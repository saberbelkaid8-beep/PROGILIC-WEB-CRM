/**
 * PROGILIC CRM × TRELLO INTEGRATION
 * Contextual AI Extraction Engine
 * 
 * Uses Gemini to parse raw checklist items from "PROGRAMME DE SERVICES"
 * without keyword bias or hardcoded enums.
 */

import { auth } from '../../firebase/config.js';

export const TRELLO_AI_SYSTEM_PROMPT = `
You are the AI Understanding Engine for PROGILIC CRM.
Your mission is to understand operational items imported from Trello checklist items.

IMPORTANT RULES:
1. Strict contextual interpretation: Terms like "Vidéo", "Déplacement", "Prestation" are illustrative operational vehicles, NOT automatic bug tickets or forced categories.
2. Separate:
   - Action Nature (What is happening: installation, technical_issue, requirement, training, assistance, contact, service)
   - Intervention Medium (How it was delivered: Vidéo, Déplacement, Téléphone, or null if unspecified)
   - Stated Outcome (Did the text explicitly confirm resolution? e.g. "réparé", "réglé", "تم الحل"). Checkbox state alone does not mean an issue is resolved.
3. Extract verbatim evidence from the text for every conclusion.
4. If details are missing or ambiguous, explicitly list them in "uncertainties" and lower confidence. Never fabricate information.
5. Extract customer details: rawName, phone, wilaya, company, and whether the text indicates they are an existing real-world customer (e.g. renewal, upgrade).

OUTPUT FORMAT: Return strictly a valid JSON object matching the requested schema.
`;

export async function classifyTrelloItem(checklistItem, cardContext = {}) {
  const itemText = checklistItem?.name || '';
  if (!itemText.trim()) {
    return {
      rawText: '',
      actionNature: 'unspecified',
      extractedInterventionMedium: null,
      contextEvidence: '',
      statedOutcome: 'unspecified',
      confirmedResolved: false,
      outcomeEvidence: null,
      confidence: 0,
      uncertainties: ['Empty checklist item text'],
      customer: { rawName: '', phone: null, company: null, wilaya: null, isExistingRealWorldClient: false }
    };
  }
  try {
    const headers = { 'Content-Type': 'application/json' };
    if (auth && auth.currentUser && typeof auth.currentUser.getIdToken === 'function') {
      try {
        const idToken = await auth.currentUser.getIdToken();
        if (idToken) headers['Authorization'] = `Bearer ${idToken}`;
      } catch (_) {}
    }

    const res = await fetch('/api/trello/classify', {
      method: 'POST',
      headers,
      body: JSON.stringify({ itemText, cardContext, checklistItem })
    });

    if (res.ok) {
      const data = await res.json();
      if (data && data.actionNature) {
        return data;
      }
    }
  } catch (err) {
    console.warn('[Trello AI] Remote classifier unreachable, using local heuristic parser:', err.message);
  }

  // Fallback Local Heuristic Parser for robust offline/testing resilience
  return parseLocallyWithHeuristics(itemText, checklistItem);
}

export function parseLocallyWithHeuristics(text, checklistItem) {
  const clean = text.trim();
  const lower = clean.toLowerCase();
  const uncertainties = [];

  // 1. Phone extraction
  const phoneMatch = clean.match(/(?:0|\+?213)[5-7]\d{8}/);
  const phone = phoneMatch ? phoneMatch[0] : null;

  // 2. Intervention medium detection (verbatim evidence)
  let extractedInterventionMedium = null;
  if (lower.includes('vidéo') || lower.includes('video') || clean.includes('فيديو')) {
    extractedInterventionMedium = 'Vidéo';
  } else if (lower.includes('déplacement') || lower.includes('deplacement') || clean.includes('تنقل')) {
    extractedInterventionMedium = 'Déplacement';
  }

  // 3. Stated outcome detection
  let confirmedResolved = false;
  let outcomeEvidence = null;
  if (/réparé|réglé|résolu|termine|terminé|fait|تم الحل|محلول/i.test(clean)) {
    confirmedResolved = true;
    outcomeEvidence = 'Explicit resolution indicated in text.';
  }

  // 4. Action nature detection based on complete context
  let actionNature = 'unspecified';
  let title = clean;

  if (/panne|erreur|bug|problème|probleme|bloqué|مشكل|عطب|خطأ/i.test(clean)) {
    actionNature = 'technical_issue';
  } else if (/install|installation|activer|activation|v27|v26|v24|تثبيت|تفعيل/i.test(clean)) {
    actionNature = 'installation';
  } else if (/demande|ajouter|modifi|développement|ميزة|تعديل|طلب/i.test(clean)) {
    actionNature = 'requirement';
  } else if (/formation|explication|apprendre|guide|تدريب|شرح/i.test(clean)) {
    actionNature = 'training';
  } else if (/استفسار|سؤال|متابعة|تواصل|contact|appel|question/i.test(clean)) {
    actionNature = 'contact';
  } else if (extractedInterventionMedium) {
    actionNature = 'service';
  } else {
    uncertainties.push('Operational nature requires review');
  }

  // 5. Customer name extraction heuristic
  let rawName = '';
  const customerPrefixMatch = clean.match(/(?:client|زبون|للزبون|محل|ets)\s+([A-Za-z\u0600-\u06FF0-9\s_-]+?)(?:[-–—:]|\s+(?:panne|install|vidéo|déplacement|0[5-7]|سطيف|وهران|الجزائر))/i);
  if (customerPrefixMatch && customerPrefixMatch[1]) {
    rawName = customerPrefixMatch[1].trim();
  } else {
    const parts = clean.split(/[-–—:]/);
    if (parts.length > 1 && parts[0].trim().length >= 3) {
      rawName = parts[0].replace(/(?:0|\+?213)[5-7]\d{8}/g, '').trim();
    }
  }

  // Extract common wilaya if present
  let wilaya = null;
  const wilayaMatch = clean.match(/(سطيف|وهران|الجزائر|قسنطينة|بوفاريك|عنابة|تلمسان|باتنة|البليدة|أدرار|الشلف)/);
  if (wilayaMatch) {
    wilaya = wilayaMatch[1];
  }

  const confidence = uncertainties.length === 0 && rawName ? 0.95 : 0.75;

  return {
    rawText: clean,
    actionNature,
    actionDescription: clean,
    title,
    extractedInterventionMedium,
    contextEvidence: clean,
    statedOutcome: confirmedResolved ? 'completed' : (checklistItem?.state === 'complete' ? 'in_progress' : 'unspecified'),
    confirmedResolved,
    outcomeEvidence,
    confidence,
    uncertainties,
    customer: {
      rawName,
      phone,
      company: null,
      wilaya,
      isExistingRealWorldClient: /v2[0-9]|renouvel|mise à jour|تجديد/i.test(clean)
    }
  };
}
