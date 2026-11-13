# CRM Recovery Acceptance Matrix

| Workflow / control | Local evidence | Production acceptance |
|---|---|---|
| Customer creation without initial license | Unit tests verify persistence-before-success and transaction failure behavior | Blocked: live Firestore/emulator unavailable |
| Customer creation with explicitly selected initial license | Unit tests verify fields and reject incomplete device counts | Blocked: live Firestore/emulator unavailable |
| License add/edit/delete | Transaction and validation tests pass; unknown fields remain unknown | Blocked: live Firestore/emulator unavailable |
| License summary and exports | Regression coverage prevents guessed device totals and license fields | Not browser-verified |
| Historical program recovery | Dry-run classifier tests verify evidence-only candidates and zero writes | Blocked: no historical source data or production credentials |
| Migration safeguards | Migration-gate test verifies no writes without approval and verified-backup flags | Production migration intentionally not run |
| Local backup and restore safeguard | IndexedDB tests verify snapshots by read-back; restore requires safety snapshot | Not a production Firestore backup |
| Sync queue retry/error handling | Integration tests cover queue persistence, retry, and retained failures | Blocked: live Firestore unavailable |
| Timeline outbox and retry | Unit tests cover metadata, persistence, failed write recovery, and retry | Blocked: live Firestore unavailable |
| Trello license synchronization | Tests confirm incomplete license payloads are routed for review, not written | Production Trello connection unavailable |
| Trello Mobile license fields | Focused test verifies explicit Mobile platform, application type, version, and device count are preserved | Production Trello connection unavailable |
| Firestore security rules | Owner-scoped routes inspected in repository rules | Emulator rules suite/deployed configuration not verified |
| Browser end-to-end flows | Not run; Playwright browser installation failed | Blocked |
| Full local suite and production build | 337 tests across 46 files pass; production build completes | Not deploy-approved |

**Decision:** NOT READY FOR PRODUCTION until all blocked production and browser acceptance rows are resolved.
