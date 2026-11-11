# PROGILIC CRM × TRELLO INTEGRATION
# PHASE 1.1.1 — RISK REGISTER & VULNERABILITY AUDIT

**Date:** 2026-11-04  
**Audit Role:** Independent Principal Backend Architect & Application Security Auditor  
**Scope:** Phase 1.1.1 Server-Side Integrity & Production Foundation  

---

## Risk Summary Matrix

| ID | Title | Category | Severity | Classification | Immediate Action Required |
| :---: | :--- | :--- | :---: | :---: | :--- |
| **RSK-01** | Missing Pre-Remediation Snapshot & Manifest | Data Protection | **HIGH** | **FAILED CLAIM** | Create genuine physical snapshot with verified SHA-256 manifest. |
| **RSK-02** | Web SDK Live Firestore Network Leakage in Tests | Test Isolation | **HIGH** | **VERIFIED DEFECT** | Guard Web Client SDK in `trelloSyncService.js` against running in `test` environment. |
| **RSK-03** | TOCTOU Window Between Lease Check & Final CRM Write | Concurrency | **MEDIUM** | **VERIFIED LIMITATION** | Wrap sub-item mutations in a unified transaction or verify lease inside write transaction. |
| **RSK-04** | Absence of Monotonic Fencing Token Generation Counter | Distributed Systems | **MEDIUM** | **VERIFIED LIMITATION** | Implement incrementing generation counter (`generationId`) on sync documents. |
| **RSK-05** | Esbuild Duplicate Key Warnings in `src/utils/i18n.js` | Build Integrity | **LOW** | **FAILED CLAIM** | Deduplicate the remaining 8 keys in `i18n.js`. |
| **RSK-06** | Accidental Nested `/app/applet/` Workspace Directory | Repository Cleanliness | **LOW** | **VERIFIED DEFECT** | Clean nested folder created by misplaced report target paths. |

---

## Detailed Risk Assessments

### RSK-01: Missing Pre-Remediation Snapshot & Manifest
- **Classification:** **FAILED CLAIM**
- **Severity:** **HIGH**
- **Location:** `/.aistudio/artifacts/brain/a76fe77b-fa2a-40a8-80e2-11da4bb068c7/pre_remediation_snapshot/`
- **Finding:** The previous remediation report explicitly stated that a pre-remediation backup of all 119 files was archived with a cryptographic SHA-256 manifest. Filesystem inspection confirmed that this directory was never created. If source corruption had occurred, recovery from this claimed snapshot would have failed completely.
- **Remediation Requirement:** Perform a real source backup to a persistent location and verify using `sha256sum -c`.

---

### RSK-02: Web SDK Live Firestore Network Leakage During Tests
- **Classification:** **VERIFIED DEFECT**
- **Severity:** **HIGH**
- **Location:** `src/business/trello/trelloSyncService.js` (lines 54, 86, 112, 137) and `tests/unit/backend-security.test.js` (line 590)
- **Finding:** In `trelloSyncService.js`, methods contain fallback logic:
  ```js
  if (!serverAdminRepo && db && typeof window !== 'undefined' && S.isOnline) {
    await setDoc(doc(db, `users/${tenantId}/trello_sync/${itemId}`), record, { merge: true });
  }
  ```
  When tests run with `serverAdminRepo` reset to `null` (such as in `tests/unit/backend-security.test.js` Section J), the test runner attempts actual live gRPC connections across the internet to Cloud Firestore (`GrpcConnection RPC 'Write' stream 0x17b03c39`). The write was blocked solely by remote Firestore security rules returning `7 PERMISSION_DENIED`. If tests were run against a project with permissive rules, automated tests would mutate live production data!
- **Remediation Requirement:** Explicitly check `process.env.NODE_ENV !== 'test'` before executing any client-side Firestore SDK network calls, or mock `@firebase/firestore` globally in `vitest.config.js`.

---

### RSK-03: Time-of-Check to Time-of-Use (TOCTOU) Window in Sync Pipeline
- **Classification:** **VERIFIED LIMITATION**
- **Severity:** **MEDIUM**
- **Location:** `src/business/trello/trelloSyncService.js` (lines 253–379)
- **Finding:** Step 6 verifies lease ownership via `serverAdminRepo.verifyLeaseOwnership()`. Step 8 commits the CRM sub-item write via `serverAdminRepo.saveClientSubItem()`. Because these two steps are separate non-transactional operations, a worker that stalls for >15s between step 6 and step 8 can lose its lease to another worker, yet still commit its outdated write.
- **Remediation Requirement:** Combine the lease check and the CRM subcollection mutation into a single Firestore transaction in production.

---

### RSK-04: Absence of Monotonically Increasing Fencing Tokens
- **Classification:** **VERIFIED LIMITATION**
- **Severity:** **MEDIUM**
- **Location:** `src/server/firestoreAdminRepository.js` (lines 87–150)
- **Finding:** The distributed locking implementation uses a random string (`Math.random().toString(36) + '_' + Date.now()`). In classic distributed systems literature (e.g. Martin Kleppmann on fencing tokens), fencing tokens must be monotonically increasing integers so that the storage layer can reject any write with a token lower than the latest seen token.
- **Remediation Requirement:** Add an integer `leaseGeneration` field to the sync document that increments on each acquisition.

---

### RSK-05: Esbuild Duplicate Key Warnings in `src/utils/i18n.js`
- **Classification:** **FAILED CLAIM**
- **Severity:** **LOW**
- **Location:** `src/utils/i18n.js`
- **Finding:** The remediation report claimed that dictionary deduplication resolved all build warnings. During `npm run build`, esbuild outputs 8 duplicate key warnings (`منتهي`, `البرامج والتراخيص`, `عالية`, `متوسطة`, `منخفضة`, `الاسم الكامل`, `متوسطة`, `القسم`).
- **Remediation Requirement:** Remove the remaining 8 duplicate keys from `src/utils/i18n.js`.
