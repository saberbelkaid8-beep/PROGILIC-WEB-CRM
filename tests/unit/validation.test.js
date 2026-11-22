import { describe, it, expect, vi, beforeEach } from 'vitest';
import { saveClient } from '../../src/business/actions/clientActions.js';
import * as utilsIndex from '../../src/utils/index.js';
import * as utilsToast from '../../src/utils/toast.js';
import { S, updateState, setCurrentUser } from '../../src/state/store.js';
import { validateClient, validateProgram } from '../../src/firebase/validation.js';
import * as storage from '../../src/business/storage.js';

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

vi.mock('../../src/business/storage.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    commitOnlineMutation: vi.fn().mockResolvedValue({ version: 1, updatedAt: '2026-11-20T00:00:00Z' }),
    startClientDetailSync: vi.fn(),
    enqueueSyncAction: vi.fn()
  };
});

describe('Validation Logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setCurrentUser({ uid: 'test-admin', role: 'gerant', email: 'admin@progilic.dz' });
    updateState({ clients: [], stats: {}, isOnline: true, quotaExceeded: false });
  });

  it('saveClient should fail if fullName is empty', async () => {
    utilsIndex.gv.mockImplementation((id) => {
      if (id === 'f_fn') return '';
      return 'test';
    });

    await saveClient(null);

    expect(utilsToast.showToast).toHaveBeenCalledWith('الرجاء إدخال الاسم الكامل للعميل *', 'error');
  });

  it('saveClient should proceed if all mandatory fields are provided', async () => {
    utilsIndex.gv.mockImplementation((id) => ({
      f_fn: 'Test Client',
      f_co: 'Test Company',
      f_ph: '0550123456',
      f_wi: 'الجزائر',
      f_bt: 'تجارة تجزئة',
      f_bf: 'سوبرماركت / بقالة',
      f_st: 'نشط',
      f_lc: '2026-11-20',
      f_sd: '2026-11-20'
    })[id] || '');

    await saveClient(null);

    expect(storage.commitOnlineMutation).toHaveBeenCalledWith('ADD_CLIENT', expect.any(Object));
    expect(utilsToast.showToast).toHaveBeenCalledWith('تم إضافة العميل بنجاح');
  });

  it('saveClient should retain the Gmail account and initial program version', async () => {
    utilsIndex.gv.mockImplementation((id) => ({
      f_fn: 'Test Client',
      f_co: 'Test Company',
      f_ph: '0550123456',
      f_wi: 'الجزائر',
      f_bt: 'تجارة تجزئة',
      f_bf: 'سوبرماركت / بقالة',
      f_gmail: 'client@gmail.com',
      f_st: 'نشط',
      f_lc: '2026-11-20',
      f_sd: '2026-11-20',
      f_p_pl: 'Desktop',
      f_p_ty: 'تجاري',
      f_p_ver: 'V24'
    })[id] || '');

    await saveClient(null);

    expect(storage.commitOnlineMutation).toHaveBeenCalledWith('ADD_CLIENT', expect.objectContaining({
      clientData: expect.objectContaining({
        gmailAccount: 'client@gmail.com',
        programs: [expect.objectContaining({ version: 'V24' })]
      })
    }));
  });

  it('Firebase validation should retain Gmail and program versions properly', () => {
    expect(validateClient({ fullName: 'Test Client', gmailAccount: 'client@gmail.com' }).gmailAccount)
      .toBe('client@gmail.com');
    expect(validateProgram({ programName: 'PROGILIC POS', version: 'V24' }).version).toBe('V24');
    expect(validateProgram({ programName: 'PROGILIC Mobile', platform: 'Mobile', version: 'V25' }).version).toBe('');
  });
});
