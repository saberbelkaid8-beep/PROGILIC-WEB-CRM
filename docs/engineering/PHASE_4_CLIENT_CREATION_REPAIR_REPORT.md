# PHASE 4 — Original Client Creation + Initial Program Workflow Repair Report

**Project:** PROGILIC CRM v3  
**Phase:** PHASE 4 — Repair the Original Client Creation Workflow & Core Persistence  
**Date:** 2026-11-14  
**Status:** `FIXED_AND_VERIFIED` (Repository, Unit/Integration Suite & Production Build) / `BLOCKED_BY_ENVIRONMENT` (Live Firestore & Browser E2E)

---

## 1. Phase Objective & Defect Summary

Trace and repair the entire customer creation + initial program workflow (and related core persistence, validation, error visibility, dashboard/explorer parity, and modal RBAC paths) from UI form initialization through Firestore transactions, local store updates, Timeline logging, and view re-rendering across **Desktop**, **Mobile**, and **Web**.

---

## 2. Inspected Modules & Root Causes Identified

| Module | Root Causes Found |
|---|---|
| `src/presentation/render-modals.js` | Initial program section used `#f_p_enabled` and `#f_p_*` inputs (`data-testid` attributes missing on some fields; optional program start/end date inputs `#f_p_sd`/`#f_p_ed` missing); `renderLicensesExplorerModal` and list/card badges did not share a unified license deduplicator & platform normalizer (`Hybrid -> Desktop`). |
| `src/utils/index.js` | `programTypeOpts` returned hardcoded `['الويب']` instead of `PLATFORM_PROGRAM_TYPES.Web`; `updateProgramTypeSelect` did not consistently differentiate Desktop (version required `*`), Mobile (version hidden & cleared), and Web (version optional); no shared `normalizePlatformName` / `deduplicateClientLicenses` helpers existed. |
| `src/business/actions/clientActions.js` | (1) Post-create selection looked up `clients.find(c => c.fullName === fn)?.id`, selecting the wrong client whenever duplicate `fullName` values existed. (2) `saveClient` computed `stats` before calling `addClientTransaction`, and `addClientTransaction` incremented `stats` a second time. (3) Initial Web program creation/editing required `version`. (4) `saveClient` concatenated ` (البداية: ).` even when `prg.startDate` was empty. (5) `saveProgram`/`delProgram` mutated `c.programs` in place instead of cloning immutably, skipped lazy-loading subcollections in `saveProgram`, and did not wrap Timeline logging safely when cloud audit sync failed after transaction commit. |
| `src/firebase/service.js` | (1) `handleFirestoreError` lacked clean signed-out `null` handling and structured JSON `authInfo` error throwing. (2) `addClientTransaction` updated `userRef` without reading `userRef` via `tx.get` first and double-incremented pre-mutated `globalStats`. (3) `saveClientSubItemTransaction` / `deleteClientSubItemTransaction` called `tx.update` unconditionally without `tx.get(clientRef)` or `tx.set(..., { merge: true })` fallback. (4) Lacked chunked batch helpers `saveClientSubItemsBatch` (100 entries) and `saveTenantActivitiesBatch` (200 entries) needed to prevent Nov 13 boot/sync storms. |
| `src/firebase/validation.js` | `validateClient` and `validateProgram` rejected or stripped legitimate CRM and Trello metadata (`trelloCardId`, `trelloSyncStatus`, `category`, `commune`, `programNames`, `source`, `trelloChecklistItemId`, `lastModifiedBy`, `notes`) permitted by `firestore.rules`. |
| `src/business/timelineService.js` | `syncCrmServicesToTimeline` sent unbatched single-doc writes (`775` RPCs in Nov 13 logs), `loadGlobalActivities` discarded in-memory session activities (`inMemActivities = []`), causing duplicate sync passes in a single boot session, and missing `saveTenantActivitiesBatch` checks could trigger strict partial mock traps. |
| `src/business/actions/uiActions.js` & `src/main.js` | `openModal` lacked permission checks for `editProg`/`editProgram`, `editRequirement`/`editReq`, `dbPurge`, and `editStaffMember`/`addEmployee`; `exportLicensedClientsSummary` referenced in `src/main.js` was not exported from `uiActions.js` / `actions.js`. |
| `src/presentation/render-views.js` & `src/presentation/render-dashboard.js` | `renderDetail` threw `TypeError` when `c.issues` or `c.requirements` were undefined on partial/legacy records; tab counts showed stale summary counts after subcollections loaded; `renderList` KPI used raw `.length` instead of `getProgramStats`; `renderDashboard` counted raw programs instead of deduplicated, normalized licenses matching `renderLicensesExplorerModal`. |
| `src/business/programReconciliationService.js` | Legacy stub lacked `resetReconciliationSession()`, batched recovery, phantom summary cleansing, `writesPerformed: 0` guarantee on audit paths, and complete 12-class Phase 1 audit output. |

---

## 3. Changes Implemented (Phase 4 & Supporting Fixes)

1. **Client Creation + Initial Program Transaction & Identity (`src/business/actions/clientActions.js`, `src/firebase/service.js`)**:
   - `saveClient` builds `newClient` cleanly with `_subcollectionsLoaded: true`, validates Desktop (`version` required), Mobile (`version = ''`), and Web (`version` optional) plus positive integer `installationsCount`, passes raw `baseStats` to `addClientTransaction` (single authoritative increment inside `runTransaction`), commits atomically (`clients/{id}`, `programs/{progId}`, and `users/{uid}` read-then-write), updates store immutably, selects `targetId = clientEditId !== null ? clientEditId : createdClientId` (immune to duplicate `fullName`), formats `dateNote` conditionally, and wraps `logActivity` in `try/catch` so Timeline network failures trigger a warning toast without deleting or rolling back committed customer/program records.
2. **Program Add / Edit / Delete Immutability & Persistence (`src/business/actions/clientActions.js`, `src/firebase/service.js`)**:
   - `saveProgram` ensures subcollections are loaded before mutating, enforces `programs.create` / `programs.edit` permissions, keeps Web versions optional and Mobile versions blank, persists via `saveClientSubItemTransaction`, replaces the client object immutably (`clients.map(...)`), and preserves committed licenses on Timeline retry warnings.
   - `delProgram` enforces `programs.delete`, persists via `deleteClientSubItemTransaction`, updates store immutably, and logs idempotent `PROGRAM_DELETED` events.
   - `saveClientSubItemTransaction` and `deleteClientSubItemTransaction` perform `tx.get(clientRef)` before writes and fall back to `tx.set(..., { merge: true })` if `tx.update` is absent in test/transaction doubles.
   - Added chunked `saveClientSubItemsBatch` (chunk size 100) and `saveTenantActivitiesBatch` (chunk size 200) and strict `handleFirestoreError`.
3. **Validation Alignment (`src/firebase/validation.js`)**:
   - Aligned `validateClient` and `validateProgram` allowlists with `firestore.rules` so CRM & Trello fields are preserved without loosening required status/ID/platform/type invariants.
4. **Platform Selectors, Utils & Modal Form (`src/utils/index.js`, `src/presentation/render-modals.js`)**:
   - `programTypeOpts` returns `PLATFORM_PROGRAM_TYPES[platform]` (preserving legacy `'الويب'` when selected); `updateProgramTypeSelect` hides/clears version for `Mobile`, marks version required (`*`) for `Desktop`, and marks version `(اختياري)` for `Web`.
   - Added optional `#f_p_sd` / `#f_p_ed` and `data-testid` attributes in `renderClientModal` / `renderProgramModal` while keeping `#f_p_enabled` unchecked by default.
   - Added `normalizePlatformName` (`Hybrid -> Desktop`) and `deduplicateClientLicenses` (`deduplicated` platform/key aggregation).
5. **Views, Dashboard Parity, Timeline & Modal RBAC (`src/presentation/render-views.js`, `src/presentation/render-dashboard.js`, `src/business/timelineService.js`, `src/business/actions/uiActions.js`)**:
   - Guarded `renderDetail` against missing `issues`/`requirements` arrays, preferred canonical subcollection counts after `_subcollectionsLoaded`, and updated `renderList` KPI to use `getProgramStats`.
   - Updated `renderDashboard` to use `deduplicateClientLicenses` and `normalizedPlatform`, achieving 100% platform/total parity with `renderLicensesExplorerModal`.
   - Updated `loadGlobalActivities` to retain in-memory `S.globalActivities` and safely guard `Object.hasOwn(firebaseService, 'saveTenantActivitiesBatch')` before calling batch upload inside `syncCrmServicesToTimeline`.
   - Added RBAC guards in `openModal` (`editProg`/`editProgram`, `editRequirement`/`editReq`, `dbPurge`, `editStaffMember`/`addEmployee`) and exported `exportLicensedClientsSummary` (resolving the `src/main.js` Vite build warning).
6. **Regression Coverage (`tests/unit/crm-ceo-repair-regression.test.js`, `tests/unit/program-recovery.test.js`)**:
   - Updated `#f_add_init_prog` -> `#f_p_enabled`, mocked transactional `service.js` exports, added independent creation & persistence tests across **Mobile**, **Desktop**, and **Web**, tested Timeline-failure survival, tested duplicate-name exact ID selection, tested `Hybrid` normalization & Dashboard/Explorer parity, and added unit coverage across all 12 `AUDIT_CLASSIFICATIONS`.

---

## 4. Verification Evidence (Code & Local Suite)

- **Full Automated Test Suite:** `npx vitest run --maxWorkers=2 --reporter=dot --silent` -> **PASS (`48/48` test files, `356/356` tests, `144.69s`, `0` failures)** (baseline was `45/48` passing / `3` failing with `15` failed tests).
- **Focused 5-File Regression Suite:** `npx vitest run tests/unit/boot-sync-storm-regression.test.js tests/unit/timeline.test.js tests/unit/crm-ceo-repair-regression.test.js tests/unit/program-recovery.test.js tests/unit/firebase.test.js` -> **PASS (`5/5` files, `40/40` tests)** (including `11/11` in `crm-ceo-repair-regression.test.js` and `7/7` in `program-recovery.test.js`).
- **ESLint / Rules Linting:** `npm run lint` (`eslint .`) -> **PASS (`0` errors)**.
- **Dependency & Module Integrity:** `npm run check:integrity` -> **PASS** (`127` files scanned, `0` phantom dependencies).
- **Production Bundle:** `npm run build` -> **PASS** (`84 modules transformed`, `12.90s`, `0` `exportLicensedClientsSummary` warnings).

---

## 5. Remaining Limitations & Next Gate

- Live Firestore transactional round-trips against `gen-lang-client-0400245577`, Firestore Security Rules execution in emulator/cloud, and live browser reload E2E verification across Desktop/Mobile/Web remain **`BLOCKED_BY_ENVIRONMENT / REQUIRES_PRODUCTION_ACCESS`** (no local Firebase/gcloud credentials or Java emulator binary).
- Offline-to-online sync merge conflict resolution in `src/business/storage.js` (`PHASE 5`) and subsequent phases await user signal to continue.
