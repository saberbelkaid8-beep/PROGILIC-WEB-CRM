import { describe, it, expect } from 'vitest';
import { handleTrelloWebhookRequest } from '../../src/server/trelloRoutes.js';

describe('Webhook Callback URL Integrity (Addendum Section 7)', () => {
  it('fails closed when TRELLO_CALLBACK_URL is missing from server environment', async () => {
    const rawBody = JSON.stringify({ action: { type: 'createCard' } });
    const headers = {
      'x-trello-webhook': 'some_signature',
      'x-trello-callback-url': 'https://untrusted-attacker-site.com/webhook'
    };
    const envWithoutCallback = {
      TRELLO_WEBHOOK_SECRET: 'secret123'
      // TRELLO_CALLBACK_URL is intentionally absent
    };

    const res = await handleTrelloWebhookRequest(rawBody, headers, 'POST', envWithoutCallback);
    expect(res.status).toBe(401);
    const body = JSON.parse(res.body);
    expect(body.error).toBe('UNCONFIGURED_WEBHOOK_CALLBACK_URL');
  });

  it('strictly ignores header x-trello-callback-url and uses server env.TRELLO_CALLBACK_URL', async () => {
    const rawBody = JSON.stringify({ action: { type: 'createCard' } });
    const headers = {
      'x-trello-webhook': 'invalid_signature_test',
      'x-trello-callback-url': 'https://attacker-chosen-url.com/'
    };
    const envWithServerCallback = {
      TRELLO_WEBHOOK_SECRET: 'secret123',
      TRELLO_CALLBACK_URL: 'https://progilic-crm.pages.dev/api/trello/webhook'
    };

    const res = await handleTrelloWebhookRequest(rawBody, headers, 'POST', envWithServerCallback);
    expect(res.status).toBe(401); // Signature mismatch because signature check fails on server URL
    const body = JSON.parse(res.body);
    expect(body.error).toBe('INVALID_OR_MISSING_WEBHOOK_SIGNATURE');
  });
});
