export function validateClient(c) {
  if (!c || typeof c !== 'object' || Array.isArray(c)) {
    throw new TypeError('Client data must be an object.');
  }
  if (!Number.isSafeInteger(c.id)) {
    throw new TypeError('Client ID is missing or invalid; it cannot be synthesized during migration.');
  }
  if (typeof c.fullName !== 'string' || !c.fullName.trim()) {
    throw new TypeError('Client name is missing; the record requires manual review.');
  }
  if (!['نشط', 'محتمل', 'متوقف'].includes(c.status)) {
    throw new TypeError('Client status is missing or invalid; it cannot be assumed during migration.');
  }
  for (const field of ['openIssuesCount', 'requirementsCount', 'programsCount', 'installationsCount']) {
    if (Object.hasOwn(c, field) && (typeof c[field] !== 'number' || !Number.isFinite(c[field]))) {
      throw new TypeError(`Client ${field} is invalid; it cannot be coerced during migration.`);
    }
  }

  const allowedFields = [
    'id', 'fullName', 'status', 'phone', 'gmailAccount', 'company', 'wilaya', 'commune',
    'location', 'businessType', 'businessField', 'startDate', 'endDate', 'lastContact',
    'notes', 'gps', 'score', 'openIssuesCount', 'requirementsCount', 'programsCount',
    'installationsCount', 'updatedAt', '_subcollectionsLoaded', 'version', 'programNames',
    'firestoreId', 'category', 'registrationChannel', 'deviceType', 'creatorRole', 'creatorEmail'
  ];
  const doc = Object.fromEntries(allowedFields
    .filter(field => Object.hasOwn(c, field))
    .map(field => [field, c[field]]));
  return doc;
}

export function validateProgram(p) {
  if (!p || typeof p !== 'object' || Array.isArray(p)) {
    throw new TypeError('Program data must be an object.');
  }
  if (!Number.isSafeInteger(p.id)) {
    throw new TypeError('Program ID is missing or invalid; it cannot be synthesized during migration.');
  }
  if (typeof p.programName !== 'string' || !p.programName.trim()) {
    throw new TypeError('Program name is missing; the record requires manual review.');
  }
  if (!['Desktop', 'Mobile', 'Web', 'Hybrid'].includes(p.platform)) {
    throw new TypeError('Program platform is missing or invalid; the record requires manual review.');
  }
  if (typeof p.type !== 'string' || !p.type.trim()) {
    throw new TypeError('Program type is missing; the record requires manual review.');
  }
  const allowedFields = [
    'id', 'programName', 'platform', 'type', 'version', 'installationsCount',
    'startDate', 'endDate', 'clientId', 'notes', 'createdAt', 'updatedAt'
  ];
  if (Object.keys(p).some(field => !allowedFields.includes(field))) {
    throw new TypeError('Program contains unsupported fields; the record requires manual review.');
  }
  if (p.programName.length > 200 || p.type.length > 100) {
    throw new TypeError('Program name or type exceeds the database schema limit.');
  }
  if (Object.hasOwn(p, 'version') && (typeof p.version !== 'string' || p.version.length > 50)) {
    throw new TypeError('Program version is invalid; it cannot be normalized during migration.');
  }
  if (Object.hasOwn(p, 'installationsCount') && (!Number.isSafeInteger(p.installationsCount) || p.installationsCount < 0)) {
    throw new TypeError('Program installation count is invalid; it cannot be coerced during migration.');
  }
  for (const field of ['startDate', 'endDate']) {
    if (Object.hasOwn(p, field) && (typeof p[field] !== 'string' || p[field].length > 20)) {
      throw new TypeError(`Program ${field} is invalid; it cannot be normalized during migration.`);
    }
  }
  return { ...p };
}

export function validateIssue(i) {
  const objId = Number(i.id) || (Date.now() + Math.floor(Math.random() * 9999));
  return {
    id: objId,
    title: (i.title || 'بدون عنوان').substring(0, 200) || 'بدون عنوان',
    type: ["خطأ تقني", "أداء", "استفسار", "طلب ميزة", "خطأ مستخدم", "أخرى"].includes(i.type) ? i.type : "أخرى",
    priority: ["عاجل", "عالية", "متوسطة", "منخفضة"].includes(i.priority) ? i.priority : "متوسطة",
    status: ["مفتوح", "قيد المعالجة", "محلول", "مغلق"].includes(i.status) ? i.status : "مفتوح",
    repeatCount: Number(i.repeatCount) || 1,
    featureOpp: Boolean(i.featureOpp),
    source: ["نظام", "عميل", "سوء استخدام", "شبكة", "غير محدد"].includes(i.source) ? i.source : "غير محدد",
    confidence: typeof i.confidence === 'number' ? i.confidence : 50,
    date: (i.date || '').substring(0, 20),
    notes: (i.notes || '').substring(0, 1000),
    solution: (i.solution || '').substring(0, 1000)
  };
}

export function validateRequirement(r) {
  const objId = Number(r.id) || (Date.now() + Math.floor(Math.random() * 9999));
  return {
    id: objId,
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
    note: (ch.note || 'تواصل بدون ملاحظة').substring(0, 2000) || 'تواصل بدون ملاحظة',
    date: (ch.date || new Date().toISOString().split('T')[0]).substring(0, 20)
  };
}
