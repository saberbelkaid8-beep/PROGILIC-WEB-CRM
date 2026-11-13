# PROGILIC CRM × TRELLO — Mission Progress Ledger

**Mission Directory:** `artifacts/trello-mission-20261105T085725Z`
**Status:** DEVELOPMENT COMPLETE — SANDBOX VALIDATED — PRODUCTION ACTIVATION LOCKED — AWAITING EXPLICIT SECOND APPROVAL
**Current Phase:** Phase 13 — Production Gate Locked
**Safety Invariants Status:** Enforced (I-1 to I-10 active)

## Passed Gates & Remediated Items
- [x] Mission directory & ledger initialized (`artifacts/trello-mission-20261105T085725Z/`)
- [x] Credential Purge & Sanitization: Removed plaintext credentials from `production-activation-checklist.md`; replaced with Secret Manager references.
- [x] Accidental Directory Cleanup: Removed accidental nested `/app/applet/app/applet/` structure cleanly.
- [x] Dependency Integrity: Declared `@babel/parser` in `package.json` devDependencies. 110 files scanned, 0 phantom dependencies found.
- [x] Server-Enforced Fail-Closed Production Safety Gate: Enforced `TRELLO_PRODUCTION_GATE_UNLOCKED=true` requirement in `sandboxGuard.js`, `trelloRoutes.js` (returns HTTP 423 Locked for live webhooks), and `trelloBackfill.js`.
- [x] Atomic Transactional Sync: Wired `commitProtectedSyncTransaction()` in `trelloSyncService.js` to ensure atomic multi-document writes (subitem, client, timeline, and sync map) with lease renewal and stale worker fencing.
- [x] Single-Account Hardening: Strict single-account restriction for `progilicservice@gmail.com` with mandatory `email_verified === true` verification and fail-closed UID matching in `authMiddleware.js`.
- [x] Firestore Security Rules Hardening: Removed permissive `isSignedIn()` fallback from `isVerified(userId)`; replaced recursive `{document=**}` wildcard under clients with explicit subcollection rules (`programs`, `issues`, `requirements`, `contacts`) enforcing full schema blueprints.
- [x] Confidential Trello OAuth 2.0 Flow: Implemented server-side PKCE (RFC 7636) code_verifier and code_challenge, state CSRF tokens, back-channel code exchange, and member identity binding to `progilicservice@gmail.com`.
- [x] Unit Tests & Verification: All 48 Trello, account restriction, OAuth, and scenario tests passing cleanly.

## Decisions Log
- In accordance with Invariant I-2 and Section 5.4, all Live Trello operations are restricted to GET-only read access.
- In accordance with Invariant I-3 and Section 5.4, test/sandbox writes target emulator or isolated mock repositories; production Firestore writes are locked.
- Single-account restriction applies to `progilicservice@gmail.com` with UID resolution as tenant identifier.
- Server-side fail-closed production safety gate rejects live mutations with HTTP 423 until explicitly approved.saberbel