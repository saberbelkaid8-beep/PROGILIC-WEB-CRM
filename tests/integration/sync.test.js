import { describe, it, expect, beforeEach, vi } from 'vitest';
import { commitOnlineMutation, flushSyncQueue, resolveConflict, loadCache } from '../../src/business/storage.js';
import { S, clients, updateState, setCurrentUser, resetTenantSessionState } from '../../src/state/store.js';
import * as firebaseService from '../../src/firebase/service.js';

vi.mock('../../src/firebase/service.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    addClientTransaction: vi.fn(),
    updateClientTransaction: vi.fn(),
    deleteClientTransaction: vi.fn(),
    saveClientSubItemTransaction: vi.fn(),
    deleteClientSubItemTransaction: vi.fn(),
    syncProgramVersionTransaction: vi.fn()
  };
});

describe('Real-Time Auto-Sync, Durable Offline Queue & OCC Conflict Lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.clear();
    }
    resetTenantSessionState();
    setCurrentUser({ uid: 'test-uid', email: 'admin@progilic.dz', role: 'gerant' });
    updateState({
      syncQueue: [],
      pendingSyncCount: 0,
      hasPendingLocalWrites: false,
      isOnline: true,
      quotaExceeded: false,
      clients: [{ id: 1, fullName: 'Original', version: 1 }]
    });
  });

  it('queues offline mutations durably in localStorage and flushes automatically in FIFO order when back online', async () => {
    S.isOnline = false;

    const queuedAck = await commitOnlineMutation('UPDATE_CLIENT', {
      clientId: '1',
      clientData: { id: 1, fullName: 'Offline Edit' },
      oldStatus: 'نشط',
      stats: S.stats,
      baseVersion: 1
    });

    expect(queuedAck.queued).toBe(true);
    expect(queuedAck.acknowledged).toBe(false);
    expect(S.syncQueue.length).toBe(1);
    expect(S.pendingSyncCount).toBe(1);
    expect(S.hasPendingLocalWrites).toBe(true);
    expect(firebaseService.updateClientTransaction).not.toHaveBeenCalled();

    // Verify persistence across reload via loadCache()
    updateState({ syncQueue: [], pendingSyncCount: 0, hasPendingLocalWrites: false });
    await loadCache();
    expect(S.syncQueue.length).toBe(1);

    // Reconnect and flush FIFO
    S.isOnline = true;
    firebaseService.updateClientTransaction.mockResolvedValueOnce({ version: 2, updatedAt: '2026-11-20T10:15:00Z' });
    const flushed = await flushSyncQueue('test-uid');

    expect(flushed).toBe(true);
    expect(firebaseService.updateClientTransaction).toHaveBeenCalledTimes(1);
    expect(S.syncQueue.length).toBe(0);
    expect(S.pendingSyncCount).toBe(0);
    expect(S.hasPendingLocalWrites).toBe(false);
    expect(S.connectionState).toBe('live');
    expect(S.hasConfirmedServerSync).toBe(true);
  });

  it('rejects permission-denied and quota mutations immediately without queuing locally', async () => {
    S.isOnline = true;
    const permErr = new Error('Missing or insufficient permissions.');
    permErr.code = 'permission-denied';
    firebaseService.updateClientTransaction.mockRejectedValueOnce(permErr);

    await expect(
      commitOnlineMutation('UPDATE_CLIENT', {
        clientId: '1',
        clientData: { id: 1, fullName: 'Unauthorized' },
        oldStatus: 'نشط',
        stats: S.stats,
        baseVersion: 1
      })
    ).rejects.toMatchObject({ code: 'permission-denied' });

    expect(S.syncQueue.length).toBe(0);

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

  it('commits online mutations immediately and returns acknowledged: true upon server ACK', async () => {
    S.isOnline = true;
    firebaseService.addClientTransaction.mockResolvedValueOnce({ version: 1, updatedAt: '2026-11-20T10:00:00Z' });

    const ack = await commitOnlineMutation('ADD_CLIENT', {
      clientData: { id: 2, fullName: 'Confirmed Client' },
      stats: S.stats
    });

    expect(ack.acknowledged).toBe(true);
    expect(ack.queued).toBe(false);
    expect(ack.version).toBe(1);
    expect(firebaseService.addClientTransaction).toHaveBeenCalledTimes(1);
    expect(S.hasConfirmedServerSync).toBe(true);
    expect(S.connectionState).toBe('live');
  });

  it('opens conflict modal on VERSION_CONFLICT without queuing into offline retry queue', async () => {
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

  it('handles resolveConflict(server) and resolveConflict(merge) via online server transaction', async () => {
    S.conflictItem = {
      id: '123',
      type: 'UPDATE_CLIENT',
      payload: { clientId: '1', clientData: { id: 1, fullName: 'Local Edit' } }
    };
    S.conflictServerData = { id: 1, fullName: 'Server Edit', version: 2 };
    S.modal = 'conflict';

    const ok = await resolveConflict('server');
    expect(ok).toBe(true);
    expect(clients.find(c => c.id == 1).fullName).toBe('Server Edit');
    expect(S.modal).toBeNull();

    S.conflictItem = {
      id: '124',
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
    expect(clients.find(c => c.id == 1).version).toBe(3);
    expect(S.modal).toBeNull();
  });

  it('commits SYNC_PROGRAM_VERSION through syncProgramVersionTransaction and supports conflict resolution', async () => {
    S.isOnline = true;
    const conflictErr = new Error('VERSION_CONFLICT');
    conflictErr.code = 'VERSION_CONFLICT';
    conflictErr.serverData = { id: 1, fullName: 'Original', version: 4 };

    firebaseService.syncProgramVersionTransaction.mockRejectedValueOnce(conflictErr);

    await expect(
      commitOnlineMutation('SYNC_PROGRAM_VERSION', {
        clientId: '1',
        updatedPrograms: [{ id: 10, programName: 'Mobile - تطبيق VDD V22', version: 'V22', installationsCount: 4 }],
        counterUpdates: { programsCount: 1, installationsCount: 4 },
        versionHistoryEntry: { id: 'vh-1', newVersion: 'V22', previousVersion: 'V21' },
        baseVersion: 1
      })
    ).rejects.toMatchObject({ code: 'VERSION_CONFLICT' });

    expect(S.modal).toBe('conflict');

    firebaseService.syncProgramVersionTransaction.mockResolvedValueOnce({
      version: 5,
      updatedAt: '2026-11-24T12:00:00Z',
      updatedPrograms: [{ id: 10, programName: 'Mobile - تطبيق VDD V22', version: 'V22', installationsCount: 4 }],
      versionHistory: [{ id: 'vh-1', newVersion: 'V22', previousVersion: 'V21' }]
    });

    const resolved = await resolveConflict('local');
    expect(resolved).toBe(true);
    expect(firebaseService.syncProgramVersionTransaction).toHaveBeenCalledTimes(2);
    expect(clients.find(c => c.id == 1).version).toBe(5);
  });
});
