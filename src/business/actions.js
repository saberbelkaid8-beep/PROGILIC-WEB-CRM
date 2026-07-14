import { S, clients, setClients, updateState, currentUser, setCurrentUser } from '../state/store.js';
import { persist, loadClientSubcollectionsIfNeeded, enqueueSyncAction } from './storage.js';
import { R } from '../presentation/render-core.js';
import { logActivity, ActivityType, getTimeline } from './timelineService.js';
import { getBackups, deleteBackup } from './idbStorage.js';
import { createSnapshotBackup, restoreFromBackup, downloadBackupJSON } from './backupService.js';
import { auth, googleProvider, facebookProvider, appleProvider } from '../firebase/config.js';
import { signInWithPopup, signOut, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail, sendEmailVerification, updateProfile } from 'firebase/auth';
import { gv, gc2, gc, gn, td } from '../utils/index.js';
import { autoDetectFeatureOpp, computeScore } from './intelligence.js';
import { showToast } from '../utils/toast.js';
import { showConfirm, showPrompt } from '../utils/confirm.js';
import { 
  addClientTransaction, 
  updateClientTransaction, 
  deleteClientTransaction, 
  saveClientSubItemTransaction, 
  deleteClientSubItemTransaction 
} from '../firebase/service.js';

export function checkPasswordStrength(password) {
  let score = 0;
  if (!password) return { score: 0, text: '', color: 'transparent', width: '0%' };
  if (password.length >= 8) score++;
  if (password.match(/[a-zA-Z]/)) score++;
  if (password.match(/\d/)) score++;
  if (password.match(/[^a-zA-Z\d]/)) score++;
  
  if (score <= 1) return { score, text: 'ضعيفة', color: '#ff4d4f', width: '25%' };
  if (score === 2) return { score, text: 'متوسطة', color: '#faad14', width: '50%' };
  if (score === 3) return { score, text: 'جيدة', color: '#52c41a', width: '75%' };
  return { score, text: 'قوية جداً', color: '#13c2c2', width: '100%' };
}

export function updatePasswordStrength(val) {
  const res = checkPasswordStrength(val);
  const bar = document.getElementById('pwd-strength-bar');
  const txt = document.getElementById('pwd-strength-text');
  if(bar) {
    bar.style.width = res.width;
    bar.style.backgroundColor = res.color;
  }
  if(txt) {
    txt.innerText = res.text;
    txt.style.color = res.color;
  }
}

export function loginUser(username, password, fullname = '') {
  const email = username.trim().toLowerCase();
  if (!email || !password.trim()) {
    showToast("Please enter both email and password.", 'error');
    return;
  }
  
  const btn = document.querySelector('.auth-btn');
  const originalText = btn ? btn.innerText : '';
  if (btn) {
    btn.disabled = true;
    btn.innerText = window.loginMode === 'register' ? 'Registering account...' : 'Logging in...';
  }

  if (window.loginMode === 'register') {
    const strength = checkPasswordStrength(password);
    if (strength.score < 2) {
      showToast("Please use a stronger password (at least medium).", 'error');
      if (btn) {
        btn.disabled = false;
        btn.innerText = originalText;
      }
      return;
    }

    createUserWithEmailAndPassword(auth, email, password)
      .then((userCredential) => {
        const user = userCredential.user;
        updateProfile(user, {
          displayName: fullname.trim() || email.split('@')[0]
        }).then(() => {
          console.log("User profile displayName updated successfully.");
        }).catch((err) => {
          console.error("Error updating profile displayName:", err);
        });
      })
      .catch((error) => {
        console.error("Registration error:", error);
        let errorMsg = "An error occurred while creating your account.";
        if (error.code === 'auth/email-already-in-use') {
          errorMsg = "This email is already in use. Please log in.";
        } else if (error.code === 'auth/invalid-email') {
          errorMsg = "The email address is invalid.";
        } else if (error.code === 'auth/weak-password') {
          errorMsg = "The password is too weak.";
        }
        showToast(errorMsg, 'error');
        if (btn) {
          btn.disabled = false;
          btn.innerText = originalText;
        }
      });
  } else {
    signInWithEmailAndPassword(auth, email, password)
      .catch((error) => {
        console.error("Login error:", error);
        let errorMsg = "Incorrect email or password.";
        if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
          errorMsg = "Incorrect email or password.";
        } else if (error.code === 'auth/invalid-email') {
          errorMsg = "The email address is invalid.";
        } else if (error.code === 'auth/user-disabled') {
          errorMsg = "This account has been disabled.";
        }
        showToast(errorMsg, 'error');
        if (btn) {
          btn.disabled = false;
          btn.innerText = originalText;
        }
      });
  }
}

export async function logout() {
  const confirmed = await showConfirm("هل أنت متأكد من رغبتك في تسجيل الخروج؟", "تسجيل الخروج");
  if (confirmed) {
    auth.signOut().then(() => {
      setCurrentUser(null);
      try {
        localStorage.removeItem('crm_currentUser');
      } catch (e) {
        console.warn("localStorage.removeItem failed for crm_currentUser", e);
      }
      setClients([]);
      S.view = 'list';
      S.selId = null;
      R();
    }).catch((err) => {
      console.error("Logout error:", err);
      showToast("حدث خطأ أثناء تسجيل الخروج.", "error");
    });
  }
}

// 1. Contact History Operations (Transactional - Now Enqueued with Optimistic Updates)
export async function saveContact() {
  const date = gv('fch_d');
  const note = (document.getElementById('fch_n') || {}).value || '';
  if (!date) { showToast('الرجاء اختيار تاريخ التواصل', 'error'); return; }
  if (!note.trim()) { showToast('الرجاء إدخال ملاحظة التواصل', 'error'); return; }
  
  const c = gc(); if (!c) return;
  if (!Array.isArray(c.contactHistory)) c.contactHistory = [];
  
  const entryId = ++S.nid;
  const entry = { id: entryId, date, note: note.trim() };
  
  const updatedHistory = [...c.contactHistory, entry];
  const latest = updatedHistory.reduce((m, h) => h.date > m ? h.date : m, '');
  
  // Optimistic Local Update
  c.contactHistory.push(entry);
  if (latest) c.lastContact = latest;
  setClients([...clients]);
  
  // Enqueue Sync Action
  enqueueSyncAction('SAVE_SUB_ITEM', {
    clientId: String(c.id),
    collectionName: 'contacts',
    itemId: String(entryId),
    itemData: entry,
    counterUpdates: { lastContact: latest || c.lastContact },
    stats: S.stats
  });

  // Log timeline activity
  logActivity(c.id, ActivityType.CONTACT_ADDED, "تسجيل تواصل", `تم تسجيل تواصل جديد بتاريخ ${entry.date}. الملاحظة: "${entry.note}".`)
    .catch(err => console.error(err));
  
  S.tab = 'contacts';
  closeModal();
}

export async function delContact(cid, hid) {
  const confirmed = await showConfirm('هل أنت متأكد من حذف هذا السجل نهائياً؟', 'تأكيد الحذف');
  if (!confirmed) return;
  const c = clients.find(x => x.id === cid); if (!c) return;
  
  const nextHistory = (c.contactHistory || []).filter(h => h.id !== hid);
  const latest = nextHistory.reduce((m, h) => h.date > m ? h.date : m, '');
  
  // Optimistic Update
  c.contactHistory = nextHistory;
  c.lastContact = latest || '';
  setClients([...clients]);
  
  // Enqueue Sync Action
  enqueueSyncAction('DELETE_SUB_ITEM', {
    clientId: String(cid),
    collectionName: 'contacts',
    itemId: String(hid),
    counterUpdates: { lastContact: latest || '' },
    stats: S.stats
  });

  // Log timeline activity
  logActivity(cid, ActivityType.CONTACT_DELETED, "حذف سجل تواصل", "تم مسح سجل المكالمة/التواصل من الأرشيف.")
    .catch(err => console.error(err));
  
  R();
}

// 2. Navigation Actions & On-Demand Loader
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

export function goBack() { S.view = 'list'; S.selId = null; R(); }
export function setView(v) { S.view = v; S.selId = null; R(); }
export function setTab(t) { 
  S.tab = t; 
  if (t === 'timeline' && S.selId) {
    loadClientTimeline(S.selId);
  }
  R(); 
}
export function setFil(f) { S.filter = f; R(); }
export function onQ(q) { S.q = q; R(); }
export function openModal(m) { 
  S.modal = m; 
  S.form = {}; 
  if (m === 'backupManager') {
    loadBackupsList();
  }
  R(); 
}
export function closeModal() { S.modal = null; S.form = {}; R(); }
export function bkClose(e) { if (e.target.classList.contains('mbk')) closeModal(); }
export function editIssue(cid, iid) { S.modal = 'editIssue'; S.form = { eid: iid }; R(); }
export function editReq(cid, rid) { S.modal = 'editReq'; S.form = { eid: rid }; R(); }

export function setAdvFil(key, val) { S[key] = val; R(); }
export function clearAdvFil() { S.fWilaya = ''; S.fCommune = ''; S.fActivity = ''; S.fActType = ''; S.fProgram = ''; R(); }
export function toggleAdvFil() { S.showAdvFil = !S.showAdvFil; R(); }

export function setSortBy(key) { S.sortBy = key; R(); }
export function toggleSortOrder() { S.sortOrder = S.sortOrder === 'asc' ? 'desc' : 'asc'; R(); }

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
    d.id = ++S.nid;
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

export function autoFillConf() {
  const src = gv('fi_src'); const type = gv('fi_ty');
  const rc = gn('fi_rc', 1); const title = document.getElementById('fi_t')?.value || '';
  
  // Quick algorithm check
  let conf = 50;
  if (src === 'سوء استخدام') conf = 90;
  else if (type === 'استفسار') conf = 75;
  else if (rc >= 3) conf = 30;

  const el = document.getElementById('fi_co'); const vEl = document.getElementById('fi_cov');
  if (el) el.value = conf; if (vEl) vEl.textContent = conf + '%';
}

// 3. Client Registration & General Operations (Transactional - Now Enqueued with Optimistic Updates)
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
    const nextId = ++S.nid;
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
export async function saveIssue(editId) {
  const title = gv('fi_t'); if (!title) { showToast('الرجاء إدخال عنوان المشكلة', 'error'); return; }
  const c = gc(); if (!c) return;
  
  const rc = gn('fi_rc', 1);
  const src = gv('fi_src') || 'غير محدد';
  const type = gv('fi_ty') || 'خطأ تقني';
  const confEl = document.getElementById('fi_co');
  const confidence = confEl ? parseInt(confEl.value) || 50 : 50;
  
  const d = {
    title,
    type,
    priority: gv('fi_p') || 'متوسطة',
    status: gv('fi_s') || 'مفتوح',
    repeatCount: rc,
    featureOpp: gc2('fi_fo'),
    source: src,
    confidence,
    date: gv('fi_d') || td(),
    notes: gv('fi_no'),
    solution: gv('fi_sol') || ''
  };
  if (rc >= 3 && src !== 'سوء استخدام') d.featureOpp = true;

  const eid = editId !== null && editId !== 'null' ? editId : null;
  if (!Array.isArray(c.issues)) c.issues = [];

  let nextIssues = [...c.issues];
  const stats = { ...(S.stats || {}) };
  const oldOpenCount = c.issues.filter(i => i.status === 'مفتوح' || i.status === 'قيد المعالجة').length;

  if (eid !== null) {
    const i = nextIssues.findIndex(x => x.id === eid);
    if (i > -1) {
      d.id = eid;
      nextIssues[i] = { ...nextIssues[i], ...d };
    }
  } else {
    d.id = ++S.nid;
    nextIssues.push(d);
  }

  const nextOpenCount = nextIssues.filter(i => i.status === 'مفتوح' || i.status === 'قيد المعالجة').length;
  stats.totalOpenIssues = Math.max(0, (stats.totalOpenIssues || 0) + (nextOpenCount - oldOpenCount));

  const tempClient = { ...c, issues: nextIssues };
  const nextScore = computeScore(tempClient).total;

  // Optimistic Local Update
  c.issues = nextIssues;
  c.score = nextScore;
  S.stats = stats;
  setClients([...clients]);

  // Enqueue Sync Action
  enqueueSyncAction('SAVE_SUB_ITEM', {
    clientId: String(c.id),
    collectionName: 'issues',
    itemId: String(d.id),
    itemData: d,
    counterUpdates: { 
      openIssuesCount: nextOpenCount,
      score: nextScore
    },
    stats
  });

  // Log timeline activity
  if (eid !== null) {
    logActivity(c.id, ActivityType.ISSUE_EDITED, "تعديل تذكرة مشكلة", `تم تعديل تذكرة المشكلة: "${d.title}".`)
      .catch(err => console.error(err));
  } else {
    logActivity(c.id, ActivityType.ISSUE_ADDED, "تسجيل مشكلة جديدة", `تم تسجيل مشكلة بعنوان: "${d.title}" وبأولوية (${d.priority}).`)
      .catch(err => console.error(err));
  }

  closeModal();
}

export async function markSolved(cid, iid) {
  const sol = await showPrompt('أدخل وصف الحل المقدم للتذكرة:', 'إغلاق وحل تذكرة الدعم', '', 'مثال: تم تحديث البرنامج وتثبيت رخصة جديدة'); if (sol === null) return;
  const c = clients.find(x => x.id === cid); if (!c) return;
  const iss = (c.issues || []).find(x => x.id === iid); if (!iss) return;

  const updatedIssue = { ...iss, status: 'محلول', solution: sol || 'تم الحل' };
  const nextIssues = c.issues.map(i => i.id === iid ? updatedIssue : i);
  const nextOpenCount = nextIssues.filter(i => i.status === 'مفتوح' || i.status === 'قيد المعالجة').length;

  const stats = { ...(S.stats || {}) };
  stats.totalOpenIssues = Math.max(0, (stats.totalOpenIssues || 0) - 1);

  const tempClient = { ...c, issues: nextIssues };
  const nextScore = computeScore(tempClient).total;

  // Optimistic Local Update
  c.issues = nextIssues;
  c.score = nextScore;
  S.stats = stats;
  setClients([...clients]);

  // Enqueue Sync Action
  enqueueSyncAction('SAVE_SUB_ITEM', {
    clientId: String(cid),
    collectionName: 'issues',
    itemId: String(iid),
    itemData: updatedIssue,
    counterUpdates: {
      openIssuesCount: nextOpenCount,
      score: nextScore
    },
    stats
  });

  // Log timeline activity
  logActivity(cid, ActivityType.ISSUE_RESOLVED, "حل تذكرة مشكلة", `تم وضع علامة "محلول" على المشكلة: "${iss.title}". وصف الحل: "${sol || 'تم تقديم الدعم وحل المشكلة.'}"`)
    .catch(err => console.error(err));

  R();
}

export async function delIssue(cid, iid) {
  const confirmed = await showConfirm('هل أنت متأكد من حذف هذه المشكلة نهائياً؟', 'تأكيد الحذف');
  if (!confirmed) return;
  const c = clients.find(x => x.id === cid); if (!c) return;
  const issToDelete = (c.issues || []).find(i => i.id === iid);
  if (!issToDelete) return;

  const nextIssues = c.issues.filter(i => i.id !== iid);
  const nextOpenCount = nextIssues.filter(i => i.status === 'مفتوح' || i.status === 'قيد المعالجة').length;

  const stats = { ...(S.stats || {}) };
  if (issToDelete.status === 'مفتوح' || issToDelete.status === 'قيد المعالجة') {
    stats.totalOpenIssues = Math.max(0, (stats.totalOpenIssues || 0) - 1);
  }

  const tempClient = { ...c, issues: nextIssues };
  const nextScore = computeScore(tempClient).total;

  // Optimistic Local Update
  c.issues = nextIssues;
  c.score = nextScore;
  S.stats = stats;
  setClients([...clients]);

  // Enqueue Sync Action
  enqueueSyncAction('DELETE_SUB_ITEM', {
    clientId: String(cid),
    collectionName: 'issues',
    itemId: String(iid),
    counterUpdates: {
      openIssuesCount: nextOpenCount,
      score: nextScore
    },
    stats
  });

  // Log timeline activity
  logActivity(cid, ActivityType.ISSUE_DELETED, "حذف تذكرة مشكلة", `تم إزالة تذكرة المشكلة نهائياً: "${issToDelete.title}".`)
    .catch(err => console.error(err));

  R();
}

// 5. Client Requirements Operations (Transactional - Now Enqueued with Optimistic Updates)
export async function saveReq(editId) {
  const title = gv('fr_t'); if (!title) { showToast('الرجاء إدخال عنوان الطلب', 'error'); return; }
  const c = gc(); if (!c) return;
  
  const d = {
    title,
    type: gv('fr_ty') || 'ميزة جديدة',
    priority: gv('fr_p') || 'متوسطة',
    status: gv('fr_s') || 'مقترح',
    impact: gv('fr_im') || 'متوسط',
    date: gv('fr_d') || td(),
    notes: gv('fr_no')
  };

  const eid = editId !== null && editId !== 'null' ? editId : null;
  if (!Array.isArray(c.requirements)) c.requirements = [];

  let nextReqs = [...c.requirements];
  if (eid !== null) {
    const i = nextReqs.findIndex(x => x.id === eid);
    if (i > -1) {
      d.id = eid;
      nextReqs[i] = { ...nextReqs[i], ...d };
    }
  } else {
    d.id = ++S.nid;
    nextReqs.push(d);
  }

  // Optimistic Local Update
  c.requirements = nextReqs;
  setClients([...clients]);

  // Enqueue Sync Action
  enqueueSyncAction('SAVE_SUB_ITEM', {
    clientId: String(c.id),
    collectionName: 'requirements',
    itemId: String(d.id),
    itemData: d,
    counterUpdates: { requirementsCount: nextReqs.length },
    stats: S.stats
  });

  // Log timeline activity
  if (eid !== null) {
    logActivity(c.id, ActivityType.REQUIREMENT_EDITED, "تعديل طلب ميزة", `تم تحديث متطلب الميزة: "${d.title}".`)
      .catch(err => console.error(err));
  } else {
    logActivity(c.id, ActivityType.REQUIREMENT_ADDED, "تسجيل متطلب جديد", `تم تسجيل متطلب ميزة جديد: "${d.title}" بتأثير (${d.impact}).`)
      .catch(err => console.error(err));
  }

  closeModal();
}

export async function delReq(cid, rid) {
  const confirmed = await showConfirm('هل أنت متأكد من حذف هذا الطلب نهائياً؟', 'تأكيد الحذف');
  if (!confirmed) return;
  const c = clients.find(x => x.id === cid); if (!c) return;

  const nextReqs = (c.requirements || []).filter(r => r.id !== rid);

  // Optimistic Local Update
  c.requirements = nextReqs;
  setClients([...clients]);

  // Enqueue Sync Action
  enqueueSyncAction('DELETE_SUB_ITEM', {
    clientId: String(cid),
    collectionName: 'requirements',
    itemId: String(rid),
    counterUpdates: { requirementsCount: nextReqs.length },
    stats: S.stats
  });

  // Log timeline activity
  logActivity(cid, ActivityType.REQUIREMENT_DELETED, "حذف طلب متطلب", "تم إزالة متطلب ميزة من حساب العميل.")
    .catch(err => console.error(err));

  R();
}

// 6. Delete Client & Metadata (Transactional - Now Enqueued with Optimistic Updates)
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

export function toggleDark() {
  const on = document.body.classList.toggle('dark');
  try {
    localStorage.setItem('crm_dark', on ? '1' : '0');
  } catch (e) {
    console.warn("localStorage.setItem failed for crm_dark", e);
  }
  const btn = document.getElementById('dmBtn');
  if (btn) btn.textContent = on ? '☀️' : '🌙';
}

export function initDark() {
  let isDark = false;
  try {
    isDark = localStorage.getItem('crm_dark') === '1';
  } catch (e) {
    console.warn("localStorage.getItem failed for crm_dark", e);
  }
  if (isDark) {
    document.body.classList.add('dark');
  }
}

export async function loginWithGoogle() {
  const btn = document.querySelector('.auth-btn');
  const originalText = btn ? btn.innerText : '';
  if (btn) {
    btn.disabled = true;
    btn.innerText = 'Redirecting to Google...';
  }
  try {
    await signInWithPopup(auth, googleProvider);
  } catch (error) {
    if (error.code === 'auth/popup-closed-by-user') {
      console.log('User closed the Google login popup.');
      showToast('تم إلغاء عملية تسجيل الدخول.', 'info');
    } else {
      console.error('Error during Google login:', error);
      showToast('فشل تسجيل الدخول بـ Google', 'error');
    }
    if (btn) {
      btn.disabled = false;
      btn.innerText = originalText;
    }
  }
}

export async function resetPassword(email) {
  try {
    await sendPasswordResetEmail(auth, email);
    showToast('تم إرسال رابط إعادة تعيين كلمة المرور');
  } catch (e) {
    showToast('خطأ: ' + e.message, 'error');
  }
}

export async function verifyEmail() {
  try {
    await sendEmailVerification(auth.currentUser);
    showToast('تم إرسال رابط التوثيق');
  } catch(e) {
    showToast('خطأ: ' + e.message, 'error');
  }
}

export async function loginWithFacebook() {
  try {
    await signInWithPopup(auth, facebookProvider);
  } catch (error) {
    if (error.code === 'auth/popup-closed-by-user') {
      showToast('تم إلغاء عملية تسجيل الدخول.', 'info');
    } else {
      console.error('Error during Facebook login:', error);
      showToast('فشل تسجيل الدخول بـ Facebook', 'error');
    }
  }
}

export async function loginWithApple() {
  try {
    await signInWithPopup(auth, appleProvider);
  } catch (error) {
    if (error.code === 'auth/popup-closed-by-user') {
      showToast('تم إلغاء عملية تسجيل الدخول.', 'info');
    } else {
      console.error('Error during Apple login:', error);
      showToast('فشل تسجيل الدخول بـ Apple', 'error');
    }
  }
}

export function showSocialLoginUnavailable(provider) {
  showToast(`تسجيل الدخول عبر ${provider} غير متوفر حالياً. يرجى استخدام البريد الإلكتروني أو حساب Google.`, 'info', 5000);
}

export async function loadClientTimeline(clientId) {
  if (!clientId) return;
  try {
    const list = await getTimeline(clientId);
    updateState({ clientActivities: list });
    R();
  } catch (err) {
    console.error("Failed to load client timeline:", err);
  }
}

export async function loadBackupsList() {
  if (!currentUser) return;
  try {
    const list = await getBackups(currentUser.uid);
    updateState({ backups: list });
    R();
  } catch (err) {
    console.error("Failed to load backups list:", err);
  }
}

export async function triggerManualBackup() {
  if (!currentUser) return;
  let reason = await showPrompt("أدخل وصفاً أو ملاحظة لهذه النسخة الاحتياطية (اختياري):", "إنشاء نسخة احتياطية يدوية", "", "مثال: قبل تحديث بيانات العملاء الكبرى");
  if (reason === null) return; // user cancelled
  reason = reason.trim() || "نسخة احتياطية يدوية";
  try {
    const backup = await createSnapshotBackup(currentUser.uid, reason, clients, S.stats, S.nid);
    if (backup) {
      showToast("تم إنشاء النسخة الاحتياطية بنجاح!", "success");
      await loadBackupsList();
    }
  } catch (err) {
    console.error("Failed to trigger manual backup:", err);
    showToast("فشل إنشاء النسخة الاحتياطية.", "error");
  }
}

export async function triggerRestore(backupId) {
  if (!currentUser) return;
  const confirmed = await showConfirm(
    "هل أنت متأكد من استرجاع هذه النسخة الاحتياطية؟ سيتم استبدال البيانات الحالية (وسيتم أخذ نسخة وقائية تلقائية للحالة الحالية قبل البدء).", 
    "تأكيد الاسترجاع"
  );
  if (!confirmed) return;
  try {
    const ok = await restoreFromBackup(currentUser.uid, backupId);
    if (ok) {
      closeModal();
      R();
    }
  } catch (err) {
    console.error("Failed to restore backup:", err);
  }
}

export async function downloadBackup(backupId) {
  if (!S.backups) return;
  const backup = S.backups.find(b => b.id === backupId);
  if (backup) {
    downloadBackupJSON(backup);
  }
}

export async function triggerDeleteBackup(backupId) {
  if (!currentUser) return;
  const confirmed = await showConfirm("هل أنت متأكد من حذف هذه النسخة الاحتياطية نهائياً من المتصفح؟", "حذف نسخة احتياطية");
  if (!confirmed) return;
  try {
    await deleteBackup(currentUser.uid, backupId);
    showToast("تم حذف النسخة الاحتياطية بنجاح.", "success");
    await loadBackupsList();
  } catch (err) {
    console.error("Failed to delete backup:", err);
  }
}

export function setDbFilter(key, val) {
  S[key] = val;
  R();
}

export function resetDbFilters() {
  S.dbFilterWilaya = 'all';
  S.dbFilterProg = 'all';
  S.dbFilterTier = 'all';
  S.dbSearchQuery = '';
  S.dbSortKey = 'score';
  S.dbSortDir = 'desc';
  R();
}

