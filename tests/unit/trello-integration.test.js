import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import crypto from 'crypto';
import { 
  syncTrelloChecklistItem, 
  handleTrelloItemDeleted, 
  resolveReviewItem, 
  rollbackTrelloItem,
  rollbackBackfillRun,
  inMemorySyncStore, 
  inMemoryReviewQueue, 
  saveSyncRecord,
  setServerAdminRepo,
  resetServerAdminRepoForTesting
} from '../../src/business/trello/trelloSyncService.js';
import { runHistoricalDryRun } from '../../src/business/trello/trelloBackfill.js';
import { determineOperationRoute } from '../../src/business/trello/deterministicRouter.js';
import { resolveTrelloCustomer } from '../../src/business/ai/entityResolver.js';
import { 
  isEventInTrelloScope, 
  verifyTrelloWebhookSignature, 
  handleTrelloWebhookRequest 
} from '../../src/server/trelloRoutes.js';
import { S, clients, setClients, setCurrentStaffUser } from '../../src/state/store.js';
import { logActivity, ActivityType } from '../../src/business/timelineService.js';
import { createTestAdminRepository } from '../../src/server/firestoreAdminRepository.js';

describe('PROGILIC CRM × Trello Integration - Master Verification Suite', () => {
  const tenantId = 'test_tenant_uid';
  let testRepo;

  beforeEach(() => {
    inMemorySyncStore.clear();
    inMemoryReviewQueue.clear();
    S.globalActivities = [];
    S.clientActivities = [];
    S.selId = null;
    S.syncQueue = [];
    setCurrentStaffUser(null);
    const initialClients = [
      {
        id: 101,
        fullName: 'أحمد بن علي',
        phone: '0550112233',
        company: 'سوبرماركت البركة',
        wilaya: 'وهران',
        status: 'نشط',
        programs: [],
        issues: [],
        requirements: [],
        contactHistory: []
      },
      {
        id: 102,
        fullName: 'محمد قاسم',
        phone: '0770998877',
        company: 'صيدلية النور',
        wilaya: 'الجزائر',
        status: 'نشط',
        programs: [],
        issues: [],
        requirements: [],
        contactHistory: []
      }
    ];
    setClients(initialClients);
    testRepo = createTestAdminRepository(initialClients);
    testRepo.seedClients(tenantId, initialClients);
    setServerAdminRepo(testRepo);
  });

  afterEach(() => {
    resetServerAdminRepoForTesting();
  });

  // --- SPECIFICATION SCENARIOS 1 to 23 ---

  it('Scenario 1: Matches existing CRM customer and attaches operation without duplicate client', async () => {
    const item = { id: 'chk_101', name: 'أحمد بن علي 0550112233 - تثبيت برنامج v27 تجاري', state: 'complete' };
    const res = await syncTrelloChecklistItem(tenantId, item, { id: 'card_1' }, { id: 'board_1' });

    expect(res.status).toBe('SYNCED');
    expect(res.clientId).toBe(101);
    expect(clients.length).toBe(2); // Zero duplicate clients created
    const client = clients.find(c => c.id === 101);
    expect(client.programs.length).toBe(1);
    expect(client.programs[0].programName).toContain('PROGILIC');
  });

  it('Scenario 2: Safely creates genuinely new customer with complete details and attaches operation', async () => {
    const item = { id: 'chk_new_1', name: 'زبون جديد سمير رحماني 0661445566 بوفاريك - تثبيت برنامج', state: 'complete' };
    const res = await syncTrelloChecklistItem(tenantId, item, { id: 'card_1' }, { id: 'board_1' });

    expect(res.status).toBe('SYNCED');
    expect(clients.length).toBe(3); // New client created
    const newClient = clients.find(c => c.id === res.clientId);
    expect(newClient.fullName).toContain('سمير رحماني');
    expect(newClient.phone).toBe('0661445566');
  });

  it('Scenario 3: Existing real-world customer missing from CRM is created without false acquisition tagging', async () => {
    const item = { id: 'chk_exist_miss', name: 'تجديد رخصة V24 للزبون كريم عيساوي 0555991122 سطيف', state: 'complete' };
    const res = await syncTrelloChecklistItem(tenantId, item, { id: 'card_1' }, { id: 'board_1' });

    expect(res.status).toBe('SYNCED');
    const client = clients.find(c => c.id === res.clientId);
    expect(client.status).toBe('نشط');
    expect(client.notes).toContain('Trello');
  });

  it('Scenario 4: Handles multiple customers in one Trello Card independently', async () => {
    const card = { id: 'card_multi' };
    const itemA = { id: 'chk_m1', name: 'أحمد بن علي 0550112233 - استفسار عن إغلاق اليومية', state: 'incomplete' };
    const itemB = { id: 'chk_m2', name: 'محمد قاسم 0770998877 - طلب إضافة قالب فاتورة مخصص', state: 'incomplete' };

    const resA = await syncTrelloChecklistItem(tenantId, itemA, card, { id: 'b1' });
    const resB = await syncTrelloChecklistItem(tenantId, itemB, card, { id: 'b1' });

    expect(resA.clientId).toBe(101);
    expect(resB.clientId).toBe(102);
    expect(resA.targetCollection).toBe('contacts');
    expect(resB.targetCollection).toBe('requirements');
  });

  it('Scenario 5: Duplicate Checklist Item delivery is skipped idempotently', async () => {
    const item = { id: 'chk_dup_1', name: 'أحمد بن علي 0550112233 - استفسار تدريبي', state: 'complete' };
    
    const res1 = await syncTrelloChecklistItem(tenantId, item, { id: 'c1' }, { id: 'b1' });
    expect(res1.status).toBe('SYNCED');

    const res2 = await syncTrelloChecklistItem(tenantId, item, { id: 'c1' }, { id: 'b1' });
    expect(res2.status).toBe('SYNCED');
    expect(res2.skipped).toBe(true);

    const client = clients.find(c => c.id === 101);
    expect(client.contactHistory.length).toBe(1); // Never duplicated
  });

  it('Scenario 6: Concurrent events acquire distributed lease and prevent parallel collisions', async () => {
    const item = { id: 'chk_concurrent', name: 'أحمد بن علي 0550112233 - تدريب على النظام', state: 'complete' };
    
    // Simulate active lease currently in flight
    await saveSyncRecord(tenantId, item.id, {
      status: 'PROCESSING',
      leaseExpiresAt: Date.now() + 10000,
      leaseToken: 'active_worker_token'
    });

    const res = await syncTrelloChecklistItem(tenantId, item, { id: 'c1' }, { id: 'b1' });
    expect(res.status).toBe('FAILED');
    expect(res.reason).toBe('CONCURRENT_PROCESSING_ACTIVE');
  });

  it('Scenario 7: Software installation routes to programs collection', () => {
    const extracted = {
      actionNature: 'installation',
      programName: 'PROGILIC POS',
      platform: 'Desktop',
      programType: 'تجاري',
      version: 'v27',
      confidence: 0.95,
      uncertainties: []
    };
    const route = determineOperationRoute(extracted, { status: 'MATCHED_EXISTING', client: { id: 101 } }, { state: 'complete' });
    expect(route.destination).toBe('programs');
    expect(route.payload.version).toBe('v27');
  });

  it('Scenario 8: Technical issue routes to issues collection', () => {
    const extracted = {
      actionNature: 'technical_issue',
      title: 'خطأ في قاعدة البيانات عند طباعة الوصل',
      issueType: 'خطأ تقني',
      priority: 'عاجل',
      confidence: 0.95,
      uncertainties: []
    };
    const route = determineOperationRoute(extracted, { status: 'MATCHED_EXISTING', client: { id: 101 } }, { state: 'incomplete' });
    expect(route.destination).toBe('issues');
    expect(route.payload.status).toBe('مفتوح');
  });

  it('Scenario 9: Feature requirement routes to requirements collection', () => {
    const extracted = {
      actionNature: 'requirement',
      title: 'إضافة تقرير مبيعات إجمالي لكل بائع',
      priority: 'عالية',
      impact: 'عالي',
      confidence: 0.92,
      uncertainties: []
    };
    const route = determineOperationRoute(extracted, { status: 'MATCHED_EXISTING', client: { id: 101 } }, { state: 'incomplete' });
    expect(route.destination).toBe('requirements');
    expect(route.payload.impact).toBe('عالي');
  });

  it('Scenario 10: Service intervention operation routes to contacts collection without bug ticket creation', () => {
    const extracted = {
      actionNature: 'service_intervention',
      actionDescription: 'جلسة مساعدة وإعداد إعدادات الشبكة',
      confidence: 0.92,
      uncertainties: []
    };
    const route = determineOperationRoute(extracted, { status: 'MATCHED_EXISTING', client: { id: 101 } }, { state: 'complete' });
    expect(route.destination).toBe('contacts');
    expect(route.destination).not.toBe('issues');
  });

  it('Scenario 11: Vidéo used for training is NOT classified as a technical issue', () => {
    const extracted = {
      actionNature: 'training',
      extractedInterventionMedium: 'Vidéo',
      actionDescription: 'شرح كيفية إدخال مشتريات وتحديث الأسعار عبر فيديو',
      confidence: 0.94,
      uncertainties: []
    };
    const route = determineOperationRoute(extracted, { status: 'MATCHED_EXISTING', client: { id: 101 } }, { state: 'complete' });
    expect(route.destination).toBe('contacts');
    expect(route.payload.note).toContain('[Vidéo]');
  });

  it('Scenario 12: Checklist item containing only "Vidéo" preserves medium without inventing a bug', () => {
    const extracted = {
      actionNature: 'service',
      extractedInterventionMedium: 'Vidéo',
      actionDescription: 'Vidéo',
      rawText: 'Vidéo',
      confidence: 0.90,
      uncertainties: []
    };
    const route = determineOperationRoute(extracted, { status: 'MATCHED_EXISTING', client: { id: 101 } }, { state: 'incomplete' });
    expect(route.destination).toBe('contacts');
    expect(route.payload.note).toBe('[Vidéo] Vidéo');
  });

  it('Scenario 13: Déplacement is logged as an operational vehicle / service, not a bug', () => {
    const extractedDepl = {
      actionNature: 'service',
      extractedInterventionMedium: 'Déplacement',
      actionDescription: 'Déplacement pour inventaire de fin d’année',
      confidence: 0.91,
      uncertainties: []
    };
    const route = determineOperationRoute(extractedDepl, { status: 'MATCHED_EXISTING', client: { id: 101 } }, { state: 'complete' });
    expect(route.destination).toBe('contacts');
    expect(route.destination).not.toBe('issues');
  });

  it('Scenario 14: Prestation is logged as a service intervention in contacts collection', () => {
    const extractedPrest = {
      actionNature: 'service',
      actionDescription: 'Prestation de maintenance mensuelle',
      confidence: 0.90,
      uncertainties: []
    };
    const route = determineOperationRoute(extractedPrest, { status: 'MATCHED_EXISTING', client: { id: 101 } }, { state: 'complete' });
    expect(route.destination).toBe('contacts');
    expect(route.destination).not.toBe('issues');
  });

  it('Scenario 15: Technical issue handled via Déplacement preserves both dimensions', () => {
    const extracted = {
      actionNature: 'technical_issue',
      extractedInterventionMedium: 'Déplacement',
      title: 'عطب في قارئ الباركود تم حله ميدانياً',
      confirmedResolved: true,
      outcomeEvidence: 'تم استبدال الكابل وضبط الإعدادات واختباره بنجاح',
      confidence: 0.95,
      uncertainties: []
    };
    const route = determineOperationRoute(extracted, { status: 'MATCHED_EXISTING', client: { id: 101 } }, { state: 'complete' });
    expect(route.destination).toBe('issues');
    expect(route.payload.status).toBe('محلول');
    expect(route.payload.solution).toContain('تم استبدال الكابل');
  });

  it('Scenario 16: Ambiguous operation routes to Human Review Queue', () => {
    const ambiguousCustomer = { status: 'AMBIGUOUS', candidates: [{ id: 1 }, { id: 2 }], confidence: 0.5 };
    const extracted = { actionNature: 'technical_issue', confidence: 0.7, uncertainties: ['Customer is uncertain'] };
    const route = determineOperationRoute(extracted, ambiguousCustomer, { state: 'incomplete' });
    expect(route.destination).toBe('review_queue');
  });

  it('Scenario 17: Operation status update does not falsely mark issues resolved without evidence', () => {
    const extracted = {
      actionNature: 'technical_issue',
      title: 'مشكلة مزامنة الشبكة',
      confirmedResolved: false,
      confidence: 0.9,
      uncertainties: []
    };
    const route = determineOperationRoute(extracted, { status: 'MATCHED_EXISTING', client: { id: 101 } }, { state: 'complete' });
    expect(route.payload.status).toBe('قيد المعالجة');
  });

  it('Scenario 18: Existing CRM record is updated in place without duplication', async () => {
    const item1 = { id: 'chk_upd', name: 'أحمد بن علي 0550112233 - عطب في الطابعة', state: 'incomplete' };
    const res1 = await syncTrelloChecklistItem(tenantId, item1, { id: 'c1' }, { id: 'b1' });
    expect(res1.status).toBe('SYNCED');

    const item2 = { id: 'chk_upd', name: 'أحمد بن علي 0550112233 - عطب في الطابعة تم حله', state: 'complete' };
    const res2 = await syncTrelloChecklistItem(tenantId, item2, { id: 'c1' }, { id: 'b1' });
    expect(res2.status).toBe('SYNCED');

    const client = clients.find(c => c.id === 101);
    expect(client.issues.length).toBe(1); // Updated in place
  });

  it('Scenario 19: Trello activities appear under actor Trello in Global Timeline', async () => {
    const item = { id: 'chk_tl_glob', name: 'أحمد بن علي 0550112233 - استفسار فني', state: 'complete' };
    await syncTrelloChecklistItem(tenantId, item, { id: 'c1' }, { id: 'b1' });

    expect(S.globalActivities.length).toBeGreaterThan(0);
    const globalAct = S.globalActivities[0];
    expect(globalAct.userName).toBe('Trello');
    expect(globalAct.userRole).toBe('Integration');
    expect(globalAct.source).toBe('trello');
  });

  it('Scenario 20: Trello activities appear under actor Trello in Client Timeline', async () => {
    S.selId = 101;
    const item = { id: 'chk_tl_cli', name: 'أحمد بن علي 0550112233 - تدريب على المبيعات', state: 'complete' };
    await syncTrelloChecklistItem(tenantId, item, { id: 'c1' }, { id: 'b1' });

    expect(S.clientActivities.length).toBeGreaterThan(0);
    expect(S.clientActivities[0].userName).toBe('Trello');
  });

  it('Scenario 21: Manual CRM operations retain the real employee identity', async () => {
    setCurrentStaffUser({ id: 'emp_kareem', name: 'كريم بلحاج', role: 'technique', department: 'الدعم الفني' });
    await logActivity(101, ActivityType.ISSUE_EDITED, 'تعديل تذكرة يدوياً', 'تم تعديل المشكلة من طرف كريم', 'local');

    const lastAct = S.globalActivities[0];
    expect(lastAct.userName).toBe('كريم بلحاج');
    expect(lastAct.userRole).toBe('الدعم الفني');
    expect(lastAct.userName).not.toBe('Trello');
  });

  it('Scenario 22: Reject events from unauthorized board or list (Dual Scope Enforcement)', () => {
    const allowedBoard = 'board_prod_123';
    const allowedList = 'list_programme_de_services_456';

    const validEvent = { action: { data: { board: { id: allowedBoard }, list: { id: allowedList } } } };
    const invalidListEvent = { action: { data: { board: { id: allowedBoard }, list: { id: 'list_app_vdd_789' } } } };
    const invalidBoardEvent = { action: { data: { board: { id: 'foreign_board' }, list: { id: allowedList } } } };

    expect(isEventInTrelloScope(validEvent, allowedBoard, allowedList).inScope).toBe(true);
    expect(isEventInTrelloScope(invalidListEvent, allowedBoard, allowedList).inScope).toBe(false);
    expect(isEventInTrelloScope(invalidBoardEvent, allowedBoard, allowedList).inScope).toBe(false);
  });

  it('Scenario 23: Historical import dry run produces zero production writes', async () => {
    const initialClientsCount = clients.length;
    const items = [
      { id: 'dry_1', name: 'عميل غير مسجل 0661223344 سطيف - تثبيت برنامج', state: 'complete' },
      { id: 'dry_2', name: 'أحمد بن علي 0550112233 - مشكلة في الشبكة', state: 'incomplete' }
    ];

    const report = await runHistoricalDryRun(tenantId, items, { cardName: 'Card' });

    expect(report.totalItemsScanned).toBe(2);
    expect(report.toCreateCount).toBe(2);
    expect(clients.length).toBe(initialClientsCount); // Zero production client writes!
    const client = clients.find(c => c.id === 101);
    expect(client.issues.length).toBe(0); // Zero production issue writes!
  });

  // --- MILESTONE 1 to 4 SECURITY & CONCURRENCY REMEDIATION TESTS ---

  it('Remediation 1 (Security): HMAC signature verification fails closed on missing secret, header, or URL', () => {
    const body = '{"test":1}';
    const secret = 'valid_secret_key';
    const url = 'https://example.com/api/trello/webhook';

    // 1. Missing secret -> Fail closed
    expect(verifyTrelloWebhookSignature(body, 'any_sig', url, null)).toBe(false);
    expect(verifyTrelloWebhookSignature(body, 'any_sig', url, '')).toBe(false);

    // 2. Missing signature header -> Fail closed
    expect(verifyTrelloWebhookSignature(body, null, url, secret)).toBe(false);
    expect(verifyTrelloWebhookSignature(body, '', url, secret)).toBe(false);

    // 3. Missing callback URL -> Fail closed
    expect(verifyTrelloWebhookSignature(body, 'any_sig', null, secret)).toBe(false);

    // 4. Invalid / tampered signature -> Fail closed
    expect(verifyTrelloWebhookSignature(body, 'tampered_signature', url, secret)).toBe(false);

    // 5. Valid signature -> Constant-time verification succeeds
    const computed = crypto.createHmac('sha1', secret).update(body + url).digest('base64');
    expect(verifyTrelloWebhookSignature(body, computed, url, secret)).toBe(true);
  });

  it('Remediation 2 (Security): Incomplete webhook payloads lacking board or list are strictly rejected', () => {
    const allowedBoard = 'board_1';
    const allowedList = 'list_1';

    expect(isEventInTrelloScope({ action: { data: {} } }, allowedBoard, allowedList).inScope).toBe(false);
    expect(isEventInTrelloScope({ action: { data: { board: { id: allowedBoard } } } }, allowedBoard, allowedList).inScope).toBe(false);
  });

  it('Remediation 3 (Concurrency): Stale worker fencing rejects writes after lease expires or is overtaken', async () => {
    const item = { id: 'chk_stale_1', name: 'أحمد بن علي 0550112233 - مشكلة عاجلة', state: 'incomplete' };
    
    // Worker runs with an artificially short 1ms lease
    const res = await syncTrelloChecklistItem(tenantId, item, { id: 'c1' }, { id: 'b1' }, { leaseDurationMs: -100 });
    
    // Fencing gate must catch the expired lease before any CRM state mutation
    expect(res.status).toBe('FAILED');
    expect(res.error).toBe('STALE_WORKER_FENCING_REJECTED');

    const client = clients.find(c => c.id === 101);
    expect(client.issues.length).toBe(0); // Zero writes permitted
  });

  it('Remediation 4 (Arabic Identity): Normalized name alone cannot confirm customer identity without secondary corroboration', () => {
    // Client 101 is "أحمد بن علي" in wilaya "وهران", phone "0550112233"
    // Incoming is normalized variation "احمد بن على" without phone, without company, without wilaya
    const ambiguousCustomer = {
      rawName: 'احمد بن على',
      phone: null,
      company: null,
      wilaya: null
    };

    const res = resolveTrelloCustomer(ambiguousCustomer, clients);
    // Must NOT be MATCHED_EXISTING without secondary corroboration!
    expect(res.status).toBe('AMBIGUOUS');
    expect(res.matchType).toBe('NAME_ONLY_UNCONFIRMED');

    // With secondary corroboration (wilaya match)
    const corroboratedCustomer = {
      rawName: 'احمد بن على',
      phone: null,
      company: null,
      wilaya: 'وهران'
    };
    const resCorr = resolveTrelloCustomer(corroboratedCustomer, clients);
    expect(resCorr.status).toBe('MATCHED_EXISTING');
    expect(resCorr.client.id).toBe(101);
  });

  it('Remediation 5 (Persistence): Review Queue resolution persists to client subcollection and enqueues sync action', async () => {
    const itemId = 'rev_persist_1';
    await saveSyncRecord(tenantId, itemId, {
      status: 'REVIEW_REQUIRED',
      rawText: 'طلب تدريب إضافي للموظفين'
    });

    const res = await resolveReviewItem(tenantId, itemId, {
      approved: true,
      selectedClientId: 101,
      destination: 'contacts',
      resolvedBy: 'Auditor'
    });

    expect(res.status).toBe('APPROVED');
    const client = clients.find(c => c.id === 101);
    expect(client.contactHistory.length).toBe(1);
    expect(client.contactHistory[0].note).toContain('طلب تدريب إضافي');
    expect(S.syncQueue.length).toBeGreaterThan(0); // Enqueued to Firestore sync engine
  });

  it('Remediation 6 (Rollback): Safe item rollback reverts created record and preserves pre-existing customer', async () => {
    const item = { id: 'chk_roll_1', name: 'أحمد بن علي 0550112233 - تثبيت برنامج تجاري v27', state: 'complete' };
    
    // Sync operation
    const syncRes = await syncTrelloChecklistItem(tenantId, item, { id: 'c1' }, { id: 'b1' });
    expect(syncRes.status).toBe('SYNCED');

    const client = clients.find(c => c.id === 101);
    expect(client.programs.length).toBe(1);

    // Rollback operation
    const rollRes = await rollbackTrelloItem(tenantId, item.id);
    expect(rollRes.status).toBe('ROLLED_BACK');
    expect(client.programs.length).toBe(0); // Item rolled back cleanly
    expect(clients.some(c => c.id === 101)).toBe(true); // Customer profile strictly preserved!
  });

  it('Remediation 7 (Rollback Protection): Rollback aborts with conflict if human staff manually edited the record', async () => {
    const item = { id: 'chk_roll_conflict', name: 'أحمد بن علي 0550112233 - عطب في الطابعة', state: 'incomplete' };
    await syncTrelloChecklistItem(tenantId, item, { id: 'c1' }, { id: 'b1' });

    const client = clients.find(c => c.id === 101);
    expect(client.issues.length).toBe(1);

    // Human employee modifies the issue manually
    client.issues[0].lastModifiedBy = 'emp_kareem';
    client.issues[0].notes = 'تم فحص الطابعة من طرف كريم وتغيير الرول';

    // Attempt rollback
    const rollRes = await rollbackTrelloItem(tenantId, item.id);
    expect(rollRes.status).toBe('CONFLICT_MANUAL_EDITS_DETECTED');
    expect(client.issues.length).toBe(1); // Manual edit protected from deletion
  });
});
