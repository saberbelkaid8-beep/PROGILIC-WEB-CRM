import { openModal, closeModal } from "./uiActions.js";
import { S, clients, setClients, updateState, currentUser, setCurrentUser, currentStaffUser, hasPermission, getActiveTenantId, setSyncing, setLastSyncedTime } from '../../state/store.js';
import { persist, loadClientSubcollectionsIfNeeded, startClientDetailSync, commitOnlineMutation } from '../storage.js';
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
import { mergeOrAddClientProgram, adjustClientProgramDevices } from '../programMetrics.js';
import { buildVersionSyncPlan } from '../versionSync.js';
import {
  normalizeClientStatus,
  isConfirmedClientStatus,
  isUnconfirmedClientStatus,
  buildClientClassificationPlan
} from '../clientStatus.js';
import { computeStats } from '../mergeDatabase.js';
import { batchClassifyClientsStatus } from '../../firebase/service.js';

export async function selClient(id) {
  const uid = (auth && auth.currentUser && auth.currentUser.uid) || (currentUser && currentUser.tenantId) || currentUser?.uid || getActiveTenantId();
  S.selId = id;
  S.view = 'detail';
  S.tab = 'overview';
  S.clientActivities = [];
  if (uid && S.isOnline !== false) {
    startClientDetailSync(uid, id);
  } else {
    S.view = 'loading_details';
    R();
    await loadClientSubcollectionsIfNeeded(id);
    S.selId = id;
    S.view = 'detail';
  }
  R();
}

export function editProg(cid, pid) { S.modal = 'editProgram'; S.form = { eid: pid }; R(); }

// 3. Program Operations (Real-Time Auto-Sync Transactional)

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

  const prevClients = clients.map(cl => ({ ...cl }));
  const prevStats = { ...(S.stats || {}) };

  const nextProgs = (c.programs || []).filter(p => p.id !== pid);
  const activeProg = nextProgs.filter(p => p.endDate).sort((a, b) => new Date(a.endDate) - new Date(b.endDate));
  const nextEndDate = activeProg.length > 0 ? activeProg[0].endDate : '';
  const nextInstalls = nextProgs.reduce((acc, p) => acc + (Number(p.installationsCount) || 1), 0);
  const nextNames = nextProgs.map(p => p.programName);

  const stats = { ...(S.stats || {}) };
  stats.totalPrograms = Math.max(0, (stats.totalPrograms || 0) - 1);
  stats.totalLicensedDevices = Math.max(0, (stats.totalLicensedDevices || 0) - (Number(progToDelete.installationsCount) || 1));

  const updatedClient = {
    ...c,
    programs: nextProgs,
    programsCount: nextProgs.length,
    installationsCount: nextInstalls,
    endDate: nextEndDate,
    programNames: nextNames,
    _dirtyLocal: true
  };
  S.stats = stats;
  setClients(clients.map(x => (x && x.id === cid ? updatedClient : x)));
  R();

  let ack = null;
  try {
    ack = await commitOnlineMutation('DELETE_SUB_ITEM', {
      clientId: String(cid),
      collectionName: 'programs',
      itemId: String(pid),
      counterUpdates: {
        programs: nextProgs,
        programsCount: nextProgs.length,
        installationsCount: nextInstalls,
        endDate: nextEndDate,
        programNames: nextNames
      },
      stats,
      concurrency: {
        baseVersion: Number(c.version || 0),
        expectedItemVersion: Number(progToDelete.versionNum || 1),
        isCreate: false
      }
    });
  } catch (err) {
    if (err?.code !== 'VERSION_CONFLICT') {
      setClients(prevClients);
      S.stats = prevStats;
      R();
      showToast(t('فشل حذف البرنامج: ') + (err?.message || ''), 'error');
    }
    return;
  }

  const isQueued = Boolean(ack?.queued);
  logActivity(
    cid,
    ActivityType.PROGRAM_DELETED,
    "حذف برنامج ترخيص",
    `تم إزالة ترخيص البرنامج "${progToDelete.programName}" من حساب العميل.`,
    isQueued ? 'local' : 'online-crm',
    {
      clientName: c.fullName,
      programId: progToDelete.id,
      programName: progToDelete.programName
    }
  ).catch(err => console.error(err));

  if (isQueued) {
    showToast(t('تم حفظ التعديل محلياً وسيُزامن تلقائياً عند عودة الاتصال.'), 'warning');
  } else {
    showToast(t('تم حذف البرنامج وحفظ التعديل في السحابة.'), 'success');
  }
  R();
}

export async function adjustProgramDevices(cid, pid, delta) {
  if (!hasPermission('programs.edit')) {
    showToast(t('⚠️ لا تملك صلاحية تعديل بيانات البرامج والتراخيص.'), 'error');
    return;
  }
  const c = clients.find(x => String(x.id) === String(cid));
  if (!c || !Array.isArray(c.programs)) return;

  const targetOld = c.programs.find(p => String(p.id) === String(pid));
  const res = adjustClientProgramDevices(c.programs, pid, delta);
  if (!res.targetProgram || res.diffDevices === 0) return;

  const prevClients = clients.map(cl => ({ ...cl }));
  const prevStats = { ...(S.stats || {}) };

  const stats = { ...(S.stats || {}) };
  stats.totalLicensedDevices = Math.max(0, (stats.totalLicensedDevices || 0) + res.diffDevices);

  const nextInstalls = res.nextPrograms.reduce((acc, p) => acc + (Number(p.installationsCount) || 1), 0);
  const nextNames = res.nextPrograms.map(p => p.programName);

  const updatedClient = {
    ...c,
    programs: res.nextPrograms,
    programsCount: res.nextPrograms.length,
    installationsCount: nextInstalls,
    endDate: '',
    programNames: nextNames,
    _dirtyLocal: true
  };
  S.stats = stats;
  setClients(clients.map(x => (String(x?.id) === String(c.id) ? updatedClient : x)));
  R();

  let ack = null;
  try {
    ack = await commitOnlineMutation('SAVE_SUB_ITEM', {
      clientId: String(c.id),
      collectionName: 'programs',
      itemId: String(res.targetProgram.id),
      itemData: res.targetProgram,
      counterUpdates: {
        programs: res.nextPrograms,
        programsCount: res.nextPrograms.length,
        installationsCount: nextInstalls,
        endDate: '',
        programNames: nextNames
      },
      stats,
      concurrency: {
        baseVersion: Number(c.version || 0),
        expectedItemVersion: Number(targetOld?.versionNum || 1),
        isCreate: false
      }
    });
  } catch (err) {
    if (err?.code !== 'VERSION_CONFLICT') {
      setClients(prevClients);
      S.stats = prevStats;
      R();
      showToast(t('فشل تحديث عدد الأجهزة: ') + (err?.message || ''), 'error');
    }
    return;
  }

  const isQueued = Boolean(ack?.queued);
  logActivity(
    c.id,
    ActivityType.PROGRAM_EDITED,
    "تحديث عدد أجهزة الترخيص",
    `تم تعديل عدد أجهزة البرنامج "${res.targetProgram.programName}" إلى ${res.targetProgram.installationsCount} أجهزة.`,
    isQueued ? 'local' : 'online-crm',
    {
      clientName: c.fullName,
      programId: res.targetProgram.id,
      programName: res.targetProgram.programName,
      platform: res.targetProgram.platform,
      type: res.targetProgram.type,
      version: res.targetProgram.version,
      installationsCount: res.targetProgram.installationsCount
    }
  ).catch(err => console.error(err));

  if (isQueued) {
    showToast(t('تم حفظ التعديل محلياً وسيُزامن تلقائياً عند عودة الاتصال.'), 'warning');
  } else {
    showToast(t('تم تحديث عدد الأجهزة وحفظه في السحابة.'), 'success');
  }
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
  if (platform !== 'Mobile' && !version) {
    showToast(t('الرجاء اختيار إصدار البرنامج (مثال: V27, V26...) *'), 'error');
    return;
  }

  const installationsCount = Math.max(1, gn('fp_ic', 1));
  const c = gc(); if (!c) return;

  const prevClients = clients.map(cl => ({ ...cl }));
  const prevStats = { ...(S.stats || {}) };

  const typeDisplay = type ? type.split(' (')[0].trim() : (platform === 'Web' ? 'الويب' : '');
  const derivedProgramName = `${platform} - ${typeDisplay}${version ? ` ${version}` : ''}`.trim();
  
  let d = {
    programName: derivedProgramName,
    platform: platform,
    type: type || 'الويب',
    version: version,
    installationsCount: installationsCount,
    startDate: gv('fp_sd') || td(),
    endDate: ''
  };

  if (!Array.isArray(c.programs)) c.programs = [];

  let nextProgs = [...c.programs];
  const stats = { ...(S.stats || {}) };
  let mergedExisting = false;
  let oldItemVersionNum = null;
  let isCreateItem = programEditId === null;

  if (programEditId !== null) {
    const i = nextProgs.findIndex(p => p.id === programEditId);
    if (i > -1) {
      const oldP = nextProgs[i];
      oldItemVersionNum = Number(oldP.versionNum || 1);
      const diffInstalls = d.installationsCount - (Number(oldP.installationsCount) || 1);
      stats.totalLicensedDevices = Math.max(0, (stats.totalLicensedDevices || 0) + diffInstalls);
      
      d.id = programEditId;
      nextProgs[i] = { ...nextProgs[i], ...d };
    }
  } else {
    d.id = Date.now();
    const existingCount = nextProgs.length;
    const mergeRes = mergeOrAddClientProgram(nextProgs, d);
    nextProgs = mergeRes.nextPrograms;
    d = mergeRes.targetProgram;
    stats.totalPrograms = (stats.totalPrograms || 0) + mergeRes.addedProgramsCount;
    stats.totalLicensedDevices = (stats.totalLicensedDevices || 0) + mergeRes.addedDevices;
    mergedExisting = mergeRes.action === 'merged';
    if (mergedExisting && existingCount > 0) {
      isCreateItem = false;
      oldItemVersionNum = Number(d.versionNum || 1);
    }
  }

  const nextInstalls = nextProgs.reduce((acc, p) => acc + (Number(p.installationsCount) || 1), 0);
  const nextNames = nextProgs.map(p => p.programName);

  const updatedClient = {
    ...c,
    programs: nextProgs,
    programsCount: nextProgs.length,
    installationsCount: nextInstalls,
    endDate: '',
    programNames: nextNames,
    _dirtyLocal: true
  };
  S.stats = stats;
  setClients(clients.map(x => (x && x.id === c.id ? updatedClient : x)));
  R();

  let ack = null;
  try {
    ack = await commitOnlineMutation('SAVE_SUB_ITEM', {
      clientId: String(c.id),
      collectionName: 'programs',
      itemId: String(d.id),
      itemData: d,
      counterUpdates: { 
        programs: nextProgs,
        programsCount: nextProgs.length, 
        installationsCount: nextInstalls, 
        endDate: '',
        programNames: nextNames
      },
      stats,
      concurrency: {
        baseVersion: Number(c.version || 0),
        expectedItemVersion: isCreateItem ? null : oldItemVersionNum,
        isCreate: isCreateItem
      }
    });
  } catch (err) {
    if (err?.code !== 'VERSION_CONFLICT') {
      setClients(prevClients);
      S.stats = prevStats;
      R();
      showToast(t('فشل حفظ البرنامج في قاعدة البيانات: ') + (err?.message || ''), 'error');
    }
    return;
  }

  const isQueued = Boolean(ack?.queued);

  // Log timeline activity
  if (programEditId !== null || mergedExisting) {
    logActivity(
      c.id,
      ActivityType.PROGRAM_EDITED,
      mergedExisting ? "زيادة أجهزة برنامج مرخص" : "تعديل ترخيص برنامج",
      mergedExisting
        ? `تم دمج ${installationsCount} جهاز(أجهزة) على البرنامج "${d.programName}" ليصبح المجموع ${d.installationsCount} أجهزة مرخصة.`
        : `تم تعديل بيانات ترخيص البرنامج "${d.programName}". الأجهزة المرخصة: ${d.installationsCount}.`,
      isQueued ? 'local' : 'online-crm',
      {
        clientName: c.fullName,
        programId: d.id,
        programName: d.programName,
        platform: d.platform,
        type: d.type,
        version: d.version,
        installationsCount: d.installationsCount,
        startDate: d.startDate,
        endDate: ''
      }
    ).catch(err => console.error(err));
  } else {
    logActivity(
      c.id,
      ActivityType.PROGRAM_ADDED,
      "إضافة برنامج ترخيص",
      `تم تسجيل ترخيص جديد للبرنامج "${d.programName}" مع ${d.installationsCount} أجهزة مرخصة.`,
      isQueued ? 'local' : 'online-crm',
      {
        clientName: c.fullName,
        activityId: `act_prog_${c.id}_${d.id}`,
        programId: d.id,
        programName: d.programName,
        platform: d.platform,
        type: d.type,
        version: d.version,
        installationsCount: d.installationsCount,
        startDate: d.startDate,
        endDate: ''
      }
    ).catch(err => console.error(err));
  }

  if (isQueued) {
    showToast(t('تم حفظ البرنامج محلياً وسيُزامن تلقائياً عند عودة الاتصال.'), 'warning');
  } else if (mergedExisting) {
    showToast(`${t('تمت إضافة الأجهزة على البرنامج الموجود')} (${d.installationsCount} ${t('جهاز')})`, 'success');
  } else {
    showToast(t('تم حفظ بيانات البرنامج وتأكيدها في السحابة.'), 'success');
  }

  closeModal();
}

export async function confirmProgramVersionSync(clientId = null) {
  if (!hasPermission('programs.edit')) {
    showToast(t('⚠️ لا تملك صلاحية تعديل بيانات البرامج والتراخيص.'), 'error');
    return false;
  }

  const targetClient = (clientId !== null && clientId !== undefined)
    ? clients.find(x => String(x?.id) === String(clientId))
    : gc();
  if (!targetClient) {
    showToast(t('تعذر العثور على بطاقة العميل.'), 'error');
    return false;
  }

  const programKey = (gv('vs_program') || gv('fpu_prog') || '').trim();
  const targetVersion = (gv('vs_version') || gv('fpu_ver') || '').trim();
  const updateDate = (gv('vs_date') || gv('fpu_date') || td()).trim();
  const note = (gv('vs_note') || gv('fpu_notes') || '').trim();

  if (!programKey) {
    showToast(t('الرجاء اختيار البرنامج المعني بالتحديث *'), 'error');
    return false;
  }
  if (!targetVersion) {
    showToast(t('الرجاء اختيار الإصدار الجديد صراحةً *'), 'error');
    return false;
  }

  const actor = currentStaffUser || S.currentStaffUser || currentUser || S.currentUser || {};
  const employeeName = actor.displayName || actor.fullName || actor.username || actor.email || 'المسؤول العام';
  const employeeId = actor.id || actor.uid || 'gerant';

  let plan;
  try {
    plan = buildVersionSyncPlan({
      client: targetClient,
      programKey,
      targetVersion,
      updateDate,
      employeeName,
      employeeId,
      note
    });
  } catch (planErr) {
    showToast(planErr?.message || t('بيانات تحديث الإصدار غير صالحة.'), 'error');
    return false;
  }

  const prevClients = clients.map(cl => ({ ...cl }));
  const existingHistory = Array.isArray(targetClient.versionHistory) ? targetClient.versionHistory : [];
  const nextVersionHistory = [plan.versionHistoryEntry, ...existingHistory].slice(0, 100);
  const nextVersionUpdates = [plan.versionUpdateEntry, ...(targetClient.versionUpdates || [])].slice(0, 100);

  const updatedClient = {
    ...targetClient,
    programs: plan.nextPrograms,
    programNames: plan.counterUpdates.programNames,
    programsCount: plan.counterUpdates.programsCount,
    installationsCount: plan.counterUpdates.installationsCount,
    versionHistory: nextVersionHistory,
    versionUpdates: nextVersionUpdates,
    _dirtyLocal: true
  };

  setClients(clients.map(x => (String(x?.id) === String(targetClient.id) ? updatedClient : x)));
  R();

  let ack = null;
  try {
    ack = await commitOnlineMutation('SYNC_PROGRAM_VERSION', {
      clientId: String(targetClient.id),
      programKey: plan.programKey,
      programLabel: plan.programLabel,
      previousVersion: plan.previousVersion,
      newVersion: plan.newVersion,
      affectedDevices: plan.affectedDevices,
      updatedPrograms: plan.updatedPrograms,
      counterUpdates: plan.counterUpdates,
      versionHistoryEntry: plan.versionHistoryEntry,
      baseVersion: Number(targetClient.version || 0),
      concurrency: { baseVersion: Number(targetClient.version || 0) }
    });
  } catch (err) {
    if (err?.code !== 'VERSION_CONFLICT') {
      setClients(prevClients);
      R();
      showToast(t('فشل تحديث إصدار البرنامج في السحابة: ') + (err?.message || ''), 'error');
    }
    return false;
  }

  const isQueued = Boolean(ack?.queued);

  logActivity(
    targetClient.id,
    ActivityType.PROGRAM_VERSION_UPDATED,
    `تحديث إصدار ${plan.programLabel} إلى ${plan.newVersion}`,
    `تم تحديث ${plan.affectedProgramsCount} ترخيص (${plan.affectedDevices} جهاز) من (${plan.previousVersion}) إلى (${plan.newVersion}) بواسطة ${employeeName}.`,
    isQueued ? 'local' : 'online-crm',
    {
      clientName: targetClient.fullName,
      programKey: plan.programKey,
      programLabel: plan.programLabel,
      previousVersion: plan.previousVersion,
      newVersion: plan.newVersion,
      toVersion: plan.newVersion,
      affectedDevices: plan.affectedDevices,
      affectedProgramsCount: plan.affectedProgramsCount,
      updateDate
    }
  ).catch(err => console.error(err));

  if (isQueued) {
    showToast(t('تم حفظ تحديث الإصدار محلياً وسيُزامن تلقائياً عند عودة الاتصال.'), 'warning');
  } else {
    showToast(t('تم تحديث الإصدار لجميع أجهزة البرنامج وحفظه في السحابة.'), 'success');
  }

  closeModal();
  return true;
}

export async function openLogProgramUpdateModal(clientId = null) {
  const c = (clientId !== null && clientId !== undefined)
    ? clients.find(x => String(x?.id) === String(clientId))
    : gc();
  if (c) {
    S.selId = c.id;
  }
  openModal('logProgramUpdate', { clientId: c?.id, targetVersion: '' });
  if (S.form) {
    S.form.targetVersion = '';
  }
}

export async function saveProgramVersionUpdate(clientId = null) {
  return await confirmProgramVersionSync(clientId);
}

export async function saveClient(editId) {
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

  const bt = (gv('f_bt') || '').trim();
  if (!bt) { showToast(t('الرجاء اختيار النشاط الرئيسي *'), 'error'); return; }

  const bf = (gv('f_bf') || '').trim();
  if (!bf) { showToast(t('الرجاء اختيار تخصص النشاط *'), 'error'); return; }

  const clientEditId = editId !== null && editId !== 'null' ? editId : null;
  const rawSt = (gv('f_st') || (clientEditId === null ? 'غير مؤكد' : 'مؤكد')).trim();
  const st = normalizeClientStatus(rawSt);
  if (!rawSt) { showToast(t('الرجاء تحديد حالة العميل (مؤكد / غير مؤكد) *'), 'error'); return; }

  const lc = (gv('f_lc') || '').trim();
  if (isConfirmedClientStatus(st) && !lc) { showToast(t('الرجاء تحديد تاريخ آخر تواصل *'), 'error'); return; }

  const sd = (gv('f_sd') || '').trim();
  if (isConfirmedClientStatus(st) && !sd) { showToast(t('الرجاء تحديد تاريخ البدء / التسجيل *'), 'error'); return; }

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

  if (clientEditId === null && !hasPermission('clients.create') && !hasPermission('canAddClients')) {
    showToast('⚠️ لا تملك صلاحية إضافة عملاء جدد. الصلاحيات محددة من طرف الرئيس (Gérant).', 'error');
    return;
  }
  if (clientEditId !== null && !hasPermission('clients.edit') && !hasPermission('canEditClients')) {
    showToast('⚠️ لا تملك صلاحية تعديل بيانات العملاء. الصلاحيات محددة من طرف الرئيس (Gérant).', 'error');
    return;
  }

  const prevClients = clients.map(cl => ({ ...cl }));
  const prevStats = { ...(S.stats || {}) };
  const stats = { ...(S.stats || {}) };
  let createdClientId = null;

  if (clientEditId !== null) {
    const oldC = clients.find(c => c.id === clientEditId);
    if (oldC) {
      const updatedClient = { ...oldC, ...d, _dirtyLocal: true };
      
      // Update stats
      if (isConfirmedClientStatus(oldC.status) !== isConfirmedClientStatus(d.status)) {
        if (isConfirmedClientStatus(oldC.status)) {
          stats.activeClients = Math.max(0, (stats.activeClients || 0) - 1);
          stats.confirmedClients = Math.max(0, (stats.confirmedClients || 0) - 1);
        } else {
          stats.stoppedClients = Math.max(0, (stats.stoppedClients || 0) - 1);
          stats.unconfirmedClients = Math.max(0, (stats.unconfirmedClients || 0) - 1);
        }

        if (isConfirmedClientStatus(d.status)) {
          stats.activeClients = (stats.activeClients || 0) + 1;
          stats.confirmedClients = (stats.confirmedClients || 0) + 1;
        } else {
          stats.stoppedClients = (stats.stoppedClients || 0) + 1;
          stats.unconfirmedClients = (stats.unconfirmedClients || 0) + 1;
        }
        stats.prospectiveClients = 0;
      }
      
      // Optimistic Update
      const i = clients.findIndex(c => c.id === clientEditId);
      if (i > -1) {
        const nextClients = [...clients];
        nextClients[i] = updatedClient;
        setClients(nextClients);
      }
      S.stats = stats;
      R();
      
      let ack = null;
      try {
        ack = await commitOnlineMutation('UPDATE_CLIENT', {
          clientId: String(clientEditId),
          clientData: updatedClient,
          oldStatus: oldC.status,
          stats,
          baseVersion: Number(oldC.version || 0)
        });
      } catch (err) {
        if (err?.code !== 'VERSION_CONFLICT') {
          setClients(prevClients);
          S.stats = prevStats;
          R();
          showToast(t('فشل تحديث بيانات العميل في قاعدة البيانات: ') + (err?.message || ''), 'error');
        }
        return;
      }

      const isQueued = Boolean(ack?.queued);
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
        isQueued ? 'local' : 'online-crm',
        { clientName: d.fullName, changedFields }
      ).catch(err => console.error(err));

      if (isQueued) {
        showToast(t('تم حفظ التعديلات محلياً وستُزامن تلقائياً عند عودة الاتصال.'), 'warning');
      } else {
        showToast(t('تم تحديث بيانات العميل وحفظها في السحابة.'), 'success');
      }
    }
  } else {
    const nextId = Date.now();
    createdClientId = nextId;
    const startDateVal = d.startDate || (isConfirmedClientStatus(d.status) ? td() : '');
    const newClient = {
      ...d,
      startDate: startDateVal,
      id: nextId,
      score: 100,
      gps: { lat: null, lng: null },
      programs: [],
      programsCount: 0,
      installationsCount: 0,
      programNames: [],
      versionHistory: [],
      issues: [],
      requirements: [],
      contactHistory: [],
      _subcollectionsLoaded: true,
      _dirtyLocal: true
    };

    // Check if optional initial program was enabled in the modal
    const progToggle = typeof document !== 'undefined' ? document.getElementById('f_p_enable') : null;
    const pPl = (gv('f_p_pl') || '').trim();
    const pVer = (gv('f_p_ver') || '').trim();
    const pTy = (gv('f_p_ty') || '').trim();
    const hasInitialProg = progToggle
      ? progToggle.checked
      : Boolean(pVer || (pPl === 'Mobile' && pTy));
    let initialProg = null;
    if (hasInitialProg) {
      if (!pPl) {
        showToast(t('الرجاء اختيار المنصة *'), 'error');
        return;
      }
      if (pPl !== 'Mobile' && !pVer) {
        showToast(t('الرجاء اختيار إصدار البرنامج المرخص (مثال: V27, V26...) *'), 'error');
        return;
      }
      if (pPl !== 'Web' && !pTy) {
        showToast(t('الرجاء اختيار نوع البرنامج المرخص *'), 'error');
        return;
      }
      const typeDisplay = pTy ? pTy.split(' (')[0].trim() : (pPl === 'Web' ? 'الويب' : '');
      const derivedName = `${pPl || 'Desktop'} - ${typeDisplay}${pVer ? ` ${pVer}` : ''}`.trim();
      initialProg = {
        id: nextId + 1,
        programName: derivedName,
        platform: pPl || 'Desktop',
        type: pTy || (pPl === 'Web' ? 'الويب' : 'تجاري'),
        version: pVer,
        installationsCount: Math.max(1, gn('f_p_ic', 1)),
        startDate: startDateVal || td(),
        endDate: ''
      };
      newClient.programs = [initialProg];
      newClient.programsCount = 1;
      newClient.installationsCount = initialProg.installationsCount;
      newClient.programNames = [initialProg.programName];
      if (!newClient.endDate && initialProg.endDate) {
        newClient.endDate = initialProg.endDate;
      }
      stats.totalPrograms = (stats.totalPrograms || 0) + 1;
      stats.totalLicensedDevices = (stats.totalLicensedDevices || 0) + initialProg.installationsCount;
    }

    // Update stats
    stats.totalClients = (stats.totalClients || 0) + 1;
    if (isConfirmedClientStatus(d.status)) {
      stats.activeClients = (stats.activeClients || 0) + 1;
      stats.confirmedClients = (stats.confirmedClients || 0) + 1;
    } else {
      stats.stoppedClients = (stats.stoppedClients || 0) + 1;
      stats.unconfirmedClients = (stats.unconfirmedClients || 0) + 1;
    }
    stats.prospectiveClients = 0;
    
    // Optimistic Update
    setClients([...clients, newClient]);
    S.stats = stats;
    R();
    
    let ack = null;
    try {
      ack = await commitOnlineMutation('ADD_CLIENT', {
        clientData: newClient,
        stats
      });
    } catch (err) {
      if (err?.code !== 'VERSION_CONFLICT') {
        setClients(prevClients);
        S.stats = prevStats;
        R();
        showToast(t('فشل إضافة العميل إلى قاعدة البيانات: ') + (err?.message || ''), 'error');
      }
      return;
    }

    const isQueued = Boolean(ack?.queued);

    // Log timeline activity
    logActivity(nextId, ActivityType.CLIENT_CREATED, "إنشاء العميل", `تم تسجيل العميل بنظام CRM بنجاح: ${newClient.fullName}.`)
      .catch(err => console.error(err));
    if (initialProg) {
      logActivity(
        nextId,
        ActivityType.PROGRAM_ADDED,
        `خدمة ترخيص برنامج: ${initialProg.programName}`,
        `تقديم وتثبيت خدمة برمجية "${initialProg.programName}" للعميل ${newClient.fullName} - المنصة: ${initialProg.platform} - نوع الخدمة: ${initialProg.type} - أجهزة مرخصة: ${initialProg.installationsCount} محطة (البداية: ${initialProg.startDate})${initialProg.endDate ? ` (النهاية: ${initialProg.endDate})` : ''}.`,
        isQueued ? 'local' : 'online-crm',
        {
          clientName: newClient.fullName,
          activityId: `act_prog_${nextId}_${initialProg.id}`,
          programId: initialProg.id,
          programName: initialProg.programName,
          platform: initialProg.platform,
          type: initialProg.type,
          version: initialProg.version,
          installationsCount: initialProg.installationsCount,
          startDate: initialProg.startDate,
          endDate: initialProg.endDate
        }
      ).catch(err => console.error(err));
    }

    if (isQueued) {
      showToast(t('تم حفظ العميل محلياً وسيُزامن تلقائياً عند عودة الاتصال.'), 'warning');
    } else {
      showToast(t('تم إضافة العميل بنجاح'));
    }
  }
  
  const targetId = clientEditId !== null ? clientEditId : (createdClientId || S.selId);
  if (targetId) {
    S.selId = targetId;
    S.view = 'detail';
    S.tab = 'overview';
  }
  closeModal();
  R();
}

// 4. Client Deletion (Real-Time Auto-Sync Transactional)

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

  const prevClients = clients.map(cl => ({ ...cl }));
  const prevStats = { ...(S.stats || {}) };

  const stats = { ...(S.stats || {}) };
  stats.totalClients = Math.max(0, (stats.totalClients || 0) - 1);
  if (isConfirmedClientStatus(c.status)) {
    stats.activeClients = Math.max(0, (stats.activeClients || 0) - 1);
    stats.confirmedClients = Math.max(0, (stats.confirmedClients || 0) - 1);
  } else if (isUnconfirmedClientStatus(c.status)) {
    stats.stoppedClients = Math.max(0, (stats.stoppedClients || 0) - 1);
    stats.unconfirmedClients = Math.max(0, (stats.unconfirmedClients || 0) - 1);
  }
  stats.prospectiveClients = 0;

  stats.totalPrograms = Math.max(0, (stats.totalPrograms || 0) - (c.programsCount || (c.programs || []).length));
  stats.totalLicensedDevices = Math.max(0, (stats.totalLicensedDevices || 0) - (c.installationsCount || (c.programs || []).reduce((acc, p) => acc + (Number(p.installationsCount) || 1), 0)));
  stats.totalOpenIssues = Math.max(0, (stats.totalOpenIssues || 0) - (c.openIssuesCount || (c.issues || []).filter(i => i.status === 'مفتوح' || i.status === 'قيد المعالجة').length));

  // Optimistic Local Update
  setClients(clients.filter(x => x.id !== id));
  S.stats = stats;
  R();
  
  let ack = null;
  try {
    ack = await commitOnlineMutation('DELETE_CLIENT', {
      clientId: String(id),
      clientData: {
        ...c,
        programsCount: c.programsCount || (c.programs || []).length,
        installationsCount: c.installationsCount || (c.programs || []).reduce((acc, p) => acc + (Number(p.installationsCount) || 1), 0),
        openIssuesCount: c.openIssuesCount || (c.issues || []).filter(i => i.status === 'مفتوح' || i.status === 'قيد المعالجة').length
      },
      stats
    });
  } catch (err) {
    if (err?.code !== 'VERSION_CONFLICT') {
      setClients(prevClients);
      S.stats = prevStats;
      R();
      showToast(t('فشل حذف العميل من السحابة: ') + (err?.message || ''), 'error');
    }
    return;
  }

  const isQueued = Boolean(ack?.queued);
  logActivity(id, ActivityType.CLIENT_DELETED, "حذف العميل نهائياً", `تم حذف العميل "${c.fullName}" وجميع بياناته المرتبطة من قاعدة البيانات.`, isQueued ? 'local' : 'online-crm', { clientName: c.fullName })
    .catch(err => console.error(err));

  if (isQueued) {
    showToast(t('تم تسجيل الحذف محلياً وسيُزامن تلقائياً عند عودة الاتصال.'), 'warning');
  } else {
    showToast(t('تم حذف العميل نهائياً من السحابة.'), 'success');
  }

  S.view = 'list'; S.selId = null;
  R();
}

// 7. Geo Location API Operation

export async function captureGPS() {
  if (!navigator.geolocation) { showToast(t('المتصفح لا يدعم تحديد الموقع الجغرافي'), 'error'); return; }
  navigator.geolocation.getCurrentPosition(
    async pos => {
      const c = gc(); if (!c) return;
      const lat = Number(pos.coords.latitude.toFixed(6));
      const lng = Number(pos.coords.longitude.toFixed(6));
      const newGps = { lat, lng };
      const prevClients = clients.map(cl => ({ ...cl }));

      // Optimistic Local Update
      const updatedClient = { ...c, gps: newGps, _dirtyLocal: true };
      setClients(clients.map(x => (x && x.id === c.id ? updatedClient : x)));
      R();

      let ack = null;
      try {
        ack = await commitOnlineMutation('UPDATE_CLIENT', {
          clientId: String(c.id),
          clientData: updatedClient,
          oldStatus: c.status,
          stats: S.stats,
          baseVersion: Number(c.version || 0)
        });
      } catch (err) {
        if (err?.code !== 'VERSION_CONFLICT') {
          setClients(prevClients);
          R();
          showToast(t('فشل حفظ الموقع الجغرافي: ') + (err?.message || ''), 'error');
        }
        return;
      }

      const isQueued = Boolean(ack?.queued);
      logActivity(c.id, ActivityType.GPS_CAPTURED, "تحديد الموقع الجغرافي", `تم التقاط إحداثيات GPS للعميل بنجاح (${lat}, ${lng}).`, isQueued ? 'local' : 'online-crm', { clientName: c.fullName })
        .catch(err => console.error(err));

      if (isQueued) {
        showToast(t('تم حفظ الإحداثيات محلياً وستُزامن عند عودة الاتصال.'), 'warning');
      } else {
        showToast(t('تم حفظ الموقع الجغرافي وتأكيده في السحابة.'), 'success');
      }
      R();
    },
    err => { showToast(t('تعذر تحديد الموقع: ') + err.message + '\n' + t('تأكد من منح الإذن للمتصفح'), 'error'); }
  );
}

export async function toggleClientConfirmationStatus(clientId) {
  if (!hasPermission('clients.edit') && !hasPermission('canEditClients')) {
    showToast('⚠️ لا تملك صلاحية تعديل حالة العملاء.', 'error');
    return;
  }
  const target = clients.find(c => String(c?.id) === String(clientId));
  if (!target) return;

  const currentConfirmed = isConfirmedClientStatus(target.status);
  const nextStatus = currentConfirmed ? 'غير مؤكد' : 'مؤكد';
  const prevClients = clients.map(cl => ({ ...cl }));
  const prevStats = { ...(S.stats || {}) };

  const updatedClient = {
    ...target,
    status: nextStatus,
    startDate: (!currentConfirmed && !target.startDate) ? td() : (target.startDate || ''),
    _dirtyLocal: true
  };

  const nextClients = clients.map(c => (String(c?.id) === String(target.id) ? updatedClient : c));
  const { stats } = computeStats(nextClients);

  setClients(nextClients);
  S.stats = stats;
  R();

  let ack = null;
  try {
    ack = await commitOnlineMutation('UPDATE_CLIENT', {
      clientId: String(target.id),
      clientData: updatedClient,
      oldStatus: target.status,
      stats,
      baseVersion: Number(target.version || 0)
    });
  } catch (err) {
    if (err?.code !== 'VERSION_CONFLICT') {
      setClients(prevClients);
      S.stats = prevStats;
      R();
      showToast(t('فشل تحديث حالة العميل في السحابة: ') + (err?.message || ''), 'error');
    }
    return;
  }

  const isQueued = Boolean(ack?.queued);
  logActivity(
    target.id,
    ActivityType.CLIENT_EDITED,
    `تحديث حالة العميل (${nextStatus})`,
    `تم تغيير وضعية العميل "${target.fullName}" إلى "${nextStatus}".`,
    isQueued ? 'local' : 'online-crm',
    { clientName: target.fullName, prevStatus: target.status, nextStatus }
  ).catch(console.error);

  showToast(
    nextStatus === 'مؤكد'
      ? t('تم تأكيد العميل وحفظ الحالة في السحابة.')
      : t('تم تحويل العميل إلى غير مؤكد وحفظ الحالة في السحابة.'),
    isQueued ? 'warning' : 'success'
  );
  R();
}

export function setCleanupMode(mode) {
  S.cleanupMode = mode === 'strict' ? 'strict' : 'balanced';
  R();
}

export async function applyClientStatusCleanup() {
  if (!hasPermission('clients.edit') && !hasPermission('canEditClients')) {
    showToast('⚠️ لا تملك صلاحية تعديل حالة العملاء.', 'error');
    return;
  }
  if (S.cleanupIsExecuting) return;

  const mode = S.cleanupMode === 'strict' ? 'strict' : 'balanced';
  const plan = buildClientClassificationPlan(clients, mode);
  if (plan.changesCount === 0) {
    showToast(t('جميع العملاء مصنفون مسبقاً وفق هذه القاعدة ولا توجد تغييرات مطلوبة.'), 'info');
    closeModal();
    return;
  }

  const uid = (auth && auth.currentUser && auth.currentUser.uid) || (currentUser && currentUser.tenantId) || currentUser?.uid || getActiveTenantId();
  if (!uid) {
    showToast(t('يجب تسجيل الدخول لتنفيذ التصنيف السحابي.'), 'error');
    return;
  }
  if (!S.isOnline || (typeof navigator !== 'undefined' && navigator.onLine === false)) {
    showToast(t('النظام يعمل حصرياً أونلاين: لا يمكن تنفيذ التصفية بدون اتصال بالإنترنت.'), 'error');
    return;
  }

  S.cleanupIsExecuting = true;
  R();

  const prevClients = clients.map(cl => ({ ...cl }));
  const prevStats = { ...(S.stats || {}) };

  try {
    setSyncing(true);
    await createSnapshotBackup(uid, 'نسخة تلقائية قبل تصفية وتصنيف الزبائن', clients, S.stats, S.nid);

    const changeById = new Map(plan.changes.map(ch => [String(ch.client.id), ch.nextStatus]));
    const nextClients = clients.map(c => {
      if (!c) return c;
      const nextSt = changeById.get(String(c.id));
      if (!nextSt) return c;
      return {
        ...c,
        status: nextSt,
        version: Math.max(1, (Number(c.version) || 0) + 1)
      };
    });

    const { stats: nextStats } = computeStats(nextClients);
    const updates = plan.changes.map(ch => ({
      clientId: ch.client.id,
      status: ch.nextStatus,
      baseVersion: Number(ch.client.version || 0),
      nextVersion: Math.max(1, (Number(ch.client.version) || 0) + 1)
    }));

    await batchClassifyClientsStatus(uid, updates, nextStats);

    setClients(nextClients);
    S.stats = nextStats;
    setLastSyncedTime(new Date());

    logActivity(
      null,
      ActivityType.CLIENTS_STATUS_CLASSIFIED,
      'تصفية وتصنيف الزبائن',
      `تم تصنيف ${plan.changesCount} عميل (${plan.confirmedCount} مؤكد · ${plan.unconfirmedCount} غير مؤكد) وفق النمط ${mode === 'strict' ? 'الصارم' : 'المتوازن'}.`,
      'online-crm',
      { mode, changedCount: plan.changesCount, confirmedCount: plan.confirmedCount, unconfirmedCount: plan.unconfirmedCount }
    ).catch(console.error);

    showToast(`${t('تم تصنيف وتحديث')} ${plan.changesCount} ${t('عميل بنجاح')} (${plan.confirmedCount} ${t('مؤكد')} · ${plan.unconfirmedCount} ${t('غير مؤكد')})`, 'success');
    S.cleanupIsExecuting = false;
    closeModal();
  } catch (err) {
    setClients(prevClients);
    S.stats = prevStats;
    S.cleanupIsExecuting = false;
    showToast(t('فشلت عملية تصنيف العملاء: ') + (err?.message || ''), 'error');
    R();
  } finally {
    setSyncing(false);
  }
}


