import { describe, it, expect, beforeEach } from 'vitest';
import { setClients, S } from '../../src/state/store.js';
import { applyFilters } from '../../src/utils/index.js';

describe('Performance - Large Dataset', () => {
  const generateLargeDataset = (count) => {
    return Array.from({ length: count }, (_, i) => ({
      id: i + 1,
      fullName: `Client ${i + 1}`,
      company: `Company ${i + 1}`,
      wilaya: 'الجزائر',
      status: i % 2 === 0 ? 'نشط' : 'محتمل',
      issues: [],
      requirements: [],
      programs: [],
      lastContact: '2023-01-01'
    }));
  };

  it('should handle 5,000 clients efficiently', () => {
    const start = performance.now();
    const data = generateLargeDataset(5000);
    setClients(data);
    const end = performance.now();
    
    expect(end - start).toBeLessThan(500); // Initialization should be fast
    expect(S.clients.length).toBe(5000);
  });

  it('should filter large datasets within reasonable time', () => {
    const data = generateLargeDataset(5000);
    setClients(data);
    S.filter = 'نشط';
    
    const start = performance.now();
    const filtered = applyFilters(S.clients);
    const end = performance.now();
    
    expect(filtered.length).toBe(2500);
    expect(end - start).toBeLessThan(100); // Filtering should be very fast
  });
});
