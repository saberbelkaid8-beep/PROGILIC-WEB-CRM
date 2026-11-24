export function validateClient(c) {
  const data = { ...c };
  const validBT = [
    "تجارة تجزئة", "تجارة جملة", "منتوجات التغليف والتعليب والحلويات", "مطاعم وفنادق",
    "خدمات ومهن حرة", "شركة خدمات", "إنتاج وصناعة", "صناعة / تصنيع",
    "صحة وصيدلة", "تعليم وتكوين", "بناء وعقارات", "نقل ولوجستيك",
    "زراعة وأغذية", "تقنية ومعلوماتية", "مالية وتأمين", "أخرى"
  ];

  const rawPrograms = Array.isArray(data.programs) ? data.programs.filter(Boolean).map(validateProgram) : [];
  const rawIssues = Array.isArray(data.issues) ? data.issues.filter(Boolean) : [];
  const rawReqs = Array.isArray(data.requirements) ? data.requirements.filter(Boolean) : [];
  const rawContacts = Array.isArray(data.contactHistory) ? data.contactHistory.filter(Boolean) : [];

  const openIssues = rawIssues.filter(i => i.status === 'مفتوح' || i.status === 'قيد المعالجة' || i.status === 'جديد');
  const defaultIssuesByPriority = {
    عاجل: openIssues.filter(i => i.priority === 'عاجل' || i.priority === 'عاجلة').length,
    عالية: openIssues.filter(i => i.priority === 'عالية').length,
    متوسطة: openIssues.filter(i => i.priority === 'متوسطة').length,
    منخفضة: openIssues.filter(i => i.priority === 'منخفضة' || !i.priority).length
  };
  const issuesByPriority = (data.issuesByPriority && typeof data.issuesByPriority === 'object')
    ? {
        عاجل: Number(data.issuesByPriority['عاجل'] || 0),
        عالية: Number(data.issuesByPriority['عالية'] || 0),
        متوسطة: Number(data.issuesByPriority['متوسطة'] || 0),
        منخفضة: Number(data.issuesByPriority['منخفضة'] || 0)
      }
    : defaultIssuesByPriority;

  const defaultReqsByStatus = {
    مقترح: rawReqs.filter(r => r.status === 'مقترح' || !r.status).length,
    'قيد الدراسة': rawReqs.filter(r => r.status === 'قيد الدراسة').length,
    مخطط: rawReqs.filter(r => r.status === 'مخطط').length,
    منفذ: rawReqs.filter(r => r.status === 'منفذ').length
  };
  const reqsByStatus = (data.reqsByStatus && typeof data.reqsByStatus === 'object')
    ? {
        مقترح: Number(data.reqsByStatus['مقترح'] || 0),
        'قيد الدراسة': Number(data.reqsByStatus['قيد الدراسة'] || 0),
        مخطط: Number(data.reqsByStatus['مخطط'] || 0),
        منفذ: Number(data.reqsByStatus['منفذ'] || 0)
      }
    : defaultReqsByStatus;

  const programNames = Array.isArray(data.programNames)
    ? data.programNames.filter(Boolean).map(n => String(n).substring(0, 100))
    : rawPrograms.map(p => p.programName).filter(Boolean);

  const programsCount = data.programsCount !== undefined ? Number(data.programsCount) || 0 : rawPrograms.length;
  const installationsCount = data.installationsCount !== undefined
    ? Number(data.installationsCount) || 0
    : rawPrograms.reduce((acc, p) => acc + (Number(p.installationsCount) || 1), 0);
  const openIssuesCount = data.openIssuesCount !== undefined ? Number(data.openIssuesCount) || 0 : openIssues.length;
  const urgentIssuesCount = data.urgentIssuesCount !== undefined
    ? Number(data.urgentIssuesCount) || 0
    : (issuesByPriority['عاجل'] || 0) + (issuesByPriority['عالية'] || 0);
  const solvedIssuesCount = data.solvedIssuesCount !== undefined
    ? Number(data.solvedIssuesCount) || 0
    : rawIssues.filter(i => i.status === 'محلول' || i.status === 'مغلق').length;
  const requirementsCount = data.requirementsCount !== undefined ? Number(data.requirementsCount) || 0 : rawReqs.length;
  const contactsCount = data.contactsCount !== undefined ? Number(data.contactsCount) || 0 : rawContacts.length;

  const rawVersionHistory = Array.isArray(data.versionHistory)
    ? data.versionHistory
        .filter(h => h && typeof h === 'object')
        .slice(0, 100)
        .map(h => ({
          id: String(h.id || `vh_${Date.now()}`).substring(0, 80),
          programKey: String(h.programKey || '').substring(0, 100),
          programLabel: String(h.programLabel || '').substring(0, 120),
          platform: String(h.platform || '').substring(0, 30),
          previousVersion: String(h.previousVersion || '').substring(0, 50),
          previousVersions: Array.isArray(h.previousVersions) ? h.previousVersions.map(v => String(v).substring(0, 30)).slice(0, 20) : [],
          newVersion: String(h.newVersion || '').substring(0, 30),
          updateDate: String(h.updateDate || '').substring(0, 20),
          updatedAt: String(h.updatedAt || '').substring(0, 40),
          employeeName: String(h.employeeName || '').substring(0, 100),
          employeeId: String(h.employeeId || '').substring(0, 80),
          affectedDevices: Math.max(0, Number(h.affectedDevices) || 0),
          affectedProgramsCount: Math.max(0, Number(h.affectedProgramsCount) || 0),
          programIds: Array.isArray(h.programIds) ? h.programIds.slice(0, 100) : [],
          note: String(h.note || '').substring(0, 500)
        }))
    : [];

  const doc = {
    id: Number(data.id) || Date.now(),
    version: Math.max(1, Number(data.version) || 1),
    fullName: (data.fullName || 'بدون اسم').substring(0, 100) || 'بدون اسم',
    phone: (data.phone || '').substring(0, 30),
    gmailAccount: (data.gmailAccount || '').substring(0, 254),
    company: (data.company || '').substring(0, 100),
    wilaya: (data.wilaya || '').substring(0, 50),
    commune: (data.commune || '').substring(0, 50),
    location: (data.location || '').substring(0, 100),
    businessType: validBT.includes(data.businessType) ? data.businessType : (data.businessType ? String(data.businessType).substring(0, 50) : 'أخرى'),
    businessField: (data.businessField || '').substring(0, 50),
    status: ["نشط", "محتمل", "متوقف"].includes(data.status) ? data.status : "نشط",
    startDate: (data.startDate || '').substring(0, 20),
    endDate: (data.endDate || '').substring(0, 20),
    lastContact: (data.lastContact || '').substring(0, 20),
    notes: (data.notes || '').substring(0, 1000),
    gps: (data.gps && typeof data.gps === 'object') ? { lat: typeof data.gps.lat === 'number' ? data.gps.lat : null, lng: typeof data.gps.lng === 'number' ? data.gps.lng : null } : { lat: null, lng: null },
    score: typeof data.score === 'number' ? Math.max(0, Math.min(100, Math.round(data.score))) : 100,
    openIssuesCount,
    urgentIssuesCount,
    solvedIssuesCount,
    issuesByPriority,
    requirementsCount,
    reqsByStatus,
    programsCount,
    installationsCount,
    contactsCount,
    programNames,
    programs: rawPrograms,
    versionHistory: rawVersionHistory,
    updatedAt: data.updatedAt ? String(data.updatedAt) : new Date().toISOString()
  };
  if (data.programsPurgedAt) {
    doc.programsPurgedAt = String(data.programsPurgedAt).substring(0, 40);
  }
  return doc;
}

export function validateProgram(p) {
  const objId = Number(p.id) || (Date.now() + Math.floor(Math.random() * 9999));
  const allowedVersions = [
    "V27", "V26", "V25", "V24", "V23", "V22", "V21", "v18", "v16", "v15", "R+", "arabe",
    "V18", "V16", "V15", "r+", "Arabe"
  ];
  const rawVer = String(p.version || '').trim();
  const normalizedVer = allowedVersions.includes(rawVer) ? rawVer : rawVer.substring(0, 20);
  return {
    id: objId,
    versionNum: Math.max(1, Number(p.versionNum) || 1),
    programName: (p.programName || p.product || 'غير محدد').substring(0, 100) || 'غير محدد',
    platform: ["Desktop", "Mobile", "Web", "Hybrid"].includes(p.platform) ? p.platform : "Desktop",
    type: String(p.type || "أخرى").substring(0, 100),
    version: normalizedVer,
    installationsCount: Math.max(1, Number(p.installationsCount) || 1),
    startDate: (p.startDate || '').substring(0, 20),
    endDate: (p.endDate || '').substring(0, 20)
  };
}

export function validateIssue(i) {
  const objId = Number(i.id) || (Date.now() + Math.floor(Math.random() * 9999));
  const out = {
    id: objId,
    version: Math.max(1, Number(i.version) || 1),
    title: (i.title || 'بدون عنوان').substring(0, 200) || 'بدون عنوان',
    type: ["خطأ تقني", "أداء", "استفسار", "طلب ميزة", "خطأ مستخدم", "أخرى"].includes(i.type) ? i.type : "أخرى",
    priority: ["عاجل", "عاجلة", "عالية", "متوسطة", "منخفضة"].includes(i.priority) ? (i.priority === 'عاجلة' ? 'عاجل' : i.priority) : "متوسطة",
    status: ["مفتوح", "جديد", "قيد المعالجة", "محلول", "مغلق"].includes(i.status) ? i.status : "مفتوح",
    repeatCount: Number(i.repeatCount) || 1,
    featureOpp: Boolean(i.featureOpp),
    source: ["نظام", "عميل", "سوء استخدام", "شبكة", "غير محدد"].includes(i.source) ? i.source : "غير محدد",
    confidence: typeof i.confidence === 'number' ? i.confidence : 50,
    date: (i.date || '').substring(0, 20),
    notes: (i.notes || '').substring(0, 1000),
    solution: (i.solution || '').substring(0, 1000)
  };
  if (i.resolvedDate) {
    out.resolvedDate = String(i.resolvedDate).substring(0, 20);
  }
  return out;
}

export function validateRequirement(r) {
  const objId = Number(r.id) || (Date.now() + Math.floor(Math.random() * 9999));
  return {
    id: objId,
    version: Math.max(1, Number(r.version) || 1),
    title: (r.title || 'بدون عنوان').substring(0, 200) || 'بدون عنوان',
    priority: ["عاجل", "عالية", "متوسطة", "منخفضة"].includes(r.priority) ? r.priority : "متوسطة",
    status: ["مقترح", "قيد الدراسة", "مخطط", "منفذ", "مرفوض"].includes(r.status) ? r.status : "مقترح",
    impact: ["عالي", "متوسط", "منخفض"].includes(r.impact) ? r.impact : "متوسط",
    type: (r.type || '').substring(0, 100),
    date: (r.date || '').substring(0, 20),
    notes: (r.notes || '').substring(0, 1000)
  };
}

export function validateContact(ch) {
  const objId = Number(ch.id) || (Date.now() + Math.floor(Math.random() * 9999));
  return {
    id: objId,
    version: Math.max(1, Number(ch.version) || 1),
    note: (ch.note || 'تواصل بدون ملاحظة').substring(0, 2000) || 'تواصل بدون ملاحظة',
    date: (ch.date || new Date().toISOString().split('T')[0]).substring(0, 20)
  };
}

export function validateBackup(backup, uid) {
  if (!backup || typeof backup !== 'object' || !Array.isArray(backup.clients)) {
    throw new Error('بنية النسخة الاحتياطية غير صالحة أو لا تحتوي على قائمة عملاء.');
  }
  const normalizedClients = backup.clients.filter(Boolean).map((c) => {
    const base = validateClient(c);
    base.programs = Array.isArray(c.programs) ? c.programs.filter(Boolean).map(validateProgram) : [];
    base.issues = Array.isArray(c.issues) ? c.issues.filter(Boolean).map(validateIssue) : [];
    base.requirements = Array.isArray(c.requirements) ? c.requirements.filter(Boolean).map(validateRequirement) : [];
    base.contactHistory = Array.isArray(c.contactHistory) ? c.contactHistory.filter(Boolean).map(validateContact) : [];
    return base;
  });
  return {
    id: String(backup.id || `backup_${Date.now()}`).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128),
    uid: String(uid || backup.uid || ''),
    timestamp: String(backup.timestamp || new Date().toISOString()),
    reason: String(backup.reason || 'نسخة احتياطية سحابية').slice(0, 120),
    clientCount: normalizedClients.length,
    nid: Number(backup.nid) || 100,
    stats: (backup.stats && typeof backup.stats === 'object') ? { ...backup.stats } : null,
    clients: normalizedClients
  };
}
