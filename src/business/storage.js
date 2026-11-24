import { td, getProgramStats } from '../utils/index.js';
import { showToast } from '../utils/toast.js';
import { showConfirm } from '../utils/confirm.js';
import { t } from '../utils/i18n.js';
import { computeScore } from './intelligence.js';
import { ActivityType, logActivity, resetTimelineSyncGuards } from './timelineService.js';
import { R } from '../presentation/render-core.js';
import { 
  S, 
  clients, 
  setClients, 
  updateState, 
  currentUser,
  hasPermission,
  isGerant,
  setStaffUsers,
  setSyncing,
  setLastSyncedTime,
  setLoading,
  setSaveError,
  _isSyncing,
  _lastSyncedTime,
  _saveError,
  notify,
  subscribe,
  batch,
  getActiveTenantId
} from '../state/store.js';
import { createDefaultGerant } from '../constants/index.js';
import {
  getUserDataStrict,
  getUserData,
  saveUserData,
  getClientsPage,
  getClientSubcollections,
  subscribeClientSubcollections,
  subscribeEmployeesForTenant,
  subscribeTenantActivities,
  addClientTransaction,
  updateClientTransaction,
  deleteClientTransaction,
  saveClientSubItemTransaction,
  deleteClientSubItemTransaction,
  syncProgramVersionTransaction,
  classifyFirestoreError
} from '../firebase/service.js';
import { migrateLegacyDataIfNeeded } from '../firebase/migration.js';
import { onSnapshot, doc, collection, writeBatch } from 'firebase/firestore';
import { db, auth } from '../firebase/config.js';
import { mergeClientLists, computeStats, mergeWithSessionAndUser } from './mergeDatabase.js';
import { reconcileClientPrograms, extractDeletedProgramsFromActivities, parseProgramFromActivity, isProgramDeletedAfter, getClientProgramsPurgeCutoff } from './programRecovery.js';
import {
  getPendingSyncStorageKey,
  isQueueableSyncError,
  extractMutationClientId,
  getPendingClientIds,
  coalescePendingMutation,
  overlayPendingMutationsOnClients,
  advanceQueuedMutationVersions
} from './syncQueueUtils.js';

import { createSnapshotBackup, checkAndTriggerPeriodicBackup } from './backupService.js';

const SCHEMA_VERSION = 3;

// Re-export the live bindings directly from store.js for full backward compatibility
export { _isSyncing, _lastSyncedTime, _saveError };

const _LEGACY_BTYPE_MAP = {
  'تجارة التجزئة': 'تجارة تجزئة',
  'تجارة بالجملة': 'تجارة جملة',
  'مطعم / مقهى': 'مطاعم وفنادق',
  'مؤسسة خدمات': 'خدمات ومهن حرة',
  'صناعة / إنتاج': 'إنتاج وصناعة'
};

const _LEGACY_BFIELD_MAP = {
  'سوبر ماركت': 'سوبرماركت / بقالة',
  'مواد غذائية': 'سوبرماركت / بقالة',
  'مواد تجميل': 'عطور وتجميل',
  'قطع غيار': 'قطع غيار سيارات',
  'أجهزة إلكترونية': 'إلكترونيات وكهرومنزلية',
  'مواد بناء': 'خردوات ومواد بناء',
  'صيدلية': 'صيدلية / شبه صيدلي'
};

export function migrateSchema(d) {
  if (!d) return null;
  if (Array.isArray(d)) {
    d = { clients: d };
  } else if (!Array.isArray(d.clients)) {
    const list = d.data || d.records || d.rows || d.items || d.customers || d.donnees || d['العملاء'] || d['عملاء'] || d.clients_list || d.table_clients || (d.backup && d.backup.clients) || (d.snapshot && d.snapshot.clients) || (d.payload && d.payload.clients);
    if (Array.isArray(list)) {
      d = { ...d, clients: list };
    } else {
      const vals = Object.values(d).filter(v => v && typeof v === 'object' && !Array.isArray(v));
      const clientLike = vals.filter(v => v && (v.fullName || v.name || v.company || v.phone || v.wilaya || v.location || v.id));
      if (clientLike.length > 0) {
        d = { ...d, clients: clientLike };
      } else {
        d = { ...d, clients: [] };
      }
    }
  }
  d.clients = d.clients.map((c, idx) => {
    if (!c || typeof c !== 'object') return null;
    if (!c.id) c.id = Date.now() + idx + Math.floor(Math.random() * 9999);
    if (!c.fullName && c.name) c.fullName = c.name;
    if (!c.fullName) c.fullName = `عميل ${idx + 1}`;
    if (!c.company) c.company = '';
    if (!c.phone) c.phone = '';
    if (!c.wilaya) c.wilaya = '';
    if (!c.commune) c.commune = '';
    if (!c.location) c.location = '';
    if (!c.status) c.status = 'نشط';
    if (!c.startDate) c.startDate = '';
    if (!c.endDate) c.endDate = '';
    if (!c.lastContact) c.lastContact = '';
    if (!c.notes) c.notes = '';
    if (!c.gps) c.gps = { lat: null, lng: null };
    if (!c.businessType) c.businessType = '';
    if (!c.businessField) c.businessField = '';
    if (!Array.isArray(c.issues)) c.issues = [];
    if (!Array.isArray(c.requirements)) c.requirements = [];
    if (c.status === 'تجريبي') c.status = 'محتمل';
    if (c.status === 'مفقود') c.status = 'متوقف';

    if (c.businessType && _LEGACY_BTYPE_MAP[c.businessType]) {
      const newField = c.businessField && _LEGACY_BFIELD_MAP[c.businessField] ? _LEGACY_BFIELD_MAP[c.businessField] : c.businessField;
      c.businessType = _LEGACY_BTYPE_MAP[c.businessType];
      c.businessField = newField || '';
    }

    if (!Array.isArray(c.contactHistory)) {
      c.contactHistory = c.lastContact
          ? [{ id: Date.now() + Math.floor(Math.random() * 999), date: c.lastContact, note: "(مُرحَّل تلقائياً من آخر تواصل)" }]
          : [];
    }
    delete c.monthlyValue;
    if (!Array.isArray(c.programs)) { c.programs = []; }
    if (c.programs.length === 0 && (c.product || c.contractType)) {
      const typeMap = { 'شهري': 'تجاري', 'سنوي': 'تجاري', 'تجريبي': 'تجاري', 'مرة واحدة': 'تجاري' };
      c.programs.push({
        id: Date.now() + Math.floor(Math.random() * 999),
        programName: c.product || 'غير محدد',
        platform: 'Desktop',
        type: typeMap[c.contractType] || 'تجاري',
        installationsCount: 1,
        startDate: c.startDate || '',
        endDate: c.endDate || ''
      });
    }
    delete c.product; delete c.contractType;

    c.issues = c.issues.map(i => {
      if (i.confidence === undefined) i.confidence = 50;
      if (i.source === undefined) i.source = 'غير محدد';
      if (i.featureOpp === undefined) i.featureOpp = false;
      if (i.solution === undefined) i.solution = '';
      return i;
    });
    return c;
  }).filter(Boolean);
  return d;
}

// Global sanitize functions for export / data integrity
export function sanitizeProgram(p) {
  return {
    id: p.id || Date.now() + Math.floor(Math.random() * 999),
    programName: p.programName || 'غير محدد',
    platform: p.platform || 'Desktop',
    type: p.type || 'تجاري',
    installationsCount: Number(p.installationsCount) || 1,
    startDate: p.startDate || '',
    endDate: p.endDate || ''
  };
}

export function sanitizeIssue(i) {
  return {
    id: i.id || Date.now() + Math.floor(Math.random() * 999),
    title: i.title || '',
    type: i.type || 'خطأ تقني',
    priority: i.priority || 'متوسطة',
    status: i.status || 'مفتوح',
    repeatCount: Number(i.repeatCount) || 1,
    featureOpp: !!i.featureOpp,
    source: i.source || 'غير محدد',
    confidence: Number(i.confidence) || 50,
    date: i.date || '',
    notes: i.notes || '',
    solution: i.solution || ''
  };
}

export function sanitizeReq(r) {
  return {
    id: r.id || Date.now() + Math.floor(Math.random() * 999),
    title: r.title || '',
    type: r.type || 'ميزة جديدة',
    priority: r.priority || 'متوسطة',
    status: r.status || 'مقترح',
    impact: r.impact || 'متوسط',
    date: r.date || '',
    notes: r.notes || ''
  };
}

export function sanitizeContact(ch) {
  return {
    id: ch.id || Date.now() + Math.floor(Math.random() * 999),
    date: ch.date || '',
    note: ch.note || ''
  };
}

export function sanitizeClient(c) {
  return {
    id: c.id,
    fullName: c.fullName || '',
    phone: c.phone || '',
    company: c.company || '',
    wilaya: c.wilaya || '',
    location: c.location || '',
    businessType: c.businessType || '',
    businessField: c.businessField || '',
    status: c.status || 'نشط',
    startDate: c.startDate || '',
    endDate: c.endDate || '',
    lastContact: c.lastContact || '',
    notes: c.notes || '',
    gps: c.gps || { lat: null, lng: null },
    score: c.score || 100,
    programs: (c.programs || []).map(sanitizeProgram),
    issues: (c.issues || []).map(sanitizeIssue),
    requirements: (c.requirements || []).map(sanitizeReq),
    contactHistory: (c.contactHistory || []).map(sanitizeContact)
  };
}

let reconciledClientsWithActivities = new Set();
let _isRecoveringPrograms = false;
let _backfillBlockedByPermission = false;
let _quotaBlocked = false;
let _quotaToastShown = false;
let _hydrationInFlightPromise = null;
let _hydrationInFlightUid = null;
let activeUnsubscribers = [];
let detailUnsubscribe = null;
let activeDetailClientId = null;
const inFlightMutationClientIds = new Set();
let _isFlushingQueue = false;

function readPersistedSyncQueue(uid) {
  if (!uid || typeof window === 'undefined' || !window.localStorage) return [];
  try {
    const raw = window.localStorage.getItem(getPendingSyncStorageKey(uid));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

function writePersistedSyncQueue(uid, queue) {
  if (!uid || typeof window === 'undefined' || !window.localStorage) return;
  try {
    const key = getPendingSyncStorageKey(uid);
    if (!Array.isArray(queue) || queue.length === 0) {
      window.localStorage.removeItem(key);
    } else {
      window.localStorage.setItem(key, JSON.stringify(queue));
    }
  } catch (_) {}
}

function getEffectiveSyncQueue(uid) {
  const memQueue = Array.isArray(S.syncQueue) ? S.syncQueue : [];
  if (memQueue.length > 0) return memQueue;
  return readPersistedSyncQueue(uid);
}

function detachMainRealtimeListeners() {
  if (activeUnsubscribers.length > 0) {
    activeUnsubscribers.forEach(unsub => {
      try {
        unsub();
      } catch (err) {
        console.error("Error unsubscribing:", err);
      }
    });
    activeUnsubscribers = [];
  }
}

export function stopClientDetailSync() {
  if (detailUnsubscribe) {
    try {
      detailUnsubscribe();
    } catch (err) {
      console.error("Error unsubscribing client detail listener:", err);
    }
    detailUnsubscribe = null;
  }
  activeDetailClientId = null;
  if (S.activeDetailClientId !== null) {
    updateState({ activeDetailClientId: null });
  }
}

function isQuotaError(err) {
  const code = String(err?.code || '').toLowerCase();
  const msg = String(err?.message || err || '').toLowerCase();
  return code === 'resource-exhausted' || code.endsWith('/resource-exhausted') ||
    msg.includes('quota limit exceeded') || msg.includes('quota exceeded') ||
    msg.includes('free daily read units');
}

export function handleFirestoreQuotaExceeded(sourceLabel, error) {
  _quotaBlocked = true;
  if (typeof globalThis !== 'undefined') {
    globalThis.__progilicFirestoreQuotaExceeded = true;
  }
  // Immediately trip circuit breaker: detach all active listeners so zero additional reads/retries fire
  detachMainRealtimeListeners();
  stopClientDetailSync();

  batch(() => {
    setSyncing(false);
    setSaveError(true);
    updateState({
      quotaExceeded: true,
      dataIsStale: true,
      isMutating: false,
      connectionState: 'quota-exceeded',
      timelineCloudStatus: 'quota-exceeded',
      lastListenerError: error?.message || String(error || 'Quota limit exceeded')
    });
  });
  console.warn(`[Firestore Quota Circuit Breaker] ${sourceLabel}:`, error?.message || error);
  if (!_quotaToastShown) {
    _quotaToastShown = true;
    showToast(t('تم تجاوز الحد اليومي لقراءات قاعدة البيانات السحابية. تم إيقاف المزامنة التلقائية مؤقتاً لحماية الحصة مع الإبقاء على آخر نسخة مؤكدة للعرض فقط.'), 'error');
  }
}

async function persistRecoveredClientPrograms(userId, clientId, reconciled, updatedStats = null) {
  let permissionDenied = false;
  try {
    const serviceMod = await import('../firebase/service.js');
    if (typeof serviceMod.backfillClientProgramsTransaction === 'function') {
      const ok = await serviceMod.backfillClientProgramsTransaction(
        userId,
        String(clientId),
        reconciled.recoveredPrograms,
        reconciled.counterUpdates,
        updatedStats,
        {
          onPermissionDenied: () => {
            permissionDenied = true;
          }
        }
      );
      if (permissionDenied) {
        _backfillBlockedByPermission = true;
      }
      return { ok: Boolean(ok), permissionDenied };
    }
    return { ok: false, permissionDenied: false };
  } catch (err) {
    const msg = String(err?.message || '').toLowerCase();
    permissionDenied = err?.code === 'permission-denied' || msg.includes('permission') || msg.includes('permissions');
    if (permissionDenied) {
      _backfillBlockedByPermission = true;
    }
    console.warn(`[ProgramRecovery] Backfill failed for client ${clientId}:`, err);
    return { ok: false, permissionDenied };
  }
}

async function persistRecoveredClientProgramsBatch(userId, batchItems = []) {
  if (!Array.isArray(batchItems) || batchItems.length === 0) {
    return { ok: true, permissionDenied: false };
  }
  let permissionDenied = false;
  try {
    const serviceMod = await import('../firebase/service.js');
    if (typeof serviceMod.backfillClientProgramsBatch === 'function') {
      const ok = await serviceMod.backfillClientProgramsBatch(userId, batchItems, {
        onPermissionDenied: () => {
          permissionDenied = true;
        }
      });
      if (permissionDenied) {
        _backfillBlockedByPermission = true;
      }
      return { ok: Boolean(ok), permissionDenied };
    }

    if (typeof serviceMod.backfillClientProgramsTransaction === 'function') {
      for (const item of batchItems) {
        const ok = await serviceMod.backfillClientProgramsTransaction(
          userId,
          String(item.clientId),
          item.programsToWrite,
          item.counterUpdates,
          null,
          {
            onPermissionDenied: () => {
              permissionDenied = true;
            }
          }
        );
        if (permissionDenied) {
          _backfillBlockedByPermission = true;
          return { ok: false, permissionDenied: true };
        }
        if (!ok) {
          return { ok: false, permissionDenied: false };
        }
      }
      return { ok: true, permissionDenied: false };
    }

    return { ok: false, permissionDenied: false };
  } catch (err) {
    const msg = String(err?.message || '').toLowerCase();
    permissionDenied = err?.code === 'permission-denied' || msg.includes('permission') || msg.includes('permissions');
    if (permissionDenied) {
      _backfillBlockedByPermission = true;
    }
    console.warn('[ProgramRecovery] Batch backfill failed:', err);
    return { ok: false, permissionDenied };
  }
}

export async function recoverMissingClientPrograms(userId, activitiesOverride = null) {
  if (!userId || _isRecoveringPrograms || _backfillBlockedByPermission || _quotaBlocked || globalThis?.__progilicFirestoreQuotaExceeded) return 0;
  const currentList = Array.isArray(clients) ? clients : [];
  if (currentList.length === 0) return 0;

  const activities = Array.isArray(activitiesOverride)
    ? activitiesOverride
    : (Array.isArray(S.globalActivities) ? S.globalActivities : []);
  const activitiesLoaded = activities.length > 0 || activitiesOverride !== null;

  const candidates = currentList.filter(c => {
    if (!c || !c.id) return false;
    const key = `${c.id}:${activitiesLoaded ? 'full' : 'partial'}`;
    if (reconciledClientsWithActivities.has(key)) return false;

    const inlineProgs = Array.isArray(c.programs) ? c.programs.filter(Boolean) : [];
    const hasUnsyncedInline = inlineProgs.length > 0 && Number(c.programsCount || 0) < inlineProgs.length;
    if (hasUnsyncedInline) return true;

    if (activitiesLoaded) {
      const purgeCutoff = getClientProgramsPurgeCutoff(c, activities);
      const clientActs = activities.filter(a => a && Number(a.clientId) === Number(c.id));
      const deletions = extractDeletedProgramsFromActivities(c.id, clientActs);
      const hasActiveActivityProgram = clientActs.some(a => {
        if (a.type !== 'PROGRAM_ADDED') return false;
        if (purgeCutoff && (!a.timestamp || a.timestamp <= purgeCutoff)) return false;
        const parsed = parseProgramFromActivity(a, c);
        return parsed && !isProgramDeletedAfter(parsed, a.timestamp || '', deletions);
      });
      if (hasActiveActivityProgram && (inlineProgs.length === 0 || Number(c.programsCount || 0) === 0)) {
        return true;
      }
      reconciledClientsWithActivities.add(key);
    }
    return false;
  });

  if (candidates.length === 0) return 0;

  _isRecoveringPrograms = true;
  let recoveredCount = 0;
  const recoveredUpdatesMap = new Map();
  const pendingWrites = [];

  try {
    const READ_CONCURRENCY = 10;
    for (let i = 0; i < candidates.length; i += READ_CONCURRENCY) {
      if (_backfillBlockedByPermission || _quotaBlocked || globalThis?.__progilicFirestoreQuotaExceeded) break;
      const chunk = candidates.slice(i, i + READ_CONCURRENCY);
      const chunkResults = await Promise.all(chunk.map(async (candidate) => {
        const liveTarget = (Array.isArray(clients) ? clients : []).find(x => String(x?.id) === String(candidate.id)) || candidate;
        const key = `${liveTarget.id}:${activitiesLoaded ? 'full' : 'partial'}`;
        reconciledClientsWithActivities.add(key);

        let sub = null;
        try {
          sub = await getClientSubcollections(userId, String(liveTarget.id));
        } catch (subErr) {
          if (isQuotaError(subErr)) {
            handleFirestoreQuotaExceeded(`ProgramRecovery(${liveTarget.id})`, subErr);
          } else {
            console.warn(`[ProgramRecovery] Subcollection fetch notice for client ${liveTarget.id}:`, subErr);
          }
        }

        const inlinePrograms = Array.isArray(liveTarget.programs) ? liveTarget.programs.filter(Boolean) : [];
        const clientActivities = activities.filter(a => a && (Number(a.clientId) === Number(liveTarget.id) || a.type === 'SYSTEM_PURGE'));
        const reconciled = reconcileClientPrograms({
          client: liveTarget,
          subPrograms: sub?.programs || [],
          inlinePrograms,
          activities: clientActivities
        });

        return { liveTarget, sub, reconciled };
      }));

      for (const { liveTarget, sub, reconciled } of chunkResults) {
        if (reconciled.needsBackfill || reconciled.needsCounterSync) {
          const patch = {
            programs: reconciled.programs,
            programsCount: reconciled.counterUpdates.programsCount,
            installationsCount: reconciled.counterUpdates.installationsCount,
            programNames: reconciled.counterUpdates.programNames
          };
          if (reconciled.counterUpdates.endDate) patch.endDate = reconciled.counterUpdates.endDate;
          if (sub) {
            patch.issues = sub.issues || liveTarget.issues || [];
            patch.requirements = sub.requirements || liveTarget.requirements || [];
            patch.contactHistory = sub.contactHistory || liveTarget.contactHistory || [];
            patch._subcollectionsLoaded = true;
          }
          Object.assign(liveTarget, patch);
          recoveredUpdatesMap.set(String(liveTarget.id), patch);
          recoveredCount++;
          pendingWrites.push({
            clientId: String(liveTarget.id),
            programsToWrite: reconciled.recoveredPrograms,
            counterUpdates: reconciled.counterUpdates
          });
        }
      }
    }

    if (pendingWrites.length > 0 && !_backfillBlockedByPermission) {
      const writeResult = await persistRecoveredClientProgramsBatch(userId, pendingWrites);
      if (writeResult?.permissionDenied) {
        console.warn('[ProgramRecovery] Stopping background backfill due to insufficient Firestore write permissions.');
      }
    }

    if (recoveredUpdatesMap.size > 0) {
      const latestClients = Array.isArray(clients) ? clients : [];
      const mergedList = latestClients.map(cl => {
        const patch = recoveredUpdatesMap.get(String(cl?.id));
        if (!patch) return cl;
        return {
          ...cl,
          ...patch,
          _subcollectionsLoaded: Boolean(cl._subcollectionsLoaded || patch._subcollectionsLoaded)
        };
      });
      const nextStats = {
        ...(S.stats || {}),
        totalPrograms: mergedList.reduce((sum, cl) => sum + (Array.isArray(cl?.programs) && cl.programs.length > 0 ? cl.programs.length : Number(cl?.programsCount || 0)), 0),
        totalLicensedDevices: mergedList.reduce((sum, cl) => {
          if (Array.isArray(cl?.programs) && cl.programs.length > 0) {
            return sum + cl.programs.reduce((acc, p) => acc + (Number(p?.installationsCount) || 1), 0);
          }
          return sum + Number(cl?.installationsCount || 0);
        }, 0)
      };
      batch(() => {
        S.stats = nextStats;
        setClients(mergedList);
      });
      if (typeof window !== 'undefined' && window.R) {
        window.R();
      }
      console.log(`[ProgramRecovery] Restored and synced programs for ${recoveredCount} client(s).`);
    }
  } finally {
    _isRecoveringPrograms = false;
  }

  return recoveredCount;
}

// On-Demand Client Subcollection Loader
export async function loadClientSubcollectionsIfNeeded(clientId) {
  if (!currentUser) return;
  const c = clients.find(x => x.id === clientId || String(x.id) === String(clientId));
  if (!c) return;

  if (c._subcollectionsLoaded) return;

  const uid = (auth && auth.currentUser && auth.currentUser.uid) || (currentUser && currentUser.tenantId) || currentUser?.uid || getActiveTenantId();
  const inlinePrograms = Array.isArray(c.programs) ? c.programs.filter(Boolean) : [];

  try {
    setSyncing(true);

    const sub = (await getClientSubcollections(uid, String(clientId))) || {};
    const purgeActivities = Array.isArray(S.globalActivities)
      ? S.globalActivities.filter(a => a && a.type === 'SYSTEM_PURGE')
      : [];
    let clientActivities = Array.isArray(S.globalActivities)
      ? S.globalActivities.filter(a => a && Number(a.clientId) === Number(c.id))
      : [];

    if (clientActivities.length === 0 && uid) {
      try {
        const serviceMod = await import('../firebase/service.js');
        if (typeof serviceMod.getTenantActivities === 'function') {
          const fetchedActs = await serviceMod.getTenantActivities(uid, c.id);
          if (Array.isArray(fetchedActs) && fetchedActs.length > 0) {
            clientActivities = fetchedActs;
          }
        }
      } catch (actErr) {
        console.warn(`[ProgramRecovery] Activity lookup notice for client ${clientId}:`, actErr);
      }
    }

    const latestList = Array.isArray(clients) ? [...clients] : [];
    const liveIdx = latestList.findIndex(x => x.id === clientId || String(x.id) === String(clientId));
    const baseClient = liveIdx > -1 ? latestList[liveIdx] : c;
    const latestInlinePrograms = Array.isArray(baseClient.programs) && baseClient.programs.length > 0
      ? baseClient.programs.filter(Boolean)
      : inlinePrograms;

    const reconciled = reconcileClientPrograms({
      client: baseClient,
      subPrograms: sub.programs || [],
      inlinePrograms: latestInlinePrograms,
      activities: [...clientActivities, ...purgeActivities]
    });

    const loadedFields = {
      programs: reconciled.programs,
      programsCount: reconciled.counterUpdates.programsCount,
      installationsCount: reconciled.counterUpdates.installationsCount,
      programNames: reconciled.counterUpdates.programNames,
      issues: sub.issues || [],
      requirements: sub.requirements || [],
      contactHistory: sub.contactHistory || [],
      _subcollectionsLoaded: true
    };
    if (reconciled.counterUpdates.endDate) {
      loadedFields.endDate = reconciled.counterUpdates.endDate;
    }

    Object.assign(c, loadedFields);
    if (liveIdx > -1) {
      latestList[liveIdx] = { ...baseClient, ...loadedFields };
    }

    const nextStats = {
      ...(S.stats || {}),
      totalPrograms: latestList.reduce((sum, cl) => sum + (Array.isArray(cl?.programs) && cl.programs.length > 0 ? cl.programs.length : Number(cl?.programsCount || 0)), 0),
      totalLicensedDevices: latestList.reduce((sum, cl) => {
        if (Array.isArray(cl?.programs) && cl.programs.length > 0) {
          return sum + cl.programs.reduce((acc, p) => acc + (Number(p?.installationsCount) || 1), 0);
        }
        return sum + Number(cl?.installationsCount || 0);
      }, 0)
    };
    batch(() => {
      S.stats = nextStats;
      setClients(latestList);
    });

    if (uid && !_backfillBlockedByPermission && (reconciled.needsBackfill || reconciled.needsCounterSync)) {
      persistRecoveredClientPrograms(uid, clientId, reconciled, nextStats).catch(console.warn);
    }
    console.log(`Subcollections loaded successfully for client ${clientId} (${loadedFields.programs.length} programs)`);
  } catch (err) {
    console.error(`Failed to load subcollections for client ${clientId}:`, err);
  } finally {
    setSyncing(false);
  }
}

export function hydrateAllClientSubcollections(userId = null, options = {}) {
  const uid = userId || (auth && auth.currentUser && auth.currentUser.uid) || (currentUser && currentUser.tenantId) || currentUser?.uid || getActiveTenantId();
  if (!uid || _quotaBlocked || globalThis?.__progilicFirestoreQuotaExceeded) return Promise.resolve(0);

  const initialList = Array.isArray(clients) ? clients : [];
  if (initialList.length === 0) return Promise.resolve(0);

  if (_hydrationInFlightPromise && _hydrationInFlightUid === uid && !options.force) {
    return _hydrationInFlightPromise;
  }

  const runHydration = async () => {
    const currentList = Array.isArray(clients) ? clients : [];
    const targetClients = currentList.filter(c => c && c.id && (options.force || !c._subcollectionsLoaded));
    if (targetClients.length === 0) return 0;

    const activities = Array.isArray(S.globalActivities) ? S.globalActivities : [];
    const activitiesLoaded = activities.length > 0;
    const hydratedPatches = new Map();
    const pendingWrites = [];
    const HYDRATE_CONCURRENCY = 10;

    setSyncing(true);
    try {
      for (let i = 0; i < targetClients.length; i += HYDRATE_CONCURRENCY) {
        if (_quotaBlocked || globalThis?.__progilicFirestoreQuotaExceeded) break;
        const chunk = targetClients.slice(i, i + HYDRATE_CONCURRENCY);
        const chunkResults = await Promise.all(chunk.map(async (candidate) => {
          if (_quotaBlocked || globalThis?.__progilicFirestoreQuotaExceeded) return null;
          const liveTarget = (Array.isArray(clients) ? clients : []).find(x => String(x?.id) === String(candidate.id)) || candidate;
          let sub = null;
          try {
            sub = await getClientSubcollections(uid, String(liveTarget.id));
          } catch (subErr) {
            if (isQuotaError(subErr)) {
              handleFirestoreQuotaExceeded(`DashboardSync(${liveTarget.id})`, subErr);
            } else {
              console.warn(`[DashboardSync] Subcollection fetch failed for client ${liveTarget.id}:`, subErr);
            }
            return null;
          }
          if (!sub || typeof sub !== 'object') return null;

          const inlinePrograms = Array.isArray(liveTarget.programs) ? liveTarget.programs.filter(Boolean) : [];
          const clientActivities = activities.filter(a => a && (Number(a.clientId) === Number(liveTarget.id) || a.type === 'SYSTEM_PURGE'));
          const reconciled = reconcileClientPrograms({
            client: liveTarget,
            subPrograms: sub.programs || [],
            inlinePrograms,
            activities: clientActivities
          });

          const issues = Array.isArray(sub.issues) ? sub.issues : (liveTarget.issues || []);
          const requirements = Array.isArray(sub.requirements) ? sub.requirements : (liveTarget.requirements || []);
          const contactHistory = Array.isArray(sub.contactHistory) ? sub.contactHistory : (liveTarget.contactHistory || []);
          const latestContact = contactHistory.reduce((latest, entry) => {
            const d = entry?.date ? String(entry.date) : '';
            return d && d > latest ? d : latest;
          }, liveTarget.lastContact || '');

          const openIssuesCount = issues.filter(iss => iss && (iss.status === 'مفتوح' || iss.status === 'قيد المعالجة' || iss.status === 'جديد')).length;
          const requirementsCount = requirements.length;

          reconciledClientsWithActivities.add(`${liveTarget.id}:${activitiesLoaded ? 'full' : 'partial'}`);

          return {
            clientId: String(liveTarget.id),
            patch: {
              programs: reconciled.programs,
              programsCount: reconciled.counterUpdates.programsCount,
              installationsCount: reconciled.counterUpdates.installationsCount,
              programNames: reconciled.counterUpdates.programNames,
              endDate: reconciled.counterUpdates.endDate || liveTarget.endDate || '',
              issues,
              requirements,
              contactHistory,
              lastContact: latestContact || liveTarget.lastContact || '',
              openIssuesCount,
              requirementsCount,
              _subcollectionsLoaded: true
            },
            reconciled
          };
        }));

        for (const item of chunkResults) {
          if (!item) continue;
          hydratedPatches.set(item.clientId, item.patch);
          if (!_backfillBlockedByPermission && (item.reconciled.needsBackfill || item.reconciled.needsCounterSync)) {
            pendingWrites.push({
              clientId: item.clientId,
              programsToWrite: item.reconciled.recoveredPrograms,
              counterUpdates: item.reconciled.counterUpdates
            });
          }
        }
      }

      if (hydratedPatches.size > 0) {
        const latestClients = Array.isArray(clients) ? clients : [];
        const hydratedList = latestClients.map(cl => {
          const patch = hydratedPatches.get(String(cl?.id));
          if (!patch) return cl;
          return {
            ...cl,
            ...patch
          };
        });

        batch(() => {
          // Update clients first so intelligence.js cache calculates real maxProgs/maxInsts across full list
          setClients(hydratedList);
          const scoredList = hydratedList.map(cl => {
            if (!cl || !cl._subcollectionsLoaded) return cl;
            const liveScore = computeScore(cl).total;
            return cl.score === liveScore ? cl : { ...cl, score: liveScore };
          });
          setClients(scoredList);
          const { stats: computedStats } = computeStats(scoredList);
          S.stats = computedStats;
        });
      }

      if (pendingWrites.length > 0 && !_backfillBlockedByPermission) {
        persistRecoveredClientProgramsBatch(uid, pendingWrites).catch(console.warn);
      }

      return hydratedPatches.size;
    } finally {
      setSyncing(false);
    }
  };

  const promise = runHydration().finally(() => {
    if (_hydrationInFlightPromise === promise) {
      _hydrationInFlightPromise = null;
      _hydrationInFlightUid = null;
    }
  });
  _hydrationInFlightUid = uid;
  _hydrationInFlightPromise = promise;
  return promise;
}

// Real-Time Single-Client Detail Subcollection Subscription (Programs, Issues, Requirements, Contacts)
export function startClientDetailSync(userId, clientId) {
  const uid = userId || (auth && auth.currentUser && auth.currentUser.uid) || getActiveTenantId();
  const cidStr = clientId !== null && clientId !== undefined ? String(clientId) : '';
  if (!uid || !cidStr) return () => {};
  if (_quotaBlocked || globalThis?.__progilicFirestoreQuotaExceeded) {
    return () => {};
  }
  if (activeDetailClientId === cidStr && detailUnsubscribe) {
    return detailUnsubscribe;
  }

  stopClientDetailSync();
  activeDetailClientId = cidStr;
  updateState({ activeDetailClientId: cidStr });

  const receivedCollections = new Set();
  const bufferedSubData = {};

  detailUnsubscribe = subscribeClientSubcollections(
    uid,
    cidStr,
    ({ collectionName, fieldName, items, fromCache, hasPendingWrites }) => {
      if (_quotaBlocked || globalThis?.__progilicFirestoreQuotaExceeded) return;
      receivedCollections.add(collectionName);
      bufferedSubData[fieldName] = Array.isArray(items) ? items : [];

      const latestList = Array.isArray(clients) ? [...clients] : [];
      const idx = latestList.findIndex(x => String(x?.id) === cidStr);
      if (idx === -1) return;

      const target = latestList[idx];
      const currentQueue = getEffectiveSyncQueue(uid);
      const hasPendingMutationForClient = getPendingClientIds(currentQueue, inFlightMutationClientIds).has(cidStr);

      // Never wipe local pending/in-flight edits with stale snapshot emissions
      if (hasPendingMutationForClient && (fromCache || hasPendingWrites || inFlightMutationClientIds.has(cidStr))) {
        return;
      }

      let resolvedValue = bufferedSubData[fieldName];
      if (fieldName === 'programs' && resolvedValue.length === 0 && Array.isArray(target.programs) && target.programs.length > 0) {
        const clientActs = Array.isArray(S.globalActivities)
          ? S.globalActivities.filter(a => a && (Number(a.clientId) === Number(target.id) || a.type === 'SYSTEM_PURGE'))
          : [];
        const reconciled = reconcileClientPrograms({
          client: target,
          subPrograms: [],
          inlinePrograms: target.programs.filter(Boolean),
          activities: clientActs
        });
        resolvedValue = reconciled.programs;
        if (!fromCache && !_backfillBlockedByPermission && (reconciled.needsBackfill || reconciled.needsCounterSync)) {
          persistRecoveredClientPrograms(uid, cidStr, reconciled, null).catch(console.warn);
        }
      }

      let nextClient = {
        ...target,
        [fieldName]: resolvedValue,
        _subcollectionsLoaded: receivedCollections.size >= 4 ? true : Boolean(target._subcollectionsLoaded)
      };

      // Recompute local summary fields when subcollections update in real time
      if (fieldName === 'programs') {
        const progs = nextClient.programs || [];
        nextClient.programsCount = progs.length;
        nextClient.installationsCount = progs.reduce((s, p) => s + (Number(p?.installationsCount) || 1), 0);
        nextClient.programNames = progs.map(p => p?.programName).filter(Boolean);
      } else if (fieldName === 'issues') {
        const iss = nextClient.issues || [];
        const open = iss.filter(i => i && (i.status === 'مفتوح' || i.status === 'قيد المعالجة' || i.status === 'جديد'));
        nextClient.openIssuesCount = open.length;
        nextClient.solvedIssuesCount = iss.filter(i => i && (i.status === 'محلول' || i.status === 'مغلق')).length;
        nextClient.issuesByPriority = {
          عاجل: open.filter(i => i.priority === 'عاجل' || i.priority === 'عاجلة').length,
          عالية: open.filter(i => i.priority === 'عالية').length,
          متوسطة: open.filter(i => i.priority === 'متوسطة').length,
          منخفضة: open.filter(i => i.priority === 'منخفضة' || !i.priority).length
        };
        nextClient.urgentIssuesCount = (nextClient.issuesByPriority.عاجل || 0) + (nextClient.issuesByPriority.عالية || 0);
      } else if (fieldName === 'requirements') {
        const reqs = nextClient.requirements || [];
        nextClient.requirementsCount = reqs.length;
        nextClient.reqsByStatus = {
          مقترح: reqs.filter(r => r.status === 'مقترح' || !r.status).length,
          'قيد الدراسة': reqs.filter(r => r.status === 'قيد الدراسة').length,
          مخطط: reqs.filter(r => r.status === 'مخطط').length,
          منفذ: reqs.filter(r => r.status === 'منفذ').length
        };
      } else if (fieldName === 'contactHistory') {
        const ch = nextClient.contactHistory || [];
        nextClient.contactsCount = ch.length;
        const latestContact = ch.reduce((latest, entry) => {
          const d = entry?.date ? String(entry.date) : '';
          return d && d > latest ? d : latest;
        }, target.lastContact || '');
        if (latestContact) nextClient.lastContact = latestContact;
      }

      if (nextClient._subcollectionsLoaded) {
        nextClient.score = computeScore(nextClient).total;
      }

      if (hasPendingMutationForClient) {
        const overlaid = overlayPendingMutationsOnClients([nextClient], currentQueue, [target]);
        if (overlaid[0]) nextClient = overlaid[0];
      }

      latestList[idx] = nextClient;
      batch(() => {
        setClients(latestList);
        if (!fromCache && !hasPendingWrites) {
          setLastSyncedTime(new Date());
        }
      });
    },
    (error, collName) => {
      if (isQuotaError(error)) {
        handleFirestoreQuotaExceeded(`Client detail listener (${collName})`, error);
        return;
      }
      console.warn(`[DetailSync] Subcollection listener notice (${collName}):`, error);
    }
  );

  return detailUnsubscribe;
}

// Helper: build normalized client summary document preserving hydrated subcollections only when valid
function normalizeClientSummary(docSnap, existingClient = null, preserveSubcollections = true) {
  const data = docSnap && typeof docSnap.data === 'function' ? docSnap.data() : (docSnap || {});
  const inlineProgs = Array.isArray(data.programs) ? data.programs : [];
  const effectiveProgramsCount = inlineProgs.length > 0
    ? Math.max(Number(data.programsCount || 0), inlineProgs.length)
    : (data.programsCount || 0);
  const effectiveInstallsCount = inlineProgs.length > 0
    ? Math.max(Number(data.installationsCount || 0), inlineProgs.reduce((s, p) => s + (Number(p?.installationsCount) || 1), 0))
    : (data.installationsCount || 0);

  const base = {
    ...data,
    id: data.id !== undefined ? data.id : docSnap?.id,
    programs: inlineProgs,
    programsCount: effectiveProgramsCount,
    installationsCount: effectiveInstallsCount,
    programNames: Array.isArray(data.programNames) && data.programNames.length > 0
      ? data.programNames
      : inlineProgs.map(p => p?.programName).filter(Boolean),
    issues: data.issues || [],
    requirements: data.requirements || [],
    contactHistory: data.contactHistory || [],
    gps: data.gps || { lat: null, lng: null },
    _subcollectionsLoaded: false
  };

  if (preserveSubcollections && existingClient && existingClient._subcollectionsLoaded) {
    const existingOpenIssuesCount = (existingClient.issues || []).filter(i => i && (i.status === 'مفتوح' || i.status === 'قيد المعالجة' || i.status === 'جديد')).length;
    const existingReqCount = (existingClient.requirements || []).length;
    const existingProgCount = (existingClient.programs || []).length;
    const isDetailSubscribed = activeDetailClientId === String(base.id);
    const remoteChangedCounts =
      (base.programsCount !== undefined && Number(base.programsCount) !== existingProgCount) ||
      (base.openIssuesCount !== undefined && Number(base.openIssuesCount) !== existingOpenIssuesCount) ||
      (base.requirementsCount !== undefined && Number(base.requirementsCount) !== existingReqCount);

    if (isDetailSubscribed || !remoteChangedCounts) {
      return {
        ...base,
        programs: existingClient.programs,
        programsCount: existingProgCount,
        installationsCount: existingClient.programs.reduce((s, p) => s + (Number(p?.installationsCount) || 1), 0),
        programNames: existingClient.programs.map(p => p?.programName).filter(Boolean),
        issues: existingClient.issues,
        requirements: existingClient.requirements,
        contactHistory: existingClient.contactHistory,
        score: existingClient.score !== undefined ? existingClient.score : base.score,
        _subcollectionsLoaded: true
      };
    }
  }

  return base;
}

export function startRealtimeSync(userId) {
  if (!userId) return;
  if (_quotaBlocked || globalThis?.__progilicFirestoreQuotaExceeded) {
    updateState({
      quotaExceeded: true,
      dataIsStale: true,
      connectionState: 'quota-exceeded'
    });
    return;
  }

  detachMainRealtimeListeners();
  reconciledClientsWithActivities = new Set();
  _backfillBlockedByPermission = false;

  let hasClientsSnapshot = false;
  let hasActivitiesSnapshot = false;
  let clientMapById = new Map();

  updateState({
    connectionState: navigator?.onLine === false ? 'offline' : 'connecting',
    lastListenerError: null
  });

  // 1. Listen to user profile document (for stats and next ID sequence)
  const userDocRef = doc(db, 'users', userId);
  const unsubUser = onSnapshot(userDocRef, { includeMetadataChanges: true }, (snapshot) => {
    const fromCache = Boolean(snapshot.metadata?.fromCache);
    if (snapshot.exists()) {
      const data = snapshot.data();
      const nextNid = data.nid || 100;
      const nextStats = data.stats || {};
      const nextConnState = navigator?.onLine === false
        ? 'offline'
        : (fromCache ? 'cached-stale' : 'live');
      batch(() => {
        updateState({
          nid: nextNid,
          stats: nextStats,
          hasConfirmedServerSync: !fromCache || S.hasConfirmedServerSync,
          dataIsStale: fromCache && !S.hasConfirmedServerSync,
          connectionState: nextConnState,
          lastListenerError: null
        });
        if (!fromCache) {
          setLastSyncedTime(new Date());
        }
        setSyncing(false);
        setSaveError(false);
      });
    } else if (!fromCache && navigator?.onLine !== false) {
      updateState({
        hasConfirmedServerSync: true,
        dataIsStale: false,
        connectionState: 'live',
        lastListenerError: null
      });
    }
  }, (error) => {
    if (isQuotaError(error)) {
      handleFirestoreQuotaExceeded('User profile snapshot listener', error);
      return;
    }
    console.error("User profile snapshot listener error:", error);
    setSaveError(true);
    updateState({
      dataIsStale: true,
      connectionState: navigator?.onLine === false ? 'offline' : 'error',
      lastListenerError: error?.message || String(error)
    });
  });

  // 2. Listen to clients collection incrementally using docChanges()
  const clientsCollRef = collection(db, 'users', userId, 'clients');
  const unsubClients = onSnapshot(clientsCollRef, { includeMetadataChanges: true }, (snapshot) => {
    const fromCache = Boolean(snapshot.metadata?.fromCache);
    const hasPendingWrites = Boolean(snapshot.metadata?.hasPendingWrites);
    const prevClients = Array.isArray(clients) ? clients : [];
    const existingById = new Map(prevClients.map(x => [String(x?.id), x]));
    const activeQueue = getEffectiveSyncQueue(userId);
    const protectedIds = getPendingClientIds(activeQueue, inFlightMutationClientIds);

    // Integrity check: if cache claims 0 docs while confirmed server state or pending local adds already exist, do not wipe memory
    if (snapshot.empty && fromCache && (prevClients.length > 0 || activeQueue.length > 0)) {
      updateState({
        clientsFromCache: true,
        dataIsStale: true,
        connectionState: navigator?.onLine === false ? 'offline' : 'cached-stale'
      });
      return;
    }

    const canUseDocChanges = hasClientsSnapshot && typeof snapshot.docChanges === 'function';
    let nextClients;

    if (canUseDocChanges) {
      const changes = snapshot.docChanges();
      if (changes.length === 0 && !fromCache && prevClients.length > 0 && activeQueue.length === 0) {
        updateState({
          clientsFromCache: false,
          hasConfirmedServerSync: true,
          dataIsStale: false,
          hasPendingLocalWrites: hasPendingWrites,
          connectionState: 'live',
          lastListenerError: null
        });
        if (!hasPendingWrites) {
          setLastSyncedTime(new Date());
        }
        setSaveError(false);
        return;
      }

      for (const change of changes) {
        const docId = String(change.doc.data()?.id ?? change.doc.id);
        if (change.type === 'removed') {
          if (!protectedIds.has(docId)) {
            clientMapById.delete(docId);
          }
        } else {
          const prevItem = existingById.get(docId) || clientMapById.get(docId);
          if (protectedIds.has(docId) && prevItem && (inFlightMutationClientIds.has(docId) || hasPendingWrites || fromCache)) {
            clientMapById.set(docId, prevItem);
          } else {
            clientMapById.set(docId, normalizeClientSummary(change.doc, prevItem, true));
          }
        }
      }
      nextClients = Array.from(clientMapById.values());
    } else {
      clientMapById = new Map();
      for (const d of snapshot.docs) {
        const docId = String(d.data()?.id ?? d.id);
        const prevItem = existingById.get(docId);
        if (protectedIds.has(docId) && prevItem && (inFlightMutationClientIds.has(docId) || hasPendingWrites || fromCache)) {
          clientMapById.set(docId, prevItem);
        } else {
          clientMapById.set(docId, normalizeClientSummary(d, prevItem, true));
        }
      }
      nextClients = Array.from(clientMapById.values());
    }

    hasClientsSnapshot = true;

    // Never allow incoming snapshot to delete or replace queued offline/pending user edits
    if (activeQueue.length > 0) {
      nextClients = overlayPendingMutationsOnClients(nextClients, activeQueue, prevClients);
    }

    // Maintain consistent order matching current state
    nextClients.sort((a, b) => Number(b.id || 0) - Number(a.id || 0));

    const clientsChanged = JSON.stringify(prevClients) !== JSON.stringify(nextClients);
    const nextConnState = navigator?.onLine === false
      ? 'offline'
      : (fromCache ? 'cached-stale' : 'live');

    batch(() => {
      setSyncing(false);
      if (clientsChanged) {
        setClients(nextClients);
      }
      updateState({
        clientsFromCache: fromCache,
        hasConfirmedServerSync: !fromCache || S.hasConfirmedServerSync,
        dataIsStale: fromCache,
        hasPendingLocalWrites: activeQueue.length > 0 || hasPendingWrites,
        pendingSyncCount: activeQueue.length,
        connectionState: nextConnState,
        lastListenerError: null
      });
      if (!fromCache && !hasPendingWrites) {
        setLastSyncedTime(new Date());
      }
      setSaveError(false);
    });

    // Never run eager 4xN fleet hydration! Only repair genuinely legacy unbackfilled inline programs after server confirmation.
    if (!fromCache && !_quotaBlocked && !globalThis?.__progilicFirestoreQuotaExceeded) {
      const hasLegacyInlineUnbackfilled = nextClients.some(c => {
        const inlineProgs = Array.isArray(c?.programs) ? c.programs.filter(Boolean) : [];
        return inlineProgs.length > 0 && Number(c?.programsCount || 0) < inlineProgs.length;
      });
      if (hasLegacyInlineUnbackfilled) {
        recoverMissingClientPrograms(userId, hasActivitiesSnapshot ? S.globalActivities : null).catch(console.warn);
      }
    }
  }, (error) => {
    if (isQuotaError(error)) {
      handleFirestoreQuotaExceeded('Clients collection snapshot listener', error);
      return;
    }
    console.error("Clients collection snapshot listener error:", error);
    setSaveError(true);
    updateState({
      dataIsStale: true,
      connectionState: navigator?.onLine === false ? 'offline' : 'error',
      lastListenerError: error?.message || String(error)
    });
  });

  // 3. Listen to employees collection (real-time cross-device sync, zero duplicate initial fetch)
  let defaultGerantProvisioned = false;
  const unsubEmployees = subscribeEmployeesForTenant(
    userId,
    (remoteStaff, meta = {}) => {
      const fromCache = Boolean(meta.fromCache);
      if (remoteStaff.length > 0) {
        setStaffUsers(remoteStaff, userId);
      } else if (!fromCache && !defaultGerantProvisioned && !_quotaBlocked && navigator?.onLine !== false) {
        // Server confirmed 0 employee docs for this tenant -> create default Gerant once
        defaultGerantProvisioned = true;
        import('../firebase/service.js').then(({ saveEmployeeForTenant }) => {
          const authEmail = auth?.currentUser?.email || '';
          const authName = auth?.currentUser?.displayName || authEmail.split('@')[0] || 'المدير العام (GERANT)';
          const defaultGerant = createDefaultGerant(userId, authName);
          defaultGerant.adminEmail = authEmail;
          defaultGerant.status = 'نشط';
          defaultGerant.createdAt = new Date().toISOString().split('T')[0];
          return saveEmployeeForTenant(userId, defaultGerant).then(() => {
            setStaffUsers([defaultGerant], userId);
          });
        }).catch(err => {
          defaultGerantProvisioned = false;
          if (isQuotaError(err)) handleFirestoreQuotaExceeded('Provision default gerant', err);
          else console.warn("[Realtime Sync] Default gerant provision failed:", err);
        });
      }
    },
    (error) => {
      if (isQuotaError(error)) {
        handleFirestoreQuotaExceeded('Employees collection snapshot listener', error);
        return;
      }
      console.warn("Employees collection snapshot listener notice:", error);
    }
  );

  // 4. Listen to bounded recent activities subcollection (limit 200, ordered newest-first)
  const unsubActivities = subscribeTenantActivities(
    userId,
    200,
    (remoteActivities, meta = {}) => {
      hasActivitiesSnapshot = true;
      const fromCache = Boolean(meta.fromCache);
      const prevActivities = Array.isArray(S.globalActivities) ? S.globalActivities : [];
      const activitiesChanged = prevActivities.length !== remoteActivities.length ||
        JSON.stringify(prevActivities) !== JSON.stringify(remoteActivities);

      batch(() => {
        if (activitiesChanged) {
          S.globalActivities = remoteActivities;
          if (S.selId) {
            S.clientActivities = remoteActivities.filter(a => Number(a.clientId) === Number(S.selId));
          }
        }
        updateState({
          timelineCloudStatus: fromCache ? 'cached' : 'synced'
        });
        if (!fromCache && activitiesChanged) {
          setLastSyncedTime(new Date());
        }
      });
    },
    (error) => {
      if (isQuotaError(error)) {
        handleFirestoreQuotaExceeded('Activities collection snapshot listener', error);
        return;
      }
      console.warn("Activities collection snapshot listener notice:", error);
    }
  );

  activeUnsubscribers.push(unsubUser, unsubClients, unsubEmployees, unsubActivities);
}

export function stopRealtimeSync() {
  reconciledClientsWithActivities = new Set();
  _backfillBlockedByPermission = false;
  resetTimelineSyncGuards();
  _quotaBlocked = false;
  _quotaToastShown = false;
  _hydrationInFlightPromise = null;
  _hydrationInFlightUid = null;
  _isFlushingQueue = false;
  inFlightMutationClientIds.clear();
  if (typeof globalThis !== 'undefined') {
    globalThis.__progilicFirestoreQuotaExceeded = false;
  }
  detachMainRealtimeListeners();
  stopClientDetailSync();
}

export async function reconnectRealtimeSync() {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    updateState({ isOnline: false, connectionState: 'offline' });
    showToast(t('لا يوجد اتصال بالإنترنت حالياً. يرجى التحقق من الشبكة ثم المحاولة.'), 'error');
    return false;
  }
  const activeAuthUser = auth?.currentUser;
  if (!activeAuthUser || !activeAuthUser.uid) {
    showToast(t('يرجى تسجيل الدخول لإعادة الاتصال بالسحابة.'), 'error');
    return false;
  }

  _quotaBlocked = false;
  _quotaToastShown = false;
  if (typeof globalThis !== 'undefined') {
    globalThis.__progilicFirestoreQuotaExceeded = false;
  }
  updateState({
    isOnline: true,
    quotaExceeded: false,
    dataIsStale: false,
    lastListenerError: null,
    connectionState: 'connecting'
  });
  setSaveError(false);

  // Flush any pending local edits BEFORE reloading from Firestore so edits are NEVER wiped!
  const pendingQueue = getEffectiveSyncQueue(activeAuthUser.uid);
  if (pendingQueue.length > 0) {
    await flushSyncQueue(activeAuthUser.uid);
  }

  await loadDataFromFirestore(activeAuthUser);
  return !_quotaBlocked;
}

/**
 * Strictly Online: user cache loading is disabled.
 * The system relies entirely on Cloud Firestore.
 */
export async function loadUserCache(uid) {
  if (!uid) return;
  console.log("[Storage] Strict Online Mode: Skipping local cache load.");
  updateState({ isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true });
}

// In-flight guard to deduplicate concurrent loadDataFromFirestore triggers across devices/listeners
let currentLoadPromise = null;

// Load data from Firestore supporting Schema Version 3 + Legacy Auto-Migration
export function loadDataFromFirestore(user) {
  if (!user || !user.uid) return Promise.resolve();
  if (currentLoadPromise) {
    console.log("loadDataFromFirestore: In-flight load already running, returning active promise");
    return currentLoadPromise;
  }
  currentLoadPromise = doLoadDataFromFirestore(user).finally(() => {
    currentLoadPromise = null;
  });
  return currentLoadPromise;
}

async function doLoadDataFromFirestore(user) {
  if (!user || !user.uid) return;
  if (_quotaBlocked || globalThis?.__progilicFirestoreQuotaExceeded) {
    updateState({
      quotaExceeded: true,
      dataIsStale: true,
      connectionState: 'quota-exceeded'
    });
    return;
  }

  try {
    // Hydrate any persisted offline mutations for this tenant immediately so they are never lost
    const persistedQueue = getEffectiveSyncQueue(user.uid);
    batch(() => {
      setLoading(true);
      setSyncing(true);
      setSaveError(false);
      updateState({
        syncQueue: persistedQueue,
        pendingSyncCount: persistedQueue.length,
        hasPendingLocalWrites: persistedQueue.length > 0,
        connectionState: navigator?.onLine === false ? 'offline' : 'connecting',
        lastListenerError: null
      });
    });

    if (user && typeof user.getIdToken === 'function' && (user.emailVerified || (user.providerData || []).some(p => p.providerId === 'google.com' || p.providerId === 'facebook.com'))) {
      try {
        await user.getIdToken();
      } catch (tokErr) {
        console.warn("Failed to retrieve ID token:", tokErr);
      }
    }

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(Object.assign(new Error('FIRESTORE_TIMEOUT'), { code: 'network-offline' })), 12000)
    );

    let res;
    try {
      res = await Promise.race([getUserDataStrict(user.uid), timeoutPromise]);
    } catch (timeoutOrErr) {
      res = {
        status: classifyFirestoreError(timeoutOrErr),
        exists: false,
        fromCache: false,
        data: null,
        error: timeoutOrErr
      };
    }

    if (res.status === 'permission-denied' && typeof user.getIdToken === 'function') {
      try {
        await user.getIdToken(true);
        const retryTimeout = new Promise((_, reject) =>
          setTimeout(() => reject(Object.assign(new Error('FIRESTORE_TIMEOUT'), { code: 'network-offline' })), 8000)
        );
        res = await Promise.race([getUserDataStrict(user.uid), retryTimeout]);
      } catch (retryErr) {
        res = {
          status: classifyFirestoreError(retryErr),
          exists: false,
          fromCache: false,
          data: null,
          error: retryErr
        };
      }
    }

    if (res.status === 'quota-exceeded') {
      handleFirestoreQuotaExceeded('Initial user profile load', res.error);
      return;
    }

    if (res.status === 'permission-denied' || res.status === 'network-offline' || res.status === 'unauthenticated' || res.status === 'unknown') {
      console.warn(`[Storage] Initial user doc load failed (${res.status}). Preserving confirmed state without overwriting cloud.`, res.error);
      setSaveError(true);
      updateState({
        dataIsStale: true,
        connectionState: res.status === 'network-offline' ? 'offline' : 'error',
        lastListenerError: res.error?.message || res.status
      });
      if (persistedQueue.length > 0 && Array.isArray(clients)) {
        setClients(overlayPendingMutationsOnClients(clients, persistedQueue, clients));
      }
      // Do NOT attach migration or overwrite { v: 3 } on failed read!
      if (res.status !== 'permission-denied' && res.status !== 'unauthenticated' && navigator?.onLine !== false) {
        startRealtimeSync(user.uid);
      }
      return;
    }

    if (res.status === 'missing') {
      // Only initialize new tenant profile when server explicitly confirmed missing (!fromCache && online)
      if (!res.fromCache && navigator?.onLine !== false) {
        const emptyStats = {
          activeClients: 0,
          prospectiveClients: 0,
          stoppedClients: 0,
          totalClients: 0,
          totalPrograms: 0,
          totalLicensedDevices: 0,
          averageScore: 100,
          totalOpenIssues: 0
        };
        try {
          await saveUserData(user.uid, {
            v: SCHEMA_VERSION,
            updatedAt: new Date().toISOString(),
            nid: 100,
            stats: emptyStats
          });
          updateState({
            nid: 100,
            stats: emptyStats,
            hasConfirmedServerSync: true,
            dataIsStale: false,
            connectionState: 'live'
          });
        } catch (initErr) {
          if (isQuotaError(initErr)) {
            handleFirestoreQuotaExceeded('Initialize new user profile', initErr);
            return;
          }
          console.warn('[Storage] User profile initialization notice:', initErr);
        }
      }
    } else if (res.status === 'ok' && res.data) {
      const data = res.data;
      const legacyClients = Array.isArray(data.clients) && data.clients.length > 0 ? data.clients : null;

      batch(() => {
        if (legacyClients) {
          const merged = overlayPendingMutationsOnClients(mergeClientLists(legacyClients), persistedQueue, clients);
          const { stats: computedStats, nid: computedNid } = computeStats(merged);
          setClients(merged);
          updateState({
            nid: Math.max(Number(data.nid) || 100, computedNid),
            stats: data.stats || computedStats
          });
        } else {
          updateState({
            nid: Math.max(Number(data.nid) || 100, S.nid || 100),
            stats: data.stats || S.stats
          });
        }
        updateState({
          hasConfirmedServerSync: !res.fromCache,
          dataIsStale: Boolean(res.fromCache),
          connectionState: res.fromCache ? 'cached-stale' : 'live'
        });
      });

      // Only migrate if doc explicitly contains legacy inline clients & schema < 3 & confirmed from server
      if (!res.fromCache && legacyClients && (data.v === undefined || Number(data.v) < 3) && navigator?.onLine !== false) {
        const { nid: computedNid } = computeStats(legacyClients);
        migrateLegacyDataIfNeeded(user.uid, { clients: legacyClients }, computedNid).catch(err => {
          console.warn("[Storage] Cloud migration notice:", err);
        });
      }
    }

    // Flush persisted offline writes automatically when online, then attach listeners
    if (persistedQueue.length > 0 && (typeof navigator === 'undefined' || navigator.onLine !== false)) {
      await flushSyncQueue(user.uid);
    }

    // Start real-time listeners (clients, user profile, employees, bounded activities)
    startRealtimeSync(user.uid);
  } catch (err) {
    if (isQuotaError(err)) {
      handleFirestoreQuotaExceeded('loadDataFromFirestore', err);
      return;
    }
    console.error("Error loading from Firestore:", err?.message || String(err));
    setSaveError(true);
    updateState({
      dataIsStale: true,
      connectionState: navigator?.onLine === false ? 'offline' : 'error',
      lastListenerError: err?.message || String(err)
    });
  } finally {
    batch(() => {
      setLoading(false);
      setSyncing(false);
    });
  }
}

// For backwards compatibility, but operations should use transactional actions
export async function persist() {
  if (!currentUser) return;
  setSyncing(true);
  setSaveError(false);

  try {
    // Keep user's general metadata and next ID sequence in sync
    const payload = {
      v: SCHEMA_VERSION,
      updatedAt: new Date().toISOString(),
      nid: S.nid,
      stats: S.stats || {}
    };
    await saveUserData(currentUser.uid, payload);
    setLastSyncedTime(new Date());
  } catch (e) {
    setSaveError(true);
    console.error('Save general metadata to Cloud failed:', e);
  } finally {
    setSyncing(false);
  }
}

export function exportData(format = 'json'){
  if (!hasPermission('clients.export')) {
    showToast(t('⚠️ لا تملك صلاحية تصدير البيانات. يتم ضبط الصلاحيات من طرف الرئيس (Gérant).'), 'error');
    return;
  }
  try{
    const isDum = format === 'dum' || format === 'dump';
    const payload=JSON.stringify({
      v:SCHEMA_VERSION,
      exported:new Date().toISOString(),
      format: isDum ? 'PROGILIC_CRM_DUMP' : 'PROGILIC_CRM_JSON',
      nid:S.nid,
      clients:clients.map(sanitizeClient)
    },null,2);
    const mime = isDum ? 'application/octet-stream' : 'application/json';
    const ext = isDum ? 'dum' : 'json';
    const blob=new Blob([payload],{type: mime});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url;
    a.download=`progilic-crm-backup-${td()}.${ext}`;
    document.body.appendChild(a);
    a.click();
    setTimeout(()=>{document.body.removeChild(a);URL.revokeObjectURL(url);},1000);
    logActivity(null, ActivityType.DATA_EXPORTED, 'تصدير نسخة بيانات', `تم تصدير بيانات ${clients.length} عميل بصيغة ${ext.toUpperCase()}.`).catch(console.warn);
  }catch(e){showToast(t('فشل التصدير: ')+e.message, 'error');}
}

export function exportToDump(){
  exportData('dum');
}

export function exportToCSV(){
  if (!hasPermission('clients.export')) {
    showToast(t('⚠️ لا تملك صلاحية تصدير البيانات. يتم ضبط الصلاحيات من طرف الرئيس (Gérant).'), 'error');
    return;
  }
  try{
    const ac=clients.filter(c=>c.status==='نشط').length;
    const pr=clients.filter(c=>c.status==='محتمل').length;
    const pa=clients.filter(c=>c.status==='متوقف').length;
    const totalProgs=clients.reduce((s,c)=>s+(c.programs||[]).length,0);
    const totalInst=clients.reduce((s,c)=>s+(c.programs||[]).reduce((a,p)=>a+(Number(p.installationsCount)||1),0),0);
    const avgScore=clients.length?Math.round(clients.reduce((s,c)=>s+computeScore(c).total,0)/clients.length):0;

    let csvContent="";
    
    const generalStatsTitle = S.lang === 'fr' ? 'Statistiques Générales' : (S.lang === 'en' ? 'General Statistics' : 'إحصائيات عامة');
    const exportDateTitle = S.lang === 'fr' ? 'Date d\'exportation' : (S.lang === 'en' ? 'Export Date' : 'تاريخ التصدير');
    const totalClientsTitle = S.lang === 'fr' ? 'Total Clients' : (S.lang === 'en' ? 'Total Clients' : 'إجمالي العملاء');
    const activeClientsTitle = S.lang === 'fr' ? 'Clients Actifs' : (S.lang === 'en' ? 'Active Clients' : 'عملاء نشطون');
    const prospectClientsTitle = S.lang === 'fr' ? 'Clients Prospects' : (S.lang === 'en' ? 'Prospect Clients' : 'عملاء محتملون');
    const inactiveClientsTitle = S.lang === 'fr' ? 'Clients Inactifs' : (S.lang === 'en' ? 'Inactive Clients' : 'عملاء متوقفون');
    const totalProgramsTitle = S.lang === 'fr' ? 'Total Logiciels' : (S.lang === 'en' ? 'Total Software' : 'إجمالي البرامج');
    const totalDevicesTitle = S.lang === 'fr' ? 'Total Appareils Licenciés' : (S.lang === 'en' ? 'Total Licensed Devices' : 'إجمالي الأجهزة المرخصة');
    const avgScoreTitle = S.lang === 'fr' ? 'Score Moyen des Clients' : (S.lang === 'en' ? 'Average Client Score' : 'متوسط نقاط العملاء');
    const tableTitle = S.lang === 'fr' ? 'Tableau détaillé des clients' : (S.lang === 'en' ? 'Detailed Clients Table' : 'جدول العملاء التفصيلي');

    csvContent+=`"${generalStatsTitle}","PROGILIC CRM v3"\n`;
    csvContent+=`"${exportDateTitle}","${td()}"\n`;
    csvContent+=`"${totalClientsTitle}","${clients.length}"\n`;
    csvContent+=`"${activeClientsTitle}","${ac}"\n`;
    csvContent+=`"${prospectClientsTitle}","${pr}"\n`;
    csvContent+=`"${inactiveClientsTitle}","${pa}"\n`;
    csvContent+=`"${totalProgramsTitle}","${totalProgs}"\n`;
    csvContent+=`"${totalDevicesTitle}","${totalInst}"\n`;
    csvContent+=`"${avgScoreTitle}","${avgScore}"\n`;
    csvContent+=`"\n`;
    csvContent+=`"${tableTitle}"\n`;
    
    const headers = S.lang === 'fr' ? [
      "ID", "Nom complet", "Entreprise", "Téléphone", "Wilaya", "Localisation",
      "Activité principale", "Spécialité", "Statut", "Début contrat", "Fin contrat",
      "Dernier contact", "Nombre de logiciels", "Nombre d'appareils", "Problèmes ouverts",
      "Total des demandes", "Score client"
    ] : (S.lang === 'en' ? [
      "ID", "Full Name", "Company", "Phone", "Wilaya", "Location",
      "Main Activity", "Specialty", "Status", "Contract Start", "Contract End",
      "Last Contact", "Programs Count", "Devices Count", "Open Issues",
      "Total Requirements", "Client Score"
    ] : [
      "المعرف", "الاسم الكامل", "المؤسسة/الشركة", "الهاتف", "الولاية", "المنطقة/الحي",
      "النشاط الرئيسي", "تخصص النشاط", "الحالة", "بداية العقد", "نهاية العقد",
      "آخر تواصل", "عدد البرامج", "عدد الأجهزة", "المشاكل المفتوحة",
      "إجمالي الطلبات", "نقاط العميل"
    ]);
    
    csvContent+=headers.map(h=>`"${h}"`).join(",")+ "\n";
    
    clients.forEach(c=>{
      const ps=getProgramStats(c);
      const oi=(c.issues||[]).filter(i=>i.status==='مفتوح'||i.status==='قيد المعالجة').length;
      const sc=computeScore(c).total;
      
      const row=[
        c.id,
        c.fullName||"",
        c.company||"",
        hasPermission('clients.view_sensitive') ? (c.phone || "") : (c.phone ? "0550•• •••• 🔒" : ""),
        c.wilaya||"",
        c.location||"",
        t(c.businessType||""),
        t(c.businessField||""),
        t(c.status||""),
        c.startDate||"",
        c.endDate||"",
        c.lastContact||"",
        ps.total,
        ps.totalInstalls,
        oi,
        (c.requirements||[]).length,
        sc
      ];
      
      csvContent+=row.map(v=>{
        const str=String(v===null||v===undefined?"":v);
        return `"${str.replace(/"/g,'""')}"`;
      }).join(",")+ "\n";
    });
    
    const blob=new Blob(["\uFEFF"+csvContent],{type:'text/csv;charset=utf-8;'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url;a.download=`progilic-clients-export-${td()}.csv`;
    document.body.appendChild(a);a.click();
    setTimeout(()=>{document.body.removeChild(a);URL.revokeObjectURL(url);},1000);
    logActivity(null, ActivityType.DATA_EXPORTED, 'تصدير بيانات العملاء', `تم تصدير تقرير CSV لعدد ${clients.length} عميل.`).catch(console.warn);
  }catch(e){showToast(t('فشل تصدير CSV: ')+e.message, 'error');}
}

// Universal Parser for .DUM, .DUMP, and .JSON files
export function parseDumpOrJson(rawText) {
  if (!rawText || typeof rawText !== 'string') {
    throw new Error(t('الملف فارغ أو غير صالح'));
  }

  let text = rawText.trim();

  // Strip UTF-8 BOM if present
  if (text.charCodeAt(0) === 0xFEFF) {
    text = text.slice(1).trim();
  }

  // Strip null bytes (UTF-16 LE/BE conversion artifacts)
  if (text.includes('\u0000')) {
    text = text.replace(/\u0000/g, '').trim();
  }

  // Safe UTF-8 Base64 decoder
  const decodeBase64Safe = (b64) => {
    try {
      const cleanB64 = b64.replace(/\s+/g, '');
      const binary = atob(cleanB64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      return new TextDecoder('utf-8').decode(bytes);
    } catch (_) {
      try { return atob(b64.replace(/\s+/g, '')); } catch (__) { return null; }
    }
  };

  // Helper to strip comments and trailing commas from relaxed JSON
  const stripJsonComments = (str) => {
    return str.replace(/\/\*[\s\S]*?\*\/|([^:]|^)\/\/.*$/gm, '$1').replace(/,\s*([}\]])/g, '$1');
  };

  // Handle Data URL prefix (e.g. data:application/octet-stream;base64,...)
  if (text.startsWith('data:')) {
    const commaIdx = text.indexOf(',');
    if (commaIdx !== -1) {
      const b64 = text.slice(commaIdx + 1).replace(/\s+/g, '');
      const dec = decodeBase64Safe(b64);
      if (dec) text = dec.trim();
    }
  }

  // Handle markdown code fences (```json or ```dum)
  if (text.startsWith('```')) {
    const lines = text.split(/\r?\n/);
    if (lines.length > 2 && lines[lines.length - 1].startsWith('```')) {
      text = lines.slice(1, -1).join('\n').trim();
    }
  }

  // Helper to extract client array from any parsed object or array
  const extractList = (obj) => {
    if (Array.isArray(obj)) return obj;
    if (obj && typeof obj === 'object') {
      const candidates = [
        obj.clients, obj.data, obj.records, obj.rows, obj.items, obj.customers,
        obj.donnees, obj['العملاء'], obj['عملاء'], obj.clients_list, obj.table_clients,
        obj.backup?.clients, obj.snapshot?.clients, obj.payload?.clients, obj.PROGILIC_CRM?.clients
      ];
      for (const cand of candidates) {
        if (Array.isArray(cand)) return cand;
      }
      const vals = Object.values(obj).filter(v => v && typeof v === 'object' && !Array.isArray(v));
      const clientLike = vals.filter(v => v && (v.fullName || v.name || v.company || v.phone || v.wilaya || v.location || v.id));
      if (clientLike.length > 0) {
        return clientLike;
      }
    }
    return null;
  };

  // 1. Direct JSON parse
  try {
    const parsed = JSON.parse(text);
    const clientsList = extractList(parsed);
    if (clientsList) {
      return { clients: clientsList, ...((typeof parsed === 'object' && !Array.isArray(parsed)) ? parsed : {}) };
    }
  } catch (_) {}

  // 1b. Relaxed JSON (comments / trailing commas stripped)
  try {
    const stripped = stripJsonComments(text);
    const parsed = JSON.parse(stripped);
    const clientsList = extractList(parsed);
    if (clientsList) {
      return { clients: clientsList, ...((typeof parsed === 'object' && !Array.isArray(parsed)) ? parsed : {}) };
    }
  } catch (_) {}

  // 2. Base64 encoded JSON (common in binary-like .dum backups)
  try {
    const decoded = decodeBase64Safe(text);
    if (decoded && (decoded.startsWith('{') || decoded.startsWith('['))) {
      const parsed = JSON.parse(decoded);
      const clientsList = extractList(parsed);
      if (clientsList) {
        return { clients: clientsList, ...((typeof parsed === 'object' && !Array.isArray(parsed)) ? parsed : {}) };
      }
    }
  } catch (_) {}

  // 3. Extract embedded JSON block (e.g. if .dum has header comments or wrapper text)
  try {
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      const jsonCandidate = text.slice(firstBrace, lastBrace + 1);
      let parsed = null;
      try { parsed = JSON.parse(jsonCandidate); } catch (_) {
        try { parsed = JSON.parse(stripJsonComments(jsonCandidate)); } catch (__) {}
      }
      if (parsed) {
        const clientsList = extractList(parsed);
        if (clientsList) {
          return { clients: clientsList, ...((typeof parsed === 'object' && !Array.isArray(parsed)) ? parsed : {}) };
        }
      }
    }
    const firstBracket = text.indexOf('[');
    const lastBracket = text.lastIndexOf(']');
    if (firstBracket !== -1 && lastBracket > firstBracket) {
      const jsonCandidate = text.slice(firstBracket, lastBracket + 1);
      let parsed = null;
      try { parsed = JSON.parse(jsonCandidate); } catch (_) {
        try { parsed = JSON.parse(stripJsonComments(jsonCandidate)); } catch (__) {}
      }
      if (parsed) {
        const clientsList = extractList(parsed);
        if (clientsList) {
          return { clients: clientsList };
        }
      }
    }
  } catch (_) {}

  // 4. JSON Lines (NDJSON / .dum stream with one json per line)
  try {
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const fromJsonL = [];
    for (const line of lines) {
      if ((line.startsWith('{') && line.endsWith('}')) || (line.startsWith('[') && line.endsWith(']'))) {
        try {
          const item = JSON.parse(line);
          if (Array.isArray(item)) fromJsonL.push(...item);
          else if (item && (item.fullName || item.name || item.company || item.phone)) fromJsonL.push(item);
        } catch (_) {}
      }
    }
    if (fromJsonL.length > 0) {
      return { clients: fromJsonL };
    }
  } catch (_) {}

  // 5. SQL Dump (INSERT INTO ... VALUES ...)
  try {
    const insertRegex = /INSERT\s+INTO\s+[`"']?([a-zA-Z0-9_]+)[`"']?\s*\(([^)]+)\)\s*VALUES\s*([^;]+);/gi;
    let match;
    const sqlClients = [];
    while ((match = insertRegex.exec(text)) !== null) {
      const cols = match[2].split(',').map(c => c.replace(/[`"'\s]/g, '').trim());
      const valuesBlock = match[3];
      const rowRegex = /\(([^)]+)\)/g;
      let rowMatch;
      while ((rowMatch = rowRegex.exec(valuesBlock)) !== null) {
        const rawVals = rowMatch[1].split(',').map(v => v.trim().replace(/^['"]|['"]$/g, ''));
        const obj = {};
        cols.forEach((col, i) => {
          obj[col] = rawVals[i] !== undefined && rawVals[i] !== 'NULL' ? rawVals[i] : '';
        });
        if (obj.fullName || obj.name || obj.company || obj.phone) {
          sqlClients.push(obj);
        }
      }
    }
    if (sqlClients.length > 0) {
      return { clients: sqlClients };
    }
  } catch (_) {}

  // 6. Delimited Dump (CSV / TSV / Semicolon-delimited rows)
  try {
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (lines.length >= 2) {
      const firstLine = lines[0];
      let delimiter = ',';
      if (firstLine.includes(';') && firstLine.split(';').length > firstLine.split(',').length) delimiter = ';';
      else if (firstLine.includes('\t')) delimiter = '\t';
      else if (firstLine.includes('|')) delimiter = '|';

      const headers = firstLine.split(delimiter).map(h => h.replace(/^["']|["']$/g, '').trim());
      const csvClients = [];
      for (let i = 1; i < lines.length; i++) {
        const rawCols = lines[i].split(delimiter).map(c => c.replace(/^["']|["']$/g, '').trim());
        const obj = {};
        headers.forEach((h, idx) => { obj[h] = rawCols[idx] || ''; });
        const normalized = {
          fullName: obj.fullName || obj.name || obj['الاسم الكامل'] || obj['الاسم'] || obj['Nom complet'] || obj['Nom'] || obj[headers[0]] || `عميل ${i}`,
          company: obj.company || obj['المؤسسة/الشركة'] || obj['الشركة'] || obj['Entreprise'] || obj[headers[1]] || '',
          phone: obj.phone || obj['الهاتف'] || obj['Téléphone'] || obj['tel'] || obj[headers[2]] || '',
          wilaya: obj.wilaya || obj['الولاية'] || '',
          commune: obj.commune || obj['البلدية'] || '',
          location: obj.location || obj['المنطقة/الحي'] || obj['Localisation'] || '',
          status: obj.status || obj['الحالة'] || obj['Statut'] || 'نشط',
          startDate: obj.startDate || obj['بداية العقد'] || '',
          endDate: obj.endDate || obj['نهاية العقد'] || '',
          notes: obj.notes || obj['ملاحظات'] || ''
        };
        csvClients.push(normalized);
      }
      if (csvClients.length > 0) {
        return { clients: csvClients };
      }
    }
  } catch (_) {}

  // 7. Universal Fallback: If text contains any lines or JSON objects, convert them to client records
  try {
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (lines.length > 0) {
      const fallbackClients = lines.map((l, idx) => ({
        id: idx + 1,
        fullName: l.replace(/^["']|["']$/g, ''),
        company: '',
        phone: '',
        status: 'نشط',
        wilaya: '',
        programs: [],
        issues: [],
        requirements: []
      }));
      if (fallbackClients.length > 0) {
        return { clients: fallbackClients };
      }
    }
  } catch (_) {}

  throw new Error(t('تعذر قراءة بيانات العملاء من ملف الـ DUM / JSON. تأكد من صحة تنسيق الملف.'));
}

export function importData(file){
  if(!file)return;
  if (!hasPermission('backup.restore') && !isGerant()) {
    showToast(t('⚠️ لا تملك صلاحية استيراد واسترجاع البيانات. يتم ضبط الصلاحيات من طرف الرئيس (Gérant).'), 'error');
    return;
  }
  const fileName = file.name || 'ملف النسخة الاحتياطية';
  const isDum = fileName.toLowerCase().endsWith('.dum') || fileName.toLowerCase().endsWith('.dump');
  const reader=new FileReader();
  reader.onload=async e=>{
    try{
      const rawText = e.target.result;
      let d = parseDumpOrJson(rawText);
      d = migrateSchema(d);
      if(!d || !Array.isArray(d.clients) || d.clients.length === 0) {
        throw new Error(t('الملف لا يحتوي على بيانات عملاء صالحة'));
      }

      const fileTypeLabel = isDum ? 'DUM' : 'JSON';
      const confirmPrompt = S.lang === 'fr'
        ? `Fichier ${fileTypeLabel} détecté (${fileName}) : ${d.clients.length} client(s) trouvés.\nToutes vos données actuelles seront remplacées par le contenu du fichier.\nVoulez-vous continuer ?`
        : (S.lang === 'en'
          ? `${fileTypeLabel} file detected (${fileName}): ${d.clients.length} client(s) found.\nAll current data will be replaced by the file content.\nDo you want to continue?`
          : `تم التعرف على ملف ${fileTypeLabel} (${fileName}) يحتوي على ${d.clients.length} عميل.\nسيتم استبدال جميع بياناتك ببيانات هذا الملف والبدء بهيكل v3.\nهل تريد المتابعة؟`);

      const confirmed = await showConfirm(confirmPrompt, t('استيراد البيانات'));
      if(!confirmed)return;
      
      if (S.quotaExceeded || _quotaBlocked || globalThis?.__progilicFirestoreQuotaExceeded) {
        showToast(t('تم تجاوز حصة القراءة والكتابة اليومية، تعذر الاستيراد السحابي الآن.'), 'error');
        return;
      }
      if (!S.isOnline || (typeof navigator !== 'undefined' && navigator.onLine === false)) {
        showToast(t('النظام يعمل حصرياً أونلاين: لا يمكن استيراد البيانات بدون اتصال فعلي بالسحابة.'), 'error');
        return;
      }

      setSyncing(true);
      updateState({ isMutating: true });

      const maxId = d.clients.reduce((m, c) => Math.max(m, Number(c.id) || 0, ...(c.issues || []).map(i => Number(i.id) || 0), ...(c.requirements || []).map(r => Number(r.id) || 0)), 0);
      const nextNid = Math.max(d.nid || 0, maxId) + 1;

      if (!currentUser || !currentUser.uid) {
        throw new Error(t('يجب تسجيل الدخول لاستيراد البيانات إلى السحابة.'));
      }

      // Await Cloud Firestore acknowledgement BEFORE updating confirmed UI state
      await migrateLegacyDataIfNeeded(currentUser.uid, d, nextNid);

      const stats = d.stats || computeStats(d.clients).stats;
      setClients(d.clients.map(c => ({ ...c, _subcollectionsLoaded: true })));
      updateState({ nid: nextNid, stats, hasConfirmedServerSync: true });
      setLastSyncedTime(new Date());
      showToast(t(`تم استيراد ${d.clients.length} عميل وحفظهم في السحابة بنجاح!`), "success");
      S.view = 'list'; S.selId = null; S.modal = null; S.gi = false;
      R();
    } catch (er) {
      if (isQuotaError(er)) handleFirestoreQuotaExceeded('Import backup', er);
      else showToast(t('فشل الحفظ السحابي للاستيراد: ') + er.message, 'error');
    } finally {
      setSyncing(false);
      updateState({ isMutating: false });
    }
  };
  reader.readAsText(file);
}

export function importFromDump(file){
  return importData(file);
}

export function triggerImportDumOrJson(){
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.dum,.dump,.json,.txt,.csv';
  input.style.display = 'none';
  input.onchange = (e) => {
    if (e.target.files && e.target.files[0]) {
      importData(e.target.files[0]);
    }
  };
  document.body.appendChild(input);
  input.click();
  setTimeout(() => {
    if (input.parentNode) document.body.removeChild(input);
  }, 1000);
}

export async function clearAllData(){
  const msg1 = S.lang === 'fr'
    ? '⚠️ Êtes-vous certain de vouloir supprimer définitivement toutes les données ?\nCette action est irréversible.'
    : (S.lang === 'en'
      ? '⚠️ Are you sure you want to permanently delete all data?\nThis action cannot be undone.'
      : '⚠️ هل أنت متأكد من حذف جميع البيانات نهائياً؟\nلا يمكن التراجع عن هذا الإجراء.');
  const confirmed1 = await showConfirm(msg1, t('مسح جميع البيانات'));
  if(!confirmed1)return;
  
  const msg2 = S.lang === 'fr'
    ? 'Confirmation finale : tous les clients, tickets et demandes seront effacés.\nContinuer ?'
    : (S.lang === 'en'
      ? 'Final confirmation: all clients, issues, and requirements will be erased.\nContinue?'
      : 'تأكيد أخير: سيتم مسح جميع العملاء والمشاكل والمتطلبات.\nاستمرار؟');
  const confirmed2 = await showConfirm(msg2, t('تأكيد الحذف النهائي'));
  if(!confirmed2)return;
  
  try {
    setSyncing(true);

    const stats = {
      activeClients: 0,
      prospectiveClients: 0,
      stoppedClients: 0,
      totalClients: 0,
      totalPrograms: 0,
      totalLicensedDevices: 0,
      averageScore: 100,
      totalOpenIssues: 0
    };

    const batch = writeBatch(db);
    // Delete all client docs we have in memory
    for (const c of clients) {
      batch.delete(doc(db, `users/${currentUser.uid}/clients/${c.id}`));
    }
    await batch.commit();

    await saveUserData(currentUser.uid, {
      v: SCHEMA_VERSION,
      updatedAt: new Date().toISOString(),
      nid: 100,
      stats
    });

    setClients([]);
    updateState({ nid: 100, stats });
    setLastSyncedTime(new Date());
    S.view='list';S.selId=null;S.gi=false;
    R();
  } catch (err) {
    showToast(t("حدث خطأ أثناء مسح البيانات: ") + err.message, 'error');
  } finally {
    setSyncing(false);
  }
}

// ==========================================
// REAL-TIME AUTO SYNC & DURABLE PENDING QUEUE ENGINE
// ==========================================

export async function loadCache() {
  const uid = (auth && auth.currentUser && auth.currentUser.uid) || getActiveTenantId() || currentUser?.uid;
  const persisted = uid ? readPersistedSyncQueue(uid) : [];
  updateState({
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    syncQueue: persisted,
    pendingSyncCount: persisted.length,
    hasPendingLocalWrites: persisted.length > 0,
    connectionState: (typeof navigator !== 'undefined' && navigator.onLine === false) ? 'offline' : S.connectionState
  });
}

async function executeServerMutation(uid, type, payload) {
  switch (type) {
    case 'ADD_CLIENT':
      return await addClientTransaction(uid, payload.clientData, payload.stats);
    case 'UPDATE_CLIENT':
      return await updateClientTransaction(
        uid,
        payload.clientId,
        payload.clientData,
        payload.oldStatus,
        payload.stats,
        payload.baseVersion ?? 0
      );
    case 'DELETE_CLIENT':
      return await deleteClientTransaction(uid, payload.clientId, payload.clientData, payload.stats);
    case 'SAVE_SUB_ITEM':
      return await saveClientSubItemTransaction(
        uid,
        payload.clientId,
        payload.collectionName,
        payload.itemId,
        payload.itemData,
        payload.counterUpdates,
        payload.stats,
        payload.concurrency || {}
      );
    case 'DELETE_SUB_ITEM':
      return await deleteClientSubItemTransaction(
        uid,
        payload.clientId,
        payload.collectionName,
        payload.itemId,
        payload.counterUpdates,
        payload.stats,
        payload.concurrency || {}
      );
    case 'SYNC_PROGRAM_VERSION':
      return await syncProgramVersionTransaction(uid, payload.clientId, {
        updatedPrograms: payload.updatedPrograms,
        counterUpdates: payload.counterUpdates,
        versionHistoryEntry: payload.versionHistoryEntry,
        concurrency: payload.concurrency || { baseVersion: payload.baseVersion }
      });
    default:
      throw new Error(`Unsupported mutation type: ${type}`);
  }
}

function applyServerAckToLocalClients(type, payload, result) {
  if (!result || typeof result !== 'object') return;
  const cid = extractMutationClientId({ type, payload });
  if (cid === null) return;
  const cidStr = String(cid);
  const currentList = Array.isArray(clients) ? clients : [];
  const idx = currentList.findIndex(c => String(c?.id) === cidStr);
  if (idx === -1) return;

  const target = { ...currentList[idx], _dirtyLocal: false };
  if (result.version !== undefined) target.version = result.version;
  if (result.updatedAt !== undefined) target.updatedAt = result.updatedAt;

  if (type === 'SAVE_SUB_ITEM' && result.itemVersion !== undefined && payload?.collectionName) {
    const fieldName = payload.collectionName === 'contacts' ? 'contactHistory' : payload.collectionName;
    const versionField = payload.collectionName === 'programs' ? 'versionNum' : 'version';
    if (Array.isArray(target[fieldName])) {
      target[fieldName] = target[fieldName].map(it =>
        String(it?.id) === String(payload.itemId)
          ? { ...it, [versionField]: result.itemVersion }
          : it
      );
    }
  }

  if (type === 'SYNC_PROGRAM_VERSION') {
    if (Array.isArray(result.updatedPrograms) && result.updatedPrograms.length > 0 && Array.isArray(target.programs)) {
      const updatedById = new Map(result.updatedPrograms.map(p => [String(p.id), p]));
      target.programs = target.programs.map(p => updatedById.get(String(p?.id)) || p);
      target.programNames = target.programs.map(p => p?.programName).filter(Boolean);
      target.programsCount = target.programs.length;
      target.installationsCount = target.programs.reduce((s, p) => s + (Number(p?.installationsCount) || 1), 0);
    }
    if (Array.isArray(result.versionHistory)) {
      target.versionHistory = result.versionHistory;
    }
  }

  const nextList = [...currentList];
  nextList[idx] = target;
  setClients(nextList);
}

function enqueueMutationLocally(uid, type, payload) {
  const existingQueue = getEffectiveSyncQueue(uid);
  const nextQueue = coalescePendingMutation(existingQueue, { type, payload });
  writePersistedSyncQueue(uid, nextQueue);
  setSaveError(false);
  updateState({
    syncQueue: nextQueue,
    pendingSyncCount: nextQueue.length,
    hasPendingLocalWrites: nextQueue.length > 0,
    dataIsStale: true,
    connectionState: (typeof navigator !== 'undefined' && navigator.onLine === false) || !S.isOnline
      ? 'offline'
      : 'cached-stale'
  });
  return {
    acknowledged: false,
    queued: true,
    queueLength: nextQueue.length
  };
}

export async function commitOnlineMutation(type, payload, options = {}) {
  if (_quotaBlocked || S.quotaExceeded || globalThis?.__progilicFirestoreQuotaExceeded) {
    const quotaErr = new Error(t('تم تجاوز الحد اليومي لحصة Firestore. الكتابة معلقة مؤقتاً لحماية قاعدة البيانات.'));
    quotaErr.code = 'resource-exhausted';
    throw quotaErr;
  }

  const uid = (auth && auth.currentUser && auth.currentUser.uid) || (currentUser && currentUser.tenantId) || (currentUser && !currentUser.isEmployee ? currentUser.uid : null) || getActiveTenantId() || currentUser?.uid;
  if (!uid) {
    const authErr = new Error(t('يجب تسجيل الدخول بحساب سحابي صالح قبل حفظ التعديلات.'));
    authErr.code = 'unauthenticated';
    throw authErr;
  }

  const browserOnline = typeof navigator === 'undefined' || navigator.onLine !== false;
  if (!browserOnline || !S.isOnline) {
    updateState({ isOnline: false, connectionState: 'offline' });
    if (options.disableOfflineQueue) {
      const offlineErr = new Error(t('الاتصال بالإنترنت مقطوع. لا يمكن تنفيذ هذه العملية الآن.'));
      offlineErr.code = 'network-offline';
      setSaveError(true);
      throw offlineErr;
    }
    return enqueueMutationLocally(uid, type, payload);
  }

  const cid = extractMutationClientId({ type, payload });
  if (cid !== null) {
    inFlightMutationClientIds.add(String(cid));
  }

  updateState({ isMutating: true });
  setSyncing(true);
  setSaveError(false);

  try {
    const result = await executeServerMutation(uid, type, payload);
    applyServerAckToLocalClients(type, payload, result);

    const remainingQueue = getEffectiveSyncQueue(uid);
    setLastSyncedTime(new Date());
    setSaveError(false);
    updateState({
      hasConfirmedServerSync: true,
      dataIsStale: false,
      connectionState: 'live',
      lastListenerError: null,
      pendingSyncCount: remainingQueue.length,
      hasPendingLocalWrites: remainingQueue.length > 0
    });

    createSnapshotBackup(uid, "تلقائي بعد المزامنة", clients, S.stats, S.nid)
      .catch(err => console.warn("[Backup] Snapshot after sync notice:", err));

    return { ...(result || {}), acknowledged: true, queued: false };
  } catch (err) {
    if (err?.code === 'VERSION_CONFLICT' || (err?.message && err.message.includes('VERSION_CONFLICT'))) {
      setSaveError(true);
      updateState({
        conflictItem: {
          id: `${Date.now()}-conflict`,
          type,
          payload,
          conflictScope: err.conflictScope || (payload?.collectionName ? 'subitem' : 'client'),
          collectionName: err.collectionName || payload?.collectionName || null,
          itemId: err.itemId || payload?.itemId || null,
          serverItem: err.serverItem || null,
          deletedRemotely: Boolean(err.deletedRemotely),
          timestamp: new Date().toISOString()
        },
        conflictServerData: err.serverData || null,
        modal: 'conflict'
      });
      if (typeof window !== 'undefined' && typeof window.R === 'function') window.R();
      else R();
      throw err;
    }

    if (isQuotaError(err)) {
      handleFirestoreQuotaExceeded(`Mutation(${type})`, err);
      throw err;
    }

    const kind = classifyFirestoreError(err);
    if (!options.disableOfflineQueue && !options.fromQueueFlush && isQueueableSyncError(err, { code: kind })) {
      return enqueueMutationLocally(uid, type, payload);
    }

    setSaveError(true);
    if (kind === 'network-offline') {
      updateState({ connectionState: 'offline' });
    }
    throw err;
  } finally {
    if (cid !== null) {
      inFlightMutationClientIds.delete(String(cid));
    }
    setSyncing(false);
    updateState({ isMutating: false });
  }
}

export async function flushSyncQueue(userIdOverride = null) {
  const uid = userIdOverride || (auth && auth.currentUser && auth.currentUser.uid) || getActiveTenantId() || currentUser?.uid;
  if (!uid) return true;
  if (_isFlushingQueue) return false;
  if (_quotaBlocked || S.quotaExceeded || globalThis?.__progilicFirestoreQuotaExceeded) return false;
  const browserOnline = typeof navigator === 'undefined' || navigator.onLine !== false;
  if (!browserOnline || !S.isOnline) return false;

  let workingQueue = [...getEffectiveSyncQueue(uid)];
  if (workingQueue.length === 0) {
    updateState({ syncQueue: [], pendingSyncCount: 0, hasPendingLocalWrites: false });
    return true;
  }

  _isFlushingQueue = true;
  setSyncing(true);
  updateState({ isMutating: true });

  try {
    while (workingQueue.length > 0) {
      const head = workingQueue[0];
      const cid = extractMutationClientId(head);
      if (cid !== null) inFlightMutationClientIds.add(String(cid));

      try {
        const ack = await executeServerMutation(uid, head.type, head.payload);
        applyServerAckToLocalClients(head.type, head.payload, ack);
        workingQueue = workingQueue.slice(1);
        if (cid !== null && workingQueue.length > 0) {
          workingQueue = advanceQueuedMutationVersions(workingQueue, cid, ack);
        }
        writePersistedSyncQueue(uid, workingQueue);
        updateState({
          syncQueue: workingQueue,
          pendingSyncCount: workingQueue.length,
          hasPendingLocalWrites: workingQueue.length > 0,
          hasConfirmedServerSync: true,
          dataIsStale: workingQueue.length > 0,
          connectionState: workingQueue.length > 0 ? 'connecting' : 'live',
          lastListenerError: null
        });
        setLastSyncedTime(new Date());
        setSaveError(false);
      } catch (err) {
        if (err?.code === 'VERSION_CONFLICT' || (err?.message && err.message.includes('VERSION_CONFLICT'))) {
          workingQueue = workingQueue.slice(1);
          writePersistedSyncQueue(uid, workingQueue);
          setSaveError(true);
          updateState({
            syncQueue: workingQueue,
            pendingSyncCount: workingQueue.length,
            hasPendingLocalWrites: workingQueue.length > 0,
            conflictItem: {
              id: head.id || `${Date.now()}-conflict`,
              type: head.type,
              payload: head.payload,
              conflictScope: err.conflictScope || (head.payload?.collectionName ? 'subitem' : 'client'),
              collectionName: err.collectionName || head.payload?.collectionName || null,
              itemId: err.itemId || head.payload?.itemId || null,
              serverItem: err.serverItem || null,
              deletedRemotely: Boolean(err.deletedRemotely),
              timestamp: new Date().toISOString()
            },
            conflictServerData: err.serverData || null,
            modal: 'conflict'
          });
          if (typeof window !== 'undefined' && typeof window.R === 'function') window.R();
          else R();
          return false;
        }

        if (isQuotaError(err)) {
          handleFirestoreQuotaExceeded('FlushSyncQueue', err);
          return false;
        }

        const kind = classifyFirestoreError(err);
        if (isQueueableSyncError(err, { code: kind })) {
          updateState({ connectionState: 'offline', dataIsStale: true });
          return false;
        }

        // Fatal permission/validation error: keep user aware, do not silently discard
        setSaveError(true);
        showToast(t('تعذر مزامنة أحد التعديلات المعلقة: ') + (err?.message || kind), 'error');
        return false;
      } finally {
        if (cid !== null) inFlightMutationClientIds.delete(String(cid));
      }
    }

    return true;
  } finally {
    _isFlushingQueue = false;
    setSyncing(false);
    updateState({ isMutating: false });
  }
}

export function enqueueSyncAction(type, payload, options = {}) {
  return commitOnlineMutation(type, payload, options);
}

export async function resolveConflict(decision) {
  const item = S.conflictItem;
  const serverData = S.conflictServerData;
  if (!item || !serverData) return false;

  const targetCid = extractMutationClientId(item);
  const itemType = item.type || 'UPDATE_CLIENT';
  const uid = (auth && auth.currentUser && auth.currentUser.uid) || getActiveTenantId() || currentUser?.uid;

  if (decision === 'server') {
    const nextClients = clients.map(c => {
      if (String(c.id) !== String(targetCid)) return c;
      const merged = { ...c, ...serverData, _dirtyLocal: false };
      if (item.collectionName && item.itemId !== null && item.itemId !== undefined) {
        const fieldName = item.collectionName === 'contacts' ? 'contactHistory' : item.collectionName;
        if (Array.isArray(merged[fieldName])) {
          if (item.deletedRemotely) {
            merged[fieldName] = merged[fieldName].filter(x => String(x?.id) !== String(item.itemId));
          } else if (item.serverItem) {
            const exists = merged[fieldName].some(x => String(x?.id) === String(item.itemId));
            merged[fieldName] = exists
              ? merged[fieldName].map(x => String(x?.id) === String(item.itemId) ? item.serverItem : x)
              : [...merged[fieldName], item.serverItem];
          }
        }
      }
      return merged;
    });
    setClients(nextClients);
    updateState({ modal: null, conflictItem: null, conflictServerData: null });
    setSaveError(false);
    R();
    showToast(t('تم اعتماد النسخة السحابية الأحدث بنجاح.'), 'success');
    if (uid && Array.isArray(S.syncQueue) && S.syncQueue.length > 0) {
      flushSyncQueue(uid).catch(console.warn);
    }
    return true;
  }

  if (decision === 'local' || decision === 'merge') {
    let nextPayload;
    if (itemType === 'UPDATE_CLIENT') {
      const localClientData = item.payload?.clientData || {};
      const mergedData = decision === 'merge'
        ? { ...serverData, ...localClientData }
        : { ...localClientData };
      nextPayload = {
        ...item.payload,
        clientData: mergedData,
        baseVersion: Number(serverData.version || 0)
      };
    } else if (itemType === 'SAVE_SUB_ITEM' || itemType === 'DELETE_SUB_ITEM') {
      const isProgram = item.payload?.collectionName === 'programs';
      const versionField = isProgram ? 'versionNum' : 'version';
      nextPayload = {
        ...item.payload,
        concurrency: {
          ...(item.payload?.concurrency || {}),
          baseVersion: Number(serverData.version || 0),
          expectedItemVersion: item.serverItem ? Number(item.serverItem[versionField] || 0) : null,
          isCreate: !item.serverItem
        }
      };
    } else if (itemType === 'SYNC_PROGRAM_VERSION') {
      nextPayload = {
        ...item.payload,
        baseVersion: Number(serverData.version || 0),
        concurrency: {
          ...(item.payload?.concurrency || {}),
          baseVersion: Number(serverData.version || 0)
        }
      };
    } else {
      nextPayload = {
        ...item.payload,
        baseVersion: Number(serverData.version || 0)
      };
    }

    try {
      const ack = await commitOnlineMutation(itemType, nextPayload);
      const nextClients = clients.map(c => {
        if (String(c.id) !== String(targetCid)) return c;
        if (itemType === 'UPDATE_CLIENT') {
          return {
            ...c,
            ...(nextPayload.clientData || {}),
            version: ack?.version ?? (Number(serverData.version || 0) + 1),
            _dirtyLocal: false
          };
        }
        return {
          ...c,
          version: ack?.version ?? (Number(serverData.version || 0) + 1),
          _dirtyLocal: false
        };
      });
      setClients(nextClients);
      updateState({ modal: null, conflictItem: null, conflictServerData: null });
      R();
      showToast(t(decision === 'merge' ? 'تم دمج التعديلات وحفظها في السحابة.' : 'تم فرض حفظ تعديلاتك في السحابة.'), 'success');
      if (uid && Array.isArray(S.syncQueue) && S.syncQueue.length > 0) {
        flushSyncQueue(uid).catch(console.warn);
      }
      return true;
    } catch (err) {
      if (err?.code !== 'VERSION_CONFLICT') {
        showToast(t('تعذر تأكيد حل التعارض على السحابة: ') + (err?.message || ''), 'error');
      }
      return false;
    }
  }
  return false;
}
