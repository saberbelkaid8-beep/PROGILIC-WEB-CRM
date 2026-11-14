/**
 * Program recovery dry-run, 12-classification forensic auditor, and safe batched
 * session-deduplicated reconciliation service.
 *
 * Strictly enforces Zero Fabrication: historical audit events and denormalized
 * summaries are classified honestly; operational program records are only
 * recovered from complete verified `meta.program` evidence and never synthesized
 * from `programNames`, counts, prose, or guessed dates.
 */

import { computeStats } from './mergeDatabase.js';

const PROGRAM_ADDED = 'PROGRAM_ADDED';

export const AUDIT_CLASSIFICATIONS = Object.freeze({
  CONSISTENT: 'CONSISTENT',
  PROGRAM_EXISTS_BUT_NOT_VISIBLE: 'PROGRAM_EXISTS_BUT_NOT_VISIBLE',
  PROGRAM_EXISTS_IN_SUBCOLLECTION_ONLY: 'PROGRAM_EXISTS_IN_SUBCOLLECTION_ONLY',
  PROGRAM_EXISTS_IN_SUMMARY_ONLY: 'PROGRAM_EXISTS_IN_SUMMARY_ONLY',
  TIMELINE_ONLY_RECOVERY_CANDIDATE: 'TIMELINE_ONLY_RECOVERY_CANDIDATE',
  PROGRAM_MISSING: 'PROGRAM_MISSING',
  DUPLICATE_PROGRAM: 'DUPLICATE_PROGRAM',
  CONFLICTING_PROGRAM_METADATA: 'CONFLICTING_PROGRAM_METADATA',
  INVALID_CUSTOMER_RELATIONSHIP: 'INVALID_CUSTOMER_RELATIONSHIP',
  TENANT_MISMATCH: 'TENANT_MISMATCH',
  INSUFFICIENT_RECOVERY_EVIDENCE: 'INSUFFICIENT_RECOVERY_EVIDENCE',
  PENDING_MANUAL_REVIEW: 'PENDING_MANUAL_REVIEW'
});

const completedReconciliationSessions = new Set();
const inFlightReconciliations = new Map();

export function resetReconciliationSession() {
  completedReconciliationSessions.clear();
  inFlightReconciliations.clear();
}

function sameId(left, right) {
  return left !== undefined && left !== null
    && right !== undefined && right !== null
    && String(left) === String(right);
}

function completeProgram(program) {
  return Boolean(
    program
    && typeof program === 'object'
    && !Array.isArray(program)
    && (typeof program.id === 'string' || typeof program.id === 'number')
    && String(program.id).trim().length > 0
    && typeof program.programName === 'string'
    && program.programName.trim().length > 0
    && typeof program.platform === 'string'
    && program.platform.trim().length > 0
    && typeof program.type === 'string'
    && program.type.trim().length > 0
  );
}

export function extractProgramFromActivity(activity) {
  const program = activity?.meta?.program;
  return completeProgram(program) ? { ...program } : null;
}

function matchesClient(activity, client) {
  return sameId(activity?.clientId, client?.id);
}

function normalizePlatformBucket(platform) {
  if (platform === 'Desktop' || platform === 'Mobile' || platform === 'Web' || platform === 'Hybrid') {
    return platform;
  }
  return 'Unknown';
}

function getProgramDuplicateKey(program) {
  const name = String(program?.programName || '').trim().toLowerCase();
  const platform = String(program?.platform || '').trim().toLowerCase();
  const version = String(program?.version || '').trim().toLowerCase();
  const type = String(program?.type || '').trim().toLowerCase();
  if (name || platform || type || version) {
    return `${platform}|${name}|${version}|${type}`;
  }
  return `id:${String(program?.id ?? '')}`;
}

function summarizeCandidate(client, classification, action, evidence, activity, program = null, auditClassification = null) {
  return {
    customerId: client?.id ?? null,
    customerDisplayName: client?.fullName || null,
    existingProgramId: program?.id ?? null,
    program: program ? { ...program } : null,
    platform: program?.platform || 'Unknown',
    originalTimestamp: program?.createdAt || program?.startDate || activity?.timestamp || null,
    fieldVerification: {
      programName: program?.programName ? 'verified' : 'unknown',
      platform: program?.platform ? 'verified' : 'unknown',
      version: program?.version ? 'verified' : 'unknown',
      startDate: program?.startDate ? 'verified' : 'unknown',
      endDate: program?.endDate ? 'verified' : 'unknown',
      installationsCount: Number.isFinite(Number(program?.installationsCount)) && Number(program.installationsCount) > 0 ? 'verified' : 'unknown',
      licenseType: program?.type ? 'verified' : 'unknown'
    },
    evidenceSources: evidence,
    sourceEventId: activity?.id || null,
    confidence: classification === 'C' ? 'high' : 'low',
    classification,
    auditClassification: auditClassification || AUDIT_CLASSIFICATIONS.PENDING_MANUAL_REVIEW,
    proposedAction: action
  };
}

/**
 * Classifies every customer record (including null/malformed entries) across all
 * 12 Phase 1 audit classifications and breaks down all supported platforms.
 */
export function buildForensicProgramAudit({ clients = [], activities = [], expectedTenantId = null } = {}) {
  const classificationCounts = Object.fromEntries(
    Object.values(AUDIT_CLASSIFICATIONS).map(key => [key, 0])
  );
  const platformBreakdown = {
    Desktop: 0,
    Mobile: 0,
    Web: 0,
    Hybrid: 0,
    Unknown: 0
  };
  const customerFindings = [];
  const safeActivities = Array.isArray(activities) ? activities.filter(Boolean) : [];
  const safeClients = Array.isArray(clients) ? clients : [];

  let malformedClients = 0;
  let clientsWithPrograms = 0;
  let orphanProgramDocuments = 0;

  const clientIds = new Set(
    safeClients
      .filter(c => c && typeof c === 'object' && c.id !== undefined && c.id !== null)
      .map(c => String(c.id))
  );

  for (const act of safeActivities) {
    if (act.type === PROGRAM_ADDED && act.clientId !== undefined && act.clientId !== null && !clientIds.has(String(act.clientId))) {
      orphanProgramDocuments += 1;
    }
  }

  safeClients.forEach((client, index) => {
    if (!client || typeof client !== 'object' || Array.isArray(client) || client.id === undefined || client.id === null || client.id === '') {
      malformedClients += 1;
      classificationCounts[AUDIT_CLASSIFICATIONS.INVALID_CUSTOMER_RELATIONSHIP] += 1;
      customerFindings.push({
        index,
        customerId: client?.id ?? null,
        customerDisplayName: client?.fullName || null,
        auditClassification: AUDIT_CLASSIFICATIONS.INVALID_CUSTOMER_RELATIONSHIP,
        programCount: 0,
        platforms: [],
        notes: ['Null, malformed, or ID-less client record cannot be linked safely.']
      });
      return;
    }

    const rawPrograms = Array.isArray(client.programs) ? client.programs : [];
    const validPrograms = rawPrograms.filter(p => p && typeof p === 'object');
    const hasMalformedProgramsArray = client.programs !== undefined && !Array.isArray(client.programs);
    const clientActivities = safeActivities.filter(activity => matchesClient(activity, client));
    const addedEvents = clientActivities.filter(activity => activity?.type === PROGRAM_ADDED);

    if (expectedTenantId && client.tenantId && String(client.tenantId) !== String(expectedTenantId)) {
      classificationCounts[AUDIT_CLASSIFICATIONS.TENANT_MISMATCH] += 1;
      customerFindings.push({
        index,
        customerId: client.id,
        customerDisplayName: client.fullName || null,
        auditClassification: AUDIT_CLASSIFICATIONS.TENANT_MISMATCH,
        programCount: validPrograms.length,
        platforms: validPrograms.map(p => normalizePlatformBucket(p.platform)),
        notes: [`Client tenantId "${client.tenantId}" does not match expected tenant "${expectedTenantId}".`]
      });
      return;
    }

    const tenantMismatchedAct = expectedTenantId
      ? addedEvents.find(a => a.actorUid && a.actorUid !== 'offline-tenant' && String(a.actorUid) !== String(expectedTenantId))
      : null;
    if (tenantMismatchedAct) {
      classificationCounts[AUDIT_CLASSIFICATIONS.TENANT_MISMATCH] += 1;
      customerFindings.push({
        index,
        customerId: client.id,
        customerDisplayName: client.fullName || null,
        auditClassification: AUDIT_CLASSIFICATIONS.TENANT_MISMATCH,
        programCount: validPrograms.length,
        platforms: validPrograms.map(p => normalizePlatformBucket(p.platform)),
        notes: [`Activity ${tenantMismatchedAct.id} belongs to tenant "${tenantMismatchedAct.actorUid}".`]
      });
      return;
    }

    if (hasMalformedProgramsArray) {
      classificationCounts[AUDIT_CLASSIFICATIONS.CONFLICTING_PROGRAM_METADATA] += 1;
      customerFindings.push({
        index,
        customerId: client.id,
        customerDisplayName: client.fullName || null,
        auditClassification: AUDIT_CLASSIFICATIONS.CONFLICTING_PROGRAM_METADATA,
        programCount: 0,
        platforms: [],
        notes: ['Client programs property is non-array/malformed and requires manual audit.']
      });
      return;
    }

    if (validPrograms.length > 0) {
      clientsWithPrograms += 1;
      validPrograms.forEach(p => {
        platformBreakdown[normalizePlatformBucket(p.platform)] += 1;
      });

      const invalidRelation = validPrograms.some(
        p => p.clientId !== undefined && p.clientId !== null && !sameId(p.clientId, client.id)
      );
      if (invalidRelation) {
        classificationCounts[AUDIT_CLASSIFICATIONS.INVALID_CUSTOMER_RELATIONSHIP] += 1;
        customerFindings.push({
          index,
          customerId: client.id,
          customerDisplayName: client.fullName || null,
          auditClassification: AUDIT_CLASSIFICATIONS.INVALID_CUSTOMER_RELATIONSHIP,
          programCount: validPrograms.length,
          platforms: validPrograms.map(p => normalizePlatformBucket(p.platform)),
          notes: ['Subcollection program clientId differs from parent client id.']
        });
        return;
      }

      const dupKeys = new Set();
      let hasDuplicates = false;
      for (const prog of validPrograms) {
        const dk = getProgramDuplicateKey(prog);
        if (dupKeys.has(dk)) {
          hasDuplicates = true;
          break;
        }
        dupKeys.add(dk);
      }
      if (hasDuplicates) {
        classificationCounts[AUDIT_CLASSIFICATIONS.DUPLICATE_PROGRAM] += 1;
        customerFindings.push({
          index,
          customerId: client.id,
          customerDisplayName: client.fullName || null,
          auditClassification: AUDIT_CLASSIFICATIONS.DUPLICATE_PROGRAM,
          programCount: validPrograms.length,
          platforms: validPrograms.map(p => normalizePlatformBucket(p.platform)),
          notes: ['Multiple identical program records exist under client.']
        });
        return;
      }

      const actualNames = validPrograms.map(p => p.programName).filter(Boolean);
      const summaryNames = Array.isArray(client.programNames) ? client.programNames : [];
      const countMismatch = client.programsCount !== undefined && Number(client.programsCount) !== validPrograms.length;
      const namesMismatch = client.programNames !== undefined && JSON.stringify(summaryNames) !== JSON.stringify(actualNames);

      if (Number(client.programsCount || 0) === 0 && summaryNames.length === 0 && client.programsCount !== undefined) {
        classificationCounts[AUDIT_CLASSIFICATIONS.PROGRAM_EXISTS_BUT_NOT_VISIBLE] += 1;
        customerFindings.push({
          index,
          customerId: client.id,
          customerDisplayName: client.fullName || null,
          auditClassification: AUDIT_CLASSIFICATIONS.PROGRAM_EXISTS_BUT_NOT_VISIBLE,
          programCount: validPrograms.length,
          platforms: validPrograms.map(p => normalizePlatformBucket(p.platform)),
          notes: ['Canonical programs exist but customer summary reports 0 programs.']
        });
        return;
      }

      if (countMismatch || namesMismatch || client.programsCount === undefined) {
        classificationCounts[AUDIT_CLASSIFICATIONS.PROGRAM_EXISTS_IN_SUBCOLLECTION_ONLY] += 1;
        customerFindings.push({
          index,
          customerId: client.id,
          customerDisplayName: client.fullName || null,
          auditClassification: AUDIT_CLASSIFICATIONS.PROGRAM_EXISTS_IN_SUBCOLLECTION_ONLY,
          programCount: validPrograms.length,
          platforms: validPrograms.map(p => normalizePlatformBucket(p.platform)),
          notes: ['Canonical program records diverge from or lack updated parent summary projection.']
        });
        return;
      }

      const hasTimelineConflict = addedEvents.some(act => {
        const extracted = extractProgramFromActivity(act);
        if (!extracted) return false;
        const match = validPrograms.find(p => sameId(p.id, extracted.id));
        return match && (match.programName !== extracted.programName || match.platform !== extracted.platform);
      });
      if (hasTimelineConflict) {
        classificationCounts[AUDIT_CLASSIFICATIONS.CONFLICTING_PROGRAM_METADATA] += 1;
        customerFindings.push({
          index,
          customerId: client.id,
          customerDisplayName: client.fullName || null,
          auditClassification: AUDIT_CLASSIFICATIONS.CONFLICTING_PROGRAM_METADATA,
          programCount: validPrograms.length,
          platforms: validPrograms.map(p => normalizePlatformBucket(p.platform)),
          notes: ['Timeline event metadata conflicts with canonical program document.']
        });
        return;
      }

      classificationCounts[AUDIT_CLASSIFICATIONS.CONSISTENT] += 1;
      customerFindings.push({
        index,
        customerId: client.id,
        customerDisplayName: client.fullName || null,
        auditClassification: AUDIT_CLASSIFICATIONS.CONSISTENT,
        programCount: validPrograms.length,
        platforms: validPrograms.map(p => normalizePlatformBucket(p.platform)),
        notes: []
      });
      return;
    }

    // No canonical programs on client document/subcollection
    const completeEvents = addedEvents
      .map(activity => ({ activity, program: extractProgramFromActivity(activity) }))
      .filter(candidate => candidate.program);
    const summaryHasPrograms = Number(client.programsCount) > 0
      || (Array.isArray(client.programNames) && client.programNames.length > 0);

    if (completeEvents.length > 0) {
      classificationCounts[AUDIT_CLASSIFICATIONS.TIMELINE_ONLY_RECOVERY_CANDIDATE] += 1;
      customerFindings.push({
        index,
        customerId: client.id,
        customerDisplayName: client.fullName || null,
        auditClassification: AUDIT_CLASSIFICATIONS.TIMELINE_ONLY_RECOVERY_CANDIDATE,
        programCount: 0,
        platforms: completeEvents.map(item => normalizePlatformBucket(item.program.platform)),
        notes: ['Complete verified meta.program exists in Timeline; missing from canonical program records.']
      });
      return;
    }

    if (summaryHasPrograms && addedEvents.length > 0) {
      classificationCounts[AUDIT_CLASSIFICATIONS.PROGRAM_MISSING] += 1;
      customerFindings.push({
        index,
        customerId: client.id,
        customerDisplayName: client.fullName || null,
        auditClassification: AUDIT_CLASSIFICATIONS.PROGRAM_MISSING,
        programCount: 0,
        platforms: [],
        notes: ['Both customer summary and Timeline reference a program whose canonical subcollection document is missing and incomplete.']
      });
      return;
    }

    if (summaryHasPrograms) {
      classificationCounts[AUDIT_CLASSIFICATIONS.PROGRAM_EXISTS_IN_SUMMARY_ONLY] += 1;
      customerFindings.push({
        index,
        customerId: client.id,
        customerDisplayName: client.fullName || null,
        auditClassification: AUDIT_CLASSIFICATIONS.PROGRAM_EXISTS_IN_SUMMARY_ONLY,
        programCount: 0,
        platforms: [],
        notes: ['Only summary fields (programsCount/programNames) exist without subcollection or Timeline metadata; may require manual review or cleansing.']
      });
      return;
    }

    if (addedEvents.length > 0) {
      classificationCounts[AUDIT_CLASSIFICATIONS.INSUFFICIENT_RECOVERY_EVIDENCE] += 1;
      customerFindings.push({
        index,
        customerId: client.id,
        customerDisplayName: client.fullName || null,
        auditClassification: AUDIT_CLASSIFICATIONS.INSUFFICIENT_RECOVERY_EVIDENCE,
        programCount: 0,
        platforms: [],
        notes: ['Timeline event lacks complete meta.program fields; recovery blocked against fabrication.']
      });
      return;
    }

    if (client.status === 'نشط' && Number(client.installationsCount) > 0) {
      classificationCounts[AUDIT_CLASSIFICATIONS.PENDING_MANUAL_REVIEW] += 1;
      customerFindings.push({
        index,
        customerId: client.id,
        customerDisplayName: client.fullName || null,
        auditClassification: AUDIT_CLASSIFICATIONS.PENDING_MANUAL_REVIEW,
        programCount: 0,
        platforms: [],
        notes: ['Active client reports non-zero installationsCount with zero program records or Timeline evidence.']
      });
      return;
    }

    classificationCounts[AUDIT_CLASSIFICATIONS.CONSISTENT] += 1;
    customerFindings.push({
      index,
      customerId: client.id,
      customerDisplayName: client.fullName || null,
      auditClassification: AUDIT_CLASSIFICATIONS.CONSISTENT,
      programCount: 0,
      platforms: [],
      notes: []
    });
  });

  return {
    writesPerformed: 0,
    auditedClients: safeClients.length,
    malformedClients,
    clientsWithPrograms,
    orphanProgramDocuments,
    platformBreakdown,
    classificationCounts,
    customerFindings
  };
}

/**
 * Classifies recovery candidates using only supplied snapshots; it performs no
 * Firebase reads or writes and never infers missing license values.
 */
export function buildProgramRecoveryDryRun({ clients = [], activities = [], expectedTenantId = null } = {}) {
  const candidates = [];
  const safeClients = Array.isArray(clients) ? clients.filter(Boolean) : [];
  const safeActivities = Array.isArray(activities) ? activities.filter(Boolean) : [];
  const auditSummary = buildForensicProgramAudit({ clients, activities: safeActivities, expectedTenantId });

  for (const client of safeClients) {
    const programs = Array.isArray(client.programs) ? client.programs.filter(Boolean) : [];
    const clientActivities = safeActivities.filter(activity => matchesClient(activity, client));
    const addedEvents = clientActivities.filter(activity => activity?.type === PROGRAM_ADDED);

    if (programs.length > 0) {
      const actualNames = programs.map(program => program.programName).filter(Boolean);
      const projectionMatches = Number(client.programsCount || 0) === programs.length
        && JSON.stringify(client.programNames || []) === JSON.stringify(actualNames);
      if (!projectionMatches) {
        const auditCls = Number(client.programsCount || 0) === 0 && (client.programNames || []).length === 0
          ? AUDIT_CLASSIFICATIONS.PROGRAM_EXISTS_BUT_NOT_VISIBLE
          : AUDIT_CLASSIFICATIONS.PROGRAM_EXISTS_IN_SUBCOLLECTION_ONLY;
        candidates.push(summarizeCandidate(
          client,
          'B',
          'repair_projection',
          ['canonical_program_records', 'customer_summary'],
          null,
          null,
          auditCls
        ));
      }

      for (const activity of addedEvents) {
        const eventProgramId = activity?.meta?.programId ?? activity?.meta?.program?.id;
        if (eventProgramId !== undefined && programs.some(program => sameId(program.id, eventProgramId))) {
          candidates.push(summarizeCandidate(
            client,
            'E',
            'no_change_duplicate_event',
            ['canonical_program_records', 'timeline_event'],
            activity,
            programs.find(program => sameId(program.id, eventProgramId)),
            AUDIT_CLASSIFICATIONS.DUPLICATE_PROGRAM
          ));
        }
      }
      continue;
    }

    const completeEvents = addedEvents
      .map(activity => ({ activity, program: extractProgramFromActivity(activity) }))
      .filter(candidate => candidate.program);

    if (completeEvents.length > 0) {
      const byProgramId = new Map();
      for (const item of completeEvents) {
        const key = String(item.program.id);
        const matches = byProgramId.get(key) || [];
        matches.push(item);
        byProgramId.set(key, matches);
      }
      for (const matches of byProgramId.values()) {
        const [first, ...duplicates] = matches;
        candidates.push(summarizeCandidate(
          client,
          'C',
          'recover_record_after_backup_and_approval',
          ['timeline_event_meta.program'],
          first.activity,
          first.program,
          AUDIT_CLASSIFICATIONS.TIMELINE_ONLY_RECOVERY_CANDIDATE
        ));
        for (const duplicate of duplicates) {
          candidates.push(summarizeCandidate(
            client,
            'E',
            'manual_review_duplicate_evidence',
            ['timeline_event_meta.program', 'duplicate_program_id'],
            duplicate.activity,
            duplicate.program,
            AUDIT_CLASSIFICATIONS.DUPLICATE_PROGRAM
          ));
        }
      }
      continue;
    }

    const summaryHasPrograms = Number(client.programsCount) > 0
      || (Array.isArray(client.programNames) && client.programNames.length > 0);
    if (summaryHasPrograms) {
      candidates.push(summarizeCandidate(
        client,
        'F',
        'manual_review',
        ['customer_summary', ...(addedEvents.length ? ['incomplete_timeline_event'] : [])],
        addedEvents[0] || null,
        null,
        addedEvents.length ? AUDIT_CLASSIFICATIONS.PROGRAM_MISSING : AUDIT_CLASSIFICATIONS.PROGRAM_EXISTS_IN_SUMMARY_ONLY
      ));
    } else if (addedEvents.length > 0) {
      candidates.push(summarizeCandidate(
        client,
        'D',
        'manual_review_incomplete_registration',
        ['timeline_event_without_complete_program_metadata'],
        addedEvents[0],
        null,
        AUDIT_CLASSIFICATIONS.INSUFFICIENT_RECOVERY_EVIDENCE
      ));
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    mode: 'read-only-dry-run',
    writesPerformed: 0,
    candidates,
    auditSummary,
    totals: candidates.reduce((totals, candidate) => {
      totals[candidate.classification] = (totals[candidate.classification] || 0) + 1;
      return totals;
    }, {})
  };
}

/**
 * Session-deduplicated, batched reconciliation for verified recovery candidates
 * (`classification === 'C'`) and cleansing of unverified phantom summaries.
 * Never fabricates missing programs from `programNames`, counts, or dates.
 */
export async function reconcileMissingPrograms(uid = null) {
  const { clients, setClients, updateState, S, currentUser } = await import('../state/store.js');
  const firebaseService = await import('../firebase/service.js');

  const sessionKey = String(uid || currentUser?.tenantId || currentUser?.uid || 'default-session');

  if (inFlightReconciliations.has(sessionKey)) {
    return inFlightReconciliations.get(sessionKey);
  }

  if (completedReconciliationSessions.has(sessionKey)) {
    return {
      reconciledCount: 0,
      cleanedCount: 0,
      candidates: [],
      totals: {},
      skipped: true
    };
  }

  const runPromise = (async () => {
    const currentClients = Array.isArray(clients) ? clients : [];
    const activities = Array.isArray(S.globalActivities) ? S.globalActivities : [];
    const dryRun = buildProgramRecoveryDryRun({
      clients: currentClients,
      activities,
      expectedTenantId: sessionKey !== 'default-session' ? sessionKey : null
    });

    const verifiedCandidates = dryRun.candidates.filter(
      c => c.classification === 'C' && c.program && c.customerId !== null && c.customerId !== undefined
    );

    const programsByClientId = new Map();
    for (const candidate of verifiedCandidates) {
      const cidKey = String(candidate.customerId);
      const list = programsByClientId.get(cidKey) || [];
      if (!list.some(p => sameId(p.id, candidate.program.id))) {
        list.push({ ...candidate.program });
      }
      programsByClientId.set(cidKey, list);
    }

    const batchEntries = [];
    let cleanedCount = 0;

    const nextClients = currentClients.map(client => {
      if (!client || typeof client !== 'object') return client;
      const cidKey = String(client.id);
      const existingPrograms = Array.isArray(client.programs) ? client.programs : [];
      const recovered = programsByClientId.get(cidKey) || [];

      if (recovered.length > 0) {
        const mergedPrograms = [...existingPrograms];
        for (const prog of recovered) {
          if (!mergedPrograms.some(p => sameId(p.id, prog.id))) {
            mergedPrograms.push(prog);
          }
        }
        const totalInstalls = mergedPrograms.reduce((sum, p) => {
          const count = Number(p?.installationsCount);
          return Number.isFinite(count) && count > 0 ? sum + count : sum;
        }, 0);
        const programNames = mergedPrograms.map(p => p.programName).filter(Boolean);
        const counterUpdates = {
          programsCount: mergedPrograms.length,
          installationsCount: totalInstalls,
          programNames
        };

        for (const prog of recovered) {
          batchEntries.push({
            clientId: client.id,
            collectionName: 'programs',
            itemId: String(prog.id),
            itemData: prog,
            counterUpdates,
            existingClientData: client
          });
        }

        return {
          ...client,
          programs: mergedPrograms,
          programsCount: mergedPrograms.length,
          installationsCount: totalInstalls,
          programNames,
          _subcollectionsLoaded: true
        };
      }

      // Cleanse unverified phantom summary metadata on clients that have zero programs and zero timeline traces
      const hasAddedTrace = activities.some(act => act?.type === PROGRAM_ADDED && matchesClient(act, client));
      const hasPhantomSummary = existingPrograms.length === 0 && !hasAddedTrace && (
        Number(client.programsCount || 0) > 0
        || (Array.isArray(client.programNames) && client.programNames.length > 0)
        || Number(client.installationsCount || 0) > 0
      );

      if (hasPhantomSummary) {
        cleanedCount += 1;
        return {
          ...client,
          programs: [],
          programsCount: 0,
          installationsCount: 0,
          programNames: [],
          _subcollectionsLoaded: true
        };
      }

      return client;
    });

    if (batchEntries.length > 0 && typeof firebaseService.saveClientSubItemsBatch === 'function') {
      await firebaseService.saveClientSubItemsBatch(sessionKey, batchEntries);
    }

    if (batchEntries.length > 0 || cleanedCount > 0) {
      const nextStats = computeStats(nextClients).stats;
      setClients(nextClients);
      updateState({ stats: nextStats });
    }

    completedReconciliationSessions.add(sessionKey);

    return {
      reconciledCount: batchEntries.length,
      cleanedCount,
      candidates: dryRun.candidates,
      totals: dryRun.totals,
      auditSummary: dryRun.auditSummary
    };
  })().finally(() => {
    inFlightReconciliations.delete(sessionKey);
  });

  inFlightReconciliations.set(sessionKey, runPromise);
  return runPromise;
}

function stableHash(input) {
  let h = 2166136261;
  const str = String(input || '');
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36).padStart(7, '0');
}

/**
 * Generates a deterministic, collision-resistant recovery ID when an original
 * Timeline event has complete program fields but lacks an explicit programId.
 */
export function generateDeterministicRecoveryId(clientId, program, fallbackTimestamp = '') {
  const sig = [
    String(clientId ?? ''),
    String(program?.platform || '').trim().toLowerCase(),
    String(program?.programName || '').trim().toLowerCase(),
    String(program?.type || '').trim().toLowerCase(),
    String(program?.version || '').trim().toLowerCase(),
    String(program?.startDate || '').trim(),
    String(fallbackTimestamp || program?.createdAt || '').trim()
  ].join('|');
  return `rec_${stableHash(sig)}_${stableHash(sig.split('').reverse().join(''))}`;
}

function getMissingProgramFields(raw) {
  const missing = [];
  if (!raw || typeof raw !== 'object') {
    return ['programName', 'platform', 'type'];
  }
  if (!raw.programName || !String(raw.programName).trim()) missing.push('programName');
  if (!raw.platform || !String(raw.platform).trim()) missing.push('platform');
  if (!raw.type || !String(raw.type).trim()) missing.push('type');
  return missing;
}

/**
 * Extracts a recoverable program from Timeline `meta.program`. Reuses original
 * `id`/`programId` if present, or deterministically assigns a collision-resistant
 * recovery ID when all core fields (`programName`, `platform`, `type`) are present.
 */
export function extractRecoverableProgramFromActivity(activity, clientId) {
  const raw = activity?.meta?.program;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { program: null, missingFields: ['meta.program'], usedDeterministicId: false };
  }
  const missingFields = getMissingProgramFields(raw);
  if (missingFields.length > 0) {
    return { program: null, missingFields, usedDeterministicId: false };
  }

  const explicitId = raw.id ?? activity?.meta?.programId;
  const hasExplicitId = explicitId !== undefined && explicitId !== null && String(explicitId).trim().length > 0;
  const resolvedId = hasExplicitId
    ? explicitId
    : generateDeterministicRecoveryId(clientId, raw, activity?.timestamp || '');

  return {
    program: {
      ...raw,
      id: resolvedId
    },
    missingFields: [],
    usedDeterministicId: !hasExplicitId
  };
}

/**
 * Scenario D — Classifies local / pending offline queue program mutations
 * against remote cloud snapshots without overwriting legitimate offline writes.
 */
export function classifyPendingLocalPrograms({ clients = [], remoteClients = [], syncQueue = [] } = {}) {
  const remoteMap = new Map((Array.isArray(remoteClients) ? remoteClients : []).filter(Boolean).map(c => [String(c.id), c]));
  const queue = Array.isArray(syncQueue) ? syncQueue.filter(Boolean) : [];
  const classifications = [];

  for (const op of queue) {
    if (op.type === 'ADD_CLIENT') {
      const c = op.payload?.clientData;
      if (!c) continue;
      const progs = Array.isArray(c.programs) ? c.programs : [];
      const remoteMatch = remoteMap.get(String(c.id));
      for (const prog of progs) {
        const remoteHas = Array.isArray(remoteMatch?.programs) && remoteMatch.programs.some(
          rp => sameId(rp.id, prog.id) || getProgramDuplicateKey(rp) === getProgramDuplicateKey(prog)
        );
        const status = remoteHas
          ? 'duplicate'
          : (op.state === 'failed' || op.state === 'requires-attention' ? 'failed_previous_sync' : 'legitimate_unsynced');
        classifications.push({
          clientId: c.id,
          programId: prog.id,
          programName: prog.programName || null,
          platform: prog.platform || 'Unknown',
          operationType: op.type,
          queueState: op.state || 'pending',
          classification: status,
          program: { ...prog }
        });
      }
    } else if (op.type === 'SAVE_SUB_ITEM' && op.payload?.collectionName === 'programs') {
      const clientId = op.payload.clientId;
      const prog = op.payload.itemData;
      if (!prog) continue;
      const remoteMatch = remoteMap.get(String(clientId));
      const remoteProgs = Array.isArray(remoteMatch?.programs) ? remoteMatch.programs : [];
      const exactIdMatch = remoteProgs.find(rp => sameId(rp.id, prog.id));
      const dupMatch = remoteProgs.find(rp => getProgramDuplicateKey(rp) === getProgramDuplicateKey(prog));

      let status = 'legitimate_unsynced';
      if (op.state === 'failed' || op.state === 'requires-attention') {
        status = 'failed_previous_sync';
      } else if (exactIdMatch && dupMatch) {
        const opTs = Date.parse(prog.updatedAt || op.timestamp || 0) || 0;
        const remoteTs = Date.parse(exactIdMatch.updatedAt || 0) || 0;
        status = remoteTs > opTs ? 'stale' : 'duplicate';
      } else if (dupMatch && !exactIdMatch) {
        status = 'duplicate';
      }

      classifications.push({
        clientId,
        programId: prog.id,
        programName: prog.programName || null,
        platform: prog.platform || 'Unknown',
        operationType: op.type,
        queueState: op.state || 'pending',
        classification: status,
        program: { ...prog }
      });
    } else if (op.type === 'DELETE_SUB_ITEM' && op.payload?.collectionName === 'programs') {
      classifications.push({
        clientId: op.payload.clientId,
        programId: op.payload.itemId,
        programName: null,
        platform: 'Unknown',
        operationType: op.type,
        queueState: op.state || 'pending',
        classification: 'stale',
        program: null
      });
    }
  }

  // Also check local clients whose programs exist only locally without a queue item
  for (const localClient of (Array.isArray(clients) ? clients : []).filter(Boolean)) {
    const remoteClient = remoteMap.get(String(localClient.id));
    const localProgs = Array.isArray(localClient.programs) ? localClient.programs : [];
    const remoteProgs = Array.isArray(remoteClient?.programs) ? remoteClient.programs : [];
    for (const lp of localProgs) {
      const inRemote = remoteProgs.some(rp => sameId(rp.id, lp.id));
      const inQueue = classifications.some(c => sameId(c.clientId, localClient.id) && sameId(c.programId, lp.id));
      if (!inRemote && !inQueue) {
        classifications.push({
          clientId: localClient.id,
          programId: lp.id,
          programName: lp.programName || null,
          platform: lp.platform || 'Unknown',
          operationType: 'LOCAL_ONLY_UNQUEUED',
          queueState: 'untracked',
          classification: 'stale',
          program: { ...lp }
        });
      }
    }
  }

  return classifications;
}

/**
 * Scenario A — Repairs missing/divergent customer summary projections
 * (`programsCount`, `installationsCount`, `programNames`) when canonical programs
 * already exist, without creating duplicate program documents.
 */
export function repairProgramProjections(clients = []) {
  const repairedIds = [];
  const nextClients = (Array.isArray(clients) ? clients : []).map(client => {
    if (!client || typeof client !== 'object') return client;
    const programs = Array.isArray(client.programs) ? client.programs.filter(Boolean) : [];
    if (programs.length === 0) return client;

    const programNames = programs.map(p => p.programName).filter(Boolean);
    const totalInstalls = programs.reduce((sum, p) => {
      const count = Number(p?.installationsCount);
      return Number.isFinite(count) && count > 0 ? sum + count : sum;
    }, 0);

    const needsRepair = Number(client.programsCount || 0) !== programs.length
      || Number(client.installationsCount || 0) !== totalInstalls
      || JSON.stringify(client.programNames || []) !== JSON.stringify(programNames)
      || client._subcollectionsLoaded !== true;

    if (!needsRepair) return client;

    repairedIds.push(client.id);
    return {
      ...client,
      programsCount: programs.length,
      installationsCount: totalInstalls,
      programNames,
      _subcollectionsLoaded: true
    };
  });

  return { repairedIds, nextClients };
}

function buildVerifiedBackupCheck(backupVerified, backupSnapshot) {
  if (backupVerified !== true) {
    return { ok: false, reason: 'backupVerified must be explicitly true before Phase 2 recovery writes.' };
  }
  if (!backupSnapshot || typeof backupSnapshot !== 'object') {
    return { ok: false, reason: 'backupSnapshot object is required before Phase 2 recovery writes.' };
  }
  const hasSnapshotId = typeof backupSnapshot.id === 'string' && backupSnapshot.id.trim().length > 0;
  const hasClientsArray = Array.isArray(backupSnapshot.clients);
  if (!hasSnapshotId && !hasClientsArray) {
    return { ok: false, reason: 'backupSnapshot must contain a verified id or clients array.' };
  }
  return { ok: true };
}

/**
 * PHASE 2 Controlled Program Recovery (Scenarios A through E).
 *
 * Strictly enforces:
 * - Explicit operator approval (`approved === true`)
 * - Verified backup pre-condition (`backupVerified === true` and valid `backupSnapshot`)
 * - Zero fabrication (incomplete Timeline/Summary records go to `manualReview`)
 * - Idempotency (matches existing programs by original ID or duplicate key across Desktop, Mobile, Web, Hybrid)
 * - Scenario D offline sync queue protection
 */
export async function executeControlledProgramRecovery({
  uid = null,
  clients = [],
  activities = [],
  pendingQueue = [],
  explicitRecords = [],
  approved = false,
  backupVerified = false,
  backupSnapshot = null,
  expectedTenantId = null,
  batchWriter = null
} = {}) {
  const safeClients = Array.isArray(clients) ? clients : [];
  const safeActivities = Array.isArray(activities) ? activities.filter(Boolean) : [];
  const safeQueue = Array.isArray(pendingQueue) ? pendingQueue.filter(Boolean) : [];
  const safeExplicit = Array.isArray(explicitRecords) ? explicitRecords.filter(Boolean) : [];

  if (approved !== true) {
    return {
      status: 'blocked',
      reason: 'Explicit approval (approved === true) is required before Phase 2 recovery writes.',
      writesPerformed: 0,
      repairedProjections: [],
      restored: [],
      protectedLocal: [],
      manualReview: [],
      duplicateSkipped: [],
      recoveryReportRows: [],
      nextClients: safeClients
    };
  }

  const backupCheck = buildVerifiedBackupCheck(backupVerified, backupSnapshot);
  if (!backupCheck.ok) {
    return {
      status: 'blocked',
      reason: backupCheck.reason,
      writesPerformed: 0,
      repairedProjections: [],
      restored: [],
      protectedLocal: [],
      manualReview: [],
      duplicateSkipped: [],
      recoveryReportRows: [],
      nextClients: safeClients
    };
  }

  // Scenario D: Protect pending legitimate offline queue programs first
  const pendingClassifications = classifyPendingLocalPrograms({
    clients: safeClients,
    remoteClients: safeClients,
    syncQueue: safeQueue
  });
  const protectedLocal = pendingClassifications.filter(item => item.classification === 'legitimate_unsynced');

  // Scenario A: Repair parent summary projections where canonical programs already exist
  const { repairedIds, nextClients: projectionRepairedClients } = repairProgramProjections(safeClients);
  const repairedProjections = [];
  const restored = [];
  const manualReview = [];
  const duplicateSkipped = [];
  const recoveryReportRows = [];
  const batchEntries = [];

  for (const cid of repairedIds) {
    const client = projectionRepairedClients.find(c => c && sameId(c.id, cid));
    if (!client) continue;
    repairedProjections.push({ customerId: client.id, programsCount: client.programsCount });
    for (const p of (client.programs || [])) {
      recoveryReportRows.push({
        customerId: client.id,
        customerName: client.fullName || '',
        programId: p.id,
        programName: p.programName || '',
        platform: p.platform || 'Unknown',
        version: p.version || '',
        originalLocation: 'Subcollection',
        recoveryAction: 'Linked',
        verification: 'Passed',
        evidence: 'canonical_program_records -> parent_summary_repaired'
      });
    }
  }

  const updatedClients = projectionRepairedClients.map(client => {
    if (!client || typeof client !== 'object' || client.id === undefined || client.id === null) {
      return client;
    }

    // Tenant isolation check
    if (expectedTenantId && client.tenantId && String(client.tenantId) !== String(expectedTenantId)) {
      return client;
    }

    const existingPrograms = Array.isArray(client.programs) ? [...client.programs] : [];
    const clientActivities = safeActivities.filter(act => matchesClient(act, client) && act.type === PROGRAM_ADDED);
    const clientExplicit = safeExplicit.filter(rec => sameId(rec.customerId ?? rec.clientId, client.id));
    const clientPending = protectedLocal.filter(item => sameId(item.clientId, client.id));

    for (const pend of clientPending) {
      recoveryReportRows.push({
        customerId: client.id,
        customerName: client.fullName || '',
        programId: pend.programId,
        programName: pend.programName || '',
        platform: pend.platform || 'Unknown',
        version: pend.program?.version || '',
        originalLocation: 'Local',
        recoveryAction: 'Already present',
        verification: 'Pending',
        evidence: `pending_sync_queue:${pend.operationType}`
      });
    }

    const newlyRecoveredForClient = [];

    // Scenario C & E: Extract all independently verified Timeline programs for this customer
    for (const activity of clientActivities) {
      if (expectedTenantId && activity.actorUid && activity.actorUid !== 'offline-tenant' && String(activity.actorUid) !== String(expectedTenantId)) {
        manualReview.push({
          customerId: client.id,
          customerName: client.fullName || '',
          sourceEventId: activity.id || null,
          reason: 'TENANT_MISMATCH',
          missingFields: []
        });
        continue;
      }

      const { program, missingFields, usedDeterministicId } = extractRecoverableProgramFromActivity(activity, client.id);
      if (!program) {
        manualReview.push({
          customerId: client.id,
          customerName: client.fullName || '',
          sourceEventId: activity.id || null,
          reason: 'INCOMPLETE_TIMELINE_METADATA',
          missingFields
        });
        recoveryReportRows.push({
          customerId: client.id,
          customerName: client.fullName || '',
          programId: activity?.meta?.programId || 'N/A',
          programName: activity?.meta?.program?.programName || '',
          platform: activity?.meta?.program?.platform || 'Unknown',
          version: activity?.meta?.program?.version || '',
          originalLocation: 'Timeline',
          recoveryAction: 'Manual review',
          verification: 'Pending',
          evidence: `timeline_event:${activity.id || 'unknown'} (missing: ${missingFields.join(', ')})`
        });
        continue;
      }

      const combinedSoFar = [...existingPrograms, ...newlyRecoveredForClient];
      const dupMatch = combinedSoFar.find(
        ep => sameId(ep.id, program.id) || getProgramDuplicateKey(ep) === getProgramDuplicateKey(program)
      );
      if (dupMatch) {
        duplicateSkipped.push({
          customerId: client.id,
          programId: dupMatch.id,
          programName: program.programName,
          platform: program.platform,
          reason: 'ALREADY_EXISTS'
        });
        continue;
      }

      const recoveredRecord = {
        ...program,
        clientId: client.id,
        recoveredFrom: usedDeterministicId ? 'timeline_deterministic_id' : 'timeline_original_id'
      };
      newlyRecoveredForClient.push(recoveredRecord);
      restored.push({
        customerId: client.id,
        customerName: client.fullName || '',
        program: recoveredRecord,
        usedDeterministicId,
        sourceEventId: activity.id || null
      });
      recoveryReportRows.push({
        customerId: client.id,
        customerName: client.fullName || '',
        programId: recoveredRecord.id,
        programName: recoveredRecord.programName,
        platform: recoveredRecord.platform,
        version: recoveredRecord.version || '',
        originalLocation: 'Timeline',
        recoveryAction: 'Restored',
        verification: 'Passed',
        evidence: `timeline_event:${activity.id || 'verified_meta'}`
      });
    }

    // Also process explicit pre-verified recovery records (e.g. approved CSV entries with complete fields)
    for (const exp of clientExplicit) {
      const candidateProg = exp.program || exp;
      const missingFields = getMissingProgramFields(candidateProg);
      if (missingFields.length > 0) {
        manualReview.push({
          customerId: client.id,
          customerName: client.fullName || '',
          sourceEventId: exp.sourceId || null,
          reason: 'INCOMPLETE_EXPLICIT_RECORD',
          missingFields
        });
        continue;
      }
      const combinedSoFar = [...existingPrograms, ...newlyRecoveredForClient];
      const explicitId = candidateProg.id ?? generateDeterministicRecoveryId(client.id, candidateProg, 'explicit');
      const resolvedProg = { ...candidateProg, id: explicitId, clientId: client.id };
      const dupMatch = combinedSoFar.find(
        ep => sameId(ep.id, resolvedProg.id) || getProgramDuplicateKey(ep) === getProgramDuplicateKey(resolvedProg)
      );
      if (dupMatch) {
        duplicateSkipped.push({
          customerId: client.id,
          programId: dupMatch.id,
          programName: resolvedProg.programName,
          platform: resolvedProg.platform,
          reason: 'ALREADY_EXISTS'
        });
        continue;
      }
      newlyRecoveredForClient.push(resolvedProg);
      restored.push({
        customerId: client.id,
        customerName: client.fullName || '',
        program: resolvedProg,
        usedDeterministicId: candidateProg.id === undefined,
        sourceEventId: exp.sourceId || 'explicit_record'
      });
      recoveryReportRows.push({
        customerId: client.id,
        customerName: client.fullName || '',
        programId: resolvedProg.id,
        programName: resolvedProg.programName,
        platform: resolvedProg.platform,
        version: resolvedProg.version || '',
        originalLocation: 'Summary',
        recoveryAction: 'Restored',
        verification: 'Passed',
        evidence: exp.evidence || 'verified_explicit_record'
      });
    }

    // Scenario B: Summary exists without any canonical, Timeline, or explicit record -> Manual review (never fabricate!)
    const allPrograms = [...existingPrograms, ...newlyRecoveredForClient];
    const summaryHasPrograms = Number(client.programsCount) > 0 || (Array.isArray(client.programNames) && client.programNames.length > 0);
    if (allPrograms.length === 0 && summaryHasPrograms) {
      manualReview.push({
        customerId: client.id,
        customerName: client.fullName || '',
        sourceEventId: null,
        reason: 'SUMMARY_ONLY_INSUFFICIENT_FIELDS',
        missingFields: ['programId', 'platform', 'type', 'installationsCount']
      });
      recoveryReportRows.push({
        customerId: client.id,
        customerName: client.fullName || '',
        programId: 'N/A',
        programName: Array.isArray(client.programNames) ? client.programNames.join(' + ') : '',
        platform: 'Unknown',
        version: '',
        originalLocation: 'Summary',
        recoveryAction: 'Manual review',
        verification: 'Pending',
        evidence: 'customer_summary_only_zero_fabrication'
      });
    }

    if (newlyRecoveredForClient.length === 0) {
      return client;
    }

    const totalInstalls = allPrograms.reduce((sum, p) => {
      const count = Number(p?.installationsCount);
      return Number.isFinite(count) && count > 0 ? sum + count : sum;
    }, 0);
    const programNames = allPrograms.map(p => p.programName).filter(Boolean);
    const counterUpdates = {
      programsCount: allPrograms.length,
      installationsCount: totalInstalls,
      programNames
    };

    for (const prog of newlyRecoveredForClient) {
      batchEntries.push({
        clientId: client.id,
        collectionName: 'programs',
        itemId: String(prog.id),
        itemData: prog,
        counterUpdates,
        existingClientData: client
      });
    }

    return {
      ...client,
      programs: allPrograms,
      programsCount: allPrograms.length,
      installationsCount: totalInstalls,
      programNames,
      _subcollectionsLoaded: true
    };
  });

  if (batchEntries.length > 0 && typeof batchWriter === 'function') {
    await batchWriter(uid || expectedTenantId || 'recovery-session', batchEntries);
  }

  return {
    status: 'completed',
    backupSnapshotId: backupSnapshot.id || 'verified-snapshot',
    writesPerformed: batchEntries.length,
    batchEntries,
    repairedProjections,
    restored,
    protectedLocal,
    manualReview,
    duplicateSkipped,
    recoveryReportRows,
    nextClients: updatedClients,
    stats: computeStats(updatedClients).stats
  };
}

