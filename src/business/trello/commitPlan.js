/**
 * PROGILIC CRM × TRELLO INTEGRATION
 * Pure Commit Plan Generator & Serialization Contract (Section 5.3)
 * 
 * Separates the pure analysis pipeline (fetch -> classify -> resolve customer -> route)
 * from the transactional commit step.
 * 
 * Generates an immutable, serializable CommitPlan containing:
 * - crmMutations: entity write, client write, sub-item write
 * - mappingRecord: Trellosync status, provenance, snapshots, lease state
 * - reviewRecord: when human review is required
 * - timelineActivity: audit activity attributed to 'Trello'
 * - provenance: model info, hashes, timestamps
 */

import { OPERATION_DESTINATION, TRELLO_SYNC_STATUS } from './trelloTypes.js';

export function createCommitPlan({
  tenantId,
  checklistItem,
  card,
  board,
  extracted,
  customerResolution,
  route,
  existingSync = null
}) {
  const itemId = String(checklistItem.id);
  const cardId = card?.id || null;
  const boardId = board?.id || null;
  const nowIso = new Date().toISOString();

  // If review is required
  if (route.destination === OPERATION_DESTINATION.REVIEW_QUEUE) {
    return {
      type: 'REVIEW_REQUIRED',
      checklistItemId: itemId,
      tenantId,
      reviewRecord: {
        checklistItemId: itemId,
        cardId,
        boardId,
        rawText: checklistItem.name,
        trelloState: checklistItem.state,
        extracted,
        customerResolution,
        reviewReason: route.reason,
        reviewDetails: route.details,
        createdAt: nowIso
      },
      mappingRecord: {
        checklistItemId: itemId,
        cardId,
        status: TRELLO_SYNC_STATUS.REVIEW_REQUIRED,
        reviewReason: route.reason,
        reviewDetails: route.details,
        leaseExpiresAt: 0,
        updatedAt: nowIso
      },
      crmMutations: null,
      timelineActivity: null,
      provenance: {
        confidence: extracted.confidence,
        uncertainties: extracted.uncertainties || [],
        planGeneratedAt: nowIso
      }
    };
  }

  // Target Client Determination
  let targetClient = customerResolution.client;
  let wasClientCreated = false;
  let clientId = targetClient?.id || null;
  let clientRecord = null;

  if (!targetClient && customerResolution.status === 'NEW_CLIENT_QUALIFIED') {
    clientId = Date.now();
    wasClientCreated = true;
    clientRecord = {
      id: clientId,
      ...customerResolution.proposedClientData,
      source: 'trello_auto_import',
      trelloOriginCard: card?.name || 'Programme de Services',
      trelloChecklistItemId: itemId,
      createdAt: nowIso.split('T')[0],
      updatedAt: nowIso
    };
  }

  // Sub-Item Record
  const targetRecordId = existingSync?.targetRecordId || (Date.now() + Math.floor(Math.random() * 1000));
  const isUpdate = Boolean(existingSync?.targetRecordId);
  const subItemRecord = {
    ...route.payload,
    id: targetRecordId,
    source: 'trello',
    trelloChecklistItemId: itemId,
    lastModifiedBy: 'trello',
    updatedAt: nowIso
  };

  const auditTitle = route.auditTitle || 'عملية مجدولة من Trello';
  const auditDescription = route.auditDescription || `مزامنة مهمة "${checklistItem.name}"`;

  const timelineActivity = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    clientId: clientId,
    type: 'TRELLO_SYNCED',
    title: auditTitle,
    description: auditDescription,
    userName: 'Trello',
    userId: 'trello-integration',
    actorUid: tenantId,
    occurredAt: nowIso,
    recordedAt: nowIso,
    metadata: {
      trelloCardId: cardId,
      trelloChecklistItemId: itemId,
      destination: route.destination,
      targetRecordId
    }
  };

  return {
    type: 'APPLY_MUTATION',
    checklistItemId: itemId,
    tenantId,
    crmMutations: {
      clientId,
      collectionKey: route.destination,
      subItemId: targetRecordId,
      subItemRecord,
      isClientNew: wasClientCreated,
      clientRecord
    },
    mappingRecord: {
      checklistItemId: itemId,
      cardId,
      status: TRELLO_SYNC_STATUS.SYNCED,
      targetCollection: route.destination,
      targetRecordId,
      clientId,
      wasClientCreatedByTrello: wasClientCreated,
      actionType: isUpdate ? 'RECORD_UPDATED' : 'SUB_ITEM_CREATED',
      leaseExpiresAt: 0,
      syncedAt: nowIso,
      updatedAt: nowIso
    },
    reviewRecord: null,
    timelineActivity,
    provenance: {
      actionNature: extracted.actionNature,
      confidence: extracted.confidence,
      uncertainties: extracted.uncertainties || [],
      planGeneratedAt: nowIso
    }
  };
}
