import { S, clients } from '../state/store.js';
import { BUSINESS_TYPES, PLATFORMS, PROGRAM_TYPES, PROGRAM_VERSIONS, ISSUE_TYPES, PRIORITY_LEVELS, ISSUE_STATUSES, ISSUE_SOURCES, REQ_STATUSES, IMPACT_LEVELS, WILAYAS } from '../constants/index.js';
import { gc, selOpts, td, wOpts, actTypeOpts, esc, isClientAtRisk } from '../utils/index.js';
import { getPurgeAuditLogs } from '../business/purgeService.js';
import { computeScore, scoreColor } from '../business/intelligence.js';
import { normalizeProgramCategory } from '../business/programMetrics.js';
import { getClientProgramGroups } from '../business/versionSync.js';
import {
  normalizeClientStatus,
  isConfirmedClientStatus,
  isUnconfirmedClientStatus,
  buildClientClassificationPlan
} from '../business/clientStatus.js';

const CSTATUSES = ['مؤكد', 'غير مؤكد'];
const ITYPES = ISSUE_TYPES;
const ISOURCES = ISSUE_SOURCES;
const PRIOS = PRIORITY_LEVELS;
const ISTATUSES = ISSUE_STATUSES;
const IMPACTS = IMPACT_LEVELS;
const RSTATUSES = REQ_STATUSES;
const RTYPES = ['ميزة جديدة', 'تحسين', 'تعديل', 'أخرى'];
const PROGRAM_PLATFORMS = PLATFORMS;
const ACTIVITIES = BUSINESS_TYPES;
import { 
  renderEmployeeFormModal, 
  renderEditPermissionsModal, 
  renderChangePasswordModal, 
  renderViewEmployeeTasksModal, 
  renderAdminPasswordModal 
} from './render-employees.js';

const MI = {
  box: '<path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>',
  bulb: '<path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/>',
  save: '<path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7"/><path d="M7 3v4a1 1 0 0 0 1 1h7"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/>',
  refresh: '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
  inbox: '<polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  desktop: '<rect width="20" height="14" x="2" y="3" rx="2"/><line x1="8" x2="16" y1="21" y2="21"/><line x1="12" x2="12" y1="17" y2="21"/>',
  mobile: '<rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><path d="M12 18h.01"/>',
  globe: '<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>',
  warn: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  shield: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>',
  cloud: '<path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/>',
  bug: '<path d="m8 2 1.88 1.88"/><path d="M14.12 3.88 16 2"/><path d="M9 7.13v-1a3.003 3.003 0 1 1 6 0v1"/><path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6"/><path d="M12 20v-9"/><path d="M6.53 9C4.6 8.8 3 7.1 3 5"/><path d="M6 13H2"/><path d="M3 21c0-2.1 1.7-3.9 3.8-4"/><path d="M20.97 5c0 2.1-1.6 3.8-3.5 4"/><path d="M22 13h-4"/><path d="M17.2 17c2.1.1 3.8 1.9 3.8 4"/>',
  target: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
  flame: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
  scroll: '<path d="M19 17V5a2 2 0 0 0-2-2H4"/><path d="M8 21h12a2 2 0 0 0 2-2v-1a1 1 0 0 0-1-1H11a1 1 0 0 0-1 1v1a2 2 0 1 1-4 0V5a2 2 0 1 0-4 0v2a1 1 0 0 0 1 1h3"/>',
  calendar: '<rect width="18" height="18" x="3" y="4" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/>',
  fileText: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>',
  check: '<polyline points="20 6 9 17 4 12"/>',
  chart: '<line x1="18" x2="18" y1="20" y2="10"/><line x1="12" x2="12" y1="20" y2="4"/><line x1="6" x2="6" y1="20" y2="14"/>',
  pin: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
  phone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>',
  ticket: '<path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/><path d="M13 5v2"/><path d="M13 17v2"/><path d="M13 11v2"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  table: '<path d="M12 3v18"/><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M3 15h18"/>',
  grid: '<rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/>',
  building: '<rect width="16" height="20" x="4" y="2" rx="2" ry="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M12 6h.01"/><path d="M12 10h.01"/><path d="M12 14h.01"/><path d="M16 10h.01"/><path d="M16 14h.01"/><path d="M8 10h.01"/><path d="M8 14h.01"/>',
  clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  trash: '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>',
  lock: '<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  star: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
  scale: '<path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="M7 21h10"/><path d="M12 3v18"/><path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2"/>'
};

const mIc = (name, size = 14, sw = 2) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex-shrink:0">${MI[name] || ''}</svg>`;

export function renderModal(){
  const m=S.modal;
  let html='';
  if(m==='addClient'||m==='editClient')html=renderClientModal();
  if(m==='addIssue'||m==='editIssue')html=renderIssueModal();
  if(m==='addRequirement'||m==='editReq')html=renderReqModal();
  if(m==='addProgram'||m==='editProgram')html=renderProgramModal();
  if(m==='syncProgramVersion'||m==='logProgramUpdate')html=renderSyncProgramVersionModal();
  if(m==='conflict')html=renderConflictModal();
  if(m==='addContact')html=renderAddContactModal();
  if(m==='backupManager')html=renderBackupManagerModal();
  if(m==='dbPurge')html=renderDbPurgeModal();
  if(m==='editStaffMember')html=renderStaffMemberModal();
  if(m==='addEmployee'||m==='editEmployee')html=renderEmployeeFormModal();
  if(m==='editEmployeePermissions')html=renderEditPermissionsModal();
  if(m==='changeEmployeePassword')html=renderChangePasswordModal();
  if(m==='viewEmployeeTasks')html=renderViewEmployeeTasksModal();
  if(m==='adminPasswordConfirm')html=renderAdminPasswordModal();
  if(m==='geoReport')html=renderGeoReportModal();
  if(m==='ticketsAndReqs')html=renderTicketsAndReqsModal();
  if(m==='healthScoreExplainer')html=renderHealthScoreExplainerModal();
  if(m==='licensesExplorer')html=renderLicensesExplorerModal();
  if(m==='clientCleanup')html=renderClientCleanupModal();
  const isSuperWide = m === 'licensesExplorer';
  const isWide = m === 'geoReport' || m === 'ticketsAndReqs' || m === 'healthScoreExplainer' || m === 'dbPurge' || m === 'clientCleanup' || isSuperWide;
  return`<div class="mbk"><div class="msheet" style="direction: ${S.lang === 'ar' ? 'rtl' : 'ltr'}; ${isSuperWide ? 'max-width:1080px; width:96vw; max-height:94vh;' : isWide ? 'max-width:920px; width:95vw;' : ''}">${html}</div></div>`;
}

import { t } from '../utils/i18n.js';
import { cOpts, programTypeOpts, updateProgramTypeSelect, sBdg, getProgramStats } from '../utils/index.js';

function renderClientModal(){
  const isEdit=S.modal==='editClient';
  let c={};if(isEdit)c=clients.find(x=>x.id===S.selId)||{};
  const addProgChecked = Boolean(S.form && S.form._addInitialProg);
  const curStatus = isEdit ? normalizeClientStatus(c.status) : (addProgChecked ? 'مؤكد' : 'غير مؤكد');
  const isConf = isConfirmedClientStatus(curStatus);
  return`
    <div class="mhdr">
      <div class="mtitle">${isEdit?t('تعديل بيانات العميل'):t('إضافة عميل جديد')}</div>
      <button class="mclose" onclick="closeModal()">×</button>
    </div>
    <div class="frow">
      <div class="fgroup"><label class="flbl">${t('الاسم الكامل')} *</label><input class="fctl" id="f_fn" value="${esc(c.fullName)}" placeholder="${t('مثال: محمد بن علي')}"></div>
      <div class="fgroup"><label class="flbl">${t('المؤسسة / الشركة')} *</label><input class="fctl" id="f_co" value="${esc(c.company)}" placeholder="${t('مثال: شركة الأفق للتجارة')}"></div>
    </div>
    <div class="frow">
      <div class="fgroup"><label class="flbl">${t('الهاتف')} *</label><input class="fctl" id="f_ph" dir="ltr" value="${esc(c.phone)}" placeholder="0550 12 34 56"></div>
      <div class="fgroup"><label class="flbl">${t('الولاية')} *</label><select class="fctl" id="f_wi" onchange="updateCommunesOpts()"><option value="">${t('اختر الولاية')}</option>${wOpts(c.wilaya)}</select></div>
    </div>
    <div class="frow">
      <div class="fgroup"><label class="flbl">${t('البلدية')} <span style="font-size:11px;color:var(--muted)">(${t('اختياري')})</span></label><select class="fctl" id="f_cm"><option value="">${t('اختر البلدية (اختياري)')}</option>${cOpts(c.wilaya, c.commune)}</select></div>
      <div class="fgroup"><label class="flbl">${t('حساب Gmail')} <span style="font-size:11px;color:var(--muted)">(${t('اختياري')})</span></label><input type="email" class="fctl" id="f_gmail" dir="ltr" autocomplete="email" value="${esc(c.gmailAccount)}" placeholder="client@gmail.com"></div>
    </div>
    <div class="fgroup"><label class="flbl">${t('العنوان / المنطقة أو الحي')} <span style="font-size:11px;color:var(--muted)">(${t('اختياري')})</span></label><input class="fctl" id="f_lo" value="${esc(c.location)}" placeholder="${t('مثال: حي النصر، شارع أول نوفمبر')}"></div>
    <div class="frow">
      <div class="fgroup"><label class="flbl">${t('النشاط الرئيسي')} *</label><select class="fctl" id="f_bt" onchange="updateActTypeOpts()"><option value="">${t('اختر النشاط')}</option>${selOpts(ACTIVITIES,c.businessType)}</select></div>
      <div class="fgroup"><label class="flbl">${t('تخصص النشاط')} *</label><select class="fctl" id="f_bf">${actTypeOpts(c.businessType||'',c.businessField)}</select></div>
    </div>
    <div class="fsec">${t('حالة العميل والتسجيل')}</div>
    <div class="frow">
      <div class="fgroup"><label class="flbl">${t('الحالة')} *</label><select class="fctl" id="f_st" onchange="onClientStatusChange()">${selOpts(CSTATUSES,curStatus)}</select></div>
      <div class="fgroup"><label class="flbl">${t('آخر تواصل')} <span style="font-size:11px;color:var(--muted)">(${t('اختياري لغير المؤكد')})</span></label><input type="date" class="fctl" id="f_lc" value="${c.lastContact||(isConf?td():'')}"></div>
    </div>
    <div class="fgroup">
      <label class="flbl">${t('تاريخ البدء / التسجيل')} <span style="color:var(--brand);font-weight:600">(${t('ترخيص مدى الحياة')})</span></label>
      <input type="date" class="fctl" id="f_sd" value="${c.startDate||(isConf?td():'')}">
    </div>
    ${!isEdit ? (() => {
      return `
    <div id="active_client_prog_sec" style="background:rgba(255,255,255,0.03); border:1px solid var(--border); border-radius:var(--r-sm); padding:12px; margin-top:10px;">
      <label for="f_p_enable" style="display:flex; align-items:center; justify-content:space-between; gap:10px; cursor:pointer; margin:0; user-select:none;">
        <span style="display:flex; align-items:center; gap:8px; font-weight:700; font-size:13px; color:var(--brand)">
          <input type="checkbox" id="f_p_enable" ${addProgChecked ? 'checked' : ''} style="width:16px; height:16px; accent-color:var(--brand); cursor:pointer;" onchange="if(window.S&&window.S.form){window.S.form._addInitialProg=this.checked;} const fields=document.getElementById('f_p_fields'); if(fields) fields.style.display=this.checked?'block':'none'; if(this.checked){const stSel=document.getElementById('f_st');if(stSel){stSel.value='مؤكد';if(window.onClientStatusChange)window.onClientStatusChange();}}">
          <span style="display:inline-flex; align-items:center; gap:6px">${mIc('box', 14)} ${t('إضافة أول برنامج')}</span>
        </span>
        <span style="font-size:11px; color:var(--muted); font-weight:500">(${t('اختياري')})</span>
      </label>
      <div id="f_p_fields" style="display:${addProgChecked ? 'block' : 'none'}; margin-top:12px; padding-top:12px; border-top:1px dashed var(--border);">
        <div class="frow">
          <div class="fgroup">
            <label class="flbl">${t('المنصة')} *</label>
            <select class="fctl" id="f_p_pl" onchange="updateProgramTypeSelect(this.value, 'f_p_ty')">
              <option value="Desktop" selected>Desktop</option>
              <option value="Mobile">Mobile</option>
              <option value="Web">Web</option>
            </select>
          </div>
          <div class="fgroup">
            <label class="flbl">${t('نوع البرنامج')} *</label>
            <select class="fctl" id="f_p_ty">${programTypeOpts('Desktop', 'تجاري (Commercial)')}</select>
          </div>
        </div>
        <div class="frow">
          <div class="fgroup" id="f_p_ver_group">
            <label class="flbl">${t('إصدار البرنامج')} *</label>
            <select class="fctl" id="f_p_ver">
              <option value="">${t('اختر الإصدار')}</option>
              ${PROGRAM_VERSIONS.map(v => `<option value="${v}">${v}</option>`).join('')}
            </select>
          </div>
          <div class="fgroup">
            <label class="flbl">${t('عدد الأجهزة المرخصة')} *</label>
            <input type="number" class="fctl" id="f_p_ic" min="1" value="1">
          </div>
        </div>
      </div>
    </div>
    `;
    })() : ''}
    <div class="fgroup" style="margin-top:10px"><label class="flbl">${t('ملاحظات عامة')} <span style="font-size:11px;color:var(--muted)">(${t('اختياري')})</span></label><textarea class="fctl" id="f_no">${esc(c.notes)}</textarea></div>
    <div class="facts">
      <button class="btn btn-ghost" onclick="closeModal()">${t('إلغاء')}</button>
      <button class="btn btn-primary" onclick="saveClient(${isEdit?c.id:null})">${isEdit?t('تأكيد التعديل'):t('حفظ العميل')}</button>
    </div>`;
}

function renderProgramModal(){
  const isEdit=S.modal==='editProgram';
  const cid=S.selId;const c=clients.find(x=>x.id===cid);if(!c)return'';
  let p={};
  if(isEdit){const eid=S.form.eid;p=c.programs.find(x=>x.id===eid)||{};}
  const curPlat = p.platform || 'Desktop';
  return`
    <div class="mhdr">
      <div class="mtitle">${isEdit?t('تعديل بيانات الترخيص'):t('إضافة برنامج وترخيص جديد')}</div>
      <button class="mclose" onclick="closeModal()">×</button>
    </div>
    <div class="frow">
      <div class="fgroup">
        <label class="flbl">${t('المنصة')} *</label>
        <select class="fctl" id="fp_pl" onchange="updateProgramTypeSelect(this.value, 'fp_ty')">
          <option value="Desktop"${curPlat==='Desktop'?' selected':''}>Desktop</option>
          <option value="Mobile"${curPlat==='Mobile'?' selected':''}>Mobile</option>
          <option value="Web"${curPlat==='Web'?' selected':''}>Web</option>
        </select>
      </div>
      <div class="fgroup">
        <label class="flbl">${t('نوع البرنامج')} *</label>
        <select class="fctl" id="fp_ty">${programTypeOpts(curPlat, p.type||'')}</select>
      </div>
    </div>
    <div class="frow">
      <div class="fgroup" id="fp_ver_group">
        <label class="flbl">${t('إصدار البرنامج')} *</label>
        <select class="fctl" id="fp_ver">
          <option value="">${t('اختر الإصدار')}</option>
          ${PROGRAM_VERSIONS.map(v => `<option value="${v}"${p.version===v?' selected':''}>${v}</option>`).join('')}
        </select>
      </div>
      <div class="fgroup">
        <label class="flbl">${t('عدد الأجهزة المرخصة')} *</label>
        <input type="number" class="fctl" id="fp_ic" min="1" value="${p.installationsCount||1}">
      </div>
    </div>
    <div class="fgroup">
      <label class="flbl">${t('تاريخ البداية / التثبيت')} <span style="color:var(--brand);font-weight:600">(${t('ترخيص مدى الحياة — Licence à vie')})</span></label>
      <input type="date" class="fctl" id="fp_sd" value="${p.startDate||td()}">
    </div>
    ${!isEdit ? `<div style="font-size:11.5px;color:var(--t2);background:rgba(10,132,255,0.08);border:1px solid rgba(10,132,255,0.22);border-radius:var(--r-sm);padding:8px 10px;margin-top:6px">${t('ملاحظة: عند إضافة نفس نوع البرنامج وإصداره، يتم دمج عدد الأجهزة تلقائياً على الترخيص الموجود دون تكرار البرنامج.')}</div>` : ''}
    <div class="facts">
      <button class="btn btn-ghost" onclick="closeModal()">${t('إلغاء')}</button>
      <button class="btn btn-primary" onclick="saveProgram(${isEdit?p.id:null})">${isEdit?t('حفظ التغييرات'):t('إضافة البرنامج')}</button>
    </div>`;
}

function renderSyncProgramVersionModal() {
  const c = gc() || clients.find(x => x.id === S.selId);
  if (!c) return '';
  const groups = getClientProgramGroups(c.programs || []);
  const selectedKey = (S.form && S.form.programKey && groups.some(g => g.key === S.form.programKey))
    ? S.form.programKey
    : (groups[0]?.key || '');
  const activeGroup = groups.find(g => g.key === selectedKey) || null;
  const currentVersText = activeGroup && activeGroup.currentVersions.length > 0
    ? activeGroup.currentVersions.join(' / ')
    : t('غير محدد');

  const isLogProgramUpdate = S.modal === 'logProgramUpdate';
  const progSelectId = isLogProgramUpdate ? 'fpu_prog' : 'vs_program';
  const verSelectId = isLogProgramUpdate ? 'fpu_ver' : 'vs_version';
  const dateInputId = isLogProgramUpdate ? 'fpu_date' : 'vs_date';
  const noteInputId = isLogProgramUpdate ? 'fpu_notes' : 'vs_note';

  return `
    <div class="mhdr">
      <div class="mtitle" style="display:flex;align-items:center;gap:8px">
        ${mIc('refresh', 16)}
        <span>${t('تحديث إصدار برنامج')}</span>
      </div>
      <button class="mclose" onclick="closeModal()">×</button>
    </div>
    ${groups.length === 0 ? `
      <div style="padding:18px;text-align:center;color:var(--t2);font-size:13px">
        ${t('لا توجد برامج مسجلة لهذا العميل لتحديث إصدارها.')}
      </div>
      <div class="facts">
        <button class="btn btn-ghost" onclick="closeModal()">${t('إغلاق')}</button>
      </div>
    ` : `
      <div style="background:rgba(10,132,255,0.07);border:1px solid rgba(10,132,255,0.22);border-radius:var(--r-sm);padding:10px 12px;margin-bottom:12px;font-size:12px;color:var(--t2);line-height:1.6">
        ${t('عند تأكيد التحديث، سيتم تحديث الإصدار تلقائياً لجميع الأجهزة والتراخيص المرتبطة بنفس البرنامج لدى هذا العميل فقط، مع تسجيل السجل التاريخي.')}
      </div>
      <div class="fgroup">
        <label class="flbl">${t('البرنامج المعني بالتحديث')} *</label>
        <select class="fctl" id="${progSelectId}" onchange="if(window.S&&window.S.form){window.S.form.programKey=this.value; window.S.form.targetVersion='';} R();">
          ${groups.map(g => `<option value="${esc(g.key)}"${g.key === selectedKey ? ' selected' : ''}>${esc(g.label)} · ${g.devicesCount} ${t('جهاز')}</option>`).join('')}
        </select>
      </div>
      ${activeGroup ? `
        <div style="background:rgba(255,255,255,0.03);border:1px solid var(--border);border-radius:var(--r-sm);padding:10px 12px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;font-size:12px">
          <span><strong style="color:var(--t2)">${t('الإصدار الحالي المسجل')}:</strong> <span class="bdg bdg-gr num">${esc(currentVersText)}</span></span>
          <span><strong style="color:var(--t2)">${t('الأجهزة التي سيتم تحديثها')}:</strong> <span class="bdg bdg-b num">${activeGroup.devicesCount} ${t('جهاز')} (${activeGroup.entriesCount} ${t('ترخيص')})</span></span>
        </div>
      ` : ''}
      <div class="frow">
        <div class="fgroup">
          <label class="flbl">${t('الإصدار الجديد (اختيار صريح)')} *</label>
          <select class="fctl" id="${verSelectId}" onchange="if(window.S&&window.S.form){window.S.form.targetVersion=this.value;}">
            <option value="" selected>${t('اختر الإصدار الجديد *')}</option>
            ${PROGRAM_VERSIONS.map(v => `<option value="${v}">${v}</option>`).join('')}
          </select>
        </div>
        <div class="fgroup">
          <label class="flbl">${t('تاريخ التحديث')} *</label>
          <input type="date" class="fctl" id="${dateInputId}" value="${td()}">
        </div>
      </div>
      <div class="fgroup">
        <label class="flbl">${t('ملاحظة التحديث')} <span style="font-size:11px;color:var(--muted)">(${t('اختياري')})</span></label>
        <textarea class="fctl" id="${noteInputId}" placeholder="${t('مثال: ترقية ميدانية أو عن بعد لجميع أجهزة العميل')}"></textarea>
      </div>
      <div class="facts">
        <button class="btn btn-ghost" onclick="closeModal()">${t('إلغاء')}</button>
        <button class="btn btn-primary" onclick="confirmProgramVersionSync(${c.id})">${t('تأكيد وتحديث الإصدار')}</button>
      </div>
    `}
  `;
}

function renderIssueModal(){
  const isEdit=S.modal==='editIssue';
  const cid=S.selId;const c=clients.find(x=>x.id===cid);if(!c)return'';
  let i={};if(isEdit){const eid=S.form.eid;i=c.issues.find(x=>x.id===eid)||{};}
  return`
    <div class="mhdr">
      <div class="mtitle">${isEdit?t('تعديل المشكلة'):t('تسجيل مشكلة جديدة')}</div>
      <button class="mclose" onclick="closeModal()">×</button>
    </div>
    <div class="fgroup"><label class="flbl">${t('عنوان المشكلة باختصار *')}</label><input class="fctl" id="fi_t" value="${esc(i.title)}" oninput="autoFillConf()"></div>
    <div class="frow">
      <div class="fgroup"><label class="flbl">${t('نوع المشكلة')}</label><select class="fctl" id="fi_ty" onchange="autoFillConf()">${selOpts(ITYPES,i.type||'خطأ تقني')}</select></div>
      <div class="fgroup"><label class="flbl">${t('المصدر')}</label><select class="fctl" id="fi_src" onchange="autoFillConf()">${selOpts(ISOURCES,i.source||'غير محدد')}</select></div>
    </div>
    <div class="frow">
      <div class="fgroup"><label class="flbl">${t('أولوية المشكلة')}</label><select class="fctl" id="fi_p">${selOpts(PRIOS,i.priority||'متوسطة')}</select></div>
      <div class="fgroup"><label class="flbl">${t('حالة المشكلة')}</label><select class="fctl" id="fi_s">${selOpts(ISTATUSES,i.status||'مفتوح')}</select></div>
    </div>
    <div class="frow">
      <div class="fgroup"><label class="flbl">${S.lang === 'fr' ? 'Répétitions' : S.lang === 'en' ? 'Repeats' : 'مرات التكرار'}</label><input type="number" class="fctl" id="fi_rc" min="1" value="${i.repeatCount||1}" oninput="autoFillConf()"></div>
      <div class="fgroup"><label class="flbl">${S.lang === 'fr' ? 'Date' : S.lang === 'en' ? 'Date' : 'التاريخ'}</label><input type="date" class="fctl" id="fi_d" value="${i.date||td()}"></div>
    </div>
    <div class="fgroup" style="background:rgba(255,255,255,0.03);padding:10px 12px;border-radius:var(--r-sm);border:1px solid var(--border)">
      <label class="flbl" style="display:flex;justify-content:space-between">
        <span>${t('نسبة الثقة التقريبية (%)')}</span>
        <span id="fi_cov" class="num" style="color:var(--brand)">${i.confidence||50}%</span>
      </label>
      <div class="conf-row">
        <input type="range" class="conf-range" id="fi_co" min="0" max="100" value="${i.confidence||50}" oninput="document.getElementById('fi_cov').textContent=this.value+'%'">
      </div>
    </div>
    <div class="fgroup" style="margin-top:10px">
      <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;color:var(--t1)">
        <input type="checkbox" id="fi_fo" ${i.featureOpp?'checked':''}>
        <strong style="display:inline-flex;align-items:center;gap:6px">${mIc('bulb', 14)} ${t('فرصة ميزة جديدة في المنظومة')}</strong>
      </label>
    </div>
    <div class="fgroup"><label class="flbl">${t('ملاحظات تقنية / تشخيص')}</label><textarea class="fctl" id="fi_no">${esc(i.notes)}</textarea></div>
    <div class="fgroup"><label class="flbl">${t('الحل المقترح أو المنفذ')}</label><textarea class="fctl" id="fi_sol">${esc(i.solution)}</textarea></div>
    <div class="facts">
      <button class="btn btn-ghost" onclick="closeModal()">${t('إلغاء')}</button>
      <button class="btn btn-primary" onclick="saveIssue(${isEdit?i.id:null})">${isEdit?t('حفظ التغييرات'):t('تسجيل المشكلة')}</button>
    </div>`;
}

function renderReqModal(){
  const isEdit=S.modal==='editReq';
  const cid=S.selId;const c=clients.find(x=>x.id===cid);if(!c)return'';
  let r={};if(isEdit){const eid=S.form.eid;r=c.requirements.find(x=>x.id===eid)||{};}
  return`
    <div class="mhdr">
      <div class="mtitle">${isEdit?t('تعديل الطلب'):t('تسجيل طلب أو ميزة جديدة')}</div>
      <button class="mclose" onclick="closeModal()">×</button>
    </div>
    <div class="fgroup"><label class="flbl">${t('عنوان الطلب *')}</label><input class="fctl" id="fr_t" value="${esc(r.title)}"></div>
    <div class="frow">
      <div class="fgroup"><label class="flbl">${t('نوع الطلب')}</label><select class="fctl" id="fr_ty">${selOpts(RTYPES,r.type||'ميزة جديدة')}</select></div>
      <div class="fgroup"><label class="flbl">${t('الأثر المتوقع')}</label><select class="fctl" id="fr_im">${selOpts(IMPACTS,r.impact||'متوسط')}</select></div>
    </div>
    <div class="frow">
      <div class="fgroup"><label class="flbl">${t('أولوية التنفيذ')}</label><select class="fctl" id="fr_p">${selOpts(PRIOS,r.priority||'متوسطة')}</select></div>
      <div class="fgroup"><label class="flbl">${t('حالة الطلب')}</label><select class="fctl" id="fr_s">${selOpts(RSTATUSES,r.status||'مقترح')}</select></div>
    </div>
    <div class="fgroup"><label class="flbl">${S.lang === 'fr' ? 'Date' : S.lang === 'en' ? 'Date' : 'التاريخ'}</label><input type="date" class="fctl" id="fr_d" value="${r.date||td()}"></div>
    <div class="fgroup"><label class="flbl">${t('تفاصيل الطلب ومبرراته')}</label><textarea class="fctl" id="fr_no">${esc(r.notes)}</textarea></div>
    <div class="facts">
      <button class="btn btn-ghost" onclick="closeModal()">${t('إلغاء')}</button>
      <button class="btn btn-primary" onclick="saveReq(${isEdit?r.id:null})">${isEdit?t('حفظ التغييرات'):t('تسجيل الطلب')}</button>
    </div>`;
}

function renderAddContactModal(){
  return`
    <div class="mhdr">
      <div class="mtitle">${t('تسجيل تواصل مع العميل')}</div>
      <button class="mclose" onclick="closeModal()">×</button>
    </div>
    <div class="fgroup"><label class="flbl">${t('تاريخ التواصل')} *</label><input type="date" class="fctl" id="fch_d" value="${td()}"></div>
    <div class="fgroup"><label class="flbl">${t('ملاحظات التواصل')} *</label><textarea class="fctl" id="fch_n" placeholder="${S.lang === 'fr' ? 'Ex: Appel téléphonique...' : S.lang === 'en' ? 'Ex: Phone call discussing...' : 'مثال: مكالمة هاتفية...'}"></textarea></div>
    <div class="facts">
      <button class="btn btn-ghost" onclick="closeModal()">${t('إلغاء')}</button>
      <button class="btn btn-primary" onclick="saveContact()">${t('حفظ التغييرات')}</button>
    </div>`;
}

function renderBackupManagerModal() {
  const list = S.backups || [];
  const locale = S.lang === 'fr' ? 'fr-FR' : (S.lang === 'en' ? 'en-US' : 'ar-DZ');
  return `
    <div class="mhdr">
      <div class="mtitle" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
        ${mIc('save', 16)}
        <span>${t('إدارة النسخ الاحتياطية')}</span>
        <span style="font-size:12px;font-weight:500;color:var(--t3)">· <span class="num">${S.lang === 'fr' ? '30 sauvegardes conservées' : S.lang === 'en' ? '30 retained backups' : '30 نسخة محفوظة'}</span></span>
      </div>
      <button class="mclose" onclick="closeModal()">×</button>
    </div>
    <div style="background:rgba(255,255,255,0.03);border:1px solid var(--border);border-radius:var(--r-sm);padding:12px;margin-bottom:1rem;font-size:12px;color:var(--t2);line-height:1.65;display:flex;align-items:flex-start;gap:10px">
      <span style="color:var(--bt);margin-top:2px">${mIc('lock', 15)}</span>
      <span>${S.lang === 'fr' 
        ? 'Les sauvegardes sont enregistrées <strong>automatiquement dans votre navigateur (IndexedDB)</strong>. Le système conserve un maximum de <strong>30 sauvegardes consécutives</strong>.'
        : S.lang === 'en'
        ? 'Backups are stored <strong>automatically in your local browser (IndexedDB)</strong>. The system retains up to <strong>30 rolling snapshots</strong>.'
        : 'يتم حفظ النسخ الاحتياطية <strong>تلقائياً وبشكل دوري في جهازك (IndexedDB)</strong> بشكل معزول لكل مستخدم. يحتفظ النظام بحد أقصى <strong>30 نسخة متعاقبة</strong>.'}</span>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;gap:10px;flex-wrap:wrap">
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        <button class="btn btn-primary btn-sm" onclick="triggerManualBackup()">${mIc('save', 14)} ${t('إنشاء نسخة الآن')}</button>
        <label class="btn btn-outline btn-sm" style="cursor:pointer;margin:0;display:inline-flex;align-items:center;gap:6px" title="${t('استيراد ملف .dum أو .json')}">
          ${mIc('upload', 14)} ${S.lang === 'fr' ? 'Importer (.dum / .json)' : (S.lang === 'en' ? 'Import (.dum / .json)' : 'استيراد (.dum / .json)')}
          <input type="file" accept=".dum,.dump,.json,.txt,.csv" style="display:none" onchange="importData(this.files[0]);this.value=''">
        </label>
      </div>
      <button class="btn btn-outline btn-sm" onclick="loadBackupsList()">${mIc('refresh', 14)} ${t('تحديث')}</button>
    </div>
    <div style="max-height:300px;overflow-y:auto;display:flex;flex-direction:column;gap:8px" class="custom-scrollbar">
      ${list.length === 0
        ? `<div style="text-align:center;padding:2rem;color:var(--t3);font-size:12px;display:flex;flex-direction:column;align-items:center;gap:8px">${mIc('inbox', 24)}<span>${S.lang === 'fr' ? 'Aucune sauvegarde archivée pour l\'instant.' : S.lang === 'en' ? 'No backups saved yet.' : 'لا توجد نسخ احتياطية مسجلة بعد.'}</span></div>`
        : list.map((b) => {
            const dateStr = new Date(b.timestamp).toLocaleString(locale, {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            });
            const clientCount = b.clients?.length || 0;
            const programCount = b.clients?.reduce((acc, c) => acc + (c.programs?.length || 0), 0) || 0;
            return `
              <div style="background:rgba(255,255,255,0.03);border:1px solid var(--border);border-radius:var(--r-sm);padding:12px;display:flex;flex-direction:column;gap:6px">
                <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap">
                  <strong style="font-size:12.5px;color:var(--t1)">${esc(b.reason || (S.lang === 'fr' ? 'Sauvegarde système' : S.lang === 'en' ? 'System Snapshot' : 'نسخة احتياطية بدون عنوان'))}</strong>
                  <span class="num" style="font-size:11px;color:var(--t3)" dir="ltr">${dateStr}</span>
                </div>
                <div style="font-size:11.5px;color:var(--t2);display:flex;gap:10px;align-items:center;flex-wrap:wrap">
                  <span style="display:inline-flex;align-items:center;gap:4px">${mIc('users', 12)} ${t('العملاء')}: <strong class="num" style="color:var(--t1)">${clientCount}</strong></span>
                  <span aria-hidden="true">·</span>
                  <span style="display:inline-flex;align-items:center;gap:4px">${mIc('desktop', 12)} ${t('البرامج')}: <strong class="num" style="color:var(--t1)">${programCount}</strong></span>
                </div>
                <div style="display:flex;gap:6px;margin-top:4px;flex-wrap:wrap">
                  <button class="btn btn-outline btn-xs" onclick="downloadBackup('${b.id}', 'json')">${mIc('download', 12)} JSON</button>
                  <button class="btn btn-outline btn-xs" onclick="downloadBackup('${b.id}', 'dum')">${mIc('save', 12)} DUM</button>
                  <button class="btn btn-success-soft btn-xs" onclick="triggerRestore('${b.id}')" style="font-weight:700">${mIc('refresh', 12)} ${S.lang === 'fr' ? 'Restaurer' : S.lang === 'en' ? 'Restore' : 'استرجاع هذه النسخة'}</button>
                  <button class="btn btn-danger-soft btn-xs" onclick="triggerDeleteBackup('${b.id}')">${mIc('trash', 12)} ${t('حذف')}</button>
                </div>
              </div>
            `;
          }).join('')}
    </div>
    <div class="facts" style="margin-top:1.5rem;padding-top:1rem;border-top:1px solid var(--border)">
      <button class="btn btn-ghost" onclick="closeModal()">${t('إغلاق')}</button>
    </div>
  `;
}

function renderConflictModal() {
  const item = S.conflictItem;
  const serverData = S.conflictServerData;
  if (!item || !serverData) return '';
  const localClient = item.payload?.clientData || clients.find(c => String(c?.id) === String(item.payload?.clientId)) || {};
  const isSubItem = item.type === 'SAVE_SUB_ITEM' || item.type === 'DELETE_SUB_ITEM';
  const isVersionSync = item.type === 'SYNC_PROGRAM_VERSION';
  const localVersionLabel = isVersionSync
    ? `${item.payload?.programLabel || ''} → ${item.payload?.newVersion || ''} (أساس #${item.payload?.baseVersion ?? 0})`
    : (isSubItem
      ? `${item.payload?.collectionName || ''} #${item.payload?.itemId || ''} (أساس #${item.payload?.concurrency?.baseVersion ?? 0})`
      : `${localClient.version || 0}`);
  const localSummaryTitle = isVersionSync
    ? `ترقية ${item.payload?.programLabel || 'برنامج'} إلى ${item.payload?.newVersion || ''}`
    : (isSubItem
      ? `${item.payload?.itemData?.programName || item.payload?.itemData?.title || item.payload?.itemData?.note || item.payload?.collectionName || 'تعديل فرعي'}`
      : (localClient.fullName || 'غير محدد'));

  return `
    <div class="mhdr">
      <div class="mtitle" style="color: var(--rt); display:flex; align-items:center; gap:8px;">
        ${mIc('warn', 17)}
        <span>تعارض في المزامنة (Conflict)</span>
      </div>
      <button class="mclose" onclick="closeModal()">×</button>
    </div>
    <div class="mbdy">
      <p style="margin-bottom: 14px; font-size: 13.5px; color: var(--t2); line-height: 1.65;">
        تم تعديل هذا السجل في السحابة بواسطة جلسة أو مستخدم آخر قبل إتمام حفظك. يرجى اختيار النسخة التي ترغب في اعتمادها حتى لا تُفقد أي بيانات.
      </p>
      
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; margin-bottom: 20px;">
        <div style="border: 1px solid rgba(10,132,255,0.28); border-radius: var(--r-sm); padding: 14px; background: rgba(10,132,255,0.06);">
          <h4 style="margin-top:0; margin-bottom:8px; color: var(--bt); font-size: 13.5px; font-weight:700;">بيانات الخادم (الأحدث)</h4>
          <ul style="padding-inline-start: 18px; font-size: 13px; color: var(--t1); margin-bottom: 0; line-height: 1.7;">
            <li><strong style="color:var(--t2)">العميل:</strong> ${esc(serverData.fullName || 'غير محدد')}</li>
            <li><strong style="color:var(--t2)">الحالة:</strong> ${esc(serverData.status || 'غير محدد')}</li>
            <li><strong style="color:var(--t2)">رقم النسخة:</strong> <span class="num">${serverData.version || 0}</span></li>
          </ul>
        </div>
        
        <div style="border: 1px solid rgba(48,209,88,0.28); border-radius: var(--r-sm); padding: 14px; background: rgba(48,209,88,0.06);">
          <h4 style="margin-top:0; margin-bottom:8px; color: var(--gt); font-size: 13.5px; font-weight:700;">تعديلك المحلي (بانتظار التأكيد)</h4>
          <ul style="padding-inline-start: 18px; font-size: 13px; color: var(--t1); margin-bottom: 0; line-height: 1.7;">
            <li><strong style="color:var(--t2)">التعديل:</strong> ${esc(localSummaryTitle)}</li>
            <li><strong style="color:var(--t2)">الحالة:</strong> ${esc(localClient.status || serverData.status || 'غير محدد')}</li>
            <li><strong style="color:var(--t2)">النسخة المرجعية:</strong> <span class="num">${esc(localVersionLabel)}</span></li>
          </ul>
        </div>
      </div>
    </div>
    <div class="facts" style="justify-content: flex-start; gap: 8px; flex-wrap: wrap;">
      <button class="btn btn-success-soft" style="flex:1;" onclick="resolveConflict('local')">الاحتفاظ بتعديلاتي</button>
      <button class="btn btn-primary" style="flex:1;" onclick="resolveConflict('server')">اعتماد بيانات الخادم</button>
      <button class="btn btn-outline" onclick="resolveConflict('merge')" style="flex:1;">${S.lang === 'fr' ? 'Fusionner les deux' : S.lang === 'en' ? 'Keep both' : 'دمج الخيارين'}</button>
    </div>
  `;
}

function renderDbPurgeModal() {
  const tab = S.purgeTab || 'filtered';
  const filterType = S.purgeFilterType || 'stopped_clients';
  const days = S.purgeOlderThanDays || 30;
  const programMode = S.purgeProgramMode || 'all_with_programs';
  const targetDate = S.purgeTargetDate || '';
  const targetDateMode = S.purgeTargetDateMode || 'exact';
  const mdNamesCount = Array.isArray(S.purgeMdClientNames) ? S.purgeMdClientNames.length : 0;
  const mdFileName = S.purgeMdFileName || '';
  const sim = S.purgeSimulation || { totalClientsAffected: 0, clientsDeletedCount: 0, clientsKeptCount: 0, programsCount: 0, issuesCount: 0, reqsCount: 0, contactsCount: 0, estimatedFreedKb: '0', sampleClients: [] };
  const confirmText = S.purgeConfirmText || '';
  const requiredCode = tab === 'all' ? 'DELETE-ALL-DATA' : 'CONFIRM-PURGE';
  const isMatch = confirmText.trim() === requiredCode;
  const selective = S.purgeSelectiveCollections || {};
  const progress = S.purgeProgress;
  const auditLogs = getPurgeAuditLogs();

  const clientsPreserved = (sim.clientsDeletedCount === 0) && (
    (tab === 'filtered' && (filterType === 'client_programs' || filterType === 'solved_issues' || filterType === 'old_contacts')) ||
    (tab === 'selective' && !selective.clients)
  );

  const totalClients = clients.length;
  const totalProgs = clients.reduce((acc, c) => acc + (c.programs || []).length, 0);
  const totalIssues = clients.reduce((acc, c) => acc + (c.issues || []).length, 0);

  const titleText = S.lang === 'fr' 
    ? 'Console de purge et de maintenance de la base de données'
    : (S.lang === 'en'
      ? 'Database purge and maintenance console'
      : 'لوحة تصفية ومحو قاعدة البيانات');

  const subTitleText = S.lang === 'fr'
    ? 'Gestion des opérations de purge, archivage et nettoyage sécurisé des données'
    : (S.lang === 'en'
      ? 'Management of data purging, archiving, and secure sanitization'
      : 'إدارة عمليات التصفية، الأرشفة، والتطهير الآمن لسجلات البيانات');

  return `
    <div class="mhdr" style="border-bottom: 1px solid var(--border); padding-bottom: 14px; margin-bottom: 0;">
      <div class="mtitle" style="display:flex;align-items:center;gap:10px;font-size:16px;font-weight:700">
        <span style="width:34px;height:34px;border-radius:10px;background:rgba(10,132,255,0.14);border:1px solid rgba(10,132,255,0.28);color:var(--bt);display:inline-flex;align-items:center;justify-content:center">${mIc('shield', 17)}</span>
        <div>
          <div style="color:var(--t1)">${titleText}</div>
          <div style="font-size:11.5px;font-weight:400;color:var(--t3);margin-top:2px">${subTitleText}</div>
        </div>
      </div>
      <button class="mclose" onclick="closeModal()">×</button>
    </div>

    <!-- Live Summary Strip -->
    <div style="background:rgba(255,255,255,0.03);border-bottom:1px solid var(--border);padding:10px 4px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;font-size:12px;color:var(--t2)">
      <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
        <span style="color:var(--bt);font-weight:600;display:inline-flex;align-items:center;gap:6px">${mIc('cloud', 14)} ${S.lang === 'fr' ? 'Firestore connecté' : S.lang === 'en' ? 'Firestore connected' : 'متصل بقاعدة فايرستور'}</span>
        <span aria-hidden="true">·</span>
        <span style="display:inline-flex;align-items:center;gap:5px">${mIc('users', 13)} ${t('العملاء')}: <strong class="num" style="color:var(--t1)">${totalClients}</strong></span>
        <span aria-hidden="true">·</span>
        <span style="display:inline-flex;align-items:center;gap:5px">${mIc('box', 13)} ${t('البرامج')}: <strong class="num" style="color:var(--t1)">${totalProgs}</strong></span>
        <span aria-hidden="true">·</span>
        <span style="display:inline-flex;align-items:center;gap:5px">${mIc('bug', 13)} ${t('التذاكر والمشاكل')}: <strong class="num" style="color:var(--t1)">${totalIssues}</strong></span>
      </div>
      <span style="font-size:11.5px;color:var(--t3)">${S.lang==='fr'?'Opérateur':S.lang==='en'?'Operator':'المشغل'}: <span style="color:var(--bt)" dir="ltr">${esc(S.currentUser?.email || 'Admin')}</span></span>
    </div>

    <!-- Purge Mode Tabs -->
    <div style="display:flex;border-bottom:1px solid var(--border);gap:4px;overflow-x:auto">
      <button class="btn" style="border:none;border-bottom:2px solid ${tab==='filtered'?'var(--bt)':'transparent'};background:transparent;color:${tab==='filtered'?'var(--bt)':'var(--t3)'};font-weight:600;font-size:12px;padding:10px 14px;border-radius:0;display:inline-flex;align-items:center;gap:6px;white-space:nowrap" onclick="setPurgeTab('filtered')">${mIc('target', 14)} ${S.lang==='fr'?'Filtre intelligent':S.lang==='en'?'Smart filter':'تصفية بشرط'}</button>
      <button class="btn" style="border:none;border-bottom:2px solid ${tab==='selective'?'var(--bt)':'transparent'};background:transparent;color:${tab==='selective'?'var(--bt)':'var(--t3)'};font-weight:600;font-size:12px;padding:10px 14px;border-radius:0;display:inline-flex;align-items:center;gap:6px;white-space:nowrap" onclick="setPurgeTab('selective')">${mIc('flame', 14)} ${S.lang==='fr'?'Portée sélective':S.lang==='en'?'Selective scope':'محو مخصص'}</button>
      <button class="btn" style="border:none;border-bottom:2px solid ${tab==='all'?'var(--rt)':'transparent'};background:transparent;color:${tab==='all'?'var(--rt)':'var(--t3)'};font-weight:600;font-size:12px;padding:10px 14px;border-radius:0;display:inline-flex;align-items:center;gap:6px;white-space:nowrap" onclick="setPurgeTab('all')">${mIc('warn', 14)} ${S.lang==='fr'?'Réinitialisation totale':S.lang==='en'?'Complete reset':'إعادة ضبط كاملة'}</button>
      <button class="btn" style="border:none;border-bottom:2px solid ${tab==='audit'?'var(--pt)':'transparent'};background:transparent;color:${tab==='audit'?'var(--pt)':'var(--t3)'};font-weight:600;font-size:12px;padding:10px 14px;border-radius:0;margin-inline-start:auto;display:inline-flex;align-items:center;gap:6px;white-space:nowrap" onclick="setPurgeTab('audit')">${mIc('scroll', 14)} ${S.lang==='fr'?'Journaux d\'audit':S.lang==='en'?'Audit Logs':'سجلات التدقيق'} (<span class="num">${auditLogs.length}</span>)</button>
    </div>

    <div style="padding:16px 4px;max-height:480px;overflow-y:auto">

      ${tab === 'audit' ? renderAuditTabContent(auditLogs) : `

        <!-- Configuration Panel for Active Tab -->
        ${tab === 'filtered' ? `
          <div style="background:rgba(255,255,255,0.03);border:1px solid var(--border);border-radius:var(--r-md);padding:14px;margin-bottom:14px">
            <label class="flbl" style="font-weight:700;margin-bottom:8px;display:block">${S.lang==='fr'?'Critère de purge et filtrage :':S.lang==='en'?'Purge and filter criteria:':'اختر معيار التصفية والتطهير:'}</label>
            <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(220px, 1fr));gap:10px;margin-bottom:12px">
              <label style="display:flex;align-items:center;gap:8px;padding:10px;background:rgba(255,255,255,0.03);border:1px solid ${filterType==='client_programs'?'var(--brand)':'var(--border)'};border-radius:var(--r-sm);cursor:pointer">
                <input type="radio" name="pft" ${filterType==='client_programs'?'checked':''} onchange="setPurgeFilterType('client_programs')">
                <div>
                  <strong style="font-size:12px;display:block;color:var(--t1)">${S.lang==='fr'?'Supprimer uniquement les logiciels (garder clients)':S.lang==='en'?'Delete programs only (keep client names)':'حذف برامج العملاء فقط (الإبقاء على الأسماء)'}</strong>
                  <span style="font-size:11px;color:var(--t3)">${S.lang==='fr'?'Efface les licences en conservant tous les noms de clients':S.lang==='en'?'Deletes software licenses while keeping client names intact':'مسح التراخيص والبرامج مع الاحتفاظ بأسماء وسجلات العملاء'}</span>
                </div>
              </label>

              <label style="display:flex;align-items:center;gap:8px;padding:10px;background:rgba(255,255,255,0.03);border:1px solid ${filterType==='stopped_clients'?'var(--brand)':'var(--border)'};border-radius:var(--r-sm);cursor:pointer">
                <input type="radio" name="pft" ${filterType==='stopped_clients'?'checked':''} onchange="setPurgeFilterType('stopped_clients')">
                <div>
                  <strong style="font-size:12px;display:block;color:var(--t1)">${S.lang==='fr'?'Purger clients non confirmés / anciens':S.lang==='en'?'Purge unconfirmed / stopped clients':'حذف العملاء غير المؤكدين / المتوقفين'}</strong>
                  <span style="font-size:11px;color:var(--t3)">${S.lang==='fr'?'Clients non confirmés ou ancien statut inactif selon l’ancienneté':S.lang==='en'?'Unconfirmed clients or legacy stopped status older than threshold':'العملاء بحالة "غير مؤكد" أو الحالة القديمة "متوقف"'}</span>
                </div>
              </label>

              <label style="display:flex;align-items:center;gap:8px;padding:10px;background:rgba(255,255,255,0.03);border:1px solid ${filterType==='solved_issues'?'var(--brand)':'var(--border)'};border-radius:var(--r-sm);cursor:pointer">
                <input type="radio" name="pft" ${filterType==='solved_issues'?'checked':''} onchange="setPurgeFilterType('solved_issues')">
                <div>
                  <strong style="font-size:12px;display:block;color:var(--t1)">${S.lang==='fr'?'Purger tickets résolus':S.lang==='en'?'Purge solved issues':'تصفية المشاكل المغلقة'}</strong>
                  <span style="font-size:11px;color:var(--t3)">${S.lang==='fr'?'Nettoyer définitivement les tickets résolus':S.lang==='en'?'Clean permanently resolved tickets':'تنظيف التذاكر المحلولة نهائياً'}</span>
                </div>
              </label>

              <label style="display:flex;align-items:center;gap:8px;padding:10px;background:rgba(255,255,255,0.03);border:1px solid ${filterType==='old_contacts'?'var(--brand)':'var(--border)'};border-radius:var(--r-sm);cursor:pointer">
                <input type="radio" name="pft" ${filterType==='old_contacts'?'checked':''} onchange="setPurgeFilterType('old_contacts')">
                <div>
                  <strong style="font-size:12px;display:block;color:var(--t1)">${S.lang==='fr'?'Purger anciens contacts':S.lang==='en'?'Purge old contact records':'تصفية سجلات التواصل القديمة'}</strong>
                  <span style="font-size:11px;color:var(--t3)">${S.lang==='fr'?'Supprimer les anciens historiques':S.lang==='en'?'Delete historical interactions':'حذف الملاحظات التاريخية القديمة'}</span>
                </div>
              </label>
            </div>

            ${filterType === 'client_programs' ? `
              <div style="display:flex;flex-direction:column;gap:10px;margin-top:10px;background:rgba(255,255,255,0.02);padding:12px;border-radius:var(--r-sm);border:1px solid var(--border)">
                <div style="font-size:12px;font-weight:700;color:var(--t1);display:flex;align-items:center;gap:6px">${mIc('target', 14)} ${S.lang==='fr'?'Ciblage des clients concernés (noms conservés) :':S.lang==='en'?'Target clients (client names will be kept):':'تحديد العملاء المراد حذف برامجهم (الأسماء ستبقى محفوظة):'}</div>
                <div style="display:flex;gap:8px;flex-wrap:wrap">
                  <button type="button" class="btn btn-xs ${programMode==='all_with_programs'?'btn-primary':'btn-ghost'}" onclick="setPurgeProgramMode('all_with_programs')">
                    ${mIc('box', 13)} ${S.lang==='fr'?'Tous les clients avec logiciels':S.lang==='en'?'All clients with programs':'كل العملاء أصحاب البرامج'}
                  </button>
                  <button type="button" class="btn btn-xs ${programMode==='by_date'?'btn-primary':'btn-ghost'}" onclick="setPurgeProgramMode('by_date')">
                    ${mIc('calendar', 13)} ${S.lang==='fr'?'Par date':S.lang==='en'?'By date':'حسب التاريخ'}
                  </button>
                  <button type="button" class="btn btn-xs ${programMode==='from_md'?'btn-primary':'btn-ghost'}" onclick="setPurgeProgramMode('from_md')">
                    ${mIc('fileText', 13)} ${S.lang==='fr'?'Depuis un fichier .md':S.lang==='en'?'From Markdown (.md) file':'من ملف Markdown (.md)'}
                  </button>
                </div>

                ${programMode === 'by_date' ? `
                  <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding-top:6px;border-top:1px dashed var(--border)">
                    <label style="font-size:12px;font-weight:600">${S.lang==='fr'?'Date cible :':S.lang==='en'?'Target date:':'التاريخ المستهدف:'}</label>
                    <input type="date" class="fctl" style="width:170px;margin:0" value="${esc(targetDate)}" onchange="setPurgeTargetDate(this.value)">
                    <select class="fctl" style="width:180px;margin:0" onchange="setPurgeTargetDateMode(this.value)">
                      <option value="exact" ${targetDateMode==='exact'?'selected':''}>${S.lang==='fr'?'Uniquement cette date':S.lang==='en'?'Exact date only':'في هذا التاريخ فقط'}</option>
                      <option value="since" ${targetDateMode==='since'?'selected':''}>${S.lang==='fr'?'Depuis cette date (≥)':S.lang==='en'?'Since this date (≥)':'منذ هذا التاريخ فأحدث (≥)'}</option>
                    </select>
                  </div>
                ` : ''}

                ${programMode === 'from_md' ? `
                  <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding-top:6px;border-top:1px dashed var(--border)">
                    <input type="file" accept=".md,.txt" onchange="handlePurgeMdFileUpload(this)" style="font-size:12px">
                    ${mdNamesCount > 0 ? `
                      <span class="num" style="font-size:11.5px;color:var(--gt);font-weight:700;display:inline-flex;align-items:center;gap:4px">
                        ${mIc('check', 13)} ${esc(mdFileName)} (${mdNamesCount} ${S.lang==='fr'?'noms':S.lang==='en'?'names':'اسم عميل'})
                      </span>
                      <button type="button" class="btn btn-ghost btn-xs" onclick="clearPurgeMdClients()" style="color:var(--rt)">${mIc('trash', 12)} ${t('مسح')}</button>
                    ` : `<span style="font-size:11px;color:var(--t3)">${S.lang==='fr'?'Importez le fichier .md exporté (titres ## Nom)':S.lang==='en'?'Upload exported .md file (## Client Name headings)':'ارفع ملف .md المصدّر لمطابقة أسماء العملاء تلقائياً'}</span>`}
                  </div>
                ` : ''}
              </div>
            ` : ''}

            ${filterType === 'stopped_clients' || filterType === 'old_contacts' ? `
              <div style="display:flex;align-items:center;gap:12px;margin-top:10px;background:rgba(255,255,255,0.02);padding:10px;border-radius:var(--r-sm);border:1px solid var(--border)">
                <label style="font-size:12px;font-weight:600">${S.lang==='fr'?'Plus ancien que :':S.lang==='en'?'Older than:':'اقدم من كم يوم؟'}</label>
                <input type="number" class="fctl num" style="width:100px;margin:0" value="${days}" min="1" max="365" oninput="setPurgeOlderThanDays(this.value)">
                <span style="font-size:12px;color:var(--t3)">${S.lang==='fr'?'jours (30 jours par défaut)':S.lang==='en'?'days (default 30 days)':'يوم (الافتراضي 30 يوم)'}</span>
              </div>
            ` : ''}
          </div>
        ` : ''}

        ${tab === 'selective' ? `
          <div style="background:rgba(255,255,255,0.03);border:1px solid var(--border);border-radius:var(--r-md);padding:14px;margin-bottom:14px">
            <label class="flbl" style="font-weight:700;margin-bottom:8px;display:block">${S.lang==='fr'?'Sélectionnez les catégories à supprimer du cloud :':S.lang==='en'?'Select categories to purge from cloud:':'حدد الفئات والمجموعات المراد حذفها من السحابة:'}</label>
            <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(180px, 1fr));gap:10px">
              ${[
                { id: 'clients', ico: 'users', label: S.lang==='fr'?'Clients':S.lang==='en'?'Clients':'العملاء', sub: S.lang==='fr'?'Tous les clients':S.lang==='en'?'All client records':'سجلات جميع العملاء' },
                { id: 'programs', ico: 'box', label: S.lang==='fr'?'Logiciels & Licences':S.lang==='en'?'Software & Licenses':'البرامج والتراخيص', sub: S.lang==='fr'?'Licences et postes':S.lang==='en'?'Licenses and devices':'تراخيص وأجهزة البرامج' },
                { id: 'issues', ico: 'bug', label: S.lang==='fr'?'Tickets & Anomalies':S.lang==='en'?'Issues & Tickets':'التذاكر والمشاكل', sub: S.lang==='fr'?'Tous les tickets':S.lang==='en'?'All issue tickets':'جميع تذاكر المتابعة' },
                { id: 'requirements', ico: 'bulb', label: S.lang==='fr'?'Demandes & Besoins':S.lang==='en'?'Requirements & Ideas':'المتطلبات والاقتراحات', sub: S.lang==='fr'?'Demandes de fonctionnalités':S.lang==='en'?'Feature requests':'طلبات الميزات' },
                { id: 'contacts', ico: 'fileText', label: S.lang==='fr'?'Historique Contacts':S.lang==='en'?'Contact History':'سجلات التواصل', sub: S.lang==='fr'?'Appels et réunions':S.lang==='en'?'Calls and meetings':'سجلات المكالمات والاجتماعات' },
                { id: 'cache', ico: 'trash', label: 'IndexedDB Cache', sub: S.lang==='fr'?'Purger cache local':S.lang==='en'?'Clear local cache':'تطهير الذاكرة المحلية' }
              ].map(item => `
                <label style="display:flex;align-items:flex-start;gap:8px;padding:10px;background:rgba(255,255,255,0.03);border:1px solid ${selective[item.id]?'var(--brand)':'var(--border)'};border-radius:var(--r-sm);cursor:pointer">
                  <input type="checkbox" ${selective[item.id]?'checked':''} onchange="togglePurgeSelectiveCollection('${item.id}')">
                  <div>
                    <strong style="font-size:12px;display:flex;align-items:center;gap:5px;color:var(--t1)">${mIc(item.ico, 13)} ${item.label}</strong>
                    <span style="font-size:10.5px;color:var(--t3)">${item.sub}</span>
                  </div>
                </label>
              `).join('')}
            </div>
          </div>
        ` : ''}

        ${tab === 'all' ? `
          <div style="background:rgba(255,69,58,0.10);border:1px solid rgba(255,69,58,0.32);border-radius:var(--r-md);padding:14px;margin-bottom:14px;color:var(--rt)">
            <div style="font-weight:800;font-size:14px;margin-bottom:6px;display:flex;align-items:center;gap:7px">${mIc('warn', 16)} ${S.lang==='fr'?'Avertissement de risque élevé : suppression totale de la base de données':S.lang==='en'?'High-risk warning: complete database wipe':'تحذير عالي الخطورة: محو كامل لقاعدة البيانات'}</div>
            <div style="font-size:12px;line-height:1.6;color:var(--t1)">
              ${S.lang==='fr'
                ?'Tous les clients, logiciels, tickets et demandes seront définitivement supprimés de <strong>Firestore Cloud</strong>, et les compteurs remis à zéro. Cette action est irréversible !'
                :(S.lang==='en'
                  ?'All clients, software, issues, and requirements will be permanently deleted from <strong>Firestore Cloud</strong>, and stats reset to zero. This action is irreversible!'
                  :'سيتم مسح جميع العملاء، البرامج، المشاكل، والمتطلبات نهائياً من سيرفر <strong>Firestore Cloud</strong> وتصفير جميع العدادات وإحصائيات المستخدم. لا يمكن التراجع عن هذه العملية بعد إتمامها!')}
            </div>
          </div>
        ` : ''}

        <!-- Dry Run / Simulation Results Panel -->
        <div style="background:rgba(255,255,255,0.03);border:1px solid var(--border);border-radius:var(--r-md);padding:14px;margin-bottom:14px;color:var(--t1)">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;gap:8px;flex-wrap:wrap">
            <span style="font-size:12px;font-weight:700;color:var(--bt);display:flex;align-items:center;gap:6px">${mIc('chart', 14)} ${S.lang==='fr'?'Analyse de Simulation (Dry Run Analysis)':S.lang==='en'?'Simulation Results (Dry Run Analysis)':'نتائج محاكاة المعاينة الفورية (Dry Run Analysis)'}</span>
            <span style="font-size:11px;color:var(--t3)">${S.lang==='fr'?'Aperçu avant exécution':S.lang==='en'?'Pre-execution Preview':'معاينة قبل التنفيذ'}</span>
          </div>

          ${clientsPreserved && sim.totalClientsAffected > 0 ? `
            <div style="background:rgba(48,209,88,0.10);border:1px solid rgba(48,209,88,0.28);color:var(--gt);border-radius:var(--r-sm);padding:8px 10px;font-size:11.5px;font-weight:700;margin-bottom:10px;display:flex;align-items:center;gap:6px">
              ${mIc('shield', 14)}
              <span>${S.lang==='fr'
                ? `Les noms et dossiers des clients (${sim.totalClientsAffected}) seront conservés — 0 client supprimé !`
                : (S.lang==='en'
                  ? `Client names & records (${sim.totalClientsAffected}) will be preserved — 0 clients deleted!`
                  : `سيتم الإبقاء على أسماء وسجلات جميع العملاء (${sim.totalClientsAffected} عميل) — 0 عميل سيتم حذفه!`)}</span>
            </div>
          ` : ''}

          <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(110px, 1fr));gap:8px;margin-bottom:12px">
            <div style="background:rgba(255,255,255,0.03);border:1px solid var(--border);border-radius:var(--r-sm);padding:10px;text-align:center">
              <div class="num" style="font-size:17px;font-weight:800;color:${clientsPreserved ? 'var(--gt)' : (sim.totalClientsAffected>0?'var(--rt)':'var(--gt)')}">${sim.totalClientsAffected}</div>
              <div style="font-size:10.5px;color:var(--t3);margin-top:2px">${clientsPreserved ? (S.lang==='fr'?'Clients conservés':S.lang==='en'?'Clients preserved':'عميل محتفظ به') : (S.lang==='fr'?'Clients supprimés':S.lang==='en'?'Clients deleted':'عميل متأثر')}</div>
            </div>
            <div style="background:rgba(255,255,255,0.03);border:1px solid var(--border);border-radius:var(--r-sm);padding:10px;text-align:center">
              <div class="num" style="font-size:17px;font-weight:800;color:${sim.programsCount>0?'var(--wt)':'var(--t3)'}">${sim.programsCount}</div>
              <div style="font-size:10.5px;color:var(--t3);margin-top:2px">${S.lang==='fr'?'Logiciels à supprimer':S.lang==='en'?'Programs to delete':'برامج سيتم حذفها'}</div>
            </div>
            <div style="background:rgba(255,255,255,0.03);border:1px solid var(--border);border-radius:var(--r-sm);padding:10px;text-align:center">
              <div class="num" style="font-size:17px;font-weight:800;color:${sim.issuesCount>0?'var(--wt)':'var(--t3)'}">${sim.issuesCount}</div>
              <div style="font-size:10.5px;color:var(--t3);margin-top:2px">${S.lang==='fr'?'Tickets':S.lang==='en'?'Issues':'مشكلة وتذكرة'}</div>
            </div>
            <div style="background:rgba(255,255,255,0.03);border:1px solid var(--border);border-radius:var(--r-sm);padding:10px;text-align:center">
              <div class="num" style="font-size:17px;font-weight:800;color:var(--bt)">${sim.estimatedFreedKb} KB</div>
              <div style="font-size:10.5px;color:var(--t3);margin-top:2px">${S.lang==='fr'?'Espace libéré':S.lang==='en'?'Freed space':'مساحة محررة'}</div>
            </div>
          </div>

          ${sim.sampleClients && sim.sampleClients.length > 0 ? `
            <div style="font-size:11px;color:var(--t3);margin-bottom:6px">${clientsPreserved ? (S.lang==='fr'?'Échantillon de clients ciblés (noms conservés) :':S.lang==='en'?'Sample targeted clients (names preserved):':'عينة العملاء المستهدفين (الأسماء ستبقى محفوظة):') : (S.lang==='fr'?'Échantillon de clients ciblés :':S.lang==='en'?'Sample affected clients:':'عينة المخرجات المشمولة بالحذف:')}</div>
            <div style="font-size:12px;color:var(--t2);line-height:1.6">
              ${sim.sampleClients.map(sc => `${esc(sc.fullName)} (${esc(sc.company || '—')})`).join(' · ')}
              ${sim.totalClientsAffected > sim.sampleClients.length ? ` · + ${sim.totalClientsAffected - sim.sampleClients.length} ${S.lang==='fr'?'autres clients...':S.lang==='en'?'other clients...':'عميل آخر...'}` : ''}
            </div>
          ` : `<div style="font-size:11.5px;color:var(--t3);text-align:center">${S.lang==='fr'?'Aucun enregistrement ne correspond actuellement à ces conditions.':S.lang==='en'?'No records currently match these conditions.':'لا توجد سجلات تنطبق عليها هذه الشروط حالياً.'}</div>`}
        </div>

        <!-- Protection & Operator Safeguards -->
        <div style="background:rgba(255,255,255,0.03);border:1px solid var(--border);border-radius:var(--r-md);padding:14px;margin-bottom:14px">
          <div style="font-size:12px;font-weight:700;margin-bottom:10px;color:var(--t1);display:flex;align-items:center;gap:6px">${mIc('shield', 14)} ${S.lang==='fr'?'Options de sécurité et sauvegarde préventive :':S.lang==='en'?'Safety & Backup Safeguards:':'خيارات الأمان والنسخ الوقائي:'}</div>
          
          <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:12px">
            <label style="display:flex;align-items:center;gap:8px;font-size:12px;cursor:pointer;color:var(--t2)">
              <input type="checkbox" id="p_ab" ${S.purgeAutoBackup !== false ? 'checked' : ''} onchange="updateState({ purgeAutoBackup: this.checked })">
              <span><strong style="color:var(--t1)">${S.lang==='fr'?'Sauvegarde locale automatique':S.lang==='en'?'Automatic local backup':'أخذ نسخة احتياطية محلية تلقائية'}</strong> ${S.lang==='fr'?'dans IndexedDB avant tout effacement':S.lang==='en'?'in IndexedDB before purging data':'في IndexedDB قبل البدء بمحو أي بيانات'}</span>
            </label>
            <label style="display:flex;align-items:center;gap:8px;font-size:12px;cursor:pointer;color:var(--t2)">
              <input type="checkbox" id="p_db" ${S.purgeDownloadBackup !== false ? 'checked' : ''} onchange="updateState({ purgeDownloadBackup: this.checked })">
              <span><strong style="color:var(--t1)">${S.lang==='fr'?'Télécharger le fichier de sauvegarde (.json)':S.lang==='en'?'Download backup file (.json)':'تنزيل ملف النسخة الاحتياطية (.json)'}</strong> ${S.lang==='fr'?'directement sur votre appareil':S.lang==='en'?'directly to your device':'مباشرة لجهازك عند البدء'}</span>
            </label>
          </div>

          <div class="fgroup" style="margin-bottom:12px">
            <label class="flbl" style="font-size:11.5px">${S.lang==='fr'?'Motif / Note de l\'opérateur :':S.lang==='en'?'Reason / Operator note:':'سبب العملية / ملاحظة مسؤول النظام:'}</label>
            <input class="fctl" style="font-size:12px" value="${esc(S.purgeOperatorNote || '')}" oninput="updateState({ purgeOperatorNote: this.value })" placeholder="${S.lang==='fr'?'Ex: Nettoyage mensuel':S.lang==='en'?'E.g.: Monthly cleanup':'مثال: تنظيف دوري بنهاية الشهر'}">
          </div>

          <!-- Type-to-Confirm Guard -->
          <div style="background:rgba(255,255,255,0.03);border:1px solid var(--border);border-radius:var(--r-sm);padding:12px;color:var(--t1)">
            <div style="font-size:12px;font-weight:700;color:var(--rt);margin-bottom:6px;display:flex;align-items:center;gap:6px">${mIc('lock', 14)} ${S.lang==='fr'?'Confirmation par saisie du code :':S.lang==='en'?'Enter the confirmation code:':'تأكيد العملية بكتابة الرمز:'}</div>
            <div style="font-size:11.5px;color:var(--t2);margin-bottom:8px">
              ${S.lang==='fr'?'Veuillez taper le code suivant':S.lang==='en'?'Please type the following code':'يرجى كتابة الرمز التالي'} <strong style="color:var(--bt);font-family:monospace" dir="ltr">${requiredCode}</strong> ${S.lang==='fr'?'pour déverrouiller l\'exécution :':S.lang==='en'?'to enable execution:':'لتفعيل زر التنفيذ:'}
            </div>
            <input class="fctl" style="border:1px solid ${isMatch ? 'var(--gt)' : 'var(--rt)'};font-family:monospace;font-size:13px;letter-spacing:1px;direction:ltr;text-align:center" value="${esc(confirmText)}" oninput="updateState({ purgeConfirmText: this.value })" placeholder="${requiredCode}">
          </div>
        </div>

        <!-- Progress Tracker Bar during execution -->
        ${progress ? `
          <div style="background:rgba(255,255,255,0.03);border:1px solid var(--border);border-radius:var(--r-md);padding:12px;margin-bottom:14px;color:var(--t1)">
            <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:6px">
              <span>${progress.text}</span>
              <strong class="num" style="color:var(--bt)">${progress.pct}%</strong>
            </div>
            <div style="width:100%;height:8px;background:rgba(255,255,255,0.08);border-radius:99px;overflow:hidden">
              <div style="width:${progress.pct}%;height:100%;background:linear-gradient(90deg, var(--sys-blue, #0A84FF), var(--sys-green, #30D158));transition:width 0.3s"></div>
            </div>
          </div>
        ` : ''}

      `}

    </div>

    <!-- Actions Footer -->
    <div class="facts" style="padding:14px 4px 0;border-top:1px solid var(--border);margin:0">
      <button class="btn btn-ghost" onclick="closeModal()">${t('إلغاء')}</button>
      ${tab !== 'audit' ? `
        <button class="btn ${tab === 'all' ? 'btn-danger' : 'btn-primary'}" ${!isMatch || S.purgeIsExecuting ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''} onclick="handleExecutePurge()">
          ${S.purgeIsExecuting ? `${mIc('clock', 14)} ${S.lang==='fr'?'Exécution en cours...':S.lang==='en'?'Executing...':'جاري التنفيذ...'}` : (tab === 'all' ? `${mIc('flame', 14)} ${S.lang==='fr'?'Exécuter Réinitialisation Totale':S.lang==='en'?'Execute Total Zero Wipe':'تنفيذ المحو والتصفير الشامل'}` : `${mIc('target', 14)} ${S.lang==='fr'?'Exécuter la purge sélectionnée':S.lang==='en'?'Execute Selected Purge':'تنفيذ عملية التصفية المحددة'}`)}
        </button>
      ` : ''}
    </div>
  `;
}

function renderAuditTabContent(auditLogs) {
  const locale = S.lang === 'fr' ? 'fr-FR' : (S.lang === 'en' ? 'en-US' : 'ar-DZ');

  if (!auditLogs || auditLogs.length === 0) {
    return `
      <div style="text-align:center;padding:3rem 1rem;color:var(--t3);font-size:12px;display:flex;flex-direction:column;align-items:center;gap:8px">
        ${mIc('inbox', 26)}
        <span>${S.lang==='fr'
          ?'Aucun journal d\'audit de sécurité enregistré pour le moment. Chaque opération de purge y sera automatiquement répertoriée.'
          :(S.lang==='en'
            ?'No security audit logs recorded yet. Every purge operation will be automatically logged here with full details.'
            :'لا توجد سجلات تدقيق أمني مسجلة بعد. سيتم تسجيل كل عملية محو أو تصفية تنفذها مع تفاصيل العواقب هنا تلقائياً.')}</span>
      </div>
    `;
  }

  return `
    <div style="display:flex;flex-direction:column;gap:10px">
      <div style="font-size:12px;color:var(--t2);margin-bottom:4px">
        ${S.lang==='fr'?'Journal d’audit des opérations de purge :':S.lang==='en'?'Purge and deletion audit log:':'سجل تدقيق عمليات التصفية والمحو:'}
      </div>

      ${auditLogs.map(log => {
        const dStr = new Date(log.timestamp).toLocaleString(locale, {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });

        const defaultNote = S.lang === 'fr' ? 'Opération de purge' : (S.lang === 'en' ? 'Purge operation' : 'عملية تصفية');
        const scopeLabel = log.scope === 'all'
          ? (S.lang==='fr'?'Réinitialisation totale':S.lang==='en'?'Total Wipe':'تصفير شامل')
          : (log.scope === 'filtered'
            ? (S.lang==='fr'?'Filtre conditionnel':S.lang==='en'?'Filtered':'تصفية بشرط')
            : (S.lang==='fr'?'Portée sélective':S.lang==='en'?'Selective Scope':'محو مخصص'));

        return `
          <div style="background:rgba(255,255,255,0.03);border:1px solid var(--border);border-radius:var(--r-sm);padding:12px;color:var(--t1)">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px">
              <span style="font-size:12.5px;font-weight:700;color:var(--bt)">${esc(log.operatorNote || defaultNote)}</span>
              <span class="num" style="font-size:11px;color:var(--t3)" dir="ltr">${dStr}</span>
            </div>

            <div style="display:flex;gap:10px;font-size:11.5px;color:var(--t2);margin-bottom:6px;flex-wrap:wrap;align-items:center">
              <span style="display:inline-flex;align-items:center;gap:4px">${mIc('user', 12)} ${S.lang==='fr'?'Opérateur':S.lang==='en'?'Operator':'المشغل'}: <strong dir="ltr">${esc(log.operatorEmail)}</strong></span>
              <span aria-hidden="true">·</span>
              <span style="display:inline-flex;align-items:center;gap:4px">${mIc('target', 12)} ${S.lang==='fr'?'Portée':S.lang==='en'?'Scope':'النطاق'}: <strong>${scopeLabel}</strong></span>
              <span aria-hidden="true">·</span>
              <span style="display:inline-flex;align-items:center;gap:4px">${mIc('users', 12)} ${S.lang==='fr'?'Clients purgés':S.lang==='en'?'Clients purged':'العملاء المحذوفون'}: <strong class="num" style="color:var(--rt)">${log.deletedClientsCount || 0}</strong></span>
              <span aria-hidden="true">·</span>
              <span style="display:inline-flex;align-items:center;gap:4px">${mIc('bug', 12)} ${S.lang==='fr'?'Tickets purgés':S.lang==='en'?'Issues purged':'المشاكل المحذوفة'}: <strong class="num" style="color:var(--rt)">${log.deletedIssuesCount || 0}</strong></span>
            </div>

            ${log.backupSnapshotId ? `
              <div style="font-size:11px;color:var(--gt);display:flex;align-items:center;gap:5px">
                ${mIc('check', 12)}
                <span>${S.lang==='fr'?'Sauvegarde de sécurité créée sous le N° :':S.lang==='en'?'Pre-purge safety snapshot created:':'تم إنشاء نسخة احتياطية وقائية برقم:'}</span>
                <code class="num" style="background:rgba(255,255,255,0.06);padding:1px 6px;border-radius:4px">${log.backupSnapshotId}</code>
              </div>
            ` : ''}
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function renderStaffMemberModal(){
  const st = S.form || {};
  const isEdit = !!st.id;
  return `
    <div class="mhdr">
      <div class="mtitle">${isEdit ? 'تعديل بيانات الموظف' : 'إضافة موظف جديد'}</div>
      <button class="mclose" onclick="closeModal()">×</button>
    </div>
    <div class="frow">
      <div class="fgroup"><label class="flbl">اسم الموظف *</label><input class="fctl" id="sm_name" value="${esc(st.name || '')}"></div>
      <div class="fgroup"><label class="flbl">اسم المستخدم / المعرّف</label><input class="fctl" id="sm_username" value="${esc(st.username || '')}"></div>
    </div>
    <div class="frow">
      <div class="fgroup"><label class="flbl">المنصب</label><input class="fctl" id="sm_position" value="${esc(st.position || '')}"></div>
      <div class="fgroup">
        <label class="flbl">القسم</label>
        <select class="fctl" id="sm_dept">
          ${selOpts(['القسم التقني', 'قسم التجاري', 'قسم المتابعة', 'قسم ما بعد البيع', 'الإدارة العليا'], st.department || 'القسم التقني')}
        </select>
      </div>
    </div>
    <div class="frow">
      <div class="fgroup"><label class="flbl">المسؤول المباشر</label><input class="fctl" id="sm_sup" value="${esc(st.supervisor || 'المدير العام')}"></div>
      <div class="fgroup"><label class="flbl">كلمة السر (الدخول) *</label><input type="password" class="fctl" id="sm_pwd" placeholder="${isEdit ? 'اترك فارغاً للإبقاء على الحالية' : 'أدخل كلمة سر الموظف'}"></div>
    </div>
    <div class="fgroup">
      <label class="flbl">المهام والمسؤوليات</label>
      <textarea class="fctl" id="sm_tasks" rows="3">${esc(st.tasks || '')}</textarea>
    </div>
    <div class="facts">
      <button class="btn btn-ghost" onclick="closeModal()">إلغاء</button>
      <button class="btn btn-primary" onclick="saveStaffMember({
        id: '${esc(st.id || '')}',
        name: document.getElementById('sm_name').value,
        username: document.getElementById('sm_username').value,
        position: document.getElementById('sm_position').value,
        department: document.getElementById('sm_dept').value,
        supervisor: document.getElementById('sm_sup').value,
        password: document.getElementById('sm_pwd') ? document.getElementById('sm_pwd').value : '',
        tasks: document.getElementById('sm_tasks').value,
        role: '${st.role || 'employee'}'
      })">حفظ الموظف</button>
    </div>
  `;
}

// ─────────────────────────────────────────────────────────────
// 1. التقرير الجغرافي الشامل للولايات (Geographic Report Modal)
// ─────────────────────────────────────────────────────────────
export function renderGeoReportModal() {
  const geoSearch = (S.form.geoSearch || '').trim().toLowerCase();
  
  // Aggregate clients by wilaya
  const wilayaStats = {};
  WILAYAS.forEach(w => {
    wilayaStats[w] = { name: w, total: 0, confirmed: 0, unconfirmed: 0, scoreSum: 0, issues: 0, progs: 0 };
  });

  clients.forEach(c => {
    const w = (c.wilaya || 'غير محدد').trim();
    if (!wilayaStats[w]) {
      wilayaStats[w] = { name: w, total: 0, confirmed: 0, unconfirmed: 0, scoreSum: 0, issues: 0, progs: 0 };
    }
    wilayaStats[w].total++;
    if (isConfirmedClientStatus(c.status)) wilayaStats[w].confirmed++;
    else wilayaStats[w].unconfirmed++;
    wilayaStats[w].scoreSum += (c._subcollectionsLoaded ? computeScore(c).total : (c.score !== undefined ? Number(c.score) : computeScore(c).total));
    const issCount = (c.issues || []).length > 0 || c._subcollectionsLoaded
      ? (c.issues || []).filter(i => i.status === 'مفتوح' || i.status === 'قيد المعالجة' || i.status === 'جديد').length
      : (Number(c.openIssuesCount) || 0);
    wilayaStats[w].issues += issCount;
    const cProgs = (c.programs || []).length > 0 ? c.programs.length : Math.max(Number(c.programsCount) || 0, Array.isArray(c.programNames) ? c.programNames.length : 0);
    wilayaStats[w].progs += cProgs;
  });

  const allWilayasList = Object.values(wilayaStats).sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, 'ar'));
  const filteredList = geoSearch 
    ? allWilayasList.filter(item => item.name.toLowerCase().includes(geoSearch))
    : allWilayasList;

  const coveredCount = allWilayasList.filter(item => item.total > 0).length;
  const topWilaya = allWilayasList[0] || { name: '—', total: 0 };
  const maxClientsInWilaya = Math.max(1, ...allWilayasList.map(x => x.total));

  return `
    <div class="mhdr" style="border-bottom:1px solid var(--border);padding-bottom:12px;margin-bottom:16px">
      <div style="display:flex;align-items:center;gap:10px">
        <span style="width:34px;height:34px;border-radius:10px;background:rgba(10,132,255,0.14);border:1px solid rgba(10,132,255,0.28);color:var(--bt);display:inline-flex;align-items:center;justify-content:center">${mIc('pin', 17)}</span>
        <div>
          <div class="mtitle" style="font-size:17px;font-weight:800;color:var(--t1)">${t('التقرير الجغرافي الشامل للولايات')}</div>
          <div style="font-size:12px;color:var(--t2)">${t('توزيع قاعدة العملاء، التراخيص، ومؤشرات الأداء عبر كل الولايات')}</div>
        </div>
      </div>
      <div style="display:flex;gap:8px;align-items:center">
        <button class="btn btn-outline btn-sm" onclick="exportGeoReport()">
          ${mIc('download', 14)} ${t('تصدير التقرير (CSV)')}
        </button>
        <button class="mclose" onclick="closeModal()">×</button>
      </div>
    </div>

    <!-- Quick KPIs Summary -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(160px, 1fr));gap:10px;margin-bottom:16px">
      <div style="background:rgba(255,255,255,0.03);border:1px solid var(--border);padding:12px 14px;border-radius:var(--r-sm)">
        <div style="font-size:11.5px;color:var(--t2);font-weight:600">${t('الولايات المغطاة')}</div>
        <div style="font-size:22px;font-weight:800;color:var(--t1);margin-top:2px" class="num">${coveredCount} <span style="font-size:12px;color:var(--t3);font-weight:600">/ ${WILAYAS.length}</span></div>
      </div>
      <div style="background:rgba(255,255,255,0.03);border:1px solid var(--border);padding:12px 14px;border-radius:var(--r-sm)">
        <div style="font-size:11.5px;color:var(--t2);font-weight:600">${t('أعلى ولاية كثافة')}</div>
        <div style="font-size:19px;font-weight:800;color:var(--bt);margin-top:4px">${esc(topWilaya.name)} <span style="font-size:13px;color:var(--t2)" class="num">(${topWilaya.total})</span></div>
      </div>
      <div style="background:rgba(255,255,255,0.03);border:1px solid var(--border);padding:12px 14px;border-radius:var(--r-sm)">
        <div style="font-size:11.5px;color:var(--t2);font-weight:600">${t('نسبة التغطية الوطنية')}</div>
        <div style="font-size:22px;font-weight:800;color:var(--gt);margin-top:2px" class="num">${((coveredCount / (WILAYAS.length || 1)) * 100).toFixed(1)}%</div>
      </div>
      <div style="background:rgba(255,255,255,0.03);border:1px solid var(--border);padding:12px 14px;border-radius:var(--r-sm)">
        <div style="font-size:11.5px;color:var(--t2);font-weight:600">${t('إجمالي العملاء')}</div>
        <div style="font-size:22px;font-weight:800;color:var(--t1);margin-top:2px" class="num">${clients.length}</div>
      </div>
    </div>

    <!-- Search input -->
    <div style="margin-bottom:12px;position:relative">
      <input 
        type="text" 
        class="fctl" 
        style="padding-inline-start:34px" 
        placeholder="${t('ابحث عن اسم ولاية...')}" 
        value="${esc(geoSearch)}"
        oninput="S.form.geoSearch=this.value; R();"
      >
      <span style="position:absolute;inset-inline-start:11px;top:50%;transform:translateY(-50%);color:var(--t3);display:inline-flex;pointer-events:none">${mIc('search', 14)}</span>
    </div>

    <!-- Scrollable Wilayas Table -->
    <div class="glass-table-wrap" style="max-height:420px;overflow-y:auto">
      <table class="glass-table">
        <thead>
          <tr>
            <th>${t('الولاية')}</th>
            <th style="text-align:center">${t('عدد العملاء')}</th>
            <th>${t('توزيع الحالة')} (${t('مؤكد')} / ${t('غير مؤكد')})</th>
            <th style="text-align:center">${t('البرامج')}</th>
            <th style="text-align:center">${t('مشاكل مفتوحة')}</th>
            <th style="text-align:center">${t('صحة العملاء')}</th>
            <th style="text-align:center">${t('إجراء سريع')}</th>
          </tr>
        </thead>
        <tbody>
          ${filteredList.map(item => {
            const avg = item.total ? Math.round(item.scoreSum / item.total) : 100;
            const barW = Math.round((item.total / maxClientsInWilaya) * 100);
            return `
              <tr>
                <td style="font-weight:700;color:var(--t1)">
                  ${esc(item.name)}
                </td>
                <td style="text-align:center;font-weight:800" class="num">
                  <div style="display:inline-flex;align-items:center;gap:8px">
                    <span>${item.total}</span>
                    <div style="width:50px;height:6px;background:rgba(255,255,255,0.08);border-radius:3px;overflow:hidden">
                      <div style="width:${barW}%;height:100%;background:var(--sys-blue, #0A84FF)"></div>
                    </div>
                  </div>
                </td>
                <td>
                  ${item.total > 0 ? `
                    <div style="display:flex;gap:6px;font-size:11.5px;align-items:center" class="num">
                      <span style="color:var(--gt);font-weight:700">${item.confirmed} ${t('مؤكد')}</span> · 
                      <span style="color:var(--wt);font-weight:700">${item.unconfirmed} ${t('غير مؤكد')}</span>
                    </div>
                  ` : `<span style="color:var(--t3);font-size:11.5px">—</span>`}
                </td>
                <td style="text-align:center" class="num">${item.progs}</td>
                <td style="text-align:center" class="num">
                  ${item.issues > 0 ? `<span style="color:var(--rt);font-weight:700;display:inline-flex;align-items:center;gap:4px">${mIc('warn', 12)} ${item.issues}</span>` : `<span style="color:var(--t3)">0</span>`}
                </td>
                <td style="text-align:center">
                  ${item.total > 0 ? `<span class="num" style="font-weight:800;color:${scoreColor(avg)}">${avg}/100</span>` : '<span style="color:var(--t3)">—</span>'}
                </td>
                <td style="text-align:center">
                  <div style="display:flex;gap:6px;justify-content:center">
                    <button class="btn btn-xs btn-outline" onclick="setDbWilaya('${esc(item.name)}');closeModal();setView('dashboard')" title="${t('تصفية لوحة القيادة بهذه الولاية')}">
                      ${mIc('chart', 12)} ${t('تصفية اللوحة')}
                    </button>
                    <button class="btn btn-xs btn-primary" onclick="S.fWilaya='${esc(item.name)}';S.filter='الكل';closeModal();setView('list')" title="${t('عرض العملاء في القائمة')}">
                      ${mIc('users', 12)} ${t('العملاء')}
                    </button>
                  </div>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>

    <div class="facts" style="margin-top:14px;display:flex;justify-content:space-between;align-items:center">
      <span style="font-size:12px;color:var(--t2)">${t('تم العثور على')} <strong class="num" style="color:var(--t1)">${filteredList.length}</strong> ${t('ولاية')}</span>
      <button class="btn btn-ghost" onclick="closeModal()">${t('إغلاق')}</button>
    </div>
  `;
}

// ─────────────────────────────────────────────────────────────
// 2. مستكشف التذاكر وطلبات الميزات (Tickets & Requirements Modal)
// ─────────────────────────────────────────────────────────────
export function renderTicketsAndReqsModal() {
  const curTab = S.form.tab || 'issues';
  const curFilter = S.form.filter || 'all';
  const curSearch = (S.form.search || '').trim().toLowerCase();

  const allIssues = clients.flatMap(c => (c.issues || []).map(i => ({
    ...i,
    clientId: c.id,
    clientName: c.fullName,
    clientWilaya: c.wilaya,
    clientStatus: c.status
  })));

  const allReqs = clients.flatMap(c => (c.requirements || []).map(r => ({
    ...r,
    clientId: c.id,
    clientName: c.fullName,
    clientWilaya: c.wilaya,
    clientStatus: c.status
  })));

  let displayItems = [];
  if (curTab === 'issues') {
    displayItems = allIssues.filter(i => {
      if (curFilter !== 'all') {
        if (['عاجل', 'عالية', 'متوسطة', 'منخفضة'].includes(curFilter) && i.priority !== curFilter) return false;
        if (['مفتوح', 'قيد المعالجة', 'محلول', 'مغلق'].includes(curFilter) && i.status !== curFilter) return false;
      }
      if (curSearch) {
        const txt = `${i.title || ''} ${i.clientName || ''} ${i.notes || ''} ${i.type || ''}`.toLowerCase();
        if (!txt.includes(curSearch)) return false;
      }
      return true;
    });
  } else {
    displayItems = allReqs.filter(r => {
      if (curFilter !== 'all') {
        if (['مقترح', 'قيد الدراسة', 'مخطط', 'منفذ', 'مرفوض'].includes(curFilter) && r.status !== curFilter) return false;
        if (['عالي', 'متوسط', 'منخفض'].includes(curFilter) && r.impact !== curFilter) return false;
      }
      if (curSearch) {
        const txt = `${r.title || ''} ${r.clientName || ''} ${r.notes || ''} ${r.type || ''}`.toLowerCase();
        if (!txt.includes(curSearch)) return false;
      }
      return true;
    });
  }

  return `
    <div class="mhdr" style="border-bottom:1px solid var(--border);padding-bottom:12px;margin-bottom:16px">
      <div style="display:flex;align-items:center;gap:10px">
        <span style="width:34px;height:34px;border-radius:10px;background:rgba(10,132,255,0.14);border:1px solid rgba(10,132,255,0.28);color:var(--bt);display:inline-flex;align-items:center;justify-content:center">${mIc(curTab === 'issues' ? 'ticket' : 'bulb', 17)}</span>
        <div>
          <div class="mtitle" style="font-size:17px;font-weight:800;color:var(--t1)">${t('مستكشف التذاكر وطلبات الميزات والتطوير')}</div>
          <div style="font-size:12px;color:var(--t2)">${t('استعراض وتتبع كافة مشاكل الدعم الفني وطلبات التحسين البرمجي عبر العملاء')}</div>
        </div>
      </div>
      <button class="mclose" onclick="closeModal()">×</button>
    </div>

    <!-- Tab Switcher -->
    <div style="display:flex;background:rgba(255,255,255,0.03);border:1px solid var(--border);border-radius:var(--r-sm);padding:4px;margin-bottom:14px;gap:4px">
      <button 
        class="btn btn-sm ${curTab === 'issues' ? 'btn-primary' : 'btn-ghost'}" 
        style="flex:1;border-radius:calc(var(--r-sm) - 3px);font-weight:700"
        onclick="S.form.tab='issues'; S.form.filter='all'; R();"
      >
        ${mIc('ticket', 14)} ${t('تذاكر الدعم والمشاكل التقنية')} (<span class="num">${allIssues.length}</span>)
      </button>
      <button 
        class="btn btn-sm ${curTab === 'reqs' ? 'btn-primary' : 'btn-ghost'}" 
        style="flex:1;border-radius:calc(var(--r-sm) - 3px);font-weight:700"
        onclick="S.form.tab='reqs'; S.form.filter='all'; R();"
      >
        ${mIc('bulb', 14)} ${t('طلبات الميزات والتطوير')} (<span class="num">${allReqs.length}</span>)
      </button>
    </div>

    <!-- Filters Bar and Search -->
    <div style="display:flex;gap:10px;margin-bottom:14px;align-items:center;flex-wrap:wrap">
      <div style="flex:1;min-width:200px;position:relative">
        <input 
          type="text" 
          class="fctl" 
          style="padding-inline-start:34px" 
          placeholder="${curTab === 'issues' ? t('ابحث عن عنوان تذكرة أو اسم عميل...') : t('ابحث عن طلب ميزة...')}" 
          value="${esc(curSearch)}"
          oninput="S.form.search=this.value; R();"
        >
        <span style="position:absolute;inset-inline-start:11px;top:50%;transform:translateY(-50%);color:var(--t3);display:inline-flex;pointer-events:none">${mIc('search', 14)}</span>
      </div>

      <!-- Quick Filter Controls -->
      <div class="filter-bar" style="margin:0;border:none;padding:0;gap:4px">
        ${curTab === 'issues' ? `
          ${['all', 'عاجل', 'عالية', 'مفتوح', 'محلول'].map(f => `
            <button type="button"
              class="fpill ${curFilter === f ? 'on' : ''}" 
              onclick="S.form.filter='${f}'; R();"
            >
              ${f === 'all' ? t('الكل') : t(f)}
            </button>
          `).join('')}
        ` : `
          ${['all', 'مقترح', 'قيد الدراسة', 'مخطط', 'منفذ'].map(f => `
            <button type="button"
              class="fpill ${curFilter === f ? 'on' : ''}" 
              onclick="S.form.filter='${f}'; R();"
            >
              ${f === 'all' ? t('الكل') : t(f)}
            </button>
          `).join('')}
        `}
      </div>
    </div>

    <!-- Items List -->
    <div class="tickets-modal-list">
      ${displayItems.length ? displayItems.map(item => {
        const isSolved = item.status === 'محلول' || item.status === 'منفذ';
        const prioColor = item.priority === 'عاجل' ? 'var(--rt)' : (item.priority === 'عالية' ? 'var(--wt)' : 'var(--bt)');
        const impactColor = item.impact === 'عالي' ? 'var(--wt)' : 'var(--bt)';
        const statusColor = isSolved ? 'var(--gt)' : 'var(--wt)';
        return `
          <div 
            class="ticket-modal-item" 
            onclick="closeModal(); selClient(${item.clientId}); setTab('${curTab === 'issues' ? 'issues' : 'requirements'}');"
            title="${t('اضغط لفتح بطاقة العميل والتفاصيل الكاملة')}"
          >
            <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap">
              <div>
                <div style="font-weight:700;font-size:14px;color:var(--t1);margin-bottom:4px">
                  ${esc(item.title || item.name || 'بدون عنوان')}
                </div>
                <div style="font-size:12px;color:var(--t2);display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                  <span style="display:inline-flex;align-items:center;gap:4px">${mIc('user', 12)} <strong>${esc(item.clientName)}</strong></span>
                  <span aria-hidden="true">·</span>
                  <span style="display:inline-flex;align-items:center;gap:4px">${mIc('pin', 12)} ${esc(item.clientWilaya || '—')}</span>
                  ${item.date ? `<span aria-hidden="true">·</span><span class="num" style="display:inline-flex;align-items:center;gap:4px">${mIc('calendar', 12)} ${esc(item.date)}</span>` : ''}
                  ${item.repeatCount && Number(item.repeatCount) > 1 ? `<span aria-hidden="true">·</span><span class="num" style="color:var(--rt);font-weight:700;display:inline-flex;align-items:center;gap:4px">${mIc('refresh', 12)} تكررت ${item.repeatCount} مرات</span>` : ''}
                </div>
              </div>
              <div style="display:flex;gap:8px;align-items:center;flex-shrink:0;font-size:12px;font-weight:700">
                ${item.priority ? `<span style="color:${prioColor}">${esc(item.priority)}</span><span style="color:var(--t3)" aria-hidden="true">·</span>` : ''}
                ${item.impact ? `<span style="color:${impactColor}">تأثير ${esc(item.impact)}</span><span style="color:var(--t3)" aria-hidden="true">·</span>` : ''}
                <span style="color:${statusColor}">${esc(item.status || 'مفتوح')}</span>
              </div>
            </div>
            ${item.solution ? `
              <div style="font-size:12px;color:var(--gt);background:rgba(48,209,88,0.10);border:1px solid rgba(48,209,88,0.22);border-radius:var(--r-sm);padding:6px 10px;margin-top:8px;display:flex;align-items:center;gap:6px">
                ${mIc('check', 13)}
                <span><strong>${t('الحل:')}</strong> ${esc(item.solution)}</span>
              </div>
            ` : (item.notes ? `
              <div style="font-size:12px;color:var(--t2);margin-top:6px;line-height:1.5;display:flex;align-items:flex-start;gap:6px">
                <span style="margin-top:2px">${mIc('fileText', 12)}</span>
                <span>${esc(item.notes)}</span>
              </div>
            ` : '')}
          </div>
        `;
      }).join('') : `
        <div style="padding:3rem 1rem;text-align:center;color:var(--t2);background:rgba(255,255,255,0.03);border:1px dashed var(--border);border-radius:var(--r-md);display:flex;flex-direction:column;align-items:center;gap:8px">
          ${mIc('search', 28)}
          <div style="font-weight:700;font-size:14px;color:var(--t1)">${t('لا توجد عناصر تطابق بحثك حالياً')}</div>
        </div>
      `}
    </div>

    <div class="facts" style="margin-top:14px;display:flex;justify-content:space-between;align-items:center">
      <span style="font-size:12px;color:var(--t2)">${t('تم العثور على')} <strong class="num" style="color:var(--t1)">${displayItems.length}</strong> ${curTab === 'issues' ? t('تذكرة') : t('طلب ميزة')}</span>
      <button class="btn btn-ghost" onclick="closeModal()">${t('إغلاق')}</button>
    </div>
  `;
}

// ─────────────────────────────────────────────────────────────
// 3. توضيح بطاقة صحة العملاء (Health Score Explainer Modal)
// ─────────────────────────────────────────────────────────────
export function renderHealthScoreExplainerModal() {
  return `
    <div class="mhdr" style="border-bottom:1px solid var(--border);padding-bottom:12px;margin-bottom:16px">
      <div style="display:flex;align-items:center;gap:10px">
        <span style="width:34px;height:34px;border-radius:10px;background:rgba(10,132,255,0.14);border:1px solid rgba(10,132,255,0.28);color:var(--bt);display:inline-flex;align-items:center;justify-content:center">${mIc('info', 17)}</span>
        <div>
          <div class="mtitle" style="font-size:17px;font-weight:800;color:var(--t1)">${t('دليل مؤشر صحة العملاء (Customer Health Score)')}</div>
          <div style="font-size:12px;color:var(--t2)">${t('كيفية احتساب النقاط وتصنيف الحسابات والمعايير الأربعة المعتمدة')}</div>
        </div>
      </div>
      <button class="mclose" onclick="closeModal()">×</button>
    </div>

    <div style="font-size:13.5px;color:var(--t1);line-height:1.65;margin-bottom:16px">
      <strong>مؤشر صحة العميل</strong> هو مقياس حسابي ذكي من <strong class="num">0 إلى 100 نقطة</strong>، يُحسب آلياً لكل عميل في الوقت الحقيقي بناءً على 4 محاور أساسية تعكس استقرار حسابه ورضاه ومستوى ولائه لنظام PROGILIC CRM.
    </div>

    <!-- Tiers Breakdown -->
    <div style="font-size:13px;font-weight:800;color:var(--t1);margin-bottom:10px;display:flex;align-items:center;gap:6px">${mIc('star', 14)} التصنيفات الأربعة لمستوى صحة العميل:</div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(220px, 1fr));gap:10px;margin-bottom:20px">
      <div style="border:1px solid rgba(48,209,88,0.28);background:rgba(48,209,88,0.08);border-radius:var(--r-sm);padding:12px">
        <div style="display:flex;align-items:center;gap:8px;font-weight:800;color:var(--gt);margin-bottom:4px">
          ${mIc('star', 15)} <span>عميل متميز (<span class="num">75 – 100</span> نقطة)</span>
        </div>
        <div style="font-size:12px;color:var(--t2);line-height:1.55">
          حساب نموذجي مستقر، لديه تراخيص نشطة، تواصل دوري مستمر، ولا توجد أي مشاكل معلقة أو أعطال حرجة.
        </div>
      </div>

      <div style="border:1px solid rgba(255,159,10,0.28);background:rgba(255,159,10,0.08);border-radius:var(--r-sm);padding:12px">
        <div style="display:flex;align-items:center;gap:8px;font-weight:800;color:var(--wt);margin-bottom:4px">
          ${mIc('check', 15)} <span>عميل جيد (<span class="num">50 – 74</span> نقطة)</span>
        </div>
        <div style="font-size:12px;color:var(--t2);line-height:1.55">
          حساب مستقر في مساره الطبيعي، قد يحتاج لتواصل اعتيادي أو تجديد ترخيص قادم في وقته.
        </div>
      </div>

      <div style="border:1px solid rgba(255,149,0,0.32);background:rgba(255,149,0,0.08);border-radius:var(--r-sm);padding:12px">
        <div style="display:flex;align-items:center;gap:8px;font-weight:800;color:var(--ot);margin-bottom:4px">
          ${mIc('warn', 15)} <span>يحتاج متابعة (<span class="num">25 – 49</span> نقطة)</span>
        </div>
        <div style="font-size:12px;color:var(--t2);line-height:1.55">
          تظهر عليه مؤشرات الفتور؛ مثل انقطاع الاتصال لأكثر من 30 يوماً، أو وجود مشكلة فنية غير محلولة.
        </div>
      </div>

      <div style="border:1px solid rgba(255,69,58,0.28);background:rgba(255,69,58,0.08);border-radius:var(--r-sm);padding:12px">
        <div style="display:flex;align-items:center;gap:8px;font-weight:800;color:var(--rt);margin-bottom:4px">
          ${mIc('flame', 15)} <span>خطر عالٍ (أقل من <span class="num">25</span> نقطة)</span>
        </div>
        <div style="font-size:12px;color:var(--t2);line-height:1.55">
          حساب حرج يحتاج متابعة عاجلة؛ تراكم مشاكل غير محلولة، أو انقطاع التواصل لأكثر من 60 يوماً.
        </div>
      </div>
    </div>

    <!-- The 4 Pillars Breakdown -->
    <div style="font-size:13px;font-weight:800;color:var(--t1);margin-bottom:10px;display:flex;align-items:center;gap:6px">${mIc('scale', 14)} كيف تُوزع الـ 100 نقطة بالتفصيل؟</div>
    <div style="border:1px solid var(--border);border-radius:var(--r-sm);background:rgba(255,255,255,0.03);overflow:hidden;margin-bottom:16px">
      <div style="display:flex;align-items:center;padding:12px 14px;border-bottom:1px solid var(--border);gap:12px">
        <div class="num" style="width:36px;height:36px;border-radius:10px;background:rgba(10,132,255,0.16);color:var(--bt);display:grid;place-items:center;font-weight:800;flex-shrink:0">35</div>
        <div>
          <div style="font-weight:700;color:var(--t1)">1. البرامج والتراخيص (35 نقطة كحد أقصى)</div>
          <div style="font-size:12px;color:var(--t2);margin-top:2px">يُحتسب بناءً على عدد البرامج النشطة ونسبة الأجهزة المفعلة من التراخيص. الحساب الذي يمتلك تراخيص ممتدة ومحطات متعددة يحصل على كامل النقاط.</div>
        </div>
      </div>

      <div style="display:flex;align-items:center;padding:12px 14px;border-bottom:1px solid var(--border);gap:12px">
        <div class="num" style="width:36px;height:36px;border-radius:10px;background:rgba(255,159,10,0.16);color:var(--ot);display:grid;place-items:center;font-weight:800;flex-shrink:0">25</div>
        <div>
          <div style="font-weight:700;color:var(--t1)">2. التواصل الدوري وسجل الاتصالات (25 نقطة كحد أقصى)</div>
          <div style="font-size:12px;color:var(--t2);margin-top:2px">25 نقطة إذا تم التواصل خلال آخر 7 أيام · 18 نقطة خلال 30 يوماً · 10 نقاط خلال 60 يوماً · 4 نقاط خلال 90 يوماً · 0 نقطة إذا تجاوز الانقطاع 90 يوماً.</div>
        </div>
      </div>

      <div style="display:flex;align-items:center;padding:12px 14px;border-bottom:1px solid var(--border);gap:12px">
        <div class="num" style="width:36px;height:36px;border-radius:10px;background:rgba(48,209,88,0.16);color:var(--gt);display:grid;place-items:center;font-weight:800;flex-shrink:0">25</div>
        <div>
          <div style="font-weight:700;color:var(--t1)">3. الدعم الفني واستقرار النظام (25 نقطة كحد أقصى)</div>
          <div style="font-size:12px;color:var(--t2);margin-top:2px">تبدأ من 25 نقطة؛ ويُخصم (4 نقاط) عن كل مشكلة مفتوحة، و(7 نقاط) عن كل مشكلة عاجلة معلقة، و(3 نقاط) عن المشاكل المتكررة 3 مرات فأكثر.</div>
        </div>
      </div>

      <div style="display:flex;align-items:center;padding:12px 14px;gap:12px">
        <div class="num" style="width:36px;height:36px;border-radius:10px;background:rgba(191,90,242,0.16);color:var(--pt);display:grid;place-items:center;font-weight:800;flex-shrink:0">15</div>
        <div>
          <div style="font-weight:700;color:var(--t1)">4. الميزات والمقترحات التطويرية (15 نقطة كحد أقصى)</div>
          <div style="font-size:12px;color:var(--t2);margin-top:2px">يُمنح العميل 5 نقاط عن كل طلب ميزة أو متطلب ذي تأثير عالي مقدم من طرفه، مما يعكس شراكته وتفاعله الإيجابي في تطوير البرنامج.</div>
        </div>
      </div>
    </div>

    <div class="facts" style="margin-top:14px;display:flex;justify-content:flex-end">
      <button class="btn btn-primary" onclick="closeModal()">${t('حسناً، فهمت ذلك')}</button>
    </div>
  `;
}

export function renderLicensesExplorerModal() {
  const curPlatform = S.form.platform || 'all';
  const curVersion = S.form.version || 'all';
  const curType = S.form.type || 'all';
  const curSearch = (S.form.search || '').trim().toLowerCase();
  const curViewMode = S.form.viewMode || 'table';

  // Aggregate all licenses across all clients
  const allLicenses = [];
  clients.forEach(c => {
    const progs = c.programs || [];
    if (progs.length > 0) {
      progs.forEach(p => {
        allLicenses.push({
          ...p,
          clientId: c.id,
          clientName: c.fullName || 'عميل غير مسمى',
          clientCompany: c.company || '—',
          clientWilaya: c.wilaya || '—',
          clientPhone: c.phone || '—',
          clientStatus: normalizeClientStatus(c.status)
        });
      });
    } else {
      const summaryProgCount = Math.max(Number(c.programsCount) || 0, Array.isArray(c.programNames) ? c.programNames.length : 0);
      if (summaryProgCount > 0) {
        const names = Array.isArray(c.programNames) && c.programNames.length > 0
          ? c.programNames
          : Array(summaryProgCount).fill('PROGILIC');
        const totalInst = Math.max(names.length, Number(c.installationsCount) || names.length);
        const baseInst = Math.floor(totalInst / names.length);
        let remInst = totalInst % names.length;
        names.forEach((name, idx) => {
          const norm = normalizeProgramCategory(name);
          const devices = baseInst + (remInst > 0 ? 1 : 0);
          if (remInst > 0) remInst--;
          allLicenses.push({
            id: `summary_${c.id}_${idx}`,
            programName: name,
            platform: norm.platform,
            type: norm.labelAr,
            categoryKey: norm.categoryKey,
            version: norm.version || '—',
            installationsCount: devices,
            startDate: c.startDate || '',
            endDate: '',
            clientId: c.id,
            clientName: c.fullName || 'عميل غير مسمى',
            clientCompany: c.company || '—',
            clientWilaya: c.wilaya || '—',
            clientPhone: c.phone || '—',
            clientStatus: normalizeClientStatus(c.status)
          });
        });
      }
    }
  });

  // Calculate high-level stats
  const totalLicenses = allLicenses.length;
  const desktopLicenses = allLicenses.filter(l => (l.platform || 'Desktop') === 'Desktop').length;
  const mobileLicenses = allLicenses.filter(l => l.platform === 'Mobile').length;
  const webLicenses = allLicenses.filter(l => l.platform === 'Web').length;
  const totalDevices = allLicenses.reduce((sum, l) => sum + (Number(l.installationsCount) || 1), 0);

  // Filter licenses
  const filtered = allLicenses.filter(l => {
    const plat = l.platform || 'Desktop';
    if (curPlatform !== 'all' && plat !== curPlatform) return false;
    if (curVersion !== 'all' && (l.version || '').toUpperCase() !== curVersion.toUpperCase()) return false;
    if (curType !== 'all') {
      const norm = normalizeProgramCategory(l);
      const lType = (l.type || '').toLowerCase();
      const lName = (l.programName || '').toLowerCase();
      if (norm.categoryKey.toLowerCase() !== curType.toLowerCase() && !lType.includes(curType.toLowerCase()) && !lName.includes(curType.toLowerCase())) {
        return false;
      }
    }
    if (curSearch) {
      const q = curSearch;
      const match = (l.clientName || '').toLowerCase().includes(q) ||
                    (l.clientCompany || '').toLowerCase().includes(q) ||
                    (l.clientWilaya || '').toLowerCase().includes(q) ||
                    (l.clientPhone || '').toLowerCase().includes(q) ||
                    (l.programName || '').toLowerCase().includes(q) ||
                    (l.version || '').toLowerCase().includes(q) ||
                    (l.type || '').toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  const filteredDevicesSum = filtered.reduce((sum, l) => sum + (Number(l.installationsCount) || 1), 0);

  // Sort by client name, then program
  filtered.sort((a, b) => {
    const nameCmp = (a.clientName || '').localeCompare(b.clientName || '', 'ar');
    if (nameCmp !== 0) return nameCmp;
    return (a.programName || '').localeCompare(b.programName || '', 'ar');
  });

  return `
    <!-- Modal Header -->
    <div class="mhdr" style="margin-bottom:14px;border-bottom:1px solid var(--border);padding-bottom:12px">
      <div>
        <div class="mtitle" style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
          <span style="width:32px;height:32px;border-radius:10px;background:rgba(10,132,255,0.14);border:1px solid rgba(10,132,255,0.28);color:var(--bt);display:inline-flex;align-items:center;justify-content:center">${mIc('box', 16)}</span>
          <span style="font-size:16px;font-weight:800">${t('مستكشف التراخيص والبرامج حسب الإصدار والمنصة')}</span>
          <span class="num" style="font-size:12.5px;font-weight:700;color:var(--bt)">· ${filtered.length} ${t('ترخيص')} · ${filteredDevicesSum} ${t('جهاز')}</span>
        </div>
        <div style="font-size:12px;color:var(--t2);margin-top:4px">
          ${t('استعراض تفصيلي ومقارنة حية لتراخيص العملاء والمنصات (Desktop · Mobile · Web) والإصدارات في الـ CRM')}
        </div>
      </div>
      <button class="mclose" onclick="closeModal()" title="${t('إغلاق')}">×</button>
    </div>

    <!-- Quick Stat KPI Tiles -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px;margin-bottom:14px">
      <div class="lic-kpi-card">
        <span class="lic-kpi-lbl" style="display:inline-flex;align-items:center;gap:5px">${mIc('box', 13)} ${t('إجمالي التراخيص')}</span>
        <span class="lic-kpi-val num" style="color:var(--t1)">${totalLicenses}</span>
      </div>
      <div class="lic-kpi-card">
        <span class="lic-kpi-lbl" style="display:inline-flex;align-items:center;gap:5px">${mIc('desktop', 13)} Desktop</span>
        <span class="lic-kpi-val num" style="color:var(--bt)">${desktopLicenses}</span>
      </div>
      <div class="lic-kpi-card">
        <span class="lic-kpi-lbl" style="display:inline-flex;align-items:center;gap:5px">${mIc('mobile', 13)} Mobile</span>
        <span class="lic-kpi-val num" style="color:var(--gt)">${mobileLicenses}</span>
      </div>
      <div class="lic-kpi-card">
        <span class="lic-kpi-lbl" style="display:inline-flex;align-items:center;gap:5px">${mIc('globe', 13)} Web</span>
        <span class="lic-kpi-val num" style="color:var(--wt)">${webLicenses}</span>
      </div>
      <div class="lic-kpi-card">
        <span class="lic-kpi-lbl" style="display:inline-flex;align-items:center;gap:5px">${mIc('desktop', 13)} ${t('إجمالي الأجهزة')}</span>
        <span class="lic-kpi-val num" style="color:var(--pt)">${totalDevices}</span>
      </div>
    </div>

    <!-- Platform Tabs (Desktop / Mobile / Web) & Category Pills -->
    <div style="display:flex;gap:6px;margin-bottom:10px;flex-wrap:wrap;align-items:center">
      ${[
        { id: 'all', label: 'كافة المنصات (الكل)', ico: 'globe', count: totalLicenses },
        { id: 'Desktop', label: 'برامج Desktop', ico: 'desktop', count: desktopLicenses },
        { id: 'Mobile', label: 'تطبيقات Mobile', ico: 'mobile', count: mobileLicenses },
        { id: 'Web', label: 'منظومة Web', ico: 'globe', count: webLicenses }
      ].map(tab => {
        const isActive = curPlatform === tab.id;
        return `
          <button 
            type="button"
            class="btn btn-sm ${isActive ? 'btn-primary' : 'btn-ghost'}" 
            style="font-size:12px;padding:6px 14px;border-radius:10px;font-weight:700;display:inline-flex;align-items:center;gap:6px"
            onclick="S.form.platform='${tab.id}'; S.form.type='all'; R();"
          >
            ${mIc(tab.ico, 14)}
            <span>${t(tab.label)}</span>
            <span class="num" style="opacity:${isActive ? '0.95' : '0.7'};font-size:11.5px">(${tab.count})</span>
          </button>
        `;
      }).join('')}
    </div>

    <!-- Category Filter Strip -->
    <div style="display:flex;gap:6px;margin-bottom:12px;flex-wrap:wrap;align-items:center">
      <span style="font-size:11.5px;color:var(--t3);font-weight:700;margin-inline-end:2px">${t('الفئة')}:</span>
      ${[
        { id: 'all', label: t('الكل') },
        { id: 'Commercial', label: 'Commercial' },
        { id: 'Production', label: 'Production' },
        { id: 'Distribution', label: 'Distribution' }
      ].map(cat => `
        <button type="button"
          class="fpill ${curType === cat.id ? 'on' : ''}"
          onclick="S.form.type='${cat.id}'; ${cat.id !== 'all' ? "S.form.platform='Desktop';" : ''} R();"
          style="font-size:11.5px;padding:4px 10px"
        >
          ${cat.label}
        </button>
      `).join('')}
    </div>

    <!-- Sub-Filters Toolbar: Search, Version, View Mode Switcher, and Export -->
    <div style="display:flex;gap:10px;margin-bottom:12px;align-items:center;justify-content:space-between;flex-wrap:wrap">
      
      <!-- Live Search Input -->
      <div style="flex:1;min-width:220px;position:relative">
        <input 
          type="text" 
          class="fctl" 
          style="padding-inline-start:34px;font-size:12px;height:36px;border-radius:10px" 
          placeholder="${t('ابحث: اسم العميل، الشركة، الولاية، أو الإصدار...')}" 
          value="${esc(curSearch)}"
          oninput="S.form.search=this.value; R();"
        >
        <span style="position:absolute;inset-inline-start:10px;top:50%;transform:translateY(-50%);color:var(--t3);display:inline-flex;pointer-events:none">${mIc('search', 14)}</span>
        ${curSearch ? `
          <button 
            type="button" 
            onclick="S.form.search=''; R();" 
            style="position:absolute;inset-inline-end:8px;top:50%;transform:translateY(-50%);background:none;border:none;color:var(--t3);cursor:pointer;font-size:12px;padding:2px 6px"
            title="${t('مسح البحث')}"
          >✕</button>
        ` : ''}
      </div>

      <!-- Version Filter Controls -->
      <div class="filter-bar" style="margin:0;border:none;padding:0;gap:4px;display:flex;align-items:center;flex-wrap:wrap">
        <span style="font-size:11.5px;color:var(--t3);font-weight:700;margin-inline-end:4px">${t('الإصدار')}:</span>
        ${['all', ...PROGRAM_VERSIONS].map(v => `
          <button type="button"
            class="fpill ${curVersion === v ? 'on' : ''}" 
            onclick="S.form.version='${v}'; R();"
            style="font-size:11.5px;padding:4px 10px"
          >
            ${v === 'all' ? t('الكل') : v}
          </button>
        `).join('')}
      </div>

      <!-- View Switcher (Table vs Cards) & Export CSV -->
      <div style="display:flex;align-items:center;gap:6px">
        <div style="display:inline-flex;border:1px solid var(--border);border-radius:10px;overflow:hidden;background:rgba(255,255,255,0.03)">
          <button 
            type="button"
            class="btn btn-xs ${curViewMode === 'table' ? 'btn-primary' : 'btn-ghost'}" 
            style="border-radius:0;font-size:11.5px;padding:6px 10px;font-weight:700"
            onclick="S.form.viewMode='table'; R();"
            title="${t('عرض جدول تفصيلي منظم')}"
          >
            ${mIc('table', 13)} ${t('جدول')}
          </button>
          <button 
            type="button"
            class="btn btn-xs ${curViewMode === 'cards' ? 'btn-primary' : 'btn-ghost'}" 
            style="border-radius:0;font-size:11.5px;padding:6px 10px;font-weight:700"
            onclick="S.form.viewMode='cards'; R();"
            title="${t('عرض بطاقات رحبة')}"
          >
            ${mIc('grid', 13)} ${t('بطاقات')}
          </button>
        </div>

        <button 
          type="button"
          class="btn btn-outline btn-xs" 
          onclick="exportLicensesCSV()" 
          style="font-size:11.5px;font-weight:700;padding:6px 10px;border-radius:10px"
          title="${t('تصدير التراخيص إلى ملف CSV')}"
        >
          ${mIc('download', 13)} CSV
        </button>
      </div>
    </div>

    <!-- Main Content Area: Table View or Cards View -->
    ${filtered.length === 0 ? `
      <div class="empty" style="padding:3rem 1rem;background:rgba(255,255,255,0.02);border:1px dashed var(--border);border-radius:var(--r-md)">
        <div class="empty-icon" style="margin-bottom:8px;color:var(--t3);display:flex;justify-content:center">${mIc('box', 34)}</div>
        <div class="empty-text" style="font-size:14px;font-weight:800;color:var(--t1)">${t('لا توجد تراخيص أو برامج مطابقة لخيارات الفلترة الحالية')}</div>
        <div style="font-size:12px;color:var(--t3);margin-top:4px;margin-bottom:12px">${t('يرجى تغيير المنصة أو الإصدار أو مسح نص البحث')}</div>
        <button class="btn btn-outline btn-sm" onclick="S.form.platform='all'; S.form.version='all'; S.form.search=''; R();">
          ${mIc('refresh', 13)} ${t('إعادة تعيين الفلاتر')}
        </button>
      </div>
    ` : (curViewMode === 'table' ? `
      <!-- 1. Table View (Clean, Pristine & Non-Overlapping) -->
      <div class="lic-table-wrap">
        <table class="lic-table">
          <thead>
            <tr>
              <th style="width:40px;text-align:center">#</th>
              <th style="min-width:180px">${t('العميل والمؤسسة')}</th>
              <th style="min-width:140px">${t('الولاية والهاتف')}</th>
              <th style="min-width:110px">${t('المنصة')}</th>
              <th style="min-width:140px">${t('البرنامج والنوع')}</th>
              <th style="width:75px;text-align:center">${t('الإصدار')}</th>
              <th style="width:85px;text-align:center">${t('الأجهزة')}</th>
              <th style="min-width:110px">${t('حالة الترخيص')}</th>
              <th style="width:90px;text-align:center">${t('إجراء')}</th>
            </tr>
          </thead>
          <tbody>
            ${filtered.map((item, idx) => {
              const plat = item.platform || 'Desktop';
              const platPillClass = plat === 'Desktop' ? 'lic-pill-desktop' : (plat === 'Mobile' ? 'lic-pill-mobile' : 'lic-pill-web');
              const platIcoName = plat === 'Desktop' ? 'desktop' : (plat === 'Mobile' ? 'mobile' : 'globe');
              const statusColor = isConfirmedClientStatus(item.clientStatus) ? 'var(--gt)' : 'var(--wt)';

              return `
                <tr>
                  <!-- Index -->
                  <td class="num" style="text-align:center;color:var(--t3);font-size:11px;font-weight:700">
                    ${idx + 1}
                  </td>

                  <!-- Client Name & Company -->
                  <td>
                    <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
                      <strong style="color:var(--t1);font-size:13px;cursor:pointer" onclick="closeModal(); selClient(${item.clientId}); setTab('programs');">
                        ${esc(item.clientName)}
                      </strong>
                      <span style="font-size:11px;font-weight:700;color:${statusColor}">
                        · ${t(item.clientStatus)}
                      </span>
                    </div>
                    ${item.clientCompany && item.clientCompany !== '—' ? `
                      <div style="font-size:11.5px;color:var(--t2);margin-top:2px;display:flex;align-items:center;gap:4px">
                        ${mIc('building', 11)} <span>${esc(item.clientCompany)}</span>
                      </div>
                    ` : ''}
                  </td>

                  <!-- Wilaya & Phone -->
                  <td>
                    <div style="font-size:12px;color:var(--t1);display:flex;align-items:center;gap:4px">
                      ${mIc('pin', 12)}
                      <span>${esc(item.clientWilaya)}</span>
                    </div>
                    ${item.clientPhone && item.clientPhone !== '—' ? `
                      <div class="num" style="font-size:11.5px;color:var(--t2);margin-top:2px;display:inline-flex;align-items:center;gap:4px" dir="ltr">
                        ${mIc('phone', 11)} <a href="tel:${esc(item.clientPhone)}" style="color:inherit;text-decoration:none">${esc(item.clientPhone)}</a>
                      </div>
                    ` : ''}
                  </td>

                  <!-- Platform Label -->
                  <td>
                    <span class="${platPillClass}">
                      ${mIc(platIcoName, 13)} ${esc(plat)}
                    </span>
                  </td>

                  <!-- Program & Type -->
                  <td>
                    <div style="font-weight:700;color:var(--t1);font-size:12.5px">
                      ${esc(item.programName || item.type || 'PROGILIC')}
                    </div>
                    <div style="font-size:11px;color:var(--t3);margin-top:1px">
                      ${esc(item.type || 'تجاري')}
                    </div>
                  </td>

                  <!-- Version -->
                  <td style="text-align:center">
                    <span class="lic-pill-ver num">
                      ${esc(item.version || '—')}
                    </span>
                  </td>

                  <!-- Devices Count -->
                  <td style="text-align:center">
                    <span class="lic-pill-dev num">
                      ${mIc('desktop', 12)} ${item.installationsCount || 1}
                    </span>
                  </td>

                  <!-- License Validity & Date -->
                  <td>
                    <div style="font-size:11.5px;color:var(--brand);font-weight:700;display:flex;align-items:center;gap:4px">
                      ${mIc('clock', 12)} ${t('مدى الحياة')}
                    </div>
                    ${item.startDate ? `
                      <div class="num" style="font-size:10.5px;color:var(--t3);margin-top:2px;display:flex;align-items:center;gap:4px">
                        ${mIc('calendar', 11)} ${esc(item.startDate)}
                      </div>
                    ` : ''}
                  </td>

                  <!-- Action Button -->
                  <td style="text-align:center">
                    <button 
                      type="button"
                      class="btn btn-ghost btn-xs" 
                      style="color:var(--bt);font-weight:700;font-size:11.5px;padding:4px 8px;border-radius:6px"
                      onclick="closeModal(); selClient(${item.clientId}); setTab('programs');"
                      title="${t('فتح بطاقة العميل')}"
                    >
                      ${t('عرض ↗')}
                    </button>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    ` : `
      <!-- 2. Cards View (Spacious, Tiered & Non-Overlapping) -->
      <div style="max-height:480px;overflow-y:auto;display:flex;flex-direction:column;gap:8px;padding-inline-end:4px">
        ${filtered.map(item => {
          const plat = item.platform || 'Desktop';
          const platPillClass = plat === 'Desktop' ? 'lic-pill-desktop' : (plat === 'Mobile' ? 'lic-pill-mobile' : 'lic-pill-web');
          const platIcoName = plat === 'Desktop' ? 'desktop' : (plat === 'Mobile' ? 'mobile' : 'globe');
          const statusColor = isConfirmedClientStatus(item.clientStatus) ? 'var(--gt)' : 'var(--wt)';

          return `
            <div 
              class="lic-card-item" 
              onclick="closeModal(); selClient(${item.clientId}); setTab('programs');"
              title="${t('اضغط لفتح بطاقة العميل وإدارة برامجه وتراخيصه')}"
            >
              <!-- Tier 1: Client Header -->
              <div class="lic-card-top">
                <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                  <span style="font-weight:800;font-size:14px;color:var(--t1)">${esc(item.clientName)}</span>
                  ${item.clientCompany && item.clientCompany !== '—' ? `
                    <span style="font-size:12px;color:var(--t2)">(${esc(item.clientCompany)})</span>
                  ` : ''}
                  <span style="font-size:11.5px;font-weight:700;color:${statusColor}">
                    · ${t(item.clientStatus)}
                  </span>
                </div>

                <button 
                  type="button"
                  class="btn btn-ghost btn-xs" 
                  style="color:var(--bt);font-weight:700;font-size:11.5px;padding:3px 8px;border-radius:6px"
                >
                  ${t('عرض العميل ↗')}
                </button>
              </div>

              <!-- Tier 2: Metadata Details -->
              <div class="lic-card-meta">
                <span style="display:inline-flex;align-items:center;gap:4px">${mIc('pin', 12)} ${esc(item.clientWilaya)}</span>
                ${item.clientPhone && item.clientPhone !== '—' ? `
                  <span class="num" style="display:inline-flex;align-items:center;gap:4px" dir="ltr">${mIc('phone', 12)} ${esc(item.clientPhone)}</span>
                ` : ''}
                <span style="display:inline-flex;align-items:center;gap:4px;color:var(--brand);font-weight:700">${mIc('clock', 12)} ${t('ترخيص مدى الحياة')}</span>
                ${item.startDate ? `
                  <span class="num" style="display:inline-flex;align-items:center;gap:4px">${mIc('calendar', 12)} ${t('بدء التثبيت')}: ${esc(item.startDate)}</span>
                ` : ''}
              </div>

              <!-- Tier 3: Unboxed Specs Strip -->
              <div class="lic-card-pills">
                <span class="${platPillClass}">
                  ${mIc(platIcoName, 13)} ${esc(plat)}
                </span>
                <span aria-hidden="true" style="color:var(--t3)">·</span>
                <span style="color:var(--t1);font-weight:700;font-size:12px">
                  ${esc(item.type || 'تجاري')}
                </span>
                <span aria-hidden="true" style="color:var(--t3)">·</span>
                <span class="lic-pill-ver num">
                  ${esc(item.version || '—')}
                </span>
                <span aria-hidden="true" style="color:var(--t3)">·</span>
                <span class="lic-pill-dev num">
                  ${mIc('desktop', 12)} ${item.installationsCount || 1} ${t('أجهزة')}
                </span>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `)}

    <!-- Modal Footer -->
    <div class="facts" style="margin-top:14px;display:flex;justify-content:space-between;align-items:center;border-top:1px solid var(--border);padding-top:12px">
      <span style="font-size:12px;color:var(--t3)">
        ${t('يتم عرض')} <b class="num" style="color:var(--t1)">${filtered.length}</b> ${t('من أصل')} <b class="num" style="color:var(--t1)">${totalLicenses}</b> ${t('ترخيصًا مسجلًا')}
      </span>
      <button type="button" class="btn btn-primary" onclick="closeModal()">${t('إغلاق')}</button>
    </div>
  `;
}

export function renderClientCleanupModal() {
  const safeAll = (clients || []).filter(Boolean);
  const mode = S.cleanupMode === 'strict' ? 'strict' : 'balanced';
  const plan = buildClientClassificationPlan(safeAll, mode);
  const currentlyConfirmed = safeAll.filter(c => isConfirmedClientStatus(c.status)).length;
  const currentlyUnconfirmed = safeAll.filter(c => isUnconfirmedClientStatus(c.status)).length;
  const noProgramsCount = safeAll.filter(c => getProgramStats(c).total === 0).length;
  const legacyCount = safeAll.filter(c => c.status !== 'مؤكد' && c.status !== 'غير مؤكد').length;

  const willConfirmCount = plan.changes.filter(ch => ch.nextStatus === 'مؤكد').length;
  const willUnconfirmCount = plan.changes.filter(ch => ch.nextStatus === 'غير مؤكد').length;
  const isExec = Boolean(S.cleanupIsExecuting);

  return `
    <div class="mhdr" style="border-bottom:1px solid var(--border);padding-bottom:12px;margin-bottom:16px">
      <div style="display:flex;align-items:center;gap:10px">
        <span style="width:34px;height:34px;border-radius:10px;background:rgba(48,209,88,0.14);border:1px solid rgba(48,209,88,0.28);color:var(--gt);display:inline-flex;align-items:center;justify-content:center">${mIc('target', 17)}</span>
        <div>
          <div class="mtitle" style="font-size:17px;font-weight:800;color:var(--t1)">${t('تصفية وتصنيف الزبائن')}</div>
          <div style="font-size:12px;color:var(--t2)">${t('تصنيف تلقائي للزبائن بين مؤكد وغير مؤكد مع حفظ نسخة احتياطية قبل التحديث')}</div>
        </div>
      </div>
      <button class="mclose" onclick="closeModal()" ${isExec ? 'disabled' : ''}>×</button>
    </div>

    <!-- Current Stats Row -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(150px, 1fr));gap:10px;margin-bottom:16px">
      <div style="background:rgba(48,209,88,0.08);border:1px solid rgba(48,209,88,0.25);padding:12px 14px;border-radius:var(--r-sm)">
        <div style="font-size:11.5px;color:var(--gt);font-weight:700">${t('مؤكد')} (${t('الحالي')})</div>
        <div class="num" style="font-size:22px;font-weight:800;color:var(--t1);margin-top:2px">${currentlyConfirmed}</div>
      </div>
      <div style="background:rgba(255,159,10,0.08);border:1px solid rgba(255,159,10,0.25);padding:12px 14px;border-radius:var(--r-sm)">
        <div style="font-size:11.5px;color:var(--wt);font-weight:700">${t('غير مؤكد')} (${t('الحالي')})</div>
        <div class="num" style="font-size:22px;font-weight:800;color:var(--t1);margin-top:2px">${currentlyUnconfirmed}</div>
      </div>
      <div style="background:rgba(10,132,255,0.08);border:1px solid rgba(10,132,255,0.25);padding:12px 14px;border-radius:var(--r-sm)">
        <div style="font-size:11.5px;color:var(--bt);font-weight:700">${t('بدون برامج')}</div>
        <div class="num" style="font-size:22px;font-weight:800;color:var(--t1);margin-top:2px">${noProgramsCount}</div>
      </div>
      <div style="background:rgba(255,255,255,0.03);border:1px solid var(--border);padding:12px 14px;border-radius:var(--r-sm)">
        <div style="font-size:11.5px;color:var(--t2);font-weight:700">${t('حالات قديمة')}</div>
        <div class="num" style="font-size:22px;font-weight:800;color:${legacyCount > 0 ? 'var(--wt)' : 'var(--t1)'};margin-top:2px">${legacyCount}</div>
      </div>
    </div>

    <!-- Mode Selection Cards -->
    <div style="font-size:12.5px;font-weight:800;color:var(--t1);margin-bottom:8px">${t('اختر قاعدة التصنيف:')}</div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(260px, 1fr));gap:10px;margin-bottom:16px">
      <button
        type="button"
        onclick="setCleanupMode('balanced')"
        style="text-align:start;padding:12px 14px;border-radius:var(--r-sm);cursor:pointer;border:1px solid ${mode === 'balanced' ? 'var(--brand)' : 'var(--border)'};background:${mode === 'balanced' ? 'rgba(10,132,255,0.12)' : 'rgba(255,255,255,0.03)'};color:var(--t1)"
      >
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:4px">
          <strong style="font-size:13px;color:${mode === 'balanced' ? 'var(--bt)' : 'var(--t1)'}">${t('الوضع المتوازن')}</strong>
          ${mode === 'balanced' ? `<span style="color:var(--bt)">${mIc('check', 15)}</span>` : ''}
        </div>
        <div style="font-size:11.5px;color:var(--t2);line-height:1.55">
          ${t('المتوازن (أي برنامج أو تواصل أو سجل = مؤكد)')}
        </div>
      </button>

      <button
        type="button"
        onclick="setCleanupMode('strict')"
        style="text-align:start;padding:12px 14px;border-radius:var(--r-sm);cursor:pointer;border:1px solid ${mode === 'strict' ? 'var(--brand)' : 'var(--border)'};background:${mode === 'strict' ? 'rgba(10,132,255,0.12)' : 'rgba(255,255,255,0.03)'};color:var(--t1)"
      >
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:4px">
          <strong style="font-size:13px;color:${mode === 'strict' ? 'var(--bt)' : 'var(--t1)'}">${t('الوضع الصارم')}</strong>
          ${mode === 'strict' ? `<span style="color:var(--bt)">${mIc('check', 15)}</span>` : ''}
        </div>
        <div style="font-size:11.5px;color:var(--t2);line-height:1.55">
          ${t('الصارم (يجب توفر برنامج وتواصل أو سجل لتأكيد العميل)')}
        </div>
      </button>
    </div>

    <!-- Live Classification Plan Summary -->
    <div style="background:rgba(255,255,255,0.03);border:1px solid var(--border);border-radius:var(--r-md);padding:14px;margin-bottom:14px">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:10px">
        <span style="font-size:12.5px;font-weight:800;color:var(--t1);display:inline-flex;align-items:center;gap:6px">
          ${mIc('chart', 14)}
          <span>${t('نتيجة المعاينة قبل التطبيق:')}</span>
        </span>
        <div style="display:flex;gap:12px;font-size:12px;font-weight:700;flex-wrap:wrap" class="num">
          <span style="color:var(--gt)">${t('مؤكد')}: ${plan.confirmedCount}</span>
          <span style="color:var(--wt)">${t('غير مؤكد')}: ${plan.unconfirmedCount}</span>
          <span style="color:var(--bt)">${t('سيتم تعديل')}: ${plan.changesCount}</span>
        </div>
      </div>

      ${plan.changesCount > 0 ? `
        <div style="display:flex;gap:10px;flex-wrap:wrap;font-size:11.5px;color:var(--t2);margin-bottom:10px">
          <span>→ ${t('سيتم تحويل إلى مؤكد')}: <strong class="num" style="color:var(--gt)">${willConfirmCount}</strong></span>
          <span>·</span>
          <span>→ ${t('سيتم تحويل إلى غير مؤكد')}: <strong class="num" style="color:var(--wt)">${willUnconfirmCount}</strong></span>
        </div>

        <div class="glass-table-wrap" style="max-height:240px;overflow-y:auto">
          <table class="glass-table">
            <thead>
              <tr>
                <th>${t('العميل')}</th>
                <th>${t('البرامج والتواصل')}</th>
                <th>${t('الحالة الحالية')}</th>
                <th>${t('الحالة الجديدة')}</th>
              </tr>
            </thead>
            <tbody>
              ${plan.changes.slice(0, 40).map(ch => `
                <tr>
                  <td>
                    <strong style="color:var(--t1);font-size:12.5px">${esc(ch.client.fullName)}</strong>
                    ${ch.client.company ? `<div style="font-size:11px;color:var(--t3)">${esc(ch.client.company)}</div>` : ''}
                  </td>
                  <td style="font-size:11.5px;color:var(--t2)">
                    <span class="num">${ch.signals.programsCount}</span> ${t('برامج')} ·
                    <span class="num">${ch.signals.contactsCount}</span> ${t('تواصل')} ·
                    <span class="num">${ch.signals.issuesCount + ch.signals.requirementsCount}</span> ${t('سجلات')}
                  </td>
                  <td>${sBdg(ch.prevStatus)}</td>
                  <td>${sBdg(ch.nextStatus)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        ${plan.changes.length > 40 ? `
          <div style="font-size:11.5px;color:var(--t3);margin-top:8px;text-align:center">
            + <span class="num">${plan.changes.length - 40}</span> ${t('عميل آخر مشمول بالتصنيف')}
          </div>
        ` : ''}
      ` : `
        <div style="padding:18px;text-align:center;color:var(--gt);font-size:12.5px;font-weight:700">
          ${t('جميع العملاء مصنفون بالفعل وفق القاعدة المختارة.')}
        </div>
      `}
    </div>

    <div class="facts" style="display:flex;justify-content:space-between;align-items:center;border-top:1px solid var(--border);padding-top:12px;gap:8px;flex-wrap:wrap">
      <button type="button" class="btn btn-ghost" onclick="closeModal()" ${isExec ? 'disabled' : ''}>${t('إلغاء')}</button>
      <button type="button" class="btn btn-primary" onclick="applyClientStatusCleanup()" ${isExec ? 'disabled style="opacity:0.6;cursor:not-allowed"' : ''}>
        ${isExec
          ? `${mIc('clock', 14)} <span>${t('جاري تطبيق التصنيف...')}</span>`
          : `${mIc('check', 14)} <span>${t('تطبيق التصنيف على قاعدة البيانات')} (<span class="num">${plan.changesCount}</span>)</span>`}
      </button>
    </div>
  `;
}



