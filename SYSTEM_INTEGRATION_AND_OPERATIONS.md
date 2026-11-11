# PROGILIC CRM v3 — System Integration, Operational Runbook & Architecture Specification

**System Version:** PROGILIC CRM v3 (Enterprise Cloud Architecture)  
**Security Classification:** Strict Enterprise Confidential  
**Certified Target Account:** `progilicservice@gmail.com`  
**Production Gate Controller:** `TRELLO_PRODUCTION_GATE_UNLOCKED`  

---

## 1. Executive Summary & Architectural Overview

PROGILIC CRM v3 is an enterprise-grade Customer Relationship Management and Intelligence platform engineered for Algerian commercial enterprises and software licensing workflows. The platform operates on a resilient dual-tier architecture:
1. **Frontend Presentation & Reactive Store:** High-performance, zero-framework reactive UI with complete offline-first capability, IndexedDB local persistence, client-side Firebase Auth, and real-time Firestore listeners.
2. **Server-Side Integration & Synchronization Gateway:** Express/Node.js secure backend orchestrating Trello webhook ingestion, constant-time HMAC-SHA1 authentication, server-controlled tenant isolation, Gemini AI card classification, deterministic routing, and distributed lease-fenced transactions via the Firebase Admin SDK.

---

## 2. Server Startup & Deployment Topologies

### 2.1 Development Startup
In local development and continuous testing environments:
```bash
# Starts Vite development server with proxy rules configured
npm run dev
```
- **Port:** Defaults to `3000` (or `PORT` environment variable).
- **Behavior:** Serves ES modules natively via Vite. Dynamic backend proxy redirects `/api/*` to the Node.js API handlers.
- **Safety Mode:** Operates strictly under `TRELLO_PRODUCTION_GATE_UNLOCKED=false`. Real Trello webhooks are not registered; mock/synthetic payloads are validated against the sandbox guard.

### 2.2 Production Startup (Full-Stack Mode)
In production deployment (Google Cloud Run, Linux VM, or containerized Docker):
```bash
# Builds the production distribution and boots the Node.js production server
npm run build
npm run start   # Executes: node server.js --start
```
- **Entrypoint:** `server.js` boots an Express production server that:
  - Serves static pre-compiled assets from `/dist` with immutable cache headers.
  - Mounts API routes under `/api/trello`, `/api/health`, and `/api/sync`.
  - Initializes the Firebase Admin SDK using Google Cloud Application Default Credentials (ADC) or explicit project identifiers (`GOOGLE_CLOUD_PROJECT` / `FIRESTORE_DATABASE_ID`).

---

## 3. Webhook Authentication, Integrity & Payload Protection

### 3.1 Cryptographic Signature Verification
Trello signs incoming webhook POST requests with an HMAC-SHA1 hash of the raw body and callback URL:
- **Algorithm:** `HMAC-SHA1`
- **Secret:** `TRELLO_WEBHOOK_SECRET`
- **Integrity Requirement:** Comparison is performed strictly using `crypto.timingSafeEqual` between binary buffers (`Buffer.from(rawBody, 'utf8')`) to eliminate all timing-attack attack vectors.
- **Callback URL Integrity:** Validated against the registered HTTPS endpoint (`TRELLO_CALLBACK_URL`), ensuring requests cannot be intercepted or redirected to forged endpoints.

### 3.2 Payload Ceiling (Denial-of-Service Defense)
- Maximum allowed incoming webhook payload size: **512 KB** (`524,288 bytes`).
- Requests exceeding this threshold are immediately rejected with **HTTP 413 (Payload Too Large)** prior to JSON parsing or cryptographic evaluation.

### 3.3 Scope & Allowlist Enforcement
- Incoming card actions must match both:
  - `TRELLO_BOARD_ID`: The authorized master board ID.
  - `TRELLO_LIST_ID`: The authorized incoming tickets/leads list ID.
- Events from foreign boards, deleted cards, or unmonitored lists return HTTP 200 with an explicit ignore audit entry (`SKIPPED_UNMONITORED_SCOPE`).

---

## 4. Tenant Isolation & Zero-Trust Authorization

### 4.1 Server-Controlled Tenant Resolution
- Tenant binding is strictly governed by `src/server/tenantResolver.js`.
- The system resolves the authoritative CRM tenant UID via server-side configuration (`TRELLO_TENANT_ID` and `TRELLO_ALLOWED_EMAIL`).
- **Zero-Trust Invariant:** Any `tenantId` or `userId` parameter supplied in the incoming request body, query string, or header is **completely ignored and rejected**.
- Production environments enforce strict single-tenant binding for `progilicservice@gmail.com`.

### 4.2 Firebase Role-Based Access Control (RBAC)
- All client-authenticated API routes validate Firebase ID tokens via `verifyFirebaseIdToken`.
- `assertTenantAccess` verifies that `userTenantId === targetTenantId`.
- **Admin Claim Isolation:** Tokens containing `{ admin: true }` are **NOT** permitted to bypass tenant boundaries. Cross-tenant reads and writes are blocked without exception.
- **Email Verification Mandate:** All write operations and privileged administrative APIs require `token.email_verified === true`.

### 4.3 Admin SDK Path Sanitation & Subcollection Allowlists
In `src/server/firestoreAdminRepository.js`:
- Every document and subcollection path segment is checked against the strict regex:
  ```regex
  ^[a-zA-Z0-9_-]{1,128}$
  ```
- Subcollection access is strictly locked to allowlisted collections:
  - `programs`
  - `issues`
  - `requirements`
  - `contacts`
- Arbitrary document path traversal (`..`, `/`, `\0`, or special characters) is rejected with an immediate fatal security exception.

---

## 5. Distributed Concurrency & Fencing Guarantees

### 5.1 Monotonic Lease Generation
To prevent race conditions, split-brain executions, or concurrent webhook worker overwrites:
1. Every synchronization worker must acquire an atomic distributed lease stored at `users/{tenantId}/locks/trello_sync`.
2. Lease acquisition occurs within a Firestore transaction that checks lease expiration (`expiresAt < now`).
3. Upon acquisition or renewal, the lease increments a monotonically increasing counter:
   ```javascript
   leaseGeneration = previousGeneration + 1
   ```
4. All subsequent database writes verify that the worker holds the active `leaseToken` and `leaseGeneration`. Stale workers attempting writes are fenced and halted immediately.

### 5.2 Error & Retry Semantics
- **Transient Failures (Network/Rate Limits):** Handled with exponential backoff and jitter (maximum 3 retry attempts).
- **Fatal/Semantic Errors (Validation/Authentication):** Fail closed immediately with dead-letter logging in the activity audit collection (`ActivityType.SECURITY_ALERT`).

---

## 6. AI Classification & Deterministic Business Safety

### 6.1 Gemini AI Extraction Pipeline
- Unstructured Trello card titles, descriptions, and checklists are processed via Google Gemini API (`gemini-2.5-flash`).
- **Confidence Gate:** `AI_CONFIDENCE_THRESHOLD = 0.70`.
  - Predictions with confidence score $\ge 0.70$ are routed to automated ingestion.
  - Predictions with confidence $< 0.70$ are tagged for manual administrative review (`NEEDS_REVIEW`).

### 6.2 Deterministic Safety Net
- AI output is treated as **untrusted suggestion**.
- Every extracted client, program version, wilaya, and issue priority passes through `src/business/trello/deterministicRouter.js`.
- Invalid wilayas, malformed phone numbers, or unapproved software versions are sanitized or mapped to safe defaults (`الجزائر`, `تجاري`, `متوسط`).
- Heuristic fallback guarantees complete operational continuity if the Gemini API is unavailable or throttled.

---

## 7. Operational Endpoints

| Endpoint | Method | Security Level | Functionality |
| :--- | :---: | :--- | :--- |
| `/api/health` | `GET` | Public / Monitoring | System health, uptime, memory, version, and status |
| `/api/trello/readiness` | `GET` | Authenticated / Admin | Trello configuration, board binding, and gate status |
| `/api/trello/webhook` | `HEAD` | Public / Trello Handshake | Trello webhook registration handshake (HTTP 200) |
| `/api/trello/webhook` | `POST` | HMAC-SHA1 Verified | Ingests card events, synchronizes CRM records |
| `/api/trello/sync` | `POST` | Gerant Authenticated | Manual batch synchronization trigger |

---

## 8. Live Production Go-Live Protocol

To transition from the secured Sandbox mode to live operational synchronization:

1. **Configure Environment Secrets:**
   ```bash
   TRELLO_API_KEY="<actual_trello_api_key>"
   TRELLO_API_TOKEN="<actual_trello_member_token>"
   TRELLO_WEBHOOK_SECRET="<actual_trello_signing_secret>"
   TRELLO_BOARD_ID="<target_board_id>"
   TRELLO_LIST_ID="<target_list_id>"
   TRELLO_ALLOWED_EMAIL="progilicservice@gmail.com"
   TRELLO_TENANT_ID="<crm_tenant_uid>"
   TRELLO_CALLBACK_URL="https://your-domain.app/api/trello/webhook"
   GEMINI_API_KEY="<actual_gemini_api_key>"
   ```

2. **Unlock the Production Gate:**
   Set:
   ```bash
   TRELLO_PRODUCTION_GATE_UNLOCKED="true"
   ```

3. **Verify Readiness:**
   Send a request to `/api/trello/readiness`. Confirm that `productionGateUnlocked: true` and `status: "ready"`.

4. **Verify Live Webhook Handshake:**
   Register the webhook with Trello:
   ```bash
   POST https://api.trello.com/1/webhooks/
   ```
   Confirm incoming events trigger real-time card classification into PROGILIC CRM v3.
