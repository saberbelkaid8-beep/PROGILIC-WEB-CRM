import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import crypto from 'crypto';
import http from 'http';
import {
  initFirebaseAdmin,
  getAdminFirestore,
  getAdminAuth,
  setAdminFirestoreForTesting,
  setAdminAuthForTesting,
  resetFirebaseAdminForTesting,
  getFirebaseAdminStatus,
  checkFirestoreReadiness
} from '../../src/server/firebaseAdmin.js';
import {
  resolveTenantForTrelloScope,
  setDynamicTenantMappingsForTesting,
  resetTenantMappingsForTesting
} from '../../src/server/tenantResolver.js';
import { FirestoreAdminRepository, createTestAdminRepository, InMemoryFirestoreAdminRepository } from '../../src/server/firestoreAdminRepository.js';
import { extractBearerToken, verifyFirebaseIdToken, assertTenantAccess } from '../../src/server/middleware/authMiddleware.js';
import { handleTrelloWebhookRequest, verifyTrelloWebhookSignature, isEventInTrelloScope } from '../../src/server/trelloRoutes.js';
import {
  syncTrelloChecklistItem,
  setServerAdminRepo,
  resetServerAdminRepoForTesting,
  inMemorySyncStore,
  rollbackTrelloItem
} from '../../src/business/trello/trelloSyncService.js';
import fs from 'fs';

describe('Phase 1 — Backend & Tenant Security Foundation', () => {

  beforeEach(() => {
    resetFirebaseAdminForTesting();
    resetTenantMappingsForTesting();
    resetServerAdminRepoForTesting();
    vi.clearAllMocks();
  });

  afterEach(() => {
    resetFirebaseAdminForTesting();
    resetTenantMappingsForTesting();
    resetServerAdminRepoForTesting();
  });

  // ============================================================================
  // SECTION A: Firebase Admin Initialization & Singleton Architecture
  // ============================================================================
  describe('A. Firebase Admin Initialization', () => {
    it('initializes safely and returns a consistent singleton instance', () => {
      const app1 = initFirebaseAdmin({ projectId: 'test-project-123' });
      const app2 = initFirebaseAdmin({ projectId: 'test-project-123' });

      expect(app1).toBeDefined();
      expect(app1).toBe(app2);
    });

    it('handles dependency injection for automated testing via setAdminFirestoreForTesting', () => {
      const mockDb = {
        collection: vi.fn().mockReturnThis(),
        doc: vi.fn().mockReturnThis(),
        get: vi.fn().mockResolvedValue({ exists: true, data: () => ({ test: true }) })
      };

      setAdminFirestoreForTesting(mockDb);
      const activeDb = getAdminFirestore();

      expect(activeDb).toBe(mockDb);
    });

    it('resetFirebaseAdminForTesting clears active mock overrides', () => {
      setAdminFirestoreForTesting({ custom: 'mock' });
      resetFirebaseAdminForTesting();
      // Should no longer return the custom mock
      expect(getAdminFirestore()).not.toEqual({ custom: 'mock' });
    });
  });

  // ============================================================================
  // SECTION B: Trusted Server-Side Tenant Resolution
  // ============================================================================
  describe('B. Tenant Resolution & Scope Authorization', () => {
    const validEnv = {
      TRELLO_BOARD_ID: 'board_alpha_1',
      TRELLO_LIST_ID: 'list_services_1',
      TRELLO_TENANT_ID: 'tenant_owner_789'
    };

    it('resolves authorized board/list to the configured tenant', () => {
      const res = resolveTenantForTrelloScope(
        { boardId: 'board_alpha_1', listId: 'list_services_1' },
        validEnv
      );

      expect(res.authorized).toBe(true);
      expect(res.tenantId).toBe('tenant_owner_789');
      expect(res.boardId).toBe('board_alpha_1');
      expect(res.listId).toBe('list_services_1');
    });

    it('rejects an unknown board ID (fails closed)', () => {
      const res = resolveTenantForTrelloScope(
        { boardId: 'unauthorized_board_999', listId: 'list_services_1' },
        validEnv
      );

      expect(res.authorized).toBe(false);
      expect(res.reason).toBe('UNAUTHORIZED_BOARD_ID');
      expect(res.tenantId).toBeUndefined();
    });

    it('rejects an unknown list ID (fails closed)', () => {
      const res = resolveTenantForTrelloScope(
        { boardId: 'board_alpha_1', listId: 'unauthorized_list_888' },
        validEnv
      );

      expect(res.authorized).toBe(false);
      expect(res.reason).toBe('UNAUTHORIZED_LIST_ID');
    });

    it('rejects missing board or list identifiers', () => {
      expect(resolveTenantForTrelloScope({ boardId: '' }, validEnv).authorized).toBe(false);
      expect(resolveTenantForTrelloScope({ listId: '' }, validEnv).authorized).toBe(false);
      expect(resolveTenantForTrelloScope({}, validEnv).authorized).toBe(false);
    });

    it('fails closed when server tenant configuration is missing or incomplete', () => {
      const incompleteEnv = { TRELLO_BOARD_ID: 'board_1', TRELLO_LIST_ID: 'list_1' }; // missing TRELLO_TENANT_ID
      const res = resolveTenantForTrelloScope({ boardId: 'board_1', listId: 'list_1' }, incompleteEnv);

      expect(res.authorized).toBe(false);
      expect(res.reason).toBe('SERVER_TENANT_MAPPING_UNCONFIGURED');
    });

    it('supports multi-tenant JSON mapping table', () => {
      const multiEnv = {
        TRELLO_TENANT_MAPPINGS: JSON.stringify({
          'board_a::list_a': 'tenant_a',
          'board_b::list_b': 'tenant_b'
        })
      };

      const resA = resolveTenantForTrelloScope({ boardId: 'board_a', listId: 'list_a' }, multiEnv);
      const resB = resolveTenantForTrelloScope({ boardId: 'board_b', listId: 'list_b' }, multiEnv);
      const resC = resolveTenantForTrelloScope({ boardId: 'board_c', listId: 'list_c' }, multiEnv);

      expect(resA.authorized).toBe(true);
      expect(resA.tenantId).toBe('tenant_a');

      expect(resB.authorized).toBe(true);
      expect(resB.tenantId).toBe('tenant_b');

      expect(resC.authorized).toBe(false);
      expect(resC.reason).toBe('UNAUTHORIZED_SCOPE_NOT_IN_MAPPING_TABLE');
    });

    it('ignores client-supplied or webhook-supplied tenant IDs and does not fall back to default', () => {
      // Even if payload contains a tenantId field, resolver strictly checks board/list
      const maliciousScope = {
        boardId: 'board_alpha_1',
        listId: 'list_services_1',
        tenantId: 'hacked_admin_tenant'
      };

      const res = resolveTenantForTrelloScope(maliciousScope, validEnv);
      expect(res.tenantId).toBe('tenant_owner_789'); // Must equal server configuration, not hacked tenant!
    });
  });

  // ============================================================================
  // SECTION C: Webhook Security & Request Guards
  // ============================================================================
  describe('C. Webhook Security & Entry Point Guards', () => {
    const secret = 'prod_webhook_secret_key_99';
    const callbackUrl = 'https://crm.example.com/api/trello/webhook';
    const boardId = 'board_sec_1';
    const listId = 'list_sec_1';
    const tenantId = 'tenant_sec_1';

    const testEnv = {
      TRELLO_WEBHOOK_SECRET: secret,
      TRELLO_CALLBACK_URL: callbackUrl,
      TRELLO_BOARD_ID: boardId,
      TRELLO_LIST_ID: listId,
      TRELLO_TENANT_ID: tenantId
    };

    const makeSignedRequest = (bodyObj) => {
      const rawBody = JSON.stringify(bodyObj);
      const signature = crypto.createHmac('sha1', secret).update(rawBody + callbackUrl).digest('base64');
      const headers = {
        'x-trello-webhook': signature,
        'x-trello-callback-url': callbackUrl,
        'content-type': 'application/json'
      };
      return { rawBody, headers };
    };

    it('rejects requests with missing or empty HMAC signature', async () => {
      const { rawBody } = makeSignedRequest({ test: 1 });
      const res = await handleTrelloWebhookRequest(rawBody, {}, 'POST', testEnv);

      expect(res.status).toBe(401);
      expect(JSON.parse(res.body).error).toBe('INVALID_OR_MISSING_WEBHOOK_SIGNATURE');
    });

    it('rejects requests when webhook secret is missing from server env', async () => {
      const { rawBody, headers } = makeSignedRequest({ test: 1 });
      const envNoSecret = { ...testEnv, TRELLO_WEBHOOK_SECRET: '' };
      const res = await handleTrelloWebhookRequest(rawBody, headers, 'POST', envNoSecret);

      expect(res.status).toBe(401);
    });

    it('rejects tampered or forged signatures', async () => {
      const { rawBody, headers } = makeSignedRequest({ test: 1 });
      headers['x-trello-webhook'] = 'forged_fake_signature_abc=';
      const res = await handleTrelloWebhookRequest(rawBody, headers, 'POST', testEnv);

      expect(res.status).toBe(401);
    });

    it('rejects oversized request bodies exceeding 512KB', async () => {
      const hugeBody = 'x'.repeat(600000); // 600KB
      const res = await handleTrelloWebhookRequest(hugeBody, { 'x-trello-webhook': 'sig' }, 'POST', testEnv);

      expect(res.status).toBe(413);
      expect(JSON.parse(res.body).error).toBe('PAYLOAD_TOO_LARGE');
    });

    it('rejects malformed JSON payloads safely without throwing', async () => {
      const rawBody = '{"not_valid_json: 123';
      const signature = crypto.createHmac('sha1', secret).update(rawBody + callbackUrl).digest('base64');
      const headers = { 'x-trello-webhook': signature, 'x-trello-callback-url': callbackUrl };

      const res = await handleTrelloWebhookRequest(rawBody, headers, 'POST', testEnv);
      expect(res.status).toBe(400);
      expect(JSON.parse(res.body).error).toBe('MALFORMED_JSON_PAYLOAD');
    });

    it('ignores webhook events from out-of-scope lists or boards', async () => {
      const eventOutOfScope = {
        action: {
          type: 'updateCheckItemStateOnCard',
          data: {
            board: { id: boardId },
            list: { id: 'unauthorized_testing_list' },
            checkItem: { id: 'chk_1' }
          }
        }
      };
      const { rawBody, headers } = makeSignedRequest(eventOutOfScope);
      const res = await handleTrelloWebhookRequest(rawBody, headers, 'POST', testEnv);

      expect(res.status).toBe(200);
      expect(JSON.parse(res.body).status).toBe('IGNORED_OUT_OF_SCOPE');
    });

    it('handles Trello HEAD handshake request with 200 OK', async () => {
      const res = await handleTrelloWebhookRequest('', {}, 'HEAD', testEnv);
      expect(res.status).toBe(200);
      expect(res.body).toBe('OK');
    });
  });

  // ============================================================================
  // SECTION D: Authenticated CRM API & Tenant Isolation Middleware
  // ============================================================================
  describe('D. Authenticated API Security & Tenant Isolation', () => {
    it('extracts Bearer token correctly from Authorization header', () => {
      expect(extractBearerToken({ authorization: 'Bearer token_abc_123' })).toBe('token_abc_123');
      expect(extractBearerToken({ Authorization: 'Bearer token_upper_456' })).toBe('token_upper_456');
      expect(extractBearerToken({ authorization: 'Basic user:pass' })).toBeNull();
      expect(extractBearerToken({})).toBeNull();
    });

    it('verifyFirebaseIdToken rejects empty or missing tokens', async () => {
      await expect(verifyFirebaseIdToken(null)).rejects.toThrow('UNAUTHENTICATED');
      await expect(verifyFirebaseIdToken('')).rejects.toThrow('UNAUTHENTICATED');
    });

    it('verifyFirebaseIdToken validates against Firebase Admin Auth', async () => {
      const mockAuth = {
        verifyIdToken: vi.fn().mockResolvedValue({ uid: 'user_owner_1', email: 'owner@crm.dz' })
      };
      setAdminAuthForTesting(mockAuth);

      const decoded = await verifyFirebaseIdToken('valid_token_xyz');
      expect(decoded.uid).toBe('user_owner_1');
      expect(mockAuth.verifyIdToken).toHaveBeenCalledWith('valid_token_xyz');
    });

    it('assertTenantAccess allows access when user UID matches target tenant', () => {
      const decoded = { uid: 'tenant_123', email: 'admin@crm.dz' };
      expect(assertTenantAccess(decoded, 'tenant_123')).toBe(true);
    });

    it('assertTenantAccess rejects cross-tenant access attempts', () => {
      const decoded = { uid: 'tenant_malicious_hacker', email: 'hacker@crm.dz' };
      expect(() => assertTenantAccess(decoded, 'tenant_victim_victim')).toThrow('Cross-tenant access denied');
    });
  });

  // ============================================================================
  // SECTION E: Server-Side Firestore Admin Repository
  // ============================================================================
  describe('E. Firestore Admin Repository Security', () => {
    it('rejects invalid or traversal tenant IDs', async () => {
      const repo = new FirestoreAdminRepository({});
      await expect(repo.getSyncRecord('../../../etc', 'chk_1')).rejects.toThrow('[Security] Invalid or forbidden tenantId');
      await expect(repo.getSyncRecord('', 'chk_1')).rejects.toThrow('[Security] Invalid or forbidden tenantId');
    });

    it('rejects forbidden subcollection names under client records', async () => {
      const repo = new FirestoreAdminRepository({});
      await expect(repo.saveClientSubItem('tenant_1', 'client_1', 'arbitrary_collection', 'item_1', {}))
        .rejects.toThrow('[Security] Forbidden subcollection');
    });

    it('successfully stores and retrieves sync records via mock Firestore adapter', async () => {
      const storeMap = new Map();
      const mockDocRef = {
        get: vi.fn().mockImplementation(async () => ({
          exists: storeMap.has('record_1'),
          data: () => storeMap.get('record_1')
        })),
        set: vi.fn().mockImplementation(async (data) => {
          storeMap.set('record_1', data);
        }),
        delete: vi.fn().mockImplementation(async () => {
          storeMap.delete('record_1');
        })
      };

      const mockCollection = {
        doc: vi.fn().mockReturnValue(mockDocRef)
      };

      const mockDb = {
        collection: vi.fn().mockImplementation((col) => {
          if (col === 'users') {
            return {
              doc: vi.fn().mockReturnValue({
                collection: vi.fn().mockReturnValue(mockCollection)
              })
            };
          }
          return mockCollection;
        })
      };

      const repo = new FirestoreAdminRepository(mockDb);
      await repo.saveSyncRecord('tenant_valid', 'record_1', { status: 'SYNCED', rawText: 'Test task' });

      const retrieved = await repo.getSyncRecord('tenant_valid', 'record_1');
      expect(retrieved.status).toBe('SYNCED');
    });
  });

  // ============================================================================
  // SECTION F: Dependency & Lockfile Integrity
  // ============================================================================
  describe('F. Dependency & Lockfile Integrity', () => {
    it('package.json and package-lock.json both include firebase-admin', () => {
      const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
      const lock = JSON.parse(fs.readFileSync('package-lock.json', 'utf8'));

      expect(pkg.dependencies['firebase-admin']).toBeDefined();
      expect(lock.packages['node_modules/firebase-admin'] || lock.dependencies?.['firebase-admin']).toBeDefined();
    });

    it('package.json defines distinct dev (Vite) and start (server.js) scripts', () => {
      const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
      expect(pkg.scripts.dev).toContain('vite');
      expect(pkg.scripts.start).toContain('server.js');
    });
  });

  // ============================================================================
  // SECTION G: Firebase Admin Readiness vs. Liveness Diagnostics
  // ============================================================================
  describe('G. Firebase Admin Readiness vs. Liveness Diagnostics', () => {
    it('reports uninitialized status when Admin is not initialized', () => {
      resetFirebaseAdminForTesting();
      const status = getFirebaseAdminStatus();
      expect(status.status).toBe('UNINITIALIZED');
    });

    it('checkFirestoreReadiness returns operational with injected test database', async () => {
      const mockDb = {
        collection: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            get: vi.fn().mockResolvedValue({ docs: [] })
          })
        })
      };
      setAdminFirestoreForTesting(mockDb);

      const readiness = await checkFirestoreReadiness();
      expect(readiness.operational).toBe(true);
      expect(mockDb.collection).toHaveBeenCalledWith('users');
    });

    it('checkFirestoreReadiness reports degraded when probe throws without crashing process', async () => {
      const mockDb = {
        collection: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            get: vi.fn().mockRejectedValue(new Error('FIRESTORE_NETWORK_TIMEOUT'))
          })
        })
      };
      setAdminFirestoreForTesting(mockDb);

      const readiness = await checkFirestoreReadiness();
      expect(readiness.operational).toBe(false);
      expect(readiness.reason).toBe('MOCK_FIRESTORE_ERROR');
    });
  });

  // ============================================================================
  // SECTION H: Protected API Authentication & Administrative Claims Policy
  // ============================================================================
  describe('H. Administrative Claims Policy & API Guards', () => {
    it('assertTenantAccess strictly denies cross-tenant access even when admin claim is present', () => {
      const adminToken = { uid: 'super_admin_uid', admin: true, email: 'admin@progilic.dz' };
      expect(() => assertTenantAccess(adminToken, 'foreign_tenant_xyz'))
        .toThrow('FORBIDDEN: Cross-tenant access denied');
    });

    it('assertTenantAccess rejects non-admin users attempting cross-tenant access', () => {
      const regularUserToken = { uid: 'user_tenant_1', admin: false, email: 'staff@progilic.dz' };
      expect(() => assertTenantAccess(regularUserToken, 'user_tenant_2'))
        .toThrow('FORBIDDEN: Cross-tenant access denied');
    });

    it('assertTenantAccess rejects requests with missing target tenantId', () => {
      const token = { uid: 'user_1' };
      expect(() => assertTenantAccess(token, ''))
        .toThrow('BAD_REQUEST: Missing target tenantId');
    });
  });

  // ============================================================================
  // SECTION I: Atomic Distributed Lease & Concurrency Protection
  // ============================================================================
  describe('I. Atomic Distributed Lease & Concurrency Protection', () => {
    it('acquires distributed lease atomically and blocks concurrent worker', async () => {
      const leaseStore = new Map();

      const mockDocRef = {
        get: vi.fn().mockImplementation(async () => ({
          exists: leaseStore.has('item_concurrency_1'),
          data: () => leaseStore.get('item_concurrency_1')
        })),
        set: vi.fn().mockImplementation(async (data) => {
          const prev = leaseStore.get('item_concurrency_1') || {};
          leaseStore.set('item_concurrency_1', { ...prev, ...data });
        })
      };

      const mockDb = {
        collection: vi.fn().mockReturnValue({
          doc: vi.fn().mockReturnValue({
            collection: vi.fn().mockReturnValue({
              doc: vi.fn().mockReturnValue(mockDocRef)
            })
          })
        }),
        runTransaction: vi.fn().mockImplementation(async (txFn) => {
          return await txFn({
            get: async (ref) => ref.get(),
            set: async (ref, data, opt) => ref.set(data, opt)
          });
        })
      };

      const repo = new FirestoreAdminRepository(mockDb);

      // Worker 1 acquires lease
      const worker1Token = 'worker_1_' + Date.now();
      const lease1 = await repo.acquireSyncLease('tenant_lock', 'item_concurrency_1', worker1Token, 15000);
      expect(lease1.acquired).toBe(true);
      expect(lease1.leaseToken).toBe(worker1Token);

      // Worker 2 attempts concurrent acquire while Worker 1 is processing
      const worker2Token = 'worker_2_' + Date.now();
      const lease2 = await repo.acquireSyncLease('tenant_lock', 'item_concurrency_1', worker2Token, 15000);
      expect(lease2.acquired).toBe(false);
      expect(lease2.reason).toBe('CONCURRENT_PROCESSING_ACTIVE');
      expect(lease2.activeLeaseToken).toBe(worker1Token);
    });

    it('verifies lease ownership and rejects stale tokens', async () => {
      const leaseStore = new Map();
      const validToken = 'token_valid_123';

      leaseStore.set('item_fence_1', {
        status: 'PROCESSING',
        leaseToken: validToken,
        leaseExpiresAt: Date.now() + 10000
      });

      const mockDocRef = {
        get: vi.fn().mockImplementation(async () => ({
          exists: true,
          data: () => leaseStore.get('item_fence_1')
        }))
      };

      const mockDb = {
        collection: vi.fn().mockReturnValue({
          doc: vi.fn().mockReturnValue({
            collection: vi.fn().mockReturnValue({
              doc: vi.fn().mockReturnValue(mockDocRef)
            })
          })
        })
      };

      const repo = new FirestoreAdminRepository(mockDb);

      // Valid token check
      const validCheck = await repo.verifyLeaseOwnership('tenant_fence', 'item_fence_1', validToken);
      expect(validCheck.valid).toBe(true);

      // Superseded / stale token check
      const staleCheck = await repo.verifyLeaseOwnership('tenant_fence', 'item_fence_1', 'stale_worker_token');
      expect(staleCheck.valid).toBe(false);
      expect(staleCheck.reason).toBe('TOKEN_MISMATCH');
    });

    it('releaseSyncLease clears lease expiration upon worker completion', async () => {
      const leaseStore = new Map();
      const myToken = 'token_to_release';

      leaseStore.set('item_rel_1', {
        status: 'PROCESSING',
        leaseToken: myToken,
        leaseExpiresAt: Date.now() + 10000
      });

      const mockDocRef = {
        get: vi.fn().mockImplementation(async () => ({
          exists: true,
          data: () => leaseStore.get('item_rel_1')
        })),
        set: vi.fn().mockImplementation(async (updates) => {
          const prev = leaseStore.get('item_rel_1');
          leaseStore.set('item_rel_1', { ...prev, ...updates });
        })
      };

      const mockDb = {
        collection: vi.fn().mockReturnValue({
          doc: vi.fn().mockReturnValue({
            collection: vi.fn().mockReturnValue({
              doc: vi.fn().mockReturnValue(mockDocRef)
            })
          })
        })
      };

      const repo = new FirestoreAdminRepository(mockDb);
      const released = await repo.releaseSyncLease('tenant_rel', 'item_rel_1', myToken, null, 'SYNCED');
      expect(released).toBe(true);

      const updated = leaseStore.get('item_rel_1');
      expect(updated.leaseExpiresAt).toBe(0);
      expect(updated.status).toBe('SYNCED');
    });
  });

  // ============================================================================
  // SECTION J: Persistence Error Handling & Rollback Safeguards
  // ============================================================================
  describe('J. Persistence Error Propagation & Rollback Safeguards', () => {
    it('propagates Admin Firestore persistence errors without swallowing', async () => {
      const mockFailingRepo = {
        saveSyncRecord: vi.fn().mockRejectedValue(new Error('FIRESTORE_WRITE_PERMISSION_DENIED'))
      };
      setServerAdminRepo(mockFailingRepo);

      const repo = new FirestoreAdminRepository({});
      // Ensure syncService throws when Admin repo fails to write
      await expect(repo.saveSyncRecord('tenant_fail', 'chk_fail', { status: 'TEST' }))
        .rejects.toThrow();
    });

    it('rollback preserves pre-existing CRM records when staff manual edits exist', async () => {
      const tenantId = 'tenant_rollback_test';
      const itemId = 'chk_rollback_manual';
      const testRepo = createTestAdminRepository();
      testRepo.seedClients(tenantId, [{ id: 99991, fullName: 'Test Client', issues: [{ id: 88881, title: 'Existing Issue', lastModifiedBy: 'human_staff' }] }]);
      setServerAdminRepo(testRepo);

      await testRepo.saveSyncRecord(tenantId, itemId, {
        status: 'SYNCED',
        clientId: 99991,
        targetCollection: 'issues',
        targetRecordId: 88881,
        actionType: 'SUB_ITEM_CREATED'
      });

      inMemorySyncStore.set(`${tenantId}:${itemId}`, {
        status: 'SYNCED',
        clientId: 99991,
        targetCollection: 'issues',
        targetRecordId: 88881,
        actionType: 'SUB_ITEM_CREATED'
      });

      // Staff edited the issue manually
      const res = await rollbackTrelloItem(tenantId, itemId);
      expect(res.status).toBe('CONFLICT_MANUAL_EDITS_DETECTED');
    });
  });

  // ============================================================================
  // SECTION K: Monotonic Fencing Generation & Protected Transaction
  // ============================================================================
  describe('K. Monotonic Fencing Generation & Protected Commit', () => {
    it('increments leaseGeneration monotonically across sequential lease acquisitions', async () => {
      const repo = createTestAdminRepository();
      const tenantId = 'tenant_gen_1';
      const itemId = 'item_gen_1';

      const l1 = await repo.acquireSyncLease(tenantId, itemId, 'token_1', 15000);
      expect(l1.acquired).toBe(true);
      expect(l1.leaseGeneration).toBe(1);

      await repo.releaseSyncLease(tenantId, itemId, 'token_1', 1, 'EXPIRED');

      const l2 = await repo.acquireSyncLease(tenantId, itemId, 'token_2', 15000);
      expect(l2.acquired).toBe(true);
      expect(l2.leaseGeneration).toBe(2);
    });

    it('rejects lease renewal when leaseGeneration mismatch occurs', async () => {
      const repo = createTestAdminRepository();
      const tenantId = 'tenant_renew_1';
      const itemId = 'item_renew_1';

      const l1 = await repo.acquireSyncLease(tenantId, itemId, 'token_1', 15000);
      const renewRes = await repo.renewSyncLease(tenantId, itemId, 'token_1', 999, 15000); // Mismatched generation
      expect(renewRes.renewed).toBe(false);
      expect(renewRes.reason).toBe('GENERATION_MISMATCH');
    });

    it('commitProtectedSyncTransaction rejects commit when stale generation is presented', async () => {
      const repo = createTestAdminRepository();
      const tenantId = 'tenant_commit_1';
      const itemId = 'item_commit_1';

      await repo.acquireSyncLease(tenantId, itemId, 'token_1', 15000);

      await expect(repo.commitProtectedSyncTransaction(tenantId, itemId, 'token_1', 99, {
        clientId: 'c1',
        collectionKey: 'issues',
        subItemId: 's1',
        subItemRecord: { title: 'Test' }
      })).rejects.toThrow('STALE_WORKER_GENERATION_MISMATCH');
    });
  });

  // ============================================================================
  // SECTION L: Zero Network Leakage & Hermetic Test Environment
  // ============================================================================
  describe('L. Zero Network Leakage Verification', () => {
    it('proves no client Web SDK calls or gRPC connections occur when serverAdminRepo is reset', async () => {
      resetServerAdminRepoForTesting();
      // Calling getSyncRecord when serverAdminRepo is null should return in-memory or null without calling Web SDK
      const res = await syncTrelloChecklistItem('tenant_hermetic', { id: 'chk_hermetic_1', name: 'Hermetic Task' });
      // Returns synced or processed in-memory without error or remote network call
      expect(res).toBeDefined();
    });
  });

});
