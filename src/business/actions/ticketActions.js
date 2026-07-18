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



export async function saveContact() {
  const date = gv('fch_d');
  const note = (document.getElementById('fch_n') || {}).value || '';
  if (!date) { showToast('الرجاء اختيار تاريخ التواصل', 'error'); return; }
  if (!note.trim()) { showToast('الرجاء إدخال ملاحظة التواصل', 'error'); return; }
  
  const c = gc(); if (!c) return;
  if (!Array.isArray(c.contactHistory)) c.contactHistory = [];
  
  const entryId = Date.now();
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

export function editIssue(cid, iid) { S.modal = 'editIssue'; S.form = { eid: iid }; R(); }

export function editReq(cid, rid) { S.modal = 'editReq'; S.form = { eid: rid }; R(); }

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
    d.id = Date.now();
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
    d.id = Date.now();
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

