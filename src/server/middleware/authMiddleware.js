/**
 * PROGILIC CRM v3 — Authenticated CRM API Middleware
 * 
 * Cryptographically verifies Firebase ID tokens for protected CRM server endpoints.
 * Validates authenticated user identity and enforces tenant boundary access.
 */

import { getAdminAuth } from '../firebaseAdmin.js';

/**
 * Extracts the Bearer token from the HTTP Authorization header.
 */
export function extractBearerToken(headers = {}) {
  const authHeader = headers.authorization || headers.Authorization || '';
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  return null;
}

/**
 * Verifies a Firebase ID token and extracts the authenticated principal.
 * 
 * @param {string} idToken - The JWT ID token from the client
 * @returns {Promise<Object>} The verified decoded token payload
 */
export async function verifyFirebaseIdToken(idToken) {
  if (!idToken || typeof idToken !== 'string' || idToken.trim() === '') {
    const error = new Error('UNAUTHENTICATED: Missing Bearer ID token.');
    error.status = 401;
    throw error;
  }

  const auth = getAdminAuth();
  if (!auth) {
    const error = new Error('SERVICE_UNAVAILABLE: Firebase Admin Auth is not configured on this server.');
    error.status = 503;
    throw error;
  }

  try {
    const decodedToken = await auth.verifyIdToken(idToken.trim());
    return decodedToken;
  } catch (err) {
    const error = new Error(`UNAUTHORIZED: Invalid or expired ID token (${err.code || err.message}).`);
    error.status = 401;
    throw error;
  }
}

/**
 * Validates that an authenticated request is authorized to access the target tenant.
 * Rejects cross-tenant access and unverified identities.
 * 
 * @param {Object} decodedToken - The verified Firebase user token
 * @param {string} targetTenantId - The tenantId being requested
 * @returns {boolean} True if authorized, throws Error if unauthorized
 */
export function assertTenantAccess(decodedToken, targetTenantId) {
  if (!decodedToken || !decodedToken.uid) {
    const error = new Error('UNAUTHENTICATED: Invalid user credentials.');
    error.status = 401;
    throw error;
  }

  if (!targetTenantId || typeof targetTenantId !== 'string') {
    const error = new Error('BAD_REQUEST: Missing target tenantId.');
    error.status = 400;
    throw error;
  }

  // The primary owner tenantId is the Firebase Auth UID
  // For staff users, custom claims or tenantId claim may be present
  const userTenantId = decodedToken.tenantId || decodedToken.uid;

  if (userTenantId !== targetTenantId.trim()) {
    const error = new Error(`FORBIDDEN: Cross-tenant access denied. Principal ${decodedToken.uid} is not authorized for tenant ${targetTenantId}.`);
    error.status = 403;
    throw error;
  }

  return true;
}

/**
 * Validates that an authenticated request to Trello-facing endpoints is strictly
 * from the single authorized account specified in server configuration.
 * 
 * Mandatory Security Constraints (Addendum Section 4):
 * - TRELLO_ALLOWED_EMAIL must be explicitly configured (no silent default).
 * - TRELLO_TENANT_ID must be the Firebase Auth UID belonging to that email.
 * - Require email_verified === true where available.
 * - Verify email and UID together.
 * - Fail closed when either configuration value is missing or invalid.
 * 
 * @param {Object} decodedToken - The verified Firebase user token
 * @param {Object} env - Environment variables (defaults to process.env)
 * @returns {boolean} True if authorized, throws Error with status 403/401 if unauthorized
 */
export function assertTrelloAuthorizedPrincipal(decodedToken, env = process.env) {
  if (!decodedToken || !decodedToken.uid) {
    const error = new Error('UNAUTHENTICATED: Missing or invalid principal.');
    error.status = 401;
    throw error;
  }

  const allowedEmail = (env.TRELLO_ALLOWED_EMAIL || '').trim().toLowerCase();
  const configuredTenantId = (env.TRELLO_TENANT_ID || '').trim();

  // Fail closed if server TRELLO_ALLOWED_EMAIL or TRELLO_TENANT_ID is not explicitly configured
  if (!allowedEmail) {
    const error = new Error('FORBIDDEN: Server TRELLO_ALLOWED_EMAIL is not configured.');
    error.status = 403;
    throw error;
  }

  if (!configuredTenantId) {
    const error = new Error('FORBIDDEN: Server TRELLO_TENANT_ID is not configured.');
    error.status = 403;
    throw error;
  }

  const tokenEmail = (decodedToken.email || '').trim().toLowerCase();
  const tokenUid = (decodedToken.uid || '').trim();

  // 1. Check Allowed Email (Reject unauthorized principals first)
  if (tokenEmail !== allowedEmail) {
    const error = new Error(`FORBIDDEN: User ${tokenEmail || tokenUid} is not authorized for Trello integration.`);
    error.status = 403;
    throw error;
  }

  // 2. Check UID matches configured tenant ID
  if (tokenUid !== configuredTenantId) {
    const error = new Error(`FORBIDDEN: User UID mismatch for authorized Trello account.`);
    error.status = 403;
    throw error;
  }

  // 3. Strict Email Verification Requirement (Reject unverified accounts)
  // In production or when token provides email_verified, it must strictly be true
  if (decodedToken.email_verified === false || (env.NODE_ENV === 'production' && decodedToken.email_verified !== true)) {
    const error = new Error(`FORBIDDEN: Unverified email address for user ${tokenEmail || tokenUid}. Email verification is strictly required.`);
    error.status = 403;
    throw error;
  }

  return true;
}
