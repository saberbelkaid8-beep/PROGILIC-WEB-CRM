# PROGILIC CRM × TRELLO INTEGRATION
## PHASE 1.1.1 — VERIFICATION MATRIX

**Target Agent:** Google AI Gemini 4 Argon  
**Project:** PROGILIC CRM × Trello Integration  
**Phase:** 1.1.1 — Critical Server-Side Integrity Remediation  

---

### Verification Matrix by Requirement & Scenario

| Item # | Verification Category | Specific Test / Assertion | Implementation File(s) | Result |
| :---: | :--- | :--- | :--- | :---: |
| **V-01** | Test Isolation | Zero live Firestore gRPC calls during test execution | `src/server/firestoreAdminRepository.js` | **PASS** |
| **V-02** | Security | Missing Bearer token returns 401 UNAUTHORIZED | `src/server/trelloRoutes.js` | **PASS** |
| **V-03** | Security | Invalid Firebase Auth token returns 401 UNAUTHORIZED | `src/server/trelloRoutes.js` | **PASS** |
| **V-04** | Security | Cross-tenant token access returns 403 FORBIDDEN | `src/server/tenantResolver.js` | **PASS** |
| **V-05** | Security | Role claim `admin: true` strictly DENIED across tenant boundary | `src/server/tenantResolver.js` | **PASS** |
| **V-06** | Webhook Security | Missing `X-Trello-Webhook` header returns 401 UNAUTHORIZED | `src/server/trelloRoutes.js` | **PASS** |
| **V-07** | Webhook Security | Invalid HMAC signature returns 401 UNAUTHORIZED | `src/server/trelloRoutes.js` | **PASS** |
| **V-08** | Webhook Security | Valid HMAC signature executes webhook handler | `src/server/trelloRoutes.js` | **PASS** |
| **V-09** | Concurrency | Distributed lease acquisition prevents duplicate parallel sync | `src/server/firestoreAdminRepository.js` | **PASS** |
| **V-10** | Concurrency | Stale worker lease expiration fences zombie writes | `src/business/trello/trelloSyncService.js` | **PASS** |
| **V-11** | Concurrency | Overtaken lease throws `LEASE_EXPIRED` conflict | `src/server/firestoreAdminRepository.js` | **PASS** |
| **V-12** | Idempotency | Duplicate checklist item delivery skipped idempotently | `src/business/trello/trelloSyncService.js` | **PASS** |
| **V-13** | Data Integrity | Checklist item maps to correct CRM entity type (`programs`) | `src/business/trello/trelloSyncService.js` | **PASS** |
| **V-14** | Data Integrity | Checklist item maps to correct CRM entity type (`issues`) | `src/business/trello/trelloSyncService.js` | **PASS** |
| **V-15** | Data Integrity | Checklist item maps to correct CRM entity type (`requirements`) | `src/business/trello/trelloSyncService.js` | **PASS** |
| **V-16** | Data Integrity | Checklist item maps to correct CRM entity type (`contacts`) | `src/business/trello/trelloSyncService.js` | **PASS** |
| **V-17** | Data Integrity | In-place update preserves `beforeSnapshot` and original fields | `src/business/trello/trelloSyncService.js` | **PASS** |
| **V-18** | Audit & Timeline | Trello activity logged with actor `Trello` (`trello-integration`) | `src/business/trello/trelloSyncService.js` | **PASS** |
| **V-19** | Audit & Timeline | Human staff manual operations preserve real employee UID | `src/business/trello/trelloSyncService.js` | **PASS** |
| **V-20** | Review Queue | Unmatched checklist item enqueued into review queue | `src/business/trello/trelloSyncService.js` | **PASS** |
| **V-21** | Review Queue | Server-side review resolution persists to client subcollection | `src/business/trello/trelloSyncService.js` | **PASS** |
| **V-22** | Rollback Protection | Item rollback restores previous snapshot upon failure | `src/business/trello/trelloSyncService.js` | **PASS** |
| **V-23** | Rollback Protection | Rollback aborts with conflict if human staff edited record | `src/business/trello/trelloSyncService.js` | **PASS** |
| **V-24** | Error Handling | Database read errors fail closed instead of returning null | `src/business/trello/trelloSyncService.js` | **PASS** |
| **V-25** | Webhook Protocol | Processing failure returns HTTP 500/503 to trigger webhook retry | `src/server/trelloRoutes.js` | **PASS** |
| **V-26** | Runtime Cleanliness | Server runtime operates without DOM/window polyfills | `src/server/bootstrap.js` | **PASS** |
| **V-27** | Code Quality | Zero ESLint errors or warnings | Codebase-wide | **PASS** |
| **V-28** | Build Integrity | Production Vite build succeeds without duplicate key warnings | `src/utils/i18n.js`, `dist/` | **PASS** |
