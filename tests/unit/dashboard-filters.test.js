import { afterEach, describe, expect, it } from 'vitest';
import { renderDashboard } from '../../src/presentation/render-views.js';
import { setClients, setCurrentStaffUser, setCurrentUser, S, updateState } from '../../src/state/store.js';

const dashboardClients = [
  {
    id: 501, fullName: 'عميل ERP', company: 'شركة ألف', status: 'نشط', wilaya: 'وهران',
    programNames: ['PROGILIC ERP V24'], programsCount: 1, installationsCount: 3, score: 90,
    programs: [], issues: [], _subcollectionsLoaded: false
  },
  {
    id: 502, fullName: 'عميل POS', company: 'شركة باء', status: 'متوقف', wilaya: 'الجزائر',
    programNames: ['PROGILIC POS V15'], programsCount: 1, installationsCount: 1, score: 20,
    programs: [], issues: [], _subcollectionsLoaded: false
  }
];

describe('Dashboard filters', () => {
  afterEach(() => {
    setClients([]);
    setCurrentStaffUser(null);
    setCurrentUser(null);
    updateState({
      dbFilterWilaya: 'all', dbFilterProg: 'all', dbFilterTier: 'all',
      dbSearchQuery: '', dbSortKey: 'score', dbSortDir: 'desc',
      dbPage: 1, dbPageSize: 25, dbActiveTab: 'directory'
    });
  });

  it('applies dashboard search, wilaya, tier, program and multi-device filters', () => {
    setCurrentUser({ uid: 'dashboard-filter-admin', role: 'gerant' });
    setClients(dashboardClients);
    updateState({ dbActiveTab: 'directory', dbFilterWilaya: 'all', dbFilterProg: 'all', dbFilterTier: 'all', dbSearchQuery: '' });

    const cases = [
      [{ dbSearchQuery: 'عميل ERP' }, [501]],
      [{ dbFilterWilaya: 'الجزائر' }, [502]],
      [{ dbFilterTier: 'excellent' }, [501]],
      [{ dbFilterTier: 'critical' }, [502]],
      [{ dbFilterProg: 'PROGILIC ERP V24' }, [501]],
      [{ dbFilterProg: 'v15_v16' }, [502]],
      [{ dbFilterProg: 'multi_device' }, [501]]
    ];
    for (const [filters, expected] of cases) {
      updateState({
        dbFilterWilaya: 'all', dbFilterProg: 'all', dbFilterTier: 'all', dbSearchQuery: '',
        ...filters
      });
      const markup = renderDashboard();
      for (const id of expected) expect(markup).toContain(`selClient(${id})`);
      for (const client of dashboardClients.filter(client => !expected.includes(client.id))) {
        expect(markup).not.toContain(`selClient(${client.id})`);
      }
    }
  });
});
