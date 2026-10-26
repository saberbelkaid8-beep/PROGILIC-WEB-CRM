/**
 * PROGILIC CRM v3 - Team Productivity Activity Heatmap Component
 * Visualizes CRM operations volume (Adds, Edits, Deletes, System) over the past 30 days
 * with interactive filtering, day drill-down, and team member productivity analytics.
 */

import { S, clients, staffUsers } from '../../state/store.js';
import { esc } from '../../utils/index.js';
import { t } from '../../utils/i18n.js';
import { ActivityType, getActivityVisuals } from '../../business/timelineService.js';

// Action Type Classification Sets
const ADD_TYPES = new Set([
  ActivityType.CLIENT_CREATED,
  ActivityType.PROGRAM_ADDED,
  ActivityType.ISSUE_ADDED,
  ActivityType.REQUIREMENT_ADDED,
  ActivityType.CONTACT_ADDED,
  ActivityType.STAFF_ADDED,
  ActivityType.BACKUP_CREATED,
  ActivityType.DATA_IMPORTED
]);

const EDIT_TYPES = new Set([
  ActivityType.CLIENT_EDITED,
  ActivityType.PROGRAM_EDITED,
  ActivityType.ISSUE_EDITED,
  ActivityType.REQUIREMENT_EDITED,
  ActivityType.STAFF_EDITED,
  ActivityType.GPS_CAPTURED,
  ActivityType.ISSUE_RESOLVED
]);

const DELETE_TYPES = new Set([
  ActivityType.CLIENT_DELETED,
  ActivityType.PROGRAM_DELETED,
  ActivityType.ISSUE_DELETED,
  ActivityType.REQUIREMENT_DELETED,
  ActivityType.CONTACT_DELETED,
  ActivityType.STAFF_DELETED,
  ActivityType.BACKUP_DELETED
]);

// Expose state handlers on window object
if (typeof window !== 'undefined') {
  window.setHeatmapFilterType = function(type) {
    S.heatmapFilterType = type;
    if (window.R) window.R();
  };

  window.setHeatmapUserFilter = function(user) {
    S.heatmapUserFilter = user;
    if (window.R) window.R();
  };

  window.selectHeatmapDate = function(dateStr) {
    if (S.heatmapSelectedDate === dateStr) {
      S.heatmapSelectedDate = null;
    } else {
      S.heatmapSelectedDate = dateStr;
    }
    if (window.R) window.R();
  };

  window.clearHeatmapDateSelection = function() {
    S.heatmapSelectedDate = null;
    if (window.R) window.R();
  };
}

/**
 * Returns the last 30 calendar days formatted as array of objects
 */
function getLast30Days() {
  const days = [];
  const today = new Date();
  
  const arDayNames = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
  const frDayNames = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
  const enDayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const arMonths = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
  const frMonths = ['Janv', 'Févr', 'Mars', 'Avril', 'Mai', 'Juin', 'Juil', 'Août', 'Sept', 'Oct', 'Nov', 'Déc'];
  const enMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  for (let i = 29; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;

    const lang = S.lang || 'ar';
    const dayName = lang === 'fr' ? frDayNames[d.getDay()] : (lang === 'en' ? enDayNames[d.getDay()] : arDayNames[d.getDay()]);
    const monthName = lang === 'fr' ? frMonths[d.getMonth()] : (lang === 'en' ? enMonths[d.getMonth()] : arMonths[d.getMonth()]);

    days.push({
      dateStr,
      dayNumber: d.getDate(),
      dayName,
      monthName,
      fullDateObj: d,
      isToday: i === 0
    });
  }

  return days;
}

/**
 * Calculates activity counts and intensity scale for heatmap
 */
export function renderActivityHeatmap() {
  const lang = S.lang || 'ar';
  const isRTL = lang === 'ar';
  const rawActivities = Array.isArray(S.globalActivities) ? S.globalActivities : [];

  const filterType = S.heatmapFilterType || 'all'; // 'all' | 'adds' | 'edits' | 'deletes' | 'other'
  const selectedUser = S.heatmapUserFilter || 'all';
  const selectedDateStr = S.heatmapSelectedDate || null;

  // 1. Filter raw activities by user if user filter active
  let userFilteredActivities = rawActivities;
  if (selectedUser !== 'all') {
    userFilteredActivities = rawActivities.filter(a => 
      a && (a.userName === selectedUser || a.userId === selectedUser || a.actorUid === selectedUser)
    );
  }

  const days30 = getLast30Days();
  const startDateStr = days30[0].dateStr;
  const endDateStr = days30[days30.length - 1].dateStr;

  // Filter 30-day window
  const windowActivities = userFilteredActivities.filter(a => {
    if (!a || !a.timestamp) return false;
    const isoDate = String(a.timestamp).slice(0, 10);
    return isoDate >= startDateStr && isoDate <= endDateStr;
  });

  // Group activities by date string
  const dayMap = {};
  days30.forEach(d => {
    dayMap[d.dateStr] = {
      dayInfo: d,
      activities: [],
      adds: 0,
      edits: 0,
      deletes: 0,
      other: 0,
      total: 0
    };
  });

  windowActivities.forEach(a => {
    const isoDate = String(a.timestamp).slice(0, 10);
    if (dayMap[isoDate]) {
      dayMap[isoDate].activities.push(a);
      dayMap[isoDate].total++;

      if (ADD_TYPES.has(a.type)) dayMap[isoDate].adds++;
      else if (EDIT_TYPES.has(a.type)) dayMap[isoDate].edits++;
      else if (DELETE_TYPES.has(a.type)) dayMap[isoDate].deletes++;
      else dayMap[isoDate].other++;
    }
  });

  // Calculate 30-day Totals & Distribution
  let total30DayActions = 0;
  let total30Adds = 0;
  let total30Edits = 0;
  let total30Deletes = 0;
  let total30Other = 0;

  let maxActionsInSingleDay = 0;
  let busiestDayObj = null;

  Object.values(dayMap).forEach(data => {
    total30DayActions += data.total;
    total30Adds += data.adds;
    total30Edits += data.edits;
    total30Deletes += data.deletes;
    total30Other += data.other;

    if (data.total > maxActionsInSingleDay) {
      maxActionsInSingleDay = data.total;
      busiestDayObj = data;
    }
  });

  const dailyAvg = (total30DayActions / 30).toFixed(1);

  // User Contributions (Team Productivity)
  const userContributions = {};
  windowActivities.forEach(a => {
    const uName = a.userName || (lang === 'fr' ? 'Administrateur' : lang === 'en' ? 'Administrator' : 'المسؤول العام');
    userContributions[uName] = (userContributions[uName] || 0) + 1;
  });

  const sortedTeam = Object.entries(userContributions)
    .map(([name, count]) => ({ name, count, pct: Math.round((count / (total30DayActions || 1)) * 100) }))
    .sort((a, b) => b.count - a.count);

  // Helper to compute color intensity based on filter type & volume
  function getHeatmapColorStyle(count, typeFilter) {
    if (!count || count === 0) {
      return {
        bg: 'var(--surface-soft, rgba(255,255,255,0.03))',
        border: 'var(--border-soft, rgba(255,255,255,0.08))',
        color: 'var(--t3, #94a3b8)',
        opacity: 0.55
      };
    }

    // Color theme Palette based on Filter Type
    let baseHue = {
      all: { r: 16, g: 185, b: 129, hex: '#10B981' },     // Emerald Green
      adds: { r: 16, g: 185, b: 129, hex: '#10B981' },    // Emerald Green
      edits: { r: 59, g: 130, b: 246, hex: '#3B82F6' },    // Blue
      deletes: { r: 239, g: 68, b: 68, hex: '#EF4444' },   // Red
      other: { r: 139, g: 92, b: 246, hex: '#8B5CF6' }     // Purple
    }[typeFilter] || { r: 16, g: 185, b: 129, hex: '#10B981' };

    if (count <= 2) {
      return {
        bg: `rgba(${baseHue.r}, ${baseHue.g}, ${baseHue.b}, 0.22)`,
        border: `rgba(${baseHue.r}, ${baseHue.g}, ${baseHue.b}, 0.45)`,
        color: baseHue.hex,
        fontWeight: '600'
      };
    } else if (count <= 5) {
      return {
        bg: `rgba(${baseHue.r}, ${baseHue.g}, ${baseHue.b}, 0.48)`,
        border: `rgba(${baseHue.r}, ${baseHue.g}, ${baseHue.b}, 0.72)`,
        color: '#ffffff',
        fontWeight: '700'
      };
    } else if (count <= 10) {
      return {
        bg: `rgba(${baseHue.r}, ${baseHue.g}, ${baseHue.b}, 0.82)`,
        border: baseHue.hex,
        color: '#ffffff',
        fontWeight: '800',
        textShadow: '0 1px 2px rgba(0,0,0,0.3)'
      };
    } else {
      return {
        bg: `linear-gradient(135deg, ${baseHue.hex} 0%, rgba(${baseHue.r}, ${baseHue.g}, ${baseHue.b}, 0.85) 100%)`,
        border: `1px solid ${baseHue.hex}`,
        color: '#ffffff',
        fontWeight: '900',
        shadow: `0 4px 12px rgba(${baseHue.r}, ${baseHue.g}, ${baseHue.b}, 0.35)`
      };
    }
  }

  // Selected Day Details Data
  const selectedDayData = selectedDateStr ? dayMap[selectedDateStr] : null;

  return `
    <div class="dash-v-card" style="padding: 1.25rem;" data-testid="activity-heatmap-card">
      
      <!-- CARD HEADER & METRICS -->
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; margin-bottom:1rem; border-bottom:1px solid var(--border-soft); padding-bottom:0.75rem;">
        <div>
          <div style="display:flex; align-items:center; gap:8px">
            <h3 style="font-size:15px; font-weight:800; color:var(--t1); margin:0; display:flex; align-items:center; gap:6px">
              <span>🔥</span> ${lang === 'fr' ? 'Activité de l’équipe & Productivité (30 jours)' : (lang === 'en' ? 'Team Activity & Productivity (30 Days)' : 'حرارية النشاط وإنتاجية الفريق (30 يوماً الأخيرة)')}
            </h3>
            <span style="font-size:10.5px; background:rgba(16,185,129,0.12); color:#10B981; border:1px solid rgba(16,185,129,0.3); padding:2px 8px; border-radius:10px; font-weight:700">
              ⚡ ${total30DayActions} ${lang === 'fr' ? 'opérations' : (lang === 'en' ? 'actions' : 'عملية')}
            </span>
          </div>
          <p style="font-size:11.5px; color:var(--t3); margin:3px 0 0 0">
            ${lang === 'fr' ? 'Visualisation en خريطة حرارية لحجم الإضافات والتعديلات والحذفيات اليومية' : (lang === 'en' ? 'Heatmap visualization of daily additions, edits, and deletions' : 'خريطة حرارية تفاعلية لحجم الإضافات والتعديلات والحذفيات اليومية لمتابعة أداء فريق العمل')}
          </p>
        </div>

        <!-- ACTION TYPE FILTER CHIPS -->
        <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap">
          <button type="button" 
                  class="btn btn-xs ${filterType === 'all' ? 'btn-primary' : 'btn-ghost'}" 
                  onclick="setHeatmapFilterType('all')" 
                  style="font-size:11px; padding:4px 10px; border-radius:8px; font-weight:700">
            الكل (${total30DayActions})
          </button>
          <button type="button" 
                  class="btn btn-xs ${filterType === 'adds' ? 'btn-primary' : 'btn-ghost'}" 
                  onclick="setHeatmapFilterType('adds')" 
                  style="font-size:11px; padding:4px 10px; border-radius:8px; font-weight:700; ${filterType === 'adds' ? 'background:#10B981; border-color:#10B981; color:#fff' : 'color:#10B981'}">
            ➕ إضافات (${total30Adds})
          </button>
          <button type="button" 
                  class="btn btn-xs ${filterType === 'edits' ? 'btn-primary' : 'btn-ghost'}" 
                  onclick="setHeatmapFilterType('edits')" 
                  style="font-size:11px; padding:4px 10px; border-radius:8px; font-weight:700; ${filterType === 'edits' ? 'background:#3B82F6; border-color:#3B82F6; color:#fff' : 'color:#3B82F6'}">
            📝 تعديلات (${total30Edits})
          </button>
          <button type="button" 
                  class="btn btn-xs ${filterType === 'deletes' ? 'btn-primary' : 'btn-ghost'}" 
                  onclick="setHeatmapFilterType('deletes')" 
                  style="font-size:11px; padding:4px 10px; border-radius:8px; font-weight:700; ${filterType === 'deletes' ? 'background:#EF4444; border-color:#EF4444; color:#fff' : 'color:#EF4444'}">
            🗑️ حذفيات (${total30Deletes})
          </button>
        </div>
      </div>

      <!-- PRODUCTIVITY HIGHLIGHTS ROW -->
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(170px, 1fr)); gap:10px; margin-bottom:1rem">
        <div style="background:var(--surface); border:1px solid var(--border-soft); padding:8px 12px; border-radius:10px">
          <div style="font-size:10.5px; color:var(--t3); font-weight:700">📊 المعدل اليومي</div>
          <div style="font-size:16px; font-weight:800; color:var(--t1); margin-top:2px">${dailyAvg} <span style="font-size:11px; font-weight:600; color:var(--t3)">عملية/يوم</span></div>
        </div>

        <div style="background:var(--surface); border:1px solid var(--border-soft); padding:8px 12px; border-radius:10px">
          <div style="font-size:10.5px; color:var(--t3); font-weight:700">🏆 اليوم الأكثر إنتاجية</div>
          <div style="font-size:14px; font-weight:800; color:#10B981; margin-top:2px">
            ${busiestDayObj ? `${busiestDayObj.dayInfo.dayNumber} ${busiestDayObj.dayInfo.monthName} (${busiestDayObj.total} عملية)` : '—'}
          </div>
        </div>

        <div style="background:var(--surface); border:1px solid var(--border-soft); padding:8px 12px; border-radius:10px">
          <div style="font-size:10.5px; color:var(--t3); font-weight:700">👥 القائم بالأعمال الأكثر نشاطاً</div>
          <div style="font-size:13.5px; font-weight:800; color:#3B82F6; margin-top:2px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap">
            ${sortedTeam[0] ? `${esc(sortedTeam[0].name)} (${sortedTeam[0].pct}%)` : '—'}
          </div>
        </div>

        <!-- TEAM MEMBER USER FILTER SELECTOR -->
        <div style="background:var(--surface); border:1px solid var(--border-soft); padding:6px 10px; border-radius:10px; display:flex; flex-direction:column; justify-content:center">
          <div style="font-size:10px; color:var(--t3); font-weight:700; margin-bottom:2px">👤 تصفية العضو:</div>
          <select onchange="setHeatmapUserFilter(this.value)" style="background:transparent; border:none; color:var(--t1); font-size:11.5px; font-weight:700; outline:none; cursor:pointer; width:100%">
            <option value="all" ${selectedUser === 'all' ? 'selected' : ''}>كافة أعضاء الفريق (${sortedTeam.length})</option>
            ${sortedTeam.map(u => `
              <option value="${esc(u.name)}" ${selectedUser === u.name ? 'selected' : ''}>${esc(u.name)} (${u.count})</option>
            `).join('')}
          </select>
        </div>
      </div>

      <!-- HEATMAP 30-DAY GRID -->
      <div style="margin-bottom:0.75rem">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px">
          <span style="font-size:11px; font-weight:700; color:var(--t3)">
            📅 ${days30[0].dayNumber} ${days30[0].monthName} ← ${days30[days30.length - 1].dayNumber} ${days30[days30.length - 1].monthName} (انقر على أي يوم لمعاينة التفاصيل)
          </span>
          <!-- INTENSITY LEGEND -->
          <div style="display:flex; align-items:center; gap:4px; font-size:10px; color:var(--t3)">
            <span>أقل</span>
            <span style="width:10px; height:10px; border-radius:2px; background:var(--surface-soft, rgba(255,255,255,0.05)); border:1px solid var(--border-soft)"></span>
            <span style="width:10px; height:10px; border-radius:2px; background:rgba(16,185,129,0.22); border:1px solid rgba(16,185,129,0.45)"></span>
            <span style="width:10px; height:10px; border-radius:2px; background:rgba(16,185,129,0.48); border:1px solid rgba(16,185,129,0.65)"></span>
            <span style="width:10px; height:10px; border-radius:2px; background:rgba(16,185,129,0.85)"></span>
            <span style="width:10px; height:10px; border-radius:2px; background:#059669"></span>
            <span>أكثر</span>
          </div>
        </div>

        <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(36px, 1fr)); gap:6px" data-testid="heatmap-grid">
          ${days30.map(d => {
            const data = dayMap[d.dateStr];
            let displayCount = data.total;
            if (filterType === 'adds') displayCount = data.adds;
            else if (filterType === 'edits') displayCount = data.edits;
            else if (filterType === 'deletes') displayCount = data.deletes;
            else if (filterType === 'other') displayCount = data.other;

            const style = getHeatmapColorStyle(displayCount, filterType);
            const isSelected = selectedDateStr === d.dateStr;

            return `
              <div class="heatmap-cell ${isSelected ? 'selected' : ''}" 
                   onclick="selectHeatmapDate('${d.dateStr}')" 
                   title="${d.dayName} ${d.dayNumber} ${d.monthName}: ${displayCount} ${filterType === 'all' ? 'عميلة إجمالية' : filterType} (➕${data.adds} 📝${data.edits} 🗑️${data.deletes})"
                   style="
                     display:flex; 
                     flex-direction:column; 
                     align-items:center; 
                     justify-content:center; 
                     height:48px; 
                     border-radius:8px; 
                     cursor:pointer; 
                     user-select:none;
                     background:${style.bg}; 
                     border:${isSelected ? '2px solid #1e60f2' : style.border}; 
                     color:${style.color}; 
                     font-size:11px; 
                     position:relative;
                     transition: transform 0.15s ease, box-shadow 0.15s ease;
                     ${isSelected ? 'box-shadow: 0 0 0 3px rgba(30, 96, 242, 0.35), 0 4px 10px rgba(0,0,0,0.2); transform:scale(1.06);' : ''}
                   ">
                <span style="font-size:9.5px; opacity:0.85; font-weight:600">${d.dayNumber}</span>
                <span style="font-size:11px; font-weight:800; margin-top:-1px">${displayCount > 0 ? displayCount : '•'}</span>
                ${d.isToday ? `<span style="position:absolute; top:2px; right:2px; width:5px; height:5px; border-radius:50%; background:#1e60f2" title="اليوم"></span>` : ''}
              </div>
            `;
          }).join('')}
        </div>
      </div>

      <!-- DAY DRILL-DOWN DETAILED EXPANDED DRAWER -->
      ${selectedDayData ? `
        <div style="margin-top:1rem; background:var(--surface); border:1px solid #1e60f2; border-radius:12px; padding:1rem; animation: fadeIn 0.2s ease">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; border-bottom:1px solid var(--border-soft); padding-bottom:8px">
            <div style="display:flex; align-items:center; gap:8px">
              <span style="font-size:16px">📅</span>
              <h4 style="margin:0; font-size:14px; font-weight:800; color:var(--t1)">
                تفاصيل نشاط يوم ${selectedDayData.dayInfo.dayName} ${selectedDayData.dayInfo.dayNumber} ${selectedDayData.dayInfo.monthName} ${selectedDayData.dayInfo.fullDateObj.getFullYear()}
              </h4>
              <span style="font-size:11px; background:rgba(30, 96, 242, 0.12); color:#1e60f2; font-weight:800; padding:2px 8px; border-radius:8px">
                إجمالي ${selectedDayData.total} عملية
              </span>
            </div>

            <button type="button" class="btn btn-xs btn-ghost" onclick="clearHeatmapDateSelection()" style="font-size:11px; color:var(--t3)">
              ✕ إغلاق المعاينة
            </button>
          </div>

          <!-- ACTION COUNTERS BREAKDOWN -->
          <div style="display:flex; gap:12px; flex-wrap:wrap; margin-bottom:12px; font-size:12px; font-weight:700">
            <span style="color:#10B981; background:rgba(16,185,129,0.1); padding:4px 10px; border-radius:8px">➕ إضافات: ${selectedDayData.adds}</span>
            <span style="color:#3B82F6; background:rgba(59,130,246,0.1); padding:4px 10px; border-radius:8px">📝 تعديلات: ${selectedDayData.edits}</span>
            <span style="color:#EF4444; background:rgba(239,68,68,0.1); padding:4px 10px; border-radius:8px">🗑️ حذفيات: ${selectedDayData.deletes}</span>
            ${selectedDayData.other > 0 ? `<span style="color:#8B5CF6; background:rgba(139,92,246,0.1); padding:4px 10px; border-radius:8px">⚙️ أخرى: ${selectedDayData.other}</span>` : ''}
          </div>

          <!-- ACTIVITIES LOG IN SELECTED DAY -->
          ${selectedDayData.activities.length === 0 ? `
            <div style="text-align:center; padding:1.5rem; color:var(--t3); font-size:12px">
              لا توجد عمليات مسجلة في هذا اليوم المنسق مع الفلاتر المحددة.
            </div>
          ` : `
            <div style="display:flex; flex-direction:column; gap:8px; max-height:220px; overflow-y:auto; padding-left:4px">
              ${selectedDayData.activities.map(act => {
                const visuals = getActivityVisuals(act.type);
                const timeStr = act.timestamp ? new Date(act.timestamp).toLocaleTimeString(lang === 'fr' ? 'fr-FR' : (lang === 'en' ? 'en-US' : 'ar-DZ'), { hour: '2-digit', minute: '2-digit' }) : '';
                return `
                  <div style="display:flex; align-items:center; justify-content:space-between; padding:8px 12px; border-radius:8px; background:var(--surface-soft, rgba(255,255,255,0.03)); border:1px solid var(--border-soft); font-size:12px">
                    <div style="display:flex; align-items:center; gap:8px">
                      <span style="font-size:14px">${visuals.icon || '⏱️'}</span>
                      <div>
                        <span style="font-weight:800; color:var(--t1)">${esc(act.title || visuals.label)}</span>
                        ${act.clientName ? `<span style="color:var(--t2); margin-right:6px">• العميل: <strong>${esc(act.clientName)}</strong></span>` : ''}
                        <div style="font-size:11px; color:var(--t3); margin-top:2px">${esc(act.description || '')}</div>
                      </div>
                    </div>
                    
                    <div style="text-align:left; font-size:11px; color:var(--t3)">
                      <div style="font-weight:700; color:#3B82F6">👤 ${esc(act.userName || 'المسؤول العام')}</div>
                      <div>⏰ ${timeStr}</div>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          `}
        </div>
      ` : ''}

    </div>
  `;
}
