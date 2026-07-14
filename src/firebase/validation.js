export function validateClient(c) {
  const data = { ...c };
  const validBT = ["تجارة تجزئة", "تجارة جملة", "مطاعم وفنادق", "خدمات ومهن حرة", "إنتاج وصناعة", "أخرى"];
  
  const doc = {
    id: Number(data.id) || Date.now(),
    fullName: (data.fullName || 'بدون اسم').substring(0, 100) || 'بدون اسم',
    phone: (data.phone || '').substring(0, 30),
    company: (data.company || '').substring(0, 100),
    wilaya: (data.wilaya || '').substring(0, 50),
    location: (data.location || '').substring(0, 100),
    businessType: validBT.includes(data.businessType) ? data.businessType : 'أخرى',
    businessField: (data.businessField || '').substring(0, 50),
    status: ["نشط", "محتمل", "متوقف"].includes(data.status) ? data.status : "نشط",
    startDate: (data.startDate || '').substring(0, 20),
    endDate: (data.endDate || '').substring(0, 20),
    lastContact: (data.lastContact || '').substring(0, 20),
    notes: (data.notes || '').substring(0, 1000),
    gps: (data.gps && typeof data.gps === 'object') ? { lat: typeof data.gps.lat === 'number' ? data.gps.lat : null, lng: typeof data.gps.lng === 'number' ? data.gps.lng : null } : { lat: null, lng: null },
    score: typeof data.score === 'number' ? Math.max(0, Math.min(100, Math.round(data.score))) : 100,
    openIssuesCount: Number(data.openIssuesCount) || 0,
    requirementsCount: Number(data.requirementsCount) || 0,
    programsCount: Number(data.programsCount) || 0,
    installationsCount: Number(data.installationsCount) || 0,
    updatedAt: new Date().toISOString()
  };
  return doc;
}

export function validateProgram(p) {
  const objId = Number(p.id) || (Date.now() + Math.floor(Math.random() * 9999));
  return {
    id: objId,
    programName: (p.programName || p.product || 'غير محدد').substring(0, 100) || 'غير محدد',
    platform: ["Desktop", "Mobile", "Web", "Hybrid"].includes(p.platform) ? p.platform : "Desktop",
    type: ["تجاري", "إنتاجي", "لوحة تحكم", "خدمي", "أخرى"].includes(p.type) ? p.type : "أخرى",
    installationsCount: Number(p.installationsCount) || 1,
    startDate: (p.startDate || '').substring(0, 20),
    endDate: (p.endDate || '').substring(0, 20)
  };
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
