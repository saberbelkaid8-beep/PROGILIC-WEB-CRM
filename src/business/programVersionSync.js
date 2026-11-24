import { PROGRAM_VERSIONS } from '../constants/index.js';
import { normalizeProgramCategory, getClientCategoryBreakdown } from './programMetrics.js';

const VERSION_TOKEN_REGEX = /(?:^|[\s\-·_])(V\d+|v\d+|R\+|arabe)(?=$|[\s\-·_])/gi;

export function getBaseProgramKey(progOrName) {
  const isObj = progOrName && typeof progOrName === 'object';
  const rawName = isObj ? (progOrName.programName || '') : String(progOrName || '');
  const norm = normalizeProgramCategory(progOrName);

  if (norm.platform === 'Mobile' || norm.categoryKey === 'Mobile') {
    return `Mobile|${norm.subAppKey || 'general'}`;
  }

  if (norm.categoryKey === 'Other') {
    const cleanBase = rawName
      .replace(VERSION_TOKEN_REGEX, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
    return `${norm.platform}|Other:${cleanBase || String(progOrName?.type || 'other').trim().toLowerCase()}`;
  }

  return `${norm.platform}|${norm.categoryKey}`;
}

export function getBaseProgramLabel(progOrName) {
  const norm = normalizeProgramCategory(progOrName);
  if (norm.platform === 'Mobile') return norm.labelAr || 'Mobile';
  if (norm.categoryKey === 'Web') return 'Web';
  if (norm.categoryKey === 'Other') {
    const rawName = (progOrName && typeof progOrName === 'object' ? progOrName.programName : String(progOrName || ''))
      .replace(VERSION_TOKEN_REGEX, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return rawName || `${norm.platform} · ${norm.labelAr}`;
  }
  return `${norm.platform} · ${norm.labelAr}`;
}

export function buildProgramNameWithVersion(platform, type, version, fallbackName = '') {
  const cleanPlatform = String(platform || 'Desktop').trim() || 'Desktop';
  const cleanVersion = cleanPlatform === 'Mobile' ? '' : String(version || '').trim();
  const cleanType = String(type || '').trim();
  const typeDisplay = cleanType
    ? cleanType.split(' (')[0].trim()
    : (cleanPlatform === 'Web' ? 'الويب' : '');

  if (cleanPlatform === 'Mobile') {
    return `${cleanPlatform} - ${typeDisplay}`.trim();
  }
  if (!typeDisplay && fallbackName) {
    const baseFallback = String(fallbackName).replace(VERSION_TOKEN_REGEX, ' ').replace(/\s+/g, ' ').trim();
    return cleanVersion ? `${baseFallback} ${cleanVersion}`.trim() : baseFallback;
  }
  return cleanVersion
    ? `${cleanPlatform} - ${typeDisplay} ${cleanVersion}`.trim()
    : `${cleanPlatform} - ${typeDisplay}`.trim();
}

export function getClientVersionSyncGroups(client) {
  const progs = Array.isArray(client?.programs) ? client.programs.filter(Boolean) : [];
  const groupsMap = new Map();

  for (const prog of progs) {
    const norm = normalizeProgramCategory(prog);
    if (norm.platform === 'Mobile') continue;

    const baseKey = getBaseProgramKey(prog);
    if (!groupsMap.has(baseKey)) {
      groupsMap.set(baseKey, {
        baseKey,
        platform: norm.platform,
        categoryKey: norm.categoryKey,
        label: getBaseProgramLabel(prog),
        type: prog.type || norm.labelAr,
        records: [],
        recordsCount: 0,
        totalDevices: 0,
        versionsSet: new Set(),
        latestStartDate: ''
      });
    }

    const group = groupsMap.get(baseKey);
    const devices = Math.max(1, Number(prog.installationsCount) || 1);
    group.records.push(prog);
    group.recordsCount += 1;
    group.totalDevices += devices;
    if (norm.version) {
      group.versionsSet.add(prog.version || norm.version);
    } else if (prog.version) {
      group.versionsSet.add(String(prog.version).trim());
    }
    if (prog.startDate && (!group.latestStartDate || String(prog.startDate) > group.latestStartDate)) {
      group.latestStartDate = String(prog.startDate);
    }
  }

  return Array.from(groupsMap.values()).map(g => ({
    baseKey: g.baseKey,
    platform: g.platform,
    categoryKey: g.categoryKey,
    label: g.label,
    type: g.type,
    records: g.records,
    recordsCount: g.recordsCount,
    totalDevices: g.totalDevices,
    currentVersions: g.versionsSet.size > 0 ? Array.from(g.versionsSet) : ['غير محدد'],
    latestStartDate: g.latestStartDate
  }));
}

export function syncClientProgramVersion({
  programs,
  baseKey,
  targetVersion,
  date = '',
  notes = '',
  actorName = 'المسؤول العام',
  actorEmail = '',
  now = new Date()
}) {
  const cleanTargetVersion = String(targetVersion || '').trim();
  if (!cleanTargetVersion) {
    return {
      ok: false,
      error: 'MISSING_TARGET_VERSION',
      message: 'الرجاء اختيار الإصدار الذي تم تحديث العميل إليه.'
    };
  }

  const cleanBaseKey = String(baseKey || '').trim();
  if (!cleanBaseKey) {
    return {
      ok: false,
      error: 'MISSING_BASE_KEY',
      message: 'الرجاء اختيار البرنامج المستهدف للتحديث.'
    };
  }

  const sourceList = Array.isArray(programs) ? programs.filter(Boolean) : [];
  const updateDate = String(date || '').trim() || now.toISOString().slice(0, 10);
  const updateTimestamp = now.toISOString();
  const cleanNotes = String(notes || '').trim();

  const updatedRecords = [];
  const fromVersionsSet = new Set();
  let affectedDevicesCount = 0;
  let programLabel = '';
  let programPlatform = '';
  let programType = '';

  const nextPrograms = sourceList.map(orig => {
    const p = { ...orig };
    const norm = normalizeProgramCategory(p);
    if (norm.platform === 'Mobile') {
      return p;
    }

    if (getBaseProgramKey(p) !== cleanBaseKey) {
      return p;
    }

    const prevVer = String(p.version || norm.version || '').trim();
    if (prevVer) fromVersionsSet.add(prevVer);

    const nextPlatform = p.platform === 'Hybrid' ? 'Hybrid' : norm.platform;
    const nextType = p.type || norm.labelAr;
    const nextProgramName = buildProgramNameWithVersion(
      nextPlatform,
      nextType,
      cleanTargetVersion,
      p.programName
    );
    const inst = Math.max(1, Number(p.installationsCount) || 1);

    const updatedProg = {
      ...p,
      platform: nextPlatform,
      type: nextType,
      version: cleanTargetVersion,
      programName: nextProgramName,
      previousVersion: prevVer,
      lastVersionUpdate: updateDate,
      versionNum: Math.max(1, Number(p.versionNum) || 1) + 1
    };

    updatedRecords.push(updatedProg);
    affectedDevicesCount += inst;
    if (!programLabel) programLabel = getBaseProgramLabel(updatedProg);
    if (!programPlatform) programPlatform = nextPlatform;
    if (!programType) programType = nextType;

    return updatedProg;
  });

  if (updatedRecords.length === 0) {
    return {
      ok: false,
      error: 'NO_MATCHING_PROGRAM',
      message: 'لم يتم العثور على سجلات مطابقة لهذا البرنامج لدى العميل.'
    };
  }

  const fromVersions = Array.from(fromVersionsSet);
  const totalDevices = nextPrograms.reduce((sum, p) => sum + Math.max(1, Number(p?.installationsCount) || 1), 0);
  const programNames = nextPrograms.map(p => p.programName).filter(Boolean);

  const updateLog = {
    id: `vupd_${now.getTime()}_${Math.random().toString(36).slice(2, 7)}`,
    baseKey: cleanBaseKey,
    programLabel,
    platform: programPlatform,
    type: programType,
    fromVersions,
    toVersion: cleanTargetVersion,
    affectedRecordsCount: updatedRecords.length,
    affectedDevicesCount,
    date: updateDate,
    notes: cleanNotes,
    updatedBy: String(actorName || 'المسؤول العام').slice(0, 100),
    actorEmail: String(actorEmail || '').slice(0, 120),
    timestamp: updateTimestamp
  };

  return {
    ok: true,
    nextPrograms,
    updatedRecords,
    affectedRecordsCount: updatedRecords.length,
    affectedDevicesCount,
    fromVersions,
    toVersion: cleanTargetVersion,
    programNames,
    totalDevices,
    updateLog
  };
}

export function computeProgramVersionMetrics(clientsList) {
  const cl = Array.isArray(clientsList) ? clientsList.filter(Boolean) : [];
  const versionMap = new Map();
  let totalVersionedPrograms = 0;
  let totalVersionedDevices = 0;

  const ensureEntry = (version) => {
    if (!versionMap.has(version)) {
      versionMap.set(version, {
        version,
        programsCount: 0,
        devicesCount: 0,
        clientIds: new Set()
      });
    }
    return versionMap.get(version);
  };

  cl.forEach(c => {
    const progs = Array.isArray(c.programs) ? c.programs : [];
    const items = progs.length > 0
      ? progs.map(p => {
          const norm = normalizeProgramCategory(p);
          return {
            platform: norm.platform,
            version: norm.platform === 'Mobile' ? '' : (String(p.version || norm.version || '').trim()),
            devices: Math.max(1, Number(p.installationsCount) || 1)
          };
        })
      : getClientCategoryBreakdown(c).items.map(item => ({
          platform: item.platform,
          version: item.platform === 'Mobile' ? '' : String(item.version || '').trim(),
          devices: Math.max(1, Number(item.devices) || 1)
        }));

    items.forEach(item => {
      if (item.platform === 'Mobile') return;
      const ver = item.version || 'غير محدد';
      const entry = ensureEntry(ver);
      entry.programsCount += 1;
      entry.devicesCount += item.devices;
      entry.clientIds.add(String(c.id));
      totalVersionedPrograms += 1;
      totalVersionedDevices += item.devices;
    });
  });

  const knownOrder = new Map(PROGRAM_VERSIONS.map((v, idx) => [v.toUpperCase(), idx]));

  const byVersion = Array.from(versionMap.values())
    .map(entry => ({
      version: entry.version,
      programsCount: entry.programsCount,
      devicesCount: entry.devicesCount,
      clientsCount: entry.clientIds.size
    }))
    .sort((a, b) => {
      if (a.version === 'غير محدد') return 1;
      if (b.version === 'غير محدد') return -1;
      const ia = knownOrder.has(a.version.toUpperCase()) ? knownOrder.get(a.version.toUpperCase()) : 999;
      const ib = knownOrder.has(b.version.toUpperCase()) ? knownOrder.get(b.version.toUpperCase()) : 999;
      if (ia !== ib) return ia - ib;
      return b.devicesCount - a.devicesCount;
    });

  const map = {};
  byVersion.forEach(row => {
    map[row.version] = {
      programsCount: row.programsCount,
      devicesCount: row.devicesCount,
      clientsCount: row.clientsCount
    };
  });

  return {
    totalVersionedPrograms,
    totalVersionedDevices,
    byVersion,
    map
  };
}
