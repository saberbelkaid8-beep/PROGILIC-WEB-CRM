/**
 * AI Gateway interfacing with Google Gemini 2.5 Flash via /api/ai server route and local offline failover.
 */

import { parseLocalIntent } from './localIntentParser.js';
import { auth } from '../../firebase/config.js';

export async function processAiRequest(userMessage, activeContext = {}, conversationHistory = []) {
  if (!navigator.onLine) {
    console.info('AI Gateway: Device offline, switching to local intent parser.');
    return parseLocalIntent(userMessage, activeContext);
  }

  try {
    const headers = { 'Content-Type': 'application/json' };
    if (auth && auth.currentUser && typeof auth.currentUser.getIdToken === 'function') {
      try {
        const idToken = await auth.currentUser.getIdToken();
        if (idToken) headers['Authorization'] = `Bearer ${idToken}`;
      } catch (_) {}
    }

    const res = await fetch('/api/ai', {
      method: 'POST',
      headers,
      body: JSON.stringify({ userMessage, activeContext, conversationHistory })
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      console.warn('AI Server API response error:', res.status, errJson);
      return parseLocalIntent(userMessage, activeContext);
    }

    const data = await res.json();
    if (data && data.intent) {
      return data;
    }

    console.warn('AI Server returned unexpected result structure, falling back to local intent parser:', data);
    return parseLocalIntent(userMessage, activeContext);
  } catch (err) {
    console.error('AI Gateway Fetch/Network Error:', err);
    return parseLocalIntent(userMessage, activeContext);
  }
}
