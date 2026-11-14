# PHASE 10 SECURITY PREFLIGHT — Security & Tenant Isolation Audit Report

**Project:** PROGILIC CRM v3  
**Phase:** PHASE 10 SECURITY PREFLIGHT — Security, Tenant Isolation & Build Artifact Hardening  
**Date:** 2026-11-14  
**Policy:** Zero customer PII, phone numbers, credentials, tokens, or unredacted dumps recorded in audit documentation.

---

## 1. Security Vulnerabilities & Exposure Vectors Audited & Remediated

| # | Severity | Component / File | Finding | Remediation Applied |
|---|---|---|---|---|
| 1 | **CRITICAL** | `vite.config.js`, `scripts/postbuild.js`, `dist/` | Vite copied all files under `public/` directly into `dist/`, exposing sensitive raw session/RPC log files, prompts, PDFs, HTML mockups, and dev screenshots (`dist/assets/aistudio/*` and root dev `*.png` screenshots) as static web assets. | Added `sanitize-dist-artifacts` Vite `closeBundle()` plugin and `sanitizeAndAuditDist()` post-build gate in `scripts/postbuild.js` that removes `dist/assets/aistudio` and non-runtime screenshots and fails the build if any forbidden artifact remains. |
| 2 | **HIGH** | `vite.config.js` (`/api/ai`, `/api/trello/classify`) | Vite dev server middleware accepted unauthenticated POST requests without checking Firebase ID Bearer tokens or Trello principal constraints, had no payload size guard, and returned raw error messages. | Wired `extractBearerToken()`, `verifyFirebaseIdToken()`, and `assertTrelloAuthorizedPrincipal()` (for `/api/trello/classify`), enforced a 1 MB request body limit (`413`), `Cache-Control: no-store`, and sanitized 500 error responses. |
| 3 | **MEDIUM-HIGH** | `server.js` (`/api/trello/oauth/start`, `/api/trello/oauth/callback`, `/api/ai`, static file server) | OAuth start accepted `?token=` in query parameters (exposing JWTs to access logs/history); OAuth callback did not sanitize `returnUrl` against open redirects (`//...` or external URLs); static server lacked explicit `403` blocks on `/assets/aistudio/*`, dotfiles, `*.md`, `*.pdf`, `*.map`, and `/firebase-applet-config.json` and lacked security headers. | Removed `?token=` query parameter acceptance (header-only `Authorization: Bearer`), enforced strict relative-path sanitization on `returnUrl`, added `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy: strict-origin-when-cross-origin`, `Cache-Control: no-store` on APIs, normalized path traversal check with `path.resolve`, explicitly returned `403` for forbidden paths, and sanitized `/api/ai` input & error output. |
| 4 | **MEDIUM** | `firestore.rules` & `firebase-blueprint.json` | Defined `isValidUser()` and `isValidEmployee()` validators were unused on `/users/{userId}` and `/users/{userId}/employees/{employeeId}`; `firebase-blueprint.json` omitted `activities`, `trello_sync`, and `trello_review` entities/routes. | Enforced `isValidUser(incoming())` on `users/{userId}` `create, update` and `isValidEmployee(incoming())` on `employees/{employeeId}` `create, update` (blocking plaintext `password`/`pwd` fields); aligned `firebase-blueprint.json` with all collections. |
| 5 | **MEDIUM** | `src/business/storage.js` (`clearAllData`), `src/business/purgeService.js` (`executePurge`) | Destructive bulk wipe/purge paths did not enforce Gérant / `clients.delete` RBAC guards in business logic and used unchunked `writeBatch()` risking >500-op Firestore batch failure. | Enforced `isGerant() \|\| hasPermission('clients.delete')` and chunked `writeBatch` commits (max 400 operations per batch). |

---

## 2. Verified Non-Leakage Checks

- **Client Bundle Environment Audit (`VITE_*` / Secrets):** Verified `GEMINI_API_KEY`, `TRELLO_OAUTH_CLIENT_SECRET`, `TRELLO_WEBHOOK_SECRET`, and Admin credentials reside exclusively on server routes (`server.js`, `vite.config.js`, `src/server/*`) and are never injected into client `dist/` bundles.
- **Tenant Isolation Integrity:** `firestore.rules` maintains strict deny-by-default (`allow read, write: if false`) and `isOwner(userId)` tenant scoping across every subcollection; backend `assertTenantAccess()` and `FirestoreAdminRepository` fail closed on tenant mismatch or traversal IDs.
- **Production Rules Deployment Gate:** Live Firebase deployment was **not** performed automatically; `firestore.rules` lint validation passes locally via `@firebase/eslint-plugin-security-rules`.

---

## 3. Residual Environment Note

- Live Firestore rule evaluation against production project `gen-lang-client-0400245577` remains `BLOCKED_BY_ENVIRONMENT / REQUIRES_PRODUCTION_ACCESS` until an authenticated Firebase session is available.
