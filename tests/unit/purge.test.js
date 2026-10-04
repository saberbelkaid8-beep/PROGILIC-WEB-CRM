import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setClients, S, updateState } from '../../src/state/store.js';
import { simulatePurge, getPurgeAuditLogs } from '../../src/business/purgeService.js';
import { openDbPurgeModal, setPurgeTab, setPurgeFilterType, setPurgeOlderThanDays, togglePurgeSelectiveCollection } from '../../src/business/actions/purgeActions.js';

describe('Database Purge & Maintenance Service', () => {
  beforeEach(() => {
    setClients([
      {
        id: 'c1',
        fullName: 'عميل 1',
        company: 'شركة أ',
        status: 'متوقف',
        lastContact: '2020-01-01',
        programs: [{ id: 'p1', endDate: '2020-01-01' }],
        issues: [{ id: 'i1', status: 'محلول' }],
        requirements: [{ id: 'r1', status: 'منجز' }],
        contactHistory: [{ date: '2020-01-01' }]
      },
      {
        id: 'c2',
        fullName: 'عميل 2',
        company: 'شركة ب',
        status: 'نشط',
        lastContact: '2026-07-01',
        programs: [{ id: 'p2', endDate: '2028-01-01' }],
        issues: [{ id: 'i2', status: 'مفتوح' }],
        requirements: [],
        contactHistory: [{ date: '2026-07-01' }]
      }
    ]);
  });

  it('should simulate purge correctly for stopped clients filter', () => {
    const sim = simulatePurge({
      targetScope: 'filtered',
      filterType: 'stopped_clients',
      olderThanDays: 30
    });

    expect(sim.totalClientsAffected).toBe(1);
    expect(sim.sampleClients[0].id).toBe('c1');
    expect(sim.programsCount).toBe(1);
    expect(sim.issuesCount).toBe(1);
  });

  it('should simulate purge for solved issues filter', () => {
    const sim = simulatePurge({
      targetScope: 'filtered',
      filterType: 'solved_issues'
    });

    expect(sim.issuesCount).toBe(1);
    expect(sim.sampleClients.length).toBe(1);
  });

  it('should simulate purge for full zero wipe scope', () => {
    const sim = simulatePurge({
      targetScope: 'all'
    });

    expect(sim.totalClientsAffected).toBe(2);
    expect(sim.programsCount).toBe(2);
    expect(sim.issuesCount).toBe(2);
  });

  it('should update state via purge actions', () => {
    openDbPurgeModal();
    expect(S.modal).toBe('dbPurge');
    expect(S.purgeTab).toBe('filtered');

    setPurgeTab('selective');
    expect(S.purgeTab).toBe('selective');

    setPurgeFilterType('solved_issues');
    expect(S.purgeFilterType).toBe('solved_issues');

    setPurgeOlderThanDays(60);
    expect(S.purgeOlderThanDays).toBe(60);

    togglePurgeSelectiveCollection('programs');
    expect(S.purgeSelectiveCollections.programs).toBe(false);
  });

  it('should retrieve audit logs array without crashing', () => {
    const logs = getPurgeAuditLogs();
    expect(Array.isArray(logs)).toBe(true);
  });
});
