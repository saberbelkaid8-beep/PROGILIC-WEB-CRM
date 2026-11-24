import { afterEach, describe, expect, it } from 'vitest';
import { renderDashboard } from '../../src/presentation/render-views.js';
import { setClients, setCurrentStaffUser, setCurrentUser, updateState } from '../../src/state/store.js';

const dashboardClients = [
  {
    id: 501, fullName: 'عميل ERP', company: 'شركة ألف', status: 'نشط', wilaya: 'وهران',
    programNames: ['PROGILIC ERP V24'], programsCount: 1, installationsCount: 3, score: 90,
    programs: [{ id: 1, programName: 'Desktop - تجاري', installationsCount: 3 }],
    issues: [],
    contactHistory: [{ id: 10, date: '2026-11-20', note: 'متابعة' }],
    _subcollectionsLoaded: true
  },
  {
    id: 502, fullName: 'عميل POS', company: 'شركة باء', status: 'متوقف', wilaya: 'الجزائر',
    programNames: ['PROGILIC POS V15'], programsCount: 1, installationsCount: 1, score: 20,
    programs: [{ id: 2, programName: 'Mobile - تطبيق', installationsCount: 1 }],
    issues: [{ id: 20, title: 'عطل شبكة', priority: 'عاجل', status: 'مفتوح' }],
    contactHistory: [],
    _subcollectionsLoaded: true
  }
];

describe('Executive Dashboard filters', () => {
  afterEach(() => {
    setClients([]);
    setCurrentStaffUser(null);
    setCurrentUser(null);
    updateState({
      dbWilaya: 'all', dbPeriod: 30, dbRadarTab: 'all'
    });
  });

  it('applies wilaya scope, radar tab, and period filters cleanly on the executive dashboard', () => {
    setCurrentUser({ uid: 'dashboard-filter-admin', role: 'gerant' });
    setClients(dashboardClients);

    // 1. Default all wilayas -> shows both clients in totals (4 devices) and radar entry 502
    updateState({ dbWilaya: 'all', dbPeriod: 30, dbRadarTab: 'all' });
    const allHtml = renderDashboard();
    expect(allHtml).toContain('المركز التنفيذي للقيادة');
    expect(allHtml).toContain('كافة الولايات');
    expect(allHtml).toContain('selClient(502)');

    // 2. Wilaya filter = 'وهران' -> only client 501 (3 devices, 0 at-risk)
    updateState({ dbWilaya: 'وهران', dbPeriod: 7, dbRadarTab: 'risk' });
    const oranHtml = renderDashboard();
    expect(oranHtml).toContain('وهران');
    expect(oranHtml).toContain('آخر 7 أيام');
    expect(oranHtml).not.toContain('selClient(502)');
    expect(oranHtml).toContain('لا توجد تنبيهات عاجلة حالياً');

    // 3. Wilaya filter = 'الجزائر' -> client 502 urgent alert & risk radar visible
    updateState({ dbWilaya: 'الجزائر', dbPeriod: 1, dbRadarTab: 'alerts' });
    const algiersHtml = renderDashboard();
    expect(algiersHtml).toContain('اليوم لحظياً');
    expect(algiersHtml).toContain('selClient(502)');
  });
});
