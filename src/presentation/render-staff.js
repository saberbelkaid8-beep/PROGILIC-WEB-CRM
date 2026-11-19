import { S, staffUsers } from '../state/store.js';
import { ALL_PERMISSIONS, PERMISSION_GROUPS } from '../constants/index.js';
import { esc } from '../utils/index.js';
import { t } from '../utils/i18n.js';

const SI = {
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  crown: '<path d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z"/><path d="M5 21h14"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/>',
  zap: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
  edit: '<path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.375 2.625a1 1 0 0 1 3 3l-9.013 9.014a2 2 0 0 1-.853.505l-2.873.84a.5.5 0 0 1-.62-.62l.84-2.873a2 2 0 0 1 .506-.852z"/>',
  trash: '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>',
  check: '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/>',
  shield: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>',
  plus: '<line x1="12" x2="12" y1="5" y2="19"/><line x1="5" x2="19" y1="12" y2="12"/>',
  x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>'
};

const sIc = (name, size = 15, sw = 2) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${SI[name] || SI.user}</svg>`;

export function renderStaffLogin() {
  const staffList = staffUsers || [];
  const currentUserEmail = S.currentUser ? S.currentUser.email : '';
  const dir = S.lang === 'ar' ? 'rtl' : 'ltr';

  return `
    <div class="dashboard-root" style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;direction:${dir}">
      <div class="card" style="max-width:1120px;width:100%;padding:28px">
        <div style="display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:16px;margin-bottom:20px;border-bottom:1px solid var(--border-soft);padding-bottom:18px">
          <div>
            <div style="font-size:11px;font-weight:700;color:var(--info-t);letter-spacing:0.08em;margin-bottom:6px">PROGILIC CRM · USER ACCESS PORTAL</div>
            <h1 style="font-size:22px;font-weight:800;color:var(--t1);margin:0 0 4px 0;display:flex;align-items:center;gap:8px">
              ${sIc('users', 20)} <span>بوابة تسجيل دخول المستخدمين</span>
            </h1>
            <p style="font-size:13px;color:var(--t2);margin:0">
              ${S.lang === 'fr' ? 'Compte connecté :' : S.lang === 'en' ? 'Signed-in account:' : 'الحساب المسجل:'} <strong data-user-content="true" style="color:var(--info-t)">${esc(currentUserEmail || (S.lang === 'fr' ? 'Administrateur' : S.lang === 'en' ? 'Administrator' : 'المسؤول'))}</strong>
            </p>
          </div>

          <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
            <button class="btn btn-primary btn-sm" onclick="window.focusGerantLogin()" style="background:var(--brand);border-color:rgba(255,255,255,0.28)" title="التركيز على حساب الرئيس لإدخال كلمة المرور">
              ${sIc('crown', 14)} <span>حساب الرئيس (كلمة المرور مطلوبة)</span>
            </button>
            <button class="btn btn-danger-soft btn-sm" onclick="logout()" title="تسجيل الخروج والعودة لصفحة التسجيل">
              ${sIc('logout', 14)} <span>تسجيل الخروج</span>
            </button>
          </div>
        </div>

        <div style="background:rgba(255,255,255,0.04);border:1px solid var(--border-soft);border-radius:var(--r-md);padding:12px 16px;margin-bottom:20px;display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">
          <p style="font-size:13px;color:var(--t2);margin:0;line-height:1.6">
            ${S.lang === 'fr' ? 'Sélectionnez un compte utilisateur et saisissez son mot de passe. Le gérant gère les autorisations des utilisateurs.' : S.lang === 'en' ? 'Select a user account and enter its password. The administrator manages user permissions.' : 'اختر حساب المستخدم وأدخل كلمة المرور الصحيحة للمتابعة. يتحكم المسؤول في تحديد وتوزيع الصلاحيات على المستخدمين.'}
          </p>
          <span class="staff-count num" style="font-size:12px;color:var(--info-t);font-weight:700">
            ${staffList.length} مستخدم مسجل
          </span>
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px;max-height:65vh;overflow-y:auto;padding:2px">
          ${staffList.map(m => {
            const isG = m.role === 'GERANT';
            const permCount = isG ? ALL_PERMISSIONS.length : Object.values(m.permissions || {}).filter(Boolean).length;

            return `
              <div class="card" style="padding:18px;display:flex;flex-direction:column;gap:12px;border-color:${isG ? 'rgba(255,159,10,0.35)' : 'var(--border)'}">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px">
                  <div style="display:flex;align-items:center;gap:10px">
                    <div style="width:42px;height:42px;border-radius:12px;background:${isG ? 'rgba(255,159,10,0.18)' : 'rgba(10,132,255,0.18)'};border:1px solid ${isG ? 'rgba(255,159,10,0.35)' : 'rgba(10,132,255,0.35)'};color:${isG ? 'var(--wt)' : 'var(--info-t)'};display:flex;align-items:center;justify-content:center;flex-shrink:0">
                      ${isG ? sIc('crown', 18) : sIc('user', 18)}
                    </div>
                    <div>
                      <div class="staff-name" style="font-weight:800;font-size:15px;color:var(--t1)">${esc(m.name || m.fullName)}</div>
                      <div class="staff-position" style="font-size:12px;color:var(--t2);font-weight:600">${m.position ? esc(m.position) : t('مستخدم')}</div>
                    </div>
                  </div>
                  <span class="num" style="font-size:11px;color:${isG ? 'var(--wt)' : 'var(--info-t)'};font-weight:700;flex-shrink:0">
                    ${isG ? 'مسؤول عام (الرئيس)' : `${permCount} صلاحية`}
                  </span>
                </div>

                <div style="font-size:12px;color:var(--t3)">
                  <span><strong>اسم الحساب:</strong> <code style="direction:ltr;font-family:monospace;color:${isG ? 'var(--wt)' : 'var(--info-t)'};font-weight:700">${esc(m.username || 'user')}</code></span>
                  ${m.supervisor ? ` · <span><strong>المسؤول:</strong> <span class="staff-supervisor" style="color:var(--t2)">${esc(m.supervisor)}</span></span>` : ''}
                </div>

                <div style="display:flex;gap:8px;margin-top:4px">
                  <input
                    type="password"
                    id="staff-pwd-${m.id}"
                    class="fctl"
                    placeholder="${isG ? (S.lang === 'fr' ? 'Saisissez le mot de passe du gérant...' : S.lang === 'en' ? 'Enter the administrator password...' : 'أدخل كلمة مرور المسؤول...') : (S.lang === 'fr' ? 'Mot de passe...' : S.lang === 'en' ? 'Password...' : 'كلمة المرور...')}"
                    value=""
                    autocomplete="current-password"
                    onkeydown="if(event.key==='Enter') loginStaff('${m.id}', this.value)"
                    style="flex:1;min-height:38px;font-size:12.5px"
                  />
                  <button
                    type="button"
                    class="btn btn-primary btn-sm"
                    onclick="loginStaff('${m.id}', document.getElementById('staff-pwd-${m.id}').value)"
                    style="${isG ? 'background:var(--brand)' : ''}"
                  >
                    ${isG ? `${sIc('crown', 13)} <span>دخول الرئيس</span>` : 'دخول'}
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
    <div class="gi-overlay" style="z-index:9999;padding:16px;direction:${S.lang === 'ar' ? 'rtl' : 'ltr'}">
      <div class="gi-sheet" style="max-width:1200px;max-height:94vh;padding:0;display:flex;flex-direction:column;overflow:hidden">
        <!-- Modal Header -->
        <div style="padding:20px 24px;border-bottom:1px solid var(--border-soft);display:flex;justify-content:space-between;align-items:center;gap:14px;flex-wrap:wrap">
          <div>
            <div style="display:inline-flex;align-items:center;gap:6px;font-size:11.5px;font-weight:700;color:var(--wt);margin-bottom:4px">
              ${sIc('crown', 14)} <span>لوحة تحكم المسؤول العام (الرئيس)</span>
            </div>
            <h2 style="font-size:19px;font-weight:800;margin:0 0 4px 0;color:var(--t1)">
              إدارة المستخدمين والصلاحيات الـ <span class="num">68</span>
            </h2>
            <p style="font-size:12.5px;color:var(--t2);margin:0">
              تحكم كامل ومباشر من طرف الرئيس في منح وسحب وتوزيع الصلاحيات الدقيقة على جميع مستخدمي وموظفي النظام
            </p>
          </div>
          <div style="display:flex;gap:8px;align-items:center">
            <button class="btn btn-primary btn-sm" onclick="openModal('editStaffMember', {})">
              ${sIc('plus', 14)} <span>إضافة مستخدم جديد</span>
            </button>
            <button class="btn btn-ghost btn-sm" onclick="toggleStaffManagerModal(false)">
              ${sIc('x', 14)} <span>إغلاق</span>
            </button>
          </div>
        </div>

        <!-- Staff / Users Cards List -->
        <div style="flex:1;overflow-y:auto;padding:20px 24px;display:flex;flex-direction:column;gap:20px">
          ${staffList.map(st => {
            const isG = st.role === 'GERANT';
            const grantedCount = isG ? ALL_PERMISSIONS.length : Object.values(st.permissions || {}).filter(Boolean).length;
            const percent = Math.round((grantedCount / ALL_PERMISSIONS.length) * 100);

            return `
              <div style="background:rgba(255,255,255,0.04);border:1px solid var(--border);border-radius:var(--r-lg);padding:20px">
                <div style="display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:14px;margin-bottom:16px;border-bottom:1px solid var(--border-soft);padding-bottom:14px">
                  <div style="display:flex;align-items:center;gap:12px">
                    <div style="width:46px;height:46px;border-radius:14px;background:${isG ? 'rgba(255,159,10,0.18)' : 'rgba(10,132,255,0.18)'};border:1px solid ${isG ? 'rgba(255,159,10,0.35)' : 'rgba(10,132,255,0.35)'};color:${isG ? 'var(--wt)' : 'var(--info-t)'};display:flex;align-items:center;justify-content:center;flex-shrink:0">
                      ${isG ? sIc('crown', 20) : sIc('user', 20)}
                    </div>
                    <div>
                      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                        <h3 style="font-size:16px;font-weight:800;margin:0;color:var(--t1)">${esc(st.name || st.fullName)}</h3>
                        <span style="font-size:11.5px;font-weight:700;color:${isG ? 'var(--wt)' : 'var(--info-t)'}">
                          · ${isG ? 'المسؤول العام (الرئيس)' : esc(st.department || 'القسم التقني')}
                        </span>
                        <span style="font-size:11.5px;font-weight:700;color:${st.status === 'معطل' ? 'var(--rt)' : 'var(--gt)'}">
                          · ${st.status === 'معطل' ? 'معطل' : 'نشط'}
                        </span>
                      </div>
                      <div style="font-size:12px;color:var(--t2);margin-top:4px;display:flex;gap:14px;flex-wrap:wrap">
                        <span><strong>المسمى الوظيفي:</strong> ${esc(st.position || 'موظف')}</span>
                        <span><strong>اسم المستخدم:</strong> <code style="direction:ltr;font-family:monospace;color:var(--info-t)">${esc(st.username || 'user')}</code></span>
                        ${st.supervisor ? `<span><strong>المسؤول المباشر:</strong> ${esc(st.supervisor)}</span>` : ''}
                      </div>
                    </div>
                  </div>

                  <div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center">
                    <button class="btn btn-blue-soft btn-xs" onclick="switchStaffDirectly('${st.id}')" title="الدخول المباشر وتجربة واجهة هذا المستخدم بصلاحياته الحالية">
                      ${sIc('zap', 12)} <span>تجربة الحساب</span>
                    </button>
                    <button class="btn btn-outline btn-xs" onclick="openModal('editStaffMember', ${JSON.stringify(st).replace(/"/g, '&quot;')})">
                      ${sIc('edit', 12)} <span>تعديل البيانات</span>
                    </button>
                    ${!isG ? `
                      <button class="btn btn-success-soft btn-xs" onclick="grantAllStaffPermissions('${st.id}', true)">
                        ${sIc('check', 12)} <span>منح كل الصلاحيات (68)</span>
                      </button>
                      <button class="btn btn-danger-soft btn-xs" onclick="grantAllStaffPermissions('${st.id}', false)">
                        ${sIc('x', 12)} <span>إلغاء الكل</span>
                      </button>
                      <button class="btn btn-ghost btn-xs" onclick="deleteStaffMember('${st.id}')" style="color:var(--rt)">
                        ${sIc('trash', 12)} <span>حذف</span>
                      </button>
                    ` : ''}
                  </div>
                </div>

                <!-- Overall Permissions Status Bar -->
                <div style="margin-bottom:16px;background:rgba(255,255,255,0.03);border:1px solid var(--border-soft);border-radius:var(--r-sm);padding:10px 14px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
                  <div style="font-size:13px;font-weight:700;color:var(--t1)">
                    مجموع الصلاحيات الممنوحة:
                    <span class="num" style="color:var(--info-t);font-weight:800;font-size:14px;margin-inline-start:4px">
                      ${grantedCount} / ${ALL_PERMISSIONS.length} (${percent}%)
                    </span>
                  </div>
                  ${isG ? `
                    <span style="font-size:12px;color:var(--wt);font-weight:700;display:inline-flex;align-items:center;gap:5px">
                      ${sIc('crown', 13)} <span>حساب الرئيس يمتلك كامل الصلاحيات تلقائياً ودائماً</span>
                    </span>
                  ` : `
                    <span style="font-size:12px;color:var(--t2)">
                      يتم تفعيل وإلغاء أي صلاحية بنقرة واحدة وتُحفظ فورياً سحابياً
                    </span>
                  `}
                </div>

                <!-- 9 Categorized Permission Groups -->
                <div style="display:flex;flex-direction:column;gap:12px">
                  ${PERMISSION_GROUPS.map(group => {
                    const groupPerms = group.permissions || [];
                    const activeInGroup = isG ? groupPerms.length : groupPerms.filter(p => st.permissions && st.permissions[p.key]).length;

                    return `
                      <div style="border:1px solid var(--border);border-radius:var(--r-md);overflow:hidden;background:rgba(255,255,255,0.02)">
                        <div style="padding:10px 14px;background:rgba(255,255,255,0.04);border-bottom:1px solid var(--border-soft);display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
                          <div style="display:flex;align-items:center;gap:8px">
                            ${sIc('shield', 14)}
                            <span style="font-size:13px;font-weight:800;color:var(--t1)">${group.title}</span>
                            <span class="num" style="font-size:11.5px;color:${activeInGroup === groupPerms.length ? 'var(--gt)' : 'var(--t3)'};font-weight:700">
                              ${activeInGroup} / ${groupPerms.length}
                            </span>
                          </div>

                          ${!isG ? `
                            <div style="display:flex;gap:6px">
                              <button type="button" class="btn btn-ghost btn-xs" onclick="grantStaffGroupPermissions('${st.id}', '${group.id}', true)" style="color:var(--gt);font-weight:700">
                                ${sIc('check', 12)} <span>منح هذا القسم</span>
                              </button>
                              <button type="button" class="btn btn-ghost btn-xs" onclick="grantStaffGroupPermissions('${st.id}', '${group.id}', false)" style="color:var(--rt);font-weight:700">
                                ${sIc('x', 12)} <span>إلغاء هذا القسم</span>
                              </button>
                            </div>
                          ` : ''}
                        </div>

                        <div style="padding:12px 14px;display:grid;grid-template-columns:repeat(auto-fill,minmax(275px,1fr));gap:10px">
                          ${groupPerms.map(p => {
                            const checked = isG || !!(st.permissions && st.permissions[p.key]);

                            return `
                              <label style="display:flex;align-items:flex-start;gap:8px;padding:8px 10px;border-radius:8px;border:1px solid ${checked ? 'rgba(10,132,255,0.30)' : 'var(--border-soft)'};background:${checked ? 'rgba(10,132,255,0.08)' : 'transparent'};cursor:${isG ? 'default' : 'pointer'};transition:all 0.15s">
                                <input
                                  type="checkbox"
                                  ${checked ? 'checked' : ''}
                                  ${isG ? 'disabled' : ''}
                                  onchange="toggleStaffPermission('${st.id}', '${p.key}')"
                                  style="margin-top:2px;cursor:${isG ? 'default' : 'pointer'};width:15px;height:15px;accent-color:var(--sys-blue)"
                                />
                                <div style="flex:1">
                                  <div style="font-size:12.5px;font-weight:700;color:var(--t1);line-height:1.35">${p.label}</div>
                                  <div style="font-size:11px;color:var(--t2);margin-top:2px;line-height:1.35">${p.desc}</div>
                                  <div style="font-size:10px;font-family:monospace;color:var(--t3);direction:ltr;text-align:left;margin-top:3px">${p.key}</div>
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
    inp.style.outline = '2px solid var(--sys-orange)';
    inp.style.boxShadow = '0 0 0 4px rgba(255, 159, 10, 0.35)';
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
  S.showStaffPortal = false;
  if (typeof window.R === 'function') {
    window.R();
  }
};
