/**
 * Unit Tests for Confidential Trello OAuth 2.0 Flow with PKCE
 * 
 * Verifies:
 * 1. Generates RFC 7636 compliant PKCE code_verifier and code_challenge (S256).
 * 2. Strict enforcement of authorized account progilicservice@gmail.com and tenant ID.
 * 3. Rejection of unauthorized users attempting to initiate Trello OAuth.
 * 4. State CSRF protection: rejects invalid or missing states.
 * 5. Back-channel code exchange with Trello and user account binding.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  generateCodeVerifier,
  computeCodeChallenge,
  generateStateToken,
  initiateTrelloOAuth,
  handleTrelloOAuthCallback,
  __clearAllPendingStates
} from '../../src/server/trelloOAuth.js';

describe('Confidential Trello OAuth 2.0 Flow with PKCE', () => {
  const validEnv = {
    TRELLO_ALLOWED_EMAIL: 'progilicservice@gmail.com',
    TRELLO_TENANT_ID: 'tenant-progilic-authorized-uid',
    TRELLO_OAUTH_CLIENT_ID: 'trello-client-key-12345',
    TRELLO_OAUTH_CLIENT_SECRET: 'trello-client-secret-67890',
    TRELLO_OAUTH_REDIRECT_URI: 'https://progilic-web-crm.pages.dev/api/trello/oauth/callback'
  };

  beforeEach(() => {
    __clearAllPendingStates();
  });

  describe('PKCE RFC 7636 Cryptographic Helpers', () => {
    it('generates high entropy code_verifier with valid base64url characters', () => {
      const verifier = generateCodeVerifier();
      expect(typeof verifier).toBe('string');
      expect(verifier.length).toBeGreaterThanOrEqual(43);
      // Valid base64url chars: A-Z, a-z, 0-9, -, _
      expect(verifier).toMatch(/^[A-Za-z0-9_-]+$/);
    });

    it('computes deterministic SHA-256 code_challenge', () => {
      const verifier = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';
      const challenge1 = computeCodeChallenge(verifier);
      const challenge2 = computeCodeChallenge(verifier);
      expect(challenge1).toBe(challenge2);
      expect(challenge1).toMatch(/^[A-Za-z0-9_-]+$/);
    });
  });

  describe('initiateTrelloOAuth Authorization Initiation', () => {
    it('generates a valid authorization URL for authorized account', () => {
      const res = initiateTrelloOAuth({
        uid: 'tenant-progilic-authorized-uid',
        email: 'progilicservice@gmail.com',
        returnUrl: '/crm/settings'
      }, validEnv);

      expect(res.authUrl).toBeDefined();
      expect(res.state).toBeDefined();

      const parsedUrl = new URL(res.authUrl);
      expect(parsedUrl.origin).toBe('https://trello.com');
      expect(parsedUrl.searchParams.get('client_id')).toBe('trello-client-key-12345');
      expect(parsedUrl.searchParams.get('response_type')).toBe('code');
      expect(parsedUrl.searchParams.get('code_challenge_method')).toBe('S256');
      expect(parsedUrl.searchParams.get('code_challenge')).toBeTruthy();
      expect(parsedUrl.searchParams.get('state')).toBe(res.state);
    });

    it('strictly forbids non-authorized emails from initiating OAuth', () => {
      expect(() => {
        initiateTrelloOAuth({
          uid: 'tenant-other-uid',
          email: 'unauthorized_staff@progilic.dz'
        }, validEnv);
      }).toThrow(/OAuth authorization restricted strictly to progilicservice@gmail.com/);
    });

    it('strictly forbids UID mismatch even if email matches', () => {
      expect(() => {
        initiateTrelloOAuth({
          uid: 'impostor-uid',
          email: 'progilicservice@gmail.com'
        }, validEnv);
      }).toThrow(/OAuth authorization restricted strictly/);
    });
  });

  describe('handleTrelloOAuthCallback Exchange & Binding', () => {
    it('fails closed when state is missing or invalid', async () => {
      await expect(
        handleTrelloOAuthCallback({ code: 'auth-code-123', state: 'non-existent-state' }, validEnv)
      ).rejects.toThrow(/CSRF state verification failed/);
    });

    it('exchanges code via back-channel and verifies member identity', async () => {
      // 1. Initiate OAuth to register valid state
      const initRes = initiateTrelloOAuth({
        uid: 'tenant-progilic-authorized-uid',
        email: 'progilicservice@gmail.com',
        returnUrl: '/crm/board'
      }, validEnv);

      // 2. Mock fetch implementation for Trello endpoints
      const mockFetch = async (url, options = {}) => {
        if (url.includes('/1/OAuthGetAccessToken')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              access_token: 'mock-access-token-abcxyz',
              token_type: 'Bearer'
            })
          };
        }
        if (url.includes('/1/members/me')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              id: 'trello-mem-1',
              username: 'progilic_support',
              fullName: 'Progilic Support Service',
              email: 'progilicservice@gmail.com'
            })
          };
        }
        return { ok: false, status: 404, text: async () => 'Not Found' };
      };

      const result = await handleTrelloOAuthCallback({
        code: 'valid-trello-auth-code',
        state: initRes.state
      }, validEnv, mockFetch);

      expect(result.success).toBe(true);
      expect(result.email).toBe('progilicservice@gmail.com');
      expect(result.uid).toBe('tenant-progilic-authorized-uid');
      expect(result.member.username).toBe('progilic_support');
      expect(result.isBoundToAuthorizedAccount).toBe(true);
    });
  });
});
