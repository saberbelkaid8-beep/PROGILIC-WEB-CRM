import { td, getProgramStats, formatCsvCell } from '../utils/index.js';
import { showToast } from '../utils/toast.js';
import { showConfirm } from '../utils/confirm.js';
import { t } from '../utils/i18n.js';
import { computeScore } from './intelligence.js';
import { ActivityType, logActivity, mergeActivities, getPendingActivitiesForTenant } from './timelineService.js';
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
  getUserData, 
  saveUserData, 
  getClientsPage, 
  getClientsFromServer,
  getClientFromServer,
  getClientSubcollections, 
  
  addClientTransaction, 
  updateClientTransaction, 
  deleteClientTransaction, 
  saveClientSubItemTransaction, 
  deleteClientSubItemTransaction 
} from '../firebase/service.js';
import { migrateLegacyDataIfNeeded } from '../firebase/migration.js';
import { onSnapshot, doc, collection, writeBatch } from 'firebase/firestore';
import { db, auth } from '../firebase/config.js';
import { mergeClientLists, computeStats, mergeWithSessionAndUser } from './mergeDatabase.js';
import { getSyncQueue, saveSyncQueue, saveClients, setMeta } from './idbStorage.js';

// Strictly Online Mode: All local storage, IndexedDB, and disk-based caching is disabled.
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
    if (!c.company) c.company = '';
    if (!c.phone) c.phone = '';
    if (!c.wilaya) c.wilaya = '';
    if (!c.commune) c.commune = '';
    if (!c.location) c.location = '';
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
  return p && typeof p === 'object' ? { ...p } : p;
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
    ...c,
    ...(Array.isArray(c.programs) ? { programs: c.programs.map(sanitizeProgram) } : {})
  };
}

const ACTIVE_QUEUE_STATES = new Set(['pending', 'syncing', 'requires-attention', 'failed']);

function computeProgramSummary(programs = []) {
  const safeProgs = Array.isArray(programs) ? programs.filter(Boolean) : [];
  const installationsCount = safeProgs.reduce((total, p) => {
    const count = Number(p?.installationsCount);
    return Number.isSafeInteger(count) && count > 0 ? total + count : total;
  }, 0);
  const programNames = safeProgs.map(p => p.programName).filter(Boolean);
  return {
    programsCount: safeProgs.length,
    installationsCount,
    programNames
  };
}

function mergeAvailableSubcollectionRecords(remoteItems = [], retainedItems = []) {
  const records = new Map();
  const recordKey = (item, index) => {
    if (item?.id !== undefined && item?.id !== null) return `id:${String(item.id)}`;
    return `record:${JSON.stringify(item)}:${index}`;
  };

  (Array.isArray(retainedItems) ? retainedItems : []).forEach((item, index) => {
    if (item && typeof item === 'object') records.set(recordKey(item, index), item);
  });
  (Array.isArray(remoteItems) ? remoteItems : []).forEach((item, index) => {
    if (item && typeof item === 'object') records.set(recordKey(item, index), item);
  });
  return Array.from(records.values());
}

function getExpectedProgramCount(client) {
  const count = Number(client?.programsCount);
  const hasCount = Number.isSafeInteger(count) && count >= 0;
  const namesCount = Array.isArray(client?.programNames) ? client.programNames.length : 0;
  const embeddedCount = Array.isArray(client?.programs) ? client.programs.length : 0;
  if (!hasCount && namesCount === 0 && embeddedCount === 0) return null;
  return Math.max(hasCount ? count : 0, namesCount, embeddedCount);
}

export function mergeSubcollectionWithQueue(clientId, collectionName, remoteItems = [], localItems = [], syncQueue = []) {
  const cidStr = String(clientId);
  const queue = Array.isArray(syncQueue) ? syncQueue : [];
  const byId = new Map();
  const unidentified = new Map();

  for (const [index, item] of (Array.isArray(remoteItems) ? remoteItems : []).entries()) {
    if (!item || typeof item !== 'object') continue;
    if (item.id === undefined || item.id === null) {
      unidentified.set(`${JSON.stringify(item)}:${index}`, { ...item });
    } else {
      byId.set(String(item.id), { ...item });
    }
  }

  // If client creation is still pending in queue and remote has nothing yet, keep local initial items
  const hasPendingAddClient = queue.some(
    q => q && ACTIVE_QUEUE_STATES.has(q.state || 'pending')
      && q.type === 'ADD_CLIENT'
      && String(q.payload?.clientData?.id) === cidStr
  );
  if (hasPendingAddClient && byId.size === 0 && Array.isArray(localItems)) {
    for (const item of localItems) {
      if (!item || item.id === undefined || item.id === null) continue;
      byId.set(String(item.id), { ...item });
    }
  }

  for (const q of queue) {
    if (!q || !ACTIVE_QUEUE_STATES.has(q.state || 'pending')) continue;
    const payload = q.payload || {};
    if (String(payload.clientId) !== cidStr || payload.collectionName !== collectionName) continue;
    const itemId = String(payload.itemId ?? payload.itemData?.id ?? '');
    if (!itemId) continue;

    if (q.type === 'SAVE_SUB_ITEM' && payload.itemData) {
      byId.set(itemId, { ...payload.itemData });
    } else if (q.type === 'DELETE_SUB_ITEM') {
      byId.delete(itemId);
    }
  }

  return [...byId.values(), ...unidentified.values()];
}

export function mergeClientSyncState(remoteSummaries = [], localClients = [], syncQueue = [], options = {}) {
  const isOnline = options.isOnline !== false;
  const queue = Array.isArray(syncQueue) ? syncQueue : [];
  const existingList = Array.isArray(localClients) ? localClients.filter(Boolean) : [];
  const remoteList = Array.isArray(remoteSummaries) ? remoteSummaries.filter(Boolean) : [];

  const pendingDeletes = new Set();
  const pendingAdds = new Map();
  const pendingUpdates = new Map();
  const pendingSubOpsClients = new Map();

  for (const q of queue) {
    if (!q || !ACTIVE_QUEUE_STATES.has(q.state || 'pending')) continue;
    const payload = q.payload || {};
    if (q.type === 'DELETE_CLIENT' && payload.clientId !== undefined) {
      pendingDeletes.add(String(payload.clientId));
    } else if (q.type === 'ADD_CLIENT' && payload.clientData?.id !== undefined) {
      pendingAdds.set(String(payload.clientData.id), { ...payload.clientData, _subcollectionsLoaded: true });
    } else if (q.type === 'UPDATE_CLIENT' && payload.clientId !== undefined && payload.clientData) {
      pendingUpdates.set(String(payload.clientId), payload.clientData);
    } else if ((q.type === 'SAVE_SUB_ITEM' || q.type === 'DELETE_SUB_ITEM') && payload.clientId !== undefined) {
      const cid = String(payload.clientId);
      const set = pendingSubOpsClients.get(cid) || new Set();
      if (payload.collectionName) set.add(payload.collectionName);
      pendingSubOpsClients.set(cid, set);
    }
  }

  // Offline fallback: if offline and remote listener reports empty, preserve non-deleted local cache + pending adds
  if (remoteList.length === 0 && !isOnline && existingList.length > 0) {
    const preserved = existingList.filter(c => !pendingDeletes.has(String(c.id)));
    const preservedIds = new Set(preserved.map(c => String(c.id)));
    for (const [cid, added] of pendingAdds.entries()) {
      if (!pendingDeletes.has(cid) && !preservedIds.has(cid)) {
        preserved.push(added);
      }
    }
    return preserved;
  }

  const existingById = new Map(existingList.map(c => [String(c.id), c]));
  const mergedClients = [];
  const seenIds = new Set();

  for (const newC of remoteList) {
    const cid = String(newC.id);
    if (pendingDeletes.has(cid)) {
      continue;
    }
    seenIds.add(cid);

    const existingC = existingById.get(cid);
    const existingPrograms = Array.isArray(existingC?.programs) ? existingC.programs : [];
    const pendingSubCols = pendingSubOpsClients.get(cid) || new Set();
    const remoteHasZeroPrograms = newC.programsCount !== undefined
      && Number(newC.programsCount) === 0
      && (!Array.isArray(newC.programNames) || newC.programNames.length === 0)
      && (!Array.isArray(newC.programs) || newC.programs.length === 0)
      && existingPrograms.length === 0
      && !pendingSubCols.has('programs');
    const remoteHasEmbeddedProgs = Array.isArray(newC.programs) && newC.programs.length > 0;

    let basePrograms = Array.isArray(newC.programs) ? newC.programs : [];
    let programsLoaded = false;

    if (remoteHasZeroPrograms && !pendingSubCols.has('programs')) {
      basePrograms = [];
      programsLoaded = true;
    } else if (existingC && existingC._subcollectionsLoaded) {
      const existingPrograms = Array.isArray(existingC.programs) ? existingC.programs : [];
      const existingNames = existingPrograms.map(p => p?.programName).filter(Boolean);
      const remoteNames = Array.isArray(newC.programNames) ? newC.programNames : [];
      const countMatches = newC.programsCount === undefined || Number(newC.programsCount) === existingPrograms.length;
      const namesMatch = newC.programNames === undefined || JSON.stringify(remoteNames) === JSON.stringify(existingNames);
      const versionNotNewer = Number(newC.version || 0) <= Number(existingC.version || 0);

      if ((countMatches && namesMatch && versionNotNewer) || pendingSubCols.has('programs')) {
        basePrograms = existingPrograms;
        programsLoaded = true;
      } else if (remoteHasEmbeddedProgs && Number(newC.programsCount ?? newC.programs.length) === newC.programs.length) {
        basePrograms = newC.programs;
        programsLoaded = true;
      } else {
        // Cloud summary changed on another session; require fresh subcollection read
        basePrograms = Array.isArray(newC.programs) ? newC.programs : [];
        programsLoaded = false;
      }
    } else if (remoteHasEmbeddedProgs && (newC.programsCount === undefined || Number(newC.programsCount) === newC.programs.length)) {
      basePrograms = newC.programs;
      programsLoaded = true;
    }

    const expectedProgramCount = getExpectedProgramCount(newC);
    const programSummaryExplicitlyEmpty = newC.programsCount !== undefined
      && Number(newC.programsCount) === 0
      && (!Array.isArray(newC.programNames) || newC.programNames.length === 0)
      && (!Array.isArray(newC.programs) || newC.programs.length === 0)
      && existingPrograms.length === 0
      && !pendingSubCols.has('programs');
    const cloudProgramsAreIncomplete = !programSummaryExplicitlyEmpty && (
      (expectedProgramCount !== null && expectedProgramCount > basePrograms.length)
      || existingPrograms.length > basePrograms.length
    );
    if (cloudProgramsAreIncomplete) {
      basePrograms = mergeAvailableSubcollectionRecords(basePrograms, existingPrograms);
      programsLoaded = false;
    }

    const finalProgs = mergeSubcollectionWithQueue(cid, 'programs', basePrograms, existingC?.programs, queue);
    const finalIssues = mergeSubcollectionWithQueue(
      cid,
      'issues',
      (existingC?._subcollectionsLoaded ? existingC.issues : newC.issues) || [],
      existingC?.issues,
      queue
    );
    const finalReqs = mergeSubcollectionWithQueue(
      cid,
      'requirements',
      (existingC?._subcollectionsLoaded ? existingC.requirements : newC.requirements) || [],
      existingC?.requirements,
      queue
    );
    const finalContacts = mergeSubcollectionWithQueue(
      cid,
      'contacts',
      (existingC?._subcollectionsLoaded ? existingC.contactHistory : newC.contactHistory) || [],
      existingC?.contactHistory,
      queue
    );

    const pendingUpdate = pendingUpdates.get(cid);
    const mergedRecord = {
      ...newC,
      ...(pendingUpdate ? pendingUpdate : {}),
      programs: finalProgs,
      issues: finalIssues,
      requirements: finalReqs,
      contactHistory: finalContacts,
      _subcollectionsLoaded: programsLoaded || pendingSubCols.has('programs')
    };

    if (mergedRecord._subcollectionsLoaded) {
      Object.assign(mergedRecord, computeProgramSummary(finalProgs));
    }

    mergedClients.push(mergedRecord);
  }

  for (const [cid, addedClient] of pendingAdds.entries()) {
    if (!seenIds.has(cid) && !pendingDeletes.has(cid)) {
      const finalProgs = mergeSubcollectionWithQueue(cid, 'programs', addedClient.programs || [], addedClient.programs || [], queue);
      mergedClients.push({
        ...addedClient,
        programs: finalProgs,
        ...computeProgramSummary(finalProgs),
        _subcollectionsLoaded: true
      });
    }
  }

  return mergedClients;
}

// On-Demand Client Subcollection Loader
export async function loadClientSubcollectionsIfNeeded(clientId) {
  if (!currentUser) return;
  const c = clients.find(x => x.id === clientId || String(x.id) === String(clientId));
  if (!c) return;

  if (c._subcollectionsLoaded) return;

  const tenantUid = activeTenantUid() || currentUser.uid;
  try {
    setSyncing(true);

    const sub = await getClientSubcollections(tenantUid, String(c.firestoreId || clientId));
    const currentQueue = S.syncQueue || [];

    const remotePrograms = Array.isArray(sub?.programs) ? sub.programs : [];
    const expectedPrograms = getExpectedProgramCount(c);
    const programsExplicitlyEmpty = c.programsCount !== undefined
      && Number(c.programsCount) === 0
      && (!Array.isArray(c.programNames) || c.programNames.length === 0)
      && (!Array.isArray(c.programs) || c.programs.length === 0)
      && remotePrograms.length === 0;
    const preservePrograms = !programsExplicitlyEmpty && (
      (expectedPrograms !== null && expectedPrograms > remotePrograms.length)
      || (Array.isArray(c.programs) && c.programs.length > remotePrograms.length)
    );
    const programBase = preservePrograms
      ? mergeAvailableSubcollectionRecords(remotePrograms, c.programs)
      : remotePrograms;
    const mergedProgs = mergeSubcollectionWithQueue(clientId, 'programs', programBase, c.programs || [], currentQueue);
    const programsLoaded = !preservePrograms;

    const remoteIssues = Array.isArray(sub?.issues) ? sub.issues : [];
    const preserveIssues = remoteIssues.length < (Array.isArray(c.issues) ? c.issues.length : 0)
      || (Number(c.openIssuesCount) > remoteIssues.length);
    const mergedIssues = mergeSubcollectionWithQueue(
      clientId,
      'issues',
      preserveIssues ? mergeAvailableSubcollectionRecords(remoteIssues, c.issues) : remoteIssues,
      c.issues || [],
      currentQueue
    );
    const remoteRequirements = Array.isArray(sub?.requirements) ? sub.requirements : [];
    const preserveRequirements = remoteRequirements.length < (Array.isArray(c.requirements) ? c.requirements.length : 0)
      || Number(c.requirementsCount) > remoteRequirements.length;
    const mergedReqs = mergeSubcollectionWithQueue(
      clientId,
      'requirements',
      preserveRequirements ? mergeAvailableSubcollectionRecords(remoteRequirements, c.requirements) : remoteRequirements,
      c.requirements || [],
      currentQueue
    );
    const remoteContacts = Array.isArray(sub?.contactHistory) ? sub.contactHistory : [];
    const preserveContacts = remoteContacts.length < (Array.isArray(c.contactHistory) ? c.contactHistory.length : 0);
    const mergedContacts = mergeSubcollectionWithQueue(
      clientId,
      'contacts',
      preserveContacts ? mergeAvailableSubcollectionRecords(remoteContacts, c.contactHistory) : remoteContacts,
      c.contactHistory || [],
      currentQueue
    );

    const progSummary = programsLoaded ? computeProgramSummary(mergedProgs) : {};
    const openIssuesCount = preserveIssues
      ? c.openIssuesCount
      : mergedIssues.filter(i => i && (i.status === 'مفتوح' || i.status === 'قيد المعالجة')).length;

    const updatedClient = {
      ...c,
      programs: mergedProgs,
      ...progSummary,
      issues: mergedIssues,
      openIssuesCount,
      requirements: mergedReqs,
      ...(preserveRequirements ? {} : { requirementsCount: mergedReqs.length }),
      contactHistory: mergedContacts,
      _subcollectionsLoaded: programsLoaded
    };

    const nextClients = clients.map(x => (x && String(x.id) === String(clientId)) ? updatedClient : x);
    setClients(nextClients);
    Promise.resolve(saveClients(tenantUid, nextClients)).catch(() => {});
    console.log(`Subcollections loaded successfully for client ${clientId}`);
  } catch (err) {
    console.error(`Failed to load subcollections for client ${clientId}:`, err);
  } finally {
    setSyncing(false);
  }
}

// Real-Time Sync State Listeners
let activeUnsubscribers = [];
let realtimeSyncGeneration = 0;

function mergeLegacyProfileClients(cloudClients, profileClients) {
  const mergedById = new Map();
  const arrayFields = ['programs', 'issues', 'requirements', 'contactHistory'];

  (Array.isArray(profileClients) ? profileClients : []).forEach(client => {
    if (!client || typeof client !== 'object') return;
    const sourceId = client.id ?? client.firestoreId;
    if (sourceId === undefined || sourceId === null) return;
    const numericId = Number(sourceId);
    const id = Number.isSafeInteger(numericId) ? numericId : sourceId;
    mergedById.set(String(id), { ...client, id, _subcollectionsLoaded: false });
  });

  (Array.isArray(cloudClients) ? cloudClients : []).forEach(client => {
    if (!client || client.id === undefined || client.id === null) return;
    const key = String(client.id);
    const profileClient = mergedById.get(key);
    const mergedClient = { ...profileClient, ...client };
    arrayFields.forEach(field => {
      if (Array.isArray(profileClient?.[field]) && profileClient[field].length > 0
        && (!Array.isArray(client[field]) || client[field].length === 0)) {
        mergedClient[field] = profileClient[field];
      }
    });
    mergedById.set(key, mergedClient);
  });

  return Array.from(mergedById.values());
}

export function startRealtimeSync(userId) {
  stopRealtimeSync();
  userId = auth?.currentUser?.uid || userId;
  if (!userId) {
    setSaveError(true);
    console.error('[Online Sync] Cannot start Firestore listeners without an authenticated tenant.');
    return;
  }
  const generation = ++realtimeSyncGeneration;

  console.log("Starting real-time synchronization for user:", userId);

  // 1. Listen to user profile document (for stats and next ID sequence)
  const userDocRef = doc(db, 'users', userId);
  let latestClientSummaries = [];
  let legacyProfileClients = [];
  let receivedServerSnapshot = false;
  const applyClientSnapshot = (hasPendingWrites = false) => {
    const summaries = mergeLegacyProfileClients(latestClientSummaries, legacyProfileClients);
    const mergedClients = mergeClientSyncState(summaries, clients, S.syncQueue || [], { isOnline: S.isOnline });
    batch(() => {
      setSyncing(hasPendingWrites);
      setClients(mergedClients);
      setLastSyncedTime(new Date());
      setSaveError(false);
    });
    Promise.resolve(saveClients(userId, mergedClients)).catch(() => {});
  };
  const unsubUser = onSnapshot(userDocRef, { includeMetadataChanges: true }, (snapshot) => {
    if (snapshot.metadata?.fromCache) return;
    if (snapshot.exists()) {
      const data = snapshot.data();
      legacyProfileClients = Array.isArray(data.clients) ? data.clients : [];
      batch(() => {
        updateState({
          nid: data.nid || 100,
          stats: data.stats || {}
        });
        setLastSyncedTime(new Date());
        setSyncing(snapshot.metadata.hasPendingWrites);
      });
      if (receivedServerSnapshot) applyClientSnapshot(snapshot.metadata.hasPendingWrites);
    }
  }, (error) => {
    console.error("User profile snapshot listener error:", error);
    setSaveError(true);
  });

  // 2. Listen to clients collection (real-time summaries)
  const clientsCollRef = collection(db, 'users', userId, 'clients');
  const unsubClients = onSnapshot(clientsCollRef, { includeMetadataChanges: true }, (snapshot) => {
    if (snapshot.metadata?.fromCache) return;
    receivedServerSnapshot = true;
    latestClientSummaries = snapshot.docs.map(docSnap => {
      const data = docSnap.data();
      const numericId = Number(docSnap.id);
      return {
        ...data,
        id: data.id ?? (Number.isSafeInteger(numericId) ? numericId : docSnap.id),
        firestoreId: docSnap.id,
        programs: data.programs || [],
        issues: data.issues || [],
        requirements: data.requirements || [],
        contactHistory: data.contactHistory || [],
        gps: data.gps || { lat: null, lng: null },
        _subcollectionsLoaded: false
      };
    });
    applyClientSnapshot(snapshot.metadata.hasPendingWrites);
  }, (error) => {
    console.error("Clients collection snapshot listener error:", error);
    setSaveError(true);
  });

  getClientsFromServer(userId).then(serverClients => {
    if (generation !== realtimeSyncGeneration || receivedServerSnapshot) return;
    receivedServerSnapshot = true;
    latestClientSummaries = serverClients;
    applyClientSnapshot(false);
  }).catch(error => {
    if (generation !== realtimeSyncGeneration) return;
    console.error('[Online Sync] Initial server refresh for clients failed:', error);
    setSaveError(true);
  });

  // 3. Listen to employees collection (real-time cross-device sync)
  const employeesCollRef = collection(db, 'users', userId, 'employees');
  const unsubEmployees = onSnapshot(employeesCollRef, { includeMetadataChanges: true }, (snapshot) => {
    if (snapshot.metadata?.fromCache) return;
    const remoteStaff = snapshot.docs.map(doc => ({
      ...doc.data(),
      id: doc.id
    }));
    if (remoteStaff.length > 0) {
      console.log(`[Realtime Sync] Received ${remoteStaff.length} employees from Firestore for user ${userId}`);
      setStaffUsers(remoteStaff, userId);
      if (typeof window !== 'undefined' && window.R) {
        window.R();
      }
    }
  }, (error) => {
    console.warn("Employees collection snapshot listener notice:", error);
  });

  // 4. Listen to activities subcollection (real-time cross-device and multi-user audit timeline sync)
  const activitiesCollRef = collection(db, 'users', userId, 'activities');
  const unsubActivities = onSnapshot(activitiesCollRef, { includeMetadataChanges: true }, (snapshot) => {
    if (snapshot.metadata?.fromCache) return;
    const remoteActivities = snapshot.docs.map(docSnap => ({
      ...docSnap.data(),
      id: docSnap.data()?.id || docSnap.id
    }));
    const pendingLocal = getPendingActivitiesForTenant(userId);
    const mergedActivities = mergeActivities(remoteActivities, pendingLocal);
    batch(() => {
      S.globalActivities = mergedActivities;
      if (S.selId) {
        S.clientActivities = mergedActivities.filter(a => Number(a.clientId) === Number(S.selId));
      }
      setLastSyncedTime(new Date());
    });
    if (typeof window !== 'undefined' && window.R) {
      window.R();
    }
  }, (error) => {
    console.warn("Activities collection snapshot listener notice:", error);
  });

  activeUnsubscribers.push(unsubUser, unsubClients, unsubEmployees, unsubActivities);
}

export function stopRealtimeSync() {
  realtimeSyncGeneration += 1;
  if (activeUnsubscribers.length > 0) {
    console.log("Stopping real-time synchronization, cleaning up listeners...");
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
  let data = null;
  let fetchFailed = false;

  try {
    console.log("loadDataFromFirestore: start");
    stopRealtimeSync();
    batch(() => {
      setSyncing(true);
      setSaveError(false);
      setClients([]);
    });

    // Strict Online Mode: Direct Cloud Firestore loading without local disk cache
    setLoading(true);

    try {
      if (user && (user.emailVerified || user.providerData.some(p => p.providerId === 'google.com' || p.providerId === 'facebook.com'))) {
        try {
          // Use standard cached token; only force refresh upon permission errors to prevent multi-device token contention
          await user.getIdToken();
        } catch (tokErr) {
          console.warn("Failed to retrieve ID token:", tokErr);
        }
      }
      console.log("loadDataFromFirestore: before getUserData with 12s timeout");
      
      // Resilient 12-second race timeout: provides ample time for cellular/cold connections while local cache serves UI
      const fsTimeoutMs = (typeof window !== 'undefined' && (window.__PLAYWRIGHT_TEST__ || window.isPlaywright)) ? 1000 : 12000;
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('FIRESTORE_TIMEOUT')), fsTimeoutMs)
      );
      data = await Promise.race([getUserData(user.uid), timeoutPromise]);
      console.log("loadDataFromFirestore: after getUserData", data);
    } catch (fetchErr) {
      const isPermissionErr = fetchErr.message && (
        fetchErr.message.includes("permission") || 
        fetchErr.message.includes("permissions") || 
        fetchErr.message.includes("Missing or insufficient permissions")
      );
      if (isPermissionErr && user) {
        try {
          console.log("Permission error in loadDataFromFirestore, attempting ID token force refresh and retry...");
          await user.getIdToken(true);
          const retryTimeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('FIRESTORE_TIMEOUT')), 8000)
          );
          data = await Promise.race([getUserData(user.uid), retryTimeoutPromise]);
          console.log("Retry getUserData succeeded after ID token force refresh");
        } catch (retryErr) {
          console.error("Retry getUserData failed after ID token force refresh:", retryErr);
          fetchFailed = true;
          if (!clients || clients.length === 0) setSaveError(true);
        }
      } else {
        console.warn("Could not load user data from Firestore server within timeout, operating with local cache:", fetchErr);
        fetchFailed = true;
        // If we already have clients in local cache, do not show an alarming red error
        if (!clients || clients.length === 0) {
          setSaveError(true);
        }
      }
    }

    if (!fetchFailed) {
      const baseClients = (data && data.clients && Array.isArray(data.clients) && data.clients.length > 0)
        ? data.clients
        : (clients && clients.length > 0 ? clients : []);
      const queue = S.syncQueue || [];
      const mergedClients = queue.length > 0
        ? mergeClientSyncState(mergeClientLists(baseClients), clients, queue, { isOnline: S.isOnline })
        : mergeClientLists(baseClients);
      const { stats: computedStats, nid: computedNid } = computeStats(mergedClients);

      console.log(`[Storage] User profile metadata loaded (Clients will be populated via real-time subcollection listener).`);
      batch(() => {
        setClients(mergedClients);
        updateState({
          nid: Math.max(Number(data?.nid) || 100, computedNid),
          stats: computedStats
        });
      });
      Promise.resolve(saveClients(user.uid, mergedClients)).catch(() => {});

      import('./timelineService.js')
        .then(m => m.syncCrmServicesToTimeline(user.uid))
        .catch(console.warn);

      // If user doc didn't exist or had older schema or fewer clients, commit to Cloud Firestore
      if (!data || data.v === undefined || Number(data.v) < 3 || (data.clients && data.clients.length < mergedClients.length)) {
        console.info('[Storage] Legacy schema detected; cloud migration requires explicit approval and a verified backup.');
      }
    } else {
      console.warn('[Online Sync] User profile could not be confirmed by Firestore; waiting for server listeners.');
      setClients([]);
      updateState({
        nid: 100,
        stats: {
          activeClients: 0,
          prospectiveClients: 0,
          stoppedClients: 0,
          totalClients: 0,
          totalPrograms: 0,
          totalLicensedDevices: 0,
          averageScore: 100,
          totalOpenIssues: 0
        }
      });
    }

    // 2. Load tenant-isolated employees from Firestore
    try {
      const { getEmployeesForTenant, saveEmployeeForTenant } = await import('../firebase/service.js');
      const remoteStaff = await getEmployeesForTenant(user.uid);
      if (Array.isArray(remoteStaff) && remoteStaff.length > 0) {
        setStaffUsers(remoteStaff, user.uid);

        // Upload any locally created offline employees that are missing in remote
        const { getEmployees } = await import('./employeeService.js');
        const localList = getEmployees();
        const missingInRemote = (localList || []).filter(loc => 
          loc.id !== 'gerant' && !remoteStaff.some(rem => rem.id === loc.id || rem.username === loc.username)
        );
        if (missingInRemote.length > 0) {
          console.log(`[Storage] Uploading ${missingInRemote.length} offline employees to Firestore...`);
          for (const emp of missingInRemote) {
            await saveEmployeeForTenant(user.uid, emp);
          }
        }
      } else {
        // Firestore is empty: check if this device already has local employees from previous sessions
        const { getEmployees } = await import('./employeeService.js');
        const localList = getEmployees();
        const nonGerant = (localList || []).filter(e => e.id !== 'gerant');
        if (nonGerant.length > 0) {
          console.log(`[Storage] Pushing ${localList.length} local employees to Firestore for first-time cloud sync...`);
          for (const emp of localList) {
            await saveEmployeeForTenant(user.uid, emp);
          }
          setStaffUsers(localList, user.uid);
        } else {
          const defaultGerant = createDefaultGerant(user.uid, user.displayName || user.email?.split('@')[0] || 'المدير العام (GERANT)');
          defaultGerant.adminEmail = user.email || '';
          defaultGerant.status = 'نشط';
          defaultGerant.createdAt = new Date().toISOString().split('T')[0];
          await saveEmployeeForTenant(user.uid, defaultGerant);
          setStaffUsers([ defaultGerant ], user.uid);
        }
      }
    } catch (staffSyncErr) {
      console.warn("[Storage] Tenant staff sync notice:", staffSyncErr);
    }

    // 3. Start the real-time sync listeners
    console.log("loadDataFromFirestore: before startRealtimeSync");
    startRealtimeSync(user.uid);
    console.log("loadDataFromFirestore: after startRealtimeSync");
  } catch (err) {
    console.error("Error loading from Firestore:", err.message || String(err));
    // Support robust offline-first: do not overwrite clients in memory if we already have some loaded
    if (!clients || clients.length === 0) {
      setClients([]);
    }
    updateState({ nid: S.nid || 100 });
    setSaveError(true);
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
    const totalInst=clients.reduce((total,c)=>total+getProgramStats(c).totalInstalls,0);
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
      
      csvContent+=row.map(v=>formatCsvCell(v)).join(",")+ "\n";
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
      
      setSyncing(true);

      const maxId=d.clients.reduce((m,c)=>Math.max(m,Number(c.id)||0,...(c.issues||[]).map(i=>Number(i.id)||0),...(c.requirements||[]).map(r=>Number(r.id)||0)),0);
      const nextNid = Math.max(d.nid||0, maxId)+1;
      
      // Perform automated import schema migration onto the subcollections in the background!
      if (currentUser && currentUser.uid) {
        migrateLegacyDataIfNeeded(currentUser.uid, d, nextNid).then(result => {
          if (result?.status === 'blocked') {
            console.info(`[Import] Cloud migration not run: ${result.reason}`);
          }
        }).catch(err => {
          console.warn("Background migration failed (offline), will rely on local persistence:", err);
        });
      }
      
      const stats = d.stats || {
        activeClients: d.clients.filter(c => c.status === 'نشط').length,
        prospectiveClients: d.clients.filter(c => c.status === 'محتمل').length,
        stoppedClients: d.clients.filter(c => c.status === 'متوقف').length,
        totalClients: d.clients.length,
        totalPrograms: d.clients.reduce((acc, c) => acc + (c.programs || []).length, 0),
        totalLicensedDevices: d.clients.reduce((total, c) => total + getProgramStats(c).totalInstalls, 0),
        averageScore: d.clients.length > 0 ? Math.round(d.clients.reduce((acc, c) => acc + (c.score || 100), 0) / d.clients.length) : 100,
        totalOpenIssues: d.clients.reduce((acc, c) => acc + (c.issues || []).filter(i => i.status === 'مفتوح' || i.status === 'قيد المعالجة').length, 0)
      };
      
      setClients(d.clients.map(c => ({ ...c, _subcollectionsLoaded: true })));
      updateState({ nid: nextNid, stats });
      setLastSyncedTime(new Date());
      showToast(t(`تم استيراد ${d.clients.length} عميل بنجاح من ملف ${fileTypeLabel}!`), "success");
      S.view='list';S.selId=null;S.modal=null;S.gi=false;
      R();
    }catch(er){
      showToast(t('خطأ في الاستيراد: ')+er.message, 'error');
    } finally {
      setSyncing(false);
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
  if (!isGerant() && !hasPermission('clients.delete')) {
    showToast(t('⚠️ لا تملك صلاحية مسح جميع البيانات. هذه الصلاحية خاصة بالرئيس (Gérant).'), 'error');
    throw new Error('غير مصرح: صلاحيات الرئيس (Gérant) مطلوبة لمسح جميع البيانات.');
  }
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
    const uid = activeTenantUid() || currentUser?.uid;
    if (!uid) {
      throw new Error('AUTH_REQUIRED');
    }

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

    const CHUNK_SIZE = 400;
    const allClients = Array.isArray(clients) ? clients : [];
    for (let i = 0; i < allClients.length; i += CHUNK_SIZE) {
      const batchOp = writeBatch(db);
      for (const c of allClients.slice(i, i + CHUNK_SIZE)) {
        batchOp.delete(doc(db, `users/${uid}/clients/${c.id}`));
      }
      await batchOp.commit();
    }

    await saveUserData(uid, {
      v: SCHEMA_VERSION,
      updatedAt: new Date().toISOString(),
      nid: 100,
      stats
    });

    setClients([]);
    updateState({ nid: 100, stats, syncQueue: [] });
    Promise.resolve(saveClients(uid, [])).catch(() => {});
    Promise.resolve(saveSyncQueue(uid, [])).catch(() => {});
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
// ENTERPRISE OFFLINE SYNCHRONIZATION ENGINE
// ==========================================

let _isFlushing = false;
let retryTimer = null;

export async function loadCache() {
  try {
    updateState({ isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true });
    const uid = auth?.currentUser?.uid || currentUser?.tenantId || currentUser?.uid;
    if (!uid) return;
    const queuedOperations = await getSyncQueue(uid);
    const resumableQueue = queuedOperations.map(item => ({
      ...item,
      state: item.state === 'syncing' ? 'pending' : item.state || 'pending'
    }));
    updateState({ syncQueue: resumableQueue });
    console.log(`[Online Sync] Restored ${resumableQueue.length} pending operations for tenant ${uid}.`);
  } catch (e) {
    console.error("[Online Sync] Could not restore pending operation state:", e);
  }
}

let queuePersistence = Promise.resolve();

function activeTenantUid() {
  return auth?.currentUser?.uid
    || currentUser?.tenantId
    || (currentUser && !currentUser.isEmployee ? currentUser.uid : null)
    || getActiveTenantId()
    || currentUser?.uid;
}

function persistSyncQueue(uid, queue) {
  const write = queuePersistence.then(() => saveSyncQueue(uid, queue));
  queuePersistence = write.catch(error => {
    setSaveError(true);
    console.error('[Offline Sync] Could not persist the operation queue:', error);
  });
  return write;
}

async function persistFailureState(uid, queue, item) {
  try {
    await persistSyncQueue(uid, queue);
  } catch (error) {
    item.lastError = `${item.lastError || 'Sync failed'}; failed to persist recovery state: ${error.message || error}`;
    setSaveError(true);
    console.error('[Offline Sync] Could not persist failure state:', error);
  }
}

function isRetryableSyncError(error) {
  const retryableCodes = new Set([
    'aborted',
    'deadline-exceeded',
    'network-request-failed',
    'resource-exhausted',
    'unavailable'
  ]);
  return (typeof navigator !== 'undefined' && !navigator.onLine)
    || retryableCodes.has(error?.code)
    || /network|offline|unavailable|timeout/i.test(error?.message || '');
}

export async function flushSyncQueue() {
  if (_isFlushing) return;
  if (!S.isOnline || !currentUser) return;
  const uid = activeTenantUid();
  if (!uid) return;

  await queuePersistence;
  const queue = S.syncQueue || [];
  if (queue.length === 0) {
    setSyncing(false);
    return;
  }

  _isFlushing = true;
  setSyncing(true);
  setSaveError(false);
  console.log(`[Offline Sync] Starting to flush ${queue.length} pending operations...`);

  const nextQueue = queue.map(item => ({ ...item }));
  let errorOccurred = false;
  let retryDelay = 1000;

  while (nextQueue.length > 0 && S.isOnline) {
    const item = nextQueue[0];
    if (item.state === 'failed' || item.state === 'requires-attention') {
      errorOccurred = true;
      setSaveError(true);
      break;
    }

    item.state = 'syncing';
    item.attempts = Number(item.attempts) || 0;
    updateState({ syncQueue: [...nextQueue] });
    try {
      await persistSyncQueue(uid, nextQueue);
    } catch (error) {
      item.state = 'pending';
      item.lastError = error.message || String(error);
      updateState({ syncQueue: [...nextQueue] });
      setSaveError(true);
      errorOccurred = true;
      break;
    }
    try {
      console.log(`[Offline Sync] Processing action: ${item.type}`, item.payload);
      
      switch (item.type) {
        case 'ADD_CLIENT':
          await addClientTransaction(uid, item.payload.clientData, item.payload.stats);
          break;
        case 'UPDATE_CLIENT':
          await updateClientTransaction(
            uid,
            item.payload.clientId,
            item.payload.clientData,
            item.payload.oldStatus,
            item.payload.stats,
            item.payload.baseVersion ?? 0
          );
          break;
        case 'DELETE_CLIENT':
          await deleteClientTransaction(uid, item.payload.clientId, item.payload.clientData, item.payload.stats);
          break;
        case 'SAVE_SUB_ITEM':
          await saveClientSubItemTransaction(
            uid,
            item.payload.clientId,
            item.payload.collectionName,
            item.payload.itemId,
            item.payload.itemData,
            item.payload.counterUpdates,
            item.payload.stats
          );
          break;
        case 'DELETE_SUB_ITEM':
          await deleteClientSubItemTransaction(
            uid,
            item.payload.clientId,
            item.payload.collectionName,
            item.payload.itemId,
            item.payload.counterUpdates,
            item.payload.stats
          );
          break;
        default:
          throw Object.assign(new Error(`Unknown sync operation: ${item.type}`), { code: 'unsupported-operation' });
      }

      nextQueue.shift();
      try {
        await persistSyncQueue(uid, nextQueue);
      } catch (error) {
        nextQueue.unshift({
          ...item,
          state: 'requires-attention',
          lastError: `Remote write completed but queue removal could not be saved: ${error.message || error}`
        });
        updateState({ syncQueue: [...nextQueue] });
        setSaveError(true);
        errorOccurred = true;
        break;
      }
      updateState({ syncQueue: nextQueue });
      setLastSyncedTime(new Date());
    } catch (err) {
      console.error(`[Offline Sync] Failed to process action ${item.type}:`, err);
      
      if (err.code === 'VERSION_CONFLICT' || (err.message && err.message.includes('VERSION_CONFLICT'))) {
        _isFlushing = false;
        errorOccurred = true;
        item.state = 'requires-attention';
        item.lastError = err.message;
        await persistFailureState(uid, nextQueue, item);
        setSaveError(true);
        updateState({ 
          conflictItem: item, 
          conflictServerData: err.serverData,
          modal: 'conflict'
        });
        if (typeof window !== 'undefined' && window.R) window.R();
        break; 
      }
      
      item.attempts++;
      item.lastError = err.message || String(err);
      item.errorCode = err.code || 'unknown';
      if (isRetryableSyncError(err)) {
        item.state = 'pending';
        retryDelay = Math.min(60000, 1000 * (2 ** Math.min(item.attempts - 1, 6)));
        await persistFailureState(uid, nextQueue, item);
        updateState({ syncQueue: [...nextQueue] });
        errorOccurred = true;
        setSaveError(true);
        break;
      } else {
        item.state = 'failed';
        await persistFailureState(uid, nextQueue, item);
        updateState({ syncQueue: [...nextQueue] });
        setSaveError(true);
        showToast(t('فشلت المزامنة نهائياً. احتُفظ بالعملية لمراجعتها.'), 'error');
        errorOccurred = true;
        break;
      }
    }
  }

  _isFlushing = false;
  setSyncing(false);

  if (errorOccurred) {
    if (S.isOnline && nextQueue[0]?.state === 'pending') scheduleRetry(retryDelay);
  } else {
    if (retryTimer) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }
    console.log("[Offline Sync] All pending operations successfully flushed.");
    Promise.resolve(saveClients(uid, clients)).catch(() => {});
    
    // Create an automatic rolling snapshot backup after successful sync completion!
    const backupUid = (auth && auth.currentUser && auth.currentUser.uid) || (currentUser && currentUser.tenantId) || currentUser?.uid || getActiveTenantId();
    if (backupUid) {
      createSnapshotBackup(backupUid, "تلقائي بعد المزامنة", clients, S.stats, S.nid)
        .catch(err => console.error("[Backup] Snapshot after sync failed:", err));
    }
  }
}

function scheduleRetry(delay = 1000) {
  if (retryTimer) return;
  retryTimer = setTimeout(() => {
    retryTimer = null;
    if (S.isOnline) {
      flushSyncQueue();
    } else {
      scheduleRetry();
    }
  }, delay);
}

export function retryFailedSyncActions() {
  const queue = (S.syncQueue || []).map(item => (
    item.state === 'failed' || item.state === 'requires-attention'
      ? { ...item, state: 'pending', lastError: null }
      : item
  ));
  updateState({ syncQueue: queue });
  const uid = activeTenantUid();
  if (!uid) {
    showToast(t('يلزم تسجيل الدخول لإعادة محاولة المزامنة.'), 'error');
    return Promise.resolve(false);
  }
  return persistSyncQueue(uid, queue)
    .then(() => flushSyncQueue())
    .catch(error => {
      console.error('[Offline Sync] Could not requeue failed operations:', error);
      showToast(t('تعذر حفظ إعادة المحاولة محلياً.'), 'error');
      return false;
    });
}

export function enqueueSyncAction(type, payload) {
  const currentQueue = S.syncQueue || [];
  const newItem = {
    id: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
    type,
    payload,
    timestamp: new Date().toISOString(),
    state: 'pending',
    attempts: 0,
    lastError: null
  };
  const nextQueue = [...currentQueue, newItem];
  updateState({ syncQueue: nextQueue });
  const uid = activeTenantUid();
  if (!uid) {
    setSaveError(true);
    console.error('[Offline Sync] Cannot persist queued operation without an authenticated tenant.');
    return Promise.resolve(false);
  }
  return persistSyncQueue(uid, nextQueue)
    .then(() => {
      if (S.isOnline) return flushSyncQueue();
      return newItem;
    })
    .catch(error => {
      const failedQueue = (S.syncQueue || []).map(item => item.id === newItem.id
        ? { ...item, state: 'failed', lastError: `Failed to persist locally: ${error.message || error}` }
        : item);
      updateState({ syncQueue: failedQueue });
      setSaveError(true);
      showToast(t('تعذر حفظ العملية محلياً؛ يرجى إبقاء التطبيق مفتوحاً حتى اكتمال المزامنة.'), 'error');
      console.error('[Offline Sync] Operation was not sent because local persistence failed:', error);
      return false;
    });
}

// Strict Online Mode: Local IndexedDB disk caching is disabled. All state is maintained online via Cloud Firestore.


// Setup global network event listeners
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.log("[Network] Browser online, initiating queue flush...");
    updateState({ isOnline: true });
    flushSyncQueue();
  });
  
  window.addEventListener('offline', () => {
    console.log("[Network] Browser offline, sync suspended.");
    updateState({ isOnline: false });
    setSaveError(true);
  });
}


export function resolveConflict(decision) {
  const item = S.conflictItem;
  const serverData = S.conflictServerData;
  if (!item || !serverData) return;

  const currentQueue = S.syncQueue || [];
  let updatedClientsList = clients;
  
  if (decision === 'server') {
    // Drop the local change, adopt server data while keeping loaded subcollections unless server explicitly cleared them
    updatedClientsList = clients.map(c => {
      if (c.id != item.payload.clientId) return c;
      const serverMentionsPrograms = serverData.programsCount !== undefined
        || serverData.programNames !== undefined
        || serverData.programs !== undefined;
      const serverClearedPrograms = serverMentionsPrograms
        && Number(serverData.programsCount || 0) === 0
        && (!Array.isArray(serverData.programNames) || serverData.programNames.length === 0)
        && (!Array.isArray(serverData.programs) || serverData.programs.length === 0);
      const programs = Array.isArray(serverData.programs) && serverData.programs.length > 0
        ? serverData.programs
        : (serverClearedPrograms ? [] : (c.programs || []));
      return {
        ...c,
        ...serverData,
        programs,
        issues: Array.isArray(serverData.issues) && serverData.issues.length > 0 ? serverData.issues : (c.issues || []),
        requirements: Array.isArray(serverData.requirements) && serverData.requirements.length > 0 ? serverData.requirements : (c.requirements || []),
        contactHistory: Array.isArray(serverData.contactHistory) && serverData.contactHistory.length > 0 ? serverData.contactHistory : (c.contactHistory || [])
      };
    });
    setClients(updatedClientsList);
    
    // Remove item from queue
    const nextQueue = currentQueue.filter(q => q.id !== item.id);
    updateState({ syncQueue: nextQueue, modal: null, conflictItem: null, conflictServerData: null });
    
  } else if (decision === 'local') {
    // Re-enqueue with the updated baseVersion to force it through
    const nextQueue = currentQueue.map(q => {
      if (q.id === item.id) {
        return {
          ...q,
          state: 'pending',
          lastError: null,
          payload: {
            ...q.payload,
            baseVersion: serverData.version || 0
          }
        };
      }
      return q;
    });
    updateState({ syncQueue: nextQueue, modal: null, conflictItem: null, conflictServerData: null });
  } else if (decision === 'merge') {
    // Combine fields safely without losing subcollection data, and bump baseVersion
    const mergedData = {
      ...serverData,
      ...item.payload.clientData,
      programs: Array.isArray(item.payload.clientData?.programs) && item.payload.clientData.programs.length > 0
        ? item.payload.clientData.programs
        : (serverData.programs || [])
    };
    
    updatedClientsList = clients.map(c => c.id == item.payload.clientId ? { ...c, ...mergedData } : c);
    setClients(updatedClientsList);
    
    const nextQueue = currentQueue.map(q => {
      if (q.id === item.id) {
        return {
          ...q,
          state: 'pending',
          lastError: null,
          payload: {
            ...q.payload,
            clientData: mergedData,
            baseVersion: serverData.version || 0
          }
        };
      }
      return q;
    });
    updateState({ syncQueue: nextQueue, modal: null, conflictItem: null, conflictServerData: null });
  }
  
  R();
  const uid = activeTenantUid();
  if (uid) {
    Promise.resolve(saveClients(uid, updatedClientsList)).catch(() => {});
    const recomputed = computeStats(updatedClientsList);
    Promise.resolve(setMeta(uid, 'stats', recomputed.stats)).catch(() => {});
    persistSyncQueue(uid, S.syncQueue || []).then(() => setTimeout(flushSyncQueue, 500)).catch(error => {
      console.error('[Offline Sync] Could not persist conflict resolution:', error);
      showToast(t('تعذر حفظ حل التعارض محلياً.'), 'error');
    });
  }
}
