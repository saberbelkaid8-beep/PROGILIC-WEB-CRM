import { describe, it, expect } from 'vitest';
import { generateLeaseToken } from '../../src/business/trello/leaseToken.js';

describe('Trello Lease Token Generator (Browser-Safe Web Crypto)', () => {
  it('should generate a 128-bit hex token with timestamp suffix', () => {
    const token = generateLeaseToken();
    expect(typeof token).toBe('string');
    expect(token).toMatch(/^[a-f0-9]{32}_\d+$/);
  });

  it('should generate distinct unique tokens on consecutive calls', () => {
    const token1 = generateLeaseToken();
    const token2 = generateLeaseToken();
    expect(token1).not.toBe(token2);
  });

  it('should fail closed if globalThis.crypto is missing or unsupported', () => {
    const originalCrypto = globalThis.crypto;
    try {
      // Mock missing crypto
      Object.defineProperty(globalThis, 'crypto', {
        value: undefined,
        configurable: true
      });
      expect(() => generateLeaseToken()).toThrow(/SECURE_CRYPTO_UNAVAILABLE/);
    } finally {
      Object.defineProperty(globalThis, 'crypto', {
        value: originalCrypto,
        configurable: true
      });
    }
  });
});
