import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isQueueableSyncError,
  coalescePendingMutation,
  overlayPendingMutationsOnClients,
  advanceQueuedMutationVersions
} from './syncQueueUtils.js';

test('isQueueableSyncError returns true only for offline/transient failures and false for permission/quota/conflict/validation errors', () => {
  assert.equal(isQueueableSyncError({ code: 'network-offline' }), true);
  assert.equal(isQueueableSyncError({ code: 'unavailable' }), true);
  assert.equal(isQueueableSyncError({ code: 'firestore_timeout' }), true);
  assert.equal(isQueueableSyncError({ message: 'Failed to fetch due to network error' }), true);

  assert.equal(isQueueableSyncError({ code: 'permission-denied' }), false);
  assert.equal(isQueueableSyncError({ code: 'resource-exhausted' }), false);
  assert.equal(isQueueableSyncError({ code: 'VERSION_CONFLICT' }), false);
  assert.equal(isQueueableSyncError({ code: 'invalid-argument' }), false);
});

test('coalescePendingMutation merges ADD+UPDATE, UPDATE+UPDATE preserving earliest baseVersion, and drops ADD+DELETE', () => {
  let queue = [];
  queue = coalescePendingMutation(queue, {
    type: 'ADD_CLIENT',
    payload: { clientId: '10', clientData: { id: 10, fullName: 'عميل 1', phone: '0550' } }
  });
  queue = coalescePendingMutation(queue, {
    type: 'UPDATE_CLIENT',
    payload: { clientId: '10', clientData: { id: 10, phone: '0551', notes: 'محدث' }, baseVersion: 1 }
  });
  assert.equal(queue.length, 1);
  assert.equal(queue[0].type, 'ADD_CLIENT');
  assert.equal(queue[0].payload.clientData.phone, '0551');
  assert.equal(queue[0].payload.clientData.notes, 'محدث');

  queue = coalescePendingMutation(queue, {
    type: 'DELETE_CLIENT',
    payload: { clientId: '10' }
  });
  assert.equal(queue.length, 0);

  // Existing client UPDATE coalescing keeps baseVersion of earliest pending edit
  let updQueue = [];
  updQueue = coalescePendingMutation(updQueue, {
    type: 'UPDATE_CLIENT',
    payload: { clientId: '20', clientData: { id: 20, fullName: 'A' }, baseVersion: 4, oldStatus: 'نشط' }
  });
  updQueue = coalescePendingMutation(updQueue, {
    type: 'UPDATE_CLIENT',
    payload: { clientId: '20', clientData: { id: 20, notes: 'B' }, baseVersion: 99, oldStatus: 'محتمل' }
  });
  assert.equal(updQueue.length, 1);
  assert.equal(updQueue[0].payload.baseVersion, 4);
  assert.equal(updQueue[0].payload.oldStatus, 'نشط');
  assert.equal(updQueue[0].payload.clientData.fullName, 'A');
  assert.equal(updQueue[0].payload.clientData.notes, 'B');
});

test('overlayPendingMutationsOnClients preserves pending local edits during Firestore snapshots without hiding remote updates for other clients', () => {
  const serverSnapshot = [
    { id: 1, fullName: 'Client 1 Server Old', notes: '', version: 2 },
    { id: 2, fullName: 'Client 2 Remote Updated', notes: 'From Session B', version: 5 }
  ];
  const queue = [
    {
      id: 'q1',
      type: 'UPDATE_CLIENT',
      payload: { clientId: '1', clientData: { id: 1, fullName: 'Client 1 Unsaved Edit', notes: 'Offline Note' }, baseVersion: 2 }
    },
    {
      id: 'q2',
      type: 'SYNC_PROGRAM_VERSION',
      payload: {
        clientId: '1',
        counterUpdates: {
          programs: [{ id: 10, programName: 'Mobile - تطبيق VDD V22', version: 'V22', installationsCount: 4 }],
          programNames: ['Mobile - تطبيق VDD V22'],
          programsCount: 1,
          installationsCount: 4
        },
        versionHistoryEntry: { id: 'vh_1', newVersion: 'V22', previousVersion: 'V21' }
      }
    }
  ];

  const merged = overlayPendingMutationsOnClients(serverSnapshot, queue, []);
  const c1 = merged.find(c => c.id === 1);
  const c2 = merged.find(c => c.id === 2);

  assert.equal(c1.fullName, 'Client 1 Unsaved Edit');
  assert.equal(c1.notes, 'Offline Note');
  assert.equal(c1._dirtyLocal, true);
  assert.equal(c1.programs[0].version, 'V22');
  assert.equal(c1.versionHistory[0].id, 'vh_1');

  assert.equal(c2.fullName, 'Client 2 Remote Updated');
  assert.equal(c2.notes, 'From Session B');
  assert.equal(Boolean(c2._dirtyLocal), false);
});

test('advanceQueuedMutationVersions increments expected baseVersion for subsequent queued writes of the same client', () => {
  const queue = [
    { id: 'q2', type: 'SYNC_PROGRAM_VERSION', payload: { clientId: '55', baseVersion: 3, concurrency: { baseVersion: 3 } } },
    { id: 'q3', type: 'UPDATE_CLIENT', payload: { clientId: '99', baseVersion: 1 } }
  ];

  const next = advanceQueuedMutationVersions(queue, '55', { version: 4 });
  assert.equal(next[0].payload.baseVersion, 4);
  assert.equal(next[0].payload.concurrency.baseVersion, 4);
  assert.equal(next[1].payload.baseVersion, 1);
});
