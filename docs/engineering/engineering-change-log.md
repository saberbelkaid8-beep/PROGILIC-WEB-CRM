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
