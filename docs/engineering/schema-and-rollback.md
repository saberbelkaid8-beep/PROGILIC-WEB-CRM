# Data Schema and Rollback Notes

## Canonical records

- Tenant metadata: `users/{uid}` (statistics, schema metadata, next-ID metadata).
- Customer record: `users/{uid}/clients/{clientId}`.
- Canonical license: `users/{uid}/clients/{clientId}/programs/{programId}`.
- Timeline audit event: `users/{uid}/activities/{activityId}`.
- Local client cache, metadata, sync queue, backups, and activity outbox are held in a per-user IndexedDB database.

`programNames`, `programsCount`, and `installationsCount` on a customer are projections, not license records. They can provide evidence for review but must not be used to fabricate a canonical license or fill its missing fields.

## Persistence transaction behavior

Customer creation with an initial license uses the client-creation transaction. Program add/edit and delete use transactions that update the program document, customer summary fields, and tenant statistics together. UI state and success messages update only after the transaction succeeds.

Sync queue and Timeline outbox entries are persisted before cloud delivery. Retryable failures remain queued with retry/error metadata; permanent Timeline failures require explicit retry.

## Backup format and restore

Local snapshots include an ID, timestamp, reason, clients, statistics, ID sequence (nullable if unknown), version, and schema version. Snapshot creation is verified by reading the record back from user-scoped IndexedDB and comparing it to the original. Restore requires a successfully verified safety snapshot of current local state first.

This local snapshot mechanism is not a substitute for an independently verified production Firestore export.

## Migration and rollback procedure

1. Stop the migration/recovery operation; do not retry an uncertain partial cloud write.
2. Obtain authorized read-only access and record the source and scope.
3. Export the complete affected production collections, including canonical program subcollections and required metadata; independently verify the backup before any write.
4. Run the program recovery classifier in read-only mode against the supplied snapshots.
5. Review each candidate and missing field with the data owner; get explicit approval for a specific migration set.
6. Only then call the migration with both `approved: true` and `backupVerified: true`. The code gate intentionally blocks calls that omit either condition.
7. Verify record counts, customer links, summary projections, timestamps, and audit events against the backup and approved candidate list.
8. If validation fails, stop further writes and restore only from the verified production backup using an approved, separately reviewed rollback procedure. Do not delete records or infer values to make counts match.

The repository does not currently implement an automated production rollback tool. Local IndexedDB restore is for local state only; it must not be represented as a cloud rollback.

## Current migration state

No migration or recovery has been performed. No production backup exists from this task. Production access, backup verification, review, and explicit migration approval remain prerequisites.
