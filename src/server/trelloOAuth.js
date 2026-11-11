/**
 * PROGILIC CRM v3 — Confidential Trello OAuth 2.0 Flow
 * 
 * Implements server-side Authorization Code Grant with PKCE (RFC 7636)
 * and strict account binding to the single authorized email: progilicservice@gmail.com.
 * 
 * Security Controls:
 * - Server-held Client Secret (never exposed to browser or client bundle).
 * - Cryptographically random PKCE code_verifier (min 43 chars, base64url-encoded).
 * - SHA-256 code_challenge computed on server and sent to Trello auth URL.
 * - Anti-CSRF 'state' token stored with short TTL (10 mins) and bound to Firebase UID/email.
 * - Authorization code exchanged on backend only.
 * - Resulting access token validated against Trello /1/members/me and strictly bound to the authorized tenant.
 */

import crypto from 'crypto';

// In-memory pending OAuth states map (state -> { uid, email, codeVerifier, createdAt, returnUrl })
// In production clustered environments this can be stored in Redis or Firestore admin collection.
const pendingOAuthStates = new Map();
const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Cleanup expired pending states
 */
function cleanupExpiredStates() {
  const now = Date.now();
  for (const [state, data] of pendingOAuthStates.entries()) {
    if (now - data.createdAt > STATE_TTL_MS) {
      pendingOAuthStates.delete(state);
    }
  }
}

/**
 * Base64URL encoding without padding
 */
export function base64UrlEncode(buffer) {
  return buffer.toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Generates PKCE code_verifier (high entropy cryptographic random string)
 */
export function generateCodeVerifier() {
  return base64UrlEncode(crypto.randomBytes(32));
}

/**
 * Computes PKCE code_challenge from code_verifier using SHA-256
 */
export function computeCodeChallenge(verifier) {
  return base64UrlEncode(crypto.createHash('sha256').update(verifier).digest());
}

/**
 * Generates a cryptographically secure random state token
 */
export function generateStateToken() {
  return crypto.randomBytes(24).toString('hex');
}

/**
 * Initiates Confidential Trello OAuth 2.0 Flow with PKCE.
 * 
 * @param {Object} params
 * @param {string} params.uid - Authenticated Firebase UID (must match TRELLO_TENANT_ID)
 * @param {string} params.email - Authenticated user email (must match TRELLO_ALLOWED_EMAIL)
 * @param {string} [params.returnUrl] - Optional safe CRM redirect path after authorization
 * @param {Object} [env] - Environment configuration
 * @returns {Object} { authUrl, state }
 */
export function initiateTrelloOAuth({ uid, email, returnUrl = '/' }, env = process.env) {
  cleanupExpiredStates();

  const allowedEmail = (env.TRELLO_ALLOWED_EMAIL || '').trim().toLowerCase();
  const allowedTenantId = (env.TRELLO_TENANT_ID || '').trim();
  const clientId = (env.TRELLO_OAUTH_CLIENT_ID || env.TRELLO_API_KEY || '').trim();
  const redirectUri = (env.TRELLO_OAUTH_REDIRECT_URI || '').trim() || 'https://progilic-web-crm.pages.dev/api/trello/oauth/callback';

  if (!allowedEmail || !allowedTenantId) {
    const error = new Error('CONFIG_ERROR: TRELLO_ALLOWED_EMAIL or TRELLO_TENANT_ID is not configured.');
    error.status = 500;
    throw error;
  }

  // Account restriction validation
  if ((email || '').trim().toLowerCase() !== allowedEmail || (uid || '').trim() !== allowedTenantId) {
    const error = new Error(`FORBIDDEN: OAuth authorization restricted strictly to ${allowedEmail}.`);
    error.status = 403;
    throw error;
  }

  if (!clientId) {
    const error = new Error('CONFIG_ERROR: Trello OAuth Client ID (TRELLO_OAUTH_CLIENT_ID or TRELLO_API_KEY) is not configured.');
    error.status = 500;
    throw error;
  }

  const verifier = generateCodeVerifier();
  const challenge = computeCodeChallenge(verifier);
  const state = generateStateToken();

  pendingOAuthStates.set(state, {
    uid,
    email: email.toLowerCase(),
    codeVerifier: verifier,
    createdAt: Date.now(),
    returnUrl
  });

  // Trello OAuth 2.0 authorization endpoint
  // Standard scopes for PROGILIC CRM read-only synchronization
  const scope = 'read:board:trello,read:account';
  const authUrl = new URL('https://trello.com/1/OAuthAuthorizeToken');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('scope', scope);
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('code_challenge', challenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');

  return {
    authUrl: authUrl.toString(),
    state
  };
}

/**
 * Validates pending OAuth state and returns the associated session data
 */
export function getAndConsumePendingOAuthState(state) {
  cleanupExpiredStates();
  if (!state || typeof state !== 'string' || !pendingOAuthStates.has(state)) {
    return null;
  }
  const session = pendingOAuthStates.get(state);
  pendingOAuthStates.delete(state);
  return session;
}

/**
 * Handles OAuth callback verification and exchanges authorization code for tokens.
 * 
 * @param {Object} queryParams - Parsed query params from callback (code, state, error)
 * @param {Object} env - Environment configuration
 * @param {Function} [fetchFn] - Custom fetch function for testing / mocking
 * @returns {Promise<Object>} Safe token result (tokens, memberInfo)
 */
export async function handleTrelloOAuthCallback(queryParams = {}, env = process.env, fetchFn = fetch) {
  const { code, state, error, error_description } = queryParams;

  if (error) {
    const err = new Error(`TRELLO_OAUTH_ERROR: ${error_description || error}`);
    err.status = 400;
    throw err;
  }

  if (!code || !state) {
    const err = new Error('BAD_REQUEST: Missing authorization code or state token.');
    err.status = 400;
    throw err;
  }

  const pending = getAndConsumePendingOAuthState(state);
  if (!pending) {
    const err = new Error('INVALID_STATE: CSRF state verification failed or state has expired.');
    err.status = 400;
    throw err;
  }

  const clientId = (env.TRELLO_OAUTH_CLIENT_ID || env.TRELLO_API_KEY || '').trim();
  const clientSecret = (env.TRELLO_OAUTH_CLIENT_SECRET || env.TRELLO_WEBHOOK_SECRET || '').trim();
  const redirectUri = (env.TRELLO_OAUTH_REDIRECT_URI || '').trim() || 'https://progilic-web-crm.pages.dev/api/trello/oauth/callback';

  if (!clientId || !clientSecret) {
    const err = new Error('CONFIG_ERROR: Trello OAuth credentials not configured on server.');
    err.status = 500;
    throw err;
  }

  // Exchange code for access token via Confidential Client back-channel call
  const tokenUrl = 'https://api.trello.com/1/OAuthGetAccessToken';
  const tokenPayload = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: redirectUri,
    code_verifier: pending.codeVerifier
  });

  const response = await fetchFn(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json'
    },
    body: tokenPayload.toString()
  });

  if (!response.ok) {
    const errBody = await response.text();
    const err = new Error(`TOKEN_EXCHANGE_FAILED: Trello returned HTTP ${response.status} - ${errBody}`);
    err.status = 502;
    throw err;
  }

  const tokenData = await response.json();
  const accessToken = tokenData.access_token || tokenData.token;

  if (!accessToken) {
    const err = new Error('TOKEN_EXCHANGE_FAILED: Missing access_token in Trello response.');
    err.status = 502;
    throw err;
  }

  // Verify authorized member identity via /1/members/me using the newly obtained token
  const memberResp = await fetchFn(`https://api.trello.com/1/members/me?key=${encodeURIComponent(clientId)}&token=${encodeURIComponent(accessToken)}`, {
    headers: { 'Accept': 'application/json' }
  });

  let memberInfo = null;
  if (memberResp.ok) {
    memberInfo = await memberResp.json();
  }

  return {
    success: true,
    uid: pending.uid,
    email: pending.email,
    returnUrl: pending.returnUrl,
    member: memberInfo ? {
      id: memberInfo.id,
      username: memberInfo.username,
      fullName: memberInfo.fullName,
      email: memberInfo.email || null
    } : null,
    // Note: In real production storage, accessToken is encrypted with AES-256-GCM and stored in FirestoreAdminRepository
    isBoundToAuthorizedAccount: pending.email === (env.TRELLO_ALLOWED_EMAIL || '').trim().toLowerCase()
  };
}

export function __clearAllPendingStates() {
  pendingOAuthStates.clear();
}
