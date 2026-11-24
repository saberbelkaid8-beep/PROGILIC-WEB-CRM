import { normalizeProgramCategory } from './programMetrics.js';

export function buildProgramFamilyKey(prog) {
  const norm = normalizeProgramCategory(prog);
  if (norm.categoryKey === 'Mobile') {
    return `Mobile|${norm.subAppKey || 'general'}`;
  }
  if (norm.categoryKey === 'Other') {
    const cleanBase = String(prog?.programName || prog?.type || 'other')
      .replace(/\bV\d+\b/gi, '')
      .trim()
      .toLowerCase();
    return `${norm.platform}|Other|${cleanBase}`;
  }
  return `${norm.platform}|${norm.categoryKey}`;
}

export function formatProgramFamilyLabel(prog) {
  const norm = normalizeProgramCategory(prog);
  if (norm.categoryKey === 'Mobile') return norm.labelAr || 'Mobile';
  if (norm.categoryKey === 'Web') return 'Web';
  if (norm.categoryKey === 'Other') {
    return `${norm.platform} · ${norm.labelAr || prog?.type || 'أخرى'}`;
  }
  return `${norm.platform} · ${norm.categoryKey}`;
}

export function replaceVersionInProgramName(programName, newVersion, platform = 'Desktop') {
  const raw = String(programName || '').trim();
  const cleanVer = String(newVersion || '').trim();
  if (!cleanVer || platform === 'Mobile') {
    return raw || 'PROGILIC';
  }
  if (!raw) return `PROGILIC ${cleanVer}`;

  const versionTokenRegex = /\b(?:V\d{1,3}|v\d{1,3}|R\+|arabe)\b/gi;
  if (versionTokenRegex.test(raw)) {
    return raw.replace(versionTokenRegex, cleanVer).replace(/\s+/g, ' ').trim();
  }
  return `${raw} ${cleanVer}`.trim();
}

export function extractProgramFamilyOptions(programs = []) {
  const list = Array.isArray(programs) ? programs.filter(Boolean) : [];
  const groups = new Map();

  for (const p of list) {
    const familyKey = buildProgramFamilyKey(p);
    const norm = normalizeProgramCategory(p);
    const devices = Math.max(1, Number(p.installationsCount) || 1);
    const currentVer = p.version || norm.version || '';

    if (!groups.has(familyKey)) {
      groups.set(familyKey, {
        familyKey,
        platform: norm.platform,
        categoryKey: norm.categoryKey,
        label: formatProgramFamilyLabel(p),
        recordsCount: 0,
        totalDevices: 0,
        versions: new Set(),
        records: []
      });
    }
    const g = groups.get(familyKey);
    g.recordsCount += 1;
    g.totalDevices += devices;
    if (currentVer) g.versions.add(currentVer);
    g.records.push(p);
  }

  return Array.from(groups.values()).map(g => ({
    ...g,
    versions: Array.from(g.versions)
  }));
}

/**
 * Synchronizes all device/license records belonging to a specific program family
 * on a client to the exact employee-selected targetVersion, leaving all other
 * client programs completely untouched.
 */
export function syncClientProgramVersion(programs = [], options = {}) {
  const {
    targetFamilyKey = '',
    targetVersion = '',
    syncDate = new Date().toISOString().split('T')[0],
    staffName = '',
    note = ''
  } = options || {};

  const cleanVersion = String(targetVersion || '').trim();
  if (!targetFamilyKey) {
    throw new Error('يرجى اختيار البرنامج المراد تحديثه.');
  }
  if (!cleanVersion) {
    throw new Error('يرجى تحديد الإصدار المستهدف للمزامنة.');
  }

  const list = Array.isArray(programs) ? programs.map(p => ({ ...p })) : [];
  const updatedPrograms = [];
  const nextPrograms = [];
  const previousVersionsSet = new Set();
  let affectedDevices = 0;

  for (const prog of list) {
    if (!prog) continue;
    const fk = buildProgramFamilyKey(prog);
    if (fk !== targetFamilyKey) {
      nextPrograms.push(prog);
      continue;
    }

    const norm = normalizeProgramCategory(prog);
    if (norm.platform === 'Mobile') {
      nextPrograms.push(prog);
      continue;
    }

    const prevVer = String(prog.version || norm.version || '').trim() || 'غير محدد';
    previousVersionsSet.add(prevVer);
    const devices = Math.max(1, Number(prog.installationsCount) || 1);
    affectedDevices += devices;

    const history = Array.isArray(prog.versionHistory) ? [...prog.versionHistory] : [];
    history.unshift({
      fromVersion: prevVer,
      toVersion: cleanVersion,
      date: syncDate,
      staffName: String(staffName || '').slice(0, 100),
      affectedDevices: devices,
      note: String(note || '').slice(0, 200)
    });

    const syncedRecord = {
      ...prog,
      version: cleanVersion,
      programName: replaceVersionInProgramName(prog.programName, cleanVersion, norm.platform),
      lastVersionSyncAt: new Date().toISOString(),
      versionHistory: history.slice(0, 20)
    };
    updatedPrograms.push(syncedRecord);
    nextPrograms.push(syncedRecord);
  }

  if (updatedPrograms.length === 0) {
    throw new Error('لم يتم العثور على سجلات أجهزة مطابقة لهذا البرنامج أو أن المنصة لا تستخدم أرقام إصدارات.');
  }

  const programNames = nextPrograms.map(p => p?.programName).filter(Boolean);
  const totalInstalls = nextPrograms.reduce((s, p) => s + Math.max(1, Number(p?.installationsCount) || 1), 0);

  return {
    nextPrograms,
    updatedPrograms,
    affectedRecords: updatedPrograms.length,
    affectedDevices,
    previousVersions: Array.from(previousVersionsSet),
    targetVersion: cleanVersion,
    counterUpdates: {
      programs: nextPrograms,
      programsCount: nextPrograms.length,
      installationsCount: totalInstalls,
      programNames
    }
  };
}
