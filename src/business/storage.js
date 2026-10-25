import { td, getProgramStats } from '../utils/index.js';
import { showToast } from '../utils/toast.js';
import { showConfirm } from '../utils/confirm.js';
import { t } from '../utils/i18n.js';
import { computeScore } from './intelligence.js';
import { ActivityType, logActivity } from './timelineService.js';
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
  batch
} from '../state/store.js';
import { createDefaultGerant } from '../constants/index.js';
import { 
  getUserData, 
  saveUserData, 
  getClientsPage, 
  getClientSubcollections, 
  
  addClientTransaction,
  updateClientTransaction,
  deleteClientTransaction,
  saveClientSubItemTransaction,
  deleteClientSubItemTransaction
} from '../firebase/service.js';
import { migrateLegacyDataIfNeeded } from '../firebase/migration.js';
import { onSnapshot, doc, collection, writeBatch } from 'firebase/firestore';
import { db } from '../firebase/config.js';
import { mergeClientLists, computeStats, mergeWithSessionAndUser } from './mergeDatabase.js';

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

// On-Demand Client Subcollection Loader
export async function loadClientSubcollectionsIfNeeded(clientId) {
  if (!currentUser) return;
  const c = clients.find(x => x.id === clientId || String(x.id) === String(clientId));
  if (!c) return;

  if (c._subcollectionsLoaded) return;

  try {
    setSyncing(true);

    const sub = await getClientSubcollections(currentUser.uid, String(clientId));
    c.programs = sub.programs || [];
    c.issues = sub.issues || [];
    c.requirements = sub.requirements || [];
    c.contactHistory = sub.contactHistory || [];
    c._subcollectionsLoaded = true;

    setClients([...clients]);
    console.log(`Subcollections loaded successfully for client ${clientId}`);
  } catch (err) {
    console.error(`Failed to load subcollections for client ${clientId}:`, err);
  } finally {
    setSyncing(false);
  }
}

// Real-Time Sync State Listeners
let activeUnsubscribers = [];

export function startRealtimeSync(userId) {
  stopRealtimeSync();

  console.log("Starting real-time synchronization for user:", userId);

  // 1. Listen to user profile document (for stats and next ID sequence)
  const userDocRef = doc(db, 'users', userId);
  const unsubUser = onSnapshot(userDocRef, (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.data();
      batch(() => {
        updateState({
          nid: data.nid || 100,
          stats: data.stats || {}
        });
        setLastSyncedTime(new Date());
        setSyncing(snapshot.metadata.hasPendingWrites);
      });
    }
  }, (error) => {
    console.error("User profile snapshot listener error:", error);
    setSaveError(true);
  });

  // 2. Listen to clients collection (real-time summaries)
  const clientsCollRef = collection(db, 'users', userId, 'clients');
  const unsubClients = onSnapshot(clientsCollRef, (snapshot) => {
    const summaries = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        ...data,
        programs: data.programs || [],
        issues: data.issues || [],
        requirements: data.requirements || [],
        contactHistory: data.contactHistory || [],
        gps: data.gps || { lat: null, lng: null },
        _subcollectionsLoaded: false
      };
    });

    // Merge summaries with existing clients to preserve already loaded details in memory
    let mergedClients = summaries.map(newC => {
      const existingC = clients.find(x => String(x.id) === String(newC.id));
      if (existingC && existingC._subcollectionsLoaded) {
        return {
          ...newC,
          programs: existingC.programs,
          issues: existingC.issues,
          requirements: existingC.requirements,
          contactHistory: existingC.contactHistory,
          _subcollectionsLoaded: true
        };
      }
      return newC;
    });

    // Safety guard: If subcollection listener reports 0 docs, but we already have loaded clients
    // (e.g. from data.clients in the user doc or IndexedDB), preserve them!
    if (summaries.length === 0 && clients && clients.length > 0) {
      console.log(`[Realtime Sync] Subcollection empty but ${clients.length} clients exist in state. Preserving current client list.`);
      mergedClients = clients;
    }

    batch(() => {
      setSyncing(snapshot.metadata.hasPendingWrites);
      setClients(mergedClients);
      setLastSyncedTime(new Date());
      setSaveError(false);
    });
  }, (error) => {
    console.error("Clients collection snapshot listener error:", error);
    setSaveError(true);
  });

  // 3. Listen to employees collection (real-time cross-device sync)
  const employeesCollRef = collection(db, 'users', userId, 'employees');
  const unsubEmployees = onSnapshot(employeesCollRef, (snapshot) => {
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
  const unsubActivities = onSnapshot(activitiesCollRef, (snapshot) => {
    const remoteActivities = snapshot.docs.map(doc => ({
      ...doc.data(),
      id: doc.id
    }));
    remoteActivities.sort((a, b) => String(b.timestamp || '').localeCompare(String(a.timestamp || '')));
    batch(() => {
      S.globalActivities = remoteActivities;
      if (S.selId) {
        S.clientActivities = remoteActivities.filter(a => Number(a.clientId) === Number(S.selId));
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
    batch(() => {
      setSyncing(true);
      setSaveError(false);
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
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('FIRESTORE_TIMEOUT')), 12000)
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
      const mergedClients = mergeClientLists(baseClients);
      const { stats: computedStats, nid: computedNid } = computeStats(mergedClients);

      console.log(`[Storage] User profile metadata loaded (Clients will be populated via real-time subcollection listener).`);
      batch(() => {
        setClients(mergedClients);
        updateState({
          nid: Math.max(Number(data?.nid) || 100, computedNid),
          stats: computedStats
        });
      });

      // Strictly Online: No local persistence.
      import('./timelineService.js').then(m => m.syncCrmServicesToTimeline(user.uid)).catch(console.warn);

      // If user doc didn't exist or had older schema or fewer clients, commit to Cloud Firestore
      if (!data || data.v === undefined || Number(data.v) < 3 || (data.clients && data.clients.length < mergedClients.length)) {
        console.log(`[Storage] Syncing merged database (${mergedClients.length} clients) to Cloud Firestore...`);
        const payload = {
          v: SCHEMA_VERSION,
          updatedAt: new Date().toISOString(),
          nid: computedNid,
          stats: computedStats
        };
        saveUserData(user.uid, payload).catch(console.warn);
        migrateLegacyDataIfNeeded(user.uid, { clients: mergedClients }, computedNid).catch(err => {
          console.warn("[Storage] Cloud migration notice:", err);
        });
      }
    } else {
      // Fetch failed or timed out, make sure we fallback to loaded cache states safely
      console.log("Using cached stats and sequence ID:", S.stats, S.nid);
      updateState({
        nid: S.nid || 100,
        stats: S.stats || {
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
      
      setSyncing(true);

      const maxId=d.clients.reduce((m,c)=>Math.max(m,Number(c.id)||0,...(c.issues||[]).map(i=>Number(i.id)||0),...(c.requirements||[]).map(r=>Number(r.id)||0)),0);
      const nextNid = Math.max(d.nid||0, maxId)+1;
      
      // Perform automated import schema migration onto the subcollections in the background!
      if (currentUser && currentUser.uid) {
        migrateLegacyDataIfNeeded(currentUser.uid, d, nextNid).catch(err => {
          console.warn("Background migration failed (offline), will rely on local persistence:", err);
        });
      }
      
      const stats = d.stats || {
        activeClients: d.clients.filter(c => c.status === 'نشط').length,
        prospectiveClients: d.clients.filter(c => c.status === 'محتمل').length,
        stoppedClients: d.clients.filter(c => c.status === 'متوقف').length,
        totalClients: d.clients.length,
        totalPrograms: d.clients.reduce((acc, c) => acc + (c.programs || []).length, 0),
        totalLicensedDevices: d.clients.reduce((acc, c) => acc + (c.programs || []).reduce((sum, p) => sum + (Number(p.installationsCount) || 1), 0), 0),
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
// ENTERPRISE OFFLINE SYNCHRONIZATION ENGINE
// ==========================================

let _isFlushing = false;
let retryTimer = null;

export async function loadCache() {
  try {
    updateState({ isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true });
    const uid = currentUser?.uid;
    if (!uid) return;
    const cached = await getClients(uid);
    const merged = mergeClientLists(cached && cached.length > 0 ? cached : clients);
    const { stats, nid } = computeStats(merged);
    
    batch(() => {
      setClients(merged);
      updateState({ stats, nid });
    });

    console.log(`[Offline Cache] Session hydrated with ${merged.length} clients for tenant ${uid}.`);
    saveClients(uid, merged).catch(console.warn);
    setMeta(uid, 'stats', stats).catch(console.warn);
    setMeta(uid, 'nid', nid).catch(console.warn);
  } catch (e) {
    console.error("[Offline Cache] Error loading from local cache:", e);
  }
}

export async function flushSyncQueue() {
  if (_isFlushing) return;
  if (!S.isOnline || !currentUser) return;
  
  const queue = S.syncQueue || [];
  if (queue.length === 0) {
    setSyncing(false);
    return;
  }

  _isFlushing = true;
  setSyncing(true);
  setSaveError(false);
  console.log(`[Offline Sync] Starting to flush ${queue.length} pending operations...`);

  const nextQueue = [...queue];
  let errorOccurred = false;

  while (nextQueue.length > 0 && S.isOnline) {
    const item = nextQueue[0];
    try {
      console.log(`[Offline Sync] Processing action: ${item.type}`, item.payload);
      
      const uid = currentUser.uid;
      switch (item.type) {
        case 'ADD_CLIENT':
          await addClientTransaction(uid, item.payload.clientData, item.payload.stats);
          break;
        case 'UPDATE_CLIENT':
          await updateClientTransaction(uid, item.payload.clientId, item.payload.clientData, item.payload.oldStatus, item.payload.stats);
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
          console.warn(`[Offline Sync] Unknown action type: ${item.type}`);
      }

      // Success! Remove from local queue
      nextQueue.shift();
      updateState({ syncQueue: nextQueue });
      setLastSyncedTime(new Date());
    } catch (err) {
      console.error(`[Offline Sync] Failed to process action ${item.type}:`, err);
      
      if (err.code === 'VERSION_CONFLICT' || (err.message && err.message.includes('VERSION_CONFLICT'))) {
        _isFlushing = false;
        errorOccurred = true;
        setSaveError(true);
        updateState({ 
          conflictItem: item, 
          conflictServerData: err.serverData,
          modal: 'conflict'
        });
        if (typeof window !== 'undefined' && window.R) window.R();
        break; 
      }
      
      const isNetworkError = !navigator.onLine || 
                            err.message.includes("network") || 
                            err.message.includes("failed-precondition") ||
                            err.message.includes("offline") ||
                            err.message.includes("Unavailable");

      if (isNetworkError) {
        errorOccurred = true;
        setSaveError(true);
        break; // Stop loop, keep item in queue
      } else {
        // Discard permanent errors
        console.warn(`[Offline Sync] Non-retryable error on action ${item.type}. Dropping operation.`, err);
        nextQueue.shift();
        updateState({ syncQueue: nextQueue });
      }
    }
  }

  _isFlushing = false;
  setSyncing(false);

  if (errorOccurred) {
    scheduleRetry();
  } else {
    if (retryTimer) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }
    console.log("[Offline Sync] All pending operations successfully flushed.");
    
    // Create an automatic rolling snapshot backup after successful sync completion!
    if (currentUser && currentUser.uid) {
      createSnapshotBackup(currentUser.uid, "تلقائي بعد المزامنة", clients, S.stats, S.nid)
        .catch(err => console.error("[Backup] Snapshot after sync failed:", err));
    }
  }
}

function scheduleRetry() {
  if (retryTimer) return;
  retryTimer = setTimeout(() => {
    retryTimer = null;
    if (S.isOnline) {
      flushSyncQueue();
    } else {
      scheduleRetry();
    }
  }, 10000);
}

export function enqueueSyncAction(type, payload) {
  const currentQueue = S.syncQueue || [];
  const newItem = {
    id: Date.now() + '-' + Math.random().toString(36).substr(2, 9),
    type,
    payload,
    timestamp: new Date().toISOString()
  };
  
  updateState({ syncQueue: [...currentQueue, newItem] });
  
  if (S.isOnline) {
    flushSyncQueue();
  }
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
  
  if (decision === 'server') {
    // Drop the local change, adopt server data
    // First, update local state to match server
    const nextClients = clients.map(c => c.id == item.payload.clientId ? { ...c, ...serverData } : c);
    setClients(nextClients);
    
    // Remove item from queue
    const nextQueue = currentQueue.filter(q => q.id !== item.id);
    updateState({ syncQueue: nextQueue, modal: null, conflictItem: null, conflictServerData: null });
    
  } else if (decision === 'local') {
    // Re-enqueue with the updated baseVersion to force it through
    const nextQueue = currentQueue.map(q => {
      if (q.id === item.id) {
        return {
          ...q,
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
    // Basic merge: combine fields, preferring local, and bump baseVersion
    const mergedData = { ...serverData, ...item.payload.clientData };
    
    const nextClients = clients.map(c => c.id == item.payload.clientId ? { ...c, ...mergedData } : c);
    setClients(nextClients);
    
    const nextQueue = currentQueue.map(q => {
      if (q.id === item.id) {
        return {
          ...q,
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
  setTimeout(() => {
    flushSyncQueue();
  }, 500);
}
