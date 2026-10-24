/**
 * PROGILIC CRM v3 - Comprehensive Activity Timeline & Global Audit Log Service
 * Tracks, logs, filters, and exports history events across the entire CRM
 * with authenticated user attribution, timestamps, and multi-criteria querying.
 */

import { addActivity, getActivities } from './idbStorage.js';
import { currentUser, currentStaffUser, clients, S, hasPermission } from '../state/store.js';
import { getTenantActivities, saveTenantActivity } from '../firebase/service.js';

const pendingActivitiesKey = uid => `progilic_crm_pending_activities_${uid}`;
const activityMigrationKey = uid => `progilic_crm_activity_migration_${uid}`;
let activitySyncPromise = null;

function readPendingActivities(uid) {
  try {
    const pending = JSON.parse(localStorage.getItem(pendingActivitiesKey(uid)) || '[]');
    return Array.isArray(pending) ? pending : [];
  } catch (error) {
    console.warn('[Timeline] Failed to read pending cloud activities:', error);
    return [];
  }
}

function writePendingActivities(uid, pending) {
  try {
    localStorage.setItem(pendingActivitiesKey(uid), JSON.stringify(pending));
    return true;
  } catch (error) {
    console.error('[Timeline] Failed to persist pending cloud activities:', error);
    return false;
  }
}

function mergeActivities(...lists) {
  const merged = new Map();
  lists.flat().filter(Boolean).forEach(activity => {
    const key = String(activity.id || `${activity.timestamp}-${activity.type}-${activity.clientId || ''}`);
    merged.set(key, activity);
  });
  return [...merged.values()].sort((a, b) => String(b.timestamp || '').localeCompare(String(a.timestamp || '')));
}

async function migrateLocalActivities(uid) {
  try {
    if (localStorage.getItem(activityMigrationKey(uid)) === 'complete') return;
    const localActivities = await getActivities(uid, null);
    let cachedActivities = [];
    try {
      cachedActivities = JSON.parse(localStorage.getItem(`progilic_crm_activities_${uid}`) || '[]');
    } catch (error) {
      console.warn('[Timeline] Failed to read cached history during migration:', error);
    }

    const cursorValue = localStorage.getItem(activityMigrationKey(uid));
    const cursor = cursorValue ? JSON.parse(cursorValue) : null;
    const pendingIds = new Set(readPendingActivities(uid).map(activity => String(activity.id)));
    const legacyActivities = mergeActivities(localActivities || [], cachedActivities || [])
      .filter(activity => activity.id && activity.actorUid === uid && activity.source !== 'baseline')
      .sort((a, b) => String(a.timestamp || '').localeCompare(String(b.timestamp || ''))
        || String(a.id).localeCompare(String(b.id)))
      .filter(activity => !cursor
        || String(activity.timestamp || '') > cursor.timestamp
        || (String(activity.timestamp || '') === cursor.timestamp && String(activity.id) > cursor.id));

    while (legacyActivities.length) {
      const batch = legacyActivities.splice(0, 100);
      const pending = readPendingActivities(uid);
      const queued = new Set(pending.map(activity => String(activity.id)));
      batch.forEach(activity => {
        if (!queued.has(String(activity.id)) && !pendingIds.has(String(activity.id))) pending.push(activity);
      });
      if (!writePendingActivities(uid, pending) || !(await syncPendingActivities(uid))) {
        S.timelineCloudStatus = 'pending';
        return;
      }

      const lastActivity = batch[batch.length - 1];
      localStorage.setItem(activityMigrationKey(uid), JSON.stringify({
        timestamp: String(lastActivity.timestamp || ''),
        id: String(lastActivity.id)
      }));
    }
    localStorage.setItem(activityMigrationKey(uid), 'complete');
  } catch (error) {
    S.timelineCloudStatus = 'partial';
    console.error('[Timeline] Failed to migrate local history to the shared audit log:', error);
  }
}

export async function syncPendingActivities(uid = currentUser?.uid) {
  if (!uid || !currentUser || uid !== currentUser.uid) return false;
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    S.timelineCloudStatus = 'pending';
    return false;
  }
  if (activitySyncPromise) return activitySyncPromise;

  activitySyncPromise = (async () => {
    const pending = readPendingActivities(uid);
    let remaining = pending;
    for (const activity of pending) {
      if (!currentUser || uid !== currentUser.uid) break;
      try {
        const savedId = await saveTenantActivity(uid, activity);
        if (savedId) remaining = remaining.filter(item => String(item.id) !== String(activity.id));
      } catch (error) {
        console.error('[Timeline] Failed to sync activity to the tenant audit log:', error);
      }
      writePendingActivities(uid, remaining);
    }
    S.timelineCloudStatus = remaining.length ? 'pending' : 'synced';
    return remaining.length === 0;
  })().finally(() => {
    activitySyncPromise = null;
  });

  return activitySyncPromise;
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    syncPendingActivities().catch(error => console.error('[Timeline] Online sync failed:', error));
  });
}

export const ActivityType = {
  // Clients
  CLIENT_CREATED: 'CLIENT_CREATED',
  CLIENT_EDITED: 'CLIENT_EDITED',
  CLIENT_DELETED: 'CLIENT_DELETED',
  GPS_CAPTURED: 'GPS_CAPTURED',

  // Software & Licenses
  PROGRAM_ADDED: 'PROGRAM_ADDED',
  PROGRAM_EDITED: 'PROGRAM_EDITED',
  PROGRAM_DELETED: 'PROGRAM_DELETED',

  // Issues & Tickets
  ISSUE_ADDED: 'ISSUE_ADDED',
  ISSUE_EDITED: 'ISSUE_EDITED',
  ISSUE_RESOLVED: 'ISSUE_RESOLVED',
  ISSUE_DELETED: 'ISSUE_DELETED',

  // Requirements & Features
  REQUIREMENT_ADDED: 'REQUIREMENT_ADDED',
  REQUIREMENT_EDITED: 'REQUIREMENT_EDITED',
  REQUIREMENT_DELETED: 'REQUIREMENT_DELETED',

  // Contacts & History
  CONTACT_ADDED: 'CONTACT_ADDED',
  CONTACT_DELETED: 'CONTACT_DELETED',

  // Backups & Data
  BACKUP_CREATED: 'BACKUP_CREATED',
  BACKUP_RESTORED: 'BACKUP_RESTORED',
  BACKUP_DELETED: 'BACKUP_DELETED',
  DATA_IMPORTED: 'DATA_IMPORTED',
  DATA_EXPORTED: 'DATA_EXPORTED',

  // Staff & Permissions
  STAFF_ADDED: 'STAFF_ADDED',
  STAFF_EDITED: 'STAFF_EDITED',
  STAFF_DELETED: 'STAFF_DELETED',

  // System
  SYSTEM_PURGE: 'SYSTEM_PURGE'
};

/**
 * Returns Arabic metadata mapping (icon, friendly category name, badge styling class)
 * for rendering the timeline interface with crisp visual polish.
 */
export function getActivityVisuals(type) {
  switch (type) {
    case ActivityType.CLIENT_CREATED:
      return { icon: '👤', label: 'إضافة عميل جديد', category: 'clients', colorClass: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' };
    case ActivityType.CLIENT_EDITED:
      return { icon: '📝', label: 'تعديل بيانات العميل', category: 'clients', colorClass: 'bg-blue-500/10 text-blue-500 border-blue-500/20' };
    case ActivityType.CLIENT_DELETED:
      return { icon: '🗑️', label: 'حذف العميل', category: 'clients', colorClass: 'bg-rose-500/10 text-rose-500 border-rose-500/20' };
    case ActivityType.GPS_CAPTURED:
      return { icon: '📍', label: 'تحديد الموقع الجغرافي', category: 'clients', colorClass: 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20' };

    case ActivityType.PROGRAM_ADDED:
      return { icon: '📦', label: 'إضافة ترخيص برنامج', category: 'programs', colorClass: 'bg-teal-500/10 text-teal-500 border-teal-500/20' };
    case ActivityType.PROGRAM_EDITED:
      return { icon: '✏️', label: 'تعديل ترخيص برنامج', category: 'programs', colorClass: 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20' };
    case ActivityType.PROGRAM_DELETED:
      return { icon: '🗑️', label: 'حذف ترخيص برنامج', category: 'programs', colorClass: 'bg-rose-500/10 text-rose-500 border-rose-500/20' };

    case ActivityType.ISSUE_ADDED:
      return { icon: '🐛', label: 'تسجيل مشكلة تقنية', category: 'issues', colorClass: 'bg-amber-500/10 text-amber-500 border-amber-500/20' };
    case ActivityType.ISSUE_EDITED:
      return { icon: '🔧', label: 'تعديل تذكرة مشكلة', category: 'issues', colorClass: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' };
    case ActivityType.ISSUE_RESOLVED:
      return { icon: '✅', label: 'حل وإغلاق مشكلة', category: 'issues', colorClass: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' };
    case ActivityType.ISSUE_DELETED:
      return { icon: '❌', label: 'حذف تذكرة مشكلة', category: 'issues', colorClass: 'bg-gray-500/10 text-gray-400 border-gray-500/20' };

    case ActivityType.REQUIREMENT_ADDED:
      return { icon: '💡', label: 'إضافة متطلب أو فكرة', category: 'requirements', colorClass: 'bg-purple-500/10 text-purple-500 border-purple-500/20' };
    case ActivityType.REQUIREMENT_EDITED:
      return { icon: '⚙️', label: 'تعديل متطلب ميزة', category: 'requirements', colorClass: 'bg-fuchsia-500/10 text-fuchsia-500 border-fuchsia-500/20' };
    case ActivityType.REQUIREMENT_DELETED:
      return { icon: '🗑️', label: 'حذف طلب متطلب', category: 'requirements', colorClass: 'bg-rose-500/10 text-rose-500 border-rose-500/20' };

    case ActivityType.CONTACT_ADDED:
      return { icon: '📞', label: 'تسجيل تواصل ومكالمة', category: 'contacts', colorClass: 'bg-sky-500/10 text-sky-500 border-sky-500/20' };
    case ActivityType.CONTACT_DELETED:
      return { icon: '🗑️', label: 'حذف سجل تواصل', category: 'contacts', colorClass: 'bg-rose-500/10 text-rose-500 border-rose-500/20' };

    case ActivityType.BACKUP_CREATED:
      return { icon: '💾', label: 'إنشاء نسخة احتياطية', category: 'backup', colorClass: 'bg-violet-500/10 text-violet-500 border-violet-500/20' };
    case ActivityType.BACKUP_RESTORED:
      return { icon: '🔄', label: 'استرجاع نسخة احتياطية', category: 'backup', colorClass: 'bg-orange-500/10 text-orange-500 border-orange-500/20' };
    case ActivityType.BACKUP_DELETED:
      return { icon: '🗑️', label: 'حذف نسخة احتياطية', category: 'backup', colorClass: 'bg-rose-500/10 text-rose-500 border-rose-500/20' };
    case ActivityType.DATA_IMPORTED:
      return { icon: '📥', label: 'استيراد بيانات', category: 'backup', colorClass: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' };
    case ActivityType.DATA_EXPORTED:
      return { icon: '📊', label: 'تصدير بيانات أو تقرير', category: 'backup', colorClass: 'bg-blue-500/10 text-blue-500 border-blue-500/20' };

    case ActivityType.STAFF_ADDED:
      return { icon: '👥', label: 'إضافة مستخدم جديد', category: 'staff', colorClass: 'bg-teal-500/10 text-teal-500 border-teal-500/20' };
    case ActivityType.STAFF_EDITED:
      return { icon: '🔑', label: 'تعديل مستخدم وصلاحيات', category: 'staff', colorClass: 'bg-blue-500/10 text-blue-500 border-blue-500/20' };
    case ActivityType.STAFF_DELETED:
      return { icon: '🚫', label: 'حذف حساب مستخدم', category: 'staff', colorClass: 'bg-rose-500/10 text-rose-500 border-rose-500/20' };

    case ActivityType.SYSTEM_PURGE:
      return { icon: '⚠️', label: 'تصفية أو محو بيانات', category: 'system', colorClass: 'bg-red-500/10 text-red-500 border-red-500/20' };

    default:
      return { icon: '⏱️', label: 'إجراء نظام', category: 'system', colorClass: 'bg-slate-500/10 text-slate-400 border-slate-500/20' };
  }
}

/**
 * Logs an activity locally and syncs it to the shared tenant audit log.
 * Automatically attributes the operation to the active staff user name.
 * 
 * @param {number|string|null} clientId Client ID if related
 * @param {string} type One of ActivityType constants
 * @param {string} title Arabic event brief title
 * @param {string} description Full details about what was validated/performed
 * @param {string} source Source of the event ('local' | 'firestore' | 'sync' | 'import' | 'restore')
 * @param {object} meta Optional extra metadata object (e.g. clientName, changes)
 */
export async function logActivity(clientId, type, title, description, source = 'local', meta = {}) {
  const uid = currentUser?.uid || 'offline-tenant';

  // Determine user identity
  const activeStaff = currentStaffUser;
  let userName = 'المسؤول العام';
  let userRole = 'الإدارة العامة (Gérant)';
  let userId = 'gerant';

  if (activeStaff) {
    userName = activeStaff.name || activeStaff.fullName || 'موظف';
    userRole = activeStaff.department || activeStaff.position || (activeStaff.role === 'GERANT' ? 'المسؤول العام (Gérant)' : 'فريق العمل');
    userId = activeStaff.id || 'staff';
  } else if (currentUser) {
    userName = currentUser.displayName || (currentUser.email ? currentUser.email.split('@')[0] : 'المسؤول العام');
    userRole = 'المسؤول العام (Gérant)';
    userId = currentUser.uid;
  }

  // Determine target client name if linked
  let clientName = meta?.clientName || '';
  if (!clientName && clientId) {
    const c = (clients || []).find(x => x.id === Number(clientId) || String(x.id) === String(clientId));
    if (c) clientName = c.fullName || c.name || '';
  }

  // Derive category from visuals
  const visuals = getActivityVisuals(type);
  const category = visuals.category || 'system';

  const activity = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    clientId: clientId ? Number(clientId) : null,
    clientName,
    type,
    category,
    title,
    description,
    timestamp: new Date().toISOString(),
    userName,
    userRole,
    userId,
    actorUid: uid,
    actorEmail: currentUser?.email || '',
    source,
    meta: meta || {}
  };

  // 1. Reactive in-memory state update
  if (!Array.isArray(S.globalActivities)) {
    S.globalActivities = [];
  }
  S.globalActivities = [activity, ...S.globalActivities];

  // 2. Fast localStorage cache update
  try {
    const cacheKey = `progilic_crm_activities_${uid}`;
    const recent = S.globalActivities.slice(0, 300);
    localStorage.setItem(cacheKey, JSON.stringify(recent));
  } catch (e) {
    console.warn("Notice: LocalStorage activity cache failed:", e);
  }

  // 3. Persist locally and queue the shared tenant copy before attempting network sync.
  let savedId = activity.id;
  try {
    savedId = await addActivity(uid, activity);
  } catch (err) {
    console.error("[Timeline] Failed to log activity to IDB:", err);
  }

  if (currentUser?.uid) {
    const pending = readPendingActivities(currentUser.uid);
    if (!pending.some(item => String(item.id) === String(activity.id))) {
      pending.push(activity);
    }
    if (writePendingActivities(currentUser.uid, pending)) {
      S.timelineCloudStatus = 'pending';
      await syncPendingActivities(currentUser.uid);
    } else {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        S.timelineCloudStatus = 'partial';
        console.error('[Timeline] Could not queue activity for cloud sync because local storage is unavailable while offline.');
        return activity.id;
      }
      try {
        const saved = await saveTenantActivity(currentUser.uid, activity);
        S.timelineCloudStatus = saved ? 'synced' : 'partial';
      } catch (error) {
        S.timelineCloudStatus = 'partial';
        console.error('[Timeline] Failed to save activity to the shared audit log:', error);
      }
    }
  } else {
    S.timelineCloudStatus = 'local-only';
  }

  console.log(`[Timeline] Logged event #${savedId} [${type}] by ${userName}`);
  return savedId;
}

/**
 * Fetches all timeline activities for a single client (Kept intact for client profile!).
 * 
 * @param {number|string} clientId Client ID
 * @returns {Promise<Array>} Sorted activities (newest first)
 */
export async function getTimeline(clientId) {
  if (!hasPermission('clients.view_timeline')) return [];
  if (!currentUser) {
    // Check in-memory state if offline
    if (Array.isArray(S.globalActivities)) {
      return S.globalActivities
        .filter(a => Number(a.clientId) === Number(clientId))
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    }
    return [];
  }
  try {
    const [localList, cloudList] = await Promise.all([
      getActivities(currentUser.uid, clientId),
      getTenantActivities(currentUser.uid, clientId)
    ]);
    const stateList = Array.isArray(S.globalActivities)
      ? S.globalActivities.filter(activity => Number(activity.clientId) === Number(clientId))
      : [];
    return mergeActivities(localList || [], cloudList || [], stateList);
  } catch (err) {
    console.error(`[Timeline] Failed to get activities for client ${clientId}:`, err);
    return [];
  }
}

/**
 * Loads all CRM-wide activities for the Global Timeline view.
 * Merges Firestore, IndexedDB, and the localStorage cache for an authorized user.
 */
export async function loadGlobalActivities() {
  const uid = currentUser?.uid || 'offline-tenant';
  if (currentUser) await migrateLocalActivities(uid);
  if (!hasPermission('timeline.view')) {
    S.globalActivities = [];
    return [];
  }
  try {
    const cacheKey = `progilic_crm_activities_${uid}`;
    let cached = [];
    try {
      const raw = localStorage.getItem(cacheKey);
      if (raw) cached = JSON.parse(raw);
    } catch (e) {}

    let dbActivities = [];
    let cloudActivities = [];
    if (currentUser) {
      [dbActivities, cloudActivities] = await Promise.all([
        getActivities(currentUser.uid, null),
        getTenantActivities(currentUser.uid)
      ]);
      S.timelineCloudStatus = Array.isArray(cloudActivities) ? 'synced' : 'partial';
    }

    let merged = mergeActivities(cached || [], dbActivities || [], cloudActivities || []);

    S.globalActivities = merged;
    if (currentUser && readPendingActivities(currentUser.uid).length) {
      S.timelineCloudStatus = 'pending';
      syncPendingActivities(currentUser.uid).catch(error => console.error('[Timeline] Pending activity sync failed:', error));
    } else if (!currentUser) {
      S.timelineCloudStatus = 'local-only';
    }
    return merged;
  } catch (err) {
    console.error("Failed to load global activities:", err);
    S.timelineCloudStatus = currentUser ? 'partial' : 'local-only';
    return S.globalActivities || [];
  }
}
