// Single Source of Truth - Centralized State Store with Rendering Audit Controls
import { buildSearchIndex } from '../business/searchIndex.js';

let internalState = {
  lang: 'ar',
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
  fWilaya: '',
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

// ESM Live Bindings to keep other modules up-to-date automatically
export let clients = [];
export let currentUser = null;
export let _isSyncing = false;
export let _lastSyncedTime = null;
export let _saveError = false;

// Global Audit State for Real-Time Rendering Profiling
if (!window.__renderAudit) {
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
      window.__renderAudit.fps = Math.round((frameCount * 1000) / (now - lastFrameTime));
      window.__renderAudit.fpsHistory.push(window.__renderAudit.fps);
      if (window.__renderAudit.fpsHistory.length > 30) {
        window.__renderAudit.fpsHistory.shift();
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
const RENDER_LIMIT = 10;
let renderTimestamps = [];
let isThrottled = false;

// Subscribers Set for reactivity
const subscribers = new Set();
let renderScheduled = false;

/**
 * Subscribes a callback to state changes.
 * Returns an unsubscribe function to prevent memory leaks.
 */
export function subscribe(callback) {
  if (typeof callback !== 'function') return () => {};
  subscribers.add(callback);
  return () => {
    subscribers.delete(callback);
  };
}

/**
 * Triggers all registered subscribers.
 */
function triggerSubscribers() {
  if (isThrottled) {
    console.warn("Rendering is currently throttled due to a suspected infinite render loop.");
    return;
  }

  // 1. Detect Render Loop
  const now = performance.now();
  renderTimestamps = renderTimestamps.filter(t => now - t < RENDER_WINDOW_MS);
  renderTimestamps.push(now);

  if (renderTimestamps.length > RENDER_LIMIT) {
    window.__renderAudit.renderLoopsPrevented++;
    isThrottled = true;
    console.error(`⚠️ RENDER LOOP DETECTED: Scheduled ${renderTimestamps.length} renders in ${RENDER_WINDOW_MS}ms. Throttling active to protect CPU!`);
    
    // Auto-reset throttle after 2 seconds
    setTimeout(() => {
      isThrottled = false;
      renderTimestamps = [];
      console.log("Render loop throttle reset. Back to normal.");
      scheduleRender();
    }, 2000);
    return;
  }

  // 2. Execute subscribers with auditing
  window.__isProcessingMicrotasks = true;
  window.__isRendering = true;
  const startTime = performance.now();

  for (const cb of subscribers) {
    try {
      cb();
    } catch (err) {
      console.error('State subscriber error:', err);
    }
  }

  const duration = performance.now() - startTime;
  window.__isRendering = false;
  window.__isProcessingMicrotasks = false;

  // 3. Update Audit Performance Telemetry
  window.__renderAudit.renderCount++;
  window.__renderAudit.lastRenderDurationMs = duration;
  window.__renderAudit.totalRenderDurationMs += duration;
  window.__renderAudit.avgRenderDurationMs = window.__renderAudit.totalRenderDurationMs / window.__renderAudit.renderCount;

  // Trigger a second pass to update auditor overlay, without triggering another full audit render
  const auditorOverlay = document.getElementById('render-auditor-overlay');
  if (auditorOverlay && typeof window.__updateAuditorUI === 'function') {
    window.__updateAuditorUI();
  }
}

/**
 * Microtask-batched render scheduling to completely prevent render loops
 * and eliminate unnecessary redundant renderings.
 */
export function scheduleRender() {
  if (renderScheduled) return;
  renderScheduled = true;
  Promise.resolve().then(() => {
    renderScheduled = false;
    triggerSubscribers();
  });
}

/**
 * Notifies the store to queue a render. Exposes callback-driven trigger.
 */
export function notify() {
  scheduleRender();
}

/**
 * Checks for recursive rendering risks (state modification during execution of R).
 * Defers update to next microtask and warns if state is modified inside rendering cycle.
 * @returns {boolean} true if nested rendering is detected.
 */
function handleRecursiveCheck(prop) {
  if (window.__isRendering) {
    window.__renderAudit.recursiveRendersPrevented++;
    console.warn(`⚠️ RECURSIVE RENDER WARNING: State property "${prop}" was updated inside a rendering cycle. This can trigger infinite loops! Deferring to next microtask.`);
    return true;
  }
  return false;
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
  const isDifferent = JSON.stringify(currentUser) !== JSON.stringify(newUser);
  if (!isDifferent) {
    window.__renderAudit.unnecessaryRendersPrevented++;
    return;
  }

  handleRecursiveCheck('currentUser');
  currentUser = newUser ? Object.freeze({ ...newUser }) : null;
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

export function setLoading(val) {
  if (internalState.isLoading === !!val) {
    window.__renderAudit.unnecessaryRendersPrevented++;
    return;
  }
  handleRecursiveCheck('isLoading');
  internalState = Object.freeze({ ...internalState, isLoading: !!val });
  scheduleRender();
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

/**
 * Updates properties of S in bulk or individual fields immutably.
 */
export function updateState(newState) {
  if (!newState) return;
  
  let changed = false;
  const nextState = { ...internalState };
  
  for (const key in newState) {
    if (key in internalState) {
      if (JSON.stringify(internalState[key]) !== JSON.stringify(newState[key])) {
        nextState[key] = newState[key];
        changed = true;
      }
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
    window.__renderAudit.unnecessaryRendersPrevented++;
    return;
  }

  handleRecursiveCheck(Object.keys(newState).join(', '));
  internalState = Object.freeze(nextState);
  scheduleRender();
}

// Proxy wrapper for S to allow backward-compatible direct reads and writes
// while enforcing strict predictable states and immutable updates under the hood.
export const S = new Proxy({}, {
  get(target, prop) {
    if (prop === 'clients') return clients;
    if (prop === 'currentUser') return currentUser;
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

    handleRecursiveCheck(prop);

    internalState = Object.freeze({
      ...internalState,
      [prop]: value
    });

    scheduleRender();
    return true;
  }
});
