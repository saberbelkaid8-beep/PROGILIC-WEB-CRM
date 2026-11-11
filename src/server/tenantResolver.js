/**
 * PROGILIC CRM × TRELLO INTEGRATION
 * Trusted Server-Side Tenant Resolution Engine
 * 
 * Maps authorized Trello board & list scope to the single authorized CRM tenant.
 * Strictly ignores any client-supplied, webhook-supplied, or query-param tenant IDs.
 * Fails closed on any missing, unverified, or mismatched configuration.
 */

let dynamicMappingOverrides = null;

function cleanId(id) {
  return typeof id === 'string' ? id.trim() : '';
}

function buildScopeKey(boardId, listId) {
  return `${cleanId(boardId)}::${cleanId(listId)}`;
}

/**
 * Resolves the authenticated CRM tenant for an incoming Trello event
 * based strictly on the verified board ID and list ID.
 * 
 * In production mode (NODE_ENV !== 'test'), only the single configured
 * TRELLO_BOARD_ID, TRELLO_LIST_ID, and TRELLO_TENANT_ID are evaluated.
 * 
 * @param {Object} scope - { boardId, listId }
 * @param {Object} env - Environment variables (defaults to process.env)
 * @returns {Object} Resolution result: { authorized: boolean, tenantId?: string, reason?: string }
 */
export function resolveTenantForTrelloScope(scope = {}, env = process.env) {
  const boardId = cleanId(scope.boardId);
  const listId = cleanId(scope.listId);
  const isProduction = env.NODE_ENV === 'production' || (typeof process !== 'undefined' && process.env.NODE_ENV === 'production');
  const isTestMode = !isProduction;

  // 1. Mandatory Scope Check: Fail closed if board or list ID is missing
  if (!boardId || !listId) {
    return {
      authorized: false,
      reason: 'MISSING_SCOPE_IDENTIFIERS',
      details: 'Both boardId and listId must be provided to resolve tenant authorization.'
    };
  }

  // 2. Dynamic test overrides (STRICTLY RESTRICTED TO TEST ENVIRONMENT ONLY)
  if (isTestMode && dynamicMappingOverrides instanceof Map) {
    const scopeKey = buildScopeKey(boardId, listId);
    if (dynamicMappingOverrides.has(scopeKey)) {
      const mappedTenant = dynamicMappingOverrides.get(scopeKey);
      if (mappedTenant && typeof mappedTenant === 'string' && mappedTenant.trim() !== '') {
        return {
          authorized: true,
          tenantId: mappedTenant.trim(),
          boardId,
          listId
        };
      }
    }
    return {
      authorized: false,
      reason: 'UNAUTHORIZED_SCOPE_NO_DYNAMIC_MAPPING',
      details: `Scope ${scopeKey} is not registered in the dynamic test mapping.`
    };
  }

  // 3. Environment Tenant Mappings (STRICTLY RESTRICTED TO TEST ENVIRONMENT ONLY)
  if (isTestMode && env.TRELLO_TENANT_MAPPINGS) {
    try {
      const parsedMappings = typeof env.TRELLO_TENANT_MAPPINGS === 'string'
        ? JSON.parse(env.TRELLO_TENANT_MAPPINGS)
        : env.TRELLO_TENANT_MAPPINGS;

      const scopeKey = buildScopeKey(boardId, listId);
      const mappedTenant = parsedMappings[scopeKey] || parsedMappings[`${boardId}:${listId}`];

      if (mappedTenant && typeof mappedTenant === 'string' && mappedTenant.trim() !== '') {
        return {
          authorized: true,
          tenantId: mappedTenant.trim(),
          boardId,
          listId
        };
      }
      return {
        authorized: false,
        reason: 'UNAUTHORIZED_SCOPE_NOT_IN_MAPPING_TABLE',
        details: `Board/List scope ${scopeKey} was not found in TRELLO_TENANT_MAPPINGS.`
      };
    } catch (err) {
      console.error('[Tenant Resolver] Error parsing test TRELLO_TENANT_MAPPINGS:', err.message);
      return {
        authorized: false,
        reason: 'MALFORMED_TENANT_MAPPINGS_CONFIG',
        details: 'Failed to parse TRELLO_TENANT_MAPPINGS JSON configuration.'
      };
    }
  }

  // 4. Production Single-Account Integration Model (Mandatory Enforcement)
  const configuredBoard = cleanId(env.TRELLO_BOARD_ID);
  const configuredList = cleanId(env.TRELLO_LIST_ID);
  const configuredTenant = cleanId(env.TRELLO_TENANT_ID);

  if (!configuredBoard || !configuredList || !configuredTenant) {
    return {
      authorized: false,
      reason: 'SERVER_TENANT_MAPPING_UNCONFIGURED',
      details: 'TRELLO_BOARD_ID, TRELLO_LIST_ID, and TRELLO_TENANT_ID must all be configured on the server.'
    };
  }

  if (boardId !== configuredBoard) {
    return {
      authorized: false,
      reason: 'UNAUTHORIZED_BOARD_ID',
      details: `Received boardId (${boardId}) does not match authorized TRELLO_BOARD_ID.`
    };
  }

  if (listId !== configuredList) {
    return {
      authorized: false,
      reason: 'UNAUTHORIZED_LIST_ID',
      details: `Received listId (${listId}) does not match authorized TRELLO_LIST_ID.`
    };
  }

  return {
    authorized: true,
    tenantId: configuredTenant,
    boardId,
    listId
  };
}

/**
 * Registers dynamic mappings for isolated unit/integration testing.
 * Strictly ignored in non-test production environments.
 */
export function setDynamicTenantMappingsForTesting(mappingsMap) {
  dynamicMappingOverrides = mappingsMap;
}

export function resetTenantMappingsForTesting() {
  dynamicMappingOverrides = null;
}
