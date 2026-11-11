/**
 * PROGILIC CRM × TRELLO INTEGRATION
 * Browser-Safe Cryptographically Secure Worker Lease Token Generator
 * 
 * Uses Web Crypto API (globalThis.crypto.getRandomValues) to ensure 100%
 * browser and Node.js runtime compatibility without Node-only 'crypto' imports.
 */

export function generateLeaseToken() {
  const cryptoObj = typeof globalThis !== 'undefined' ? globalThis.crypto : (typeof window !== 'undefined' ? window.crypto : null);

  if (!cryptoObj || typeof cryptoObj.getRandomValues !== 'function') {
    throw new Error('SECURE_CRYPTO_UNAVAILABLE: globalThis.crypto.getRandomValues is not supported in this runtime environment.');
  }

  // Generate 16 random bytes (128 bits of entropy)
  const array = new Uint8Array(16);
  cryptoObj.getRandomValues(array);

  // Convert to 32-character hexadecimal string
  let hex = '';
  for (let i = 0; i < array.length; i++) {
    hex += array[i].toString(16).padStart(2, '0');
  }

  return `${hex}_${Date.now()}`;
}
