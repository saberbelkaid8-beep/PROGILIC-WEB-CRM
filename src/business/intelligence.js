import { clients } from '../state/store.js';
import { getProgramStats } from '../utils/index.js';

let lastClientsRef = null;
let cachedMaxProgs = 1;
let cachedMaxInsts = 1;
let scoreCache = new WeakMap();
let riskCache = new WeakMap();
let noteCache = new WeakMap();

function checkCacheValidity() {
  if (clients !== lastClientsRef) {
    lastClientsRef = clients;
    cachedMaxProgs = Math.max(...clients.map(x => getProgramStats(x).total), 1);
    cachedMaxInsts = Math.max(...clients.map(x => getProgramStats(x).totalInstalls), 1);
    scoreCache = new WeakMap();
    riskCache = new WeakMap();
    noteCache = new WeakMap();
  }
}

export function scoreColor(s){if(s>=75)return'#10B981';if(s>=50)return'#F59E0B';if(s>=25)return'#F97316';return'#EF4444'}
export function scoreLabel(s){if(s>=75)return'عميل متميز';if(s>=50)return'عميل جيد';if(s>=25)return'يحتاج متابعة';return'خطر عالي'}
export function riskColor(l){return l==='high'?'var(--r)':l==='medium'?'var(--w)':'var(--g)'}
export function riskLabel(l){return l==='high'?'خطر عالي':l==='medium'?'تحت المراقبة':'وضع مستقر'}
export function riskBdg(l){return l==='high'?'bdg-r':l==='medium'?'bdg-y':'bdg-g'}

export function computeScore(c){
  checkCacheValidity();
  if (scoreCache.has(c)) {
    return scoreCache.get(c);
  }
  if (!c._subcollectionsLoaded && c.score !== undefined) {
    const res = { total: c.score, prog: 0, act: 0, iss: 0, req: 0 };
    scoreCache.set(c, res);
    return res;
  }
  const ps=getProgramStats(c);
  const maxProgs=cachedMaxProgs;
  const maxInst=cachedMaxInsts;
  const progScore=Math.min(35,Math.round((ps.active/maxProgs)*20+(ps.totalInstalls/maxInst)*15));
  let actScore=0;
  if(c.lastContact){
    const d=Math.floor((Date.now()-new Date(c.lastContact+'T00:00').getTime())/86400000);
    actScore=d<7?25:d<30?18:d<60?10:d<90?4:0;
  }
  const openCnt=(c.issues||[]).filter(i=>i.status==='مفتوح'||i.status==='قيد المعالجة').length;
  const urgCnt=(c.issues||[]).filter(i=>i.priority==='عاجل'&&i.status!=='محلول'&&i.status!=='مغلق').length;
  const repCnt=(c.issues||[]).filter(i=>i.repeatCount>=3).length;
  const issScore=Math.max(0,25-(openCnt*4)-(urgCnt*7)-(repCnt*3));
  const hiReqs=(c.requirements||[]).filter(r=>r.impact==='عالي'&&r.status!=='مرفوض').length;
  const reqScore=Math.min(15,hiReqs*5);
  let total=progScore+actScore+issScore+reqScore;
  if(c.status==='متوقف')total=Math.round(total*0.6);
  const res = {total:Math.min(100,Math.max(0,total)),prog:progScore,act:actScore,iss:issScore,req:reqScore};
  scoreCache.set(c, res);
  return res;
}

export function analyzeRootCause(iss){
  const causes=[];
  if(iss.source==='نظام'){
    if(iss.type==='أداء')causes.push('احتمال وجود استعلام قاعدة بيانات غير محسّن أو عملية ثقيلة في الخلفية');
    else if(iss.type==='خطأ تقني')causes.push('خلل في منطق التطبيق أو تعارض بين وحدات برمجية');
    else causes.push('خلل داخلي في النظام يستدعي مراجعة الكود');
    if(iss.repeatCount>=3)causes.push('التكرار المتعدد يؤكد أن الحل السابق لم يعالج الجذر');
    if(iss.repeatCount>=5)causes.push('🔴 تحذير: تكرار عالٍ جداً — هذا خلل بنيوي');
  }else if(iss.source==='سوء استخدام'){
    causes.push('المستخدم لم يفهم طريقة عمل الميزة بشكل صحيح');
    causes.push('الحل: جلسة تدريب مخصصة أو دليل مبسط مع لقطات شاشة');
  }else if(iss.source==='شبكة'){
    causes.push('ضعف أو انقطاع الاتصال بالإنترنت في بيئة العميل');
    causes.push('الحل المقترح: وضع عمل offline أو تنبيه ذكي عند انقطاع الاتصال');
  }else if(iss.source==='عميل'){
    causes.push('مشكلة في بيئة العميل (جهاز قديم، نظام تشغيل، إعدادات محلية)');
    causes.push('تحقق من مواصفات الجهاز ومتصفح الويب المستخدم');
  }else{
    causes.push('المصدر غير محدد — يحتاج تحقيقاً أعمق مع العميل');
  }
  if(iss.confidence<40)causes.push(`⚠ درجة الثقة في التشخيص منخفضة جداً (${iss.confidence}%) — يستوجب إعادة الفحص`);
  if(iss.featureOpp)causes.push('💡 هذه المشكلة تكشف حاجة حقيقية قابلة للتحويل لميزة منتج');
  return causes;
}

export function detectCrossClientIssues(){
  const byType={};
  clients.forEach(c=>{
    (c.issues||[]).forEach(iss=>{
      const k=iss.type;
      if(!byType[k])byType[k]={type:k,count:0,clientNames:[],items:[]};
      if(!byType[k].clientNames.includes(c.fullName))byType[k].clientNames.push(c.fullName);
      byType[k].count++;
      byType[k].items.push({title:iss.title,client:c.fullName,priority:iss.priority,source:iss.source});
    });
  });
  return Object.values(byType).filter(x=>x.clientNames.length>=2).sort((a,b)=>b.count-a.count);
}

export function computeRiskProfile(c){
  checkCacheValidity();
  if (riskCache.has(c)) {
    return riskCache.get(c);
  }
  const risks=[];let level='low';
  const openUrgent=(c.issues||[]).filter(i=>i.priority==='عاجل'&&(i.status==='مفتوح'||i.status==='قيد المعالجة'));
  if(openUrgent.length>0){risks.push(`${openUrgent.length} مشكلة عاجلة لم تُحل بعد`);level='high';}
  const sc=computeScore(c);
  if(sc.total<25){risks.push('نقاط العميل أقل من 25 — خطر إلغاء العقد');if(level!=='high')level='high';}
  else if(sc.total<50){risks.push('نقاط العميل دون المتوسط');if(level==='low')level='medium';}
  if(c.endDate){
    const dl=Math.floor((new Date(c.endDate+'T00:00').getTime()-Date.now())/86400000);
    if(dl>=0&&dl<=7){risks.push(`العقد ينتهي خلال ${dl} يوم — عاجل`);level='high';}
    else if(dl>=0&&dl<=30){risks.push(`العقد ينتهي خلال ${dl} يوم`);if(level==='low')level='medium';}
    else if(dl<0&&c.status==='نشط'){risks.push('العقد انتهى ولم يتم تجديده');level='high';}
  }
  if(c.lastContact){
    const ds=Math.floor((Date.now()-new Date(c.lastContact+'T00:00').getTime())/86400000);
    if(ds>=60&&c.status==='نشط'){risks.push(`لا تواصل منذ ${ds} يوم`);if(level==='low')level='medium';}
    else if(ds>=90){risks.push(`لا تواصل منذ ${ds} يوم — خطر عالٍ`);if(level!=='high')level='high';}
  }
  if(c.status==='متوقف'){risks.push('العميل في حالة توقف');if(level==='low')level='medium';}
  const repeated=(c.issues||[]).filter(i=>i.repeatCount>=3);
  if(repeated.length>=2){risks.push(`${repeated.length} مشاكل متكررة — انعدام الثقة محتمل`);if(level==='low')level='medium';}
  const res = {level,risks,score:sc.total};
  riskCache.set(c, res);
  return res;
}

export function computeGlobalStats(){
  const totalProgsGlobal=clients.reduce((s,c)=>s+(c.programs||[]).length,0);
  const totalInstGlobal=clients.reduce((s,c)=>s+(c.programs||[]).reduce((a,p)=>a+(Number(p.installationsCount)||1),0),0);
  const allIssues=clients.flatMap(c=>(c.issues||[]).map(i=>({...i,clientName:c.fullName,clientId:c.id})));
  const allReqs=clients.flatMap(c=>(c.requirements||[]).map(r=>({...r,clientName:c.fullName,clientId:c.id})));
  const openIssues=allIssues.filter(i=>i.status==='مفتوح'||i.status==='قيد المعالجة');
  const featureOpps=allIssues.filter(i=>i.featureOpp);
  const highRiskClients=clients.filter(c=>computeRiskProfile(c).level==='high');
  const crossIssues=detectCrossClientIssues();
  const avgScore=clients.length?Math.round(clients.reduce((s,c)=>s+computeScore(c).total,0)/clients.length):0;
  const impactW={عالي:3,متوسط:2,منخفض:1};const prioW={عاجل:4,عالية:3,متوسطة:2,منخفضة:1};
  const topReqs=[...allReqs].filter(r=>r.status!=='مرفوض').sort((a,b)=>
    ((impactW[b.impact]||1)+(prioW[b.priority]||1))-((impactW[a.impact]||1)+(prioW[a.priority]||1))).slice(0,5);
  return{totalProgsGlobal,totalInstGlobal,openIssues,featureOpps,highRiskClients,crossIssues,avgScore,topReqs,allReqs,allIssues};
}

export function computeAlerts(){
  const alerts=[];const now=Date.now();const DAY=86400000;
  clients.forEach(c=>{
    if(c.endDate&&c.status==='نشط'){
      const dl=Math.floor((new Date(c.endDate+'T00:00').getTime()-now)/DAY);
      if(dl>=0&&dl<=30)alerts.push({type:'CONTRACT_EXPIRING',cid:c.id,
        msg:`عقد ${c.fullName} ينتهي خلال ${dl} يوم`,
        sub:c.company+' — '+c.wilaya,level:dl<=7?'urgent':'warning',icon:'📄'});
      else if(dl<0&&c.status==='نشط')alerts.push({type:'CONTRACT_EXPIRED',cid:c.id,
        msg:`عقد ${c.fullName} انتهى منذ ${Math.abs(dl)} يوم`,
        sub:'يحتاج تجديد فوري',level:'urgent',icon:'🔴'});
    }
    if(c.status==='نشط'&&c.lastContact){
      const ds=Math.floor((now-new Date(c.lastContact+'T00:00').getTime())/DAY);
      if(ds>=60)alerts.push({type:'NO_CONTACT',cid:c.id,
        msg:`لم يتم التواصل مع ${c.fullName} منذ ${ds} يوم`,
        sub:c.company,level:'urgent',icon:'📞'});
      else if(ds>=30)alerts.push({type:'NO_CONTACT',cid:c.id,
        msg:`لم يتم التواصل مع ${c.fullName} منذ ${ds} يوم`,
        sub:c.company,level:'info',icon:'📞'});
    }
    (c.issues||[]).filter(i=>i.priority==='عاجل'&&(i.status==='مفتوح'||i.status==='قيد المعالجة')).forEach(iss=>{
      alerts.push({type:'URGENT_ISSUE',cid:c.id,
        msg:`مشكلة عاجلة: ${iss.title}`,
        sub:c.fullName+' — '+c.wilaya,level:'urgent',icon:'🚨'});
    });
    const rp=computeRiskProfile(c);
    if(rp.level==='high'&&c.status!=='متوقف'){
      const existsAlready=alerts.some(a=>a.cid===c.id&&a.type==='HIGH_RISK');
      if(!existsAlready)alerts.push({type:'HIGH_RISK',cid:c.id,
        msg:`${c.fullName} — عميل في وضع خطر`,
        sub:rp.risks[0]||'',level:'urgent',icon:'⚠️'});
    }
  });
  return alerts.sort((a,b)=>a.level==='urgent'&&b.level!=='urgent'?-1:b.level==='urgent'&&a.level!=='urgent'?1:0);
}

export function calcAutoConf(source,type,repeatCount,title){
  let base=50;const t=(title||'').toLowerCase();
  if(source==='نظام'){base=(type==='خطأ تقني'||type==='أداء')?72:58;if(repeatCount>=3)base=Math.min(95,base+18);if(repeatCount>=5)base=Math.min(98,base+8);}
  else if(source==='سوء استخدام'){base=type==='خطأ مستخدم'?82:55;}
  else if(source==='شبكة'){base=(t.includes('اتصال')||t.includes('شبكة')||t.includes('بطيء')||t.includes('إنترنت'))?80:62;}
  else if(source==='عميل'){base=62;}
  return Math.min(100,base);
}

export function autoDetectFeatureOpp(issues){
  if (!issues || !Array.isArray(issues)) return;
  issues.forEach(i=>{
    if(i.repeatCount>=3&&i.source!=='سوء استخدام')i.featureOpp=true;
    if(i.source==='عميل'&&i.priority==='عالية'&&i.repeatCount>=2)i.featureOpp=true;
  });
}

export function generateAutoNote(c){
  checkCacheValidity();
  if (noteCache.has(c)) {
    return noteCache.get(c);
  }
  const hist = (c.contactHistory||[]);
  const issues = c.issues||[];
  const reqs = c.requirements||[];
  const progs = c.programs||[];
  const today = new Date(); today.setHours(0,0,0,0);

  const last30 = hist.filter(h=>{
    const d=new Date(h.date+'T00:00'); return(today-d)/86400000<=30;
  }).length;
  const last90 = hist.filter(h=>{
    const d=new Date(h.date+'T00:00'); return(today-d)/86400000<=90;
  }).length;
  const daysSinceLast = c.lastContact
    ? Math.floor((today-new Date(c.lastContact+'T00:00'))/86400000) : 999;

  const openIss = issues.filter(i=>i.status==='مفتوح'||i.status==='قيد المعالجة');
  const urgIss  = openIss.filter(i=>i.priority==='عاجل');
  const repeated= issues.filter(i=>i.repeatCount>=3);
  const techIss = issues.filter(i=>i.type==='خطأ تقني'||i.type==='أداء');

  const hiReqs  = reqs.filter(r=>r.impact==='عالي'&&r.status!=='مرفوض');
  const pendReqs= reqs.filter(r=>r.status==='مقترح'||r.status==='قيد الدراسة');

  const activeProg = progs.filter(p=>{
    if(!p.endDate) return true;
    return new Date(p.endDate+'T00:00')>=today;
  });
  const expiringSoon = progs.filter(p=>{
    if(!p.endDate) return false;
    const dl=Math.floor((new Date(p.endDate+'T00:00')-today)/86400000);
    return dl>=0&&dl<=30;
  });

  const parts=[];
  const tags=[];

  if(c.status==='نشط') tags.push({t:'نشط',cls:'green'});
  else if(c.status==='محتمل') tags.push({t:'محتمل',cls:'yellow'});
  else tags.push({t:'متوقف',cls:'red'});

  if(last30>=3){
    parts.push('يتواصل بشكل متكرر ومنتظم');
    tags.push({t:'تواصل مكثف',cls:'green'});
  } else if(last30>=1){
    parts.push('تواصل منتظم خلال الشهر الأخير');
  } else if(daysSinceLast<=60&&last90>=1){
    parts.push('تواصل متقطع — لم يتصل خلال 30 يوم الأخيرة');
    tags.push({t:'تواصل ضعيف',cls:'yellow'});
  } else if(daysSinceLast>60&&c.status==='نشط'){
    parts.push(`غياب تواصل لـ ${daysSinceLast} يوم — يستدعي المتابعة العاجلة`);
    tags.push({t:'غياب تواصل',cls:'red'});
  }

  if(urgIss.length>0){
    parts.push(`يعاني من ${urgIss.length} مشكلة عاجلة لم تُحل بعد`);
    tags.push({t:'مشاكل عاجلة',cls:'red'});
  } else if(openIss.length>0){
    parts.push(`لديه ${openIss.length} مشكلة مفتوحة قيد المعالجة`);
    tags.push({t:'مشاكل مفتوحة',cls:'yellow'});
  } else if(issues.length>0){
    parts.push('جميع المشاكل المسجلة محلولة');
    tags.push({t:'مشاكل محلولة ✓',cls:'green'});
  }

  if(repeated.length>=2){
    parts.push(`${repeated.length} مشاكل تتكرر باستمرار تشير إلى خلل بنيوي`);
    tags.push({t:'مشاكل متكررة',cls:'red'});
  }
  if(techIss.length>=3&&c.status==='نشط'){
    parts.push('يعاني من مشاكل تقنية متعددة — يحتاج دعماً تقنياً مكثفاً');
  }

  if(hiReqs.length>=2){
    parts.push(`طلب ${hiReqs.length} ميزات ذات تأثير عالٍ — عميل مشارك ومهتم بالتطوير`);
    tags.push({t:'تفاعل عالٍ',cls:'green'});
  } else if(pendReqs.length>0){
    parts.push(`لديه ${pendReqs.length} طلب قيد الانتظار — يتوقع ردوداً`);
  }

  if(expiringSoon.length>0){
    parts.push(`برنامج ينتهي خلال 30 يوم — فرصة تجديد العقد`);
    tags.push({t:'تجديد وشيك',cls:'yellow'});
  }
  if(activeProg.length===0&&progs.length>0){
    parts.push('جميع البرامج منتهية الصلاحية — خطر فقدان العميل');
    tags.push({t:'برامج منتهية',cls:'red'});
  }

  if(c.status==='متوقف'){
    const daysOff = daysSinceLast;
    parts.push(daysOff<90?'العميل في حالة توقف مؤقت — تواصل معه لاستئناف العلاقة':'العميل متوقف لفترة طويلة — يستوجب إعادة التواصل العاجل');
  }
  if(c.status==='محتمل'&&hist.length<=2){
    parts.push('عميل في مرحلة التجربة — يحتاج متابعة دقيقة وإقناعاً مستمراً');
    tags.push({t:'مرحلة إقناع',cls:'yellow'});
  }

  let action='';
  if(urgIss.length>0) action='🔴 أولوية: حل المشاكل العاجلة فوراً';
  else if(expiringSoon.length>0) action='🟡 أولوية: التواصل لتجديد العقد';
  else if(daysSinceLast>45&&c.status==='نشط') action='🔵 أولوية: جدولة مكالمة متابعة';
  else if(c.status==='محتمل') action='🟢 أولوية: متابعة التجربة وإغلاق الصفقة';
  else if(repeated.length>=2) action='🟠 أولوية: جلسة تقنية لحل المشاكل الجذرية';
  else if(openIss.length===0&&c.status==='نشط') action='✅ الوضع مستقر — استمر في المتابعة الدورية';

  if(parts.length===0) parts.push('لا توجد بيانات كافية لتوليد تحليل تلقائي.');

  const res = {text:parts.join('، ')+'.',action,tags};
  noteCache.set(c, res);
  return res;
}
