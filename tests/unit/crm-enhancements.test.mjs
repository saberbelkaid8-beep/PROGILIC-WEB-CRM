import test from 'node:test';
import assert from 'node:assert/strict';

import {
  syncClientProgramVersion,
  extractProgramFamilyOptions
} from '../../src/business/versionSyncService.js';
import {
  sanitizeAttachmentItem,
  validateAndSanitizeAttachments
} from '../../src/business/attachmentUtils.js';
import {
  buildUnifiedBacklog,
  getRequirementInterestCount
} from '../../src/business/backlogService.js';
import {
  computeTaskAnalytics,
  filterTasks
} from '../../src/business/taskService.js';
import {
  computeCustomerDimensions,
  evaluateIssueSla
} from '../../src/business/customerHealth.js';

test('1. Automatic Software Version Sync updates all matching program records to employee-selected version (e.g. V21 -> V22) without touching other programs', () => {
  const clientPrograms = [
    {
      id: 101,
      programName: 'Desktop - تجاري V21',
      platform: 'Desktop',
      type: 'تجاري (Commercial)',
      version: 'V21',
      installationsCount: 2
    },
    {
      id: 102,
      programName: 'Desktop - تجاري V21 (الفرع 2)',
      platform: 'Desktop',
      type: 'تجاري (Commercial)',
      version: 'V21',
      installationsCount: 2
    },
    {
      id: 201,
      programName: 'Desktop - إنتاجي V21',
      platform: 'Desktop',
      type: 'إنتاجي (Production)',
      version: 'V21',
      installationsCount: 3
    }
  ];

  const families = extractProgramFamilyOptions(clientPrograms);
  const commFamily = families.find(f => f.categoryKey === 'Commercial');
  assert.ok(commFamily, 'Commercial family option must exist');
  assert.equal(commFamily.totalDevices, 4);

  // Employee selects V22 (NOT latest V27!)
  const res = syncClientProgramVersion(clientPrograms, {
    targetFamilyKey: commFamily.familyKey,
    targetVersion: 'V22',
    syncDate: '2026-11-22',
    staffName: 'كريم التقني',
    note: 'ترقية مجدولة لنسخة V22'
  });

  assert.equal(res.affectedRecords, 2);
  assert.equal(res.affectedDevices, 4);
  assert.equal(res.targetVersion, 'V22');

  const comm1 = res.nextPrograms.find(p => p.id === 101);
  const comm2 = res.nextPrograms.find(p => p.id === 102);
  const prod = res.nextPrograms.find(p => p.id === 201);

  assert.equal(comm1.version, 'V22');
  assert.equal(comm2.version, 'V22');
  assert.match(comm1.programName, /V22/);
  assert.doesNotMatch(comm1.programName, /V27/);
  assert.equal(comm1.versionHistory[0].fromVersion, 'V21');
  assert.equal(comm1.versionHistory[0].toVersion, 'V22');
  assert.equal(comm1.versionHistory[0].staffName, 'كريم التقني');

  // Production program remains untouched on V21
  assert.equal(prod.version, 'V21');
  assert.match(prod.programName, /V21/);
});

test('2. Attachment sanitization accepts safe JPEG dataUrl and .log text previews while blocking SVG XSS and oversized payloads', () => {
  const safeImg = sanitizeAttachmentItem({
    id: 'a1',
    name: 'error<script>.png',
    mimeType: 'image/jpeg',
    size: 12000,
    dataUrl: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ=='
  });
  assert.ok(safeImg);
  assert.equal(safeImg.kind, 'image');
  assert.ok(safeImg.dataUrl.startsWith('data:image/jpeg;base64,'));
  assert.doesNotMatch(safeImg.name, /[<>]/);

  const safeLog = sanitizeAttachmentItem({
    id: 'a2',
    name: 'server-trace.log',
    mimeType: 'text/plain',
    size: 512,
    textPreview: '[ERROR] Connection timeout at line 42'
  });
  assert.ok(safeLog);
  assert.equal(safeLog.kind, 'log');
  assert.match(safeLog.textPreview, /Connection timeout/);

  // SVG XSS payload must NOT keep dataUrl
  const svgXss = sanitizeAttachmentItem({
    id: 'a3',
    name: 'payload.svg',
    mimeType: 'image/svg+xml',
    size: 2048,
    dataUrl: 'data:image/svg+xml;base64,PHN2ZyBvbmxvYWQ9ImFsZXJ0KDEpIj48L3N2Zz4='
  });
  assert.equal(svgXss.dataUrl, undefined);

  // Oversized image dataUrl (> 72KB) must be stripped
  const oversized = sanitizeAttachmentItem({
    id: 'a4',
    name: 'huge.png',
    mimeType: 'image/png',
    size: 500000,
    dataUrl: 'data:image/png;base64,' + 'A'.repeat(80000)
  });
  assert.equal(oversized.dataUrl, undefined);

  // validateAndSanitizeAttachments enforces max 5 items
  const list = validateAndSanitizeAttachments([safeImg, safeLog, safeImg, safeLog, safeImg, safeLog]);
  assert.equal(list.length, 5);
});

test('3. Unified Backlog clusters 12 clients requesting the same feature into 1 Backlog card with 12 interested clients', () => {
  const mockClients = Array.from({ length: 12 }, (_, idx) => ({
    id: idx + 1,
    fullName: `عميل رقم ${idx + 1}`,
    company: `مؤسسة ${idx + 1}`,
    wilaya: 'الجزائر',
    requirements: [
      {
        id: 500 + idx,
        title: idx % 2 === 0 ? 'تصدير فواتير XML للضرائب' : 'تصدير فواتير XML للضرائب ',
        priority: 'عالية',
        status: 'مقترح',
        type: 'ميزة جديدة',
        impact: 'عالي',
        assignedStaffName: 'ياسين المحلل'
      }
    ]
  }));

  const unified = buildUnifiedBacklog(mockClients, []);
  assert.equal(unified.totalBacklogItems, 1);
  assert.equal(unified.repeatedClusters.length, 1);
  assert.equal(unified.items[0].interestedClientsCount, 12);
  assert.equal(unified.items[0].interestedClients.length, 12);

  const countFromSingleReq = getRequirementInterestCount(mockClients[0].requirements[0], mockClients);
  assert.equal(countFromSingleReq, 12);
});

test('4. Task Analytics and filterTasks accurately track today, overdue, awaiting client, completed, department & employee stats', () => {
  const today = '2026-11-22';
  const staff = [
    { id: 'emp1', fullName: 'أحمد التجاري', department: 'commercial', status: 'نشط' },
    { id: 'emp2', fullName: 'سارة المتابعة', department: 'suivi', status: 'نشط' }
  ];
  const tasks = [
    { id: 't1', title: 'إرسال عرض سعر', assignedStaffId: 'emp1', assignedStaffName: 'أحمد التجاري', department: 'commercial', dueDate: '2026-11-22', status: 'مفتوحة', clientName: 'شركة ألف' },
    { id: 't2', title: 'متابعة تجديد متأخرة', assignedStaffId: 'emp2', assignedStaffName: 'سارة المتابعة', department: 'suivi', dueDate: '2026-11-18', status: 'قيد التنفيذ', clientName: 'شركة باء' },
    { id: 't3', title: 'انتظار موافقة العميل', assignedStaffId: 'emp2', assignedStaffName: 'سارة المتابعة', department: 'suivi', dueDate: '2026-11-25', status: 'بانتظار العميل', clientName: 'شركة جيم' },
    { id: 't4', title: 'إغلاق ترقية V22', assignedStaffId: 'emp1', assignedStaffName: 'أحمد التجاري', department: 'commercial', dueDate: '2026-11-20', status: 'مكتملة', resultNote: 'تم التوقيع وتفعيل الترقية', clientName: 'شركة دال' }
  ];

  const analytics = computeTaskAnalytics(tasks, staff, today);
  assert.equal(analytics.counts.dueToday, 1);
  assert.equal(analytics.counts.overdue, 1);
  assert.equal(analytics.counts.awaitingClient, 1);
  assert.equal(analytics.counts.completed, 1);

  const commDept = analytics.byDepartment.find(d => d.deptId === 'commercial');
  assert.equal(commDept.completionRate, 50);
  assert.equal(commDept.recentResults[0].resultNote, 'تم التوقيع وتفعيل الترقية');

  const emp2 = analytics.byEmployee.find(e => e.staffId === 'emp2');
  assert.equal(emp2.overdue, 1);
  assert.equal(emp2.awaitingClient, 1);

  assert.equal(filterTasks(tasks, { bucket: 'today', todayYmd: today }).length, 1);
  assert.equal(filterTasks(tasks, { bucket: 'overdue', todayYmd: today }).length, 1);
  assert.equal(filterTasks(tasks, { bucket: 'awaiting_client', todayYmd: today }).length, 1);
  assert.equal(filterTasks(tasks, { bucket: 'completed', staffId: 'emp1', todayYmd: today }).length, 1);
});

test('5. 3-Axis Customer Health separates high Customer Value from low Customer Health & high Customer Risk', () => {
  const nowMs = new Date('2026-11-22T12:00:00Z').getTime();

  // Client with 20 devices + open deals (high commercial value),
  // BUT repeated issues, breached SLA, low 2-star satisfaction, expired support contract, stale usage/contact!
  const highValueRiskyClient = {
    id: 99,
    fullName: 'مجمع الشرق الصناعي',
    status: 'نشط',
    lastContact: '2026-08-10',
    lastProgramUsage: '2026-08-15',
    supportContractStatus: 'منتهي',
    renewalDate: '2026-11-01',
    openDealsCount: 2,
    openDealsValue: 250000,
    programs: [
      { id: 1, platform: 'Desktop', type: 'تجاري (Commercial)', version: 'V22', installationsCount: 20 }
    ],
    issues: [
      { id: 10, title: 'عطل فواتير متكرر', priority: 'عاجل', status: 'مفتوح', date: '2026-11-10', slaHours: 24, repeatCount: 3 },
      { id: 11, title: 'بطء الشبكة', priority: 'عالية', status: 'محلول', date: '2026-10-01', resolvedDate: '2026-10-15', slaHours: 48, repeatCount: 2, customerRating: 2 }
    ]
  };

  const slaCheck = evaluateIssueSla(highValueRiskyClient.issues[0], nowMs);
  assert.equal(slaCheck.breached, true);

  const dim = computeCustomerDimensions(highValueRiskyClient, { nowMs });
  assert.ok(dim.customerValue >= 70, `Expected high customerValue (>=70), got ${dim.customerValue}`);
  assert.ok(dim.customerHealth <= 45, `Expected low customerHealth (<=45), got ${dim.customerHealth}`);
  assert.ok(dim.customerRisk >= 65, `Expected high customerRisk (>=65), got ${dim.customerRisk}`);
  assert.equal(dim.riskLevel, 'high');
  assert.ok(dim.riskReasons.length >= 4);
});
