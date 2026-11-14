# PHASE 1 — Complete Forensic Data Integrity Audit Report

**Project:** PROGILIC CRM v3  
**Phase:** PHASE 1 — Complete Forensic Data Integrity Audit (Read-Only)  
**Audit Date:** 2026-11-14  
**Authoritative Storage Model Verified in Source:**
- Tenant root / stats & sequence doc: `users/{tenantId}` (`stats`, `nid`, `v`)
- Customer records: `users/{tenantId}/clients/{clientId}` (`programsCount`, `installationsCount`, `programNames`, etc.)
- Canonical program documents: `users/{tenantId}/clients/{clientId}/programs/{programId}`
- Audit Timeline events: `users/{tenantId}/activities/{activityId}` (`PROGRAM_ADDED`, `meta.program`, `clientId`, `actorUid`)

---

## 1. Evidence Sources Audited & Live Access Status

| Source | Status | Exact Verified Findings |
|---|---|---|
| Live Firestore (`gen-lang-client-0400245577` / `ai-studio-a76fe77b-fa2a-40a8-80e2-11da4bb068c7`) | **`BLOCKED_BY_ENVIRONMENT / REQUIRES_PRODUCTION_ACCESS`** | No authenticated local Firebase / gcloud session or Java emulator available. Zero live reads or writes performed. |
| Nov 12 Console & RPC Log (`public/assets/aistudio/Paste_November_12__2026_-_4_24PM_8fe1222c`, `6,749` lines) | **Audited (Primary Telemetry)** | Active tenant `z1FY0kWqOOSe78cFv8rqak0mjV03` (`progilicservice@gmail.com`); `927` client docs audited across `30` reconciliation passes vs `0` / `2,137` / `2,139` timeline traces; stale `stats.totalClients` = `959` (32-client drift). |
| Nov 13 Console & RPC Log (`public/assets/aistudio/Paste_November_13__2026_-_1_29PM_9a43d2a5`, `14,248` lines) | **Audited (Sync Storm Telemetry)** | `[Timeline] Populating 775 existing CRM services...` (and `771`) fired unbatched single-doc `saveTenantActivity` writes alongside `1,282` `RPC 'BatchGetDocuments'` failures. |
| Conversation CSV Export (User Request #2) | **Audited (Explicit User Dataset)** | Explicit customer-program rows including Mobile (`Mobile - تطبيق V27`), Desktop (`V21`, `V23`, `V24`, `V27`), and legacy un-normalized labels (`COMMERCIAL`, `logiciel commercial`, `logiciel production commercial`). |
| `src/data/importedClients.js` | **Audited** | Empty (`[]`, `0` records). |
| `public/assets/aistudio/progilic_dashboard_349c4566.html` | **Audited & Excluded** | Static HTML design mockup containing demo counters only; not real tenant data. |

---

## 2. Root Causes Discovered for Historical Missing Programs & Sync Failures

### 2.1 Nov 12 False-Success Recovery Loop & `Commit` `permission-denied` (`242` failures)
- Across `30` reconciliation loops on `927` clients, the legacy reconciler logged **48 unique client headers** (`25` matched via `Found timeline trace` and `23` via `Recovering program from programNames`) and emitted **`268` false `"Successfully saved recovered program to Firestore"`** messages (across `46` unique client names).
- In reality, **242 Firestore `Commit` RPCs failed with `permission-denied`** across **23 distinct client IDs** (`10`, `11`, `12`, `100`–`106`, `108`, `109`, `111`–`122`), and the legacy code fabricated `"startDate": "2025-11-15"` on those writes.
- **Why `firestore.rules` rejected the transactions:** `firestore.rules:227` evaluates `isValidClient(incoming())` on parent `clients/{clientId}` updates. Whenever a legacy client document lacked valid required fields (`status` in `["نشط", "محتمل", "متوقف"]`) or exceeded length/allowlist checks, updating `programsCount` / `programNames` on the parent client doc rejected the entire multi-document transaction—meaning the `programs/{programId}` subdocument was **never persisted**, even while local state and console logs claimed success.

### 2.2 Timeline Metadata vs Legacy Summary Fields vs Empty Programs
- Clients fell into three distinct historical groups:
  1. **Real customers with `PROGRAM_ADDED` Timeline traces** (`25` unique client names observed in Nov 12 logs, e.g., `GC - YAHIATENE SIDAHMED`, `GC - MAACHI AISSA`, etc.) whose `programs/{id}` subcollections failed to commit or were wiped by parent update errors.
  2. **Mobile & Desktop customers carrying `programNames` summaries** (`23` unique client names in Nov 12 logs, including Mobile `GC _ BOUMENDIL ABDELHAMID` and `KHALOUATI boudawed` confirmed by user CSV Request #2 with `Mobile - تطبيق V27`).
  3. **False-positive / phantom summary customers**: Clients marked active with stale `programsCount` or `programNames` despite zero canonical programs and zero Timeline evidence.

### 2.3 Nov 13 Boot & Timeline Sync Storm (`1,282` `BatchGetDocuments` errors)
- `syncCrmServicesToTimeline` looped over `775` CRM services firing unbatched `saveTenantActivity` writes simultaneously, while repeated boot/reconciliation passes overwhelmed Firestore streaming channels.

---

## 3. Reconciliation Engine & 12 Phase 1 Classifications Implemented

`src/business/programReconciliationService.js` has been upgraded with `buildForensicProgramAudit` and enhanced `buildProgramRecoveryDryRun` covering **Mobile, Desktop, Web, Hybrid, and Unknown** platforms and classifying every customer (never skipping `null`, malformed, or empty records) across all **12 required Phase 1 audit classifications**:

1. `CONSISTENT`
2. `PROGRAM_EXISTS_BUT_NOT_VISIBLE`
3. `PROGRAM_EXISTS_IN_SUBCOLLECTION_ONLY`
4. `PROGRAM_EXISTS_IN_SUMMARY_ONLY`
5. `TIMELINE_ONLY_RECOVERY_CANDIDATE`
6. `PROGRAM_MISSING`
7. `DUPLICATE_PROGRAM`
8. `CONFLICTING_PROGRAM_METADATA`
9. `INVALID_CUSTOMER_RELATIONSHIP`
10. `TENANT_MISMATCH`
11. `INSUFFICIENT_RECOVERY_EVIDENCE`
12. `PENDING_MANUAL_REVIEW`

### Audit Metrics Captured (Nov 12 Log Sample vs Live Snapshot)

| Metric | Observed Value (Nov 12 Log Telemetry) | Live Firestore Verification |
|---|---|---|
| Customers Audited in Nov 12 Log | `927` (`getUserData.stats.totalClients` = `959`, drift = `32`) | `BLOCKED_BY_ENVIRONMENT` |
| Customers with Programs / Recoverable Leads in Nov 12 Log | `48` client headers (`25` Timeline trace + `23` `programNames`) | `BLOCKED_BY_ENVIRONMENT` |
| Mobile Programs Confirmed in Nov 12 Log & User CSV | `Mobile - تطبيق V27` (`GC _ BOUMENDIL ABDELHAMID`, `KHALOUATI boudawed`, `KHEDIM Oussama`) | `BLOCKED_BY_ENVIRONMENT` |
| Desktop Programs Confirmed in Nov 12 Log & User CSV | Majority (`Desktop - تجاري V27/V24/V21`, `إنتاجي V23/V24/V27`, `توزيع V27`) | `BLOCKED_BY_ENVIRONMENT` |
| Web Programs Confirmed in Nov 12 Log | `0` logged in Nov 12 failure subset (support repaired in Phase 4) | `BLOCKED_BY_ENVIRONMENT` |
| Failed Commit RPCs / Permission-Denied Subcollections | `242` commits across `23` unique client IDs | `BLOCKED_BY_ENVIRONMENT` |
| Production Recovery Writes Performed in Phase 1 | **`0` (Read-Only Gate Respected)** | `0` |

---

## 4. Safety & Idempotency Rules Enforced

- `buildProgramRecoveryDryRun` and `buildForensicProgramAudit` perform **zero Firestore reads/writes** (`writesPerformed: 0`).
- `reconcileMissingPrograms` only recovers programs backed by complete, verified `meta.program` Timeline evidence (or explicit approved records in Phase 2) via chunked `saveClientSubItemsBatch`, never synthesizes programs from `programNames` or fabricates start/end dates, and cleanses phantom stale summaries on clients with zero programs and zero Timeline evidence.
- Pending Gate: Live Firestore dry-run against `gen-lang-client-0400245577`, full backup export, and Phase 2 recovery require authorized production access and user go-ahead.
