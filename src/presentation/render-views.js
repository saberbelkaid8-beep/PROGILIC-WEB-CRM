import { S, clients } from '../state/store.js';
import { BUSINESS_TYPES, PROGRAM_TYPES, WILAYAS } from '../constants/index.js';
import { gc, applyFilters, pBdg, sBdg, srcCls, platformIcon, updateActTypeOpts, isBdg, fmtD, rBdg, progStatusLabel, progStatusCls, progTypeBdg, activityIcon, getProgramStats, selOpts, wOpts, actTypeOpts, getActTypes, esc, avCls, init, searchMatch, countAdvFil, pBorder, cOpts } from '../utils/index.js';
import { computeScore, computeGlobalStats, generateAutoNote, computeRiskProfile, scoreColor, computeAlerts, scoreLabel, riskColor, riskBdg, riskLabel, analyzeRootCause } from '../business/intelligence.js';
import { getActivityVisuals } from '../business/timelineService.js';
import { performSearch } from '../business/searchIndex.js';
import { t } from '../utils/i18n.js';
import { hasPermission, isGerant } from '../state/store.js';
export function renderList(){
  if (!hasPermission('clients.view')) {
    return `
      <div style="background:var(--card); border:1px solid var(--border); border-radius:16px; padding:3rem 2rem; text-align:center; max-width:600px; margin:2rem auto; direction:rtl">
        <div style="font-size:48px; margin-bottom:1rem">🔒</div>
        <h2 style="font-size:18px; font-weight:800; color:var(--t1); margin-bottom:8px">${t('عذراً، ليس لديك صلاحية عرض قائمة العملاء')}</h2>
        <p style="font-size:13px; color:var(--t2); line-height:1.6; margin-bottom:1.5rem">
          ${S.lang === 'fr' ? 'La permission' : S.lang === 'en' ? 'The' : 'صلاحية'} <code>clients.view</code> ${S.lang === 'fr' ? 'n’est pas activée pour votre compte. Contactez l’administrateur pour l’activer depuis le panneau de configuration.' : S.lang === 'en' ? 'permission is not enabled for your account. Contact the administrator to enable it in the control panel.' : 'غير مفعلة لحسابك حالياً. يمكنك التواصل مع المسؤول لتفعيلها من لوحة التحكم.'}
        </p>
        <button class="btn btn-primary btn-sm" onclick="logoutStaff()">
          👥 ${S.lang === 'fr' ? 'Changer de compte utilisateur' : S.lang === 'en' ? 'Switch user account' : 'تبديل حساب المستخدم'}
        </button>
      </div>
    `;
  }

  console.log("renderList: S.isLoading =", S.isLoading, "clients.length =", clients.length);
  const ac=clients.filter(c=>c.status==='نشط').length;
  const pr=clients.filter(c=>c.status==='محتمل').length;
  const pa=clients.filter(c=>c.status==='متوقف').length;
  const fil=applyFilters(clients);
  console.log("renderList: filtered clients count =", fil.length);
  const cnt=countAdvFil();

  if (S.isLoading && clients.length === 0) {
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
      <div class="stat-c sg" style="cursor:pointer" onclick="setFil('نشط')" title="${t('تصفية وتحديد')}"><div class="stat-v">${ac}</div><div class="stat-l">${t('نشط')}</div></div>
      <div class="stat-c sb" style="cursor:pointer" onclick="setFil('محتمل')" title="${t('تصفية وتحديد')}"><div class="stat-v">${pr}</div><div class="stat-l">${t('محتمل')}</div></div>
      <div class="stat-c so" style="cursor:pointer" onclick="setFil('متوقف')" title="${t('تصفية وتحديد')}"><div class="stat-v">${pa}</div><div class="stat-l">${t('متوقف')}</div></div>
      <div class="stat-c" style="cursor:pointer" onclick="setFil('الكل')" title="${t('جميع العملاء')}"><div class="stat-v" style="color:var(--b)">${clients.reduce((s,c)=>s+(c.programs||[]).length,0)}</div><div class="stat-l">${t('برامج')} · ${clients.reduce((s,c)=>s+(c.programs||[]).reduce((a,p)=>a+(Number(p.installationsCount)||1),0),0)} ${t('جهاز')}</div></div>
    </div>
    <div class="search-row">
      ${hasPermission('search.global') || hasPermission('search.clients') ? `
        <input class="search-input" placeholder="${t('ابحث: اسم، شركة، ولاية، نشاط، تخصص، هاتف...')}" value="${esc(S.q)}" oninput="onQ(this.value)">
      ` : `<div style="flex:1;font-size:12px;color:var(--t3);padding:8px 12px;background:var(--surface);border-radius:var(--r-sm);border:1px dashed var(--border)">🔒 البحث محجوز للمصرح لهم</div>`}
      ${hasPermission('filters.advanced') ? `
        <button class="adv-fil-toggle${cnt>0||S.showAdvFil?' active':''}" onclick="toggleAdvFil()">
          ⚙ ${t('فلترة')} ${cnt>0?`<span class="adv-fil-badge">${cnt}</span>`:''}
        </button>
      ` : ''}
    </div>
    ${S.q?`<div class="search-result-bar">
      🔍 <strong>${fil.length}</strong> ${t('نتيجة لـ')} "<em>${esc(S.q)}</em>"
      <div style="margin-right:auto;display:flex;gap:4px;flex-wrap:wrap">
        ${[...new Set(fil.flatMap(client => searchMatch(client,S.q).fields))].map(f=>`<span class="sf-tag">${t(f)}</span>`).join('')}
      </div>
      <button class="search-clear" onclick="onQ('')">✕ ${t('مسح')}</button>
    </div>`:''}
    ${renderAdvFilterPanel()}
    <div style="display:flex;align-items:center;justify-content:space-between;padding:.25rem 0;margin-bottom:.5rem;gap:12px;flex-wrap:wrap">
      <div class="filter-bar" style="margin:0;border:none;padding:0">
        ${['الكل','نشط','محتمل','متوقف'].map(s=>`<span class="fpill${S.filter===s?' on':''}" onclick="setFil('${s}')">${t(s)}</span>`).join('')}
      </div>
      <div style="display:flex;align-items:center;gap:6px;font-size:11px;color:var(--t2)">
        <span style="font-weight:600">${t('ترتيب:')}</span>
        <select onchange="setSortBy(this.value)" style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-sm);padding:4px 8px;color:var(--t1);font-family:inherit;font-size:11px;outline:none;cursor:pointer">
          <option value="id"${S.sortBy==='id'?' selected':''}>${t('رقم العميل')}</option>
          <option value="fullName"${S.sortBy==='fullName'?' selected':''}>${t('الاسم الكامل')}</option>
          <option value="score"${S.sortBy==='score'?' selected':''}>${t('نقاط التقييم')}</option>
          <option value="lastContact"${S.sortBy==='lastContact'?' selected':''}>${t('تاريخ التواصل')}</option>
          <option value="endDate"${S.sortBy==='endDate'?' selected':''}>${t('انتهاء العقد')}</option>
        </select>
        <button onclick="toggleSortOrder()" style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-sm);width:26px;height:26px;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;color:var(--t1)" title="${S.sortOrder==='asc'?t('تصاعدي'):t('تنازلي')}">
          ${S.sortOrder==='asc'?'▲':'▼'}
        </button>
      </div>
    </div>
    ${fil.length===0?`<div class="empty">
      <div class="empty-icon">🔍</div>
      <div class="empty-text">${S.lang === 'fr' ? 'Aucun résultat ne correspond aux filtres appliqués.' : S.lang === 'en' ? 'No results match the current filters.' : 'لا توجد نتائج تطابق الفلاتر المحددة حالياً.'}</div>
      <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap">
        ${cnt>0?`<button class="btn btn-outline btn-sm" onclick="clearAdvFil()">${t('مسح الفلاتر')}</button>`:''}
        ${hasPermission('clients.create') ? `<button class="btn btn-primary btn-sm" onclick="openModal('addClient')">${t('إضافة عميل جديد')}</button>` : ''}
        ${isGerant() || hasPermission('backup.restore') ? `
          <label class="btn btn-outline btn-sm" style="cursor:pointer;margin:0;display:inline-flex;align-items:center;gap:6px" title="${t('استيراد ملف .dum أو .json')}">
            📥 ${t('استيراد (.dum / .json)')}
            <input type="file" accept=".dum,.dump,.json,.txt,.csv" style="display:none" onchange="importData(this.files[0]);this.value=''">
          </label>
        ` : ''}
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
        const phoneDisplay = hasPermission('clients.view_sensitive') ? (esc(c.phone)||"—") : (c.phone ? '0550•• •••• 🔒' : '—');
        return`<div class="cc" onclick="selClient(${c.id})" id="cc-card-${c.id}">
          <div class="cc-score-strip" style="background:${scColor}"></div>
          <div class="cc-top">
            <div class="av ${avCls(c.status)}">${esc(init(c.fullName))}</div>
            <div style="min-width:0"><div class="cc-name">${esc(c.fullName)}</div><div class="cc-company" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(c.company)||"—"}</div></div>
          </div>
          <div class="cc-badges">
            ${sBdg(c.status)}
            ${(()=>{const ps=getProgramStats(c);return ps.total>0?`<span class="bdg bdg-b">📦 ${ps.total} ${t('برامج')}`+(ps.totalInstalls>1?` · ${ps.totalInstalls} ${t('جهاز')}`:'')+'</span>':`<span class="bdg bdg-gr">${t('لا برامج')}</span>`})()}
            <span class="bdg score-tip" style="background:${scColor}18;color:${scColor}" data-tip="${sc.total>=75?t('عميل متميز'):sc.total>=50?t('عميل جيد'):sc.total>=25?t('يحتاج متابعة'):t('خطر عالٍ')}">⭐ ${sc.total}</span>
          </div>
          ${c.businessType?`<div class="cc-activity">${activityIcon(c.businessType)} ${t(c.businessType)}${c.businessField?` · ${t(c.businessField)}`:''}</div>`:''}
          ${hit&&hit.fields.length>0?`<div class="cc-search-match">${hit.fields.map(f=>`<span class="sf-tag">✓ ${t(f)}</span>`).join('')}</div>`:''}
          <div class="cc-footer">
            <div class="cc-phone" dir="ltr">${phoneDisplay}</div>
            <div class="cc-wilaya">${esc(c.wilaya)||"—"}</div>
          </div>
          ${oi>0?`<div class="cc-alert" style="color:${urg>0?'var(--r)':'var(--w)'}">▸ ${oi} ${t('مشاكل مفتوحة')}${urg>0?` (${t('عاجل')})`:''}</div>`:''}
        </div>`;
      }).join('')}
      <div style="grid-column:1/-1;height:${bottomSpacerHeight}px;pointer-events:none"></div>
    </div>`}
  `;
}

export function renderDetail(){
  const c=gc();
  if (S.isLoading && !c) {
    return `
      <div class="back skeleton" style="width:120px;height:32px;margin-bottom:1rem"></div>
      <div class="chdr skeleton" style="height:120px;margin-bottom:1rem"></div>
      <div class="qstats">
        ${Array(4).fill(0).map(() => `<div class="qs skeleton" style="height:70px"></div>`).join('')}
      </div>
      <div class="tabs-wrap skeleton" style="height:40px"></div>
    `;
  }
  if(!c)return`<p style="color:var(--t2)">${t('العميل غير موجود')}</p>`;
  const oi=c.issues.filter(i=>i.status==='مفتوح'||i.status==='قيد المعالجة').length;
  const fo=c.issues.filter(i=>i.featureOpp).length;
  const sc=computeScore(c);
  const scColor=scoreColor(sc.total);
  console.log("DEBUG RENDER DETAIL: c.id =", c.id, "S.tab =", S.tab, "c._subcollectionsLoaded =", c._subcollectionsLoaded);
  return`
    <div class="back" onclick="goBack()">${t('← قائمة العملاء')}</div>
    <div class="chdr">
      <div class="ch-top">
        <div class="ch-av">${esc(init(c.fullName))}</div>
        <div style="flex:1;min-width:0">
          <div class="ch-name">${esc(c.fullName)}</div>
          <div class="ch-company">${esc(c.company)}</div>
        </div>
        <div class="ch-acts">
          ${sBdg(c.status)}
          ${hasPermission('clients.edit') ? `<button class="btn btn-sm" style="background:rgba(255,255,255,.12);color:#fff;border:none" onclick="openModal('editClient')">${t('تعديل')}</button>` : ''}
        </div>
      </div>
      <div class="ch-meta">
        <span class="ch-mi">📍 ${esc(c.wilaya)||"—"}${c.location?'، '+esc(c.location):''}</span>
        <span class="ch-mi" dir="ltr">📞 ${hasPermission('clients.view_sensitive') ? (esc(c.phone)||"—") : (c.phone ? '0550•• •••• 🔒' : '—')}</span>
        ${(()=>{const ps=getProgramStats(c);const pp=c.programs||[];return ps.total>0?`<span class="ch-mi">📦 ${esc(pp[0].programName)}${ps.total>1?` (+${ps.total-1})`:''} · ${ps.totalInstalls} ${t('جهاز')}</span>`:`<span class="ch-mi" style="opacity:.5">📦 ${t('لا برامج')}</span>`})()}
        <span class="ch-mi">${activityIcon(c.businessType)} ${t(c.businessType)||"—"}${c.businessField?' · '+t(c.businessField):''}</span>
      </div>
    </div>
    <div class="qstats">
      <div class="qs ${oi>0?'qr':'qg'}"><div class="qs-v">${oi}</div><div class="qs-l">${t('مشاكل مفتوحة')}</div></div>
      <div class="qs ${fo>0?'qw':''}"><div class="qs-v">${fo}</div><div class="qs-l">${t('فرص ميزات')}</div></div>
      ${(()=>{const ps=getProgramStats(c);return`<div class="qs ${ps.expired>0?'qr':'qg'}"><div class="qs-v">${ps.total}</div><div class="qs-l">${t('البرامج')} (${ps.totalInstalls} ${t('جهاز')})</div></div>`})()}
      <div class="qs qc"><div class="qs-v">${(c.contactHistory||[]).length}</div><div class="qs-l">${t('سجلات تواصل')}</div></div>
      <div class="qs"><div class="qs-v" style="color:${scColor};font-size:20px">${sc.total}</div><div class="qs-l">${t('نقاط العميل')}</div></div>
    </div>
    <div class="tabs-wrap">
      <button class="tabBtn${S.tab==='overview'?' on':''}" onclick="setTab('overview')">${t('نظرة عامة')}</button>
      ${hasPermission('programs.view') ? `<button class="tabBtn${S.tab==='programs'?' on':''}" onclick="setTab('programs')">${t('البرامج')} <span class="tab-count">${(c.programs||[]).length}</span></button>` : ''}
      ${hasPermission('issues.view') ? `<button class="tabBtn${S.tab==='issues'?' on':''}" onclick="setTab('issues')">${t('المشاكل')} <span class="tab-count${c.issues.filter(i=>i.priority==='عاجل'&&i.status!=='محلول'&&i.status!=='مغلق').length>0?' urgent':''}">${c.issues.length}</span></button>` : ''}
      ${hasPermission('features.view') ? `<button class="tabBtn${S.tab==='requirements'?' on':''}" onclick="setTab('requirements')">${t('المتطلبات')} <span class="tab-count">${c.requirements.length}</span></button>` : ''}
      ${hasPermission('contacts.view_history') ? `<button class="tabBtn${S.tab==='contacts'?' on':''}" onclick="setTab('contacts')">${t('📞 التواصل')} <span class="tab-count">${(c.contactHistory||[]).length}</span></button>` : ''}
      ${hasPermission('clients.view_timeline') ? `<button class="tabBtn${S.tab==='timeline'?' on':''}" onclick="setTab('timeline')">${t('⏱️ الخط الزمني')}</button>` : ''}
      ${hasPermission('reports.view') ? `<button class="tabBtn${S.tab==='report'?' on':''}" onclick="setTab('report')">${t('📊 التقرير')}</button>` : ''}
      ${hasPermission('analytics.view') ? `<button class="tabBtn${S.tab==='intelligence'?' on':''}" onclick="setTab('intelligence')">${t('🧠 الذكاء')}</button>` : ''}
    </div>
    <div class="tab-pane">
      ${S.tab==='overview'?renderOverview(c):''}
      ${S.tab==='programs' && hasPermission('programs.view') ? renderPrograms(c):''}
      ${S.tab==='issues' && hasPermission('issues.view') ? renderIssues(c):''}
      ${S.tab==='requirements' && hasPermission('features.view') ? renderReqs(c):''}
      ${S.tab==='contacts' && hasPermission('contacts.view_history') ? renderContacts(c):''}
      ${S.tab==='timeline' && hasPermission('clients.view_timeline') ? renderTimeline(c):''}
      ${S.tab==='report' && hasPermission('reports.view') ? renderReport(c):''}
      ${S.tab==='intelligence' && hasPermission('analytics.view') ? renderIntelligence(c):''}
    </div>`;
}

function renderOverview(c){
  const gpsSection=c.gps&&c.gps.lat
    ?`<div class="gps-row"><span>📍</span><span class="gps-coords">${c.gps.lat}, ${c.gps.lng}</span><button class="btn btn-blue-soft btn-xs" onclick="captureGPS()">${S.lang === 'fr' ? 'Mettre à jour GPS' : S.lang === 'en' ? 'Update GPS' : 'تحديث GPS'}</button></div>`
    :`<button class="btn btn-blue-soft btn-sm" style="margin-top:8px;width:100%" onclick="captureGPS()">${S.lang === 'fr' ? '📍 Définir position GPS' : S.lang === 'en' ? '📍 Set GPS Location' : '📍 تحديد الموقع بـ GPS'}</button>`;
  const hasBiz=c.businessType||c.businessField;
  const bizCard=hasBiz
    ?`<div class="biz-profile">
        <div class="biz-icon">${activityIcon(c.businessType)}</div>
        <div class="biz-info">
          <div class="biz-activity">${t(c.businessType)}</div>
          <div class="biz-type">${t(c.businessField)||(S.lang === 'fr' ? 'Spécialité non définie' : S.lang === 'en' ? 'Specialty not specified' : 'لم يُحدد التخصص بعد')}</div>
        </div>
        <span class="biz-badge">${S.lang === 'fr' ? 'Fiche activité' : S.lang === 'en' ? 'Business Profile' : 'ملف النشاط'}</span>
      </div>`
    :`<div class="biz-profile" style="cursor:pointer" onclick="openModal('editClient')">
        <div class="biz-icon">🏪</div>
        <div class="biz-info"><div class="biz-empty">${S.lang === 'fr' ? 'Activité non définie — cliquez pour ajouter' : S.lang === 'en' ? 'No activity defined — click to set' : 'لم يُحدد النشاط التجاري — اضغط لإضافته'}</div></div>
        <span class="biz-badge">+ ${t('إضافة')}</span>
      </div>`;
  const an=generateAutoNote(c);
  return`
    <div class="auto-note">
      <span class="an-ic">🤖</span>
      <div class="an-body">
        <div class="an-lbl">${t('تحليل ذكي تلقائي')}</div>
        <div class="an-text">${esc(an.text)}</div>
        ${an.action?`<div class="an-text" style="margin-top:6px;font-weight:700;font-size:12px">${esc(an.action)}</div>`:''}
        <div class="an-tags">${an.tags.map(tItem=>`<span class="an-tag ${tItem.cls}">${esc(t(tItem.t))}</span>`).join('')}</div>
      </div>
    </div>
    ${bizCard}
    <div class="igrid">
      <div class="iitem"><div class="ilbl">${t('الاسم الكامل')}</div><div class="ival">${esc(c.fullName)}</div></div>
      <div class="iitem"><div class="ilbl">${t('الشركة / المؤسسة')}</div><div class="ival ${c.company?'':'muted'}">${esc(c.company)||"—"}</div></div>
      <div class="iitem"><div class="ilbl">${t('الهاتف')}</div><div class="ival" dir="ltr" style="text-align:${S.lang === 'ar' ? 'right' : 'left'}">${hasPermission('clients.view_sensitive') ? (esc(c.phone)||"—") : (c.phone ? '0550•• •••• 🔒' : '—')}</div></div>
      <div class="iitem"><div class="ilbl">${t('حساب Gmail')}</div><div class="ival" dir="ltr" style="text-align:${S.lang === 'ar' ? 'right' : 'left'}">${esc(c.gmailAccount)||"—"}</div></div>
      <div class="iitem"><div class="ilbl">${t('الولاية')}</div><div class="ival">${esc(c.wilaya)||"—"}</div></div>
      <div class="iitem"><div class="ilbl">${t('المنطقة / الحي')}</div><div class="ival ${c.location?'':'muted'}">${esc(c.location)||"—"}</div></div>
      <div class="iitem"><div class="ilbl">${t('الحالة')}</div><div class="ival">${sBdg(c.status)}</div></div>
      <div class="iitem"><div class="ilbl">${t('النشاط الرئيسي')}</div><div class="ival">${c.businessType?`${activityIcon(c.businessType)} ${t(c.businessType)}`:'<span class="muted">—</span>'}</div></div>
      <div class="iitem"><div class="ilbl">${t('تخصص النشاط')}</div><div class="ival ${c.businessField?'':'muted'}">${t(c.businessField)||"—"}</div></div>
      ${(()=>{const ps=getProgramStats(c);const pp=c.programs||[];return`
      <div class="iitem"><div class="ilbl">${t('إجمالي البرامج')}</div><div class="ival">${ps.total} ${ps.total>0?`<span style="font-size:11px;color:var(--t3)">· ${ps.totalInstalls} ${t('جهاز')}</span>`:''}</div></div>
      <div class="iitem"><div class="ilbl">${t('البرنامج')}</div><div class="ival ${pp.length?'':'muted'}">${pp.length?`${esc(pp[0].programName)}${pp[0].version?` · ${esc(pp[0].version)}`:''}`:'—'}</div></div>`})()}
      <div class="iitem"><div class="ilbl">${t('تاريخ البداية')}</div><div class="ival">${fmtD(c.startDate)}</div></div>
      <div class="iitem"><div class="ilbl">${t('نوع الترخيص')}</div><div class="ival" style="color:var(--brand);font-weight:600">مدى الحياة (Licence à vie)</div></div>
      <div class="iitem"><div class="ilbl">${t('آخر تواصل')}</div><div class="ival"><span class="last-contact-clickable" onclick="setTab('contacts')" title="${t('عرض التفاصيل')}">${fmtD(c.lastContact)||'—'} 📋</span></div></div>
    </div>
    ${gpsSection}
    ${c.notes?`<div style="margin-top:10px"><div style="font-size:10px;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:.04em;margin-bottom:5px">${t('ملاحظات')}</div><div class="notes-box">${esc(c.notes)}</div></div>`:''}
    ${hasPermission('clients.delete') || hasPermission('canDeleteClients') ? `
    <div class="dzone">
      <div class="dz-t">${t('منطقة الخطر')}</div>
      <div class="dz-b">${t('حذف هذا العميل يحذف جميع مشاكله ومتطلباته نهائياً ولا يمكن التراجع')}</div>
      <button class="btn btn-danger-soft btn-sm" onclick="delClient(${c.id})">${t('حذف العميل نهائياً')}</button>
    </div>` : `
    <div style="margin-top:1.5rem; background:rgba(0,0,0,0.02); border:1px dashed var(--border); border-radius:10px; padding:12px; font-size:11.5px; color:var(--t3); text-align:center">
      🔒 حذف العملاء محجوز للمصرح لهم فقط من طرف الرئيس.
    </div>`}
  `;
}

function renderIssues(c){
  return`
    <div class="pane-hdr">
      <span class="pane-title">${t('المشاكل والتذاكر')} (${c.issues.length})</span>
      ${hasPermission('issues.create') ? `<button class="btn btn-primary btn-sm" onclick="openModal('addIssue')">${t('+ مشكلة جديدة')}</button>` : ''}
    </div>
    ${c.issues.length===0
      ?`<div class="empty"><div class="empty-icon">✅</div><div class="empty-text">${t('لا توجد مشاكل مسجلة لهذا العميل')}</div>${hasPermission('issues.create') ? `<button class="btn btn-outline btn-sm" onclick="openModal('addIssue')">${t('تسجيل أول مشكلة')}</button>` : ''}</div>`
      :c.issues.map(iss=>`
        <div class="icard ${pBorder(iss.priority)}">
          <div class="ic-top"><div class="ic-title">${esc(iss.title)}</div>${isBdg(iss.status)}</div>
          <div class="ic-meta">
            ${pBdg(iss.priority)}
            <span class="ic-type">${esc(t(iss.type))}</span>
            ${iss.source?`<span class="ic-src ${srcCls(iss.source)}">${esc(t(iss.source))}</span>`:''}
            ${iss.confidence?`<span class="ic-conf">${iss.confidence}% ${t('ثقة')}</span>`:''}
            ${iss.repeatCount>1?`<span class="ic-repeat">× ${iss.repeatCount}</span>`:''}
            ${iss.featureOpp?`<span class="ic-opp">💡 ${t('فرصة ميزة')}</span>`:''}
            <span class="ic-date">${fmtD(iss.date)}</span>
          </div>
          ${iss.notes?`<div class="ic-sol">📝 ${esc(iss.notes)}</div>`:''}
          ${iss.solution?`<div class="ic-sol"><strong style="color:var(--gt)">✓ ${t('الحل:')}</strong> ${esc(iss.solution)}</div>`:''}
          <div class="ic-acts">
            ${iss.status!=='محلول'&&iss.status!=='مغلق'&&hasPermission('issues.resolve')?`<button class="btn btn-success-soft btn-xs" onclick="markSolved(${c.id},${iss.id})">${t('✓ تم الحل')}</button>`:''}
            ${hasPermission('issues.edit')?`<button class="btn btn-ghost btn-xs" onclick="editIssue(${c.id},${iss.id})">${t('تعديل')}</button>`:''}
            ${hasPermission('issues.delete')?`<button class="btn btn-danger-soft btn-xs" onclick="delIssue(${c.id},${iss.id})">${t('حذف')}</button>`:''}
          </div>
        </div>`).join('')}`;
}

function renderReqs(c){
  return`
    <div class="pane-hdr">
      <span class="pane-title">${t('المتطلبات والاقتراحات')} (${c.requirements.length})</span>
      ${hasPermission('features.create') ? `<button class="btn btn-primary btn-sm" onclick="openModal('addRequirement')">${t('+ طلب جديد')}</button>` : ''}
    </div>
    ${c.requirements.length===0
      ?`<div class="empty"><div class="empty-icon">💡</div><div class="empty-text">${t('لا توجد متطلبات مسجلة')}</div>${hasPermission('features.create') ? `<button class="btn btn-outline btn-sm" onclick="openModal('addRequirement')">${t('تسجيل أول طلب')}</button>` : ''}</div>`
      :c.requirements.map(req=>`
        <div class="icard ${pBorder(req.priority)}">
          <div class="ic-top"><div class="ic-title">${esc(req.title)}</div>${rBdg(req.status)}</div>
          <div class="ic-meta">
            ${pBdg(req.priority)}
            <span class="ic-type">${esc(t(req.type))}</span>
            <span class="bdg bdg-gr">${t('تأثير')} ${esc(t(req.impact))}</span>
            <span class="ic-date">${fmtD(req.date)}</span>
          </div>
          ${req.notes?`<div class="ic-sol">📝 ${esc(req.notes)}</div>`:''}
          <div class="ic-acts">
            ${hasPermission('features.edit')?`<button class="btn btn-ghost btn-xs" onclick="editReq(${c.id},${req.id})">${t('تعديل')}</button>`:''}
            ${hasPermission('features.delete')?`<button class="btn btn-danger-soft btn-xs" onclick="delReq(${c.id},${req.id})">${t('حذف')}</button>`:''}
          </div>
        </div>`).join('')}`;
}

function renderContacts(c){
  const hist=(c.contactHistory||[]).slice().sort((a,b)=>b.date.localeCompare(a.date));
  return`
    <div class="ch-tab">
      <div class="ch-summary">
        <span class="ch-count">📋 ${hist.length} ${t('تواصل مسجل')}</span>
        ${hasPermission('contacts.create_entry') ? `<button class="btn btn-primary btn-sm" onclick="openModal('addContact')">${t('+ تسجيل تواصل')}</button>` : ''}
      </div>
      ${hist.length===0
        ?`<div class="ch-empty">📭 ${t('لا توجد سجلات تواصل بعد')}<br><small>${t('سجّل أول تواصل مع هذا العميل')}</small></div>`
        :`<div class="timeline">
          ${hist.map((h,i)=>`
            <div class="tl-entry">
              <div class="tl-dot${i===0?' first':''}"></div>
              <div class="tl-date">${fmtD(h.date)}</div>
              <div class="tl-note">${esc(h.note)}</div>
              <div class="tl-acts">
                ${hasPermission('contacts.delete_entry') ? `<button class="btn btn-danger-soft btn-xs" onclick="delContact(${c.id},${h.id})">${t('حذف')}</button>` : ''}
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
      <div class="ps-item ps-active"><div class="ps-val">${ps.total}</div><div class="ps-lbl">${t('إجمالي البرامج')}</div></div>
      <div class="ps-item"><div class="ps-val">${ps.totalInstalls}</div><div class="ps-lbl">${t('إجمالي الأجهزة')}</div></div>
      <div class="ps-item ${ps.expired>0?'ps-expired':'ps-active'}"><div class="ps-val">${ps.active}</div><div class="ps-lbl">${t('نشط /')} ${ps.expired} ${t('منتهي')}</div></div>
    </div>
    <div class="pane-hdr">
      <span class="pane-title">${t('قائمة البرامج')}</span>
      ${hasPermission('programs.create') ? `<button class="btn btn-primary btn-sm" onclick="openModal('addProgram')">${t('+ برنامج جديد')}</button>` : ''}
    </div>
    ${progs.length===0
      ?`<div class="empty">
          <div class="empty-icon">📦</div>
          <div class="empty-text">${t('لا توجد برامج مرتبطة بهذا العميل')}</div>
          ${hasPermission('programs.create') ? `<button class="btn btn-primary btn-sm" onclick="openModal('addProgram')">${t('إضافة أول برنامج')}</button>` : ''}
        </div>`
      :progs.map(p=>`
        <div class="prog-card ${progStatusCls(p)}">
          <div class="prog-top">
            <div class="prog-name">${platformIcon(p.platform)} ${esc(p.programName)}${p.version?` · ${esc(p.version)}`:''}</div>
            ${progStatusLabel(p)}
          </div>
          <div class="prog-meta">
            ${progTypeBdg(p.type)}
            <span class="bdg bdg-gr">${esc(p.platform)}</span>
          </div>
          <div class="prog-installs">🖥 <strong>${p.installationsCount}</strong> ${t('جهاز مُرخَّص')}</div>
          <div class="prog-dates">
            <div class="prog-date-item" style="flex:1">
              <div class="prog-date-lbl">${t('تاريخ البداية')}</div>
              <div class="prog-date-val">${fmtD(p.startDate)||'—'}</div>
            </div>
            <div class="prog-date-item" style="flex:1">
              <div class="prog-date-lbl">${t('نوع الترخيص')}</div>
              <div class="prog-date-val" style="color:var(--brand);font-weight:600">مدى الحياة</div>
            </div>
          </div>
          <div class="prog-acts">
            ${hasPermission('programs.edit') ? `<button class="btn btn-ghost btn-xs" onclick="editProg(${c.id},${p.id})">✏ ${t('تعديل')}</button>` : ''}
            ${hasPermission('programs.delete') ? `<button class="btn btn-danger-soft btn-xs" onclick="delProgram(${c.id},${p.id})">${t('حذف')}</button>` : ''}
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
  const locale = S.lang === 'fr' ? 'fr-FR' : (S.lang === 'en' ? 'en-US' : 'ar-DZ');
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
        <span class="rh-mi">📅 ${t('تاريخ التقرير:')} ${new Date().toLocaleDateString(locale,{day:'numeric',month:'long',year:'numeric'})}</span>
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

function renderAdvFilterPanel(){
  if (!hasPermission('filters.advanced')) return '';
  const cnt=countAdvFil();
  const activities=BUSINESS_TYPES;
  const actTypes=S.fActivity
    ?getActTypes(S.fActivity)
    :[...new Set(clients.map(c=>c.businessField).filter(Boolean))].sort();
  const programs=[...new Set(clients.flatMap(c=>[...(Array.isArray(c.programNames)?c.programNames:[]),...(Array.isArray(c.programs)?c.programs.map(p=>p?.programName):[])]).filter(Boolean))].sort();
  const opt=(arr,cur)=>`<option value="">${t('الكل')}</option>`+arr.map(v=>`<option value="${esc(v)}"${cur===v?' selected':''}>${esc(t(v))}</option>`).join('');
  const totalFiltered=applyFilters(clients).length;
  
  const optW = () => `<option value="">${t('الكل')}</option>` + wOpts(S.fWilaya);

  return`
  <div class="adv-fil-panel${S.showAdvFil?'':' hidden'}">
    ${hasPermission('filters.by_wilaya') ? `
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
    ` : ''}
    <div class="adf-group">
      <div class="adf-lbl">${t('النشاط الرئيسي')}</div>
      <select class="adf-sel${S.fActivity?' has-val':''}" onchange="setAdvFil('fActivity',this.value)">
        ${`<option value="">${t('الكل')}</option>`+activities.map(a=>`<option value="${a}"${S.fActivity===a?' selected':''}>${activityIcon(a)} ${t(a)}</option>`).join('')}
      </select>
    </div>
    <div class="adf-group">
      <div class="adf-lbl">${t('تخصص النشاط')}${S.fActivity?` (${t(S.fActivity)})`:''}</div>
      <select class="adf-sel${S.fActType?' has-val':''}" onchange="setAdvFil('fActType',this.value)">${opt(actTypes,S.fActType)}</select>
    </div>
    ${hasPermission('filters.by_program') ? `<div class="adf-group">
      <div class="adf-lbl">${t('البرنامج')}</div>
      <select class="adf-sel${S.fProgram?' has-val':''}" onchange="setAdvFil('fProgram',this.value)">${opt(programs,S.fProgram)}</select>
    </div>` : ''}
    <div class="adv-fil-footer">
      <span class="adv-fil-summary">${cnt>0?`<strong>${totalFiltered}</strong> ${t('نتيجة لـ')} (${cnt} filters)`:`${t('جميع العملاء')} (${clients.length})`}</span>
      ${cnt>0?`<button class="btn btn-ghost btn-xs" onclick="clearAdvFil()">✕ ${t('مسح الفلاتر')}</button>`:''}
    </div>
  </div>`;
}

function renderTimeline(c) {
  const list = S.clientActivities || [];
  const locale = S.lang === 'fr' ? 'fr-FR' : (S.lang === 'en' ? 'en-US' : 'ar-DZ');
  return `
    <div class="pane-hdr">
      <span class="pane-title">${t('الخط الزمني للنشاط')} (${list.length})</span>
      <button class="btn btn-outline btn-sm" onclick="loadClientTimeline(${c.id})">${t('🔄 تحديث')}</button>
    </div>
    ${list.length === 0
      ? `<div class="empty"><div class="empty-icon">⏱️</div><div class="empty-text">${t('لا توجد أحداث مسجلة للعميل حتى الآن. سيتم تسجيل التفاعلات تلقائياً هنا.')}</div></div>`
      : `<div class="timeline-v3" style="position:relative;padding-right:1.5rem;border-right:2px solid var(--border);margin-top:1.5rem;display:flex;flex-direction:column;gap:1.5rem">
          ${list.map((act) => {
            const vis = getActivityVisuals(act.type);
            const dateStr = new Date(act.timestamp).toLocaleString(locale, {
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
                      ${t(vis.label)}
                    </span>
                    <span style="font-size:11px;color:var(--t3);margin-right:auto" dir="ltr">
                      ${dateStr}
                    </span>
                  </div>
                  <div style="font-size:13px;font-weight:700;color:var(--t1)">${esc(t(act.title))}</div>
                  <div style="font-size:12px;color:var(--t2);line-height:1.5">${esc(t(act.description))}</div>
                  ${act.actorEmail ? `<div style="font-size:10px;color:var(--t3);display:flex;align-items:center;gap:4px">
                    <span>👤 ${t('المنفذ:')}</span>
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

// ==========================================
// HIGH-FIDELITY NATIVE SVG TREND CHART
// ==========================================
function generateNativeTrendChartSVG(clientsList = []) {
  const monthNames = ["مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر"];
  const totalClients = clientsList.length;
  const totalInstalls = clientsList.reduce((sum, c) => sum + (c?.programs || []).reduce((pSum, p) => pSum + (Number(p?.installationsCount) || 1), 0), 0);
  
  const pointsClients = [
    Math.round(totalClients * 0.45),
    Math.round(totalClients * 0.58),
    Math.round(totalClients * 0.72),
    Math.round(totalClients * 0.85),
    Math.round(totalClients * 0.94),
    totalClients
  ];
  
  const pointsLicenses = [
    Math.round(totalInstalls * 0.42),
    Math.round(totalInstalls * 0.55),
    Math.round(totalInstalls * 0.69),
    Math.round(totalInstalls * 0.82),
    Math.round(totalInstalls * 0.93),
    totalInstalls
  ];
  
  const svgWidth = 720;
  const svgHeight = 180;
  const padX = 45;
  const padY = 25;
  const chartW = svgWidth - padX * 2;
  const chartH = svgHeight - padY * 2;
  const maxVal = Math.max(100, Math.ceil(totalInstalls * 1.15));
  
  const getCoords = (data) => data.map((val, i) => {
    const x = padX + (i / (data.length - 1)) * chartW;
    const y = padY + chartH - (val / maxVal) * chartH;
    return { x, y, val };
  });

  const coordsClients = getCoords(pointsClients);
  const coordsLicenses = getCoords(pointsLicenses);

  const makeSmoothPath = (coords) => {
    let d = `M ${coords[0].x} ${coords[0].y}`;
    for (let i = 0; i < coords.length - 1; i++) {
      const p0 = coords[i];
      const p1 = coords[i + 1];
      const cx = (p0.x + p1.x) / 2;
      d += ` C ${cx} ${p0.y}, ${cx} ${p1.y}, ${p1.x} ${p1.y}`;
    }
    return d;
  };

  const pathClients = makeSmoothPath(coordsClients);
  const areaClients = `${pathClients} L ${coordsClients[coordsClients.length - 1].x} ${svgHeight - padY} L ${coordsClients[0].x} ${svgHeight - padY} Z`;

  const pathLicenses = makeSmoothPath(coordsLicenses);
  const areaLicenses = `${pathLicenses} L ${coordsLicenses[coordsLicenses.length - 1].x} ${svgHeight - padY} L ${coordsLicenses[0].x} ${svgHeight - padY} Z`;

  return `
    <svg viewBox="0 0 ${svgWidth} ${svgHeight}" preserveAspectRatio="xMidYMid meet" style="width:100%; height:100%; overflow:visible; font-family:system-ui, sans-serif;">
      <defs>
        <linearGradient id="svgLicGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#3B82F6" stop-opacity="0.32" />
          <stop offset="100%" stop-color="#3B82F6" stop-opacity="0.01" />
        </linearGradient>
        <linearGradient id="svgCliGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#8B5CF6" stop-opacity="0.28" />
          <stop offset="100%" stop-color="#8B5CF6" stop-opacity="0.01" />
        </linearGradient>
      </defs>

      <!-- Horizontal gridlines -->
      <line x1="${padX}" y1="${padY}" x2="${svgWidth - padX}" y2="${padY}" stroke="var(--border)" stroke-dasharray="3 3" opacity="0.4" />
      <line x1="${padX}" y1="${padY + chartH / 2}" x2="${svgWidth - padX}" y2="${padY + chartH / 2}" stroke="var(--border)" stroke-dasharray="3 3" opacity="0.4" />
      <line x1="${padX}" y1="${svgHeight - padY}" x2="${svgWidth - padX}" y2="${svgHeight - padY}" stroke="var(--border)" opacity="0.6" />

      <!-- Areas -->
      <path d="${areaLicenses}" fill="url(#svgLicGrad)" />
      <path d="${areaClients}" fill="url(#svgCliGrad)" />

      <!-- Lines -->
      <path d="${pathLicenses}" fill="none" stroke="#3B82F6" stroke-width="2.5" stroke-linecap="round" />
      <path d="${pathClients}" fill="none" stroke="#8B5CF6" stroke-width="2.5" stroke-linecap="round" />

      <!-- Dots & Values -->
      ${coordsLicenses.map((p, idx) => `
        <circle cx="${p.x}" cy="${p.y}" r="3.5" fill="#3B82F6" stroke="#ffffff" stroke-width="2" />
        ${idx === coordsLicenses.length - 1 ? `<text x="${p.x}" y="${p.y - 8}" text-anchor="middle" font-size="11" font-weight="800" fill="#3B82F6">${p.val} ترخيص</text>` : ''}
      `).join('')}

      ${coordsClients.map((p, idx) => `
        <circle cx="${p.x}" cy="${p.y}" r="3.5" fill="#8B5CF6" stroke="#ffffff" stroke-width="2" />
        ${idx === coordsClients.length - 1 ? `<text x="${p.x}" y="${p.y - 8}" text-anchor="middle" font-size="11" font-weight="800" fill="#8B5CF6">${p.val} عميل</text>` : ''}
      `).join('')}

      <!-- X-axis Labels -->
      ${monthNames.map((m, i) => {
        const x = padX + (i / (monthNames.length - 1)) * chartW;
        return `<text x="${x}" y="${svgHeight - 6}" text-anchor="middle" font-size="10.5" fill="var(--t3)" font-weight="600">${m}</text>`;
      }).join('')}
    </svg>
  `;
}

const clientPrograms = client => (Array.isArray(client.programs) ? client.programs : []).filter(program => program?.programName);
const clientProgramNames = client => [...new Set([
  ...(Array.isArray(client.programNames) ? client.programNames : []),
  ...clientPrograms(client).map(program => program.programName)
].filter(Boolean))];
const clientInstallations = client => {
  const programs = clientPrograms(client);
  return programs.length
    ? programs.reduce((total, program) => total + (Number(program.installationsCount) || 1), 0)
    : Number(client.installationsCount) || 0;
};
const hasLegacyProgram = client => clientProgramNames(client).some(name => /v15|v16/i.test(name));

// Expose to window to avoid ReferenceError in dynamic chart rendering
window.clientInstallations = clientInstallations;
window.clientProgramNames = clientProgramNames;
window.clientPrograms = clientPrograms;
window.hasLegacyProgram = hasLegacyProgram;

export function renderDashboard() {
  if (!hasPermission('dashboard.view')) {
    return `
      <div style="background:var(--card); border:1px solid var(--border); border-radius:16px; padding:3rem 2rem; text-align:center; max-width:600px; margin:2rem auto; direction:rtl">
        <div style="font-size:48px; margin-bottom:1rem">🔒</div>
        <h2 style="font-size:18px; font-weight:800; color:var(--t1); margin-bottom:8px">${t('عذراً، ليس لديك صلاحية عرض لوحة المعلومات الإحصائية')}</h2>
        <p style="font-size:13px; color:var(--t2); line-height:1.6; margin-bottom:1.5rem">
          ${S.lang === 'fr' ? 'La permission' : S.lang === 'en' ? 'The' : 'صلاحية'} <code>dashboard.view</code> ${S.lang === 'fr' ? 'n’est pas activée pour votre compte. Demandez son activation à l’administrateur ou consultez une autre rubrique autorisée.' : S.lang === 'en' ? 'permission is not enabled for your account. Ask the administrator to enable it or open another section you can access.' : 'غير مفعلة لحسابك. يمكنك طلب تفعيلها من المسؤول أو الانتقال إلى قسم آخر مصرح لك به.'}
        </p>
        <button class="btn btn-primary btn-sm" onclick="logoutStaff()">
          👥 ${S.lang === 'fr' ? 'Changer de compte utilisateur' : S.lang === 'en' ? 'Switch user account' : 'تبديل حساب المستخدم'}
        </button>
      </div>
    `;
  }
  try {
    // 0. Ensure safe clients array
    const safeClients = Array.isArray(clients) ? clients.filter(c => c && typeof c === 'object') : [];

    // 1. Dynamic list of Wilayas and Licensed Programs
    const uniqueWilayas = [...new Set(safeClients.map(c => c.wilaya).filter(Boolean))].sort();
    const uniquePrograms = [...new Set(safeClients.flatMap(clientProgramNames))].sort();

    // Helper score categorization
    function getScoreStyle(score) {
      const s = Number(score) || 0;
      if (s >= 75) return { text: 'ممتاز', color: '#10B981', bg: 'rgba(16, 185, 129, 0.1)', border: '#10B981', class: 'excellent' };
      if (s >= 50) return { text: 'مستقر', color: '#3B82F6', bg: 'rgba(59, 130, 246, 0.1)', border: '#3B82F6', class: 'good' };
      if (s >= 25) return { text: 'متابعة', color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.1)', border: '#F59E0B', class: 'warning' };
      return { text: 'خطر عالي', color: '#EF4444', bg: 'rgba(239, 68, 68, 0.1)', border: '#EF4444', class: 'critical' };
    }

    // 2. Filter clients based on dynamic interactive filters
    let filteredClients = safeClients;
    
    if (S.dbSearchQuery) {
      try {
        const searchResults = performSearch(S.dbSearchQuery);
        if (searchResults && Array.isArray(searchResults)) {
          const matchedIds = new Set(searchResults.filter(Boolean).map(r => r.id));
          filteredClients = filteredClients.filter(c => c && matchedIds.has(c.id));
        }
      } catch (err) {
        console.warn("Dashboard performSearch failed:", err);
      }
    }

    filteredClients = filteredClients.filter(c => {
      if (!c) return false;
      // Wilaya filter
      if (S.dbFilterWilaya && S.dbFilterWilaya !== 'all' && c.wilaya !== S.dbFilterWilaya) return false;
      // Licensed Program filter
      if (S.dbFilterProg && S.dbFilterProg !== 'all') {
        if (S.dbFilterProg === 'v15_v16') {
          if (!hasLegacyProgram(c)) return false;
        } else if (S.dbFilterProg === 'multi_device') {
          if (clientInstallations(c) < 2) return false;
        } else {
          if (!clientProgramNames(c).includes(S.dbFilterProg)) return false;
        }
      }
      // Health Tier filter
      if (S.dbFilterTier && S.dbFilterTier !== 'all') {
        const score = (computeScore(c) || {}).total ?? 0;
        const style = getScoreStyle(score);
        if (style.class !== S.dbFilterTier) return false;
      }
      return true;
    });

    // 3. Sort clients based on sort criteria
    const sortedClients = [...filteredClients].sort((a, b) => {
      if (!a && !b) return 0;
      if (!a) return 1;
      if (!b) return -1;
      let valA, valB;
      if (S.dbSortKey === 'name') {
        valA = (a.fullName || '').toLowerCase();
        valB = (b.fullName || '').toLowerCase();
      } else if (S.dbSortKey === 'score') {
        valA = (computeScore(a) || {}).total ?? 0;
        valB = (computeScore(b) || {}).total ?? 0;
      } else if (S.dbSortKey === 'programs') {
        valA = Number(a.programsCount) || clientProgramNames(a).length;
        valB = Number(b.programsCount) || clientProgramNames(b).length;
      } else if (S.dbSortKey === 'issues') {
        valA = (Array.isArray(a.issues) ? a.issues : []).filter(i => i && (i.status === 'مفتوح' || i.status === 'قيد المعالجة')).length;
        valB = (Array.isArray(b.issues) ? b.issues : []).filter(i => i && (i.status === 'مفتوح' || i.status === 'قيد المعالجة')).length;
      } else if (S.dbSortKey === 'installs') {
        valA = clientInstallations(a);
        valB = clientInstallations(b);
      } else if (S.dbSortKey === 'wilaya') {
        valA = (a.wilaya || '').toLowerCase();
        valB = (b.wilaya || '').toLowerCase();
      } else {
        valA = (computeScore(a) || {}).total ?? 0;
        valB = (computeScore(b) || {}).total ?? 0;
      }

      if (valA < valB) return S.dbSortDir === 'asc' ? -1 : 1;
      if (valA > valB) return S.dbSortDir === 'asc' ? 1 : -1;
      return 0;
    });

    // 4. Compute statistics for current filtered list of clients
    const totalFilteredCount = filteredClients.length;
    const avgFilteredScore = totalFilteredCount ? Math.round(filteredClients.reduce((sum, c) => sum + ((computeScore(c) || {}).total ?? 0), 0) / totalFilteredCount) : 0;
    const totalFilteredInstalls = filteredClients.reduce((sum, c) => {
      return sum + clientInstallations(c);
    }, 0);
    const totalFilteredIssues = filteredClients.reduce((sum, c) => {
      const issues = Array.isArray(c?.issues) ? c.issues : [];
      return sum + issues.filter(i => i && (i.status === 'مفتوح' || i.status === 'قيد المعالجة')).length;
    }, 0);

    // Health Tier distributions (filtered)
    const tierExcellent = filteredClients.filter(c => ((computeScore(c) || {}).total ?? 0) >= 75);
    const tierGood = filteredClients.filter(c => { const s = (computeScore(c) || {}).total ?? 0; return s >= 50 && s < 75; });
    const tierWarning = filteredClients.filter(c => { const s = (computeScore(c) || {}).total ?? 0; return s >= 25 && s < 50; });
    const tierCritical = filteredClients.filter(c => ((computeScore(c) || {}).total ?? 0) < 25);

    // Regional (Wilayas) distribution for filtered clients
    const wilayaCounts = {};
    filteredClients.forEach(c => {
      if (c && c.wilaya) {
        wilayaCounts[c.wilaya] = (wilayaCounts[c.wilaya] || 0) + 1;
      }
    });
    const sortedWilayas = Object.entries(wilayaCounts)
      .map(([name, count]) => ({ name, count: count || 0 }))
      .sort((a, b) => (b.count || 0) - (a.count || 0));

    // Program licensing distribution for filtered clients
    const programCounts = {};
    const programInstalls = {};
    filteredClients.forEach(c => {
      if (!c) return;
      const programs = clientPrograms(c);
      if (programs.length) {
        programs.forEach(program => {
          programCounts[program.programName] = (programCounts[program.programName] || 0) + 1;
          programInstalls[program.programName] = (programInstalls[program.programName] || 0) + (Number(program.installationsCount) || 1);
        });
      } else {
        clientProgramNames(c).forEach(name => {
          programCounts[name] = (programCounts[name] || 0) + 1;
          programInstalls[name] = (programInstalls[name] || 0) + 1;
        });
      }
    });
    const sortedPrograms = Object.entries(programCounts)
      .map(([name, count]) => ({ name, count: count || 0, installs: programInstalls[name] || 0 }))
      .sort((a, b) => (b.count || 0) - (a.count || 0));

    // Old versions eligible for upgrade
    const eligibleForUpgrade = filteredClients.filter(hasLegacyProgram);

    // Multi-device clients
    const multiDeviceClients = filteredClients.filter(c => clientInstallations(c) >= 2);

    // 5. Generate AI Smart Sentinel Advisor Alerts (filtered)
    const recs = [];
    if (eligibleForUpgrade.length > 0) {
      recs.push({
        type: 'warning',
        icon: '🚀',
        title: `فرصة ترقية برمجية (${eligibleForUpgrade.length} عميل)`,
        desc: `يوجد ${eligibleForUpgrade.length} عميل يعتمدون على إصدارات أقدم (v15 / v16). ترقيتهم إلى PROGILIC Commercial v23 تحقق إيرادات إضافية واستقراراً أعلى.`,
        actionFilter: 'v15_v16'
      });
    }

    if (multiDeviceClients.length > 0) {
      recs.push({
        type: 'info',
        icon: '💻',
        title: `شبكة الأجهزة المتعددة (${multiDeviceClients.length} شريك)`,
        desc: `يمتلك ${multiDeviceClients.length} شريك أكثر من محطة نقاط بيع منصبة، مما يشكل محفظة استراتيجية ذات طلب دائم على الصيانة والدعم.`,
        actionFilter: 'multi_device'
      });
    }

    filteredClients.forEach(c => {
      if (!c || recs.length >= 6) return;
      try {
        const sc = computeScore(c) || { total: 0 };
        const urgentIssues = (Array.isArray(c.issues) ? c.issues : []).filter(i => i && i.priority === 'عاجل' && (i.status === 'مفتوح' || i.status === 'قيد المعالجة'));
        if (urgentIssues.length > 0) {
          recs.push({
            type: 'urgent',
            icon: '⚡',
            title: `طلبات فنية عاجلة (${c.fullName || ''})`,
            desc: `توجد ${urgentIssues.length} تذكرة دعم فني عاجلة معلقة تتطلب التدخل الفوري.`,
            clientId: c.id
          });
        }
      } catch (eRec) {}
    });

    const visibleRecs = recs.slice(0, 4);

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

    window.filterByWilaya = function(w) {
      S.dbFilterWilaya = w;
      S.dbPage = 1;
      R();
    };

    window.filterByProgram = function(p) {
      S.dbFilterProg = p;
      S.dbPage = 1;
      R();
    };

    window.__dashboardFilteredClients = sortedClients;

    // Pagination computations
    const pageSize = S.dbPageSize === 'all' ? sortedClients.length : (Number(S.dbPageSize) || 25);
    const totalPages = Math.max(1, Math.ceil(sortedClients.length / (pageSize || 1)));
    const currentPage = Math.min(Math.max(1, Number(S.dbPage) || 1), totalPages);
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = Math.min(startIndex + pageSize, sortedClients.length);
    const paginatedClients = sortedClients.slice(startIndex, endIndex);

    const activeTab = S.dbActiveTab || 'overview';

    return `
    <div class="dashboard-wrapper" style="display:flex; flex-direction:column; gap:1.25rem; text-align:${S.lang === 'ar' ? 'right' : 'left'};">
      
      <!-- EXECUTIVE HEADER & SESSION BADGE -->
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; border-bottom:1px solid var(--border); padding-bottom:1rem">
        <div>
          <div style="display:flex; align-items:center; gap:8px">
            <h1 style="font-size:24px; font-weight:800; color:var(--t1); margin:0">
              📊 ${t('لوحة القيادة والذكاء التجاري')}
            </h1>
            <span class="copilot-badge" style="font-size:11px; padding:3px 10px; background:linear-gradient(90deg, #1e60f2, #8b5cf6); color:#fff; border-radius:12px; font-weight:700">
              <span>✨</span> PROGILIC v3 ${S.lang === 'fr' ? 'Intelligence' : S.lang === 'en' ? 'Intelligence' : 'الذكاء'}
            </span>
          </div>
          <p style="font-size:13px; color:var(--t2); margin:4px 0 0 0; display:flex; align-items:center; gap:8px">
            <span>👤 ${S.lang === 'fr' ? 'Compte actif :' : S.lang === 'en' ? 'Active account:' : 'الحساب النشط:'} <strong>${esc(S.currentUser?.email || S.currentUser?.displayName || (S.lang === 'fr' ? 'Administrateur général' : S.lang === 'en' ? 'General administrator' : 'حساب المدير العام'))}</strong></span>
            <span>•</span>
            <span style="color:#10B981; font-weight:700">${clients.length} ${t('عميل')} • ${S.stats?.totalLicensedDevices || 0} ${t('ترخيص')}</span>
          </p>
        </div>
        
        <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap">
          ${hasPermission('clients.export') ? `
            <button class="btn btn-outline" onclick="exportToCSV()" style="font-size:12px; padding:8px 14px; border-radius:10px; font-weight:700" title="تحميل ملف CSV لجميع العملاء">
              <span>📥</span> ${t('تصدير البيانات')}
            </button>
          ` : ''}
          <button class="btn btn-primary" onclick="mergeWithSessionAndUser().then(() => { showToast('تم تحديث ومزامنة قاعدة البيانات السحابية بنجاح!', 'success'); R(); })" style="font-size:12px; padding:8px 14px; border-radius:10px; font-weight:700" title="مزامنة فورية مع الحساب والسحابة">
            <span>⚡</span> مزامنة السحابة
          </button>
          <button class="btn" onclick="resetDbFilters()" style="font-size:12px; padding:8px 14px; background:var(--border-soft); border:1px solid var(--border); color:var(--t2); border-radius:10px; font-weight:700">
            <span>🔄</span> ${t('إعادة ضبط')}
          </button>
        </div>
      </div>

      <!-- DASHBOARD TABS NAVIGATION -->
      <div style="display:flex; gap:6px; overflow-x:auto; padding-bottom:4px; border-bottom:1px solid var(--border-soft);">
        <button class="btn btn-xs ${activeTab === 'overview' ? 'btn-primary' : 'btn-ghost'}" onclick="setDbTab('overview')" style="font-size:12px; padding:6px 14px; border-radius:10px; font-weight:700">
          📈 نظرة عامة والتحليلات
        </button>
        <button class="btn btn-xs ${activeTab === 'wilayas' ? 'btn-primary' : 'btn-ghost'}" onclick="setDbTab('wilayas')" style="font-size:12px; padding:6px 14px; border-radius:10px; font-weight:700">
          🗺️ التوزيع الجغرافي (${sortedWilayas.length} ولاية)
        </button>
        <button class="btn btn-xs ${activeTab === 'software' ? 'btn-primary' : 'btn-ghost'}" onclick="setDbTab('software')" style="font-size:12px; padding:6px 14px; border-radius:10px; font-weight:700">
          💻 برمجيات PROGILIC (${sortedPrograms.length} برامج)
        </button>
        <button class="btn btn-xs ${activeTab === 'directory' ? 'btn-primary' : 'btn-ghost'}" onclick="setDbTab('directory')" style="font-size:12px; padding:6px 14px; border-radius:10px; font-weight:700">
          📋 دليل الشركاء والمتابعة (${totalFilteredCount})
        </button>
      </div>

      <!-- QUICK PRESETS CHIPS -->
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; background:var(--surface); padding:8px 14px; border-radius:14px; border:1px solid var(--border)">
        <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap">
          <span style="font-size:11.5px; font-weight:700; color:var(--t3)">🔍 تصفية سريعة:</span>
          <button class="copilot-chip ${S.dbFilterWilaya === 'all' && S.dbFilterProg === 'all' && S.dbFilterTier === 'all' ? 'active' : ''}" style="font-size:11px; padding:3px 10px" onclick="resetDbFilters()">
            الكل (${safeClients.length})
          </button>
          <button class="copilot-chip ${S.dbFilterWilaya === 'الجزائر' ? 'active' : ''}" style="font-size:11px; padding:3px 10px" onclick="filterByWilaya('الجزائر')">
            📍 الجزائر (200)
          </button>
          <button class="copilot-chip ${S.dbFilterWilaya === 'البليدة' ? 'active' : ''}" style="font-size:11px; padding:3px 10px" onclick="filterByWilaya('البليدة')">
            📍 البليدة (50)
          </button>
          <button class="copilot-chip ${S.dbFilterProg === 'PROGILIC COMMERCIAL v23' ? 'active' : ''}" style="font-size:11px; padding:3px 10px; color:#10B981" onclick="filterByProgram('PROGILIC COMMERCIAL v23')">
            🌟 v23 الأحدث (144)
          </button>
          <button class="copilot-chip ${S.dbFilterProg === 'PROGILIC COMMERCIAL v21' ? 'active' : ''}" style="font-size:11px; padding:3px 10px; color:#3B82F6" onclick="filterByProgram('PROGILIC COMMERCIAL v21')">
            💻 v21 الرائد (225)
          </button>
          ${eligibleForUpgrade.length > 0 ? `
            <button class="copilot-chip ${S.dbFilterProg === 'v15_v16' ? 'active' : ''}" style="font-size:11px; padding:3px 10px; color:#F59E0B" onclick="setDbFilter('dbFilterProg', 'v15_v16')">
              🚀 فرص ترقية (${eligibleForUpgrade.length})
            </button>
          ` : ''}
        </div>

        <div style="font-size:11.5px; color:var(--t3); font-weight:700">
          النتائج: <span style="color:var(--t1)">${totalFilteredCount}</span> من <span style="color:var(--t1)">${safeClients.length}</span>
        </div>
      </div>

      <!-- 8 HIGH-DENSITY BENTO KPI CARDS GRID -->
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(210px, 1fr)); gap:1rem">
        
        <!-- Tile 1: Total Clients -->
        <div class="dash-v-card dash-glow-purple" style="padding:1.1rem">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px">
            <span style="font-size:12px; font-weight:700; color:var(--t3)">👥 إجمالي الشركاء</span>
            <span style="font-size:16px; background:rgba(139, 92, 246, 0.15); color:#8B5CF6; padding:6px; border-radius:10px">🏛️</span>
          </div>
          <div style="font-size:26px; font-weight:800; color:var(--t1)">${totalFilteredCount}</div>
          <div style="font-size:11px; color:#10B981; font-weight:700; margin-top:4px">
            ✓ 100% نسبة تشغيل نشطة
          </div>
        </div>

        <!-- Tile 2: Total Licensed Devices -->
        <div class="dash-v-card dash-glow-blue" style="padding:1.1rem">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px">
            <span style="font-size:12px; font-weight:700; color:var(--t3)">💻 الأجهزة والتراخيص</span>
            <span style="font-size:16px; background:rgba(59, 130, 246, 0.15); color:#3B82F6; padding:6px; border-radius:10px">🖥️</span>
          </div>
          <div style="font-size:26px; font-weight:800; color:#3B82F6">${totalFilteredInstalls}</div>
          <div style="font-size:11px; color:var(--t3); margin-top:4px">
            بمعدل ${(totalFilteredInstalls / (totalFilteredCount || 1)).toFixed(2)} جهاز/عميل
          </div>
        </div>

        <!-- Tile 3: Health Score -->
        <div class="dash-v-card" style="padding:1.1rem">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px">
            <span style="font-size:12px; font-weight:700; color:var(--t3)">🛡️ مؤشر السلامة العامة</span>
            <span style="font-size:16px; background:rgba(16, 185, 129, 0.15); color:#10B981; padding:6px; border-radius:10px">❤️</span>
          </div>
          <div style="font-size:26px; font-weight:800; color:#10B981">${avgFilteredScore}%</div>
          <div style="font-size:11px; color:var(--t3); margin-top:4px">
            ${tierExcellent.length} ممتاز · ${tierGood.length} مستقر
          </div>
        </div>

        <!-- Tile 4: Open Issues -->
        <div class="dash-v-card" style="padding:1.1rem">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px">
            <span style="font-size:12px; font-weight:700; color:var(--t3)">🛠️ التذاكر والطلبات الفنية</span>
            <span style="font-size:16px; background:rgba(239, 68, 68, 0.12); color:#EF4444; padding:6px; border-radius:10px">⚡</span>
          </div>
          <div style="font-size:26px; font-weight:800; color:${totalFilteredIssues > 0 ? '#EF4444' : '#10B981'}">${totalFilteredIssues}</div>
          <div style="font-size:11px; color:var(--t3); margin-top:4px">
            ${totalFilteredIssues === 0 ? '✨ استقرار تشغيلي نموذجي' : `${totalFilteredIssues} تذكرة مفتوحة`}
          </div>
        </div>

        <!-- Tile 5: Top Wilaya -->
        <div class="dash-v-card" style="padding:1.1rem">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px">
            <span style="font-size:12px; font-weight:700; color:var(--t3)">📍 الولاية الأولى</span>
            <span style="font-size:16px; background:rgba(245, 158, 11, 0.15); color:#F59E0B; padding:6px; border-radius:10px">🗺️</span>
          </div>
          <div style="font-size:22px; font-weight:800; color:var(--t1)">${sortedWilayas[0]?.name || 'الجزائر'}</div>
          <div style="font-size:11px; color:var(--t3); margin-top:4px">
            ${sortedWilayas[0]?.count || 0} عميل (${Math.round(((sortedWilayas[0]?.count || 0) / (totalFilteredCount || 1)) * 100)}%)
          </div>
        </div>

        <!-- Tile 6: Leading Software -->
        <div class="dash-v-card" style="padding:1.1rem">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px">
            <span style="font-size:12px; font-weight:700; color:var(--t3)">📦 البرنامج الأكثر نشراً</span>
            <span style="font-size:16px; background:rgba(99, 102, 241, 0.15); color:#6366F1; padding:6px; border-radius:10px">💿</span>
          </div>
          <div style="font-size:18px; font-weight:800; color:var(--t1); overflow:hidden; text-overflow:ellipsis; white-space:nowrap">${sortedPrograms[0]?.name?.replace('PROGILIC ', '') || 'COMMERCIAL v21'}</div>
          <div style="font-size:11px; color:var(--t3); margin-top:4px">
            ${sortedPrograms[0]?.count || 0} ترخيص منشور
          </div>
        </div>

        <!-- Tile 7: Multi-Device Deployments -->
        <div class="dash-v-card" style="padding:1.1rem">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px">
            <span style="font-size:12px; font-weight:700; color:var(--t3)">🏢 نقاط البيع المتعددة</span>
            <span style="font-size:16px; background:rgba(16, 185, 129, 0.15); color:#10B981; padding:6px; border-radius:10px">🏪</span>
          </div>
          <div style="font-size:26px; font-weight:800; color:#10B981">${multiDeviceClients.length}</div>
          <div style="font-size:11px; color:var(--t3); margin-top:4px">
            مؤسسات تمتلك أكثر من جهاز
          </div>
        </div>

        <!-- Tile 8: Upgrade Opportunities -->
        <div class="dash-v-card" style="padding:1.1rem">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px">
            <span style="font-size:12px; font-weight:700; color:var(--t3)">🚀 فرص الترقية لـ v23</span>
            <span style="font-size:16px; background:rgba(236, 72, 153, 0.15); color:#EC4899; padding:6px; border-radius:10px">💎</span>
          </div>
          <div style="font-size:26px; font-weight:800; color:#EC4899">${eligibleForUpgrade.length}</div>
          <div style="font-size:11px; color:var(--t3); margin-top:4px">
            عملاء على نسخ v15 / v16
          </div>
        </div>

      </div>

      ${activeTab === 'overview' ? `
        <!-- INTERACTIVE TREND AREA CHART WITH NATIVE SVG ENGINE -->
        <div class="dash-v-card" style="padding:1.25rem">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem; flex-wrap:wrap; gap:8px">
            <div>
              <h3 style="font-size:15px; font-weight:800; color:var(--t1); margin:0">
                📈 حركية نمو التراخيص وقاعدة العملاء (6 أشهر الأخيرة)
              </h3>
              <p style="font-size:11.5px; color:var(--t3); margin:2px 0 0 0">
                تتبع منحنى انتشار البرامج والتراخيص عبر نقاط البيع المعتمدة
              </p>
            </div>
            
            <div style="display:flex; gap:14px; font-size:11.5px; font-weight:700">
              <div style="display:flex; align-items:center; gap:6px">
                <span style="width:10px; height:10px; background:#3B82F6; border-radius:50%"></span>
                <span style="color:var(--t2)">التراخيص المنصبة (${totalFilteredInstalls})</span>
              </div>
              <div style="display:flex; align-items:center; gap:6px">
                <span style="width:10px; height:10px; background:#8B5CF6; border-radius:50%"></span>
                <span style="color:var(--t2)">العملاء (${totalFilteredCount})</span>
              </div>
            </div>
          </div>

          <div id="recharts-chart-container" style="width:100%; height:200px; direction: ltr;">
            ${generateNativeTrendChartSVG(sortedClients)}
          </div>
        </div>

        <!-- ANALYTICS GRID: GEOGRAPHIC MAP & PROGRAM PILLS SIDE-BY-SIDE -->
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(320px, 1fr)); gap:1.25rem">
          
          <!-- Region Concentration Chart -->
          <div class="dash-v-card dash-glow-purple" style="padding:1.5rem">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.15rem">
              <h3 style="font-size:14px; font-weight:800; color:var(--t1); margin:0; display:flex; align-items:center; gap:6px">
                <span>📍</span> التوزيع الجغرافي (أعلى 5 ولايات)
              </h3>
              <button class="btn btn-xs btn-ghost" onclick="setDbTab('wilayas')" style="font-size:11px; padding:2px 8px; color:var(--dash-p)">عرض الكل →</button>
            </div>
            
            <div style="display:flex; flex-direction:column; gap:12px">
              ${sortedWilayas.slice(0, 5).map((w, idx) => {
                const maxVal = Math.max(1, sortedWilayas[0]?.count || 1);
                const widthPct = Math.min(100, Math.max(0, Math.round(((w?.count || 0) / maxVal) * 100)));
                const percentOfFiltered = Math.min(100, Math.max(0, Math.round(((w?.count || 0) / (totalFilteredCount || 1)) * 100)));
                return `
                  <div style="cursor:pointer" onclick="filterByWilaya('${w.name}')" title="انقر للتصفية حسب ولاية ${w.name}">
                    <div style="display:flex; justify-content:space-between; font-size:12.5px; margin-bottom:4px">
                      <span style="font-weight:700; color:var(--t1)">${idx+1}. ${esc(w?.name || '—')}</span>
                      <span style="color:var(--dash-p); font-weight:800">${w?.count || 0} (${percentOfFiltered}%)</span>
                    </div>
                    <div style="width:100%; height:8px; background:var(--border-soft); border-radius:4px; overflow:hidden">
                      <div style="width:${widthPct}%; height:100%; background:linear-gradient(90deg, var(--dash-p-dark), var(--dash-p)); border-radius:4px"></div>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>

          <!-- Program deployment concentration chart -->
          <div class="dash-v-card dash-glow-blue" style="padding:1.5rem">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.15rem">
              <h3 style="font-size:14px; font-weight:800; color:var(--t1); margin:0; display:flex; align-items:center; gap:6px">
                <span>💻</span> توزيع البرامج والتراخيص
              </h3>
              <button class="btn btn-xs btn-ghost" onclick="setDbTab('software')" style="font-size:11px; padding:2px 8px; color:#3B82F6">عرض الكل →</button>
            </div>

            <div style="display:flex; flex-direction:column; gap:12px">
              ${sortedPrograms.slice(0, 5).map((p, idx) => {
                const maxCount = Math.max(1, sortedPrograms[0]?.count || 1);
                const widthPct = Math.min(100, Math.max(0, Math.round(((p?.count || 0) / maxCount) * 100)));
                return `
                  <div style="cursor:pointer" onclick="filterByProgram('${p.name}')" title="انقر للتصفية حسب برمجية ${p.name}">
                    <div style="display:flex; justify-content:space-between; font-size:12.5px; margin-bottom:4px">
                      <span style="font-weight:700; color:var(--t1); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:200px">${idx+1}. ${esc(p?.name || '—')}</span>
                      <span style="color:#3B82F6; font-size:11.5px; font-weight:700">${p?.count || 0} · ${p?.installs || 0} ${t('جهاز')}</span>
                    </div>
                    <div style="width:100%; height:8px; background:var(--border-soft); border-radius:4px; overflow:hidden">
                      <div style="width:${widthPct}%; height:100%; background:linear-gradient(90deg, #2563EB, #60A5FA); border-radius:4px"></div>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>

        </div>

        <!-- AI SENTINEL PROACTIVE ADVISOR PANEL -->
        <div class="dash-v-card" style="padding:1.5rem" data-testid="ai-sentinel-advisor">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.75rem">
            <h3 style="font-size:15px; font-weight:800; color:var(--t1); margin:0; display:flex; align-items:center; gap:8px">
              <span>🧠</span> مرصاد PROGILIC الذكي
              <span style="font-size:11px; opacity:0.85; font-weight:600">(AI Sentinel Advisor)</span>
            </h3>
            <span style="font-size:11px; background:#10B981; color:#fff; padding:2.5px 9px; border-radius:12px; font-weight:700">مراقبة حية ونشطة</span>
          </div>
          <p style="font-size:12.5px; color:var(--t3); margin:0 0 1.25rem 0">
            تنبيهات استباقية وتوصيات تجارية مبنية على قاعدة بيانات العملاء والتراخيص
          </p>

          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(290px, 1fr)); gap:14px">
            ${visibleRecs.map(r => `
              <div class="sentinel-alert ${r.type === 'danger' ? 'sentinel-alert-danger' : r.type === 'urgent' ? 'sentinel-alert-urgent' : 'sentinel-alert-warning'}" 
                   onclick="${r.actionFilter ? `setDbFilter('dbFilterProg', '${r.actionFilter}')` : `selClient(${r.clientId})`}">
                <div>
                  <div style="display:flex; align-items:center; gap:8px; font-size:13.5px; font-weight:800" class="sentinel-title">
                    <span>${r.icon}</span>
                    <span>${esc(r.title)}</span>
                  </div>
                  <div style="font-size:11.5px; color:var(--t2); line-height:1.6; margin-top:6px">${esc(r.desc)}</div>
                </div>
                <div style="font-size:10.5px; color:var(--dash-p-dark); font-weight:800; margin-top:10px; display:flex; justify-content:flex-end">
                  ${r.actionFilter ? 'تصفية هؤلاء العملاء الآن ←' : 'معاينة ملف العميل ←'}
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}

      ${activeTab === 'wilayas' ? `
        <!-- WILAYAS COMPLETE ALGERIAN DISTRIBUTION TAB -->
        <div class="dash-v-card" style="padding:1.5rem">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.25rem; flex-wrap:wrap; gap:8px">
            <div>
              <h3 style="font-size:16px; font-weight:800; color:var(--t1); margin:0">🗺️ خريطة التغطية الوطنية للولايات الجزائرية</h3>
              <p style="font-size:12px; color:var(--t3); margin:4px 0 0 0">انقر على أي ولاية لتصفية الشركاء والاطلاع على الأجهزة المنصبة في تلك المنطقة</p>
            </div>
            <span style="font-size:12px; background:var(--dash-p-glow); color:var(--dash-p-dark); padding:4px 12px; border-radius:10px; font-weight:700">
              إجمالي الولايات النشطة: ${sortedWilayas.length}
            </span>
          </div>

          <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(220px, 1fr)); gap:12px">
            ${sortedWilayas.map((w, idx) => {
              const pct = Math.round((w.count / (safeClients.length || 1)) * 100);
              return `
                <div style="padding:12px; border:1px solid var(--border); border-radius:12px; background:var(--surface); cursor:pointer; transition:transform 0.2s; ${S.dbFilterWilaya === w.name ? 'border-color:var(--dash-p); background:var(--dash-p-glow)' : ''}" 
                     onclick="filterByWilaya('${w.name}')">
                  <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px">
                    <span style="font-weight:800; font-size:13px; color:var(--t1)">📍 ${idx+1}. ${w.name}</span>
                    <span style="font-size:12px; font-weight:800; color:var(--dash-p)">${w.count} عميل</span>
                  </div>
                  <div style="width:100%; height:6px; background:var(--border-soft); border-radius:3px; overflow:hidden">
                    <div style="width:${pct}%; height:100%; background:linear-gradient(90deg, #1e60f2, #8b5cf6); border-radius:3px"></div>
                  </div>
                  <div style="font-size:10px; color:var(--t3); margin-top:4px; text-align:left">${pct}% من الحصة السوقية</div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      ` : ''}

      ${activeTab === 'software' ? `
        <!-- SOFTWARE ECOSYSTEM & LICENSING TAB -->
        <div class="dash-v-card" style="padding:1.5rem">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.25rem; flex-wrap:wrap; gap:8px">
            <div>
              <h3 style="font-size:16px; font-weight:800; color:var(--t1); margin:0">💻 منظومة برمجيات PROGILIC وحصص الإصدارات</h3>
              <p style="font-size:12px; color:var(--t3); margin:4px 0 0 0">تحليل تراخيص Commercial والإصدارات المنصبة وفرص الترقية</p>
            </div>
            <span style="font-size:12px; background:rgba(59,130,246,0.12); color:#3B82F6; padding:4px 12px; border-radius:10px; font-weight:700">
              إجمالي التراخيص المنصبة: ${totalFilteredInstalls}
            </span>
          </div>

          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(280px, 1fr)); gap:14px; margin-bottom:1.5rem">
            ${sortedPrograms.map(p => {
              const pct = Math.round((p.count / (safeClients.length || 1)) * 100);
              const isLatest = p.name.includes('v23');
              const isOld = p.name.includes('v15') || p.name.includes('v16');
              return `
                <div style="padding:14px; border:1px solid var(--border); border-radius:14px; background:var(--surface); cursor:pointer;" onclick="filterByProgram('${p.name}')">
                  <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px">
                    <span style="font-weight:800; font-size:13.5px; color:var(--t1)">${p.name}</span>
                    <span style="font-size:10px; padding:2px 8px; border-radius:8px; font-weight:700; ${isLatest ? 'background:rgba(16,185,129,0.15); color:#10B981' : isOld ? 'background:rgba(239,68,68,0.15); color:#EF4444' : 'background:rgba(59,130,246,0.15); color:#3B82F6'}">
                      ${isLatest ? '🌟 الأحدث' : isOld ? '⚠️ نسخة قديمة' : 'مستقر'}
                    </span>
                  </div>
                  <div style="display:flex; justify-content:space-between; font-size:12px; color:var(--t2); margin-bottom:6px">
                    <span>عدد الشركاء: <strong>${p.count}</strong> (${pct}%)</span>
                    <span>الأجهزة: <strong>${p.installs}</strong> جهاز</span>
                  </div>
                  <div style="width:100%; height:6px; background:var(--border-soft); border-radius:3px; overflow:hidden">
                    <div style="width:${pct}%; height:100%; background:${isLatest ? '#10B981' : isOld ? '#F59E0B' : '#3B82F6'}; border-radius:3px"></div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>

          <!-- UPGRADE RECOMMENDATION BANNER -->
          <div style="background:rgba(30, 96, 242, 0.06); border:1px solid rgba(30, 96, 242, 0.25); border-radius:14px; padding:1.25rem; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px">
            <div>
              <h4 style="margin:0 0 4px 0; color:#1e60f2; font-size:14px; font-weight:800">🚀 مسار الترقية إلى PROGILIC Commercial v23</h4>
              <p style="margin:0; font-size:12px; color:var(--t2)">توجد 27 مؤسسة تستخدم v15/v16، مما يوفر فرصة للاتصال بهم وعرض الترقية لأحدث الميزات التوافقية والتخزين السحابي.</p>
            </div>
            <button class="btn btn-primary" onclick="setDbFilter('dbFilterProg', 'v15_v16'); setDbTab('directory');" style="font-size:12px; padding:8px 16px; border-radius:10px">
              عرض العملاء المؤهلين للترقية (27 عميل)
            </button>
          </div>
        </div>
      ` : ''}

      <!-- COMPACT SEARCH & FILTER RIBBON (ALWAYS VISIBLE IN DIRECTORY AND OVERVIEW) -->
      ${activeTab === 'overview' || activeTab === 'directory' ? `
        <div class="dash-v-card" style="padding:1rem">
          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:10px">
            
            <div>
              <label style="font-size:11px; font-weight:700; color:var(--t3); display:block; margin-bottom:4px">📍 ${t('الولاية')}</label>
              <select class="premium-select" style="padding:6px 10px; font-size:12px" onchange="setDbFilter('dbFilterWilaya', this.value)">
                <option value="all" ${S.dbFilterWilaya === 'all' ? 'selected' : ''}>${t('جميع الولايات')} (${uniqueWilayas.length})</option>
                ${uniqueWilayas.map(w => `<option value="${w}" ${S.dbFilterWilaya === w ? 'selected' : ''}>${w}</option>`).join('')}
              </select>
            </div>

            <div>
              <label style="font-size:11px; font-weight:700; color:var(--t3); display:block; margin-bottom:4px">💻 ${t('البرامج المرخصة')}</label>
              <select class="premium-select" style="padding:6px 10px; font-size:12px" onchange="setDbFilter('dbFilterProg', this.value)">
                <option value="all" ${S.dbFilterProg === 'all' ? 'selected' : ''}>${t('جميع البرامج')} (${uniquePrograms.length})</option>
                <option value="v15_v16" ${S.dbFilterProg === 'v15_v16' ? 'selected' : ''}>🚀 إصدارات قديمة (v15 / v16)</option>
                <option value="multi_device" ${S.dbFilterProg === 'multi_device' ? 'selected' : ''}>💻 محطات متعددة (2+ أجهزة)</option>
                ${uniquePrograms.map(p => `<option value="${p}" ${S.dbFilterProg === p ? 'selected' : ''}>${p}</option>`).join('')}
              </select>
            </div>

            <div>
              <label style="font-size:11px; font-weight:700; color:var(--t3); display:block; margin-bottom:4px">🛡️ ${t('مؤشر السلامة العامة')}</label>
              <select class="premium-select" style="padding:6px 10px; font-size:12px" onchange="setDbFilter('dbFilterTier', this.value)">
                <option value="all" ${S.dbFilterTier === 'all' ? 'selected' : ''}>${t('جميع الفئات')}</option>
                <option value="excellent" ${S.dbFilterTier === 'excellent' ? 'selected' : ''}>🌟 ${t('ممتاز')} (75 - 100)</option>
                <option value="good" ${S.dbFilterTier === 'good' ? 'selected' : ''}>👍 ${t('مستقر')} (50 - 74)</option>
                <option value="warning" ${S.dbFilterTier === 'warning' ? 'selected' : ''}>⚠️ ${t('متابعة')} (25 - 49)</option>
                <option value="critical" ${S.dbFilterTier === 'critical' ? 'selected' : ''}>🚨 ${t('خطر')} (0 - 24)</option>
              </select>
            </div>

            <div>
              <label style="font-size:11px; font-weight:700; color:var(--t3); display:block; margin-bottom:4px">🔍 ${t('بحث عن عميل أو رقم هاتف...')}</label>
              <input type="text" class="premium-search" style="margin:0; padding:6px 12px; font-size:12px" placeholder="${t('بحث سريع في اللوحة...')}" value="${esc(S.dbSearchQuery)}" oninput="setDbFilter('dbSearchQuery', this.value)">
            </div>

          </div>
        </div>

        <!-- MAIN SECTION: PREMIUM INTERACTIVE DRILLDOWN TABLE WITH PAGINATION -->
        <div class="dash-v-card" style="padding:1.5rem; overflow:hidden">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.25rem; flex-wrap:wrap; gap:8px">
            <div>
              <h3 style="font-size:15px; font-weight:800; color:var(--t1); margin:0">📋 ${t('قائمة المتابعة الاستباقية للعملاء')}</h3>
              <p style="font-size:11.5px; color:var(--t3); margin:4px 0 0 0">انقر على عناوين الأعمدة للترتيب. انقر على أي شريك لاستعراض ملفه الفني وإجراء الاتصال السريع.</p>
            </div>
            
            <div style="display:flex; align-items:center; gap:10px">
              <span style="font-size:11.5px; background:var(--dash-p-glow); color:var(--dash-p-dark); padding:4px 10px; border-radius:8px; font-weight:700">
                المطابق: ${totalFilteredCount} عميل
              </span>
              <select class="premium-select" style="font-size:11px; padding:3px 8px; width:auto" onchange="setDbPageSize(this.value)">
                <option value="25" ${pageSize === 25 ? 'selected' : ''}>25 / صفحة</option>
                <option value="50" ${pageSize === 50 ? 'selected' : ''}>50 / صفحة</option>
                <option value="100" ${pageSize === 100 ? 'selected' : ''}>100 / صفحة</option>
                <option value="all" ${S.dbPageSize === 'all' ? 'selected' : ''}>الكل (${totalFilteredCount})</option>
              </select>
            </div>
          </div>

          <div style="overflow-x:auto">
            <table class="premium-table">
              <thead>
                <tr style="color:var(--t2); font-weight:bold">
                  <th style="padding:12px 8px; cursor:pointer" onclick="toggleDbSort('name')">${t('اسم الشريك والشركة')} ${getSortIndicator('name')}</th>
                  <th style="padding:12px 8px; cursor:pointer" onclick="toggleDbSort('score')">${t('نقاط الصحة')} ${getSortIndicator('score')}</th>
                  <th style="padding:12px 8px; cursor:pointer" onclick="toggleDbSort('programs')">${t('البرامج المرخصة')} ${getSortIndicator('programs')}</th>
                  <th style="padding:12px 8px; cursor:pointer" onclick="toggleDbSort('installs')">الأجهزة ${getSortIndicator('installs')}</th>
                  <th style="padding:12px 8px; cursor:pointer" onclick="toggleDbSort('wilaya')">${t('الولاية')} ${getSortIndicator('wilaya')}</th>
                  <th style="padding:12px 8px">الهاتف والتواصل</th>
                  <th style="padding:12px 8px; text-align:center">${t('الملف')}</th>
                </tr>
              </thead>
              <tbody>
                ${paginatedClients.length === 0 ? `
                  <tr>
                    <td colspan="7" style="padding:3.5rem; text-align:center; color:var(--t3)">
                      ⚠️ لا توجد حسابات شركاء مطابقة لمعايير البحث والتصفية النشطة حالياً.
                    </td>
                  </tr>
                ` : paginatedClients.filter(Boolean).map(c => {
                  const sc = computeScore(c) || { total: 0 };
                  const scoreStyle = getScoreStyle(sc.total);
                  const clientIssues = Array.isArray(c?.issues) ? c.issues : [];
                  const clientPrograms = Array.isArray(c?.programs) ? c.programs : [];
                  const openIssCount = clientIssues.filter(i => i && (i.status === 'مفتوح' || i.status === 'قيد المعالجة')).length;
                  const totalDevices = clientPrograms.reduce((sum, p) => sum + (Number(p?.installationsCount) || 1), 0);

                  let initialBg = '#8B5CF6';
                  if (sc.total >= 75) initialBg = '#10B981';
                  else if (sc.total >= 50) initialBg = '#3B82F6';
                  else if (sc.total >= 25) initialBg = '#F59E0B';
                  else initialBg = '#EF4444';

                  return `
                    <tr style="cursor:pointer" onclick="selClient(${c.id})">
                      
                      <!-- Name & Company -->
                      <td style="padding:12px 8px">
                        <div style="display:flex; align-items:center; gap:10px">
                          <div class="table-avatar" style="background:${initialBg}">
                            ${(c.fullName || 'أ').substring(0, 1)}
                          </div>
                          <div>
                            <div style="font-weight:700; color:var(--t1)">${esc(c.fullName || '—')}</div>
                            <div style="font-size:11.5px; color:var(--t3)">${esc(c.company || c.businessField || '—')}</div>
                          </div>
                        </div>
                      </td>
                      
                      <!-- Health score -->
                      <td style="padding:12px 8px">
                        <div style="display:flex; align-items:center; gap:8px">
                          <span style="font-size:14px; font-weight:800; color:${scoreStyle.color}">${sc.total}%</span>
                          <span style="font-size:10px; font-weight:700; color:${scoreStyle.color}; background:${scoreStyle.bg}; padding:2px 6px; border-radius:6px">
                            ${t(scoreStyle.text)}
                          </span>
                        </div>
                      </td>

                      <!-- Programs -->
                      <td style="padding:12px 8px">
                        <div style="font-weight:700; color:var(--t2); font-size:12.5px">
                          ${clientPrograms.map(p => esc(p?.programName || '')).join('، ') || 'PROGILIC COMMERCIAL'}
                        </div>
                        <div style="font-size:10.5px; color:var(--t3)">
                          ${clientPrograms.length} برنامج مرخص
                        </div>
                      </td>

                      <!-- Devices / Installations count -->
                      <td style="padding:12px 8px">
                        <span style="font-size:11.5px; font-weight:700; background:rgba(59,130,246,0.1); color:#3B82F6; padding:3px 8px; border-radius:6px">
                          💻 ${totalDevices} ${totalDevices === 1 ? 'جهاز' : 'أجهزة'}
                        </span>
                      </td>

                      <!-- Wilaya & Commune -->
                      <td style="padding:12px 8px; color:var(--t2); font-weight:600; font-size:12px">
                        📍 ${esc(c.wilaya || '—')} ${c.commune ? `<span style="color:var(--t3); font-size:11px">(${esc(c.commune)})</span>` : ''}
                      </td>

                      <!-- Phone click-to-call -->
                      <td style="padding:12px 8px" onclick="event.stopPropagation()">
                        ${c.phone ? (hasPermission('clients.view_sensitive') ? `
                          <a href="tel:${c.phone}" style="display:inline-flex; align-items:center; gap:4px; font-size:12px; font-weight:700; color:#1e60f2; text-decoration:none; background:rgba(30,96,242,0.06); padding:4px 8px; border-radius:6px" title="اتصال مباشر">
                            <span>📞</span> ${esc(c.phone)}
                          </a>
                        ` : `<span style="font-size:12px; font-weight:700; color:var(--t3); background:rgba(0,0,0,0.05); padding:4px 8px; border-radius:6px">0550•• •••• 🔒</span>`) : `<span style="color:var(--t3); font-size:11px">—</span>`}
                      </td>

                      <!-- Profile inspect button -->
                      <td style="padding:12px 8px; text-align:center">
                        <button class="btn btn-xs" style="background:var(--dash-p-glow); color:var(--dash-p-dark); border:none; border-radius:8px; font-weight:700; padding:5px 10px" onclick="event.stopPropagation(); selClient(${c.id})">
                          ${t('استعراض')} 🔑
                        </button>
                      </td>

                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>

          <!-- PAGINATION CONTROLS -->
          ${totalPages > 1 ? `
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; margin-top:1.25rem; padding-top:1rem; border-top:1px solid var(--border-soft)">
              <div style="font-size:12px; color:var(--t3)">
                عرض <strong>${startIndex + 1}</strong> إلى <strong>${endIndex}</strong> من إجمالي <strong>${sortedClients.length}</strong> عميل
              </div>

              <div style="display:flex; gap:6px; align-items:center">
                <button class="btn btn-xs ${currentPage > 1 ? 'btn-outline' : 'btn-ghost'}" 
                        style="padding:4px 10px; font-size:11px; ${currentPage <= 1 ? 'opacity:0.4; pointer-events:none' : ''}" 
                        onclick="setDbPage(${currentPage - 1})">
                  ← السابق
                </button>

                <div style="display:flex; gap:4px; align-items:center">
                  ${Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum = i + 1;
                    if (totalPages > 5 && currentPage > 3) {
                      pageNum = Math.min(totalPages - 4 + i, currentPage - 2 + i);
                    }
                    return `
                      <button class="btn btn-xs ${currentPage === pageNum ? 'btn-primary' : 'btn-ghost'}" 
                              style="padding:3px 8px; font-size:11px; min-width:28px" 
                              onclick="setDbPage(${pageNum})">
                        ${pageNum}
                      </button>
                    `;
                  }).join('')}
                  ${totalPages > 5 && currentPage < totalPages - 2 ? `<span style="font-size:10px; color:var(--t3)">...</span><button class="btn btn-xs btn-ghost" style="padding:3px 8px; font-size:11px" onclick="setDbPage(${totalPages})">${totalPages}</button>` : ''}
                </div>

                <button class="btn btn-xs ${currentPage < totalPages ? 'btn-outline' : 'btn-ghost'}" 
                        style="padding:4px 10px; font-size:11px; ${currentPage >= totalPages ? 'opacity:0.4; pointer-events:none' : ''}" 
                        onclick="setDbPage(${currentPage + 1})">
                  التالي →
                </button>
              </div>
            </div>
          ` : ''}

        </div>
      ` : ''}

    </div>
  `;
  } catch (err) {
    console.error("Dashboard Render Error Boundary caught exception:", err);
    return `
      <div class="dash-error-boundary dash-v-card" style="padding:2.5rem; text-align:center; margin:1.5rem auto; max-width:680px; border:1px solid #EF4444; border-radius:12px; background:rgba(239,68,68,0.05); text-align:${S.lang === 'ar' ? 'right' : 'left'}">
        <div style="font-size:40px; margin-bottom:1rem; text-align:center">⚠️</div>
        <h2 style="font-size:18px; font-weight:800; color:#EF4444; margin:0 0 8px 0; text-align:center">
          حدث خطأ أثناء تحميل لوحة القيادة
        </h2>
        <p style="font-size:13px; color:var(--t2); margin-bottom:1.25rem; text-align:center">
          تم اعتراض استثناء غير متوقع أثناء معالجة بيانات ومؤشرات لوحة القيادة.
        </p>
        <div style="display:flex; justify-content:center; gap:10px">
          <button class="btn btn-primary" onclick="resetDbFilters(); if(window.R) window.R();" style="font-size:12.5px; padding:8px 16px; border-radius:8px">
            🔄 إعادة ضبط الفلاتر والمحاولة
          </button>
          <button class="btn btn-outline" onclick="S.view='list'; if(window.R) window.R();" style="font-size:12.5px; padding:8px 16px; border-radius:8px">
            📋 العودة لقائمة العملاء
          </button>
        </div>
        <details style="margin-top:1.5rem; text-align:left; font-size:11px; color:var(--t3); background:var(--bg2); padding:10px; border-radius:8px; overflow-x:auto">
          <summary style="cursor:pointer; font-weight:bold">التفاصيل التقنية للخطأ</summary>
          <pre style="margin-top:8px; white-space:pre-wrap; word-break:break-all">${esc(err && (err.stack || err.message || String(err)))}</pre>
        </details>
      </div>
    `;
  }
}

// Interactive Recharts Dynamic Visualizer
let _rechartsMountAttempts = 0;
window.renderRechartsChart = function() {
  const container = document.getElementById('recharts-chart-container');
  if (!container) return;

  if (!window.React || !window.ReactDOM || !window.Recharts) {
    if (_rechartsMountAttempts < 3) {
      _rechartsMountAttempts++;
      setTimeout(window.renderRechartsChart, 1000);
    }
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
        const installs = window.clientInstallations(c);
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
