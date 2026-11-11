/**
 * PROGILIC CRM × TRELLO INTEGRATION
 * Historical Backfill Simulation & Controlled Execution Engine
 */

import { classifyTrelloItem } from './trelloAiClassifier.js';
import { resolveTrelloCustomer } from '../ai/entityResolver.js';
import { determineOperationRoute } from './deterministicRouter.js';
import { syncTrelloChecklistItem, getSyncRecord } from './trelloSyncService.js';
import { clients } from '../../state/store.js';

export const inMemoryBackfillRuns = new Map();

/**
 * Executes a non-destructive dry-run simulation of Trello items.
 * Produces an audit report with 0 production modifications.
 */
export async function runHistoricalDryRun(tenantId, items = [], cardContext = {}) {
  const runId = `dryrun_${Date.now()}`;
  const report = {
    runId,
    tenantId,
    timestamp: new Date().toISOString(),
    totalItemsScanned: items.length,
    toCreateCount: 0,
    toUpdateCount: 0,
    alreadySyncedCount: 0,
    toReviewCount: 0,
    itemsPreview: []
  };

  for (const item of items) {
    const existingSync = await getSyncRecord(tenantId, item.id);
    if (existingSync && existingSync.status === 'SYNCED') {
      report.alreadySyncedCount++;
      report.itemsPreview.push({
        itemId: item.id,
        rawText: item.name,
        action: 'SKIP_ALREADY_SYNCED',
        targetCollection: existingSync.targetCollection,
        clientId: existingSync.clientId
      });
      continue;
    }

    const extracted = await classifyTrelloItem(item, cardContext);
    const customerRes = resolveTrelloCustomer(extracted.customer, clients);
    const route = determineOperationRoute(extracted, customerRes, item);

    if (route.destination === 'review_queue') {
      report.toReviewCount++;
      report.itemsPreview.push({
        itemId: item.id,
        rawText: item.name,
        action: 'FLAG_FOR_REVIEW',
        reason: route.reason,
        details: route.details
      });
    } else {
      report.toCreateCount++;
      report.itemsPreview.push({
        itemId: item.id,
        rawText: item.name,
        action: 'WILL_CREATE_RECORD',
        targetCollection: route.destination,
        targetCustomer: customerRes.client?.fullName || customerRes.proposedClientData?.fullName || 'غير محدد',
        proposedPayload: route.payload
      });
    }
  }

  inMemoryBackfillRuns.set(runId, { ...report, status: 'PREVIEW_READY' });
  return report;
}

/**
 * Executes an approved historical backfill in controlled batches
 */
export async function executeApprovedBackfill(tenantId, runIdOrReport, maybeItems = [], approvedBy = 'gerant') {
  // Production Safety Gate Check
  if (typeof process !== 'undefined' && process.env && process.env.NODE_ENV !== 'test' && process.env.TRELLO_PRODUCTION_GATE_UNLOCKED !== 'true') {
    throw new Error('PRODUCTION_GATE_LOCKED: Production backfill cannot be executed without explicit second approval (TRELLO_PRODUCTION_GATE_UNLOCKED=true).');
  }

  let runId = runIdOrReport;
  let items = maybeItems;

  if (typeof runIdOrReport === 'object' && runIdOrReport !== null) {
    runId = runIdOrReport.runId || `approved_${Date.now()}`;
    items = Array.isArray(maybeItems) && maybeItems.length > 0 ? maybeItems : (runIdOrReport.items || runIdOrReport.itemsPreview || []);
  }

  let existingRun = inMemoryBackfillRuns.get(runId);
  if (!existingRun && typeof runIdOrReport === 'object') {
    existingRun = runIdOrReport;
  }
  if (!existingRun) {
    throw new Error('RUN_NOT_FOUND_OR_UNAPPROVED');
  }

  const results = {
    runId,
    approvedBy,
    executedAt: new Date().toISOString(),
    successCount: 0,
    reviewCount: 0,
    failedCount: 0,
    details: []
  };

  // Process in chunks of 10 for controlled execution
  const batchSize = 10;
  for (let i = 0; i < items.length; i += batchSize) {
    const chunk = items.slice(i, i + batchSize);
    for (const item of chunk) {
      try {
        const syncRes = await syncTrelloChecklistItem(tenantId, item, { id: 'backfill_card' }, { id: 'backfill_board' });
        if (syncRes.status === 'SYNCED') results.successCount++;
        else if (syncRes.status === 'REVIEW_REQUIRED') results.reviewCount++;
        else results.failedCount++;
        results.details.push({ itemId: item.id, result: syncRes });
      } catch (err) {
        results.failedCount++;
        results.details.push({ itemId: item.id, error: err.message });
      }
    }
  }

  inMemoryBackfillRuns.set(runId, { ...existingRun, status: 'COMPLETED', results });
  return results;
}
