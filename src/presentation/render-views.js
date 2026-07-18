import { S, clients } from '../state/store.js';
import { BUSINESS_TYPES, PROGRAM_TYPES, WILAYAS } from '../constants/index.js';
import { gc, applyFilters, pBdg, sBdg, srcCls, platformIcon, updateActTypeOpts, isBdg, fmtD, rBdg, progStatusLabel, progStatusCls, progTypeBdg, activityIcon, getProgramStats, selOpts, wOpts, actTypeOpts, getActTypes, esc, avCls, init, searchMatch, countAdvFil, pBorder } from '../utils/index.js';
import { computeScore, computeGlobalStats, generateAutoNote, computeRiskProfile, scoreColor, computeAlerts, scoreLabel, riskColor, riskBdg, riskLabel, analyzeRootCause } from '../business/intelligence.js';
import { getActivityVisuals } from '../business/timelineService.js';
import { performSearch } from '../business/searchIndex.js';
export function renderList(){
  console.log("renderList: S.isLoading =", S.isLoading, "clients.length =", clients.length);
  const ac=clients.filter(c=>c.status==='نشط').length;
  const pr=clients.filter(c=>c.status==='محتمل').length;
  const pa=clients.filter(c=>c.status==='متوقف').length;
  const fil=applyFilters(clients);
  console.log("renderList: filtered clients count =", fil.length);
  const cnt=countAdvFil();

  if (S.isLoading) {
    return `
      <div class="stats-row">
        ${Array(4).fill(0).map(() => `<div class="stat-c skeleton" style="height:70px"></div>`).join('')}
      </div>
      <div class="search-row skeleton" style="height:40px;margin-bottom:.75rem"></div>
      <div class="cgrid">
        ${Array(6).fill(0).map(() => `<div class="cc skeleton" style="height:160px"></div>`).join('')}
      </div>
    `;
  }

  // List Virtualization: Calculate visible slice of items to keep DOM size minimal
  const itemHeight = 165;
  const numCols = window.innerWidth <= 520 ? 1 : 2;
  const totalRows = Math.ceil(fil.length / numCols);

  const scrollTop = S.virtualScrollTop || 0;
  const viewportHeight = S.viewportHeight || window.innerHeight;

  const visibleRowsCount = Math.ceil(viewportHeight / itemHeight);
  const bufferRows = 4; // Buffer rows above/below

  const startRow = Math.max(0, Math.floor(scrollTop / itemHeight) - bufferRows);
  const endRow = Math.min(totalRows, startRow + visibleRowsCount + bufferRows * 2);

  const startIndex = startRow * numCols;
  const endIndex = Math.min(fil.length, endRow * numCols);

  const visibleItems = fil.slice(startIndex, endIndex);

  const topSpacerHeight = startRow * itemHeight;
  const bottomSpacerHeight = Math.max(0, (totalRows - endRow) * itemHeight);

  return`
    <div class="stats-row">
      <div class="stat-c sg"><div class="stat-v">${ac}</div><div class="stat-l">نشطون</div></div>
      <div class="stat-c sb"><div class="stat-v">${pr}</div><div class="stat-l">محتمل</div></div>
      <div class="stat-c so"><div class="stat-v">${pa}</div><div class="stat-l">متوقف</div></div>
      <div class="stat-c"><div class="stat-v" style="color:var(--b)">${clients.reduce((s,c)=>s+(c.programs||[]).length,0)}</div><div class="stat-l">برامج · ${clients.reduce((s,c)=>s+(c.programs||[]).reduce((a,p)=>a+(Number(p.installationsCount)||1),0),0)} جهاز</div></div>
    </div>
    <div class="search-row">
      <input class="search-input" placeholder="ابحث: اسم، شركة، ولاية، نشاط، تخصص، هاتف..." value="${esc(S.q)}" oninput="onQ(this.value)">
      <button class="adv-fil-toggle${cnt>0||S.showAdvFil?' active':''}" onclick="toggleAdvFil()">
        ⚙ فلترة ${cnt>0?`<span class="adv-fil-badge">${cnt}</span>`:''}
      </button>
    </div>
    ${S.q?`<div class="search-result-bar">
      🔍 <strong>${fil.length}</strong> نتيجة لـ "<em>${esc(S.q)}</em>"
      <div style="margin-right:auto;display:flex;gap:4px;flex-wrap:wrap">
        ${['الاسم','الشركة','الولاية','النشاط','التخصص','الهاتف'].map(f=>`<span class="sf-tag">${f}</span>`).join('')}
      </div>
      <button class="search-clear" onclick="onQ('')">✕ مسح</button>
    </div>`:''}
    ${renderAdvFilterPanel()}
    <div style="display:flex;align-items:center;justify-content:space-between;padding:.25rem 0;margin-bottom:.5rem;gap:12px;flex-wrap:wrap">
      <div class="filter-bar" style="margin:0;border:none;padding:0">
        ${['الكل','نشط','محتمل','متوقف'].map(s=>`<span class="fpill${S.filter===s?' on':''}" onclick="setFil('${s}')">${s}</span>`).join('')}
      </div>
      <div style="display:flex;align-items:center;gap:6px;font-size:11px;color:var(--t2)">
        <span style="font-weight:600">ترتيب:</span>
        <select onchange="setSortBy(this.value)" style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-sm);padding:4px 8px;color:var(--t1);font-family:inherit;font-size:11px;outline:none;cursor:pointer">
          <option value="id"${S.sortBy==='id'?' selected':''}>رقم العميل</option>
          <option value="fullName"${S.sortBy==='fullName'?' selected':''}>الاسم الكامل</option>
          <option value="score"${S.sortBy==='score'?' selected':''}>نقاط التقييم</option>
          <option value="lastContact"${S.sortBy==='lastContact'?' selected':''}>تاريخ التواصل</option>
          <option value="endDate"${S.sortBy==='endDate'?' selected':''}>انتهاء العقد</option>
        </select>
        <button onclick="toggleSortOrder()" style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-sm);width:26px;height:26px;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;color:var(--t1)" title="${S.sortOrder==='asc'?'تصاعدي':'تنازلي'}">
          ${S.sortOrder==='asc'?'▲':'▼'}
        </button>
      </div>
    </div>
    ${fil.length===0?`<div class="empty">
      <div class="empty-icon">🔍</div>
      <div class="empty-text">لا توجد نتائج تطابق الفلاتر المحددة حالياً.</div>
      <div style="display:flex;gap:8px;justify-content:center">
        ${cnt>0?`<button class="btn btn-outline btn-sm" onclick="clearAdvFil()">مسح الفلاتر</button>`:''}
        <button class="btn btn-primary btn-sm" onclick="openModal('addClient')">إضافة عميل جديد</button>
      </div>
    </div>`:
    `<div class="cgrid">
      <div style="grid-column:1/-1;height:${topSpacerHeight}px;pointer-events:none"></div>
      ${visibleItems.map(c=>{
        const oi=c.openIssuesCount !== undefined ? c.openIssuesCount : (c.issues||[]).filter(i=>i.status==='مفتوح'||i.status==='قيد المعالجة').length;
        const urg=c.urgentIssuesCount !== undefined ? c.urgentIssuesCount : (c.issues||[]).filter(i=>i.priority==='عاجل'&&i.status!=='محلول'&&i.status!=='مغلق').length;
        const sc=computeScore(c);
        const scColor=scoreColor(sc.total);
        const hit=S.q?searchMatch(c,S.q):null;
        return`<div class="cc" onclick="selClient(${c.id})" id="cc-card-${c.id}">
          <div class="cc-score-strip" style="background:${scColor}"></div>
          <div class="cc-top">
            <div class="av ${avCls(c.status)}">${esc(init(c.fullName))}</div>
            <div style="min-width:0"><div class="cc-name">${esc(c.fullName)}</div><div class="cc-company" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(c.company)||"—"}</div></div>
          </div>
          <div class="cc-badges">
            ${sBdg(c.status)}
            ${(()=>{const ps=getProgramStats(c);return ps.total>0?`<span class="bdg bdg-b">📦 ${ps.total} برنامج`+(ps.totalInstalls>1?` · ${ps.totalInstalls} جهاز`:'')+'</span>':`<span class="bdg bdg-gr">لا برامج</span>`})()}
            <span class="bdg score-tip" style="background:${scColor}18;color:${scColor}" data-tip="${sc.total>=75?'عميل متميز':sc.total>=50?'عميل جيد':sc.total>=25?'يحتاج متابعة':'خطر عالٍ'}">⭐ ${sc.total}</span>
          </div>
          ${c.businessType?`<div class="cc-activity">${activityIcon(c.businessType)} ${esc(c.businessType)}${c.businessField?` · ${esc(c.businessField)}`:''}</div>`:''}
          ${hit&&hit.fields.length>0?`<div class="cc-search-match">${hit.fields.map(f=>`<span class="sf-tag">✓ ${f}</span>`).join('')}</div>`:''}
          <div class="cc-footer">
            <div class="cc-phone" dir="ltr">${esc(c.phone)||"—"}</div>
            <div class="cc-wilaya">${esc(c.wilaya)||"—"}</div>
          </div>
          ${oi>0?`<div class="cc-alert" style="color:${urg>0?'var(--r)':'var(--w)'}">▸ ${oi} مشكلة مفتوحة${urg>0?' (عاجل)':''}</div>`:''}
        </div>`;
      }).join('')}
      <div style="grid-column:1/-1;height:${bottomSpacerHeight}px;pointer-events:none"></div>
    </div>`}
  `;
}

export function renderDetail(){
  if (S.isLoading) {
    return `
      <div class="back skeleton" style="width:120px;height:32px;margin-bottom:1rem"></div>
      <div class="chdr skeleton" style="height:120px;margin-bottom:1rem"></div>
      <div class="qstats">
        ${Array(4).fill(0).map(() => `<div class="qs skeleton" style="height:70px"></div>`).join('')}
      </div>
      <div class="tabs-wrap skeleton" style="height:40px"></div>
    `;
  }
  const c=gc();if(!c)return'<p style="color:var(--t2)">العميل غير موجود</p>';
  const oi=c.issues.filter(i=>i.status==='مفتوح'||i.status==='قيد المعالجة').length;
  const fo=c.issues.filter(i=>i.featureOpp).length;
  const sc=computeScore(c);
  const scColor=scoreColor(sc.total);
  console.log("DEBUG RENDER DETAIL: c.id =", c.id, "S.tab =", S.tab, "c._subcollectionsLoaded =", c._subcollectionsLoaded);
  return`
    <div class="back" onclick="goBack()">← قائمة العملاء</div>
    <div class="chdr">
      <div class="ch-top">
        <div class="ch-av">${esc(init(c.fullName))}</div>
        <div style="flex:1;min-width:0">
          <div class="ch-name">${esc(c.fullName)}</div>
          <div class="ch-company">${esc(c.company)}</div>
        </div>
        <div class="ch-acts">
          ${sBdg(c.status)}
          <button class="btn btn-sm" style="background:rgba(255,255,255,.12);color:#fff;border:none" onclick="openModal('editClient')">تعديل</button>
        </div>
      </div>
      <div class="ch-meta">
        <span class="ch-mi">📍 ${esc(c.wilaya)||"—"}${c.location?'، '+esc(c.location):''}</span>
        <span class="ch-mi" dir="ltr">📞 ${esc(c.phone)||"—"}</span>
        ${(()=>{const ps=getProgramStats(c);const pp=c.programs||[];return ps.total>0?`<span class="ch-mi">📦 ${esc(pp[0].programName)}${ps.total>1?` (+${ps.total-1})`:''} · ${ps.totalInstalls} جهاز</span>`:`<span class="ch-mi" style="opacity:.5">📦 لا برامج</span>`})()}
        <span class="ch-mi">${activityIcon(c.businessType)} ${esc(c.businessType)||"—"}${c.businessField?' · '+esc(c.businessField):''}</span>
      </div>
    </div>
    <div class="qstats">
      <div class="qs ${oi>0?'qr':'qg'}"><div class="qs-v">${oi}</div><div class="qs-l">مشاكل مفتوحة</div></div>
      <div class="qs ${fo>0?'qw':''}"><div class="qs-v">${fo}</div><div class="qs-l">فرص ميزات</div></div>
      ${(()=>{const ps=getProgramStats(c);return`<div class="qs ${ps.expired>0?'qr':'qg'}"><div class="qs-v">${ps.total}</div><div class="qs-l">البرامج (${ps.totalInstalls} جهاز)</div></div>`})()}
      <div class="qs qc"><div class="qs-v">${(c.contactHistory||[]).length}</div><div class="qs-l">سجلات تواصل</div></div>
      <div class="qs"><div class="qs-v" style="color:${scColor};font-size:20px">${sc.total}</div><div class="qs-l">نقاط العميل</div></div>
    </div>
    <div class="tabs-wrap">
      <button class="tabBtn${S.tab==='overview'?' on':''}" onclick="setTab('overview')">نظرة عامة</button>
      <button class="tabBtn${S.tab==='programs'?' on':''}" onclick="setTab('programs')">البرامج <span class="tab-count">${(c.programs||[]).length}</span></button>
      <button class="tabBtn${S.tab==='issues'?' on':''}" onclick="setTab('issues')">المشاكل <span class="tab-count${c.issues.filter(i=>i.priority==='عاجل'&&i.status!=='محلول'&&i.status!=='مغلق').length>0?' urgent':''}">${c.issues.length}</span></button>
      <button class="tabBtn${S.tab==='requirements'?' on':''}" onclick="setTab('requirements')">المتطلبات <span class="tab-count">${c.requirements.length}</span></button>
      <button class="tabBtn${S.tab==='contacts'?' on':''}" onclick="setTab('contacts')">📞 التواصل <span class="tab-count">${(c.contactHistory||[]).length}</span></button>
      <button class="tabBtn${S.tab==='timeline'?' on':''}" onclick="setTab('timeline')">⏱️ الخط الزمني</button>
      <button class="tabBtn${S.tab==='report'?' on':''}" onclick="setTab('report')">📊 التقرير</button>
      <button class="tabBtn${S.tab==='intelligence'?' on':''}" onclick="setTab('intelligence')">🧠 الذكاء</button>
    </div>
    <div class="tab-pane">
      ${S.tab==='overview'?renderOverview(c):''}
      ${S.tab==='programs'?renderPrograms(c):''}
      ${S.tab==='issues'?renderIssues(c):''}
      ${S.tab==='requirements'?renderReqs(c):''}
      ${S.tab==='contacts'?renderContacts(c):''}
      ${S.tab==='timeline'?renderTimeline(c):''}
      ${S.tab==='report'?renderReport(c):''}
      ${S.tab==='intelligence'?renderIntelligence(c):''}
    </div>`;
}

function renderOverview(c){
  const gpsSection=c.gps&&c.gps.lat
    ?`<div class="gps-row"><span>📍</span><span class="gps-coords">${c.gps.lat}, ${c.gps.lng}</span><button class="btn btn-blue-soft btn-xs" onclick="captureGPS()">تحديث GPS</button></div>`
    :`<button class="btn btn-blue-soft btn-sm" style="margin-top:8px;width:100%" onclick="captureGPS()">📍 تحديد الموقع بـ GPS</button>`;
  const hasBiz=c.businessType||c.businessField;
  const bizCard=hasBiz
    ?`<div class="biz-profile">
        <div class="biz-icon">${activityIcon(c.businessType)}</div>
        <div class="biz-info">
          <div class="biz-activity">${esc(c.businessType)}</div>
          <div class="biz-type">${esc(c.businessField)||"لم يُحدد التخصص بعد"}</div>
        </div>
        <span class="biz-badge">ملف النشاط</span>
      </div>`
    :`<div class="biz-profile" style="cursor:pointer" onclick="openModal('editClient')">
        <div class="biz-icon">🏪</div>
        <div class="biz-info"><div class="biz-empty">لم يُحدد النشاط التجاري — اضغط لإضافته</div></div>
        <span class="biz-badge">+ إضافة</span>
      </div>`;
  const an=generateAutoNote(c);
  return`
    <div class="auto-note">
      <span class="an-ic">🤖</span>
      <div class="an-body">
        <div class="an-lbl">تحليل ذكي تلقائي</div>
        <div class="an-text">${esc(an.text)}</div>
        ${an.action?`<div class="an-text" style="margin-top:6px;font-weight:700;font-size:12px">${esc(an.action)}</div>`:''}
        <div class="an-tags">${an.tags.map(t=>`<span class="an-tag ${t.cls}">${esc(t.t)}</span>`).join('')}</div>
      </div>
    </div>
    ${bizCard}
    <div class="igrid">
      <div class="iitem"><div class="ilbl">الاسم الكامل</div><div class="ival">${esc(c.fullName)}</div></div>
      <div class="iitem"><div class="ilbl">الشركة / المؤسسة</div><div class="ival ${c.company?'':'muted'}">${esc(c.company)||"—"}</div></div>
      <div class="iitem"><div class="ilbl">الهاتف</div><div class="ival" dir="ltr" style="text-align:right">${esc(c.phone)||"—"}</div></div>
      <div class="iitem"><div class="ilbl">الولاية</div><div class="ival">${esc(c.wilaya)||"—"}</div></div>
      <div class="iitem"><div class="ilbl">المنطقة / الحي</div><div class="ival ${c.location?'':'muted'}">${esc(c.location)||"—"}</div></div>
      <div class="iitem"><div class="ilbl">الحالة</div><div class="ival">${sBdg(c.status)}</div></div>
      <div class="iitem"><div class="ilbl">النشاط الرئيسي</div><div class="ival">${c.businessType?`${activityIcon(c.businessType)} ${esc(c.businessType)}`:'<span class="muted">—</span>'}</div></div>
      <div class="iitem"><div class="ilbl">تخصص النشاط</div><div class="ival ${c.businessField?'':'muted'}">${esc(c.businessField)||"—"}</div></div>
      ${(()=>{const ps=getProgramStats(c);const pp=c.programs||[];return`
      <div class="iitem"><div class="ilbl">عدد البرامج</div><div class="ival">${ps.total} ${ps.total>0?`<span style="font-size:11px;color:var(--t3)">· ${ps.totalInstalls} جهاز</span>`:''}</div></div>
      <div class="iitem"><div class="ilbl">البرنامج الرئيسي</div><div class="ival ${pp.length?'':'muted'}">${pp.length?esc(pp[0].programName):'—'}</div></div>`})()}
      <div class="iitem"><div class="ilbl">بداية العقد</div><div class="ival">${fmtD(c.startDate)}</div></div>
      <div class="iitem"><div class="ilbl">نهاية العقد</div><div class="ival ${c.endDate?'':'muted'}">${c.endDate?fmtD(c.endDate):'—'}</div></div>
      <div class="iitem"><div class="ilbl">آخر تواصل</div><div class="ival"><span class="last-contact-clickable" onclick="setTab('contacts')" title="عرض سجل التواصل الكامل">${fmtD(c.lastContact)||'—'} 📋</span></div></div>
    </div>
    ${gpsSection}
    ${c.notes?`<div style="margin-top:10px"><div style="font-size:10px;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:.04em;margin-bottom:5px">ملاحظات</div><div class="notes-box">${esc(c.notes)}</div></div>`:''}
    <div class="dzone">
      <div class="dz-t">منطقة الخطر</div>
      <div class="dz-b">حذف هذا العميل يحذف جميع مشاكله ومتطلباته نهائياً ولا يمكن التراجع</div>
      <button class="btn btn-danger-soft btn-sm" onclick="delClient(${c.id})">حذف العميل نهائياً</button>
    </div>`;
}

function renderIssues(c){
  return`
    <div class="pane-hdr">
      <span class="pane-title">المشاكل والتذاكر (${c.issues.length})</span>
      <button class="btn btn-primary btn-sm" onclick="openModal('addIssue')">+ مشكلة جديدة</button>
    </div>
    ${c.issues.length===0
      ?`<div class="empty"><div class="empty-icon">✅</div><div class="empty-text">لا توجد مشاكل مسجلة لهذا العميل</div><button class="btn btn-outline btn-sm" onclick="openModal('addIssue')">تسجيل أول مشكلة</button></div>`
      :c.issues.map(iss=>`
        <div class="icard ${pBorder(iss.priority)}">
          <div class="ic-top"><div class="ic-title">${esc(iss.title)}</div>${isBdg(iss.status)}</div>
          <div class="ic-meta">
            ${pBdg(iss.priority)}
            <span class="ic-type">${esc(iss.type)}</span>
            ${iss.source?`<span class="ic-src ${srcCls(iss.source)}">${esc(iss.source)}</span>`:''}
            ${iss.confidence?`<span class="ic-conf">${iss.confidence}% ثقة</span>`:''}
            ${iss.repeatCount>1?`<span class="ic-repeat">× ${iss.repeatCount}</span>`:''}
            ${iss.featureOpp?`<span class="ic-opp">💡 فرصة ميزة</span>`:''}
            <span class="ic-date">${fmtD(iss.date)}</span>
          </div>
          ${iss.notes?`<div class="ic-sol">📝 ${esc(iss.notes)}</div>`:''}
          ${iss.solution?`<div class="ic-sol"><strong style="color:var(--gt)">✓ الحل:</strong> ${esc(iss.solution)}</div>`:''}
          <div class="ic-acts">
            ${iss.status!=='محلول'&&iss.status!=='مغلق'?`<button class="btn btn-success-soft btn-xs" onclick="markSolved(${c.id},${iss.id})">✓ تم الحل</button>`:''}
            <button class="btn btn-ghost btn-xs" onclick="editIssue(${c.id},${iss.id})">تعديل</button>
            <button class="btn btn-danger-soft btn-xs" onclick="delIssue(${c.id},${iss.id})">حذف</button>
          </div>
        </div>`).join('')}`;
}

function renderReqs(c){
  return`
    <div class="pane-hdr">
      <span class="pane-title">المتطلبات والاقتراحات (${c.requirements.length})</span>
      <button class="btn btn-primary btn-sm" onclick="openModal('addRequirement')">+ طلب جديد</button>
    </div>
    ${c.requirements.length===0
      ?`<div class="empty"><div class="empty-icon">💡</div><div class="empty-text">لا توجد متطلبات مسجلة</div><button class="btn btn-outline btn-sm" onclick="openModal('addRequirement')">تسجيل أول طلب</button></div>`
      :c.requirements.map(req=>`
        <div class="icard ${pBorder(req.priority)}">
          <div class="ic-top"><div class="ic-title">${esc(req.title)}</div>${rBdg(req.status)}</div>
          <div class="ic-meta">
            ${pBdg(req.priority)}
            <span class="ic-type">${esc(req.type)}</span>
            <span class="bdg bdg-gr">تأثير ${esc(req.impact)}</span>
            <span class="ic-date">${fmtD(req.date)}</span>
          </div>
          ${req.notes?`<div class="ic-sol">📝 ${esc(req.notes)}</div>`:''}
          <div class="ic-acts">
            <button class="btn btn-ghost btn-xs" onclick="editReq(${c.id},${req.id})">تعديل</button>
            <button class="btn btn-danger-soft btn-xs" onclick="delReq(${c.id},${req.id})">حذف</button>
          </div>
        </div>`).join('')}`;
}
function renderContacts(c){
  const hist=(c.contactHistory||[]).slice().sort((a,b)=>b.date.localeCompare(a.date));
  return`
    <div class="ch-tab">
      <div class="ch-summary">
        <span class="ch-count">📋 ${hist.length} تواصل مسجل</span>
        <button class="btn btn-primary btn-sm" onclick="openModal('addContact')">+ تسجيل تواصل</button>
      </div>
      ${hist.length===0
        ?`<div class="ch-empty">📭 لا توجد سجلات تواصل بعد<br><small>سجّل أول تواصل مع هذا العميل</small></div>`
        :`<div class="timeline">
          ${hist.map((h,i)=>`
            <div class="tl-entry">
              <div class="tl-dot${i===0?' first':''}"></div>
              <div class="tl-date">${fmtD(h.date)}</div>
              <div class="tl-note">${esc(h.note)}</div>
              <div class="tl-acts">
                <button class="btn btn-danger-soft btn-xs" onclick="delContact(${c.id},${h.id})">حذف</button>
              </div>
            </div>`).join('')}
        </div>`}
    </div>`;
}

function renderPrograms(c){
  const ps=getProgramStats(c);
  const progs=c.programs||[];
  console.log("DEBUG RENDER PROGRAMS: c.id =", c.id, "c.fullName =", c.fullName, "progs =", JSON.stringify(progs));
  return`
    <div class="prog-summary">
      <div class="ps-item ps-active"><div class="ps-val">${ps.total}</div><div class="ps-lbl">إجمالي البرامج</div></div>
      <div class="ps-item"><div class="ps-val">${ps.totalInstalls}</div><div class="ps-lbl">إجمالي الأجهزة</div></div>
      <div class="ps-item ${ps.expired>0?'ps-expired':'ps-active'}"><div class="ps-val">${ps.active}</div><div class="ps-lbl">نشط / ${ps.expired} منتهي</div></div>
    </div>
    <div class="pane-hdr">
      <span class="pane-title">قائمة البرامج</span>
      <button class="btn btn-primary btn-sm" onclick="openModal('addProgram')">+ برنامج جديد</button>
    </div>
    ${progs.length===0
      ?`<div class="empty">
          <div class="empty-icon">📦</div>
          <div class="empty-text">لا توجد برامج مرتبطة بهذا العميل</div>
          <button class="btn btn-primary btn-sm" onclick="openModal('addProgram')">إضافة أول برنامج</button>
        </div>`
      :progs.map(p=>`
        <div class="prog-card ${progStatusCls(p)}">
          <div class="prog-top">
            <div class="prog-name">${platformIcon(p.platform)} ${esc(p.programName)}</div>
            ${progStatusLabel(p)}
          </div>
          <div class="prog-meta">
            ${progTypeBdg(p.type)}
            <span class="bdg bdg-gr">${esc(p.platform)}</span>
          </div>
          <div class="prog-installs">🖥 <strong>${p.installationsCount}</strong> جهاز مُرخَّص</div>
          <div class="prog-dates">
            <div class="prog-date-item">
              <div class="prog-date-lbl">تاريخ البداية</div>
              <div class="prog-date-val">${fmtD(p.startDate)||'—'}</div>
            </div>
            <div class="prog-date-item">
              <div class="prog-date-lbl">تاريخ الانتهاء</div>
              <div class="prog-date-val ${!p.endDate?'muted':''}">${p.endDate?fmtD(p.endDate):'بدون انتهاء'}</div>
            </div>
          </div>
          <div class="prog-acts">
            <button class="btn btn-ghost btn-xs" onclick="editProg(${c.id},${p.id})">✏ تعديل</button>
            <button class="btn btn-danger-soft btn-xs" onclick="delProgram(${c.id},${p.id})">حذف</button>
          </div>
        </div>`).join('')}`;
}

function renderReport(c){
  const sc   = computeScore(c);
  const rp   = computeRiskProfile(c);
  const ps   = getProgramStats(c);
  const an   = generateAutoNote(c);
  const today= new Date(); today.setHours(0,0,0,0);

  const openIss  = c.issues.filter(i=>i.status==='مفتوح'||i.status==='قيد المعالجة');
  const solvedIss= c.issues.filter(i=>i.status==='محلول'||i.status==='مغلق');
  const urgIss   = openIss.filter(i=>i.priority==='عاجل');
  const repeated = c.issues.filter(i=>i.repeatCount>=3);
  const featureOp= c.issues.filter(i=>i.featureOpp);
  const hiReqs   = c.requirements.filter(r=>r.impact==='عالي'&&r.status!=='مرفوض');
  const hist     = (c.contactHistory||[]).slice().sort((a,b)=>b.date.localeCompare(a.date));
  const last30ct = hist.filter(h=>(today-new Date(h.date+'T00:00'))/86400000<=30).length;
  const daysSince= c.lastContact?Math.floor((today-new Date(c.lastContact+'T00:00'))/86400000):null;

  const scColor  = sc.total>=75?'var(--g)':sc.total>=50?'var(--w)':sc.total>=25?'var(--brand)':'var(--r)';
  const riskColor= rp.level==='high'?'var(--r)':rp.level==='medium'?'var(--w)':'var(--g)';
  const riskLbl  = rp.level==='high'?'خطر عالٍ':rp.level==='medium'?'تحت المراقبة':'وضع مستقر';
  const riskBdgCls= rp.level==='high'?'bdg-r':rp.level==='medium'?'bdg-y':'bdg-g';

  const oppLevel = (()=>{
    let score=0;
    if(hiReqs.length>=2)score+=3;
    if(featureOp.length>=2)score+=2;
    if(last30ct>=3)score+=2;
    if(c.status==='محتمل')score+=2;
    if(ps.total>=2)score+=1;
    return score>=6?'عالية':score>=3?'متوسطة':'منخفضة';
  })();
  const oppColor = oppLevel==='عالية'?'var(--g)':oppLevel==='متوسطة'?'var(--w)':'var(--t3)';

  const actions=[];
  if(urgIss.length>0)
    actions.push({icon:'🚨',text:`حل ${urgIss.length} مشكلة عاجلة مفتوحة فوراً`,cls:'urgent'});
  if(ps.expired>0&&ps.active===0)
    actions.push({icon:'🔴',text:'جميع البرامج منتهية — تجديد العقد أولوية قصوى',cls:'urgent'});
  const expiring=c.programs.filter(p=>{
    if(!p.endDate)return false;
    const dl=Math.floor((new Date(p.endDate+'T00:00')-today)/86400000);
    return dl>=0&&dl<=30;
  });
  if(expiring.length>0)
    actions.push({icon:'📅',text:`تجديد ${expiring.length} برنامج ينتهي خلال 30 يوم`,cls:'urgent'});
  if(daysSince!==null&&daysSince>45&&c.status==='نشط')
    actions.push({icon:'📞',text:`جدولة مكالمة متابعة — لا تواصل منذ ${daysSince} يوم`,cls:''});
  if(repeated.length>=2)
    actions.push({icon:'🔧',text:`جلسة تقنية لحل ${repeated.length} مشاكل متكررة جذرياً`,cls:''});
  if(hiReqs.length>0)
    actions.push({icon:'💡',text:`مراجعة ${hiReqs.length} طلب ذو تأثير عالٍ مع فريق المنتج`,cls:''});
  if(c.status==='محتمل'&&hist.length<3)
    actions.push({icon:'🤝',text:'تكثيف جهود الإقناع وتقديم عرض مخصص لإغلاق الصفقة',cls:''});
  if(actions.length===0)
    actions.push({icon:'✅',text:'الوضع مستقر — استمر في المتابعة الدورية',cls:'ok'});

  const sbar=(lbl,val,max,col)=>`
    <div class="rep-score-bar">
      <span class="rep-score-lbl">${lbl}</span>
      <div class="rep-score-track"><div class="rep-score-fill" style="width:${max?Math.round(val/max*100):0}%;background:${col}"></div></div>
      <span class="rep-score-val">${val}/${max}</span>
    </div>`;

  return`<div class="report-wrap">

    <!-- HEADER -->
    <div class="report-header">
      <div class="rh-top">
        <div class="rh-av">${esc((c.fullName||'').substring(0,2))}</div>
        <div style="flex:1;min-width:0">
          <div class="rh-name">${esc(c.fullName)}</div>
          <div class="rh-sub">${esc(c.company)||"—"}</div>
        </div>
        <div style="text-align:left;flex-shrink:0">
          <div style="font-size:26px;font-weight:800;color:${scColor}">${sc.total}</div>
          <div style="font-size:10px;opacity:.5;margin-top:2px">/ 100 نقطة</div>
        </div>
      </div>
      <div class="rh-meta">
        <span class="rh-mi">📍 ${esc(c.wilaya)||"—"}</span>
        <span class="rh-mi" dir="ltr">📞 ${esc(c.phone)||"—"}</span>
        <span class="rh-mi">${activityIcon(c.businessType)} ${esc(c.businessType)||"—"}</span>
        <span class="rh-mi">📅 تاريخ التقرير: ${new Date().toLocaleDateString('ar-DZ',{day:'numeric',month:'long',year:'numeric'})}</span>
      </div>
    </div>

    <!-- KPIs -->
    <div class="report-kpis">
      <div class="rkpi ${openIss.length>0?'rr':'rg'}"><div class="rkpi-v">${openIss.length}</div><div class="rkpi-l">مشاكل مفتوحة</div></div>
      <div class="rkpi rb"><div class="rkpi-v">${ps.total}</div><div class="rkpi-l">برامج · ${ps.totalInstalls} جهاز</div></div>
      <div class="rkpi ro"><div class="rkpi-v">${hist.length}</div><div class="rkpi-l">سجلات تواصل</div></div>
      <div class="rkpi ${rp.level==='high'?'rr':rp.level==='medium'?'ro':'rg'}"><div class="rkpi-v" style="font-size:15px">${riskLbl}</div><div class="rkpi-l">مستوى الخطر</div></div>
      <div class="rkpi"><div class="rkpi-v" style="color:${oppColor};font-size:16px">${oppLevel}</div><div class="rkpi-l">مستوى الفرصة</div></div>
      <div class="rkpi"><div class="rkpi-v">${c.requirements.length}</div><div class="rkpi-l">متطلبات</div></div>
    </div>

    <!-- 1. PROFILE -->
    <div class="rep-sec">
      <div class="rep-sec-title">🏢 الملف التجاري</div>
      <div class="rep-card">
        <div class="rep-row"><div class="rep-dot"></div><div><strong>النشاط:</strong> ${c.businessType?`${activityIcon(c.businessType)} ${esc(c.businessType)}`:'غير محدد'}${c.businessField?' — '+esc(c.businessField):''}</div></div>
        <div class="rep-row"><div class="rep-dot"></div><div><strong>الموقع:</strong> ${esc(c.wilaya)||"—"}${c.location?'، '+esc(c.location):''}</div></div>
        <div class="rep-row"><div class="rep-dot"></div><div><strong>الحالة:</strong> ${esc(c.status)} — ${c.status==='نشط'?'علاقة نشطة':'يحتاج متابعة'}</div></div>
        <div class="rep-row"><div class="rep-dot"></div><div><strong>العقد:</strong> ${fmtD(c.startDate)||'—'} ← ${fmtD(c.endDate)||'مفتوح'}</div></div>
        ${c.notes?`<div class="rep-row"><div class="rep-dot"></div><div><strong>ملاحظات:</strong> ${esc(c.notes)}</div></div>`:''}
      </div>
    </div>

    <!-- 2. PROGRAMS -->
    <div class="rep-sec">
      <div class="rep-sec-title">📦 البرامج والتراخيص</div>
      ${ps.total===0
        ?`<div class="rep-card" style="color:var(--t3);text-align:center">لا توجد برامج مرتبطة</div>`
        :(c.programs||[]).map(p=>{
            const cls=!p.endDate||new Date(p.endDate+'T00:00')>=today?'green':'red';
            const lbl=!p.endDate||new Date(p.endDate+'T00:00')>=today?'نشط':'منتهي';
            return`<div class="rep-card">
              <div class="rep-row"><div class="rep-dot ${cls}"></div><div><strong>${esc(p.programName)}</strong> — <span style="color:${cls==='green'?'var(--g)':'var(--r)'}">${lbl}</span></div></div>
              <div class="rep-row"><div class="rep-dot"></div><div>المنصة: ${esc(p.platform)} · النوع: ${esc(p.type)} · ${p.installationsCount} جهاز</div></div>
              <div class="rep-row"><div class="rep-dot"></div><div>الفترة: ${fmtD(p.startDate)||'—'} ← ${p.endDate?fmtD(p.endDate):'مفتوح'}</div></div>
            </div>`;
          }).join('')}
    </div>

    <!-- 3. ISSUES -->
    <div class="rep-sec">
      <div class="rep-sec-title">🐛 تحليل المشاكل</div>
      ${c.issues.length===0
        ?`<div class="rep-card" style="color:var(--gt)">✅ لا توجد مشاكل مسجلة</div>`
        :`<div class="rep-card">
          <div class="rep-row"><div class="rep-dot red"></div><div><strong>${openIss.length}</strong> مشكلة مفتوحة${urgIss.length>0?` (${urgIss.length} عاجلة)`:''}</div></div>
          <div class="rep-row"><div class="rep-dot green"></div><div><strong>${solvedIss.length}</strong> مشكلة محلولة</div></div>
          ${repeated.length>0?`<div class="rep-row"><div class="rep-dot yellow"></div><div><strong>${repeated.length}</strong> مشاكل متكررة (repeatCount ≥ 3) — تشير إلى خلل بنيوي</div></div>`:''}
          ${featureOp.length>0?`<div class="rep-row"><div class="rep-dot"></div><div><strong>${featureOp.length}</strong> فرصة لتحويل مشكلة إلى ميزة منتج 💡</div></div>`:''}
        </div>
        ${openIss.length>0?`<div class="rep-card"><strong>المشاكل المفتوحة:</strong><br>${openIss.map(i=>`<div class="rep-row" style="margin-top:5px"><div class="rep-dot ${i.priority==='عاجل'?'red':i.priority==='عالية'?'yellow':''}"></div><div>${esc(i.title)} — ${esc(i.priority)} — ${esc(i.type)}</div></div>`).join('')}</div>`:''}`}
    </div>

    <!-- 4. CONTACT ANALYSIS -->
    <div class="rep-sec">
      <div class="rep-sec-title">📞 تحليل التواصل</div>
      <div class="rep-card">
        <div class="rep-row"><div class="rep-dot"></div><div><strong>إجمالي التواصلات:</strong> ${hist.length} سجل</div></div>
        <div class="rep-row"><div class="rep-dot ${last30ct>=2?'green':last30ct===0?'red':'yellow'}"></div><div><strong>خلال 30 يوم الأخيرة:</strong> ${last30ct} تواصل</div></div>
        <div class="rep-row"><div class="rep-dot ${daysSince!==null&&daysSince>60?'red':daysSince!==null&&daysSince>30?'yellow':'green'}"></div><div><strong>آخر تواصل:</strong> ${fmtD(c.lastContact)||'—'}${daysSince!==null?` (منذ ${daysSince} يوم)`:''}</div></div>
        ${hist.length>0?`<div class="rep-row"><div class="rep-dot"></div><div><strong>آخر ملاحظة:</strong> ${esc(hist[0].note)}</div></div>`:''}
      </div>
    </div>

    <!-- 5. SCORE -->
    <div class="rep-sec">
      <div class="rep-sec-title">⭐ تقييم العميل</div>
      <div class="rep-card">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:.75rem">
          <div style="font-size:28px;font-weight:800;color:${scColor}">${sc.total}</div>
          <div style="font-size:12px;color:var(--t2)">${sc.total>=75?'عميل متميز':sc.total>=50?'عميل جيد':sc.total>=25?'يحتاج متابعة':'خطر عالٍ'}</div>
        </div>
        ${sbar('البرامج',sc.prog,35,'#10B981')}
        ${sbar('التواصل',sc.act,25,'#3B82F6')}
        ${sbar('صحة المشاكل',sc.iss,25,'#F97316')}
        ${sbar('المتطلبات',sc.req,15,'#8B5CF6')}
      </div>
    </div>

    <!-- 6. RISK -->
    <div class="rep-sec">
      <div class="rep-sec-title">⚠️ ملف المخاطر</div>
      <div class="rep-card">
        <div class="rep-risk-badge bdg ${riskBdgCls}" style="font-size:13px">${riskLbl}</div>
        ${rp.risks.length===0
          ?`<div style="color:var(--gt)">✅ لا توجد مخاطر مكتشفة</div>`
          :rp.risks.map(r=>`<div class="rep-row"><div class="rep-dot red"></div><div>${r}</div></div>`).join('')}
      </div>
    </div>

    <!-- 7. OPPORTUNITIES -->
    <div class="rep-sec">
      <div class="rep-sec-title">💡 فرص النمو</div>
      <div class="rep-card">
        <div class="rep-row"><div class="rep-dot ${oppLevel==='عالية'?'green':oppLevel==='متوسطة'?'yellow':''}"></div><div><strong>مستوى الفرصة:</strong> <span style="color:${oppColor};font-weight:700">${oppLevel}</span></div></div>
        ${hiReqs.length>0?`<div class="rep-row"><div class="rep-dot green"></div><div>${hiReqs.length} طلب ذو تأثير عالٍ — فرصة لتوسيع العقد</div></div>`:''}
        ${featureOp.length>0?`<div class="rep-row"><div class="rep-dot green"></div><div>${featureOp.length} مشكلة قابلة للتحويل لميزة — قيمة منتج مضافة</div></div>`:''}
        ${c.status==='محتمل'?`<div class="rep-row"><div class="rep-dot yellow"></div><div>عميل محتمل — لم يُغلق العقد بعد</div></div>`:''}
        ${ps.total>=2?`<div class="rep-row"><div class="rep-dot green"></div><div>يستخدم ${ps.total} برامج — ارتباط قوي بالمنصة</div></div>`:''}
      </div>
    </div>

    <!-- 8. INTELLIGENT NOTE -->
    <div class="rep-sec">
      <div class="rep-sec-title">🤖 الملاحظة الذكية التلقائية</div>
      <div class="rep-card">${esc(an.text)}${an.action?`<div style="margin-top:6px;font-weight:700;color:var(--t1)">${esc(an.action)}</div>`:''}</div>
    </div>

    <!-- 9. ACTIONS -->
    <div class="rep-sec">
      <div class="rep-sec-title">🎯 الإجراءات المقترحة</div>
      ${actions.map(a=>`<div class="rep-action ${a.cls}"><span class="rep-action-icon">${a.icon}</span><span>${esc(a.text)}</span></div>`).join('')}
    </div>

    <button class="btn btn-outline rep-print" onclick="window.print()">🖨️ طباعة / تصدير PDF</button>

  </div>`;
}

function renderIntelligence(c){
  const sc=computeScore(c);
  const color=scoreColor(sc.total);
  const label=scoreLabel(sc.total);
  const rp=computeRiskProfile(c);
  const rpColor=riskColor(rp.level);
  const clientAlerts=computeAlerts().filter(a=>a.cid===c.id);
  const repeated=c.issues.filter(i=>i.repeatCount>=3);
  const opps=c.issues.filter(i=>i.featureOpp);
  const sourceDist={};
  c.issues.forEach(i=>{const s=i.source||'غير محدد';sourceDist[s]=(sourceDist[s]||0)+1;});

  const sbar=(lbl,val,max,col)=>`<div class="sbar-row">
    <span class="sbar-lbl">${lbl}</span>
    <div class="sbar-track"><div class="sbar-fill" style="width:${max?Math.round(val/max*100):0}%;background:${col}"></div></div>
    <span class="sbar-val">${val}/${max}</span>
  </div>`;

  return`
    <div class="intel-sec">
      <div class="intel-sec-title">نتيجة العميل</div>
      <div class="score-card">
        <div class="score-ring" style="border-color:${color}40">
          <div class="score-ring-num" style="color:${color}">${sc.total}</div>
          <div class="score-ring-lbl">/ 100</div>
        </div>
        <div class="score-details">
          <div class="score-name" style="color:${color}">${label}</div>
          <div class="score-desc">تقييم مبني على 4 محاور: برامج نشطة، تواصل، صحة المشاكل، قيمة المتطلبات</div>
          <div class="sbar-wrap">
            ${sbar('البرامج',sc.prog,35,'#10B981')}
            ${sbar('النشاط',sc.act,25,'#3B82F6')}
            ${sbar('صحة المشاكل',sc.iss,25,'#F97316')}
            ${sbar('المتطلبات',sc.req,15,'#8B5CF6')}
          </div>
        </div>
      </div>
    </div>

    <div class="intel-sec">
      <div class="intel-sec-title">ملف المخاطر</div>
      <div class="intel-card" style="border-right:3px solid ${rpColor}">
        <div class="intelc-title"><span class="bdg ${riskBdg(rp.level)}">${riskLabel(rp.level)}</span></div>
        ${rp.risks.length===0
          ?`<div class="risk-empty">✅ لا توجد مخاطر مكتشفة</div>`
          :rp.risks.map(r=>`<div class="risk-bar"><span class="risk-icon">⚠</span><span class="risk-text">${esc(r)}</span></div>`).join('')}
      </div>
    </div>

    <div class="intel-sec">
      <div class="intel-sec-title">تحليل المشاكل</div>
      ${c.issues.length===0
        ?`<div class="intel-card"><div class="intelc-body" style="color:var(--t3);text-align:center;padding:.5rem 0">لا توجد مشاكل مسجلة لهذا العميل</div></div>`
        :''}
      ${repeated.length>0?`<div class="intel-card">
        <div class="intelc-title">🔁 مشاكل متكررة — تحتاج حلاً جذرياً</div>
        <div class="intelc-body">${repeated.map(i=>`<div class="intelc-item">• ${esc(i.title)} <span class="ic-repeat">× ${i.repeatCount}</span></div>`).join('')}</div>
      </div>`:''}
      ${opps.length>0?`<div class="intel-card">
        <div class="intelc-title">💡 فرص تحويلها لميزات جديدة</div>
        <div class="intelc-body">${opps.map(i=>`<div class="intelc-item">• ${esc(i.title)}</div>`).join('')}</div>
      </div>`:''}
      ${c.issues.length>0?`<div class="intel-card">
        <div class="intelc-title">📊 توزيع مصادر المشاكل</div>
        <div class="source-pills">${Object.entries(sourceDist).map(([s,n])=>`<span class="bdg bdg-gr">${esc(s)}: <strong>${n}</strong></span>`).join('')}</div>
      </div>`:''}
      ${c.issues.length>0&&repeated.length===0&&opps.length===0?`<div class="intel-card">
        <div class="intelc-body" style="color:var(--gt)">✅ لا توجد مشاكل متكررة — الوضع جيد</div>
      </div>`:''}
    </div>

    ${c.issues.length>0?`
    <div class="intel-sec">
      <div class="intel-sec-title">🔬 تحليل الجذر لكل مشكلة</div>
      ${c.issues.filter(i=>i.status!=='مغلق').map(iss=>{
        const causes=analyzeRootCause(iss);
        return`<div class="intel-card">
          <div class="intelc-title">
            ${pBdg(iss.priority)}
            ${esc(iss.title)}
            ${iss.source?`<span class="ic-src ${srcCls(iss.source)}" style="margin-right:auto">${esc(iss.source)}</span>`:''}
          </div>
          <div class="intelc-body">
            ${causes.map(c=>`<div class="cause-item">→ ${esc(c)}</div>`).join('')}
          </div>
        </div>`;}).join('')}
    </div>`:''}

    <div class="intel-sec">
      <div class="intel-sec-title">تنبيهات خاصة بهذا العميل</div>
      ${clientAlerts.length===0
        ?`<div class="intel-card"><div class="intelc-body" style="color:var(--gt)">✅ لا توجد تنبيهات نشطة لهذا العميل</div></div>`
        :clientAlerts.map(a=>`<div class="abanner ${a.level}" style="margin-bottom:6px" onclick="void(0)">
            <span class="ab-icon">${a.icon}</span>
            <div class="ab-body"><div class="ab-title">${a.msg}</div><div class="ab-sub">${a.sub}</div></div>
          </div>`).join('')}
    </div>`;
}

export function renderGlobalIntelligence(){
  const gs=computeGlobalStats();
  const alerts=computeAlerts();
  const crossIssues=gs.crossIssues;
  const impactW={عالي:3,متوسط:2,منخفض:1};const prioW={عاجل:4,عالية:3,متوسطة:2,منخفضة:1};

  return`<div class="gi-overlay" onclick="if(event.target.classList.contains('gi-overlay')){S.gi=false;R()}">
  <div class="gi-sheet">
    <div class="gi-hdr">
      <div class="gi-title">🧠 لوحة الذكاء العالمي</div>
      <button class="mclose" onclick="S.gi=false;R()">×</button>
    </div>

    <div class="gi-kpis">
      <div class="gi-kpi"><div class="gi-kpi-v" style="color:var(--b)">${gs.totalProgsGlobal}</div><div class="gi-kpi-l">برامج · ${gs.totalInstGlobal} جهاز</div></div>
      <div class="gi-kpi"><div class="gi-kpi-v" style="color:${gs.openIssues.length>0?'var(--r)':'var(--g)'}">${gs.openIssues.length}</div><div class="gi-kpi-l">مشاكل مفتوحة</div></div>
      <div class="gi-kpi"><div class="gi-kpi-v" style="color:var(--purple)">${gs.featureOpps.length}</div><div class="gi-kpi-l">فرص ميزات</div></div>
      <div class="gi-kpi"><div class="gi-kpi-v" style="color:${gs.highRiskClients.length>0?'var(--r)':'var(--g)'}">${gs.highRiskClients.length}</div><div class="gi-kpi-l">عملاء في خطر</div></div>
      <div class="gi-kpi"><div class="gi-kpi-v">${gs.avgScore}</div><div class="gi-kpi-l">متوسط نقاط العملاء</div></div>
      <div class="gi-kpi"><div class="gi-kpi-v" style="color:var(--brand)">${alerts.filter(a=>a.level==='urgent').length}</div><div class="gi-kpi-l">تنبيهات عاجلة</div></div>
    </div>

    ${gs.highRiskClients.length>0?`
    <div class="gi-sec">
      <div class="gi-sec-title">⚠️ عملاء في وضع خطر</div>
      ${gs.highRiskClients.map(c=>{
        const rp=computeRiskProfile(c);const sc=computeScore(c);
        return`<div class="gi-card" style="border-right:3px solid var(--r);cursor:pointer" onclick="S.gi=false;selClient(${c.id})">
          <div class="gi-card-title">
            <span class="bdg bdg-r">خطر عالي</span> ${esc(c.fullName)}
            <span class="bdg bdg-gr" style="margin-right:auto">${esc(c.wilaya)}</span>
            <span style="font-size:11px;color:var(--t3)">نقاط: ${sc.total}</span>
          </div>
          <div class="gi-card-body">${rp.risks.map(r=>`<div class="gi-item">• ${esc(r)}</div>`).join('')}</div>
        </div>`;}).join('')}
    </div>`:''}

    ${crossIssues.length>0?`
    <div class="gi-sec">
      <div class="gi-sec-title">🔁 مشاكل متكررة عبر عدة عملاء — مشاكل نظامية</div>
      ${crossIssues.map(ci=>`<div class="gi-card">
        <div class="gi-card-title">
          <span class="bdg bdg-o">${esc(ci.type)}</span>
          <span style="margin-right:auto;font-size:11px;color:var(--t3)">${ci.count} حالة / ${ci.clientNames.length} عملاء</span>
        </div>
        <div class="gi-card-body">
          ${ci.items.slice(0,3).map(i=>`<div class="gi-item">• <span style="color:var(--t1)">${esc(i.title)}</span></div>`).join('')}
          <div class="cross-clients">العملاء: ${ci.clientNames.map(esc).join(' ، ')}</div>
        </div>
      </div>`).join('')}
    </div>`:''}

    ${gs.featureOpps.length>0?`
    <div class="gi-sec">
      <div class="gi-sec-title">💡 فرص ميزات محتملة (من المشاكل)</div>
      ${gs.featureOpps.slice(0,5).map(f=>`<div class="gi-card" style="cursor:pointer" onclick="S.gi=false;selClient(${f.clientId})">
        <div class="gi-card-title">💡 ${esc(f.title)}</div>
        <div class="gi-card-body">العميل: ${esc(f.clientName)} — تكرار: ${f.repeatCount} مرة — مصدر: ${esc(f.source)}</div>
      </div>`).join('')}
    </div>`:''}

    ${gs.topReqs.length>0?`
    <div class="gi-sec">
      <div class="gi-sec-title">📋 أهم المتطلبات (مرتبة بالتأثير والأولوية)</div>
      ${gs.topReqs.map(r=>`<div class="gi-card" style="cursor:pointer" onclick="S.gi=false;selClient(${r.clientId})">
        <div class="gi-card-title">${esc(r.title)}</div>
        <div class="gi-card-body">${esc(r.clientName)} — ${esc(r.type)} — تأثير ${esc(r.impact)} — ${esc(r.status)}</div>
      </div>`).join('')}
    </div>`:''}

  </div>
</div>`;
}

import { t } from '../utils/i18n.js';
import { cOpts } from '../utils/index.js';
import { getWilayasList } from '../utils/algeria.js';

function renderAdvFilterPanel(){
  const cnt=countAdvFil();
  const wilayas=getWilayasList().map(w => w.name_ar); 
  const activities=BUSINESS_TYPES;
  const actTypes=S.fActivity
    ?getActTypes(S.fActivity)
    :[...new Set(clients.map(c=>c.businessField).filter(Boolean))].sort();
  const programs=[...new Set(clients.flatMap(c=>(c.programs||[]).map(p=>p.programName)).filter(Boolean))].sort();
  const opt=(arr,cur)=>`<option value="">${t('الكل')}</option>`+arr.map(v=>`<option value="${v}"${cur===v?' selected':''}>${v}</option>`).join('');
  const totalFiltered=applyFilters(clients).length;
  
  const optW = () => `<option value="">${t('الكل')}</option>` + wOpts(S.fWilaya);

  return`
  <div class="adv-fil-panel${S.showAdvFil?'':' hidden'}">
    <div class="adf-group">
      <div class="adf-lbl">${t('الولاية')}</div>
      <select class="adf-sel${S.fWilaya?' has-val':''}" onchange="setAdvFil('fWilaya',this.value)">${optW()}</select>
    </div>
    <div class="adf-group">
      <div class="adf-lbl">${t('البلدية')}</div>
      <select class="adf-sel${S.fCommune?' has-val':''}" onchange="setAdvFil('fCommune',this.value)">
        <option value="">${t('الكل')}</option>
        ${cOpts(S.fWilaya, S.fCommune)}
      </select>
    </div>
    <div class="adf-group">
      <div class="adf-lbl">النشاط الرئيسي</div>
      <select class="adf-sel${S.fActivity?' has-val':''}" onchange="setAdvFil('fActivity',this.value)">
        ${`<option value="">${t('الكل')}</option>`+activities.map(a=>`<option value="${a}"${S.fActivity===a?' selected':''}>${activityIcon(a)} ${a}</option>`).join('')}
      </select>
    </div>
    <div class="adf-group">
      <div class="adf-lbl">تخصص النشاط${S.fActivity?` (${S.fActivity})`:''}</div>
      <select class="adf-sel${S.fActType?' has-val':''}" onchange="setAdvFil('fActType',this.value)">${opt(actTypes,S.fActType)}</select>
    </div>
    <div class="adf-group">
      <div class="adf-lbl">البرنامج</div>
      <select class="adf-sel${S.fProgram?' has-val':''}" onchange="setAdvFil('fProgram',this.value)">${opt(programs,S.fProgram)}</select>
    </div>
    <div class="adv-fil-footer">
      <span class="adv-fil-summary">${cnt>0?`<strong>${totalFiltered}</strong> نتيجة بعد تطبيق ${cnt} فلتر`:`عرض جميع العملاء (${clients.length})`}</span>
      ${cnt>0?`<button class="btn btn-ghost btn-xs" onclick="clearAdvFil()">✕ مسح الفلاتر</button>`:''}
    </div>
  </div>`;
}

function renderTimeline(c) {
  const list = S.clientActivities || [];
  return `
    <div class="pane-hdr">
      <span class="pane-title">الخط الزمني للنشاط (${list.length})</span>
      <button class="btn btn-outline btn-sm" onclick="loadClientTimeline(${c.id})">🔄 تحديث</button>
    </div>
    ${list.length === 0
      ? `<div class="empty"><div class="empty-icon">⏱️</div><div class="empty-text">لا توجد أحداث مسجلة للعميل حتى الآن. سيتم تسجيل التفاعلات تلقائياً هنا.</div></div>`
      : `<div class="timeline-v3" style="position:relative;padding-right:1.5rem;border-right:2px solid var(--border);margin-top:1.5rem;display:flex;flex-direction:column;gap:1.5rem">
          ${list.map((act) => {
            const vis = getActivityVisuals(act.type);
            const dateStr = new Date(act.timestamp).toLocaleString('ar-DZ', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            });
            return `
              <div class="tl-v3-item" style="position:relative">
                <!-- Dot Icon -->
                <div class="tl-v3-icon" style="position:absolute;right:calc(-1.5rem - 13px);top:2px;width:24px;height:24px;border-radius:50%;background:var(--surface);border:2px solid var(--border);display:flex;align-items:center;justify-content:center;font-size:12px;z-index:1" title="${vis.label}">
                  ${vis.icon}
                </div>
                <!-- Content Card -->
                <div class="tl-v3-card" style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-md);padding:1rem;display:flex;flex-direction:column;gap:0.5rem">
                  <div style="display:flex;align-items:center;justify-content:between;gap:8px;flex-wrap:wrap">
                    <span class="bdg ${vis.colorClass}" style="font-size:10px;font-weight:600;padding:2px 8px;border-radius:999px;border:1px solid transparent">
                      ${vis.label}
                    </span>
                    <span style="font-size:11px;color:var(--t3);margin-right:auto" dir="ltr">
                      ${dateStr}
                    </span>
                  </div>
                  <div style="font-size:13px;font-weight:700;color:var(--t1)">${esc(act.title)}</div>
                  <div style="font-size:12px;color:var(--t2);line-height:1.5">${esc(act.description)}</div>
                  ${act.actorEmail ? `<div style="font-size:10px;color:var(--t3);display:flex;align-items:center;gap:4px">
                    <span>👤 المنفذ:</span>
                    <strong>${esc(act.actorEmail)}</strong>
                  </div>` : ''}
                </div>
              </div>
            `;
          }).join('')}
        </div>`
    }
  `;
}

export function renderDashboard() {
  // Ensure dashboard state properties are initialized
  S.dbFilterWilaya = S.dbFilterWilaya || 'all';
  S.dbFilterProg = S.dbFilterProg || 'all';
  S.dbFilterTier = S.dbFilterTier || 'all';
  S.dbSearchQuery = S.dbSearchQuery || '';
  S.dbSortKey = S.dbSortKey || 'score';
  S.dbSortDir = S.dbSortDir || 'desc';

  // 1. Compute dynamic list of Wilayas and Licensed Programs for selection options
  const uniqueWilayas = [...new Set(clients.map(c => c.wilaya).filter(Boolean))].sort();
  const uniquePrograms = [...new Set(clients.flatMap(c => (c.programs || []).map(p => p.programName).filter(Boolean)))].sort();

  // Helper score categorization
  function getScoreStyle(score) {
    if (score >= 75) return { text: 'ممتاز', color: '#10B981', bg: 'rgba(16, 185, 129, 0.1)', border: '#10B981', class: 'excellent' };
    if (score >= 50) return { text: 'مستقر', color: '#3B82F6', bg: 'rgba(59, 130, 246, 0.1)', border: '#3B82F6', class: 'good' };
    if (score >= 25) return { text: 'متابعة', color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.1)', border: '#F59E0B', class: 'warning' };
    return { text: 'خطر عالي', color: '#EF4444', bg: 'rgba(239, 68, 68, 0.1)', border: '#EF4444', class: 'critical' };
  }

    // 2. Filter clients based on dynamic interactive filters
  let filteredClients = clients;
  
  if (S.dbSearchQuery) {
    const searchResults = performSearch(S.dbSearchQuery);
    if (searchResults) {
      const matchedIds = new Set(searchResults.map(r => r.id));
      filteredClients = filteredClients.filter(c => matchedIds.has(c.id));
    }
  }

  filteredClients = filteredClients.filter(c => {
    // Wilaya filter
    if (S.dbFilterWilaya !== 'all' && c.wilaya !== S.dbFilterWilaya) return false;
    // Licensed Program filter
    if (S.dbFilterProg !== 'all') {
      const hasProg = (c.programs || []).some(p => p.programName === S.dbFilterProg);
      if (!hasProg) return false;
    }
    // Health Tier filter
    if (S.dbFilterTier !== 'all') {
      const score = computeScore(c).total;
      const style = getScoreStyle(score);
      if (style.class !== S.dbFilterTier) return false;
    }
    return true;
  });

  // 3. Sort clients based on sort criteria
  const sortedClients = [...filteredClients].sort((a, b) => {
    let valA, valB;
    if (S.dbSortKey === 'name') {
      valA = a.fullName || '';
      valB = b.fullName || '';
    } else if (S.dbSortKey === 'score') {
      valA = computeScore(a).total;
      valB = computeScore(b).total;
    } else if (S.dbSortKey === 'programs') {
      valA = (a.programs || []).length;
      valB = (b.programs || []).length;
    } else if (S.dbSortKey === 'issues') {
      valA = (a.issues || []).filter(i => i.status === 'مفتوح' || i.status === 'قيد المعالجة').length;
      valB = (b.issues || []).filter(i => i.status === 'مفتوح' || i.status === 'قيد المعالجة').length;
    } else {
      valA = computeScore(a).total;
      valB = computeScore(b).total;
    }

    if (valA < valB) return S.dbSortDir === 'asc' ? -1 : 1;
    if (valA > valB) return S.dbSortDir === 'asc' ? 1 : -1;
    return 0;
  });

  // 4. Compute statistics for current filtered list of clients
  const totalFilteredCount = filteredClients.length;
  const avgFilteredScore = totalFilteredCount ? Math.round(filteredClients.reduce((sum, c) => sum + computeScore(c).total, 0) / totalFilteredCount) : 0;
  const totalFilteredInstalls = filteredClients.reduce((sum, c) => sum + (c.programs || []).reduce((pSum, p) => pSum + (Number(p.installationsCount) || 1), 0), 0);
  const totalFilteredIssues = filteredClients.reduce((sum, c) => sum + (c.issues || []).filter(i => i.status === 'مفتوح' || i.status === 'قيد المعالجة').length, 0);

  // Health Tier distributions (filtered)
  const tierExcellent = filteredClients.filter(c => computeScore(c).total >= 75);
  const tierGood = filteredClients.filter(c => { const s = computeScore(c).total; return s >= 50 && s < 75; });
  const tierWarning = filteredClients.filter(c => { const s = computeScore(c).total; return s >= 25 && s < 50; });
  const tierCritical = filteredClients.filter(c => computeScore(c).total < 25);

  const pctExcellent = Math.round((tierExcellent.length / (totalFilteredCount || 1)) * 100);
  const pctGood = Math.round((tierGood.length / (totalFilteredCount || 1)) * 100);
  const pctWarning = Math.round((tierWarning.length / (totalFilteredCount || 1)) * 100);
  const pctCritical = Math.round((tierCritical.length / (totalFilteredCount || 1)) * 100);

  // Regional (Wilayas) distribution for filtered clients
  const wilayaCounts = {};
  filteredClients.forEach(c => {
    if (c.wilaya) {
      wilayaCounts[c.wilaya] = (wilayaCounts[c.wilaya] || 0) + 1;
    }
  });
  const sortedWilayas = Object.entries(wilayaCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Program licensing distribution for filtered clients
  const programCounts = {};
  const programInstalls = {};
  filteredClients.forEach(c => {
    (c.programs || []).forEach(p => {
      if (p.programName) {
        programCounts[p.programName] = (programCounts[p.programName] || 0) + 1;
        programInstalls[p.programName] = (programInstalls[p.programName] || 0) + (Number(p.installationsCount) || 1);
      }
    });
  });
  const sortedPrograms = Object.entries(programCounts)
    .map(([name, count]) => ({ name, count, installs: programInstalls[name] || 0 }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // 5. Generate AI Smart Sentinel Advisor Alerts (filtered)
  const recs = [];
  filteredClients.forEach(c => {
    const rp = computeRiskProfile(c);
    const sc = computeScore(c);
    
    // Expired or expiring contract
    if (c.endDate) {
      const dl = Math.floor((new Date(c.endDate+'T00:00').getTime() - Date.now()) / 86400000);
      if (dl < 0 && c.status === 'نشط') {
        recs.push({
          type: 'danger',
          icon: '📅',
          title: `عقد منتهي للعميل "${c.fullName}"`,
          desc: `انتهى العقد بتاريخ ${fmtD(c.endDate)} والعميل لا يزال مسجلاً بنظام التشغيل "نشط". يرجى اتخاذ إجراء للتجديد السريع.`,
          clientId: c.id
        });
      } else if (dl >= 0 && dl <= 15) {
        recs.push({
          type: 'warning',
          icon: '⏳',
          title: `قرب انتهاء عقد "${c.fullName}"`,
          desc: `ينتهي عقد الشريك خلال ${dl} أيام فقط (تاريخ الانتهاء: ${fmtD(c.endDate)}). يوصى بإعداد مسودة التجديد والاتصال به.`,
          clientId: c.id
        });
      }
    }
    
    // High risk level or critical health score
    if (rp.level === 'high') {
      recs.push({
        type: 'danger',
        icon: '🚨',
        title: `ملف خطر عالي للعميل "${c.fullName}"`,
        desc: `تراجع مؤشر الصحة لمستوى حرج (${sc.total}/100). المسببات النشطة: ${rp.risks.join(' ، ')}.`,
        clientId: c.id
      });
    }

    // High support tickets overload
    const openUrgent = (c.issues || []).filter(i => i.priority === 'عاجل' && (i.status === 'مفتوح' || i.status === 'قيد المعالجة'));
    if (openUrgent.length > 0) {
      recs.push({
        type: 'urgent',
        icon: '⚡',
        title: `مشاكل عاجلة معلقة لـ "${c.fullName}"`,
        desc: `يوجد لدى العميل تذاكر معلقة ذات أولوية عالية تتطلب تدخلاً سريعاً: "${openUrgent[0].title}".`,
        clientId: c.id
      });
    }

    // No communication for long periods of time
    if (c.lastContact && c.status === 'نشط') {
      const ds = Math.floor((Date.now() - new Date(c.lastContact+'T00:00').getTime()) / 86400000);
      if (ds >= 45) {
        recs.push({
          type: 'info',
          icon: '📞',
          title: `انقطاع تواصل مع العميل "${c.fullName}"`,
          desc: `مضى أكثر من ${ds} يوماً دون تسجيل أي نشاط أو مكالمة تواصل مع العميل. يوصى بإجراء تواصل دوري سريع.`,
          clientId: c.id
        });
      }
    }
  });

  // Sort recommendations so danger displays first
  const rank = { danger: 1, urgent: 2, warning: 3, info: 4 };
  recs.sort((a, b) => rank[a.type] - rank[b.type]);
  const visibleRecs = recs.slice(0, 6);

  // Sorting columns helper to show visual arrows
  function getSortIndicator(key) {
    if (S.dbSortKey !== key) return '↕️';
    return S.dbSortDir === 'asc' ? '▲' : '▼';
  }

  // Toggle sort helper function call (bound globally)
  window.toggleDbSort = function(key) {
    if (S.dbSortKey === key) {
      S.dbSortDir = S.dbSortDir === 'asc' ? 'desc' : 'asc';
    } else {
      S.dbSortKey = key;
      S.dbSortDir = 'desc';
    }
    R();
  };

  // HTML Rendering
  window.__dashboardFilteredClients = filteredClients;

  if (clients.length === 0) {
    return `
      <style>
        @keyframes floatDash {
          0% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
          100% { transform: translateY(0px); }
        }
      </style>
      <div class="dashboard-wrapper" style="display:flex; flex-direction:column; gap:1.5rem; text-align:center; min-height:60vh; justify-content:center; align-items:center;">
        <div style="background:var(--surface); border:1px solid var(--border); border-radius:var(--r-lg); padding:3rem 2rem; max-width:500px; width:100%; box-shadow:0 10px 25px rgba(0,0,0,0.05);">
          <div style="font-size:64px; margin-bottom:1rem; animation: floatDash 3s ease-in-out infinite;">✨</div>
          <h2 style="color:var(--t1); font-size:24px; font-weight:800; margin-bottom:0.75rem;">أهلاً بك في منصة إدارة العملاء</h2>
          <p style="color:var(--t3); font-size:14px; line-height:1.6; margin-bottom:2rem;">
            تبدو لوحة التحكم فارغة حالياً. ابدأ بإضافة أول عميل لك لتتمكن من تتبع البرامج، التراخيص، وإدارة تذاكر الدعم الفني بكل سهولة.
          </p>
          <button class="btn btn-primary" onclick="openModal('addClient')" style="padding:12px 24px; font-size:15px; border-radius:12px; display:inline-flex; align-items:center; gap:8px; box-shadow:0 4px 14px rgba(139, 92, 246, 0.4);">
            <span>+</span>
            <span>ابدأ بإضافة أول عميل</span>
          </button>
        </div>
      </div>
    `;
  }
  
  return `
    <div class="dashboard-wrapper" style="display:flex; flex-direction:column; gap:1.5rem; text-align:right;">
      
      <!-- HEADER PARTNER WELCOME BANNER -->
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:16px; border-bottom:1px solid var(--border); padding-bottom:1.25rem; margin-bottom:0.25rem">
        <div style="display:flex; align-items:center; gap:14px">
          <div style="width:54px; height:54px; border-radius:16px; background:linear-gradient(135deg, var(--dash-p) 0%, #EC4899 100%); display:flex; align-items:center; justify-content:center; color:#fff; font-size:20px; font-weight:800; box-shadow:0 6px 16px rgba(139, 92, 246, 0.25)">
            ${(S.currentUser?.email || 'A').charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 style="font-size:22px; font-weight:800; color:var(--t1); margin:0; display:flex; align-items:center; gap:8px">
              <span>مرحباً بك مجدداً،</span>
              <span style="color:var(--dash-p)">${esc((S.currentUser?.email || 'المشرف').split('@')[0])}</span>
            </h1>
            <p style="font-size:12.5px; color:var(--t3); margin:4px 0 0 0">
              مراقبة وتحليل فوري لمؤشرات الصحة، التراخيص الفعالة للعملاء، والتمركز الإقليمي.
            </p>
          </div>
        </div>
        
        <div style="display:flex; gap:10px; flex-wrap:wrap">
          <button class="btn btn-outline" onclick="exportToCSV()" style="font-size:12px; padding:8px 14px; display:flex; align-items:center; gap:6px; border-radius:12px">
            <span>📥</span> تصدير البيانات (CSV)
          </button>
          <button class="btn" onclick="resetDbFilters()" style="font-size:12px; padding:8px 14px; display:flex; align-items:center; gap:6px; background:var(--border-soft); border:1px solid var(--border); color:var(--t2); border-radius:12px">
            <span>🧹</span> إعادة ضبط التصفية
          </button>
        </div>
      </div>

      <!-- INTERACTIVE FILTERS PANEL (Bento-style Ribbon) -->
      <div class="dash-v-card dash-glow-purple" style="padding:1.25rem; margin-bottom:0.25rem">
        <div style="font-size:13px; font-weight:800; color:var(--dash-p); margin-bottom:0.85rem; display:flex; align-items:center; gap:8px">
          <span>🔍</span> فلاتر تصفية حية للبيانات وأدوات الفرز التفاعلي
        </div>
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(210px, 1fr)); gap:12px">
          
          <!-- Filter 1: Wilaya -->
          <div style="display:flex; flex-direction:column; gap:5px">
            <label style="font-size:11px; font-weight:700; color:var(--t3)">📍 الولاية الجغرافية</label>
            <select class="premium-select" onchange="setDbFilter('dbFilterWilaya', this.value)">
              <option value="all" ${S.dbFilterWilaya === 'all' ? 'selected' : ''}>كل الولايات الجغرافية (${uniqueWilayas.length})</option>
              ${uniqueWilayas.map(w => `<option value="${w}" ${S.dbFilterWilaya === w ? 'selected' : ''}>${w}</option>`).join('')}
            </select>
          </div>

          <!-- Filter 2: Program licensed -->
          <div style="display:flex; flex-direction:column; gap:5px">
            <label style="font-size:11px; font-weight:700; color:var(--t3)">💻 فئة الترخيص النشط</label>
            <select class="premium-select" onchange="setDbFilter('dbFilterProg', this.value)">
              <option value="all" ${S.dbFilterProg === 'all' ? 'selected' : ''}>كل البرامج المرخصة (${uniquePrograms.length})</option>
              ${uniquePrograms.map(p => `<option value="${p}" ${S.dbFilterProg === p ? 'selected' : ''}>${p}</option>`).join('')}
            </select>
          </div>

          <!-- Filter 3: Health Tier -->
          <div style="display:flex; flex-direction:column; gap:5px">
            <label style="font-size:11px; font-weight:700; color:var(--t3)">🛡️ مؤشر السلامة والأداء</label>
            <select class="premium-select" onchange="setDbFilter('dbFilterTier', this.value)">
              <option value="all" ${S.dbFilterTier === 'all' ? 'selected' : ''}>جميع مستويات الصحة</option>
              <option value="excellent" ${S.dbFilterTier === 'excellent' ? 'selected' : ''}>🌟 ممتاز (75 - 100)</option>
              <option value="good" ${S.dbFilterTier === 'good' ? 'selected' : ''}>👍 مستقر (50 - 74)</option>
              <option value="warning" ${S.dbFilterTier === 'warning' ? 'selected' : ''}>⚠️ متابعة لازمة (25 - 49)</option>
              <option value="critical" ${S.dbFilterTier === 'critical' ? 'selected' : ''}>🚨 خطر مرتفع (0 - 24)</option>
            </select>
          </div>

          <!-- Filter 4: Search input -->
          <div style="display:flex; flex-direction:column; gap:5px">
            <label style="font-size:11px; font-weight:700; color:var(--t3)">✍️ بحث سريع ومباشر</label>
            <div style="position:relative; display:flex; align-items:center">
              <input type="text" class="premium-search" style="margin:0" placeholder="ابحث باسم الشريك أو الشركة..." value="${esc(S.dbSearchQuery)}" oninput="setDbFilter('dbSearchQuery', this.value)">
              ${S.dbSearchQuery ? `
                <span style="position:absolute; left:12px; cursor:pointer; color:var(--t3); font-weight:700" onclick="setDbFilter('dbSearchQuery', '')">×</span>
              ` : `
                <span style="position:absolute; left:12px; color:var(--t3); font-size:12px">🔍</span>
              `}
            </div>
          </div>

        </div>
      </div>

      <!-- PREMIUM BENTO KPI TILES GRID WITH SPARKLINE GRAPHS -->
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(230px, 1fr)); gap:1.25rem">
        
        <!-- Tile 1: Target Clients (Violet Glow) -->
        <div class="dash-v-card dash-glow-purple" style="display:flex; flex-direction:column; justify-content:space-between">
          <div>
            <div style="display:flex; justify-content:space-between; align-items:center">
              <span style="font-size:12px; font-weight:700; color:var(--t3)">العملاء المصفّون</span>
              <span style="font-size:16px; background:var(--dash-p-glow); color:var(--dash-p); padding:6px; border-radius:8px">👥</span>
            </div>
            
            <div class="kpi-spark-container">
              <div class="kpi-spark-meta">
                <span class="kpi-spark-val">${totalFilteredCount}</span>
                <span class="kpi-spark-change up">
                  <span>من ${clients.length} إجمالي</span>
                </span>
              </div>
              
              <!-- Sparkline SVG -->
              <svg viewBox="0 0 100 35" class="kpi-spark-chart">
                <defs>
                  <linearGradient id="g-purple" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="#8B5CF6" stop-opacity="0.3"/>
                    <stop offset="100%" stop-color="#8B5CF6" stop-opacity="0.0"/>
                  </linearGradient>
                </defs>
                <path d="M 0 35 L 0 25 Q 15 10 30 20 T 60 5 T 90 15 T 100 8 L 100 35 Z" fill="url(#g-purple)" />
                <path d="M 0 25 Q 15 10 30 20 T 60 5 T 90 15 T 100 8" fill="none" stroke="#8B5CF6" stroke-width="2" stroke-linecap="round" />
              </svg>
            </div>
          </div>
          <div style="font-size:11px; color:var(--t2); border-top:1px solid var(--border-soft); margin-top:10px; padding-top:8px">
            <span>•</span> النشطون تشغيلياً: <strong>${filteredClients.filter(c => c.status === 'نشط').length}</strong> شريك فعال
          </div>
        </div>

        <!-- Tile 2: Health Index (Green Glow) -->
        <div class="dash-v-card dash-glow-blue" style="display:flex; flex-direction:column; justify-content:space-between">
          <div>
            <div style="display:flex; justify-content:space-between; align-items:center">
              <span style="font-size:12px; font-weight:700; color:var(--t3)">مؤشر السلامة العام</span>
              <span style="font-size:16px; background:rgba(16, 185, 129, 0.1); color:#10B981; padding:6px; border-radius:8px">❤️</span>
            </div>
            
            <div class="kpi-spark-container">
              <div class="kpi-spark-meta">
                <span class="kpi-spark-val" style="color:#10B981">${avgFilteredScore}%</span>
                <span class="kpi-spark-change up">
                  <span>امتثال ممتاز</span>
                </span>
              </div>
              
              <!-- Sparkline SVG -->
              <svg viewBox="0 0 100 35" class="kpi-spark-chart">
                <defs>
                  <linearGradient id="g-green" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="#10B981" stop-opacity="0.3"/>
                    <stop offset="100%" stop-color="#10B981" stop-opacity="0.0"/>
                  </linearGradient>
                </defs>
                <path d="M 0 35 L 0 18 Q 20 28 40 10 T 80 15 T 100 5 L 100 35 Z" fill="url(#g-green)" />
                <path d="M 0 18 Q 20 28 40 10 T 80 15 T 100 5" fill="none" stroke="#10B981" stroke-width="2" stroke-linecap="round" />
              </svg>
            </div>
          </div>
          <div style="font-size:11px; color:var(--t2); border-top:1px solid var(--border-soft); margin-top:10px; padding-top:8px">
            مستوى رضا واعتمادية تشغيلية مرتفعة جداً
          </div>
        </div>

        <!-- Tile 3: Licensed Devices (Blue Glow) -->
        <div class="dash-v-card dash-glow-blue" style="display:flex; flex-direction:column; justify-content:space-between">
          <div>
            <div style="display:flex; justify-content:space-between; align-items:center">
              <span style="font-size:12px; font-weight:700; color:var(--t3)">إجمالي التراخيص النشطة</span>
              <span style="font-size:16px; background:rgba(59, 130, 246, 0.1); color:#3B82F6; padding:6px; border-radius:8px">💻</span>
            </div>
            
            <div class="kpi-spark-container">
              <div class="kpi-spark-meta">
                <span class="kpi-spark-val" style="color:#3B82F6">${totalFilteredInstalls}</span>
                <span class="kpi-spark-change up">
                  <span>جهاز مرخص</span>
                </span>
              </div>
              
              <!-- Sparkline SVG -->
              <svg viewBox="0 0 100 35" class="kpi-spark-chart">
                <defs>
                  <linearGradient id="g-blue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="#3B82F6" stop-opacity="0.3"/>
                    <stop offset="100%" stop-color="#3B82F6" stop-opacity="0.0"/>
                  </linearGradient>
                </defs>
                <path d="M 0 35 L 0 30 Q 25 5 50 22 T 85 10 T 100 15 L 100 35 Z" fill="url(#g-blue)" />
                <path d="M 0 30 Q 25 5 50 22 T 85 10 T 100 15" fill="none" stroke="#3B82F6" stroke-width="2" stroke-linecap="round" />
              </svg>
            </div>
          </div>
          <div style="font-size:11px; color:var(--t2); border-top:1px solid var(--border-soft); margin-top:10px; padding-top:8px">
            معدل: <strong>${totalFilteredCount ? Math.round(totalFilteredInstalls / totalFilteredCount) : 0}</strong> ترخيص مبيعات/شريك
          </div>
        </div>

        <!-- Tile 4: Support tickets (Pink/Red Glow) -->
        <div class="dash-v-card dash-glow-pink" style="display:flex; flex-direction:column; justify-content:space-between">
          <div>
            <div style="display:flex; justify-content:space-between; align-items:center">
              <span style="font-size:12px; font-weight:700; color:var(--t3)">المشاكل والطلبات المعلقة</span>
              <span style="font-size:16px; background:rgba(239, 68, 68, 0.1); color:#EF4444; padding:6px; border-radius:8px">⚠️</span>
            </div>
            
            <div class="kpi-spark-container">
              <div class="kpi-spark-meta">
                <span class="kpi-spark-val" style="color:${totalFilteredIssues > 0 ? '#EF4444' : '#10B981'}">${totalFilteredIssues}</span>
                <span class="kpi-spark-change down" style="color:${totalFilteredIssues > 0 ? '#EF4444' : '#10B981'}">
                  <span>تذاكر مفتوحة حالياً</span>
                </span>
              </div>
              
              <!-- Sparkline SVG -->
              <svg viewBox="0 0 100 35" class="kpi-spark-chart">
                <defs>
                  <linearGradient id="g-red" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="#EF4444" stop-opacity="0.3"/>
                    <stop offset="100%" stop-color="#EF4444" stop-opacity="0.0"/>
                  </linearGradient>
                </defs>
                <path d="M 0 35 L 0 10 Q 15 25 35 15 T 70 30 T 100 20 L 100 35 Z" fill="url(#g-red)" />
                <path d="M 0 10 Q 15 25 35 15 T 70 30 T 100 20" fill="none" stroke="#EF4444" stroke-width="2" stroke-linecap="round" />
              </svg>
            </div>
          </div>
          <div style="font-size:11px; color:var(--t2); border-top:1px solid var(--border-soft); margin-top:10px; padding-top:8px">
            منها <strong>${filteredClients.flatMap(c => c.issues || []).filter(i => i.priority === 'عاجل' && (i.status === 'مفتوح' || i.status === 'قيد المعالجة')).length}</strong> مشكلة حرجة للغاية
          </div>
        </div>

      </div>

      <!-- HIGH-FIDELITY MAIN COMPARATIVE AREA CHART GRAPH -->
      <div class="dash-v-card dash-glow-purple" style="padding:1.5rem">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem; flex-wrap:wrap; gap:10px">
          <div>
            <h3 style="font-size:15px; font-weight:800; color:var(--t1); margin:0; display:flex; align-items:center; gap:8px">
              <span>📈</span> معدل تراخيص الأجهزة والنشاط الشهري (تحديث حي)
            </h3>
            <p style="font-size:11.5px; color:var(--t3); margin:4px 0 0 0">تحليل مقارن لنشاط مبيعات البرامج الفعالة في المقابل وتيرة الاتصالات والطلبات الفنية للعملاء المصفين</p>
          </div>
          
          <!-- Legend -->
          <div style="display:flex; gap:16px; font-size:11px; font-weight:700">
            <div style="display:flex; align-items:center; gap:6px">
              <span style="width:12px; height:4px; background:#8B5CF6; border-radius:2px; display:inline-block"></span>
              <span style="color:var(--t2)">تراخيص الأجهزة النشطة (معدل)</span>
            </div>
            <div style="display:flex; align-items:center; gap:6px">
              <span style="width:12px; height:4px; background:#EC4899; border-radius:2px; display:inline-block"></span>
              <span style="color:var(--t2)">تذاكر ومكالمات الدعم الفني</span>
            </div>
          </div>
        </div>
        
        <!-- Interactive Recharts Graph Container -->
        <div id="recharts-chart-container" style="width:100%; height:230px; direction: ltr; margin-top: 10px;">
          <div style="display:flex; justify-content:center; align-items:center; height:100%; color:var(--t3); font-size:12px;">
            جاري تشغيل المخطط البياني التفاعلي Recharts...
          </div>
        </div>
      </div>

      <!-- SPENDING PARAMETERS - CONCENTRIC RADIAL PROGRESS RINGS -->
      <div class="dash-v-card" style="padding:1.5rem">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem">
          <div>
            <h3 style="font-size:15px; font-weight:800; color:var(--t1); margin:0">📊 توزيع جودة وصحة حسابات الشركاء (Concentric Gauges)</h3>
            <p style="font-size:11.5px; color:var(--t3); margin:4px 0 0 0">مستويات السلامة والأداء مجمعة للعملاء النشطين بنسب مئوية تفاعلية</p>
          </div>
          <span style="font-size:11px; background:var(--dash-p-light); color:var(--dash-p-dark); padding:3px 9px; border-radius:12px; font-weight:700">محدثة دورياً</span>
        </div>
        
        <div class="radial-params-container">
          
          <!-- Gauge 1: Excellent -->
          <div class="radial-param-card" style="cursor:pointer" onclick="setDbFilter('dbFilterTier', 'excellent')" title="انقر لعرض عملاء الفئة الممتازة">
            <div class="radial-svg-box">
              <svg viewBox="0 0 80 80" width="100%" height="100%">
                <circle class="radial-svg-circle-bg" cx="40" cy="40" r="35"/>
                <circle class="radial-svg-circle-fill" cx="40" cy="40" r="35" stroke="#10B981" 
                  stroke-dasharray="220" stroke-dashoffset="${220 - (220 * pctExcellent) / 100}"/>
              </svg>
              <div class="radial-percentage">${pctExcellent}%</div>
            </div>
            <div style="font-size:13px; font-weight:700; color:#10B981">🌟 ممتاز (75-100)</div>
            <div style="font-size:11px; color:var(--t3)">${tierExcellent.length} عملاء</div>
          </div>

          <!-- Gauge 2: Stable -->
          <div class="radial-param-card" style="cursor:pointer" onclick="setDbFilter('dbFilterTier', 'good')" title="انقر لعرض عملاء الفئة المستقرة">
            <div class="radial-svg-box">
              <svg viewBox="0 0 80 80" width="100%" height="100%">
                <circle class="radial-svg-circle-bg" cx="40" cy="40" r="35"/>
                <circle class="radial-svg-circle-fill" cx="40" cy="40" r="35" stroke="#3B82F6" 
                  stroke-dasharray="220" stroke-dashoffset="${220 - (220 * pctGood) / 100}"/>
              </svg>
              <div class="radial-percentage">${pctGood}%</div>
            </div>
            <div style="font-size:13px; font-weight:700; color:#3B82F6">👍 مستقر (50-74)</div>
            <div style="font-size:11px; color:var(--t3)">${tierGood.length} عملاء</div>
          </div>

          <!-- Gauge 3: Warning -->
          <div class="radial-param-card" style="cursor:pointer" onclick="setDbFilter('dbFilterTier', 'warning')" title="انقر لعرض عملاء المتابعة">
            <div class="radial-svg-box">
              <svg viewBox="0 0 80 80" width="100%" height="100%">
                <circle class="radial-svg-circle-bg" cx="40" cy="40" r="35"/>
                <circle class="radial-svg-circle-fill" cx="40" cy="40" r="35" stroke="#F59E0B" 
                  stroke-dasharray="220" stroke-dashoffset="${220 - (220 * pctWarning) / 100}"/>
              </svg>
              <div class="radial-percentage">${pctWarning}%</div>
            </div>
            <div style="font-size:13px; font-weight:700; color:#F59E0B">⚠️ متابعة (25-49)</div>
            <div style="font-size:11px; color:var(--t3)">${tierWarning.length} عملاء</div>
          </div>

          <!-- Gauge 4: High Risk -->
          <div class="radial-param-card" style="cursor:pointer" onclick="setDbFilter('dbFilterTier', 'critical')" title="انقر لعرض عملاء الخطر العالي">
            <div class="radial-svg-box">
              <svg viewBox="0 0 80 80" width="100%" height="100%">
                <circle class="radial-svg-circle-bg" cx="40" cy="40" r="35"/>
                <circle class="radial-svg-circle-fill" cx="40" cy="40" r="35" stroke="#EF4444" 
                  stroke-dasharray="220" stroke-dashoffset="${220 - (220 * pctCritical) / 100}"/>
              </svg>
              <div class="radial-percentage">${pctCritical}%</div>
            </div>
            <div style="font-size:13px; font-weight:700; color:#EF4444">🚨 خطر (0-24)</div>
            <div style="font-size:11px; color:var(--t3)">${tierCritical.length} عملاء</div>
          </div>

        </div>
      </div>

      <!-- MAIN SECTION: PREMIUM INTERACTIVE DRILLDOWN TABLE -->
      <div class="dash-v-card" style="padding:1.5rem; overflow:hidden">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.25rem; flex-wrap:wrap; gap:8px">
          <div>
            <h3 style="font-size:15px; font-weight:800; color:var(--t1); margin:0">📋 سجل ومؤشرات أداء الحسابات والشركاء</h3>
            <p style="font-size:11.5px; color:var(--t3); margin:4px 0 0 0">انقر على عناوين الأعمدة لترتيب الحسابات. انقر على أي شريك لاستعراض ملفه الفني المتكامل.</p>
          </div>
          <span style="font-size:11.5px; background:var(--dash-p-glow); color:var(--dash-p-dark); padding:4px 10px; border-radius:8px; font-weight:700">
            طابق البحث: ${totalFilteredCount} شريك
          </span>
        </div>

        <div style="overflow-x:auto">
          <table class="premium-table">
            <thead>
              <tr style="color:var(--t2); font-weight:bold">
                <th style="padding:12px 8px; cursor:pointer" onclick="toggleDbSort('name')">اسم الشريك والشركة ${getSortIndicator('name')}</th>
                <th style="padding:12px 8px; cursor:pointer" onclick="toggleDbSort('score')">نقاط الصحة والتشغيل ${getSortIndicator('score')}</th>
                <th style="padding:12px 8px; cursor:pointer" onclick="toggleDbSort('programs')">البرامج المرخصة ${getSortIndicator('programs')}</th>
                <th style="padding:12px 8px; cursor:pointer" onclick="toggleDbSort('issues')">الطلبات الفنية المعلقة ${getSortIndicator('issues')}</th>
                <th style="padding:12px 8px">الولاية الجغرافية</th>
                <th style="padding:12px 8px">آخر نشاط</th>
                <th style="padding:12px 8px; text-align:center">الملف</th>
              </tr>
            </thead>
            <tbody>
              ${sortedClients.length === 0 ? `
                <tr>
                  <td colspan="7" style="padding:3.5rem; text-align:center; color:var(--t3)">
                    ⚠️ لا توجد حسابات شركاء مطابقة لمعايير البحث والتصفية النشطة حالياً.
                  </td>
                </tr>
              ` : sortedClients.map(c => {
                const sc = computeScore(c);
                const scoreStyle = getScoreStyle(sc.total);
                const openIssCount = (c.issues || []).filter(i => i.status === 'مفتوح' || i.status === 'قيد المعالجة').length;
                const urgentCount = (c.issues || []).filter(i => i.priority === 'عاجل' && (i.status === 'مفتوح' || i.status === 'قيد المعالجة')).length;

                // Color based initials
                let initialBg = '#8B5CF6';
                if (sc.total >= 75) initialBg = '#10B981';
                else if (sc.total >= 50) initialBg = '#3B82F6';
                else if (sc.total >= 25) initialBg = '#F59E0B';
                else initialBg = '#EF4444';

                return `
                  <tr style="cursor:pointer" onclick="selClient(${c.id})">
                    <!-- Client Name with Avatar initials -->
                    <td style="padding:12px 8px">
                      <div style="display:flex; align-items:center; gap:10px">
                        <div class="table-avatar" style="background:${initialBg}">
                          ${(c.fullName || 'أ').substring(0, 1)}
                        </div>
                        <div>
                          <div style="font-weight:700; color:var(--t1)">${esc(c.fullName)}</div>
                          <div style="font-size:11.5px; color:var(--t3)">${esc(c.company || 'مؤسسة فردية')}</div>
                        </div>
                      </div>
                    </td>
                    
                    <!-- Health score block -->
                    <td style="padding:12px 8px">
                      <div style="display:flex; align-items:center; gap:8px">
                        <span style="font-size:14px; font-weight:800; color:${scoreStyle.color}">${sc.total}%</span>
                        <span style="font-size:10.5px; font-weight:700; color:${scoreStyle.color}; background:${scoreStyle.bg}; border:1px solid rgba(255,255,255,0.05); padding:2px 7px; border-radius:6px">
                          ${scoreStyle.text}
                        </span>
                      </div>
                    </td>

                    <!-- Programs licensed count -->
                    <td style="padding:12px 8px">
                      <div style="font-weight:700; color:var(--t2)">
                        ${(c.programs || []).length} برامج مرخصة
                      </div>
                      <div style="font-size:10.5px; color:var(--t3); max-width:200px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap">
                        ${(c.programs || []).map(p => p.programName).join('، ') || 'لم تفعل تراخيص'}
                      </div>
                    </td>

                    <!-- Support load -->
                    <td style="padding:12px 8px">
                      <div style="display:flex; align-items:center; gap:4px">
                        <span class="bdg ${openIssCount > 0 ? 'bdg-r' : 'bdg-g'}" style="font-size:11px; font-weight:bold; border-radius:6px; padding:3px 8px">
                          ${openIssCount} طلبات
                        </span>
                        ${urgentCount > 0 ? `
                          <span class="bdg bdg-p" style="font-size:10px; font-weight:bold; border-radius:6px; padding:3px 8px animate-pulse" title="مشاكل ذات أولوية عاجلة">
                            ⚡ ${urgentCount} حرجة
                          </span>
                        ` : ''}
                      </div>
                    </td>

                    <!-- Wilaya -->
                    <td style="padding:12px 8px; color:var(--t2); font-weight:600">
                      📍 ${esc(c.wilaya || 'الجزائر العاصمة')}
                    </td>

                    <!-- Last contact -->
                    <td style="padding:12px 8px; color:var(--t2); font-size:11px">
                      ${fmtD(c.lastContact) || '<span style="color:var(--t3)">لم يسجل اتصال</span>'}
                    </td>

                    <!-- Direct link button -->
                    <td style="padding:12px 8px; text-align:center">
                      <button class="btn btn-xs" style="background:var(--dash-p-glow); color:var(--dash-p-dark); border:none; border-radius:8px; font-weight:700; padding:5px 10px">
                        استعراض 🔑
                      </button>
                    </td>

                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- ANALYTICS GRID: GEOGRAPHIC MAP & PROGRAM PILLS SIDE-BY-SIDE -->
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(320px, 1fr)); gap:1.25rem">
        
        <!-- Region Concentration Chart (Light & Dark adaptation) -->
        <div class="dash-v-card dash-glow-purple" style="padding:1.5rem">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.15rem">
            <h3 style="font-size:14px; font-weight:800; color:var(--t1); margin:0; display:flex; align-items:center; gap:6px">
              <span>📍</span> الكثافة والتوزيع الجغرافي للشركاء (الولايات)
            </h3>
            <span style="font-size:11px; color:var(--t3)">أعلى 5 ولايات</span>
          </div>
          
          ${sortedWilayas.length === 0 ? `
            <div style="text-align:center; padding:2rem 0; color:var(--t3); font-size:12px">لا تتوفر ولايات تطابق الفلترة الحالية</div>
          ` : `
            <div style="display:flex; flex-direction:column; gap:12px">
              ${sortedWilayas.map((w, idx) => {
                const maxVal = sortedWilayas[0].count || 1;
                const widthPct = Math.round((w.count / maxVal) * 100);
                const percentOfFiltered = Math.round((w.count / (totalFilteredCount || 1)) * 100);
                return `
                  <div>
                    <div style="display:flex; justify-content:space-between; font-size:12.5px; margin-bottom:4px">
                      <span style="font-weight:700; color:var(--t1)">${idx+1}. ${w.name}</span>
                      <span style="color:var(--dash-p); font-weight:800">${w.count} عملاء (${percentOfFiltered}%)</span>
                    </div>
                    <div style="width:100%; height:8px; background:var(--border-soft); border-radius:4px; overflow:hidden">
                      <div style="width:${widthPct}%; height:100%; background:linear-gradient(90deg, var(--dash-p-dark), var(--dash-p)); border-radius:4px"></div>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          `}
        </div>

        <!-- Program deployment concentration chart -->
        <div class="dash-v-card dash-glow-blue" style="padding:1.5rem">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.15rem">
            <h3 style="font-size:14px; font-weight:800; color:var(--t1); margin:0; display:flex; align-items:center; gap:6px">
              <span>💻</span> الحصة السوقية وتحليل توزيع تراخيص البرمجيات
            </h3>
            <span style="font-size:11px; color:var(--t3)">أعلى 5 برمجيات</span>
          </div>

          ${sortedPrograms.length === 0 ? `
            <div style="text-align:center; padding:2rem 0; color:var(--t3); font-size:12px">لا تتوفر تراخيص مطابقة للفلترة الحالية</div>
          ` : `
            <div style="display:flex; flex-direction:column; gap:12px">
              ${sortedPrograms.map((p, idx) => {
                const maxCount = sortedPrograms[0].count || 1;
                const widthPct = Math.round((p.count / maxCount) * 100);
                return `
                  <div>
                    <div style="display:flex; justify-content:space-between; font-size:12.5px; margin-bottom:4px">
                      <span style="font-weight:700; color:var(--t1); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:200px">${idx+1}. ${esc(p.name)}</span>
                      <span style="color:#3B82F6; font-size:11.5px; font-weight:700">${p.count} حساب · ${p.installs} جهاز</span>
                    </div>
                    <div style="width:100%; height:8px; background:var(--border-soft); border-radius:4px; overflow:hidden">
                      <div style="width:${widthPct}%; height:100%; background:linear-gradient(90deg, #2563EB, #60A5FA); border-radius:4px"></div>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          `}
        </div>

      </div>

      <!-- AI SENTINEL PROACTIVE ADVISOR PANEL (Microsoft Sentinel Style) -->
      <div class="dash-v-card" style="padding:1.5rem">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.75rem">
          <h3 style="font-size:15px; font-weight:800; color:var(--t1); margin:0; display:flex; align-items:center; gap:8px">
            <span>🧠</span> مركز الاستشارات والتوصيات الذكية (AI Sentinel Advisor)
          </h3>
          <span style="font-size:11px; background:var(--dash-g); color:#fff; padding:2.5px 9px; border-radius:12px; font-weight:700">مراقبة حية ونشطة</span>
        </div>
        <p style="font-size:12.5px; color:var(--t3); margin:0 0 1.25rem 0">
          يقوم الذكاء الاصطناعي بنشاط وبشكل دائم بتحليل العقود المنتهية، الفترات الزمنية للتواصل، ومؤشرات الأداء للعملاء المصفين لإصدار إرشادات استباقية.
        </p>

        ${visibleRecs.length === 0 ? `
          <div style="text-align:center; padding:2.5rem; color:#10B981; font-size:13.5px; font-weight:700">
            ✨ رائع! لا تتوفر أي مخاطر أو تذاكر حرجة معلقة للعملاء المصفين حالياً. جميع الحسابات نشطة ومستقرة تماماً.
          </div>
        ` : `
          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(290px, 1fr)); gap:14px">
            ${visibleRecs.map(r => {
              let alertClass = 'sentinel-alert-info';
              if (r.type === 'danger') alertClass = 'sentinel-alert-danger';
              else if (r.type === 'urgent') alertClass = 'sentinel-alert-urgent';
              else if (r.type === 'warning') alertClass = 'sentinel-alert-warning';

              return `
                <div class="sentinel-alert ${alertClass}" onclick="selClient(${r.clientId})">
                  <div>
                    <div style="display:flex; align-items:center; gap:8px; font-size:13.5px; font-weight:800" class="sentinel-title">
                      <span>${r.icon}</span>
                      <span>${esc(r.title)}</span>
                    </div>
                    <div style="font-size:11.5px; color:var(--t2); line-height:1.6; margin-top:6px">${esc(r.desc)}</div>
                  </div>
                  <div style="font-size:10.5px; color:var(--dash-p-dark); font-weight:800; margin-top:10px; display:flex; justify-content:flex-end">
                    متابعة إجراء الدعم الفني للشريك ←
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        `}
      </div>

    </div>
  `;
}

// Interactive Recharts Dynamic Visualizer
window.renderRechartsChart = function() {
  const container = document.getElementById('recharts-chart-container');
  if (!container) return;

  if (!window.React || !window.ReactDOM || !window.Recharts) {
    console.warn("React, ReactDOM or Recharts is not loaded yet.");
    container.innerHTML = `
      <div style="display:flex; justify-content:center; align-items:center; height:100%; color:var(--t3); font-size:12px;">
        جاري تحميل المكتبات الرسومية التفاعلية...
      </div>
    `;
    setTimeout(window.renderRechartsChart, 100);
    return;
  }

  try {
    const h = React.createElement;
    const { 
      ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend 
    } = window.Recharts;

    const clientsList = window.__dashboardFilteredClients || [];

    // Create last 6 months buckets
    const monthNames = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
    const last6Months = [];
    const d = new Date();

    for (let i = 5; i >= 0; i--) {
      const m = new Date(d.getFullYear(), d.getMonth() - i, 1);
      const yearMonth = `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}`;
      last6Months.push({
        key: yearMonth,
        name: monthNames[m.getMonth()],
        activeClients: 0,
        licenses: 0,
        openIssues: 0
      });
    }

    // Aggregate stats
    clientsList.forEach(c => {
      let dateStr = c.startDate || c.lastContact || '';
      if (!dateStr && c.contactHistory && c.contactHistory.length > 0) {
        dateStr = c.contactHistory[0].date;
      }
      if (!dateStr) return;

      const match = dateStr.match(/^(\d{4})-(\d{2})/);
      if (!match) return;
      const clientYM = `${match[1]}-${match[2]}`;

      const monthBucket = last6Months.find(m => m.key === clientYM);
      if (monthBucket) {
        if (c.status === 'نشط') {
          monthBucket.activeClients += 1;
        }
        const installs = (c.programs || []).reduce((sum, p) => sum + (Number(p.installationsCount) || 1), 0);
        monthBucket.licenses += installs;

        const issuesCount = (c.issues || []).filter(i => i.status === 'مفتوح' || i.status === 'قيد المعالجة').length;
        monthBucket.openIssues += issuesCount;
      }
    });

    // Calculate cumulative stats to show actual trends
    let cumClients = 0;
    let cumLicenses = 0;
    let cumIssues = 0;

    const chartData = last6Months.map(m => {
      cumClients += m.activeClients;
      cumLicenses += m.licenses;
      cumIssues += m.openIssues;
      return {
        name: m.name,
        "العملاء النشطون": cumClients,
        "التراخيص الفعالة": cumLicenses,
        "تذاكر الدعم": cumIssues
      };
    });

    const CustomTooltip = ({ active, payload, label }) => {
      if (active && payload && payload.length) {
        return h('div', { 
          style: { 
            backgroundColor: 'var(--surface)', 
            border: '1px solid var(--border)', 
            padding: '10px', 
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            textAlign: 'right'
          } 
        },
          h('p', { style: { margin: 0, fontWeight: 'bold', color: 'var(--t1)', fontSize: '12px' } }, label),
          payload.map((entry, index) => h('p', { 
            key: index, 
            style: { margin: '4px 0 0 0', color: entry.color, fontSize: '11px', fontWeight: '600' } 
          }, `${entry.name}: ${entry.value}`))
        );
      }
      return null;
    };

    function RechartsComponent() {
      return h(ResponsiveContainer, { width: "100%", height: "100%" },
        h(AreaChart, { data: chartData, margin: { top: 10, right: 10, left: -20, bottom: 0 } },
          h('defs', null,
            h('linearGradient', { id: 'colorClients', x1: '0', y1: '0', x2: '0', y2: '1' },
              h('stop', { offset: '5%', stopColor: '#8B5CF6', stopOpacity: 0.25 }),
              h('stop', { offset: '95%', stopColor: '#8B5CF6', stopOpacity: 0 })
            ),
            h('linearGradient', { id: 'colorLicenses', x1: '0', y1: '0', x2: '0', y2: '1' },
              h('stop', { offset: '5%', stopColor: '#3B82F6', stopOpacity: 0.2 }),
              h('stop', { offset: '95%', stopColor: '#3B82F6', stopOpacity: 0 })
            ),
            h('linearGradient', { id: 'colorIssues', x1: '0', y1: '0', x2: '0', y2: '1' },
              h('stop', { offset: '5%', stopColor: '#EC4899', stopOpacity: 0.15 }),
              h('stop', { offset: '95%', stopColor: '#EC4899', stopOpacity: 0 })
            )
          ),
          h(CartesianGrid, { strokeDasharray: "3 3", stroke: "var(--border)", strokeOpacity: 0.4 }),
          h(XAxis, { 
            dataKey: "name", 
            stroke: "var(--t3)", 
            fontSize: 10,
            tickLine: false,
            axisLine: false
          }),
          h(YAxis, { 
            stroke: "var(--t3)", 
            fontSize: 10,
            tickLine: false,
            axisLine: false
          }),
          h(Tooltip, { content: h(CustomTooltip) }),
          h(Legend, { 
            wrapperStyle: { fontSize: 11, paddingTop: 10 },
            iconSize: 8,
            iconType: "circle"
          }),
          h(Area, { 
            type: "monotone", 
            dataKey: "العملاء النشطون", 
            stroke: "#8B5CF6", 
            strokeWidth: 2.5,
            fillOpacity: 1, 
            fill: "url(#colorClients)" 
          }),
          h(Area, { 
            type: "monotone", 
            dataKey: "التراخيص الفعالة", 
            stroke: "#3B82F6", 
            strokeWidth: 2,
            fillOpacity: 1, 
            fill: "url(#colorLicenses)" 
          }),
          h(Area, { 
            type: "monotone", 
            dataKey: "تذاكر الدعم", 
            stroke: "#EC4899", 
            strokeWidth: 1.5,
            fillOpacity: 1, 
            fill: "url(#colorIssues)" 
          })
        )
      );
    }

    if (typeof ReactDOM.createRoot === 'function') {
      let root = container.__reactRoot;
      if (!root) {
        root = ReactDOM.createRoot(container);
        container.__reactRoot = root;
      }
      root.render(h(RechartsComponent));
    } else {
      ReactDOM.render(h(RechartsComponent), container);
    }
  } catch (err) {
    console.error("Error rendering Recharts:", err);
    container.innerHTML = `<div style="color:var(--r); font-size:11px; padding:10px;">فشل تشغيل المخطط التفاعلي: ${err.message}</div>`;
  }
};


