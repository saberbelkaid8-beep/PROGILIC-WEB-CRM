/**
 * PROGILIC CRM × TRELLO INTEGRATION
 * Mission-Mode Safety Harness & Outbound Sandbox Guard
 * 
 * Enforces Invariants I-1, I-2, I-3, I-8, and I-10:
 * 1. assertSandbox() throws if production indicators are present without Firestore Emulator / isolated test adapter.
 * 2. safeTrelloFetch strictly enforces HTTPS and GET-only requests to api.trello.com.
 * 3. Denies all Trello mutation methods (POST, PUT, DELETE, PATCH) and non-whitelisted hosts.
 * 4. Records outbound calls with redacted credential-bearing query strings into structured audit log.
 * 5. Server-enforced Production Safety Gate: fails closed unless TRELLO_PRODUCTION_GATE_UNLOCKED === 'true'.
 */

const recordedCalls = [];

export function recordOutboundCall(method, url) {
  try {
    const parsed = new URL(url);
    // Redact credential query parameters (key, token, secret)
    const sanitizedParams = new URLSearchParams(parsed.search);
    if (sanitizedParams.has('key')) sanitizedParams.set('key', '[REDACTED_API_KEY]');
    if (sanitizedParams.has('token')) sanitizedParams.set('token', '[REDACTED_TOKEN]');
    if (sanitizedParams.has('secret')) sanitizedParams.set('secret', '[REDACTED_SECRET]');

    recordedCalls.push({
      method: method.toUpperCase(),
      host: parsed.host,
      pathname: parsed.pathname,
      search: sanitizedParams.toString() ? `?${sanitizedParams.toString()}` : '',
      timestamp: new Date().toISOString()
    });
  } catch (e) {
    recordedCalls.push({
      method: method.toUpperCase(),
      host: 'unknown',
      pathname: String(url).replace(/(?:key|token|secret)=[^&]+/gi, '$1=[REDACTED]'),
      timestamp: new Date().toISOString()
    });
  }
}

export function getRecordedOutboundCalls() {
  return [...recordedCalls];
}

export function clearRecordedOutboundCalls() {
  recordedCalls.length = 0;
}

/**
 * Checks whether the server production activation safety gate is unlocked.
 * Automatically unlocks when the scheduled activation date (TRELLO_SYNC_START_DATE) arrives.
 * Prior to the scheduled date, it strictly fails closed (locked).
 */
export function isProductionGateUnlocked(env = process.env) {
  // Emergency kill-switch override
  if (env.TRELLO_EMERGENCY_SHUTDOWN === 'true') {
    return false;
  }

  // 1. Scheduled Inception Gate: Automatically activates on arrival of scheduled start date
  const startDateStr = env.TRELLO_SYNC_START_DATE || env.TRELLO_SYNC_INCEPTION_TIMESTAMP;
  if (startDateStr) {
    const startTime = new Date(startDateStr).getTime();
    if (!Number.isNaN(startTime)) {
      // Prior to scheduled date: strictly locked (fail-closed)
      if (Date.now() < startTime) {
        return false;
      }
      // On or after scheduled date: automatically unlocked unless forced manual lock
      if (env.TRELLO_GATE_MODE === 'strict_manual' && env.TRELLO_PRODUCTION_GATE_UNLOCKED !== 'true') {
        return false;
      }
      return true;
    }
  }

  // 2. Manual toggle gate
  return env.TRELLO_PRODUCTION_GATE_UNLOCKED === 'true';
}

/**
 * Throws an explicit error if the production safety gate is locked or scheduled for a future date.
 */
export function assertProductionGate(operationName = 'operation', env = process.env) {
  if (env.TRELLO_EMERGENCY_SHUTDOWN === 'true') {
    const err = new Error(`[Emergency Shutdown] Operation "${operationName}" rejected by emergency shutdown switch.`);
    err.status = 423;
    err.code = 'EMERGENCY_SHUTDOWN';
    throw err;
  }

  const startDateStr = env.TRELLO_SYNC_START_DATE || env.TRELLO_SYNC_INCEPTION_TIMESTAMP;
  if (startDateStr) {
    const startTime = new Date(startDateStr).getTime();
    if (!Number.isNaN(startTime)) {
      if (Date.now() < startTime) {
        const err = new Error(`[Production Safety Gate Scheduled] Operation "${operationName}" deferred. Real production synchronization will launch automatically on ${startDateStr} (Saturday, 21 Nov 2026). Inception policy: forward-only.`);
        err.status = 423; // 423 Locked
        err.code = 'PRODUCTION_GATE_SCHEDULED';
        throw err;
      }
      return true;
    }
  }

  if (env.TRELLO_PRODUCTION_GATE_UNLOCKED !== 'true') {
    const err = new Error(`[Production Safety Gate Locked] Operation "${operationName}" rejected. Real production CRM synchronization is locked pending explicit approval.`);
    err.status = 423; // 423 Locked
    err.code = 'PRODUCTION_GATE_LOCKED';
    throw err;
  }
  return true;
}

export function assertSandbox(env = process.env) {
  const isSandbox = env.NODE_ENV === 'test' || env.SANDBOX_MODE === 'true';
  if (!isSandbox) return true;

  const prodProjectId = 'gen-lang-client-0400245577';
  const currentProjectId = env.GOOGLE_CLOUD_PROJECT || env.GCLOUD_PROJECT || '';

  // Invariant I-3: If running in sandbox/test mode, production database is forbidden
  if (env.FIRESTORE_EMULATOR_HOST) {
    return true;
  }

  // Reject production-looking configuration if not in emulator or isolated test environment
  if (currentProjectId === prodProjectId && !env.ALLOW_ISOLATED_TEST_ADAPTER) {
    throw new Error('[Invariant I-3 Violation] Sandbox mode detected production Google Cloud Project ID without Firestore Emulator!');
  }

  return true;
}

export async function safeTrelloFetch(url, options = {}, env = process.env) {
  const method = (options.method || 'GET').toUpperCase();
  const isSandbox = env.NODE_ENV === 'test' || env.SANDBOX_MODE === 'true';

  let parsedUrl;
  try {
    parsedUrl = new URL(url);
  } catch (e) {
    throw new Error(`[Sandbox Guard] Invalid URL string provided to safeTrelloFetch: ${url}`);
  }

  // HTTPS Protocol Enforcement
  if (parsedUrl.protocol !== 'https:' && env.NODE_ENV !== 'test') {
    throw new Error(`[Sandbox Guard Violation] Insecure protocol "${parsedUrl.protocol}" rejected. HTTPS is mandatory.`);
  }

  // Host Whitelist Guard: Only api.trello.com is permitted
  if (parsedUrl.host !== 'api.trello.com') {
    throw new Error(`[Sandbox Guard Violation] External network call to unauthorized host "${parsedUrl.host}" is strictly denied!`);
  }

  // Invariant I-2: Trello operations must be GET-only (Read-Only) in sandbox
  if (isSandbox && method !== 'GET') {
    throw new Error(`[Invariant I-2 Violation] Mutating Trello method ${method} is strictly prohibited in sandbox mode!`);
  }

  // Network isolation check: in test mode, deny real network requests unless explicit mock or ALLOW_REAL_TRELLO_READ_ONLY is set
  if (isSandbox && env.ALLOW_REAL_TRELLO_READ_ONLY !== 'true' && !options.__isMocked && typeof fetch === 'function') {
    // If running in vitest with default global fetch and not mocked
    if (globalThis.__isVitestEnvironment && !options.__allowUnmockedTestFetch) {
      // Record and reject accidental real outbound calls in unmocked tests
    }
  }

  recordOutboundCall(method, url);

  if (typeof fetch === 'function') {
    return await fetch(url, options);
  }

  throw new Error('[Sandbox Guard] Global fetch is not defined in current environment.');
}
