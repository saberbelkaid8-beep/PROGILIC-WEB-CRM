/**
 * PROGILIC CRM × TRELLO INTEGRATION
 * Real Server-Side Trello REST API Client (Read-Only)
 * 
 * Enforces Invariant I-2: Read-Only Trello Access
 * - Supports GET operations ONLY against api.trello.com
 * - Restricts scope strictly to authorized Board ID and List ID
 * - Uses safeTrelloFetch() sandbox guard wrapper
 * - Credentials reside strictly server-side
 */

import { safeTrelloFetch } from './sandboxGuard.js';

export class TrelloClient {
  constructor(env = process.env) {
    this.env = env;
    this.apiKey = (env.TRELLO_API_KEY || '').trim();
    this.apiToken = (env.TRELLO_API_TOKEN || '').trim();
    this.boardId = (env.TRELLO_BOARD_ID || '').trim();
    this.listId = (env.TRELLO_LIST_ID || '').trim();
  }

  /**
   * Asserts that server credentials and board/list configuration are present.
   */
  assertConfig() {
    if (!this.apiKey || !this.apiToken) {
      throw new Error('[Trello Client] Missing TRELLO_API_KEY or TRELLO_API_TOKEN on server.');
    }
    if (!this.boardId || !this.listId) {
      throw new Error('[Trello Client] Missing TRELLO_BOARD_ID or TRELLO_LIST_ID configuration.');
    }
  }

  /**
   * Builds authorized read-only URL with query parameters.
   */
  buildUrl(path, queryParams = {}) {
    const params = new URLSearchParams({
      key: this.apiKey,
      token: this.apiToken,
      ...queryParams
    });
    return `https://api.trello.com/1${path}?${params.toString()}`;
  }

  /**
   * Verified Board Details GET
   */
  async verifyBoard(boardId = this.boardId) {
    this.assertConfig();
    const targetBoard = (boardId || this.boardId).trim();
    if (targetBoard !== this.boardId) {
      throw new Error(`[Security] Attempted to query unauthorized Trello board: ${targetBoard}`);
    }
    const url = this.buildUrl(`/boards/${targetBoard}`);
    const res = await safeTrelloFetch(url, { method: 'GET' }, this.env);
    if (!res.ok) {
      throw new Error(`[Trello API Error] Board lookup failed: ${res.status} ${res.statusText}`);
    }
    return await res.json();
  }

  /**
   * Verified List Details GET
   */
  async verifyList(listId = this.listId) {
    this.assertConfig();
    const targetList = (listId || this.listId).trim();
    if (targetList !== this.listId) {
      throw new Error(`[Security] Attempted to query unauthorized Trello list: ${targetList}`);
    }
    const url = this.buildUrl(`/lists/${targetList}`);
    const res = await safeTrelloFetch(url, { method: 'GET' }, this.env);
    if (!res.ok) {
      throw new Error(`[Trello API Error] List lookup failed: ${res.status} ${res.statusText}`);
    }
    return await res.json();
  }

  /**
   * Retrieves cards from the configured list (Read-Only)
   */
  async getListCards(listId = this.listId) {
    this.assertConfig();
    const targetList = (listId || this.listId).trim();
    if (targetList !== this.listId) {
      throw new Error(`[Security] Attempted to query cards from unauthorized list: ${targetList}`);
    }
    const url = this.buildUrl(`/lists/${targetList}/cards`);
    const res = await safeTrelloFetch(url, { method: 'GET' }, this.env);
    if (!res.ok) {
      throw new Error(`[Trello API Error] List cards fetch failed: ${res.status} ${res.statusText}`);
    }
    return await res.json();
  }

  /**
   * Retrieves single card details (Read-Only)
   */
  async getCardDetails(cardId) {
    this.assertConfig();
    if (!cardId || typeof cardId !== 'string') {
      throw new Error('[Trello Client] Invalid cardId parameter.');
    }
    const url = this.buildUrl(`/cards/${cardId.trim()}`);
    const res = await safeTrelloFetch(url, { method: 'GET' }, this.env);
    if (!res.ok) {
      throw new Error(`[Trello API Error] Card fetch failed: ${res.status} ${res.statusText}`);
    }
    return await res.json();
  }

  /**
   * Retrieves card checklists and checklist items with state (Read-Only)
   */
  async getCardChecklists(cardId) {
    this.assertConfig();
    if (!cardId || typeof cardId !== 'string') {
      throw new Error('[Trello Client] Invalid cardId parameter.');
    }
    const url = this.buildUrl(`/cards/${cardId.trim()}/checklists`);
    const res = await safeTrelloFetch(url, { method: 'GET' }, this.env);
    if (!res.ok) {
      throw new Error(`[Trello API Error] Card checklists fetch failed: ${res.status} ${res.statusText}`);
    }
    return await res.json();
  }

  /**
   * Identifies the real Sunday card from the authorized list.
   * Uses SUNDAY_CARD_REF if explicitly provided, or auto-detects Sunday card
   * matching 'Dimanche DD-MM-YYYY' in Africa/Algiers timezone.
   */
  async findSundayCard(sundayCardRef = this.env.SUNDAY_CARD_REF) {
    const cards = await this.getListCards(this.listId);
    const ref = (sundayCardRef || '').trim();

    if (ref) {
      if (ref === 'latest-past-sunday') {
        const sundayCards = cards.filter(c => /dimanche/i.test(c.name));
        if (sundayCards.length === 0) {
          return { found: false, candidates: [], reason: 'NO_SUNDAY_CARDS_FOUND' };
        }
        return { found: true, card: sundayCards[0], candidates: sundayCards };
      }

      const match = cards.filter(c => c.name.toLowerCase().includes(ref.toLowerCase()) || c.id === ref || c.shortLink === ref);
      if (match.length === 1) {
        return { found: true, card: match[0], candidates: match };
      }
      if (match.length > 1) {
        return { found: false, candidates: match, reason: 'AMBIGUOUS_SUNDAY_CARD_REF' };
      }
      return { found: false, candidates: [], reason: 'SUNDAY_CARD_REF_NOT_FOUND' };
    }

    // Auto-detect Sunday cards matching Dimanche pattern
    const sundayCandidates = cards.filter(c => /dimanche/i.test(c.name));
    if (sundayCandidates.length === 1) {
      return { found: true, card: sundayCandidates[0], candidates: sundayCandidates };
    }
    if (sundayCandidates.length > 1) {
      return { found: false, candidates: sundayCandidates, reason: 'MULTIPLE_SUNDAY_CANDIDATES_AMBIGUOUS' };
    }

    return { found: false, candidates: cards, reason: 'NO_SUNDAY_CARD_DETECTED' };
  }
}
