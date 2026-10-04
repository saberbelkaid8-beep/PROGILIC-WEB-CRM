import { S, updateState, currentUser } from '../../state/store.js';
import { R } from '../../presentation/render-core.js';
import { simulatePurge, executePurge, getPurgeAuditLogs } from '../purgeService.js';
import { showToast } from '../../utils/toast.js';
import { t } from '../../utils/i18n.js';

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
    olderThanDays: S.purgeOlderThanDays || 30
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
    autoBackup: S.purgeAutoBackup !== false,
    downloadBackup: S.purgeDownloadBackup !== false,
    operatorNote: S.purgeOperatorNote || (S.lang === 'fr' ? 'Purge périodique' : (S.lang === 'en' ? 'Periodic purge' : 'تصفية دورية لقاعدة البيانات'))
  };

  try {
    updateState({ purgeIsExecuting: true });
    
    await executePurge(config, (progress) => {
      updateState({ purgeProgress: progress });
    });

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
