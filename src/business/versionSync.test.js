import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildProgramGroupKey,
  getClientProgramGroups,
  applyVersionToProgramRecord,
  buildVersionSyncPlan
} from './versionSync.js';

test('buildVersionSyncPlan updates all 4 VDD V21 devices on Client ABC to explicit V22 without touching other programs', () => {
  const clientABC = {
    id: 101,
    fullName: 'Client ABC',
    version: 3,
    programs: [
      { id: 1, programName: 'Mobile - تطبيق VDD V21', platform: 'Mobile', type: 'تطبيق VDD (Vendeur Distributeur)', version: 'V21', installationsCount: 1, startDate: '2026-01-01', endDate: '' },
      { id: 2, programName: 'Mobile - تطبيق VDD V21', platform: 'Mobile', type: 'تطبيق VDD (Vendeur Distributeur)', version: 'V21', installationsCount: 1, startDate: '2026-01-02', endDate: '' },
      { id: 3, programName: 'Mobile - تطبيق VDD V21', platform: 'Mobile', type: 'تطبيق VDD (Vendeur Distributeur)', version: 'V21', installationsCount: 1, startDate: '2026-01-03', endDate: '' },
      { id: 4, programName: 'Mobile - تطبيق VDD V21', platform: 'Mobile', type: 'تطبيق VDD (Vendeur Distributeur)', version: 'V21', installationsCount: 1, startDate: '2026-01-04', endDate: '' },
      { id: 5, programName: 'Desktop - تجاري V26', platform: 'Desktop', type: 'تجاري (Commercial)', version: 'V26', installationsCount: 2, startDate: '2026-01-01', endDate: '' }
    ]
  };

  const plan = buildVersionSyncPlan({
    client: clientABC,
    programKey: 'Mobile:vdd',
    targetVersion: 'V22',
    updateDate: '2026-11-24',
    employeeName: 'أحمد تقني',
    employeeId: 'emp-1',
    note: 'تحديث ميداني مؤكد'
  });

  assert.equal(plan.newVersion, 'V22');
  assert.equal(plan.previousVersion, 'V21');
  assert.equal(plan.affectedProgramsCount, 4);
  assert.equal(plan.affectedDevices, 4);

  const vddUpdated = plan.nextPrograms.filter(p => buildProgramGroupKey(p) === 'Mobile:vdd');
  assert.equal(vddUpdated.length, 4);
  for (const p of vddUpdated) {
    assert.equal(p.version, 'V22');
    assert.equal(p.programName, 'Mobile - تطبيق VDD V22');
    assert.equal(p.installationsCount, 1);
  }

  const desktopProg = plan.nextPrograms.find(p => p.id === 5);
  assert.equal(desktopProg.version, 'V26');
  assert.equal(desktopProg.programName, 'Desktop - تجاري V26');
  assert.equal(desktopProg.installationsCount, 2);

  assert.equal(plan.versionHistoryEntry.previousVersion, 'V21');
  assert.equal(plan.versionHistoryEntry.newVersion, 'V22');
  assert.equal(plan.versionHistoryEntry.updateDate, '2026-11-24');
  assert.equal(plan.versionHistoryEntry.employeeName, 'أحمد تقني');
  assert.equal(plan.versionHistoryEntry.affectedDevices, 4);
  assert.equal(plan.counterUpdates.installationsCount, 6);
});

test('buildVersionSyncPlan supports consolidated entry with installationsCount = 4 while preserving device count and dates', () => {
  const clientABC = {
    id: 102,
    fullName: 'Client ABC Consolidated',
    programs: [
      { id: 10, programName: 'Mobile - تطبيق VDD V21', platform: 'Mobile', type: 'تطبيق VDD (Vendeur Distributeur)', version: 'V21', installationsCount: 4, startDate: '2026-02-01', endDate: '2027-02-01' }
    ]
  };

  const plan = buildVersionSyncPlan({
    client: clientABC,
    programKey: 'Mobile:vdd',
    targetVersion: 'V22',
    updateDate: '2026-11-24',
    employeeName: 'سارة'
  });

  assert.equal(plan.affectedProgramsCount, 1);
  assert.equal(plan.affectedDevices, 4);
  assert.equal(plan.nextPrograms[0].version, 'V22');
  assert.equal(plan.nextPrograms[0].installationsCount, 4);
  assert.equal(plan.nextPrograms[0].startDate, '2026-02-01');
  assert.equal(plan.nextPrograms[0].endDate, '2027-02-01');
});

test('buildVersionSyncPlan & applyVersionToProgramRecord reject missing or empty targetVersion (never auto-select latest)', () => {
  const client = {
    id: 103,
    programs: [
      { id: 11, programName: 'Mobile - تطبيق VDD V21', platform: 'Mobile', type: 'تطبيق VDD', version: 'V21', installationsCount: 4 }
    ]
  };

  assert.throws(
    () => buildVersionSyncPlan({ client, programKey: 'Mobile:vdd', targetVersion: '' }),
    /اختيار الإصدار/
  );
  assert.throws(
    () => buildVersionSyncPlan({ client, programKey: 'Mobile:vdd' }),
    /اختيار الإصدار/
  );
  assert.throws(
    () => applyVersionToProgramRecord(client.programs[0], '   '),
    /الإصدار الجديد/
  );
});

test('getClientProgramGroups groups devices accurately per program identity without cross-contaminating other programs', () => {
  const groups = getClientProgramGroups([
    { id: 1, platform: 'Mobile', type: 'تطبيق VDD', version: 'V21', installationsCount: 2 },
    { id: 2, platform: 'Mobile', type: 'تطبيق VDD', version: 'V21', installationsCount: 2 },
    { id: 3, platform: 'Desktop', type: 'تجاري (Commercial)', version: 'V26', installationsCount: 3 }
  ]);

  assert.equal(groups.length, 2);
  const vddGroup = groups.find(g => g.key === 'Mobile:vdd');
  assert.equal(vddGroup.devicesCount, 4);
  assert.equal(vddGroup.entriesCount, 2);
  assert.deepEqual(vddGroup.currentVersions, ['V21']);
});
