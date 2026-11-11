import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TrelloClient } from '../../src/server/trelloClient.js';
import { clearRecordedOutboundCalls, getRecordedOutboundCalls } from '../../src/server/sandboxGuard.js';

describe('TrelloClient — Server-Side Read-Only API Client (Addendum Section 2 & 3)', () => {
  const env = {
    NODE_ENV: 'test',
    SANDBOX_MODE: 'true',
    TRELLO_API_KEY: 'test_key_123',
    TRELLO_API_TOKEN: 'test_token_abc',
    TRELLO_BOARD_ID: 'board_progilic_123',
    TRELLO_LIST_ID: 'list_services_456'
  };

  beforeEach(() => {
    clearRecordedOutboundCalls();
    vi.restoreAllMocks();
  });

  it('fails closed when required credentials or board/list configuration are missing', () => {
    const client = new TrelloClient({});
    expect(() => client.assertConfig()).toThrow('Missing TRELLO_API_KEY');
  });

  it('builds read-only URLs containing API key and token', () => {
    const client = new TrelloClient(env);
    const url = client.buildUrl('/boards/board_progilic_123');
    expect(url).toContain('https://api.trello.com/1/boards/board_progilic_123');
    expect(url).toContain('key=test_key_123');
    expect(url).toContain('token=test_token_abc');
  });

  it('restricts board and list queries strictly to authorized scope', async () => {
    const client = new TrelloClient(env);
    await expect(client.verifyBoard('unauthorized_board_999')).rejects.toThrow('unauthorized Trello board');
    await expect(client.verifyList('unauthorized_list_999')).rejects.toThrow('unauthorized Trello list');
  });

  it('retrieves cards and checklists via GET requests only', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ id: 'card_1', name: 'Dimanche 01-11-2026', idList: 'list_services_456' }]
    });
    vi.stubGlobal('fetch', mockFetch);

    const client = new TrelloClient(env);
    const cards = await client.getListCards();

    expect(cards).toHaveLength(1);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const recorded = getRecordedOutboundCalls();
    expect(recorded).toHaveLength(1);
    expect(recorded[0].method).toBe('GET');
    expect(recorded[0].host).toBe('api.trello.com');
  });

  it('finds Sunday card by Dimanche pattern and handles ambiguity safely', async () => {
    const mockCards = [
      { id: 'c1', name: 'Dimanche 01-11-2026', idList: 'list_services_456' },
      { id: 'c2', name: 'Dimanche 08-11-2026', idList: 'list_services_456' }
    ];
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockCards
    }));

    const client = new TrelloClient(env);
    
    // Exact match test
    const resExact = await client.findSundayCard('Dimanche 01-11-2026');
    expect(resExact.found).toBe(true);
    expect(resExact.card.id).toBe('c1');

    // Ambiguous auto-detect test
    const resAmbiguous = await client.findSundayCard('');
    expect(resAmbiguous.found).toBe(false);
    expect(resAmbiguous.reason).toBe('MULTIPLE_SUNDAY_CANDIDATES_AMBIGUOUS');
    expect(resAmbiguous.candidates).toHaveLength(2);
  });
});
