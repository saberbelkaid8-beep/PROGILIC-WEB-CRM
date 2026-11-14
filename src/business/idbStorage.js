/**
 * PROGILIC CRM v3 - No-Op Storage Layer
 * Enforces Strictly Online Mode by providing empty stubs for all local storage operations.
 */

export function openUserDB() { return Promise.resolve(null); }
export function closeUserDB() {}
export async function getClients() { return []; }
export async function saveClient() { return true; }
export async function saveClients() { return true; }
export async function deleteClient() { return true; }
export async function getMeta() { return null; }
export async function setMeta() { return true; }
export async function getSyncQueue() { return []; }
export async function saveSyncQueue() { return true; }
export async function getBackups() { return []; }
export async function saveBackup() { return true; }
export async function deleteBackup() { return true; }
export async function getActivities() { return []; }
export async function addActivity() { return "noop"; }
export async function clearAllUserData() { return true; }
