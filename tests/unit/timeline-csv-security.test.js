import { describe, it, expect } from 'vitest';
import { buildTimelineCSV } from '../../src/business/actions/timelineCsv.js';

describe('Timeline CSV Security & Formula Injection Defense', () => {
  it('should format headers and sanitize all activity properties against formula injection', () => {
    const maliciousActivities = [
      {
        id: '=CMD|"/C calc"!A0',
        timestamp: '2026-11-09T10:00:00Z',
        userName: '+123-calc',
        userRole: '@admin',
        title: '-calc',
        category: '\tSystem',
        clientName: '   =1+1',
        description: '=SUM(A1:A10)'
      }
    ];

    const csvOutput = buildTimelineCSV(maliciousActivities, 'en-US');
    expect(typeof csvOutput).toBe('string');
    expect(csvOutput.startsWith('\uFEFF')).toBe(true); // UTF-8 BOM

    // Every malicious cell must be single-quote escaped
    expect(csvOutput).toContain('"\'=CMD|""/C calc""!A0"');
    expect(csvOutput).toContain('"\' +123-calc"'.replace(/ /g, ''));
    expect(csvOutput).toContain('"\'@admin"');
    expect(csvOutput).toContain('"\' -calc"'.replace(/ /g, ''));
    expect(csvOutput).toContain('"\'\tSystem"');
    expect(csvOutput).toContain('"\'   =1+1"');
    expect(csvOutput).toContain('"\'=SUM(A1:A10)"');

    // No row should contain raw executable `="` formula prefixes
    const lines = csvOutput.split('\r\n');
    for (const line of lines) {
      expect(line.startsWith('="')).toBe(false);
    }
  });

  it('should handle clean legitimate activity entries without corruption', () => {
    const cleanActivities = [
      {
        id: 'act-101',
        timestamp: '2026-11-09T12:00:00Z',
        userName: 'كريم مهندس الدعم',
        userRole: 'employee',
        title: 'إضافة تذكرة دعم',
        category: 'القسم التقني',
        clientName: 'مؤسسة الجزائر للحلول',
        description: 'تم حلي وتحديث تذكرة الدعم'
      }
    ];

    const csvOutput = buildTimelineCSV(cleanActivities, 'ar-DZ');
    expect(csvOutput).toContain('"act-101"');
    expect(csvOutput).toContain('"كريم مهندس الدعم"');
    expect(csvOutput).toContain('"مؤسسة الجزائر للحلول"');
  });
});
