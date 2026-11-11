# PROGILIC CRM × TRELLO

# PHASE 1.1.1 — CRITICAL SERVER-SIDE INTEGRITY REMEDIATION

**Execution Mode:** Surgical Remediation — Existing Production-Oriented Application
**Target Agent:** Google AI Gemini 4 Argon
**Phase:** 1.1.1
**Priority:** Critical
**Authorization:** Limited implementation authority within the scope defined below
**Next Phase:** NOT AUTHORIZED

---

# ROLE

Act as a Principal Backend Architect, Senior Firebase/Firestore Engineer, Distributed Systems Engineer, Application Security Engineer, and Senior QA Engineer.

You are working on an existing production-oriented application: PROGILIC CRM.

Your responsibility is to eliminate verified architectural and data-integrity defects discovered during the Phase 1.1 code audit.

Think and operate as an engineer responsible for protecting an existing customer database.

Do not optimize for the number of files changed, the speed of implementation, or the appearance of completion.

Optimize for:

1. Data integrity.
2. Tenant isolation.
3. Correct server-side execution.
4. Reliable persistence.
5. Idempotency.
6. Concurrency safety.
7. Recoverability.
8. Verifiable evidence.

A feature that appears to work in the browser but fails in a standalone Node.js production process is NOT complete.

A test that checks a helper function without exercising the real execution path is NOT sufficient evidence.

A report claiming success without reproducible verification is NOT acceptance.

---

# CONTEXT

## 1. Existing project

PROGILIC CRM is an existing application.

The integration must preserve its established architecture, data model, UI, authentication model, customer records, activity history, and operational workflows.

The integration is not authorized to redesign or replace the CRM.

Previously inspected architecture includes:

- Vanilla JavaScript ES Modules.
- Vite.
- Firebase Authentication.
- Cloud Firestore.
- IndexedDB/offline functionality.
- Google GenAI SDK through the existing `/api/ai` proxy.
- An existing standalone Node.js server in `server.js`.
- A separate Vite development environment.
- Existing CRM client records and subcollections.
- Existing Global Timeline and Client Timeline.

Existing client data structure includes:

`/users/{userId}/clients/{clientId}`

With existing subcollections such as:

- `programs`
- `issues`
- `requirements`
- `contacts`

Existing activity storage:

`/users/{userId}/activities/{activityId}`

Existing relevant modules include, subject to verification against the current repository:

- `src/server/firebaseAdmin.js`
- `src/server/tenantResolver.js`
- `src/server/firestoreAdminRepository.js`
- `src/server/middleware/authMiddleware.js`
- `src/server/trelloRoutes.js`
- `src/business/trello/trelloSyncService.js`
- `src/business/trello/entityResolver.js`
- `src/business/trello/deterministicRouter.js`
- `src/business/trello/trelloAiClassifier.js`
- `src/business/timelineService.js`
- `src/state/store.js`
- `src/server/bootstrap.js`
- `server.js`

These are investigation starting points, not permission to assume that their current implementation matches previous reports.

## 2. Phase 1.1 audit findings

The previous source-code audit of the supplied project archive identified these critical defects.

You MUST independently reproduce or disprove every finding against the current repository before making changes.

### Finding A — Browser-dependent server synchronization

`src/business/trello/trelloSyncService.js` imports or depends on browser-oriented modules, including:

- `timelineService.js`
- `state/store.js`
- `storage.js`
- Firebase Web SDK modules.
- Browser Firebase configuration.

The synchronization process uses the in-memory `clients` collection from the frontend state store.

In a standalone Node.js process, this state may be empty or unavailable.

The customer resolver therefore cannot safely assume that an existing CRM customer is absent merely because the browser state is empty.

This can result in incorrect customer resolution and duplicate customer creation.

### Finding B — Timeline writes are not server-integrated

The Trello synchronization path calls the existing browser-oriented `logActivity()`.

That function depends on browser authentication/session state and existing frontend persistence behavior.

An Admin SDK implementation of `logActivity()` exists or was reported to exist in the server repository, but the real Trello synchronization path does not reliably use it.

This can cause Trello activities to disappear from the actual Firestore Timeline.

It can also incorrectly conflate tenant ownership with the visible actor identity.

### Finding C — Distributed lease and fencing are incomplete

A lease mechanism exists, but the previous audit identified weaknesses:

- Lease verification may happen separately from actual CRM writes.
- An old worker may continue writing after losing ownership.
- Some fallback acquisition logic may use separate read and write operations.
- Release operations may not be atomic.
- Long-running processing may outlive the lease.
- The current implementation does not establish a sufficiently strong fencing guarantee.

A lease existing in Firestore does not automatically make the writes protected.

### Finding D — Webhook acknowledgement after failed synchronization

The previous audit found that the webhook route could return HTTP 200 with a `PROCESSED` response even when the synchronization result was `FAILED`.

This creates a false acknowledgement.

An HTTP success response must never imply successful processing if the event was neither successfully processed nor durably accepted for retry.

### Finding E — Sync record reads fail open

The previous audit found fallback behavior in which a failure to read an Admin SDK sync record could trigger a fallback read or result in `null`.

A Firestore read failure is not equivalent to a record not existing.

This behavior can undermine idempotency and create duplicates.

### Finding F — Update behavior is inconsistent

The previous audit found that updates to existing checklist-item mappings were not handled consistently across all CRM entity types.

Some entity types could receive a new CRM subdocument instead of updating the record already associated with the same Trello Checklist Item ID.

### Finding G — Rollback is browser-state dependent

The rollback path uses the frontend `clients` state instead of resolving the authoritative CRM record through the server-side repository.

A rollback must not report success without actually restoring or safely reversing the integration-owned changes.

### Finding H — Browser polyfill inside server bootstrap

The previous audit found that `src/server/bootstrap.js` introduced fake browser globals such as `window` and `requestAnimationFrame`.

This is not an acceptable solution to coupling frontend modules into the server runtime.

### Finding I — Test quality and authentication-policy mismatch

Some previous tests did not exercise the actual synchronization execution path.

A previous authentication test expected a generic `admin: true` custom claim to grant cross-tenant access, while the inspected middleware did not implement that policy.

Do not blindly add an authorization bypass just to make an incorrect test pass.

The real authorization policy must be explicitly established, documented, and tested.

### Finding J — Operational and documentation inconsistencies

Previous inspection identified:

- Possible coexistence of `package-lock.json` and `bun.lock`.
- Duplicate translation keys in `src/utils/i18n.js`.
- Documentation inconsistencies concerning webhook signature algorithms.
- Missing or incomplete Phase 1.1 remediation evidence.

Verify the current repository before acting on these findings.

---

# OBJECTIVE

Remediate the verified critical defects from Phase 1.1 so that:

1. Trello synchronization executes through a genuine server-side architecture.
2. CRM customer resolution uses authoritative Firestore data.
3. Existing customers are reused rather than duplicated.
4. Trello-originated Timeline activities are persisted through Firebase Admin.
5. Trello actor identity remains separate from tenant ownership and employee identity.
6. Sync processing is idempotent under repeated and concurrent requests.
7. A stale worker cannot silently overwrite the result of a newer worker.
8. Webhook failures cannot be falsely reported as successful processing.
9. Update and rollback operations work against authoritative CRM records.
10. The backend operates without browser globals or browser-only dependencies.
11. Security boundaries remain intact.
12. Critical behavior is demonstrated through meaningful automated tests.

This is a remediation phase, NOT a new integration implementation phase.

---

# TASKS

## TASK 0 — Repository Baseline and Change Protection

Before modifying anything:

1. Inspect the actual repository root.
2. Inspect the current Git branch and working-tree status.
3. Capture the existing `git status --short`.
4. Inspect existing unstaged and staged changes.
5. Identify the package manager used by the actual project, deployment, and CI configuration.
6. Identify the current Node.js runtime requirements.
7. Identify the real production server entry point.
8. Identify the actual development command.
9. Run the existing targeted tests and available baseline checks BEFORE modifying source code, where the environment permits.

Create an internal baseline containing:

- Existing test count.
- Passing test count.
- Failing test count.
- Existing build result.
- Existing lint result.
- Installation failures.
- Runtime and environment constraints.
- Pre-existing repository changes.

IMPORTANT:

Do not overwrite, revert, discard, or clean up unrelated pre-existing user changes.

Do not run destructive Git commands.

Do not use `git reset --hard`, indiscriminate checkout operations, or destructive cleanup commands.

Do not assume that historical reports accurately describe the current repository.

If an existing issue already exists before your modifications, classify it as a baseline issue rather than claiming that your work introduced or fixed it.

---

## TASK 1 — Establish a Genuine Server-Side Execution Boundary

This is a mandatory architectural correction.

Inspect the complete Trello processing call chain, not just its entry-point function.

Trace:

Webhook route → Event validation → Tenant resolution → Sync service → Customer resolution → CRM persistence → Mapping persistence → Timeline persistence → Response.

### Requirements

The actual server-side synchronization path must not depend on:

- `window`
- `document`
- `localStorage`
- `sessionStorage`
- `requestAnimationFrame`
- IndexedDB.
- Frontend `state/store.js`.
- Frontend `clients` state.
- Browser Firebase Auth session.
- Firebase Web SDK persistence functions.
- Browser-only database configuration.
- Frontend UI state mutations.

Do not solve this by adding browser polyfills to Node.js.

Do not add fake `window` or `requestAnimationFrame` objects.

### Required architecture

Separate responsibilities clearly:

**Server route layer**

- Request verification.
- Signature validation.
- Payload validation.
- Tenant resolution.
- HTTP response handling.

**Server synchronization service**

- Business orchestration.
- Customer resolution.
- Operation classification orchestration.
- Idempotency coordination.
- Mapping lifecycle.
- Rollback orchestration.

**Firebase Admin Repository**

- Authoritative CRM reads.
- CRM writes.
- Sync record reads/writes.
- Lease operations.
- Review record operations.
- Timeline writes.

**Pure shared logic**

- Normalization.
- Entity matching utilities.
- Deterministic classification helpers.
- Validation and mapping functions.

Existing modules may be reused only when they are genuinely runtime-independent.

### Required result

The standalone Node.js production process must be able to execute the synchronization service without importing frontend state or browser Firebase persistence.

Keep the existing frontend application operational.

Do not redesign the CRM.

Do not migrate the entire application to a new framework.

### Verification

Add tests proving that the real server-side synchronization module can be imported and executed in a Node.js environment where browser globals are absent.

A test that merely mocks the existence of `window` is insufficient.

---

## TASK 2 — Make Firebase Admin the Authoritative Customer Data Source

This is a critical data-integrity requirement.

The synchronization service must use the server-side Admin Repository when resolving CRM customers.

It must never treat an empty browser-side collection as proof that a customer does not exist.

### Required behavior

Before resolving a customer:

1. Obtain the authorized tenant from the trusted server-side tenant resolver.
2. Query the tenant's existing CRM customers through Firebase Admin.
3. Use the existing entity-resolution logic where appropriate.
4. Identify reliable matching identifiers.
5. Distinguish confirmed matches from candidate matches.
6. Send ambiguous cases to human review.

### Customer identity rules

Preserve these rules exactly:

**Existing CRM customer**

Reuse the existing client record.

Do not create another customer.

Add or update the appropriate operation.

**Genuinely new customer**

Create a customer only when the available identity and required information are sufficiently reliable.

**Existing real-world customer absent from CRM**

Preserve the historical nature of the relationship.

Do not falsely classify the customer as newly acquired.

### Prohibited matching behavior

Do not rely solely on:

- Name equality.
- A fuzzy similarity score.
- Arabic normalization.
- Generic business descriptions.
- Missing frontend cache results.

Arabic normalization may help retrieve candidates, but it does not prove identity.

Do not merge `ة` and `ه` as though they were always interchangeable.

Do not merge two customers based on ambiguous names.

Do not automatically assign `نشط`, `محتمل`, or a newly acquired status without evidence.

### Required tests

Create realistic tests for:

- Customer already exists in Firestore but frontend state is empty.
- Matching reliable phone number.
- Matching reliable email.
- Matching company identifiers.
- Similar names belonging to different customers.
- Arabic names with normalization ambiguity.
- Customer without sufficient identifying information.
- Existing customer not found in CRM.
- Two simultaneous events attempting to create the same genuinely new customer.

The existing-customer test must prove that the original CRM customer ID is reused and no duplicate customer document is created.

---

## TASK 3 — Integrate Trello Timeline Through Firebase Admin

The existing CRM Timeline must remain the only Timeline system.

Do not build a separate Trello Timeline.

Do not create a parallel audit log or redesign Timeline UI.

### Required implementation

Trace the existing Timeline persistence and rendering pipeline.

Identify the precise existing activity schema and all fields required by the UI.

Use the server-side Admin Repository for Trello-originated activity writes.

Trello activities must be visible in:

- Global Timeline.
- The corresponding customer's Client Timeline.

Manual CRM activity behavior must remain unchanged.

### Actor identity rules

A Trello event must visibly identify its actor as:

`Trello`

Do not attribute a Trello event to:

- The logged-in employee.
- The person who linked Trello.
- The tenant owner.
- The person who happened to trigger the webhook.

Preserve the distinction between:

1. Tenant ownership.
2. Authenticated server execution identity.
3. Visible activity actor identity.

Do not blindly assign `tenantId` to `actorUid`.

Do not invent invalid actor identifiers.

Inspect the existing Timeline schema and Firestore rules before deciding the appropriate values for:

- `userName`
- `userRole`
- `userId`
- `actorUid`
- `actorEmail`
- `source`
- `meta`

If the schema permits a system/integration actor, use it consistently.

If the schema does not support this safely, introduce only the smallest backward-compatible adjustment necessary and document the exact compatibility implications.

### Transactional consistency

Where a CRM operation and its corresponding Timeline entry are part of the same synchronization commit, persist them atomically with the mapping and lease validation where technically feasible.

Do not report successful synchronization when the required Timeline persistence failed.

### Required tests

Verify:

- Trello actor displays as `Trello`.
- Global Timeline receives the activity.
- Correct Client Timeline receives the same activity.
- Tenant ownership is not confused with actor identity.
- Existing manual CRM activities preserve their original employee attribution.
- Timeline persistence failure cannot be silently ignored.

---

## TASK 4 — Implement a Defensible Distributed Lease and Fencing Protocol

Treat concurrency as a data-integrity problem.

Do not claim that a lease is safe merely because an acquisition function uses a Firestore transaction.

Inspect every acquisition, renewal, verification, release, and protected-write path.

### Required properties

The implementation must prevent:

- Two workers from simultaneously owning the same active lease.
- Duplicate CRM writes caused by concurrent processing.
- An old worker from overwriting a newer worker's result.
- Stale lease release from deleting or releasing a newer worker's lease.
- A worker from silently continuing after losing ownership.

### Fencing requirements

Use a monotonically increasing fencing token or an equivalent verifiable ownership generation.

Every protected commit must validate the current lease owner and fencing generation.

The validation must be part of the same atomic commit boundary as the CRM and mapping writes it protects.

A separate check followed by unrelated writes is insufficient.

Where supported by the actual Firestore data model, the protected transaction should read the current lease and relevant sync/customer records before issuing writes.

The transaction should atomically:

1. Verify that the worker still owns the expected lease.
2. Verify the expected fencing generation.
3. Verify that the lease has not expired according to the defined server-side time policy.
4. Check the expected mapping version/state.
5. Apply only the authorized CRM changes.
6. Persist the corresponding mapping state.
7. Persist the relevant Timeline activity.
8. Record the committed fencing generation or equivalent protection metadata.

Do not execute external network requests or AI classification calls inside a Firestore transaction callback.

Prepare all required external results before entering the transaction.

Transaction callbacks may be retried. They must not perform non-idempotent external side effects.

### Expiry and clock handling

Define:

- Lease ownership.
- Lease expiry.
- Renewal behavior.
- Fencing generat
- Stale worker behavior.
- Release semantics.
- Clock source.
- Safety margin.

Use a trusted server-side clock policy.

A worker must not intentionally begin a protected commit when its lease is expired or within an unsafe expiry margin.

If the existing Firestore design cannot mathematically guarantee rejection at the exact wall-clock instant of expiry, explicitly document the limitation and the guarantee actually achieved.

Do not falsely claim absolute expiry-time fencing if the mechanism only prevents stale writes after a replacement owner obtains a newer fencing token.

Do not introduce a new external lock infrastructure or new distributed systems dependency without identifying why the current stack cannot satisfy the requirement and reporting the proposed alternative for approval.

### Atomicity

Do not retain unsafe fallback code that changes a required atomic acquisition into separate `get()` and `set()` operations.

If a required transactional primitive is unavailable, fail safely rather than silently degrading concurrency guarantees.

### Release behavior

A worker must only release the exact lease generation it owns.

A stale worker must never release a newer worker's lease.

### Required concurrency tests

Exercise the real repository/synchronization path:

**Scenario 1:** Two workers acquire the same item simultaneously.

**Scenario 2:** Worker A acquires a lease; its lease expires; worker B obtains a newer fencing generation; worker A attempts to commit.

Expected result: A is rejected and cannot alter CRM data, Timeline data, or the current mapping.

**Scenario 3:** Worker A attempts release after worker B has acquired a newer lease.

Expected result: B's lease remains intact.

**Scenario 4:** A long-running operation approaches lease expiry.

Expected result: safe renewal or safe abort, never an unprotected commit.

**Scenario 5:** Two requests process the same checklist item concurrently.

Expected result: exactly one logical CRM operation and one consistent mapping.

Use Firestore Emulator or a realistic transaction-aware test harness when available.

Mocks must model transaction conflicts and retries correctly.

Do not claim production-grade concurrency verification based solely on two sequential function calls.

---

## TASK 5 — Correct Webhook Acknowledgement and Persistence Failure Semantics

Inspect the actual Trello webhook HTTP response path.

### Mandatory rules

An event must not be reported as `PROCESSED` when synchronization failed.

An HTTP 200/2xx acknowledgement is permitted only when one of these conditions is true:

1. The event was successfully processed and its durable final state was committed.
2. The event was safely accepted into a durable processing mechanism that guarantees subsequent processing and exposes its state.

A memory-only queue or an unpersisted promise is not durable acceptance.

If processing failed and no durable acceptance or recovery mechanism exists, return an appropriate retryable non-2xx response.

Use an appropriate HTTP 5xx status for retryable processing failures.

Do not expose internal stack traces, credentials, or sensitive database information in HTTP responses.

### Idempotent retry behavior

Repeated delivery of the same event must not duplicate CRM records or Timeline activities.

Distinguish:

- Successful first processing.
- Already processed duplicate.
- Currently processing duplicate.
- Retryable failure.
- Permanent validation/security rejection.
- Durably accepted but not yet processed.

Do not confuse a duplicate event with an unprocessed event.

Do not claim that Trello guarantees unlimited retries. Verify the actual retry behavior from authoritative integration documentation if required, or explicitly document what the application itself guarantees.

### Persistence errors

Remove silent error swallowing from critical operations.

Critical persistence errors must:

- Propagate to the orchestration layer.
- Produce a structured internal error.
- Preserve a traceable event/sync state when possible.
- Trigger retry or human-review behavior as appropriate.
- Never generate a false success result.

Do not return `null` from critical reads when the actual cause is a database failure.

Use explicit distinctions such as:

- `FOUND`
- `NOT_FOUND`
- `UNAVAILABLE`
- `PERMISSION_DENIED`
- `FAILED`

Adapt names to the existing codebase where appropriate.

---

## TASK 6 — Make Idempotency and Sync Record Reads Fail Closed

Inspect the complete mapping lifecycle.

The stable external identity remains:

`checklistItemId`

Do not replace it with a card ID or card name.

Preserve the known Trello hierarchy and existing identifier mapping.

The mapping must remain tenant-scoped.

### Read semantics

A database exception must never be converted into a normal `NOT_FOUND` result.

A missing record and a failed read are different states.

When idempotency cannot be verified because Firestore is unavailable, do not proceed with customer or CRM writes as though no mapping exists.

Fail safely and expose a retryable failure.

### Processing semantics

The same Checklist Item ID must not produce multiple independent CRM operations.

Repeated webhook delivery must not create duplicate:

- Customer records.
- Program records.
- Issue records.
- Requirement records.
- Contact records.
- Timeline entries.
- Sync mappings.

Use the existing mapping structure if valid.

Previously proposed mapping:

`/users/{tenantId}/trello_sync/{checklistItemId}`

Verify its actual implementation and schema before changing anything.

Do not create alternative mapping collections without a documented requirement.

### Mapping versioning

Where appropriate, preserve:

- External Checklist Item ID.
- Tenant ID.
- Linked CRM client ID.
- Linked CRM entity type.
- Linked CRM entity ID.
- Last processed source state.
- Source modification timestamp.
- Processing status.
- Fencing generation.
- Creation/update timestamps.
- Relevant provenance.

Do not invent unnecessary fields.

Maintain backward compatibility with existing mapping documents.

---

## TASK 7 — Correct Updates Across Every Supported CRM Entity Type

An update to an existing Trello Checklist Item must update its already linked CRM operation.

It must not automatically create another operation.

Inspect all supported destination entity types:

- `programs`
- `issues`
- `requirements`
- `contacts`
- Any other genuinely existing supported structure discovered in the project.

For each type, establish:

1. How the original CRM document is located.
2. How updates are applied.
3. How fields are preserved when the Trello source omits them.
4. How provenance is preserved.
5. How deleted or archived source items are handled.
6. How a repeated update remains idempotent.

Do not introduce a different implementation strategy for each entity type without justification.

Prefer a common safe persistence contract where practical.

### Preserve semantic rules

Do not weaken the previously established AI/business interpretation rules.

In particular:

- A completed checkbox means the worker marked the task complete; it does NOT automatically mean a technical issue is resolved.
- An issue may be marked `محلول` only when the source explicitly confirms resolution or includes sufficient specific resolution evidence.
- Ambiguous interpretation goes to human review.
- Do not treat illustrative words such as `Vidéo`, `Déplacement`, or `Prestation` as hardcoded universal categories.
- Do not infer a training topic or technical resolution from a vague label.
- Distinguish operation nature, intervention medium, and outcome.
- Only preserve information supported by Trello source data or approved AI extraction.

Do not add speculative semantic changes in this phase.

---

## TASK 8 — Make Rollback Work Against Authoritative Server Data

Inspect `rollbackTrelloItem()` and the complete rollback call chain.

Rollback must not depend on:

- Frontend `clients`.
- Browser session state.
- IndexedDB.
- Browser Firebase SDK.

Resolve all affected records through the authorized Firebase Admin Repository.

### Required rollback safety

Rollback must:

1. Identify the precise integration mapping.
2. Verify the tenant boundary.
3. Identify the linked CRM entity.
4. Read integration provenance and before-state information.
5. Reverse only fields or records demonstrably created or changed by this integration.
6. Preserve pre-existing customer data.
7. Never delete an existing CRM customer merely because a Trello item is deleted or archived.
8. Preserve Timeline history.
9. Record the rollback outcome.
10. Be idempotent.

For deletion or archival of a Trello Checklist Item, the CRM record must not automatically be physically deleted.

Use the existing lifecycle strategy where possible, such as a source-deleted status on the mapping and an appropriate Timeline activity.

If the current data does not contain enough provenance to reverse a particular change safely, do not guess.

Mark it for human review and preserve the CRM record.

### Required tests

Test rollback of:

- An integration-created CRM operation.
- An operation linked to a pre-existing customer.
- A CRM record subsequently modified manually.
- A source-deleted Checklist Item.
- A mapping with incomplete provenance.
- A repeated rollback request.

Verify that pre-existing customer documents are never deleted.

---

## TASK 9 — Remove Browser Polyfills From the Backend

Inspect `src/server/bootstrap.js`, imports, server startup, and all modules imported by the standalone server.

Remove fake browser globals only after eliminating the frontend dependencies that required them.

Do not remove a polyfill blindly if an unrelated server component genuinely uses the capability.

Do not retain unnecessary frontend initialization in the backend.

The backend must start and execute its server-side routes without creating:

- A fake `window`.
- A fake `document`.
- A fake `requestAnimationFrame`.
- A synthetic browser application lifecycle.

The frontend must retain its existing browser functionality.

### Startup behavior

If Firebase Admin initialization is mandatory for the enabled backend features:

- A required initialization failure must be visible.
- Readiness must report unavailable.
- The process must not misleadingly report full readiness.
- Do not swallow the initialization error and continue as though the database were operational.

Maintain the distinction between:

- Process liveness.
- Admin SDK initialization.
- Firestore operational readiness.
- Route availability.

Do not unnecessarily change deployment topology.

---

## TASK 10 — Authentication and Tenant Security Regression

Re-audit the actual routes after remediation.

Separate:

**Trello provider webhook authentication**

- HMAC signature verification.
- Exact request-body handling.
- Board/list authorization.
- Tenant resolution using server-controlled configuration or mapping.
- No trust in an arbitrary payload `tenantId`.

**Firebase-authenticated administrative/client endpoints**

- Verify Firebase ID tokens.
- Enforce the authenticated user's tenant boundary.
- Apply explicit, documented authorization rules to any legitimate privileged cross-tenant operation.

### Critical rule

Do not introduce a generic cross-tenant bypass based only on:

`admin === true`

unless the real application already has an explicitly defined, verified, audited policy establishing that privilege.

A custom claim is trustworthy only after Firebase token verification, and its authorization meaning must be established by the application policy.

The test suite must match the established authorization policy.

Never weaken tenant isolation to satisfy an incorrect test expectation.

Do not expose service-account credentials or Trello secrets.

Do not rely on Firestore Security Rules as the only tenant protection for Admin SDK operations. Admin SDK bypasses Firestore Security Rules; the server must enforce its own authorization.

---

## TASK 11 — Package, Build, and Documentation Integrity

Verify dependency integrity.

Previous inspection found `firebase-admin@^14.5.0` in `package.json` and version `14.5.0` in the npm lockfile, but the existence of both `package-lock.json` and `bun.lock` requires a clear package-management policy.

Determine the canonical package manager from:

- Project documentation.
- CI configuration.
- Deployment scripts.
- Existing lockfiles.
- Developer workflows.

Do not delete a lockfile simply to make the repository look cleaner.

If npm is canonical:

- Ensure `package.json` and `package-lock.json` are consistent.
- Verify `npm ci` when the environment permits.
- Document the supported installation command.
- Explain the status of any other lockfile.

Do not silently upgrade unrelated dependencies.

### Documentation accuracy

Update only documentation affected by the actual remediation.

Check:

- Server startup instructions.
- Production versus development startup.
- Firebase Admin initialization.
- Readiness endpoint semantics.
- Tenant-resolution behavior.
- Webhook authentication behavior.
- Lease/fencing guarantees and limitations.
- Error and retry semantics.
- Rollback behavior.

Ensure the documented webhook signature algorithm matches the implementation.

Do not claim security properties not established by the code and tests.

### Duplicate i18n keys

Inspect the previously reported duplicate keys in `src/utils/i18n.js`.

If they are still causing build warnings, perform only a narrowly scoped correction.

Determine the intended translation values from the existing localization conventions and nearby language dictionaries.

Do not guess translations.

Do not alter UI text or redesign any screens.

If the correct value is unclear, report it instead of silently choosing one.

---

## TASK 12 — Automated Test Engineering

This task is mandatory.

Do not merely modify old tests until they pass.

Inspect the validity of the old tests.

For each critical behavior, identify the production code path being exercised.

Tests must validate behavior, persistence outcomes, security boundaries, and failure semantics.

### Required test groups

**A. Server runtime isolation**

- Server-side module import without browser globals.
- Full server sync path without frontend state.
- No accidental Firebase Web SDK dependency in server processing.

**B. Customer resolution**

- Existing Firestore client with empty frontend cache.
- Reuse existing client.
- No duplicate client creation.
- Ambiguous customer to review.
- New customer creation only when justified.
- Concurrent customer-creation attempts.

**C. Timeline**

- Admin-backed persistence.
- Global Timeline.
- Client Timeline.
- Correct `Trello` actor.
- Manual employee actor preserved.
- Persistence failure propagation.

**D. Lease and fencing**

- Concurrent acquisition.
- Lease expiry.
- Renewal.
- New fencing generation.
- Stale worker commit rejection.
- Stale worker release rejection.
- Transaction conflict and retry.
- Failure without unsafe fallback.

**E. Webhook**

- Invalid signature.
- Unauthorized Board/List.
- Correct tenant mapping.
- Successful processing.
- Already-processed duplicate.
- Retryable persistence failure.
- Durable acceptance, if such a mechanism exists.
- No false HTTP 200 for failed and unpersisted processing.

**F. Sync record and idempotency**

- Existing mapping.
- Missing mapping.
- Firestore read failure.
- Concurrent repeated events.
- Mapping consistency.

**G. Entity updates**

- Existing program update.
- Existing issue update.
- Existing requirement update.
- Existing contact update.
- No duplicate subdocument on update.
- Source deletion and archival.

**H. Rollback**

- Created record rollback.
- Existing client preservation.
- Manual modification preservation.
- Incomplete provenance.
- Repeated rollback.

**I. Authentication and tenant isolation**

- Valid user token.
- Invalid token.
- Expired token.
- Correct tenant.
- Cross-tenant rejection.
- Explicitly permitted privileged access only if established by real application policy.
- Webhook authentication independent of Firebase user login.

**J. Startup and readiness**

- Successful Admin initialization.
- Failed Admin initialization.
- Liveness behavior.
- Readiness failure.
- Graceful shutdown.

### Test quality requirements

Prefer Firebase Emulator for integration-level Firestore behavior if already available or reasonably configurable without introducing production infrastructure.

For concurrency testing, use a transaction-aware emulator or test harness that models contention, retries, and ownership changes.

Use dependency injection for controlled failure scenarios.

Do not create tests that merely instantiate a mock without passing it into the real production path.

Do not make tests pass by weakening the implementation.

Do not use production customer data.

Do not perform live Trello writes.

Do not access production Firebase for test mutations.

---

## TASK 13 — Regression and Final Verification

Run the checks supported by the actual repository.

At minimum, attempt:

- Dependency consistency verification.
- `npm ci` if npm is the canonical package manager.
- `npm test`.
- Targeted Trello tests.
- Backend security tests.
- Repository integration tests.
- `npm run build`.
- `npm run lint` if defined.
- Standalone production server startup.
- Liveness endpoint check.
- Readiness endpoint check.
- Backend execution without browser globals.

Use the exact package manager and scripts that the project supports.

If any command is not defined, state that explicitly.

If installation fails because of network restrictions, environment limitations, or timeout:

- Record the exact command.
- Record the actual error.
- Do not invent a successful result.
- Continue only with checks that can genuinely be performed.
- Distinguish static inspection from executed tests.

### Historical baseline

Previous reports mentioned several different historical counts, including:

- 161 tests with 154 passing and 7 failing.
- 30/30 Trello tests.
- 25 security tests reportedly passing in Phase 1.

Treat these only as historical claims.

Reconstruct the actual current baseline from the current repository.

Show:

1. Baseline before remediation.
2. Results after remediation.
3. Newly added tests.
4. Existing failures.
5. New failures.
6. Regressions.
7. Environment-related checks that could not execute.

Never claim that old failures are unaffected without comparing the actual results.

---

# CONSTRAINTS

These restrictions are mandatory.

## Scope restrictions

This phase is ONLY for critical integrity remediation.

Do not begin Phase 2.

Do not implement new Trello connectivity features.

Do not register Trello webhooks.

Do not initiate live Trello API synchronization.

Do not perform historical backfill.

Do not run a production migration.

Do not modify production CRM records.

Do not create a new CRM application.

Do not redesign the CRM UI.

Do not redesign the Timeline UI.

Do not build a separate Trello dashboard.

Do not create a parallel Timeline or audit architecture.

Do not replace Firebase or migrate the database.

Do not introduce a new external queue, Redis, message broker, or lock infrastructure without reporting the technical necessity and waiting for separate authorization.

## Data protection

Never delete existing customers.

Never duplicate an existing customer.

Never silently overwrite manual CRM data.

Never interpret missing data as evidence.

Never infer customer status without evidence.

Never infer issue resolution from checkbox completion.

Never ignore persistence failures.

Never claim success before durable success.

Never trust an arbitrary tenant identifier supplied by the webhook payload.

Never use a stale lease as permission to continue writing.

## Security restrictions

Do not expose secrets.

Do not hardcode credentials.

Do not weaken Firebase Security Rules.

Do not add unverified cross-tenant administrator privileges.

Do not disable HMAC validation.

Do not bypass authentication for convenience.

Do not use browser-side authentication as server authorization.

Do not assume Admin SDK automatically enforces tenant isolation.

## Engineering restrictions

Prefer the smallest correct architectural change.

Preserve existing public interfaces unless a documented correction is necessary.

Avoid unnecessary dependencies.

Avoid unrelated refactoring.

Avoid mass formatting.

Avoid changing unrelated files.

Avoid modifying historical business data.

Avoid hiding failures through generic catch blocks.

Do not use comments as a substitute for implementation.

Do not report code as implemented if it is only planned.

Do not report a test as passed if it was not executed successfully.

Do not commit or push changes unless explicitly authorized.

Protect all pre-existing user modifications.

---

# DELIVERABLES

Produce the following artifacts in the project repository.

## 1. `phase-1.1.1-remediation-report.md`

A detailed engineering report containing:

- Executive summary.
- Verified original defects.
- Root cause analysis.
- Exact corrective changes.
- Architecture before and after.
- Server-side execution boundary.
- Customer-resolution behavior.
- Admin-backed Timeline implementation.
- Lease/fencing protocol.
- Webhook acknowledgement semantics.
- Idempotency behavior.
- Update behavior.
- Rollback safety.
- Authentication and tenant isolation.
- Startup/readiness behavior.
- Remaining limitations.
- Explicit unresolved risks.

## 2. `phase-1.1.1-verification-matrix.md`

Create a verification matrix with these columns:

\| ID | Requirement | Source File / Function | Test Case | Expected Result | Actual Result | Evidence | Status |

Use only these statuses:

- PASS
- FAIL
- PARTIAL
- NOT TESTED
- BLOCKED

Every critical requirement must have its own row.

A test name alone is not evidence of success.

## 3. `phase-1.1.1-test-results.md`

Include:

- Baseline commands and results.
- Post-remediation commands and results.
- Exact test counts.
- Failed test details.
- Build/lint results.
- Startup/readiness results.
- Environment limitations.

## 4. Architecture and data-flow documentation

Document:

- Actual server-side synchronization flow.
- Trust boundaries.
- Tenant resolution.
- Customer resolution.
- CRM persistence.
- Timeline persistence.
- Lease ownership and fencing.
- Idempotency.
- Error handling and recovery.

Keep it concise and consistent with the actual code.

## 5. Source-code changes

Provide:

- Exact changed file list.
- New files.
- Modified files.
- Removed files, if any, with justification.
- Important function-level changes.
- Any required environment variable changes.
- Any backward-compatibility considerations.

## 6. Final handoff summary

Provide an explicit decision:

- READY FOR PHASE 2
- NOT READY FOR PHASE 2

Do not choose READY simply because the code compiles or tests pass.

---

# ACCEPTANCE CRITERIA

Phase 1.1.1 can be considered successfully completed only when all critical requirements below are satisfied.

### AC-01 — Backend isolation

The real server-side Trello synchronization flow executes without browser state or Browser SDK dependencies.

### AC-02 — Authoritative customer lookup

Customer matching uses the authorized tenant's actual Firestore customer records through Firebase Admin.

### AC-03 — No duplicate customer creation

An existing customer is reused even when the frontend state is empty.

### AC-04 — Timeline reliability

Trello activities are saved through the Admin-backed Timeline path and appear in the appropriate existing Global and Client Timeline structures.

### AC-05 — Correct actor attribution

Trello events display `Trello` as the actor without falsely attributing them to an employee or confusing the actor with tenant ownership.

### AC-06 — Defensible concurrency protection

Lease acquisition, renewal, ownership verification, release, and protected commits follow one documented fencing protocol.

The implementation must reject stale workers and must not silently fall back to unsafe non-transactional behavior.

Any remaining technical limitation concerning exact wall-clock expiry enforcement must be explicitly documented.

### AC-07 — Honest webhook acknowledgement

Failed and unpersisted events never receive a success acknowledgement.

### AC-08 — Fail-closed idempotency

Database read failures do not become false `NOT_FOUND` results.

Repeated and concurrent processing does not generate duplicate CRM operations.

### AC-09 — Correct entity updates

Updates to existing Checklist Items modify their original linked CRM entities rather than creating new duplicates.

### AC-10 — Safe rollback

Rollback uses authoritative server data, preserves pre-existing customers, respects provenance, and is idempotent.

### AC-11 — No fake browser runtime

Backend execution does not depend on artificial browser globals.

### AC-12 — Tenant isolation

All server-side data access is explicitly tenant-scoped and protected.

### AC-13 — Meaningful tests

Critical requirements are covered by tests exercising the real production execution paths or a valid integration test harness.

### AC-14 — Regression integrity

No newly introduced critical regressions.

Existing failures are accurately classified against the measured baseline.

### AC-15 — Documentation and evidence

The reports, verification matrix, and execution evidence accurately describe the real implementation.

**All critical acceptance criteria must pass before the phase can be recommended for acceptance.**

A blocked test or unverified critical security guarantee must not be silently converted into PASS.

---

# OUTPUT FORMAT

Present your final response in this exact structure:

## 1. Executive Decision

State clearly:

- Completed or incomplete.
- READY or NOT READY for Phase 2.
- The three most important results.

## 2. Initial Baseline

Show the actual initial status, test results, build, lint, and environment constraints.

## 3. Verified Root Causes

List each finding and explain whether it was confirmed, partially confirmed, or disproved.

## 4. Architecture Changes

Describe the real execution flow after remediation.

## 5. Customer Integrity

Explain how existing customers are found, reused, created, or sent to review.

## 6. Timeline Integrity

Explain how Trello events are persisted and attributed.

## 7. Distributed Concurrency

Explain lease ownership, fencing, expiry, renewal, release, and the precise protection guarantee.

## 8. Webhook and Error Semantics

Explain when the endpoint returns success, retryable failure, or rejection.

## 9. Idempotency and Entity Updates

Explain mapping and update behavior for every supported entity type.

## 10. Rollback and Recovery

Explain provenance, reversal boundaries, and deletion/archive behavior.

## 11. Security Verification

Explain authentication, tenant isolation, HMAC, and Admin SDK trust boundaries.

## 12. Test Evidence

Give exact commands, test counts, pass/fail details, and actual execution status.

## 13. Changed Files

List all modified, added, and removed files with purpose.

## 14. Remaining Risks

List unresolved technical limitations without minimizing them.

## 15. Acceptance Matrix

Summarize all AC-01 through AC-15.

## 16. Final Handoff

Provide the explicit readiness decision and the exact reason.

---

# HANDOFF

The next authorized engineering stage, if approved separately, is:

**PHASE 2 — TRELLO CONNECTIVITY & SECURE INGESTION**

However, Phase 2 is NOT part of this assignment.

Your handoff must include:

- What has actually been implemented.
- What remains unresolved.
- What Phase 2 must know about the remediated architecture.
- Any migration or compatibility concerns.
- Any approved interfaces that Phase 2 should consume.
- Any limitations that Phase 2 must not bypass.

Do not start Phase 2 tasks.

---

ADDITIONAL CONTEXT — DEPLOYMENT SECRETS CONFIGURATION

The deployment environment's Secrets configuration has been populated by the project owner.

The configured variables are intended to cover:

- Gemini API access.
- Google Cloud project identification.
- Firestore database selection.
- Trello API credentials.
- Trello webhook signature secret.
- Trello callback URL.
- Authorized Trello Board ID.
- Authorized Trello List ID.
- Authoritative CRM Tenant ID.

Mandatory verification

1. Compare the actual environment variable names against the repository's ".env.example" and the code's "process.env" references.
2. Detect missing, misspelled, duplicated, or incorrectly named variables.
3. Verify that the runtime receives the expected variables without printing or exposing their values.
4. Verify Firebase Admin authentication using the deployment's actual supported credential mechanism, including ADC where available.
5. Verify that the configured Firestore database ID points to the database defined by the project's actual Firebase configuration.
6. Distinguish configuration presence from successful authentication and actual Firestore authorization.

Secret-handling restrictions

- Never print secret values.
- Never include credentials in logs, reports, screenshots, test output, or error messages.
- Never expose secrets to frontend bundles.
- Never request the project owner to paste secrets into the conversation.
- Never perform live Trello API operations in this phase.
- Never register or activate a Trello webhook in this phase.
- Never perform production data mutations to test credentials.

Report configuration verification using variable names and statuses only, such as:

"PRESENT", "MISSING", "MISNAMED", "NOT_INHERITED_BY_RUNTIME", "AUTHENTICATION_FAILED", "VERIFIED".

Important: The presence of an environment variable does not prove that its value is valid or that its corresponding service is accessible.

---

# STOP RULE — STRICT

STOP immediately after completing the Phase 1.1.1 implementation, verification, and documentation.

Do not begin Phase 2.

Do not register webhooks.

Do not perform historical backfill.

Do not initiate live Trello synchronization.

Do not modify production data.

Do not automatically proceed to another phase.

Return the complete report, verification matrix, test results, changed-file list, and final acceptance decision.

Then WAIT for explicit human review and authorization.

**The project owner must review the actual remediation evidence before Phase 2 is authorized.**

**A successful build is not proof of data integrity.**

**A passing unit-test suite is not proof of concurrency safety.**

**A successful HTTP response is not proof of durable processing.**

**A generated report is not proof that the reported changes exist.**

Your responsibility ends when the remediation has been implemented, verified to the extent possible, accurately documented, and handed over for review.
