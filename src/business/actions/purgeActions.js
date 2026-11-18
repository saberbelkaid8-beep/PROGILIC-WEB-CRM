import { S, updateState } from '../../state/store.js';
import { R } from '../../presentation/render-core.js';
import { simulatePurge, executePurge, parseClientNamesFromMarkdown } from '../purgeService.js';
import { showToast } from '../../utils/toast.js';
import { t } from '../../utils/i18n.js';
import { ActivityType, logActivity } from '../timelineService.js';

export function openDbPurgeModal() {
  const defaultNote = S.lang === 'fr' 
    ? 'Purge périodique de la base de données'
    : (S.lang === 'en' 
      ? 'Periodic database cleanup'
      : 'تصفية دورية لقاعدة البيانات');

  updateState({
    modal: 'dbPurge',
    purgeTab: 'filtered', // 'filtered', 'selective', 'all', 'audit'
    purgeFilterType: 'stopped_clients',
    purgeOlderThanDays: 30,
    purgeProgramMode: 'all_with_programs', // 'all_with_programs', 'by_date', 'from_md'
    purgeTargetDate: '',
    purgeTargetDateMode: 'exact', // 'exact', 'since'
    purgeMdClientNames: [],
    purgeMdFileName: '',
    purgeAutoBackup: true,
    purgeDownloadBackup: true,
    purgeConfirmText: '',
    purgeOperatorNote: defaultNote,
    purgeProgress: null,
    purgeSimulation: null,
    purgeSelectiveCollections: {
      clients: false,
      programs: true,
      issues: true,
      requirements: false,
      contacts: false,
      cache: true
    }
  });
  // Auto-run simulation on open
  runPurgeSimulation();
}

export function setPurgeTab(tab) {
  updateState({ purgeTab: tab, purgeConfirmText: '', purgeProgress: null });
  runPurgeSimulation();
}

export function setPurgeFilterType(filterType) {
  updateState({ purgeFilterType: filterType, purgeProgress: null });
  runPurgeSimulation();
}

export function setPurgeOlderThanDays(days) {
  updateState({ purgeOlderThanDays: Number(days) || 30, purgeProgress: null });
  runPurgeSimulation();
}

export function setPurgeProgramMode(mode) {
  updateState({ purgeProgramMode: mode || 'all_with_programs', purgeProgress: null });
  runPurgeSimulation();
}

export function setPurgeTargetDate(dateStr) {
  updateState({
    purgeTargetDate: String(dateStr || '').trim(),
    purgeProgramMode: 'by_date',
    purgeProgress: null
  });
  runPurgeSimulation();
}

export function setPurgeTargetDateMode(dateMode) {
  updateState({
    purgeTargetDateMode: dateMode === 'since' ? 'since' : 'exact',
    purgeProgramMode: 'by_date',
    purgeProgress: null
  });
  runPurgeSimulation();
}

export async function handlePurgeMdFileUpload(inputEl) {
  const file = inputEl?.files?.[0];
  if (!file) return;
  try {
    const content = await file.text();
    const names = parseClientNamesFromMarkdown(content);
    if (names.length === 0) {
      showToast(t('لم يتم العثور على عناوين عملاء (## الاسم) داخل الملف المرفق.'), 'warning');
      return;
    }
    updateState({
      purgeFilterType: 'client_programs',
      purgeProgramMode: 'from_md',
      purgeMdClientNames: names,
      purgeMdFileName: file.name,
      purgeProgress: null
    });
    runPurgeSimulation();
    showToast(`تمت قراءة ${names.length} اسم عميل من الملف (${file.name}) بنجاح.`, 'success');
  } catch (err) {
    console.error('Failed to read .md file for purge:', err);
    showToast(t('تعذر قراءة ملف Markdown: ') + err.message, 'error');
  }
}

export function clearPurgeMdClients() {
  updateState({
    purgeMdClientNames: [],
    purgeMdFileName: '',
    purgeProgramMode: 'all_with_programs',
    purgeProgress: null
  });
  runPurgeSimulation();
}

export function togglePurgeSelectiveCollection(colName) {
  const current = S.purgeSelectiveCollections || {};
  updateState({
    purgeSelectiveCollections: {
      ...current,
      [colName]: !current[colName]
    },
    purgeProgress: null
  });
  runPurgeSimulation();
}

export function runPurgeSimulation() {
  const config = {
    targetScope: S.purgeTab || 'filtered',
    selectiveCollections: S.purgeSelectiveCollections || {},
    filterType: S.purgeFilterType || 'stopped_clients',
    olderThanDays: S.purgeOlderThanDays || 30,
    programTargetMode: S.purgeProgramMode || 'all_with_programs',
    targetDate: S.purgeTargetDate || '',
    targetDateMode: S.purgeTargetDateMode || 'exact',
    targetClientNames: S.purgeMdClientNames || []
  };
  const sim = simulatePurge(config);
  updateState({ purgeSimulation: sim });
}

export async function handleExecutePurge() {
  const tab = S.purgeTab || 'filtered';
  const confirmText = (S.purgeConfirmText || '').trim();

  const requiredCode = tab === 'all' ? 'DELETE-ALL-DATA' : 'CONFIRM-PURGE';

  if (confirmText !== requiredCode) {
    const errorMsg = S.lang === 'fr'
      ? `Veuillez saisir exactement le code de confirmation (${requiredCode}) pour continuer !`
      : (S.lang === 'en'
        ? `Please type the exact confirmation code (${requiredCode}) to proceed!`
        : `يرجى كتابة رمز التأكيد بالضبط (${requiredCode}) للمتابعة!`);
    showToast(errorMsg, "error");
    return;
  }

  const config = {
    targetScope: tab,
    selectiveCollections: S.purgeSelectiveCollections || {},
    filterType: S.purgeFilterType || 'stopped_clients',
    olderThanDays: S.purgeOlderThanDays || 30,
    programTargetMode: S.purgeProgramMode || 'all_with_programs',
    targetDate: S.purgeTargetDate || '',
    targetDateMode: S.purgeTargetDateMode || 'exact',
    targetClientNames: S.purgeMdClientNames || [],
    autoBackup: S.purgeAutoBackup !== false,
    downloadBackup: S.purgeDownloadBackup !== false,
    operatorNote: S.purgeOperatorNote || (S.lang === 'fr' ? 'Purge périodique' : (S.lang === 'en' ? 'Periodic purge' : 'تصفية دورية لقاعدة البيانات'))
  };

  try {
    updateState({ purgeIsExecuting: true });
    
    const result = await executePurge(config, (progress) => {
      updateState({ purgeProgress: progress });
    });

    const keptNotice = result.summary.clientsDeletedCount === 0
      ? ' (تم الإبقاء على جميع أسماء وسجلات العملاء)'
      : '';

    await logActivity(
      null,
      ActivityType.SYSTEM_PURGE,
      'تصفية بيانات النظام',
      `اكتملت عملية التصفية (${config.targetScope}) بملاحظة: ${config.operatorNote}. العملاء المتأثرون: ${result.summary.totalClientsAffected}، المشاكل: ${result.summary.issuesCount}، البرامج المحذوفة: ${result.summary.programsCount}${keptNotice}.`,
      'local',
      {
        purgeProgramsOnly: Boolean(result.purgeProgramsOnly),
        purgedBefore: result.purgedBefore || new Date().toISOString(),
        purgedClientIds: Array.isArray(result.purgedClientIds) ? result.purgedClientIds : []
      }
    ).catch(console.warn);

    updateState({
      modal: null,
      purgeIsExecuting: false,
      purgeProgress: null
    });
    
    R();
  } catch (err) {
    console.error("Execute Purge failed:", err);
    showToast(t("فشلت عملية المحو: ") + err.message, "error");
    updateState({ purgeIsExecuting: false });
  }
}
