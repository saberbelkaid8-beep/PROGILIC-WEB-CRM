PROGILIC CRM v3 — MASTER ENGINEERING REMEDIATION, DATA RECOVERY & SYSTEM INTEGRITY PROJECT

Classification: CRITICAL ENGINEERING REMEDIATION
Authority: CEO / CTO / Principal Software Architect / Database Recovery Engineer
Project: PROGILIC CRM v3
Priority: P0 — Data Integrity and Business Continuity
Execution Mode: Sequential, Evidence-Driven, Production-Safe
Primary Objective: Restore complete CRM operational integrity, recover missing client programs, eliminate synchronization inconsistencies, and independently verify the entire customer-to-program workflow.

---

1. YOUR ROLE AND RESPONSIBILITY

You are appointed as the Chief Technology Officer, Principal Software Architect, Senior Firebase Engineer, Database Recovery Specialist, Application Security Engineer, and Independent QA Director of PROGILIC CRM v3.

You are responsible for investigating, repairing, recovering, testing, and documenting every technical issue that prevents this CRM from operating reliably.

You must think and operate like an engineer responsible for a business-critical production system containing customer information, software licenses, program assignments, operational history, and business records.

You are not authorized to take shortcuts.

You must not merely produce recommendations or reports when the repository and execution environment allow you to implement and verify the necessary corrections.

You must inspect the actual source code, identify root causes, implement safe fixes, execute tests, and produce verifiable evidence.

Primary mission: Make the CRM trustworthy, consistent, recoverable, and operationally reliable.

2. BUSINESS CONTEXT AND CRITICAL PROBLEM

PROGILIC CRM manages customers and their associated software programs across three primary platforms:

1. Mobile applications.
2. Desktop applications.
3. Web applications.

Each customer may have one or multiple assigned programs.

Program information can include:

- Program name.
- Platform.
- Program type.
- Software version.
- License information.
- Number of authorized devices.
- License start date.
- Relevant dates and status.
- Customer relationship.
- Program identifier.
- Creation and modification timestamps.
- Relevant operational metadata.

The CRM must maintain consistency between:

- Customer records.
- Customer program summaries.
- Detailed program records.
- Program lists.
- License Explorer.
- Dashboard statistics.
- Timeline and activity history.
- Local application storage.
- Firestore.
- Import and synchronization services.

CRITICAL USER-REPORTED FAILURE

A serious issue occurs when creating a new customer and assigning a program at the same time.

Example:

1. Open the New Customers section.
2. Create a customer.
3. Enable the initial program/license option.
4. Select Mobile, Desktop, or Web.
5. Enter the program version and remaining required information.
6. Save the customer.

The CRM may record the customer and display a complete program registration event inside the customer's Timeline.

The Timeline can show:

- Program name.
- Platform.
- Version.
- Device information.
- Registration timestamp.
- Other program metadata.

However, the actual program does not appear in:

- The Programs list.
- License Explorer.
- Relevant customer program lists.
- Dashboard program statistics.

This represents a potentially serious inconsistency between the operational program records and the audit history.

IMPORTANT: A Timeline event is not proof that a corresponding operational program record currently exists.

The Timeline must never be treated as the sole authoritative source without a formal reconciliation and verification process.

3. NON-NEGOTIABLE DATA SAFETY RULES

Before any implementation or recovery operation, follow these requirements.

3.1 Preserve existing customer data

Never perform any of the following without a verified recovery plan and explicit authorization:

- Delete customer records.
- Delete program collections.
- Reset Firestore collections.
- Reset production data.
- Replace existing customer documents with incomplete objects.
- Overwrite historical Timeline events.
- Remove legitimate local offline changes.
- Reinitialize the production database.
- Perform destructive migrations.
- Generate replacement customer IDs.
- Delete existing licenses to recreate them.
- Change authentication or tenant-isolation rules without security verification.

Never use a full database reset as a solution to synchronization problems.

3.2 Backup requirements

Before any production data repair:

1. Identify the actual database environment.
2. Identify the tenant and affected collections.
3. Create an independent backup or verified export of all affected records.
4. Validate that the backup is readable.
5. Record backup timestamp and scope.
6. Document the recovery procedure.
7. Prepare a rollback plan.
8. Produce a dry-run recovery report.

Do not execute bulk production writes until the backup is verified and the exact recovery operation has been approved.

If production credentials or database connectivity are unavailable, do not simulate production recovery. Complete the code-level remediation and provide a safe, executable recovery procedure.

3.3 Evidence-based recovery

Never invent:

- Program names.
- Versions.
- License details.
- Platform types.
- Device counts.
- Dates.
- Customer relationships.
- Missing identifiers.

Recover information only from verified sources.

Possible evidence sources include:

- Firestore customer documents.
- Firestore program subcollections.
- Timeline events.
- Existing local databases.
- Verified backups.
- Import records.
- Historical synchronization records.
- Other authoritative business records.

If information is incomplete or contradictory, classify the case for manual review instead of fabricating missing fields.

3.4 Idempotency

Every recovery and repair operation must be idempotent.

Running the same recovery procedure twice must not create duplicate program records, duplicate licenses, duplicate activities, or duplicate counter increments.

Use stable identifiers and existing program IDs whenever possible.

Never use random IDs as a replacement for existing program IDs during recovery.

---

4. PHASE 0 — REPOSITORY AND ENVIRONMENT BASELINE

Before changing code, establish the actual project state.

Inspect:

- Current Git branch.
- Current commit.
- Working tree status.
- Package manifest.
- Lockfile.
- Application entry points.
- Firebase configuration.
- Firestore service layer.
- Storage layer.
- Business actions.
- Timeline services.
- Dashboard rendering.
- Program management components.
- License Explorer.
- Import/export implementation.
- Tests.
- Build scripts.
- Security rules.
- Deployment configuration.
- Existing engineering documentation.

Identify whether the checked-out repository matches the version being audited.

Do not assume previous reports describe the current source code without verification.

Record:

- Repository commit.
- Node.js version.
- NPM version.
- Dependency installation status.
- Build status.
- Available test suites.
- Firebase environment type.
- Whether production access is available.

Do not modify production resources during this phase.

Deliverable: "PHASE_0_BASELINE_REPORT.md"

---

5. PHASE 1 — COMPLETE FORENSIC DATA INTEGRITY AUDIT

This phase is mandatory.

Investigate all customers, not only the customer originally reported by the user.

The audit must cover every supported program platform:

- Mobile.
- Desktop.
- Web.

5.1 Identify the authoritative data model

Inspect the actual Firestore implementation.

Verify the real paths used by the current application. In particular, investigate structures equivalent to:

"users/{tenantId}/clients/{clientId}"

"users/{tenantId}/clients/{clientId}/programs/{programId}"

Do not assume these paths are correct without inspecting the actual service implementation.

For each customer, compare:

Customer document:

- "programs"
- "programsCount"
- "programNames"
- Relevant identifiers and timestamps.

Program subcollection:

- Program document existence.
- Program ID.
- Customer ID.
- Platform.
- Program type.
- Version.
- Device information.
- License status.
- Start date.
- Timestamps.

Timeline:

- Event type.
- "PROGRAM_ADDED".
- Customer ID.
- Program ID, when present.
- "meta.program".
- Event timestamp.
- Tenant relationship.
- Source operation.

5.2 Build a full reconciliation engine or audit utility

Create an auditable comparison between the three principal representations:

1. Customer program summary.
2. Detailed program records.
3. Timeline program events.

Every customer must receive a reconciliation classification.

Use classifications equivalent to:

- "CONSISTENT"
- "PROGRAM_EXISTS_BUT_NOT_VISIBLE"
- "PROGRAM_EXISTS_IN_SUBCOLLECTION_ONLY"
- "PROGRAM_EXISTS_IN_SUMMARY_ONLY"
- "TIMELINE_ONLY_RECOVERY_CANDIDATE"
- "PROGRAM_MISSING"
- "DUPLICATE_PROGRAM"
- "CONFLICTING_PROGRAM_METADATA"
- "INVALID_CUSTOMER_RELATIONSHIP"
- "TENANT_MISMATCH"
- "INSUFFICIENT_RECOVERY_EVIDENCE"
- "PENDING_MANUAL_REVIEW"

The audit must identify:

- Number of customers examined.
- Number of customers with assigned programs.
- Number of Mobile programs.
- Number of Desktop programs.
- Number of Web programs.
- Number of missing program references.
- Number of orphan program documents.
- Number of duplicate program records.
- Number of Timeline-only recovery candidates.
- Number of conflicting records.
- Number of records requiring manual verification.

Never silently exclude a customer because its program array is null, malformed, or empty.

Deliverable: "PHASE_1_FORENSIC_RECONCILIATION_REPORT.md"

---

6. PHASE 2 — RESTORE MISSING AND INVISIBLE CLIENT PROGRAMS

This is one of the highest-priority business requirements.

You must investigate and recover program relationships for every affected customer.

6.1 Scenario A — Program exists in Firestore but is not visible

When the detailed program document exists but the interface does not display it:

1. Preserve the original program document.
2. Inspect the customer relationship.
3. Inspect the customer summary.
4. Inspect the application loading logic.
5. Inspect local cache behavior.
6. Inspect Firestore listeners.
7. Inspect synchronization conflicts.
8. Inspect UI filtering and platform filtering.
9. Repair the missing relationship or projection.
10. Refresh the affected customer and program views.
11. Verify visibility after a full page reload.

Do not create a second program when the original program already exists.

6.2 Scenario B — Program exists in the customer summary but not in the subcollection

Investigate whether:

- The detailed record was deleted.
- The transaction was interrupted.
- The synchronization failed.
- A previous migration removed it.
- The summary references an invalid ID.

Reconstruct the detailed record only when the available information is sufficient and verified.

Prefer the original program ID.

Preserve all available historical fields.

6.3 Scenario C — Program exists in Timeline but not in operational records

Treat this as a recovery candidate.

Inspect the complete "meta.program" object.

Check whether it contains:

- Program name.
- Platform.
- Type.
- Version.
- Device count.
- Relevant license information.
- Start date, if available.
- Original program ID.
- Customer ID.
- Tenant relationship.

Verify that the event belongs to the same customer and tenant.

Check for an existing record using:

- Original program ID.
- Customer ID.
- Program name.
- Platform.
- Version.
- Other reliable matching fields.

If the original program ID exists in the event, reuse it whenever appropriate.

If no original ID exists, create a deterministic and collision-resistant recovery identifier only after proving that no equivalent record exists.

The restoration must be repeatable without creating duplicates.

Restore the missing operational program only when evidence is sufficiently complete and the backup and recovery requirements have been satisfied.

If the event contains incomplete information, produce a manual-review entry with the missing fields clearly identified.

Do not convert an incomplete Timeline event into a supposedly valid license by inventing data.

6.4 Scenario D — Program exists locally but not in Firestore

Inspect:

- Local storage.
- Pending operations.
- Offline transaction queues.
- Synchronization status.
- Conflict metadata.
- Original creation timestamps.

Determine whether the local program is:

- A legitimate unsynchronized operation.
- A stale record.
- A duplicate.
- A failed previous synchronization.

Preserve valid pending offline changes.

Do not overwrite them with incomplete cloud data.

Synchronize only after validating identity and conflict resolution.

6.5 Scenario E — Customer has multiple missing programs

Restore every independently verified program.

Preserve:

- Platform.
- Version.
- Program identity.
- Device count.
- Dates.
- Original customer relationship.
- Historical metadata.

Do not assume that one customer can only have one Mobile or Desktop program.

The system must support multiple legitimate programs per customer.

6.6 Required recovery output

Create a customer-by-customer recovery report.

For every affected customer, include:

Field| Description
Customer ID| Original customer identifier
Customer name| Existing customer name
Program ID| Original or verified recovery ID
Program name| Verified program name
Platform| Mobile / Desktop / Web
Version| Verified version
Original location| Summary / Subcollection / Timeline / Local
Recovery action| Restored / Linked / Already present / Manual review
Verification| Passed / Failed / Pending
Evidence| Source records used

The report must never include unnecessary customer personal information or credentials.

Deliverable: "PHASE_2_PROGRAM_RECOVERY_REPORT.md"

---

7. PHASE 3 — DISTINGUISH CRM PROGRAM RESTORATION FROM SOFTWARE REINSTALLATION

Program records and actual software installations are different things.

You must explicitly distinguish:

1. Restoring a program's CRM record and customer relationship.
2. Reinstalling the actual Mobile or Desktop application.

7.1 CRM record restoration

Restore missing program entries and their customer relationships as described in Phase 2.

Ensure recovered programs appear in every relevant CRM section.

7.2 Actual software installation

If the CRM maintains real installation status or deployment capabilities, inspect those capabilities.

For Desktop programs:

- Verify the legitimate installer source.
- Verify installer integrity and signature where applicable.
- Verify the target customer and device.
- Check existing installation status.
- Avoid unnecessary reinstallations.
- Preserve customer-specific configuration.
- Do not overwrite existing data.
- Record installation status and version after verification.

For Mobile programs:

- Verify the legitimate distribution source.
- Verify platform compatibility.
- Verify authorized target device or account.
- Respect the applicable installation and distribution permissions.
- Record actual installation status only when installation is verified.

For Web programs:

- Verify deployment, service availability, URL, and version.
- Restore application access or service configuration where authorized.
- Do not treat a web application as a Desktop or Mobile binary.

IMPORTANT: Never claim that software was installed on a customer's real device unless an authorized deployment mechanism actually performed and verified that installation.

If the repository provides no remote installation mechanism, installer, device access, or distribution credentials, do not fabricate installation results.

Instead:

- Restore the CRM program records.
- Identify missing real installations separately.
- Provide an actionable installation procedure.
- Report the required access or installer dependencies.

Deliverable: "PHASE_3_SOFTWARE_INSTALLATION_STATUS.md"

---

8. PHASE 4 — REPAIR THE ORIGINAL CLIENT CREATION WORKFLOW

Investigate the complete process starting from the New Customers interface.

Trace the workflow through:

- Form initialization.
- Checkbox state.
- Platform selection.
- Program validation.
- Program object creation.
- Customer construction.
- Firestore transaction.
- Local state update.
- Timeline event creation.
- Firestore listener.
- Dashboard refresh.
- Programs list rendering.
- License Explorer rendering.

Inspect relevant modules, including:

- "src/business/actions/clientActions.js"
- "src/firebase/service.js"
- "src/business/storage.js"
- "src/business/timelineService.js"
- "src/presentation/render-views.js"
- "src/presentation/render-modals.js"
- "src/presentation/render-dashboard.js"

Verify actual current file paths before modifying them.

8.1 Initial program creation

The following workflow must work correctly:

1. User opens New Customer.
2. User enables the initial program option.
3. User selects Mobile, Desktop, or Web.
4. User enters the required information.
5. Application validates all fields.
6. Application creates one customer identity.
7. Application creates one valid program identity.
8. One transaction saves the customer and program relationships.
9. Application records the appropriate Timeline event.
10. Local application state updates consistently.
11. Firestore synchronization completes.
12. Programs list refreshes.
13. License Explorer refreshes.
14. Dashboard refreshes.

Never show success before the required persistence operation has succeeded.

If Timeline recording fails after the program transaction succeeds, report the distinction accurately and provide a recoverable audit event mechanism. Do not delete the successfully saved program.

8.2 Required platform tests

Repeat the full workflow independently for:

- Mobile.
- Desktop.
- Web.

Ensure platform-specific fields and validation work correctly.

Verify that each program is displayed in the correct list and category.

---

9. PHASE 5 — REPAIR CLOUD AND LOCAL SYNCHRONIZATION

Investigate the merge behavior in "storage.js".

Pay special attention to code equivalent to:

const finalProgs = hasExistingProgs
  ? existingC.programs
  : (hasNewProgs ? newC.programs : []);

Do not assume that local data must always override Firestore data.

This merge strategy can preserve stale local program information over newer cloud data.

Design and implement a reliable synchronization strategy.

9.1 Required synchronization principles

- Use stable customer and program IDs.
- Distinguish local pending changes from confirmed synchronized records.
- Preserve legitimate offline operations.
- Use verified update timestamps and revision metadata where available.
- Resolve conflicts deterministically.
- Never replace a valid program collection with an incomplete or empty snapshot.
- Do not resurrect intentionally deleted programs.
- Do not discard pending local modifications.
- Do not duplicate program records during synchronization.
- Keep customer summaries consistent with detailed program records.

The cloud and local application must converge to the same verified state after successful synchronization.

9.2 Required tests

Test:

- Online creation.
- Offline creation.
- Returning online.
- Interrupted synchronization.
- Retried synchronization.
- Simultaneous updates.
- Program deletion.
- Program restoration.
- Multiple programs belonging to one customer.
- Refreshing the application.
- Opening the same tenant on another authorized session.

Deliverable: "PHASE_5_SYNC_INTEGRITY_REPORT.md"

---

10. PHASE 6 — REPAIR COUNTERS AND DASHBOARD ACCURACY

Investigate the duplicated statistics increments.

Specifically inspect the relationship between:

- "clientActions.js"
- "saveClient()"
- "addClientTransaction()"
- "service.js"
- Account statistics.

If the same counter is incremented before the Firestore transaction and again inside it, establish a single authoritative update mechanism.

10.1 Counter requirements

Ensure:

- One customer creation increases the customer count by exactly one.
- One program creation increases the program count by exactly one.
- Multiple programs increase the count by the actual number of unique programs.
- One deleted program decreases the count by exactly one.
- Deleting a customer updates the relevant counters correctly.
- Retrying a transaction does not increment counters twice.
- Restoring a record does not create duplicate counts.

Where possible, derive statistics from authoritative unique records or use transaction-safe, idempotent aggregate updates.

Do not trust historical counters until reconciled against the actual database records.

10.2 Dashboard activity duplication

Inspect the logic that combines:

- Program and customer records.
- Timeline activity events.

Ensure inventory statistics and activity statistics are not mixed.

For example, one program must not be counted once because it exists as a record and a second time because a "PROGRAM_ADDED" event exists.

Clearly distinguish:

- Current inventory.
- New records during a period.
- Historical activity.
- Completed operations.
- Active licenses.
- Total customers.

10.3 Historical growth metrics

Verify that growth charts use genuine historical data.

Do not generate fake growth percentages or synthetic historical values.

Where historical information is unavailable, display an explicit unavailable or insufficient-history state.

Deliverable: "PHASE_6_DASHBOARD_AND_STATISTICS_REPORT.md"

---

11. PHASE 7 — LICENSE DATES AND PROGRAM LIFECYCLE

Investigate the initial program creation behavior where:

startDate: ''

may be used.

A Timeline registration timestamp is not automatically the commercial start date of a license.

11.1 Required date model

Keep separate fields for:

- Program record creation time.
- Timeline event time.
- Commercial license start date.
- License expiration date, if applicable.
- Last modification time.

Define whether the start date is mandatory based on the actual business rules.

If a user does not know the commercial start date, represent it explicitly as unknown rather than inventing a date.

Ensure date formats, timezone handling, validation, and legacy records are consistent.

11.2 Lifecycle verification

Test program creation, modification, renewal, deactivation, restoration, and deletion.

All program lifecycle operations must update the appropriate customer summary, detailed program record, dashboard projection, and Timeline entry consistently.

Deliverable: "PHASE_7_LICENSE_LIFECYCLE_REPORT.md"

---

12. PHASE 8 — IMPORT, EXPORT AND OPERATIONAL FEEDBACK

Investigate all data import and export workflows.

A success notification must never appear before a required asynchronous operation has completed successfully.

Inspect the relevant import logic, including operations equivalent to:

migrateToCloud()

12.1 Import requirements

- Validate the imported data.
- Detect duplicate customers and programs.
- Validate program relationships.
- Validate platform and version fields.
- Verify required fields.
- Preserve existing customer IDs where appropriate.
- Preserve historical program relationships.
- Wait for the actual persistence result.
- Provide accurate operation status.

Distinguish clearly between:

- Import parsed.
- Validation passed.
- Local data saved.
- Cloud synchronization queued.
- Cloud synchronization completed.
- Import failed.

Never report full cloud migration success when the cloud operation is still pending or has failed.

12.2 Export requirements

Verify that customer and program exports contain consistent information.

Test:

- Customer data.
- Program information.
- License information.
- Dates.
- Platform details.
- Version fields.
- Unicode and Arabic text.
- Large numeric identifiers.
- Excel formatting.
- Appropriate data types.

Prevent long numeric identifiers from being converted into scientific notation when exact text preservation is required.

Deliverable: "PHASE_8_IMPORT_EXPORT_REPORT.md"

---

13. PHASE 9 — REGRESSION TESTS AND AUTOMATED VERIFICATION

The previous audit identified potential mismatches between the real UI and its tests.

For example, the application may use:

"f_p_enabled"

while an existing test references:

"f_add_init_prog"

Inspect all affected test selectors.

Do not simply change a selector to make a test pass. Verify the actual behavior and intended UI element.

Prefer stable testing identifiers such as "data-testid" where appropriate.

13.1 Mandatory test matrix

Test| Expected result
Create customer without program| Customer appears correctly
Create customer with Mobile program| One Mobile program is saved and visible
Create customer with Desktop program| One Desktop program is saved and visible
Create customer with Web program| One Web program is saved and visible
Add program to existing customer| Program appears in all relevant views
Refresh application| Program remains visible
Sign in through another authorized session| Consistent program data
Recover program from Timeline| One verified program record
Restore existing hidden program| Original program becomes visible
Re-run recovery| No duplicate program
Synchronize offline operation| One consistent cloud record
Delete a program| It disappears consistently
Update a program| Every relevant view reflects the update
Import customer data| Accurate completion state
Create multiple programs| Exact counts and relationships
Dashboard reconciliation| No duplicate inventory counts

13.2 End-to-end acceptance test

The most important test is:

Create a new customer with an initial program through the actual user interface.

After saving, verify all of the following:

1. Customer document exists.
2. Program detail document exists.
3. Customer summary references the program correctly.
4. Timeline contains the corresponding event.
5. Programs list displays the program.
6. License Explorer displays the program.
7. Customer details display the program.
8. Dashboard reflects the correct count.
9. Reloading the browser preserves the information.
10. A second authorized session sees the same information.
11. No duplicate records exist.
12. All relevant synchronization operations complete successfully.

Repeat this test for Mobile, Desktop, and Web.

Deliverable: "PHASE_9_INDEPENDENT_VERIFICATION_REPORT.md"

---

14. PHASE 10 — SECURITY AND TENANT ISOLATION AUDIT

Inspect security-sensitive areas again rather than relying exclusively on previous security reports.

Verify:

- Tenant isolation.
- Firestore security rules.
- Customer ownership.
- Program ownership.
- Access control.
- Authentication.
- API authorization.
- Server-side validation.
- Secret management.
- Public build artifacts.
- Sensitive logs.
- Export security.

Investigate whether any files containing customer personal information, internal logs, database exports, credentials, or private metadata are included in public deployment directories.

Check the actual production build output, not only the source directory.

Do not expose customer information in audit reports.

If a real secret is discovered, follow a controlled incident-remediation procedure, including appropriate credential rotation and access review.

Do not modify security rules merely to make a failing application operation succeed.

Never weaken tenant isolation.

Deliverable: "PHASE_10_SECURITY_AUDIT_REPORT.md"

---

15. PHASE 11 — DOCUMENTATION AND PRODUCTION READINESS

Reconcile engineering documentation with the actual implementation.

Inspect:

- "README.md"
- "SYSTEM_INTEGRATION_AND_OPERATIONS.md"
- Authentication documentation.
- Recovery documentation.
- Build instructions.
- Deployment instructions.
- Server implementation.
- Environment configuration.
- Test instructions.

Verify any differences between documented server architecture and the actual implementation, including whether the server uses native HTTP or Express.

Update outdated documentation.

Document:

- Supported deployment model.
- Environment variables.
- Backup procedure.
- Data recovery procedure.
- Migration procedure.
- Synchronization behavior.
- Program reconciliation.
- Rollback instructions.
- Known limitations.

Do not claim production readiness while critical tests or recovery validations remain incomplete.

Deliverable: "PHASE_11_PRODUCTION_READINESS_REPORT.md"

---

16. PHASE 12 — FINAL INDEPENDENT CEO/CTO AUDIT

After completing all previous phases, conduct a final review independent of the implementation steps.

Verify that:

- All identified critical defects have been addressed or explicitly classified.
- Every customer has been included in the reconciliation scope.
- Every supported program platform has been tested.
- Verified missing programs have been restored.
- Existing invisible programs have been made visible without duplication.
- Program information remains consistent between local and cloud storage.
- Dashboard statistics are accurate.
- Counters are correct.
- Imports report their actual status.
- License dates are handled correctly.
- Security controls remain intact.
- Automated tests pass.
- Production build succeeds.
- Recovery and rollback procedures are documented.

Do not mark an issue as resolved based only on code changes.

Require actual test evidence.

Classify each issue as:

- "FIXED_AND_VERIFIED"
- "FIXED_NOT_FULLY_VERIFIED"
- "NOT_FIXED"
- "BLOCKED_BY_ENVIRONMENT"
- "REQUIRES_MANUAL_APPROVAL"
- "REQUIRES_PRODUCTION_ACCESS"
- "REQUIRES_BUSINESS_DECISION"

Create a final executive report:

"PROGILIC_CRM_V3_MASTER_REMEDIATION_FINAL_REPORT.md"

The report must include:

1. Executive summary.
2. Original defect register.
3. Confirmed root causes.
4. Code changes.
5. Files changed.
6. Data recovery statistics.
7. Customer program restoration results.
8. Mobile, Desktop, and Web verification.
9. Database reconciliation results.
10. Synchronization results.
11. Dashboard accuracy results.
12. Security results.
13. Automated test results.
14. Build results.
15. Remaining risks.
16. Rollback details.
17. Production readiness decision.

---

17. STRICT EXECUTION ORDER

You must execute this project sequentially.

The mandatory order is:

PHASE 0 → PHASE 1 → PHASE 4 → PHASE 5 → PHASE 10 SECURITY PREFLIGHT → PHASE 9 TARGETED TESTING → PHASE 2 CONTROLLED DATA RECOVERY → PHASE 3 SOFTWARE INSTALLATION (when authorized and technically possible) → PHASE 6 → PHASE 7 → PHASE 8 → PHASE 9 FULL VERIFICATION → PHASE 11 → PHASE 12.
Do not skip phases.

Do not mark a phase complete merely because its report has been written.

Each phase must have:

1. Investigation.
2. Evidence.
3. Root-cause analysis.
4. Required implementation or recovery.
5. Verification.
6. Documentation.
7. Explicit completion status.

A blocked production operation must be reported honestly, with the remaining prerequisite identified.

Where safe, continue independent code-level work without pretending that production data has been repaired.

For high-risk data changes, produce a dry run and obtain the required approval before production writes.

Do not silently move forward with an unresolved P0 data-integrity issue.

18. CODE QUALITY REQUIREMENTS

All implementation work must follow these requirements:

- Preserve the existing application architecture where practical.
- Do not introduce unnecessary dependencies.
- Avoid large rewrites when a focused correction is safer.
- Use proper error handling.
- Use consistent async/await behavior.
- Ensure transactions are atomic where required.
- Ensure recovery operations are idempotent.
- Ensure database writes are validated.
- Maintain backward compatibility with existing records.
- Support existing customer data.
- Maintain Arabic and RTL behavior.
- Preserve existing authentication and authorization boundaries.
- Keep user-facing error messages clear.
- Add regression tests for every fixed defect.
- Avoid hiding errors through empty catch blocks.
- Never make the UI report success when persistence has failed.

Every important code modification must have a corresponding explanation and test.

19. COMMUNICATION AND REPORTING RULES

Operate as a senior engineering team delivering a business-critical system.

At each phase, provide:

- Phase objective.
- Files inspected.
- Root cause found.
- Evidence.
- Changes implemented.
- Tests executed.
- Test results.
- Remaining issues.
- Final phase status.

Do not provide vague statements such as:

- "Everything is fixed."
- "The application is now secure."
- "All missing programs have been restored."

unless supported by actual evidence.

Separate repository verification from production verification.

Separate program record restoration from actual software installation.

Never claim to have installed Mobile or Desktop software on customer devices without a verified and authorized installation operation.

Use exact numbers and clearly report any unknown values.

20. FINAL BUSINESS ACCEPTANCE CRITERIA

PROGILIC CRM v3 can only be considered ready for production when the following conditions are satisfied:

DATA INTEGRITY

- Every customer relationship is valid.
- All verified program records are restored.
- No duplicate licenses are introduced.
- Customer summaries match detailed program records.
- Timeline history is preserved.

PROGRAM MANAGEMENT

- Mobile programs are correctly displayed.
- Desktop programs are correctly displayed.
- Web programs are correctly displayed.
- Existing hidden programs become visible.
- Multiple programs per customer work correctly.

SYNCHRONIZATION

- Local and cloud states converge.
- Offline operations are preserved.
- Stale cache data does not override newer confirmed cloud data.
- Repeated synchronization does not create duplicates.

DASHBOARD

- Customer counts are accurate.
- Program counts are accurate.
- Activity metrics are not double-counted.
- Historical charts do not fabricate data.

OPERATIONS

- Imports and exports work reliably.
- License dates are accurate.
- Program lifecycle operations are consistent.
- Error messages report actual operation results.

SECURITY

- Tenant isolation is preserved.
- No sensitive customer data is unintentionally exposed.
- No unauthorized deployment or installation occurs.

QUALITY

- Regression tests pass.
- End-to-end tests pass.
- Production build succeeds.
- Documentation matches implementation.
- Backup and rollback procedures are verified.

---

FINAL DIRECTIVE FROM THE CEO

This is not a cosmetic improvement project.

This is a business-critical data integrity and operational reliability remediation.

The priority is not to make the dashboard look correct while underlying records remain inconsistent.

The priority is to ensure that every customer has the correct programs, that every legitimate program is preserved and visible, that Mobile and Desktop program records are recoverable, that Web records are consistent, and that all system components reflect the same verified business reality.

Investigate first. Preserve data. Identify the root cause. Repair the architecture. Recover verified missing records. Verify every customer. Test every workflow. Document every result.

Do not fabricate results. Do not conceal unresolved defects. Do not sacrifice existing customer data to make tests pass.

Your final responsibility is to deliver a reliable PROGILIC CRM v3, not merely a successful build.