import { INITIAL_IMPORTED_CLIENTS } from '../data/importedClients.js';
import { S, clients, setClients, updateState, currentUser } from '../state/store.js';
import { saveClients, setMeta, getClients } from './idbStorage.js';
import { saveUserData } from '../firebase/service.js';
import { migrateLegacyDataIfNeeded } from '../firebase/migration.js';
import { auth } from '../firebase/config.js';


export function computeStats(clientList) {
  const safeList = Array.isArray(clientList) ? clientList.filter(Boolean) : [];
  const active = safeList.filter(c => c && c.status === 'نشط').length;
  const prospective = safeList.filter(c => c && c.status === 'محتمل').length;
  const stopped = safeList.filter(c => c && c.status === 'متوقف').length;
  const totalPrograms = safeList.reduce((acc, c) => acc + (c?.programs || []).length, 0);
  const totalInstalls = safeList.reduce((acc, c) => acc + (c?.programs || []).reduce((sum, p) => sum + (Number(p?.installationsCount) || 1), 0), 0);
  const totalIssues = safeList.reduce((acc, c) => acc + (c?.issues || []).filter(i => i && (i.status === 'مفتوح' || i.status === 'قيد المعالجة')).length, 0);
  const maxId = safeList.reduce((max, c) => Math.max(max, Number(c?.id) || 0), 0);

  return {
    stats: {
      activeClients: active,
      prospectiveClients: prospective,
      stoppedClients: stopped,
      totalClients: safeList.length,
      totalPrograms: totalPrograms,
      totalLicensedDevices: totalInstalls,
      averageScore: 100,
      totalOpenIssues: totalIssues
    },
    nid: Math.max(100, maxId + 1)
  };
}

export function mergeClientLists(currentList = []) {
  const safeList = Array.isArray(currentList) ? currentList.filter(Boolean) : [];
  return safeList;
}

export const DEFAULT_SABER_USER = {
  uid: null,
  email: '',
  displayName: 'المسؤول العام',
  emailVerified: true
};

/**
 * Ensures data is persisted into the current session and active account.
 */
export async function mergeWithSessionAndUser(user = currentUser) {
  const currentInMemory = Array.isArray(clients) && clients.length > 0 ? clients : [];
  const merged = mergeClientLists(currentInMemory);
  const { stats, nid } = computeStats(merged);

  setClients(merged);
  updateState({ stats, nid });

  const activeUser = user || currentUser;
  const primaryUid = (auth && auth.currentUser && auth.currentUser.uid) || activeUser?.uid;

  if (primaryUid) {
    try {
      await saveClients(primaryUid, merged);
      await setMeta(primaryUid, 'stats', stats);
      await setMeta(primaryUid, 'nid', nid);
    } catch (idbErr) {
      console.warn(`[Database Merge] IDB save notice for ${primaryUid}:`, idbErr);
    }
  }

  console.log(`[Database Merge] Successfully merged ${merged.length} clients to user ${primaryUid || 'active'} and active session.`);

  // If user is actively authenticated with Firebase Auth, trigger cloud Firestore sync
  if (primaryUid && auth && auth.currentUser) {
    try {
      console.log(`[Database Merge] Syncing ${merged.length} clients to Firestore for account ${activeUser.email || 'active_user'} (${primaryUid})...`);
      await saveUserData(primaryUid, {
        v: 3,
        updatedAt: new Date().toISOString(),
        nid,
        stats
      });
      // Background migration to subcollections
      migrateLegacyDataIfNeeded(primaryUid, { clients: merged }, nid).then(() => {
        console.log(`[Database Merge] Cloud migration completed for account ${activeUser.email || 'active_user'}.`);
      }).catch(cloudErr => {
        console.warn("[Database Merge] Cloud migration notice:", cloudErr);
      });
    } catch (cloudErr) {
      console.warn("[Database Merge] Cloud save notice:", cloudErr);
    }
  }

  return merged;
}
