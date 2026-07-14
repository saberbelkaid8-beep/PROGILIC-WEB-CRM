import { describe, it, expect, beforeEach, vi } from 'vitest';
import { enqueueSyncAction, flushSyncQueue } from '../../src/business/storage.js';
import { S } from '../../src/state/store.js';

describe('Offline Sync Logic', () => {
  beforeEach(() => {
    S.syncQueue = [];
    S.isOnline = true;
    localStorage.clear();
  });

  it('should enqueue actions when offline', () => {
    S.isOnline = false;
    enqueueSyncAction('UPDATE_CLIENT', { id: 1, data: {} });
    
    expect(S.syncQueue.length).toBe(1);
    expect(S.syncQueue[0].type).toBe('UPDATE_CLIENT');
  });

  it('should not flush queue if offline', async () => {
    S.isOnline = false;
    S.syncQueue = [{ type: 'TEST', payload: {} }];
    
    await flushSyncQueue();
    
    expect(S.syncQueue.length).toBe(1);
  });
});
