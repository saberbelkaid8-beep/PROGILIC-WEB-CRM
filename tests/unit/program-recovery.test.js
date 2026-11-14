import { describe, expect, it, vi } from 'vitest';
import {
  AUDIT_CLASSIFICATIONS,
  buildForensicProgramAudit,
  buildProgramRecoveryDryRun,
  extractProgramFromActivity
} from '../../src/business/programReconciliationService.js';
import { computeStats } from '../../src/business/mergeDatabase.js';

describe('Program recovery dry run', () => {
  it('does not count an unknown installation total as one device', () => {
    const result = computeStats([{
      id: 1,
      fullName: 'Customer',
      programs: [{ id: 7, programName: 'Recorded Program' }],
      _subcollectionsLoaded: true
    }]);

    expect(result.stats.totalPrograms).toBe(1);
    expect(result.stats.totalLicensedDevices).toBe(0);
  });

  it('only extracts an explicitly recorded complete program, without inventing fields', () => {
    const activity = {
      type: 'PROGRAM_ADDED',
      title: 'Program registration',
      description: 'Desktop license registered',
      timestamp: '2024-01-02T03:04:05.000Z'
    };

    expect(extractProgramFromActivity(activity)).toBeNull();
    expect(buildProgramRecoveryDryRun({
      clients: [{ id: 1, fullName: 'Customer', programs: [] }],
      activities: [{ ...activity, clientId: 1 }]
    })).toMatchObject({
      writesPerformed: 0,
      totals: { D: 1 },
      candidates: [{
        classification: 'D',
        proposedAction: 'manual_review_incomplete_registration',
        program: null
      }]
    });
  });

  it('proposes recovery only from complete program metadata and preserves it exactly', () => {
    const program = {
      id: 55,
      programName: 'Web - Commercial V27',
      platform: 'Web',
      type: 'Commercial',
      version: 'V27',
      installationsCount: 3,
      startDate: '2024-01-02',
      endDate: ''
    };
    const clients = [{ id: 1, fullName: 'Customer', programs: [] }];
    const activities = [{
      id: 'event-1',
      type: 'PROGRAM_ADDED',
      clientId: 1,
      timestamp: '2024-01-02T03:04:05.000Z',
      meta: { programId: '55', program }
    }];

    const result = buildProgramRecoveryDryRun({ clients, activities });

    expect(result).toMatchObject({
      writesPerformed: 0,
      totals: { C: 1 },
      candidates: [{
        classification: 'C',
        proposedAction: 'recover_record_after_backup_and_approval',
        existingProgramId: 55,
        program
      }]
    });
    expect(clients[0].programs).toEqual([]);
    expect(activities[0].meta.program).toEqual(program);
  });

  it('classifies existing program references as duplicate evidence without proposing deletion', () => {
    const result = buildProgramRecoveryDryRun({
      clients: [{
        id: 1,
        fullName: 'Customer',
        programs: [{ id: 55, programName: 'ERP', platform: 'Desktop', type: 'Commercial' }],
        programsCount: 1,
        programNames: ['ERP']
      }],
      activities: [{
        id: 'event-1',
        type: 'PROGRAM_ADDED',
        clientId: 1,
        meta: { programId: '55' }
      }]
    });

    expect(result.totals).toEqual({ E: 1 });
    expect(result.candidates[0].proposedAction).toBe('no_change_duplicate_event');
  });

  it('classifies all 12 Phase 1 audit labels and platform breakdowns without mutating input', () => {
    const audit = buildForensicProgramAudit({
      expectedTenantId: 'tenant-1',
      clients: [
        null,
        { id: 1, fullName: 'Consistent', _subcollectionsLoaded: true, programs: [{ id: 10, programName: 'D', platform: 'Desktop', type: 'Commercial', installationsCount: 1 }], programsCount: 1, installationsCount: 1, programNames: ['D'] },
        { id: 2, fullName: 'Not visible', _subcollectionsLoaded: true, programs: [{ id: 11, programName: 'M', platform: 'Mobile', type: 'Mobile' }], programsCount: 0, programNames: [] },
        { id: 3, fullName: 'Subcollection only', _subcollectionsLoaded: true, programs: [{ id: 12, programName: 'W', platform: 'Web', type: 'Web' }] },
        { id: 4, fullName: 'Summary only', _subcollectionsLoaded: true, programs: [], programsCount: 1, programNames: ['Desktop'] },
        { id: 5, fullName: 'Timeline recoverable', _subcollectionsLoaded: true, programs: [] },
        { id: 6, fullName: 'Missing trace', _subcollectionsLoaded: true, programs: [], programsCount: 1, programNames: ['Legacy ERP'] },
        { id: 7, fullName: 'Duplicate', _subcollectionsLoaded: true, programs: [{ id: 13, programName: 'H', platform: 'Hybrid', type: 'Commercial' }, { id: 14, programName: 'H', platform: 'Hybrid', type: 'Commercial' }], programsCount: 2 },
        { id: 8, fullName: 'Conflicting', _subcollectionsLoaded: true, programs: [{ id: 15, programName: 'U', platform: 'Legacy', type: 'Commercial' }], programsCount: 1, programNames: ['U'] },
        { id: 9, fullName: 'Tenant mismatch', tenantId: 'tenant-2', _subcollectionsLoaded: true, programs: [] },
        { id: 10, fullName: 'Insufficient evidence', _subcollectionsLoaded: true, programs: [] },
        { id: 11, fullName: 'Pending review', _subcollectionsLoaded: true, programs: [], installationsCount: 2, status: 'نشط' }
      ],
      activities: [
        { id: 'a1', clientId: 5, type: 'PROGRAM_ADDED', meta: { program: { id: 20, programName: 'Recovered', platform: 'Desktop', type: 'Commercial' } } },
        { id: 'a2', clientId: 6, type: 'PROGRAM_ADDED', description: 'summary + incomplete event' },
        { id: 'a3', clientId: 8, type: 'PROGRAM_ADDED', meta: { program: { id: 15, programName: 'Different', platform: 'Desktop', type: 'Commercial' } } },
        { id: 'a4', clientId: 10, type: 'PROGRAM_ADDED', description: 'missing metadata' },
        { id: 'a5', clientId: 999, type: 'PROGRAM_ADDED', description: 'orphan' }
      ]
    });

    expect(audit.writesPerformed).toBe(0);
    expect(audit.auditedClients).toBe(12);
    expect(audit.malformedClients).toBe(1);
    expect(audit.orphanProgramDocuments).toBe(1);
    expect(audit.platformBreakdown).toMatchObject({ Desktop: 1, Mobile: 1, Web: 1, Hybrid: 2, Unknown: 1 });
    expect(audit.classificationCounts[AUDIT_CLASSIFICATIONS.INVALID_CUSTOMER_RELATIONSHIP]).toBe(1);
    expect(audit.classificationCounts[AUDIT_CLASSIFICATIONS.CONSISTENT]).toBe(1);
    expect(audit.classificationCounts[AUDIT_CLASSIFICATIONS.PROGRAM_EXISTS_BUT_NOT_VISIBLE]).toBe(1);
    expect(audit.classificationCounts[AUDIT_CLASSIFICATIONS.PROGRAM_EXISTS_IN_SUBCOLLECTION_ONLY]).toBe(1);
    expect(audit.classificationCounts[AUDIT_CLASSIFICATIONS.PROGRAM_EXISTS_IN_SUMMARY_ONLY]).toBe(1);
    expect(audit.classificationCounts[AUDIT_CLASSIFICATIONS.TIMELINE_ONLY_RECOVERY_CANDIDATE]).toBe(1);
    expect(audit.classificationCounts[AUDIT_CLASSIFICATIONS.PROGRAM_MISSING]).toBe(1);
    expect(audit.classificationCounts[AUDIT_CLASSIFICATIONS.DUPLICATE_PROGRAM]).toBe(1);
    expect(audit.classificationCounts[AUDIT_CLASSIFICATIONS.CONFLICTING_PROGRAM_METADATA]).toBe(1);
    expect(audit.classificationCounts[AUDIT_CLASSIFICATIONS.TENANT_MISMATCH]).toBe(1);
    expect(audit.classificationCounts[AUDIT_CLASSIFICATIONS.INSUFFICIENT_RECOVERY_EVIDENCE]).toBe(1);
    expect(audit.classificationCounts[AUDIT_CLASSIFICATIONS.PENDING_MANUAL_REVIEW]).toBe(1);
  });
});

vi.mock('../../src/firebase/config.js', () => ({
  db: {},
  auth: { currentUser: { uid: 'tenant-1' } }
}));

vi.mock('firebase/firestore', () => ({
  doc: vi.fn((_db, path) => ({ path })),
  runTransaction: vi.fn(),
  getDoc: vi.fn(),
  setDoc: vi.fn(),
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
  collection: vi.fn(),
  getDocs: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  startAfter: vi.fn(),
  writeBatch: vi.fn(),
  deleteField: vi.fn(),
  onSnapshot: vi.fn()
}));

describe('Program persistence errors', () => {
  it('writes the program record and summary in one Firestore transaction', async () => {
    const firestore = await import('firebase/firestore');
    const { saveClientSubItemTransaction } = await import('../../src/firebase/service.js');
    const writes = [];
    firestore.runTransaction.mockImplementation(async (_db, callback) => callback({
      set: (...args) => writes.push(['set', ...args]),
      update: (...args) => writes.push(['update', ...args]),
      delete: vi.fn()
    }));

    const program = {
      id: 55,
      programName: 'Desktop - Commercial V27',
      platform: 'Desktop',
      type: 'Commercial'
    };
    await saveClientSubItemTransaction('tenant-1', '1', 'programs', '55', program, {
      programsCount: 1,
      programNames: [program.programName]
    }, { totalPrograms: 1 });

    expect(writes).toEqual([
      ['set', { path: 'users/tenant-1/clients/1/programs/55' }, program, { merge: true }],
      ['update', { path: 'users/tenant-1/clients/1' }, expect.objectContaining({
        programsCount: 1,
        programNames: [program.programName]
      })],
      ['update', { path: 'users/tenant-1' }, expect.objectContaining({
        stats: { totalPrograms: 1 }
      })]
    ]);
  });

  it('propagates permission failures instead of reporting a false successful write', async () => {
    const firestore = await import('firebase/firestore');
    const { saveClientSubItemTransaction } = await import('../../src/firebase/service.js');
    const originalError = Object.assign(new Error('permission denied'), { code: 'permission-denied' });
    firestore.runTransaction.mockRejectedValue(originalError);
    vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(saveClientSubItemTransaction(
      'tenant-1',
      '1',
      'programs',
      '55',
      { id: 55, programName: 'ERP', platform: 'Desktop', type: 'Commercial' },
      { programsCount: 1 }
    )).rejects.toMatchObject({ code: 'permission-denied' });
  });
});
