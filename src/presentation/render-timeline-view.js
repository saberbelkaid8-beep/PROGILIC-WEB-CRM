/**
 * PROGILIC CRM v3 - Global Timeline & Activity Audit View
 * Comprehensive timeline rendering of all CRM operations with user attribution,
 * multi-criteria filtering (by user, date range, category), search, and CSV export.
 */

import { S, clients, staffUsers, hasPermission } from '../state/store.js';
import { getActivityVisuals } from '../business/timelineService.js';
import { buildTimelineReport, getFilteredTimelineList } from '../business/actions/timelineActions.js';
import { esc } from '../utils/index.js';
import { t } from '../utils/i18n.js';

export function renderGlobalTimeline() {
  if (!hasPermission('timeline.view')) {
    return `<div class="empty"><div class="empty-icon">🔒</div><div class="empty-text">${t('ليس لديك صلاحية عرض المخطط الزمني')}</div></div>`;
  }
  const allActivities = Array.isArray(S.globalActivities) ? S.globalActivities : [];
  const filtered = getFilteredTimelineList();
  const report = buildTimelineReport(filtered);
  const locale = S.lang === 'fr' ? 'fr-FR' : (S.lang === 'en' ? 'en-US' : 'ar-DZ');
  const cloudStatus = {
    synced: { label: 'سجل السحابة أونلاين متزامن فورياً مع كافة المستخدمين', color: '#059669' },
    pending: { label: 'أنشطة جديدة قيد الرفع والمزامنة أونلاين', color: '#D97706' },
    partial: { label: 'مطلوب اتصال بالإنترنت للمزامنة السحابية', color: '#DC2626' },
    'local-only': { label: 'مطلوب تسجيل الدخول بالإنترنت للمزامنة السحابية', color: '#DC2626' }
  }[S.timelineCloudStatus] || { label: 'مزامنة سحابية حية نشطة أونلاين', color: '#059669' };

  // Calculate High-Level KPIs
  const totalCount = allActivities.length;
  const filteredCount = filtered.length;
  
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const todayCount = allActivities.filter(a => {
    const timestamp = new Date(a.timestamp);
    return !Number.isNaN(timestamp.getTime())
      && timestamp.getFullYear() === today.getFullYear()
      && timestamp.getMonth() === today.getMonth()
      && timestamp.getDate() === today.getDate();
  }).length;

  // Top Active User
  const userCounts = {};
  allActivities.forEach(a => {
    const u = a.userName || 'المسؤول العام';
    userCounts[u] = (userCounts[u] || 0) + 1;
  });
  let topUserName = '—';
  let topUserActions = 0;
  Object.entries(userCounts).forEach(([u, count]) => {
    if (count > topUserActions) {
      topUserActions = count;
      topUserName = u;
    }
  });

  // Solved Issues / Positive Validations
  const solvedCount = allActivities.filter(a => a.type === 'ISSUE_RESOLVED').length;

  // Collect unique user names for the User Filter dropdown
  const uniqueUsers = new Map();
  const addUser = (id, name) => {
    const userName = name || 'المسؤول العام';
    uniqueUsers.set(String(id || userName), { id: String(id || userName), name: userName });
  };
  if (S.staffUsers && S.staffUsers.length > 0) {
    S.staffUsers.forEach(s => {
      const n = s.name || s.fullName;
      if (n) addUser(s.id, n);
    });
  }
  allActivities.forEach(a => {
    if (a.userName) addUser(a.userId || a.actorUid, a.userName);
  });
  addUser('gerant', 'المسؤول العام');
  const userOptions = Array.from(uniqueUsers.values()).sort((a, b) => a.name.localeCompare(b.name));

  // Check if any filter is active
  const isAnyFilterActive = 
    (S.timelineUserFilter && S.timelineUserFilter !== 'all') ||
    (S.timelineCategoryFilter && S.timelineCategoryFilter !== 'all') ||
    (S.timelineDatePreset && S.timelineDatePreset !== 'all') ||
    Boolean(S.timelineDateFrom) ||
    Boolean(S.timelineDateTo) ||
    Boolean(S.timelineSearch && S.timelineSearch.trim());

  // Group filtered activities by Date Day
  const groupedByDate = {};
  filtered.forEach(a => {
    const timestamp = new Date(a.timestamp);
    const dayKey = !Number.isNaN(timestamp.getTime())
      ? `${timestamp.getFullYear()}-${String(timestamp.getMonth() + 1).padStart(2, '0')}-${String(timestamp.getDate()).padStart(2, '0')}`
      : 'سابقاً';
    if (!groupedByDate[dayKey]) groupedByDate[dayKey] = [];
    groupedByDate[dayKey].push(a);
  });
  const dateKeys = Object.keys(groupedByDate).sort((a, b) => b.localeCompare(a));

  return `
    <div class="global-timeline-wrapper" style="max-width:1200px; margin:0 auto; padding:0.5rem 0.75rem 2.5rem; direction:rtl">
      
      <!-- Top Title & Action Ribbon -->
      <div style="background:var(--card); border:1px solid var(--border); border-radius:var(--r-lg); padding:1.25rem 1.5rem; margin-bottom:1.25rem; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:14px; box-shadow:0 2px 8px rgba(0,0,0,0.03)">
        <div>
          <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px">
            <span style="font-size:24px">⏱️</span>
            <h1 style="font-size:19px; font-weight:800; color:var(--t1); margin:0">
              ${t('المخطط الزمني وسجل العمليات الشامل')}
            </h1>
            <span style="font-size:11px; font-weight:700; background:rgba(37,99,235,0.1); color:#2563EB; padding:3px 9px; border-radius:999px; border:1px solid rgba(37,99,235,0.2)">
              ${t('سجل الأنشطة المعتمدة')}
            </span>
          </div>
          <p style="font-size:12.5px; color:var(--t2); margin:0; line-height:1.5">
            ${t('سجل عمليات موحد لحساب المؤسسة، مع اسم الموظف المنفذ والتاريخ والوقت والتصفية والتقرير الإداري.')}
          </p>
        </div>

        <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap">
          <span role="status" style="font-size:11px; color:${cloudStatus.color}; font-weight:700">${t(cloudStatus.label)}</span>
          <button class="btn btn-outline btn-sm" onclick="syncAllCrmServicesAction()" title="${t('مزامنة ورفع كافة خدمات وتراخيص الـ CRM الحالية إلى المخطط الزمني السحابي')}" style="font-size:11.5px; padding:6px 12px; color:#059669; border-color:#059669; font-weight:700">
            ⚡ ${t('مزامنة كل خدمات الـ CRM')}
          </button>
          <button class="btn btn-outline btn-sm" onclick="refreshGlobalTimeline()" title="${t('تحديث السجل')}" style="font-size:11.5px; padding:6px 12px">
            🔄 ${t('تحديث')}
          </button>
          <button class="btn btn-outline btn-sm" onclick="exportGlobalTimelineCSV()" title="${t('تصدير كـ CSV')}" style="font-size:11.5px; padding:6px 12px; color:var(--brand); border-color:var(--brand)">
            📊 ${t('تصدير CSV')}
          </button>
        </div>
      </div>

      <!-- KPI Summary Stat Cards -->
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:12px; margin-bottom:1.25rem">
        
        <div style="background:var(--card); border:1px solid var(--border); border-radius:var(--r-md); padding:1rem; display:flex; align-items:center; gap:12px">
          <div style="width:42px; height:42px; border-radius:10px; background:rgba(37,99,235,0.1); color:#2563EB; display:flex; align-items:center; justify-content:center; font-size:18px">
            📋
          </div>
          <div>
            <div style="font-size:11.5px; color:var(--t3); font-weight:600">${t('إجمالي العمليات المسجلة')}</div>
            <div style="font-size:20px; font-weight:800; color:var(--t1)">${totalCount}</div>
          </div>
        </div>

        <div style="background:var(--card); border:1px solid var(--border); border-radius:var(--r-md); padding:1rem; display:flex; align-items:center; gap:12px">
          <div style="width:42px; height:42px; border-radius:10px; background:rgba(16,185,129,0.1); color:#10B981; display:flex; align-items:center; justify-content:center; font-size:18px">
            ⚡
          </div>
          <div>
            <div style="font-size:11.5px; color:var(--t3); font-weight:600">${t('عمليات اليوم')}</div>
            <div style="font-size:20px; font-weight:800; color:#10B981">${todayCount}</div>
          </div>
        </div>

        <div style="background:var(--card); border:1px solid var(--border); border-radius:var(--r-md); padding:1rem; display:flex; align-items:center; gap:12px">
          <div style="width:42px; height:42px; border-radius:10px; background:rgba(245,158,11,0.1); color:#F59E0B; display:flex; align-items:center; justify-content:center; font-size:18px">
            👑
          </div>
          <div>
            <div style="font-size:11.5px; color:var(--t3); font-weight:600">${t('المستخدم الأكثر نشاطاً')}</div>
            <div style="font-size:15px; font-weight:800; color:var(--t1); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:140px" title="${esc(topUserName)}">
              ${esc(topUserName)} <span style="font-size:11px; color:var(--t3); font-weight:600">(${topUserActions})</span>
            </div>
          </div>
        </div>

        <div style="background:var(--card); border:1px solid var(--border); border-radius:var(--r-md); padding:1rem; display:flex; align-items:center; gap:12px">
          <div style="width:42px; height:42px; border-radius:10px; background:rgba(139,92,246,0.1); color:#8B5CF6; display:flex; align-items:center; justify-content:center; font-size:18px">
            ✅
          </div>
          <div>
            <div style="font-size:11.5px; color:var(--t3); font-weight:600">${t('مشاكل تم حلها')}</div>
            <div style="font-size:20px; font-weight:800; color:#8B5CF6">${solvedCount}</div>
          </div>
        </div>

      </div>

      <!-- Advanced Filtering Ribbon (User Filter, Date Range, Category, Search) -->
      <div style="background:var(--card); border:1px solid var(--border); border-radius:var(--r-lg); padding:1.25rem; margin-bottom:1.5rem; display:flex; flex-direction:column; gap:1rem; box-shadow:0 2px 8px rgba(0,0,0,0.02)">
        
        <!-- Primary Filter Controls: User Select & Category Select & Search -->
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(240px, 1fr)); gap:12px">
          
          <!-- 1. USER FILTER (NON-NEGOTIABLE CORE REQUIREMENT) -->
          <div>
            <label style="display:block; font-size:11.5px; font-weight:700; color:var(--t2); margin-bottom:5px">
              👤 ${t('تصفية باسم المستخدم المنفذ:')}
            </label>
            <select class="premium-select" onchange="setTimelineUserFilter(this.value)" style="width:100%; padding:7px 10px; font-size:12px; border-radius:var(--r-md); border:1px solid var(--border); background:var(--surface); color:var(--t1)">
              <option value="all" ${S.timelineUserFilter === 'all' ? 'selected' : ''}>👤 ${t('جميع المستخدمين (الكل)')}</option>
              ${userOptions.map(user => `
                <option value="${esc(user.id)}" ${S.timelineUserFilter === user.id || S.timelineUserFilter === user.name ? 'selected' : ''}>
                  👤 ${esc(user.name)}
                </option>
              `).join('')}
            </select>
          </div>

          <!-- 2. CATEGORY FILTER -->
          <div>
            <label style="display:block; font-size:11.5px; font-weight:700; color:var(--t2); margin-bottom:5px">
              🏷️ ${t('نوع العملية / القسم:')}
            </label>
            <select class="premium-select" onchange="setTimelineCategoryFilter(this.value)" style="width:100%; padding:7px 10px; font-size:12px; border-radius:var(--r-md); border:1px solid var(--border); background:var(--surface); color:var(--t1)">
              <option value="all" ${S.timelineCategoryFilter === 'all' ? 'selected' : ''}>🌟 ${t('جميع الأقسام والعمليات')}</option>
              <option value="clients" ${S.timelineCategoryFilter === 'clients' ? 'selected' : ''}>👥 ${t('العملاء وحساباتهم')}</option>
              <option value="issues" ${S.timelineCategoryFilter === 'issues' ? 'selected' : ''}>🐛 ${t('المشاكل والدعم الفني')}</option>
              <option value="programs" ${S.timelineCategoryFilter === 'programs' ? 'selected' : ''}>📦 ${t('البرامج والتراخيص')}</option>
              <option value="requirements" ${S.timelineCategoryFilter === 'requirements' ? 'selected' : ''}>💡 ${t('المتطلبات والميزات')}</option>
              <option value="contacts" ${S.timelineCategoryFilter === 'contacts' ? 'selected' : ''}>📞 ${t('سجل التواصل والمكالمات')}</option>
              <option value="backup" ${S.timelineCategoryFilter === 'backup' ? 'selected' : ''}>💾 ${t('النسخ الاحتياطي والأمان')}</option>
              <option value="staff" ${S.timelineCategoryFilter === 'staff' ? 'selected' : ''}>🔑 ${t('المستخدمون والصلاحيات')}</option>
              <option value="system" ${S.timelineCategoryFilter === 'system' ? 'selected' : ''}>⚙️ ${t('عمليات النظام')}</option>
            </select>
          </div>

          <!-- 3. FREE TEXT SEARCH -->
          <div>
            <label style="display:block; font-size:11.5px; font-weight:700; color:var(--t2); margin-bottom:5px">
              🔍 ${t('بحث فوري في العمليات:')}
            </label>
            <input type="text" 
                   class="search-input" 
                   placeholder="${t('ابحث: اسم المستخدم، العميل، تفاصيل الإجراء...')}" 
                   value="${esc(S.timelineSearch || '')}" 
                   oninput="setTimelineSearch(this.value)"
                   style="width:100%; padding:7px 10px; font-size:12px; border-radius:var(--r-md); border:1px solid var(--border); background:var(--surface); color:var(--t1)">
          </div>

        </div>

        <!-- Secondary Filter Controls: Date Presets & Custom From/To Date Range -->
        <div style="background:var(--surface); border:1px solid var(--border); border-radius:var(--r-md); padding:0.875rem 1rem; display:flex; flex-direction:column; gap:0.75rem">
          
          <!-- Date Presets Row -->
          <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px">
            <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap">
              <span style="font-size:11.5px; font-weight:700; color:var(--t2); margin-left:4px">📅 ${t('الفترة الزمنية:')}</span>
              ${[
                { id: 'all', label: 'كل الأوقات' },
                { id: 'today', label: 'اليوم' },
                { id: 'yesterday', label: 'أمس (البارح)' },
                { id: 'day_before_yesterday', label: 'أول أمس (أول البارح)' },
                { id: 'week', label: 'آخر 7 أيام' },
                { id: 'month', label: 'هذا الشهر' },
                { id: 'custom', label: 'مخصص 📅' }
              ].map(p => `
                <button class="btn btn-xs ${S.timelineDatePreset === p.id ? 'btn-primary' : 'btn-ghost'}" 
                        onclick="setTimelineDatePreset('${p.id}')"
                        style="font-size:11px; padding:3px 9px; margin:0">
                  ${t(p.label)}
                </button>
              `).join('')}
            </div>

            ${isAnyFilterActive ? `
              <button class="btn btn-ghost btn-xs" onclick="clearTimelineFilters()" style="color:var(--r); font-weight:700">
                ✕ ${t('مسح جميع الفلاتر')}
              </button>
            ` : ''}
          </div>

          <!-- Precise Custom Date Range Pickers (من الوقت الفلاني إلى الوقت الفلاني) -->
          <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap; border-top:1px dashed var(--border); padding-top:0.625rem">
            <div style="display:flex; align-items:center; gap:6px">
              <label style="font-size:11px; font-weight:700; color:var(--t3)">${t('من تاريخ:')}</label>
              <input type="date" 
                     value="${S.timelineDateFrom || ''}" 
                     onchange="setTimelineDateFrom(this.value)"
                     style="padding:4px 8px; font-size:11.5px; border-radius:var(--r-sm); border:1px solid var(--border); background:var(--card); color:var(--t1)">
            </div>

            <div style="display:flex; align-items:center; gap:6px">
              <label style="font-size:11px; font-weight:700; color:var(--t3)">${t('إلى تاريخ:')}</label>
              <input type="date" 
                     value="${S.timelineDateTo || ''}" 
                     onchange="setTimelineDateTo(this.value)"
                     style="padding:4px 8px; font-size:11.5px; border-radius:var(--r-sm); border:1px solid var(--border); background:var(--card); color:var(--t1)">
            </div>

            ${S.timelineDateFrom || S.timelineDateTo ? `
              <button class="btn btn-ghost btn-xs" onclick="clearTimelineDates()" title="${t('إلغاء التحديد المخصص')}" style="color:var(--t3)">
                ✕ إلغاء التواريخ
              </button>
            ` : ''}
          </div>

        </div>

        <!-- Filter Results Status Bar -->
        <div style="display:flex; align-items:center; justify-content:space-between; font-size:11.5px; color:var(--t2); padding:0 4px">
          <div>
            ${t('عرض')} <strong style="color:var(--brand)">${filteredCount}</strong> ${t('عملية من أصل')} <strong>${totalCount}</strong> ${t('عملية مسجلة')}
            ${S.timelineUserFilter !== 'all' ? ` · <span style="color:#2563EB; font-weight:700">المستخدم: ${esc(S.timelineUserFilter)}</span>` : ''}
            ${S.timelineCategoryFilter !== 'all' ? ` · <span style="color:#10B981; font-weight:700">القسم: ${esc(S.timelineCategoryFilter)}</span>` : ''}
          </div>
          <div style="font-size:11px; color:var(--t3)">
            ✓ ${t('توثيق فوري معتمد')}
          </div>
        </div>

      </div>

      ${renderTimelineReport(report, filtered, locale)}

      <!-- Timeline Feed Stream -->
      ${filtered.length === 0 ? `
        <div style="background:var(--card); border:1px solid var(--border); border-radius:var(--r-lg); padding:3.5rem 2rem; text-align:center">
          <div style="font-size:44px; margin-bottom:12px">⏱️</div>
          <h3 style="font-size:16px; font-weight:800; color:var(--t1); margin-bottom:6px">
            ${t('لا توجد عمليات تطابق معايير البحث والفلترة')}
          </h3>
          <p style="font-size:12.5px; color:var(--t2); max-width:480px; margin:0 auto 1.25rem auto">
            ${t('لم يتم العثور على أية عمليات للمستخدم أو الفترة الزمنية أو القسم المختار. يمكنك تجربة تغيير الفلاتر أو مسحها.')}
          </p>
          <button class="btn btn-primary btn-sm" onclick="clearTimelineFilters()">
            ✕ ${t('إعادة ضبط ومسح الفلاتر')}
          </button>
        </div>
      ` : `
        <div class="global-timeline-stream" style="display:flex; flex-direction:column; gap:1.75rem; position:relative">
          
          ${dateKeys.map(dayKey => {
            const dayActivities = groupedByDate[dayKey];
            const isToday = dayKey === todayStr;
            const dayLabel = isToday ? 'اليوم' : dayKey;

            return `
              <div class="timeline-day-group" style="position:relative">
                
                <!-- Day Divider Ribbon -->
                <div style="display:flex; align-items:center; gap:12px; margin-bottom:1rem">
                  <div style="background:var(--surface); border:1px solid var(--border); border-radius:999px; padding:4px 14px; font-size:11.5px; font-weight:800; color:var(--t1); display:flex; align-items:center; gap:6px; box-shadow:0 1px 3px rgba(0,0,0,0.02)">
                    <span>📅</span>
                    <span>${dayLabel}</span>
                    <span style="background:var(--card); border:1px solid var(--border); border-radius:999px; padding:1px 7px; font-size:10px; color:var(--t3)">
                      ${dayActivities.length} عمليات
                    </span>
                  </div>
                  <div style="flex:1; height:1px; background:var(--border)"></div>
                </div>

                <!-- Activities Cards List for this day -->
                <div style="display:flex; flex-direction:column; gap:10px; padding-right:1rem; border-right:2px solid var(--border); margin-right:1rem">
                  ${dayActivities.map(a => {
                    const vis = getActivityVisuals(a.type);
                    const timeDate = a.timestamp ? new Date(a.timestamp) : new Date();
                    const timeFormatted = timeDate.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                    const fullDateStr = timeDate.toLocaleString(locale, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

                    return `
                      <div class="tl-card-row" style="background:var(--card); border:1px solid var(--border); border-radius:var(--r-md); padding:1rem 1.25rem; position:relative; box-shadow:0 1px 4px rgba(0,0,0,0.01); transition:transform 0.15s, border-color 0.15s">
                        
                        <!-- Timeline Node Dot on Line -->
                        <div style="position:absolute; right:-1.5rem; top:1.25rem; width:14px; height:14px; border-radius:50%; background:var(--card); border:2.5px solid var(--brand); transform:translateX(50%)"></div>

                        <!-- Top Row: User Badge (Prominent!), Category & Action Badge, and Time -->
                        <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px; margin-bottom:0.625rem">
                          
                          <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap">
                            
                            <!-- USER WHO PERFORMED THE ACTION (NON-NEGOTIABLE CORE REQUIREMENT) -->
                            <div style="display:inline-flex; align-items:center; gap:5px; background:rgba(37,99,235,0.08); border:1px solid rgba(37,99,235,0.2); padding:3px 10px; border-radius:8px">
                              <span style="font-size:12px">👤</span>
                              <strong style="font-size:12px; color:#1d4ed8">${esc(a.userName || 'المسؤول العام')}</strong>
                              ${a.userRole ? `
                                <span style="font-size:10px; color:var(--t3); background:var(--card); border:1px solid var(--border); border-radius:4px; padding:1px 5px">
                                  ${esc(a.userRole)}
                                </span>
                              ` : ''}
                            </div>

                            <!-- Action Type Badge -->
                            <span class="bdg ${vis.colorClass}" style="font-size:10.5px; font-weight:700; padding:2.5px 9px; border-radius:999px; border:1px solid transparent; display:inline-flex; align-items:center; gap:4px">
                              <span>${vis.icon}</span>
                              <span>${t(vis.label)}</span>
                            </span>

                            <!-- Associated Client Link if Applicable -->
                            ${a.clientId ? `
                              <button class="btn btn-ghost btn-xs" onclick="selClient(${a.clientId})" title="${t('فتح ملف العميل')}" style="padding:2px 8px; font-size:11px; color:var(--brand); font-weight:700; margin:0">
                                🏢 ${esc(a.clientName || ('عميل #' + a.clientId))} ←
                              </button>
                            ` : ''}

                          </div>

                          <!-- Exact Timestamp -->
                          <div style="font-size:11px; color:var(--t3); display:flex; align-items:center; gap:6px" dir="ltr">
                            <span>🕒 ${timeFormatted}</span>
                            <span style="opacity:0.75">(${fullDateStr})</span>
                          </div>

                        </div>

                        <!-- Action Title -->
                        <div style="font-size:13.5px; font-weight:800; color:var(--t1); margin-bottom:4px">
                          ${esc(t(a.title))}
                        </div>

                        <!-- Action Full Description -->
                        <div style="font-size:12.5px; color:var(--t2); line-height:1.6">
                          ${esc(t(a.description))}
                        </div>

                        <!-- Footer Verification Note -->
                        <div style="display:flex; align-items:center; justify-content:space-between; margin-top:0.75rem; padding-top:0.5rem; border-top:1px dashed var(--border); font-size:10.5px; color:var(--t3)">
                          <span style="display:flex; align-items:center; gap:4px">
                            <span style="color:#10B981">✓</span>
                            <span>${t('عملية معتمدة ومسجلة في النظام')}</span>
                          </span>
                          <span>
                            ID: #${a.id}
                          </span>
                        </div>

                      </div>
                    `;
                  }).join('')}
                </div>

              </div>
            `;
          }).join('')}

        </div>
      `}

    </div>
  `;
}

function renderTimelineReport(report, activities, locale) {
  const categoryNames = {
    clients: 'العملاء',
    programs: 'البرامج والتراخيص',
    issues: 'المشاكل والدعم',
    requirements: 'المتطلبات',
    contacts: 'التواصل',
    backup: 'النسخ الاحتياطي',
    staff: 'المستخدمون والصلاحيات',
    system: 'النظام'
  };
  const maxCategory = Math.max(1, ...report.categories.map(item => item.count));
  const maxDay = Math.max(1, ...report.days.map(item => item.count));
  const maxUser = Math.max(1, ...report.users.slice(0, 5).map(item => item.count));
  const activeFilters = [
    S.timelineUserFilter !== 'all' ? `المستخدم: ${S.timelineUserFilter}` : '',
    S.timelineCategoryFilter !== 'all' ? `القسم: ${categoryNames[S.timelineCategoryFilter] || S.timelineCategoryFilter}` : '',
    S.timelineDateFrom || S.timelineDateTo ? `الفترة: ${S.timelineDateFrom || 'البداية'} - ${S.timelineDateTo || 'اليوم'}` : S.timelineDatePreset !== 'all' ? `الفترة: ${S.timelineDatePreset}` : '',
    S.timelineSearch ? `بحث: ${S.timelineSearch}` : ''
  ].filter(Boolean);

  return `
    <section style="background:var(--card); border:1px solid var(--border); border-radius:var(--r-lg); padding:1.25rem; margin-bottom:1.5rem">
      <div style="display:flex; justify-content:space-between; align-items:start; flex-wrap:wrap; gap:8px; margin-bottom:1rem">
        <div>
          <h2 style="font-size:17px; font-weight:800; color:var(--t1); margin:0 0 4px">📈 تقرير الإدارة عن الأنشطة</h2>
          <div style="font-size:11.5px; color:var(--t3)">تحليل العمليات الظاهرة وفق الفلاتر الحالية، وليس تقرير طباعة.</div>
        </div>
        <span style="font-size:11px; color:var(--t2)">${activeFilters.length ? activeFilters.map(esc).join(' · ') : 'كل العمليات المسجلة'}</span>
      </div>

      <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(145px,1fr)); gap:9px; margin-bottom:1rem">
        ${[
          ['إجمالي العمليات', report.total, '#2563EB'],
          ['مستخدمون نشطون', report.users.length, '#8B5CF6'],
          ['عملاء جدد', report.clientsCreated, '#10B981'],
          ['حذف عملاء', report.clientsDeleted, '#EF4444'],
          ['مشاكل مسجلة / محلولة', `${report.issuesCreated} / ${report.issuesResolved}`, '#F59E0B']
        ].map(([label, value, color]) => `
          <div style="background:var(--surface); border:1px solid var(--border); border-radius:10px; padding:10px 12px">
            <div style="font-size:10.5px; color:var(--t3); margin-bottom:4px">${label}</div>
            <strong style="font-size:19px; color:${color}">${value}</strong>
          </div>
        `).join('')}
      </div>

      <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(240px,1fr)); gap:12px">
        <div style="background:var(--surface); border-radius:10px; padding:12px">
          <h3 style="font-size:12px; font-weight:800; color:var(--t1); margin:0 0 9px">توزيع العمليات حسب القسم</h3>
          ${report.categories.length ? report.categories.map(item => `
            <div style="margin:7px 0">
              <div style="display:flex; justify-content:space-between; font-size:10.5px; color:var(--t2); margin-bottom:3px"><span>${categoryNames[item.category] || esc(item.category)}</span><strong>${item.count}</strong></div>
              <div style="height:6px; background:var(--border); border-radius:99px; overflow:hidden"><div style="height:100%; width:${Math.round(item.count / maxCategory * 100)}%; background:var(--brand); border-radius:99px"></div></div>
            </div>
          `).join('') : '<div style="font-size:11px;color:var(--t3)">لا توجد عمليات ضمن الفلاتر الحالية.</div>'}
        </div>
        <div style="background:var(--surface); border-radius:10px; padding:12px">
          <h3 style="font-size:12px; font-weight:800; color:var(--t1); margin:0 0 9px">أكثر المستخدمين نشاطاً</h3>
          ${report.users.length ? report.users.slice(0, 5).map((user, index) => `
            <div style="display:flex; align-items:center; gap:8px; margin:8px 0; font-size:11px">
              <span style="width:20px; color:var(--t3)">${index + 1}.</span><span style="flex:1;color:var(--t1)">${esc(user.name)}</span><strong>${user.count}</strong>
              <span style="width:48px; height:5px; background:var(--border); border-radius:99px; overflow:hidden"><span style="display:block;height:100%;width:${Math.round(user.count / maxUser * 100)}%;background:#8B5CF6"></span></span>
            </div>
          `).join('') : '<div style="font-size:11px;color:var(--t3)">لا يوجد مستخدمون ضمن النتائج.</div>'}
        </div>
        <div style="background:var(--surface); border-radius:10px; padding:12px">
          <h3 style="font-size:12px; font-weight:800; color:var(--t1); margin:0 0 9px">حركة العمليات حسب اليوم</h3>
          ${report.days.length ? report.days.map(day => `
            <div style="display:flex; align-items:center; gap:8px; margin:8px 0; font-size:10.5px">
              <time style="width:82px; color:var(--t2)" dir="ltr">${new Date(`${day.date}T12:00:00`).toLocaleDateString(locale,{day:'numeric',month:'short'})}</time>
              <span style="flex:1; height:6px; background:var(--border); border-radius:99px; overflow:hidden"><span style="display:block;height:100%;width:${Math.round(day.count / maxDay * 100)}%;background:#10B981"></span></span><strong>${day.count}</strong>
            </div>
          `).join('') : '<div style="font-size:11px;color:var(--t3)">لا توجد تواريخ صالحة لعرض الحركة اليومية.</div>'}
        </div>
        <div style="background:var(--surface); border-radius:10px; padding:12px">
          <h3 style="font-size:12px; font-weight:800; color:var(--t1); margin:0 0 9px">أكثر أنواع الإجراءات تكراراً</h3>
          ${report.actions.length ? report.actions.map(action => `
            <div style="display:flex; justify-content:space-between; gap:8px; margin:8px 0; font-size:10.5px; color:var(--t2)"><span>${esc(t(action.label))}</span><strong>${action.count}</strong></div>
          `).join('') : '<div style="font-size:11px;color:var(--t3)">لا توجد إجراءات ضمن النتائج.</div>'}
        </div>
      </div>
      <div style="font-size:10.5px; color:var(--t3); margin-top:10px">التقرير يعرض ${activities.length} عملية مطابقة؛ استخدم تصدير CSV لتنزيل تفاصيل هذه العمليات.</div>
    </section>
  `;
}
