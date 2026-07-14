import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderList, renderDetail } from '../../src/presentation/render-views.js';
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
});
