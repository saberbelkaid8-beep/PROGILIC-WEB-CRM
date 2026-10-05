import { describe, it, expect, beforeEach, vi } from 'vitest';
import { S, updateState, setClients, setCurrentUser, subscribe } from '../../src/state/store.js';

describe('State Management', () => {
  beforeEach(() => {
    // Reset state before each test if necessary or just test transitions
  });

  it('should initialize with default state', () => {
    expect(S.view).toBe('list');
    expect(S.clients).toEqual([]);
  });

  it('should update state correctly', () => {
    updateState({ view: 'detail', selId: 123 });
    expect(S.view).toBe('detail');
    expect(S.selId).toBe(123);
  });

  it('should notify subscribers on state change', async () => {
    const callback = vi.fn();
    subscribe(callback);
    
    updateState({ view: 'settings' });
    
    // Wait for the microtask (Promise.resolve().then)
    await new Promise(resolve => setTimeout(resolve, 0));
    
    expect(callback).toHaveBeenCalled();
  });

  it('should handle clients update', () => {
    const mockClients = [{ id: 1, fullName: 'Test' }];
    setClients(mockClients);
    expect(S.clients).toEqual(mockClients);
  });

  it('should handle user update', () => {
    const user = { uid: '123', email: 'test@example.com' };
    setCurrentUser(user);
    expect(S.currentUser).toEqual(user);
  });

  it('should batch multiple updates into a single subscriber notification', async () => {
    const { batch } = await import('../../src/state/store.js');
    const callback = vi.fn();
    const unsub = subscribe(callback);

    batch(() => {
      updateState({ view: 'dashboard' });
      setClients([{ id: 99, fullName: 'Batch User' }]);
      updateState({ nid: 150 });
    });

    await new Promise(resolve => setTimeout(resolve, 0));
    // The subscriber should have been called only once for the whole batch
    expect(callback).toHaveBeenCalledTimes(1);
    unsub();
  });
});
