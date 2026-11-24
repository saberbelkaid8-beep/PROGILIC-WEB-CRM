/**
 * Pure domain helpers for Automatic Software Version Synchronization.
 * Groups a client's registered program records/devices by program identity
 * (e.g. Mobile · VDD, Desktop · Commercial) and computes atomic, explicit-version
 * updates + audit history without touching other programs or other clients.
 */

import { normalizeProgramCategory } from './programMetrics.js';

export function buildProgramGroupKey(program) {
  const norm = normalizeProgramCategory(program);
  if (norm.platform === 'Mobile') {
    return `Mobile:${norm.subAppKey || 'general'}`;
  }
  if (norm.platform === 'Web') {
    return 'Web:Web';
  }
  if (norm.categoryKey === 'Other') {
    const typeSeed = String(program?.type || program?.programName || 'other')
      .trim()
      .toLowerCase();
    return `${norm.platform}:Other:${typeSeed}`;
  }
  return `${norm.platform}:${norm.categoryKey}`;
}

export function getProgramGroupLabel(program) {
  const norm = normalizeProgramCategory(program);
  if (norm.platform === 'Mobile') {
    if (norm.subAppKey === 'vdd') return 'تطبيق VDD (Vendeur Distributeur)';
    if (norm.subAppKey === 'dashboard') return 'تطبيق لوحة القيادة (Tableau de bord)';
    if (norm.subAppKey === 'commercant') return 'تطبيق التاجر (Commerçant)';
    return 'تطبيق Mobile';
  }
  if (norm.platform === 'Web') {
    return 'تطبيق الويب (Web)';
  }
  if (norm.categoryKey === 'Commercial') return 'تجاري (Commercial)';
  if (norm.categoryKey === 'Production') return 'إنتاجي (Production)';
  if (norm.categoryKey === 'Distribution') return 'توزيع (Distribution)';
  return program?.type || norm.labelAr || program?.programName || 'برنامج';
}

export function formatProgramNameWithVersion(program, targetVersion) {
  const ver = String(targetVersion || '').trim();
  const norm = normalizeProgramCategory(program);
  const platform = norm.platform;

  let baseType = '';
  if (platform === 'Mobile') {
    if (norm.subAppKey === 'vdd') baseType = 'تطبيق VDD';
    else if (norm.subAppKey === 'dashboard') baseType = 'تطبيق لوحة القيادة';
    else if (norm.subAppKey === 'commercant') baseType = 'تطبيق التاجر';
    else baseType = String(program?.type || 'تطبيق').split(' (')[0].trim() || 'تطبيق';
  } else if (platform === 'Web') {
    baseType = 'الويب';
  } else if (norm.categoryKey === 'Commercial') {
    baseType = 'تجاري';
  } else if (norm.categoryKey === 'Production') {
    baseType = 'إنتاجي';
  } else if (norm.categoryKey === 'Distribution') {
    baseType = 'توزيع';
  } else {
    baseType = String(program?.type || 'برنامج').split(' (')[0].trim() || 'برنامج';
  }

  return `${platform} - ${baseType}${ver ? ` ${ver}` : ''}`.trim();
}

export function getClientProgramGroups(programs = []) {
  const list = Array.isArray(programs) ? programs.filter(Boolean) : [];
  const groupsMap = new Map();

  for (const p of list) {
    const key = buildProgramGroupKey(p);
    const norm = normalizeProgramCategory(p);
    const devices = Math.max(1, Number(p.installationsCount) || 1);
    const ver = String(p.version || norm.version || '').trim();

    if (!groupsMap.has(key)) {
      groupsMap.set(key, {
        key,
        platform: norm.platform,
        label: getProgramGroupLabel(p),
        devicesCount: 0,
        entriesCount: 0,
        currentVersions: [],
        programIds: [],
        programs: []
      });
    }

    const group = groupsMap.get(key);
    group.devicesCount += devices;
    group.entriesCount += 1;
    group.programIds.push(p.id);
    group.programs.push(p);
    if (ver && !group.currentVersions.includes(ver)) {
      group.currentVersions.push(ver);
    }
  }

  return Array.from(groupsMap.values());
}

export function applyVersionToProgramRecord(program, targetVersion, updateDate = null) {
  const explicitVersion = String(targetVersion || '').trim();
  if (!explicitVersion) {
    throw new Error('يجب تحديد الإصدار الجديد صراحةً');
  }
  const prevNorm = normalizeProgramCategory(program);
  const prevVer = String(program.version || prevNorm.version || '').trim() || 'غير محدد';
  const resolvedDate = String(updateDate || new Date().toISOString().split('T')[0]).trim();
  return {
    ...program,
    version: explicitVersion,
    programName: formatProgramNameWithVersion(program, explicitVersion),
    versionNum: Math.max(1, Number(program?.versionNum) || 1) + 1,
    previousVersion: prevVer,
    lastVersionUpdate: resolvedDate
  };
}

export function buildVersionSyncPlan({
  client,
  programKey,
  targetVersion,
  updateDate,
  employeeName = 'المسؤول العام',
  employeeId = 'gerant',
  note = ''
}) {
  if (!client || typeof client !== 'object') {
    throw new Error('لم يتم العثور على سجل العميل');
  }

  const rawKey = String(programKey || '').trim();
  if (!rawKey) {
    throw new Error('يرجى اختيار البرنامج المراد تحديث إصداره');
  }
  const normalizedKey = rawKey.replace('|', ':');

  const explicitVersion = String(targetVersion || '').trim();
  if (!explicitVersion) {
    throw new Error('يرجى اختيار الإصدار الجديد صراحةً قبل التأكيد');
  }

  const existingPrograms = Array.isArray(client.programs) ? client.programs.filter(Boolean) : [];
  const matchingPrograms = existingPrograms.filter(p => {
    const pk = buildProgramGroupKey(p);
    return pk === rawKey || pk === normalizedKey;
  });

  if (matchingPrograms.length === 0) {
    throw new Error('لا توجد أجهزة أو تراخيص مسجلة لهذا البرنامج لدى العميل');
  }

  const key = buildProgramGroupKey(matchingPrograms[0]);
  const resolvedDate = String(updateDate || new Date().toISOString().split('T')[0]).trim();
  const updatedPrograms = [];
  const previousVersionsSet = new Set();
  const nextPrograms = existingPrograms.map(prog => {
    const pk = buildProgramGroupKey(prog);
    if (pk !== key && pk !== rawKey && pk !== normalizedKey) {
      return { ...prog };
    }
    const prevNorm = normalizeProgramCategory(prog);
    const prevVer = String(prog.version || prevNorm.version || '').trim() || 'غير محدد';
    previousVersionsSet.add(prevVer);

    const updated = applyVersionToProgramRecord(prog, explicitVersion, resolvedDate);
    updatedPrograms.push(updated);
    return updated;
  });

  const previousVersions = Array.from(previousVersionsSet);
  const previousVersion = previousVersions.join(' / ');
  const affectedDevices = updatedPrograms.reduce(
    (sum, p) => sum + Math.max(1, Number(p.installationsCount) || 1),
    0
  );
  const programLabel = getProgramGroupLabel(matchingPrograms[0]);
  const nowIso = new Date().toISOString();

  const versionHistoryEntry = {
    id: `vh_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    programKey: key,
    programLabel,
    platform: normalizeProgramCategory(matchingPrograms[0]).platform,
    previousVersion,
    previousVersions,
    newVersion: explicitVersion,
    updateDate: resolvedDate,
    updatedAt: nowIso,
    employeeName: String(employeeName || 'المسؤول العام').trim(),
    employeeId: String(employeeId || 'gerant').trim(),
    affectedDevices,
    affectedProgramsCount: updatedPrograms.length,
    programIds: updatedPrograms.map(p => p.id),
    note: String(note || '').trim().substring(0, 500)
  };

  const versionUpdateEntry = {
    id: `vu_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    fromVersion: previousVersion,
    toVersion: explicitVersion,
    programKey: key,
    programLabel,
    affectedDevicesCount: affectedDevices,
    affectedProgramsCount: updatedPrograms.length,
    date: resolvedDate,
    employeeName: String(employeeName || 'المسؤول العام').trim(),
    note: String(note || '').trim().substring(0, 500)
  };

  const programNames = nextPrograms.map(p => p.programName).filter(Boolean);
  const programsCount = nextPrograms.length;
  const installationsCount = nextPrograms.reduce(
    (sum, p) => sum + Math.max(1, Number(p.installationsCount) || 1),
    0
  );

  return {
    programKey: key,
    programLabel,
    previousVersion,
    previousVersions,
    newVersion: explicitVersion,
    affectedDevices,
    affectedProgramsCount: updatedPrograms.length,
    updatedPrograms,
    nextPrograms,
    versionHistoryEntry,
    versionUpdateEntry,
    counterUpdates: {
      programs: nextPrograms,
      programNames,
      programsCount,
      installationsCount
    }
  };
}
