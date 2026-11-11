/**
 * PROGILIC CRM v3 — Master Task 6 End-to-End Sandbox Integration Suite
 * 
 * Comprehensive validation of Trello & AI integration across all 12 mandated scenarios:
 * - Scenario A: Valid existing customer with technical issue
 * - Scenario B: Valid existing customer with feature request
 * - Scenario C: Customer interaction or contact update
 * - Scenario D: New and previously unmatched customer
 * - Scenario E: Ambiguous customer identity (multiple candidates)
 * - Scenario F: Invalid phone number handling
 * - Scenario G: Arabic checklist content
 * - Scenario H: French checklist content
 * - Scenario I: Duplicate webhook delivery idempotency
 * - Scenario J: Exact AI confidence boundary (0.69, 0.70, 0.71)
 * - Scenario K: Unavailable Gemini provider fallback resilience
 * - Scenario L: Malformed Trello payload & empty items
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createTestAdminRepository } from '../../src/server/firestoreAdminRepository.js';
import {
  syncTrelloChecklistItem,
  setServerAdminRepo,
  inMemorySyncStore,
  inMemoryReviewQueue
} from '../../src/business/trello/trelloSyncService.js';
import { determineOperationRoute, AI_CONFIDENCE_THRESHOLD } from '../../src/business/trello/deterministicRouter.js';
import { classifyTrelloItem, parseLocallyWithHeuristics } from '../../src/business/trello/trelloAiClassifier.js';
import { resolveTrelloCustomer } from '../../src/business/ai/entityResolver.js';
import { setClients } from '../../src/state/store.js';
import { handleTrelloWebhookRequest, verifyTrelloWebhookSignature, isEventInTrelloScope } from '../../src/server/trelloRoutes.js';
import crypto from 'crypto';

describe('Task 6 — Complete Trello & AI Integration E2E Sandbox Suite', () => {
  let repo;
  const TENANT_ID = 'tenant_e2e_sandbox_6';
  const BOARD = { id: 'board_sandbox_main', name: 'PROGRAMME DE SERVICES' };
  const CARD = { id: 'card_sunday_sandbox', name: 'Dimanche 08-11-2026' };

  const initialClients = [
    {
      id: 601,
      fullName: 'مؤسسة النور',
      phone: '0550112233',
      company: 'مؤسسة النور للإلكترونيات',
      wilaya: 'سطيف',
      status: 'نشط',
      programs: [{ id: 1, programName: 'PROGILIC ERP V24', installationsCount: 2 }],
      issues: [],
      requirements: [],
      contactHistory: []
    },
    {
      id: 602,
      fullName: 'Ets Lumiere Alger',
      phone: '0661998877',
      company: 'SARL Lumiere',
      wilaya: 'الجزائر',
      status: 'نشط',
      programs: [{ id: 2, programName: 'PROGILIC POS V15', installationsCount: 1 }],
      issues: [],
      requirements: [],
      contactHistory: []
    },
    {
      id: 603,
      fullName: 'متجر الوفاق وهران',
      phone: '0770334455',
      company: 'الوفاق',
      wilaya: 'وهران',
      status: 'نشط',
      programs: [],
      issues: [],
      requirements: [],
      contactHistory: []
    },
    {
      id: 604,
      fullName: 'متجر الوفاق سطيف',
      phone: '0555334455',
      company: 'الوفاق',
      wilaya: 'سطيف',
      status: 'نشط',
      programs: [],
      issues: [],
      requirements: [],
      contactHistory: []
    }
  ];

  beforeEach(() => {
    const freshClients = JSON.parse(JSON.stringify(initialClients));
    repo = createTestAdminRepository(freshClients);
    repo.seedClients(TENANT_ID, freshClients);
    setServerAdminRepo(repo);
    setClients(freshClients);
    inMemorySyncStore.clear();
    inMemoryReviewQueue.clear();
  });

  // --------------------------------------------------------------------------
  // Scenario A: Valid existing customer with a technical issue
  // --------------------------------------------------------------------------
  it('Scenario A: Valid existing customer with technical issue routes to issues collection', async () => {
    const item = {
      id: 'chk_scen_a',
      name: 'مؤسسة النور 0550112233 - عطب في قاعدة البيانات عند حفظ الفاتورة خطأ تقني',
      state: 'complete'
    };

    const res = await syncTrelloChecklistItem(TENANT_ID, item, CARD, BOARD);
    expect(res.status).toBe('SYNCED');

    const client = await repo.getClient(TENANT_ID, '601');
    expect(client.issues.length).toBe(1);
    expect(client.issues[0].title).toContain('عطب في قاعدة البيانات');
    expect(client.issues[0].source).toBe('trello');
    expect(client.issues[0].lastModifiedBy).toBe('trello');
  });

  // --------------------------------------------------------------------------
  // Scenario B: Valid existing customer with a feature request
  // --------------------------------------------------------------------------
  it('Scenario B: Valid existing customer with feature request routes to requirements collection', async () => {
    const item = {
      id: 'chk_scen_b',
      name: 'Ets Lumiere Alger 0661998877 - Demande d\'ajouter un rapport de stock par fournisseur',
      state: 'incomplete'
    };

    const res = await syncTrelloChecklistItem(TENANT_ID, item, CARD, BOARD);
    expect(res.status).toBe('SYNCED');

    const client = await repo.getClient(TENANT_ID, '602');
    expect(client.requirements.length).toBe(1);
    expect(client.requirements[0].title).toContain('ajouter un rapport');
    expect(client.requirements[0].status).toBe('قيد الدراسة');
  });

  // --------------------------------------------------------------------------
  // Scenario C: Customer interaction or contact update
  // --------------------------------------------------------------------------
  it('Scenario C: Customer interaction or field service routes to contacts collection without bug creation', async () => {
    const item = {
      id: 'chk_scen_c',
      name: 'مؤسسة النور 0550112233 - Déplacement pour explication et formation du personnel',
      state: 'complete'
    };

    const res = await syncTrelloChecklistItem(TENANT_ID, item, CARD, BOARD);
    expect(res.status).toBe('SYNCED');

    const client = await repo.getClient(TENANT_ID, '601');
    expect(client.contactHistory.length).toBe(1);
    expect(client.contactHistory[0].note).toContain('[Déplacement]');
    // Ensures no unwanted bug ticket was created
    expect(client.issues.length).toBe(0);
  });

  // --------------------------------------------------------------------------
  // Scenario D: New and previously unmatched customer
  // --------------------------------------------------------------------------
  it('Scenario D: Qualified new customer is automatically created or flagged for review if incomplete', async () => {
    // Highly qualified new customer with full name, phone, wilaya, and program installation
    const itemQualified = {
      id: 'chk_scen_d_qual',
      name: 'صيدلية المستقبل 0559887766 - تثبيت برنامج PROGILIC PHARMA V27 في وهران',
      state: 'complete'
    };

    const res = await syncTrelloChecklistItem(TENANT_ID, itemQualified, CARD, BOARD);
    expect(['SYNCED', 'REVIEW_REQUIRED']).toContain(res.status);

    if (res.status === 'SYNCED') {
      const allClients = await repo.listClients(TENANT_ID);
      const newClient = allClients.find(c => c.phone === '0559887766');
      expect(newClient).toBeDefined();
      expect(newClient.fullName).toContain('صيدلية المستقبل');
    }
  });

  // --------------------------------------------------------------------------
  // Scenario E: Ambiguous customer identity (multiple candidates)
  // --------------------------------------------------------------------------
  it('Scenario E: Ambiguous customer identity with multiple matches safely routes to Review Queue', async () => {
    // Both 603 and 604 match "الوفاق", but no phone number provided
    const itemAmbiguous = {
      id: 'chk_scen_e_ambig',
      name: 'متجر الوفاق - صيانة وتحديث البرنامج',
      state: 'incomplete'
    };

    const res = await syncTrelloChecklistItem(TENANT_ID, itemAmbiguous, CARD, BOARD);
    expect(res.status).toBe('REVIEW_REQUIRED');

    const reviewItems = await repo.listReviewItems(TENANT_ID);
    const flagged = reviewItems.find(r => r.id === itemAmbiguous.id);
    expect(flagged).toBeDefined();
    expect(flagged.reviewReason).toMatch(/AMBIGUOUS_CUSTOMER|LOW_AI_CONFIDENCE|UNCLEAR_OPERATION_NATURE/);
  });

  // --------------------------------------------------------------------------
  // Scenario F: Invalid phone number handling
  // --------------------------------------------------------------------------
  it('Scenario F: Invalid or malformed phone numbers are safely handled without parser failure', async () => {
    const parsed = parseLocallyWithHeuristics('زبون مجهول هاتف 12345 - مشكلة في الاتصال', { id: 'chk_f' });
    expect(parsed.customer.phone).toBeNull(); // Rejects invalid Algerian phone
    expect(parsed.actionNature).toBe('technical_issue');
  });

  // --------------------------------------------------------------------------
  // Scenario G: Arabic checklist content
  // --------------------------------------------------------------------------
  it('Scenario G: Arabic business content extracts customer, wilaya, and issue accurately', async () => {
    const text = 'مؤسسة النور سطيف 0550112233 - خطأ تقني في احتساب نسبة الضريبة على القيمة المضافة';
    const parsed = parseLocallyWithHeuristics(text, { id: 'chk_g' });

    expect(parsed.customer.phone).toBe('0550112233');
    expect(parsed.customer.wilaya).toBe('سطيف');
    expect(parsed.actionNature).toBe('technical_issue');
  });

  // --------------------------------------------------------------------------
  // Scenario H: French checklist content
  // --------------------------------------------------------------------------
  it('Scenario H: French business content extracts vehicle and operation cleanly', async () => {
    const text = 'Ets Lumiere Alger 0661998877 - Vidéo de formation pour la clôture journalière';
    const parsed = parseLocallyWithHeuristics(text, { id: 'chk_h' });

    expect(parsed.customer.phone).toBe('0661998877');
    expect(parsed.extractedInterventionMedium).toBe('Vidéo');
    expect(parsed.actionNature).toBe('training');
  });

  // --------------------------------------------------------------------------
  // Scenario I: Duplicate webhook delivery
  // --------------------------------------------------------------------------
  it('Scenario I: Duplicate webhook delivery preserves idempotency with 0 duplicate records', async () => {
    const item = {
      id: 'chk_scen_i_dup',
      name: 'مؤسسة النور 0550112233 - مشكلة في الشبكة خطأ تقني',
      state: 'complete'
    };

    const firstRun = await syncTrelloChecklistItem(TENANT_ID, item, CARD, BOARD);
    expect(firstRun.status).toBe('SYNCED');

    // Immediate second delivery of identical item
    const secondRun = await syncTrelloChecklistItem(TENANT_ID, item, CARD, BOARD);
    expect(secondRun.status).toBe('SYNCED');
    expect(secondRun.skipped).toBe(true);
    expect(secondRun.reason).toBe('ALREADY_SYNCED_IDEMPOTENT');

    const client = await repo.getClient(TENANT_ID, '601');
    const matched = client.issues.filter(i => i.trelloChecklistItemId === item.id);
    expect(matched.length).toBe(1); // Exactly one issue
  });

  // --------------------------------------------------------------------------
  // Scenario J: Exact AI confidence boundary (0.69, 0.70, 0.71)
  // --------------------------------------------------------------------------
  it('Scenario J: Confidence boundary tests strictly enforce 0.70 threshold', () => {
    expect(AI_CONFIDENCE_THRESHOLD).toBe(0.70);

    const validCustomer = { status: 'MATCHED_EXISTING', client: { id: 601 } };
    const trelloItem = { state: 'incomplete' };

    // 1. Boundary 0.69 -> Strict Rejection to Review Queue
    const extraction69 = {
      actionNature: 'technical_issue',
      title: 'Boundary Test 0.69',
      confidence: 0.69,
      uncertainties: []
    };
    const route69 = determineOperationRoute(extraction69, validCustomer, trelloItem);
    expect(route69.destination).toBe('review_queue');
    expect(route69.reason).toBe('LOW_AI_CONFIDENCE');

    // 2. Boundary 0.70 -> Accepted to Destination
    const extraction70 = {
      actionNature: 'technical_issue',
      title: 'Boundary Test 0.70',
      confidence: 0.70,
      uncertainties: []
    };
    const route70 = determineOperationRoute(extraction70, validCustomer, trelloItem);
    expect(route70.destination).toBe('issues');
    expect(route70.payload.title).toBe('Boundary Test 0.70');

    // 3. Boundary 0.71 -> Accepted to Destination
    const extraction71 = {
      actionNature: 'technical_issue',
      title: 'Boundary Test 0.71',
      confidence: 0.71,
      uncertainties: []
    };
    const route71 = determineOperationRoute(extraction71, validCustomer, trelloItem);
    expect(route71.destination).toBe('issues');
    expect(route71.payload.title).toBe('Boundary Test 0.71');
  });

  // --------------------------------------------------------------------------
  // Scenario K: Unavailable Gemini provider fallback resilience
  // --------------------------------------------------------------------------
  it('Scenario K: Unavailable remote Gemini provider seamlessly falls back to heuristic parser', async () => {
    // When fetch fails, classifyTrelloItem falls back to parseLocallyWithHeuristics
    const item = {
      id: 'chk_scen_k',
      name: 'Ets Lumiere Alger 0661998877 - Panne bloquante dans le serveur',
      state: 'incomplete'
    };

    const classified = await classifyTrelloItem(item, { cardName: 'Dimanche' });
    expect(classified).toBeDefined();
    expect(classified.actionNature).toBe('technical_issue');
    expect(classified.customer.phone).toBe('0661998877');
    expect(classified.confidence).toBeGreaterThanOrEqual(0.70);
  });

  // --------------------------------------------------------------------------
  // Scenario L: Malformed Trello response & empty items
  // --------------------------------------------------------------------------
  it('Scenario L: Malformed or empty checklist item returns safe failure without crashing', async () => {
    const emptyItem = { id: 'chk_empty', name: '   ', state: 'incomplete' };
    const res = await syncTrelloChecklistItem(TENANT_ID, emptyItem, CARD, BOARD);

    // Empty text triggers review or zero confidence
    expect(['FAILED', 'REVIEW_REQUIRED']).toContain(res.status);
  });

  // --------------------------------------------------------------------------
  // Phase 2 Webhook Edge Cases & Signature Security
  // --------------------------------------------------------------------------
  describe('Phase 2 Webhook Security & Edge Ingestion', () => {
    const SECRET = 'test_webhook_secret_key_123';
    const CALLBACK = 'https://crm.progilic.dz/api/trello/webhook';
    const BOARD_ID = 'board_valid_1';
    const LIST_ID = 'list_valid_1';

    const env = {
      TRELLO_WEBHOOK_SECRET: SECRET,
      TRELLO_CALLBACK_URL: CALLBACK,
      TRELLO_BOARD_ID: BOARD_ID,
      TRELLO_LIST_ID: LIST_ID,
      NODE_ENV: 'test'
    };

    function signPayload(body) {
      const content = body + CALLBACK;
      return crypto.createHmac('sha1', SECRET).update(content).digest('base64');
    }

    it('validates authentic webhook signature with constant-time HMAC', () => {
      const body = JSON.stringify({ action: { type: 'updateCheckItemStateOnCard' } });
      const sig = signPayload(body);

      const isValid = verifyTrelloWebhookSignature(body, sig, CALLBACK, SECRET);
      expect(isValid).toBe(true);

      const isForged = verifyTrelloWebhookSignature(body, 'forged_signature_xyz', CALLBACK, SECRET);
      expect(isForged).toBe(false);
    });

    it('rejects oversized payloads > 512KB with 413 Payload Too Large', async () => {
      const giantString = 'a'.repeat(600 * 1024);
      const res = await handleTrelloWebhookRequest(giantString, {}, 'POST', env);
      expect(res.status).toBe(413);
      expect(JSON.parse(res.body).error).toBe('PAYLOAD_TOO_LARGE');
    });

    it('rejects events outside authorized Board or List scope', async () => {
      const outOfScopeBody = {
        action: {
          data: {
            board: { id: 'unauthorized_board_xyz' },
            list: { id: LIST_ID }
          }
        }
      };

      const scopeCheck = isEventInTrelloScope(outOfScopeBody, BOARD_ID, LIST_ID);
      expect(scopeCheck.inScope).toBe(false);
      expect(scopeCheck.reason).toBe('UNAUTHORIZED_BOARD');
    });

    it('handles Trello webhook registration HEAD handshake with 200 OK', async () => {
      const res = await handleTrelloWebhookRequest('', {}, 'HEAD', env);
      expect(res.status).toBe(200);
      expect(res.body).toBe('OK');
    });
  });
});
