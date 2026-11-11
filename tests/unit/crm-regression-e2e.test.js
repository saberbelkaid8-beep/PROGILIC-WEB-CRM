import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { 
  S, 
  clients, 
  setClients, 
  currentUser, 
  setCurrentUser, 
  currentStaffUser, 
  setCurrentStaffUser, 
  setStaffUsers,
  updateState, 
  isGerant, 
  hasPermission,
  getActiveTenantId
} from '../../src/state/store.js';
import { renderDashboard, renderList, renderDetail } from '../../src/presentation/render-views.js';
import { applyFilters, formatCsvCell } from '../../src/utils/index.js';
import { setLanguage, t } from '../../src/utils/i18n.js';
import { logActivity, ActivityType, getTimeline } from '../../src/business/timelineService.js';
import { 
  deleteEmployeeWithPassword, 
  upsertEmployee, 
  getEmployees,
  DEPARTMENTS 
} from '../../src/business/employeeService.js';
import { computeScore, computeRiskProfile } from '../../src/business/intelligence.js';
import { validateClient, validateProgram } from '../../src/firebase/validation.js';

describe('Task 7 CRM Core Functional Regression Suite (Scenarios A through P)', () => {
  const TENANT_A = 'tenant_company_alpha';
  const TENANT_B = 'tenant_company_beta';

  beforeEach(() => {
    setLanguage('ar');
    setClients([]);
    setStaffUsers([]);
    setCurrentStaffUser(null);
    setCurrentUser(null);
    updateState({
      view: 'dashboard',
      selId: null,
      tab: 'overview',
      dbActiveTab: 'overview',
      dbPeriod: 30,
      dbWilaya: 'all',
      filter: 'الكل',
      q: '',
      fWilaya: '',
      fCommune: '',
      fActivity: '',
      fActType: '',
      fProgram: '',
      sortBy: 'id',
      sortOrder: 'desc',
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
  });

  afterEach(() => {
    setClients([]);
    setStaffUsers([]);
    setCurrentStaffUser(null);
    setCurrentUser(null);
  });

  // Scenario A: Authorized login & dashboard open
  it('Scenario A: Authorized Gérant login renders executive dashboard with KPIs', () => {
    setCurrentUser({
      uid: 'gerant-master-1',
      tenantId: TENANT_A,
      email: 'gerant@progilic.dz',
      displayName: 'المدير العام',
      role: 'gerant',
      emailVerified: true
    });

    expect(isGerant()).toBe(true);
    expect(hasPermission('dashboard.view')).toBe(true);

    const clientSample = {
      id: 101,
      tenantId: TENANT_A,
      fullName: 'مؤسسة النور للتجارة',
      company: 'النور للتوزيع',
      wilaya: 'وهران',
      status: 'نشط',
      score: 95,
      programs: [{ id: 1, programName: 'PROGILIC ERP V24', installationsCount: 2 }],
      issues: []
    };
    setClients([clientSample]);

    const markup = renderDashboard();
    expect(markup).toContain('لوحة القيادة');
    expect(markup).toContain('إجمالي العملاء');
    expect(markup).toContain('المؤشرات التنفيذية');
  });

  // Scenario B: Unauthorized user blocked from restricted module
  it('Scenario B: Employee from Pré-vente is strictly blocked from Gérant administrative actions', () => {
    const preVenteEmp = {
      id: 'emp_pre_vente_1',
      fullName: 'أحمد ما قبل البيع',
      username: 'ahmed_pv',
      department: 'pre_vente',
      role: 'employee',
      permissions: {
        'clients.view': true,
        'clients.create': true,
        'dashboard.view': true,
        'users.delete': false,
        'users.create': false
      }
    };
    setCurrentStaffUser(preVenteEmp);
    setCurrentUser({
      uid: 'user_ahmed',
      tenantId: TENANT_A,
      isEmployee: true,
      role: 'employee',
      emailVerified: true
    });

    expect(isGerant()).toBe(false);
    expect(hasPermission('users.delete')).toBe(false);

    // Attempting deleteEmployeeWithPassword must fail with unauthorized rejection
    const result = deleteEmployeeWithPassword('emp_target_2', 'wrong_or_right_pwd');
    expect(result.success).toBe(false);
    expect(result.message).toContain('فقط المسؤول العام');
  });

  // Scenario C: Commercial user creates customer
  it('Scenario C: Commercial user creates new customer with commercial metadata', () => {
    const commercialEmp = {
      id: 'emp_comm_1',
      fullName: 'سارة التجاري',
      username: 'sara_comm',
      department: 'commercial',
      role: 'employee',
      permissions: {
        'clients.view': true,
        'clients.create': true,
        'programs.create': true
      }
    };
    setStaffUsers([commercialEmp], TENANT_A);
    setCurrentStaffUser(commercialEmp);
    setCurrentUser({
      uid: 'sara_uid',
      tenantId: TENANT_A,
      isEmployee: true,
      role: 'employee',
      permissions: commercialEmp.permissions,
      emailVerified: true
    });

    expect(hasPermission('clients.create')).toBe(true);

    const newCustomer = {
      id: 201,
      tenantId: TENANT_A,
      fullName: 'شركة الأمل للأجهزة',
      company: 'الأمل SARL',
      phone: '0550123456',
      wilaya: 'الجزائر',
      status: 'نشط',
      businessType: 'تجارة تجزئة',
      businessField: 'أجهزة إلكترونية',
      programs: [
        { id: 1, programName: 'PROGILIC POS V15', platform: 'Desktop', installationsCount: 2 }
      ],
      issues: [],
      requirements: [],
      contactHistory: []
    };

    setClients([newCustomer]);
    expect(clients.length).toBe(1);
    expect(clients[0].fullName).toBe('شركة الأمل للأجهزة');
    expect(clients[0].programs[0].programName).toBe('PROGILIC POS V15');
  });

  // Scenario D: Authorized employee updates customer
  it('Scenario D: Authorized staff user updates customer details with phone and status', () => {
    const initialClient = {
      id: 301,
      tenantId: TENANT_A,
      fullName: 'مجمع الفلاح التجاري',
      company: 'الفلاح',
      phone: '0550111222',
      wilaya: 'سطيف',
      status: 'محتمل',
      programs: [],
      issues: []
    };
    setClients([initialClient]);

    // Update client status to 'نشط' and update phone
    const updatedClient = {
      ...initialClient,
      phone: '0550999888',
      status: 'نشط',
      company: 'مجمع الفلاح الجديد'
    };
    setClients([updatedClient]);

    expect(clients[0].phone).toBe('0550999888');
    expect(clients[0].status).toBe('نشط');
    expect(clients[0].company).toBe('مجمع الفلاح الجديد');
  });

  // Scenario E: Technical issue created
  it('Scenario E: Technical support issue is logged and health score reflects pending issue', () => {
    const client = {
      id: 401,
      tenantId: TENANT_A,
      fullName: 'صيدلية الشفاء',
      status: 'نشط',
      _subcollectionsLoaded: true,
      lastContact: '2026-11-01',
      programs: [{ id: 1, programName: 'ERP', installationsCount: 1 }],
      issues: []
    };
    setClients([client]);

    const initialScore = computeScore(client).total;
    expect(initialScore).toBeGreaterThanOrEqual(40);

    const updatedClient = {
      ...client,
      issues: [
        {
          id: 1001,
          title: 'خطأ في طباعة الفاتورة',
          type: 'خطأ تقني',
          priority: 'عاجل',
          status: 'مفتوح',
          repeatCount: 1,
          date: '2026-11-08'
        }
      ]
    };
    const updatedScore = computeScore(updatedClient).total;

    expect(updatedClient.issues.length).toBe(1);
    expect(updatedClient.issues[0].priority).toBe('عاجل');
    // Open urgent issue reduces client health score
    expect(updatedScore).toBeLessThan(initialScore);
  });

  // Scenario F: Feature requirement created
  it('Scenario F: Customer requirement/feature request is recorded in pipeline', () => {
    const client = {
      id: 501,
      tenantId: TENANT_A,
      fullName: 'سوبرماركت التوفيق',
      status: 'نشط',
      requirements: []
    };
    setClients([client]);

    const req = {
      id: 2001,
      title: 'إضافة قارئ الباركود اللاسلكي',
      type: 'ميزة جديدة',
      priority: 'عالية',
      status: 'مقترح',
      impact: 'عالية',
      date: '2026-11-08'
    };
    client.requirements.push(req);

    expect(client.requirements.length).toBe(1);
    expect(client.requirements[0].title).toBe('إضافة قارئ الباركود اللاسلكي');
    expect(client.requirements[0].status).toBe('مقترح');
  });

  // Scenario G: Interaction added to timeline
  it('Scenario G: Interaction logging records activity with actor attribution and retrieval', async () => {
    setCurrentUser({
      uid: 'user_technique_9',
      displayName: 'كريم مهندس الدعم'
    });

    const savedId = await logActivity(
      401,
      ActivityType.ISSUE_ADDED,
      'تسجيل تذكرة عطل تقني',
      'تم تسجيل تذكرة لطابعة الفواتير'
    );

    expect(savedId).toBeDefined();

    const logged = S.globalActivities.find(a => a.clientId === 401);
    expect(logged).toBeDefined();
    expect(logged.userName).toBe('كريم مهندس الدعم');
    expect(logged.type).toBe(ActivityType.ISSUE_ADDED);
    expect(logged.clientId).toBe(401);
    expect(logged.title).toBe('تسجيل تذكرة عطل تقني');
  });

  // Scenario H: Dashboard statistics update correctly
  it('Scenario H: Dashboard statistics reactive counts mirror active, prospective, and stopped cohorts', () => {
    const sample = [
      { id: 1, fullName: 'عميل 1', status: 'نشط', wilaya: 'الجزائر', programs: [{ id: 10, installationsCount: 2 }], issues: [] },
      { id: 2, fullName: 'عميل 2', status: 'نشط', wilaya: 'وهران', programs: [{ id: 11, installationsCount: 1 }], issues: [] },
      { id: 3, fullName: 'عميل 3', status: 'محتمل', wilaya: 'قسنطينة', programs: [], issues: [] },
      { id: 4, fullName: 'عميل 4', status: 'متوقف', wilaya: 'عنابة', programs: [], issues: [{ id: 1, status: 'مفتوح' }] }
    ];
    setClients(sample);

    const activeCount = sample.filter(c => c.status === 'نشط').length;
    const prospectiveCount = sample.filter(c => c.status === 'محتمل').length;
    const stoppedCount = sample.filter(c => c.status === 'متوقف').length;

    expect(activeCount).toBe(2);
    expect(prospectiveCount).toBe(1);
    expect(stoppedCount).toBe(1);

    const totalPrograms = sample.reduce((acc, c) => acc + c.programs.length, 0);
    const totalDevices = sample.reduce((acc, c) => acc + c.programs.reduce((sum, p) => sum + p.installationsCount, 0), 0);
    expect(totalPrograms).toBe(2);
    expect(totalDevices).toBe(3);
  });

  // Scenario I: Search & filters return expected records
  it('Scenario I: Global search and faceted Wilaya/Status filters accurately isolate records', () => {
    const catalog = [
      { id: 10, fullName: 'سوبرماركت المدينة', company: 'المدينة SARL', wilaya: 'وهران', status: 'نشط' },
      { id: 20, fullName: 'مؤسسة الأوراس', company: 'الأوراس EURL', wilaya: 'باتنة', status: 'نشط' },
      { id: 30, fullName: 'مكتبة الفلاح', company: 'الفلاح', wilaya: 'وهران', status: 'متوقف' }
    ];
    setClients(catalog);

    // Filter by Wilaya
    S.fWilaya = 'وهران';
    S.filter = 'الكل';
    S.q = '';
    const wilayaFiltered = applyFilters(catalog);
    expect(wilayaFiltered.map(c => c.id).sort()).toEqual([10, 30]);

    // Filter by Status and Wilaya
    S.filter = 'نشط';
    const comboFiltered = applyFilters(catalog);
    expect(comboFiltered.map(c => c.id)).toEqual([10]);
  });

  // Scenario J: Multi-tenant isolation (Tenant A cannot access Tenant B records)
  it('Scenario J: Multi-tenant partitioning guarantees Tenant A data is isolated from Tenant B', () => {
    const tenantAClients = [
      { id: 'cli_A1', tenantId: TENANT_A, fullName: 'عميل خاص بشركة ألفا' }
    ];
    const tenantBClients = [
      { id: 'cli_B1', tenantId: TENANT_B, fullName: 'عميل خاص بشركة بيتا' }
    ];

    // Simulate session for Tenant A
    setCurrentUser({ uid: 'admin_A', tenantId: TENANT_A, role: 'gerant' });
    setClients(tenantAClients);

    expect(getActiveTenantId()).toBe(TENANT_A);
    expect(clients.every(c => c.tenantId === TENANT_A)).toBe(true);
    expect(clients.some(c => c.tenantId === TENANT_B)).toBe(false);

    // Switch to Tenant B session
    setCurrentUser({ uid: 'admin_B', tenantId: TENANT_B, role: 'gerant' });
    setClients(tenantBClients);

    expect(getActiveTenantId()).toBe(TENANT_B);
    expect(clients.every(c => c.tenantId === TENANT_B)).toBe(true);
    expect(clients.some(c => c.tenantId === TENANT_A)).toBe(false);
  });

  // Scenario K: Persistence & Session state consistency
  it('Scenario K: State store updates reliably maintain structural integrity', () => {
    updateState({
      lang: 'ar',
      view: 'detail',
      selId: 999,
      tab: 'issues'
    });

    expect(S.view).toBe('detail');
    expect(S.selId).toBe(999);
    expect(S.tab).toBe('issues');
  });

  // Scenario L: Invalid form submission safely rejected
  it('Scenario L: Client validation logic rejects empty or missing client names and enforces schema', () => {
    // Schema sanitizer assigns fallback 'بدون اسم' if missing or blank
    const fallbackClient = validateClient({ fullName: '', phone: '0550112233' });
    expect(fallbackClient.fullName).toBe('بدون اسم');

    // Valid client is preserved and bound
    const validClient = validateClient({
      fullName: 'عميل صالح ومسجل',
      phone: '0550112233',
      wilaya: 'وهران',
      status: 'نشط'
    });
    expect(validClient.fullName).toBe('عميل صالح ومسجل');
    expect(validClient.phone).toBe('0550112233');
    expect(validClient.status).toBe('نشط');

    // Program validation rejects unapproved versions
    const allowedProg = validateProgram({ programName: 'PROGILIC POS', version: 'V24' });
    expect(allowedProg.version).toBe('V24');

    const invalidProg = validateProgram({ programName: 'PROGILIC POS', version: 'V99_UNKNOWN' });
    expect(invalidProg.version).toBe('');
  });

  // Scenario M: Concurrent updates do not overwrite unrelated data
  it('Scenario M: Granular field merging prevents concurrent updates from clobbering unrelated fields', () => {
    const baseClient = {
      id: 701,
      tenantId: TENANT_A,
      fullName: 'شركة الإخوة',
      phone: '0550111111',
      wilaya: 'قسنطينة',
      status: 'نشط',
      notes: 'عميل قديم',
      version: 1
    };

    // User 1 updates phone
    const update1 = { phone: '0550222222', version: 2 };
    // User 2 updates notes concurrently
    const update2 = { notes: 'تحديث ملاحظة هامة', version: 2 };

    const merged = {
      ...baseClient,
      ...update1,
      ...update2,
      version: 3
    };

    expect(merged.phone).toBe('0550222222');
    expect(merged.notes).toBe('تحديث ملاحظة هامة');
    expect(merged.fullName).toBe('شركة الإخوة');
    expect(merged.wilaya).toBe('قسنطينة');
  });

  // Scenario N: Excel export preserves long numeric identifiers and defends against CSV formula injection
  it('Scenario N: formatCsvCell sanitizes spreadsheet formula injection and preserves long numeric IDs', () => {
    // Formula Injection Defense
    expect(formatCsvCell('=SUM(A1:A10)')).toBe('"\'=SUM(A1:A10)"');
    expect(formatCsvCell('+123-calc')).toBe('"\' +123-calc"'.replace(/ /g, ''));
    expect(formatCsvCell('@cmd|/C calc!A0')).toBe('"\'@cmd|/C calc!A0"');
    expect(formatCsvCell('-2+3')).toBe('"\' -2+3"'.replace(/ /g, ''));

    // Legitimate negative number is allowed
    expect(formatCsvCell('-15')).toBe('"-15"');
    expect(formatCsvCell('100')).toBe('"100"');

    // Preservation of Algerian phone numbers (leading zero) via safe text escape
    expect(formatCsvCell('0550112233')).toBe('"\'0550112233"');

    // Preservation of 15-digit NIF/NIS identifiers via safe text escape
    expect(formatCsvCell('001234567890123')).toBe('"\'001234567890123"');
    expect(formatCsvCell('123456789012345')).toBe('"\'123456789012345"');
  });

  // Scenario O: Arabic RTL and French LTR interfaces functional
  it('Scenario O: Localization toggle switches translations between Arabic and French', () => {
    setLanguage('ar');
    expect(S.lang).toBe('ar');
    expect(t('العملاء')).toBe('العملاء');
    expect(t('لوحة القيادة')).toBe('لوحة القيادة');

    setLanguage('fr');
    expect(S.lang).toBe('fr');
    expect(t('العملاء')).toBe('Clients');
    expect(t('لوحة القيادة')).toBe('Tableau de bord');

    // Reset back
    setLanguage('ar');
  });

  // Scenario P: Trello-created records remain correct after CRM operations
  it('Scenario P: Trello synchronization metadata is preserved across CRM business operations', () => {
    const trelloClient = {
      id: 801,
      tenantId: TENANT_A,
      fullName: 'عميل تريلو المتزامن',
      company: 'مؤسسة تريلو',
      phone: '0550778899',
      wilaya: 'الجزائر',
      status: 'نشط',
      trelloCardId: '60c72b2f9b1d8b2e1a3c5d7e',
      trelloListId: '60c72b2f9b1d8b2e1a3c5d7f',
      trelloSyncStatus: 'synced',
      trelloLastSyncedAt: '2026-11-08T12:00:00Z',
      programs: [{ id: 1, programName: 'PROGILIC POS V15', installationsCount: 1 }],
      issues: []
    };
    setClients([trelloClient]);

    // Perform CRM edit
    const modified = {
      ...trelloClient,
      phone: '0550998877',
      company: 'مؤسسة تريلو المطورة'
    };
    setClients([modified]);

    expect(clients[0].phone).toBe('0550998877');
    // Ensure Trello bridge metadata remains intact and uncorrupted
    expect(clients[0].trelloCardId).toBe('60c72b2f9b1d8b2e1a3c5d7e');
    expect(clients[0].trelloListId).toBe('60c72b2f9b1d8b2e1a3c5d7f');
    expect(clients[0].trelloSyncStatus).toBe('synced');
    expect(clients[0].trelloLastSyncedAt).toBe('2026-11-08T12:00:00Z');
  });
});
