/**
 * Pure domain helpers for Program vs Device counting, merging duplicate licenses,
 * category/platform breakdowns (Commercial / Production / Distribution / Mobile / Web),
 * follow-up coverage metrics, and strict Recent Activities sanitization.
 */

const DAY_MS = 86400000;

export function toLocalYmdStr(dateObj) {
  if (!(dateObj instanceof Date) || Number.isNaN(dateObj.getTime())) return '';
  return `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
}

export function parseDateMsStrict(val, fallbackId = null) {
  if (val) {
    const s = String(val).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      const [y, m, d] = s.split('-').map(Number);
      const dt = new Date(y, m - 1, d);
      if (!Number.isNaN(dt.getTime())) return dt.getTime();
    }
    const parsed = new Date(s).getTime();
    if (!Number.isNaN(parsed)) return parsed;
  }
  const numId = Number(fallbackId);
  if (Number.isFinite(numId) && numId >= 1577836800000 && numId <= 4102444800000) {
    return numId;
  }
  return null;
}

export function inferPlatformFromLabel(raw = '') {
  const lower = String(raw || '').toLowerCase();
  if (
    lower.startsWith('mobile') ||
    lower.includes('vdd') ||
    lower.includes('tableau de bord') ||
    lower.includes('commerçant') ||
    lower.includes('commercant') ||
    lower.includes('لوحة القيادة') ||
    lower.includes('التاجر')
  ) {
    return 'Mobile';
  }
  if (lower.startsWith('web') || lower.includes('الويب')) {
    return 'Web';
  }
  return 'Desktop';
}

/**
 * Normalizes a program object or programName string into canonical fields.
 */
export function normalizeProgramCategory(progOrName) {
  const isObj = progOrName && typeof progOrName === 'object';
  const rawPlat = isObj ? (progOrName.platform || '') : '';
  const rawType = isObj ? (progOrName.type || '') : '';
  const rawName = isObj ? (progOrName.programName || '') : String(progOrName || '');
  const combined = `${rawPlat} ${rawType} ${rawName}`.toLowerCase();

  let platform = rawPlat ? String(rawPlat).trim() : '';
  if (platform === 'Hybrid') platform = 'Desktop';
  if (!platform) platform = inferPlatformFromLabel(combined);
  if (!['Desktop', 'Mobile', 'Web'].includes(platform)) platform = 'Desktop';

  let version = isObj ? String(progOrName.version || '').trim().toUpperCase() : '';
  if (!version) {
    const vMatch = rawName.match(/\b(V\d+|R\+|ARABE)\b/i);
    if (vMatch) version = vMatch[1].toUpperCase();
  }

  let categoryKey = 'Other';
  let labelAr = 'أخرى';
  let subAppKey = '';

  if (platform === 'Web' || combined.includes('الويب') || /\bweb\b/.test(combined)) {
    platform = 'Web';
    categoryKey = 'Web';
    labelAr = 'Web';
  } else if (platform === 'Mobile') {
    categoryKey = 'Mobile';
    if (combined.includes('tableau') || combined.includes('لوحة القيادة')) {
      subAppKey = 'dashboard';
      labelAr = 'Mobile · لوحة القيادة';
    } else if (combined.includes('vdd')) {
      subAppKey = 'vdd';
      labelAr = 'Mobile · VDD';
    } else if (combined.includes('commer') || combined.includes('التاجر')) {
      subAppKey = 'commercant';
      labelAr = 'Mobile · التاجر';
    } else {
      subAppKey = 'general';
      labelAr = 'Mobile';
    }
  } else {
    // Desktop categories
    if (combined.includes('production') || combined.includes('إنتاجي') || combined.includes('انتاجي') || combined.includes('إنتاج')) {
      categoryKey = 'Production';
      labelAr = 'Production';
    } else if (combined.includes('distribution') || combined.includes('توزيع')) {
      categoryKey = 'Distribution';
      labelAr = 'Distribution';
    } else if (combined.includes('commercial') || combined.includes('تجاري') || combined.includes('progilic')) {
      categoryKey = 'Commercial';
      labelAr = 'Commercial';
    } else if (rawType) {
      categoryKey = 'Other';
      labelAr = rawType.split(' (')[0].trim() || 'Desktop';
    } else {
      categoryKey = 'Commercial';
      labelAr = 'Commercial';
    }
  }

  return {
    platform,
    categoryKey,
    labelAr,
    subAppKey,
    version,
    identityKey: categoryKey === 'Mobile'
      ? `Mobile|${subAppKey}${version ? `|${version}` : ''}`
      : (categoryKey === 'Other'
        ? `${platform}|${rawName.trim().toLowerCase()}|${version}`
        : `${platform}|${categoryKey}|${version}`)
  };
}

/**
 * Merges incoming program into an existing matching (platform + category + subApp + version)
 * entry by incrementing its installationsCount instead of creating a duplicate program row.
 */
export function mergeOrAddClientProgram(existingPrograms, incomingProgram) {
  const list = Array.isArray(existingPrograms) ? existingPrograms.map(p => ({ ...p })) : [];
  const incomingCount = Math.max(1, Number(incomingProgram?.installationsCount) || 1);
  const incNorm = normalizeProgramCategory(incomingProgram);

  const matchIdx = list.findIndex(existing => {
    if (!existing) return false;
    const exNorm = normalizeProgramCategory(existing);
    return exNorm.identityKey === incNorm.identityKey;
  });

  if (matchIdx > -1) {
    const existing = list[matchIdx];
    const prevInstalls = Math.max(1, Number(existing.installationsCount) || 1);
    const mergedInstalls = prevInstalls + incomingCount;
    const updated = {
      ...existing,
      platform: incNorm.platform,
      type: existing.type || incomingProgram.type || 'تجاري',
      version: existing.version || incNorm.version || '',
      installationsCount: mergedInstalls,
      startDate: existing.startDate || incomingProgram.startDate || '',
      endDate: ''
    };
    list[matchIdx] = updated;
    return {
      action: 'merged',
      nextPrograms: list,
      targetProgram: updated,
      addedProgramsCount: 0,
      addedDevices: incomingCount
    };
  }

  const created = {
    ...incomingProgram,
    platform: incNorm.platform,
    version: incomingProgram.version || incNorm.version || '',
    installationsCount: incomingCount,
    endDate: ''
  };
  list.push(created);
  return {
    action: 'added',
    nextPrograms: list,
    targetProgram: created,
    addedProgramsCount: 1,
    addedDevices: incomingCount
  };
}

/**
 * Increments/decrements installationsCount on a single program entry (minimum 1 device).
 */
export function adjustClientProgramDevices(existingPrograms, programId, delta) {
  const list = Array.isArray(existingPrograms) ? existingPrograms.map(p => ({ ...p })) : [];
  const idx = list.findIndex(p => String(p?.id) === String(programId));
  if (idx === -1) {
    return { nextPrograms: list, targetProgram: null, diffDevices: 0 };
  }
  const prev = Math.max(1, Number(list[idx].installationsCount) || 1);
  const next = Math.max(1, prev + Number(delta || 0));
  const diffDevices = next - prev;
  const updated = { ...list[idx], installationsCount: next };
  list[idx] = updated;
  return {
    nextPrograms: list,
    targetProgram: updated,
    diffDevices
  };
}

/**
 * Returns expanded per-program and grouped-by-category device counts for a client
 * (works seamlessly for both hydrated and unhydrated summary client records).
 */
export function getClientCategoryBreakdown(client) {
  if (!client) {
    return { totalPrograms: 0, totalDevices: 0, items: [], groupedSummary: [] };
  }

  const progs = Array.isArray(client.programs) ? client.programs : [];
  const items = [];

  if (progs.length > 0) {
    progs.forEach(p => {
      if (!p) return;
      const norm = normalizeProgramCategory(p);
      const devices = Math.max(1, Number(p.installationsCount) || 1);
      items.push({
        id: p.id,
        programName: p.programName || norm.labelAr,
        platform: norm.platform,
        categoryKey: norm.categoryKey,
        labelAr: norm.labelAr,
        subAppKey: norm.subAppKey,
        version: norm.version,
        devices
      });
    });
  } else if (!client._subcollectionsLoaded) {
    const names = Array.isArray(client.programNames) ? client.programNames.filter(Boolean) : [];
    const summaryProgCount = Math.max(Number(client.programsCount) || 0, names.length);
    if (summaryProgCount > 0) {
      const resolvedNames = names.length > 0 ? names : Array(summaryProgCount).fill('PROGILIC');
      const totalInst = Math.max(resolvedNames.length, Number(client.installationsCount) || resolvedNames.length);
      const base = Math.floor(totalInst / resolvedNames.length);
      let rem = totalInst % resolvedNames.length;
      resolvedNames.forEach((name, idx) => {
        const norm = normalizeProgramCategory(name);
        const devices = base + (rem > 0 ? 1 : 0);
        if (rem > 0) rem--;
        items.push({
          id: `summary_${client.id}_${idx}`,
          programName: name,
          platform: norm.platform,
          categoryKey: norm.categoryKey,
          labelAr: norm.labelAr,
          subAppKey: norm.subAppKey,
          version: norm.version,
          devices
        });
      });
    }
  }

  const groupMap = new Map();
  items.forEach(item => {
    const gKey = item.categoryKey === 'Other' ? item.labelAr : item.categoryKey;
    if (!groupMap.has(gKey)) {
      groupMap.set(gKey, {
        key: item.categoryKey,
        labelAr: item.categoryKey === 'Mobile' ? 'Mobile' : item.labelAr,
        platform: item.platform,
        devices: 0,
        programsCount: 0,
        versions: new Set()
      });
    }
    const g = groupMap.get(gKey);
    g.devices += item.devices;
    g.programsCount += 1;
    if (item.version) g.versions.add(item.version);
  });

  const groupedSummary = Array.from(groupMap.values()).map(g => ({
    key: g.key,
    labelAr: g.labelAr,
    platform: g.platform,
    devices: g.devices,
    programsCount: g.programsCount,
    versions: Array.from(g.versions)
  }));

  const totalPrograms = items.length;
  const totalDevices = progs.length > 0
    ? items.reduce((s, x) => s + x.devices, 0)
    : (Number(client.installationsCount) || items.reduce((s, x) => s + x.devices, 0));

  return {
    totalPrograms,
    totalDevices,
    items,
    groupedSummary
  };
}

/**
 * Computes all fleet device, category, platform, and follow-up coverage metrics for the Dashboard.
 */
export function computeFleetDeviceMetrics(clientsList, todayObj = new Date()) {
  const cl = Array.isArray(clientsList) ? clientsList.filter(Boolean) : [];
  const now = todayObj.getTime();
  const todayMidnightMs = new Date(todayObj.getFullYear(), todayObj.getMonth(), todayObj.getDate()).getTime();
  const monthWindowStartMs = todayMidnightMs - 30 * DAY_MS;

  const checkpoints30d = Array.from({ length: 8 }, (_, idx) => (
    idx === 7 ? now : monthWindowStartMs + Math.round((idx * 30 * DAY_MS) / 7)
  ));

  let totalPrograms = 0;
  let totalLicensedDevices = 0;
  const platformDevices = { Desktop: 0, Mobile: 0, Web: 0 };
  const platformPrograms = { Desktop: 0, Mobile: 0, Web: 0 };
  const categoryDevices = { Commercial: 0, Production: 0, Distribution: 0, Mobile: 0, Web: 0, Other: 0 };
  const categoryPrograms = { Commercial: 0, Production: 0, Distribution: 0, Mobile: 0, Web: 0, Other: 0 };
  const mobileSubApps = { dashboard: 0, vdd: 0, commercant: 0, general: 0 };
  const versionDevices = {};
  const versionPrograms = {};

  const deviceEntries = []; // { startMs, devices }
  let totalCalls = 0;
  let contacted30Clients = 0;
  const allContactDatesMs = [];

  cl.forEach(c => {
    const progs = Array.isArray(c.programs) ? c.programs : [];
    if (progs.length > 0) {
      totalPrograms += progs.length;
      progs.forEach(p => {
        if (!p) return;
        const inst = Math.max(1, Number(p.installationsCount) || 1);
        totalLicensedDevices += inst;
        const norm = normalizeProgramCategory(p);

        platformDevices[norm.platform] = (platformDevices[norm.platform] || 0) + inst;
        platformPrograms[norm.platform] = (platformPrograms[norm.platform] || 0) + 1;

        const cKey = categoryDevices[norm.categoryKey] !== undefined ? norm.categoryKey : 'Other';
        categoryDevices[cKey] += inst;
        categoryPrograms[cKey] += 1;

        if (norm.platform === 'Mobile') {
          const subKey = norm.subAppKey || 'general';
          mobileSubApps[subKey] = (mobileSubApps[subKey] || 0) + inst;
        }
        const verKey = String(p.version || norm.version || '').trim() || 'غير محدد';
        versionDevices[verKey] = (versionDevices[verKey] || 0) + inst;
        versionPrograms[verKey] = (versionPrograms[verKey] || 0) + 1;

        const startMs = parseDateMsStrict(p.startDate || c.startDate, p.id);
        deviceEntries.push({ startMs, devices: inst });
      });
    } else if (!c._subcollectionsLoaded) {
      const breakdown = getClientCategoryBreakdown(c);
      totalPrograms += breakdown.totalPrograms;
      totalLicensedDevices += breakdown.totalDevices;

      if (breakdown.items.length > 0) {
        breakdown.items.forEach(item => {
          platformDevices[item.platform] = (platformDevices[item.platform] || 0) + item.devices;
          platformPrograms[item.platform] = (platformPrograms[item.platform] || 0) + 1;
          const cKey = categoryDevices[item.categoryKey] !== undefined ? item.categoryKey : 'Other';
          categoryDevices[cKey] += item.devices;
          categoryPrograms[cKey] += 1;
          if (item.platform === 'Mobile') {
            const subKey = item.subAppKey || 'general';
            mobileSubApps[subKey] = (mobileSubApps[subKey] || 0) + item.devices;
          }
          const verKey = String(item.version || '').trim() || 'غير محدد';
          versionDevices[verKey] = (versionDevices[verKey] || 0) + item.devices;
          versionPrograms[verKey] = (versionPrograms[verKey] || 0) + 1;
          const startMs = parseDateMsStrict(c.startDate, c.id);
          deviceEntries.push({ startMs, devices: item.devices });
        });
      } else if ((Number(c.installationsCount) || 0) > 0) {
        const inst = Number(c.installationsCount) || 0;
        platformDevices.Desktop += inst;
        categoryDevices.Commercial += inst;
        const startMs = parseDateMsStrict(c.startDate, c.id);
        deviceEntries.push({ startMs, devices: inst });
      }
    }

    // Follow-up & Communication coverage
    const hist = Array.isArray(c.contactHistory) ? c.contactHistory : [];
    const calls = hist.length > 0 ? hist.length : (Number(c.contactsCount) || 0);
    totalCalls += calls;
    hist.forEach(h => {
      const ms = parseDateMsStrict(h?.date, h?.id);
      if (ms !== null) allContactDatesMs.push(ms);
    });

    let lastContactMs = parseDateMsStrict(c.lastContact, null);
    if (hist.length > 0) {
      hist.forEach(h => {
        const ms = parseDateMsStrict(h?.date, h?.id);
        if (ms !== null && (lastContactMs === null || ms > lastContactMs)) {
          lastContactMs = ms;
        }
      });
    }
    if (lastContactMs !== null && lastContactMs >= monthWindowStartMs && lastContactMs <= now) {
      contacted30Clients += 1;
    }
  });

  const newDevices30d = deviceEntries.reduce((sum, entry) => {
    if (entry.startMs !== null && entry.startMs >= monthWindowStartMs && entry.startMs <= now) {
      return sum + entry.devices;
    }
    return sum;
  }, 0);

  const newPrograms30d = deviceEntries.filter(entry =>
    entry.startMs !== null && entry.startMs >= monthWindowStartMs && entry.startMs <= now
  ).length;

  const devicesSparkline = checkpoints30d.map((cp, idx) => {
    if (idx === 7) return totalLicensedDevices;
    return deviceEntries.reduce((sum, entry) => (
      entry.startMs === null || entry.startMs <= cp ? sum + entry.devices : sum
    ), 0);
  });

  const progsSparkline = checkpoints30d.map((cp, idx) => {
    if (idx === 7) return totalPrograms;
    return deviceEntries.filter(entry => entry.startMs === null || entry.startMs <= cp).length;
  });

  const contacts30dCount = allContactDatesMs.filter(ms => ms >= monthWindowStartMs && ms <= now).length;
  const contactsSparkline = checkpoints30d.map((cp, idx) => {
    const startBucket = idx === 0 ? monthWindowStartMs - (30 * DAY_MS) / 7 : checkpoints30d[idx - 1];
    return allContactDatesMs.filter(ms => ms > startBucket && ms <= cp).length;
  });

  const contactCoveragePct = cl.length > 0 ? Math.round((contacted30Clients / cl.length) * 100) : 0;

  return {
    totalPrograms,
    totalLicensedDevices,
    platformDevices,
    platformPrograms,
    categoryDevices,
    categoryPrograms,
    mobileSubApps,
    versionDevices,
    versionPrograms,
    newDevices30d,
    newPrograms30d,
    devicesSparkline,
    progsSparkline,
    contacted30Clients,
    contactCoveragePct,
    totalCalls,
    contacts30dCount,
    contactsSparkline
  };
}

/**
 * Sanitizes, deduplicates, and enriches Recent Activities for Dashboard Row D3.
 * Eliminates admin/backup noise, orphaned clients, and redundant sync duplicates.
 */
export function filterRecentDashboardActivities(activities, clientsList, allowedClientIdsSet = null) {
  const safeActs = Array.isArray(activities) ? activities : [];
  const clientIdSet = new Set((Array.isArray(clientsList) ? clientsList : []).filter(Boolean).map(c => String(c.id)));
  const clientById = new Map((Array.isArray(clientsList) ? clientsList : []).filter(Boolean).map(c => [String(c.id), c]));

  const sorted = [...safeActs]
    .filter(act => {
      if (!act || !act.timestamp) return false;
      const ms = new Date(act.timestamp).getTime();
      if (Number.isNaN(ms)) return false;

      const tp = String(act.type || '');
      if (
        tp.startsWith('BACKUP_') ||
        tp.startsWith('DATA_') ||
        tp.startsWith('STAFF_') ||
        tp === 'SYSTEM_PURGE' ||
        tp.endsWith('_DELETED')
      ) {
        return false;
      }

      if (act.clientId !== undefined && act.clientId !== null && act.clientId !== '') {
        const cidStr = String(act.clientId);
        if (clientIdSet.size > 0 && !clientIdSet.has(cidStr)) return false;
        if (allowedClientIdsSet && !allowedClientIdsSet.has(Number(act.clientId)) && !allowedClientIdsSet.has(cidStr)) {
          return false;
        }
      }

      return true;
    })
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const seenDedupKeys = new Set();
  const result = [];

  for (const act of sorted) {
    const tp = String(act.type || '');
    const cidStr = act.clientId !== undefined && act.clientId !== null ? String(act.clientId) : '';
    const refId = act.meta?.programId || act.meta?.issueId || act.meta?.reqId || act.meta?.contactId || '';
    const semanticKey = refId
      ? `${cidStr}|${tp}|${refId}`
      : (act.source === 'crm-sync'
        ? `${cidStr}|${tp}|${String(act.title || '').trim()}`
        : `id:${String(act.id || '')}`);

    if (seenDedupKeys.has(semanticKey)) continue;
    seenDedupKeys.add(semanticKey);

    const linkedClient = cidStr ? clientById.get(cidStr) : null;
    const isCall = tp.includes('CONTACT');
    const isSolved = tp.includes('RESOLVED');
    const isIssue = tp.includes('ISSUE') && !isSolved;
    const isProgVersionSync = tp === 'PROGRAM_VERSION_UPDATED';
    const isProgEdit = tp === 'PROGRAM_EDITED' || isProgVersionSync;
    const isProg = tp.includes('PROGRAM');
    const isReq = tp.includes('REQUIREMENT');
    const isClient = tp.includes('CLIENT');

    let badgeTag = 'إجراء';
    let badgeColor = '#92400E';
    let badgeBg = '#FFFBEB';

    if (isCall) {
      badgeTag = 'مكالمة';
      badgeColor = '#1E40AF';
      badgeBg = '#EFF6FF';
    } else if (isSolved) {
      badgeTag = 'حل مشكلة';
      badgeColor = '#065F46';
      badgeBg = '#ECFDF5';
    } else if (isIssue) {
      badgeTag = 'تذكرة دعم';
      badgeColor = '#991B1B';
      badgeBg = '#FEF2F2';
    } else if (isProgVersionSync) {
      badgeTag = 'ترقية إصدار';
      badgeColor = '#047857';
      badgeBg = '#ECFDF5';
    } else if (isProgEdit) {
      badgeTag = 'تحديث ترخيص';
      badgeColor = '#9A3412';
      badgeBg = '#FFF3E8';
    } else if (isProg) {
      badgeTag = 'ترخيص';
      badgeColor = '#9A3412';
      badgeBg = '#FFF3E8';
    } else if (isReq) {
      badgeTag = 'طلب ميزة';
      badgeColor = '#5B21B6';
      badgeBg = '#F5F3FF';
    } else if (isClient) {
      badgeTag = tp === 'CLIENT_CREATED' ? 'عميل جديد' : 'تحديث عميل';
      badgeColor = '#0F766E';
      badgeBg = '#F0FDFA';
    }

    const actor = act.userName || act.actorName || (act.actorEmail ? act.actorEmail.split('@')[0] : 'النظام');
    result.push({
      ...act,
      actor,
      clientName: act.clientName || linkedClient?.fullName || '',
      hasLinkedClient: Boolean(linkedClient),
      badgeTag,
      badgeColor,
      badgeBg
    });
  }

  return result;
}
