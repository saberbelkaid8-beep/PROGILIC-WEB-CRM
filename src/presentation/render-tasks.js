import { S, clients, staffUsers, hasPermission } from '../state/store.js';
import { TASK_STATUSES } from '../constants/index.js';
import { computeTaskAnalytics, filterTasks, classifyTaskBucket, TASK_DEPARTMENTS } from '../business/taskService.js';
import { esc, fmtD, pBdg, td } from '../utils/index.js';
import { t } from '../utils/i18n.js';

const TI = {
  plus: '<line x1="12" x2="12" y1="5" y2="19"/><line x1="5" x2="19" y1="12" y2="12"/>',
  check: '<polyline points="20 6 9 17 4 12"/>',
  clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  warn: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  edit: '<path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.375 2.625a1 1 0 0 1 3 3l-9.013 9.014a2 2 0 0 1-.853.505l-2.873.84a.5.5 0 0 1-.62-.62l.84-2.873a2 2 0 0 1 .506-.852z"/>',
  trash: '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>',
  building: '<rect width="16" height="20" x="4" y="2" rx="2" ry="2"/><path d="M9 22v-4h6v4"/>',
  lock: '<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>'
};

const tIc = (name, size = 14) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${TI[name] || TI.clock}</svg>`;

function taskStatusBadge(status) {
  switch (status) {
    case 'مكتملة': return `<span class="bdg bdg-g">${t(status)}</span>`;
    case 'قيد التنفيذ': return `<span class="bdg bdg-b">${t(status)}</span>`;
    case 'بانتظار العميل': return `<span class="bdg bdg-y">${t(status)}</span>`;
    case 'ملغاة': return `<span class="bdg bdg-gr">${t(status)}</span>`;
    default: return `<span class="bdg bdg-p">${t(status || 'مفتوحة')}</span>`;
  }
}

export function renderTasksView() {
  if (!hasPermission('tasks.view')) {
    return `
      <div class="dashboard-root">
        <div class="empty" style="max-width:540px;margin:2rem auto">
          <div class="empty-icon">${tIc('lock', 24)}</div>
          <div class="empty-text">${t('⚠️ لا تملك صلاحية عرض المهام والمتابعات.')}</div>
        </div>
      </div>
    `;
  }

  const today = td();
  const tasks = Array.isArray(S.tasks) ? S.tasks.filter(Boolean) : [];
  const analytics = computeTaskAnalytics(tasks, staffUsers || [], today);
  const { counts, byEmployee, byDepartment } = analytics;

  const bucket = S.taskFilter || 'all';
  const staffFilter = S.taskStaffFilter || 'all';
  const deptFilter = S.taskDeptFilter || 'all';
  const search = S.taskSearch || '';

  const filtered = filterTasks(tasks, {
    bucket,
    staffId: staffFilter,
    department: deptFilter,
    search,
    todayYmd: today
  });

  const canCreate = hasPermission('tasks.create');
  const canEdit = hasPermission('tasks.edit');
  const canDelete = hasPermission('tasks.delete');

  const deptLabelMap = Object.fromEntries(TASK_DEPARTMENTS.map(d => [d.id, d]));

  return `
    <div class="dashboard-root">
      <div class="phead">
        <div>
          <h1>${t('إدارة المهام والمتابعات')}</h1>
          <p class="sub">${t('تحويل إجراءات التواصل إلى مهام يومية مرتبطة بالعملاء والموظفين والأقسام')}</p>
        </div>
        <div class="phead-actions">
          ${canCreate ? `
            <button class="btn btn-primary btn-sm" onclick="openAddTaskModal()">
              ${tIc('plus', 14)}
              <span>${t('مهمة جديدة')}</span>
            </button>
          ` : ''}
        </div>
      </div>

      <!-- 5 Operational KPI Cards -->
      <div class="stats-row" style="grid-template-columns:repeat(auto-fit,minmax(170px,1fr))">
        <div class="stat-c sb${bucket === 'today' ? ' active-kpi' : ''}" style="cursor:pointer" onclick="setTaskFilter('taskFilter','today')">
          <div class="stat-v num">${counts.dueToday}</div>
          <div class="stat-l">${t('مهام اليوم')}</div>
        </div>
        <div class="stat-c${counts.overdue > 0 ? '' : ' sg'}${bucket === 'overdue' ? ' active-kpi' : ''}" style="cursor:pointer;${counts.overdue > 0 ? 'border-color:rgba(255,69,58,0.35)' : ''}" onclick="setTaskFilter('taskFilter','overdue')">
          <div class="stat-v num" style="color:${counts.overdue > 0 ? 'var(--rt)' : 'var(--gt)'}">${counts.overdue}</div>
          <div class="stat-l">${t('مهام متأخرة')}</div>
        </div>
        <div class="stat-c so${bucket === 'awaiting_client' ? ' active-kpi' : ''}" style="cursor:pointer" onclick="setTaskFilter('taskFilter','awaiting_client')">
          <div class="stat-v num">${counts.awaitingClient}</div>
          <div class="stat-l">${t('بانتظار رد العميل')}</div>
        </div>
        <div class="stat-c sb${bucket === 'active' ? ' active-kpi' : ''}" style="cursor:pointer" onclick="setTaskFilter('taskFilter','active')">
          <div class="stat-v num">${counts.inProgress}</div>
          <div class="stat-l">${t('قيد التنفيذ')}</div>
        </div>
        <div class="stat-c sg${bucket === 'completed' ? ' active-kpi' : ''}" style="cursor:pointer" onclick="setTaskFilter('taskFilter','completed')">
          <div class="stat-v num">${counts.completed}</div>
          <div class="stat-l">${t('مهام منجزة')}</div>
        </div>
      </div>

      <!-- Department Performance & Achieved Results -->
      <div class="card" style="margin-bottom:14px;padding:16px 18px">
        <div class="chd" style="margin-bottom:12px">
          <div>
            <h3 style="margin:0;font-size:15px">${t('نتائج وأداء الأقسام')}</h3>
            <p style="margin:2px 0 0;font-size:12px;color:var(--t3)">${t('متابعة المهام النشطة، المتأخرة، ونسبة الإنجاز والنتائج المحققة لكل قسم')}</p>
          </div>
          ${deptFilter !== 'all' ? `<button class="btn btn-ghost btn-xs" onclick="setTaskFilter('taskDeptFilter','all')">${t('عرض كل الأقسام')}</button>` : ''}
        </div>
        <div class="dept-perf-grid">
          ${byDepartment.map(d => {
            const isSelected = deptFilter === d.deptId;
            return `
              <div class="dept-perf-card${isSelected ? ' on' : ''}" onclick="setTaskFilter('taskDeptFilter','${isSelected ? 'all' : d.deptId}')">
                <div class="dept-perf-hdr">
                  <span class="dept-perf-name" style="color:${d.color}">${t(d.titleAr)}</span>
                  <span class="num" style="font-size:12px;font-weight:800;color:var(--t1)">${d.completionRate}%</span>
                </div>
                <div class="dept-perf-bar"><div class="dept-perf-fill" style="width:${d.completionRate}%;background:${d.color}"></div></div>
                <div class="dept-perf-meta num">
                  <span>${t('نشطة')}: <b>${d.active}</b></span>
                  <span>${t('اليوم')}: <b>${d.dueToday}</b></span>
                  <span style="${d.overdue > 0 ? 'color:var(--rt);font-weight:700' : ''}">${t('متأخرة')}: <b>${d.overdue}</b></span>
                  <span style="color:var(--gt)">${t('منجزة')}: <b>${d.completed}</b></span>
                </div>
                ${d.recentResults.length > 0 ? `
                  <div class="dept-perf-res" title="${esc(d.recentResults[0].resultNote)}">
                    ✓ ${esc(d.recentResults[0].resultNote)}
                  </div>
                ` : `<div class="dept-perf-res muted">${t('لا توجد نتائج مسجلة بعد')}</div>`}
              </div>
            `;
          }).join('')}
        </div>
      </div>

      <!-- Employee Workload Breakdown -->
      ${byEmployee.length > 0 ? `
        <div class="card" style="margin-bottom:14px;padding:14px 18px">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:10px;flex-wrap:wrap">
            <span style="font-size:13.5px;font-weight:700;color:var(--t1);display:inline-flex;align-items:center;gap:6px">${tIc('users', 14)} ${t('مهام اليوم والمتابعات حسب الموظف')}</span>
            ${staffFilter !== 'all' ? `<button class="btn btn-ghost btn-xs" onclick="setTaskFilter('taskStaffFilter','all')">${t('عرض كل الموظفين')}</button>` : ''}
          </div>
          <div class="emp-load-strip">
            ${byEmployee.map(e => {
              const isSel = String(staffFilter) === String(e.staffId);
              return `
                <button type="button" class="emp-load-chip${isSel ? ' on' : ''}" onclick="setTaskFilter('taskStaffFilter','${isSel ? 'all' : esc(e.staffId)}')">
                  <span class="emp-load-name">${esc(e.staffName)}</span>
                  <span class="emp-load-nums num">
                    <span title="${t('اليوم')}" style="color:var(--bt)">${e.dueToday} ${t('اليوم')}</span>
                    ${e.overdue > 0 ? ` · <span style="color:var(--rt);font-weight:700">${e.overdue} ${t('متأخرة')}</span>` : ''}
                    · <span style="color:var(--gt)">${e.completed} ✓</span>
                  </span>
                </button>
              `;
            }).join('')}
          </div>
        </div>
      ` : ''}

      <!-- Search & Filter Toolbar -->
      <div class="search-row" style="gap:10px;flex-wrap:wrap;margin-bottom:12px">
        <div style="position:relative;flex:1;min-width:220px;display:flex;align-items:center">
          <span style="position:absolute;inset-inline-start:14px;color:var(--t3);display:flex;pointer-events:none">${tIc('search', 15)}</span>
          <input class="search-input" style="padding-inline-start:40px" placeholder="${t('ابحث: عنوان المهمة، العميل، الموظف، أو النتيجة...')}" value="${esc(search)}" oninput="setTaskFilter('taskSearch', this.value)">
        </div>
        <select class="fctl" style="width:auto;min-width:170px;min-height:38px" onchange="setTaskFilter('taskStaffFilter', this.value)">
          <option value="all">${t('كل الموظفين')}</option>
          ${(staffUsers || []).filter(s => s && s.status !== 'معطل').map(s => `
            <option value="${esc(s.id)}"${String(staffFilter) === String(s.id) ? ' selected' : ''}>${esc(s.fullName || s.name)}</option>
          `).join('')}
        </select>
        <select class="fctl" style="width:auto;min-width:165px;min-height:38px" onchange="setTaskFilter('taskDeptFilter', this.value)">
          <option value="all">${t('كل الأقسام')}</option>
          ${TASK_DEPARTMENTS.map(d => `
            <option value="${d.id}"${deptFilter === d.id ? ' selected' : ''}>${t(d.titleAr)}</option>
          `).join('')}
        </select>
      </div>

      <!-- Bucket Filter Pills -->
      <div class="filter-bar" style="margin-bottom:14px;gap:6px">
        ${[
          { id: 'all', label: 'الكل', count: counts.total },
          { id: 'today', label: 'مهام اليوم', count: counts.dueToday },
          { id: 'overdue', label: 'متأخرة', count: counts.overdue },
          { id: 'awaiting_client', label: 'بانتظار العميل', count: counts.awaitingClient },
          { id: 'active', label: 'النشطة', count: counts.active },
          { id: 'completed', label: 'مكتملة', count: counts.completed }
        ].map(f => `
          <span class="fpill${bucket === f.id ? ' on' : ''}" onclick="setTaskFilter('taskFilter','${f.id}')">
            ${t(f.label)} (<span class="num">${f.count}</span>)
          </span>
        `).join('')}
      </div>

      <!-- Tasks List -->
      ${filtered.length === 0 ? `
        <div class="empty">
          <div class="empty-icon">${tIc('check', 24)}</div>
          <div class="empty-text">${t('لا توجد مهام مطابقة للفلاتر الحالية')}</div>
          ${canCreate ? `<button class="btn btn-primary btn-sm" onclick="openAddTaskModal()">${t('إنشاء مهمة متابعة جديدة')}</button>` : ''}
        </div>
      ` : `
        <div class="tasks-list">
          ${filtered.map(task => {
            const bkt = classifyTaskBucket(task, today);
            const deptInfo = deptLabelMap[task.department] || { titleAr: task.department || 'قسم المتابعة', color: '#8b5cf6' };
            const isOverdue = bkt === 'overdue';
            const isToday = bkt === 'today';
            const linkedClient = task.clientId ? (clients || []).find(c => String(c?.id) === String(task.clientId)) : null;

            return `
              <div class="task-card${isOverdue ? ' task-overdue' : isToday ? ' task-today' : task.status === 'مكتملة' ? ' task-done' : ''}">
                <div class="task-top">
                  <div class="task-title-wrap">
                    <span class="task-title">${esc(task.title)}</span>
                    ${isOverdue ? `<span class="bdg bdg-r">${tIc('warn', 11)} ${t('متأخرة')}</span>` : ''}
                    ${isToday ? `<span class="bdg bdg-b">${tIc('clock', 11)} ${t('اليوم')}</span>` : ''}
                  </div>
                  <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
                    ${pBdg(task.priority || 'متوسطة')}
                    ${taskStatusBadge(task.status)}
                  </div>
                </div>

                <div class="task-meta">
                  ${task.assignedStaffName ? `<span class="bdg bdg-gr">${tIc('user', 12)} ${esc(task.assignedStaffName)}</span>` : ''}
                  <span class="bdg" style="background:rgba(255,255,255,0.06);color:${deptInfo.color};border:1px solid rgba(255,255,255,0.12)">${tIc('building', 12)} ${t(deptInfo.titleAr)}</span>
                  ${task.clientName || linkedClient ? `
                    <button type="button" class="btn btn-ghost btn-xs" style="color:var(--bt);font-weight:700;padding:2px 8px" onclick="selClient(${Number(task.clientId || linkedClient?.id)})">
                      👤 ${esc(linkedClient?.fullName || task.clientName)} ↗
                    </button>
                  ` : ''}
                  <span class="num" style="margin-inline-start:auto;font-size:12px;color:${isOverdue ? 'var(--rt)' : 'var(--t3)'}">
                    📅 ${fmtD(task.dueDate) || '—'}
                  </span>
                </div>

                ${task.description ? `<div class="task-desc">${esc(task.description)}</div>` : ''}
                ${task.resultNote ? `<div class="task-result"><strong style="color:var(--gt)">✓ ${t('النتيجة:')}</strong> ${esc(task.resultNote)}</div>` : ''}

                <div class="task-acts">
                  ${canEdit && task.status !== 'قيد التنفيذ' && task.status !== 'مكتملة' ? `
                    <button type="button" class="btn btn-outline btn-xs" onclick="updateTaskStatus('${esc(task.id)}','قيد التنفيذ')">${t('قيد التنفيذ')}</button>
                  ` : ''}
                  ${canEdit && task.status !== 'بانتظار العميل' && task.status !== 'مكتملة' ? `
                    <button type="button" class="btn btn-outline btn-xs" onclick="updateTaskStatus('${esc(task.id)}','بانتظار العميل')">${t('بانتظار العميل')}</button>
                  ` : ''}
                  ${canEdit && task.status !== 'مكتملة' ? `
                    <button type="button" class="btn btn-success-soft btn-xs" onclick="updateTaskStatus('${esc(task.id)}','مكتملة')">${tIc('check', 12)} <span>${t('إنجاز ✓')}</span></button>
                  ` : ''}
                  ${canEdit ? `<button type="button" class="btn btn-ghost btn-xs" onclick="editTask('${esc(task.id)}')">${tIc('edit', 12)} <span>${t('تعديل')}</span></button>` : ''}
                  ${canDelete ? `<button type="button" class="btn btn-danger-soft btn-xs" onclick="delTask('${esc(task.id)}')">${tIc('trash', 12)} <span>${t('حذف')}</span></button>` : ''}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `}
    </div>
  `;
}
