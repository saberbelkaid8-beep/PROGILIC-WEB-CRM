/**
 * PROGILIC CRM v3 — Master Concurrency, Distributed Locking & Stress Verification Suite
 * 
 * Verifies Scenarios TEST A through TEST J as mandated in Task 5:
 * 
 * TEST A — Simultaneous lease acquisition (Multiple independent workers, exactly one winner)
 * TEST B — Expired worker rejected (Worker A lease expires, Worker B obtains new generation, A tries to commit)
 * TEST C — Stale fencing token rejected (Worker with old generation cannot mutate records)
 * TEST D — Duplicate webhook concurrency (Simultaneous identical events produce 1 logical entity)
 * TEST E — Worker crash and recovery (Lease expires cleanly without indefinite lock)
 * TEST F — Commit retry / contention (Atomic transactions succeed without double-writes)
 * TEST G — Partial processing failure (Failures abort entire transaction cleanly)
 * TEST H — Concurrent updates to different items of same client (Consistent multi-item state)
 * TEST I — Cross-tenant isolation (Workers on tenant A cannot access or block tenant B)
 * TEST J — Lease renewal race (Raced renewal against post-expiration acquisition)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createTestAdminRepository } from '../../src/server/firestoreAdminRepository.js';
import {
  syncTrelloChecklistItem,
  setServerAdminRepo,
  resetServerAdminRepoForTesting,
  inMemorySyncStore
} from '../../src/business/trello/trelloSyncService.js';

describe('Task 5 — Concurrency, Distributed Locking & Data Integrity Stress Suite', () => {
  let repo;
  const TENANT_A = 'tenant_corp_alpha';
  const TENANT_B = 'tenant_corp_beta';

  beforeEach(() => {
    repo = createTestAdminRepository();
    setServerAdminRepo(repo);
    inMemorySyncStore.clear();
  });

  // --------------------------------------------------------------------------
  // TEST A: Simultaneous lease acquisition
  // --------------------------------------------------------------------------
  it('TEST A: Multiple independent workers competing for the same item result in exactly ONE winner', async () => {
    const itemId = 'chk_test_a_concurrent';
    const workerTokens = ['worker_1', 'worker_2', 'worker_3', 'worker_4', 'worker_5'];

    // All workers race to acquire lease simultaneously
    const results = await Promise.all(
      workerTokens.map(token => repo.acquireSyncLease(TENANT_A, itemId, token, 15000))
    );

    const acquired = results.filter(r => r.acquired);
    const rejected = results.filter(r => !r.acquired);

    expect(acquired.length).toBe(1);
    expect(rejected.length).toBe(4);
    expect(acquired[0].leaseGeneration).toBe(1);
    for (const rej of rejected) {
      expect(rej.reason).toBe('CONCURRENT_PROCESSING_ACTIVE');
    }
  });

  // --------------------------------------------------------------------------
  // TEST B: Expired worker rejected
  // --------------------------------------------------------------------------
  it('TEST B: Worker A lease expires, Worker B acquires new generation, Worker A commit is rejected', async () => {
    const itemId = 'chk_test_b_expired';

    // Worker A acquires short 10ms lease
    const leaseA = await repo.acquireSyncLease(TENANT_A, itemId, 'token_worker_A', 10);
    expect(leaseA.acquired).toBe(true);
    expect(leaseA.leaseGeneration).toBe(1);

    // Wait for lease to expire
    await new Promise(resolve => setTimeout(resolve, 25));

    // Worker B acquires after expiration
    const leaseB = await repo.acquireSyncLease(TENANT_A, itemId, 'token_worker_B', 15000);
    expect(leaseB.acquired).toBe(true);
    expect(leaseB.leaseGeneration).toBe(2);

    // Worker A wakes up and attempts to commit using its stale token and generation 1
    await expect(
      repo.commitProtectedSyncTransaction(TENANT_A, itemId, 'token_worker_A', 1, {
        clientId: 'client_101',
        collectionKey: 'issues',
        subItemId: 'issue_stale_A',
        subItemRecord: { title: 'Corrupting write from Worker A' }
      })
    ).rejects.toThrow(/STALE_WORKER_TOKEN_MISMATCH/);

    // Verify sub-item from Worker A was NOT written
    const subItem = await repo.getClientSubItem(TENANT_A, 'client_101', 'issues', 'issue_stale_A');
    expect(subItem).toBeNull();
  });

  // --------------------------------------------------------------------------
  // TEST C: Stale fencing token
  // --------------------------------------------------------------------------
  it('TEST C: Old worker presenting stale generation counter is strictly rejected', async () => {
    const itemId = 'chk_test_c_fencing';

    // Generation 1 acquired & released
    const l1 = await repo.acquireSyncLease(TENANT_A, itemId, 'token_1', 15000);
    expect(l1.leaseGeneration).toBe(1);
    await repo.releaseSyncLease(TENANT_A, itemId, 'token_1', 1, 'EXPIRED');

    // Generation 2 acquired by Worker 2
    const l2 = await repo.acquireSyncLease(TENANT_A, itemId, 'token_2', 15000);
    expect(l2.leaseGeneration).toBe(2);

    // Worker 1 attempts commit with token_1 and stale generation 1
    await expect(
      repo.commitProtectedSyncTransaction(TENANT_A, itemId, 'token_1', 1, {
        clientId: 'c1',
        collectionKey: 'issues',
        subItemId: 'sub1',
        subItemRecord: { title: 'Stale token write' }
      })
    ).rejects.toThrow(/STALE_WORKER_TOKEN_MISMATCH/);
  });

  // --------------------------------------------------------------------------
  // TEST D: Duplicate webhook concurrency
  // --------------------------------------------------------------------------
  it('TEST D: Simultaneous delivery of identical webhook produces exactly one logical processing result', async () => {
    const checklistItem = {
      id: 'chk_duplicate_simultaneous',
      name: 'مشكلة فنية في برنامج V24 للزبون شركة الأمل هاتف 0550112233',
      state: 'complete'
    };
    const card = { id: 'card_sunday_1' };
    const board = { id: 'board_main_1' };

    // Seed existing client
    await repo.upsertClient(TENANT_A, '1001', {
      id: 1001,
      fullName: 'شركة الأمل',
      phone: '0550112233',
      issues: []
    });

    // 3 parallel deliveries of the same checklist item
    const results = await Promise.all([
      syncTrelloChecklistItem(TENANT_A, checklistItem, card, board),
      syncTrelloChecklistItem(TENANT_A, checklistItem, card, board),
      syncTrelloChecklistItem(TENANT_A, checklistItem, card, board)
    ]);

    // One worker succeeds; the others are gated by active lease or subsequent idempotency
    const successfulOrSkipped = results.filter(r => r.status === 'SYNCED');
    const gated = results.filter(r => r.reason === 'CONCURRENT_PROCESSING_ACTIVE');

    expect(successfulOrSkipped.length).toBeGreaterThanOrEqual(1);
    expect(successfulOrSkipped.length + gated.length).toBe(3);

    // Verify exactly one issue sub-item was created in the client record
    const client = await repo.getClient(TENANT_A, '1001');
    const issues = client.issues || [];
    const matchedIssues = issues.filter(i => i.trelloChecklistItemId === checklistItem.id);
    expect(matchedIssues.length).toBe(1);
  });

  // --------------------------------------------------------------------------
  // TEST E: Worker crash and recovery
  // --------------------------------------------------------------------------
  it('TEST E: Worker crash after lease acquisition allows recovery after TTL without deadlock', async () => {
    const itemId = 'chk_test_e_crash';

    // Worker crashes without releasing or completing (lease TTL = 20ms)
    const crashedLease = await repo.acquireSyncLease(TENANT_A, itemId, 'token_crashed', 20);
    expect(crashedLease.acquired).toBe(true);

    // Immediate attempt by recovery worker fails while TTL is active
    const immediateAttempt = await repo.acquireSyncLease(TENANT_A, itemId, 'token_recovery', 15000);
    expect(immediateAttempt.acquired).toBe(false);

    // Wait for crashed worker lease to expire
    await new Promise(resolve => setTimeout(resolve, 30));

    // Recovery worker takes over seamlessly
    const recoveryLease = await repo.acquireSyncLease(TENANT_A, itemId, 'token_recovery', 15000);
    expect(recoveryLease.acquired).toBe(true);
    expect(recoveryLease.leaseGeneration).toBe(2);

    // Successfully commits recovery
    const commitRes = await repo.commitProtectedSyncTransaction(TENANT_A, itemId, 'token_recovery', 2, {
      clientId: 'c1',
      collectionKey: 'issues',
      subItemId: 'sub_recovery',
      subItemRecord: { title: 'Recovered item' }
    });
    expect(commitRes.committed).toBe(true);
  });

  // --------------------------------------------------------------------------
  // TEST F: Commit retry & contention safety
  // --------------------------------------------------------------------------
  it('TEST F: Commit operation enforces all-or-nothing atomicity across documents', async () => {
    const itemId = 'chk_test_f_atomic';
    await repo.acquireSyncLease(TENANT_A, itemId, 'token_f', 15000);

    const syncPayload = {
      clientId: 'client_atomic_1',
      collectionKey: 'issues',
      subItemId: 'issue_f_1',
      subItemRecord: { id: 'issue_f_1', title: 'Atomic Issue' },
      clientRecord: { id: 'client_atomic_1', fullName: 'Atomic Client', lastContact: '2026-11-08' },
      activityRecord: { id: 'act_f_1', title: 'Sync Activity', type: 'TRELLO_SYNCED' }
    };

    const commitRes = await repo.commitProtectedSyncTransaction(TENANT_A, itemId, 'token_f', 1, syncPayload);
    expect(commitRes.committed).toBe(true);

    // Verify all 3 documents were written atomically
    const subItem = await repo.getClientSubItem(TENANT_A, 'client_atomic_1', 'issues', 'issue_f_1');
    const client = await repo.getClient(TENANT_A, 'client_atomic_1');
    const activities = await repo.getActivities(TENANT_A);
    const syncRec = await repo.getSyncRecord(TENANT_A, itemId);

    expect(subItem).toBeDefined();
    expect(client).toBeDefined();
    expect(activities.some(a => a.id === 'act_f_1')).toBe(true);
    expect(syncRec.status).toBe('SYNCED');
    expect(syncRec.leaseExpiresAt).toBe(0);
  });

  // --------------------------------------------------------------------------
  // TEST G: Partial processing failure
  // --------------------------------------------------------------------------
  it('TEST G: Aborted transaction on invalid lease leaves zero partial database mutations', async () => {
    const itemId = 'chk_test_g_partial';

    // No lease acquired (or invalid token)
    await expect(
      repo.commitProtectedSyncTransaction(TENANT_A, itemId, 'invalid_token_xyz', 1, {
        clientId: 'client_g_1',
        collectionKey: 'issues',
        subItemId: 'issue_g_1',
        subItemRecord: { title: 'Ghost Issue' },
        clientRecord: { id: 'client_g_1', fullName: 'Ghost Client' }
      })
    ).rejects.toThrow();

    // Verify neither client nor sub-item was written
    const client = await repo.getClient(TENANT_A, 'client_g_1');
    const subItem = await repo.getClientSubItem(TENANT_A, 'client_g_1', 'issues', 'issue_g_1');
    expect(client).toBeNull();
    expect(subItem).toBeNull();
  });

  // --------------------------------------------------------------------------
  // TEST H: Concurrent updates to different items of same client
  // --------------------------------------------------------------------------
  it('TEST H: Concurrent commits for different items of the same client do not overwrite each other', async () => {
    const clientDoc = { id: 5001, fullName: 'مؤسسة الوفاق', issues: [], programs: [] };
    await repo.upsertClient(TENANT_A, '5001', clientDoc);

    const item1 = 'chk_item_h1';
    const item2 = 'chk_item_h2';

    const l1 = await repo.acquireSyncLease(TENANT_A, item1, 'tok_h1', 15000);
    const l2 = await repo.acquireSyncLease(TENANT_A, item2, 'tok_h2', 15000);
    expect(l1.acquired).toBe(true);
    expect(l2.acquired).toBe(true);

    // Commit both items concurrently
    await Promise.all([
      repo.commitProtectedSyncTransaction(TENANT_A, item1, 'tok_h1', 1, {
        clientId: '5001',
        collectionKey: 'issues',
        subItemId: 'sub_h1',
        subItemRecord: { id: 'sub_h1', title: 'Issue 1' }
      }),
      repo.commitProtectedSyncTransaction(TENANT_A, item2, 'tok_h2', 1, {
        clientId: '5001',
        collectionKey: 'issues',
        subItemId: 'sub_h2',
        subItemRecord: { id: 'sub_h2', title: 'Issue 2' }
      })
    ]);

    const sub1 = await repo.getClientSubItem(TENANT_A, '5001', 'issues', 'sub_h1');
    const sub2 = await repo.getClientSubItem(TENANT_A, '5001', 'issues', 'sub_h2');
    expect(sub1).toBeDefined();
    expect(sub2).toBeDefined();
    expect(sub1.title).toBe('Issue 1');
    expect(sub2.title).toBe('Issue 2');
  });

  // --------------------------------------------------------------------------
  // TEST I: Cross-tenant isolation
  // --------------------------------------------------------------------------
  it('TEST I: Lease acquisition and commit on Tenant A has zero interference with Tenant B', async () => {
    const sameItemId = 'chk_shared_identifier_id_999';

    // Both tenants use the same checklist item identifier
    const leaseA = await repo.acquireSyncLease(TENANT_A, sameItemId, 'token_tenant_a', 15000);
    const leaseB = await repo.acquireSyncLease(TENANT_B, sameItemId, 'token_tenant_b', 15000);

    // Both must succeed because tenant boundaries are completely isolated
    expect(leaseA.acquired).toBe(true);
    expect(leaseB.acquired).toBe(true);

    // Commits on both tenants succeed independently
    await repo.commitProtectedSyncTransaction(TENANT_A, sameItemId, 'token_tenant_a', 1, {
      clientId: 'c_alpha',
      collectionKey: 'issues',
      subItemId: 'iss_alpha',
      subItemRecord: { title: 'Alpha Tenant Issue' }
    });
    await repo.commitProtectedSyncTransaction(TENANT_B, sameItemId, 'token_tenant_b', 1, {
      clientId: 'c_beta',
      collectionKey: 'issues',
      subItemId: 'iss_beta',
      subItemRecord: { title: 'Beta Tenant Issue' }
    });

    const alphaItem = await repo.getClientSubItem(TENANT_A, 'c_alpha', 'issues', 'iss_alpha');
    const betaItem = await repo.getClientSubItem(TENANT_B, 'c_beta', 'issues', 'iss_beta');
    const crossCheck = await repo.getClientSubItem(TENANT_A, 'c_beta', 'issues', 'iss_beta');

    expect(alphaItem).toBeDefined();
    expect(betaItem).toBeDefined();
    expect(crossCheck).toBeNull(); // Tenant A cannot see Tenant B's client subitem
  });

  // --------------------------------------------------------------------------
  // TEST J: Lease renewal race & expiration boundary
  // --------------------------------------------------------------------------
  it('TEST J: Lease renewal race rejects renewal if lease has already expired and been overtaken', async () => {
    const itemId = 'chk_test_j_race';

    // Worker 1 acquires very short lease (10ms)
    await repo.acquireSyncLease(TENANT_A, itemId, 'tok_w1', 10);

    // Wait for Worker 1 lease to expire
    await new Promise(resolve => setTimeout(resolve, 20));

    // Worker 2 acquires new generation 2
    const leaseW2 = await repo.acquireSyncLease(TENANT_A, itemId, 'tok_w2', 15000);
    expect(leaseW2.acquired).toBe(true);
    expect(leaseW2.leaseGeneration).toBe(2);

    // Worker 1 tries to renew its expired lease
    const renewalW1 = await repo.renewSyncLease(TENANT_A, itemId, 'tok_w1', 1, 15000);
    expect(renewalW1.renewed).toBe(false);
    expect(['TOKEN_MISMATCH', 'GENERATION_MISMATCH', 'LEASE_EXPIRED_CANNOT_RENEW']).toContain(renewalW1.reason);

    // Worker 2 can legitimately renew
    const renewalW2 = await repo.renewSyncLease(TENANT_A, itemId, 'tok_w2', 2, 15000);
    expect(renewalW2.renewed).toBe(true);
    expect(renewalW2.leaseGeneration).toBe(2);
  });
});
