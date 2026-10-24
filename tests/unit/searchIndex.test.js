import { afterEach, describe, expect, it } from 'vitest';
import { buildSearchIndex, performSearch } from '../../src/business/searchIndex.js';
import { searchMatch } from '../../src/utils/index.js';

const clients = [
  { id: 1, fullName: 'حمزة بلقايد', company: 'متجر النور' },
  { id: 2, fullName: 'حمزة دباجي', company: 'بلقايد للإعلام الآلي' },
  { id: 3, fullName: 'حمزة رحالي' }
];

describe('Client name search', () => {
  afterEach(() => buildSearchIndex([]));

  it('requires all words in a multi-word search and prioritizes a matching full name', () => {
    buildSearchIndex(clients);

    expect(performSearch('حمزة بلقايد').map(result => result.id)).toEqual([1]);
    expect(performSearch('بلقايد حمزة').map(result => result.id)).toContain(1);
    expect(performSearch('حمزة مجهول')).toEqual([]);
  });

  it('does not highlight a first-name-only match as a full-name match', () => {
    expect(searchMatch(clients[0], 'حمزة بلقايد')).toEqual({ match: true, fields: ['الاسم'] });
    expect(searchMatch(clients[1], 'حمزة بلقايد').match).toBe(false);
  });
});
