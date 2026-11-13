import { describe, it, expect, beforeEach, vi } from 'vitest';
import { enqueueSyncAction, flushSyncQueue, resolveConflict } from '../../src/business/storage.js';
import { S, updateState, setClients, setCurrentUser } from '../../src/state/store.js';
import * as firebaseService from '../../src/firebase/service.js';
import * as idbStorage from '../../src/business/idbStorage.js';

vi.mock('../../src/business/idbStorage.js', () => ({
  getClients: vi.fn(async () => []),
  getSyncQueue: vi.fn(async () => []),
  saveClients: vi.fn(async () => true),
  setMeta: vi.fn(async () => true),
  saveSyncQueue: vi.fn(async () => true)
}));

vi.mock('../../src/firebase/service.js', () => ({
  addClientTransaction: vi.fn(),
  updateClientTransaction: vi.fn(),
}));

describe('Sync Queue Lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setCurrentUser({ uid: 'test-uid' });
    updateState({ 
      syncQueue: [], 
      isOnline: true,
      clients: [{ id: 1, fullName: 'Original', version: 1 }]
    });
  });

  it('should enqueue actions when offline', () => {
    S.isOnline = false;
    enqueueSyncAction('UPDATE_CLIENT', { clientId: 1, data: {} });
    
    expect(S.syncQueue.length).toBe(1);
    expect(S.syncQueue[0].type).toBe('UPDATE_CLIENT');
  });

  it('should not send an operation when local queue persistence fails', async () => {
    S.isOnline = true;
    idbStorage.saveSyncQueue.mockRejectedValueOnce(new Error('IndexedDB unavailable'));

    await expect(enqueueSyncAction('ADD_CLIENT', {
      clientData: { id: 2 },
      stats: {}
    })).resolves.toBe(false);

    expect(firebaseService.addClientTransaction).not.toHaveBeenCalled();
    expect(S.syncQueue[0]).toMatchObject({
      type: 'ADD_CLIENT',
      state: 'failed',
      lastError: expect.stringContaining('Failed to persist locally')
    });
  });

  it('should not flush queue if offline', async () => {
    S.isOnline = false;
    S.syncQueue = [{ type: 'ADD_CLIENT', payload: {} }];
    
    await flushSyncQueue();
    
    expect(S.syncQueue.length).toBe(1);
  });

  it('should flush queue successfully when online', async () => {
    S.isOnline = true;
    S.syncQueue = [
      { id: '123', type: 'ADD_CLIENT', payload: { clientData: { id: 2 }, stats: {} } }
    ];
    
    firebaseService.addClientTransaction.mockResolvedValueOnce();

    await flushSyncQueue();
    
    expect(firebaseService.addClientTransaction).toHaveBeenCalled();
    expect(S.syncQueue.length).toBe(0);
  });

  it('should suspend queue and show conflict modal on VERSION_CONFLICT', async () => {
    S.isOnline = true;
    S.syncQueue = [
      { id: '123', type: 'UPDATE_CLIENT', payload: { clientId: 1, clientData: { fullName: 'Local Edit' }, oldStatus: 'نشط', stats: {} } }
    ];
    
    const conflictError = new Error('VERSION_CONFLICT');
    conflictError.code = 'VERSION_CONFLICT';
    conflictError.serverData = { fullName: 'Server Edit', version: 2 };
    
    firebaseService.updateClientTransaction.mockRejectedValueOnce(conflictError);

    await flushSyncQueue();
    
    expect(S.modal).toBe('conflict');
    expect(S.conflictItem).toBeDefined();
    expect(S.conflictServerData).toEqual({ fullName: 'Server Edit', version: 2 });
    expect(S.syncQueue.length).toBe(1); // item stays in queue
    expect(S.syncQueue[0].state).toBe('requires-attention');
  });

  it('should retain permanent failures for attention instead of dropping operations', async () => {
    S.isOnline = true;
    S.syncQueue = [
      { id: 'perm-1', type: 'UPDATE_CLIENT', payload: { clientId: 1, clientData: {}, oldStatus: 'نشط', stats: {} } }
    ];
    firebaseService.updateClientTransaction.mockRejectedValueOnce(
      Object.assign(new Error('permission denied'), { code: 'permission-denied' })
    );

    await flushSyncQueue();

    expect(S.syncQueue).toHaveLength(1);
    expect(S.syncQueue[0]).toMatchObject({
      id: 'perm-1',
      state: 'failed',
      attempts: 1,
      errorCode: 'permission-denied'
    });
  });

  it('should release the queue when persisting a permanent failure state fails', async () => {
    S.isOnline = true;
    S.syncQueue = [
      { id: 'perm-storage-fail', type: 'UPDATE_CLIENT', payload: { clientId: 1, clientData: {}, oldStatus: 'نشط', stats: {} } }
    ];
    firebaseService.updateClientTransaction.mockRejectedValueOnce(
      Object.assign(new Error('permission denied'), { code: 'permission-denied' })
    );
    idbStorage.saveSyncQueue
      .mockResolvedValueOnce(true)
      .mockRejectedValueOnce(new Error('IndexedDB unavailable'));

    await expect(flushSyncQueue()).resolves.toBeUndefined();

    expect(S.syncQueue[0]).toMatchObject({
      id: 'perm-storage-fail',
      state: 'failed',
      lastError: expect.stringContaining('failed to persist recovery state')
    });
  });

  it('should handle resolveConflict(server)', () => {
    S.conflictItem = { id: '123', payload: { clientId: 1, clientData: { fullName: 'Local Edit' } } };
    S.conflictServerData = { fullName: 'Server Edit', version: 2 };
    S.syncQueue = [S.conflictItem];
    
    resolveConflict('server');
    
    // the local client data should be updated with server data
    expect(S.clients.find(c => c.id == 1).fullName).toBe('Server Edit');
    // the queue should be empty
    expect(S.syncQueue.length).toBe(0);
    expect(S.modal).toBeNull();
  });

  it('should handle resolveConflict(local)', () => {
    S.conflictItem = { id: '123', payload: { clientId: 1, clientData: { fullName: 'Local Edit' } } };
    S.conflictServerData = { fullName: 'Server Edit', version: 2 };
    S.syncQueue = [S.conflictItem];
    
    resolveConflict('local');
    
    // The item should stay in queue but baseVersion updated
    expect(S.syncQueue.length).toBe(1);
    expect(S.syncQueue[0].payload.baseVersion).toBe(2);
    expect(S.modal).toBeNull();
  });
});
