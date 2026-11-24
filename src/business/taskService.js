export const TASK_DEPARTMENTS = [
  { id: 'pre_vente', titleAr: 'قسم ما قبل البيع', color: '#0284c7' },
  { id: 'commercial', titleAr: 'القسم التجاري', color: '#10b981' },
  { id: 'suivi', titleAr: 'قسم المتابعة', color: '#8b5cf6' },
  { id: 'technique', titleAr: 'القسم التقني', color: '#f59e0b' },
  { id: 'gerant', titleAr: 'الإدارة العليا', color: '#38bdf8' }
];

export function isTaskClosed(status = '') {
  return status === 'مكتملة' || status === 'ملغاة';
}

export function classifyTaskBucket(task, todayYmd = new Date().toISOString().split('T')[0]) {
  if (!task || typeof task !== 'object') return 'upcoming';
  if (task.status === 'مكتملة') return 'completed';
  if (task.status === 'ملغاة') return 'cancelled';
  if (task.status === 'بانتظار العميل') {
    return 'awaiting_client';
  }
  const due = String(task.dueDate || '').trim();
  if (due && todayYmd) {
    if (due < todayYmd) return 'overdue';
    if (due === todayYmd) return 'today';
  }
  return 'upcoming';
}

export function isTaskOverdue(task, todayYmd = new Date().toISOString().split('T')[0]) {
  if (!task || isTaskClosed(task.status)) return false;
  const due = String(task.dueDate || '').trim();
  return Boolean(due && todayYmd && due < todayYmd);
}

export function isTaskDueToday(task, todayYmd = new Date().toISOString().split('T')[0]) {
  if (!task || isTaskClosed(task.status)) return false;
  return String(task.dueDate || '').trim() === todayYmd;
}

export function filterTasks(tasks = [], opts = {}) {
  const {
    bucket = 'all',
    staffId = 'all',
    department = 'all',
    search = '',
    todayYmd = new Date().toISOString().split('T')[0]
  } = opts || {};

  const safeTasks = Array.isArray(tasks) ? tasks.filter(Boolean) : [];
  const q = String(search || '').trim().toLowerCase();

  return safeTasks
    .filter(task => {
      if (staffId !== 'all' && String(task.assignedStaffId || '') !== String(staffId)) return false;
      if (department !== 'all' && String(task.department || '') !== String(department)) return false;

      if (bucket === 'today' && !isTaskDueToday(task, todayYmd)) return false;
      else if (bucket === 'overdue' && !isTaskOverdue(task, todayYmd)) return false;
      else if (bucket === 'awaiting_client' && task.status !== 'بانتظار العميل') return false;
      else if (bucket === 'completed' && task.status !== 'مكتملة') return false;
      else if (bucket === 'active' && isTaskClosed(task.status)) return false;

      if (q) {
        const haystack = [
          task.title,
          task.description,
          task.clientName,
          task.assignedStaffName,
          task.resultNote
        ].filter(Boolean).join(' ').toLowerCase();
        if (!haystack.includes(q)) return false;
      }

      return true;
    })
    .sort((a, b) => {
      const aClosed = isTaskClosed(a.status) ? 1 : 0;
      const bClosed = isTaskClosed(b.status) ? 1 : 0;
      if (aClosed !== bClosed) return aClosed - bClosed;

      const aOver = isTaskOverdue(a, todayYmd) ? 0 : 1;
      const bOver = isTaskOverdue(b, todayYmd) ? 0 : 1;
      if (aOver !== bOver) return aOver - bOver;

      const da = String(a.dueDate || '9999-12-31');
      const db = String(b.dueDate || '9999-12-31');
      return da.localeCompare(db);
    });
}

export function computeTaskAnalytics(tasks = [], staffUsers = [], todayYmd = new Date().toISOString().split('T')[0]) {
  const safeTasks = Array.isArray(tasks) ? tasks.filter(Boolean) : [];
  const safeStaff = Array.isArray(staffUsers) ? staffUsers.filter(Boolean) : [];

  const counts = {
    total: safeTasks.length,
    dueToday: 0,
    overdue: 0,
    awaitingClient: 0,
    inProgress: 0,
    open: 0,
    completed: 0,
    cancelled: 0,
    active: 0
  };

  const empMap = new Map();
  safeStaff.forEach(st => {
    const id = String(st.id || '');
    if (!id) return;
    empMap.set(id, {
      staffId: id,
      staffName: st.fullName || st.name || st.username || id,
      department: st.department || 'pre_vente',
      total: 0,
      dueToday: 0,
      overdue: 0,
      awaitingClient: 0,
      inProgress: 0,
      completed: 0,
      active: 0
    });
  });

  const deptMap = new Map();
  TASK_DEPARTMENTS.forEach(d => {
    deptMap.set(d.id, {
      deptId: d.id,
      titleAr: d.titleAr,
      color: d.color,
      total: 0,
      dueToday: 0,
      overdue: 0,
      awaitingClient: 0,
      inProgress: 0,
      completed: 0,
      active: 0,
      completionRate: 0,
      recentResults: []
    });
  });

  for (const task of safeTasks) {
    const closed = isTaskClosed(task.status);
    const overdue = isTaskOverdue(task, todayYmd);
    const dueToday = isTaskDueToday(task, todayYmd);

    if (task.status === 'مكتملة') counts.completed++;
    else if (task.status === 'ملغاة') counts.cancelled++;
    else {
      counts.active++;
      if (task.status === 'بانتظار العميل') counts.awaitingClient++;
      if (task.status === 'قيد التنفيذ') counts.inProgress++;
      if (task.status === 'مفتوحة') counts.open++;
      if (overdue) counts.overdue++;
      if (dueToday) counts.dueToday++;
    }

    const empKey = String(task.assignedStaffId || task.assignedStaffName || 'unassigned');
    if (!empMap.has(empKey)) {
      empMap.set(empKey, {
        staffId: empKey,
        staffName: task.assignedStaffName || 'غير مسند',
        department: task.department || 'suivi',
        total: 0,
        dueToday: 0,
        overdue: 0,
        awaitingClient: 0,
        inProgress: 0,
        completed: 0,
        active: 0
      });
    }
    const empStat = empMap.get(empKey);
    empStat.total++;
    if (task.status === 'مكتملة') empStat.completed++;
    else if (!closed) {
      empStat.active++;
      if (dueToday) empStat.dueToday++;
      if (overdue) empStat.overdue++;
      if (task.status === 'بانتظار العميل') empStat.awaitingClient++;
      if (task.status === 'قيد التنفيذ') empStat.inProgress++;
    }

    const deptKey = deptMap.has(task.department) ? task.department : 'suivi';
    const dStat = deptMap.get(deptKey);
    dStat.total++;
    if (task.status === 'مكتملة') {
      dStat.completed++;
      if (task.resultNote) {
        dStat.recentResults.push({
          taskId: task.id,
          title: task.title,
          clientName: task.clientName || '',
          resultNote: task.resultNote,
          completedAt: task.completedAt || task.dueDate || ''
        });
      }
    } else if (!closed) {
      dStat.active++;
      if (dueToday) dStat.dueToday++;
      if (overdue) dStat.overdue++;
      if (task.status === 'بانتظار العميل') dStat.awaitingClient++;
      if (task.status === 'قيد التنفيذ') dStat.inProgress++;
    }
  }

  const byDepartment = Array.from(deptMap.values()).map(d => {
    const actionable = d.total - safeTasks.filter(t => t.department === d.deptId && t.status === 'ملغاة').length;
    return {
      ...d,
      completionRate: actionable > 0 ? Math.round((d.completed / actionable) * 100) : 0,
      recentResults: d.recentResults.slice(0, 4)
    };
  });

  const byEmployee = Array.from(empMap.values())
    .filter(e => e.total > 0 || safeStaff.some(s => String(s.id) === e.staffId && s.status !== 'معطل'))
    .sort((a, b) => (b.overdue + b.dueToday + b.active) - (a.overdue + a.dueToday + a.active));

  return {
    counts,
    byEmployee,
    byDepartment
  };
}
