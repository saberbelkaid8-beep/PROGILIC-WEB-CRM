import { describe, it, expect } from 'vitest';
import { migrateSchema, sanitizeClient, sanitizeProgram } from '../../src/business/storage.js';

describe('Schema Migration', () => {
  it('should migrate legacy client status', () => {
    const data = {
      clients: [
        { id: 1, status: 'تجريبي' },
        { id: 2, status: 'مفقود' }
      ]
    };
    const migrated = migrateSchema(data);
    expect(migrated.clients[0].status).toBe('محتمل');
    expect(migrated.clients[1].status).toBe('متوقف');
  });

  it('should initialize missing collections', () => {
    const data = {
      clients: [
        { id: 1 }
      ]
    };
    const migrated = migrateSchema(data);
    expect(migrated.clients[0].issues).toEqual([]);
    expect(migrated.clients[0].requirements).toEqual([]);
    expect(migrated.clients[0].gps).toEqual({ lat: null, lng: null });
  });

  it('preserves legacy product fields without inventing canonical program fields', () => {
    const data = {
      clients: [
        { id: 1, product: 'ERP', contractType: 'سنوي', startDate: '2023-01-01' }
      ]
    };
    const migrated = migrateSchema(data);
    expect(migrated.clients[0].programs).toEqual([]);
    expect(migrated.clients[0].product).toBe('ERP');
    expect(migrated.clients[0].contractType).toBe('سنوي');
  });

  it('preserves incomplete program data exactly during sanitization', () => {
    const program = { id: 'legacy-id', programName: 'Recorded Program' };
    const client = { id: 2, product: 'Legacy product', programs: [program] };

    expect(sanitizeProgram(program)).toEqual(program);
    expect(sanitizeClient(client)).toEqual(client);
  });
});
