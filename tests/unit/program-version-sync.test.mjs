import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getBaseProgramKey,
  getBaseProgramLabel,
  getClientVersionSyncGroups,
  syncClientProgramVersion,
  computeProgramVersionMetrics
} from '../../src/business/programVersionSync.js';
import { reconcileClientPrograms } from '../../src/business/programRecovery.js';
import { filterRecentDashboardActivities } from '../../src/business/programMetrics.js';
import { validateClient, validateProgram } from '../../src/firebase/validation.js';
import { PROGRAM_VERSIONS } from '../../src/constants/index.js';

test('getBaseProgramKey groups programs by base product regardless of version', () => {
  const k1 = getBaseProgramKey({ platform: 'Desktop', type: 'تجاري (Commercial)', version: 'V21', programName: 'Desktop - تجاري V21' });
  const k2 = getBaseProgramKey({ platform: 'Desktop', type: 'تجاري', version: 'V22', programName: 'Desktop - Commercial V22' });
  const k3 = getBaseProgramKey({ platform: 'Desktop', type: 'إنتاجي (Production)', version: 'V21', programName: 'Desktop - إنتاجي V21' });

  assert.equal(k1, 'Desktop|Commercial');
  assert.equal(k2, 'Desktop|Commercial');
  assert.notEqual(k1, k3);
  assert.equal(k3, 'Desktop|Production');
});

test('syncClientProgramVersion synchronizes all 4 separate V21 device records to V22 while preserving other programs', () => {
  const programs = [
    { id: 101, platform: 'Desktop', type: 'تجاري (Commercial)', version: 'V21', programName: 'Desktop - تجاري V21', installationsCount: 1, startDate: '2025-01-10' },
    { id: 102, platform: 'Desktop', type: 'تجاري (Commercial)', version: 'V21', programName: 'Desktop - تجاري V21', installationsCount: 1, startDate: '2025-02-10' },
    { id: 103, platform: 'Desktop', type: 'تجاري (Commercial)', version: 'V21', programName: 'Desktop - تجاري V21', installationsCount: 1, startDate: '2025-03-10' },
    { id: 104, platform: 'Desktop', type: 'تجاري (Commercial)', version: 'V21', programName: 'Desktop - تجاري V21', installationsCount: 1, startDate: '2025-04-10' },
    { id: 201, platform: 'Desktop', type: 'إنتاجي (Production)', version: 'V21', programName: 'Desktop - إنتاجي V21', installationsCount: 2, startDate: '2025-01-15' },
    { id: 301, platform: 'Mobile', type: 'تطبيق VDD (Vendeur Distributeur)', version: '', programName: 'Mobile - تطبيق VDD', installationsCount: 3, startDate: '2025-05-01' }
  ];

  const baseKey = getBaseProgramKey(programs[0]);
  const res = syncClientProgramVersion({
    programs,
    baseKey,
    targetVersion: 'V22',
    date: '2026-11-22',
    notes: 'تحديث الخادم و4 محطات عمل',
    actorName: 'أحمد'
  });

  assert.equal(res.ok, true);
  assert.equal(res.toVersion, 'V22');
  assert.equal(res.affectedRecordsCount, 4);
  assert.equal(res.affectedDevicesCount, 4);
  assert.deepEqual(res.fromVersions, ['V21']);
  assert.equal(res.totalDevices, 9);

  // All 4 Commercial records synced to V22 (never auto-promoted to V27)
  const commercialRecs = res.nextPrograms.filter(p => p.id >= 101 && p.id <= 104);
  assert.equal(commercialRecs.length, 4);
  commercialRecs.forEach(r => {
    assert.equal(r.version, 'V22');
    assert.equal(r.programName, 'Desktop - تجاري V22');
    assert.equal(r.previousVersion, 'V21');
    assert.equal(r.lastVersionUpdate, '2026-11-22');
  });

  // Unrelated programs on same client remain untouched
  const prod = res.nextPrograms.find(p => p.id === 201);
  assert.equal(prod.version, 'V21');
  assert.equal(prod.programName, 'Desktop - إنتاجي V21');
  assert.equal(prod.lastVersionUpdate, undefined);

  const mob = res.nextPrograms.find(p => p.id === 301);
  assert.equal(mob.version, '');
  assert.equal(mob.programName, 'Mobile - تطبيق VDD');
});

test('syncClientProgramVersion updates 1 grouped record (installationsCount: 4) and converges mixed versions cleanly', () => {
  const grouped = [
    { id: 1, platform: 'Desktop', type: 'تجاري (Commercial)', version: 'V21', programName: 'Desktop - تجاري V21', installationsCount: 4, startDate: '2025-01-01' }
  ];
  const gRes = syncClientProgramVersion({ programs: grouped, baseKey: 'Desktop|Commercial', targetVersion: 'V22', date: '2026-11-22' });
  assert.equal(gRes.ok, true);
  assert.equal(gRes.affectedRecordsCount, 1);
  assert.equal(gRes.affectedDevicesCount, 4);
  assert.equal(gRes.nextPrograms[0].version, 'V22');
  assert.equal(gRes.nextPrograms[0].installationsCount, 4);

  const mixed = [
    { id: 11, platform: 'Desktop', type: 'توزيع (Distribution)', version: 'V21', programName: 'Desktop - توزيع V21', installationsCount: 2 },
    { id: 12, platform: 'Desktop', type: 'توزيع (Distribution)', version: 'V23', programName: 'Desktop - توزيع V23', installationsCount: 3 }
  ];
  const mRes = syncClientProgramVersion({ programs: mixed, baseKey: 'Desktop|Distribution', targetVersion: 'V22', date: '2026-11-22' });
  assert.equal(mRes.ok, true);
  assert.equal(mRes.affectedRecordsCount, 2);
  assert.equal(mRes.affectedDevicesCount, 5);
  assert.deepEqual(mRes.fromVersions.sort(), ['V21', 'V23']);
  assert.ok(mRes.nextPrograms.every(p => p.version === 'V22'));
});

test('syncClientProgramVersion rejects missing explicit version and NEVER auto-selects latest V27', () => {
  assert.ok(PROGRAM_VERSIONS.includes('V22'));
  assert.ok(PROGRAM_VERSIONS.includes('V25'));
  assert.equal(PROGRAM_VERSIONS[0], 'V27');

  const programs = [
    { id: 1, platform: 'Desktop', type: 'تجاري', version: 'V21', programName: 'Desktop - تجاري V21', installationsCount: 2 }
  ];
  const emptyRes = syncClientProgramVersion({ programs, baseKey: 'Desktop|Commercial', targetVersion: '' });
  assert.equal(emptyRes.ok, false);
  assert.equal(emptyRes.error, 'MISSING_TARGET_VERSION');

  const chosenRes = syncClientProgramVersion({ programs, baseKey: 'Desktop|Commercial', targetVersion: 'V22' });
  assert.equal(chosenRes.ok, true);
  assert.equal(chosenRes.toVersion, 'V22');
  assert.notEqual(chosenRes.toVersion, 'V27');
});

test('computeProgramVersionMetrics and getClientVersionSyncGroups reflect synced versions', () => {
  const clientA = {
    id: 1,
    fullName: 'شركة النور',
    programs: [
      { id: 101, platform: 'Desktop', type: 'تجاري (Commercial)', version: 'V21', programName: 'Desktop - تجاري V21', installationsCount: 1 },
      { id: 102, platform: 'Desktop', type: 'تجاري (Commercial)', version: 'V21', programName: 'Desktop - تجاري V21', installationsCount: 1 },
      { id: 103, platform: 'Desktop', type: 'تجاري (Commercial)', version: 'V21', programName: 'Desktop - تجاري V21', installationsCount: 1 },
      { id: 104, platform: 'Desktop', type: 'تجاري (Commercial)', version: 'V21', programName: 'Desktop - تجاري V21', installationsCount: 1 },
      { id: 201, platform: 'Desktop', type: 'إنتاجي (Production)', version: 'V21', programName: 'Desktop - إنتاجي V21', installationsCount: 1 },
      { id: 301, platform: 'Mobile', type: 'تطبيق التاجر', version: '', programName: 'Mobile - التاجر', installationsCount: 2 }
    ]
  };
  const clientB = {
    id: 2,
    fullName: 'مؤسسة الشرق',
    programs: [
      { id: 401, platform: 'Desktop', type: 'تجاري (Commercial)', version: 'V27', programName: 'Desktop - تجاري V27', installationsCount: 3 }
    ]
  };

  const groups = getClientVersionSyncGroups(clientA);
  assert.equal(groups.length, 2); // Mobile excluded
  assert.equal(groups[0].label, getBaseProgramLabel(clientA.programs[0]));
  assert.equal(groups[0].recordsCount, 4);
  assert.equal(groups[0].totalDevices, 4);

  const synced = syncClientProgramVersion({ programs: clientA.programs, baseKey: 'Desktop|Commercial', targetVersion: 'V22' });
  clientA.programs = synced.nextPrograms;

  const metrics = computeProgramVersionMetrics([clientA, clientB]);
  assert.equal(metrics.totalVersionedPrograms, 6);
  assert.equal(metrics.totalVersionedDevices, 8);
  assert.equal(metrics.map.V22.programsCount, 4);
  assert.equal(metrics.map.V22.devicesCount, 4);
  assert.equal(metrics.map.V21.programsCount, 1); // Only Production V21 remains
  assert.equal(metrics.map.V27.devicesCount, 3);
});

test('reconcileClientPrograms preserves 4 distinct device subcollection docs and applies PROGRAM_VERSION_UPDATED', () => {
  const client = { id: 50, startDate: '2025-01-01', endDate: '' };
  const subPrograms = [
    { id: 101, platform: 'Desktop', type: 'تجاري', version: 'V21', programName: 'Desktop - تجاري V21', installationsCount: 1 },
    { id: 102, platform: 'Desktop', type: 'تجاري', version: 'V21', programName: 'Desktop - تجاري V21', installationsCount: 1 },
    { id: 103, platform: 'Desktop', type: 'تجاري', version: 'V21', programName: 'Desktop - تجاري V21', installationsCount: 1 },
    { id: 104, platform: 'Desktop', type: 'تجاري', version: 'V21', programName: 'Desktop - تجاري V21', installationsCount: 1 }
  ];
  const activities = [
    {
      id: 'act_sync_1',
      clientId: 50,
      type: 'PROGRAM_VERSION_UPDATED',
      timestamp: '2026-11-22T10:00:00.000Z',
      meta: {
        baseKey: 'Desktop|Commercial',
        toVersion: 'V22',
        programIds: [101, 102, 103, 104]
      }
    }
  ];

  const reconciled = reconcileClientPrograms({ client, subPrograms, inlinePrograms: [], activities });
  assert.equal(reconciled.programs.length, 4);
  assert.ok(reconciled.programs.every(p => p.version === 'V22'));
  assert.ok(reconciled.programs.every(p => p.programName === 'Desktop - تجاري V22'));
});

test('filterRecentDashboardActivities formats PROGRAM_VERSION_UPDATED distinctly without collapsing sequential updates', () => {
  const clientsList = [{ id: 10, fullName: 'عميل تجريبي' }];
  const acts = [
    {
      id: 'a1',
      clientId: 10,
      type: 'PROGRAM_VERSION_UPDATED',
      title: 'مزامنة إصدار Commercial → V22',
      timestamp: '2026-11-22T10:00:00.000Z',
      userName: 'سعيد',
      meta: { updateId: 'vupd_1', toVersion: 'V22' }
    },
    {
      id: 'a2',
      clientId: 10,
      type: 'PROGRAM_VERSION_UPDATED',
      title: 'مزامنة إصدار Commercial → V23',
      timestamp: '2026-11-22T11:00:00.000Z',
      userName: 'سعيد',
      meta: { updateId: 'vupd_2', toVersion: 'V23' }
    }
  ];

  const recent = filterRecentDashboardActivities(acts, clientsList);
  assert.equal(recent.length, 2);
  assert.equal(recent[0].badgeTag, 'مزامنة إصدار');
  assert.equal(recent[1].badgeTag, 'مزامنة إصدار');
});

test('Firebase validation accepts V22/V25 program fields and versionUpdates array on clients', () => {
  const validProg = validateProgram({
    id: 101,
    programName: 'Desktop - تجاري V22',
    platform: 'Desktop',
    type: 'تجاري',
    version: 'V22',
    previousVersion: 'V21',
    lastVersionUpdate: '2026-11-22',
    installationsCount: 1,
    startDate: '2026-01-01'
  }, 'tenant-1');
  assert.equal(validProg.version, 'V22');
  assert.equal(validProg.previousVersion, 'V21');
  assert.equal(validProg.lastVersionUpdate, '2026-11-22');

  const validClient = validateClient({
    id: 1,
    fullName: 'عميل اختبار',
    versionUpdates: [{ id: 'vupd_1', toVersion: 'V22', affectedDevicesCount: 4 }]
  }, 'tenant-1');
  assert.equal(validClient.versionUpdates.length, 1);
  assert.equal(validClient.versionUpdates[0].toVersion, 'V22');
});
