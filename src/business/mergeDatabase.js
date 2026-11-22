import { S, clients, setClients, updateState, currentUser } from '../state/store.js';
import { saveUserData, assertOnlineForWrite } from '../firebase/service.js';
import { migrateLegacyDataIfNeeded } from '../firebase/migration.js';
import { auth } from '../firebase/config.js';
import { computeScore } from './intelligence.js';


export function computeStats(clientList) {
  const safeList = Array.isArray(clientList) ? clientList.filter(Boolean) : [];
  const active = safeList.filter(c => c && c.status === 'نشط').length;
  const prospective = safeList.filter(c => c && c.status === 'محتمل').length;
  const stopped = safeList.filter(c => c && c.status === 'متوقف').length;
  const totalPrograms = safeList.reduce((acc, c) => {
    const progs = Array.isArray(c?.programs) ? c.programs : [];
    const countFromDoc = Math.max(Number(c?.programsCount) || 0, Array.isArray(c?.programNames) ? c.programNames.length : 0);
    return acc + (progs.length > 0 ? progs.length : countFromDoc);
  }, 0);
  const totalInstalls = safeList.reduce((acc, c) => {
    const progs = Array.isArray(c?.programs) ? c.programs : [];
    if (progs.length > 0) {
      return acc + progs.reduce((sum, p) => sum + (Number(p?.installationsCount) || 1), 0);
    }
    return acc + (Number(c?.installationsCount) || 0);
  }, 0);
  const totalIssues = safeList.reduce((acc, c) => {
    const issues = Array.isArray(c?.issues) ? c.issues : [];
    if (issues.length > 0 || c?._subcollectionsLoaded) {
      return acc + issues.filter(i => i && (i.status === 'مفتوح' || i.status === 'قيد المعالجة' || i.status === 'جديد')).length;
    }
    return acc + (Number(c?.openIssuesCount) || 0);
  }, 0);
  const averageScore = safeList.length > 0
    ? Math.round(safeList.reduce((acc, c) => {
        const sc = c._subcollectionsLoaded
          ? computeScore(c).total
          : (c.score !== undefined ? Number(c.score) : computeScore(c).total);
        return acc + sc;
      }, 0) / safeList.length)
    : 0;
  const maxId = safeList.reduce((max, c) => Math.max(max, Number(c?.id) || 0), 0);

  return {
    stats: {
      activeClients: active,
      prospectiveClients: prospective,
      stoppedClients: stopped,
      totalClients: safeList.length,
      totalPrograms: totalPrograms,
      totalLicensedDevices: totalInstalls,
      averageScore,
      totalOpenIssues: totalIssues
    },
    nid: Math.max(100, maxId + 1)
  };
}

export function mergeClientLists(currentList = []) {
  const safeList = Array.isArray(currentList) ? currentList.filter(Boolean) : [];
  return safeList;
}

/**
 * Ensures data is persisted strictly online to Cloud Firestore before updating session state.
 */
export async function mergeWithSessionAndUser(user = currentUser) {
  assertOnlineForWrite();
  const currentInMemory = Array.isArray(clients) && clients.length > 0 ? clients : [];
  const merged = mergeClientLists(currentInMemory);
  const { stats, nid } = computeStats(merged);

  const activeUser = user || currentUser;
  const primaryUid = (auth && auth.currentUser && auth.currentUser.uid) || activeUser?.uid;
  if (!primaryUid) {
    throw new Error('لا يوجد حساب موثق للمزامنة السحابية.');
  }

  await saveUserData(primaryUid, {
    v: 3,
    updatedAt: new Date().toISOString(),
    nid,
    stats
  });
  await migrateLegacyDataIfNeeded(primaryUid, { clients: merged }, nid);

  setClients(merged);
  updateState({ stats, nid });

  return merged;
}
