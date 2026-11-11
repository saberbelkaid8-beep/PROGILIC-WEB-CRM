import { describe, expect, it, beforeEach } from 'vitest';
import { syncTrelloChecklistItem, inMemorySyncStore, inMemoryReviewQueue, resetServerAdminRepoForTesting } from '../../src/business/trello/trelloSyncService.js';
import { setClients, clients } from '../../src/state/store.js';
import { createTestAdminRepository } from '../../src/server/firestoreAdminRepository.js';
import { setServerAdminRepo } from '../../src/business/trello/trelloSyncService.js';
import { TRELLO_SYNC_STATUS, OPERATION_DESTINATION } from '../../src/business/trello/trelloTypes.js';

describe('Sunday Trello Card Sandbox Scenario (Phase 8 Isolation Test)', () => {
  const tenantId = 'sandbox-test-tenant-uid';
  const card = {
    id: 'card_sunday_demo_1',
    name: 'Dimanche 01-11-2026',
    due: '2026-11-01T17:00:00.000Z'
  };
  const board = { id: 'board_progilic_service', name: 'PROGRAMME DE SERVICES' };

  const initialClients = [
    {
      id: 201,
      fullName: 'صيدلية الأمل',
      phone: '0551223344',
      company: 'صيدلية الأمل',
      wilaya: 'الجزائر',
      status: 'نشط',
      programs: [],
      issues: [],
      requirements: [],
      contactHistory: []
    },
    {
      id: 202,
      fullName: 'شركة السعادة',
      phone: '0662334455',
      company: 'شركة السعادة',
      wilaya: 'وهران',
      status: 'نشط',
      programs: [],
      issues: [],
      requirements: [],
      contactHistory: []
    }
  ];

  beforeEach(() => {
    inMemorySyncStore.clear();
    inMemoryReviewQueue.clear();
    setClients(initialClients);
    const testRepo = createTestAdminRepository(initialClients);
    testRepo.seedClients(tenantId, initialClients);
    setServerAdminRepo(testRepo);
  });

  // Checklist Item 1: Software Installation (Programs)
  const item1 = {
    id: 'chk_sunday_item_1',
    name: 'صيدلية الأمل 0551223344 - تثبيت برنامج v27 تجاري',
    state: 'complete'
  };

  // Checklist Item 2: Defect/Bug in Progress (Issues)
  const item2 = {
    id: 'chk_sunday_item_2',
    name: 'شركة السعادة 0662334455 - مشكلة في طباعة الفواتير خطأ تقني',
    state: 'complete'
  };

  // Checklist Item 3: Ambiguous Client / Low Detail (Review Queue)
  const item3 = {
    id: 'chk_sunday_item_3',
    name: 'Vidéo', // Terse / ambiguous label without client
    state: 'incomplete'
  };

  it('processes Sunday card items independently into appropriate CRM destinations', async () => {
    // 1. Process Installation Item
    const res1 = await syncTrelloChecklistItem(tenantId, item1, card, board);
    expect(res1.status).toBe(TRELLO_SYNC_STATUS.SYNCED);
    expect(res1.destination).toBe(OPERATION_DESTINATION.PROGRAMS);
    expect(res1.targetRecordId).toBeDefined();

    // 2. Process Technical Issue Item
    const res2 = await syncTrelloChecklistItem(tenantId, item2, card, board);
    expect(res2.status).toBe(TRELLO_SYNC_STATUS.SYNCED);
    expect(res2.destination).toBe(OPERATION_DESTINATION.ISSUES);
    // Completion checkbox does not imply automatic resolution
    expect(res2.payload?.status).not.toBe('محلول');

    // 3. Process Terse/Ambiguous Item (Must be routed to review queue)
    const res3 = await syncTrelloChecklistItem(tenantId, item3, card, board);
    expect(res3.status).toBe(TRELLO_SYNC_STATUS.REVIEW_REQUIRED);
    expect(inMemoryReviewQueue.size).toBeGreaterThanOrEqual(1);
  });

  it('proves idempotency: replaying identical items creates zero duplicate records', async () => {
    const resA = await syncTrelloChecklistItem(tenantId, item1, card, board);
    expect(resA.status).toBe(TRELLO_SYNC_STATUS.SYNCED);
    const initialRecordId = resA.targetRecordId;

    // Second sync of identical item
    const resB = await syncTrelloChecklistItem(tenantId, item1, card, board);
    expect(resB.status).toBe(TRELLO_SYNC_STATUS.SYNCED);
    expect(resB.skipped).toBe(true);
    expect(resB.targetRecordId).toBe(initialRecordId);
  });

  it('proves in-place update when checklist item is modified at source', async () => {
    await syncTrelloChecklistItem(tenantId, item1, card, board);

    // Modified version of item 1 with client and updated installation details
    const modifiedItem1 = {
      ...item1,
      name: 'صيدلية الأمل 0551223344 - تثبيت برنامج نقاط البيع إضافة طابعتين'
    };

    const resUpdate = await syncTrelloChecklistItem(tenantId, modifiedItem1, card, board);
    expect(resUpdate.status).toBe(TRELLO_SYNC_STATUS.SYNCED);
    expect(resUpdate.actionType).toBe('RECORD_UPDATED');
  });
});
