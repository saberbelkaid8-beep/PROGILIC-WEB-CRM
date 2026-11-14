import { describe, it, expect } from 'vitest';
import { migrateSchema } from '../../src/business/storage.js';

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

  it('should migrate product and contractType to programs', () => {
    const data = {
      clients: [
        { id: 1, product: 'ERP', contractType: 'سنوي', startDate: '2023-01-01' }
      ]
    };
    const migrated = migrateSchema(data);
    expect(migrated.clients[0].programs.length).toBe(1);
    expect(migrated.clients[0].programs[0].programName).toBe('ERP');
    expect(migrated.clients[0].programs[0].startDate).toBe('2023-01-01');
  });
});
