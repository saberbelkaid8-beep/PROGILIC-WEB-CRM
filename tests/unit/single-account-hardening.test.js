import { describe, it, expect, beforeEach } from 'vitest';
import { assertTrelloAuthorizedPrincipal } from '../../src/server/middleware/authMiddleware.js';
import { resolveTenantForTrelloScope, setDynamicTenantMappingsForTesting, resetTenantMappingsForTesting } from '../../src/server/tenantResolver.js';

describe('Single-Account Security Hardening & Tenant Boundaries (Addendum Section 4)', () => {
  const validEnv = {
    TRELLO_ALLOWED_EMAIL: 'progilicservice@gmail.com',
    TRELLO_TENANT_ID: 'tenant_progilic_uid_123',
    TRELLO_BOARD_ID: 'board_5c359f',
    TRELLO_LIST_ID: 'list_5c35a0'
  };

  const validToken = {
    email: 'progilicservice@gmail.com',
    uid: 'tenant_progilic_uid_123',
    email_verified: true
  };

  beforeEach(() => {
    resetTenantMappingsForTesting();
  });

  it('authorizes valid principal matching email, UID, and email_verified', () => {
    expect(assertTrelloAuthorizedPrincipal(validToken, validEnv)).toBe(true);
  });

  it('fails closed when TRELLO_ALLOWED_EMAIL is missing or empty', () => {
    const invalidEnv = { ...validEnv, TRELLO_ALLOWED_EMAIL: '' };
    expect(() => assertTrelloAuthorizedPrincipal(validToken, invalidEnv)).toThrow('TRELLO_ALLOWED_EMAIL is not configured');
  });

  it('fails closed when TRELLO_TENANT_ID is missing or empty', () => {
    const invalidEnv = { ...validEnv, TRELLO_TENANT_ID: '' };
    expect(() => assertTrelloAuthorizedPrincipal(validToken, invalidEnv)).toThrow('TRELLO_TENANT_ID is not configured');
  });

  it('rejects unverified email addresses (email_verified === false)', () => {
    const unverifiedToken = { ...validToken, email_verified: false };
    expect(() => assertTrelloAuthorizedPrincipal(unverifiedToken, validEnv)).toThrow('Unverified email address');
  });

  it('rejects unauthorized email addresses', () => {
    const wrongEmailToken = { ...validToken, email: 'attacker@evil.com' };
    expect(() => assertTrelloAuthorizedPrincipal(wrongEmailToken, validEnv)).toThrow('is not authorized for Trello integration');
  });

  it('rejects mismatched UID for authorized email', () => {
    const wrongUidToken = { ...validToken, uid: 'attacker_uid_999' };
    expect(() => assertTrelloAuthorizedPrincipal(wrongUidToken, validEnv)).toThrow('User UID mismatch');
  });

  it('ignores dynamic tenant mapping overrides in production NODE_ENV', () => {
    const prodEnv = {
      ...validEnv,
      NODE_ENV: 'production'
    };
    const testMap = new Map([['board_5c359f::list_5c35a0', 'unauthorized_override_tenant']]);
    setDynamicTenantMappingsForTesting(testMap);

    const res = resolveTenantForTrelloScope({ boardId: 'board_5c359f', listId: 'list_5c35a0' }, prodEnv);
    expect(res.authorized).toBe(true);
    expect(res.tenantId).toBe('tenant_progilic_uid_123'); // Must strictly resolve to server configured tenant
  });
});
