import { afterEach, describe, expect, it } from 'vitest';
import {
  normalizeClientStatus,
  isConfirmedClientStatus,
  isUnconfirmedClientStatus,
  inspectClientSignals,
  classifyClientConfirmation,
  buildClientClassificationPlan
} from '../../src/business/clientStatus.js';
import { applyFilters } from '../../src/utils/index.js';
import { computeStats } from '../../src/business/mergeDatabase.js';
import { migrateSchema } from '../../src/business/storage.js';
import { updateState, setClients } from '../../src/state/store.js';

describe('Client Confirmation Status ("مؤكد" / "غير مؤكد")', () => {
  afterEach(() => {
    setClients([]);
    updateState({
      q: '',
      filter: 'الكل',
      fWilaya: '',
      fCommune: '',
      fActivity: '',
      fActType: '',
      fProgram: '',
      sortBy: 'id',
      sortOrder: 'asc'
    });
  });

  it('normalizes canonical, legacy Arabic, and French/English aliases accurately', () => {
    expect(normalizeClientStatus('مؤكد')).toBe('مؤكد');
    expect(normalizeClientStatus('نشط')).toBe('مؤكد');
    expect(normalizeClientStatus('Confirmé')).toBe('مؤكد');
    expect(normalizeClientStatus('confirmed')).toBe('مؤكد');

    expect(normalizeClientStatus('غير مؤكد')).toBe('غير مؤكد');
    expect(normalizeClientStatus('محتمل')).toBe('غير مؤكد');
    expect(normalizeClientStatus('متوقف')).toBe('غير مؤكد');
    expect(normalizeClientStatus('non confirme')).toBe('غير مؤكد');
    expect(normalizeClientStatus('non-confirmé')).toBe('غير مؤكد');
    expect(normalizeClientStatus('no-active')).toBe('غير مؤكد');
    expect(normalizeClientStatus('')).toBe('غير مؤكد');

    expect(isConfirmedClientStatus('نشط')).toBe(true);
    expect(isConfirmedClientStatus('غير مؤكد')).toBe(false);
    expect(isUnconfirmedClientStatus('محتمل')).toBe(true);
    expect(isUnconfirmedClientStatus('مؤكد')).toBe(false);
  });

  it('inspects client signals across subcollections, summary counters, contacts, and notes', () => {
    const emptyLead = { id: 1, fullName: 'Lead Vide', status: 'نشط' };
    expect(inspectClientSignals(emptyLead)).toEqual({
      hasPrograms: false,
      hasContacts: false,
      hasNotesOrRecords: false,
      programsCount: 0,
      contactsCount: 0,
      issuesCount: 0,
      requirementsCount: 0
    });

    const richClient = {
      id: 2,
      fullName: 'Client Actif',
      programs: [{ id: 'p1', programName: 'Commercial V27' }],
      contactHistory: [{ id: 'c1', date: '2026-04-01', note: 'Appel' }],
      issuesCount: 0,
      openIssuesCount: 1,
      requirements: [{ id: 'r1', title: 'Export PDF' }],
      notes: 'Client VIP'
    };
    const sig = inspectClientSignals(richClient);
    expect(sig.hasPrograms).toBe(true);
    expect(sig.hasContacts).toBe(true);
    expect(sig.hasNotesOrRecords).toBe(true);
    expect(sig.programsCount).toBe(1);
    expect(sig.contactsCount).toBe(1);
    expect(sig.issuesCount).toBe(1);
    expect(sig.requirementsCount).toBe(1);
  });

  it('classifies clients accurately under balanced vs strict modes', () => {
    const emptyLead = { id: 1, fullName: 'Aucun programme', status: 'نشط' };
    const contactedOnly = { id: 2, fullName: 'Contacté sans logiciel', contactHistory: [{ date: '2026-03-10', note: 'Appel' }] };
    const softwareOnly = { id: 3, fullName: 'Logiciel sans contact', programs: [{ programName: 'POS' }] };
    const completeClient = {
      id: 4,
      fullName: 'Client Complet',
      programs: [{ programName: 'Commercial V27' }],
      lastContact: '2026-04-10'
    };

    // Balanced mode: any program OR contact OR note/record -> مؤكد; completely empty -> غير مؤكد
    expect(classifyClientConfirmation(emptyLead, 'balanced')).toBe('غير مؤكد');
    expect(classifyClientConfirmation(contactedOnly, 'balanced')).toBe('مؤكد');
    expect(classifyClientConfirmation(softwareOnly, 'balanced')).toBe('مؤكد');
    expect(classifyClientConfirmation(completeClient, 'balanced')).toBe('مؤكد');

    // Strict mode: MUST have BOTH programs AND (contacts OR notes/records) -> مؤكد
    expect(classifyClientConfirmation(emptyLead, 'strict')).toBe('غير مؤكد');
    expect(classifyClientConfirmation(contactedOnly, 'strict')).toBe('غير مؤكد');
    expect(classifyClientConfirmation(softwareOnly, 'strict')).toBe('غير مؤكد');
    expect(classifyClientConfirmation(completeClient, 'strict')).toBe('مؤكد');
  });

  it('builds a classification plan with accurate diffs and totals', () => {
    const list = [
      { id: 1, fullName: 'A', status: 'نشط' }, // no programs/contacts -> unconfirmed
      { id: 2, fullName: 'B', status: 'محتمل', programs: [{ programName: 'ERP' }] }, // has program -> confirmed (balanced)
      { id: 3, fullName: 'C', status: 'مؤكد', programs: [{ programName: 'POS' }], lastContact: '2026-04-01' }, // unchanged
      { id: 4, fullName: 'D', status: 'غير مؤكد' } // unchanged
    ];

    const balancedPlan = buildClientClassificationPlan(list, 'balanced');
    expect(balancedPlan.total).toBe(4);
    expect(balancedPlan.confirmedCount).toBe(2);
    expect(balancedPlan.unconfirmedCount).toBe(2);
    expect(balancedPlan.changesCount).toBe(2);
    expect(balancedPlan.changes.map(c => [c.client.id, c.prevStatus, c.nextStatus])).toEqual([
      [1, 'نشط', 'غير مؤكد'],
      [2, 'محتمل', 'مؤكد']
    ]);

    const strictPlan = buildClientClassificationPlan(list, 'strict');
    expect(strictPlan.confirmedCount).toBe(1);
    expect(strictPlan.unconfirmedCount).toBe(3);
  });

  it('filters clients by مؤكد, غير مؤكد, بدون برامج, and preserves legacy filter exact match', () => {
    const sample = [
      { id: 1, fullName: 'Confirmed Soft', status: 'نشط', programs: [{ programName: 'POS' }] },
      { id: 2, fullName: 'New Confirmed', status: 'مؤكد', programs: [] },
      { id: 3, fullName: 'Unconfirmed Lead', status: 'غير مؤكد', programs: [] },
      { id: 4, fullName: 'Legacy Prospect', status: 'محتمل', programs: [] }
    ];
    setClients(sample);

    updateState({ filter: 'مؤكد' });
    expect(applyFilters(sample).map(c => c.id)).toEqual([1, 2]);

    updateState({ filter: 'غير مؤكد' });
    expect(applyFilters(sample).map(c => c.id)).toEqual([3, 4]);

    updateState({ filter: 'بدون برامج' });
    expect(applyFilters(sample).map(c => c.id)).toEqual([2, 3, 4]);

    // Legacy exact filter compatibility
    updateState({ filter: 'نشط' });
    expect(applyFilters(sample).map(c => c.id)).toEqual([1]);
  });

  it('computes confirmedClients and unconfirmedClients in computeStats and auto-classifies statusless clients in migrateSchema', () => {
    const sample = [
      { id: 1, fullName: 'C1', status: 'مؤكد', programsCount: 1, installationsCount: 2 },
      { id: 2, fullName: 'C2', status: 'نشط', programs: [{ programName: 'POS', installationsCount: 3 }] },
      { id: 3, fullName: 'C3', status: 'غير مؤكد' },
      { id: 4, fullName: 'C4', status: 'متوقف' }
    ];
    const { stats } = computeStats(sample);
    expect(stats.totalClients).toBe(4);
    expect(stats.confirmedClients).toBe(2);
    expect(stats.unconfirmedClients).toBe(2);
    expect(stats.totalPrograms).toBe(2);

    const migrated = migrateSchema({
      clients: [
        { id: 10, fullName: 'Empty Lead' },
        { id: 11, fullName: 'Program Owner', programs: [{ programName: 'Commercial' }] },
        { id: 12, fullName: 'Explicit Legacy Trial', status: 'تجريبي' }
      ]
    });
    expect(migrated.clients[0].status).toBe('غير مؤكد');
    expect(migrated.clients[1].status).toBe('مؤكد');
    expect(migrated.clients[2].status).toBe('محتمل');
  });
});
