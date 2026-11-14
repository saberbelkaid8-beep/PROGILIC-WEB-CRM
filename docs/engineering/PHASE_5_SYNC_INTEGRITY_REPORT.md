# PHASE 5 — Cloud & Local Synchronization Integrity Report

**Project:** PROGILIC CRM v3  
**Phase:** PHASE 5 — Cloud & Local Synchronization Repair  
**Date:** 2026-11-14  
**Scope:** Real-time Firestore snapshot reconciliation, subcollection authoritative hydration, offline sync queue protection, optimistic concurrency control (`baseVersion`), and Timeline activity convergence.

---

## 1. Root-Cause Findings Resolved

| # | Defect Location | Root Cause | Implemented Repair |
|---|---|---|---|
| 1 | `src/business/storage.js` (`startRealtimeSync` -> `unsubClients`) | `finalProgs` unconditionally preferred `existingC.programs` over newer cloud summaries, forced `_subcollectionsLoaded: true` on partial parent summaries, resurrected clients queued for `DELETE_CLIENT`, and dropped offline `ADD_CLIENT` records when `summaries.length > 0`. | Added deterministic `mergeClientSyncState()` and `mergeSubcollectionWithQueue()` reconciling remote summaries with active `S.syncQueue` (`pending`, `syncing`, `requires-attention`, `failed`) operations, preventing resurrection of deleted clients/programs, preserving offline creates, and resetting `_subcollectionsLoaded = false` when another session updates subcollection summaries or version. |
| 2 | `src/business/storage.js` (`loadClientSubcollectionsIfNeeded`) | Kept stale `c.programs` whenever `remoteProgs.length === 0`, mutated `c` in place, and ignored pending queue mutations. | Immutable state update via `mergeSubcollectionWithQueue()` treating remote empty arrays as authoritative unless pending `SAVE_SUB_ITEM`/`ADD_CLIENT` ops exist, syncing `programsCount` / `installationsCount` / `programNames`, and persisting to IndexedDB (`saveClients`). |
| 3 | `src/business/storage.js` (`unsubActivities`) & `src/business/timelineService.js` | `S.globalActivities = remoteActivities` discarded unsynced in-memory pending Timeline events during incoming snapshots. | Exported `getPendingActivitiesForTenant()` and `mergeActivities()`, merging remote Firestore activities with pending local events deduplicated by `id`. |
| 4 | `src/business/actions/clientActions.js` (`saveClient`, `captureGPS`) & `src/business/storage.js` (`flushSyncQueue`, `resolveConflict`) | `UPDATE_CLIENT` omitted `baseVersion`, and `flushSyncQueue` omitted the 6th `baseVersion` argument when calling `updateClientTransaction`, disabling OCC `VERSION_CONFLICT` detection; `captureGPS` mutated client in place; `resolveConflict` dropped IDB persistence and risked overwriting loaded subcollections. | `saveClient` edit and `captureGPS` now enqueue `baseVersion: Number(c.version) || 0`; `captureGPS` updates immutably; `flushSyncQueue` passes `item.payload.baseVersion ?? 0` to `updateClientTransaction`; `resolveConflict` preserves subcollections cleanly and persists updated clients, stats, and queue to IndexedDB. |
| 5 | `src/business/storage.js` (`doLoadDataFromFirestore`, `clearAllData`) | Boot load ignored queued offline adds/deletes; `clearAllData` lacked RBAC guard and used an unchunked `writeBatch`. | `doLoadDataFromFirestore` reconciles with active `syncQueue` when non-empty and persists IDB cache; `clearAllData` enforces `isGerant() \|\| hasPermission('clients.delete')`, chunks deletes in batches of `400`, and clears IDB clients/queue. |

---

## 2. Offline / Online / Multi-Session Convergence Guarantees

- **Online create / subcollection edit:** Committed transactionally (`addClientTransaction`, `saveClientSubItemTransaction`, `deleteClientSubItemTransaction`); remote snapshot reconciles cleanly without duplicating or dropping records.
- **Offline queue mutations:** Queued `ADD_CLIENT`, `UPDATE_CLIENT`, `DELETE_CLIENT`, `SAVE_SUB_ITEM`, `DELETE_SUB_ITEM` remain protected against stale incoming `onSnapshot` frames and converge automatically upon `flushSyncQueue()`.
- **Conflict detection & resolution:** Concurrent edits on stale `baseVersion > 0` trigger `VERSION_CONFLICT` and surface `resolveConflict('server' | 'local' | 'merge')` with deterministic state, queue, and IDB persistence.
- **Timeline convergence:** Remote activity snapshots preserve pending unsynced events and never overwrite local audit history in flight.
