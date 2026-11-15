import { describe, it, expect, vi, beforeEach } from 'vitest';

const firestoreState = vi.hoisted(() => ({
  docs: new Map(),
  collections: new Map(),
  batchSets: [],
  commitCalls: 0,
  commitError: null
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
        firestoreState.commitCalls++;
        if (firestoreState.commitError) {
          throw firestoreState.commitError;
        }
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

vi.mock('../../src/utils/toast.js', () => ({
  showToast: vi.fn()
}));

vi.mock('../../src/presentation/render-core.js', () => ({
  R: vi.fn()
}));

import { S, clients, setClients, setCurrentUser, updateState } from '../../src/state/store.js';
import { addClientTransaction, getClientSubcollections } from '../../src/firebase/service.js';
import { saveClient, saveProgram } from '../../src/business/actions/clientActions.js';
import { loadClientSubcollectionsIfNeeded, recoverMissingClientPrograms, stopRealtimeSync } from '../../src/business/storage.js';
import { reconcileClientPrograms } from '../../src/business/programRecovery.js';
import { syncCrmServicesToTimeline, ActivityType } from '../../src/business/timelineService.js';
import { renderDetail } from '../../src/presentation/render-views.js';

function setupClientModalDom({
  fullName = 'محمد أمين',
  company = 'مؤسسة النجاح',
  phone = '0550112233',
  wilaya = 'الجزائر',
  businessType = 'تجارة تجزئة',
  businessField = 'سوبرماركت / بقالة',
  status = 'نشط',
  lastContact = '2026-11-15',
  startDate = '2026-11-15',
  enableProg = true,
  platform = 'Desktop',
  progType = 'تجاري (Commercial)',
  version = 'V27',
  installationsCount = '2'
} = {}) {
  document.body.innerHTML = `
    <input id="f_fn" value="${fullName}" />
    <input id="f_co" value="${company}" />
    <input id="f_ph" value="${phone}" />
    <input id="f_wi" value="${wilaya}" />
    <input id="f_cm" value="" />
    <input id="f_gmail" value="client@gmail.com" />
    <input id="f_lo" value="باب الزوار" />
    <input id="f_bt" value="${businessType}" />
    <input id="f_bf" value="${businessField}" />
    <input id="f_st" value="${status}" />
    <input id="f_lc" value="${lastContact}" />
    <input id="f_sd" value="${startDate}" />
    <input id="f_ed" value="" />
    <input id="f_no" value="" />
    <input type="checkbox" id="f_p_enable" ${enableProg ? 'checked' : ''} />
    <input id="f_p_pl" value="${platform}" />
    <input id="f_p_ty" value="${progType}" />
    <input id="f_p_ver" value="${version}" />
    <input id="f_p_ic" value="${installationsCount}" />
  `;
}

describe('Client-Program Linking & Recovery', () => {
  beforeEach(() => {
    stopRealtimeSync();
    firestoreState.docs.clear();
    firestoreState.collections.clear();
    firestoreState.batchSets = [];
    firestoreState.commitCalls = 0;
    firestoreState.commitError = null;
    document.body.innerHTML = '';
    setCurrentUser({ uid: 'tenant-1', role: 'gerant', email: 'owner@progilic.dz', isEmployee: false });
    setClients([]);
    updateState({
      isOnline: true,
      syncQueue: [],
      globalActivities: [],
      clientActivities: [],
      selId: null,
      view: 'list',
      tab: 'overview',
      modal: null,
      form: {},
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
    });
    firestoreState.docs.set('users/tenant-1', { v: 3, nid: 100, stats: { ...S.stats } });
  });

  it('Scenario 1: creates a new client with Desktop program, persists to programs subcollection, and survives reload', async () => {
    setupClientModalDom({
      fullName: 'عميل ديسكتوب',
      platform: 'Desktop',
      progType: 'تجاري (Commercial)',
      version: 'V27',
      installationsCount: '3'
    });

    await saveClient(null);
    await new Promise(r => setTimeout(r, 20));

    expect(clients.length).toBe(1);
    const created = clients[0];
    expect(created.programs.length).toBe(1);
    expect(created.programsCount).toBe(1);
    expect(created.installationsCount).toBe(3);
    expect(created.programs[0].programName).toBe('Desktop - تجاري V27');

    // Verify Firestore subcollection contains the program doc
    const sub = await getClientSubcollections('tenant-1', String(created.id));
    expect(sub.programs.length).toBe(1);
    expect(sub.programs[0].programName).toBe('Desktop - تجاري V27');
    expect(sub.programs[0].installationsCount).toBe(3);

    // Simulate reload: client doc loaded with _subcollectionsLoaded = false
    const clientSummaryFromCloud = {
      ...firestoreState.docs.get(`users/tenant-1/clients/${created.id}`),
      _subcollectionsLoaded: false
    };
    setClients([clientSummaryFromCloud]);
    await loadClientSubcollectionsIfNeeded(created.id);

    expect(clients[0].programs.length).toBe(1);
    expect(clients[0].programs[0].programName).toBe('Desktop - تجاري V27');

    // Verify rendered client programs tab & overview show the program
    S.selId = created.id;
    S.tab = 'programs';
    const html = renderDetail();
    expect(html).toContain('Desktop - تجاري V27');
    expect(html).not.toContain('لا توجد برامج مرتبطة بهذا العميل');
  });

  it('Scenario 2: creates a new client with Mobile program (no version required) and persists to subcollection', async () => {
    setupClientModalDom({
      fullName: 'عميل موبايل',
      platform: 'Mobile',
      progType: 'تطبيق التاجر (Commerçant)',
      version: '',
      installationsCount: '2'
    });

    await saveClient(null);
    await new Promise(r => setTimeout(r, 20));

    const created = clients[0];
    expect(created.programs.length).toBe(1);
    expect(created.programs[0].platform).toBe('Mobile');
    expect(created.programs[0].programName).toBe('Mobile - تطبيق التاجر');
    expect(created.programs[0].version).toBe('');

    const sub = await getClientSubcollections('tenant-1', String(created.id));
    expect(sub.programs.length).toBe(1);
    expect(sub.programs[0].platform).toBe('Mobile');
  });

  it('Scenario 3: creates a new client with Web program and persists to subcollection', async () => {
    setupClientModalDom({
      fullName: 'عميل ويب',
      platform: 'Web',
      progType: '',
      version: 'V27',
      installationsCount: '5'
    });

    await saveClient(null);
    await new Promise(r => setTimeout(r, 20));

    const created = clients[0];
    expect(created.programs.length).toBe(1);
    expect(created.programs[0].platform).toBe('Web');
    expect(created.programs[0].programName).toBe('Web - الويب V27');

    const sub = await getClientSubcollections('tenant-1', String(created.id));
    expect(sub.programs.length).toBe(1);
    expect(sub.programs[0].platform).toBe('Web');
  });

  it('Scenario 4: creates a new client WITHOUT initial program when optional toggle is unchecked', async () => {
    setupClientModalDom({
      fullName: 'عميل بدون برنامج',
      enableProg: false,
      platform: 'Desktop',
      progType: 'تجاري (Commercial)',
      version: 'V27'
    });

    await saveClient(null);
    await new Promise(r => setTimeout(r, 20));

    expect(clients.length).toBe(1);
    const created = clients[0];
    expect(created.programs).toEqual([]);
    expect(created.programsCount).toBe(0);

    const sub = await getClientSubcollections('tenant-1', String(created.id));
    expect(sub.programs).toEqual([]);
  });

  it('Scenario 5: standalone add and edit program via saveProgram still works seamlessly', async () => {
    await addClientTransaction('tenant-1', {
      id: 7001,
      fullName: 'عميل حالي',
      status: 'نشط',
      startDate: '2026-10-01',
      programs: []
    }, S.stats);

    setClients([{
      id: 7001,
      fullName: 'عميل حالي',
      status: 'نشط',
      startDate: '2026-10-01',
      programs: [],
      issues: [],
      requirements: [],
      contactHistory: [],
      _subcollectionsLoaded: true
    }]);
    S.selId = 7001;

    document.body.innerHTML = `
      <input id="fp_pl" value="Desktop" />
      <input id="fp_ty" value="إنتاجي (Production)" />
      <input id="fp_ver" value="V26" />
      <input id="fp_ic" value="4" />
      <input id="fp_sd" value="2026-11-15" />
      <input id="fp_ed" value="" />
    `;
    await saveProgram(null);
    await new Promise(r => setTimeout(r, 20));

    expect(clients[0].programs.length).toBe(1);
    const progId = clients[0].programs[0].id;
    expect(clients[0].programs[0].programName).toBe('Desktop - إنتاجي V26');

    const subAfterAdd = await getClientSubcollections('tenant-1', '7001');
    expect(subAfterAdd.programs.length).toBe(1);

    // Edit the standalone program
    document.getElementById('fp_ver').value = 'V27';
    document.getElementById('fp_ic').value = '6';
    await saveProgram(progId);
    await new Promise(r => setTimeout(r, 20));

    expect(clients[0].programs[0].version).toBe('V27');
    expect(clients[0].programs[0].installationsCount).toBe(6);

    const subAfterEdit = await getClientSubcollections('tenant-1', '7001');
    expect(subAfterEdit.programs[0].installationsCount).toBe(6);
  });

  it('Scenario 6: recovers previously hidden programs stored inline on client doc with empty programs subcollection', async () => {
    const legacyProg = {
      id: 8002,
      programName: 'Desktop - تجاري V26',
      platform: 'Desktop',
      type: 'تجاري (Commercial)',
      version: 'V26',
      installationsCount: 2,
      startDate: '2026-10-10',
      endDate: ''
    };
    // Simulate broken historical state written by old addClientTransaction:
    // inline programs exists on parent doc, programsCount was hardcoded 0, and programs subcollection is empty!
    firestoreState.docs.set('users/tenant-1/clients/8001', {
      id: 8001,
      fullName: 'عميل قديم متضرر',
      status: 'نشط',
      programs: [legacyProg],
      programsCount: 0,
      installationsCount: 0
    });

    setClients([{
      ...firestoreState.docs.get('users/tenant-1/clients/8001'),
      _subcollectionsLoaded: false
    }]);

    await loadClientSubcollectionsIfNeeded(8001);
    await new Promise(r => setTimeout(r, 20));

    expect(clients[0].programs.length).toBe(1);
    expect(clients[0].programs[0].programName).toBe('Desktop - تجاري V26');
    expect(clients[0].programsCount).toBe(1);
    expect(clients[0].installationsCount).toBe(2);

    // Subcollection must now have the backfilled program
    const sub = await getClientSubcollections('tenant-1', '8001');
    expect(sub.programs.length).toBe(1);
    expect(sub.programs[0].id).toBe(8002);
  });

  it('Scenario 7: recovers programs from Timeline PROGRAM_ADDED when both subcollection and inline array are empty, without restoring deleted programs', async () => {
    firestoreState.docs.set('users/tenant-1/clients/9001', {
      id: 9001,
      fullName: 'عميل سجل التايملاين',
      status: 'نشط',
      startDate: '2026-10-05',
      programs: [],
      programsCount: 0,
      installationsCount: 0
    });

    const timelineActivities = [
      {
        id: 'act_prog_9001_9101',
        clientId: 9001,
        clientName: 'عميل سجل التايملاين',
        type: ActivityType.PROGRAM_ADDED,
        category: 'programs',
        title: 'خدمة ترخيص برنامج: Desktop - تجاري V27',
        description: 'تقديم وتثبيت خدمة برمجية "Desktop - تجاري V27" للعميل عميل سجل التايملاين - المنصة: Desktop - نوع الخدمة: تجاري (Commercial) - أجهزة مرخصة: 3 محطة (البداية: 2026-10-05) .',
        timestamp: '2026-10-05T10:00:00.000Z'
      },
      {
        id: 'act_prog_9001_9102',
        clientId: 9001,
        clientName: 'عميل سجل التايملاين',
        type: ActivityType.PROGRAM_ADDED,
        category: 'programs',
        title: 'خدمة ترخيص برنامج: Mobile - تطبيق',
        description: 'تقديم وتثبيت خدمة برمجية "Mobile - تطبيق" للعميل عميل سجل التايملاين - المنصة: Mobile - نوع الخدمة: تطبيق التاجر (Commerçant) - أجهزة مرخصة: 1 محطة (البداية: 2026-10-06) .',
        timestamp: '2026-10-06T10:00:00.000Z'
      },
      {
        id: 'del-act-9102',
        clientId: 9001,
        clientName: 'عميل سجل التايملاين',
        type: ActivityType.PROGRAM_DELETED,
        category: 'programs',
        title: 'حذف برنامج ترخيص',
        description: 'تم إزالة ترخيص البرنامج "Mobile - تطبيق" من حساب العميل.',
        timestamp: '2026-10-07T10:00:00.000Z'
      }
    ];

    setClients([{
      ...firestoreState.docs.get('users/tenant-1/clients/9001'),
      _subcollectionsLoaded: false
    }]);
    S.globalActivities = timelineActivities;

    const recoveredCount = await recoverMissingClientPrograms('tenant-1', timelineActivities);
    expect(recoveredCount).toBe(1);
    expect(clients[0].programs.length).toBe(1);
    expect(clients[0].programs[0].programName).toBe('Desktop - تجاري V27');
    expect(clients[0].programs[0].installationsCount).toBe(3);
    expect(clients[0].programsCount).toBe(1);

    // Deleted program should NOT be resurrected
    expect(clients[0].programs.some(p => p.programName === 'Mobile - تطبيق')).toBe(false);

    // Verify Firestore subcollection backfill
    const sub = await getClientSubcollections('tenant-1', '9001');
    expect(sub.programs.length).toBe(1);
    expect(sub.programs[0].id).toBe(9101);
  });

  it('Scenario 8: ensures Timeline and Programs list match without duplicate PROGRAM_ADDED events', async () => {
    setupClientModalDom({
      fullName: 'عميل التطابق',
      platform: 'Desktop',
      progType: 'توزيع (Distribution)',
      version: 'V24',
      installationsCount: '2'
    });

    await saveClient(null);
    await new Promise(r => setTimeout(r, 20));

    const created = clients[0];
    const addedEventsBeforeSync = S.globalActivities.filter(
      a => Number(a.clientId) === Number(created.id) && a.type === ActivityType.PROGRAM_ADDED
    );
    expect(addedEventsBeforeSync.length).toBe(1);

    // Running syncCrmServicesToTimeline afterward must not create duplicates
    await syncCrmServicesToTimeline('tenant-1');
    const addedEventsAfterSync = S.globalActivities.filter(
      a => Number(a.clientId) === Number(created.id) && a.type === ActivityType.PROGRAM_ADDED
    );
    expect(addedEventsAfterSync.length).toBe(1);
    expect(reconcileClientPrograms({
      client: created,
      subPrograms: created.programs,
      inlinePrograms: created.programs,
      activities: S.globalActivities
    }).programs.length).toBe(1);
  });

  it('Scenario 9: stops background backfill immediately on permission-denied without spamming remaining clients', async () => {
    const prog1 = { id: 1001, programName: 'Desktop - تجاري V24', platform: 'Desktop', type: 'تجاري', version: 'V24', installationsCount: 1 };
    const prog2 = { id: 1002, programName: 'Desktop - تجاري V26', platform: 'Desktop', type: 'تجاري', version: 'V26', installationsCount: 1 };
    const prog3 = { id: 1003, programName: 'Mobile - تطبيق التاجر', platform: 'Mobile', type: 'تطبيق التاجر', version: '', installationsCount: 1 };

    setClients([
      { id: 101, fullName: 'عميل 1', status: 'نشط', programs: [prog1], programsCount: 0, _subcollectionsLoaded: false },
      { id: 102, fullName: 'عميل 2', status: 'نشط', programs: [prog2], programsCount: 0, _subcollectionsLoaded: false },
      { id: 103, fullName: 'عميل 3', status: 'نشط', programs: [prog3], programsCount: 0, _subcollectionsLoaded: false }
    ]);

    const permErr = new Error('Missing or insufficient permissions.');
    permErr.code = 'permission-denied';
    firestoreState.commitError = permErr;

    const recoveredCount = await recoverMissingClientPrograms('tenant-1', []);
    expect(recoveredCount).toBe(3);
    expect(firestoreState.commitCalls).toBe(1);

    // Subsequent call in same session stays short-circuited instead of retrying
    const secondCount = await recoverMissingClientPrograms('tenant-1', []);
    expect(secondCount).toBe(0);
    expect(firestoreState.commitCalls).toBe(1);
  });

  it('Scenario 11: commits recovered programs for multiple clients in a single writeBatch to avoid snapshot re-render storms', async () => {
    const prog1 = { id: 2001, programName: 'Desktop - تجاري V24', platform: 'Desktop', type: 'تجاري', version: 'V24', installationsCount: 1 };
    const prog2 = { id: 2002, programName: 'Desktop - تجاري V26', platform: 'Desktop', type: 'تجاري', version: 'V26', installationsCount: 2 };
    const prog3 = { id: 2003, programName: 'Mobile - تطبيق التاجر', platform: 'Mobile', type: 'تطبيق التاجر', version: '', installationsCount: 1 };

    setClients([
      { id: 201, fullName: 'عميل دفعة 1', status: 'نشط', programs: [prog1], programsCount: 0, _subcollectionsLoaded: false },
      { id: 202, fullName: 'عميل دفعة 2', status: 'نشط', programs: [prog2], programsCount: 0, _subcollectionsLoaded: false },
      { id: 203, fullName: 'عميل دفعة 3', status: 'نشط', programs: [prog3], programsCount: 0, _subcollectionsLoaded: false }
    ]);

    const recoveredCount = await recoverMissingClientPrograms('tenant-1', []);
    expect(recoveredCount).toBe(3);
    expect(firestoreState.commitCalls).toBe(1);
    expect(clients.every(c => c.programsCount === 1)).toBe(true);
  });

  it('Scenario 10: keeps _subcollectionsLoaded true even if clients array is replaced mid-fetch by a realtime snapshot', async () => {
    const cid = 9501;
    firestoreState.docs.set(`users/tenant-1/clients/${cid}`, {
      id: cid,
      fullName: 'عميل التزامن',
      status: 'نشط',
      programs: [],
      programsCount: 0,
      installationsCount: 0
    });
    firestoreState.docs.set(`users/tenant-1/clients/${cid}/programs/9502`, {
      id: 9502,
      programName: 'Desktop - تجاري V27',
      platform: 'Desktop',
      type: 'تجاري (Commercial)',
      version: 'V27',
      installationsCount: 2,
      startDate: '2026-10-01',
      endDate: ''
    });

    setClients([{
      ...firestoreState.docs.get(`users/tenant-1/clients/${cid}`),
      _subcollectionsLoaded: false
    }]);

    // Simulate an intervening snapshot replacing the clients array while subcollections are loading
    const loadPromise = loadClientSubcollectionsIfNeeded(cid);
    setClients([{
      id: cid,
      fullName: 'عميل التزامن',
      status: 'نشط',
      programs: [],
      programsCount: 0,
      installationsCount: 0,
      _subcollectionsLoaded: false
    }]);
    await loadPromise;

    expect(clients[0]._subcollectionsLoaded).toBe(true);
    expect(clients[0].programs.length).toBe(1);
    expect(clients[0].programs[0].programName).toBe('Desktop - تجاري V27');
  });
});
