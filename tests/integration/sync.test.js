import { describe, it, expect, beforeEach, vi } from 'vitest';
import { enqueueSyncAction, flushSyncQueue, resolveConflict } from '../../src/business/storage.js';
import { S, updateState, setClients, setCurrentUser } from '../../src/state/store.js';
import * as firebaseService from '../../src/firebase/service.js';

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
