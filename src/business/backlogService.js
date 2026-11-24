export function normalizeFeatureKey(rawTitle = '') {
  return String(rawTitle || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function tokenizeFeature(str = '') {
  return new Set(normalizeFeatureKey(str).split(' ').filter(w => w.length >= 2));
}

export function computeFeatureSimilarity(titleA = '', titleB = '') {
  const normA = normalizeFeatureKey(titleA);
  const normB = normalizeFeatureKey(titleB);
  if (!normA || !normB) return 0;
  if (normA === normB) return 1;
  if (normA.includes(normB) || normB.includes(normA)) return 0.85;

  const setA = tokenizeFeature(normA);
  const setB = tokenizeFeature(normB);
  if (setA.size === 0 || setB.size === 0) return 0;

  let intersection = 0;
  for (const tok of setA) {
    if (setB.has(tok)) intersection++;
  }
  const union = setA.size + setB.size - intersection;
  return union > 0 ? intersection / union : 0;
}

export function findSimilarBacklogItems(backlogItems = [], rawTitle = '', minScore = 0.45) {
  const list = Array.isArray(backlogItems) ? backlogItems.filter(Boolean) : [];
  if (!rawTitle || !normalizeFeatureKey(rawTitle)) return [];
  return list
    .map(item => ({
      item,
      similarity: computeFeatureSimilarity(rawTitle, item.title)
    }))
    .filter(x => x.similarity >= minScore)
    .sort((a, b) => b.similarity - a.similarity);
}

/**
 * Consolidates explicit central Backlog items + client requirements linked via `backlogId`
 * (or auto-clustered by normalized title for unlinked repeated requests across clients).
 */
export function buildUnifiedBacklog(clients = [], backlogDocs = []) {
  const safeClients = Array.isArray(clients) ? clients.filter(c => c && typeof c === 'object') : [];
  const safeBacklog = Array.isArray(backlogDocs) ? backlogDocs.filter(b => b && typeof b === 'object') : [];

  const backlogMap = new Map();
  safeBacklog.forEach(docItem => {
    const id = String(docItem.id);
    backlogMap.set(id, {
      ...docItem,
      id,
      isVirtual: false,
      linkedRequests: [],
      clientIdsSet: new Set()
    });
  });

  const virtualClusters = new Map();

  for (const client of safeClients) {
    const reqs = Array.isArray(client.requirements) ? client.requirements.filter(Boolean) : [];
    for (const req of reqs) {
      const reqEntry = {
        clientId: client.id,
        clientName: client.fullName || `عميل #${client.id}`,
        clientCompany: client.company || '',
        clientWilaya: client.wilaya || '',
        reqId: req.id,
        title: req.title || '',
        priority: req.priority || 'متوسطة',
        status: req.status || 'مقترح',
        impact: req.impact || 'متوسط',
        type: req.type || 'ميزة جديدة',
        date: req.date || '',
        notes: req.notes || '',
        assignedStaffId: req.assignedStaffId || '',
        assignedStaffName: req.assignedStaffName || '',
        backlogId: req.backlogId || ''
      };

      const explicitId = req.backlogId ? String(req.backlogId) : '';
      if (explicitId && backlogMap.has(explicitId)) {
        const b = backlogMap.get(explicitId);
        b.linkedRequests.push(reqEntry);
        b.clientIdsSet.add(String(client.id));
        continue;
      }

      const normKey = normalizeFeatureKey(req.title || '');
      if (!normKey) continue;
      if (!virtualClusters.has(normKey)) {
        virtualClusters.set(normKey, {
          id: `auto_${normKey.replace(/\s+/g, '_').slice(0, 48)}`,
          normKey,
          title: req.title || '',
          description: req.notes || '',
          category: req.type || 'ميزة جديدة',
          priority: req.priority || 'متوسطة',
          status: req.status || 'مقترح',
          assignedStaffId: req.assignedStaffId || '',
          assignedStaffName: req.assignedStaffName || '',
          isVirtual: true,
          linkedRequests: [],
          clientIdsSet: new Set()
        });
      }
      const vc = virtualClusters.get(normKey);
      vc.linkedRequests.push(reqEntry);
      vc.clientIdsSet.add(String(client.id));
    }
  }

  const prioWeight = { 'عاجل': 4, 'عالية': 3, 'متوسطة': 2, 'منخفضة': 1 };

  const formatEntry = (entry) => ({
    ...entry,
    interestedClientsCount: entry.clientIdsSet.size,
    totalRequestsCount: entry.linkedRequests.length,
    interestedClients: entry.linkedRequests,
    clientIdsSet: undefined
  });

  const explicitItems = Array.from(backlogMap.values()).map(formatEntry);
  const autoItems = Array.from(virtualClusters.values()).map(formatEntry);

  const allItems = [...explicitItems, ...autoItems].sort((a, b) => {
    if (b.interestedClientsCount !== a.interestedClientsCount) {
      return b.interestedClientsCount - a.interestedClientsCount;
    }
    return (prioWeight[b.priority] || 0) - (prioWeight[a.priority] || 0);
  });

  const repeatedClusters = allItems.filter(x => x.interestedClientsCount >= 2);

  return {
    items: allItems,
    explicitItems,
    autoItems,
    repeatedClusters,
    totalBacklogItems: allItems.length,
    totalInterestedRequests: allItems.reduce((s, x) => s + x.totalRequestsCount, 0)
  };
}

/**
 * Counts how many clients in the system share the same feature/requirement
 * (either linked to the same backlogId or matching normalized feature title).
 */
export function getRequirementInterestCount(req, clients = []) {
  if (!req) return 1;
  const safeClients = Array.isArray(clients) ? clients.filter(c => c && typeof c === 'object') : [];
  const backlogId = req.backlogId ? String(req.backlogId) : '';
  const targetNorm = normalizeFeatureKey(req.title || '');
  const matchedClients = new Set();

  for (const c of safeClients) {
    const reqs = Array.isArray(c.requirements) ? c.requirements.filter(Boolean) : [];
    const hit = reqs.some(r => {
      if (backlogId && r.backlogId && String(r.backlogId) === backlogId) return true;
      if (targetNorm && normalizeFeatureKey(r.title || '') === targetNorm) return true;
      return false;
    });
    if (hit) matchedClients.add(String(c.id));
  }

  return Math.max(1, matchedClients.size);
}
