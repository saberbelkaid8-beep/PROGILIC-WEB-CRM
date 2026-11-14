import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  generateDeterministicRecoveryId,
  extractRecoverableProgramFromActivity,
  repairProgramProjections,
  classifyPendingLocalPrograms,
  executeControlledProgramRecovery
} from '../../src/business/programReconciliationService.js';

describe('Phase 2 — Controlled Program Recovery Suite (Scenarios A through E)', () => {
  describe('1. Deterministic Identifier & Extraction Verification', () => {
    it('generates consistent deterministic recovery IDs for the same signature', () => {
      const prog = {
        platform: 'Desktop',
        programName: 'Desktop - تجاري V27',
        type: 'تجاري',
        version: 'V27',
        startDate: '2024-01-01'
      };
      const id1 = generateDeterministicRecoveryId(101, prog);
      const id2 = generateDeterministicRecoveryId(101, prog);
      const idDiffClient = generateDeterministicRecoveryId(102, prog);

      expect(id1).toBe(id2);
      expect(id1.startsWith('rec_')).toBe(true);
      expect(id1).not.toBe(idDiffClient);
    });

    it('extracts complete program from activity and flags missing fields when incomplete', () => {
      const completeAct = {
        id: 'act-1',
        type: 'PROGRAM_ADDED',
        meta: {
          program: {
            programName: 'Mobile - تطبيق V27',
            platform: 'Mobile',
            type: 'تطبيق V27',
            installationsCount: 2
          }
        }
      };
      const result = extractRecoverableProgramFromActivity(completeAct, 201);
      expect(result.program).toBeDefined();
      expect(result.program.id).toBeDefined();
      expect(result.usedDeterministicId).toBe(true);
      expect(result.missingFields).toEqual([]);

      const incompleteAct = {
        id: 'act-2',
        type: 'PROGRAM_ADDED',
        meta: {
          program: {
            // Missing programName and platform
            type: 'تجاري'
          }
        }
      };
      const badResult = extractRecoverableProgramFromActivity(incompleteAct, 201);
      expect(badResult.program).toBeNull();
      expect(badResult.missingFields).toContain('programName');
      expect(badResult.missingFields).toContain('platform');
    });
  });

  describe('2. Scenario A — Repair Customer Summary Projections', () => {
    it('repairs divergent parent counters and names without creating duplicate programs', () => {
      const clients = [
        {
          id: 301,
          fullName: 'عميل برامج غير مرئية',
          programs: [
            { id: 'p1', programName: 'Desktop - تجاري V27', installationsCount: 2 },
            { id: 'p2', programName: 'Mobile - تطبيق V27', installationsCount: 1 }
          ],
          programsCount: 0, // Out of sync!
          programNames: [],
          _subcollectionsLoaded: false
        }
      ];

      const { repairedIds, nextClients } = repairProgramProjections(clients);

      expect(repairedIds).toEqual([301]);
      expect(nextClients[0].programsCount).toBe(2);
      expect(nextClients[0].installationsCount).toBe(3);
      expect(nextClients[0].programNames).toEqual(['Desktop - تجاري V27', 'Mobile - تطبيق V27']);
      expect(nextClients[0]._subcollectionsLoaded).toBe(true);
      expect(nextClients[0].programs.length).toBe(2); // No extra programs created!
    });
  });

  describe('3. Scenario B — Summary-Only Incomplete Records (Zero Fabrication)', () => {
    it('classifies summary-only customers as manual review and refuses to invent missing fields', async () => {
      const clients = [
        {
          id: 401,
          fullName: 'عميل ملخص قديم',
          programs: [],
          programsCount: 1,
          programNames: ['logiciel commercial']
        }
      ];

      const result = await executeControlledProgramRecovery({
        approved: true,
        backupVerified: true,
        backupSnapshot: { id: 'snap-1', clients },
        clients,
        activities: []
      });

      expect(result.status).toBe('completed');
      expect(result.writesPerformed).toBe(0);
      expect(result.manualReview.length).toBe(1);
      expect(result.manualReview[0].customerId).toBe(401);
      expect(result.manualReview[0].reason).toBe('SUMMARY_ONLY_INSUFFICIENT_FIELDS');
      expect(result.nextClients[0].programs.length).toBe(0); // Zero fabrication!
    });
  });

  describe('4. Scenario C & Safety Pre-Conditions (Gating & Idempotency)', () => {
    it('strictly blocks execution if approved is false', async () => {
      const clients = [{ id: 501, programs: [] }];
      const result = await executeControlledProgramRecovery({
        approved: false,
        backupVerified: true,
        backupSnapshot: { id: 'snap-1', clients },
        clients
      });

      expect(result.status).toBe('blocked');
      expect(result.reason).toContain('Explicit approval');
      expect(result.writesPerformed).toBe(0);
    });

    it('strictly blocks execution if backupVerified is false or backupSnapshot is missing', async () => {
      const clients = [{ id: 501, programs: [] }];
      const result = await executeControlledProgramRecovery({
        approved: true,
        backupVerified: false,
        backupSnapshot: null,
        clients
      });

      expect(result.status).toBe('blocked');
      expect(result.reason).toContain('backupVerified');
      expect(result.writesPerformed).toBe(0);
    });

    it('recovers verified Timeline programs and maintains 100% idempotency on rerun', async () => {
      const clients = [{ id: 601, fullName: 'الزبون س', programs: [] }];
      const activities = [
        {
          id: 'act-recover-1',
          type: 'PROGRAM_ADDED',
          clientId: 601,
          meta: {
            programId: 'prog-100',
            program: {
              id: 'prog-100',
              programName: 'Desktop - تجاري V27',
              platform: 'Desktop',
              type: 'تجاري',
              version: 'V27',
              installationsCount: 1
            }
          }
        }
      ];

      const batchWriter = vi.fn(async () => {});

      // First run: restores program
      const run1 = await executeControlledProgramRecovery({
        approved: true,
        backupVerified: true,
        backupSnapshot: { id: 'snap-1', clients },
        clients,
        activities,
        batchWriter
      });

      expect(run1.status).toBe('completed');
      expect(run1.writesPerformed).toBe(1);
      expect(run1.restored.length).toBe(1);
      expect(run1.nextClients[0].programs.length).toBe(1);
      expect(run1.nextClients[0].programs[0].id).toBe('prog-100');
      expect(batchWriter).toHaveBeenCalledTimes(1);

      // Second run: idempotent — skips existing program
      const run2 = await executeControlledProgramRecovery({
        approved: true,
        backupVerified: true,
        backupSnapshot: { id: 'snap-1', clients: run1.nextClients },
        clients: run1.nextClients,
        activities,
        batchWriter
      });

      expect(run2.status).toBe('completed');
      expect(run2.writesPerformed).toBe(0);
      expect(run2.restored.length).toBe(0);
      expect(run2.duplicateSkipped.length).toBe(1);
      expect(run2.nextClients[0].programs.length).toBe(1);
    });
  });

  describe('5. Scenario D — Offline Sync Queue Protection', () => {
    it('classifies pending offline creations as legitimate_unsynced and protects them', () => {
      const localClients = [
        {
          id: 701,
          fullName: 'عميل أوفلاين',
          programs: [{ id: 'lp-1', programName: 'Desktop - تجاري V27', platform: 'Desktop' }]
        }
      ];
      const syncQueue = [
        {
          type: 'SAVE_SUB_ITEM',
          state: 'pending',
          payload: {
            clientId: 701,
            collectionName: 'programs',
            itemData: { id: 'lp-1', programName: 'Desktop - تجاري V27', platform: 'Desktop' }
          }
        }
      ];

      const classifications = classifyPendingLocalPrograms({
        clients: localClients,
        remoteClients: [],
        syncQueue
      });

      expect(classifications.length).toBe(1);
      expect(classifications[0].classification).toBe('legitimate_unsynced');
      expect(classifications[0].programId).toBe('lp-1');
    });
  });

  describe('6. Scenario E — Multi-Program Customer Restoration', () => {
    it('restores multiple distinct Desktop, Mobile, and Web programs under the same customer', async () => {
      const clients = [
        { id: 801, fullName: 'مؤسسة متعددة المنصات', programs: [] }
      ];
      const activities = [
        {
          id: 'act-desktop',
          type: 'PROGRAM_ADDED',
          clientId: 801,
          meta: {
            program: {
              id: 'p-desk-1',
              programName: 'Desktop - تجاري V24',
              platform: 'Desktop',
              type: 'تجاري',
              version: 'V24',
              installationsCount: 2
            }
          }
        },
        {
          id: 'act-mobile',
          type: 'PROGRAM_ADDED',
          clientId: 801,
          meta: {
            program: {
              id: 'p-mob-1',
              programName: 'Mobile - تطبيق V27',
              platform: 'Mobile',
              type: 'تطبيق V27',
              version: 'V27',
              installationsCount: 1
            }
          }
        }
      ];

      const result = await executeControlledProgramRecovery({
        approved: true,
        backupVerified: true,
        backupSnapshot: { id: 'snap-multi', clients },
        clients,
        activities
      });

      expect(result.status).toBe('completed');
      expect(result.restored.length).toBe(2);
      expect(result.nextClients[0].programs.length).toBe(2);
      expect(result.nextClients[0].programsCount).toBe(2);
      expect(result.nextClients[0].installationsCount).toBe(3);
      expect(result.nextClients[0].programs.map(p => p.platform).sort()).toEqual(['Desktop', 'Mobile']);
    });
  });
});
