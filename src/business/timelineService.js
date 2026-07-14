/**
 * PROGILIC CRM v3 - Client Activity Timeline Service
 * Tracks and logs history events per client for audit-ready timeline rendering.
 */

import { addActivity, getActivities } from './idbStorage.js';
import { currentUser } from '../state/store.js';

export const ActivityType = {
  CLIENT_CREATED: 'CLIENT_CREATED',
  CLIENT_EDITED: 'CLIENT_EDITED',
  CLIENT_DELETED: 'CLIENT_DELETED',
  PROGRAM_ADDED: 'PROGRAM_ADDED',
  PROGRAM_EDITED: 'PROGRAM_EDITED',
  PROGRAM_DELETED: 'PROGRAM_DELETED',
  ISSUE_ADDED: 'ISSUE_ADDED',
  ISSUE_EDITED: 'ISSUE_EDITED',
  ISSUE_RESOLVED: 'ISSUE_RESOLVED',
  ISSUE_DELETED: 'ISSUE_DELETED',
  REQUIREMENT_ADDED: 'REQUIREMENT_ADDED',
  REQUIREMENT_EDITED: 'REQUIREMENT_EDITED',
  REQUIREMENT_DELETED: 'REQUIREMENT_DELETED',
  CONTACT_ADDED: 'CONTACT_ADDED',
  CONTACT_DELETED: 'CONTACT_DELETED',
  BACKUP_RESTORED: 'BACKUP_RESTORED',
  DATA_IMPORTED: 'DATA_IMPORTED'
};

/**
 * Logs an activity event to IndexedDB for the current user and client.
 * 
 * @param {number|string} clientId The ID of the client related to this event
 * @param {string} type One of ActivityType constants
 * @param {string} title Arabic event brief title
 * @param {string} description Arabic details about the event
 * @param {string} source Source of the event ('local' | 'firestore' | 'sync' | 'import' | 'restore')
 * @param {object} meta Optional extra metadata object
 */
export async function logActivity(clientId, type, title, description, source = 'local', meta = {}) {
  if (!currentUser) {
    console.warn("[Timeline] Activity ignored - no currentUser active");
    return null;
  }

  const activity = {
    clientId: clientId ? Number(clientId) : null,
    type,
    title,
    description,
    timestamp: new Date().toISOString(),
    actorUid: currentUser.uid,
    actorEmail: currentUser.email,
    source,
    meta
  };

  try {
    const id = await addActivity(currentUser.uid, activity);
    console.log(`[Timeline] Logged activity event ${id} for client ${clientId}`);
    return id;
  } catch (err) {
    console.error("[Timeline] Failed to log activity event:", err);
    return null;
  }
}

/**
 * Fetches all timeline activities for a client.
 * 
 * @param {number|string} clientId Client ID
 * @returns {Promise<Array>} Sorted activities (newest first)
 */
export async function getTimeline(clientId) {
  if (!currentUser) return [];
  try {
    return await getActivities(currentUser.uid, clientId);
  } catch (err) {
    console.error(`[Timeline] Failed to get activities for client ${clientId}:`, err);
    return [];
  }
}

/**
 * Returns Arabic metadata mapping (icon, friendly category name, badge styling class)
 * for rendering the timeline interface beautifully.
 */
export function getActivityVisuals(type) {
  switch (type) {
    case ActivityType.CLIENT_CREATED:
      return { icon: '👤', label: 'إضافة عميل', colorClass: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' };
    case ActivityType.CLIENT_EDITED:
      return { icon: '📝', label: 'تعديل بيانات', colorClass: 'bg-blue-500/10 text-blue-500 border-blue-500/20' };
    case ActivityType.CLIENT_DELETED:
      return { icon: '🗑️', label: 'حذف العميل', colorClass: 'bg-rose-500/10 text-rose-500 border-rose-500/20' };
    case ActivityType.PROGRAM_ADDED:
      return { icon: '📦', label: 'إضافة برنامج', colorClass: 'bg-teal-500/10 text-teal-500 border-teal-500/20' };
    case ActivityType.PROGRAM_EDITED:
      return { icon: '✏️', label: 'تعديل برنامج', colorClass: 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20' };
    case ActivityType.PROGRAM_DELETED:
      return { icon: '🗑️', label: 'حذف برنامج', colorClass: 'bg-rose-500/10 text-rose-500 border-rose-500/20' };
    case ActivityType.ISSUE_ADDED:
      return { icon: '🐛', label: 'تسجيل مشكلة', colorClass: 'bg-amber-500/10 text-amber-500 border-amber-500/20' };
    case ActivityType.ISSUE_EDITED:
      return { icon: '🔧', label: 'تعديل مشكلة', colorClass: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' };
    case ActivityType.ISSUE_RESOLVED:
      return { icon: '✅', label: 'حل مشكلة', colorClass: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' };
    case ActivityType.ISSUE_DELETED:
      return { icon: '❌', label: 'حذف مشكلة', colorClass: 'bg-gray-500/10 text-gray-400 border-gray-500/10' };
    case ActivityType.REQUIREMENT_ADDED:
      return { icon: '💡', label: 'إضافة متطلب', colorClass: 'bg-purple-500/10 text-purple-500 border-purple-500/20' };
    case ActivityType.REQUIREMENT_EDITED:
      return { icon: '⚙️', label: 'تعديل متطلب', colorClass: 'bg-fuchsia-500/10 text-fuchsia-500 border-fuchsia-500/20' };
    case ActivityType.REQUIREMENT_DELETED:
      return { icon: '🗑️', label: 'حذف متطلب', colorClass: 'bg-rose-500/10 text-rose-500 border-rose-500/20' };
    case ActivityType.CONTACT_ADDED:
      return { icon: '📞', label: 'تسجيل تواصل', colorClass: 'bg-sky-500/10 text-sky-500 border-sky-500/20' };
    case ActivityType.CONTACT_DELETED:
      return { icon: '🗑️', label: 'حذف سجل تواصل', colorClass: 'bg-rose-500/10 text-rose-500 border-rose-500/20' };
    case ActivityType.BACKUP_RESTORED:
      return { icon: '🔄', label: 'استرجاع نسخة', colorClass: 'bg-violet-500/10 text-violet-500 border-violet-500/20' };
    case ActivityType.DATA_IMPORTED:
      return { icon: '📥', label: 'استيراد بيانات', colorClass: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' };
    default:
      return { icon: '🔔', label: 'تنبيه', colorClass: 'bg-slate-500/10 text-slate-400 border-slate-500/20' };
  }
}
