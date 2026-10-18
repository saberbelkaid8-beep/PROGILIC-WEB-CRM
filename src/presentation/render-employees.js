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
  deleteEmployee, 
  updateEmployeePermissions, 
  updateEmployeePassword,
  loginAsEmployeeSession,
  hasPermission,
  isUserGerant
} from '../business/employeeService.js';
import { esc } from '../utils/index.js';
import { t } from '../utils/i18n.js';
import { showToast } from '../utils/toast.js';
import { showConfirm } from '../utils/confirm.js';
import { R } from './render-core.js';

// Internal UI state for Employees view
window.__empFilterDept = window.__empFilterDept || 'all';
window.__empSearchQuery = window.__empSearchQuery || '';
window.__empFilterStatus = window.__empFilterStatus || 'all';
window.__editingEmpId = window.__editingEmpId || null;
window.__permTargetEmpId = window.__permTargetEmpId || null;

/**
 * Main Render Function for Employees & Departments View
 */
export function renderEmployeesView() {
  const isGerant = isUserGerant(currentUser);
  const allEmployees = getEmployees();
  
  // Calculate department counts
  const deptCounts = {};
  DEPARTMENTS.forEach(d => {
    deptCounts[d.id] = allEmployees.filter(e => e.department === d.id).length;
  });

  // Filter employees
  let filtered = allEmployees.filter(emp => {
    if (window.__empFilterDept !== 'all' && emp.department !== window.__empFilterDept) {
      return false;
    }
    if (window.__empFilterStatus !== 'all' && emp.status !== window.__empFilterStatus) {
      return false;
    }
    if (window.__empSearchQuery) {
      const q = window.__empSearchQuery.trim().toLowerCase();
      const matchName = (emp.fullName || emp.name || '').toLowerCase().includes(q);
      const matchUser = (emp.username || '').toLowerCase().includes(q);
      const matchPos = (emp.position || '').toLowerCase().includes(q);
      const matchSup = (emp.supervisor || '').toLowerCase().includes(q);
      const matchTasks = (emp.tasks || '').toLowerCase().includes(q);
      if (!matchName && !matchUser && !matchPos && !matchSup && !matchTasks) {
        return false;
      }
    }
    return true;
  });

  return `
    <div class="employees-container" style="max-width:1300px; margin:0 auto; padding:1.25rem 0 3rem; direction:rtl">
      
      <!-- Top Executive Banner -->
      <div style="background:linear-gradient(135deg, #0f172a 0%, #1e293b 100%); border-radius:16px; padding:1.5rem 1.75rem; color:#fff; margin-bottom:1.5rem; border:1px solid rgba(255,255,255,0.08); box-shadow:0 10px 25px -5px rgba(0,0,0,0.15); display:flex; flex-wrap:wrap; justify-content:space-between; align-items:center; gap:16px;">
        <div style="display:flex; align-items:center; gap:16px;">
          <div style="width:52px; height:52px; border-radius:14px; background:linear-gradient(135deg, #2563eb, #38bdf8); display:flex; align-items:center; justify-content:center; font-size:24px; box-shadow:0 4px 12px rgba(37,99,235,0.4)">
            🏢
          </div>
          <div>
            <div style="display:flex; align-items:center; gap:8px;">
              <h1 style="margin:0; font-size:1.45rem; font-weight:800; color:#fff; letter-spacing:-0.02em">الموظفون والأقسام — PROGILIC</h1>
              <span style="background:rgba(56,189,248,0.15); color:#38bdf8; border:1px solid rgba(56,189,248,0.3); font-size:11px; padding:2px 8px; border-radius:999px; font-weight:700">RBAC Security v3</span>
            </div>
            <p style="margin:4px 0 0; font-size:13px; color:#94a3b8">
              هيكلة الأقسام الأربعة، توزيع المهام والمسؤوليات، وتحديد الصلاحيات الدقيقة لكل موظف تحت إشراف المسؤول العام (Gérant).
            </p>
          </div>
        </div>

        <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
          ${isGerant ? `
            <div style="background:rgba(16,185,129,0.12); border:1px solid rgba(16,185,129,0.3); padding:6px 12px; border-radius:10px; font-size:12px; color:#10b981; font-weight:700; display:flex; align-items:center; gap:6px">
              <span>👑</span>
              <span>المسؤول العام (Gérant): ${esc(currentUser?.displayName || currentUser?.email || 'حساب المدير')}</span>
            </div>
            <button class="btn" onclick="window.openEmployeeLoginPortal()" style="font-weight:700; display:flex; align-items:center; gap:6px; background:rgba(255,255,255,0.1); color:#fff; border:1px solid rgba(255,255,255,0.2); font-size:13px">
              <span>🔑</span>
              <span>صفحة دخول الموظفين</span>
            </button>
            <button class="btn btn-primary" onclick="window.openAddEmployeeModal()" style="font-weight:700; display:flex; align-items:center; gap:6px; box-shadow:0 4px 12px rgba(37,99,235,0.3)">
              <span>＋</span>
              <span>إضافة موظف جديد</span>
            </button>
          ` : `
            <div style="background:rgba(245,158,11,0.12); border:1px solid rgba(245,158,11,0.3); padding:6px 12px; border-radius:10px; font-size:12px; color:#f59e0b; font-weight:700; display:flex; align-items:center; gap:6px">
              <span>👤</span>
              <span>حساب موظف: ${esc(currentUser?.displayName || '')} (${esc(currentUser?.position || '')})</span>
            </div>
            <button class="btn btn-ghost" onclick="window.returnToGerantMode()" style="color:#38bdf8; font-weight:700; font-size:12px">
              ↩️ عودة لحساب المدير
            </button>
          `}
        </div>
      </div>

      <!-- Section: The 4 PROGILIC Departments (from the official photo) -->
      <div style="margin-bottom:1.5rem">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
          <div>
            <h2 style="margin:0; font-size:1.15rem; font-weight:800; color:var(--t1)">الأقسام الأربعة في PROGILIC</h2>
            <p style="margin:2px 0 0; font-size:12.5px; color:var(--t3)">انقر على أي قسم لتصفية موظفيه أو مراجعة اختصاصاته</p>
          </div>
          <button class="btn btn-xs ${window.__empFilterDept === 'all' ? 'btn-primary' : 'btn-ghost'}" onclick="window.setEmpDeptFilter('all')" style="font-size:11.5px">
            عرض جميع الأقسام (${allEmployees.length})
          </button>
        </div>

        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(280px, 1fr)); gap:14px">
          ${DEPARTMENTS.map(dept => {
            const count = deptCounts[dept.id] || 0;
            const isSelected = window.__empFilterDept === dept.id;
            return `
              <div onclick="window.setEmpDeptFilter('${dept.id}')" style="background:var(--card); border:1.5px solid ${isSelected ? dept.color : 'var(--border)'}; border-radius:14px; padding:1.1rem; cursor:pointer; transition:all 0.2s ease; position:relative; box-shadow:${isSelected ? `0 6px 20px ${dept.borderSoft}` : '0 2px 6px rgba(0,0,0,0.02)'};" onmouseenter="this.style.transform='translateY(-2px)'" onmouseleave="this.style.transform='translateY(0)'">
                <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:10px; margin-bottom:8px">
                  <div style="display:flex; align-items:center; gap:8px">
                    <span style="font-size:22px; width:36px; height:36px; border-radius:10px; background:${dept.bgSoft}; display:flex; align-items:center; justify-content:center; border:1px solid ${dept.borderSoft}">
                      ${dept.icon}
                    </span>
                    <div>
                      <div style="font-size:11px; font-weight:800; color:${dept.color}; letter-spacing:0.04em">قسم ${dept.num}</div>
                      <div style="font-size:14px; font-weight:800; color:var(--t1); line-height:1.2">${dept.titleAr}</div>
                    </div>
                  </div>
                  <span style="background:${dept.bgSoft}; color:${dept.color}; font-size:11px; font-weight:700; padding:2px 8px; border-radius:999px; border:1px solid ${dept.borderSoft}">
                    ${count} ${count === 1 ? 'موظف' : 'موظفين'}
                  </span>
                </div>

                <div style="font-size:11.5px; color:${dept.color}; font-weight:600; margin-bottom:6px; direction:ltr; text-align:right">
                  ${dept.titleFr}
                </div>

                <p style="font-size:12px; color:var(--t2); margin:0 0 10px; line-height:1.45; min-height:48px;">
                  ${dept.descriptionAr}
                </p>

                <div style="border-top:1px solid var(--border); padding-top:8px; display:flex; justify-content:space-between; align-items:center; font-size:11px;">
                  <span style="color:var(--t3); font-weight:600">المسؤول الافتراضي: ${esc(String(dept.defaultSupervisor || 'المدير العام').split('(')[0].trim())}</span>
                  <span style="color:${dept.color}; font-weight:700">${isSelected ? '✓ محدد' : 'عرض الموظفين ←'}</span>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>

      <!-- Filters & Search Toolbar -->
      <div style="background:var(--card); border:1px solid var(--border); border-radius:14px; padding:0.875rem 1rem; margin-bottom:1.25rem; display:flex; flex-wrap:wrap; justify-content:space-between; align-items:center; gap:12px">
        <div style="display:flex; align-items:center; gap:10px; flex:1; min-width:260px">
          <div style="position:relative; width:100%">
            <input 
              type="text" 
              class="fctl" 
              placeholder="ابحث باسم الموظف، المنصب، اسم المستخدم، أو المسؤول المباشر..." 
              value="${esc(window.__empSearchQuery)}" 
              oninput="window.setEmpSearchQuery(this.value)"
              style="padding-right:32px; font-size:12.5px"
            />
            <span style="position:absolute; right:10px; top:50%; transform:translateY(-50%); color:var(--t3); font-size:14px">🔍</span>
          </div>
        </div>

        <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap">
          <label style="font-size:12px; color:var(--t3); font-weight:600">القسم:</label>
          <select class="fctl" style="width:auto; font-size:12px; padding:4px 8px" onchange="window.setEmpDeptFilter(this.value)">
            <option value="all" ${window.__empFilterDept === 'all' ? 'selected' : ''}>جميع الأقسام (${allEmployees.length})</option>
            ${DEPARTMENTS.map(d => `<option value="${d.id}" ${window.__empFilterDept === d.id ? 'selected' : ''}>${d.titleAr} (${deptCounts[d.id] || 0})</option>`).join('')}
          </select>

          <label style="font-size:12px; color:var(--t3); font-weight:600; margin-right:6px">الحالة:</label>
          <select class="fctl" style="width:auto; font-size:12px; padding:4px 8px" onchange="window.setEmpStatusFilter(this.value)">
            <option value="all" ${window.__empFilterStatus === 'all' ? 'selected' : ''}>الكل</option>
            <option value="نشط" ${window.__empFilterStatus === 'نشط' ? 'selected' : ''}>نشط</option>
            <option value="معطل" ${window.__empFilterStatus === 'معطل' ? 'selected' : ''}>معطل</option>
          </select>

          ${(window.__empSearchQuery || window.__empFilterDept !== 'all' || window.__empFilterStatus !== 'all') ? `
            <button class="btn btn-ghost btn-xs" onclick="window.resetEmpFilters()" style="color:var(--r); font-weight:700">
              إلغاء التصفية ✕
            </button>
          ` : ''}
        </div>
      </div>

      <!-- Employees Directory Table -->
      <div style="background:var(--card); border:1px solid var(--border); border-radius:14px; overflow:hidden; box-shadow:0 2px 10px rgba(0,0,0,0.03)">
        <div style="padding:1rem 1.25rem; border-bottom:1px solid var(--border); display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px">
          <div>
            <h3 style="margin:0; font-size:1.05rem; font-weight:800; color:var(--t1)">جدول الموظفين والصلاحيات الممنوحة</h3>
            <span style="font-size:12px; color:var(--t3)">المعروض: ${filtered.length} من إجمالي ${allEmployees.length} موظف</span>
          </div>

          <div style="display:flex; align-items:center; gap:8px; font-size:12px; color:var(--t2)">
            <span style="width:8px; height:8px; border-radius:50%; background:#10b981; display:inline-block"></span>
            <span>المدير العام يحدد ويعدل الصلاحيات في أي وقت</span>
          </div>
        </div>

        ${filtered.length === 0 ? `
          <div style="padding:3.5rem 1rem; text-align:center; color:var(--t3)">
            <div style="font-size:42px; margin-bottom:10px">👥</div>
            <div style="font-size:15px; font-weight:700; color:var(--t1)">لا يوجد موظفون يطابقون خيارات البحث</div>
            <p style="font-size:12.5px; margin:6px 0 16px">جرب تغيير كلمات البحث أو إلغاء فلتر الأقسام.</p>
            ${isGerant ? `
              <button class="btn btn-primary" onclick="window.openAddEmployeeModal()">+ إضافة موظف جديد الآن</button>
            ` : ''}
          </div>
        ` : `
          <div style="overflow-x:auto">
            <table style="width:100%; border-collapse:collapse; font-size:12.5px; text-align:right">
              <thead>
                <tr style="background:rgba(0,0,0,0.02); border-bottom:1.5px solid var(--border); color:var(--t2); font-weight:700">
                  <th style="padding:10px 14px">الموظف وبيانات الدخول</th>
                  <th style="padding:10px 14px">القسم</th>
                  <th style="padding:10px 14px">المنصب</th>
                  <th style="padding:10px 14px">المسؤول المباشر</th>
                  <th style="padding:10px 14px">المهام والمسؤوليات</th>
                  <th style="padding:10px 14px">الصلاحيات (من الـ Gérant)</th>
                  <th style="padding:10px 14px">الحالة</th>
                  <th style="padding:10px 14px; text-align:center">الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                ${filtered.map((emp, idx) => {
                  const empSafe = emp || {};
                  const rawName = empSafe.fullName || empSafe.name || empSafe.username || 'موظف';
                  const empName = typeof rawName === 'string' ? rawName : String(rawName || 'موظف');
                  const initials = empName && typeof empName.slice === 'function' && empName.length > 0 ? empName.slice(0, 2) : 'م';
                  const dept = getDepartment(empSafe.department) || DEPARTMENTS[0];
                  const perms = empSafe.permissions || {};
                  const activePermsCount = empSafe.role === 'GERANT' ? 12 : Object.values(perms).filter(Boolean).length;
                  const activeStaffId = S?.currentStaffUser?.id || (typeof currentStaffUser !== 'undefined' && currentStaffUser ? currentStaffUser.id : null);
                  const isCurrentSession = Boolean((currentUser?.isEmployee && currentUser?.employeeId === empSafe.id) || (activeStaffId && activeStaffId === empSafe.id));

                  return `
                    <tr style="border-bottom:1px solid var(--border); transition:background 0.15s ease; ${isCurrentSession ? 'background:rgba(56,189,248,0.06)' : ''}" onmouseenter="this.style.background='rgba(0,0,0,0.015)'" onmouseleave="this.style.background='${isCurrentSession ? 'rgba(56,189,248,0.06)' : 'transparent'}'">
                      <!-- Employee & Login Info -->
                      <td style="padding:12px 14px">
                        <div style="display:flex; align-items:center; gap:10px">
                          <div style="width:38px; height:38px; border-radius:10px; background:${dept.bgSoft || 'rgba(0,0,0,0.05)'}; color:${dept.color || '#2563eb'}; font-weight:800; display:flex; align-items:center; justify-content:center; font-size:15px; border:1px solid ${dept.borderSoft || 'transparent'}">
                            ${esc(initials)}
                          </div>
                          <div>
                            <div style="font-weight:800; color:var(--t1); font-size:13.5px; display:flex; align-items:center; gap:6px">
                              <span>${esc(empName)}</span>
                              ${isCurrentSession ? `<span style="background:#38bdf8; color:#fff; font-size:9.5px; padding:1px 5px; border-radius:4px; font-weight:700">أنت الآن</span>` : ''}
                            </div>
                            <div style="font-size:11px; color:var(--t3); display:flex; align-items:center; gap:6px; margin-top:2px">
                              <span style="font-family:monospace; background:rgba(0,0,0,0.04); padding:1px 4px; border-radius:4px">@${esc(empSafe.username || empSafe.id || 'emp')}</span>
                              ${empSafe.phone ? `<span>📞 ${esc(empSafe.phone)}</span>` : ''}
                            </div>
                          </div>
                        </div>
                      </td>

                      <!-- Department -->
                      <td style="padding:12px 14px">
                        <span style="display:inline-flex; align-items:center; gap:5px; background:${dept.bgSoft}; color:${dept.color}; border:1px solid ${dept.borderSoft}; padding:3px 9px; border-radius:8px; font-weight:700; font-size:11.5px">
                          <span>${dept.icon}</span>
                          <span>${dept.titleAr}</span>
                        </span>
                        <div style="font-size:10px; color:var(--t3); margin-top:2px; direction:ltr; text-align:right">
                          ${dept.titleFr}
                        </div>
                      </td>

                      <!-- Position -->
                      <td style="padding:12px 14px; font-weight:600; color:var(--t1)">
                        ${esc(empSafe.position || dept.defaultPosition || 'موظف')}
                      </td>

                      <!-- Direct Supervisor -->
                      <td style="padding:12px 14px">
                        <div style="display:flex; align-items:center; gap:6px; color:var(--t2); font-weight:600">
                          <span style="color:#2563eb">👑</span>
                          <span>${esc(empSafe.supervisor || dept.defaultSupervisor || 'المدير العام (Gérant)')}</span>
                        </div>
                      </td>

                      <!-- Tasks and Responsibilities -->
                      <td style="padding:12px 14px; max-width:240px">
                        <div style="font-size:11.5px; color:var(--t2); line-height:1.4; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;" title="${esc(empSafe.tasks || '')}">
                          ${esc(empSafe.tasks || dept.descriptionAr || '')}
                        </div>
                        <button class="btn btn-ghost btn-xs" onclick="window.viewEmployeeTasks('${empSafe.id || ''}')" style="font-size:10.5px; padding:0; color:#2563eb; font-weight:700; margin-top:2px">
                          عرض كامل المهام 🔍
                        </button>
                      </td>

                      <!-- Permissions -->
                      <td style="padding:12px 14px">
                        <div style="display:flex; align-items:center; gap:6px">
                          <span style="background:${activePermsCount >= 8 ? 'rgba(16,185,129,0.12)' : 'rgba(37,99,235,0.1)'}; color:${activePermsCount >= 8 ? '#10b981' : '#2563eb'}; border:1px solid ${activePermsCount >= 8 ? 'rgba(16,185,129,0.25)' : 'rgba(37,99,235,0.25)'}; padding:2px 8px; border-radius:6px; font-weight:700; font-size:11.5px">
                            ${activePermsCount} / 12 صلاحية
                          </span>
                          ${isGerant ? `
                            <button class="btn btn-ghost btn-xs" onclick="window.openEditPermissionsModal('${empSafe.id || ''}')" title="تعديل الصلاحيات الممنوحة" style="color:#2563eb; font-weight:700; padding:2px 6px">
                              ⚙️ ضبط
                            </button>
                          ` : ''}
                        </div>
                        <div style="display:flex; flex-wrap:wrap; gap:3px; margin-top:4px; max-width:220px">
                          ${perms.canAddClients ? `<span style="font-size:9.5px; background:rgba(0,0,0,0.04); padding:1px 4px; border-radius:3px">إضافة عملاء</span>` : ''}
                          ${perms.canManageIssues ? `<span style="font-size:9.5px; background:rgba(245,158,11,0.1); color:#d97706; padding:1px 4px; border-radius:3px">مشاكل تقنية</span>` : ''}
                          ${perms.canManagePrograms ? `<span style="font-size:9.5px; background:rgba(16,185,129,0.1); color:#059669; padding:1px 4px; border-radius:3px">رخص وبرامج</span>` : ''}
                          ${perms.canDeleteClients ? `<span style="font-size:9.5px; background:rgba(239,68,68,0.1); color:#dc2626; padding:1px 4px; border-radius:3px; font-weight:700">حذف</span>` : ''}
                        </div>
                      </td>

                      <!-- Status -->
                      <td style="padding:12px 14px">
                        <span style="display:inline-flex; align-items:center; gap:4px; font-size:11px; font-weight:700; padding:2px 7px; border-radius:999px; ${empSafe.status === 'نشط' ? 'background:rgba(16,185,129,0.12); color:#10b981; border:1px solid rgba(16,185,129,0.3)' : 'background:rgba(239,68,68,0.1); color:#ef4444; border:1px solid rgba(239,68,68,0.3)'}">
                          <span style="width:6px; height:6px; border-radius:50%; background:${empSafe.status === 'نشط' ? '#10b981' : '#ef4444'}"></span>
                          <span>${empSafe.status || 'نشط'}</span>
                        </span>
                      </td>

                      <!-- Actions -->
                      <td style="padding:12px 14px; text-align:center">
                        <div style="display:inline-flex; align-items:center; gap:4px">
                          ${isGerant ? `
                            <button class="btn btn-ghost btn-xs" onclick="window.quickImpersonateEmployee('${empSafe.id || ''}')" title="تجربة واستعراض الواجهة بصلاحيات هذا الموظف" style="color:#0284c7; padding:4px 7px">
                              🎭 تجربة
                            </button>
                            <button class="btn btn-ghost btn-xs" onclick="window.openEditEmployeeModal('${empSafe.id || ''}')" title="تعديل بيانات الموظف والمنصب" style="color:#2563eb; padding:4px 7px">
                              ✏️
                            </button>
                            <button class="btn btn-ghost btn-xs" onclick="window.openChangePasswordModal('${empSafe.id || ''}')" title="تغيير كلمة المرور" style="color:#f59e0b; padding:4px 7px">
                              🔑
                            </button>
                            <button class="btn btn-ghost btn-xs" onclick="window.confirmDeleteEmployee('${empSafe.id || ''}')" title="حذف حساب الموظف" style="color:#ef4444; padding:4px 7px">
                              🗑️
                            </button>
                          ` : `
                            <button class="btn btn-ghost btn-xs" onclick="window.viewEmployeeTasks('${empSafe.id || ''}')" style="color:#2563eb">
                              تفاصيل
                            </button>
                          `}
                        </div>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        `}
      </div>

      <!-- Informative Gérant Governance Card -->
      <div style="margin-top:1.5rem; background:rgba(37,99,235,0.04); border:1px solid rgba(37,99,235,0.15); border-radius:14px; padding:1.25rem; display:flex; align-items:center; gap:14px">
        <div style="font-size:28px">🛡️</div>
        <div>
          <h4 style="margin:0 0 3px; font-size:13.5px; font-weight:800; color:var(--t1)">سياسة الحوكمة والتحكم في الصلاحيات</h4>
          <p style="margin:0; font-size:12px; color:var(--t2); line-height:1.5">
            تطبيق مبدأ أقل الصلاحيات المطلوبة (Least Privilege Principle). فقط المسؤول العام <strong>(Gérant)</strong> يملك صلاحية منح أو سحب الصلاحيات الحساسة كحذف العملاء وتصدير البيانات وإدارة فريق العمل، بينما يركز كل موظف على مهامه وفق قسمه المحدد في PROGILIC.
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

window.confirmDeleteEmployee = async function(empId) {
  const emp = getEmployeeById(empId);
  if (!emp) return;
  const empName = emp.fullName || emp.name || 'الموظف';
  const ok = await showConfirm(`هل أنت متأكد من حذف حساب الموظف "${empName}" (${emp.position || ''})؟ لن يتمكن من تسجيل الدخول بعد الآن.`, "حذف حساب الموظف");
  if (ok) {
    deleteEmployee(empId);
    showToast(`تم حذف حساب الموظف "${empName}" بنجاح.`, "success");
    R();
  }
};

window.openEmployeeLoginPortal = function() {
  window.loginMode = 'employeePortal';
  import('../state/store.js').then(m => {
    m.setCurrentUser(null);
    R();
  });
};

window.quickImpersonateEmployee = function(empId) {
  const emp = getEmployeeById(empId);
  if (!emp) return;
  loginAsEmployeeSession(emp);
  const empName = emp.fullName || emp.name || 'الموظف';
  showToast(`تم التبديل لتجربة الواجهة بصلاحيات: ${empName} (${getDepartment(emp.department).titleAr})`, "info", 5000);
  R();
};

window.returnToGerantMode = function() {
  localStorage.removeItem('crm_active_employee_session');
  localStorage.removeItem('crm_logged_out');
  
  // Revert back to the saved Gérant user or default Gérant session
  let savedGerant = null;
  try {
    const raw = localStorage.getItem('crm_active_gerant_user');
    if (raw) savedGerant = JSON.parse(raw);
  } catch (e) {}

  const restoredUser = savedGerant || {
    uid: (auth && auth.currentUser && auth.currentUser.uid) || 'z1FY0kWqOOSe78cFv8rqak0mjV03',
    email: 'admin@progilic.dz',
    displayName: 'المسؤول العام (Gérant)',
    emailVerified: true,
    isEmployee: false,
    role: 'gerant'
  };

  import('../state/store.js').then(m => {
    m.setCurrentUser(restoredUser);
    showToast(`تمت العودة بنجاح إلى حساب المسؤول العام (Gérant): ${restoredUser.displayName || restoredUser.email}. كامل الصلاحيات مفعلة.`, "success");
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
      <div class="mtitle">${isEdit ? 'تعديل بيانات الموظف والمنصب' : 'إضافة موظف جديد وتحديد المسؤوليات'}</div>
      <button class="mclose" onclick="closeModal()">×</button>
    </div>

    <form onsubmit="window.handleSaveEmployee(event)">
      <div class="frow">
        <div class="fgroup">
          <label class="flbl">اسم الموظف الكامل *</label>
          <input class="fctl" id="emp_fullName" required value="${esc(emp.fullName || emp.name || '')}" placeholder="مثال: سليم بن علي">
        </div>
        <div class="fgroup">
          <label class="flbl">اسم المستخدم (لتسجيل الدخول) *</label>
          <input class="fctl" id="emp_username" dir="ltr" required value="${esc(emp.username || '')}" placeholder="مثال: salim.benali">
        </div>
      </div>

      <div class="frow">
        <div class="fgroup">
          <label class="flbl">القسم التابع له (من الأقسام الأربعة) *</label>
          <select class="fctl" id="emp_department" onchange="window.onEmployeeDeptChanged(this.value)">
            ${DEPARTMENTS.map(d => `
              <option value="${d.id}" ${selectedDeptId === d.id ? 'selected' : ''}>
                ${d.num}. ${d.titleAr} (${d.titleFr})
              </option>
            `).join('')}
          </select>
        </div>
        <div class="fgroup">
          <label class="flbl">منصبه / المسمى الوظيفي *</label>
          <input class="fctl" id="emp_position" required value="${esc(emp.position || dept.defaultPosition)}" placeholder="مثال: مسؤول عروض وشروحات ما قبل البيع">
        </div>
      </div>

      <div class="frow">
        <div class="fgroup">
          <label class="flbl">المسؤول المباشر *</label>
          <input class="fctl" id="emp_supervisor" required value="${esc(emp.supervisor || 'المدير العام (Gérant)')}">
        </div>
        <div class="fgroup">
          <label class="flbl">${isEdit ? 'كلمة المرور (اتركها فارغة للإبقاء على الحالية)' : 'كلمة المرور الابتدائية *'}</label>
          <input class="fctl" id="emp_password" type="text" dir="ltr" ${isEdit ? '' : 'required'} value="" placeholder="كلمة المرور للدخول">
        </div>
      </div>

      <div class="frow">
        <div class="fgroup">
          <label class="flbl">رقم الهاتف (اختياري)</label>
          <input class="fctl" id="emp_phone" dir="ltr" value="${esc(emp.phone || '')}" placeholder="0550...">
        </div>
        <div class="fgroup">
          <label class="flbl">البريد الإلكتروني (اختياري)</label>
          <input class="fctl" id="emp_email" type="email" dir="ltr" value="${esc(emp.email || '')}" placeholder="employee@progilic.dz">
        </div>
      </div>

      <div class="fgroup" style="margin-top:10px">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px">
          <label class="flbl" style="margin:0">المهام والمسؤوليات الموكلة للموظف *</label>
          <button type="button" class="btn btn-ghost btn-xs" onclick="window.loadDeptPresetTasks()" style="color:#2563eb; font-size:11px; padding:0">
            ↺ تحميل مهام القسم الافتراضية
          </button>
        </div>
        <textarea class="fctl" id="emp_tasks" rows="3" required placeholder="تفاصيل المهام والمسؤوليات الموكلة لهذا الموظف...">${esc(emp.tasks || dept.responsibilities.join(' • '))}</textarea>
      </div>

      <div class="frow" style="margin-top:10px">
        <div class="fgroup">
          <label class="flbl">حالة الحساب</label>
          <select class="fctl" id="emp_status">
            <option value="نشط" ${emp.status !== 'معطل' ? 'selected' : ''}>نشط (يمكنه تسجيل الدخول)</option>
            <option value="معطل" ${emp.status === 'معطل' ? 'selected' : ''}>معطل (موقوف مؤقتاً)</option>
          </select>
        </div>
      </div>

      <!-- Action Footer -->
      <div style="margin-top:1.5rem; display:flex; justify-content:flex-end; gap:10px; border-top:1px solid var(--border); padding-top:1rem">
        <button type="button" class="btn btn-ghost" onclick="closeModal()">إلغاء</button>
        <button type="submit" class="btn btn-primary" style="font-weight:700">
          ${isEdit ? 'حفظ التعديلات' : 'إنشاء حساب الموظف'}
        </button>
      </div>
    </form>
  `;
}

/**
 * Department change handler in Employee Form
 */
window.onEmployeeDeptChanged = function(deptId) {
  const d = getDepartment(deptId);
  const posInput = document.getElementById('emp_position');
  const tasksInput = document.getElementById('emp_tasks');
  if (posInput) posInput.value = d.defaultPosition;
  if (tasksInput) tasksInput.value = d.responsibilities.join(' • ');
};

window.loadDeptPresetTasks = function() {
  const deptSelect = document.getElementById('emp_department');
  const tasksInput = document.getElementById('emp_tasks');
  if (deptSelect && tasksInput) {
    const d = getDepartment(deptSelect.value);
    tasksInput.value = d.responsibilities.join(' • ');
    showToast("تم تحميل مهام القسم الافتراضية.", "info");
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
    showToast("يرجى إدخال اسم الموظف واسم المستخدم.", "error");
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
    showToast("يرجى تحديد كلمة مرور للموظف الجديد.", "error");
    return;
  }
  if (passwordVal) {
    payload.password = passwordVal;
  }

  // If new employee, apply department default permissions
  if (!isEdit) {
    payload.permissions = { ...getDepartment(department).defaultPermissions };
  }

  upsertEmployee(payload);
  showToast(isEdit ? "تم تحديث بيانات الموظف بنجاح." : "تم إنشاء حساب الموظف بنجاح.", "success");
  closeModal();
  R();
};

/**
 * Modal to Edit Permissions (Strictly Gérant)
 */
export function renderEditPermissionsModal() {
  const emp = getEmployeeById(window.__permTargetEmpId);
  if (!emp) return '<div class="mhdr"><div class="mtitle">خطأ</div></div><p>لم يتم العثور على الموظف.</p>';

  const dept = getDepartment(emp.department);
  const currentPerms = emp.permissions || {};

  // Group permissions
  const groups = {};
  PERMISSION_DEFINITIONS.forEach(def => {
    if (!groups[def.group]) groups[def.group] = [];
    groups[def.group].push(def);
  });

  return `
    <div class="mhdr">
      <div>
        <div class="mtitle">تحديد وضبط الصلاحيات — ${esc(emp.fullName || emp.name || '')}</div>
        <div style="font-size:12px; color:var(--t3); margin-top:2px">
          القسم: <strong style="color:${dept.color}">${dept.titleAr}</strong> • المنصب: <strong>${esc(emp.position)}</strong>
        </div>
      </div>
      <button class="mclose" onclick="closeModal()">×</button>
    </div>

    <div style="background:rgba(37,99,235,0.06); border:1px solid rgba(37,99,235,0.2); border-radius:10px; padding:10px 14px; margin-bottom:1rem; font-size:12px; color:var(--t2); display:flex; justify-content:space-between; align-items:center">
      <span>👑 هذه الصلاحيات يتحكم بها المسؤول العام (Gérant) حصرياً.</span>
      <div style="display:flex; gap:6px">
        <button class="btn btn-ghost btn-xs" onclick="window.applyDeptDefaultPerms('${emp.department}')" style="color:#2563eb; font-weight:700">
          استعادة صلاحيات القسم الافتراضية
        </button>
        <button class="btn btn-ghost btn-xs" onclick="window.selectAllPerms(true)" style="color:#10b981; font-weight:700">
          تحديد الكل
        </button>
      </div>
    </div>

    <form onsubmit="window.handleSavePermissions(event)">
      <div style="display:flex; flex-direction:column; gap:14px; max-height:420px; overflow-y:auto; padding-left:4px">
        ${Object.keys(groups).map(grpName => `
          <div style="border:1px solid var(--border); border-radius:10px; padding:10px 12px; background:var(--card)">
            <div style="font-size:12px; font-weight:800; color:var(--t1); margin-bottom:8px; border-bottom:1px solid var(--border); padding-bottom:4px">
              📁 ${grpName}
            </div>
            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(260px, 1fr)); gap:8px">
              ${groups[grpName].map(def => {
                const isChecked = Boolean(currentPerms[def.key]);
                return `
                  <label style="display:flex; align-items:flex-start; gap:8px; cursor:pointer; font-size:12px; padding:4px 6px; border-radius:6px; transition:background 0.15s" onmouseenter="this.style.background='rgba(0,0,0,0.02)'" onmouseleave="this.style.background='transparent'">
                    <input 
                      type="checkbox" 
                      id="perm_${def.key}" 
                      ${isChecked ? 'checked' : ''} 
                      style="margin-top:3px; cursor:pointer"
                    />
                    <div>
                      <div style="font-weight:700; color:var(--t1)">${def.label}</div>
                      <div style="font-size:11px; color:var(--t3)">${def.desc}</div>
                    </div>
                  </label>
                `;
              }).join('')}
            </div>
          </div>
        `).join('')}
      </div>

      <div style="margin-top:1.25rem; display:flex; justify-content:flex-end; gap:10px; border-top:1px solid var(--border); padding-top:1rem">
        <button type="button" class="btn btn-ghost" onclick="closeModal()">إلغاء</button>
        <button type="submit" class="btn btn-primary" style="font-weight:700">
          حفظ وتطبيق الصلاحيات
        </button>
      </div>
    </form>
  `;
}

window.applyDeptDefaultPerms = function(deptId) {
  const d = getDepartment(deptId);
  PERMISSION_DEFINITIONS.forEach(def => {
    const el = document.getElementById(`perm_${def.key}`);
    if (el) {
      el.checked = Boolean(d.defaultPermissions[def.key]);
    }
  });
  showToast("تم تطبيق الصلاحيات الافتراضية لقسم " + d.titleAr, "info");
};

window.selectAllPerms = function(enableAll = true) {
  PERMISSION_DEFINITIONS.forEach(def => {
    const el = document.getElementById(`perm_${def.key}`);
    if (el) {
      el.checked = enableAll;
    }
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
  showToast("تم حفظ الصلاحيات المحدثة للموظف بنجاح.", "success");
  closeModal();
  R();
};

/**
 * Modal to Change Employee Password
 */
export function renderChangePasswordModal() {
  const emp = getEmployeeById(window.__passwordTargetEmpId);
  if (!emp) return '<div class="mhdr"><div class="mtitle">خطأ</div></div><p>لم يتم العثور على الموظف.</p>';

  return `
    <div class="mhdr">
      <div class="mtitle">تغيير كلمة المرور — ${esc(emp.fullName || emp.name || '')}</div>
      <button class="mclose" onclick="closeModal()">×</button>
    </div>

    <form onsubmit="window.handleSavePassword(event)">
      <p style="font-size:12.5px; color:var(--t2); margin:0 0 1rem">
        بصفتك المسؤول العام (Gérant)، يمكنك تعيين كلمة مرور جديدة للموظف <strong>${esc(emp.fullName || emp.name || '')}</strong> (اسم المستخدم: <code>${esc(emp.username)}</code>).
      </p>

      <div class="fgroup">
        <label class="flbl">كلمة المرور الجديدة *</label>
        <input class="fctl" type="text" id="new_emp_pwd" required dir="ltr" placeholder="أدخل كلمة مرور جديدة...">
      </div>

      <div style="margin-top:1.25rem; display:flex; justify-content:flex-end; gap:10px; border-top:1px solid var(--border); padding-top:1rem">
        <button type="button" class="btn btn-ghost" onclick="closeModal()">إلغاء</button>
        <button type="submit" class="btn btn-primary" style="font-weight:700">
          تحديث كلمة المرور
        </button>
      </div>
    </form>
  `;
}

window.handleSavePassword = function(e) {
  e.preventDefault();
  const newPwd = document.getElementById('new_emp_pwd')?.value.trim();
  if (!newPwd || newPwd.length < 4) {
    showToast("يرجى إدخال كلمة مرور من 4 أحرف على الأقل.", "error");
    return;
  }
  updateEmployeePassword(window.__passwordTargetEmpId, newPwd);
  showToast("تم تحديث كلمة المرور للموظف بنجاح.", "success");
  closeModal();
  R();
};

/**
 * Modal to View Employee Tasks and Details
 */
export function renderViewEmployeeTasksModal() {
  const emp = getEmployeeById(window.__viewingEmpId);
  if (!emp) return '<div class="mhdr"><div class="mtitle">خطأ</div></div><p>لم يتم العثور على الموظف.</p>';
  const dept = getDepartment(emp.department);

  return `
    <div class="mhdr">
      <div>
        <div class="mtitle">بطاقة الموظف والمسؤوليات — ${esc(emp.fullName || emp.name || '')}</div>
        <div style="font-size:12px; color:${dept.color}; font-weight:700; margin-top:2px">
          ${dept.icon} ${dept.titleAr} (${dept.titleFr})
        </div>
      </div>
      <button class="mclose" onclick="closeModal()">×</button>
    </div>

    <div style="display:flex; flex-direction:column; gap:14px; font-size:13px">
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; background:rgba(0,0,0,0.02); padding:10px 12px; border-radius:10px">
        <div><strong>المنصب:</strong> ${esc(emp.position)}</div>
        <div><strong>المسؤول المباشر:</strong> ${esc(emp.supervisor)}</div>
        <div><strong>اسم المستخدم:</strong> @${esc(emp.username)}</div>
        <div><strong>الهاتف:</strong> ${esc(emp.phone || 'غير مسجل')}</div>
      </div>

      <div>
        <h4 style="margin:0 0 6px; font-size:13px; font-weight:800; color:var(--t1)">المهام والمسؤوليات التفصيلية:</h4>
        <div style="background:var(--card); border:1px solid var(--border); border-radius:10px; padding:12px; line-height:1.6; color:var(--t2); white-space:pre-line">
          ${esc(emp.tasks || dept.descriptionAr)}
        </div>
      </div>

      <div>
        <h4 style="margin:0 0 6px; font-size:13px; font-weight:800; color:var(--t1)">اختصاصات قسم ${dept.titleAr} في PROGILIC:</h4>
        <ul style="margin:0; padding-right:18px; color:var(--t2); font-size:12.5px; line-height:1.5">
          ${(dept.responsibilities || []).map(r => `<li>${esc(r)}</li>`).join('')}
        </ul>
      </div>

      <div style="display:flex; justify-content:flex-end; margin-top:10px">
        <button class="btn btn-primary" onclick="closeModal()">إغلاق</button>
      </div>
    </div>
  `;
}
