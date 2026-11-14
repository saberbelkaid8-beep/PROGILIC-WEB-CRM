---
name: progilic-crm-recovery
description: Audit, repair, recover historical program records, and verify PROGILIC CRM before production release.
agent: agent
argument-hint: "Run the full PROGILIC CRM engineering recovery mission in this workspace."
---

# PROGILIC CRM — FULL ENGINEERING RECOVERY & HISTORICAL DATA RESTORATION

## Mission and authority

Act as the Principal Software Architect, Senior Full-Stack Engineer, Firebase/Firestore Engineer, Application Security Engineer, Database Reliability Engineer, and QA Director responsible for recovering this existing PROGILIC CRM repository.

This is an implementation mission, not a review-only exercise. Inspect the actual repository, reproduce defects where possible, modify the actual source code, add or improve tests, run verification, and report evidence. Do not stop after producing recommendations.

Preserve the current architecture and working functionality wherever reasonably possible. Avoid unnecessary rewrites, speculative refactors, and new dependencies unless justified. Treat previous audit reports as leads, not unquestionable truth: independently verify every finding against the current code.

**Main business incident:** when creating a customer from “New Customers” and adding a Desktop, Web, or Mobile program, the customer may appear and the Timeline may show a program-registration event (including platform/version/time), but the program is missing from the Programs list and Dashboard. This inconsistency must be investigated and fixed. Historical programs affected by the same defect must also be investigated for recovery.

## Non-negotiable safety and evidence rules

1. Work only in the opened repository/workspace. Do not deploy, publish, push, or modify a live production database unless the user explicitly authorizes that specific action.
2. Before edits, inspect `git status`, the current branch, and existing user changes. Preserve all pre-existing modifications. Do not run destructive Git commands, reset, clean, or overwrite user work.
3. Prefer an isolated repair branch if Git is available and doing so will not disrupt existing work. Never create a branch by discarding or stashing user changes without asking.
4. Never delete, overwrite, merge, or migrate production records as part of routine code repair.
5. Never run destructive database operations or recovery writes against production. Historical recovery must begin with read-only discovery and a dry-run report. Any live-data write requires an explicit user approval after the dry-run and backup plan are presented.
6. Never weaken Firebase/Firestore/Storage security rules to make features work.
7. Never expose credentials, tokens, service-account keys, customer secrets, or private data in logs, reports, screenshots, or commits.
8. Never claim a fix, test, backup, migration, recovery, or security guarantee unless it was actually implemented and verified. Mark unavailable checks as BLOCKED, not PASS.
9. Never fake success, replace real persistence with mocks, suppress errors, or use hardcoded counters/statuses to make the UI look correct.
10. Never silently discard queued writes, failed operations, or historical records.
11. Do not invent missing historical program values. Preserve unknown fields as unknown and flag records needing manual review.
12. Ask for approval only when a genuinely consequential action requires it (especially production data writes, destructive migrations, deployment, or remote push). Continue all safe local work without waiting unnecessarily.

## Phase 0 — Repository discovery and baseline

Before changing code:

- Inspect the complete folder structure, package manifests, scripts, framework, language, build system, routing, state management, and dependency versions.
- Identify Firebase products in use: Authentication, Firestore, Storage, Functions, Hosting, Emulator Suite, and any other services.
- Locate all customer, program/license, Timeline, employee, permissions, sync, backup, import/export, dashboard, and reporting modules.
- Trace data access layers, Firestore collections/subcollections, schema versions, indexes, and security rules.
- Inspect existing tests and previous audit/remediation documents. Search for `CRM_EXECUTIVE_AUDIT_REPORT_AR.md`, `report.md`, `security_spec.md`, `SYSTEM_INTEGRATION_AND_OPERATIONS.md`, and other audit artifacts if present. Do not assume they exist; discover actual files.
- Inspect `.env` files only to identify variable names and configuration shape. Do not print or reveal secret values. Do not copy secrets into reports.
- Run only safe baseline commands available from the project scripts. Record exact commands and outputs.
- Record existing failures separately from failures introduced by your work.

Create or update a concise working checklist in `docs/engineering/` if suitable. Do not create redundant documentation if the repository already has an equivalent structure.

## Phase 1 — P0 incident: customer + program registration

Trace the complete flow from UI to durable persistence and back:

- New Customer form and validation.
- Customer creation service/repository.
- Program/license form and normalization.
- Firestore writes, transactions, batches, and subcollections.
- Optimistic state updates.
- Sync queue and retry handling.
- Timeline event creation.
- Customer detail loader.
- Programs list and license explorer.
- Dashboard aggregation and counters.
- Recovery/reconciliation code.

Search for names and concepts such as `programs`, `programNames`, `programsCount`, `PROGRAM_ADDED`, `getProgramStats`, `progStatusLabel`, `idbStorage`, and `storage`, but verify the actual implementation and do not rely on presumed filenames or function names.

Determine the actual root cause(s), including whether different screens use different sources of truth (embedded arrays, subcollections, cached state, Timeline events, or denormalized summaries).

### Required target behavior

For every successful customer-program registration:

1. The customer record is durably saved.
2. The program/license record is durably saved.
3. The customer-program relationship references stable IDs.
4. Platform, version, registration time, and license fields are preserved correctly.
5. The Timeline event references the actual persisted program record and is created only after, or atomically with, successful persistence.
6. The same program appears consistently in the Programs list, Dashboard, customer details, and license explorer.
7. Data remains consistent after navigation, full reload, and reauthentication.
8. Retries do not create duplicate program records or duplicate Timeline events.

Prefer an atomic Firestore transaction or batch where the existing data model supports it. If the workflow cannot be atomic, use a durable, recoverable operation/outbox design with explicit states and idempotency. Do not report success before durable persistence is confirmed.

Verify support for Desktop, Web, and Mobile. Inspect customer-status rules: do not unnecessarily block program registration solely because a customer is prospective/new/inactive unless a documented business rule requires it. Enforce any real business rule consistently in UI and backend.

## Phase 2 — Historical program discovery and recovery (mandatory P0)

A code fix alone is NOT historical recovery. Investigate old registrations that were added previously but are missing from Programs/Dashboard.

### Read-only discovery sources

Inspect every source available in the current environment, including:

- Firestore customer documents.
- Firestore program/license subcollections.
- Timeline/audit events, especially program-registration events.
- Legacy embedded program arrays and summary fields such as `programNames` and `programsCount` if present.
- Durable sync/outbox records.
- IndexedDB and LocalStorage only where accessible and relevant.
- Existing exports, backups, migration logs, and legacy schemas.

Do not assume browser-local data is accessible from the current tool environment. Clearly identify sources you could and could not inspect. Do not fabricate findings.

### Classify each candidate

For each historical registration candidate, distinguish:

A. Program record exists but a screen does not display it.
B. Program exists in a subcollection but is missing from an embedded summary/projection.
C. Program is represented only by a Timeline event with sufficient reconstruction fields.
D. Registration is incomplete or was never durably saved.
E. Timeline event duplicates an existing program.
F. Insufficient or ambiguous evidence; manual review required.

Use stable IDs and verified relationships. Do not identify distinct licenses only by program name + platform + version. Similar-looking records may be legitimate separate licenses.

### Dry-run recovery report — required before any writes

Create a machine-readable report (JSON or CSV as appropriate) and a human-readable summary. For each candidate include, where available:

- Customer ID and customer display name (avoid exposing unnecessary personal data).
- Existing program/license ID, if any.
- Candidate program name, platform, version, and original timestamp.
- Expiry/status/license fields and whether each value is verified or unknown.
- Evidence source(s) and source event ID.
- Confidence level and classification (A–F above).
- Proposed action: no change, repair projection, recover record, deduplicate event, or manual review.

No historical data may be modified until the dry-run has been reviewed and a verified backup/rollback strategy exists. For production data, ask the user for explicit approval before executing any write. If no production credentials or data access exist, implement and test the recovery tool against fixtures/emulator and clearly document that live recovery remains BLOCKED.

### Safe recovery requirements

- Make recovery idempotent and resumable.
- Preserve original timestamps and known fields.
- Preserve existing valid records and IDs whenever possible.
- Create missing records only when evidence and identity are sufficient.
- Do not invent missing fields.
- Repair derived counters/projections from canonical records, not from unverified Timeline counts.
- Preserve historical Timeline records; do not generate duplicate success events during recovery.
- Log every proposed and executed action, with safe identifiers and outcome.
- Provide a rollback/compensation plan where possible.

### Post-recovery verification

For each recovered or repaired record verify the Programs list, customer detail, Dashboard, license explorer, stable customer relationship, original timestamp, and persistence after reload. Report totals for discovered, already-existing-but-hidden, successfully recovered, duplicates, incomplete, unrecoverable, and manual-review records. Do not mark live recovery PASS if it was only simulated in tests.

## Phase 3 — Canonical database integrity

Document the actual canonical source of truth for customers, programs/licenses, customer-program relationships, Timeline events, employees, tenants/owners, and denormalized summaries.

Investigate orphaned records, missing references, duplicate IDs, malformed platform values, missing timestamps, stale counters, conflicting summaries, soft deletion, concurrent writes, and race conditions.

Use one consistent repository/data-access contract for all screens. If subcollections are canonical, every screen that needs program details must read through the shared repository or a verified projection; do not mix incompatible sources without a documented synchronization contract.

Migrations must be additive where possible, idempotent, resumable, tested against representative legacy fixtures, and reversible where technically feasible. Never silently discard historical data. Do not merge records based solely on matching display attributes.

## Phase 4 — Synchronization and offline reliability

Audit queue persistence, IndexedDB, LocalStorage, retry policy, network failures, authentication expiration, permission errors, validation failures, duplicate requests, and page reload behavior.

Implement durable operation storage when the product promises offline/retry behavior. Each queued operation should have a stable operation ID, entity ID, type, payload, creation time, state, attempt count, last error, and idempotency strategy. Use bounded exponential backoff for retryable failures.

Differentiate retryable failures (network/temporary server errors) from permanent failures (invalid data/permission denied). Never drop a failed operation silently. Expose meaningful states such as Synced, Pending, Syncing, Failed, and Requires attention. Reauthentication must not cause duplicate writes.

## Phase 5 — Timeline and audit trail

Audit every event-producing action: customer create/update/archive, program add/update/remove, renewal, expiration, payment, task, and employee actions where applicable.

Every event must use stable entity IDs, actor identity, accurate timestamps, and a clear operation outcome. Prevent duplicates with stable event IDs/idempotency keys. Do not solve duplicates by hiding them in the UI while retaining duplicate database events. Preserve existing history and distinguish attempted, pending, failed, and completed operations where the model supports them.

## Phase 6 — Programs and license lifecycle

Verify lifetime, time-limited, active, expired, suspended, revoked, renewal, version change, platform change, and multiple-license scenarios according to actual product rules.

Derive status from canonical lifecycle fields and dates using consistent timezone handling. Do not hardcode every license as active/lifetime. Dashboard counts and license lists must share the same calculation. Use stable IDs for license identity; do not deduplicate solely by name/platform/version.

## Phase 7 — Dashboard and reporting

Audit total/new/active/inactive customers, total programs, programs by platform, active/expired licenses, revenue/payments if implemented, pending operations, and recent activity.

Verify dashboard totals against detailed lists and canonical persisted records. Check filters, pagination, empty/loading/error states, realtime listener cleanup, and stale/failed requests. A failed data request must not silently appear as a legitimate zero count. Never use fake or hardcoded values.

## Phase 8 — Security, authentication, and employee permissions

Inspect Firebase Authentication, Firestore/Storage security rules, employee identities, role model, ownership/tenant isolation, session handling, sensitive data, administrative operations, and any custom password handling.

Client-side UI checks are not security boundaries. Verify authorization at Firestore rules and/or trusted server-side functions. Test direct API access, privilege escalation, cross-tenant access, unauthorized reads/writes/deletes, logout, and expired sessions.

If the current implementation uses a shared owner Firebase session plus locally stored employee roles, assess the risk and design a safe migration that preserves legitimate workflows. Inspect password storage; a single SHA-256 hash is not an appropriate password-storage design. Prefer Firebase Authentication or a properly designed password hashing mechanism such as Argon2id/scrypt where custom authentication is genuinely required. Never store plaintext passwords.

Do not weaken security rules. If real Firebase credentials/emulator access are unavailable, add rules/tests and mark live authorization verification BLOCKED rather than claiming it passed.

## Phase 9 — Backup, restoration, and local storage

Inspect every backup/restore path and every IndexedDB abstraction. Verify that persistence functions truly write and read bytes/records; a no-op returning success is a critical defect.

Backups must contain schema/version metadata, required records, and relationship information. Verify the write before reporting success. Restore must validate the backup, check compatibility, detect conflicts, avoid duplicates, preserve relationships, protect existing data, and report actual outcomes.

Test backup/restore with representative fixtures or an emulator. Distinguish browser cache, local backup, and cloud backup. Do not claim a cloud backup exists if only local browser storage is used.

## Phase 10 — Whole-application functional audit

Inspect all modules that actually exist in this repository, including Dashboard, Customers, New Customers, customer detail, Programs, Licenses, Payments, Tasks/Reminders, Timeline, Employees, Permissions, Settings, Search, Filters, Imports/Exports, Backup/Restore, Notifications, Sync, and integrations.

For each relevant module verify create/read/update/delete-or-archive, validation, loading/error/empty states, permissions, persistence, realtime behavior, responsive layout, and cross-module consistency. Do not assume a UI rendering means the feature works.

## Phase 11 — Performance and maintainability

Inspect duplicated business logic, unnecessary reads/listeners, memory leaks, oversized components, excessive re-renders, unbounded queries, missing indexes, race conditions, dependency risk, and inconsistent error handling. Improve only where justified and avoid needless architecture complexity.

## Phase 12 — Test and verification strategy

Use the repository's existing tooling wherever possible. Add tests where coverage is missing.

- Static: syntax, lint, type checks, dependency consistency, build.
- Unit: normalization, aggregation, license status/date rules, permissions, idempotency, migrations.
- Integration: customer + program persistence, Firestore writes, Timeline, sync, IndexedDB, backup/restore, failure recovery.
- E2E: actual UI workflows using the existing framework or Playwright if appropriate.
- Security: Firestore rules/emulator tests and authorization edge cases.
- Regression: all major workflows affected by shared services/data contracts.

Use Firebase Emulator Suite for safe integration/migration/recovery tests when available. Never substitute mocks for real integration verification without labeling the test as mocked. Do not run destructive tests against production.

### Mandatory end-to-end acceptance scenario

1. Create a new customer from New Customers.
2. Add a Desktop program and version during creation.
3. Save and verify customer and program persistence.
4. Verify the program in Programs list, Dashboard, customer details, and license explorer.
5. Verify exactly one Timeline event references the persisted program ID.
6. Reload the app and repeat the checks.
7. Reauthenticate and repeat the checks.
8. Repeat for Web and Mobile.
9. Simulate network failure, reload, reconnect, and verify the operation is not lost or duplicated.
10. Verify invalid/unauthorized writes are rejected and visibly reported.

## Execution order and working protocol

Execute the work in this order, while continuing safe tasks without unnecessary pauses:

1. Inspect repository, Git state, configuration shape, and baseline.
2. Reproduce and document the customer/program incident.
3. Perform read-only historical data discovery and produce the dry-run report.
4. Prioritize findings P0/P1/P2/P3.
5. Implement the smallest safe source-code corrections, beginning with data integrity and registration.
6. Implement durable sync, Timeline integrity, license/dashboard consistency, security, and backup fixes as supported by the architecture.
7. Add tests and run them.
8. Test historical recovery in fixtures/emulator; do not write to production without explicit approval.
9. Run regression checks and build.
10. Document all changes and unresolved items.

For a large task, work in coherent milestones and maintain a checklist so context limits or interruptions do not lose the plan. Do not stop at the end of the audit phase. If a blocker prevents a specific task, continue with the remaining safe work and explain the blocker precisely.

## Required deliverables

Create/update documentation under an appropriate existing documentation folder (or `docs/engineering/` if none exists):

1. Executive audit summary and severity-ranked findings.
2. Root-cause analysis with exact files/functions and evidence.
3. Engineering change log listing every modified file and reason.
4. Database/schema/migration report and rollback plan.
5. Historical recovery dry-run report and, only if authorized and performed, execution report.
6. Security findings, rule changes, and verification results.
7. Test report with exact commands, results, failures, and skipped/blocked checks.
8. Acceptance matrix with PASS / PARTIAL / FAIL / BLOCKED / NOT APPLICABLE.
9. Remaining risks and required actions.
10. Final production-readiness decision.

### Definition of done

A criterion is PASS only when supported by actual evidence. Use:

- PASS — implemented and verified.
- PARTIAL — implemented but incompletely verified.
- FAIL — not working.
- BLOCKED — unavailable infrastructure/credentials/approval prevents verification.
- NOT APPLICABLE — justified.

The final acceptance matrix must cover customer registration, Desktop/Web/Mobile, Programs list, Dashboard, customer details, Timeline uniqueness, reload persistence, reauthentication, sync recovery, duplicate prevention, license expiration, server-enforced permissions, Firestore rules, IndexedDB persistence, backup, restore, build, automated tests, and regression.

Choose exactly one release verdict:

1. READY FOR PRODUCTION — all critical criteria pass.
2. READY WITH RESTRICTIONS — only explicitly documented non-critical limitations remain.
3. NOT READY FOR PRODUCTION — at least one critical requirement failed or remains unverified.

A successful frontend build alone is never sufficient for production readiness.

## Start now

Begin by inspecting the real workspace and Git status. Then carry out the mission in the sequence above. Make the necessary safe code changes in the actual project, run the available verification, recover historical programs only through the read-only/dry-run/approved process, and deliver an evidence-based report. Do not finish with recommendations alone.
