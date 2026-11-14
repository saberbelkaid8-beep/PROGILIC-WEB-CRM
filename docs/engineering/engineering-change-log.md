# Engineering Change Log

**Date:** 2026-11-13  
**Scope:** PROGILIC CRM recovery and persistence remediation

## Changes made

- Replaced speculative historical program recovery writes with a read-only candidate classifier. Complete program snapshots in Timeline metadata may be proposed for review; summaries and prose alone do not become license records.
- Added a strict approval-and-verified-backup gate to legacy Firestore migrations.
- Made data validation preserve canonical records and reject incomplete migration records instead of fabricating IDs, statuses, program fields, or counts.
- Updated customer creation with initial programs and program add/edit/delete to persist before local state or success UI changes.
- Made Firestore errors explicit and propagated to callers.
- Improved IndexedDB queue persistence, retry/error state, per-user isolation, Timeline outbox persistence, and backup read-back verification.
- Prevented restore when its safety snapshot cannot be verified.
- Removed guessed program field defaults from display, export, reporting, and device-count aggregation.
- Routed Trello license items without explicit core facts to review; updated tests to verify that no customer/license is created for incomplete items.
- Preserved explicit `Mobile` platform/application type details in valid Trello license routes and added Mobile metadata regression coverage.
- Added focused tests for persistence errors, local backup verification, no-fabrication behavior, recovery classification, migration gating, and retry handling.
- Added Node/jsdom storage setup and isolated Firestore-dependent test paths from real network calls.
- Fixed stale client-card program badges by preferring present program records over zero summary counts and recalculating statistics after lazy loading; added regression tests.

## Data safety and operational boundaries

- No production database reads or writes were performed.
- No migration or historical recovery was run.
- No production backup was created.
- No deployment, GitHub push, or commit was performed.
- The production data recovery step remains blocked pending authorized source access, backup verification, and explicit approval.

## Known verification caveats

- The final complete test suite passed 337 tests across 46 files.
- The latest focused Timeline, Mobile, recovery, Trello, and core regression suite passed 70 tests across 5 files.
- Lint and dependency integrity passed after those changes.
- The final production build passed; Vite reported existing dynamic/static import chunking warnings.
- Browser E2E and Firebase emulator/cloud behavior remain unverified.

---

## PHASE 0, PHASE 1 & PHASE 4 Engineering Gate Update

**Date:** 2026-11-14  
**Scope:** Sequential execution of `PHASE 0` (Repository & Environment Baseline), `PHASE 1` (Forensic Data Integrity Audit — Read-Only), and `PHASE 4` (Client Creation + Initial Program Workflow & Core Persistence Repair). Execution paused awaiting user signal before `PHASE 5` / `PHASE 2`.

### Changes made in this gate

- **`PHASE 0` Baseline (`docs/engineering/PHASE_0_BASELINE_REPORT.md`):** Recorded environment metadata (`NO_GIT`, Node `v22.23.2`, npm `10.9.8`), linked Firebase config (`gen-lang-client-0400245577` / `ai-studio-a76fe77b-fa2a-40a8-80e2-11da4bb068c7`), `BLOCKED_BY_ENVIRONMENT / REQUIRES_PRODUCTION_ACCESS` live database status, and exact baseline test failures (`45/48` test files passing, `15` test failures across `3` files) plus Vite export warning (`exportLicensedClientsSummary`).
- **`PHASE 1` Forensic Audit (`docs/engineering/PHASE_1_FORENSIC_RECONCILIATION_REPORT.md`, `docs/engineering/historical-recovery-dry-run.json`, `src/business/programReconciliationService.js`):** Audited historical logs (`6,749` lines Nov 12; `14,248` lines Nov 13) and user CSV data across Desktop, Mobile, Web, Hybrid, and Unknown platforms. Added `AUDIT_CLASSIFICATIONS` (12 labels), `buildForensicProgramAudit` (strict read-only `writesPerformed: 0`), `resetReconciliationSession()`, and session-deduplicated batched `reconcileMissingPrograms` + phantom summary cleansing.
- **`PHASE 4` Firestore Transactions & Validation (`src/firebase/service.js`, `src/firebase/validation.js`):**
  - Enforced signed-out `null` return and structured `authInfo` JSON throwing in `handleFirestoreError`.
  - Fixed `addClientTransaction` to read `userRef` via `tx.get` before writing and calculate stats once without double-incrementing.
  - Updated `saveClientSubItemTransaction` and `deleteClientSubItemTransaction` to perform `tx.get(clientRef)` and fall back to `tx.set(..., { merge: true })`.
  - Added chunked `saveClientSubItemsBatch` (chunk size 100) and `saveTenantActivitiesBatch` (chunk size 200).
  - Aligned `validateClient` and `validateProgram` allowlists with `firestore.rules` while retaining strict required-field validation.
- **`PHASE 4` Client Creation, Program & Presentation Workflow (`src/business/actions/clientActions.js`, `src/business/actions/uiActions.js`, `src/utils/index.js`, `src/business/timelineService.js`, `src/presentation/render-modals.js`, `src/presentation/render-views.js`, `src/presentation/render-dashboard.js`):**
  - Fixed `saveClient` to resolve exact `targetId` (preventing duplicate `fullName` mis-selection), support optional Web versions and blank Mobile versions alongside required Desktop versions, format conditional `dateNote`, and keep committed customer/program records intact when Timeline cloud logging fails.
  - Made `saveProgram` / `delProgram` update clients immutably, lazy-load missing subcollections before edits, and enforce permissions.
  - Updated `programTypeOpts` to use `PLATFORM_PROGRAM_TYPES.Web` (preserving `'الويب'`), `updateProgramTypeSelect` version visibility/labels, and added `normalizePlatformName` (`Hybrid -> Desktop`) + `deduplicateClientLicenses` for 100% parity between Dashboard and Licenses Explorer.
  - Guarded `renderDetail` against undefined `issues`/`requirements` arrays, updated `renderList` KPI to use `getProgramStats`, fixed `loadGlobalActivities` discarding session `S.globalActivities`, guarded `Object.hasOwn(firebaseService, 'saveTenantActivitiesBatch')` in `timelineService.js`, added RBAC modal guards (`editProg`/`editProgram`, `editRequirement`/`editReq`, `dbPurge`, `editStaffMember`/`addEmployee`), and exported `exportLicensedClientsSummary`.
- **Regression Tests & Report (`tests/unit/crm-ceo-repair-regression.test.js`, `tests/unit/program-recovery.test.js`, `docs/engineering/PHASE_4_CLIENT_CREATION_REPAIR_REPORT.md`):** Updated selectors (`#f_p_enabled`), mocked transactional service methods, added Mobile/Desktop/Web creation & Timeline survival coverage, Dashboard/Explorer parity coverage, and 12-classification forensic audit unit test.

### Gate Verification & Boundaries

- Zero production Firestore reads, writes, backups, or migrations were executed; zero rules deploys or Git pushes/commits occurred.
- Full automated test suite (`npx vitest run --maxWorkers=2 --reporter=dot --silent`) passed **`48/48` test files (`356/356` tests, `0` failures)**.
- Dependency integrity (`npm run check:integrity` -> `127` files, `0` errors), ESLint (`npm run lint` -> `0` errors), and production build (`npm run build` -> `84` modules, `0` export warnings) passed after all source edits.
- Next gated phases (`PHASE 5` Cloud/Local Sync Integrity, `PHASE 10` Security Preflight, `PHASE 2` Controlled Data Recovery, etc.) remain paused awaiting explicit user authorization.

---

## PHASE 5, PHASE 10, PHASE 9 & PHASE 2 Execution Gate Update

**Date:** 2026-11-14  
**Scope:** Sequential execution of `PHASE 5` (Cloud & Local Sync Repair), `PHASE 10 SECURITY PREFLIGHT` (Security & Tenant Isolation Hardening), `PHASE 9 TARGETED TESTING` (Automated Regression Verification), and `PHASE 2 CONTROLLED DATA RECOVERY` (Missing & Invisible Program Recovery Engine).

### Changes made in this gate

- **`PHASE 5` Cloud & Local Synchronization Repair (`src/business/storage.js`, `src/business/timelineService.js`, `src/business/actions/clientActions.js`, `docs/engineering/PHASE_5_SYNC_INTEGRITY_REPORT.md`):**
  - Added deterministic sync helpers: `mergeSubcollectionWithQueue()` and `mergeClientSyncState()` reconciling remote Firestore snapshots with pending queue mutations.
  - Fixed `startRealtimeSync` to prevent resurrection of deleted clients (`DELETE_CLIENT`) or stale subcollections, preserve offline `ADD_CLIENT` records, and reset `_subcollectionsLoaded = false` when server summary counters or versions change.
  - Fixed `loadClientSubcollectionsIfNeeded` to treat empty remote subcollections as authoritative unless pending local queue operations exist, recompute projections, and persist immutably to IndexedDB.
  - Implemented OCC (Optimistic Concurrency Control): added `baseVersion` to `UPDATE_CLIENT` and `captureGPS` payloads; forwarded `baseVersion` to `updateClientTransaction`; on `VERSION_CONFLICT`, suspended queue to `requires-attention` and opened conflict resolution modal.
  - Updated `resolveConflict('server' | 'local' | 'merge')` to preserve loaded subcollections and persist state, queue, and stats to IndexedDB.
  - Updated `timelineService.js` with `getPendingActivitiesForTenant()` and `mergeActivities()` to merge incoming remote activities with pending local activities without clobbering or duplicating events.
  - Added RBAC guard (`isGerant() || hasPermission('clients.delete')`) and 400-op chunked `writeBatch` deletions to `clearAllData`.
- **`PHASE 10` Security Preflight Hardening (`vite.config.js`, `server.js`, `scripts/postbuild.js`, `firestore.rules`, `firebase-blueprint.json`, `src/business/purgeService.js`, `docs/engineering/PHASE_10_SECURITY_AUDIT_REPORT.md`):**
  - Added `sanitize-dist-artifacts` Vite plugin and post-build audit `sanitizeAndAuditDist()` stripping `dist/assets/aistudio` and dev screenshot PNGs; throws `SECURITY_ARTIFACT_LEAK_IN_DIST` and fails the build if any sensitive telemetry, log, PDF, or markdown file remains in `dist/`.
  - Hardened server static handler: blocked dotfiles, `/assets/aistudio/*`, `*.md`, `*.pdf`, `*.log`, `*.bak`, `*.map`, and `/firebase-applet-config.json` with HTTP 403; added security headers (`X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy: strict-origin-when-cross-origin`, `Cache-Control: no-store` on API routes).
  - Protected API routes: enforced Firebase Bearer token authentication on `/api/ai` and `/api/trello/classify`, 1 MB payload limits, validated prompt inputs, removed query-parameter token fallback on `/api/trello/oauth/start`, and sanitized `returnUrl` against open redirects.
  - Wired `isValidUser(incoming())` and `isValidEmployee(incoming())` in `firestore.rules`; synced `firebase-blueprint.json` with `Activity`, `TrelloSync`, and `TrelloReview` collections.
  - Added RBAC and chunked batch deletion to `purgeService.executePurge()`.
- **`PHASE 2` Controlled Program Recovery Engine (`src/business/programReconciliationService.js`, `docs/engineering/PHASE_2_PROGRAM_RECOVERY_REPORT.md`):**
  - Implemented Scenarios A through E:
    - **Scenario A (`repairProgramProjections`):** Recalculates parent customer summary fields (`programsCount`, `installationsCount`, `programNames`) when canonical programs exist in subcollections without duplicating documents.
    - **Scenario B:** Classifies summary-only customers as `manualReview` with exact missing fields identified, strictly enforcing zero fabrication.
    - **Scenario C (`executeControlledProgramRecovery`):** Restores verified Timeline `meta.program` records; assigns deterministic collision-resistant IDs (`generateDeterministicRecoveryId`) when original IDs are absent; enforces strict pre-flight backup verification (`backupVerified === true && backupSnapshot`) and operator approval (`approved === true`).
    - **Scenario D (`classifyPendingLocalPrograms`):** Protects legitimate pending offline queue operations (`legitimate_unsynced`) from cloud overwrites.
    - **Scenario E:** Restores multiple independent Desktop, Mobile, and Web programs per customer without collision.
  - Created complete 10-column Customer-by-Customer Recovery Table covering 48 forensic candidates and user-provided multi-program records with strictly zero personal contact information.
  - Documented rollback procedures and safety verification checklist.
- **`PHASE 9` Targeted & Full Automated Verification (`tests/unit/phase5-sync-integrity.test.js`, `tests/unit/phase10-security-audit.test.js`, `tests/unit/phase2-controlled-recovery.test.js`, `docs/engineering/PHASE_9_INDEPENDENT_VERIFICATION_REPORT.md`):**
  - Confirmed UI element alignment: verified `#f_p_enabled` and `data-testid="f_p_enabled"` across production modals, actions, and regression tests.
  - Executed full Vitest suite: **51 test files / 381 automated tests passed (100%, 0 failures)**.
  - Verified dependency integrity: **130 files scanned, 0 errors**.
  - Verified production build: **84 modules transformed, 12 clean assets in `dist/` (1.95 MB), zero leaked artifacts**.

### Gate Verification & Operational Boundaries

- **Zero production Firestore database writes performed on live cloud database.** Live database access status remains **`BLOCKED_BY_ENVIRONMENT / REQUIRES_PRODUCTION_ACCESS`** until explicit live credentials and confirmation are supplied.
- **Zero rules deployed to live Firebase; zero commits or pushes to GitHub.**
- Work is paused awaiting explicit operator signal before proceeding to subsequent phases (Phase 3, 6, 7, 8, 11, or 12).


