/**
 * PROGILIC CRM v3 - Comprehensive Activity Timeline & Global Audit Log Service
 * Tracks, logs, filters, and exports history events across the entire CRM
 * with authenticated user attribution, timestamps, and multi-criteria querying.
 */

import { currentUser, currentStaffUser, clients, S, hasPermission, getActiveTenantId } from '../state/store.js';
import { getTenantActivities, saveTenantActivity } from '../firebase/service.js';
import { auth } from '../firebase/config.js';

const inMemoryPendingActivities = new Map();

function readPendingActivities(uid) {
  return inMemoryPendingActivities.get(uid) || [];
}

function writePendingActivities(uid, pending) {
  inMemoryPendingActivities.set(uid, pending);
  return true;
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
    // Strictly online: we don't migrate from local storage anymore as we want zero local footprint.
    // However, if there are in-memory activities from this session, we might want to ensure they are synced.
    const localActivities = []; 
    const cachedActivities = [];

    const cursor = null;
    const pendingIds = new Set(readPendingActivities(uid).map(activity => String(activity.id)));
    const legacyActivities = mergeActivities(localActivities || [], cachedActivities || [])
      .filter(activity => activity.id && activity.actorUid === uid)
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
    }
  } catch (error) {
    S.timelineCloudStatus = 'partial';
    console.error('[Timeline] Failed to migrate local history to the shared audit log:', error);
  }
}

export async function syncPendingActivities(uid = (auth && auth.currentUser && auth.currentUser.uid) || currentUser?.tenantId || currentUser?.uid || getActiveTenantId()) {
  if (!uid) return false;
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    S.timelineCloudStatus = 'pending';
    return false;
  }
  if (activitySyncPromise) return activitySyncPromise;

  activitySyncPromise = (async () => {
    const pending = readPendingActivities(uid);
    let remaining = pending;
    for (const activity of pending) {
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
  const tenantId = (auth && auth.currentUser && auth.currentUser.uid) || (currentUser && currentUser.tenantId) || (currentUser && !currentUser.isEmployee ? currentUser.uid : null) || getActiveTenantId() || 'offline-tenant';

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
    userRole = currentUser.isEmployee ? (currentUser.department || currentUser.position || 'فريق العمل') : 'المسؤول العام (Gérant)';
    userId = currentUser.employeeId || currentUser.id || (currentUser.isEmployee ? 'staff' : 'gerant');
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
    userId: String(userId),
    actorUid: tenantId,
    actorEmail: (auth && auth.currentUser && auth.currentUser.email) || currentUser?.email || '',
    source,
    meta: meta || {}
  };

  // 1. Reactive in-memory state update
  if (!Array.isArray(S.globalActivities)) {
    S.globalActivities = [];
  }
  S.globalActivities = [activity, ...S.globalActivities];
  if (S.selId && Number(activity.clientId) === Number(S.selId)) {
    if (!Array.isArray(S.clientActivities)) S.clientActivities = [];
    S.clientActivities = [activity, ...S.clientActivities];
  }

  // 2. Direct Online Cloud Persistence to Cloud Firestore
  let savedId = activity.id;
  if (tenantId && tenantId !== 'offline-tenant') {
    try {
      const saved = await saveTenantActivity(tenantId, activity);
      if (saved) {
        S.timelineCloudStatus = 'synced';
        savedId = saved;
      } else {
        S.timelineCloudStatus = 'pending';
      }
    } catch (err) {
      console.error("[Timeline] Direct online cloud write notice:", err);
      S.timelineCloudStatus = 'pending';
    }
  } else {
    S.timelineCloudStatus = 'local-only';
  }

  // Maintain in-memory store for unit test suites
  // Strictly Online: No local activity caching.

  console.log(`[Timeline] Logged event #${savedId} [${type}] by ${userName} (${userId}) under tenant ${tenantId}`);
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
    const cloudList = await getTenantActivities(currentUser.uid, clientId);
    let inMemList = [];
    const stateList = Array.isArray(S.globalActivities)
      ? S.globalActivities.filter(activity => Number(activity.clientId) === Number(clientId))
      : [];
    return mergeActivities(cloudList || [], inMemList || [], stateList);
  } catch (err) {
    console.error(`[Timeline] Failed to get activities for client ${clientId}:`, err);
    return [];
  }
}

/**
 * Loads all CRM-wide activities directly from Cloud Firestore for the Global Timeline view.
 */
export async function loadGlobalActivities() {
  const tenantId = (auth && auth.currentUser && auth.currentUser.uid) || (currentUser && currentUser.tenantId) || currentUser?.uid || getActiveTenantId() || 'offline-tenant';
  if (tenantId && tenantId !== 'offline-tenant') await migrateLocalActivities(tenantId);
  try {
    let cloudActivities = [];
    if (tenantId && tenantId !== 'offline-tenant') {
      cloudActivities = await getTenantActivities(tenantId) || [];
      S.timelineCloudStatus = Array.isArray(cloudActivities) ? 'synced' : 'partial';
    }

    let inMemActivities = [];

    let merged = mergeActivities(inMemActivities || [], cloudActivities || []);
    S.globalActivities = merged;

    if (tenantId && tenantId !== 'offline-tenant') {
      const generated = await syncCrmServicesToTimeline(tenantId);
      if (generated && generated.length > 0) {
        merged = mergeActivities(generated, merged);
        S.globalActivities = merged;
      }
    }

    return merged;
  } catch (err) {
    console.error("Failed to load global activities:", err);
    S.timelineCloudStatus = 'partial';
    return S.globalActivities || [];
  }
}

/**
 * Extracts and synchronizes all existing CRM services, software licenses,
 * support tickets, client registrations, and contacts into the Global Timeline.
 * Ensures services for Today, Yesterday, and Day Before Yesterday (as well as historical dates)
 * are fully populated and backed up to Cloud Firestore.
 */
export async function syncCrmServicesToTimeline(uid = (auth && auth.currentUser && auth.currentUser.uid) || currentUser?.tenantId || currentUser?.uid || getActiveTenantId()) {
  if (!uid) return [];
  const currentClients = Array.isArray(clients) ? clients : [];
  if (currentClients.length === 0) return [];

  const existingActivities = Array.isArray(S.globalActivities) ? S.globalActivities : [];
  const existingIds = new Set(existingActivities.map(a => String(a.id)));

  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  
  const yesterday = new Date(now.getTime() - 86400000);
  const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
  
  const dayBeforeYesterday = new Date(now.getTime() - 2 * 86400000);
  const dayBeforeYesterdayStr = `${dayBeforeYesterday.getFullYear()}-${String(dayBeforeYesterday.getMonth() + 1).padStart(2, '0')}-${String(dayBeforeYesterday.getDate()).padStart(2, '0')}`;

  const recentDates = [todayStr, yesterdayStr, dayBeforeYesterdayStr];

  const generated = [];
  let itemCounter = 0;

  function toIsoTimestamp(dateVal, fallbackIndex) {
    if (dateVal && String(dateVal).includes('T')) {
      const d = new Date(dateVal);
      if (!Number.isNaN(d.getTime())) return d.toISOString();
    }
    const cleanDate = dateVal && /^\d{4}-\d{2}-\d{2}$/.test(String(dateVal).trim())
      ? String(dateVal).trim()
      : recentDates[fallbackIndex % recentDates.length];
    
    // Distribute hours nicely throughout the day
    const hour = 9 + (fallbackIndex % 8);
    const minute = (fallbackIndex * 17) % 60;
    return `${cleanDate}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00.000Z`;
  }

  for (const c of currentClients) {
    if (!c || !c.id) continue;
    const clientName = c.fullName || c.name || `عميل #${c.id}`;

    // 1. Client Creation / Registration service
    const clientActId = `act_client_${c.id}`;
    if (!existingIds.has(clientActId)) {
      itemCounter++;
      generated.push({
        id: clientActId,
        clientId: Number(c.id),
        clientName,
        type: ActivityType.CLIENT_CREATED,
        category: 'clients',
        title: `تسجيل واعتماد العميل (${clientName})`,
        description: `تسجيل العميل في نظام PROGILIC CRM بنشاط: ${c.businessType || 'عام'} - ${c.businessField || ''}، الولاية: ${c.wilaya || 'غير محدد'}.`,
        timestamp: toIsoTimestamp(c.startDate, itemCounter),
        userName: 'المسؤول العام',
        userRole: 'الإدارة العامة (Gérant)',
        userId: 'gerant',
        actorUid: uid,
        actorEmail: currentUser?.email || '',
        source: 'crm-sync'
      });
      existingIds.add(clientActId);
    }

    // 2. Program Services (الخدمات والبرمجيات المرخصة)
    if (Array.isArray(c.programs)) {
      c.programs.forEach((p, pIdx) => {
        if (!p) return;
        const progId = p.id || `p_${pIdx}`;
        const progActId = `act_prog_${c.id}_${progId}`;
        if (!existingIds.has(progActId)) {
          itemCounter++;
          generated.push({
            id: progActId,
            clientId: Number(c.id),
            clientName,
            type: ActivityType.PROGRAM_ADDED,
            category: 'programs',
            title: `خدمة ترخيص برنامج: ${p.programName || 'برنامج PROGILIC'}`,
            description: `تقديم وتثبيت خدمة برمجية "${p.programName || 'برنامج'}" للعميل ${clientName} - المنصة: ${p.platform || 'Desktop'} - نوع الخدمة: ${p.type || 'تجاري'} - أجهزة مرخصة: ${p.installationsCount || 1} محطة ${p.startDate ? `(البداية: ${p.startDate})` : ''} ${p.endDate ? `(النهاية: ${p.endDate})` : ''}.`,
            timestamp: toIsoTimestamp(p.startDate || c.startDate, itemCounter),
            userName: 'المسؤول العام',
            userRole: 'الإدارة العامة (Gérant)',
            userId: 'gerant',
            actorUid: uid,
            actorEmail: currentUser?.email || '',
            source: 'crm-sync'
          });
          existingIds.add(progActId);
        }
      });
    }

    // 3. Technical Support & Issue Services (خدمات الصيانة والدعم الفني)
    if (Array.isArray(c.issues)) {
      c.issues.forEach((iss, iIdx) => {
        if (!iss) return;
        const issueId = iss.id || `iss_${iIdx}`;
        const issueActId = `act_issue_${c.id}_${issueId}`;
        if (!existingIds.has(issueActId)) {
          itemCounter++;
          const isResolved = iss.status === 'محلول' || iss.status === 'مغلق';
          generated.push({
            id: issueActId,
            clientId: Number(c.id),
            clientName,
            type: isResolved ? ActivityType.ISSUE_RESOLVED : ActivityType.ISSUE_ADDED,
            category: 'issues',
            title: `خدمة صيانة ودعم فني: ${iss.title || 'تذكرة دعم'}`,
            description: `معالجة مشكلة "${iss.title || 'دعم فني'}" للعميل ${clientName} - الأولوية: ${iss.priority || 'متوسطة'} - الحالة: ${iss.status || 'مفتوح'} ${iss.solution ? `(الحل المعتمد: ${iss.solution})` : ''}.`,
            timestamp: toIsoTimestamp(iss.date, itemCounter),
            userName: 'المسؤول العام',
            userRole: 'الإدارة العامة (Gérant)',
            userId: 'gerant',
            actorUid: uid,
            actorEmail: currentUser?.email || '',
            source: 'crm-sync'
          });
          existingIds.add(issueActId);
        }
      });
    }

    // 4. Contact & Field Calls (خدمات التواصل والزيارات)
    if (Array.isArray(c.contactHistory)) {
      c.contactHistory.forEach((ch, chIdx) => {
        if (!ch) return;
        const contactId = ch.id || `ch_${chIdx}`;
        const contactActId = `act_contact_${c.id}_${contactId}`;
        if (!existingIds.has(contactActId)) {
          itemCounter++;
          generated.push({
            id: contactActId,
            clientId: Number(c.id),
            clientName,
            type: ActivityType.CONTACT_ADDED,
            category: 'contacts',
            title: `خدمة تواصل ومتابعة: ${clientName}`,
            description: `تسجيل تواصل مع العميل ${clientName}: "${ch.note || 'متابعة دورية'}" بتاريخ ${ch.date || ''}.`,
            timestamp: toIsoTimestamp(ch.date || c.lastContact, itemCounter),
            userName: 'المسؤول العام',
            userRole: 'الإدارة العامة (Gérant)',
            userId: 'gerant',
            actorUid: uid,
            actorEmail: currentUser?.email || '',
            source: 'crm-sync'
          });
          existingIds.add(contactActId);
        }
      });
    }

    // 5. Requirements & Feature Requests (طلبات التطوير والخدمات الخاصة)
    if (Array.isArray(c.requirements)) {
      c.requirements.forEach((req, rIdx) => {
        if (!req) return;
        const reqId = req.id || `r_${rIdx}`;
        const reqActId = `act_req_${c.id}_${reqId}`;
        if (!existingIds.has(reqActId)) {
          itemCounter++;
          generated.push({
            id: reqActId,
            clientId: Number(c.id),
            clientName,
            type: ActivityType.REQUIREMENT_ADDED,
            category: 'requirements',
            title: `طلب ميزة وخدمة تطوير: ${req.title || 'ميزة جديدة'}`,
            description: `طلب خدمة تطوير وإضافة ميزة "${req.title || 'ميزة'}" للعميل ${clientName} - الأولوية: ${req.priority || 'متوسطة'} - الحالة: ${req.status || 'مقترح'}.`,
            timestamp: toIsoTimestamp(req.date, itemCounter),
            userName: 'المسؤول العام',
            userRole: 'الإدارة العامة (Gérant)',
            userId: 'gerant',
            actorUid: uid,
            actorEmail: currentUser?.email || '',
            source: 'crm-sync'
          });
          existingIds.add(reqActId);
        }
      });
    }
  }

  if (generated.length > 0) {
    console.log(`[Timeline] Populating ${generated.length} existing CRM services into Global Timeline and Cloud...`);
    // Merge into local in-memory state
    S.globalActivities = mergeActivities(generated, S.globalActivities || []);
    
    // Save to IDB and Cloud Firestore
    // Strictly Online: No local activity caching.
    for (const act of generated) {
      if (typeof navigator === 'undefined' || navigator.onLine) {
        saveTenantActivity(uid, act).catch(err => {
          console.warn("[Timeline] Cloud upload notice for generated service:", err);
        });
      }
    }

    // Strictly Online: No caching of activities to localStorage

    if (typeof window !== 'undefined' && window.R) {
      window.R();
    }
  }

  return generated;
}

