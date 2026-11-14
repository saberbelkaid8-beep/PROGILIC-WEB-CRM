import { describe, it, expect } from 'vitest';
import { parseDumpOrJson, migrateSchema } from '../../src/business/storage.js';

describe('Universal DUM and JSON Import Parser', () => {
  it('should parse direct JSON backup format', () => {
    const raw = JSON.stringify({
      v: 3,
      clients: [
        { id: 101, fullName: 'شركة الأمل', phone: '0555123456', status: 'نشط' }
      ]
    });
    const parsed = parseDumpOrJson(raw);
    expect(parsed.clients).toHaveLength(1);
    expect(parsed.clients[0].fullName).toBe('شركة الأمل');
  });

  it('should parse alternative keys: data, customers, العملاء', () => {
    const rawArabic = JSON.stringify({
      'العملاء': [
        { id: 102, fullName: 'مؤسسة النور', phone: '0666123456', status: 'نشط' }
      ]
    });
    const parsed = parseDumpOrJson(rawArabic);
    expect(parsed.clients).toHaveLength(1);
    expect(parsed.clients[0].fullName).toBe('مؤسسة النور');
  });

  it('should parse dictionary format objects', () => {
    const dict = JSON.stringify({
      version: 3,
      stats: { total: 2 },
      'c_1': { id: 1, fullName: 'عميل أ', phone: '0550' },
      'c_2': { id: 2, fullName: 'عميل ب', phone: '0551' }
    });
    const parsed = parseDumpOrJson(dict);
    expect(parsed.clients).toHaveLength(2);
  });

  it('should parse UTF-8 Base64 encoded DUM backups without corrupting Arabic characters', () => {
    const original = JSON.stringify({
      clients: [{ id: 201, fullName: 'سعيد بلخير للتجارة', wilaya: 'الجزائر العاصمة' }]
    });
    // UTF-8 bytes to base64
    const bytes = new TextEncoder().encode(original);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    const b64 = btoa(binary);

    const parsed = parseDumpOrJson(b64);
    expect(parsed.clients).toHaveLength(1);
    expect(parsed.clients[0].fullName).toBe('سعيد بلخير للتجارة');
    expect(parsed.clients[0].wilaya).toBe('الجزائر العاصمة');
  });

  it('should parse JSON with comments and trailing commas', () => {
    const jsonWithComments = `
      // PROGILIC CRM Dump Export
      /* Generated automatically */
      {
        "v": 3,
        "clients": [
          { "id": 301, "fullName": "مؤسسة المستقبل", "status": "نشط", }
        ],
      }
    `;
    const parsed = parseDumpOrJson(jsonWithComments);
    expect(parsed.clients).toHaveLength(1);
    expect(parsed.clients[0].fullName).toBe('مؤسسة المستقبل');
  });

  it('should parse embedded JSON within SQL dump wrappers', () => {
    const sqlDump = `
      -- MySQL dump 10.13
      -- Host: localhost    Database: progilic_crm
      -- Server version	8.0.35
      /* Snapshot metadata */
      {"v": 3, "clients": [{"id": 401, "fullName": "مجمع السلام"}]}
      -- Dump completed
    `;
    const parsed = parseDumpOrJson(sqlDump);
    expect(parsed.clients).toHaveLength(1);
    expect(parsed.clients[0].fullName).toBe('مجمع السلام');
  });

  it('should migrate schema and normalize missing fields correctly', () => {
    const parsed = {
      clients: [
        { id: 501, name: 'حمزة بن عيسى', status: 'تجريبي', product: 'Logiciel Commercial', contractType: 'سنوي' }
      ]
    };
    const migrated = migrateSchema(parsed);
    expect(migrated.clients).toHaveLength(1);
    expect(migrated.clients[0].fullName).toBe('حمزة بن عيسى');
    expect(migrated.clients[0].status).toBe('محتمل');
    expect(migrated.clients[0].programs).toHaveLength(1);
    expect(migrated.clients[0].programs[0].programName).toBe('Logiciel Commercial');
  });
});
