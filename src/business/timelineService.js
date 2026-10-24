/**
 * PROGILIC CRM v3 - Comprehensive Activity Timeline & Global Audit Log Service
 * Tracks, logs, filters, and exports history events across the entire CRM
 * with authenticated user attribution, timestamps, and multi-criteria querying.
 */

import { addActivity, getActivities } from './idbStorage.js';
import { currentUser, currentStaffUser, clients, S } from '../state/store.js';

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
    case ActivityType.DATA_IMPORTED:
      return { icon: '📥', label: 'استيراد بيانات', category: 'backup', colorClass: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' };
    case ActivityType.DATA_EXPORTED:
      return { icon: '📊', label: 'تصدير بيانات CSV', category: 'backup', colorClass: 'bg-blue-500/10 text-blue-500 border-blue-500/20' };

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
 * Logs an activity event to IndexedDB, memory, and localStorage.
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
    id: Date.now() + Math.floor(Math.random() * 1000),
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

  // 3. Persist to IndexedDB
  try {
    const savedId = await addActivity(uid, activity);
    console.log(`[Timeline] Logged event #${savedId} [${type}] by ${userName}`);
    return savedId;
  } catch (err) {
    console.error("[Timeline] Failed to log activity to IDB:", err);
    return activity.id;
  }
}

/**
 * Fetches all timeline activities for a single client (Kept intact for client profile!).
 * 
 * @param {number|string} clientId Client ID
 * @returns {Promise<Array>} Sorted activities (newest first)
 */
export async function getTimeline(clientId) {
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
    const list = await getActivities(currentUser.uid, clientId);
    if ((!list || list.length === 0) && Array.isArray(S.globalActivities)) {
      return S.globalActivities
        .filter(a => Number(a.clientId) === Number(clientId))
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    }
    return list;
  } catch (err) {
    console.error(`[Timeline] Failed to get activities for client ${clientId}:`, err);
    return [];
  }
}

/**
 * Loads all CRM-wide activities for the Global Timeline view.
 * Merges IndexedDB with localStorage cache, or generates baseline history if initial run.
 */
export async function loadGlobalActivities() {
  const uid = currentUser?.uid || 'offline-tenant';
  try {
    const cacheKey = `progilic_crm_activities_${uid}`;
    let cached = [];
    try {
      const raw = localStorage.getItem(cacheKey);
      if (raw) cached = JSON.parse(raw);
    } catch (e) {}

    let dbActivities = [];
    if (currentUser) {
      dbActivities = await getActivities(currentUser.uid, null);
    }

    // Merge cached + db activities deduplicating
    const map = new Map();
    (cached || []).forEach(a => {
      const key = a.id || (a.timestamp + '-' + a.type + '-' + (a.clientId || '0'));
      map.set(key, a);
    });
    (dbActivities || []).forEach(a => {
      const key = a.id || (a.timestamp + '-' + a.type + '-' + (a.clientId || '0'));
      map.set(key, a);
    });

    let merged = Array.from(map.values());

    // If completely empty and clients exist, synthesize realistic baseline activities from client records
    if (merged.length === 0 && Array.isArray(clients) && clients.length > 0) {
      merged = generateBaselineActivities(clients, S.staffUsers || []);
      try {
        localStorage.setItem(cacheKey, JSON.stringify(merged));
      } catch (e) {}
    }

    merged.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    S.globalActivities = merged;
    return merged;
  } catch (err) {
    console.error("Failed to load global activities:", err);
    return S.globalActivities || [];
  }
}

/**
 * Generates an initial baseline history from existing client datasets so the
 * timeline exhibits authentic history right after startup.
 */
function generateBaselineActivities(clientsList, staffList) {
  const activities = [];
  const staffNames = (staffList || []).map(s => ({
    name: s.name || s.fullName,
    role: s.department || s.position || 'فريق العمل',
    id: s.id
  }));
  if (staffNames.length === 0) {
    staffNames.push({ name: 'المسؤول العام', role: 'الإدارة العامة (Gérant)', id: 'gerant' });
  }

  clientsList.forEach((c, cIdx) => {
    const assignedUser = staffNames[cIdx % staffNames.length];
    const clientDate = c.startDate || new Date(Date.now() - (cIdx + 1) * 86400000 * 3).toISOString();

    // 1. Client Creation Event
    activities.push({
      id: 10000 + c.id * 10 + 1,
      clientId: c.id,
      clientName: c.fullName,
      type: ActivityType.CLIENT_CREATED,
      category: 'clients',
      title: 'تسجيل وإنشاء حساب العميل',
      description: `تم إدراج العميل "${c.fullName}" بنجاح في قاعدة البيانات (${c.wilaya} - ${c.businessType || 'نشاط تجاري'}).`,
      timestamp: clientDate.includes('T') ? clientDate : `${clientDate}T09:30:00.000Z`,
      userName: assignedUser.name,
      userRole: assignedUser.role,
      userId: assignedUser.id,
      source: 'baseline'
    });

    // 2. Program Additions
    (c.programs || []).forEach((p, pIdx) => {
      activities.push({
        id: 10000 + c.id * 10 + 2 + pIdx,
        clientId: c.id,
        clientName: c.fullName,
        type: ActivityType.PROGRAM_ADDED,
        category: 'programs',
        title: 'اعتماد وتثبيت ترخيص البرنامج',
        description: `تم ترخيص وتثبيت برنامج "${p.programName}" على ${p.installationsCount || 1} أجهزة للعميل.`,
        timestamp: p.startDate ? (p.startDate.includes('T') ? p.startDate : `${p.startDate}T11:15:00.000Z`) : clientDate,
        userName: assignedUser.name,
        userRole: assignedUser.role,
        userId: assignedUser.id,
        source: 'baseline'
      });
    });

    // 3. Issue Reports & Resolutions
    (c.issues || []).forEach((iss, iIdx) => {
      activities.push({
        id: 10000 + c.id * 10 + 5 + iIdx,
        clientId: c.id,
        clientName: c.fullName,
        type: iss.status === 'محلول' ? ActivityType.ISSUE_RESOLVED : ActivityType.ISSUE_ADDED,
        category: 'issues',
        title: iss.status === 'محلول' ? 'معالجة وإغلاق مشكلة تقنية' : 'تسجيل تذكرة دعم فني',
        description: iss.status === 'محلول' 
          ? `تم حل التذكرة "${iss.title}" بنجاح. الحل: ${iss.solution || 'تم تقديم الدعم الفني وتحديث الإعدادات.'}`
          : `تم فتح تذكرة جديدة بعنوان "${iss.title}" بأولوية ${iss.priority || 'متوسطة'}.`,
        timestamp: iss.date ? (iss.date.includes('T') ? iss.date : `${iss.date}T14:20:00.000Z`) : clientDate,
        userName: assignedUser.name,
        userRole: assignedUser.role,
        userId: assignedUser.id,
        source: 'baseline'
      });
    });

    // 4. Contact Logs
    (c.contactHistory || []).forEach((cnt, cntIdx) => {
      activities.push({
        id: 10000 + c.id * 10 + 8 + cntIdx,
        clientId: c.id,
        clientName: c.fullName,
        type: ActivityType.CONTACT_ADDED,
        category: 'contacts',
        title: 'تسجيل تواصل ومتابعة هاتفية',
        description: `تم التواصل مع العميل: "${cnt.note || 'متابعة دورية ومراجعة جودة الخدمة'}"`,
        timestamp: cnt.date ? (cnt.date.includes('T') ? cnt.date : `${cnt.date}T16:00:00.000Z`) : clientDate,
        userName: assignedUser.name,
        userRole: assignedUser.role,
        userId: assignedUser.id,
        source: 'baseline'
      });
    });
  });

  return activities;
}
