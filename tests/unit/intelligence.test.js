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
  generateAutoNote,
  checkCacheValidity
} from '../../src/business/intelligence.js';

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

  describe('computeScore', () => {
    it('should compute score properly with subcollections', () => {
      // Mock Date to ensure deterministic scoring for "lastContact"
      const now = new Date('2023-01-10T00:00:00Z').getTime();
      vi.spyOn(Date, 'now').mockReturnValue(now);

      const client = {
        _subcollectionsLoaded: true,
        lastContact: '2023-01-08', // 2 days ago
        programs: [
          { status: 'نشط', installationsCount: 2 }
        ],
        issues: [
          { status: 'مفتوح', priority: 'عاجل' }
        ],
        requirements: [
          { status: 'مكتمل' }
        ]
      };
      // For testing, mock the internal max values which are used
      // Since it depends on global S.clients, we might need to mock getProgramStats or clients array
      // but if the clients list is empty, maxProgs is 1, maxInst is 1
      const score = computeScore(client);
      
      expect(score).toBeDefined();
      expect(score.total).toBeGreaterThan(0);
      expect(score.total).toBeLessThanOrEqual(100);
      
      // Since lastContact is 2 days ago (< 7), actScore = 25
      expect(score.act).toBe(25);
      
      vi.restoreAllMocks();
    });

    it('should use pre-computed score if subcollections are not loaded', () => {
      const client = {
        _subcollectionsLoaded: false,
        score: 85
      };
      
      const score = computeScore(client);
      
      expect(score).toEqual({ total: 85, prog: 0, act: 0, iss: 0, req: 0 });
    });
  });

  it('uses follow-up terminology instead of risk labels and omits HIGH_RISK alerts', async () => {
    const { setClients } = await import('../../src/state/store.js');
    expect(scoreLabel(10)).toBe('متابعة عاجلة');
    expect(riskLabel('high')).toBe('أولوية متابعة');
    expect(riskLabel('medium')).toBe('تحت المتابعة');

    setClients([
      {
        id: 501,
        fullName: 'Client Urgent',
        status: 'مؤكد',
        score: 10,
        lastContact: '2023-01-01',
        programs: [{ id: 'p1', programName: 'POS', installationsCount: 4 }],
        issues: [{ id: 'i1', title: 'Crash', priority: 'عاجل', status: 'مفتوح', date: '2026-01-01' }],
        requirements: []
      },
      {
        id: 502,
        fullName: 'Client Solved',
        status: 'مؤكد',
        programs: [{ id: 'p2', programName: 'Commercial', installationsCount: 2 }],
        issues: [{ id: 'i2', title: 'Fixed', priority: 'متوسطة', status: 'محلول', date: '2026-01-01' }],
        requirements: []
      }
    ]);

    const alerts = computeAlerts();
    expect(alerts.some(a => a.type === 'HIGH_RISK')).toBe(false);

    const gs = computeGlobalStats();
    expect(gs.resolutionRate).toBe(50);
    expect(gs.topClients.length).toBe(2);
    expect(gs.topClients[0].client.id).toBe(501);
    setClients([]);
  });
});
