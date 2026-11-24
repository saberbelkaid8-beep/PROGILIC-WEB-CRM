import { describe, it, expect, vi } from 'vitest';
import {
  buildProgramGroupKey,
  getClientVersionSyncTargets,
  syncClientSoftwareVersion,
  computeFleetVersionDistribution
} from '../../src/business/versionSyncService.js';
import {
  normalizeFeatureText,
  buildBacklogDocId,
  buildCentralBacklog,
  buildClusterLookupMap
} from '../../src/business/backlogService.js';
import {
  buildTaskFromContact,
  classifyTaskBucket,
  filterTasks,
  computeOperationsMetrics
} from '../../src/business/taskService.js';
import {
  getIssueSlaStatus,
  getClientCsatStats,
  computeCustomerAxes
} from '../../src/business/intelligence.js';
import { setClients } from '../../src/state/store.js';

describe('Req #1: Automatic Software Version Synchronization (versionSyncService)', () => {
  const samplePrograms = [
    {
      id: 101,
      programName: 'Desktop - تجاري V21',
      platform: 'Desktop',
      type: 'تجاري (Commercial)',
      version: 'V21',
      installationsCount: 2,
      startDate: '2025-01-10',
      endDate: ''
    },
    {
      id: 102,
      programName: 'Desktop - تجاري V21 (فرع)',
      platform: 'Desktop',
      type: 'تجاري (Commercial)',
      version: 'V21',
      installationsCount: 2,
      startDate: '2025-02-01',
      endDate: ''
    },
    {
      id: 103,
      programName: 'Desktop - إنتاجي V21',
      platform: 'Desktop',
      type: 'إنتاجي (Production)',
      version: 'V21',
      installationsCount: 3,
      startDate: '2025-03-01',
      endDate: ''
    },
    {
      id: 104,
      programName: 'Mobile - تطبيق التاجر',
      platform: 'Mobile',
      type: 'تطبيق التاجر (Commerçant)',
      version: '',
      installationsCount: 2,
      startDate: '2025-03-05',
      endDate: ''
    }
  ];

  it('groups records by platform and category while excluding Mobile from version sync targets', () => {
    const targets = getClientVersionSyncTargets({ programs: samplePrograms });
    expect(targets.length).toBe(2);
    const commTarget = targets.find(t => t.groupKey === 'Desktop|Commercial');
    expect(commTarget).toBeDefined();
    expect(commTarget.recordsCount).toBe(2);
    expect(commTarget.totalDevices).toBe(4);
    expect(commTarget.versions).toEqual(['V21']);
  });

  it('syncs the exact employee-chosen target version (V22) across all matching program records without touching other programs or auto-upgrading to latest', () => {
    const result = syncClientSoftwareVersion({
      programs: samplePrograms,
      groupKey: 'Desktop|Commercial',
      targetVersion: 'V22',
      updatedDate: '2026-04-01',
      updatedBy: 'أحمد تقني',
      note: 'ترقية مجدولة لنسخة V22'
    });

    expect(result.updatedCount).toBe(2);
    expect(result.devicesSynced).toBe(4);
    expect(result.targetVersion).toBe('V22');
    expect(result.prevVersions).toEqual(['V21']);

    const updatedComm = result.nextPrograms.filter(p => buildProgramGroupKey(p) === 'Desktop|Commercial');
    expect(updatedComm.every(p => p.version === 'V22')).toBe(true);
    expect(updatedComm.reduce((s, p) => s + p.installationsCount, 0)).toBe(4);
    expect(updatedComm[0].versionHistory[0]).toMatchObject({
      from: 'V21',
      to: 'V22',
      by: 'أحمد تقني',
      date: '2026-04-01'
    });

    // Other programs must remain untouched
    const prodProg = result.nextPrograms.find(p => p.id === 103);
    expect(prodProg.version).toBe('V21');
    const mobProg = result.nextPrograms.find(p => p.id === 104);
    expect(mobProg.version).toBe('');
  });

  it('computes fleet version distribution by device count', () => {
    const dist = computeFleetVersionDistribution([
      { id: 1, programs: [{ id: 1, platform: 'Desktop', type: 'تجاري (Commercial)', version: 'V22', installationsCount: 4 }] },
      { id: 2, programs: [{ id: 2, platform: 'Desktop', type: 'تجاري (Commercial)', version: 'V21', installationsCount: 2 }] }
    ]);
    expect(dist[0]).toMatchObject({ version: 'V22', devices: 4, clientsCount: 1 });
    expect(dist[1]).toMatchObject({ version: 'V21', devices: 2, clientsCount: 1 });
  });
});

describe('Req #3: Central Product Backlog Clustering (backlogService)', () => {
  it('normalizes Arabic feature variations and groups requests from multiple clients into a single unified backlog item', () => {
    const clients = [
      {
        id: 1,
        fullName: 'شركة النور',
        wilaya: 'الجزائر',
        requirements: [
          { id: 11, title: 'إضافة ميزة تصدير فواتير Excel', priority: 'عالية', impact: 'عالي', status: 'مقترح', date: '2026-03-01', assignedToId: 'emp1', assignedToName: 'سارة' }
        ]
      },
      {
        id: 2,
        fullName: 'مؤسسة البدر',
        wilaya: 'وهران',
        requirements: [
          { id: 21, title: 'تصدير فواتير Excel', priority: 'متوسطة', impact: 'متوسط', status: 'قيد الدراسة', date: '2026-03-05' }
        ]
      },
      {
        id: 3,
        fullName: 'متجر السلام',
        wilaya: 'قسنطينة',
        requirements: [
          { id: 31, title: 'ميزة تصدير فواتير Excel', priority: 'عاجل', impact: 'عالي', status: 'مقترح', date: '2026-03-10' }
        ]
      },
      {
        id: 4,
        fullName: 'شركة الأمل',
        wilaya: 'سطيف',
        requirements: [
          { id: 41, title: 'تقرير الضرائب السنوي', priority: 'متوسطة', impact: 'منخفض', status: 'مقترح', date: '2026-03-02' }
        ]
      }
    ];

    expect(normalizeFeatureText('إضافة ميزة تصدير فواتير Excel')).toBe(normalizeFeatureText('تصدير فواتير Excel'));
    const bl = buildCentralBacklog(clients, {});
    expect(bl.length).toBe(2);
    expect(bl[0].interestedClientsCount).toBe(3);
    expect(bl[0].requestsCount).toBe(3);
    expect(bl[0].priority).toBe('عاجل');
    expect(bl[0].interestedClients.map(ic => ic.clientName)).toEqual(['شركة النور', 'مؤسسة البدر', 'متجر السلام']);
  });

  it('respects explicit backlogKey linking and custom canonical metadata', () => {
    const key = buildBacklogDocId('custom_sync_feature');
    const clients = [
      { id: 1, fullName: 'عميل 1', requirements: [{ id: 1, title: 'ربط الباركود الذكي', backlogKey: key, status: 'مقترح' }] },
      { id: 2, fullName: 'عميل 2', requirements: [{ id: 2, title: 'قراءة كود QR تلقائياً', backlogKey: key, status: 'مقترح' }] }
    ];
    const meta = {
      [key]: { id: key, canonicalTitle: 'نظام المسح الموحد للباركود و QR', devStatus: 'مخطط', targetVersion: 'V27', priority: 'عالية' }
    };
    const { items, map } = buildClusterLookupMap(clients, meta);
    expect(items.length).toBe(1);
    expect(map.get(key).title).toBe('نظام المسح الموحد للباركود و QR');
    expect(map.get(key).interestedClientsCount).toBe(2);
    expect(map.get(key).devStatus).toBe('مخطط');
  });
});

describe('Req #4, #5 & #7: Task & Follow-up Management and Operations Metrics (taskService)', () => {
  const today = '2026-04-10';

  it('auto-builds a follow-up task from structured contact history with waiting status when outcome warrants it', () => {
    const task = buildTaskFromContact({
      client: { id: 500, fullName: 'مؤسسة الوفاق', company: 'الوفاق للتجارة' },
      contact: {
        id: 700,
        contactType: 'هاتف',
        staffId: 'emp_comm',
        staffName: 'ياسين',
        contactPerson: 'مدير المشتريات',
        outcome: 'يحتاج إلى عرض',
        subject: 'عرض سعر 5 محطات إضافية',
        nextAction: 'إرسال عرض السعر عبر البريد',
        followUpDate: today,
        note: 'العميل مهتم بالتوسعة'
      },
      staffMember: { id: 'emp_comm', fullName: 'ياسين', department: 'commercial' },
      todayStr: today
    });

    expect(task.clientId).toBe(500);
    expect(task.contactId).toBe(700);
    expect(task.department).toBe('commercial');
    expect(task.status).toBe('بانتظار رد العميل');
    expect(task.priority).toBe('عالية');
    expect(task.dueDate).toBe(today);
    expect(task.title).toBe('إرسال عرض السعر عبر البريد');
  });

  it('classifies dueToday, overdue, waiting, and completed tasks accurately and computes employee & department metrics', () => {
    const tasks = [
      { id: 't1', title: 'اتصال عاجل', clientId: 1, clientName: 'ع1', assignedToId: 'e1', assignedToName: 'ياسين', department: 'commercial', status: 'مفتوحة', dueDate: today },
      { id: 't2', title: 'تأكيد عرض', clientId: 2, clientName: 'ع2', assignedToId: 'e1', assignedToName: 'ياسين', department: 'commercial', status: 'قيد التنفيذ', dueDate: '2026-04-08' },
      { id: 't3', title: 'انتظار موافقة', clientId: 3, clientName: 'ع3', assignedToId: 'e2', assignedToName: 'سارة', department: 'suivi', status: 'بانتظار رد العميل', dueDate: '2026-04-12' },
      { id: 't4', title: 'إغلاق تدريب', clientId: 4, clientName: 'ع4', assignedToId: 'e2', assignedToName: 'سارة', department: 'suivi', status: 'مكتملة', dueDate: '2026-04-05', outcomeNote: 'تم تفعيل النسخة بنجاح' }
    ];

    expect(classifyTaskBucket(tasks[0], today)).toBe('today');
    expect(classifyTaskBucket(tasks[1], today)).toBe('overdue');
    expect(classifyTaskBucket(tasks[2], today)).toBe('waiting');
    expect(classifyTaskBucket(tasks[3], today)).toBe('completed');

    expect(filterTasks(tasks, { bucket: 'overdue' }, today).map(t => t.id)).toEqual(['t2']);
    expect(filterTasks(tasks, { bucket: 'today' }, today).map(t => t.id)).toEqual(['t1']);
    expect(filterTasks(tasks, { bucket: 'waiting' }, today).map(t => t.id)).toEqual(['t3']);

    const ops = computeOperationsMetrics({
      tasks,
      clients: [
        { id: 1, issues: [{ id: 1, status: 'مفتوح', assignedToId: 'e2', assignedToName: 'سارة' }], requirements: [{ id: 9, assignedToId: 'e1', assignedToName: 'ياسين' }] }
      ],
      staffUsers: [
        { id: 'e1', fullName: 'ياسين', department: 'commercial', position: 'تجاري' },
        { id: 'e2', fullName: 'سارة', department: 'suivi', position: 'متابعة' }
      ],
      todayStr: today
    });

    expect(ops.summary).toMatchObject({ total: 4, dueToday: 1, overdue: 1, waitingOnClient: 1, completed: 1 });
    const commDept = ops.byDepartment.find(d => d.id === 'commercial');
    expect(commDept.overdue).toBe(1);
    expect(commDept.dueToday).toBe(1);

    const suiviDept = ops.byDepartment.find(d => d.id === 'suivi');
    expect(suiviDept.completed).toBe(1);
    expect(suiviDept.completionRate).toBe(50);
    expect(suiviDept.outcomes[0].outcomeNote).toBe('تم تفعيل النسخة بنجاح');

    const yassine = ops.byEmployee.find(e => e.id === 'e1');
    expect(yassine.ownedReqs).toBe(1);
    const sara = ops.byEmployee.find(e => e.id === 'e2');
    expect(sara.ownedOpenIssues).toBe(1);
  });
});

describe('Req #6: Multi-Axis Customer Health & Success (intelligence)', () => {
  it('computes all 8 indicators and keeps high Customer Value strictly separated from poor Health and high Risk', () => {
    const fixedNow = new Date('2026-04-10T12:00:00Z').getTime();
    vi.spyOn(Date, 'now').mockReturnValue(fixedNow);

    const enterpriseTroubledClient = {
      id: 901,
      fullName: 'مجمع النخبة التجاري',
      status: 'نشط',
      lastContact: '2025-12-01',
      lastProgramUsage: '2026-01-15',
      supportContractStatus: 'منتهي',
      supportRenewalDate: '2026-03-01',
      openDealsCount: 2,
      openDealsNote: 'توسعة 15 جهاز جديد',
      _subcollectionsLoaded: true,
      programs: [
        { id: 1, platform: 'Desktop', type: 'تجاري (Commercial)', version: 'V22', installationsCount: 50 }
      ],
      issues: [
        { id: 11, title: 'توقف الفوترة', status: 'مفتوح', priority: 'عاجل', repeatCount: 4, date: '2026-04-01', slaHours: 12 },
        { id: 12, title: 'بطء التقارير', status: 'محلول', priority: 'عالية', repeatCount: 3, date: '2026-03-10', resolvedDate: '2026-03-15', slaHours: 24, csatScore: 2 },
        { id: 13, title: 'مشكلة طابعة', status: 'مغلق', priority: 'متوسطة', repeatCount: 1, date: '2026-03-20', resolvedDate: '2026-03-21', csatScore: 2 }
      ],
      requirements: []
    };

    setClients([enterpriseTroubledClient]);
    const axes = computeCustomerAxes(enterpriseTroubledClient, [
      { id: 'tsk_late', clientId: 901, status: 'مفتوحة', dueDate: '2026-04-01' }
    ]);

    expect(axes.indicators.length).toBe(8);
    expect(axes.valueLevel).toBe('high');
    expect(axes.valueScore).toBeGreaterThanOrEqual(80);
    expect(axes.healthLevel).toBe('poor');
    expect(axes.healthScore).toBeLessThan(35);
    expect(axes.riskLevel).toBe('high');
    expect(axes.riskScore).toBeGreaterThanOrEqual(60);

    const csat = getClientCsatStats(enterpriseTroubledClient);
    expect(csat.avg).toBe(2);
    expect(csat.count).toBe(2);

    const sla = getIssueSlaStatus(enterpriseTroubledClient.issues[0], fixedNow);
    expect(sla.isBreached).toBe(true);

    vi.restoreAllMocks();
    setClients([]);
  });
});
