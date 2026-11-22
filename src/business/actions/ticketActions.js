import { S, clients, setClients, updateState, currentUser, setCurrentUser, hasPermission } from '../../state/store.js';
import { persist, loadClientSubcollectionsIfNeeded, commitOnlineMutation } from '../storage.js';
import { R } from '../../presentation/render-core.js';
import { logActivity, ActivityType, getTimeline } from '../timelineService.js';
import { gv, gc2, gc, gn, td } from '../../utils/index.js';
import { autoDetectFeatureOpp, computeScore } from '../intelligence.js';
import { showToast } from '../../utils/toast.js';
import { showConfirm, showPrompt } from '../../utils/confirm.js';
import { t } from '../../utils/i18n.js';
import { closeModal } from './uiActions.js';

function ensureOnlineForMutation() {
  const isBrowserOnline = typeof navigator === 'undefined' || navigator.onLine !== false;
  if (!S.isOnline || !isBrowserOnline) {
    showToast(t('الاتصال بالإنترنت مقطوع. لا يمكن حفظ أي تعديل بدون تأكيد السحابة.'), 'error');
    return false;
  }
  if (S.quotaExceeded || (typeof globalThis !== 'undefined' && globalThis.__progilicFirestoreQuotaExceeded)) {
    showToast(t('تم تجاوز الحصة اليومية لـ Firestore. التعديلات موقوفة مؤقتاً لحماية قاعدة البيانات.'), 'error');
    return false;
  }
  return true;
}

function computeIssueSummaries(issuesList = []) {
  const safe = Array.isArray(issuesList) ? issuesList.filter(Boolean) : [];
  const open = safe.filter(i => i.status === 'مفتوح' || i.status === 'قيد المعالجة' || i.status === 'جديد');
  const issuesByPriority = {
    عاجل: open.filter(i => i.priority === 'عاجل' || i.priority === 'عاجلة').length,
    عالية: open.filter(i => i.priority === 'عالية').length,
    متوسطة: open.filter(i => i.priority === 'متوسطة').length,
    منخفضة: open.filter(i => i.priority === 'منخفضة' || !i.priority).length
  };
  return {
    openIssuesCount: open.length,
    urgentIssuesCount: (issuesByPriority.عاجل || 0) + (issuesByPriority.عالية || 0),
    solvedIssuesCount: safe.filter(i => i.status === 'محلول' || i.status === 'مغلق').length,
    issuesByPriority
  };
}

function computeReqSummaries(reqsList = []) {
  const safe = Array.isArray(reqsList) ? reqsList.filter(Boolean) : [];
  return {
    requirementsCount: safe.length,
    reqsByStatus: {
      مقترح: safe.filter(r => r.status === 'مقترح' || !r.status).length,
      'قيد الدراسة': safe.filter(r => r.status === 'قيد الدراسة').length,
      مخطط: safe.filter(r => r.status === 'مخطط').length,
      منفذ: safe.filter(r => r.status === 'منفذ').length
    }
  };
}

export async function saveContact() {
  if (!hasPermission('contacts.create_entry')) {
    showToast(t('⚠️ لا تملك صلاحية تسجيل تواصل جديد.'), 'error');
    return;
  }
  const date = gv('fch_d');
  const note = (document.getElementById('fch_n') || {}).value || '';
  if (!date) { showToast(t('الرجاء اختيار تاريخ التواصل'), 'error'); return; }
  if (!note.trim()) { showToast(t('الرجاء إدخال ملاحظة التواصل'), 'error'); return; }
  if (!ensureOnlineForMutation()) return;
  
  const c = gc(); if (!c) return;
  const currentHistory = Array.isArray(c.contactHistory) ? c.contactHistory : [];
  const entryId = Date.now();
  const entry = { id: entryId, date, note: note.trim() };
  const updatedHistory = [...currentHistory, entry];
  const latest = updatedHistory.reduce((m, h) => h.date > m ? h.date : m, '') || c.lastContact || '';
  const nextScore = computeScore({ ...c, contactHistory: updatedHistory, lastContact: latest }).total;

  try {
    await commitOnlineMutation('SAVE_SUB_ITEM', {
      clientId: String(c.id),
      collectionName: 'contacts',
      itemId: String(entryId),
      itemData: entry,
      counterUpdates: {
        lastContact: latest,
        contactsCount: updatedHistory.length,
        score: nextScore
      },
      stats: S.stats
    });
  } catch (err) {
    if (err?.code !== 'VERSION_CONFLICT') {
      showToast(t('فشل حفظ سجل التواصل في السحابة: ') + (err?.message || ''), 'error');
    }
    return;
  }

  setClients(clients.map(x => x && x.id === c.id ? {
    ...x,
    contactHistory: updatedHistory,
    lastContact: latest,
    contactsCount: updatedHistory.length,
    score: nextScore
  } : x));

  logActivity(c.id, ActivityType.CONTACT_ADDED, "تسجيل تواصل", `تم تسجيل تواصل جديد بتاريخ ${entry.date}. الملاحظة: "${entry.note}".`, 'online-crm')
    .catch(err => console.error(err));
  
  showToast(t('تم تسجيل التواصل وتأكيده في السحابة.'), 'success');
  S.tab = 'contacts';
  closeModal();
}

export async function delContact(cid, hid) {
  if (!hasPermission('contacts.delete_entry')) {
    showToast(t('⚠️ لا تملك صلاحية حذف سجلات التواصل.'), 'error');
    return;
  }
  const confirmMsg = S.lang === 'fr' 
    ? 'Êtes-vous certain de vouloir supprimer cet enregistrement ?'
    : (S.lang === 'en' 
      ? 'Are you sure you want to permanently delete this contact record?'
      : 'هل أنت متأكد من حذف هذا السجل نهائياً؟');
  const confirmed = await showConfirm(confirmMsg, t('تأكيد الحذف'));
  if (!confirmed) return;
  if (!ensureOnlineForMutation()) return;

  const c = clients.find(x => x && x.id === cid); if (!c) return;
  const chToDelete = (c.contactHistory || []).find(h => h.id === hid);
  const nextHistory = (c.contactHistory || []).filter(h => h.id !== hid);
  const latest = nextHistory.reduce((m, h) => h.date > m ? h.date : m, '') || '';
  const nextScore = computeScore({ ...c, contactHistory: nextHistory, lastContact: latest }).total;

  try {
    await commitOnlineMutation('DELETE_SUB_ITEM', {
      clientId: String(cid),
      collectionName: 'contacts',
      itemId: String(hid),
      counterUpdates: {
        lastContact: latest,
        contactsCount: nextHistory.length,
        score: nextScore
      },
      stats: S.stats
    });
  } catch (err) {
    if (err?.code !== 'VERSION_CONFLICT') {
      showToast(t('فشل حذف سجل التواصل من السحابة: ') + (err?.message || ''), 'error');
    }
    return;
  }

  setClients(clients.map(x => x && x.id === cid ? {
    ...x,
    contactHistory: nextHistory,
    lastContact: latest,
    contactsCount: nextHistory.length,
    score: nextScore
  } : x));

  const dateStr = chToDelete ? chToDelete.date : '';
  logActivity(cid, ActivityType.CONTACT_DELETED, "حذف سجل تواصل", `تم إزالة سجل تواصل بتاريخ ${dateStr} من أرشيف العميل.`, 'online-crm')
    .catch(err => console.error(err));
  
  showToast(t('تم حذف سجل التواصل من السحابة.'), 'success');
  R();
}

// 2. Navigation Actions

export function editIssue(cid, iid) { S.modal = 'editIssue'; S.form = { eid: iid }; R(); }

export function editReq(cid, rid) { S.modal = 'editReq'; S.form = { eid: rid }; R(); }

export function autoFillConf() {
  const src = gv('fi_src'); const type = gv('fi_ty');
  const rc = gn('fi_rc', 1);
  let conf = 50;
  if (src === 'سوء استخدام') conf = 90;
  else if (type === 'استفسار') conf = 75;
  else if (rc >= 3) conf = 30;

  const el = document.getElementById('fi_co'); const vEl = document.getElementById('fi_cov');
  if (el) el.value = conf; if (vEl) vEl.textContent = conf + '%';
}

// 3. Client Issues Operations (Strict Online-Only Server-Acknowledged)

export async function saveIssue(editId) {
  const eid = editId !== null && editId !== 'null' ? editId : null;
  if (eid === null && !hasPermission('issues.create')) {
    showToast(t('⚠️ لا تملك صلاحية تسجيل مشاكل جديدة.'), 'error');
    return;
  }
  if (eid !== null && !hasPermission('issues.edit')) {
    showToast(t('⚠️ لا تملك صلاحية تعديل المشاكل والتذاكر.'), 'error');
    return;
  }
  const title = gv('fi_t'); if (!title) { showToast(t('الرجاء إدخال عنوان المشكلة'), 'error'); return; }
  if (!ensureOnlineForMutation()) return;

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

  const existingIssues = Array.isArray(c.issues) ? c.issues : [];
  let nextIssues = [...existingIssues];
  const stats = { ...(S.stats || {}) };
  const oldOpenCount = existingIssues.filter(i => i.status === 'مفتوح' || i.status === 'قيد المعالجة' || i.status === 'جديد').length;

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

  const summary = computeIssueSummaries(nextIssues);
  stats.totalOpenIssues = Math.max(0, (stats.totalOpenIssues || 0) + (summary.openIssuesCount - oldOpenCount));
  const nextScore = computeScore({ ...c, issues: nextIssues }).total;

  try {
    await commitOnlineMutation('SAVE_SUB_ITEM', {
      clientId: String(c.id),
      collectionName: 'issues',
      itemId: String(d.id),
      itemData: d,
      counterUpdates: {
        ...summary,
        score: nextScore
      },
      stats
    });
  } catch (err) {
    if (err?.code !== 'VERSION_CONFLICT') {
      showToast(t('فشل حفظ التذكرة في السحابة: ') + (err?.message || ''), 'error');
    }
    return;
  }

  S.stats = stats;
  setClients(clients.map(x => x && x.id === c.id ? {
    ...x,
    issues: nextIssues,
    ...summary,
    score: nextScore
  } : x));

  if (eid !== null) {
    logActivity(c.id, ActivityType.ISSUE_EDITED, "تعديل تذكرة مشكلة", `تم تعديل تذكرة المشكلة: "${d.title}".`, 'online-crm')
      .catch(err => console.error(err));
  } else {
    logActivity(c.id, ActivityType.ISSUE_ADDED, "تسجيل مشكلة جديدة", `تم تسجيل مشكلة بعنوان: "${d.title}" وبأولوية (${d.priority}).`, 'online-crm')
      .catch(err => console.error(err));
  }

  showToast(t('تم حفظ التذكرة وتأكيدها في السحابة.'), 'success');
  closeModal();
}

export async function markSolved(cid, iid) {
  if (!hasPermission('issues.resolve')) {
    showToast(t('⚠️ لا تملك صلاحية حل وإغلاق تذاكر المشاكل.'), 'error');
    return;
  }
  const promptMsg = S.lang === 'fr'
    ? 'Entrez la description de la solution apportée :'
    : (S.lang === 'en'
      ? 'Enter description of the solution provided:'
      : 'أدخل وصف الحل المقدم للتذكرة:');
  const promptPlaceholder = S.lang === 'fr'
    ? 'Ex: Logiciel mis à jour et nouvelle licence activée'
    : (S.lang === 'en'
      ? 'E.g.: Software updated and new license installed'
      : 'مثال: تم تحديث البرنامج وتثبيت رخصة جديدة');
  const sol = await showPrompt(promptMsg, t('حل التذكرة'), '', promptPlaceholder); if (sol === null) return;
  if (!ensureOnlineForMutation()) return;

  const c = clients.find(x => x && x.id === cid); if (!c) return;
  const iss = (c.issues || []).find(x => x.id === iid); if (!iss) return;

  const updatedIssue = { ...iss, status: 'محلول', solution: sol || t('تم الحل'), resolvedDate: td() };
  const nextIssues = c.issues.map(i => i.id === iid ? updatedIssue : i);
  const summary = computeIssueSummaries(nextIssues);
  const oldSummary = computeIssueSummaries(c.issues || []);

  const stats = { ...(S.stats || {}) };
  stats.totalOpenIssues = Math.max(0, (stats.totalOpenIssues || 0) + (summary.openIssuesCount - oldSummary.openIssuesCount));
  const nextScore = computeScore({ ...c, issues: nextIssues }).total;

  try {
    await commitOnlineMutation('SAVE_SUB_ITEM', {
      clientId: String(cid),
      collectionName: 'issues',
      itemId: String(iid),
      itemData: updatedIssue,
      counterUpdates: {
        ...summary,
        score: nextScore
      },
      stats
    });
  } catch (err) {
    if (err?.code !== 'VERSION_CONFLICT') {
      showToast(t('فشل تحديث حالة المشكلة في السحابة: ') + (err?.message || ''), 'error');
    }
    return;
  }

  S.stats = stats;
  setClients(clients.map(x => x && x.id === cid ? {
    ...x,
    issues: nextIssues,
    ...summary,
    score: nextScore
  } : x));

  logActivity(cid, ActivityType.ISSUE_RESOLVED, "حل تذكرة مشكلة", `تم وضع علامة "محلول" على المشكلة: "${iss.title}". وصف الحل: "${sol || 'تم تقديم الدعم وحل المشكلة.'}"`, 'online-crm')
    .catch(err => console.error(err));

  showToast(t('تم إغلاق التذكرة وحفظ الحل في السحابة.'), 'success');
  R();
}

export async function delIssue(cid, iid) {
  if (!hasPermission('issues.delete')) {
    showToast(t('⚠️ لا تملك صلاحية حذف تذاكر المشاكل.'), 'error');
    return;
  }
  const confirmMsg = S.lang === 'fr'
    ? 'Êtes-vous certain de vouloir supprimer définitivement cette anomalie ?'
    : (S.lang === 'en'
      ? 'Are you sure you want to permanently delete this issue?'
      : 'هل أنت متأكد من حذف هذه المشكلة نهائياً؟');
  const confirmed = await showConfirm(confirmMsg, t('تأكيد الحذف'));
  if (!confirmed) return;
  if (!ensureOnlineForMutation()) return;

  const c = clients.find(x => x && x.id === cid); if (!c) return;
  const issToDelete = (c.issues || []).find(i => i.id === iid);
  if (!issToDelete) return;

  const nextIssues = (c.issues || []).filter(i => i.id !== iid);
  const summary = computeIssueSummaries(nextIssues);
  const oldSummary = computeIssueSummaries(c.issues || []);

  const stats = { ...(S.stats || {}) };
  stats.totalOpenIssues = Math.max(0, (stats.totalOpenIssues || 0) + (summary.openIssuesCount - oldSummary.openIssuesCount));
  const nextScore = computeScore({ ...c, issues: nextIssues }).total;

  try {
    await commitOnlineMutation('DELETE_SUB_ITEM', {
      clientId: String(cid),
      collectionName: 'issues',
      itemId: String(iid),
      counterUpdates: {
        ...summary,
        score: nextScore
      },
      stats
    });
  } catch (err) {
    if (err?.code !== 'VERSION_CONFLICT') {
      showToast(t('فشل حذف التذكرة من السحابة: ') + (err?.message || ''), 'error');
    }
    return;
  }

  S.stats = stats;
  setClients(clients.map(x => x && x.id === cid ? {
    ...x,
    issues: nextIssues,
    ...summary,
    score: nextScore
  } : x));

  logActivity(cid, ActivityType.ISSUE_DELETED, "حذف تذكرة مشكلة", `تم إزالة تذكرة المشكلة نهائياً: "${issToDelete.title}".`, 'online-crm')
    .catch(err => console.error(err));

  showToast(t('تم حذف التذكرة من السحابة.'), 'success');
  R();
}

// 5. Client Requirements Operations (Strict Online-Only Server-Acknowledged)

export async function saveReq(editId) {
  const eid = editId !== null && editId !== 'null' ? editId : null;
  if (eid === null && !hasPermission('features.create')) {
    showToast(t('⚠️ لا تملك صلاحية تسجيل طلبات أو متطلبات جديدة.'), 'error');
    return;
  }
  if (eid !== null && !hasPermission('features.edit')) {
    showToast(t('⚠️ لا تملك صلاحية تعديل المتطلبات والطلبات.'), 'error');
    return;
  }
  const title = gv('fr_t'); if (!title) { showToast(t('الرجاء إدخال عنوان الطلب'), 'error'); return; }
  if (!ensureOnlineForMutation()) return;

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

  const existingReqs = Array.isArray(c.requirements) ? c.requirements : [];
  let nextReqs = [...existingReqs];
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

  const reqSummary = computeReqSummaries(nextReqs);
  const nextScore = computeScore({ ...c, requirements: nextReqs }).total;

  try {
    await commitOnlineMutation('SAVE_SUB_ITEM', {
      clientId: String(c.id),
      collectionName: 'requirements',
      itemId: String(d.id),
      itemData: d,
      counterUpdates: {
        ...reqSummary,
        score: nextScore
      },
      stats: S.stats
    });
  } catch (err) {
    if (err?.code !== 'VERSION_CONFLICT') {
      showToast(t('فشل حفظ الطلب في السحابة: ') + (err?.message || ''), 'error');
    }
    return;
  }

  setClients(clients.map(x => x && x.id === c.id ? {
    ...x,
    requirements: nextReqs,
    ...reqSummary,
    score: nextScore
  } : x));

  if (eid !== null) {
    logActivity(c.id, ActivityType.REQUIREMENT_EDITED, "تعديل طلب ميزة", `تم تحديث متطلب الميزة: "${d.title}".`, 'online-crm')
      .catch(err => console.error(err));
  } else {
    logActivity(c.id, ActivityType.REQUIREMENT_ADDED, "تسجيل متطلب جديد", `تم تسجيل متطلب ميزة جديد: "${d.title}" بتأثير (${d.impact}).`, 'online-crm')
      .catch(err => console.error(err));
  }

  showToast(t('تم حفظ متطلب الميزة في السحابة.'), 'success');
  closeModal();
}

export async function delReq(cid, rid) {
  if (!hasPermission('features.delete')) {
    showToast(t('⚠️ لا تملك صلاحية حذف المتطلبات والطلبات.'), 'error');
    return;
  }
  const confirmMsg = S.lang === 'fr'
    ? 'Êtes-vous certain de vouloir supprimer cette demande ?'
    : (S.lang === 'en'
      ? 'Are you sure you want to permanently delete this requirement?'
      : 'هل أنت متأكد من حذف هذا الطلب نهائياً؟');
  const confirmed = await showConfirm(confirmMsg, t('تأكيد الحذف'));
  if (!confirmed) return;
  if (!ensureOnlineForMutation()) return;

  const c = clients.find(x => x && x.id === cid); if (!c) return;
  const reqToDelete = (c.requirements || []).find(r => r.id === rid);
  const nextReqs = (c.requirements || []).filter(r => r.id !== rid);
  const reqSummary = computeReqSummaries(nextReqs);
  const nextScore = computeScore({ ...c, requirements: nextReqs }).total;

  try {
    await commitOnlineMutation('DELETE_SUB_ITEM', {
      clientId: String(cid),
      collectionName: 'requirements',
      itemId: String(rid),
      counterUpdates: {
        ...reqSummary,
        score: nextScore
      },
      stats: S.stats
    });
  } catch (err) {
    if (err?.code !== 'VERSION_CONFLICT') {
      showToast(t('فشل حذف الطلب من السحابة: ') + (err?.message || ''), 'error');
    }
    return;
  }

  setClients(clients.map(x => x && x.id === cid ? {
    ...x,
    requirements: nextReqs,
    ...reqSummary,
    score: nextScore
  } : x));

  logActivity(cid, ActivityType.REQUIREMENT_DELETED, "حذف طلب متطلب", `تم إزالة طلب المتطلب "${reqToDelete?.title || ''}" من حساب العميل.`, 'online-crm')
    .catch(err => console.error(err));

  showToast(t('تم حذف الطلب من السحابة.'), 'success');
  R();
}

export async function loadClientTimeline(clientId) {
  if (!clientId) return;
  if (!hasPermission('clients.view_timeline')) {
    showToast(t('ليس لديك صلاحية عرض الخط الزمني للعميل'), 'error');
    return;
  }
  try {
    const list = await getTimeline(clientId);
    updateState({ clientActivities: list });
    R();
  } catch (err) {
    console.error("Failed to load client timeline:", err);
  }
}
