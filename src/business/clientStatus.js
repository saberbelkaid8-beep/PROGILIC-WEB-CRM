/**
 * Pure domain helpers for Client Confirmation Status ("مؤكد" / Confirmé vs "غير مؤكد" / Non confirmé)
 * and bulk smart client classification.
 */

import { CLIENT_STATUS_CONFIRMED, CLIENT_STATUS_UNCONFIRMED } from '../constants/index.js';

const CONFIRMED_ALIASES = new Set([
  'مؤكد',
  'مؤكدة',
  'مؤكدون',
  'نشط',
  'active',
  'confirm',
  'confirme',
  'confirmé',
  'confirmee',
  'confirmée',
  'confirmed'
]);

const UNCONFIRMED_ALIASES = new Set([
  'غير مؤكد',
  'غير مؤكدة',
  'غير مؤكدين',
  'محتمل',
  'متوقف',
  'تجريبي',
  'مفقود',
  'no-active',
  'no active',
  'inactive',
  'non-confirm',
  'non confirm',
  'non-confirme',
  'non confirme',
  'non-confirmé',
  'non confirmé',
  'non-confirmed',
  'non confirmed',
  'unconfirmed',
  'prospect',
  'stopped'
]);

export function normalizeClientStatus(status) {
  const raw = String(status || '').trim();
  if (!raw) return CLIENT_STATUS_UNCONFIRMED;
  if (raw === CLIENT_STATUS_CONFIRMED) return CLIENT_STATUS_CONFIRMED;
  if (raw === CLIENT_STATUS_UNCONFIRMED) return CLIENT_STATUS_UNCONFIRMED;
  const lower = raw.toLowerCase();
  if (CONFIRMED_ALIASES.has(raw) || CONFIRMED_ALIASES.has(lower)) {
    return CLIENT_STATUS_CONFIRMED;
  }
  if (UNCONFIRMED_ALIASES.has(raw) || UNCONFIRMED_ALIASES.has(lower)) {
    return CLIENT_STATUS_UNCONFIRMED;
  }
  return CLIENT_STATUS_UNCONFIRMED;
}

export function isConfirmedClientStatus(status) {
  return normalizeClientStatus(status) === CLIENT_STATUS_CONFIRMED;
}

export function isUnconfirmedClientStatus(status) {
  return normalizeClientStatus(status) === CLIENT_STATUS_UNCONFIRMED;
}

export function inspectClientSignals(client) {
  if (!client || typeof client !== 'object') {
    return {
      hasPrograms: false,
      hasContacts: false,
      hasNotesOrRecords: false,
      programsCount: 0,
      contactsCount: 0,
      issuesCount: 0,
      requirementsCount: 0
    };
  }

  const programsArr = Array.isArray(client.programs) ? client.programs.filter(Boolean) : [];
  const programNamesArr = Array.isArray(client.programNames) ? client.programNames.filter(Boolean) : [];
  const programsCount = Math.max(
    programsArr.length,
    Number(client.programsCount) || 0,
    programNamesArr.length
  );
  const hasPrograms = programsCount > 0;

  const contactsArr = Array.isArray(client.contactHistory) ? client.contactHistory.filter(Boolean) : [];
  const contactsCount = Math.max(contactsArr.length, Number(client.contactsCount) || 0);
  const hasLastContact = Boolean(String(client.lastContact || '').trim());
  const hasContacts = hasLastContact || contactsCount > 0;

  const issuesArr = Array.isArray(client.issues) ? client.issues.filter(Boolean) : [];
  const issuesCount = Math.max(
    issuesArr.length,
    (Number(client.openIssuesCount) || 0) + (Number(client.solvedIssuesCount) || 0)
  );
  const reqsArr = Array.isArray(client.requirements) ? client.requirements.filter(Boolean) : [];
  const requirementsCount = Math.max(reqsArr.length, Number(client.requirementsCount) || 0);
  const hasNotes = Boolean(String(client.notes || '').trim());
  const hasNotesOrRecords = hasNotes || issuesCount > 0 || requirementsCount > 0;

  return {
    hasPrograms,
    hasContacts,
    hasNotesOrRecords,
    programsCount,
    contactsCount,
    issuesCount,
    requirementsCount
  };
}

/**
 * Classifies a client as "مؤكد" (Confirmé) or "غير مؤكد" (Non confirmé).
 * - mode === 'balanced' (default):
 *   Clients with NO programs AND NO contacts AND NO logged notes/issues/requirements -> "غير مؤكد".
 *   Clients with at least a program OR a logged contact OR a logged note/record -> "مؤكد".
 * - mode === 'strict':
 *   Only clients that have BOTH programs AND a logged contact/note -> "مؤكد".
 *   Everyone else (no programs OR never contacted) -> "غير مؤكد".
 */
export function classifyClientConfirmation(client, mode = 'balanced') {
  const signals = inspectClientSignals(client);
  if (mode === 'strict') {
    return (signals.hasPrograms && (signals.hasContacts || signals.hasNotesOrRecords))
      ? CLIENT_STATUS_CONFIRMED
      : CLIENT_STATUS_UNCONFIRMED;
  }
  return (signals.hasPrograms || signals.hasContacts || signals.hasNotesOrRecords)
    ? CLIENT_STATUS_CONFIRMED
    : CLIENT_STATUS_UNCONFIRMED;
}

export function buildClientClassificationPlan(clientsList = [], mode = 'balanced') {
  const safeClients = Array.isArray(clientsList) ? clientsList.filter(c => c && typeof c === 'object') : [];
  const changes = [];
  const confirmedClients = [];
  const unconfirmedClients = [];

  for (const client of safeClients) {
    const signals = inspectClientSignals(client);
    const nextStatus = classifyClientConfirmation(client, mode);
    if (nextStatus === CLIENT_STATUS_CONFIRMED) {
      confirmedClients.push({ client, signals });
    } else {
      unconfirmedClients.push({ client, signals });
    }
    if (client.status !== nextStatus) {
      changes.push({
        client,
        prevStatus: client.status || '',
        nextStatus,
        signals
      });
    }
  }

  return {
    mode,
    total: safeClients.length,
    confirmedCount: confirmedClients.length,
    unconfirmedCount: unconfirmedClients.length,
    changesCount: changes.length,
    changes,
    confirmedClients,
    unconfirmedClients
  };
}
