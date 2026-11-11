import { describe, it, expect } from 'vitest';
import { safeTrelloFetch, assertSandbox } from '../../src/server/sandboxGuard.js';

describe('Sandbox Guard Strict Network Isolation (Addendum Section 6)', () => {
  const sandboxEnv = {
    NODE_ENV: 'test',
    SANDBOX_MODE: 'true',
    GOOGLE_CLOUD_PROJECT: 'gen-lang-client-0400245577'
  };

  it('strictly denies non-GET mutating Trello requests in sandbox mode', async () => {
    const url = 'https://api.trello.com/1/cards/card123';

    await expect(safeTrelloFetch(url, { method: 'POST' }, sandboxEnv)).rejects.toThrow('Invariant I-2 Violation');
    await expect(safeTrelloFetch(url, { method: 'PUT' }, sandboxEnv)).rejects.toThrow('Invariant I-2 Violation');
    await expect(safeTrelloFetch(url, { method: 'DELETE' }, sandboxEnv)).rejects.toThrow('Invariant I-2 Violation');
  });

  it('strictly denies external requests to non-whitelisted hosts', async () => {
    const maliciousUrl = 'https://unauthorized-external-api.com/v1/data';
    await expect(safeTrelloFetch(maliciousUrl, { method: 'GET' }, sandboxEnv)).rejects.toThrow('External network call to unauthorized host');
  });

  it('assertSandbox throws when production GCP project ID is present without Emulator or test adapter', () => {
    const invalidEnv = {
      NODE_ENV: 'test',
      SANDBOX_MODE: 'true',
      GOOGLE_CLOUD_PROJECT: 'gen-lang-client-0400245577'
    };
    expect(() => assertSandbox(invalidEnv)).toThrow('Invariant I-3 Violation');
  });

  it('assertSandbox passes when FIRESTORE_EMULATOR_HOST or ALLOW_ISOLATED_TEST_ADAPTER is set', () => {
    const emulatorEnv = {
      NODE_ENV: 'test',
      SANDBOX_MODE: 'true',
      GOOGLE_CLOUD_PROJECT: 'gen-lang-client-0400245577',
      FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080'
    };
    expect(assertSandbox(emulatorEnv)).toBe(true);

    const adapterEnv = {
      NODE_ENV: 'test',
      SANDBOX_MODE: 'true',
      GOOGLE_CLOUD_PROJECT: 'gen-lang-client-0400245577',
      ALLOW_ISOLATED_TEST_ADAPTER: 'true'
    };
    expect(assertSandbox(adapterEnv)).toBe(true);
  });

  it('autonomous scheduled gate: remains locked prior to Saturday 21 Nov 2026 and unlocks automatically on/after that date', async () => {
    const { isProductionGateUnlocked, assertProductionGate } = await import('../../src/server/sandboxGuard.js');

    const scheduledEnv = {
      TRELLO_SYNC_START_DATE: '2026-11-21T00:00:00+01:00',
      TRELLO_PRODUCTION_GATE_UNLOCKED: 'false'
    };

    // 1. Before Saturday (e.g. Wednesday 11 Nov 2026) -> STRICTLY LOCKED
    const originalDateNow = Date.now;
    try {
      Date.now = () => new Date('2026-11-11T12:00:00Z').getTime();
      expect(isProductionGateUnlocked(scheduledEnv)).toBe(false);
      expect(() => assertProductionGate('sync', scheduledEnv)).toThrow(/Production Safety Gate Scheduled/);

      // 2. On Saturday 21 Nov 2026 00:00:01 -> AUTOMATICALLY UNLOCKED
      Date.now = () => new Date('2026-11-21T00:00:01+01:00').getTime();
      expect(isProductionGateUnlocked(scheduledEnv)).toBe(true);
      expect(assertProductionGate('sync', scheduledEnv)).toBe(true);
    } finally {
      Date.now = originalDateNow;
    }
  });
});

