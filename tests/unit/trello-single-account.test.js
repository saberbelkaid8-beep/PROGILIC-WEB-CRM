import { describe, expect, it } from 'vitest';
import { assertTrelloAuthorizedPrincipal } from '../../src/server/middleware/authMiddleware.js';

describe('Single-Account Restriction: progilicservice@gmail.com enforcement', () => {
  const env = {
    TRELLO_ALLOWED_EMAIL: 'progilicservice@gmail.com',
    TRELLO_TENANT_ID: 'tenant-progilicservice-uid-123'
  };

  it('allows access when token email and UID match configured values', () => {
    const validToken = {
      email: 'progilicservice@gmail.com',
      uid: 'tenant-progilicservice-uid-123'
    };
    expect(() => assertTrelloAuthorizedPrincipal(validToken, env)).not.toThrow();
  });

  it('rejects access with HTTP 403 when email is different', () => {
    const invalidEmailToken = {
      email: 'otheruser@gmail.com',
      uid: 'tenant-progilicservice-uid-123'
    };
    try {
      assertTrelloAuthorizedPrincipal(invalidEmailToken, env);
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err.status).toBe(403);
      expect(err.message).toContain('not authorized for Trello integration');
    }
  });

  it('rejects access with HTTP 403 when UID does not match configured TRELLO_TENANT_ID', () => {
    const invalidUidToken = {
      email: 'progilicservice@gmail.com',
      uid: 'wrong-unverified-uid'
    };
    try {
      assertTrelloAuthorizedPrincipal(invalidUidToken, env);
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err.status).toBe(403);
      expect(err.message).toContain('User UID mismatch');
    }
  });

  it('fails closed when TRELLO_TENANT_ID is not configured on the server', () => {
    const validToken = {
      email: 'progilicservice@gmail.com',
      uid: 'tenant-progilicservice-uid-123'
    };
    try {
      assertTrelloAuthorizedPrincipal(validToken, { TRELLO_ALLOWED_EMAIL: 'progilicservice@gmail.com' });
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err.status).toBe(403);
      expect(err.message).toContain('TRELLO_TENANT_ID is not configured');
    }
  });
});
