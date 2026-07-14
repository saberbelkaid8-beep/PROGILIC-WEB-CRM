import { describe, it, expect, vi } from 'vitest';
import { 
  scoreColor, 
  scoreLabel, 
  riskColor, 
  riskLabel, 
  computeScore, 
  analyzeRootCause,
  detectCrossClientIssues,
  computeRiskProfile,
  computeGlobalStats,
  computeAlerts,
  calcAutoConf,
  autoDetectFeatureOpp,
  generateAutoNote
} from '../../src/business/intelligence.js';
import { S, setClients } from '../../src/state/store.js';

describe('Intelligence Module', () => {
  it('should return correct score colors', () => {
    expect(scoreColor(80)).toBe('#10B981');
    expect(scoreColor(60)).toBe('#F59E0B');
    expect(scoreColor(30)).toBe('#F97316');
    expect(scoreColor(10)).toBe('#EF4444');
  });

  it('should analyze root causes correctly', () => {
    const issue = { source: 'نظام', type: 'أداء', repeatCount: 1 };
    const causes = analyzeRootCause(issue);
    expect(causes[0]).toContain('استعلام');
    
    const userIssue = { source: 'سوء استخدام' };
    expect(analyzeRootCause(userIssue)[0]).toContain('المستخدم');
  });

  it('should calculate auto confidence', () => {
    expect(calcAutoConf('نظام', 'خطأ تقني', 1)).toBe(72);
    expect(calcAutoConf('نظام', 'خطأ تقني', 3)).toBe(90);
  });

  it('should detect feature opportunities', () => {
    const issues = [{ repeatCount: 3, source: 'نظام', featureOpp: false }];
    autoDetectFeatureOpp(issues);
    expect(issues[0].featureOpp).toBe(true);
  });

  it('should generate auto notes', () => {
    const client = {
      status: 'نشط',
      lastContact: '2023-01-01',
      issues: [],
      requirements: [],
      programs: [],
      contactHistory: []
    };
    const note = generateAutoNote(client);
    expect(note.text).toBeDefined();
    expect(note.action).toBeDefined();
  });
});
