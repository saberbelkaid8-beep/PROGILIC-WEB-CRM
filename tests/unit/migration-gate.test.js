import { describe, expect, it, vi } from 'vitest';

const firestoreMocks = vi.hoisted(() => ({
  writeBatch: vi.fn(),
  setDoc: vi.fn()
}));

vi.mock('../../src/firebase/config.js', () => ({ db: {} }));
vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  writeBatch: firestoreMocks.writeBatch,
  setDoc: firestoreMocks.setDoc,
  getDoc: vi.fn()
}));
vi.mock('../../src/firebase/service.js', () => ({
  handleFirestoreError: vi.fn(),
  OperationType: { MIGRATION: 'MIGRATION' }
}));

import { migrateLegacyDataIfNeeded } from '../../src/firebase/migration.js';

describe('Legacy migration safety gate', () => {
  it('does not write unless explicit approval and a verified backup are supplied', async () => {
    const result = await migrateLegacyDataIfNeeded('tenant-1', { clients: [] }, 101);

    expect(result).toMatchObject({ status: 'blocked', writesPerformed: 0 });
    expect(firestoreMocks.writeBatch).not.toHaveBeenCalled();
    expect(firestoreMocks.setDoc).not.toHaveBeenCalled();
  });
});
