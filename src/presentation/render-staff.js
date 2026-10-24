import { S, staffUsers, currentStaffUser, setCurrentStaffUser, isGerant, hasPermission } from '../state/store.js';
import { DEPARTMENTS, ALL_PERMISSIONS, PERMISSION_GROUPS } from '../constants/index.js';
import { esc } from '../utils/index.js';
import { t } from '../utils/i18n.js';

export function renderStaffLogin() {
  const staffList = staffUsers || [];
  const currentUserEmail = S.currentUser ? S.currentUser.email : '';

  return `
    <div style="min-height:100vh; background:linear-gradient(135deg, #090e1a 0%, #0f172a 50%, #1e293b 100%); display:flex; flex-direction:column; align-items:center; justify-content:center; padding:24px; direction:rtl; font-family:system-ui, -apple-system, sans-serif; color:#f8fafc;">
      <div style="max-width:1050px; width:100%; background:rgba(30, 41, 59, 0.85); backdrop-filter:blur(20px); border:1px solid rgba(255,255,255,0.12); border-radius:24px; padding:32px; box-shadow:0 30px 60px -15px rgba(0,0,0,0.65);">
        
        <!-- Header Section -->
        <div style="display:flex; flex-wrap:wrap; justify-content:space-between; align-items:center; gap:16px; margin-bottom:24px; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:20px;">
          <div>
            <div style="display:inline-block; font-size:11px; font-weight:800; background:rgba(56,189,248,0.15); color:#38bdf8; border:1px solid rgba(56,189,248,0.3); border-radius:20px; padding:3px 12px; margin-bottom:6px; letter-spacing:0.5px;">PROGILIC CRM • USER ACCESS PORTAL</div>
            <h1 style="font-size:24px; font-weight:800; color:#ffffff; margin:0 0 6px 0;">👥 بوابة تسجيل دخول المستخدمين</h1>
            <p style="font-size:13px; color:#94a3b8; margin:0;">
              الحساب المسجل: <strong style="color:#38bdf8;">${esc(currentUserEmail || 'المسؤول')}</strong>
            </p>
          </div>
          <div style="display:flex; gap:10px; align-items:center;">
            <button class="btn btn-primary" onclick="window.focusGerantLogin()" style="background:linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color:#fff; border:none; padding:10px 18px; border-radius:12px; font-size:13px; font-weight:800; cursor:pointer; display:flex; align-items:center; gap:6px; box-shadow:0 4px 14px rgba(245,158,11,0.4);" title="التركيز على حساب الرئيس لإدخال كلمة المرور">
              👑 حساب الرئيس (كلمة المرور مطلوبة)
            </button>
            <button class="btn btn-ghost" onclick="logout()" style="color:#ef4444; border:1px solid rgba(239,68,68,0.3); padding:10px 16px; border-radius:12px; font-size:13px; font-weight:700; cursor:pointer;" title="تسجيل الخروج والعودة لصفحة التسجيل">
              🚪 تسجيل الخروج
            </button>
          </div>
        </div>

        <div style="background:rgba(15,23,42,0.5); border:1px solid rgba(255,255,255,0.06); border-radius:14px; padding:14px 18px; margin-bottom:24px; display:flex; justify-content:space-between; align-items:center;">
          <p style="font-size:13.5px; color:#cbd5e1; margin:0; line-height:1.6;">
            اختر حساب المستخدم وأدخل كلمة المرور الصحيحة للمتابعة. يتحكم الرئيس (<strong>GERANT</strong>) في تحديد وتوزيع الصلاحيات على المستخدمين.
          </p>
          <span style="font-size:12px; color:#38bdf8; background:rgba(56,189,248,0.1); border:1px solid rgba(56,189,248,0.2); padding:4px 10px; border-radius:8px; font-weight:700;">
            ${staffList.length} مستخدم مسجل
          </span>
        </div>

        <!-- Users Grid List -->
        <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(300px, 1fr)); gap:18px; max-height:65vh; overflow-y:auto; padding:4px;">
          ${staffList.map(m => {
            const isG = m.role === 'GERANT';
            const permCount = isG ? ALL_PERMISSIONS.length : Object.values(m.permissions || {}).filter(Boolean).length;
            
            return `
              <div style="background:rgba(15, 23, 42, 0.65); border:1px solid ${isG ? 'rgba(245,158,11,0.3)' : 'rgba(255,255,255,0.08)'}; border-radius:16px; padding:18px; display:flex; flex-direction:column; gap:12px; box-shadow:0 4px 12px rgba(0,0,0,0.2);">
                <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                  <div style="display:flex; align-items:center; gap:10px;">
                    <div style="width:42px; height:42px; border-radius:12px; background:${isG ? 'linear-gradient(135deg, #f59e0b, #d97706)' : 'linear-gradient(135deg, #3b82f6, #1d4ed8)'}; color:#fff; display:flex; align-items:center; justify-content:center; font-size:18px; font-weight:800;">
                      ${isG ? '👑' : '👤'}
                    </div>
                    <div>
                      <div style="font-weight:800; font-size:15px; color:#f8fafc;">${esc(m.name || m.fullName)}</div>
                      <div style="font-size:12px; color:#94a3b8; font-weight:600;">${esc(m.position || 'مستخدم')}</div>
                    </div>
                  </div>
                  <span style="font-size:10.5px; background:${isG ? 'rgba(245,158,11,0.15)' : 'rgba(56,189,248,0.12)'}; color:${isG ? '#f59e0b' : '#38bdf8'}; border:1px solid ${isG ? 'rgba(245,158,11,0.3)' : 'rgba(56,189,248,0.2)'}; padding:2px 8px; border-radius:6px; font-weight:700;">
                    ${isG ? 'مسؤول عام (الرئيس)' : `${permCount} صلاحية`}
                  </span>
                </div>

                <div style="font-size:11.5px; color:#94a3b8;">
                  <span><strong>اسم الحساب:</strong> <code style="direction:ltr; font-family:monospace; color:${isG ? '#f59e0b' : '#38bdf8'}; font-weight:700;">${esc(m.username || 'user')}</code></span>
                  ${m.supervisor ? ` | <span><strong>المسؤول:</strong> ${esc(m.supervisor)}</span>` : ''}
                </div>

                <div style="display:flex; gap:8px; margin-top:6px;">
                  <input 
                    type="password" 
                    id="staff-pwd-${m.id}" 
                    placeholder="${isG ? 'أدخل كلمة مرور الرئيس (افتراضياً: admin)...' : 'كلمة المرور...'}" 
                    value=""
                    autocomplete="current-password"
                    onkeydown="if(event.key==='Enter') loginStaff('${m.id}', this.value)"
                    style="flex:1; background:rgba(0,0,0,0.35); border:1px solid ${isG ? 'rgba(245,158,11,0.4)' : 'rgba(255,255,255,0.12)'}; border-radius:8px; padding:8px 10px; font-size:12px; color:#fff;" 
                  />
                  <button 
                    type="button"
                    onclick="loginStaff('${m.id}', document.getElementById('staff-pwd-${m.id}').value)" 
                    style="background:${isG ? 'linear-gradient(135deg, #f59e0b, #d97706)' : '#2563eb'}; color:#fff; border:none; padding:8px 16px; border-radius:8px; font-size:12.5px; font-weight:800; cursor:pointer; transition:all 0.2s; box-shadow:${isG ? '0 2px 8px rgba(245,158,11,0.3)' : 'none'};"
                    onmouseover="this.style.opacity='0.9'"
                    onmouseout="this.style.opacity='1'"
                  >
                    ${isG ? '👑 دخول الرئيس' : 'دخول'}
                  </button>
                </div>
              </div>
            `;
          }).join('')}
        </div>

      </div>
    </div>
  `;
}

export function renderStaffManagerModal() {
  if (!S.showStaffManager) return '';
  const staffList = staffUsers || [];

  return `
    <div style="position:fixed; inset:0; z-index:9999; background:rgba(0,0,0,0.8); backdrop-filter:blur(8px); display:flex; align-items:center; justify-content:center; padding:16px; direction:rtl; font-family:system-ui, -apple-system, sans-serif;">
      <div style="background:var(--card, #ffffff); color:var(--t1, #0f172a); width:100%; max-width:1200px; max-height:94vh; border-radius:24px; overflow:hidden; display:flex; flex-direction:column; box-shadow:0 30px 70px -15px rgba(0,0,0,0.5); border:1px solid var(--border, #e2e8f0);">
        
        <!-- Modal Header -->
        <div style="padding:22px 28px; border-bottom:1px solid var(--border, #e2e8f0); display:flex; justify-content:space-between; align-items:center; background:linear-gradient(to right, var(--bg2, #f8fafc), var(--bg1, #ffffff));">
          <div>
            <div style="display:inline-flex; align-items:center; gap:6px; font-size:11px; font-weight:800; background:rgba(236,72,153,0.1); color:#db2777; border:1px solid rgba(236,72,153,0.25); border-radius:20px; padding:2px 10px; margin-bottom:6px;">
              👑 لوحة تحكم المسؤول العام (الرئيس)
            </div>
            <h2 style="font-size:20px; font-weight:800; margin:0 0 4px 0; color:var(--t1);">
              إدارة المستخدمين والصلاحيات الـ 68
            </h2>
            <p style="font-size:13px; color:var(--t2, #64748b); margin:0;">
              تحكم كامل ومباشر من طرف الرئيس في منح وسحب وتوزيع الصلاحيات الدقيقة على جميع مستخدمي وموظفي النظام
            </p>
          </div>
          <div style="display:flex; gap:10px; align-items:center;">
            <button class="btn btn-primary btn-sm" onclick="openModal('editStaffMember', {})" style="padding:8px 16px; border-radius:10px; font-weight:700;">
              ＋ إضافة مستخدم جديد
            </button>
            <button class="btn btn-ghost btn-sm" onclick="toggleStaffManagerModal(false)" style="font-size:16px; border-radius:10px; padding:6px 12px;">
              ✕ إغلاق
            </button>
          </div>
        </div>

        <!-- Staff / Users Cards List -->
        <div style="flex:1; overflow-y:auto; padding:24px; display:flex; flex-direction:column; gap:24px; background:var(--bg2, #f8fafc);">
          ${staffList.map(st => {
            const isG = st.role === 'GERANT';
            const grantedCount = isG ? ALL_PERMISSIONS.length : Object.values(st.permissions || {}).filter(Boolean).length;
            const percent = Math.round((grantedCount / ALL_PERMISSIONS.length) * 100);

            return `
              <div style="background:var(--bg1, #ffffff); border:1px solid var(--border, #e2e8f0); border-radius:18px; padding:20px; box-shadow:0 4px 12px rgba(0,0,0,0.03);">
                
                <!-- User Profile & Action Bar -->
                <div style="display:flex; flex-wrap:wrap; justify-content:space-between; align-items:center; gap:14px; margin-bottom:16px; border-bottom:1px solid var(--border, #e2e8f0); padding-bottom:16px;">
                  <div style="display:flex; align-items:center; gap:14px;">
                    <div style="width:48px; height:48px; border-radius:14px; background:${isG ? 'linear-gradient(135deg, #f59e0b, #d97706)' : 'linear-gradient(135deg, #3b82f6, #1d4ed8)'}; color:#fff; display:flex; align-items:center; justify-content:center; font-size:20px; font-weight:800; box-shadow:0 4px 10px rgba(0,0,0,0.15);">
                      ${isG ? '👑' : '👤'}
                    </div>
                    <div>
                      <div style="display:flex; align-items:center; gap:8px;">
                        <h3 style="font-size:17px; font-weight:800; margin:0; color:var(--t1);">${esc(st.name || st.fullName)}</h3>
                        ${isG ? `
                          <span style="font-size:11px; font-weight:800; background:#fef3c7; color:#b45309; border:1px solid #fde68a; padding:2px 8px; border-radius:8px;">
                            المسؤول العام (الرئيس)
                          </span>
                        ` : `
                          <span style="font-size:11px; font-weight:700; background:#e0f2fe; color:#0369a1; border:1px solid #bae6fd; padding:2px 8px; border-radius:8px;">
                            ${esc(st.department || 'القسم التقني')}
                          </span>
                        `}
                        <span style="font-size:11px; background:${st.status === 'معطل' ? '#fee2e2' : '#dcfce7'}; color:${st.status === 'معطل' ? '#b91c1c' : '#15803d'}; padding:2px 8px; border-radius:8px; font-weight:700;">
                          ${st.status === 'معطل' ? 'معطل' : 'نشط'}
                        </span>
                      </div>
                      <div style="font-size:12.5px; color:var(--t2); margin-top:3px; display:flex; gap:16px;">
                        <span><strong>المسمى الوظيفي:</strong> ${esc(st.position || 'موظف')}</span>
                        <span><strong>اسم المستخدم:</strong> <code style="direction:ltr; font-family:monospace;">${esc(st.username || 'user')}</code></span>
                        ${st.supervisor ? `<span><strong>المسؤول المباشر:</strong> ${esc(st.supervisor)}</span>` : ''}
                      </div>
                    </div>
                  </div>

                  <!-- Controls for this User -->
                  <div style="display:flex; flex-wrap:wrap; gap:8px; align-items:center;">
                    <button class="btn btn-xs" onclick="switchStaffDirectly('${st.id}')" style="background:#0284c7; color:#fff; border:none; padding:5px 12px; border-radius:8px; font-weight:700;" title="الدخول المباشر وتجربة واجهة هذا المستخدم بصلاحياته الحالية">
                      ⚡ تجربة الحساب
                    </button>
                    <button class="btn btn-outline btn-xs" onclick="openModal('editStaffMember', ${JSON.stringify(st).replace(/"/g, '&quot;')})" style="border-radius:8px; font-weight:700; padding:5px 10px;">
                      ✏️ تعديل البيانات
                    </button>
                    ${!isG ? `
                      <button class="btn btn-outline btn-xs" onclick="grantAllStaffPermissions('${st.id}', true)" style="border-color:#10b981; color:#059669; border-radius:8px; font-weight:700; padding:5px 10px;">
                        ⭐ منح كل الصلاحيات (68)
                      </button>
                      <button class="btn btn-outline btn-xs" onclick="grantAllStaffPermissions('${st.id}', false)" style="border-color:#ef4444; color:#dc2626; border-radius:8px; font-weight:700; padding:5px 10px;">
                        🚫 إلغاء الكل
                      </button>
                      <button class="btn btn-ghost btn-xs" onclick="deleteStaffMember('${st.id}')" style="color:#ef4444; border-radius:8px; font-weight:700; padding:5px 10px;">
                        🗑️ حذف
                      </button>
                    ` : ''}
                  </div>
                </div>

                <!-- Overall Permissions Status Bar -->
                <div style="margin-bottom:16px; background:var(--bg2, #f8fafc); border:1px solid var(--border, #e2e8f0); border-radius:12px; padding:10px 16px; display:flex; justify-content:space-between; align-items:center;">
                  <div style="font-size:13px; font-weight:700; color:var(--t1);">
                    مجموع الصلاحيات الممنوحة: 
                    <span style="color:#2563eb; font-weight:800; font-size:14px; margin-right:4px;">
                      ${grantedCount} من أصل ${ALL_PERMISSIONS.length} صلاحية (${percent}%)
                    </span>
                  </div>
                  ${isG ? `
                    <span style="font-size:12px; color:#b45309; font-weight:700;">
                      👑 حساب الرئيس يمتلك كامل الصلاحيات تلقائياً ودائماً
                    </span>
                  ` : `
                    <span style="font-size:12px; color:var(--t2);">
                      يتم تفعيل وإلغاء أي صلاحية بنقرة واحدة وتُحفظ فورياً سحابياً
                    </span>
                  `}
                </div>

                <!-- 9 Categorized Permission Groups -->
                <div style="display:flex; flex-direction:column; gap:14px;">
                  ${PERMISSION_GROUPS.map(group => {
                    const groupPerms = group.permissions || [];
                    const activeInGroup = isG ? groupPerms.length : groupPerms.filter(p => st.permissions && st.permissions[p.key]).length;

                    return `
                      <div style="border:1px solid var(--border, #e2e8f0); border-radius:12px; overflow:hidden; background:var(--bg1, #ffffff);">
                        <!-- Group Header -->
                        <div style="padding:10px 14px; background:var(--bg2, #f8fafc); border-bottom:1px solid var(--border, #e2e8f0); display:flex; justify-content:space-between; align-items:center;">
                          <div style="display:flex; align-items:center; gap:8px;">
                            <span style="font-size:15px;">${group.icon}</span>
                            <span style="font-size:13.5px; font-weight:800; color:var(--t1);">${group.title}</span>
                            <span style="font-size:11px; background:${activeInGroup === groupPerms.length ? 'rgba(16,185,129,0.15)' : 'rgba(100,116,139,0.1)'}; color:${activeInGroup === groupPerms.length ? '#059669' : '#475569'}; border-radius:6px; padding:1px 7px; font-weight:700;">
                              ${activeInGroup} / ${groupPerms.length}
                            </span>
                          </div>

                          ${!isG ? `
                            <div style="display:flex; gap:6px;">
                              <button type="button" class="btn btn-ghost btn-xs" onclick="grantStaffGroupPermissions('${st.id}', '${group.id}', true)" style="font-size:11px; padding:2px 8px; color:#059669; font-weight:700;" title="منح كافة صلاحيات هذا القسم">
                                ✓ منح هذا القسم
                              </button>
                              <button type="button" class="btn btn-ghost btn-xs" onclick="grantStaffGroupPermissions('${st.id}', '${group.id}', false)" style="font-size:11px; padding:2px 8px; color:#dc2626; font-weight:700;" title="إلغاء كافة صلاحيات هذا القسم">
                                ✕ إلغاء هذا القسم
                              </button>
                            </div>
                          ` : ''}
                        </div>

                        <!-- Group Permission Checkbox Items -->
                        <div style="padding:12px 14px; display:grid; grid-template-columns:repeat(auto-fill, minmax(280px, 1fr)); gap:10px;">
                          ${groupPerms.map(p => {
                            const checked = isG || !!(st.permissions && st.permissions[p.key]);

                            return `
                              <label style="display:flex; align-items:flex-start; gap:8px; padding:8px 10px; border-radius:8px; border:1px solid ${checked ? 'rgba(37,99,235,0.25)' : 'transparent'}; background:${checked ? 'rgba(37,99,235,0.03)' : 'transparent'}; cursor:${isG ? 'default' : 'pointer'}; transition:all 0.15s;">
                                <input 
                                  type="checkbox" 
                                  ${checked ? 'checked' : ''} 
                                  ${isG ? 'disabled' : ''} 
                                  onchange="toggleStaffPermission('${st.id}', '${p.key}')" 
                                  style="margin-top:2px; cursor:${isG ? 'default' : 'pointer'}; width:15px; height:15px; accent-color:#2563eb;"
                                />
                                <div style="flex:1;">
                                  <div style="font-size:12.5px; font-weight:700; color:var(--t1); line-height:1.3;">
                                    ${p.label}
                                  </div>
                                  <div style="font-size:11px; color:var(--t2); margin-top:2px; line-height:1.3;">
                                    ${p.desc}
                                  </div>
                                  <div style="font-size:10px; font-family:monospace; color:#94a3b8; direction:ltr; text-align:left; margin-top:3px;">
                                    ${p.key}
                                  </div>
                                </div>
                              </label>
                            `;
                          }).join('')}
                        </div>
                      </div>
                    `;
                  }).join('')}
                </div>

              </div>
            `;
          }).join('')}
        </div>

      </div>
    </div>
  `;
}

window.focusGerantLogin = function() {
  const list = staffUsers || [];
  const gerant = list.find(s => s.role === 'GERANT' || s.id === 'gerant') || list[0];
  const gerantId = gerant ? gerant.id : 'gerant';
  const inp = document.getElementById('staff-pwd-' + gerantId);
  if (inp) {
    inp.scrollIntoView({ behavior: 'smooth', block: 'center' });
    inp.focus();
    inp.style.outline = '2px solid #f59e0b';
    inp.style.boxShadow = '0 0 0 4px rgba(245, 158, 11, 0.4)';
    setTimeout(() => {
      if (inp) {
        inp.style.outline = '';
        inp.style.boxShadow = '';
      }
    }, 2500);
  }
};

window.enterAsGerantDirectly = window.focusGerantLogin;

window.closeStaffPortal = function() {
  if (!currentStaffUser) {
    if (typeof window.showToast === 'function') {
      window.showToast('يجب اختيار حساب مستخدم وإدخال كلمة المرور للمتابعة', 'warning');
    }
    return;
  }
  S.showStaffPortal = false;
  if (typeof window.R === 'function') {
    window.R();
  }
};


