import { describe, it, expect, vi, beforeEach } from 'vitest';

const firestoreState = vi.hoisted(() => ({
  docs: new Map(),
  batchSets: []
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

  const writeBatch = vi.fn(() => {
    const ops = [];
    return {
      set: (docRef, data, opts) => ops.push({ type: 'set', docRef, data, opts }),
      update: (docRef, data) => ops.push({ type: 'update', docRef, data }),
      delete: (docRef) => ops.push({ type: 'delete', docRef }),
      commit: async () => {
        for (const op of ops) {
          if (op.type === 'set') {
            const prev = op.opts?.merge ? (firestoreState.docs.get(op.docRef.path) || {}) : {};
            firestoreState.docs.set(op.docRef.path, { ...prev, ...op.data });
            firestoreState.batchSets.push({ path: op.docRef.path, data: op.data });
          } else if (op.type === 'update') {
            const prev = firestoreState.docs.get(op.docRef.path) || {};
            firestoreState.docs.set(op.docRef.path, { ...prev, ...op.data });
          } else if (op.type === 'delete') {
            firestoreState.docs.delete(op.docRef.path);
          }
        }
      }
    };
  });

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

vi.mock('firebase/auth', () => ({
  signInWithPopup: vi.fn(),
  signOut: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
  sendEmailVerification: vi.fn(),
  updateProfile: vi.fn()
}));

import { S, clients, setClients, setCurrentUser } from '../../src/state/store.js';
import { openLogProgramUpdateModal, saveProgramVersionUpdate } from '../../src/business/actions/clientActions.js';
import { renderModal, renderLicensesExplorerModal } from '../../src/presentation/render-modals.js';
import { renderDetail, renderDashboard } from '../../src/presentation/render-views.js';

describe('Automatic Software Version Synchronization UI & Transaction Integration', () => {
  beforeEach(() => {
    firestoreState.docs.clear();
    firestoreState.batchSets = [];
    document.body.innerHTML = '<div id="app"></div><div id="toast-container"></div>';

    Object.defineProperty(window.navigator, 'onLine', { value: true, configurable: true });
    S.isOnline = true;
    S.quotaExceeded = false;
    S.modal = null;
    S.form = {};
    S.globalActivities = [];
    S.clientActivities = [];
    S.lang = 'ar';
    S.dbPeriod = 30;
    S.dbWilaya = 'all';

    setCurrentUser({ uid: 'tenant-1', email: 'owner@progilic.dz', role: 'GERANT', isEmployee: false });

    const clientData = {
      id: 700,
      fullName: 'شركة البركة للتجارة',
      company: 'Al Baraka',
      status: 'نشط',
      wilaya: 'الجزائر',
      startDate: '2025-01-01',
      lastContact: '2026-11-15',
      _subcollectionsLoaded: true,
      programsCount: 5,
      installationsCount: 6,
      programs: [
        { id: 7001, platform: 'Desktop', type: 'تجاري (Commercial)', version: 'V21', programName: 'Desktop - تجاري V21', installationsCount: 1, startDate: '2025-01-01', endDate: '' },
        { id: 7002, platform: 'Desktop', type: 'تجاري (Commercial)', version: 'V21', programName: 'Desktop - تجاري V21', installationsCount: 1, startDate: '2025-02-01', endDate: '' },
        { id: 7003, platform: 'Desktop', type: 'تجاري (Commercial)', version: 'V21', programName: 'Desktop - تجاري V21', installationsCount: 1, startDate: '2025-03-01', endDate: '' },
        { id: 7004, platform: 'Desktop', type: 'تجاري (Commercial)', version: 'V21', programName: 'Desktop - تجاري V21', installationsCount: 1, startDate: '2025-04-01', endDate: '' },
        { id: 7005, platform: 'Desktop', type: 'إنتاجي (Production)', version: 'V21', programName: 'Desktop - إنتاجي V21', installationsCount: 2, startDate: '2025-01-15', endDate: '' }
      ],
      issues: [],
      requirements: [],
      contactHistory: []
    };

    firestoreState.docs.set('users/tenant-1', { stats: { totalClients: 1, activeClients: 1, totalPrograms: 5, totalLicensedDevices: 6 } });
    firestoreState.docs.set('users/tenant-1/clients/700', { ...clientData });
    clientData.programs.forEach(p => {
      firestoreState.docs.set(`users/tenant-1/clients/700/programs/${p.id}`, { ...p });
    });

    setClients([clientData]);
    S.selId = 700;
    S.view = 'detail';
    S.tab = 'programs';
  });

  it('opens logProgramUpdate modal with empty target version (no auto-latest), rejects empty submit, and syncs all 4 matching device records to V22 across Firestore, Programs, Report, Dashboard & Explorer', async () => {
    await openLogProgramUpdateModal(700);
    expect(S.modal).toBe('logProgramUpdate');
    expect(S.form.targetVersion).toBe(''); // MUST NOT auto-select V27

    const modalHtml = renderModal();
    document.body.innerHTML += modalHtml;

    const verSelect = document.getElementById('fpu_ver');
    expect(verSelect).not.toBeNull();
    expect(verSelect.value).toBe(''); // Empty explicit prompt option selected by default

    // Attempting submit with empty version keeps modal open and leaves programs untouched
    await saveProgramVersionUpdate(700);
    expect(S.modal).toBe('logProgramUpdate');
    expect(clients[0].programs.filter(p => p.version === 'V21').length).toBe(5);

    // Employee selects V22 (not latest V27) and submits
    document.getElementById('fpu_prog').value = 'Desktop|Commercial';
    verSelect.value = 'V22';
    document.getElementById('fpu_date').value = '2026-11-22';
    document.getElementById('fpu_notes').value = 'تحديث الأجهزة الأربعة من V21 إلى V22';

    await saveProgramVersionUpdate(700);

    // Wait briefly for queued async Firestore transaction flush
    await new Promise(resolve => setTimeout(resolve, 60));

    expect(S.modal).toBeNull();

    // All 4 Commercial records synced to V22, Production stays V21
    const updatedClient = clients[0];
    const commercial = updatedClient.programs.filter(p => p.id >= 7001 && p.id <= 7004);
    expect(commercial).toHaveLength(4);
    commercial.forEach(p => {
      expect(p.version).toBe('V22');
      expect(p.programName).toBe('Desktop - تجاري V22');
      expect(p.previousVersion).toBe('V21');
      expect(p.lastVersionUpdate).toBe('2026-11-22');
    });

    const production = updatedClient.programs.find(p => p.id === 7005);
    expect(production.version).toBe('V21');
    expect(production.programName).toBe('Desktop - إنتاجي V21');

    // Client version update history & activity logged
    expect(updatedClient.versionUpdates).toHaveLength(1);
    expect(updatedClient.versionUpdates[0].toVersion).toBe('V22');
    expect(updatedClient.versionUpdates[0].affectedDevicesCount).toBe(4);
    expect(S.globalActivities.some(a => a.type === 'PROGRAM_VERSION_UPDATED' && a.meta?.toVersion === 'V22')).toBe(true);

    // Verify Firestore subcollection documents + parent document persisted V22 atomically
    for (const pid of [7001, 7002, 7003, 7004]) {
      const subDoc = firestoreState.docs.get(`users/tenant-1/clients/700/programs/${pid}`);
      expect(subDoc.version).toBe('V22');
      expect(subDoc.programName).toBe('Desktop - تجاري V22');
    }
    expect(firestoreState.docs.get('users/tenant-1/clients/700/programs/7005').version).toBe('V21');
    expect(firestoreState.docs.get('users/tenant-1/clients/700').versionUpdates).toHaveLength(1);

    // Client Programs Tab, Report Tab, Dashboard Stats & Licenses Explorer all reflect V22
    S.tab = 'programs';
    const programsHtml = renderDetail();
    expect(programsHtml).toContain('Desktop - تجاري V22');
    expect(programsHtml).toContain('سجل تحديثات الإصدارات');
    expect(programsHtml).toContain('تحديث الأجهزة الأربعة من V21 إلى V22');

    S.tab = 'report';
    const reportHtml = renderDetail();
    expect(reportHtml).toContain('الإصدار: <strong class="num">V22</strong>');
    expect(reportHtml).toContain('سجل تحديثات الإصدارات');

    const dashboardHtml = renderDashboard();
    expect(dashboardHtml).toContain('توزيع الإصدارات المعتمدة');
    expect(dashboardHtml).toContain('V22');

    S.form = { platform: 'all', version: 'V22', type: 'all', search: '', viewMode: 'table' };
    const explorerHtml = renderLicensesExplorerModal();
    expect(explorerHtml).toContain('4 ترخيص');
    expect(explorerHtml).toContain('Desktop - تجاري V22');
  });
});
