import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const fsHarness = vi.hoisted(() => {
  const listeners = new Map();
  let seq = 0;

  return {
    listeners,
    nextId: () => ++seq,
    clear() {
      listeners.clear();
      seq = 0;
    },
    register(path, onNext, onError) {
      const id = `sub_${++seq}`;
      const unsub = vi.fn(() => {
        listeners.delete(id);
      });
      listeners.set(id, { id, path, onNext, onError, unsub });
      return unsub;
    },
    byPath(fragment) {
      return [...listeners.values()].filter(l => l.path.includes(fragment));
    }
  };
});

const svcMocks = vi.hoisted(() => ({
  getUserDataStrict: vi.fn(),
  saveUserData: vi.fn(),
  getClientSubcollections: vi.fn(),
  subscribeClientSubcollections: vi.fn(),
  subscribeEmployeesForTenant: vi.fn(),
  subscribeTenantActivities: vi.fn(),
  addClientTransaction: vi.fn(),
  updateClientTransaction: vi.fn(),
  deleteClientTransaction: vi.fn(),
  saveClientSubItemTransaction: vi.fn(),
  deleteClientSubItemTransaction: vi.fn(),
  saveEmployeeForTenant: vi.fn(),
  deleteEmployeeForTenant: vi.fn(),
  getTenantActivities: vi.fn(),
  saveTenantActivity: vi.fn()
}));

const authState = vi.hoisted(() => ({
  currentUser: { uid: 'tenant-A', email: 'gerantA@progilic.dz', emailVerified: true }
}));

vi.mock('firebase/firestore', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    doc: vi.fn((_db, ...segments) => ({ path: segments.join('/') })),
    collection: vi.fn((_db, ...segments) => ({ path: segments.join('/') })),
    onSnapshot: vi.fn((targetRef, optsOrNext, onNextOrError, maybeError) => {
      const onNext = typeof optsOrNext === 'function' ? optsOrNext : onNextOrError;
      const onError = typeof optsOrNext === 'function' ? onNextOrError : maybeError;
      return fsHarness.register(targetRef?.path || 'unknown', onNext, onError);
    }),
    writeBatch: vi.fn(() => ({ set: vi.fn(), delete: vi.fn(), commit: vi.fn().mockResolvedValue(true) }))
  };
});

vi.mock('../../src/firebase/config.js', () => ({
  db: { __mockDb: true },
  auth: authState
}));

vi.mock('../../src/firebase/service.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    getUserDataStrict: svcMocks.getUserDataStrict,
    saveUserData: svcMocks.saveUserData,
    getClientSubcollections: svcMocks.getClientSubcollections,
    subscribeClientSubcollections: svcMocks.subscribeClientSubcollections,
    subscribeEmployeesForTenant: svcMocks.subscribeEmployeesForTenant,
    subscribeTenantActivities: svcMocks.subscribeTenantActivities,
    addClientTransaction: svcMocks.addClientTransaction,
    updateClientTransaction: svcMocks.updateClientTransaction,
    deleteClientTransaction: svcMocks.deleteClientTransaction,
    saveClientSubItemTransaction: svcMocks.saveClientSubItemTransaction,
    deleteClientSubItemTransaction: svcMocks.deleteClientSubItemTransaction,
    saveEmployeeForTenant: svcMocks.saveEmployeeForTenant,
    deleteEmployeeForTenant: svcMocks.deleteEmployeeForTenant,
    getTenantActivities: svcMocks.getTenantActivities,
    saveTenantActivity: svcMocks.saveTenantActivity
  };
});

vi.mock('../../src/utils/toast.js', () => ({
  showToast: vi.fn()
}));

import {
  startRealtimeSync,
  stopRealtimeSync,
  startClientDetailSync,
  stopClientDetailSync,
  loadDataFromFirestore,
  commitOnlineMutation,
  reconnectRealtimeSync,
  handleFirestoreQuotaExceeded,
  resolveConflict
} from '../../src/business/storage.js';
import { selClient } from '../../src/business/actions/clientActions.js';
import { goBack, setView } from '../../src/business/actions/uiActions.js';
import { S, clients, setClients, setCurrentUser, setCurrentStaffUser, updateState, resetTenantSessionState } from '../../src/state/store.js';
import { renderDashboard } from '../../src/presentation/render-views.js';

function makeClientDoc(data) {
  return {
    id: String(data.id),
    data: () => ({ ...data })
  };
}

describe('CRM Strict Online-Only Real-Time Architecture', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fsHarness.clear();
    stopRealtimeSync();
    resetTenantSessionState();
    authState.currentUser = { uid: 'tenant-A', email: 'gerantA@progilic.dz', emailVerified: true };
    setCurrentUser({ uid: 'tenant-A', email: 'gerantA@progilic.dz', role: 'gerant', isEmployee: false });
    setCurrentStaffUser(null);
    updateState({ isOnline: true, quotaExceeded: false, dataIsStale: false });

    svcMocks.subscribeEmployeesForTenant.mockImplementation((tenantId, onUpdate, onError) => {
      return fsHarness.register(`users/${tenantId}/employees`, onUpdate, onError);
    });
    svcMocks.subscribeTenantActivities.mockImplementation((tenantId, _limit, onUpdate, onError) => {
      return fsHarness.register(`users/${tenantId}/activities`, onUpdate, onError);
    });
    svcMocks.subscribeClientSubcollections.mockImplementation((tenantId, clientId, onUpdate, onError) => {
      return fsHarness.register(`users/${tenantId}/clients/${clientId}/subcollections`, onUpdate, onError);
    });
    svcMocks.getTenantActivities.mockResolvedValue([]);
    svcMocks.getClientSubcollections.mockResolvedValue({
      programs: [],
      issues: [],
      requirements: [],
      contactHistory: []
    });
    svcMocks.saveUserData.mockResolvedValue(true);
    svcMocks.saveEmployeeForTenant.mockResolvedValue(true);
    svcMocks.saveTenantActivity.mockResolvedValue('act-1');
  });

  afterEach(() => {
    stopRealtimeSync();
    resetTenantSessionState();
  });

  it('delivers simultaneous Employee A create and Employee B edit incrementally via onSnapshot without manual refresh', () => {
    startRealtimeSync('tenant-A');

    // Should attach exactly 4 tenant-level listeners (user profile, clients, employees, bounded activities)
    expect(fsHarness.byPath('users/tenant-A').length).toBe(4);
    expect(svcMocks.subscribeTenantActivities).toHaveBeenCalledWith('tenant-A', 200, expect.any(Function), expect.any(Function));
    expect(svcMocks.getClientSubcollections).not.toHaveBeenCalled();

    const clientsSub = fsHarness.byPath('users/tenant-A/clients')[0];
    expect(clientsSub).toBeDefined();

    // Initial server snapshot with 1 confirmed client
    const initialClient = {
      id: 101, fullName: 'شركة النور', status: 'نشط', wilaya: 'الجزائر', version: 1,
      programsCount: 2, installationsCount: 5, programNames: ['PROGILIC ERP V27', 'Mobile - التاجر'],
      openIssuesCount: 1, urgentIssuesCount: 1, solvedIssuesCount: 2,
      issuesByPriority: { عاجل: 1, عالية: 0, متوسطة: 0, منخفضة: 0 },
      requirementsCount: 3, reqsByStatus: { مقترح: 1, 'قيد الدراسة': 1, مخطط: 1, منفذ: 0 },
      contactsCount: 4, score: 82
    };
    clientsSub.onNext({
      empty: false,
      metadata: { fromCache: false },
      docs: [makeClientDoc(initialClient)],
      docChanges: () => [{ type: 'added', doc: makeClientDoc(initialClient) }]
    });

    expect(clients.length).toBe(1);
    expect(S.hasConfirmedServerSync).toBe(true);
    expect(S.connectionState).toBe('live');

    // Employee A creates client 102 remotely -> incremental docChanges() 'added'
    const employeeACreated = {
      id: 102, fullName: 'مؤسسة الأمل (Employee A)', status: 'محتمل', wilaya: 'وهران', version: 1,
      programsCount: 1, installationsCount: 2, programNames: ['Desktop - تجاري V26'],
      openIssuesCount: 0, urgentIssuesCount: 0, solvedIssuesCount: 0, requirementsCount: 0, contactsCount: 1, score: 75
    };
    clientsSub.onNext({
      empty: false,
      metadata: { fromCache: false },
      docs: [makeClientDoc(initialClient), makeClientDoc(employeeACreated)],
      docChanges: () => [{ type: 'added', doc: makeClientDoc(employeeACreated) }]
    });

    expect(clients.map(c => c.id)).toEqual([102, 101]);
    expect(clients.find(c => c.id === 102).fullName).toBe('مؤسسة الأمل (Employee A)');

    // Employee B edits client 102 remotely -> incremental docChanges() 'modified'
    const employeeBEdited = { ...employeeACreated, status: 'نشط', fullName: 'مؤسسة الأمل المحدثة (Employee B)', version: 2 };
    clientsSub.onNext({
      empty: false,
      metadata: { fromCache: false },
      docs: [makeClientDoc(initialClient), makeClientDoc(employeeBEdited)],
      docChanges: () => [{ type: 'modified', doc: makeClientDoc(employeeBEdited) }]
    });

    const synced102 = clients.find(c => c.id === 102);
    expect(synced102.status).toBe('نشط');
    expect(synced102.version).toBe(2);
    expect(synced102.fullName).toBe('مؤسسة الأمل المحدثة (Employee B)');
  });

  it('renders Dashboard accurately from maintained parent summary fields with ZERO subcollection reads', () => {
    setClients([
      {
        id: 201, fullName: 'عميل ملخص 1', status: 'نشط', wilaya: 'الجزائر',
        programsCount: 2, installationsCount: 4, programNames: ['Desktop - تجاري V27', 'Web - لوحة'],
        openIssuesCount: 2, urgentIssuesCount: 1, solvedIssuesCount: 5,
        issuesByPriority: { عاجل: 1, عالية: 0, متوسطة: 1, منخفضة: 0 },
        requirementsCount: 3, reqsByStatus: { مقترح: 1, 'قيد الدراسة': 1, مخطط: 1, منفذ: 0 },
        contactsCount: 6, score: 88, programs: [], issues: [], requirements: [], contactHistory: [],
        _subcollectionsLoaded: false
      }
    ]);

    const html = renderDashboard();

    expect(svcMocks.getClientSubcollections).not.toHaveBeenCalled();
    expect(html).toContain('2 برنامج مرخص');
    expect(html).toContain('جهازًا');
    expect(html).toContain('6 مكالمة وزيارة');
    expect(html).toContain('5 تذكرة محلولة · 3 ميزة');
    expect(html).toContain('التذاكر المفتوحة حسب الأولوية');
    expect(html).toContain('(2)');
    expect(html).toContain('مسار طلبات الميزات');
  });

  it('loads subcollections selectively via onSnapshot ONLY when opening a client and detaches on goBack/setView', async () => {
    setClients([{ id: 301, fullName: 'عميل انتقائي', status: 'نشط', _subcollectionsLoaded: false }]);

    await selClient(301);

    // No duplicate eager getClientSubcollections() calls when tenantId listener attaches
    expect(svcMocks.getClientSubcollections).not.toHaveBeenCalled();
    expect(S.activeDetailClientId).toBe('301');
    const detailSubs = fsHarness.byPath('users/tenant-A/clients/301/subcollections');
    expect(detailSubs.length).toBe(1);

    // Deliver all 4 subcollections from listener
    detailSubs[0].onNext({ collectionName: 'programs', fieldName: 'programs', items: [{ id: 1, programName: 'ERP', installationsCount: 3 }], fromCache: false });
    detailSubs[0].onNext({ collectionName: 'issues', fieldName: 'issues', items: [{ id: 2, title: 'عطل شبكة', priority: 'عاجل', status: 'مفتوح' }], fromCache: false });
    detailSubs[0].onNext({ collectionName: 'requirements', fieldName: 'requirements', items: [{ id: 3, title: 'تقرير PDF', status: 'مقترح' }], fromCache: false });
    detailSubs[0].onNext({ collectionName: 'contacts', fieldName: 'contactHistory', items: [{ id: 4, date: '2026-11-19', note: 'اتصال' }], fromCache: false });

    const hydrated = clients.find(c => c.id === 301);
    expect(hydrated._subcollectionsLoaded).toBe(true);
    expect(hydrated.programsCount).toBe(1);
    expect(hydrated.installationsCount).toBe(3);
    expect(hydrated.openIssuesCount).toBe(1);
    expect(hydrated.urgentIssuesCount).toBe(1);
    expect(hydrated.requirementsCount).toBe(1);
    expect(hydrated.contactsCount).toBe(1);

    // Navigating back or changing view must detach subcollection listeners
    const unsubSpy = detailSubs[0].unsub;
    goBack();
    expect(unsubSpy).toHaveBeenCalledTimes(1);
    expect(S.activeDetailClientId).toBeNull();

    await selClient(301);
    const secondSub = fsHarness.byPath('users/tenant-A/clients/301/subcollections')[0];
    await setView('dashboard');
    expect(secondSub.unsub).toHaveBeenCalledTimes(1);
    expect(S.activeDetailClientId).toBeNull();
  });

  it('strictly isolates accounts on tenant switch and detaches prior listeners without cross-account leakage', async () => {
    setClients([{ id: 11, fullName: 'Tenant A Exclusive Client', status: 'نشط' }]);
    updateState({
      globalActivities: [{ id: 'act-A', title: 'Tenant A Event', timestamp: '2026-11-20T00:00:00Z' }],
      hasConfirmedServerSync: true
    });
    startRealtimeSync('tenant-A');
    startClientDetailSync('tenant-A', 11);

    const tenantAListeners = fsHarness.byPath('users/tenant-A').map(l => l.unsub);
    expect(tenantAListeners.length).toBe(5);

    // Switch to Tenant B
    stopRealtimeSync();
    resetTenantSessionState();

    // All Tenant A listeners detached & all Tenant A state wiped
    tenantAListeners.forEach(unsub => expect(unsub).toHaveBeenCalled());
    expect(clients).toEqual([]);
    expect(S.globalActivities).toEqual([]);
    expect(S.hasConfirmedServerSync).toBe(false);
    expect(S.activeDetailClientId).toBeNull();

    // Boot Tenant B
    authState.currentUser = { uid: 'tenant-B', email: 'gerantB@progilic.dz', emailVerified: true };
    setCurrentUser({ uid: 'tenant-B', email: 'gerantB@progilic.dz', role: 'gerant', isEmployee: false });
    svcMocks.getUserDataStrict.mockResolvedValueOnce({
      status: 'ok',
      exists: true,
      fromCache: false,
      data: { v: 3, nid: 500, stats: { totalClients: 1, activeClients: 1 } }
    });
    await loadDataFromFirestore({ uid: 'tenant-B', email: 'gerantB@progilic.dz' });

    const tenantBClients = fsHarness.byPath('users/tenant-B/clients')[0];
    expect(tenantBClients).toBeDefined();
    expect(S.nid).toBe(500);
  });

  it('never writes migration/init docs after failed initial load or cache-only snapshot, and handles OCC conflicts', async () => {
    // 1. Initial load fails with network-offline -> must NOT call saveUserData or wipe confirmed state
    setClients([{ id: 77, fullName: 'Confirmed Before Drop', status: 'نشط' }]);
    svcMocks.getUserDataStrict.mockResolvedValueOnce({
      status: 'network-offline',
      exists: false,
      fromCache: false,
      data: null,
      error: new Error('unavailable')
    });

    await loadDataFromFirestore({ uid: 'tenant-A', email: 'gerantA@progilic.dz' });
    expect(svcMocks.saveUserData).not.toHaveBeenCalled();
    expect(S.dataIsStale).toBe(true);
    expect(clients.length).toBe(1);

    // 2. Cache-only missing user doc must NOT initialize { v: 3 }
    svcMocks.getUserDataStrict.mockResolvedValueOnce({
      status: 'missing',
      exists: false,
      fromCache: true,
      data: null,
      error: null
    });
    await loadDataFromFirestore({ uid: 'tenant-A', email: 'gerantA@progilic.dz' });
    expect(svcMocks.saveUserData).not.toHaveBeenCalled();

    // 3. Cache-only clients snapshot marks state stale & never claims confirmed sync
    const clientsSub = fsHarness.byPath('users/tenant-A/clients')[0];
    clientsSub.onNext({
      empty: true,
      metadata: { fromCache: true },
      docs: [],
      docChanges: () => []
    });
    expect(S.clientsFromCache).toBe(true);
    expect(S.dataIsStale).toBe(true);
    expect(clients.length).toBe(1); // Existing confirmed client preserved instead of wiped by empty cache!

    // 4. Rejects mutations when transaction fails before server acknowledgement (never mutates/succeeds early)
    svcMocks.updateClientTransaction.mockRejectedValueOnce({ code: 'VERSION_CONFLICT', message: 'VERSION_CONFLICT', serverData: { id: 77, fullName: 'Cloud V2', version: 2 } });
    await expect(
      commitOnlineMutation('UPDATE_CLIENT', {
        clientId: '77',
        clientData: { id: 77, fullName: 'Local Stale Edit' },
        oldStatus: 'نشط',
        stats: S.stats,
        baseVersion: 1
      })
    ).rejects.toMatchObject({ code: 'VERSION_CONFLICT' });
    expect(S.modal).toBe('conflict');

    // Accept server version
    await resolveConflict('server');
    expect(clients.find(c => c.id === 77).fullName).toBe('Cloud V2');
    expect(S.modal).toBeNull();
  });

  it('trips quota circuit breaker on resource-exhausted, detaches listeners, preserves stale data, and recovers on reconnect', async () => {
    startRealtimeSync('tenant-A');
    startClientDetailSync('tenant-A', 901);

    // Seed confirmed client in memory
    const clientsSub = fsHarness.byPath('users/tenant-A/clients')[0];
    const confirmedClient = { id: 901, fullName: 'عميل مؤكد قبل الحصة', status: 'نشط', version: 1 };
    clientsSub.onNext({
      empty: false,
      metadata: { fromCache: false },
      docs: [makeClientDoc(confirmedClient)],
      docChanges: () => [{ type: 'added', doc: makeClientDoc(confirmedClient) }]
    });

    const activeUnsubsBeforeQuota = [...fsHarness.listeners.values()].map(l => l.unsub);
    expect(activeUnsubsBeforeQuota.length).toBe(5);

    // Simulate Firestore resource-exhausted error on listener
    clientsSub.onError({ code: 'resource-exhausted', message: 'Quota limit exceeded. Free daily read units per project.' });

    // All listeners must be immediately detached (no retry polling loops)
    activeUnsubsBeforeQuota.forEach(unsub => expect(unsub).toHaveBeenCalledTimes(1));
    expect(S.quotaExceeded).toBe(true);
    expect(S.dataIsStale).toBe(true);
    expect(S.connectionState).toBe('quota-exceeded');
    expect(globalThis.__progilicFirestoreQuotaExceeded).toBe(true);

    // Last confirmed data preserved for display while mutations & additional syncs are blocked
    expect(clients.find(c => c.id === 901).fullName).toBe('عميل مؤكد قبل الحصة');
    await expect(
      commitOnlineMutation('ADD_CLIENT', { clientData: { id: 902, fullName: 'Blocked' }, stats: S.stats })
    ).rejects.toMatchObject({ code: 'resource-exhausted' });
    expect(svcMocks.addClientTransaction).not.toHaveBeenCalled();

    // Calling startRealtimeSync while quotaExceeded stays blocked (0 new listeners)
    const countBeforeExtraStart = fsHarness.listeners.size;
    startRealtimeSync('tenant-A');
    expect(fsHarness.listeners.size).toBe(countBeforeExtraStart);

    // Recovery when user clicks Reconnect after quota resets
    svcMocks.getUserDataStrict.mockResolvedValueOnce({
      status: 'ok',
      exists: true,
      fromCache: false,
      data: { v: 3, nid: 902, stats: { totalClients: 1, activeClients: 1 } }
    });

    const reconnected = await reconnectRealtimeSync();
    expect(reconnected).toBe(true);
    expect(S.quotaExceeded).toBe(false);
    expect(globalThis.__progilicFirestoreQuotaExceeded).toBe(false);
    expect(S.connectionState).toBe('connecting');
    const reattachedClients = fsHarness.byPath('users/tenant-A/clients');
    expect(reattachedClients.length).toBe(1);
    expect(fsHarness.byPath('users/tenant-A').length).toBe(4);

    // Server snapshot arrives on reattached listener -> transitions cleanly back to live
    reattachedClients[0].onNext({
      empty: false,
      metadata: { fromCache: false },
      docs: [makeClientDoc(confirmedClient)],
      docChanges: () => [{ type: 'added', doc: makeClientDoc(confirmedClient) }]
    });
    expect(S.connectionState).toBe('live');
    expect(S.dataIsStale).toBe(false);
  });

  it('clears clientsFromCache and dataIsStale when server confirms via metadata-only snapshot (docChanges = [])', () => {
    startRealtimeSync('tenant-A');
    const clientsSub = fsHarness.byPath('users/tenant-A/clients')[0];
    const cachedClient = { id: 88, fullName: 'عميل مخبأ محلياً', status: 'نشط', version: 1 };

    // Snapshot 1: initial cache emission
    clientsSub.onNext({
      empty: false,
      metadata: { fromCache: true, hasPendingWrites: false },
      docs: [makeClientDoc(cachedClient)],
      docChanges: () => [{ type: 'added', doc: makeClientDoc(cachedClient) }]
    });
    expect(S.clientsFromCache).toBe(true);
    expect(S.dataIsStale).toBe(true);

    // Snapshot 2: metadata-only server ACK (0 doc changes, fromCache: false)
    clientsSub.onNext({
      empty: false,
      metadata: { fromCache: false, hasPendingWrites: false },
      docs: [makeClientDoc(cachedClient)],
      docChanges: () => []
    });
    expect(S.clientsFromCache).toBe(false);
    expect(S.dataIsStale).toBe(false);
    expect(S.hasConfirmedServerSync).toBe(true);
    expect(S.connectionState).toBe('live');
  });
});
