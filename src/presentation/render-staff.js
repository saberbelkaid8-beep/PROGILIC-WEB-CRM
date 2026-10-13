import { S, staffUsers, currentStaffUser, isGerant, hasPermission } from '../state/store.js';
import { DEPARTMENTS, ALL_PERMISSIONS } from '../constants/index.js';
import { esc } from '../utils/index.js';
import { t } from '../utils/i18n.js';

export function renderStaffLogin() {
  const staffList = staffUsers || [];
  
  // Group staff by department
  const byDept = {};
  byDept['الإدارة العليا'] = [];
  DEPARTMENTS.forEach(d => { byDept[d.name] = []; });
  
  staffList.forEach(s => {
    const dept = s.department || 'القسم التقني';
    if (!byDept[dept]) byDept[dept] = [];
    byDept[dept].push(s);
  });

  const currentUserEmail = S.currentUser ? S.currentUser.email : '';

  return `
    <div style="min-height:100vh; background:linear-gradient(135deg, #090e1a 0%, #0f172a 50%, #1e293b 100%); display:flex; flex-direction:column; align-items:center; justify-content:center; padding:24px; direction:rtl; font-family:system-ui, -apple-system, sans-serif; color:#f8fafc;">
      <div style="max-width:1050px; width:100%; background:rgba(30, 41, 59, 0.85); backdrop-filter:blur(20px); border:1px solid rgba(255,255,255,0.12); border-radius:24px; padding:32px; box-shadow:0 30px 60px -15px rgba(0,0,0,0.65);">
        
        <!-- Header Section -->
        <div style="display:flex; flex-wrap:wrap; justify-content:space-between; align-items:center; gap:16px; margin-bottom:24px; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:20px;">
          <div>
            <div style="display:inline-block; font-size:11px; font-weight:800; background:rgba(56,189,248,0.15); color:#38bdf8; border:1px solid rgba(56,189,248,0.3); border-radius:20px; padding:3px 12px; margin-bottom:6px; letter-spacing:0.5px;">PROGILIC CRM • PORTAIL DES EMPLOYÉS</div>
            <h1 style="font-size:24px; font-weight:800; color:#ffffff; margin:0 0 6px 0;">بوابة تسجيل دخول الموظفين والأقسام</h1>
            <p style="font-size:13px; color:#94a3b8; margin:0;">
              الحساب المسجل: <strong style="color:#38bdf8;">${esc(currentUserEmail || 'المسؤول')}</strong>
            </p>
          </div>
          <div style="display:flex; gap:10px; align-items:center;">
            <button class="btn btn-primary" onclick="openModal('editStaffMember', {})" style="background:linear-gradient(90deg, #0076ff 0%, #1e5ef7 100%); border:none; padding:10px 18px; border-radius:12px; font-weight:700; font-size:13px; box-shadow:0 6px 20px rgba(30,96,242,0.4); cursor:pointer;">
              ＋ إضافة موظف جديد
            </button>
            <button class="btn btn-outline" onclick="toggleStaffManagerModal(true)" style="border:1px solid rgba(56,189,248,0.4); color:#38bdf8; padding:10px 16px; border-radius:12px; font-weight:700; font-size:13px; background:rgba(56,189,248,0.08); cursor:pointer;">
              ⚙️ إدارة الصلاحيات
            </button>
            <button class="btn btn-ghost" onclick="logout()" style="color:#ef4444; border:1px solid rgba(239,68,68,0.3); padding:10px 16px; border-radius:12px; font-size:13px; font-weight:700; cursor:pointer;" title="تسجيل الخروج والعودة لصفحة التسجيل">
              🚪 تسجيل الخروج
            </button>
          </div>
        </div>

        <div style="background:rgba(15,23,42,0.5); border:1px solid rgba(255,255,255,0.06); border-radius:14px; padding:14px 18px; margin-bottom:24px; display:flex; justify-content:space-between; align-items:center;">
          <p style="font-size:13.5px; color:#cbd5e1; margin:0; line-height:1.6;">
            اختر حسابك وأدخل كلمة المرور الصحيحة للمتابعة. يتحكم المسؤول العام (<strong>GERANT</strong>) في إضافة موظفي الشركة وضبط الصلاحيات المتاحة لكل موظف.
          </p>
          <span style="font-size:12px; color:#94a3b8; background:rgba(255,255,255,0.05); padding:4px 10px; border-radius:8px;">عزل تام للبيانات</span>
        </div>

        <!-- 4 Departments Grid -->
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(290px, 1fr)); gap:20px; max-height:65vh; overflow-y:auto; padding:4px;">
          ${Object.entries(byDept).map(([deptName, members]) => {
            if (!members || members.length === 0) return '';
            let deptIcon = '📁';
            let deptColor = '#38bdf8';
            if (deptName === 'القسم التقني') { deptIcon = '💻'; deptColor = '#f59e0b'; }
            else if (deptName === 'قسم التجاري') { deptIcon = '💼'; deptColor = '#10b981'; }
            else if (deptName === 'قسم المتابعة') { deptIcon = '📈'; deptColor = '#8b5cf6'; }
            else if (deptName === 'قسم ما بعد البيع') { deptIcon = '🎧'; deptColor = '#ec4899'; }
            else if (deptName === 'الإدارة العليا') { deptIcon = '👑'; deptColor = '#38bdf8'; }

            return `
              <div style="background:rgba(15, 23, 42, 0.65); border:1px solid rgba(255,255,255,0.08); border-radius:16px; padding:18px; display:flex; flex-direction:column; gap:12px;">
                <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid rgba(255,255,255,0.06); padding-bottom:10px;">
                  <h3 style="font-size:15.5px; font-weight:800; color:${deptColor}; margin:0; display:flex; align-items:center; gap:8px;">
                    <span>${deptIcon}</span> <span>${esc(deptName)}</span>
                  </h3>
                  <span style="font-size:11.5px; background:rgba(255,255,255,0.06); color:#cbd5e1; padding:2px 8px; border-radius:10px;">${members.length} موظف</span>
                </div>

                <div style="display:flex; flex-direction:column; gap:12px;">
                  ${members.map(m => {
                    const permCount = m.role === 'GERANT' ? ALL_PERMISSIONS.length : Object.values(m.permissions || {}).filter(Boolean).length;
                    return `
                      <div style="background:rgba(255,255,255,0.035); border:1px solid rgba(255,255,255,0.06); border-radius:12px; padding:14px; transition:border 0.2s;">
                        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:6px;">
                          <div>
                            <div style="font-weight:700; font-size:14.5px; color:#f8fafc;">${esc(m.name)}</div>
                            <div style="font-size:12px; color:${deptColor}; font-weight:600;">${esc(m.position)}</div>
                          </div>
                          <span style="font-size:10.5px; background:rgba(56,189,248,0.12); color:#38bdf8; border:1px solid rgba(56,189,248,0.2); padding:2px 6px; border-radius:6px;">
                            ${m.role === 'GERANT' ? 'مسؤول أعلى' : `${permCount} صلاحية`}
                          </span>
                        </div>

                        <div style="font-size:11.5px; color:#94a3b8; margin-bottom:4px;">
                          <strong>المسؤول المباشر:</strong> ${esc(m.supervisor || 'المدير العام')}
                        </div>

                        ${m.tasks ? `
                          <div style="font-size:11px; color:#64748b; line-height:1.4; margin-bottom:10px; max-height:40px; overflow:hidden; text-overflow:ellipsis;">
                            ${esc(m.tasks)}
                          </div>
                        ` : ''}

                        <div style="display:flex; gap:8px; margin-top:8px;">
                          <input 
                            type="password" 
                            id="staff-pwd-${m.id}" 
                            placeholder="كلمة المرور..." 
                            value=""
                            autocomplete="current-password"
                            onkeydown="if(event.key==='Enter') loginStaff('${m.id}', this.value)"
                            style="flex:1; background:rgba(0,0,0,0.35); border:1px solid rgba(255,255,255,0.12); border-radius:8px; padding:8px 10px; font-size:12px; color:#fff;" 
                          />
                          <button 
                            onclick="loginStaff('${m.id}', document.getElementById('staff-pwd-${m.id}').value)" 
                            style="background:#2563eb; color:#fff; border:none; padding:8px 16px; border-radius:8px; font-size:12.5px; font-weight:700; cursor:pointer; transition:background 0.2s;"
                            onmouseover="this.style.background='#1d4ed8'"
                            onmouseout="this.style.background='#2563eb'"
                          >
                            دخول
                          </button>
                        </div>
                      </div>
                    `;
                  }).join('')}
                </div>
              </div>
            `;
          }).join('')}
          ${staffList.length === 1 ? `
            <div style="background:rgba(15, 23, 42, 0.4); border:1px dashed rgba(255,255,255,0.15); border-radius:16px; padding:24px; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; gap:12px;">
              <span style="font-size:32px;">👥</span>
              <h4 style="margin:0; font-size:15px; color:#f8fafc; font-weight:700;">لا يوجد موظفون آخرون منشأون مسبقاً</h4>
              <p style="margin:0; font-size:12.5px; color:#94a3b8; max-width:280px; line-height:1.5;">
                أنت الآن مسجل كمسؤول عام (Gérant). يمكنك إنشاء موظفي شركتك وأقسامهم وتحديد كلمات مرورهم وصلاحياتهم في أي وقت.
              </p>
              <button class="btn btn-outline btn-sm" onclick="openModal('editStaffMember', {})" style="border:1px solid rgba(56,189,248,0.4); color:#38bdf8;">
                ＋ إنشاء موظف جديد الآن
              </button>
            </div>
          ` : ''}
        </div>

      </div>
    </div>
  `;
}

export function renderStaffManagerModal() {
  if (!S.showStaffManager) return '';
  const staffList = staffUsers || [];

  return `
    <div style="position:fixed; inset:0; z-index:9999; background:rgba(0,0,0,0.75); backdrop-filter:blur(6px); display:flex; align-items:center; justify-content:center; padding:16px; direction:rtl;">
      <div style="background:var(--card, #ffffff); color:var(--t1, #0f172a); width:100%; max-width:1150px; max-height:92vh; border-radius:20px; overflow:hidden; display:flex; flex-direction:column; box-shadow:0 25px 60px -15px rgba(0,0,0,0.35); border:1px solid var(--border, #e2e8f0);">
        
        <!-- Modal Header -->
        <div style="padding:20px 24px; border-bottom:1px solid var(--border, #e2e8f0); display:flex; justify-content:space-between; align-items:center; background:var(--bg2, #f8fafc);">
          <div>
            <h2 style="font-size:18px; font-weight:800; margin:0 0 4px 0; color:var(--t1);">👥 إدارة الموظفين والأقسام والصلاحيات (GERANT)</h2>
            <p style="font-size:13px; color:var(--t2, #64748b); margin:0;">
              التحكم الكامل في بيانات الموظفين، المنصب، القسم، المسؤول المباشر، المهام، والصلاحيات الـ 65+
            </p>
          </div>
          <div style="display:flex; gap:10px;">
            <button class="btn btn-primary btn-sm" onclick="openModal('editStaffMember', {})">+ إضافة موظف جديد</button>
            <button class="btn btn-ghost btn-sm" onclick="toggleStaffManagerModal(false)">✕ إغلاق</button>
          </div>
        </div>

        <!-- Staff Table / List -->
        <div style="flex:1; overflow-y:auto; padding:24px;">
          <div style="display:flex; flex-direction:column; gap:20px;">
            ${staffList.map(st => `
              <div style="border:1px solid var(--border, #e2e8f0); border-radius:14px; padding:18px; background:var(--bg1, #ffffff); box-shadow:0 2px 5px rgba(0,0,0,0.03);">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:12px; border-bottom:1px solid var(--border, #e2e8f0); padding-bottom:12px;">
                  <div>
                    <h3 style="font-size:16px; font-weight:700; margin:0 0 4px 0; color:var(--t1);">
                      ${esc(st.name)} 
                      <span style="font-size:12px; background:#e0f2fe; color:#0369a1; padding:2px 8px; border-radius:6px; margin-right:8px;">${esc(st.department)}</span>
                      ${st.role === 'GERANT' ? '<span style="font-size:11px; background:#fef3c7; color:#b45309; padding:2px 8px; border-radius:6px; margin-right:4px;">مسؤول عام</span>' : ''}
                    </h3>
                    <p style="font-size:13px; color:var(--t2); margin:0 0 4px 0;">
                      <strong>المنصب:</strong> ${esc(st.position)} | 
                      <strong>المسؤول المباشر:</strong> ${esc(st.supervisor || 'المدير العام')}
                    </p>
                    <p style="font-size:12.5px; color:var(--t2); margin:0;">
                      <strong>المهام والمسؤوليات:</strong> ${esc(st.tasks || 'غير محددة')}
                    </p>
                  </div>
                  <div style="display:flex; gap:8px;">
                    <button class="btn btn-outline btn-xs" onclick="openModal('editStaffMember', ${JSON.stringify(st).replace(/"/g, '&quot;')})">✏️ تعديل</button>
                    <button class="btn btn-outline btn-xs" onclick="grantAllStaffPermissions('${st.id}', true)">منح الكل</button>
                    <button class="btn btn-outline btn-xs" onclick="grantAllStaffPermissions('${st.id}', false)">إلغاء الكل</button>
                    ${st.role !== 'GERANT' ? `<button class="btn btn-ghost btn-xs" style="color:var(--r, #ef4444)" onclick="deleteStaffMember('${st.id}')">🗑️ حذف</button>` : ''}
                  </div>
                </div>

                <!-- Permissions Checklist -->
                <div>
                  <h4 style="font-size:13px; font-weight:700; margin:0 0 8px 0; color:var(--t2);">
                    الصلاحيات الممنوحة (${st.role === 'GERANT' ? ALL_PERMISSIONS.length : Object.values(st.permissions || {}).filter(Boolean).length} / ${ALL_PERMISSIONS.length}):
                  </h4>
                  <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(210px, 1fr)); gap:6px; max-height:160px; overflow-y:auto; padding:10px; background:var(--bg2, #f8fafc); border-radius:10px; border:1px solid var(--border);">
                    ${ALL_PERMISSIONS.map(p => {
                      const checked = st.role === 'GERANT' || !!(st.permissions && st.permissions[p]);
                      return `
                        <label style="display:flex; align-items:center; gap:6px; font-size:11.5px; cursor:pointer; color:var(--t1);">
                          <input type="checkbox" ${checked ? 'checked' : ''} ${st.role === 'GERANT' ? 'disabled' : ''} onchange="toggleStaffPermission('${st.id}', '${p}')" />
                          <span style="font-family:monospace; direction:ltr;">${p}</span>
                        </label>
                      `;
                    }).join('')}
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>

      </div>
    </div>
  `;
}
