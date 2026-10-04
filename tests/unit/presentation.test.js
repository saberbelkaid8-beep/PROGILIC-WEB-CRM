import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderList, renderDetail, renderDashboard } from '../../src/presentation/render-views.js';
import { S, setClients, updateState } from '../../src/state/store.js';

describe('Presentation Layer - Views', () => {
  beforeEach(() => {
    updateState({ isLoading: false, filter: 'الكل', q: '' });
  });

  it('should render loading skeleton when isLoading is true', () => {
    updateState({ isLoading: true });
    const html = renderList();
    expect(html).toContain('skeleton');
  });

  it('should render empty state when no clients', () => {
    setClients([]);
    const html = renderList();
    expect(html).toContain('empty-text');
  });

  it('should render client cards', () => {
    const clients = [{
      id: 1,
      fullName: 'Ahmed Test',
      company: 'Test Co',
      status: 'نشط',
      issues: [],
      requirements: [],
      programs: [],
      wilaya: 'الجزائر'
    }];
    setClients(clients);
    const html = renderList();
    expect(html).toContain('Ahmed Test');
    expect(html).toContain('Test Co');
  });

  it('should render client details', () => {
    const clients = [{
      id: 1,
      fullName: 'Ahmed Test',
      company: 'Test Co',
      status: 'نشط',
      issues: [],
      requirements: [],
      programs: [],
      wilaya: 'الجزائر'
    }];
    setClients(clients);
    updateState({ selId: 1 });
    const html = renderDetail();
    expect(html).toContain('Ahmed Test');
    expect(html).toContain('Test Co');
    expect(html).toContain('نظرة عامة');
  });

  it('should render dashboard without errors', () => {
    const clients = [{
      id: 1,
      fullName: 'Ahmed Test',
      company: 'Test Co',
      status: 'نشط',
      endDate: '2026-10-10',
      issues: [{ id: 101, title: 'Bug', priority: 'عاجل', status: 'مفتوح' }],
      requirements: [],
      programs: [{ id: 201, programName: 'ERP', installationsCount: 2 }],
      wilaya: 'وهران'
    }];
    setClients(clients);
    const html = renderDashboard();
    expect(html).toContain('AI Sentinel Advisor');
  });

  it('should render dashboard gracefully when clients contain malformed or null records', () => {
    setClients([null, undefined, {}, { id: 2, fullName: null, programs: null, issues: null, wilaya: null }]);
    expect(() => {
      const html = renderDashboard();
      expect(html).toBeDefined();
    }).not.toThrow();
  });

  it('should switch interface languages between ar, fr, and en', async () => {
    const { setLanguage, t } = await import('../../src/utils/i18n.js');
    setLanguage('ar');
    expect(S.lang).toBe('ar');
    expect(t('العملاء')).toBe('العملاء');

    setLanguage('fr');
    expect(S.lang).toBe('fr');
    expect(t('العملاء')).toBe('Clients');

    setLanguage('en');
    expect(S.lang).toBe('en');
    expect(t('العملاء')).toBe('Clients');

    // Reset back to Arabic
    setLanguage('ar');
  });
});
