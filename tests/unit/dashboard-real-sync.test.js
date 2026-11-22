import { describe, it, expect, vi, beforeEach } from 'vitest';

const firestoreState = vi.hoisted(() => ({
  docs: new Map(),
  failClientSubcollections: new Set()
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
    const parts = ref.path.split('/');
    if (parts.length >= 4 && parts[2] === 'clients' && firestoreState.failClientSubcollections.has(parts[3])) {
      const err = new Error('Missing or insufficient permissions.');
      err.code = 'permission-denied';
      throw err;
    }
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
import { hydrateAllClientSubcollections, stopRealtimeSync } from '../../src/business/storage.js';
import { renderDashboard } from '../../src/presentation/render-dashboard.js';
import { renderLicensesExplorerModal, renderGeoReportModal } from '../../src/presentation/render-modals.js';
import { computeStats } from '../../src/business/mergeDatabase.js';
import { computeScore } from '../../src/business/intelligence.js';
import { ActivityType } from '../../src/business/timelineService.js';

function localYmdOffset(daysDelta = 0) {
  const dt = new Date();
  dt.setDate(dt.getDate() + daysDelta);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

describe('Dashboard Real CRM Sync & Metrics', () => {
  beforeEach(() => {
    stopRealtimeSync();
    firestoreState.docs.clear();
    firestoreState.failClientSubcollections.clear();
    document.body.innerHTML = '';
    setCurrentUser({ uid: 'tenant-1', role: 'gerant', email: 'owner@progilic.dz', isEmployee: false });
    setClients([]);
    updateState({
      isOnline: true,
      syncQueue: [],
      globalActivities: [],
      clientActivities: [],
      selId: null,
      view: 'dashboard',
      dbPeriod: 30,
      dbWilaya: 'all',
      modal: null,
      form: {},
      stats: {
        activeClients: 0,
        prospectiveClients: 0,
        stoppedClients: 0,
        totalClients: 0,
        totalPrograms: 0,
        totalLicensedDevices: 0,
        averageScore: 0,
        totalOpenIssues: 0
      }
    });
    firestoreState.docs.set('users/tenant-1', { v: 3, nid: 100, stats: { ...S.stats } });
  });

  it('hydrates subcollections across unhydrated clients, computes live scores/stats, and deduplicates concurrent runs', async () => {
    const today = localYmdOffset(0);
    // Client 1: hydrated from Firestore subcollections with 2 programs + 1 open issue + 1 contact
    firestoreState.docs.set('users/tenant-1/clients/101/programs/1001', {
      id: 1001,
      programName: 'Desktop - تجاري V27',
      platform: 'Desktop',
      type: 'تجاري (Commercial)',
      version: 'V27',
      installationsCount: 3,
      startDate: today,
      endDate: ''
    });
    firestoreState.docs.set('users/tenant-1/clients/101/programs/1002', {
      id: 1002,
      programName: 'Mobile - تطبيق التاجر',
      platform: 'Mobile',
      type: 'تطبيق التاجر',
      version: '',
      installationsCount: 2,
      startDate: today,
      endDate: ''
    });
    firestoreState.docs.set('users/tenant-1/clients/101/issues/2001', {
      id: 2001,
      title: 'مشكلة طابعة',
      priority: 'عاجلة',
      status: 'مفتوح',
      date: today
    });
    firestoreState.docs.set('users/tenant-1/clients/101/contacts/3001', {
      id: 3001,
      date: today,
      note: 'اتصال متابعة'
    });

    // Client 2: zero programs, zero issues, prospective
    setClients([
      {
        id: 101,
        fullName: 'شركة الأمل',
        status: 'نشط',
        wilaya: 'الجزائر',
        startDate: today,
        lastContact: '',
        score: 100, // stale persisted score
        programs: [],
        issues: [],
        requirements: [],
        contactHistory: [],
        _subcollectionsLoaded: false
      },
      {
        id: 102,
        fullName: 'متجر بدون برامج',
        status: 'محتمل',
        wilaya: 'وهران',
        startDate: localYmdOffset(-120),
        lastContact: '',
        score: 100,
        programs: [],
        issues: [],
        requirements: [],
        contactHistory: [],
        _subcollectionsLoaded: false
      }
    ]);

    const p1 = hydrateAllClientSubcollections('tenant-1');
    const p2 = hydrateAllClientSubcollections('tenant-1');
    expect(p1).toBe(p2);

    const hydratedCount = await p1;
    expect(hydratedCount).toBe(2);

    const c1 = clients.find(c => c.id === 101);
    const c2 = clients.find(c => c.id === 102);
    expect(c1._subcollectionsLoaded).toBe(true);
    expect(c2._subcollectionsLoaded).toBe(true);
    expect(c1.programs.length).toBe(2);
    expect(c1.installationsCount).toBe(5);
    expect(c1.issues.length).toBe(1);
    expect(c1.openIssuesCount).toBe(1);
    expect(c1.lastContact).toBe(today);

    // Live score computed across full hydrated list (not frozen at stale 100)
    expect(c1.score).toBe(computeScore(c1).total);
    expect(c2.score).toBe(computeScore(c2).total);
    expect(c2.score).toBeLessThan(100);

    // Real aggregated stats without phantom devices for c2
    expect(S.stats.totalClients).toBe(2);
    expect(S.stats.totalPrograms).toBe(2);
    expect(S.stats.totalLicensedDevices).toBe(5);
    expect(S.stats.totalOpenIssues).toBe(1);
    expect(S.stats.averageScore).toBe(Math.round((c1.score + c2.score) / 2));
  });

  it('does not falsely mark _subcollectionsLoaded = true when subcollection fetch fails', async () => {
    firestoreState.failClientSubcollections.add('501');
    setClients([
      {
        id: 501,
        fullName: 'عميل محمي',
        status: 'نشط',
        programs: [],
        issues: [],
        requirements: [],
        contactHistory: [],
        _subcollectionsLoaded: false
      }
    ]);

    const count = await hydrateAllClientSubcollections('tenant-1');
    expect(count).toBe(0);
    expect(clients[0]._subcollectionsLoaded).toBe(false);
  });

  it('renders real dashboard counts without phantom devices, stale scores, duplicate department events, or synthetic deltas', () => {
    const today = localYmdOffset(0);
    const yesterday = localYmdOffset(-1);

    const clientWithSub = {
      id: 1,
      fullName: 'مؤسسة النور',
      status: 'نشط',
      wilaya: 'الجزائر',
      startDate: yesterday,
      lastContact: today,
      score: 100, // intentionally stale
      _subcollectionsLoaded: true,
      programs: [
        {
          id: 10,
          programName: 'Desktop - تجاري V27',
          platform: 'Desktop',
          type: 'تجاري (Commercial)',
          version: 'V27',
          installationsCount: 4,
          startDate: yesterday,
          endDate: ''
        },
        {
          id: 11,
          programName: 'Mobile - تطبيق التاجر',
          platform: 'Mobile',
          type: 'تطبيق التاجر',
          version: '',
          installationsCount: 1,
          startDate: today,
          endDate: ''
        }
      ],
      issues: [
        {
          id: 20,
          title: 'انقطاع شبكة',
          priority: 'عاجلة',
          status: 'مفتوح',
          date: today
        },
        {
          id: 21,
          title: 'استفسار تفعيل',
          priority: 'عالية',
          status: 'جديد',
          date: today
        },
        {
          id: 22,
          title: 'مشكلة سابقة',
          priority: 'منخفضة',
          status: 'محلول',
          date: today
        }
      ],
      requirements: [
        {
          id: 30,
          title: 'تصدير إكسل',
          priority: 'عالية',
          status: 'قيد الدراسة',
          date: today
        }
      ],
      contactHistory: [
        {
          id: 40,
          date: today,
          note: 'اتصال دعم'
        }
      ]
    };

    const clientZeroPrograms = {
      id: 2,
      fullName: 'عميل محتمل قديم',
      status: 'متوقف',
      wilaya: 'سطيف',
      startDate: localYmdOffset(-180),
      lastContact: '',
      score: 100, // intentionally stale
      _subcollectionsLoaded: true,
      programs: [],
      issues: [],
      requirements: [],
      contactHistory: []
    };

    setClients([clientWithSub, clientZeroPrograms]);

    const nowIso = new Date().toISOString();
    S.globalActivities = [
      // Deterministic act_prog id matching program 10 on client 1 -> must NOT double-count in dept commercial
      {
        id: 'act_prog_1_10',
        clientId: 1,
        clientName: 'مؤسسة النور',
        type: ActivityType.PROGRAM_ADDED,
        title: 'إضافة برنامج: Desktop - تجاري V27',
        description: 'ترخيص 4 أجهزة',
        userName: 'أحمد التجاري',
        timestamp: nowIso
      },
      // System/backup events must be excluded from department tallies
      {
        id: 'act_backup_1',
        type: ActivityType.BACKUP_CREATED,
        title: 'نسخة احتياطية',
        userName: 'المدير',
        timestamp: nowIso
      },
      // Email-only actor fallback check
      {
        id: 'act_contact_1_40',
        clientId: 1,
        clientName: 'مؤسسة النور',
        type: ActivityType.CONTACT_ADDED,
        title: 'مكالمة متابعة',
        description: 'اتصال دعم',
        actorEmail: 'suivi@progilic.dz',
        timestamp: nowIso
      }
    ];

    const html = renderDashboard();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const kpiCards = Array.from(doc.querySelectorAll('.card.kpi'));

    // 1. Exact devices count = 5 (4 Desktop + 1 Mobile), KPI 2 shows 5 الأجهزة المرخصة عبر 2 برامج
    expect(kpiCards[1].textContent).toContain('الأجهزة المرخصة');
    expect(kpiCards[1].querySelector('.val b')?.textContent?.trim()).toBe('5');
    expect(html).toContain('عبر 2 برنامج مرخص');

    // 2. Open issues counts both 'مفتوح' and 'جديد' = 2
    expect(html).toContain('تذاكر دعم مفتوحة');
    expect(html).toContain('منها 1 عاجلة');

    // 3. Real live average score (not hardcoded or stale 100)
    const liveS1 = computeScore(clientWithSub).total;
    const liveS2 = computeScore(clientZeroPrograms).total;
    const expectedAvg = Math.round((liveS1 + liveS2) / 2);
    expect(expectedAvg).toBeLessThan(100);
    expect(html).toContain(`<b class="num">${expectedAvg}</b><small>/ 100</small>`);

    // 4. Real 30d delta for Card 1 (clients: 1 new in 30d) & Card 2 (devices: 5 added in 30d)
    expect(kpiCards[0].textContent).toContain('+1 هذا الشهر');
    expect(kpiCards[0].textContent).not.toContain('+2 هذا الشهر');
    expect(kpiCards[1].textContent).toContain('+5 هذا الشهر');

    // 5. Recent activities filter out BACKUP_CREATED, show real actor names/email prefix and link to client card
    expect(html).toContain('أحمد التجاري');
    expect(html).toContain('suivi');
    expect(html).not.toContain('نسخة احتياطية');
    expect(html).toContain('selClient(1)');

    // 6. Contracts & Client Health replaced cleanly
    expect(html).not.toContain('عقود تنتهي');
    expect(html).not.toContain('صحة العملاء');
    expect(html).toContain('تغطية المتابعة');
    expect(html).toContain('الأجهزة المباعة حسب الفئة');

    // 6. Department Commercial has exactly 2 events (prog 10 deduplicated between globalActivities and c.programs + prog 11), NOT 3
    const deptCards = Array.from(doc.querySelectorAll('.card.dept'));
    const commercialCard = deptCards.find(el => el.textContent.includes('القسم التجاري'));
    expect(commercialCard).toBeTruthy();
    expect(commercialCard.querySelector('.big')?.firstChild?.textContent?.trim()).toBe('2');

    // Technique has 3 issues + 1 req = 4 activities this week
    const techCard = deptCards.find(el => el.textContent.includes('القسم التقني'));
    expect(techCard).toBeTruthy();
    expect(techCard.querySelector('.big')?.firstChild?.textContent?.trim()).toBe('4');
  });

  it('shows dash instead of V27 for Mobile or unversioned licenses in Licenses Explorer Modal', () => {
    setClients([
      {
        id: 1,
        fullName: 'عميل موبايل',
        status: 'نشط',
        wilaya: 'وهران',
        _subcollectionsLoaded: true,
        programs: [
          {
            id: 55,
            programName: 'Mobile - تطبيق التاجر',
            platform: 'Mobile',
            type: 'تطبيق التاجر',
            version: '',
            installationsCount: 2,
            startDate: '2026-11-10'
          }
        ],
        issues: [],
        requirements: [],
        contactHistory: []
      }
    ]);

    S.modal = 'licenses_explorer';
    S.form = { platform: 'all', version: 'all', search: '', viewMode: 'table' };
    const tableHtml = renderLicensesExplorerModal();
    const tableDoc = new DOMParser().parseFromString(tableHtml, 'text/html');
    expect(tableHtml).toContain('Mobile');
    expect(tableDoc.querySelector('.lic-pill-ver')?.textContent?.trim()).toBe('—');

    S.form = { platform: 'all', version: 'all', search: '', viewMode: 'cards' };
    const cardsHtml = renderLicensesExplorerModal();
    const cardsDoc = new DOMParser().parseFromString(cardsHtml, 'text/html');
    expect(cardsHtml).toContain('Mobile');
    expect(cardsDoc.querySelector('.lic-pill-ver')?.textContent?.trim()).toBe('—');
  });

  it('verifies the exact number of real software in the whole CRM across stats, dashboard, modals, and platform charts', () => {
    // Fleet setup:
    // Client 1 (الجزائر): 3 hydrated programs (1 Desktop 4 devices, 1 Mobile 2 devices, 1 Web 1 device) = 3 programs, 7 devices
    // Client 2 (وهران): 1 unhydrated summary program (Desktop 2 devices) = 1 program, 2 devices
    // Client 3 (قسنطينة): 0 programs, 0 devices
    // Expected Real Software Total in CRM: 4 programs across 9 devices
    // Platform breakdown: Desktop = 2, Mobile = 1, Web = 1
    const testClients = [
      {
        id: 701,
        fullName: 'مجمع الصناعات الكبرى',
        status: 'نشط',
        wilaya: 'الجزائر',
        startDate: '2026-11-01',
        _subcollectionsLoaded: true,
        programs: [
          {
            id: 7001,
            programName: 'Desktop - تجاري V27',
            platform: 'Desktop',
            type: 'تجاري (Commercial)',
            version: 'V27',
            installationsCount: 4,
            startDate: '2026-11-01'
          },
          {
            id: 7002,
            programName: 'Mobile - تطبيق التاجر',
            platform: 'Mobile',
            type: 'تطبيق التاجر (Commerçant)',
            version: '',
            installationsCount: 2,
            startDate: '2026-11-05'
          },
          {
            id: 7003,
            programName: 'Web - الويب V27',
            platform: 'Web',
            type: 'الويب',
            version: 'V27',
            installationsCount: 1,
            startDate: '2026-11-10'
          }
        ],
        issues: [],
        requirements: [],
        contactHistory: []
      },
      {
        id: 702,
        fullName: 'شركة الغرب للتوزيع',
        status: 'نشط',
        wilaya: 'وهران',
        startDate: '2026-11-08',
        _subcollectionsLoaded: false,
        programs: [],
        programsCount: 1,
        programNames: ['Desktop - توزيع V26'],
        installationsCount: 2,
        issues: [],
        requirements: [],
        contactHistory: []
      },
      {
        id: 703,
        fullName: 'مؤسسة الخدمات الشرقية',
        status: 'محتمل',
        wilaya: 'قسنطينة',
        startDate: '2026-10-15',
        _subcollectionsLoaded: true,
        programs: [],
        programsCount: 0,
        installationsCount: 0,
        issues: [],
        requirements: [],
        contactHistory: []
      }
    ];

    setClients(testClients);

    // 1. Core State Stats Verification
    const { stats } = computeStats(clients);
    expect(stats.totalPrograms).toBe(4);
    expect(stats.totalLicensedDevices).toBe(9);
    expect(stats.totalClients).toBe(3);

    // 2. Executive Dashboard Verification
    const dashHtml = renderDashboard();
    const dashDoc = new DOMParser().parseFromString(dashHtml, 'text/html');
    const kpiCards = Array.from(dashDoc.querySelectorAll('.card.kpi'));

    // Card 2 is "الأجهزة المرخصة" showing total devices (9) across 4 programs
    const progCard = kpiCards[1];
    expect(progCard.textContent).toContain('الأجهزة المرخصة');
    expect(progCard.querySelector('.val b')?.textContent?.trim()).toBe('9');
    expect(progCard.textContent).toContain('عبر 4 برنامج مرخص');

    // Platform Column Chart counts DEVICES: Desktop = 6 (4+2), Mobile = 2, Web = 1 => 67%, 22%, 11%
    const colChartSvg = dashDoc.querySelector('.plat-col-group');
    expect(colChartSvg).toBeTruthy();
    expect(dashHtml).toContain('<title>Desktop: 6 جهاز (67%');
    expect(dashHtml).toContain('<title>Mobile: 2 جهاز (22%');
    expect(dashHtml).toContain('<title>Web: 1 جهاز (11%');

    // 3. Licenses Explorer Modal Verification
    S.modal = 'licenses_explorer';
    S.form = { platform: 'all', version: 'all', search: '', viewMode: 'table' };
    const modalHtml = renderLicensesExplorerModal();
    const modalDoc = new DOMParser().parseFromString(modalHtml, 'text/html');

    // Top badges & pills
    const kpiVals = Array.from(modalDoc.querySelectorAll('.lic-kpi-val')).map(el => el.textContent.trim());
    expect(kpiVals[0]).toBe('4'); // إجمالي التراخيص
    expect(kpiVals[1]).toBe('2'); // Desktop
    expect(kpiVals[2]).toBe('1'); // Mobile
    expect(kpiVals[3]).toBe('1'); // Web
    expect(kpiVals[4]).toBe('9'); // إجمالي الأجهزة

    // Table rows: exactly 4 licenses listed
    const tableRows = modalDoc.querySelectorAll('.lic-table tbody tr');
    expect(tableRows.length).toBe(4);

    // 4. Geographic Report Verification
    S.modal = 'geoReport';
    const geoHtml = renderGeoReportModal();
    expect(geoHtml).toContain('الجزائر');
    expect(geoHtml).toContain('وهران');

    // 5. Dynamic Mutation Consistency
    // Remove Web program from Client 1
    const updatedClients = [
      {
        ...testClients[0],
        programs: testClients[0].programs.slice(0, 2) // keep Desktop and Mobile, remove Web
      },
      testClients[1],
      testClients[2]
    ];
    setClients(updatedClients);

    const recomputed = computeStats(clients);
    expect(recomputed.stats.totalPrograms).toBe(3);
    expect(recomputed.stats.totalLicensedDevices).toBe(8);

    const updatedDashHtml = renderDashboard();
    const updatedDoc = new DOMParser().parseFromString(updatedDashHtml, 'text/html');
    const updatedProgCard = Array.from(updatedDoc.querySelectorAll('.card.kpi'))[1];
    expect(updatedProgCard.querySelector('.val b')?.textContent?.trim()).toBe('8');
    expect(updatedProgCard.textContent).toContain('عبر 3 برنامج مرخص');
  });
});
