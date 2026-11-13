/**
 * Read-only program recovery analysis.
 *
 * Historical audit events and denormalized summaries are evidence for review;
 * they are not permission to create or alter canonical program records.
 */

const PROGRAM_ADDED = 'PROGRAM_ADDED';

function sameId(left, right) {
  return left !== undefined && left !== null
    && right !== undefined && right !== null
    && String(left) === String(right);
}

function completeProgram(program) {
  return Boolean(
    program
    && typeof program === 'object'
    && (typeof program.id === 'string' || typeof program.id === 'number')
    && String(program.id).length > 0
    && typeof program.programName === 'string'
    && program.programName.trim()
    && typeof program.platform === 'string'
    && program.platform.trim()
    && typeof program.type === 'string'
    && program.type.trim()
  );
}

export function extractProgramFromActivity(activity) {
  const program = activity?.meta?.program;
  return completeProgram(program) ? { ...program } : null;
}

function matchesClient(activity, client) {
  return sameId(activity?.clientId, client?.id);
}

function summarizeCandidate(client, classification, action, evidence, activity, program = null) {
  return {
    customerId: client.id,
    customerDisplayName: client.fullName || null,
    existingProgramId: program?.id ?? null,
    program: program ? { ...program } : null,
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
    proposedAction: action
  };
}

/**
 * Classifies recovery candidates using only supplied snapshots; it performs no
 * Firebase reads or writes and never infers missing license values.
 */
export function buildProgramRecoveryDryRun({ clients = [], activities = [] } = {}) {
  const candidates = [];

  for (const client of clients.filter(Boolean)) {
    const programs = Array.isArray(client.programs) ? client.programs.filter(Boolean) : [];
    const clientActivities = activities.filter(activity => matchesClient(activity, client));
    const addedEvents = clientActivities.filter(activity => activity?.type === PROGRAM_ADDED);

    if (programs.length > 0) {
      const actualNames = programs.map(program => program.programName).filter(Boolean);
      const projectionMatches = Number(client.programsCount || 0) === programs.length
        && JSON.stringify(client.programNames || []) === JSON.stringify(actualNames);
      if (!projectionMatches) {
        candidates.push(summarizeCandidate(
          client,
          'B',
          'repair_projection',
          ['canonical_program_records', 'customer_summary']
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
            programs.find(program => sameId(program.id, eventProgramId))
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
          first.program
        ));
        for (const duplicate of duplicates) {
          candidates.push(summarizeCandidate(
            client,
            'E',
            'manual_review_duplicate_evidence',
            ['timeline_event_meta.program', 'duplicate_program_id'],
            duplicate.activity,
            duplicate.program
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
        addedEvents[0] || null
      ));
    } else if (addedEvents.length > 0) {
      candidates.push(summarizeCandidate(
        client,
        'D',
        'manual_review_incomplete_registration',
        ['timeline_event_without_complete_program_metadata'],
        addedEvents[0]
      ));
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    mode: 'read-only-dry-run',
    writesPerformed: 0,
    candidates,
    totals: candidates.reduce((totals, candidate) => {
      totals[candidate.classification] = (totals[candidate.classification] || 0) + 1;
      return totals;
    }, {})
  };
}

/**
 * Compatibility entry point retained for callers from older builds. Despite
 * its historical name, this function is deliberately read-only.
 */
export async function reconcileMissingPrograms() {
  const { clients, S } = await import('../state/store.js');
  return buildProgramRecoveryDryRun({
    clients,
    activities: Array.isArray(S.globalActivities) ? S.globalActivities : []
  });
}
