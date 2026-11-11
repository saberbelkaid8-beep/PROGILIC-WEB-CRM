import { describe, expect, it, beforeEach } from 'vitest';
import { assertSandbox, safeTrelloFetch, recordOutboundCall, getRecordedOutboundCalls, clearRecordedOutboundCalls } from '../../src/server/sandboxGuard.js';

describe('Phase 0 Safety Harness: Sandbox Guard & GET-Only Trello Client', () => {
  beforeEach(() => {
    clearRecordedOutboundCalls();
  });

  it('allows sandbox mode when emulator host is provided', () => {
    const testEnv = {
      NODE_ENV: 'test',
      FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080',
      GOOGLE_CLOUD_PROJECT: 'demo-progilic-test'
    };
    expect(() => assertSandbox(testEnv)).not.toThrow();
  });

  it('rejects sandbox mode with production project ID when emulator host is missing and adapter flag is unset', () => {
    const dangerousEnv = {
      NODE_ENV: 'test',
      GOOGLE_CLOUD_PROJECT: 'gen-lang-client-0400245577'
    };
    expect(() => assertSandbox(dangerousEnv)).toThrow(/Invariant I-3 Violation/);
  });

  it('safeTrelloFetch permits GET requests in sandbox mode', async () => {
    const mockUrl = 'https://api.trello.com/1/boards/testboard/lists';
    // We test method validation without network execution
    let executed = false;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url) => {
      executed = true;
      return { ok: true, status: 200, json: async () => [] };
    };

    try {
      const res = await safeTrelloFetch(mockUrl, { method: 'GET' }, { NODE_ENV: 'test' });
      expect(executed).toBe(true);
      const calls = getRecordedOutboundCalls();
      expect(calls.length).toBe(1);
      expect(calls[0].method).toBe('GET');
      expect(calls[0].host).toBe('api.trello.com');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('safeTrelloFetch strictly rejects POST, PUT, DELETE in sandbox mode (Invariant I-2)', async () => {
    const mockUrl = 'https://api.trello.com/1/cards';
    const mutatingMethods = ['POST', 'PUT', 'DELETE', 'PATCH'];

    for (const method of mutatingMethods) {
      await expect(
        safeTrelloFetch(mockUrl, { method }, { NODE_ENV: 'test' })
      ).rejects.toThrow(/Invariant I-2 Violation/);
    }
  });
});
