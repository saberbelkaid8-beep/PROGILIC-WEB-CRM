import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeProgramCategory,
  mergeOrAddClientProgram,
  adjustClientProgramDevices,
  getClientCategoryBreakdown,
  computeFleetDeviceMetrics,
  filterRecentDashboardActivities,
  computeExecutiveSummary
} from '../../src/business/programMetrics.js';

test('normalizeProgramCategory classifies Desktop, Mobile sub-apps, and Web accurately', () => {
  assert.deepEqual(
    {
      platform: normalizeProgramCategory({ platform: 'Desktop', type: 'تجاري (Commercial)', version: 'V27' }).platform,
      categoryKey: normalizeProgramCategory({ platform: 'Desktop', type: 'تجاري (Commercial)', version: 'V27' }).categoryKey
    },
    { platform: 'Desktop', categoryKey: 'Commercial' }
  );

  assert.equal(normalizeProgramCategory('Desktop - إنتاجي V26').categoryKey, 'Production');
  assert.equal(normalizeProgramCategory({ platform: 'Desktop', type: 'توزيع (Distribution)', version: 'V27' }).categoryKey, 'Distribution');

  const mobVdd = normalizeProgramCategory({ platform: 'Mobile', type: 'تطبيق VDD (Vendeur Distributeur)' });
  assert.equal(mobVdd.platform, 'Mobile');
  assert.equal(mobVdd.categoryKey, 'Mobile');
  assert.equal(mobVdd.subAppKey, 'vdd');

  const web = normalizeProgramCategory({ platform: 'Web', type: 'الويب', version: 'V27' });
  assert.equal(web.platform, 'Web');
  assert.equal(web.categoryKey, 'Web');
});

test('mergeOrAddClientProgram merges identical license (1 program, 2 devices + 1 => 1 program, 3 devices)', () => {
  const initial = [
    {
      id: 1001,
      programName: 'Desktop - تجاري V27',
      platform: 'Desktop',
      type: 'تجاري (Commercial)',
      version: 'V27',
      installationsCount: 2,
      startDate: '2026-10-01'
    }
  ];

  // Adding 1 more computer with Commercial V27
  const mergedRes = mergeOrAddClientProgram(initial, {
    id: 2002,
    programName: 'Desktop - تجاري V27',
    platform: 'Desktop',
    type: 'تجاري',
    version: 'V27',
    installationsCount: 1,
    startDate: '2026-11-20'
  });

  assert.equal(mergedRes.action, 'merged');
  assert.equal(mergedRes.addedProgramsCount, 0);
  assert.equal(mergedRes.addedDevices, 1);
  assert.equal(mergedRes.nextPrograms.length, 1);
  assert.equal(mergedRes.nextPrograms[0].installationsCount, 3);
  assert.equal(mergedRes.nextPrograms[0].id, 1001);

  // Adding a genuinely different category (Production V27) creates a second program row
  const addedRes = mergeOrAddClientProgram(mergedRes.nextPrograms, {
    id: 3003,
    programName: 'Desktop - إنتاجي V27',
    platform: 'Desktop',
    type: 'إنتاجي (Production)',
    version: 'V27',
    installationsCount: 2,
    startDate: '2026-11-21'
  });

  assert.equal(addedRes.action, 'added');
  assert.equal(addedRes.addedProgramsCount, 1);
  assert.equal(addedRes.addedDevices, 2);
  assert.equal(addedRes.nextPrograms.length, 2);
});

test('adjustClientProgramDevices increments and clamps at minimum 1 device', () => {
  const progs = [{ id: 10, programName: 'Desktop - توزيع V27', platform: 'Desktop', type: 'توزيع', version: 'V27', installationsCount: 2 }];
  const plus = adjustClientProgramDevices(progs, 10, 1);
  assert.equal(plus.targetProgram.installationsCount, 3);
  assert.equal(plus.diffDevices, 1);

  const minus1 = adjustClientProgramDevices(plus.nextPrograms, 10, -1);
  assert.equal(minus1.targetProgram.installationsCount, 2);

  const clamped = adjustClientProgramDevices([{ id: 10, installationsCount: 1 }], 10, -1);
  assert.equal(clamped.targetProgram.installationsCount, 1);
  assert.equal(clamped.diffDevices, 0);
});

test('getClientCategoryBreakdown and computeFleetDeviceMetrics count devices per category and platform cleanly', () => {
  const now = new Date('2026-11-22T12:00:00Z');
  const testClients = [
    {
      id: 1,
      status: 'نشط',
      startDate: '2026-11-01',
      lastContact: '2026-11-18',
      _subcollectionsLoaded: true,
      programs: [
        { id: 11, programName: 'Desktop - تجاري V27', platform: 'Desktop', type: 'تجاري (Commercial)', version: 'V27', installationsCount: 4, startDate: '2026-11-01' },
        { id: 12, programName: 'Mobile - تطبيق التاجر', platform: 'Mobile', type: 'تطبيق التاجر (Commerçant)', version: '', installationsCount: 2, startDate: '2026-11-05' },
        { id: 13, programName: 'Web - الويب V27', platform: 'Web', type: 'الويب', version: 'V27', installationsCount: 1, startDate: '2026-11-10' }
      ],
      contactHistory: [{ id: 101, date: '2026-11-18', note: 'متابعة' }]
    },
    {
      id: 2,
      status: 'نشط',
      startDate: '2026-09-01',
      lastContact: '2026-09-10',
      _subcollectionsLoaded: false,
      programs: [],
      programsCount: 1,
      programNames: ['Desktop - توزيع V26'],
      installationsCount: 2,
      contactHistory: []
    }
  ];

  const c1Breakdown = getClientCategoryBreakdown(testClients[0]);
  assert.equal(c1Breakdown.totalPrograms, 3);
  assert.equal(c1Breakdown.totalDevices, 7);
  assert.equal(c1Breakdown.groupedSummary.length, 3);

  const fleet = computeFleetDeviceMetrics(testClients, now);
  assert.equal(fleet.totalPrograms, 4);
  assert.equal(fleet.totalLicensedDevices, 9);
  assert.deepEqual(fleet.platformDevices, { Desktop: 6, Mobile: 2, Web: 1 });
  assert.deepEqual(fleet.platformPrograms, { Desktop: 2, Mobile: 1, Web: 1 });
  assert.equal(fleet.categoryDevices.Commercial, 4);
  assert.equal(fleet.categoryDevices.Distribution, 2);
  assert.equal(fleet.categoryDevices.Mobile, 2);
  assert.equal(fleet.categoryDevices.Web, 1);
  assert.equal(fleet.mobileSubApps.commercant, 2);
  assert.equal(fleet.contacted30Clients, 1);
  assert.equal(fleet.contactCoveragePct, 50);
  assert.equal(fleet.totalCalls, 1);
});

test('filterRecentDashboardActivities filters admin/backup noise, deleted clients, and duplicates', () => {
  const clientsList = [{ id: 1, fullName: 'مؤسسة النور' }];
  const acts = [
    { id: 'b1', type: 'BACKUP_CREATED', title: 'نسخة احتياطية', timestamp: '2026-11-22T11:00:00Z' },
    { id: 'd1', type: 'PROGRAM_DELETED', clientId: 1, title: 'حذف برنامج', timestamp: '2026-11-22T10:50:00Z' },
    { id: 'orphan', type: 'CONTACT_ADDED', clientId: 999, title: 'عميل محذوف', timestamp: '2026-11-22T10:40:00Z' },
    { id: 'live_p1', type: 'PROGRAM_ADDED', clientId: 1, meta: { programId: 10 }, userName: 'أحمد', title: 'إضافة ترخيص', timestamp: '2026-11-22T10:30:00Z' },
    { id: 'act_prog_1_10', type: 'PROGRAM_ADDED', clientId: 1, meta: { programId: 10 }, userName: 'المسؤول العام', title: 'مزامنة مكررة', source: 'crm-sync', timestamp: '2026-11-22T09:00:00Z' }
  ];

  const clean = filterRecentDashboardActivities(acts, clientsList);
  assert.equal(clean.length, 1);
  assert.equal(clean[0].id, 'live_p1');
  assert.equal(clean[0].badgeTag, 'ترخيص');
});

test('computeExecutiveSummary computes lifecycle ratios, ticket resolution rate, top sectors, and unified radar queue', () => {
  const sampleClients = [
    {
      id: 1, fullName: 'شركة الأمل', status: 'نشط', wilaya: 'الجزائر', businessType: 'تجارة جملة',
      _subcollectionsLoaded: true,
      programs: [{ id: 11, installationsCount: 4 }],
      issues: [
        { id: 101, title: 'عطل شبكة', priority: 'عاجل', status: 'مفتوح', featureOpp: true },
        { id: 102, title: 'تحديث قديم', priority: 'منخفضة', status: 'محلول' }
      ],
      requirements: [{ id: 201, title: 'تقارير', impact: 'عالي', status: 'قيد الدراسة' }]
    },
    {
      id: 2, fullName: 'مؤسسة الشرق', status: 'محتمل', wilaya: 'وهران', businessType: 'تجارة جملة',
      _subcollectionsLoaded: true,
      programs: [{ id: 12, installationsCount: 2 }],
      issues: [{ id: 103, title: 'تم حله', priority: 'متوسطة', status: 'محلول' }],
      requirements: []
    },
    {
      id: 3, fullName: 'متجر الجنوب', status: 'متوقف', wilaya: 'بسكرة', businessType: 'صحة وصيدلة',
      _subcollectionsLoaded: true,
      programs: [],
      issues: [],
      requirements: []
    }
  ];
  const fleet = computeFleetDeviceMetrics(sampleClients, new Date('2026-11-22T12:00:00Z'));
  const summary = computeExecutiveSummary({
    clientsList: sampleClients,
    fleet,
    alerts: [{ cid: 1, level: 'urgent', type: 'URGENT_ISSUE', msg: 'مشكلة عاجلة: عطل شبكة', sub: 'شركة الأمل' }],
    riskItems: [{ client: sampleClients[2], score: 15, level: 'high', reasons: 'العميل في حالة توقف' }],
    crossIssues: [{ type: 'أداء', count: 2, clientNames: ['شركة الأمل', 'مؤسسة الشرق'] }],
    allIssues: sampleClients.flatMap(c => c.issues),
    allReqs: sampleClients.flatMap(c => c.requirements),
    totalOpenIssuesCount: 1
  });

  assert.equal(summary.lifecycle.total, 3);
  assert.equal(summary.lifecycle.active, 1);
  assert.equal(summary.lifecycle.prospective, 1);
  assert.equal(summary.lifecycle.stopped, 1);
  assert.equal(summary.supportHealth.solvedCount, 2);
  assert.equal(summary.supportHealth.resolutionRatePct, 67);
  assert.equal(summary.supportHealth.featureOppsCount, 1);
  assert.equal(summary.supportHealth.crossIssuesCount, 1);
  assert.equal(summary.fleetDevicesPerClient, 2);
  assert.equal(summary.topSectors[0].name, 'تجارة جملة');
  assert.equal(summary.topSectors[0].count, 2);
  assert.equal(summary.topSectors[0].devices, 6);
  assert.equal(summary.radar.all.length, 2);
  assert.equal(summary.radar.alertsOnly.length, 1);
  assert.equal(summary.radar.riskOnly.length, 1);
});
