import { describe, it, expect, vi, beforeEach } from 'vitest';

const firestoreState = vi.hoisted(() => ({
  docs: new Map(),
  failTransactionError: null
}));

vi.mock('firebase/firestore', () => {
  const doc = vi.fn((_db, ...segments) => {
    const path = segments.join('/');
    return { path, id: path.split('/').pop() };
  });
  const collection = vi.fn((_db, ...segments) => ({ path: segments.join('/') }));
  const query = vi.fn((collRef) => collRef);
  const where = vi.fn(() => ({}));
  const orderBy = vi.fn(() => ({}));
  const limit = vi.fn(() => ({}));
  const startAfter = vi.fn(() => ({}));
  const deleteField = vi.fn(() => ({ __deleteField: true }));
  const onSnapshot = vi.fn(() => () => {});

  const getDoc = vi.fn(async (docRef) => {
    const data = firestoreState.docs.get(docRef.path);
    return {
      id: docRef.id,
      exists: () => data !== undefined,
      data: () => (data ? { ...data } : undefined)
    };
  });

  const setDoc = vi.fn(async (docRef, data, opts) => {
    const prev = opts?.merge ? (firestoreState.docs.get(docRef.path) || {}) : {};
    firestoreState.docs.set(docRef.path, { ...prev, ...data });
  });

  const updateDoc = vi.fn(async (docRef, data) => {
    const prev = firestoreState.docs.get(docRef.path) || {};
    firestoreState.docs.set(docRef.path, { ...prev, ...data });
  });

  const deleteDoc = vi.fn(async (docRef) => {
    firestoreState.docs.delete(docRef.path);
  });

  const getDocs = vi.fn(async (ref) => {
    const prefix = `${ref.path}/`;
    const matched = [];
    for (const [path, val] of firestoreState.docs.entries()) {
      if (path.startsWith(prefix)) {
        const rest = path.slice(prefix.length);
        if (!rest.includes('/')) {
          matched.push({ id: rest, data: () => ({ ...val }) });
        }
      }
    }
    return { docs: matched };
  });

  const runTransaction = vi.fn(async (_db, fn) => {
    if (firestoreState.failTransactionError) {
      throw firestoreState.failTransactionError;
    }
    const tx = {
      get: async (docRef) => getDoc(docRef),
      set: (docRef, data, opts) => {
        const prev = opts?.merge ? (firestoreState.docs.get(docRef.path) || {}) : {};
        firestoreState.docs.set(docRef.path, { ...prev, ...data });
      },
      update: (docRef, data) => {
        const prev = firestoreState.docs.get(docRef.path);
        if (!prev) throw new Error(`NOT_FOUND: ${docRef.path}`);
        firestoreState.docs.set(docRef.path, { ...prev, ...data });
      },
      delete: (docRef) => {
        firestoreState.docs.delete(docRef.path);
      }
    };
    return await fn(tx);
  });

  const writeBatch = vi.fn(() => ({
    set: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    commit: vi.fn().mockResolvedValue(true)
  }));

  return {
    getFirestore: vi.fn(() => ({})),
    initializeFirestore: vi.fn(() => ({})),
    persistentLocalCache: vi.fn(),
    persistentMultipleTabManager: vi.fn(),
    memoryLocalCache: vi.fn(),
    doc,
    collection,
    query,
    where,
    orderBy,
    limit,
    startAfter,
    deleteField,
    onSnapshot,
    getDoc,
    setDoc,
    updateDoc,
    deleteDoc,
    getDocs,
    runTransaction,
    writeBatch
  };
});

vi.mock('../../src/firebase/config.js', () => ({
  db: {},
  auth: { currentUser: { uid: 'tenant-1', email: 'owner@progilic.dz' } },
  googleProvider: {},
  facebookProvider: {},
  appleProvider: {}
}));

vi.mock('../../src/utils/toast.js', () => ({
  showToast: vi.fn()
}));

vi.mock('../../src/presentation/render-core.js', () => ({
  R: vi.fn()
}));

import { S, clients, setClients, setCurrentUser, setCurrentStaffUser, updateState, resetTenantSessionState } from '../../src/state/store.js';
import { getClientSubcollections } from '../../src/firebase/service.js';
import { confirmProgramVersionSync } from '../../src/business/actions/clientActions.js';
import { stopRealtimeSync } from '../../src/business/storage.js';
import { computeFleetDeviceMetrics } from '../../src/business/programMetrics.js';
import { renderDetail } from '../../src/presentation/render-views.js';
import { renderModal, renderLicensesExplorerModal } from '../../src/presentation/render-modals.js';
import { showToast } from '../../src/utils/toast.js';

function seedAbcAndXyzClients() {
  const abcPrograms = [
    { id: 101, programName: 'Mobile - تطبيق VDD V21', platform: 'Mobile', type: 'تطبيق VDD (Vendeur Distributeur)', version: 'V21', versionNum: 1, installationsCount: 1, startDate: '2026-01-10', endDate: '' },
    { id: 102, programName: 'Mobile - تطبيق VDD V21', platform: 'Mobile', type: 'تطبيق VDD (Vendeur Distributeur)', version: 'V21', versionNum: 1, installationsCount: 1, startDate: '2026-01-11', endDate: '' },
    { id: 103, programName: 'Mobile - تطبيق VDD V21', platform: 'Mobile', type: 'تطبيق VDD (Vendeur Distributeur)', version: 'V21', versionNum: 1, installationsCount: 1, startDate: '2026-01-12', endDate: '' },
    { id: 104, programName: 'Mobile - تطبيق VDD V21', platform: 'Mobile', type: 'تطبيق VDD (Vendeur Distributeur)', version: 'V21', versionNum: 1, installationsCount: 1, startDate: '2026-01-13', endDate: '' },
    { id: 105, programName: 'Desktop - تجاري V26', platform: 'Desktop', type: 'تجاري (Commercial)', version: 'V26', versionNum: 1, installationsCount: 2, startDate: '2026-01-01', endDate: '' }
  ];
  const xyzPrograms = [
    { id: 201, programName: 'Mobile - تطبيق VDD V21', platform: 'Mobile', type: 'تطبيق VDD (Vendeur Distributeur)', version: 'V21', versionNum: 1, installationsCount: 3, startDate: '2026-03-01', endDate: '' }
  ];

  const clientABC = {
    id: 1001,
    fullName: 'Customer ABC',
    company: 'ABC Distribution',
    status: 'نشط',
    version: 1,
    programs: abcPrograms,
    programsCount: 5,
    installationsCount: 6,
    programNames: abcPrograms.map(p => p.programName),
    issues: [],
    requirements: [],
    contactHistory: [],
    versionHistory: [],
    _subcollectionsLoaded: true
  };
  const clientXYZ = {
    id: 1002,
    fullName: 'Customer XYZ',
    company: 'XYZ Corp',
    status: 'نشط',
    version: 1,
    programs: xyzPrograms,
    programsCount: 1,
    installationsCount: 3,
    programNames: xyzPrograms.map(p => p.programName),
    issues: [],
    requirements: [],
    contactHistory: [],
    versionHistory: [],
    _subcollectionsLoaded: true
  };

  firestoreState.docs.set('users/tenant-1', { v: 3, nid: 2000, stats: {} });
  firestoreState.docs.set('users/tenant-1/clients/1001', { ...clientABC });
  firestoreState.docs.set('users/tenant-1/clients/1002', { ...clientXYZ });
  for (const p of abcPrograms) {
    firestoreState.docs.set(`users/tenant-1/clients/1001/programs/${p.id}`, { ...p });
  }
  for (const p of xyzPrograms) {
    firestoreState.docs.set(`users/tenant-1/clients/1002/programs/${p.id}`, { ...p });
  }

  setClients([clientABC, clientXYZ]);
}

describe('Automatic Software Version Synchronization End-to-End', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stopRealtimeSync();
    resetTenantSessionState();
    firestoreState.docs.clear();
    firestoreState.failTransactionError = null;
    document.body.innerHTML = '';

    setCurrentUser({ uid: 'tenant-1', role: 'gerant', email: 'owner@progilic.dz', isEmployee: false });
    setCurrentStaffUser({
      id: 'emp-7',
      fullName: 'كريم تقني',
      role: 'technique',
      permissions: { 'programs.view': true, 'programs.edit': true, 'reports.view': true }
    });
    updateState({ isOnline: true, quotaExceeded: false, syncQueue: [], selId: 1001, tab: 'programs' });
    seedAbcAndXyzClients();
  });

  it('requires explicit version selection in syncProgramVersion modal (never pre-selects latest)', () => {
    S.modal = 'syncProgramVersion';
    S.selId = 1001;
    const modalHtml = renderModal();

    expect(modalHtml).toContain('تحديث إصدار برنامج');
    expect(modalHtml).toContain('id="vs_version"');
    expect(modalHtml).toContain('<option value="" selected>');
    expect(modalHtml).toContain('Mobile:vdd');
  });

  it('updates all 4 VDD V21 devices on ABC to explicit V22, leaves ABC Desktop & Client XYZ untouched, updates stats & reports, and logs history', async () => {
    document.body.innerHTML = `
      <select id="vs_program"><option value="Mobile:vdd" selected>VDD</option></select>
      <select id="vs_version"><option value="V22" selected>V22</option></select>
      <input id="vs_date" value="2026-11-24" />
      <input id="vs_note" value="ترقية من V21 إلى V22" />
    `;

    const ok = await confirmProgramVersionSync(1001);
    expect(ok).toBe(true);

    // 1. ABC local store updated for all 4 VDD entries, Desktop V26 untouched
    const abc = clients.find(c => c.id === 1001);
    const abcVdd = abc.programs.filter(p => p.platform === 'Mobile');
    expect(abcVdd.length).toBe(4);
    expect(abcVdd.every(p => p.version === 'V22')).toBe(true);
    expect(abcVdd.every(p => p.programName === 'Mobile - تطبيق VDD V22')).toBe(true);

    const abcDesktop = abc.programs.find(p => p.id === 105);
    expect(abcDesktop.version).toBe('V26');
    expect(abcDesktop.programName).toBe('Desktop - تجاري V26');

    // 2. Firestore subcollection persisted atomically for ABC
    const abcSub = await getClientSubcollections('tenant-1', '1001');
    const subVdd = abcSub.programs.filter(p => p.platform === 'Mobile');
    expect(subVdd.length).toBe(4);
    expect(subVdd.every(p => p.version === 'V22')).toBe(true);
    expect(abcSub.programs.find(p => p.id === 105).version).toBe('V26');

    // 3. Client XYZ remains completely untouched at V21
    const xyz = clients.find(c => c.id === 1002);
    expect(xyz.programs[0].version).toBe('V21');
    const xyzSub = await getClientSubcollections('tenant-1', '1002');
    expect(xyzSub.programs[0].version).toBe('V21');

    // 4. Version history audit log recorded accurately
    expect(abc.versionHistory.length).toBe(1);
    expect(abc.versionHistory[0]).toMatchObject({
      programKey: 'Mobile:vdd',
      previousVersion: 'V21',
      newVersion: 'V22',
      updateDate: '2026-11-24',
      employeeName: 'كريم تقني',
      affectedDevices: 4
    });

    // 5. Statistics reflect V22 (4 devices on ABC) and V21 (only 3 devices on XYZ)
    const fleet = computeFleetDeviceMetrics(clients);
    expect(fleet.versionDevices.V22).toBe(4);
    expect(fleet.versionPrograms.V22).toBe(4);
    expect(fleet.versionDevices.V21).toBe(3);
    expect(fleet.versionPrograms.V21).toBe(1);

    // 6. Client card Programs tab & Client Report reflect V22 and version history
    S.selId = 1001;
    S.tab = 'programs';
    const programsHtml = renderDetail();
    expect(programsHtml).toContain('Mobile - تطبيق VDD V22');
    expect(programsHtml).toContain('سجل تحديثات الإصدارات');
    expect(programsHtml).toContain('V21');
    expect(programsHtml).toContain('V22');

    S.tab = 'report';
    const reportHtml = renderDetail();
    expect(reportHtml).toContain('تاريخ تحديثات الإصدارات');
    expect(reportHtml).toContain('V22');
    expect(reportHtml).toContain('كريم تقني');

    S.form = { platform: 'all', version: 'V22', type: 'all', search: '', viewMode: 'table' };
    const explorerHtml = renderLicensesExplorerModal();
    expect(explorerHtml).toContain('Mobile - تطبيق VDD V22');
    expect(explorerHtml).toContain('Customer ABC');
  });

  it('blocks confirmation when no version is explicitly chosen and rolls back completely if Firestore write fails', async () => {
    document.body.innerHTML = `
      <select id="vs_program"><option value="Mobile:vdd" selected>VDD</option></select>
      <select id="vs_version"><option value="" selected></option></select>
      <input id="vs_date" value="2026-11-24" />
      <input id="vs_note" value="" />
    `;

    const missingVerOk = await confirmProgramVersionSync(1001);
    expect(missingVerOk).toBe(false);
    expect(showToast).toHaveBeenCalledWith(expect.stringContaining('الإصدار'), 'error');
    expect(clients.find(c => c.id === 1001).programs.every(p => p.platform !== 'Mobile' || p.version === 'V21')).toBe(true);

    // Now test Firestore failure rollback (never marks installed if DB fails)
    document.getElementById('vs_version').innerHTML = '<option value="V22" selected>V22</option>';
    const permErr = new Error('Missing or insufficient permissions.');
    permErr.code = 'permission-denied';
    firestoreState.failTransactionError = permErr;

    const failedOk = await confirmProgramVersionSync(1001);
    expect(failedOk).toBe(false);

    const abcAfterFail = clients.find(c => c.id === 1001);
    expect(abcAfterFail.programs.filter(p => p.platform === 'Mobile').every(p => p.version === 'V21')).toBe(true);
    expect(abcAfterFail.versionHistory.length).toBe(0);
    expect(showToast).toHaveBeenCalledWith(expect.stringContaining('فشل تحديث إصدار البرنامج'), 'error');
  });
});
