const KNOWN_VERSIONS = ['V27', 'V26', 'V24', 'V23', 'V21', 'v18', 'v16', 'v15', 'R+', 'arabe'];

function stableNumericId(seed) {
  let hash = 2166136261;
  const str = String(seed || '');
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return 1000000000 + (hash >>> 0);
}

function normalizeNameText(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function inferPlatformFromName(programName = '') {
  const lower = String(programName || '').toLowerCase();
  if (lower.startsWith('mobile') || lower.includes('vdd') || lower.includes('tableau de bord') || lower.includes('التاجر') || lower.includes('لوحة القيادة')) {
    return 'Mobile';
  }
  if (lower.startsWith('web') || lower.includes('الويب')) {
    return 'Web';
  }
  if (lower.startsWith('hybrid')) {
    return 'Hybrid';
  }
  return 'Desktop';
}

function inferTypeFromName(programName = '', platform = 'Desktop') {
  const text = String(programName || '');
  if (text.includes('إنتاجي') || text.toLowerCase().includes('production')) return 'إنتاجي (Production)';
  if (text.includes('توزيع') || text.toLowerCase().includes('distribution')) return 'توزيع (Distribution)';
  if (text.includes('لوحة القيادة') || text.toLowerCase().includes('tableau de bord')) return 'تطبيق لوحة القيادة (Tableau de bord)';
  if (text.includes('VDD') || text.toLowerCase().includes('vendeur')) return 'تطبيق VDD (Vendeur Distributeur)';
  if (text.includes('التاجر') || text.toLowerCase().includes('commer')) return 'تطبيق التاجر (Commerçant)';
  if (platform === 'Web' || text.includes('الويب')) return 'الويب';
  if (text.includes('تجاري') || text.toLowerCase().includes('commercial')) return 'تجاري (Commercial)';
  return platform === 'Mobile' ? 'تطبيق لوحة القيادة (Tableau de bord)' : 'تجاري (Commercial)';
}

function inferVersionFromName(programName = '', platform = 'Desktop') {
  if (platform === 'Mobile') return '';
  const text = String(programName || '');
  for (const v of KNOWN_VERSIONS) {
    const escaped = v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(?:^|\\s|-|·)${escaped}(?:$|\\s)`, 'i');
    if (regex.test(text)) {
      return v;
    }
  }
  const vMatch = text.match(/\b(V\d+|v\d+)\b/);
  return vMatch ? vMatch[1] : '';
}

export function normalizeProgramRecord(p, fallbackStartDate = '') {
  if (!p || typeof p !== 'object') return null;
  const programName = String(p.programName || p.product || '').trim() || 'غير محدد';
  const platform = ['Desktop', 'Mobile', 'Web', 'Hybrid'].includes(p.platform)
    ? p.platform
    : inferPlatformFromName(programName);
  const version = platform === 'Mobile'
    ? ''
    : String(p.version !== undefined && p.version !== null ? p.version : inferVersionFromName(programName, platform)).trim();
  const type = String(p.type || '').trim() || inferTypeFromName(programName, platform);
  const rawId = p.id;
  const numericId = Number(rawId);
  const id = Number.isFinite(numericId) && numericId > 0
    ? numericId
    : stableNumericId(`${programName}|${platform}|${p.startDate || fallbackStartDate}`);

  return {
    ...p,
    id,
    programName,
    platform,
    type,
    version,
    installationsCount: Math.max(1, Number(p.installationsCount) || 1),
    startDate: String(p.startDate || fallbackStartDate || '').trim(),
    endDate: String(p.endDate || '').trim()
  };
}

export function buildProgramFingerprint(p) {
  if (!p) return '';
  const platform = normalizeNameText(p.platform || inferPlatformFromName(p.programName));
  const name = normalizeNameText(p.programName || '');
  return `${platform}|${name}`;
}

export function parseProgramFromActivity(act, clientObj = null) {
  if (!act || act.type !== 'PROGRAM_ADDED') return null;

  const meta = act.meta && typeof act.meta === 'object' ? act.meta : {};
  const desc = String(act.description || '');
  const title = String(act.title || '');

  let programName = String(meta.programName || '').trim();
  if (!programName) {
    const quotedMatch = desc.match(/"([^"]+)"/);
    if (quotedMatch) {
      programName = quotedMatch[1].trim();
    } else if (title.startsWith('خدمة ترخيص برنامج:')) {
      programName = title.replace(/^خدمة ترخيص برنامج:\s*/, '').trim();
    }
  }
  if (!programName) return null;

  let platform = String(meta.platform || '').trim();
  if (!platform) {
    const platMatch = desc.match(/المنصة:\s*([A-Za-z]+)/);
    platform = platMatch ? platMatch[1].trim() : inferPlatformFromName(programName);
  }
  if (!['Desktop', 'Mobile', 'Web', 'Hybrid'].includes(platform)) {
    platform = inferPlatformFromName(programName);
  }

  let type = String(meta.type || '').trim();
  if (!type) {
    const typeMatch = desc.match(/نوع الخدمة:\s*([^\n-]+?)\s*(?:-|$)/);
    type = typeMatch ? typeMatch[1].trim() : inferTypeFromName(programName, platform);
  }

  let version = meta.version !== undefined ? String(meta.version || '').trim() : '';
  if (!version && platform !== 'Mobile') {
    version = inferVersionFromName(programName, platform);
  }
  if (platform === 'Mobile') version = '';

  let installationsCount = Number(meta.installationsCount);
  if (!Number.isFinite(installationsCount) || installationsCount < 1) {
    const instMatch = desc.match(/أجهزة مرخصة:\s*(\d+)/) || desc.match(/مع\s*(\d+)\s*أجهزة مرخصة/);
    installationsCount = instMatch ? Math.max(1, Number(instMatch[1])) : 1;
  }

  let startDate = String(meta.startDate || '').trim();
  if (!startDate) {
    const sdMatch = desc.match(/\(البداية:\s*([^)]+)\)/);
    if (sdMatch) {
      startDate = sdMatch[1].trim();
    } else if (act.timestamp && /^\d{4}-\d{2}-\d{2}/.test(String(act.timestamp))) {
      startDate = String(act.timestamp).slice(0, 10);
    } else {
      startDate = String(clientObj?.startDate || '').trim();
    }
  }

  let endDate = String(meta.endDate || '').trim();
  if (!endDate) {
    const edMatch = desc.match(/\(النهاية:\s*([^)]+)\)/);
    if (edMatch) {
      endDate = edMatch[1].trim();
    }
  }

  let progId = meta.programId;
  if (!progId && typeof act.id === 'string') {
    const idMatch = act.id.match(/^act_prog_[^_]+_(.+)$/);
    if (idMatch && /^\d+$/.test(idMatch[1])) {
      progId = Number(idMatch[1]);
    }
  }
  const numericProgId = Number(progId);
  const id = Number.isFinite(numericProgId) && numericProgId > 0
    ? numericProgId
    : stableNumericId(`${act.clientId || clientObj?.id || ''}|${programName}|${startDate}|${act.id || ''}`);

  return normalizeProgramRecord({
    id,
    programName,
    platform,
    type,
    version,
    installationsCount,
    startDate,
    endDate
  }, clientObj?.startDate || '');
}

export function extractDeletedProgramsFromActivities(clientId, activities = []) {
  const cid = Number(clientId);
  return (Array.isArray(activities) ? activities : [])
    .filter(a => a && a.type === 'PROGRAM_DELETED' && (clientId === undefined || clientId === null || Number(a.clientId) === cid))
    .map(a => {
      const meta = a.meta && typeof a.meta === 'object' ? a.meta : {};
      const desc = String(a.description || '');
      const quoted = desc.match(/"([^"]+)"/);
      const programName = String(meta.programName || (quoted ? quoted[1] : '')).trim();
      return {
        programId: meta.programId !== undefined ? String(meta.programId) : null,
        programName,
        normalizedName: normalizeNameText(programName),
        timestamp: String(a.timestamp || '')
      };
    });
}

function extractEditedProgramsFromActivities(clientId, activities = []) {
  const cid = Number(clientId);
  return (Array.isArray(activities) ? activities : [])
    .filter(a => a && a.type === 'PROGRAM_EDITED' && (clientId === undefined || clientId === null || Number(a.clientId) === cid))
    .sort((a, b) => String(a.timestamp || '').localeCompare(String(b.timestamp || '')))
    .map(a => {
      const meta = a.meta && typeof a.meta === 'object' ? a.meta : {};
      const desc = String(a.description || '');
      const quoted = desc.match(/"([^"]+)"/);
      const instMatch = desc.match(/الأجهزة المرخصة:\s*(\d+)/);
      return {
        programId: meta.programId !== undefined ? String(meta.programId) : null,
        programName: String(meta.programName || (quoted ? quoted[1] : '')).trim(),
        normalizedName: normalizeNameText(meta.programName || (quoted ? quoted[1] : '')),
        installationsCount: meta.installationsCount ? Number(meta.installationsCount) : (instMatch ? Number(instMatch[1]) : null),
        timestamp: String(a.timestamp || '')
      };
    });
}

export function isProgramDeletedAfter(prog, addedTimestamp = '', deletions = []) {
  if (!prog || !Array.isArray(deletions) || deletions.length === 0) return false;
  const progIdStr = prog.id !== undefined && prog.id !== null ? String(prog.id) : null;
  const normName = normalizeNameText(prog.programName);

  return deletions.some(del => {
    const idMatches = Boolean(del.programId && progIdStr && del.programId === progIdStr);
    const nameMatches = Boolean(del.normalizedName && normName && del.normalizedName === normName);
    if (!idMatches && !nameMatches) return false;
    if (!addedTimestamp || !del.timestamp) return true;
    return del.timestamp >= addedTimestamp;
  });
}

export function getClientProgramsPurgeCutoff(clientObj, activities = []) {
  let latestCutoff = '';
  const candidate = clientObj?.programsPurgedAt ? String(clientObj.programsPurgedAt).trim() : '';
  if (candidate) {
    latestCutoff = candidate;
  }

  const cidStr = clientObj?.id !== undefined && clientObj?.id !== null ? String(clientObj.id) : null;
  for (const act of (Array.isArray(activities) ? activities : [])) {
    if (!act || act.type !== 'SYSTEM_PURGE') continue;
    const meta = act.meta && typeof act.meta === 'object' ? act.meta : null;
    if (!meta || !meta.purgeProgramsOnly) continue;

    const matchesAll = Boolean(meta.purgedAllClients);
    const matchesClient = cidStr !== null && Array.isArray(meta.purgedClientIds) &&
      meta.purgedClientIds.some(id => String(id) === cidStr);

    if (!matchesAll && !matchesClient) continue;

    const actCutoff = String(meta.purgedBefore || act.timestamp || '').trim();
    if (actCutoff && (!latestCutoff || actCutoff > latestCutoff)) {
      latestCutoff = actCutoff;
    }
  }

  return latestCutoff;
}

export function reconcileClientPrograms({ client, subPrograms = [], inlinePrograms = [], activities = [] }) {
  const c = client || {};
  const fallbackStart = c.startDate || '';
  const allActivities = Array.isArray(activities) ? activities : [];
  const clientActivities = allActivities
    .filter(a => a && (c.id === undefined || c.id === null || Number(a.clientId) === Number(c.id)));

  const purgeCutoff = getClientProgramsPurgeCutoff(c, allActivities);
  const deletions = extractDeletedProgramsFromActivities(c.id, clientActivities);
  const edits = extractEditedProgramsFromActivities(c.id, clientActivities);

  const merged = [];
  const recoveredPrograms = [];
  const seenIds = new Set();
  const seenFingerprints = new Set();

  const registerProgram = (prog, isRecovered = false) => {
    if (!prog) return;
    const idKey = String(prog.id);
    const fp = buildProgramFingerprint(prog);
    if (seenIds.has(idKey) || (fp && seenFingerprints.has(fp))) {
      return;
    }
    seenIds.add(idKey);
    if (fp) seenFingerprints.add(fp);
    merged.push(prog);
    if (isRecovered) {
      recoveredPrograms.push(prog);
    }
  };

  // 1. Subcollection programs are canonical
  (Array.isArray(subPrograms) ? subPrograms : []).forEach(p => {
    const np = normalizeProgramRecord(p, fallbackStart);
    registerProgram(np, false);
  });

  // 2. Recover inline programs stored on parent client document when missing from subcollection
  const addedActivities = clientActivities
    .filter(a => a.type === 'PROGRAM_ADDED')
    .sort((a, b) => String(a.timestamp || '').localeCompare(String(b.timestamp || '')));

  const subCollectionClearedByPurge = Boolean(
    purgeCutoff &&
    (!Array.isArray(subPrograms) || subPrograms.length === 0) &&
    (!c.updatedAt || String(c.updatedAt) <= purgeCutoff || Number(c.programsCount || 0) === 0)
  );

  if (!subCollectionClearedByPurge) {
    (Array.isArray(inlinePrograms) ? inlinePrograms : []).forEach(p => {
      const np = normalizeProgramRecord(p, fallbackStart);
      if (!np) return;
      const idKey = String(np.id);
      const fp = buildProgramFingerprint(np);
      if (seenIds.has(idKey) || (fp && seenFingerprints.has(fp))) return;

      // Check whether this inline program was explicitly deleted later
      const matchingAdd = addedActivities.filter(a => {
        const parsed = parseProgramFromActivity(a, c);
        if (!parsed) return false;
        return String(parsed.id) === idKey || buildProgramFingerprint(parsed) === fp;
      }).pop();

      if (purgeCutoff && matchingAdd && (!matchingAdd.timestamp || matchingAdd.timestamp <= purgeCutoff)) {
        return;
      }

      const deletedLater = isProgramDeletedAfter(np, matchingAdd?.timestamp || '', deletions);
      if (deletedLater) return;

      registerProgram(np, true);
    });
  }

  // 3. Recover any active PROGRAM_ADDED records from Timeline that are absent from subcollection & inline
  addedActivities.forEach(act => {
    if (purgeCutoff && (!act.timestamp || act.timestamp <= purgeCutoff)) return;
    const parsed = parseProgramFromActivity(act, c);
    if (!parsed) return;
    if (isProgramDeletedAfter(parsed, act.timestamp || '', deletions)) return;

    const idKey = String(parsed.id);
    const fp = buildProgramFingerprint(parsed);
    if (seenIds.has(idKey) || (fp && seenFingerprints.has(fp))) return;

    // Apply any subsequent PROGRAM_EDITED update to installationsCount
    const latestEdit = edits.filter(e => {
      const idMatch = e.programId && e.programId === idKey;
      const nameMatch = e.normalizedName && e.normalizedName === normalizeNameText(parsed.programName);
      return (idMatch || nameMatch) && (!act.timestamp || !e.timestamp || e.timestamp >= act.timestamp);
    }).pop();

    if (latestEdit && Number.isFinite(latestEdit.installationsCount) && latestEdit.installationsCount >= 1) {
      parsed.installationsCount = latestEdit.installationsCount;
    }

    registerProgram(parsed, true);
  });

  const programsCount = merged.length;
  const installationsCount = merged.reduce((sum, p) => sum + (Number(p.installationsCount) || 1), 0);
  const programNames = merged.map(p => p.programName).filter(Boolean);
  const activeWithEndDate = merged.filter(p => p.endDate).sort((a, b) => new Date(a.endDate) - new Date(b.endDate));
  const endDate = programsCount > 0 ? (c.endDate || (activeWithEndDate.length > 0 ? activeWithEndDate[0].endDate : '')) : '';

  const existingInlineCount = Array.isArray(c.programs) ? c.programs.length : 0;
  const needsCounterSync =
    Number(c.programsCount || 0) !== programsCount ||
    Number(c.installationsCount || 0) !== installationsCount ||
    existingInlineCount !== programsCount ||
    JSON.stringify(c.programNames || []) !== JSON.stringify(programNames);

  return {
    programs: merged,
    recoveredPrograms,
    needsBackfill: recoveredPrograms.length > 0,
    needsCounterSync,
    counterUpdates: {
      programs: merged,
      programsCount,
      installationsCount,
      programNames,
      endDate
    }
  };
}
