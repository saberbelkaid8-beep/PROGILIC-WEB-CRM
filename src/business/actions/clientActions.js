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
import { t } from '../../utils/i18n.js';
import { hasPermission } from '../../state/store.js';
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
  if (!hasPermission('programs.delete')) {
    showToast(t('⚠️ لا تملك صلاحية حذف البرامج والتراخيص.'), 'error');
    return;
  }
  const confirmMsg = S.lang === 'fr' 
    ? 'Êtes-vous certain de vouloir supprimer définitivement ce logiciel ?'
    : (S.lang === 'en' 
      ? 'Are you sure you want to permanently delete this software?'
      : 'هل أنت متأكد من حذف هذا البرنامج نهائياً؟');
  const confirmed = await showConfirm(confirmMsg, t('تأكيد الحذف'));
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
  const programEditId = editId !== null && editId !== 'null' ? editId : null;
  if (programEditId === null && !hasPermission('programs.create')) {
    showToast(t('⚠️ لا تملك صلاحية إضافة برامج وتراخيص جديدة.'), 'error');
    return;
  }
  if (programEditId !== null && !hasPermission('programs.edit')) {
    showToast(t('⚠️ لا تملك صلاحية تعديل بيانات البرامج والتراخيص.'), 'error');
    return;
  }
  
  const platform = (gv('fp_pl') || 'Desktop').trim();
  if (!platform) {
    showToast(t('الرجاء اختيار المنصة (Desktop / Mobile / Web) *'), 'error');
    return;
  }

  const type = (gv('fp_ty') || '').trim();
  if (platform !== 'Web' && !type) {
    showToast(t('الرجاء اختيار نوع البرنامج المرخص *'), 'error');
    return;
  }

  const version = (gv('fp_ver') || '').trim();
  if (!version) {
    showToast(t('الرجاء اختيار إصدار البرنامج (مثال: V27, V26...) *'), 'error');
    return;
  }

  const installationsCount = Math.max(1, gn('fp_ic', 1));
  const c = gc(); if (!c) return;

  const typeDisplay = type ? type.split(' ')[0] : (platform === 'Web' ? 'الويب' : '');
  const derivedProgramName = `${platform} - ${typeDisplay} ${version}`.trim();
  
  const d = {
    programName: derivedProgramName,
    platform: platform,
    type: type || 'الويب',
    version: version,
    installationsCount: installationsCount,
    startDate: gv('fp_sd') || td(),
    endDate: gv('fp_ed') || ''
  };

  if (!Array.isArray(c.programs)) c.programs = [];

  let nextProgs = [...c.programs];
  const stats = { ...(S.stats || {}) };

  if (programEditId !== null) {
    const i = nextProgs.findIndex(p => p.id === programEditId);
    if (i > -1) {
      const oldP = nextProgs[i];
      const diffInstalls = d.installationsCount - (Number(oldP.installationsCount) || 1);
      stats.totalLicensedDevices = Math.max(0, (stats.totalLicensedDevices || 0) + diffInstalls);
      
      d.id = programEditId;
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
  if (programEditId !== null) {
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

  // 1. Strict Validation of Mandatory Fields
  const fn = (gv('f_fn') || '').trim(); 
  if (!fn) { showToast(t('الرجاء إدخال الاسم الكامل للعميل *'), 'error'); return; }

  const co = (gv('f_co') || '').trim();
  if (!co) { showToast(t('الرجاء إدخال اسم المؤسسة أو الشركة *'), 'error'); return; }

  const ph = (gv('f_ph') || '').trim();
  if (!ph) { showToast(t('الرجاء إدخال رقم الهاتف *'), 'error'); return; }

  const wi = (gv('f_wi') || '').trim();
  if (!wi) { showToast(t('الرجاء اختيار الولاية *'), 'error'); return; }

  const cm = (gv('f_cm') || '').trim();
  if (!cm) { showToast(t('الرجاء اختيار أو إدخال البلدية *'), 'error'); return; }

  const bt = (gv('f_bt') || '').trim();
  if (!bt) { showToast(t('الرجاء اختيار النشاط الرئيسي *'), 'error'); return; }

  const bf = (gv('f_bf') || '').trim();
  if (!bf) { showToast(t('الرجاء اختيار تخصص النشاط *'), 'error'); return; }

  const st = (gv('f_st') || 'نشط').trim();
  if (!st) { showToast(t('الرجاء تحديد حالة العميل (نشط / محتمل / متوقف) *'), 'error'); return; }

  const lc = (gv('f_lc') || '').trim();
  if (!lc) { showToast(t('الرجاء تحديد تاريخ آخر تواصل *'), 'error'); return; }

  const sd = (gv('f_sd') || '').trim();
  if (!sd) { showToast(t('الرجاء تحديد تاريخ البدء / التسجيل *'), 'error'); return; }

  // Optional fields: gmailAccount, location, notes
  const d = {
    fullName: fn,
    phone: ph,
    gmailAccount: (gv('f_gmail') || '').trim(),
    company: co,
    wilaya: wi,
    commune: cm,
    location: (gv('f_lo') || '').trim(),
    businessType: bt,
    businessField: bf,
    status: st,
    startDate: sd,
    endDate: (gv('f_ed') || '').trim(),
    lastContact: lc,
    notes: (gv('f_no') || '').trim()
  };
  console.log("saveClient: validated form data d =", JSON.stringify(d));

  const clientEditId = editId !== null && editId !== 'null' ? editId : null;
  if (clientEditId === null && !hasPermission('clients.create') && !hasPermission('canAddClients')) {
    showToast('⚠️ لا تملك صلاحية إضافة عملاء جدد. الصلاحيات محددة من طرف الرئيس (Gérant).', 'error');
    return;
  }
  if (clientEditId !== null && !hasPermission('clients.edit') && !hasPermission('canEditClients')) {
    showToast('⚠️ لا تملك صلاحية تعديل بيانات العملاء. الصلاحيات محددة من طرف الرئيس (Gérant).', 'error');
    return;
  }
  const stats = { ...(S.stats || {}) };

  if (clientEditId !== null) {
    const oldC = clients.find(c => c.id === clientEditId);
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
      const i = clients.findIndex(c => c.id === clientEditId);
      if (i > -1) {
        const nextClients = [...clients];
        nextClients[i] = updatedClient;
        console.log("saveClient: updating client index", i, "clients count", nextClients.length);
        setClients(nextClients);
      }
      S.stats = stats;
      
      // Enqueue Sync Action
      enqueueSyncAction('UPDATE_CLIENT', {
        clientId: String(clientEditId),
        clientData: updatedClient,
        oldStatus: oldC.status,
        stats
      });
      const fieldLabels = {
        fullName: 'الاسم واللقب', phone: 'الهاتف', gmailAccount: 'Gmail', company: 'الشركة',
        wilaya: 'الولاية', commune: 'البلدية', location: 'العنوان', businessType: 'النشاط',
        businessField: 'التخصص', status: 'الحالة', startDate: 'تاريخ البداية', endDate: 'تاريخ النهاية',
        lastContact: 'آخر تواصل', notes: 'ملاحظات'
      };
      const changedFields = Object.keys(fieldLabels).filter(key => oldC[key] !== d[key]);
      const statusChanged = oldC.status !== d.status;
      let changeDesc = '';
      if (statusChanged) {
        changeDesc += `تغيير حالة العميل من (${oldC.status}) إلى (${d.status}). `;
      }
      const otherChanges = changedFields.filter(f => f !== 'status');
      if (otherChanges.length > 0) {
        changeDesc += `تم تعديل: ${otherChanges.map(key => `${fieldLabels[key]} (الجديد: "${d[key] || 'فارغ'}")`).join('، ')}.`;
      } else if (!statusChanged) {
        changeDesc = 'تم حفظ ومزامنة بيانات العميل بنجاح.';
      }

      logActivity(
        clientEditId,
        ActivityType.CLIENT_EDITED,
        statusChanged ? `تحديث حالة العميل (${d.status})` : "تعديل بيانات العميل",
        changeDesc,
        'online-crm',
        { clientName: d.fullName, changedFields }
      )
        .catch(err => console.error(err));
      showToast(t('تم تحديث بيانات العميل'));
    }
  } else {
    const nextId = Date.now();
    const startDateVal = d.startDate || (d.status === 'نشط' ? td() : '');
    const newClient = {
      ...d,
      startDate: startDateVal,
      id: nextId,
      score: 100,
      gps: { lat: null, lng: null },
      programs: [],
      issues: [],
      requirements: [],
      contactHistory: [],
      _subcollectionsLoaded: true
    };

    // Check if initial program was created in the modal
    const pPl = (gv('f_p_pl') || '').trim();
    const pVer = (gv('f_p_ver') || '').trim();
    const pTy = (gv('f_p_ty') || '').trim();
    if (pVer || (d.status === 'نشط' && pPl)) {
      if (!pVer) {
        showToast(t('الرجاء اختيار إصدار البرنامج المرخص (مثال: V27, V26...) *'), 'error');
        return;
      }
      if (pPl !== 'Web' && !pTy) {
        showToast(t('الرجاء اختيار نوع البرنامج المرخص *'), 'error');
        return;
      }
      const typeDisplay = pTy ? pTy.split(' ')[0] : (pPl === 'Web' ? 'الويب' : '');
      const derivedName = `${pPl || 'Desktop'} - ${typeDisplay} ${pVer}`.trim();
      const pProg = {
        id: Date.now() + 1,
        programName: derivedName,
        platform: pPl || 'Desktop',
        type: pTy || 'الويب',
        version: pVer,
        installationsCount: Math.max(1, gn('f_p_ic', 1)),
        startDate: startDateVal || td(),
        endDate: gv('f_ed') || ''
      };
      newClient.programs = [pProg];
      stats.totalPrograms = (stats.totalPrograms || 0) + 1;
      stats.totalLicensedDevices = (stats.totalLicensedDevices || 0) + pProg.installationsCount;
    }

    console.log("saveClient: inserting newClient =", JSON.stringify(newClient));
    
    // Update stats
    stats.totalClients = (stats.totalClients || 0) + 1;
    if (d.status === 'نشط') stats.activeClients = (stats.activeClients || 0) + 1;
    else if (d.status === 'محتمل') stats.prospectiveClients = (stats.prospectiveClients || 0) + 1;
    else if (d.status === 'متوقف') stats.stoppedClients = (stats.stoppedClients || 0) + 1;
    
    // Optimistic Update
    setClients([...clients, newClient]);
    S.stats = stats;
    
    // Enqueue Sync Action
    enqueueSyncAction('ADD_CLIENT', {
      clientData: newClient,
      stats
    });
    // Log timeline activity
    logActivity(nextId, ActivityType.CLIENT_CREATED, "إنشاء العميل", `تم تسجيل العميل بنظام CRM بنجاح: ${newClient.fullName}.`)
      .catch(err => console.error(err));
    showToast(t('تم إضافة العميل بنجاح'));
  }
  
  const targetId = clientEditId !== null ? clientEditId : (clients.find(c => c.fullName === fn)?.id || S.selId);
  if (targetId) {
    S.selId = targetId;
    S.view = 'detail';
    S.tab = 'overview';
  }
  closeModal();
  R();
}

// 4. Client Issues Operations (Transactional - Now Enqueued with Optimistic Updates)

export async function delClient(id) {
  if (!hasPermission('clients.delete') && !hasPermission('canDeleteClients')) {
    showToast('⚠️ لا تملك صلاحية حذف العملاء نهائياً. هذه الصلاحية خاصة بالرئيس (Gérant).', 'error');
    return;
  }
  const confirmMsg = S.lang === 'fr'
    ? 'Êtes-vous certain de vouloir supprimer définitivement ce client et toutes ses données ?\nCette action est irréversible.'
    : (S.lang === 'en'
      ? 'Are you sure you want to permanently delete this client and all their data?\nThis action cannot be undone.'
      : 'هل أنت متأكد من حذف هذا العميل وجميع بياناته نهائياً؟\nلا يمكن التراجع عن هذا الإجراء.');
  const confirmed = await showConfirm(confirmMsg, t('حذف العميل'));
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

  // Log timeline activity
  logActivity(id, ActivityType.CLIENT_DELETED, "حذف العميل نهائياً", `تم حذف العميل "${c.fullName}" وجميع بياناته المرتبطة من قاعدة البيانات.`, 'local', { clientName: c.fullName })
    .catch(err => console.error(err));

  S.view = 'list'; S.selId = null;
  R();
}

// 7. Geo Location API Operation

export async function captureGPS() {
  if (!navigator.geolocation) { showToast(t('المتصفح لا يدعم تحديد الموقع الجغرافي'), 'error'); return; }
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
      
      // Log timeline activity
      logActivity(c.id, ActivityType.GPS_CAPTURED, "تحديد الموقع الجغرافي", `تم التقاط إحداثيات GPS للعميل بنجاح (${lat}, ${lng}).`, 'local', { clientName: c.fullName })
        .catch(err => console.error(err));

      R();
    },
    err => { showToast(t('تعذر تحديد الموقع: ') + err.message + '\n' + t('تأكد من منح الإذن للمتصفح'), 'error'); }
  );
}
