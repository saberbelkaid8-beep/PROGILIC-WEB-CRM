import { td, getProgramStats } from '../utils/index.js';
import { showToast } from '../utils/toast.js';
import { showConfirm } from '../utils/confirm.js';
import { computeScore } from './intelligence.js';
import { R } from '../presentation/render-core.js';
import { 
  S, 
  clients, 
  setClients, 
  updateState, 
  currentUser,
  setSyncing,
  setLastSyncedTime,
  setLoading,
  setSaveError,
  _isSyncing,
  _lastSyncedTime,
  _saveError,
  notify,
  subscribe
} from '../state/store.js';
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

// IndexedDB, Backups, and Migration Utilities imports
import { 
  getClients, 
  saveClients, 
  getMeta, 
  setMeta, 
  getSyncQueue, 
  saveSyncQueue, 
  clearAllUserData 
} from './idbStorage.js';
import { createSnapshotBackup, checkAndTriggerPeriodicBackup } from './backupService.js';
import { migrateLocalStorageToIDB } from './migrations.js';

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
  if (!d || !Array.isArray(d.clients)) return null;
  d.clients = d.clients.map(c => {
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
  });
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
      updateState({
        nid: data.nid || 100,
        stats: data.stats || {}
      });
      setLastSyncedTime(new Date());
      setSyncing(snapshot.metadata.hasPendingWrites);
    }
  }, (error) => {
    console.error("User profile snapshot listener error:", error);
    setSaveError(true);
  });

  // 2. Listen to clients collection (real-time summaries)
  const clientsCollRef = collection(db, 'users', userId, 'clients');
  const unsubClients = onSnapshot(clientsCollRef, (snapshot) => {
    setSyncing(snapshot.metadata.hasPendingWrites);
    
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
    const mergedClients = summaries.map(newC => {
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

    setClients(mergedClients);
    setLastSyncedTime(new Date());
    setSaveError(false);
  }, (error) => {
    console.error("Clients collection snapshot listener error:", error);
    setSaveError(true);
  });

  activeUnsubscribers.push(unsubUser, unsubClients);
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
 * Loads the user's specific local IndexedDB cache into in-memory state.
 * Runs legacy migration if this is the first startup on this browser.
 */
export async function loadUserCache(uid) {
  if (!uid) return;
  try {
    console.log("[Storage] Loading user-isolated cache for:", uid);
    
    // First, run migration from localStorage if needed
    await migrateLocalStorageToIDB(uid);

    // Retrieve from IndexedDB
    const cachedClients = await getClients(uid);
    const cachedStats = await getMeta(uid, 'stats');
    const cachedNid = await getMeta(uid, 'nid');
    const cachedQueue = await getSyncQueue(uid);

    if (cachedClients && cachedClients.length > 0) {
      setClients(cachedClients);
      console.log(`[IndexedDB Cache] Restored ${cachedClients.length} clients from isolated cache.`);
    } else {
      setClients([]); // Default empty
    }
    
    if (cachedStats) {
      updateState({ stats: cachedStats });
    }
    
    if (cachedNid) {
      updateState({ nid: Number(cachedNid) });
    }
    
    if (cachedQueue) {
      updateState({ syncQueue: cachedQueue });
      console.log(`[IndexedDB Cache] Restored ${cachedQueue.length} pending operations from queue.`);
    }

    updateState({ isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true });
    
    // Trigger check for periodic backups (runs 24h backup or initial backup)
    await checkAndTriggerPeriodicBackup(uid, clients, S.stats, S.nid);

  } catch (err) {
    console.error("[IndexedDB Cache] Error loading user cache:", err);
  }
}

// Load data from Firestore supporting Schema Version 3 + Legacy Auto-Migration
export async function loadDataFromFirestore(user) {
  let data = null;
  let fetchFailed = false;

  try {
    console.log("loadDataFromFirestore: start"); setLoading(true);
    setSyncing(true);
    setSaveError(false);

    // Load local IndexedDB cache first so the UI is responsive immediately!
    await loadUserCache(user.uid);

    try {
      console.log("loadDataFromFirestore: before getUserData");
      data = await getUserData(user.uid);
      console.log("loadDataFromFirestore: after getUserData", data);
    } catch (fetchErr) {
      console.warn("Could not load user data from Firestore server, falling back to local cache:", fetchErr);
      fetchFailed = true;
      setSaveError(true);
    }

    if (!fetchFailed) {
      if (data) {
        // 1. Check if Schema Migration is required (v2 -> v3)
        if (data.v === undefined || Number(data.v) < 3) {
          console.log("Legacy schema detected. Initiating automated v3 migration...");
          const migratedData = migrateSchema(data) || data;
          const stats = await migrateLegacyDataIfNeeded(user.uid, migratedData, data.nid || 100);
          updateState({ nid: data.nid || 100, stats });
        } else {
          updateState({ nid: data.nid || 100, stats: data.stats || {} });
        }
      } else {
        // Create fresh user account structure
        const initialStats = {
          activeClients: 0,
          prospectiveClients: 0,
          stoppedClients: 0,
          totalClients: 0,
          totalPrograms: 0,
          totalLicensedDevices: 0,
          averageScore: 100,
          totalOpenIssues: 0
        };
        
        const payload = {
          v: SCHEMA_VERSION,
          updatedAt: new Date().toISOString(),
          nid: 100,
          stats: initialStats
        };

        await saveUserData(user.uid, payload);
        setClients([]);
        updateState({ nid: 100, stats: initialStats });
      }
    } else {
      // Fetch failed, make sure we fallback to loaded cache states safely
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

    // 2. Start the real-time sync listeners
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
    setLoading(false);
    setSyncing(false);
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

export function exportData(){
  try{
    const payload=JSON.stringify({
      v:SCHEMA_VERSION,exported:new Date().toISOString(),
      nid:S.nid,clients:clients.map(sanitizeClient)
    },null,2);
    const blob=new Blob([payload],{type:'application/json'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url;a.download=`progilic-crm-backup-${td()}.json`;
    document.body.appendChild(a);a.click();
    setTimeout(()=>{document.body.removeChild(a);URL.revokeObjectURL(url);},1000);
  }catch(e){showToast('فشل التصدير: '+e.message, 'error');}
}

export function exportToCSV(){
  try{
    const ac=clients.filter(c=>c.status==='نشط').length;
    const pr=clients.filter(c=>c.status==='محتمل').length;
    const pa=clients.filter(c=>c.status==='متوقف').length;
    const totalProgs=clients.reduce((s,c)=>s+(c.programs||[]).length,0);
    const totalInst=clients.reduce((s,c)=>s+(c.programs||[]).reduce((a,p)=>a+(Number(p.installationsCount)||1),0),0);
    const avgScore=clients.length?Math.round(clients.reduce((s,c)=>s+computeScore(c).total,0)/clients.length):0;

    let csvContent="";
    
    csvContent+=`"إحصائيات عامة","PROGILIC CRM v3"\n`;
    csvContent+=`"تاريخ التصدير","${td()}"\n`;
    csvContent+=`"إجمالي العملاء","${clients.length}"\n`;
    csvContent+=`"عملاء نشطون","${ac}"\n`;
    csvContent+=`"عملاء محتملون","${pr}"\n`;
    csvContent+=`"عملاء متوقفون","${pa}"\n`;
    csvContent+=`"إجمالي البرامج","${totalProgs}"\n`;
    csvContent+=`"إجمالي الأجهزة المرخصة","${totalInst}"\n`;
    csvContent+=`"متوسط نقاط العملاء","${avgScore}"\n`;
    csvContent+=`"\n`;
    
    csvContent+=`"جدول العملاء التفصيلي"\n`;
    
    const headers=[
      "المعرف",
      "الاسم الكامل",
      "المؤسسة/الشركة",
      "الهاتف",
      "الولاية",
      "المنطقة/الحي",
      "النشاط الرئيسي",
      "تخصص النشاط",
      "الحالة",
      "بداية العقد",
      "نهاية العقد",
      "آخر تواصل",
      "عدد البرامج",
      "عدد الأجهزة",
      "المشاكل المفتوحة",
      "إجمالي الطلبات",
      "نقاط العميل"
    ];
    
    csvContent+=headers.map(h=>`"${h}"`).join(",")+ "\n";
    
    clients.forEach(c=>{
      const ps=getProgramStats(c);
      const oi=(c.issues||[]).filter(i=>i.status==='مفتوح'||i.status==='قيد المعالجة').length;
      const sc=computeScore(c).total;
      
      const row=[
        c.id,
        c.fullName||"",
        c.company||"",
        c.phone||"",
        c.wilaya||"",
        c.location||"",
        c.businessType||"",
        c.businessField||"",
        c.status||"",
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
  }catch(e){showToast('فشل تصدير CSV: '+e.message, 'error');}
}

export function importData(file){
  if(!file)return;
  const reader=new FileReader();
  reader.onload=async e=>{
    try{
      let d=JSON.parse(e.target.result);
      d=migrateSchema(d);
      if(!d || !Array.isArray(d.clients))throw new Error('ملف غير صالح');
      const confirmed = await showConfirm(`سيتم استبدال جميع بياناتك بـ ${d.clients.length} عميل من الملف والبدء بهيكل v3.\nهل تريد المتابعة؟`, 'استيراد البيانات');
      if(!confirmed)return;
      
      setSyncing(true);

      const maxId=d.clients.reduce((m,c)=>Math.max(m,c.id,...c.issues.map(i=>i.id),...c.requirements.map(r=>r.id)),0);
      const nextNid = Math.max(d.nid||0, maxId)+1;
      
      // Perform automated import schema migration onto the subcollections in the background!
      migrateLegacyDataIfNeeded(currentUser.uid, d, nextNid).catch(err => {
        console.warn("Background migration failed (offline), will rely on local persistence:", err);
      });
      
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
      S.view='list';S.selId=null;S.modal=null;S.gi=false;
      R();
    }catch(er){
      showToast('خطأ في الاستيراد: '+er.message, 'error');
    } finally {
      setSyncing(false);
    }
  };
  reader.readAsText(file);
}

export async function clearAllData(){
  const confirmed1 = await showConfirm('⚠️ هل أنت متأكد من حذف جميع البيانات نهائياً؟\nلا يمكن التراجع عن هذا الإجراء.', 'مسح جميع البيانات');
  if(!confirmed1)return;
  const confirmed2 = await showConfirm('تأكيد أخير: سيتم مسح جميع العملاء والمشاكل والمتطلبات.\nاستمرار؟', 'تأكيد الحذف النهائي');
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
    showToast("حدث خطأ أثناء مسح البيانات: " + err.message, 'error');
  } finally {
    setSyncing(false);
  }
}

// ==========================================
// ENTERPRISE OFFLINE SYNCHRONIZATION ENGINE
// ==========================================

let _isFlushing = false;
let retryTimer = null;

export function loadCache() {
  try {
    updateState({ isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true });
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

// Setup throttled user-isolated IndexedDB persistence observer
let saveCacheTimeout = null;
subscribe(() => {
  if (!currentUser || !currentUser.uid) return; // Only persist when logged in
  if (saveCacheTimeout) return;
  saveCacheTimeout = setTimeout(async () => {
    saveCacheTimeout = null;
    try {
      const uid = currentUser.uid;
      // Copy current snapshots synchronously to prevent race conditions during async write
      const clientsSnapshot = [...clients];
      const statsSnapshot = { ...(S.stats || {}) };
      const nidSnapshot = S.nid;
      const queueSnapshot = [...(S.syncQueue || [])];

      await saveClients(uid, clientsSnapshot);
      await setMeta(uid, 'stats', statsSnapshot);
      await setMeta(uid, 'nid', nidSnapshot);
      await saveSyncQueue(uid, queueSnapshot);
      
      console.log(`[Offline Cache] Saved state to user ${uid} IndexedDB successfully.`);
    } catch (e) {
      console.error("[Offline Cache] Failed to save state to IndexedDB:", e);
    }
  }, 1000);
});

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

