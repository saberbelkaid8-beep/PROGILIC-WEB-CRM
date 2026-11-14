import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const serviceMocks = vi.hoisted(() => ({
  getTenantActivities: vi.fn(),
  saveTenantActivity: vi.fn(),
  saveTenantActivitiesBatch: vi.fn(),
  saveClientSubItemTransaction: vi.fn(),
  saveClientSubItemsBatch: vi.fn()
}));

vi.mock('../../src/firebase/service.js', () => ({
  getTenantActivities: serviceMocks.getTenantActivities,
  saveTenantActivity: serviceMocks.saveTenantActivity,
  saveTenantActivitiesBatch: serviceMocks.saveTenantActivitiesBatch,
  saveClientSubItemTransaction: serviceMocks.saveClientSubItemTransaction,
  saveClientSubItemsBatch: serviceMocks.saveClientSubItemsBatch,
  getUserData: vi.fn(),
  saveUserData: vi.fn(),
  getClientsPage: vi.fn(),
  getClientSubcollections: vi.fn(),
  addClientTransaction: vi.fn(),
  updateClientTransaction: vi.fn(),
  deleteClientTransaction: vi.fn(),
  deleteClientSubItemTransaction: vi.fn(),
  getEmployeesForTenant: vi.fn(),
  saveEmployeeForTenant: vi.fn(),
  deleteEmployeeForTenant: vi.fn()
}));

import { S, clients, setClients, setCurrentUser, updateState } from '../../src/state/store.js';
import { reconcileMissingPrograms, resetReconciliationSession } from '../../src/business/programReconciliationService.js';
import { loadGlobalActivities, syncCrmServicesToTimeline } from '../../src/business/timelineService.js';

describe('Boot Sync Storm & BatchGetDocuments Unavailable Prevention', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetReconciliationSession();
    setCurrentUser({ uid: 'tenant-storm-1', role: 'gerant', email: 'ceo@progilic.dz' });
    updateState({
      clients: [],
      globalActivities: [],
      syncQueue: []
    });

    serviceMocks.getTenantActivities.mockImplementation(async () => {
      await new Promise(resolve => setTimeout(resolve, 15));
      return [];
    });
    serviceMocks.saveTenantActivitiesBatch.mockImplementation(async (_uid, list) => {
      await new Promise(resolve => setTimeout(resolve, 15));
      return list.map(a => a.id);
    });
    serviceMocks.saveClientSubItemsBatch.mockImplementation(async (_uid, entries) => {
      await new Promise(resolve => setTimeout(resolve, 15));
      return entries.length;
    });
  });

  afterEach(() => {
    resetReconciliationSession();
    setCurrentUser(null);
    setClients([]);
    updateState({ globalActivities: [], syncQueue: [] });
  });

  it('reconcileMissingPrograms deduplicates concurrent calls and uses batched writes instead of firing per-client transaction storms', async () => {
    const bulkClients = Array.from({ length: 120 }, (_, idx) => ({
      id: 100 + idx,
      fullName: `عميل ${idx + 1}`,
      status: 'نشط',
      programs: [],
      programNames: [`Desktop - تجاري V27`],
      installationsCount: 1,
      issues: [],
      requirements: [],
      contactHistory: []
    }));
    setClients(bulkClients);

    const bulkActivities = Array.from({ length: 120 }, (_, idx) => ({
      id: `act-prog-${idx + 1}`,
      clientId: 100 + idx,
      clientName: `عميل ${idx + 1}`,
      type: 'PROGRAM_ADDED',
      title: 'خدمة ترخيص برنامج: Desktop - تجاري V27',
      description: 'إضافة خدمة برمجية "Desktop - تجاري V27"',
      timestamp: '2026-11-12T10:00:00Z',
      meta: {
        program: {
          id: 5000 + idx,
          programName: 'Desktop - تجاري V27',
          platform: 'Desktop',
          type: 'تجاري (Commercial)',
          version: 'V27',
          installationsCount: 1
        }
      }
    }));
    updateState({ globalActivities: bulkActivities });

    const [r1, r2, r3] = await Promise.all([
      reconcileMissingPrograms('tenant-storm-1'),
      reconcileMissingPrograms('tenant-storm-1'),
      reconcileMissingPrograms('tenant-storm-1')
    ]);

    expect(r1.reconciledCount).toBe(120);
    expect(r2.reconciledCount).toBe(120);
    expect(r3.reconciledCount).toBe(120);

    // Must use batched write once instead of 120+ parallel saveClientSubItemTransaction calls
    expect(serviceMocks.saveClientSubItemsBatch).toHaveBeenCalledTimes(1);
    expect(serviceMocks.saveClientSubItemsBatch.mock.calls[0][1]).toHaveLength(120);
    expect(serviceMocks.saveClientSubItemTransaction).not.toHaveBeenCalled();

    // All clients now have recovered programs in memory
    expect(clients.every(c => Array.isArray(c.programs) && c.programs.length === 1)).toBe(true);

    // Subsequent call in same session produces zero redundant writes
    const r4 = await reconcileMissingPrograms('tenant-storm-1');
    expect(r4.reconciledCount).toBe(0);
    expect(serviceMocks.saveClientSubItemsBatch).toHaveBeenCalledTimes(1);
  });

  it('syncCrmServicesToTimeline and loadGlobalActivities deduplicate concurrent invocations and commit via saveTenantActivitiesBatch', async () => {
    const bulkClients = Array.from({ length: 120 }, (_, idx) => ({
      id: 500 + idx,
      fullName: `شركة ${idx + 1}`,
      status: 'نشط',
      startDate: '2026-11-01',
      programs: [
        { id: 9000 + idx, programName: 'Desktop - تجاري V27', platform: 'Desktop', type: 'تجاري', version: 'V27', installationsCount: 1, startDate: '2026-11-01' }
      ],
      issues: [],
      requirements: [],
      contactHistory: []
    }));
    setClients(bulkClients);

    const [g1, g2] = await Promise.all([
      syncCrmServicesToTimeline('tenant-storm-1'),
      syncCrmServicesToTimeline('tenant-storm-1')
    ]);

    expect(g1.length).toBe(240);
    expect(g2.length).toBe(240);
    expect(serviceMocks.saveTenantActivitiesBatch).toHaveBeenCalledTimes(1);
    expect(serviceMocks.saveTenantActivitiesBatch.mock.calls[0][1]).toHaveLength(240);
    expect(serviceMocks.saveTenantActivity).not.toHaveBeenCalled();

    // Concurrent loadGlobalActivities calls share a single fetch
    const [l1, l2] = await Promise.all([
      loadGlobalActivities(),
      loadGlobalActivities()
    ]);
    expect(l1.length).toBeGreaterThanOrEqual(240);
    expect(l2.length).toBeGreaterThanOrEqual(240);
    expect(serviceMocks.getTenantActivities).toHaveBeenCalledTimes(1);
    expect(serviceMocks.saveTenantActivitiesBatch).toHaveBeenCalledTimes(1);
  });
});
