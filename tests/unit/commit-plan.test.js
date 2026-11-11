import { describe, expect, it } from 'vitest';
import { createCommitPlan } from '../../src/business/trello/commitPlan.js';
import { OPERATION_DESTINATION, TRELLO_SYNC_STATUS } from '../../src/business/trello/trelloTypes.js';

describe('Commit Plan Pure Schema & Determinism Contract', () => {
  it('generates a deterministic Review Plan when route specifies REVIEW_QUEUE', () => {
    const plan = createCommitPlan({
      tenantId: 'test-tenant',
      checklistItem: { id: 'chk_123', name: 'خدمة غامضة', state: 'incomplete' },
      card: { id: 'c_999', name: 'Dimanche 01-11-2026' },
      board: { id: 'b_001' },
      extracted: { actionNature: 'service', confidence: 0.3, uncertainties: ['Uncertain client'] },
      customerResolution: { status: 'AMBIGUOUS' },
      route: { destination: OPERATION_DESTINATION.REVIEW_QUEUE, reason: 'AMBIGUOUS_CUSTOMER' }
    });

    expect(plan.type).toBe('REVIEW_REQUIRED');
    expect(plan.checklistItemId).toBe('chk_123');
    expect(plan.crmMutations).toBeNull();
    expect(plan.reviewRecord).toBeDefined();
    expect(plan.reviewRecord.reviewReason).toBe('AMBIGUOUS_CUSTOMER');
    expect(plan.mappingRecord.status).toBe(TRELLO_SYNC_STATUS.REVIEW_REQUIRED);
  });

  it('generates an Apply Mutation Plan when route is resolved with existing client', () => {
    const plan = createCommitPlan({
      tenantId: 'test-tenant',
      checklistItem: { id: 'chk_456', name: 'تثبيت البرنامج', state: 'complete' },
      card: { id: 'c_999', name: 'Dimanche 01-11-2026' },
      board: { id: 'b_001' },
      extracted: { actionNature: 'installation', confidence: 0.95 },
      customerResolution: { status: 'EXACT_MATCH', client: { id: 101, fullName: 'صيدلية النور' } },
      route: { destination: OPERATION_DESTINATION.PROGRAMS, payload: { name: 'PROGILIC PHARMA' }, auditTitle: 'تثبيت رخصة' }
    });

    expect(plan.type).toBe('APPLY_MUTATION');
    expect(plan.crmMutations).toBeDefined();
    expect(plan.crmMutations.clientId).toBe(101);
    expect(plan.crmMutations.collectionKey).toBe(OPERATION_DESTINATION.PROGRAMS);
    expect(plan.timelineActivity).toBeDefined();
    expect(plan.timelineActivity.userName).toBe('Trello');
    expect(plan.timelineActivity.userId).toBe('trello-integration');
    expect(plan.mappingRecord.status).toBe(TRELLO_SYNC_STATUS.SYNCED);
  });
});
