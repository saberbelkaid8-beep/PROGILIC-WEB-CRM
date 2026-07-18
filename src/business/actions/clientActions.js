import { closeModal } from "./uiActions.js";
import { S, clients, setClients, updateState, currentUser, setCurrentUser } from '../../state/store.js';
import { persist, loadClientSubcollectionsIfNeeded, enqueueSyncAction } from '../storage.js';
import { R } from '../../presentation/render-core.js';
import { logActivity, ActivityType, getTimeline } from '../timelineService.js';
import { getBackups, deleteBackup } from '../idbStorage.js';
import { createSnapshotBackup, restoreFromBackup, downloadBackupJSON } from '../backupService.js';
import { auth, googleProvider, facebookProvider, appleProvider } from '../../firebase/config.js';
import { signInWithPopup, signOut, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail, sendEmailVerification, updateProfile } from 'firebase/auth';
import { gv, gc2, gc, gn, td } from '../../utils/index.js';
import { autoDetectFeatureOpp, computeScore } from '../intelligence.js';
import { showToast } from '../../utils/toast.js';
import { showConfirm, showPrompt } from '../../utils/confirm.js';
import { 
  addClientTransaction, 
  updateClientTransaction, 
  deleteClientTransaction, 
  saveClientSubItemTransaction, 
  deleteClientSubItemTransaction 
} from '../../firebase/service.js';



export async function selClient(id) {
  S.view = 'loading_details';
  R();
  await loadClientSubcollectionsIfNeeded(id);
  S.selId = id;
  S.view = 'detail';
  S.tab = 'overview';
  S.clientActivities = [];
  R();
}

export function editProg(cid, pid) { S.modal = 'editProgram'; S.form = { eid: pid }; R(); }

// 3. Program Operations (Transactional)

export async function delProgram(cid, pid) {
  const confirmed = await showConfirm('هل أنت متأكد من حذف هذا البرنامج نهائياً؟', 'تأكيد الحذف');
  if (!confirmed) return;
  const c = clients.find(x => x.id === cid); if (!c) return;
  const progToDelete = (c.programs || []).find(p => p.id === pid);
  if (!progToDelete) return;

  const nextProgs = (c.programs || []).filter(p => p.id !== pid);
  const activeProg = nextProgs.filter(p => p.endDate).sort((a, b) => new Date(a.endDate) - new Date(b.endDate));
  const nextEndDate = activeProg.length > 0 ? activeProg[0].endDate : '';
  const nextInstalls = nextProgs.reduce((acc, p) => acc + (Number(p.installationsCount) || 1), 0);

  const stats = { ...(S.stats || {}) };
  stats.totalPrograms = Math.max(0, (stats.totalPrograms || 0) - 1);
  stats.totalLicensedDevices = Math.max(0, (stats.totalLicensedDevices || 0) - (Number(progToDelete.installationsCount) || 1));

  // Optimistic Local Update
  c.programs = nextProgs;
  c.endDate = nextEndDate;
  c.programNames = nextProgs.map(p => p.programName);
  S.stats = stats;
  setClients([...clients]);

  // Enqueue Sync Action
  enqueueSyncAction('DELETE_SUB_ITEM', {
    clientId: String(cid),
    collectionName: 'programs',
    itemId: String(pid),
    counterUpdates: { 
      programsCount: nextProgs.length, 
      installationsCount: nextInstalls, 
      endDate: nextEndDate,
      programNames: nextProgs.map(p => p.programName)
    },
    stats
  });

  // Log timeline activity
  logActivity(cid, ActivityType.PROGRAM_DELETED, "حذف برنامج ترخيص", `تم إزالة ترخيص البرنامج "${progToDelete.programName}" من حساب العميل.`)
    .catch(err => console.error(err));

  R();
}

export async function saveProgram(editId) {
  const nm = gv('fp_nm'); if (!nm) { showToast('الرجاء اختيار اسم البرنامج', 'error'); return; }
  const c = gc(); if (!c) return;
  
  const d = {
    programName: nm,
    platform: gv('fp_pl') || 'Desktop',
    type: gv('fp_ty') || 'تجاري',
    installationsCount: Math.max(1, gn('fp_ic', 1)),
    startDate: gv('fp_sd') || '',
    endDate: gv('fp_ed') || ''
  };

  const eid = editId !== null && editId !== 'null' ? editId : null;
  if (!Array.isArray(c.programs)) c.programs = [];

  let nextProgs = [...c.programs];
  const stats = { ...(S.stats || {}) };

  if (eid !== null) {
    const i = nextProgs.findIndex(p => p.id === eid);
    if (i > -1) {
      const oldP = nextProgs[i];
      const diffInstalls = d.installationsCount - (Number(oldP.installationsCount) || 1);
      stats.totalLicensedDevices = Math.max(0, (stats.totalLicensedDevices || 0) + diffInstalls);
      
      d.id = eid;
      nextProgs[i] = { ...nextProgs[i], ...d };
    }
  } else {
    d.id = Date.now();
    nextProgs.push(d);
    stats.totalPrograms = (stats.totalPrograms || 0) + 1;
    stats.totalLicensedDevices = (stats.totalLicensedDevices || 0) + d.installationsCount;
  }

  const activeProg = nextProgs.filter(p => p.endDate).sort((a, b) => new Date(a.endDate) - new Date(b.endDate));
  const nextEndDate = activeProg.length > 0 ? activeProg[0].endDate : '';
  const nextInstalls = nextProgs.reduce((acc, p) => acc + (Number(p.installationsCount) || 1), 0);

  // Optimistic Local Update
  c.programs = nextProgs;
  c.endDate = nextEndDate;
  c.programNames = nextProgs.map(p => p.programName);
  S.stats = stats;
  setClients([...clients]);

  // Enqueue Sync Action
  enqueueSyncAction('SAVE_SUB_ITEM', {
    clientId: String(c.id),
    collectionName: 'programs',
    itemId: String(d.id),
    itemData: d,
    counterUpdates: { 
      programsCount: nextProgs.length, 
      installationsCount: nextInstalls, 
      endDate: nextEndDate,
      programNames: nextProgs.map(p => p.programName)
    },
    stats
  });

  // Log timeline activity
  if (eid !== null) {
    logActivity(c.id, ActivityType.PROGRAM_EDITED, "تعديل ترخيص برنامج", `تم تعديل بيانات ترخيص البرنامج "${d.programName}". الأجهزة المرخصة: ${d.installationsCount}.`)
      .catch(err => console.error(err));
  } else {
    logActivity(c.id, ActivityType.PROGRAM_ADDED, "إضافة برنامج ترخيص", `تم تسجيل ترخيص جديد للبرنامج "${d.programName}" مع ${d.installationsCount} أجهزة مرخصة.`)
      .catch(err => console.error(err));
  }

  closeModal();
}

export async function saveClient(editId) {
  console.log("saveClient: starting with editId =", editId);
  const fn = gv('f_fn'); 
  console.log("saveClient: retrieved fullName =", fn);
  if (!fn) { showToast('الرجاء إدخال اسم العميل', 'error'); return; }
  const d = {
    fullName: fn,
    phone: gv('f_ph'),
    company: gv('f_co'),
    wilaya: gv('f_wi'),
    commune: gv('f_cm'),
    location: gv('f_lo'),
    businessType: gv('f_bt'),
    businessField: gv('f_bf'),
    status: gv('f_st') || 'نشط',
    startDate: gv('f_sd') || '',
    endDate: gv('f_ed') || '',
    lastContact: gv('f_lc'),
    notes: gv('f_no')
  };
  console.log("saveClient: form data d =", JSON.stringify(d));

  const eid = editId !== null && editId !== 'null' ? editId : null;
  const stats = { ...(S.stats || {}) };

  if (eid !== null) {
    const oldC = clients.find(c => c.id === eid);
    if (oldC) {
      const updatedClient = { ...oldC, ...d };
      
      // Update stats
      if (oldC.status !== d.status) {
        if (oldC.status === 'نشط') stats.activeClients = Math.max(0, (stats.activeClients || 0) - 1);
        else if (oldC.status === 'محتمل') stats.prospectiveClients = Math.max(0, (stats.prospectiveClients || 0) - 1);
        else if (oldC.status === 'متوقف') stats.stoppedClients = Math.max(0, (stats.stoppedClients || 0) - 1);
        
        if (d.status === 'نشط') stats.activeClients = (stats.activeClients || 0) + 1;
        else if (d.status === 'محتمل') stats.prospectiveClients = (stats.prospectiveClients || 0) + 1;
        else if (d.status === 'متوقف') stats.stoppedClients = (stats.stoppedClients || 0) + 1;
      }
      
      // Optimistic Update
      const i = clients.findIndex(c => c.id === eid);
      if (i > -1) {
        const nextClients = [...clients];
        nextClients[i] = updatedClient;
        console.log("saveClient: updating client index", i, "clients count", nextClients.length);
        setClients(nextClients);
      }
      S.stats = stats;
      
      // Enqueue Sync Action
      enqueueSyncAction('UPDATE_CLIENT', {
        clientId: String(eid),
        clientData: updatedClient,
        oldStatus: oldC.status,
        stats
      });
      // Log timeline activity
      logActivity(eid, ActivityType.CLIENT_EDITED, "تعديل بيانات العميل", "تم تعديل تفاصيل الملف الشخصي للعميل بنجاح.")
        .catch(err => console.error(err));
      showToast('تم تحديث بيانات العميل');
    }
  } else {
    const nextId = Date.now();
    const newClient = {
      ...d,
      id: nextId,
      score: 100,
      gps: { lat: null, lng: null },
      programs: [],
      issues: [],
      requirements: [],
      contactHistory: [],
      _subcollectionsLoaded: true
    };
    console.log("saveClient: inserting newClient =", JSON.stringify(newClient));
    
    // Update stats
    stats.totalClients = (stats.totalClients || 0) + 1;
    if (d.status === 'نشط') stats.activeClients = (stats.activeClients || 0) + 1;
    else if (d.status === 'محتمل') stats.prospectiveClients = (stats.prospectiveClients || 0) + 1;
    else if (d.status === 'متوقف') stats.stoppedClients = (stats.stoppedClients || 0) + 1;
    
    // Optimistic Update
    console.log("saveClient: before setClients clients list =", JSON.stringify(clients));
    setClients([...clients, newClient]);
    console.log("saveClient: after setClients S.clients =", JSON.stringify(S.clients));
    S.stats = stats;
    
    // Enqueue Sync Action
    enqueueSyncAction('ADD_CLIENT', {
      clientData: newClient,
      stats
    });
    // Log timeline activity
    logActivity(nextId, ActivityType.CLIENT_CREATED, "إنشاء العميل", `تم تسجيل العميل بنظام CRM بنجاح: ${newClient.fullName}.`)
      .catch(err => console.error(err));
    showToast('تم إضافة العميل بنجاح');
  }
  
  closeModal();
}

// 4. Client Issues Operations (Transactional - Now Enqueued with Optimistic Updates)

export async function delClient(id) {
  const confirmed = await showConfirm('هل أنت متأكد من حذف هذا العميل وجميع بياناته نهائياً؟\nلا يمكن التراجع عن هذا الإجراء.', 'حذف العميل');
  if (!confirmed) return;
  const c = clients.find(x => x.id === id); if (!c) return;

  const stats = { ...(S.stats || {}) };
  stats.totalClients = Math.max(0, (stats.totalClients || 0) - 1);
  if (c.status === 'نشط') stats.activeClients = Math.max(0, (stats.activeClients || 0) - 1);
  else if (c.status === 'محتمل') stats.prospectiveClients = Math.max(0, (stats.prospectiveClients || 0) - 1);
  else if (c.status === 'متوقف') stats.stoppedClients = Math.max(0, (stats.stoppedClients || 0) - 1);

  stats.totalPrograms = Math.max(0, (stats.totalPrograms || 0) - (c.programsCount || (c.programs || []).length));
  stats.totalLicensedDevices = Math.max(0, (stats.totalLicensedDevices || 0) - (c.installationsCount || (c.programs || []).reduce((acc, p) => acc + (Number(p.installationsCount) || 1), 0)));
  stats.totalOpenIssues = Math.max(0, (stats.totalOpenIssues || 0) - (c.openIssuesCount || c.issues.filter(i => i.status === 'مفتوح' || i.status === 'قيد المعالجة').length));

  // Optimistic Local Update
  setClients(clients.filter(x => x.id !== id));
  S.stats = stats;
  
  // Enqueue Sync Action
  enqueueSyncAction('DELETE_CLIENT', {
    clientId: String(id),
    clientData: {
      ...c,
      programsCount: c.programsCount || (c.programs || []).length,
      installationsCount: c.installationsCount || (c.programs || []).reduce((acc, p) => acc + (Number(p.installationsCount) || 1), 0),
      openIssuesCount: c.openIssuesCount || c.issues.filter(i => i.status === 'مفتوح' || i.status === 'قيد المعالجة').length
    },
    stats
  });

  S.view = 'list'; S.selId = null;
  R();
}

// 7. Geo Location API Operation

export async function captureGPS() {
  if (!navigator.geolocation) { showToast('المتصفح لا يدعم تحديد الموقع الجغرافي', 'error'); return; }
  navigator.geolocation.getCurrentPosition(
    pos => {
      const c = gc(); if (!c) return;
      const lat = Number(pos.coords.latitude.toFixed(6));
      const lng = Number(pos.coords.longitude.toFixed(6));
      const newGps = { lat, lng };

      // Optimistic Local Update
      c.gps = newGps;

      // Enqueue Sync Action
      enqueueSyncAction('UPDATE_CLIENT', {
        clientId: String(c.id),
        clientData: { ...c, gps: newGps },
        oldStatus: c.status,
        stats: S.stats
      });
      
      R();
    },
    err => { showToast('تعذر تحديد الموقع: ' + err.message + '\nتأكد من منح الإذن للمتصفح', 'error'); }
  );
}

