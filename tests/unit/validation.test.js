import { describe, it, expect, vi, beforeEach } from 'vitest';
import { saveClient } from '../../src/business/actions/clientActions.js';
import * as utilsIndex from '../../src/utils/index.js';
import * as utilsToast from '../../src/utils/toast.js';
import * as uiActions from '../../src/business/actions/uiActions.js';
import { S, updateState, setClients } from '../../src/state/store.js';

vi.mock('../../src/utils/index.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    gv: vi.fn(),
  };
});

vi.mock('../../src/utils/toast.js', () => ({
  showToast: vi.fn()
}));

vi.mock('../../src/business/actions/uiActions.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    closeModal: vi.fn()
  };
});

// Avoid executing Firebase transactions during unit test
vi.mock('../../src/business/storage.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    enqueueSyncAction: vi.fn()
  };
});

describe('Validation Logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateState({ clients: [], stats: {} });
  });

  it('saveClient should fail if fullName is empty', async () => {
    // Mock gv to return empty for 'f_fn'
    utilsIndex.gv.mockImplementation((id) => {
      if (id === 'f_fn') return '';
      return 'test';
    });

    await saveClient(null);

    expect(utilsToast.showToast).toHaveBeenCalledWith('الرجاء إدخال اسم العميل', 'error');
  });

  it('saveClient should proceed if fullName is provided', async () => {
    // Mock gv to return valid data
    utilsIndex.gv.mockImplementation((id) => {
      if (id === 'f_fn') return 'Test Client';
      if (id === 'f_st') return 'نشط';
      return 'test';
    });
    
    await saveClient(null);
    
    expect(utilsToast.showToast).toHaveBeenCalledWith('تم إضافة العميل بنجاح');
  });
});
