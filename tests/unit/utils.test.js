import { describe, it, expect } from 'vitest';
import { computeScore } from '../../src/business/intelligence.js';
import { searchMatch, normalizePhone } from '../../src/utils/index.js';

describe('Intelligence Utils', () => {
  it('should normalize phone numbers correctly', () => {
    expect(normalizePhone('0550-12-34-56')).toBe('0550123456');
    expect(normalizePhone('+213 550 12 34 56')).toBe('+213550123456');
  });

  it('should compute scores based on issues', () => {
    const client = {
      status: 'نشط',
      issues: [
        { status: 'مفتوح', priority: 'متوسطة' },
        { status: 'قيد المعالجة', priority: 'متوسطة' }
      ],
      requirements: [],
      programs: [],
      lastContact: '2023-01-01'
    };
    const score = computeScore(client);
    expect(score.total).toBeDefined();
    expect(score.total).toBeGreaterThanOrEqual(0);
    expect(score.total).toBeLessThanOrEqual(100);
  });
});

describe('Search Utils', () => {
  const client = {
    fullName: 'Ahmed Mohamed',
    company: 'Tech Corp',
    phone: '0550112233',
    programNames: ['ERP Plus']
  };

  it('should find client by name', () => {
    const result = searchMatch(client, 'ahmed');
    expect(result.match).toBe(true);
    expect(result.fields).toContain('الاسم');
  });

  it('should find client by program name', () => {
    const result = searchMatch(client, 'erp');
    expect(result.match).toBe(true);
    expect(result.fields).toContain('البرنامج');
  });

  it('should return no match for non-existent data', () => {
    const result = searchMatch(client, 'nonexistent');
    expect(result.match).toBe(false);
  });
});
