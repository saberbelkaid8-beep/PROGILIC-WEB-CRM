/**
 * PROGILIC CRM - Program Reconciliation & Recovery Service
 * Recovers missing software licenses for clients by reconciling with
 * historical timeline audit traces, programNames arrays, and CRM records.
 */

import { clients, S, setClients } from '../state/store.js';
import { td } from '../utils/index.js';
import { saveClientSubItemTransaction } from '../firebase/service.js';
import { logActivity, ActivityType } from './timelineService.js';

/**
 * Extracts a structured program object from an activity audit entry.
 */
export function extractProgramFromActivity(act, client) {
  if (!act) return null;
  const desc = act.description || '';
  const title = act.title || '';

  // 1. Program Name
  let progName = '';
  const titleMatch = title.match(/خدمة ترخيص برنامج:\s*([^\n\r]+)/);
  if (titleMatch && titleMatch[1]) {
    progName = titleMatch[1].trim();
  }
  if (!progName) {
    const descMatch = desc.match(/خدمة برمجية\s*"([^"]+)"/);
    if (descMatch && descMatch[1]) {
      progName = descMatch[1].trim();
    }
  }
  if (!progName) {
    const descMatch2 = desc.match(/للبرنامج\s*"([^"]+)"/);
    if (descMatch2 && descMatch2[1]) {
      progName = descMatch2[1].trim();
    }
  }
  if (!progName && client?.programNames && client.programNames.length > 0) {
    progName = client.programNames[0];
  }
  if (!progName) {
    progName = 'Desktop - تجاري V27';
  }

  // 2. Platform
  let platform = 'Desktop';
  const platMatch = desc.match(/المنصة:\s*([^\s-]+)/);
  if (platMatch && platMatch[1]) {
    platform = platMatch[1].trim();
  } else if (progName.toLowerCase().includes('mobile')) {
    platform = 'Mobile';
  } else if (progName.toLowerCase().includes('web')) {
    platform = 'Web';
  }

  // 3. Type
  let type = 'تجاري (Commercial)';
  const typeMatch = desc.match(/نوع الخدمة:\s*([^\s-]+)/);
  if (typeMatch && typeMatch[1]) {
    const rawType = typeMatch[1].trim();
    type = rawType.includes('تجاري') ? 'تجاري (Commercial)' :
           rawType.includes('إنتاجي') ? 'إنتاجي (Production)' :
           rawType.includes('توزيع') ? 'توزيع (Distribution)' : rawType;
  } else if (platform === 'Mobile') {
    type = 'تطبيق لوحة القيادة (Tableau de bord)';
  }

  // 4. Version
  let version = 'V27';
  const verMatch = progName.match(/(V\d+|v\d+|R\+|arabe)/i);
  if (verMatch) {
    version = verMatch[1];
  } else if (platform === 'Mobile') {
    version = '';
  }

  // 5. Installations count
  let installationsCount = 1;
  const instMatch = desc.match(/أجهزة مرخصة:\s*(\d+)/) || desc.match(/مع\s*(\d+)\s*أجهزة/);
  if (instMatch && instMatch[1]) {
    installationsCount = Math.max(1, parseInt(instMatch[1], 10));
  } else if (client?.installationsCount) {
    installationsCount = Math.max(1, client.installationsCount);
  }

  // 6. Dates
  let startDate = client?.startDate || td();
  const startMatch = desc.match(/البداية:\s*([\d-]+)/);
  if (startMatch && startMatch[1]) {
    startDate = startMatch[1].trim();
  } else if (act.timestamp) {
    startDate = act.timestamp.split('T')[0];
  }

  let endDate = '';
  const endMatch = desc.match(/النهاية:\s*([\d-]+)/);
  if (endMatch && endMatch[1]) {
    endDate = endMatch[1].trim();
  }

  // Ensure deterministic ID if possible
  let progId = Date.now() + Math.floor(Math.random() * 1000);
  if (act.id && act.id.startsWith('act_prog_')) {
    const parts = act.id.split('_');
    const lastPart = parts[parts.length - 1];
    if (/^\d+$/.test(lastPart)) {
      progId = Number(lastPart);
    }
  }

  return {
    id: progId,
    programName: progName,
    platform,
    type,
    version,
    installationsCount,
    startDate,
    endDate
  };
}

/**
 * Reconciles and restores missing programs for all clients using timeline traces.
 * Safe, idempotent, and non-destructive.
 */
export async function reconcileMissingPrograms(userId) {
  if (!userId || !Array.isArray(clients) || clients.length === 0) return { reconciledCount: 0 };

  const allActivities = Array.isArray(S.globalActivities) ? S.globalActivities : [];
  let reconciledCount = 0;
  let hasChanges = false;

  console.log(`[Reconciliation] Auditing ${clients.length} clients against ${allActivities.length} timeline traces...`);

  for (const client of clients) {
    // Only reconcile if programs array is completely empty or missing
    const hasPrograms = Array.isArray(client.programs) && client.programs.length > 0;
    if (hasPrograms) continue;

    // Search for any timeline activity for this client related to programs
    const clientTrace = allActivities.find(act => {
      if (!act) return false;
      const isTargetClient = act.clientId === client.id ||
                             String(act.clientId) === String(client.id) ||
                             (act.clientName && client.fullName && act.clientName.trim() === client.fullName.trim());
      if (!isTargetClient) return false;

      const isProgramType = act.type === ActivityType.PROGRAM_ADDED || act.type === 'PROGRAM_ADDED';
      const hasProgramTitle = (act.title || '').includes('برنامج') || (act.title || '').includes('ترخيص');
      const hasProgramDesc = (act.description || '').includes('خدمة برمجية') || (act.description || '').includes('أجهزة مرخصة');

      return isProgramType || hasProgramTitle || hasProgramDesc;
    });

    let recoveredProgram = null;

    if (clientTrace) {
      console.log(`[Reconciliation] Found timeline trace for client "${client.fullName}":`, clientTrace.title);
      recoveredProgram = extractProgramFromActivity(clientTrace, client);
    } else if (client.programNames && client.programNames.length > 0) {
      const pName = client.programNames[0];
      console.log(`[Reconciliation] Recovering program from programNames for client "${client.fullName}":`, pName);
      const isMobile = pName.toLowerCase().includes('mobile');
      const isWeb = pName.toLowerCase().includes('web');
      const platform = isMobile ? 'Mobile' : (isWeb ? 'Web' : 'Desktop');
      const verMatch = pName.match(/(V\d+|v\d+|R\+|arabe)/i);
      const version = verMatch ? verMatch[1] : (platform === 'Mobile' ? '' : 'V27');
      const type = platform === 'Mobile' ? 'تطبيق لوحة القيادة (Tableau de bord)' : 'تجاري (Commercial)';
      
      recoveredProgram = {
        id: Date.now() + Math.floor(Math.random() * 1000),
        programName: pName,
        platform,
        type,
        version,
        installationsCount: Math.max(1, client.installationsCount || 1),
        startDate: client.startDate || td(),
        endDate: client.endDate || ''
      };
    } else if (client.status === 'نشط' || (client.programsCount && client.programsCount > 0)) {
      // Active client with missing program record: restore standard commercial Desktop license
      console.log(`[Reconciliation] Restoring standard license for active client "${client.fullName}"`);
      recoveredProgram = {
        id: Date.now() + Math.floor(Math.random() * 1000),
        programName: 'Desktop - تجاري V27',
        platform: 'Desktop',
        type: 'تجاري (Commercial)',
        version: 'V27',
        installationsCount: Math.max(1, client.installationsCount || 1),
        startDate: client.startDate || td(),
        endDate: ''
      };
    }

    if (recoveredProgram) {
      client.programs = [recoveredProgram];
      client.programsCount = 1;
      client.installationsCount = recoveredProgram.installationsCount;
      client.programNames = [recoveredProgram.programName];
      client._subcollectionsLoaded = true;

      // Persist to Cloud Firestore subcollection & denormalized counters
      try {
        await saveClientSubItemTransaction(
          userId,
          client.id,
          'programs',
          recoveredProgram,
          {
            programsCount: 1,
            installationsCount: recoveredProgram.installationsCount,
            programNames: [recoveredProgram.programName]
          }
        );
        console.log(`[Reconciliation] Successfully saved recovered program to Firestore for client ${client.fullName}`);
      } catch (saveErr) {
        console.warn(`[Reconciliation] Notice while saving recovered program to Firestore:`, saveErr);
      }

      reconciledCount++;
      hasChanges = true;
    }
  }

  if (hasChanges) {
    setClients([...clients]);
    if (typeof window !== 'undefined' && window.R) {
      window.R();
    }
  }

  return { reconciledCount };
}
