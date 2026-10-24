// Single Source of Truth - Centralized State Store with Rendering Audit Controls
import { buildSearchIndex } from '../business/searchIndex.js';
import { DEFAULT_STAFF_USERS, createDefaultGerant } from '../constants/index.js';
import { auth } from '../firebase/config.js';


let internalState = {
  lang: (() => {
    const savedLanguage = typeof localStorage !== 'undefined' && localStorage.getItem('crm_lang');
    return ['ar', 'fr', 'en'].includes(savedLanguage) ? savedLanguage : 'ar';
  })(),
  view: 'list',
  selId: null,
  tab: 'overview',
  modal: null,
  form: {},
  filter: 'الكل',
  q: '',
  nid: 100,
  gi: false,
  showAdvFil: false,
  showStaffManager: false,
  showStaffPortal: true,
  fWilaya: '',
  fCommune: '',
  fActivity: '',
  fActType: '',
  fProgram: '',
  conflictItem: null,
  conflictServerData: null,
  sortBy: 'id',
  sortOrder: 'desc',
  syncQueue: [],
  isLoading: false,
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  virtualScrollTop: 0,
  viewportHeight: typeof window !== 'undefined' ? window.innerHeight : 600,
  dbFilterWilaya: 'all',
  dbFilterProg: 'all',
  dbFilterTier: 'all',
  dbSearchQuery: '',
  dbSortKey: 'score',
  dbSortDir: 'desc',
  dbPage: 1,
  dbPageSize: 25,
  dbActiveTab: 'overview',
  globalActivities: [],
  timelineCloudStatus: 'local-only',
  timelineUserFilter: 'all',
  timelineDatePreset: 'all',
  timelineDateFrom: '',
  timelineDateTo: '',
  timelineCategoryFilter: 'all',
  timelineSearch: '',
  stats: {
    activeClients: 0,
    prospectiveClients: 0,
    stoppedClients: 0,
    totalClients: 0,
    totalPrograms: 0,
    totalLicensedDevices: 0,
    averageScore: 100,
    totalOpenIssues: 0
  }
};


let initialUser = null;
try {
  const isLoggedOut = typeof localStorage !== 'undefined' && localStorage.getItem('crm_logged_out') === '1';
  if (!isLoggedOut) {
    const rawUser = localStorage.getItem('crm_active_gerant_user');
    if (rawUser) {
      initialUser = JSON.parse(rawUser);
    }
  }
} catch (e) {
  initialUser = null;
}

// ESM Live Bindings to keep other modules up-to-date automatically
export let clients = [];
export let currentUser = initialUser;
export let staffUsers = [];
export let currentStaffUser = null;
export let _isSyncing = false;
export let _lastSyncedTime = null;
export let _saveError = false;

// Global Audit State for Real-Time Rendering Profiling
if (typeof window !== 'undefined' && !window.__renderAudit) {
  window.__renderAudit = {
    renderCount: 0,
    unnecessaryRendersPrevented: 0,
    recursiveRendersPrevented: 0,
    renderLoopsPrevented: 0,
    lastRenderDurationMs: 0,
    totalRenderDurationMs: 0,
    avgRenderDurationMs: 0,
    domNodesReused: 0,
    domNodesRecreated: 0,
    fps: 60,
    fpsHistory: [],
    showAuditorUI: false
  };

  // FPS Tracker
  let lastFrameTime = performance.now();
  let frameCount = 0;
  const tickFPS = () => {
    const now = performance.now();
    frameCount++;
    if (now > lastFrameTime + 1000) {
      if (window.__renderAudit) {
        window.__renderAudit.fps = Math.round((frameCount * 1000) / (now - lastFrameTime));
        window.__renderAudit.fpsHistory.push(window.__renderAudit.fps);
        if (window.__renderAudit.fpsHistory.length > 30) {
          window.__renderAudit.fpsHistory.shift();
        }
      }
      frameCount = 0;
      lastFrameTime = now;
    }
    requestAnimationFrame(tickFPS);
  };
  requestAnimationFrame(tickFPS);
}

// Render Loop & Throttling Parameters
const RENDER_WINDOW_MS = 200;
const RENDER_LIMIT = 25;
let renderTimestamps = [];
let isThrottled = false;
let throttleTimer = null;
export let isBatching = false;
const subscribers = new Set();
let renderScheduled = false;

function executeSubscribers() {
  if (typeof window !== 'undefined') {
    window.__isProcessingMicrotasks = true;
    window.__isRendering = true;
  }
  const startTime = typeof performance !== 'undefined' ? performance.now() : Date.now();

  for (const cb of subscribers) {
    try {
      cb();
    } catch (err) {
      console.error('State subscriber error:', err);
    }
  }

  const duration = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - startTime;
  if (typeof window !== 'undefined') {
    window.__isRendering = false;
    window.__isProcessingMicrotasks = false;
    if (window.__renderAudit) {
      window.__renderAudit.renderCount++;
      window.__renderAudit.lastRenderDurationMs = duration;
      window.__renderAudit.totalRenderDurationMs += duration;
      window.__renderAudit.avgRenderDurationMs = window.__renderAudit.totalRenderDurationMs / window.__renderAudit.renderCount;
    }
    const auditorOverlay = document.getElementById('render-auditor-overlay');
    if (auditorOverlay && typeof window.__updateAuditorUI === 'function') {
      window.__updateAuditorUI();
    }
  }
}

function triggerSubscribers() {
  const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
  renderTimestamps = renderTimestamps.filter(t => now - t < RENDER_WINDOW_MS);
  renderTimestamps.push(now);

  if (renderTimestamps.length > RENDER_LIMIT) {
    if (typeof window !== 'undefined' && window.__renderAudit) {
      window.__renderAudit.renderLoopsPrevented++;
    }
    if (!isThrottled) {
      console.warn(`Render throttling activated: ${renderTimestamps.length} renders in ${RENDER_WINDOW_MS}ms. Coalescing via debounced frame.`);
      isThrottled = true;
    }
    if (throttleTimer) clearTimeout(throttleTimer);
    throttleTimer = setTimeout(() => {
      isThrottled = false;
      renderTimestamps = [];
      executeSubscribers();
    }, 80);
    return;
  }

  executeSubscribers();
}

export function scheduleRender() {
  if (isBatching) return;
  if (renderScheduled) return;
  renderScheduled = true;
  Promise.resolve().then(() => {
    renderScheduled = false;
    triggerSubscribers();
  });
}

export function notify() {
  scheduleRender();
}

export function batch(fn) {
  isBatching = true;
  try {
    fn();
  } finally {
    isBatching = false;
    scheduleRender();
  }
}

export function subscribe(callback) {
  if (typeof callback !== 'function') return () => {};
  subscribers.add(callback);
  return () => {
    subscribers.delete(callback);
  };
}

function handleRecursiveCheck(prop, updateFn) {
  if (typeof window !== 'undefined' && window.__isRendering) {
    if (window.__renderAudit) window.__renderAudit.recursiveRendersPrevented++;
    console.warn(`⚠️ RECURSIVE RENDER WARNING: State property "${prop}" was updated inside a rendering cycle. Deferring to next microtask.`);
    if (typeof updateFn === 'function') {
      Promise.resolve().then(updateFn);
    }
    return true;
  }
  return false;
}

export function updateState(newState) {
  if (!newState) return;
  
  let changed = false;
  const nextState = { ...internalState };
  
  for (const key in newState) {
    if (JSON.stringify(internalState[key]) !== JSON.stringify(newState[key])) {
      nextState[key] = newState[key];
      changed = true;
    }
  }

  // Handle live bindings in state merge
  if ('clients' in newState && JSON.stringify(clients) !== JSON.stringify(newState.clients)) {
    clients = Object.freeze(Array.isArray(newState.clients) ? [...newState.clients] : []);
    changed = true;
  }
  if ('currentUser' in newState && JSON.stringify(currentUser) !== JSON.stringify(newState.currentUser)) {
    currentUser = newState.currentUser ? Object.freeze({ ...newState.currentUser }) : null;
    changed = true;
  }
  if ('staffUsers' in newState && JSON.stringify(staffUsers) !== JSON.stringify(newState.staffUsers)) {
    staffUsers = Array.isArray(newState.staffUsers) ? [...newState.staffUsers] : [];
    changed = true;
  }
  if ('currentStaffUser' in newState && JSON.stringify(currentStaffUser) !== JSON.stringify(newState.currentStaffUser)) {
    currentStaffUser = newState.currentStaffUser ? Object.freeze({ ...newState.currentStaffUser }) : null;
    changed = true;
  }
  if ('_isSyncing' in newState && _isSyncing !== !!newState._isSyncing) {
    _isSyncing = !!newState._isSyncing;
    changed = true;
  }
  if ('_lastSyncedTime' in newState && String(_lastSyncedTime) !== String(newState._lastSyncedTime)) {
    _lastSyncedTime = newState._lastSyncedTime;
    changed = true;
  }
  if ('_saveError' in newState && _saveError !== !!newState._saveError) {
    _saveError = !!newState._saveError;
    changed = true;
  }

  if (!changed) {
    if (typeof window !== 'undefined' && window.__renderAudit) {
      window.__renderAudit.unnecessaryRendersPrevented++;
    }
    return;
  }

  if (handleRecursiveCheck(Object.keys(newState).join(', '), () => {
    internalState = Object.freeze(nextState);
    scheduleRender();
  })) {
    return;
  }
  internalState = Object.freeze(nextState);
  scheduleRender();
}

export function getActiveTenantId() {
  if (currentUser && currentUser.uid) return currentUser.uid;
  if (auth && auth.currentUser && auth.currentUser.uid) return auth.currentUser.uid;
  return null;
}

export function getTenantStaffStorageKey(tenantId) {
  const tid = tenantId || getActiveTenantId();
  return tid ? `crm_staff_users_${tid}` : 'crm_staff_users_guest';
}

export function getTenantCurrentStaffKey(tenantId) {
  const tid = tenantId || getActiveTenantId();
  return tid ? `crm_current_staff_${tid}` : 'crm_current_staff_guest';
}

export function loadStaffUsersForTenant(tenantId, userObj = currentUser, silent = false) {
  const tid = tenantId || getActiveTenantId();
  if (!tid) {
    staffUsers = [];
    currentStaffUser = null;
    if (silent) {
      internalState = Object.freeze({ ...internalState, staffUsers: [], currentStaffUser: null });
    } else {
      updateState({ staffUsers: [], currentStaffUser: null });
    }
    return [];
  }

  const key = getTenantStaffStorageKey(tid);
  let localStaff = null;
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        localStaff = parsed;
      }
    }
  } catch (e) {}

  if (!localStaff) {
    const defaultGerant = createDefaultGerant(tid, userObj?.displayName || userObj?.email?.split('@')[0] || 'المدير العام (GERANT)');
    defaultGerant.adminEmail = userObj?.email || '';
    localStaff = [ defaultGerant ];
    try {
      localStorage.setItem(key, JSON.stringify(localStaff));
    } catch(e) {}
  }

  staffUsers = localStaff;

  const staffKey = getTenantCurrentStaffKey(tid);
  try {
    const rawStaff = localStorage.getItem(staffKey);
    if (rawStaff) {
      const parsed = JSON.parse(rawStaff);
      const matched = staffUsers.find(s => s.id === parsed.id);
      currentStaffUser = matched || null;
    } else {
      currentStaffUser = null;
    }
  } catch (e) {
    currentStaffUser = null;
  }

  if (silent) {
    internalState = Object.freeze({ ...internalState, staffUsers, currentStaffUser });
  } else {
    updateState({ staffUsers, currentStaffUser });
  }
  return staffUsers;
}

// Initial hydration if already logged in (silent to prevent early render loops)
if (initialUser && initialUser.uid) {
  loadStaffUsersForTenant(initialUser.uid, initialUser, true);
}

export function setStaffUsers(users, tenantId) {
  const tid = tenantId || getActiveTenantId();
  const safeUsers = Array.isArray(users) ? users : [];
  staffUsers = safeUsers;
  if (tid) {
    try {
      localStorage.setItem(getTenantStaffStorageKey(tid), JSON.stringify(safeUsers));
    } catch (e) {}
  }
  updateState({ staffUsers });
}

export function setCurrentStaffUser(staff, tenantId) {
  const tid = tenantId || getActiveTenantId();
  currentStaffUser = staff ? { ...staff } : null;
  if (tid) {
    try {
      if (currentStaffUser) {
        localStorage.setItem(getTenantCurrentStaffKey(tid), JSON.stringify(currentStaffUser));
      } else {
        localStorage.removeItem(getTenantCurrentStaffKey(tid));
      }
    } catch (e) {}
  }
  updateState({ currentStaffUser });
}

export function hasPermission(perm) {
  const staff = currentStaffUser || (currentUser && currentUser.isEmployee ? currentUser : null);
  if (!staff) {
    if (currentUser && (currentUser.role === 'gerant' || currentUser.email === 'admin@progilic.dz' || !currentUser.isEmployee)) {
      return true;
    }
    return false;
  }
  // The President / General Manager (Gérant) always possesses all permissions
  if (staff.role?.toUpperCase() === 'GERANT' || staff.id === 'gerant' || staff.id === 'gerant-1') {
    return true;
  }
  
  const perms = staff.permissions || {};

  // 1. Exact canonical permission check (Boolean true or false)
  // If explicitly set on the employee profile, this is the definitive, authoritative source of truth!
  if (typeof perms[perm] === 'boolean') {
    return perms[perm];
  }

  // 2. Legacy fallback ONLY if the granular permission is not defined on perms
  const dotToCamel = {
    'clients.view': 'canViewClients',
    'clients.create': 'canAddClients',
    'clients.edit': 'canEditClients',
    'clients.delete': 'canDeleteClients',
    'clients.export': 'canExportData',
    'clients.manage_status': 'canEditClients',
    'programs.view': 'canManagePrograms',
    'programs.create': 'canManagePrograms',
    'programs.edit': 'canManagePrograms',
    'programs.delete': 'canManagePrograms',
    'programs.manage_licenses': 'canManageLicenses',
    'programs.view_licenses': 'canManageLicenses',
    'programs.view_installations': 'canManagePrograms',
    'issues.view': 'canManageIssues',
    'issues.create': 'canManageIssues',
    'issues.edit': 'canManageIssues',
    'issues.delete': 'canManageIssues',
    'issues.resolve': 'canManageIssues',
    'issues.change_status': 'canManageIssues',
    'features.view': 'canManageRequirements',
    'features.create': 'canManageRequirements',
    'features.edit': 'canManageRequirements',
    'features.delete': 'canManageRequirements',
    'features.change_status': 'canManageRequirements',
    'contacts.view_history': 'canManageContacts',
    'contacts.create_entry': 'canManageContacts',
    'contacts.edit_entry': 'canManageContacts',
    'contacts.delete_entry': 'canManageContacts',
    'dashboard.view': 'canViewDashboard',
    'reports.view': 'canViewDashboard',
    'reports.export': 'canExportData',
    'analytics.view': 'canAccessAi',
    'users.view': 'canManageEmployees',
    'users.create': 'canManageEmployees',
    'users.edit': 'canManageEmployees',
    'users.disable': 'canManageEmployees',
    'users.delete': 'canDeleteEmployees',
    'departments.view': 'canManageEmployees',
    'departments.create': 'canManageEmployees',
    'departments.edit': 'canManageEmployees',
    'departments.delete': 'canDeleteEmployees',
    'permissions.view': 'canManageEmployees',
    'permissions.assign': 'canManageEmployees',
    'permissions.revoke': 'canManageEmployees',
    'backup.view': 'canManageBackups',
    'backup.create': 'canManageBackups',
    'backup.download': 'canManageBackups',
    'backup.restore': 'canManageBackups',
    'backup.delete': 'canManageBackups'
  };

  const camelToDot = {
    'canViewClients': 'clients.view',
    'canAddClients': 'clients.create',
    'canEditClients': 'clients.edit',
    'canDeleteClients': 'clients.delete',
    'canExportData': 'clients.export',
    'canManagePrograms': 'programs.view',
    'canManageLicenses': 'programs.manage_licenses',
    'canManageIssues': 'issues.view',
    'canManageRequirements': 'features.view',
    'canManageContacts': 'contacts.view_history',
    'canViewDashboard': 'dashboard.view',
    'canManageEmployees': 'users.view',
    'canDeleteEmployees': 'users.delete',
    'canAccessAi': 'analytics.view',
    'canManageBackups': 'backup.view'
  };

  if (dotToCamel[perm] && typeof perms[dotToCamel[perm]] === 'boolean') {
    return perms[dotToCamel[perm]];
  }
  if (camelToDot[perm] && typeof perms[camelToDot[perm]] === 'boolean') {
    return perms[camelToDot[perm]];
  }

  return false;
}

export function isGerant() {
  if (currentStaffUser) {
    return currentStaffUser.role?.toUpperCase() === 'GERANT' || currentStaffUser.id === 'gerant' || currentStaffUser.id === 'gerant-1';
  }
  if (currentUser && (currentUser.role === 'gerant' || currentUser.email === 'admin@progilic.dz' || !currentUser.isEmployee)) {
    return true;
  }
  return false;
}

if (typeof window !== 'undefined') {
  window.setCurrentStaffUser = setCurrentStaffUser;
  window.setCurrentUser = setCurrentUser;
  window.hasPermission = hasPermission;
  window.isGerant = isGerant;
}


// Getters and Setters ensuring immutable state updates and single source of truth
export function setClients(newClients) {
  const isDifferent = clients !== newClients && JSON.stringify(clients) !== JSON.stringify(newClients);
  if (!isDifferent) {
    window.__renderAudit.unnecessaryRendersPrevented++;
    return;
  }
  
  handleRecursiveCheck('clients');
  clients = Object.freeze(Array.isArray(newClients) ? [...newClients] : []);
  buildSearchIndex(clients);
  scheduleRender();
}

export function setCurrentUser(newUser) {
  if (newUser && !newUser.uid) {
    newUser = { ...newUser, uid: (auth && auth.currentUser && auth.currentUser.uid) || null };
  }
  const isDifferent = JSON.stringify(currentUser) !== JSON.stringify(newUser);
  if (!isDifferent) {
    window.__renderAudit.unnecessaryRendersPrevented++;
    return;
  }

  handleRecursiveCheck('currentUser');
  currentUser = newUser ? Object.freeze({ ...newUser }) : null;
  if (currentUser && currentUser.uid) {
    loadStaffUsersForTenant(currentUser.uid, currentUser);
  } else {
    staffUsers = [];
    currentStaffUser = null;
    updateState({ staffUsers: [], currentStaffUser: null });
  }
  scheduleRender();
}

export function setSyncing(val) {
  if (_isSyncing === !!val) {
    window.__renderAudit.unnecessaryRendersPrevented++;
    return;
  }

  handleRecursiveCheck('_isSyncing');
  _isSyncing = !!val;
  scheduleRender();
}

export function setLastSyncedTime(val) {
  const nextTime = val instanceof Date ? val : val ? new Date(val) : null;
  const isDifferent = String(_lastSyncedTime) !== String(nextTime);
  if (!isDifferent) {
    window.__renderAudit.unnecessaryRendersPrevented++;
    return;
  }

  handleRecursiveCheck('_lastSyncedTime');
  _lastSyncedTime = nextTime;
  scheduleRender();
}

let loadingSafetyTimer = null;

export function setLoading(val) {
  if (loadingSafetyTimer) {
    clearTimeout(loadingSafetyTimer);
    loadingSafetyTimer = null;
  }

  if (internalState.isLoading === !!val) {
    window.__renderAudit.unnecessaryRendersPrevented++;
    return;
  }
  handleRecursiveCheck('isLoading');
  internalState = Object.freeze({ ...internalState, isLoading: !!val });
  scheduleRender();

  // Safety watchdog: Automatically release loading state after 1.5 seconds max
  // to ensure users never get stuck on skeleton placeholders under any network conditions
  if (val) {
    loadingSafetyTimer = setTimeout(() => {
      if (internalState.isLoading) {
        console.warn("[Store] Loading watchdog triggered: auto-releasing S.isLoading.");
        internalState = Object.freeze({ ...internalState, isLoading: false });
        scheduleRender();
      }
    }, 1500);
  }
}

export function setSaveError(val) {
  if (_saveError === !!val) {
    window.__renderAudit.unnecessaryRendersPrevented++;
    return;
  }

  handleRecursiveCheck('_saveError');
  _saveError = !!val;
  scheduleRender();
}

// Proxy wrapper for S to allow backward-compatible direct reads and writes
// while enforcing strict predictable states and immutable updates under the hood.
export const S = new Proxy({}, {
  get(target, prop) {
    if (prop === 'clients') return clients;
    if (prop === 'currentUser') return currentUser;
    if (prop === 'staffUsers') return staffUsers;
    if (prop === 'currentStaffUser') return currentStaffUser;
    if (prop === '_isSyncing') return _isSyncing;
    if (prop === '_lastSyncedTime') return _lastSyncedTime;
    if (prop === '_saveError') return _saveError;
    return internalState[prop];
  },
  set(target, prop, value) {
    if (prop === 'clients') {
      setClients(value);
      return true;
    }
    if (prop === 'currentUser') {
      setCurrentUser(value);
      return true;
    }
    if (prop === 'staffUsers') {
      setStaffUsers(value);
      return true;
    }
    if (prop === 'currentStaffUser') {
      setCurrentStaffUser(value);
      return true;
    }
    if (prop === '_isSyncing') {
      setSyncing(value);
      return true;
    }
    if (prop === '_lastSyncedTime') {
      setLastSyncedTime(value);
      return true;
    }
    if (prop === '_saveError') {
      setSaveError(value);
      return true;
    }

    if (JSON.stringify(internalState[prop]) === JSON.stringify(value)) {
      window.__renderAudit.unnecessaryRendersPrevented++;
      return true;
    }

    if (handleRecursiveCheck(prop, () => {
      internalState = Object.freeze({
        ...internalState,
        [prop]: value
      });
      scheduleRender();
    })) {
      return true;
    }

    internalState = Object.freeze({
      ...internalState,
      [prop]: value
    });

    scheduleRender();
    return true;
  }
});
