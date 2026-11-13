import { describe, it, expect, vi, beforeEach } from 'vitest';
import { saveClient, saveProgram } from '../../src/business/actions/clientActions.js';
import * as utilsIndex from '../../src/utils/index.js';
import * as utilsToast from '../../src/utils/toast.js';
import * as uiActions from '../../src/business/actions/uiActions.js';
import { S, clients, updateState, setClients, setCurrentUser } from '../../src/state/store.js';
import { validateClient, validateProgram } from '../../src/firebase/validation.js';
import * as firebaseService from '../../src/firebase/service.js';
import * as timelineService from '../../src/business/timelineService.js';

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

vi.mock('../../src/firebase/service.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    addClientTransaction: vi.fn(async () => {}),
    saveClientSubItemTransaction: vi.fn(async () => {})
  };
});

vi.mock('../../src/business/timelineService.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    logActivity: vi.fn(async () => 'activity')
  };
});

describe('Validation Logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setCurrentUser({ uid: 'test-admin', role: 'gerant', email: 'admin@progilic.dz' });
    updateState({ clients: [], stats: {} });
    document.body.innerHTML = '<input id="f_p_enabled" type="checkbox">';
  });

  it('saveClient should fail if fullName is empty', async () => {
    // Mock gv to return empty for 'f_fn'
    utilsIndex.gv.mockImplementation((id) => {
      if (id === 'f_fn') return '';
      return 'test';
    });

    await saveClient(null);

    expect(utilsToast.showToast).toHaveBeenCalledWith('الرجاء إدخال الاسم الكامل للعميل *', 'error');
  });

  it('saveClient should proceed if fullName is provided', async () => {
    // Mock gv to return valid data
    utilsIndex.gv.mockImplementation((id) => ({
      f_fn: 'Test Client',
      f_co: 'Test Enterprise',
      f_ph: '0550112233',
      f_wi: 'وهران',
      f_bt: 'تجارة تجزئة',
      f_bf: 'سوبرماركت',
      f_st: 'نشط',
      f_sd: '2026-11-01',
      f_lc: '2026-11-01'
    })[id] || '');
    
    await saveClient(null);
    
    expect(utilsToast.showToast).toHaveBeenCalledWith('تم إضافة العميل بنجاح');
  });

  it('saveClient should retain the Gmail account and initial program version', async () => {
    utilsIndex.gv.mockImplementation((id) => ({
      f_fn: 'Test Client',
      f_co: 'Test Enterprise',
      f_ph: '0550112233',
      f_wi: 'وهران',
      f_bt: 'تجارة تجزئة',
      f_bf: 'سوبرماركت',
      f_st: 'نشط',
      f_sd: '2026-11-01',
      f_lc: '2026-11-01',
      f_gmail: 'client@gmail.com',
      f_p_nm: 'PROGILIC POS',
      f_p_pl: 'Desktop',
      f_p_ty: 'تجاري',
      f_p_ver: 'V24',
      f_p_ic: '2'
    })[id] || '');
    document.getElementById('f_p_enabled').checked = true;

    await saveClient(null);

    expect(firebaseService.addClientTransaction).toHaveBeenCalledWith(
      'test-admin',
      expect.objectContaining({
        gmailAccount: 'client@gmail.com',
        programs: [expect.objectContaining({ version: 'V24' })]
      }),
      expect.any(Object)
    );
  });

  it('allows prospective customers to receive an explicitly selected initial program', async () => {
    utilsIndex.gv.mockImplementation((id) => ({
      f_fn: 'Prospective Customer',
      f_co: 'Prospective Enterprise',
      f_ph: '0550112233',
      f_wi: 'وهران',
      f_bt: 'تجارة تجزئة',
      f_bf: 'سوبرماركت',
      f_st: 'محتمل',
      f_sd: '2026-11-01',
      f_lc: '2026-11-01',
      f_p_pl: 'Web',
      f_p_ty: 'الويب',
      f_p_ver: 'V24',
      f_p_ic: '1'
    })[id] || '');
    document.getElementById('f_p_enabled').checked = true;

    await saveClient(null);

    expect(firebaseService.addClientTransaction).toHaveBeenCalledWith(
      'test-admin',
      expect.objectContaining({
        status: 'محتمل',
        programs: [expect.objectContaining({ platform: 'Web', version: 'V24' })]
      }),
      expect.any(Object)
    );
  });

  it('does not save a checked initial program without an explicit device count', async () => {
    utilsIndex.gv.mockImplementation((id) => ({
      f_fn: 'Incomplete Program Customer',
      f_co: 'Incomplete Program Enterprise',
      f_ph: '0550112233',
      f_wi: 'وهران',
      f_bt: 'تجارة تجزئة',
      f_bf: 'سوبرماركت',
      f_st: 'نشط',
      f_sd: '2026-11-01',
      f_lc: '2026-11-01',
      f_p_pl: 'Desktop',
      f_p_ty: 'تجاري',
      f_p_ver: 'V24',
      f_p_ic: ''
    })[id] || '');
    document.getElementById('f_p_enabled').checked = true;

    await saveClient(null);

    expect(firebaseService.addClientTransaction).not.toHaveBeenCalled();
    expect(utilsToast.showToast).toHaveBeenCalledWith(
      'يرجى استكمال بيانات الترخيص والتحقق من عدد الأجهزة قبل حفظ العميل.',
      'error'
    );
  });

  it('does not report or render a customer when its transaction fails', async () => {
    utilsIndex.gv.mockImplementation((id) => ({
      f_fn: 'Unpersisted Customer',
      f_co: 'Unpersisted Enterprise',
      f_ph: '0550112233',
      f_wi: 'وهران',
      f_bt: 'تجارة تجزئة',
      f_bf: 'سوبرماركت',
      f_st: 'نشط',
      f_sd: '2026-11-01',
      f_lc: '2026-11-01'
    })[id] || '');
    firebaseService.addClientTransaction.mockRejectedValueOnce(new Error('permission denied'));

    await saveClient(null);

    expect(clients).toHaveLength(0);
    expect(utilsToast.showToast).toHaveBeenCalledWith('تعذر حفظ العميل والترخيص. لم يتم تسجيل العملية.', 'error');
  });

  it('preserves missing program fields and existing expiry dates during an edit', async () => {
    const program = { id: 'legacy-program', programName: 'Recorded Program', endDate: '2030-01-01' };
    const client = {
      id: 44,
      fullName: 'Program Customer',
      programs: [program],
      programsCount: 1,
      programNames: ['Recorded Program'],
      endDate: '2030-01-01'
    };
    setClients([client]);
    updateState({ selId: 44, isOnline: true, stats: { totalPrograms: 1, totalLicensedDevices: 0 } });
    document.body.innerHTML = `
      <select id="fp_pl"><option value="" selected></option></select>
      <select id="fp_ty"><option value="" selected></option></select>
      <select id="fp_ver"><option value="" selected></option></select>
      <input id="fp_ic" value="">
      <input id="fp_sd" value="">
    `;
    utilsIndex.gv.mockImplementation((id) => document.getElementById(id)?.value || '');

    await saveProgram('legacy-program');

    const savedProgram = firebaseService.saveClientSubItemTransaction.mock.calls[0][4];
    expect(savedProgram).toEqual({
      id: 'legacy-program',
      programName: 'Recorded Program',
      endDate: '2030-01-01'
    });
    expect(client.programs[0]).toEqual(program);
    expect(timelineService.logActivity.mock.calls.at(-1)[5].program).toEqual(program);
    const firstEditEventId = timelineService.logActivity.mock.calls.at(-1)[5].idempotencyKey;

    await saveProgram('legacy-program');

    expect(timelineService.logActivity.mock.calls.at(-1)[5].idempotencyKey).toBe(firstEditEventId);
  });

  it('Firebase validation should retain Gmail and supported program versions', () => {
    expect(validateClient({
      id: 4, fullName: 'Test Client', status: 'نشط', gmailAccount: 'client@gmail.com'
    }).gmailAccount)
      .toBe('client@gmail.com');
    expect(validateProgram({
      id: 5, programName: 'PROGILIC POS', platform: 'Desktop', type: 'تجاري', version: 'V24'
    }).version).toBe('V24');
    expect(validateProgram({
      id: 6, programName: 'PROGILIC POS', platform: 'Desktop', type: 'تجاري', version: 'V25'
    }).version).toBe('V25');
  });

  it('does not synthesize missing migration fields or coerce historical counts', () => {
    expect(() => validateProgram({
      id: 7,
      programName: 'Recorded Program',
      platform: 'Desktop',
      type: 'تجاري',
      installationsCount: '1'
    })).toThrow('Program installation count is invalid');
    expect(() => validateProgram({
      programName: 'Recorded Program',
      platform: 'Desktop',
      type: 'تجاري'
    })).toThrow('Program ID is missing or invalid');
    expect(() => validateClient({ id: 8, fullName: 'Legacy Customer' }))
      .toThrow('Client status is missing or invalid');
  });
});
