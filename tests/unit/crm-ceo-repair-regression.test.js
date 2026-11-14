import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { S, clients, setClients, setCurrentUser, setCurrentStaffUser, updateState } from '../../src/state/store.js';
import { saveClient, saveProgram, delProgram } from '../../src/business/actions/clientActions.js';
import { openModal } from '../../src/business/actions/uiActions.js';
import { reconcileMissingPrograms, resetReconciliationSession } from '../../src/business/programReconciliationService.js';
import { validateClient, validateProgram } from '../../src/firebase/validation.js';
import * as service from '../../src/firebase/service.js';
import { handleFirestoreError, OperationType } from '../../src/firebase/service.js';
import { renderDashboard } from '../../src/presentation/render-dashboard.js';
import { renderLicensesExplorerModal } from '../../src/presentation/render-modals.js';
import { renderDetail } from '../../src/presentation/render-views.js';
import { auth } from '../../src/firebase/config.js';
import * as storage from '../../src/business/storage.js';
import * as timelineService from '../../src/business/timelineService.js';
import * as utilsToast from '../../src/utils/toast.js';
import * as utilsConfirm from '../../src/utils/confirm.js';
import { getProgramStats } from '../../src/utils/index.js';

vi.mock('../../src/firebase/service.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    addClientTransaction: vi.fn(async (_uid, clientData, baseStats = {}) => {
      const next = { ...baseStats };
      next.totalClients = (next.totalClients || 0) + 1;
      if (clientData?.status === 'نشط') next.activeClients = (next.activeClients || 0) + 1;
      else if (clientData?.status === 'محتمل') next.prospectiveClients = (next.prospectiveClients || 0) + 1;
      else if (clientData?.status === 'متوقف') next.stoppedClients = (next.stoppedClients || 0) + 1;
      if (Array.isArray(clientData?.programs) && clientData.programs.length > 0) {
        next.totalPrograms = (next.totalPrograms || 0) + clientData.programs.length;
        next.totalLicensedDevices = (next.totalLicensedDevices || 0) + (clientData.installationsCount || 0);
      }
      return next;
    }),
    saveClientSubItemTransaction: vi.fn(async (_uid, _cid, _col, _iid, _itemData, _updates, globalStats) => globalStats),
    deleteClientSubItemTransaction: vi.fn(async (_uid, _cid, _col, _iid, _updates, globalStats) => globalStats),
    saveClientSubItemsBatch: vi.fn(async (_uid, entries) => entries.length),
    saveTenantActivitiesBatch: vi.fn(async (_tid, acts) => acts.length)
  };
});

vi.mock('../../src/utils/toast.js', () => ({
  showToast: vi.fn()
}));

vi.mock('../../src/utils/confirm.js', () => ({
  showConfirm: vi.fn(() => Promise.resolve(true)),
  showPrompt: vi.fn(() => Promise.resolve('تم الحل'))
}));

vi.mock('../../src/business/storage.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    enqueueSyncAction: vi.fn()
  };
});

vi.mock('../../src/business/timelineService.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    logActivity: vi.fn(() => Promise.resolve('act-1'))
  };
});

function mountFormInputs(values = {}, checkboxChecked = null) {
  document.body.innerHTML = '';
  for (const [id, val] of Object.entries(values)) {
    const input = document.createElement('input');
    input.id = id;
    input.value = val;
    document.body.appendChild(input);
  }
  if (checkboxChecked !== null) {
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.id = 'f_p_enabled';
    cb.checked = checkboxChecked;
    document.body.appendChild(cb);
  }
}

describe('CEO Repair Regression Suite — Client Programs, Sync, Zero Fabrication & Parity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetReconciliationSession();
    document.body.innerHTML = '';
    setCurrentStaffUser(null);
    setCurrentUser({ uid: 'ceo-tenant-1', role: 'gerant', email: 'ceo@progilic.dz' });
    updateState({
      clients: [],
      stats: { totalClients: 0, activeClients: 0, prospectiveClients: 0, stoppedClients: 0, totalPrograms: 0, totalLicensedDevices: 0, totalOpenIssues: 0 },
      globalActivities: [],
      syncQueue: [],
      isOnline: true,
      modal: null,
      form: {},
      view: 'list',
      selId: null
    });
  });

  afterEach(() => {
    document.body.innerHTML = '';
    setCurrentStaffUser(null);
    setCurrentUser(null);
    setClients([]);
  });

  describe('1. Priority #1: Client Creation + Initial Program Persistence & Timeline Parity', () => {
    it('creates client WITH initial Web program when #f_p_enabled is checked, commits transaction, computes stats once, and logs PROGRAM_ADDED', async () => {
      mountFormInputs({
        f_fn: 'أحمد بن علي',
        f_co: 'مؤسسة البركة',
        f_ph: '0550123456',
        f_wi: 'الجزائر',
        f_bt: 'تجارة تجزئة',
        f_bf: 'سوبرماركت',
        f_st: 'نشط',
        f_sd: '2026-11-10',
        f_lc: '2026-11-10',
        f_p_pl: 'Web',
        f_p_ty: 'منظومة الويب (Web ERP)',
        f_p_ver: 'V27',
        f_p_ic: '3',
        f_p_sd: '2026-11-10',
        f_p_ed: '2027-11-10'
      }, true);

      await saveClient(null);

      expect(clients.length).toBe(1);
      const created = clients[0];
      expect(created.programs.length).toBe(1);
      expect(created.programsCount).toBe(1);
      expect(created.installationsCount).toBe(3);
      expect(created.programs[0]).toMatchObject({
        platform: 'Web',
        type: 'منظومة الويب (Web ERP)',
        version: 'V27',
        installationsCount: 3,
        startDate: '2026-11-10',
        endDate: '2027-11-10'
      });
      expect(created.programNames).toEqual([created.programs[0].programName]);
      expect(S.selId).toBe(created.id);
      expect(S.stats.totalClients).toBe(1);
      expect(S.stats.activeClients).toBe(1);
      expect(S.stats.totalPrograms).toBe(1);
      expect(S.stats.totalLicensedDevices).toBe(3);

      expect(service.addClientTransaction).toHaveBeenCalledWith(
        'ceo-tenant-1',
        expect.objectContaining({
          id: created.id,
          programsCount: 1,
          programs: [expect.objectContaining({ platform: 'Web', installationsCount: 3 })]
        }),
        expect.objectContaining({ totalClients: 0, totalPrograms: 0 })
      );

      const programAddedCalls = timelineService.logActivity.mock.calls.filter(
        call => call[1] === timelineService.ActivityType.PROGRAM_ADDED
      );
      expect(programAddedCalls.length).toBe(1);
      expect(programAddedCalls[0][0]).toBe(created.id);
      expect(programAddedCalls[0][3]).not.toContain('(البداية: ).');
    });

    it('creates client WITH initial Desktop and Mobile programs from creation modal and survives Timeline cloud failure', async () => {
      // Desktop creation
      mountFormInputs({
        f_fn: 'زبون سطح مكتب',
        f_co: 'شركة النور',
        f_ph: '0550111222',
        f_wi: 'سطيف',
        f_bt: 'تجارة تجزئة',
        f_bf: 'سوبرماركت',
        f_st: 'نشط',
        f_sd: '2026-11-11',
        f_lc: '2026-11-11',
        f_p_pl: 'Desktop',
        f_p_ty: 'تجاري (Commercial)',
        f_p_ver: 'V27',
        f_p_ic: '2'
      }, true);
      await saveClient(null);
      expect(clients[0].programs[0]).toMatchObject({ platform: 'Desktop', version: 'V27', installationsCount: 2, startDate: '' });

      // Mobile creation (no version required) + Timeline log failure does NOT roll back committed client/program
      timelineService.logActivity.mockRejectedValueOnce(new Error('timeline network error'));
      mountFormInputs({
        f_fn: 'زبون موبايل',
        f_co: 'شركة الموبايل',
        f_ph: '0660333444',
        f_wi: 'وهران',
        f_bt: 'تجارة تجزئة',
        f_bf: 'سوبرماركت',
        f_st: 'نشط',
        f_sd: '2026-11-12',
        f_lc: '2026-11-12',
        f_p_pl: 'Mobile',
        f_p_ty: 'تطبيق لوحة القيادة (Tableau de bord)',
        f_p_ver: 'V27',
        f_p_ic: '1'
      }, true);
      await saveClient(null);
      expect(clients.length).toBe(2);
      expect(clients[1].programs[0]).toMatchObject({ platform: 'Mobile', version: '', installationsCount: 1 });
      expect(utilsToast.showToast).toHaveBeenCalledWith(expect.stringContaining('تعذر مزامنة سجل النشاط'), 'warning');
    });

    it('creates client WITHOUT initial program when #f_p_enabled is unchecked even if hidden #f_p_* inputs have values', async () => {
      mountFormInputs({
        f_fn: 'زبون بدون برنامج',
        f_co: 'شركة الأمل',
        f_ph: '0550998877',
        f_wi: 'وهران',
        f_bt: 'تجارة تجزئة',
        f_bf: 'سوبرماركت',
        f_st: 'محتمل',
        f_sd: '2026-11-10',
        f_lc: '2026-11-10',
        f_p_pl: 'Desktop',
        f_p_ty: 'تجاري (Commercial)',
        f_p_ver: 'V27',
        f_p_ic: '1'
      }, false);

      await saveClient(null);

      expect(clients.length).toBe(1);
      const created = clients[0];
      expect(created.programs).toEqual([]);
      expect(created.programsCount).toBe(0);
      expect(created.installationsCount).toBe(0);
      expect(created.programNames).toEqual([]);

      const programAddedCalls = timelineService.logActivity.mock.calls.filter(
        call => call[1] === timelineService.ActivityType.PROGRAM_ADDED
      );
      expect(programAddedCalls.length).toBe(0);
    });

    it('selects the exact newly created client ID even when duplicate fullName exists', async () => {
      setClients([{ id: 1001, fullName: 'اسم مكرر', programs: [], issues: [], requirements: [], contactHistory: [] }]);
      mountFormInputs({
        f_fn: 'اسم مكرر',
        f_co: 'شركة ثانية',
        f_ph: '0770112233',
        f_wi: 'البليدة',
        f_bt: 'تجارة تجزئة',
        f_bf: 'سوبرماركت',
        f_st: 'نشط',
        f_sd: '2026-11-10',
        f_lc: '2026-11-10'
      }, false);

      await saveClient(null);

      expect(clients.length).toBe(2);
      const newer = clients[1];
      expect(newer.id).not.toBe(1001);
      expect(S.selId).toBe(newer.id);
    });

    it('adds Desktop, Mobile (blank version), and Web programs immutably via saveProgram and removes via delProgram', async () => {
      const baseClient = {
        id: 2001,
        fullName: 'عميل متعدد المنصات',
        status: 'نشط',
        programs: [],
        programsCount: 0,
        installationsCount: 0,
        programNames: [],
        issues: [],
        requirements: [],
        contactHistory: []
      };
      setClients([baseClient]);
      S.selId = 2001;

      // Desktop requires version
      mountFormInputs({ fp_pl: 'Desktop', fp_ty: 'تجاري (Commercial)', fp_ver: '', fp_ic: '2' });
      await saveProgram(null);
      expect(clients[0].programs.length).toBe(0);
      expect(utilsToast.showToast).toHaveBeenCalled();

      // Valid Desktop program
      mountFormInputs({ fp_pl: 'Desktop', fp_ty: 'تجاري (Commercial)', fp_ver: 'V27', fp_ic: '2', fp_sd: '2026-11-10' });
      await saveProgram(null);
      expect(clients[0].programs.length).toBe(1);
      expect(clients[0].programs[0].platform).toBe('Desktop');
      expect(clients[0].programs[0].version).toBe('V27');
      expect(clients[0]).not.toBe(baseClient);

      // Valid Mobile program (blank version allowed)
      const prevClientRef = clients[0];
      mountFormInputs({ fp_pl: 'Mobile', fp_ty: 'تطبيق لوحة القيادة (Tableau de bord)', fp_ver: 'V27', fp_ic: '1', fp_sd: '2026-11-10' });
      await saveProgram(null);
      expect(clients[0].programs.length).toBe(2);
      expect(clients[0].programs[1].platform).toBe('Mobile');
      expect(clients[0].programs[1].version).toBe('');
      expect(clients[0]).not.toBe(prevClientRef);

      // Valid Web program
      mountFormInputs({ fp_pl: 'Web', fp_ty: 'منظومة الويب (Web ERP)', fp_ver: '', fp_ic: '4', fp_sd: '2026-11-10' });
      await saveProgram(null);
      expect(clients[0].programs.length).toBe(3);
      expect(clients[0].programs[2].platform).toBe('Web');
      expect(clients[0].installationsCount).toBe(7);

      // Delete Mobile program
      const mobileId = clients[0].programs[1].id;
      await delProgram(2001, mobileId);
      expect(clients[0].programs.length).toBe(2);
      expect(clients[0].programsCount).toBe(2);
      expect(clients[0].installationsCount).toBe(6);
      expect(service.deleteClientSubItemTransaction).toHaveBeenCalledWith(
        'ceo-tenant-1',
        '2001',
        'programs',
        String(mobileId),
        expect.objectContaining({
          programsCount: 2,
          installationsCount: 6
        }),
        expect.any(Object)
      );
    });
  });

  describe('2. Validation & Strict Firestore Error Visibility', () => {
    it('retains CRM & Trello metadata in validateClient and validateProgram', () => {
      const cleanClient = validateClient({
        id: 500,
        fullName: 'Trello Client',
        status: 'نشط',
        trelloCardId: 'card-1',
        trelloSyncStatus: 'synced',
        category: 'VIP',
        commune: 'باب الزوار',
        programNames: ['Desktop - تجاري V27']
      });
      expect(cleanClient.trelloCardId).toBe('card-1');
      expect(cleanClient.trelloSyncStatus).toBe('synced');
      expect(cleanClient.category).toBe('VIP');
      expect(cleanClient.commune).toBe('باب الزوار');
      expect(cleanClient.programNames).toEqual(['Desktop - تجاري V27']);

      const cleanProg = validateProgram({
        id: 501,
        programName: 'Web ERP',
        platform: 'Web',
        type: 'منظومة الويب (Web ERP)',
        version: 'V27',
        source: 'trello',
        trelloChecklistItemId: 'chk-1',
        lastModifiedBy: 'ceo@progilic.dz',
        notes: 'ملاحظة مهمة'
      });
      expect(cleanProg.source).toBe('trello');
      expect(cleanProg.trelloChecklistItemId).toBe('chk-1');
      expect(cleanProg.lastModifiedBy).toBe('ceo@progilic.dz');
      expect(cleanProg.notes).toBe('ملاحظة مهمة');
      expect(cleanProg.version).toBe('V27');
    });

    it('handleFirestoreError throws structured JSON when authenticated and returns null when signed out', () => {
      const origUser = auth.currentUser;
      try {
        Object.defineProperty(auth, 'currentUser', { value: null, configurable: true });
        expect(handleFirestoreError(new Error('permission-denied'), OperationType.WRITE, 'users/u1/clients/c1')).toBeNull();

        Object.defineProperty(auth, 'currentUser', {
          value: { uid: 'u1', email: 'ceo@progilic.dz', emailVerified: true, isAnonymous: false },
          configurable: true
        });
        let thrown = null;
        try {
          handleFirestoreError(new Error('permission-denied'), OperationType.WRITE, 'users/u1/clients/c1');
        } catch (err) {
          thrown = err;
        }
        expect(thrown).toBeInstanceOf(Error);
        const parsed = JSON.parse(thrown.message);
        expect(parsed).toMatchObject({
          error: 'permission-denied',
          operationType: 'write',
          path: 'users/u1/clients/c1',
          authInfo: expect.objectContaining({ userId: 'u1' })
        });
      } finally {
        Object.defineProperty(auth, 'currentUser', { value: origUser, configurable: true });
      }
    });
  });

  describe('3. Zero Fabrication & Dashboard / Licenses Explorer Parity', () => {
    it('never fabricates programs for active clients lacking timeline trace, even if stale programNames exist, and cleanses phantom metadata', async () => {
      setClients([{
        id: 3001,
        fullName: 'عميل بدون برامج وبدون أثر زمني',
        status: 'نشط',
        programs: [],
        programNames: ['Desktop - تجاري V27'],
        programsCount: 1,
        installationsCount: 1
      }]);
      S.globalActivities = [];

      const res = await reconcileMissingPrograms('ceo-tenant-1');
      expect(res.reconciledCount).toBe(0);
      expect(clients[0].programs).toEqual([]);
      expect(clients[0].programsCount).toBe(0);
      expect(clients[0].programNames).toEqual([]);
      expect(clients[0].installationsCount).toBe(0);

      const stats = getProgramStats(clients[0]);
      expect(stats.total).toBe(0);
      expect(stats.totalInstalls).toBe(0);

      // Detail view renders 0 programs & 0 devices, 'لا برامج', and never fake PROGILIC
      S.selId = 3001;
      const detailHtml = renderDetail();
      expect(detailHtml).not.toContain('Desktop - تجاري V27');
      expect(detailHtml).not.toContain('برنامج PROGILIC');
      expect(detailHtml).toContain('لا برامج');
      expect(detailHtml).toContain('0 جهاز');
      // Tab count strictly 0
      expect(detailHtml).toContain('<span class="tab-count">0</span>');
    });

    it('recovers program ONLY when verified PROGRAM_ADDED activity exists in timeline', async () => {
      setClients([{
        id: 3002,
        fullName: 'عميل موثق في الخط الزمني',
        status: 'نشط',
        programs: [],
        programNames: [],
        programsCount: 0,
        installationsCount: 0
      }]);
      S.globalActivities = [{
        id: 'act-prog-1',
        clientId: 3002,
        clientName: 'عميل موثق في الخط الزمني',
        type: 'PROGRAM_ADDED',
        title: 'خدمة ترخيص برنامج: Desktop - تجاري V27',
        description: 'إضافة خدمة برمجية "Desktop - تجاري V27" - المنصة: Desktop - نوع الخدمة: تجاري (Commercial) - أجهزة مرخصة: 3',
        timestamp: '2026-11-12T10:00:00Z',
        meta: {
          program: {
            id: 8888,
            programName: 'Desktop - تجاري V27',
            platform: 'Desktop',
            type: 'تجاري (Commercial)',
            version: 'V27',
            installationsCount: 3,
            startDate: '2026-11-12'
          }
        }
      }];

      const res = await reconcileMissingPrograms('ceo-tenant-1');
      expect(res.reconciledCount).toBe(1);
      expect(clients[0].programs.length).toBe(1);
      expect(clients[0].programs[0].programName).toBe('Desktop - تجاري V27');
      expect(clients[0].programs[0].installationsCount).toBe(3);
      expect(clients[0].programsCount).toBe(1);
    });

    it('matches platform counts 100% between Dashboard and Licenses Explorer modal across Desktop, Mobile, Web, and normalized Hybrid', () => {
      setClients([
        {
          id: 4001,
          fullName: 'عميل 1',
          status: 'نشط',
          programs: [
            { id: 1, programName: 'Desktop - تجاري V27', platform: 'Desktop', type: 'تجاري', version: 'V27', installationsCount: 2 },
            { id: 2, programName: 'Desktop - تجاري V27', platform: 'Desktop', type: 'تجاري', version: 'V27', installationsCount: 2 }, // duplicate same key
            { id: 3, programName: 'Hybrid Sync', platform: 'Hybrid', type: 'تجاري', version: 'V24', installationsCount: 1 } // normalizes to Desktop
          ],
          issues: [], requirements: [], contactHistory: []
        },
        {
          id: 4002,
          fullName: 'عميل 2',
          status: 'نشط',
          programs: [
            { id: 4, programName: 'Mobile App', platform: 'Mobile', type: 'تطبيق', version: '', installationsCount: 3 },
            { id: 5, programName: 'Web Portal', platform: 'Web', type: 'ويب', version: '', installationsCount: 1 }
          ],
          issues: [], requirements: [], contactHistory: []
        }
      ]);

      const dashHtml = renderDashboard();
      const explorerHtml = renderLicensesExplorerModal();

      // Deduplicated licenses: 2 Desktop (4001: V27 + V24) + 1 Mobile (4002) + 1 Web (4002) = 4 total
      expect(dashHtml).toContain('Desktop (2)');
      expect(dashHtml).toContain('Mobile (1)');
      expect(dashHtml).toContain('Web (1)');

      expect(explorerHtml).toContain('4 ت'); // or 4 ترخيص
      expect(explorerHtml).toContain('Desktop');
      expect(explorerHtml).toContain('4 ترخيص');
      // Explorer device total = 2 + 1 + 3 + 1 = 7
      expect(explorerHtml).toContain('>7<');
    });
  });

  describe('4. Modal Permission Guards', () => {
    it('blocks unauthorized staff from editProgram, editReq, dbPurge, and employee management modals', () => {
      setCurrentUser({ uid: 'ceo-tenant-1', role: 'employee' });
      setCurrentStaffUser({
        id: 'emp-1',
        role: 'employee',
        permissions: {} // no edit/delete/admin permissions
      });

      openModal('editProgram', { eid: 1 });
      expect(S.modal).toBeNull();

      openModal('editReq', { eid: 1 });
      expect(S.modal).toBeNull();

      openModal('dbPurge');
      expect(S.modal).toBeNull();

      openModal('addEmployee');
      expect(S.modal).toBeNull();

      expect(utilsToast.showToast).toHaveBeenCalledTimes(4);
    });
  });
});
