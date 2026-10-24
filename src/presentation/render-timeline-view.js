/**
 * PROGILIC CRM v3 - Global Timeline & Activity Audit View
 * Comprehensive timeline rendering of all CRM operations with user attribution,
 * multi-criteria filtering (by user, date range, category), search, and CSV/Print export.
 */

import { S, clients, staffUsers } from '../state/store.js';
import { getActivityVisuals } from '../business/timelineService.js';
import { getFilteredTimelineList } from '../business/actions/timelineActions.js';
import { esc } from '../utils/index.js';
import { t } from '../utils/i18n.js';

export function renderGlobalTimeline() {
  const allActivities = Array.isArray(S.globalActivities) ? S.globalActivities : [];
  const filtered = getFilteredTimelineList();
  const locale = S.lang === 'fr' ? 'fr-FR' : (S.lang === 'en' ? 'en-US' : 'ar-DZ');

  // Calculate High-Level KPIs
  const totalCount = allActivities.length;
  const filteredCount = filtered.length;
  
  const todayStr = new Date().toISOString().split('T')[0];
  const todayCount = allActivities.filter(a => a.timestamp && a.timestamp.startsWith(todayStr)).length;

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
  const uniqueUsers = new Set();
  if (S.staffUsers && S.staffUsers.length > 0) {
    S.staffUsers.forEach(s => {
      const n = s.name || s.fullName;
      if (n) uniqueUsers.add(n);
    });
  }
  allActivities.forEach(a => {
    if (a.userName) uniqueUsers.add(a.userName);
  });
  // Ensure Gérant is in the list
  uniqueUsers.add('المسؤول العام');
  const userOptions = Array.from(uniqueUsers).sort();

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
    const dayKey = a.timestamp ? a.timestamp.split('T')[0] : 'سابقاً';
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
            ${t('تتبع زمني فوري وشامل لجميع العمليات المعتمدة في النظام مع توثيق اسم المستخدم المنفذ والتاريخ والوقت بدقة.')}
          </p>
        </div>

        <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap">
          <button class="btn btn-outline btn-sm" onclick="refreshGlobalTimeline()" title="${t('تحديث السجل')}" style="font-size:11.5px; padding:6px 12px">
            🔄 ${t('تحديث')}
          </button>
          <button class="btn btn-outline btn-sm" onclick="exportGlobalTimelineCSV()" title="${t('تصدير كـ CSV')}" style="font-size:11.5px; padding:6px 12px; color:var(--brand); border-color:var(--brand)">
            📊 ${t('تصدير CSV')}
          </button>
          <button class="btn btn-ghost btn-sm" onclick="printGlobalTimeline()" title="${t('طباعة التقرير')}" style="font-size:11.5px; padding:6px 12px">
            🖨️ ${t('طباعة')}
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
              ${userOptions.map(u => `
                <option value="${esc(u)}" ${S.timelineUserFilter === u ? 'selected' : ''}>
                  👤 ${esc(u)}
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
                { id: 'yesterday', label: 'أمس' },
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
