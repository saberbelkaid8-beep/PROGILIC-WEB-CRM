# PHASE 0 — Repository & Environment Baseline Report

**Project:** PROGILIC CRM v3  
**Phase:** PHASE 0 — Repository and Environment Baseline  
**Audit Date:** 2026-11-14  
**Execution Scope:** Read-only repository discovery, tooling verification, baseline tests, and static/runtime architecture inspection. Zero production reads/writes performed.

---

## 1. Environment & Repository Metadata

| Property | Verified Value | Evidence / Source |
|---|---|---|
| Workspace Root | `/app/applet` | Local filesystem check |
| Git Repository / Branch / Commit | `NO_GIT` (not a Git checkout; no `.git` directory or commit history present) | Directory / CLI verification |
| Node.js Version | `v22.23.2` | `node -v` |
| NPM Version | `10.9.8` | `npm -v` |
| Dependency Status | Installed in `node_modules/` (`package-lock.json` present) | `package.json`, `node_modules/` |
| Firebase Project ID | `gen-lang-client-0400245577` | `.firebaserc`, `firebase-applet-config.json` |
| Firestore Database ID | `ai-studio-a76fe77b-fa2a-40a8-80e2-11da4bb068c7` | `firebase-applet-config.json` |
| Firebase Environment Type | Production config linked in repo (`firebase-applet-config.json`); no local Firebase auth credentials; no Java runtime for Firestore Emulator (`java: not found`) | CLI check |
| Production Firestore Access | **`BLOCKED_BY_ENVIRONMENT / REQUIRES_PRODUCTION_ACCESS`** | `firebase projects:list` unauthenticated (`NO_LOCAL_FIREBASE_OR_GCLOUD_AUTH`) |
| Playwright Browser Binaries | Not installed in `~/.cache/ms-playwright` | Local environment check |

---

## 2. Baseline Verification Commands (Before Any Phase 1/4 Edits)

| Check | Command | Baseline Status | Notes |
|---|---|---|---|
| Dependency & Module Integrity | `npm run check:integrity` | **PASS** | 127 project files validated with 0 broken imports or missing assets |
| ESLint / Rules Linting | `npm run lint` | **PASS** | `eslint .` exited 0 |
| Production Bundle | `npm run build` | **PASS (with warning)** | Built cleanly via `vite build`, emitting warning: `src/main.js (100:48): "exportLicensedClientsSummary" is not exported by "src/business/actions.js"` |
| Unit & Integration Test Suite | `npx vitest run` | **FAIL (45 passed / 3 failed test files; 339 passed / 15 failed tests)** | Out of 48 test files (354 total tests), 3 files failed due to incomplete/unaligned Nov 13 remediation state |

### Baseline Test Failure Breakdown (`3 files / 15 tests`)

1. **`tests/unit/crm-ceo-repair-regression.test.js` (10 failures):**
   - Imports missing `resetReconciliationSession` from `src/business/programReconciliationService.js`.
   - Test fixture uses legacy checkbox ID `#f_add_init_prog` while production UI (`render-modals.js`) and `clientActions.js` use `#f_p_enabled`.
   - Test asserts legacy queued `enqueueSyncAction('ADD_CLIENT' / 'DELETE_SUB_ITEM')` while production `clientActions.js` uses synchronous Firestore transactions (`addClientTransaction` / `deleteClientSubItemTransaction`) without mocking `service.js`.
   - `saveProgram` rejects `Web` programs without version (`platform !== 'Mobile' && !version`), whereas Web versions should be optional.
   - `saveProgram` / `delProgram` mutate client objects in place (`c.programs = nextProgs`) before `setClients([...clients])`, failing immutability assertions.
   - `validateClient` / `validateProgram` strip or reject valid Trello/CRM metadata permitted in `firestore.rules`.
   - `handleFirestoreError` lacks signed-out `null` handling and SKILL.md `authInfo` JSON error formatting.
   - `reconcileMissingPrograms` lacks `{ reconciledCount }`, batched recovery writes, and phantom summary cleansing.
   - Dashboard and Licenses Explorer mismatch on duplicate licenses and `Hybrid -> Desktop` normalization.
   - `openModal` misses RBAC checks for `'editProgram'`, `'editReq'`, `'dbPurge'`, and `'addEmployee'`.
2. **`tests/unit/boot-sync-storm-regression.test.js` (2 failures):**
   - `resetReconciliationSession`, `saveClientSubItemsBatch`, and `saveTenantActivitiesBatch` do not exist yet.
   - `reconcileMissingPrograms`, `syncCrmServicesToTimeline`, and `loadGlobalActivities` do not deduplicate concurrent invocations or use chunked batch commits.
3. **`tests/unit/firebase.test.js` (3 failures):**
   - `saveTenantActivitiesBatch` and `saveClientSubItemsBatch` are not exported from `src/firebase/service.js`.
   - `saveClientSubItemTransaction` calls `tx.update` unconditionally (missing from `mockTxOps`) and fails to read `clientRef` via `tx.get`.

---

## 3. Baseline Source & Architecture Inventory

| Layer | Inspected Files | Key Baseline Findings |
|---|---|---|
| Entry & Bootstrap | `src/main.js`, `index.html`, `package.json`, `vite.config.*` | Exposes `actions.exportLicensedClientsSummary` (undefined), initializes auth/storage/listeners on sign-in |
| Firebase & Security Rules | `src/firebase/config.js`, `src/firebase/service.js`, `src/firebase/validation.js`, `firestore.rules` | Named DB configured; `addClientTransaction` double-increments `stats` and uses `tx.update(userRef)` without `tx.get`; `validation.js` out of sync with `firestore.rules` allowlists |
| Business & Actions | `src/business/actions.js`, `src/business/actions/clientActions.js`, `src/business/actions/uiActions.js` | `saveClient` selects `clients.find(c => c.fullName === fn)?.id` on line 522 (wrong client on duplicate names), hardcodes empty program dates, blocks Web without version, and contains `(البداية: ).` formatting bug |
| Storage, Sync & Timeline | `src/business/storage.js`, `src/business/timelineService.js`, `src/business/programReconciliationService.js`, `src/business/mergeDatabase.js` | `syncCrmServicesToTimeline` fires unbatched individual `saveTenantActivity` writes; `reconcileMissingPrograms` is a basic stub without session dedup or batched commit; Nov 12–13 forensic logs confirm production `Commit` (`permission-denied`) and `BatchGetDocuments` failures |
| Presentation & Utils | `src/presentation/render-modals.js`, `src/presentation/render-views.js`, `src/presentation/render-dashboard.js`, `src/utils/index.js` | `programTypeOpts` returns `['الويب']` instead of `PLATFORM_PROGRAM_TYPES.Web`; Dashboard counts differ from Licenses Explorer; List KPI uses raw `.length` instead of `getProgramStats` |
| Engineering Docs | `docs/engineering/*` | Nov 13 change log claimed `337` passing tests across `46` files; subsequent regression test additions (`boot-sync-storm-regression.test.js`, `crm-ceo-repair-regression.test.js`, `firebase.test.js` additions) exposed unimplemented fixes |

---

## 4. Operational Boundaries Respected

- No live Firestore database reads, writes, migrations, or backups were executed against `gen-lang-client-0400245577`.
- No Firebase rules deployment, hosting deployment, or Git push was executed.
- All historical findings in Phase 1 rely strictly on verified repository source code, existing artifacts, and user-provided production logs (`Paste November 12, 2026 - 4:24PM`, `Paste November 13, 2026 - 1:29PM`, CSV export in conversation history).
