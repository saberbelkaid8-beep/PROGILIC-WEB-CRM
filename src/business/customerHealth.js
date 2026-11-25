import { ISSUE_SLA_HOURS } from '../constants/index.js';
import { getClientCategoryBreakdown } from './programMetrics.js';
import { isConfirmedClientStatus } from './clientStatus.js';

const DAY_MS = 86400000;

function daysBetween(dateStr, nowMs = Date.now()) {
  if (!dateStr) return null;
  const s = String(dateStr).trim();
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(s)
    ? new Date(s + 'T00:00').getTime()
    : new Date(s).getTime();
  if (Number.isNaN(parsed)) return null;
  return Math.floor((nowMs - parsed) / DAY_MS);
}

function daysUntil(dateStr, nowMs = Date.now()) {
  if (!dateStr) return null;
  const s = String(dateStr).trim();
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(s)
    ? new Date(s + 'T00:00').getTime()
    : new Date(s).getTime();
  if (Number.isNaN(parsed)) return null;
  return Math.ceil((parsed - nowMs) / DAY_MS);
}

export function evaluateIssueSla(issue, nowMs = Date.now()) {
  if (!issue || typeof issue !== 'object') {
    return { slaHours: 96, elapsedHours: 0, breached: false, remainingHours: 96 };
  }
  const slaHours = Math.max(1, Number(issue.slaHours) || ISSUE_SLA_HOURS[issue.priority] || 96);
  if (!issue.date) {
    return { slaHours, elapsedHours: 0, breached: false, remainingHours: slaHours };
  }
  const startMs = new Date(String(issue.date) + 'T00:00').getTime();
  if (Number.isNaN(startMs)) {
    return { slaHours, elapsedHours: 0, breached: false, remainingHours: slaHours };
  }
  const isClosed = issue.status === 'محلول' || issue.status === 'مغلق';
  const endMs = isClosed && issue.resolvedDate
    ? new Date(String(issue.resolvedDate) + 'T23:59').getTime()
    : nowMs;
  const elapsedHours = Math.max(0, Math.round((endMs - startMs) / 3600000));
  const breached = elapsedHours > slaHours;
  return {
    slaHours,
    elapsedHours,
    breached,
    isClosed,
    remainingHours: Math.max(0, slaHours - elapsedHours)
  };
}

/**
 * Computes the 3 distinct executive dimensions from all 8 required indicators:
 * 1) customerValue (0-100): commercial footprint, licensed devices/programs, support contract, open deals
 * 2) customerHealth (0-100): relationship & service stability (NOT inflated by high device count!)
 * 3) customerRisk (0-100 + riskLevel): churn & escalation risk with explicit reasons
 */
export function computeCustomerDimensions(client, options = {}) {
  const nowMs = options.nowMs || Date.now();
  if (!client || typeof client !== 'object') {
    return {
      customerValue: 0,
      customerHealth: 0,
      customerRisk: 100,
      riskLevel: 'high',
      riskReasons: ['بيانات العميل غير مكتملة'],
      indicators: {}
    };
  }

  const breakdown = getClientCategoryBreakdown(client);
  const totalPrograms = breakdown.totalPrograms || 0;
  const totalDevices = breakdown.totalDevices || 0;
  const issues = Array.isArray(client.issues) ? client.issues.filter(Boolean) : [];
  const openIssues = issues.filter(i => i.status === 'مفتوح' || i.status === 'قيد المعالجة' || i.status === 'جديد');
  const repeatedIssues = issues.filter(i => (Number(i.repeatCount) || 1) >= 2);
  const structuralRepeated = issues.filter(i => (Number(i.repeatCount) || 1) >= 3);

  // SLA evaluation across issues (both open breaches & active breaches)
  const slaDetails = issues.map(i => ({ issue: i, sla: evaluateIssueSla(i, nowMs) }));
  const slaBreachedAll = slaDetails.filter(x => x.sla.breached);
  const slaBreachedOpen = slaDetails.filter(x => x.sla.breached && !x.sla.isClosed);

  // Customer Satisfaction Ratings (1-5 stars on closed/rated issues)
  const ratedIssues = issues.filter(i => Number(i.customerRating) >= 1 && Number(i.customerRating) <= 5);
  const avgSatisfaction = ratedIssues.length > 0
    ? Number((ratedIssues.reduce((s, i) => s + Number(i.customerRating), 0) / ratedIssues.length).toFixed(1))
    : null;

  // Contact recency & Usage recency
  const daysSinceContact = daysBetween(client.lastContact, nowMs);
  const daysSinceUsage = daysBetween(client.lastProgramUsage, nowMs);

  // Support contract & Renewal date
  const supportStatus = client.supportContractStatus || '';
  const renewalDate = client.renewalDate || client.endDate || '';
  const renewalDaysRemaining = daysUntil(renewalDate, nowMs);

  // Open Deals / Projects
  const openDealsCount = Math.max(0, Number(client.openDealsCount) || 0);
  const openDealsValue = Math.max(0, Number(client.openDealsValue) || 0);

  // ---------------------------------------------------
  // AXIS 1: CUSTOMER VALUE (0 - 100)
  // High commercial footprint, programs, devices, active contracts, open expansion deals
  // ---------------------------------------------------
  const maxRefDevices = Math.max(10, Number(options.maxDevicesRef) || 10);
  const deviceValuePts = Math.min(40, Math.round((totalDevices / maxRefDevices) * 32) + Math.min(8, totalPrograms * 4));
  const contractValuePts = supportStatus === 'ساري' ? 25 : supportStatus === 'قيد التجديد' ? 18 : totalPrograms > 0 ? 10 : 0;
  const dealsValuePts = Math.min(25, openDealsCount * 10 + (openDealsValue >= 100000 ? 15 : openDealsValue > 0 ? 8 : 0));
  const tierStatusPts = isConfirmedClientStatus(client.status) ? 10 : 4;
  const customerValue = Math.min(100, Math.max(0, deviceValuePts + contractValuePts + dealsValuePts + tierStatusPts));

  // ---------------------------------------------------
  // AXIS 2: CUSTOMER HEALTH (0 - 100)
  // Independent of device volume! Measures stability, responsiveness, satisfaction, SLA & contract health
  // ---------------------------------------------------
  // A) Issue & Repetition Stability (30 pts)
  let issueHealth = 30;
  issueHealth -= openIssues.length * 5;
  issueHealth -= repeatedIssues.length * 6;
  issueHealth -= structuralRepeated.length * 5;
  issueHealth = Math.max(0, issueHealth);

  // B) SLA Compliance (20 pts)
  let slaHealth = 20;
  slaHealth -= slaBreachedOpen.length * 9;
  slaHealth -= Math.max(0, slaBreachedAll.length - slaBreachedOpen.length) * 4;
  slaHealth = Math.max(0, slaHealth);

  // C) Customer Satisfaction (20 pts — neutral 14/20 when unrated so new clients aren't penalized harshly, low ratings cut sharply)
  let satisfactionHealth = 14;
  if (avgSatisfaction !== null) {
    satisfactionHealth = Math.round((avgSatisfaction / 5) * 20);
  }

  // D) Contact & Usage Engagement (20 pts when usage provided: 12 contact + 8 usage; otherwise 20 contact)
  let contactPts = 0;
  if (daysSinceContact !== null) {
    contactPts = daysSinceContact <= 7 ? 20
      : daysSinceContact <= 30 ? 15
      : daysSinceContact <= 60 ? 8
      : daysSinceContact <= 90 ? 3
      : 0;
  }
  let engagementHealth = contactPts;
  if (daysSinceUsage !== null) {
    const cScaled = Math.round((contactPts / 20) * 12);
    const uPts = daysSinceUsage <= 7 ? 8
      : daysSinceUsage <= 21 ? 6
      : daysSinceUsage <= 45 ? 3
      : 0;
    engagementHealth = cScaled + uPts;
  }

  // E) Support Contract & Renewal Health (10 pts)
  let contractHealth = 7;
  if (supportStatus === 'ساري') contractHealth = 10;
  else if (supportStatus === 'قيد التجديد') contractHealth = 6;
  else if (supportStatus === 'منتهي') contractHealth = 1;
  else if (supportStatus === 'بدون عقد') contractHealth = 4;

  if (renewalDaysRemaining !== null) {
    if (renewalDaysRemaining < 0) contractHealth = Math.min(contractHealth, 1);
    else if (renewalDaysRemaining <= 15) contractHealth = Math.min(contractHealth, 5);
  }

  let customerHealth = issueHealth + slaHealth + satisfactionHealth + engagementHealth + contractHealth;
  if (client.status === 'متوقف') {
    customerHealth = Math.round(customerHealth * 0.55);
  }
  customerHealth = Math.min(100, Math.max(0, customerHealth));

  // ---------------------------------------------------
  // AXIS 3: CUSTOMER RISK (0 - 100) + Risk Reasons
  // ---------------------------------------------------
  let riskPts = 0;
  const riskReasons = [];

  if (slaBreachedOpen.length > 0) {
    riskPts += Math.min(35, slaBreachedOpen.length * 18);
    riskReasons.push(`${slaBreachedOpen.length} تذكرة مفتوحة تجاوزت مدة SLA`);
  }
  const urgentOpen = openIssues.filter(i => i.priority === 'عاجل' || i.priority === 'عاجلة');
  if (urgentOpen.length > 0) {
    riskPts += Math.min(25, urgentOpen.length * 14);
    riskReasons.push(`${urgentOpen.length} مشكلة عاجلة قيد المعالجة`);
  }
  if (repeatedIssues.length > 0) {
    riskPts += Math.min(25, repeatedIssues.length * 10 + structuralRepeated.length * 6);
    riskReasons.push(`${repeatedIssues.length} مشكلات متكررة تؤثر على الاستقرار`);
  }
  if (avgSatisfaction !== null && avgSatisfaction < 3.5) {
    riskPts += avgSatisfaction <= 2.2 ? 25 : 14;
    riskReasons.push(`تقييم رضا منخفض (${avgSatisfaction} / 5)`);
  }
  if (daysSinceContact !== null && daysSinceContact >= 30 && isConfirmedClientStatus(client.status)) {
    riskPts += daysSinceContact >= 60 ? 20 : 10;
    riskReasons.push(`لا يوجد تواصل منذ ${daysSinceContact} يوم`);
  } else if (!client.lastContact && isConfirmedClientStatus(client.status)) {
    riskPts += 10;
    riskReasons.push('لم يُسجل تاريخ آخر تواصل');
  }
  if (daysSinceUsage !== null && daysSinceUsage >= 30 && isConfirmedClientStatus(client.status)) {
    riskPts += daysSinceUsage >= 60 ? 20 : 12;
    riskReasons.push(`تراجع أو انقطاع في استعمال البرنامج منذ ${daysSinceUsage} يوم`);
  }
  if (supportStatus === 'منتهي') {
    riskPts += 18;
    riskReasons.push('عقد الدعم التقني منتهي');
  } else if (renewalDaysRemaining !== null && renewalDaysRemaining <= 30) {
    riskPts += renewalDaysRemaining < 0 ? 18 : 10;
    riskReasons.push(renewalDaysRemaining < 0 ? 'تأخر في تجديد العقد/الخدمة' : `موعد التجديد قريب (${renewalDaysRemaining} يوم)`);
  }
  if (client.status === 'متوقف') {
    riskPts = Math.max(riskPts + 20, 60);
    riskReasons.push('حساب العميل في حالة توقف');
  }

  const customerRisk = Math.min(100, Math.max(0, riskPts));
  const riskLevel = customerRisk >= 55 ? 'high' : customerRisk >= 28 ? 'medium' : 'low';

  return {
    customerValue,
    customerHealth,
    customerRisk,
    riskLevel,
    riskReasons,
    indicators: {
      lastProgramUsage: client.lastProgramUsage || '',
      daysSinceUsage,
      repeatedIssuesCount: repeatedIssues.length,
      structuralRepeatedCount: structuralRepeated.length,
      slaBreachedCount: slaBreachedAll.length,
      slaBreachedOpenCount: slaBreachedOpen.length,
      avgSatisfaction,
      ratedIssuesCount: ratedIssues.length,
      lastContact: client.lastContact || '',
      daysSinceContact,
      supportContractStatus: supportStatus || 'غير محدد',
      renewalDate,
      renewalDaysRemaining,
      openDealsCount,
      openDealsValue,
      openDealsSummary: client.openDealsSummary || '',
      totalPrograms,
      totalDevices
    }
  };
}
