# PROGILIC CRM × TRELLO INTEGRATION
# PHASE 1.1.1 — EVIDENCE MATRIX

**Audit Execution Date:** 2026-11-04  
**Audit Mode:** READ-ONLY INDEPENDENT VERIFICATION  
**Scope:** Phase 1.1.1 — Critical Server-Side Integrity Remediation  

---

## Exhaustive Evidence Matrix

| Ref | Verification Area | Target File & Line(s) | Verified Implementation / Code Evidence | Test / Execution Evidence | Verdict |
| :---: | :--- | :--- | :--- | :--- | :---: |
| **EV-01** | Safe Snapshot | `/.aistudio/artifacts/.../pre_remediation_snapshot` | Directory not found on disk. `find` returned exit code 1. | `find /.aistudio -name "*snapshot*"` -> No files | **FAILED CLAIM** |
| **EV-02** | Snapshot Manifest | `manifest.sha256` | Manifest file missing from filesystem. | `sha256sum -c` failed with ENOENT | **FAILED CLAIM** |
| **EV-03** | Web SDK Leakage | `src/business/trello/trelloSyncService.js`:54,86 | `if (!serverAdminRepo && db && typeof window !== 'undefined' && S.isOnline) await setDoc(...)` | `backend-security.test.js`:590 emitted gRPC Write stream 0x17b03c39 error | **VERIFIED DEFECT** |
| **EV-04** | In-Memory Test Adapter | `src/server/firestoreAdminRepository.js`:413-706 | `class InMemoryFirestoreAdminRepository` implementing transactions, leases, subcollections, timeline logs. | `trello-integration.test.js`:66 injected `createTestAdminRepository()`; 30/30 passed | **VERIFIED** |
| **EV-05** | Production Repo Connection | `src/server/trelloRoutes.js`:14-16 | `if (process.env.NODE_ENV !== 'test') { setServerAdminRepo(adminRepo); }` | Confirmed `adminRepo.db` calls `getAdminFirestore()` in production runtime | **VERIFIED** |
| **EV-06** | Atomic Lease Acquisition | `src/server/firestoreAdminRepository.js`:87-145 | `firestore.runTransaction(async (transaction) => { ... })` checks existing lease expiration before updating. | `backend-security.test.js`:448-492 verified parallel worker blocked | **VERIFIED** |
| **EV-07** | Fencing Write Gate | `src/business/trello/trelloSyncService.js`:253-275 | Calls `serverAdminRepo.verifyLeaseOwnership()`; rejects writes with `STALE_WORKER_FENCING_REJECTED` if expired. | `trello-integration.test.js`:401-413 verified expired lease aborts write | **VERIFIED** |
| **EV-08** | Monotonic Generation Counter | `src/server/firestoreAdminRepository.js`:120-129 | Uses random string token (`Math.random() + Date.now()`). No integer generation counter present. | Code inspection of `acquireSyncLease` | **VERIFIED LIMITATION** |
| **EV-09** | TOCTOU Window | `src/business/trello/trelloSyncService.js`:254 & 362 | `verifyLeaseOwnership` is a read at line 254; `saveClientSubItem` is executed later at line 362 without atomic lock. | Code inspection of `syncTrelloChecklistItem` | **VERIFIED LIMITATION** |
| **EV-10** | Tenant Path Scoping | `src/server/firestoreAdminRepository.js`:16-21, 55, 100, 344 | `assertValidTenantId` validates `/^[a-zA-Z0-9_-]{1,128}$/`; paths parameterized under `users/${validTenant}/...` | `backend-security.test.js`:278-360 verified all methods reject missing tenantId | **VERIFIED** |
| **EV-11** | No Admin Tenant Bypass | `src/server/middleware/authMiddleware.js`:59-83 | `assertTenantAccess` verifies `decodedToken.tenantId || decodedToken.uid === targetTenantId`. No `admin: true` bypass. | `backend-security.test.js`:425-429 verified admin token rejected with 403 | **VERIFIED** |
| **EV-12** | HMAC Constant-Time Check | `src/server/trelloRoutes.js`:22-49 | Computes HMAC-SHA1 of `rawString + webhookCallbackUrl`; compares buffers via `crypto.timingSafeEqual`. | `backend-security.test.js`:160-220 verified invalid/tampered signatures fail | **VERIFIED** |
| **EV-13** | Webhook Scope Guard | `src/server/trelloRoutes.js`:56-83 | Rejects mismatched boards or lists; ignores out-of-scope events with HTTP 200. | `backend-security.test.js`:125-155 verified unauthorized board/list rejected | **VERIFIED** |
| **EV-14** | Webhook Retry HTTP Status | `src/server/trelloRoutes.js`:181-194 | On sync failure, returns HTTP 503 (lock contention) or HTTP 500 (general failure) with `retryable: true`. | `backend-security.test.js`:240-270 verified 500 status returned on error | **VERIFIED** |
| **EV-15** | In-Place Entity Updates | `src/business/trello/trelloSyncService.js`:339-410 | Supported for `programs`, `issues`, `requirements`, `contacts`. Finds by `trelloChecklistItemId`, updates in place. | `trello-integration.test.js`:240-270 verified zero duplicate sub-items created | **VERIFIED** |
| **EV-16** | Provenance Tracking | `src/business/trello/trelloSyncService.js`:350, 462 | Captures `beforeSnapshot = { ...subList[existingIdx] }` and sets `actionType = 'RECORD_UPDATED'`. | `trello-integration.test.js`:250-265 verified snapshot stored in sync record | **VERIFIED** |
| **EV-17** | Arabic Normalization Safety | `src/business/ai/entityResolver.js`:162-171 | Orthographic normalization alone returns `AMBIGUOUS` / `NAME_ONLY_UNCONFIRMED` without secondary proof. | `trello-integration.test.js`:415-440 verified ambiguous match returned | **VERIFIED** |
| **EV-18** | Timeline Actor Attribution | `src/business/timelineService.js`:244-247 | `source === 'trello'` forces `userName = 'Trello'`, `userId = 'trello-integration'`, `userRole = 'Integration'`. | `trello-integration.test.js`:270-300 verified Trello actor appears in timeline | **VERIFIED** |
| **EV-19** | Human Edit Rollback Guard | `src/business/trello/trelloSyncService.js`:700-705 | Checks `existingItem.lastModifiedBy !== 'trello'`; returns `CONFLICT_MANUAL_EDITS_DETECTED`. | `trello-integration.test.js`:480-495 verified rollback aborted on manual edit | **VERIFIED** |
| **EV-20** | Review Queue Resolution | `src/business/trello/trelloSyncService.js`:488-640 | `resolveReviewItem` writes to subcollection via `serverAdminRepo.saveClientSubItem` and deletes review item. | `trello-integration.test.js`:442-461 verified persistence and queue cleanup | **VERIFIED** |
| **EV-21** | Fail-Closed Database Reads | `src/business/trello/trelloSyncService.js`:47-50 | `getSyncRecord` re-throws errors from `serverAdminRepo.getSyncRecord` instead of swallowing. | `backend-security.test.js`:578-588 verified error propagation | **VERIFIED** |
| **EV-22** | Clean Server Runtime | `src/server/bootstrap.js`:1-35 | No `window`, `document`, or `requestAnimationFrame` polyfills injected into Node process. | Inspected `bootstrap.js` | **VERIFIED** |
| **EV-23** | i18n Deduplication | `src/utils/i18n.js`:713, 792, 884, 886, 888, 945, 956, 1244 | 6 keys removed, but 8 duplicate keys still exist in Arabic dictionary. | `npm run build` emitted 8 esbuild warnings | **FAILED CLAIM** |
| **EV-24** | ESLint Code Quality | Whole repository | `eslint .` | Exited 0 with zero errors and zero warnings | **VERIFIED** |
| **EV-25** | Trello Integration Tests | `tests/unit/trello-integration.test.js` | `npx vitest run tests/unit/trello-integration.test.js` | 30 tests run, 30 passed, 0 failed (duration 40ms) | **VERIFIED** |
| **EV-26** | Backend Security Tests | `tests/unit/backend-security.test.js` | `npx vitest run tests/unit/backend-security.test.js` | 38 tests run, 38 passed, 0 failed (duration 254ms) | **VERIFIED** |
| **EV-27** | Full Suite Reproduction | All 26 test files | `npm test` | 23 passed suites, 3 failed suites; 192 passed, 7 failed | **VERIFIED** |
