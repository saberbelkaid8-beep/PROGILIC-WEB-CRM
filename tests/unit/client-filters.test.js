import { afterEach, describe, expect, it, vi } from 'vitest';
import { applyFilters } from '../../src/utils/index.js';
import { setCurrentStaffUser, setCurrentUser, setClients, S, updateState } from '../../src/state/store.js';

const clients = [
  {
    id: 1, fullName: 'عميل أول', status: 'نشط', wilaya: 'وهران', commune: 'وهران',
    businessType: 'تجارة تجزئة', businessField: 'سوبرماركت', programNames: [], programs: [{ programName: 'POS' }],
    score: 80, lastContact: '2026-03-01', endDate: '2026-03-01'
  },
  {
    id: 2, fullName: 'عميل ثان', status: 'متوقف', wilaya: 'الجزائر', commune: 'الجزائر',
    businessType: 'تجارة جملة', businessField: 'مواد غذائية بالجملة', programNames: ['ERP'], programs: [],
    score: 10, lastContact: '2026-01-01', endDate: '2026-01-01'
  },
  {
    id: 3, fullName: 'عميل ثالث', status: 'نشط', wilaya: 'وهران', commune: 'السانية',
    businessType: 'تجارة تجزئة', businessField: 'سوبرماركت', programNames: ['ERP'], programs: [],
    score: 50, lastContact: '2026-02-01', endDate: '2026-02-01'
  }
];

describe('Client filters', () => {
  afterEach(() => {
    setClients([]);
    setCurrentStaffUser(null);
    setCurrentUser(null);
    updateState({
      q: '', filter: 'الكل', fWilaya: '', fCommune: '', fActivity: '', fActType: '', fProgram: '',
      sortBy: 'id', sortOrder: 'asc', showAdvFil: false
    });
  });

  it('applies status, search, and every advanced filter cumulatively', () => {
    setCurrentUser({ uid: 'filter-admin', role: 'gerant' });
    setClients(clients);
    updateState({ sortBy: 'id', sortOrder: 'asc' });

    for (const filter of [
      ['filter', 'نشط'],
      ['q', 'عميل ثالث'],
      ['fWilaya', 'وهران'],
      ['fCommune', 'السانية'],
      ['fActivity', 'تجارة تجزئة'],
      ['fActType', 'سوبرماركت'],
      ['fProgram', 'ERP']
    ]) {
      updateState({ [filter[0]]: filter[1] });
    }

    expect(applyFilters(clients).map(client => client.id)).toEqual([3]);
  });

  it('matches program filters against subcollections and legacy programNames', () => {
    setClients(clients);
    updateState({ filter: 'الكل', fProgram: 'POS', sortBy: 'id', sortOrder: 'asc' });
    expect(applyFilters(clients).map(client => client.id)).toEqual([1]);

    updateState({ fProgram: 'ERP' });
    expect(applyFilters(clients).map(client => client.id)).toEqual([2, 3]);
  });

  it('applies each visible client filter independently and sorts score/date columns', () => {
    setCurrentUser({ uid: 'filter-admin', role: 'gerant' });
    setClients(clients);

    const cases = [
      [{ filter: 'نشط' }, [1, 3]],
      [{ q: 'عميل ثالث' }, [3]],
      [{ fWilaya: 'الجزائر' }, [2]],
      [{ fCommune: 'السانية' }, [3]],
      [{ fActivity: 'تجارة جملة' }, [2]],
      [{ fActType: 'سوبرماركت' }, [1, 3]],
      [{ fProgram: 'POS' }, [1]]
    ];
    for (const [filters, expected] of cases) {
      updateState({
        filter: 'الكل', q: '', fWilaya: '', fCommune: '', fActivity: '', fActType: '', fProgram: '',
        sortBy: 'id', sortOrder: 'asc', ...filters
      });
      expect(applyFilters(clients).map(client => client.id)).toEqual(expected);
    }

    for (const sortBy of ['score', 'lastContact', 'endDate']) {
      updateState({ filter: 'الكل', q: '', fWilaya: '', fCommune: '', fActivity: '', fActType: '', fProgram: '', sortBy, sortOrder: 'asc' });
      expect(applyFilters(clients).map(client => client.id)).toEqual([2, 3, 1]);
    }

    const sortingClients = [
      { id: 3, fullName: 'Charlie', status: 'نشط' },
      { id: 1, fullName: 'Alpha', status: 'نشط' },
      { id: 2, fullName: 'Beta', status: 'نشط' }
    ];
    setClients(sortingClients);
    updateState({ filter: 'الكل', q: '', fWilaya: '', fCommune: '', fActivity: '', fActType: '', fProgram: '', sortBy: 'id', sortOrder: 'desc' });
    expect(applyFilters(sortingClients).map(client => client.id)).toEqual([3, 2, 1]);
    updateState({ sortBy: 'fullName', sortOrder: 'asc' });
    expect(applyFilters(sortingClients).map(client => client.id)).toEqual([1, 2, 3]);
  });

  it('resets dependent commune and business-field filters when their parent changes', async () => {
    const { setAdvFil } = await import('../../src/business/actions/uiActions.js');
    setCurrentUser({ uid: 'filter-admin', role: 'gerant' });
    updateState({ fCommune: 'السانية', fActType: 'سوبرماركت' });

    setAdvFil('fWilaya', 'الجزائر');
    expect(S.fCommune).toBe('');

    setAdvFil('fActivity', 'تجارة جملة');
    expect(S.fActType).toBe('');
  });
});
