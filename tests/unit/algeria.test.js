import { describe, expect, it } from 'vitest';
import { parseLocalIntent } from '../../src/business/ai/localIntentParser.js';
import { getCommunesForWilaya, getWilayaByName, getWilayasList } from '../../src/utils/algeria.js';
import { cOpts, wOpts } from '../../src/utils/index.js';

describe('Algerian administrative divisions', () => {
  it('includes all 69 wilayas and provides communes for each', () => {
    const wilayas = getWilayasList();
    const communes = wilayas.flatMap(wilaya => getCommunesForWilaya(wilaya.id));

    expect(wilayas).toHaveLength(69);
    expect(wilayas.map(wilaya => wilaya.id)).toEqual(Array.from({ length: 69 }, (_, index) => index + 1));
    expect(wilayas.every(wilaya => getCommunesForWilaya(wilaya.id).length > 0)).toBe(true);
    expect(communes).toHaveLength(1541);
    expect(new Set(communes.map(commune => commune.id)).size).toBe(1541);
  });

  it('finds new wilayas by name and retains legacy wilaya names', () => {
    expect(getWilayaByName('أفلو')).toBe(59);
    expect(getWilayaByName('تمنراست')).toBe(11);
    expect(getCommunesForWilaya(59).length).toBeGreaterThan(0);
  });

  it('recognizes newly added wilayas in local client creation', () => {
    const result = parseLocalIntent('إضافة عميل جديد في أفلو');

    expect(result.extractedData.wilaya).toBe('أفلو');
  });

  it('keeps previously saved location names selectable when editing clients', () => {
    expect(wOpts('الاغواط')).toContain('value="الاغواط" selected');
    expect(cOpts('أفلو', 'اسم بلدية قديم')).toContain('value="اسم بلدية قديم" selected');
  });
});
