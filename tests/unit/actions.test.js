import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setClients, S, updateState } from '../../src/state/store.js';
import { setAdvFil, clearAdvFil, setSortBy } from '../../src/business/actions.js';

describe('Business Actions', () => {
  beforeEach(() => {
    updateState({ fWilaya: '', sortBy: 'id', sortOrder: 'desc' });
    vi.clearAllMocks();
  });

  it('should update advanced filters', () => {
    setAdvFil('fWilaya', 'الجزائر');
    expect(S.fWilaya).toBe('الجزائر');
  });

  it('should clear advanced filters', () => {
    updateState({ fWilaya: 'الجزائر', fActivity: 'تجارة' });
    clearAdvFil();
    expect(S.fWilaya).toBe('');
    expect(S.fActivity).toBe('');
  });

  it('should update sort settings', () => {
    setSortBy('fullName');
    expect(S.sortBy).toBe('fullName');
  });
});
