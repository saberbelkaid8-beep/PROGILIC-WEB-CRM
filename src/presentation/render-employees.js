// Employees & Departments Management Presentation Module for PROGILIC CRM
// Renders the 4 PROGILIC Departments, Staff Directory, Role-Based Access Control Matrix, and Gérant Controls

import { S, currentUser, currentStaffUser } from '../state/store.js';
import { auth } from '../firebase/config.js';
import {
  DEPARTMENTS,
  PERMISSION_DEFINITIONS,
  getEmployees,
  getDepartment,
  getEmployeeById,
  upsertEmployee,
  updateEmployeePermissions,
  updateEmployeePassword,
  loginAsEmployeeSession,
  isUserGerant
} from '../business/employeeService.js';
import { esc } from '../utils/index.js';
import { t } from '../utils/i18n.js';
import { showToast } from '../utils/toast.js';
import { R } from './render-core.js';

window.__empFilterDept = window.__empFilterDept || 'all';
window.__empSearchQuery = window.__empSearchQuery || '';
window.__empFilterStatus = window.__empFilterStatus || 'all';
window.__editingEmpId = window.__editingEmpId || null;
window.__permTargetEmpId = window.__permTargetEmpId || null;

const EI = {
  building: '<rect width="16" height="20" x="4" y="2" rx="2" ry="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M12 6h.01"/><path d="M12 10h.01"/><path d="M12 14h.01"/><path d="M16 10h.01"/><path d="M16 14h.01"/><path d="M8 10h.01"/><path d="M8 14h.01"/>',
  crown: '<path d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z"/><path d="M5 21h14"/>',
  user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  shield: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>',
  lock: '<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  key: '<circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6"/><path d="m15.5 7.5 3 3L22 7l-3-3"/>',
  edit: '<path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.375 2.625a1 1 0 0 1 3 3l-9.013 9.014a2 2 0 0 1-.853.505l-2.873.84a.5.5 0 0 1-.62-.62l.84-2.873a2 2 0 0 1 .506-.852z"/>',
  trash: '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>',
  sliders: '<line x1="4" x2="4" y1="21" y2="14"/><line x1="4" x2="4" y1="10" y2="3"/><line x1="12" x2="12" y1="21" y2="12"/><line x1="12" x2="12" y1="8" y2="3"/><line x1="20" x2="20" y1="21" y2="16"/><line x1="20" x2="20" y1="12" y2="3"/><line x1="2" x2="6" y1="14" y2="14"/><line x1="10" x2="14" y1="8" y2="8"/><line x1="18" x2="22" y1="16" y2="16"/>',
  eye: '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
  phone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>',
  warn: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  refresh: '<path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/>',
  zap: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
  folder: '<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>',
  x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  plus: '<line x1="12" x2="12" y1="5" y2="19"/><line x1="5" x2="19" y1="12" y2="12"/>',
  briefcase: '<rect width="20" height="14" x="2" y="7" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>',
  wrench: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>',
  headset: '<path d="M3 11h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-5Zm0 0a9 9 0 1 1 18 0m0 0v5a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3Z"/>'
};

const eIc = (name, size = 15, sw = 2) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${EI[name] || EI.user}</svg>`;

function getDeptSvg(deptId) {
  if (deptId === 'pre_vente') return eIc('headset', 18);
  if (deptId === 'commercial') return eIc('briefcase', 18);
  if (deptId === 'suivi') return eIc('users', 18);
  return eIc('wrench', 18);
}

const employeeCountLabel = count => `<span class="num">${count}</span> ${t(count === 1 ? 'موظف' : 'موظفين')}`;

/**
 * Main Render Function for Employees & Departments View
 */
export function renderEmployeesView() {
  const isGerant = isUserGerant(currentUser);
  const direction = S.lang === 'ar' ? 'rtl' : 'ltr';
  const allEmployees = getEmployees();

  const deptCounts = {};
  DEPARTMENTS.forEach(d => {
    deptCounts[d.id] = allEmployees.filter(e => e.department === d.id).length;
  });

  const filtered = allEmployees.filter(emp => {
    if (window.__empFilterDept !== 'all' && emp.department !== window.__empFilterDept) return false;
    if (window.__empFilterStatus !== 'all' && emp.status !== window.__empFilterStatus) return false;
    if (window.__empSearchQuery) {
      const q = window.__empSearchQuery.trim().toLowerCase();
      const matchName = (emp.fullName || emp.name || '').toLowerCase().includes(q);
      const matchUser = (emp.username || '').toLowerCase().includes(q);
      const matchPos = (emp.position || '').toLowerCase().includes(q);
      const matchSup = (emp.supervisor || '').toLowerCase().includes(q);
      const matchTasks = (emp.tasks || '').toLowerCase().includes(q);
      if (!matchName && !matchUser && !matchPos && !matchSup && !matchTasks) return false;
    }
    return true;
  });

  return `
    <div class="dashboard-root" style="direction:${direction}">
      <div class="phead">
        <div>
          <h1>${t('الموظفون والأقسام — PROGILIC')}</h1>
          <p class="sub">${t('هيكلة الأقسام الأربعة، توزيع المهام والمسؤوليات، وتحديد الصلاحيات الدقيقة لكل موظف تحت إشراف المسؤول العام (Gérant).')}</p>
        </div>
        <div class="phead-actions">
          ${isGerant ? `
            <span style="display:inline-flex;align-items:center;gap:6px;font-size:12.5px;font-weight:700;color:var(--gt)">
              ${eIc('crown', 15)}
              <span>${t('المسؤول العام (Gérant):')} <span class="staff-name" style="color:var(--t1)">${esc(currentUser?.displayName || currentUser?.email || t('حساب المدير'))}</span></span>
            </span>
            <button class="btn btn-primary btn-sm" onclick="window.openAddEmployeeModal()">
              ${eIc('plus', 14)}
              <span>${t('إضافة موظف جديد')}</span>
            </button>
          ` : `
            <span style="display:inline-flex;align-items:center;gap:6px;font-size:12.5px;font-weight:700;color:var(--wt)">
              ${eIc('user', 15)}
              <span>${t('حساب موظف:')} <span class="staff-name">${esc(currentUser?.displayName || '')}</span> (<span class="staff-position">${esc(currentUser?.position || '')}</span>)</span>
            </span>
            <button class="btn btn-outline btn-sm" onclick="window.returnToGerantMode()">
              ${eIc('refresh', 14)}
              <span>${t('عودة لحساب المدير')}</span>
            </button>
          `}
        </div>
      </div>

      <!-- The 4 PROGILIC Departments -->
      <div style="margin-bottom:24px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;gap:12px;flex-wrap:wrap">
          <div>
            <h2 style="margin:0;font-size:17px;font-weight:800;color:var(--t1)">${t('الأقسام الأربعة في PROGILIC')}</h2>
            <p style="margin:3px 0 0;font-size:12.5px;color:var(--t3)">${t('انقر على أي قسم لتصفية موظفيه أو مراجعة اختصاصاته')}</p>
          </div>
          <button class="btn btn-sm ${window.__empFilterDept === 'all' ? 'btn-primary' : 'btn-outline'}" onclick="window.setEmpDeptFilter('all')">
            ${t('عرض جميع الأقسام')} (<span class="num">${allEmployees.length}</span>)
          </button>
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(275px,1fr));gap:16px">
          ${DEPARTMENTS.map(dept => {
            const count = deptCounts[dept.id] || 0;
            const isSelected = window.__empFilterDept === dept.id;
            return `
              <div class="emp-card" onclick="window.setEmpDeptFilter('${dept.id}')" style="cursor:pointer;border-color:${isSelected ? dept.color : 'var(--border)'}">
                <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:10px">
                  <div style="display:flex;align-items:center;gap:10px">
                    <span style="width:40px;height:40px;border-radius:12px;background:${dept.bgSoft};color:${dept.color};display:flex;align-items:center;justify-content:center;border:1px solid ${dept.borderSoft};flex-shrink:0">
                      ${getDeptSvg(dept.id)}
                    </span>
                    <div>
                      <div style="font-size:11px;font-weight:700;color:${dept.color}">${t('القسم')} <span class="num">${dept.num}</span></div>
                      <div style="font-size:14.5px;font-weight:800;color:var(--t1);line-height:1.25">${t(dept.titleAr)}</div>
                    </div>
                  </div>
                  <span style="font-size:12px;font-weight:700;color:${dept.color};flex-shrink:0">
                    ${employeeCountLabel(count)}
                  </span>
                </div>

                <p style="font-size:12.5px;color:var(--t2);margin:0 0 12px;line-height:1.55;min-height:46px">
                  ${t(dept.descriptionAr)}
                </p>

                <div style="border-top:1px solid var(--border-soft);padding-top:10px;display:flex;justify-content:space-between;align-items:center;font-size:11.5px;gap:8px">
                  <span style="color:var(--t3);font-weight:600">${t('المسؤول الافتراضي:')} ${esc(t(String(dept.defaultSupervisor || 'المدير العام (Gérant)').split('(')[0].trim()))}</span>
                  <span style="color:${dept.color};font-weight:700;flex-shrink:0">${isSelected ? t('محدد') : t('عرض الموظفين')}</span>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>

      <!-- Filters & Search Toolbar -->
      <div class="card" style="padding:14px 18px;margin-bottom:18px;display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:12px">
        <div style="position:relative;flex:1;min-width:260px;display:flex;align-items:center">
          <span style="position:absolute;inset-inline-start:12px;color:var(--t3);display:flex;pointer-events:none">${eIc('search', 15)}</span>
          <input
            type="text"
            class="fctl"
            style="padding-inline-start:36px;font-size:13px"
            placeholder="${t('ابحث باسم الموظف، المنصب، اسم المستخدم، أو المسؤول المباشر...')}"
            value="${esc(window.__empSearchQuery)}"
            oninput="window.setEmpSearchQuery(this.value)"
          />
        </div>

        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
          <label style="font-size:12px;color:var(--t3);font-weight:600">${t('القسم:')}</label>
          <select class="fctl" style="width:auto;min-height:36px;font-size:12.5px;padding:6px 10px" onchange="window.setEmpDeptFilter(this.value)">
            <option value="all" ${window.__empFilterDept === 'all' ? 'selected' : ''}>${t('جميع الأقسام')} (${allEmployees.length})</option>
            ${DEPARTMENTS.map(d => `<option value="${d.id}" ${window.__empFilterDept === d.id ? 'selected' : ''}>${t(d.titleAr)} (${deptCounts[d.id] || 0})</option>`).join('')}
          </select>

          <label style="font-size:12px;color:var(--t3);font-weight:600">${t('الحالة:')}</label>
          <select class="fctl" style="width:auto;min-height:36px;font-size:12.5px;padding:6px 10px" onchange="window.setEmpStatusFilter(this.value)">
            <option value="all" ${window.__empFilterStatus === 'all' ? 'selected' : ''}>${t('الكل')}</option>
            <option value="نشط" ${window.__empFilterStatus === 'نشط' ? 'selected' : ''}>${t('نشط')}</option>
            <option value="معطل" ${window.__empFilterStatus === 'معطل' ? 'selected' : ''}>${t('معطل')}</option>
          </select>

          ${(window.__empSearchQuery || window.__empFilterDept !== 'all' || window.__empFilterStatus !== 'all') ? `
            <button class="btn btn-danger-soft btn-xs" onclick="window.resetEmpFilters()">
              ${eIc('x', 12)} <span>${t('إلغاء التصفية')}</span>
            </button>
          ` : ''}
        </div>
      </div>

      <!-- Employees Directory Table -->
      <div class="glass-table-wrap">
        <div style="padding:16px 20px;border-bottom:1px solid var(--border-soft);display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">
          <div>
            <h3 style="margin:0;font-size:16px;font-weight:800;color:var(--t1)">${t('جدول الموظفين والصلاحيات الممنوحة')}</h3>
            <span style="font-size:12px;color:var(--t3)">${t('المعروض:')} <span class="num">${filtered.length}</span> / <span class="num">${allEmployees.length}</span></span>
          </div>
          <div style="display:flex;align-items:center;gap:6px;font-size:12px;color:var(--t2)">
            ${eIc('shield', 14)}
            <span>${t('المدير العام يحدد ويعدل الصلاحيات في أي وقت')}</span>
          </div>
        </div>

        ${filtered.length === 0 ? `
          <div class="empty" style="border:none;border-radius:0;margin:0;background:transparent">
            <div class="empty-icon">${eIc('users', 24)}</div>
            <div style="font-size:15px;font-weight:700;color:var(--t1)">${t('لا يوجد موظفون يطابقون خيارات البحث')}</div>
            <p class="empty-text" style="margin:0">${t('جرب تغيير كلمات البحث أو إلغاء فلتر الأقسام.')}</p>
          </div>
        ` : `
          <table class="glass-table">
            <thead>
              <tr>
                <th>${t('الموظف وبيانات الدخول')}</th>
                <th>${t('القسم')}</th>
                <th>${t('المنصب')}</th>
                <th>${t('المسؤول المباشر')}</th>
                <th>${t('المهام والمسؤوليات')}</th>
                <th>${t('الصلاحيات (من الـ Gérant)')}</th>
                <th>${t('الحالة')}</th>
                <th style="text-align:center">${t('الإجراءات')}</th>
              </tr>
            </thead>
            <tbody>
              ${filtered.map(emp => {
                const empSafe = emp || {};
                const rawName = empSafe.fullName || empSafe.name || empSafe.username || t('موظف');
                const empName = typeof rawName === 'string' ? rawName : String(rawName || t('موظف'));
                const initials = empName && typeof empName.slice === 'function' && empName.length > 0 ? empName.slice(0, 2) : t('موظف').slice(0, 1);
                const dept = getDepartment(empSafe.department) || DEPARTMENTS[0];
                const perms = empSafe.permissions || {};
                const activePermsCount = empSafe.role === 'GERANT' ? PERMISSION_DEFINITIONS.length : Object.values(perms).filter(Boolean).length;
                const activeStaffId = S?.currentStaffUser?.id || (typeof currentStaffUser !== 'undefined' && currentStaffUser ? currentStaffUser.id : null);
                const isCurrentSession = Boolean((currentUser?.isEmployee && currentUser?.employeeId === empSafe.id) || (activeStaffId && activeStaffId === empSafe.id));

                return `
                  <tr style="${isCurrentSession ? 'background:rgba(10,132,255,0.08)' : ''}">
                    <td>
                      <div style="display:flex;align-items:center;gap:10px">
                        <div style="width:38px;height:38px;border-radius:11px;background:${dept.bgSoft || 'rgba(10,132,255,0.12)'};color:${dept.color || 'var(--sys-blue)'};font-weight:800;display:flex;align-items:center;justify-content:center;font-size:14px;border:1px solid ${dept.borderSoft || 'var(--border)'};flex-shrink:0">
                          ${esc(initials)}
                        </div>
                        <div>
                          <div style="font-weight:700;color:var(--t1);font-size:13.5px;display:flex;align-items:center;gap:6px">
                            <span class="staff-name">${esc(empName)}</span>
                            ${isCurrentSession ? `<span style="font-size:11px;color:var(--info-t);font-weight:700">· ${t('أنت الآن')}</span>` : ''}
                          </div>
                          <div style="font-size:11.5px;color:var(--t3);display:flex;align-items:center;gap:8px;margin-top:2px">
                            <span data-user-content="true" style="font-family:monospace;color:var(--t2)">@${esc(empSafe.username || empSafe.id || 'emp')}</span>
                            ${empSafe.phone ? `<span class="num" style="display:inline-flex;align-items:center;gap:3px">${eIc('phone', 11)} ${esc(empSafe.phone)}</span>` : ''}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td>
                      <span style="display:inline-flex;align-items:center;gap:6px;color:${dept.color};font-weight:700;font-size:12.5px">
                        ${getDeptSvg(dept.id)}
                        <span>${t(dept.titleAr)}</span>
                      </span>
                    </td>

                    <td style="font-weight:600;color:var(--t1)">
                      ${empSafe.position ? `<span class="staff-position">${esc(empSafe.position)}</span>` : esc(t(dept.defaultPosition || 'موظف'))}
                    </td>

                    <td>
                      <div style="display:flex;align-items:center;gap:6px;color:var(--t2);font-weight:600">
                        <span style="color:var(--sys-blue)">${eIc('crown', 13)}</span>
                        <span class="staff-supervisor">${esc(empSafe.supervisor || t(dept.defaultSupervisor || 'المدير العام (Gérant)'))}</span>
                      </div>
                    </td>

                    <td style="max-width:240px">
                      <div data-user-content="${empSafe.tasks ? 'true' : 'false'}" style="font-size:12px;color:var(--t2);line-height:1.45;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden" title="${esc(empSafe.tasks || '')}">
                        ${esc(empSafe.tasks || t(dept.descriptionAr || ''))}
                      </div>
                      <button class="btn btn-ghost btn-xs" onclick="window.viewEmployeeTasks('${empSafe.id || ''}')" style="font-size:11px;padding:2px 0;color:var(--bt);font-weight:700;margin-top:3px">
                        ${t('عرض كامل المهام')}
                      </button>
                    </td>

                    <td>
                      <div style="display:flex;align-items:center;gap:8px">
                        <span class="num" style="color:${activePermsCount >= 8 ? 'var(--gt)' : 'var(--bt)'};font-weight:700;font-size:12.5px">
                          ${activePermsCount} / ${PERMISSION_DEFINITIONS.length} ${t('صلاحية')}
                        </span>
                        ${isGerant ? `
                          <button class="btn btn-ghost btn-xs" onclick="window.openEditPermissionsModal('${empSafe.id || ''}')" title="${t('تعديل الصلاحيات الممنوحة')}" style="color:var(--bt);font-weight:700">
                            ${eIc('sliders', 12)} <span>${t('ضبط')}</span>
                          </button>
                        ` : ''}
                      </div>
                      <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:3px;max-width:220px;font-size:10.5px;color:var(--t3)">
                        ${perms.canAddClients ? `<span>${t('إضافة عملاء')}</span>` : ''}
                        ${perms.canManageIssues ? `<span style="color:var(--wt)">${t('مشاكل تقنية')}</span>` : ''}
                        ${perms.canManagePrograms ? `<span style="color:var(--gt)">${t('رخص وبرامج')}</span>` : ''}
                        ${perms.canDeleteClients ? `<span style="color:var(--rt);font-weight:700">${t('حذف')}</span>` : ''}
                      </div>
                    </td>

                    <td>
                      <span style="display:inline-flex;align-items:center;gap:5px;font-size:12px;font-weight:700;color:${empSafe.status === 'نشط' ? 'var(--gt)' : 'var(--rt)'}">
                        <span style="width:6px;height:6px;border-radius:50%;background:${empSafe.status === 'نشط' ? 'var(--g)' : 'var(--r)'}"></span>
                        <span>${t(empSafe.status || 'نشط')}</span>
                      </span>
                    </td>

                    <td style="text-align:center">
                      <div style="display:inline-flex;align-items:center;gap:4px">
                        ${isGerant ? `
                          <button class="btn btn-ghost btn-xs" onclick="window.quickImpersonateEmployee('${empSafe.id || ''}')" title="${t('تجربة واستعراض الواجهة بصلاحيات هذا الموظف')}" style="color:var(--info-t)">
                            ${eIc('zap', 13)} <span>${t('تجربة')}</span>
                          </button>
                          <button class="btn btn-ghost btn-xs" onclick="window.openEditEmployeeModal('${empSafe.id || ''}')" title="${t('تعديل بيانات الموظف والمنصب')}" style="color:var(--bt)">
                            ${eIc('edit', 13)}
                          </button>
                          <button class="btn btn-ghost btn-xs" onclick="window.openChangePasswordModal('${empSafe.id || ''}')" title="${t('تغيير كلمة المرور')}" style="color:var(--wt)">
                            ${eIc('key', 13)}
                          </button>
                          <button class="btn btn-ghost btn-xs" onclick="window.confirmDeleteEmployee('${empSafe.id || ''}')" title="${t('حذف حساب الموظف')}" style="color:var(--rt)">
                            ${eIc('trash', 13)}
                          </button>
                        ` : `
                          <button class="btn btn-ghost btn-xs" onclick="window.viewEmployeeTasks('${empSafe.id || ''}')" style="color:var(--bt)">
                            ${t('تفاصيل')}
                          </button>
                        `}
                      </div>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        `}
      </div>

      <!-- Governance Card -->
      <div class="card" style="margin-top:20px;padding:18px 20px;display:flex;align-items:center;gap:14px">
        <div style="width:42px;height:42px;border-radius:12px;background:var(--bbg);color:var(--bt);display:grid;place-items:center;flex-shrink:0">
          ${eIc('shield', 20)}
        </div>
        <div>
          <h4 style="margin:0 0 3px;font-size:14px;font-weight:800;color:var(--t1)">${t('سياسة الحوكمة والتحكم في الصلاحيات')}</h4>
          <p style="margin:0;font-size:12.5px;color:var(--t2);line-height:1.55">
            ${t('تطبيق مبدأ أقل الصلاحيات المطلوبة (Least Privilege Principle). فقط المسؤول العام (Gérant) يملك صلاحية منح أو سحب الصلاحيات الحساسة كحذف العملاء وتصدير البيانات وإدارة فريق العمل، بينما يركز كل موظف على مهامه وفق قسمه المحدد في PROGILIC.')}
          </p>
        </div>
      </div>
    </div>
  `;
}

/**
 * Filter and search dispatchers
 */
window.setEmpDeptFilter = function(deptId) {
  window.__empFilterDept = deptId;
  R();
};

window.setEmpSearchQuery = function(q) {
  window.__empSearchQuery = q;
  R();
};

window.setEmpStatusFilter = function(st) {
  window.__empFilterStatus = st;
  R();
};

window.resetEmpFilters = function() {
  window.__empFilterDept = 'all';
  window.__empSearchQuery = '';
  window.__empFilterStatus = 'all';
  R();
};

/**
 * Modal Openers
 */
window.openAddEmployeeModal = function() {
  window.__editingEmpId = null;
  S.modal = 'addEmployee';
  R();
};

window.openEditEmployeeModal = function(empId) {
  window.__editingEmpId = empId;
  S.modal = 'editEmployee';
  R();
};

window.openEditPermissionsModal = function(empId) {
  window.__permTargetEmpId = empId;
  S.modal = 'editEmployeePermissions';
  R();
};

window.openChangePasswordModal = function(empId) {
  window.__passwordTargetEmpId = empId;
  S.modal = 'changeEmployeePassword';
  R();
};

window.viewEmployeeTasks = function(empId) {
  window.__viewingEmpId = empId;
  S.modal = 'viewEmployeeTasks';
  R();
};

window.confirmDeleteEmployee = function(empId) {
  const emp = getEmployeeById(empId);
  if (!emp) return;
  if (emp.id === 'gerant' || emp.role === 'GERANT') {
    showToast(t('لا يمكن حذف حساب المسؤول العام الرئيسي (Gérant).'), 'error');
    return;
  }
  window.__deleteTargetEmpId = empId;
  S.modal = 'adminPasswordConfirm';
  R();
};

window.openEmployeeLoginPortal = function() {
  S.showStaffPortal = true;
  R();
};

window.quickImpersonateEmployee = function(empId) {
  const emp = getEmployeeById(empId);
  if (!emp) return;
  loginAsEmployeeSession(emp);
  const empName = emp.fullName || emp.name || t('الموظف');
  showToast(`${t('تم التبديل لتجربة الواجهة بصلاحيات: ')}${empName} (${t(getDepartment(emp.department).titleAr)})`, 'info', 5000);
  R();
};

window.returnToGerantMode = function() {
  localStorage.removeItem('crm_active_employee_session');
  localStorage.removeItem('crm_logged_out');

  let savedGerant = null;
  try {
    const raw = localStorage.getItem('crm_active_gerant_user');
    if (raw) savedGerant = JSON.parse(raw);
  } catch (e) {}

  const restoredUser = savedGerant || {
    uid: (auth && auth.currentUser && auth.currentUser.uid) || 'z1FY0kWqOOSe78cFv8rqak0mjV03',
    email: 'admin@progilic.dz',
    displayName: t('المسؤول العام (Gérant)'),
    emailVerified: true,
    isEmployee: false,
    role: 'gerant'
  };

  import('../state/store.js').then(m => {
    m.setCurrentUser(restoredUser);
    showToast(`${t('تمت العودة بنجاح إلى حساب المسؤول العام (Gérant): ')}${restoredUser.displayName || restoredUser.email}${t('. كامل الصلاحيات مفعلة.')}`, 'success');
    R();
  });
};

/**
 * Renders the Add/Edit Employee Form Modal
 */
export function renderEmployeeFormModal() {
  const isEdit = S.modal === 'editEmployee';
  const emp = isEdit ? (getEmployeeById(window.__editingEmpId) || {}) : {};
  const selectedDeptId = emp.department || 'pre_vente';
  const dept = getDepartment(selectedDeptId);

  return `
    <div class="mhdr">
      <div class="mtitle">${t(isEdit ? 'تعديل بيانات الموظف والمنصب' : 'إضافة موظف جديد وتحديد المسؤوليات')}</div>
      <button class="mclose" onclick="closeModal()">×</button>
    </div>

    <form onsubmit="window.handleSaveEmployee(event)">
      <div class="frow">
        <div class="fgroup">
          <label class="flbl">${t('اسم الموظف الكامل *')}</label>
          <input class="fctl" id="emp_fullName" required value="${esc(emp.fullName || emp.name || '')}" placeholder="${t('مثال: سليم بن علي')}">
        </div>
        <div class="fgroup">
          <label class="flbl">${t('اسم المستخدم (لتسجيل الدخول) *')}</label>
          <input class="fctl" id="emp_username" dir="ltr" required value="${esc(emp.username || '')}" placeholder="${t('مثال: salim.benali')}">
        </div>
      </div>

      <div class="frow">
        <div class="fgroup">
          <label class="flbl">${t('القسم التابع له (من الأقسام الأربعة) *')}</label>
          <select class="fctl" id="emp_department" onchange="window.onEmployeeDeptChanged(this.value)">
            ${DEPARTMENTS.map(d => `
              <option value="${d.id}" ${selectedDeptId === d.id ? 'selected' : ''}>
                ${d.num}. ${t(d.titleAr)}
              </option>
            `).join('')}
          </select>
        </div>
        <div class="fgroup">
          <label class="flbl">${t('منصبه / المسمى الوظيفي *')}</label>
          <input class="fctl" id="emp_position" required value="${esc(emp.position || t(dept.defaultPosition))}" placeholder="${t('مثال: مسؤول عروض وشروحات ما قبل البيع')}">
        </div>
      </div>

      <div class="frow">
        <div class="fgroup">
          <label class="flbl">${t('المسؤول المباشر *')}</label>
          <input class="fctl" id="emp_supervisor" required value="${esc(emp.supervisor || t('المدير العام (Gérant)'))}">
        </div>
        <div class="fgroup">
          <label class="flbl">${t(isEdit ? 'كلمة المرور (اتركها فارغة للإبقاء على الحالية)' : 'كلمة المرور الابتدائية *')}</label>
          <input class="fctl" id="emp_password" type="text" dir="ltr" ${isEdit ? '' : 'required'} value="" placeholder="${t('كلمة المرور للدخول')}">
        </div>
      </div>

      <div class="frow">
        <div class="fgroup">
          <label class="flbl">${t('رقم الهاتف (اختياري)')}</label>
          <input class="fctl" id="emp_phone" dir="ltr" value="${esc(emp.phone || '')}" placeholder="0550...">
        </div>
        <div class="fgroup">
          <label class="flbl">${t('البريد الإلكتروني (اختياري)')}</label>
          <input class="fctl" id="emp_email" type="email" dir="ltr" value="${esc(emp.email || '')}" placeholder="employee@progilic.dz">
        </div>
      </div>

      <div class="fgroup" style="margin-top:10px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px">
          <label class="flbl" style="margin:0">${t('المهام والمسؤوليات الموكلة للموظف *')}</label>
          <button type="button" class="btn btn-ghost btn-xs" onclick="window.loadDeptPresetTasks()" style="color:var(--bt);font-size:11.5px;padding:0">
            ${eIc('refresh', 12)} <span>${t('تحميل مهام القسم الافتراضية')}</span>
          </button>
        </div>
        <textarea class="fctl" id="emp_tasks" rows="3" required placeholder="${t('تفاصيل المهام والمسؤوليات الموكلة لهذا الموظف...')}">${esc(emp.tasks || dept.responsibilities.map(t).join(' • '))}</textarea>
      </div>

      <div class="frow" style="margin-top:10px">
        <div class="fgroup">
          <label class="flbl">${t('حالة الحساب')}</label>
          <select class="fctl" id="emp_status">
            <option value="نشط" ${emp.status !== 'معطل' ? 'selected' : ''}>${t('نشط (يمكنه تسجيل الدخول)')}</option>
            <option value="معطل" ${emp.status === 'معطل' ? 'selected' : ''}>${t('معطل (موقوف مؤقتاً)')}</option>
          </select>
        </div>
      </div>

      <div class="facts">
        <button type="button" class="btn btn-ghost" onclick="closeModal()">${t('إلغاء')}</button>
        <button type="submit" class="btn btn-primary">${t(isEdit ? 'حفظ التعديلات' : 'إنشاء حساب الموظف')}</button>
      </div>
    </form>
  `;
}

window.onEmployeeDeptChanged = function(deptId) {
  const d = getDepartment(deptId);
  const posInput = document.getElementById('emp_position');
  const tasksInput = document.getElementById('emp_tasks');
  if (posInput) posInput.value = d.defaultPosition;
  if (tasksInput) tasksInput.value = d.responsibilities.map(t).join(' • ');
};

window.loadDeptPresetTasks = function() {
  const deptSelect = document.getElementById('emp_department');
  const tasksInput = document.getElementById('emp_tasks');
  if (deptSelect && tasksInput) {
    const d = getDepartment(deptSelect.value);
    tasksInput.value = d.responsibilities.map(t).join(' • ');
    showToast(t('تم تحميل مهام القسم الافتراضية.'), 'info');
  }
};

window.handleSaveEmployee = function(e) {
  e.preventDefault();
  const isEdit = S.modal === 'editEmployee';
  const existing = isEdit ? getEmployeeById(window.__editingEmpId) : null;

  const fullName = document.getElementById('emp_fullName')?.value.trim();
  const username = document.getElementById('emp_username')?.value.trim().toLowerCase();
  const department = document.getElementById('emp_department')?.value;
  const position = document.getElementById('emp_position')?.value.trim();
  const supervisor = document.getElementById('emp_supervisor')?.value.trim();
  const passwordVal = document.getElementById('emp_password')?.value.trim();
  const phone = document.getElementById('emp_phone')?.value.trim();
  const email = document.getElementById('emp_email')?.value.trim();
  const tasks = document.getElementById('emp_tasks')?.value.trim();
  const status = document.getElementById('emp_status')?.value;

  if (!fullName || !username) {
    showToast(t('يرجى إدخال اسم الموظف واسم المستخدم.'), 'error');
    return;
  }

  const payload = {
    ...(existing || {}),
    id: isEdit ? window.__editingEmpId : undefined,
    fullName,
    username,
    department,
    position,
    supervisor,
    phone,
    email,
    tasks,
    status
  };

  if (!isEdit && !passwordVal) {
    showToast(t('يرجى تحديد كلمة مرور للموظف الجديد.'), 'error');
    return;
  }
  if (passwordVal) {
    payload.password = passwordVal;
  }

  if (!isEdit) {
    payload.permissions = { ...getDepartment(department).defaultPermissions };
  }

  upsertEmployee(payload);
  showToast(t(isEdit ? 'تم تحديث بيانات الموظف بنجاح.' : 'تم إنشاء حساب الموظف بنجاح.'), 'success');
  closeModal();
  R();
};

/**
 * Modal to Edit Permissions (Strictly Gérant)
 */
export function renderEditPermissionsModal() {
  const emp = getEmployeeById(window.__permTargetEmpId);
  if (!emp) return `<div class="mhdr"><div class="mtitle">${t('خطأ')}</div></div><p>${t('لم يتم العثور على الموظف.')}</p>`;

  const dept = getDepartment(emp.department);
  const currentPerms = emp.permissions || {};

  const groups = {};
  PERMISSION_DEFINITIONS.forEach(def => {
    if (!groups[def.group]) groups[def.group] = [];
    groups[def.group].push(def);
  });

  return `
    <div class="mhdr">
      <div>
        <div class="mtitle">${t('تحديد وضبط الصلاحيات')} — <span class="staff-name">${esc(emp.fullName || emp.name || '')}</span></div>
        <div style="font-size:12px;color:var(--t3);margin-top:3px">
          ${t('القسم:')} <strong style="color:${dept.color}">${t(dept.titleAr)}</strong> · ${t('المنصب:')} <strong class="staff-position">${esc(emp.position)}</strong>
        </div>
      </div>
      <button class="mclose" onclick="closeModal()">×</button>
    </div>

    <div style="background:rgba(10,132,255,0.08);border:1px solid rgba(10,132,255,0.24);border-radius:var(--r-sm);padding:10px 14px;margin-bottom:14px;font-size:12px;color:var(--t2);display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
      <span style="display:inline-flex;align-items:center;gap:6px">${eIc('crown', 14)} <span>${t('هذه الصلاحيات يتحكم بها المسؤول العام (Gérant) حصرياً.')}</span></span>
      <div style="display:flex;gap:6px">
        <button type="button" class="btn btn-ghost btn-xs" onclick="window.applyDeptDefaultPerms('${emp.department}')" style="color:var(--bt);font-weight:700">
          ${t('استعادة صلاحيات القسم الافتراضية')}
        </button>
        <button type="button" class="btn btn-ghost btn-xs" onclick="window.selectAllPerms(true)" style="color:var(--gt);font-weight:700">
          ${t('تحديد الكل')}
        </button>
      </div>
    </div>

    <form onsubmit="window.handleSavePermissions(event)">
      <div style="display:flex;flex-direction:column;gap:12px;max-height:420px;overflow-y:auto;padding-inline-end:4px">
        ${Object.keys(groups).map(grpName => `
          <div style="border:1px solid var(--border);border-radius:var(--r-md);padding:12px 14px;background:rgba(255,255,255,0.03)">
            <div style="font-size:12.5px;font-weight:800;color:var(--t1);margin-bottom:10px;border-bottom:1px solid var(--border-soft);padding-bottom:6px;display:flex;align-items:center;gap:7px">
              ${eIc('folder', 14)} <span>${t(grpName)}</span>
            </div>
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:8px">
              ${groups[grpName].map(def => {
                const isChecked = Boolean(currentPerms[def.key]);
                return `
                  <label style="display:flex;align-items:flex-start;gap:8px;cursor:pointer;font-size:12px;padding:6px 8px;border-radius:8px;background:rgba(255,255,255,0.02);border:1px solid var(--border-soft)">
                    <input
                      type="checkbox"
                      id="perm_${def.key}"
                      ${isChecked ? 'checked' : ''}
                      style="margin-top:3px;cursor:pointer;accent-color:var(--sys-blue)"
                    />
                    <div>
                      <div style="font-weight:700;color:var(--t1)">${t(def.label)}</div>
                      <div style="font-size:11px;color:var(--t3);margin-top:2px">${t(def.desc)}</div>
                    </div>
                  </label>
                `;
              }).join('')}
            </div>
          </div>
        `).join('')}
      </div>

      <div class="facts">
        <button type="button" class="btn btn-ghost" onclick="closeModal()">${t('إلغاء')}</button>
        <button type="submit" class="btn btn-primary">${t('حفظ وتطبيق الصلاحيات')}</button>
      </div>
    </form>
  `;
}

window.applyDeptDefaultPerms = function(deptId) {
  const d = getDepartment(deptId);
  PERMISSION_DEFINITIONS.forEach(def => {
    const el = document.getElementById(`perm_${def.key}`);
    if (el) el.checked = Boolean(d.defaultPermissions[def.key]);
  });
  showToast(`${t('تم تطبيق الصلاحيات الافتراضية لقسم')} ${t(d.titleAr)}`, 'info');
};

window.selectAllPerms = function(enableAll = true) {
  PERMISSION_DEFINITIONS.forEach(def => {
    const el = document.getElementById(`perm_${def.key}`);
    if (el) el.checked = enableAll;
  });
};

window.handleSavePermissions = function(e) {
  e.preventDefault();
  const empId = window.__permTargetEmpId;
  const newPerms = {};
  PERMISSION_DEFINITIONS.forEach(def => {
    const el = document.getElementById(`perm_${def.key}`);
    newPerms[def.key] = el ? el.checked : false;
  });

  updateEmployeePermissions(empId, newPerms);
  showToast(t('تم حفظ الصلاحيات المحدثة للموظف بنجاح.'), 'success');
  closeModal();
  R();
};

/**
 * Modal to Change Employee Password
 */
export function renderChangePasswordModal() {
  const emp = getEmployeeById(window.__passwordTargetEmpId);
  if (!emp) return `<div class="mhdr"><div class="mtitle">${t('خطأ')}</div></div><p>${t('لم يتم العثور على الموظف.')}</p>`;

  return `
    <div class="mhdr">
      <div class="mtitle">${t('تغيير كلمة المرور')} — <span class="staff-name">${esc(emp.fullName || emp.name || '')}</span></div>
      <button class="mclose" onclick="closeModal()">×</button>
    </div>

    <form onsubmit="window.handleSavePassword(event)">
      <p style="font-size:12.5px;color:var(--t2);margin:0 0 14px;line-height:1.6">
        ${t('بصفتك المسؤول العام (Gérant)، يمكنك تعيين كلمة مرور جديدة للموظف')} <strong class="staff-name" style="color:var(--t1)">${esc(emp.fullName || emp.name || '')}</strong> (${t('اسم المستخدم:')} <code style="color:var(--info-t)">${esc(emp.username)}</code>).
      </p>

      <div class="fgroup">
        <label class="flbl">${t('كلمة المرور الجديدة *')}</label>
        <input class="fctl" type="text" id="new_emp_pwd" required dir="ltr" placeholder="${t('أدخل كلمة مرور جديدة...')}">
      </div>

      <div class="facts">
        <button type="button" class="btn btn-ghost" onclick="closeModal()">${t('إلغاء')}</button>
        <button type="submit" class="btn btn-primary">${t('تحديث كلمة المرور')}</button>
      </div>
    </form>
  `;
}

window.handleSavePassword = function(e) {
  e.preventDefault();
  const newPwd = document.getElementById('new_emp_pwd')?.value.trim();
  if (!newPwd || newPwd.length < 4) {
    showToast(t('يرجى إدخال كلمة مرور من 4 أحرف على الأقل.'), 'error');
    return;
  }
  updateEmployeePassword(window.__passwordTargetEmpId, newPwd);
  showToast(t('تم تحديث كلمة المرور للموظف بنجاح.'), 'success');
  closeModal();
  R();
};

/**
 * Modal to View Employee Tasks and Details
 */
export function renderViewEmployeeTasksModal() {
  const emp = getEmployeeById(window.__viewingEmpId);
  if (!emp) return `<div class="mhdr"><div class="mtitle">${t('خطأ')}</div></div><p>${t('لم يتم العثور على الموظف.')}</p>`;
  const dept = getDepartment(emp.department);

  return `
    <div class="mhdr">
      <div>
        <div class="mtitle">${t('بطاقة الموظف والمسؤوليات')} — <span class="staff-name">${esc(emp.fullName || emp.name || '')}</span></div>
        <div style="font-size:12px;color:${dept.color};font-weight:700;margin-top:3px;display:inline-flex;align-items:center;gap:6px">
          ${getDeptSvg(dept.id)} <span>${t(dept.titleAr)}</span>
        </div>
      </div>
      <button class="mclose" onclick="closeModal()">×</button>
    </div>

    <div style="display:flex;flex-direction:column;gap:14px;font-size:13px">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;background:rgba(255,255,255,0.04);border:1px solid var(--border-soft);padding:12px 14px;border-radius:var(--r-sm)">
        <div><strong style="color:var(--t3)">${t('المنصب:')}</strong> <span class="staff-position" style="color:var(--t1)">${esc(emp.position)}</span></div>
        <div><strong style="color:var(--t3)">${t('المسؤول المباشر:')}</strong> <span class="staff-supervisor" style="color:var(--t1)">${esc(emp.supervisor)}</span></div>
        <div><strong style="color:var(--t3)">${t('اسم المستخدم:')}</strong> <span style="color:var(--t1);font-family:monospace">@${esc(emp.username)}</span></div>
        <div><strong style="color:var(--t3)">${t('الهاتف:')}</strong> <span class="num" style="color:var(--t1)">${esc(emp.phone || t('غير مسجل'))}</span></div>
      </div>

      <div>
        <h4 style="margin:0 0 6px;font-size:13px;font-weight:800;color:var(--t1)">${t('المهام والمسؤوليات التفصيلية:')}</h4>
        <div data-user-content="${emp.tasks ? 'true' : 'false'}" style="background:rgba(255,255,255,0.03);border:1px solid var(--border);border-radius:var(--r-sm);padding:12px 14px;line-height:1.6;color:var(--t2);white-space:pre-line">
          ${esc(emp.tasks || t(dept.descriptionAr))}
        </div>
      </div>

      <div>
        <h4 style="margin:0 0 6px;font-size:13px;font-weight:800;color:var(--t1)">${t('اختصاصات قسم')} ${t(dept.titleAr)} ${t('في PROGILIC:')}</h4>
        <ul style="margin:0;padding-inline-start:18px;color:var(--t2);font-size:12.5px;line-height:1.6">
          ${(dept.responsibilities || []).map(r => `<li>${esc(t(r))}</li>`).join('')}
        </ul>
      </div>

      <div class="facts">
        <button class="btn btn-primary" onclick="closeModal()">${t('إغلاق')}</button>
      </div>
    </div>
  `;
}

/**
 * Renders the Admin Password Verification Modal for safe user deletion
 */
export function renderAdminPasswordModal() {
  const empId = window.__deleteTargetEmpId;
  const emp = getEmployeeById(empId) || {};
  const empName = emp.fullName || emp.name || 'الموظف';
  const dept = getDepartment(emp.department);

  return `
    <div class="mhdr">
      <div style="display:flex;align-items:center;gap:12px">
        <span style="background:var(--rbg);color:var(--rt);width:40px;height:40px;border-radius:12px;display:flex;align-items:center;justify-content:center;border:1px solid rgba(255,69,58,0.3)">${eIc('lock', 18)}</span>
        <div>
          <div class="mtitle" style="color:var(--rt)">${t('التحقق من كلمة مرور المسؤول العام (Admin Verification)')}</div>
          <div style="font-size:12px;color:var(--t3);margin-top:2px">${t('تأكيد حذف حساب الموظف نهائياً وحظر وصوله للنظام')}</div>
        </div>
      </div>
      <button class="mclose" onclick="closeModal()">×</button>
    </div>

    <form onsubmit="window.handleAdminPasswordConfirmSubmit(event)">
      <div style="background:rgba(255,69,58,0.08);border:1px solid rgba(255,69,58,0.25);border-radius:var(--r-md);padding:14px 16px;margin-bottom:16px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
          <strong class="staff-name" style="color:var(--t1);font-size:14px">${esc(empName)}</strong>
          <span style="font-size:11.5px;color:${dept.color || 'var(--bt)'};font-weight:700">${esc(t(dept.titleAr || ''))}</span>
        </div>
        <div style="font-size:12px;color:var(--t2);display:flex;gap:12px;flex-wrap:wrap">
          <span><strong>${t('اسم المستخدم:')}</strong> @${esc(emp.username || emp.id || '')}</span>
          <span><strong>${t('المنصب:')}</strong> <span class="staff-position">${esc(emp.position || t('موظف'))}</span></span>
        </div>
        <div style="margin-top:8px;font-size:12px;color:var(--rt);font-weight:600;display:flex;align-items:center;gap:6px">
          ${eIc('warn', 14)}
          <span>${t('تنبيه أمني: هذا الإجراء لا رجعة فيه وسيؤدي لمسح حساب الموظف وجميع صلاحياته وسجلاته من قاعدة البيانات نهائياً.')}</span>
        </div>
      </div>

      <div class="fgroup" style="margin-bottom:16px">
        <label class="flbl" style="font-size:13px;font-weight:700">${t('كلمة مرور المسؤول العام (Gérant) للتأكيد *')}</label>
        <div style="position:relative">
          <input
            type="password"
            id="admin_verification_pwd"
            class="fctl"
            required
            autofocus
            dir="ltr"
            placeholder="${t('أدخل كلمة المرور الخاصة بالمسؤول العام...')}"
            style="padding-inline-end:40px;font-size:13px"
          />
          <button
            type="button"
            onclick="const inp=document.getElementById('admin_verification_pwd'); inp.type = inp.type==='password'?'text':'password';"
            style="position:absolute;inset-inline-end:10px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;color:var(--t2);display:flex"
            title="${t('إظهار / إخفاء كلمة المرور')}"
          >
            ${eIc('eye', 16)}
          </button>
        </div>
        <span class="fhint">
          ${t('يتطلب النظام إدخال كلمة مرور المسؤول العام للتأكد من هوية صاحب القرار قبل تنفيذ حذف المستخدمين.')}
        </span>
      </div>

      <div class="facts">
        <button type="button" class="btn btn-ghost" onclick="closeModal()">${t('إلغاء')}</button>
        <button type="submit" class="btn btn-danger">
          ${eIc('trash', 14)} <span>${t('تأكيد وحذف الموظف نهائياً')}</span>
        </button>
      </div>
    </form>
  `;
}

window.handleAdminPasswordConfirmSubmit = function(e) {
  e.preventDefault();
  const pwd = document.getElementById('admin_verification_pwd')?.value || '';
  if (!pwd.trim()) {
    showToast(t('يرجى إدخال كلمة مرور المسؤول العام.'), 'error');
    return;
  }
  const empId = window.__deleteTargetEmpId;
  window.confirmDeleteEmployeeWithAdminPassword(empId, pwd);
};
