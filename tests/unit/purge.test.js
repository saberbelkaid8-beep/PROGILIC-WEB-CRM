import { describe, it, expect, vi, beforeEach } from 'vitest';

const { batchCommits, mockBatches, mockSubDocsByPath, saveUserDataMock } = vi.hoisted(() => ({
  batchCommits: [],
  mockBatches: [],
  mockSubDocsByPath: new Map(),
  saveUserDataMock: vi.fn(async () => {})
}));

vi.mock('firebase/firestore', () => ({
  writeBatch: vi.fn(() => {
    const ops = [];
    const batch = {
      delete: vi.fn(ref => ops.push({ op: 'delete', ref })),
      set: vi.fn((ref, data, options) => ops.push({ op: 'set', ref, data, options })),
      commit: vi.fn(async () => {
        batchCommits.push([...ops]);
      })
    };
    mockBatches.push(batch);
    return batch;
  }),
  doc: vi.fn((_db, ...segments) => ({ path: segments.join('/') })),
  collection: vi.fn((_db, ...segments) => ({ path: segments.join('/') })),
  getDocs: vi.fn(async (collRef) => {
    const docs = mockSubDocsByPath.get(collRef.path) || [];
    return { docs };
  })
}));

vi.mock('../../src/firebase/config.js', () => ({
  db: {},
  auth: { currentUser: { uid: 'tenant-1', email: 'progilicservice@gmail.com' } }
}));

vi.mock('../../src/firebase/service.js', () => ({
  saveUserData: saveUserDataMock
}));

vi.mock('../../src/business/backupService.js', () => ({
  createSnapshotBackup: vi.fn(async () => ({ id: 'bak-1' })),
  downloadBackupJSON: vi.fn()
}));

vi.mock('../../src/business/idbStorage.js', () => ({
  clearAllUserData: vi.fn(async () => {}),
  saveClients: vi.fn(async () => {})
}));

import { setClients, setCurrentUser, S, getClients } from '../../src/state/store.js';
import { simulatePurge, executePurge, parseClientNamesFromMarkdown, getPurgeAuditLogs } from '../../src/business/purgeService.js';
import { openDbPurgeModal, setPurgeTab, setPurgeFilterType, setPurgeOlderThanDays, togglePurgeSelectiveCollection } from '../../src/business/actions/purgeActions.js';
import { reconcileClientPrograms } from '../../src/business/programRecovery.js';

describe('Database Purge & Maintenance Service', () => {
  beforeEach(() => {
    batchCommits.length = 0;
    mockBatches.length = 0;
    mockSubDocsByPath.clear();
    saveUserDataMock.mockClear();
    setCurrentUser({ uid: 'tenant-1', email: 'progilicservice@gmail.com', role: 'gerant' });

    setClients([
      {
        id: 'c1',
        fullName: 'عميل 1',
        company: 'شركة أ',
        status: 'متوقف',
        startDate: '2025-11-15',
        lastContact: '2020-01-01',
        programs: [{ id: 'p1', programName: 'Desktop - تجاري V27', startDate: '2025-11-15', endDate: '2020-01-01', installationsCount: 1 }],
        programsCount: 1,
        installationsCount: 1,
        programNames: ['Desktop - تجاري V27'],
        issues: [{ id: 'i1', status: 'محلول' }],
        requirements: [{ id: 'r1', status: 'منجز' }],
        contactHistory: [{ date: '2020-01-01' }]
      },
      {
        id: 'c2',
        fullName: 'عميل 2',
        company: 'شركة ب',
        status: 'نشط',
        startDate: '2026-07-01',
        lastContact: '2026-07-01',
        programs: [{ id: 'p2', programName: 'Desktop - إنتاجي V24', startDate: '2026-07-01', endDate: '2028-01-01', installationsCount: 2 }],
        programsCount: 1,
        installationsCount: 2,
        programNames: ['Desktop - إنتاجي V24'],
        issues: [{ id: 'i2', status: 'مفتوح' }],
        requirements: [],
        contactHistory: [{ date: '2026-07-01' }]
      }
    ]);
  });

  it('should simulate purge correctly for stopped clients filter', () => {
    const sim = simulatePurge({
      targetScope: 'filtered',
      filterType: 'stopped_clients',
      olderThanDays: 30
    });

    expect(sim.totalClientsAffected).toBe(1);
    expect(sim.clientsDeletedCount).toBe(1);
    expect(sim.sampleClients[0].id).toBe('c1');
    expect(sim.programsCount).toBe(1);
    expect(sim.issuesCount).toBe(1);
  });

  it('should simulate purge for solved issues filter', () => {
    const sim = simulatePurge({
      targetScope: 'filtered',
      filterType: 'solved_issues'
    });

    expect(sim.issuesCount).toBe(1);
    expect(sim.clientsDeletedCount).toBe(0);
    expect(sim.sampleClients.length).toBe(1);
  });

  it('should simulate purge for full zero wipe scope', () => {
    const sim = simulatePurge({
      targetScope: 'all'
    });

    expect(sim.totalClientsAffected).toBe(2);
    expect(sim.clientsDeletedCount).toBe(2);
    expect(sim.programsCount).toBe(2);
    expect(sim.issuesCount).toBe(2);
  });

  it('parses unique client names from Markdown export headers', () => {
    const md = `# سجل العملاء\n\n## GC - AZOUZE BADREDDINE\n\n---\n\n## GC - TAPTI MOUNIR\n\n## GC - AZOUZE BADREDDINE\n`;
    expect(parseClientNamesFromMarkdown(md)).toEqual([
      'GC - AZOUZE BADREDDINE',
      'GC - TAPTI MOUNIR'
    ]);
  });

  it('simulates deleting only client programs by date or Markdown list while keeping clients', () => {
    const byDateSim = simulatePurge({
      targetScope: 'filtered',
      filterType: 'client_programs',
      programTargetMode: 'by_date',
      targetDate: '2025-11-15',
      targetDateMode: 'exact'
    });
    expect(byDateSim.totalClientsAffected).toBe(1);
    expect(byDateSim.clientsDeletedCount).toBe(0);
    expect(byDateSim.clientsKeptCount).toBe(1);
    expect(byDateSim.programsCount).toBe(1);

    const byMdSim = simulatePurge({
      targetScope: 'filtered',
      filterType: 'client_programs',
      programTargetMode: 'from_md',
      targetClientNames: ['عميل 1']
    });
    expect(byMdSim.totalClientsAffected).toBe(1);
    expect(byMdSim.clientsDeletedCount).toBe(0);
    expect(byMdSim.programsCount).toBe(1);
  });

  it('executes chunked Firestore subcollection deletes for >400 operations while keeping client names', async () => {
    const bulkClients = [];
    for (let i = 1; i <= 450; i++) {
      const cid = `bulk_${i}`;
      bulkClients.push({
        id: cid,
        fullName: `FAKE CLIENT ${i}`,
        status: 'نشط',
        startDate: '2025-11-15',
        programs: [{ id: `p_${i}`, programName: 'Desktop - تجاري V27', startDate: '2025-11-15', installationsCount: 1 }],
        programsCount: 1,
        installationsCount: 1,
        programNames: ['Desktop - تجاري V27'],
        issues: [],
        requirements: [],
        contactHistory: []
      });
      mockSubDocsByPath.set(`users/tenant-1/clients/${cid}/programs`, [
        { ref: { path: `users/tenant-1/clients/${cid}/programs/p_${i}` } }
      ]);
    }
    setClients(bulkClients);

    const result = await executePurge({
      targetScope: 'filtered',
      filterType: 'client_programs',
      programTargetMode: 'by_date',
      targetDate: '2025-11-15',
      targetDateMode: 'exact',
      autoBackup: false,
      downloadBackup: false,
      operatorNote: 'Delete fake programs keep names'
    });

    expect(result.success).toBe(true);
    expect(result.purgeProgramsOnly).toBe(true);
    expect(result.summary.clientsDeletedCount).toBe(0);
    expect(result.summary.programsCount).toBe(450);

    // 450 program deletes + 450 client doc merges = 900 ops => must split across >= 3 batches (max 400 per batch)
    expect(batchCommits.length).toBe(3);
    expect(batchCommits.every(ops => ops.length <= 400)).toBe(true);

    const afterClients = getClients();
    expect(afterClients.length).toBe(450);
    expect(afterClients[0].fullName).toBe('FAKE CLIENT 1');
    expect(afterClients[0].programs).toEqual([]);
    expect(afterClients[0].programsCount).toBe(0);
    expect(afterClients[0].programsPurgedAt).toBeTruthy();
    expect(saveUserDataMock).toHaveBeenCalledWith('tenant-1', expect.objectContaining({
      stats: expect.objectContaining({
        totalClients: 450,
        totalPrograms: 0,
        totalLicensedDevices: 0
      })
    }));
  });

  it('prevents programRecovery from resurrecting purged programs from old PROGRAM_ADDED activities', () => {
    const reconciled = reconcileClientPrograms({
      client: {
        id: 500,
        fullName: 'GC - AZOUZE BADREDDINE',
        startDate: '2025-11-15',
        programsPurgedAt: '2026-11-18T00:00:00.000Z',
        updatedAt: '2026-11-18T00:00:00.000Z',
        programs: [],
        programsCount: 0,
        installationsCount: 0,
        programNames: []
      },
      subPrograms: [],
      inlinePrograms: [],
      activities: [
        {
          id: 'act_prog_500_1',
          clientId: 500,
          type: 'PROGRAM_ADDED',
          timestamp: '2025-11-15T13:51:00.000Z',
          description: 'تقديم وتثبيت خدمة برمجية "Desktop - تجاري V27"',
          meta: { programId: 1, programName: 'Desktop - تجاري V27', platform: 'Desktop', type: 'تجاري', version: 'V27' }
        }
      ]
    });

    expect(reconciled.programs).toEqual([]);
    expect(reconciled.needsBackfill).toBe(false);
    expect(reconciled.needsCounterSync).toBe(false);
  });

  it('does not resurrect inlinePrograms after programsPurgedAt even when client updatedAt is later', () => {
    const reconciled = reconcileClientPrograms({
      client: {
        id: 501,
        fullName: 'GC - POST PURGE EDIT',
        startDate: '2025-11-15',
        programsPurgedAt: '2026-11-18T00:00:00.000Z',
        updatedAt: '2026-11-18T02:00:00.000Z',
        programs: [],
        programsCount: 0,
        installationsCount: 0,
        programNames: []
      },
      subPrograms: [],
      inlinePrograms: [
        { id: 99, programName: 'Desktop - تجاري V27', platform: 'Desktop', type: 'تجاري', version: 'V27', startDate: '2025-11-15' }
      ],
      activities: []
    });

    expect(reconciled.programs).toEqual([]);
    expect(reconciled.needsBackfill).toBe(false);
    expect(reconciled.needsCounterSync).toBe(false);
  });

  it('should update state via purge actions', () => {
    openDbPurgeModal();
    expect(S.modal).toBe('dbPurge');
    expect(S.purgeTab).toBe('filtered');

    setPurgeTab('selective');
    expect(S.purgeTab).toBe('selective');

    setPurgeFilterType('solved_issues');
    expect(S.purgeFilterType).toBe('solved_issues');

    setPurgeOlderThanDays(60);
    expect(S.purgeOlderThanDays).toBe(60);

    togglePurgeSelectiveCollection('programs');
    expect(S.purgeSelectiveCollections.programs).toBe(false);
  });

  it('should retrieve audit logs array without crashing', () => {
    const logs = getPurgeAuditLogs();
    expect(Array.isArray(logs)).toBe(true);
  });
});
