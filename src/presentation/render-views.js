import { S, clients } from '../state/store.js';
import { BUSINESS_TYPES, PROGRAM_TYPES, WILAYAS } from '../constants/index.js';
import { gc, applyFilters, pBdg, sBdg, srcCls, platformIcon, updateActTypeOpts, isBdg, fmtD, rBdg, progStatusLabel, progStatusCls, progTypeBdg, activityIcon, getProgramStats, selOpts, wOpts, actTypeOpts, getActTypes, esc, avCls, init, searchMatch, countAdvFil, pBorder, cOpts, isClientAtRisk } from '../utils/index.js';
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
      <div class="filter-bar" style="margin:0;border:none;padding:0;gap:4px">
        ${['الكل','نشط','محتمل','متوقف','خطر'].map(s=>{
          const isRisk = s === 'خطر';
          const rCnt = isRisk ? clients.filter(c => isClientAtRisk(c)).length : 0;
          return `<span class="fpill${S.filter===s?' on':''}${isRisk?' fpill-risk':''}" style="${isRisk&&S.filter===s?'background:#ef4444;color:#fff':(isRisk?'color:#ef4444;border-color:rgba(239,68,68,0.3)': '')}" onclick="setFil('${s}')">
            ${isRisk ? `⚠️ ${t('في وضع خطر')} (${rCnt})` : t(s)}
          </span>`;
        }).join('')}
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
          ${isClientAtRisk(c)?`<div class="cc-alert" style="color:#ef4444;font-size:10.5px;font-weight:700">⚠️ ${esc(computeRiskProfile(c).risks[0] || (c.status==='متوقف' ? t('الحساب متوقف') : t('في وضع خطر')))}</div>`:''}
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

export { renderDashboard } from './render-dashboard.js';
