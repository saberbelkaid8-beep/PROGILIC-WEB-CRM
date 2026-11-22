import { describe, it, expect, beforeEach, vi } from 'vitest';
import { commitOnlineMutation, flushSyncQueue, resolveConflict } from '../../src/business/storage.js';
import { S, updateState, setCurrentUser, resetTenantSessionState } from '../../src/state/store.js';
import * as firebaseService from '../../src/firebase/service.js';

vi.mock('../../src/firebase/service.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    addClientTransaction: vi.fn(),
    updateClientTransaction: vi.fn(),
    deleteClientTransaction: vi.fn(),
    saveClientSubItemTransaction: vi.fn(),
    deleteClientSubItemTransaction: vi.fn()
  };
});

describe('Strict Online-Only Sync & OCC Conflict Lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetTenantSessionState();
    setCurrentUser({ uid: 'test-uid', email: 'admin@progilic.dz', role: 'gerant' });
    updateState({
      syncQueue: [],
      isOnline: true,
      quotaExceeded: false,
      clients: [{ id: 1, fullName: 'Original', version: 1 }]
    });
  });

  it('should reject mutations immediately when offline without queuing', async () => {
    S.isOnline = false;

    await expect(
      commitOnlineMutation('UPDATE_CLIENT', {
        clientId: '1',
        clientData: { id: 1, fullName: 'Offline Edit' },
        oldStatus: 'نشط',
        stats: S.stats,
        baseVersion: 1
      })
    ).rejects.toMatchObject({ code: 'network-offline' });

    expect(S.syncQueue.length).toBe(0);
    expect(firebaseService.updateClientTransaction).not.toHaveBeenCalled();
  });

  it('should reject mutations when quota circuit breaker is tripped', async () => {
    S.quotaExceeded = true;
    globalThis.__progilicFirestoreQuotaExceeded = true;

    await expect(
      commitOnlineMutation('ADD_CLIENT', {
        clientData: { id: 2, fullName: 'Blocked' },
        stats: S.stats
      })
    ).rejects.toMatchObject({ code: 'resource-exhausted' });

    expect(firebaseService.addClientTransaction).not.toHaveBeenCalled();
  });

  it('should flush/clear any legacy syncQueue and commit online mutations only upon server acknowledgement', async () => {
    S.isOnline = true;
    firebaseService.addClientTransaction.mockResolvedValueOnce({ version: 1, updatedAt: '2026-11-20T10:00:00Z' });

    const ack = await commitOnlineMutation('ADD_CLIENT', {
      clientData: { id: 2, fullName: 'Confirmed Client' },
      stats: S.stats
    });

    expect(ack.version).toBe(1);
    expect(firebaseService.addClientTransaction).toHaveBeenCalledTimes(1);
    expect(S.hasConfirmedServerSync).toBe(true);
    expect(S.connectionState).toBe('live');

    await flushSyncQueue();
    expect(S.syncQueue.length).toBe(0);
  });

  it('should open conflict modal on VERSION_CONFLICT without queuing offline', async () => {
    S.isOnline = true;
    const conflictError = new Error('VERSION_CONFLICT');
    conflictError.code = 'VERSION_CONFLICT';
    conflictError.serverData = { id: 1, fullName: 'Server Edit', version: 2 };

    firebaseService.updateClientTransaction.mockRejectedValueOnce(conflictError);

    await expect(
      commitOnlineMutation('UPDATE_CLIENT', {
        clientId: '1',
        clientData: { id: 1, fullName: 'Local Edit' },
        oldStatus: 'نشط',
        stats: {},
        baseVersion: 1
      })
    ).rejects.toMatchObject({ code: 'VERSION_CONFLICT' });

    expect(S.modal).toBe('conflict');
    expect(S.conflictItem).toBeDefined();
    expect(S.conflictServerData).toEqual({ id: 1, fullName: 'Server Edit', version: 2 });
    expect(S.syncQueue.length).toBe(0);
  });

  it('should handle resolveConflict(server) by accepting authoritative cloud record', async () => {
    S.conflictItem = {
      id: '123',
      type: 'UPDATE_CLIENT',
      payload: { clientId: '1', clientData: { id: 1, fullName: 'Local Edit' } }
    };
    S.conflictServerData = { id: 1, fullName: 'Server Edit', version: 2 };
    S.modal = 'conflict';

    const ok = await resolveConflict('server');

    expect(ok).toBe(true);
    expect(S.clients.find(c => c.id == 1).fullName).toBe('Server Edit');
    expect(S.syncQueue.length).toBe(0);
    expect(S.modal).toBeNull();
  });

  it('should handle resolveConflict(local) and resolveConflict(merge) via online server transaction', async () => {
    S.conflictItem = {
      id: '123',
      type: 'UPDATE_CLIENT',
      payload: { clientId: '1', clientData: { id: 1, fullName: 'Local Edit', notes: 'Local Note' }, oldStatus: 'نشط', stats: {} }
    };
    S.conflictServerData = { id: 1, fullName: 'Server Edit', wilaya: 'الجزائر', version: 2 };
    S.modal = 'conflict';

    firebaseService.updateClientTransaction.mockResolvedValueOnce({ version: 3, updatedAt: '2026-11-20T10:05:00Z' });

    const mergedOk = await resolveConflict('merge');

    expect(mergedOk).toBe(true);
    expect(firebaseService.updateClientTransaction).toHaveBeenCalledWith(
      'test-uid',
      '1',
      expect.objectContaining({ fullName: 'Local Edit', wilaya: 'الجزائر', notes: 'Local Note' }),
      'نشط',
      {},
      2
    );
    expect(S.clients.find(c => c.id == 1).version).toBe(3);
    expect(S.modal).toBeNull();
  });
});
