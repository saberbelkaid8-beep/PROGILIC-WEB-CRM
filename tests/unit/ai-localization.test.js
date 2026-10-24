import { describe, expect, it } from 'vitest';
import { parseLocalIntent } from '../../src/business/ai/localIntentParser.js';

describe('AI assistant localization', () => {
  it('uses the selected language for offline search and navigation responses', () => {
    const frenchSearch = parseLocalIntent('بحث عن حمزة', { language: 'fr' });
    expect(frenchSearch.summary).toBe('Recherche de : "حمزة"');
    expect(frenchSearch.extractedData.query).toBe('حمزة');

    const englishNavigation = parseLocalIntent('Open dashboard', { language: 'en' });
    expect(englishNavigation.summary).toBe('Opening the dashboard');
    expect(englishNavigation.plan).toEqual(['Open the main dashboard']);
  });

  it('keeps entered client details while localizing offline draft feedback', () => {
    const result = parseLocalIntent('إضافة عميل جديد أحمد من وهران', { language: 'en' });
    expect(result.summary).toContain('أحمد');
    expect(result.summary).toContain('وهران');
    expect(result.summary).toMatch(/^Preparing a draft/);
    expect(result.plan).toEqual([
      'Open the new client form',
      'Fill in the extracted fields for review'
    ]);
    expect(result.extractedData.status).toBe('نشط');
  });
});
