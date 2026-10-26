# Implementation Plan: Automatic Multi-User Real-time Sync & General Timeline Architecture

## Problem Diagnosis
Employees without `timeline.view` permission could perform CRM actions (e.g., adding/editing clients, licenses, tickets, contacts), but their actions were not showing up in real-time in the General Timeline (`المخطط الزمني العام`) for the President/Gérant.
- **Root Cause 1 (Session UID Collision):** `loginAsEmployeeSession` set `currentUser.uid` to the employee's ID (`emp_...`). All subsequent database and activity operations attempted to write to `users/${emp.id}/activities`, which failed Firestore security rule `match /users/{userId}/activities` (`request.auth.uid == userId`) with `permission-denied`.
- **Root Cause 2 (Actor UID Invariant):** `isValidActivity` in `firestore.rules` enforces `data.actorUid == userId`.
- **Root Cause 3 (Permission Wiping):** `loadGlobalActivities` cleared `S.globalActivities = []` if the active user lacked `timeline.view`.

## Completed Remediation
1. **Tenant ID Preservation (`src/business/employeeService.js`):**
   - In `loginAsEmployeeSession(emp)`: Preserves tenant UID as `uid` / `tenantId`, while recording the employee ID in `employeeId` and `currentStaffUser`.
   - In `exitEmployeeSession()`: Restores Gérant profile cleanly.
2. **Tenant ID Priority (`src/state/store.js`):**
   - In `getActiveTenantId()`: Prioritizes `auth.currentUser.uid` first.
   - In `setCurrentUser(newUser)`: Prevents clearing `staffUsers` during employee login switches.
3. **Database Security & Path Sanitization (`src/firebase/service.js`):**
   - In `sanitizeUserId(userId)`: Resolves to `auth.currentUser.uid` when authenticated.
   - In `saveTenantActivity(tenantId, activity)`: Sets `actorUid: safeTenantId`, ensuring strict pass of `isValidActivity(incoming(), userId)`.
4. **Unconditional Background Activity Synchronization (`src/business/timelineService.js`):**
   - In `logActivity`: Captures the employee's actual name and department in `userName`, `userRole`, and `userId`, while routing persistence to `saveTenantActivity(tenantId, activity)`.
   - In `loadGlobalActivities`: Removed `S.globalActivities = []` wipe. View restriction is strictly isolated to `renderGlobalTimeline()`.
5. **Real-time Pipeline Validation:**
   - Real-time listener `onSnapshot(activitiesCollRef)` automatically streams new employee operations directly to the Gérant's dashboard without manual page refreshes or permission workarounds.
