import { S, clients } from '../state/store.js';
import { BUSINESS_TYPES, PLATFORMS, PROGRAM_TYPES, PROGRAM_VERSIONS, ISSUE_TYPES, PRIORITY_LEVELS, ISSUE_STATUSES, ISSUE_SOURCES, REQ_STATUSES, IMPACT_LEVELS, WILAYAS } from '../constants/index.js';
import { gc, selOpts, td, wOpts, actTypeOpts, esc, isClientAtRisk } from '../utils/index.js';
import { getPurgeAuditLogs } from '../business/purgeService.js';
import { computeScore, scoreColor } from '../business/intelligence.js';

const CSTATUSES = ['نشط', 'محتمل', 'متوقف'];
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

export function renderModal(){
  const m=S.modal;
  let html='';
  if(m==='addClient'||m==='editClient')html=renderClientModal();
  if(m==='addIssue'||m==='editIssue')html=renderIssueModal();
  if(m==='addRequirement'||m==='editReq')html=renderReqModal();
  if(m==='addProgram'||m==='editProgram')html=renderProgramModal();
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
  const isWide = m === 'geoReport' || m === 'ticketsAndReqs' || m === 'healthScoreExplainer' || m === 'dbPurge' || m === 'licensesExplorer';
  return`<div class="mbk"><div class="msheet" style="direction: ${S.lang === 'ar' ? 'rtl' : 'ltr'}; ${isWide ? 'max-width:920px; width:95vw;' : ''}">${html}</div></div>`;
}

import { t } from '../utils/i18n.js';
import { cOpts, programTypeOpts, updateProgramTypeSelect } from '../utils/index.js';

function renderClientModal(){
  const isEdit=S.modal==='editClient';
  let c={};if(isEdit)c=clients.find(x=>x.id===S.selId)||{};
  const curStatus = c.status || 'نشط';
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
      <div class="fgroup"><label class="flbl">${t('البلدية')} *</label><select class="fctl" id="f_cm"><option value="">${t('اختر البلدية')}</option>${cOpts(c.wilaya, c.commune)}</select></div>
      <div class="fgroup"><label class="flbl">${t('حساب Gmail')} <span style="font-size:11px;color:var(--muted)">(${t('اختياري')})</span></label><input type="email" class="fctl" id="f_gmail" dir="ltr" autocomplete="email" value="${esc(c.gmailAccount)}" placeholder="client@gmail.com"></div>
    </div>
    <div class="fgroup"><label class="flbl">${t('العنوان / المنطقة أو الحي')} <span style="font-size:11px;color:var(--muted)">(${t('اختياري')})</span></label><input class="fctl" id="f_lo" value="${esc(c.location)}" placeholder="${t('مثال: حي النصر، شارع أول نوفمبر')}"></div>
    <div class="frow">
      <div class="fgroup"><label class="flbl">${t('النشاط الرئيسي')} *</label><select class="fctl" id="f_bt" onchange="updateActTypeOpts()"><option value="">${t('اختر النشاط')}</option>${selOpts(ACTIVITIES,c.businessType)}</select></div>
      <div class="fgroup"><label class="flbl">${t('تخصص النشاط')} *</label><select class="fctl" id="f_bf">${actTypeOpts(c.businessType||'',c.businessField)}</select></div>
    </div>
    <div class="fsec">${t('حالة العقد والارتباط')}</div>
    <div class="frow">
      <div class="fgroup"><label class="flbl">${t('الحالة')} *</label><select class="fctl" id="f_st" onchange="onClientStatusChange()">${selOpts(CSTATUSES,curStatus)}</select></div>
      <div class="fgroup"><label class="flbl">${t('آخر تواصل')} *</label><input type="date" class="fctl" id="f_lc" value="${c.lastContact||td()}"></div>
    </div>
    <div class="fgroup">
      <label class="flbl">${t('تاريخ البدء / التسجيل')} * <span style="color:var(--brand);font-weight:600">(${t('ترخيص مدى الحياة')})</span></label>
      <input type="date" class="fctl" id="f_sd" value="${c.startDate||(curStatus==='نشط'?td():'')}">
    </div>
    ${!isEdit ? `
    <div id="active_client_prog_sec" style="background:var(--bg); border:1px solid var(--border); border-radius:var(--r-sm); padding:12px; margin-top:10px; ${curStatus==='نشط'?'':'display:none;'}">
      <div class="fsec" style="margin-top:0; color:var(--brand)">${t('📦 تسجيل أول برنامج ترخيص للعميل')}</div>
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
        <div class="fgroup">
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
    ` : ''}
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
      <div class="fgroup">
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
    <div class="facts">
      <button class="btn btn-ghost" onclick="closeModal()">${t('إلغاء')}</button>
      <button class="btn btn-primary" onclick="saveProgram(${isEdit?p.id:null})">${isEdit?t('حفظ التغييرات'):t('إضافة البرنامج')}</button>
    </div>`;
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
    <div class="fgroup" style="background:var(--bg);padding:10px;border-radius:var(--r-sm);border:1px solid var(--border)">
      <label class="flbl" style="display:flex;justify-content:space-between">
        <span>${t('نسبة الثقة التقريبية (%)')}</span>
        <span id="fi_cov" style="color:var(--brand)">${i.confidence||50}%</span>
      </label>
      <div class="conf-row">
        <input type="range" class="conf-range" id="fi_co" min="0" max="100" value="${i.confidence||50}" oninput="document.getElementById('fi_cov').textContent=this.value+'%'">
      </div>
    </div>
    <div class="fgroup" style="margin-top:10px">
      <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer">
        <input type="checkbox" id="fi_fo" ${i.featureOpp?'checked':''}>
        <strong>💡 ${t('فرصة ميزة جديدة في المنظومة')}</strong>
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
      <div class="mtitle" style="display:flex;align-items:center;gap:8px">💾 ${t('إدارة النسخ الاحتياطية')} <span style="font-size:11px;font-weight:normal;background:var(--border);padding:2px 8px;border-radius:99px;color:var(--t2)">${S.lang === 'fr' ? '30 sauvegardes conservées' : S.lang === 'en' ? '30 retained backups' : '30 نسخة محفوظة'}</span></div>
      <button class="mclose" onclick="closeModal()">×</button>
    </div>
    <div style="background:var(--bg);border:1px solid var(--border);border-radius:var(--r-sm);padding:12px;margin-bottom:1rem;font-size:12px;color:var(--t2);line-height:1.6">
      🔐 ${S.lang === 'fr' 
        ? 'Les sauvegardes sont enregistrées <strong>automatiquement dans votre navigateur (IndexedDB)</strong>. Le système conserve un maximum de <strong>30 sauvegardes consécutives</strong>.'
        : S.lang === 'en'
        ? 'Backups are stored <strong>automatically in your local browser (IndexedDB)</strong>. The system retains up to <strong>30 rolling snapshots</strong>.'
        : 'يتم حفظ النسخ الاحتياطية <strong>تلقائياً وبشكل دوري في جهازك (IndexedDB)</strong> بشكل معزول لكل مستخدم. يحتفظ النظام بحد أقصى <strong>30 نسخة متعاقبة</strong>.'}
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;gap:10px;flex-wrap:wrap">
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        <button class="btn btn-primary btn-sm" onclick="triggerManualBackup()">💾 ${t('إنشاء نسخة الآن')}</button>
        <label class="btn btn-outline btn-sm" style="cursor:pointer;margin:0;display:inline-flex;align-items:center;gap:6px" title="${t('استيراد ملف .dum أو .json')}">
          📥 ${S.lang === 'fr' ? 'Importer (.dum / .json)' : (S.lang === 'en' ? 'Import (.dum / .json)' : 'استيراد (.dum / .json)')}
          <input type="file" accept=".dum,.dump,.json,.txt,.csv" style="display:none" onchange="importData(this.files[0]);this.value=''">
        </label>
      </div>
      <button class="btn btn-outline btn-sm" onclick="loadBackupsList()">🔄 ${t('تحديث')}</button>
    </div>
    <div style="max-height:300px;overflow-y:auto;display:flex;flex-direction:column;gap:8px" class="custom-scrollbar">
      ${list.length === 0
        ? `<div style="text-align:center;padding:2rem;color:var(--t3);font-size:12px">📭 ${S.lang === 'fr' ? 'Aucune sauvegarde archivée pour l\'instant.' : S.lang === 'en' ? 'No backups saved yet.' : 'لا توجد نسخ احتياطية مسجلة بعد.'}</div>`
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
              <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-sm);padding:10px;display:flex;flex-direction:column;gap:6px">
                <div style="display:flex;align-items:center;justify-content:between;gap:8px;flex-wrap:wrap">
                  <strong style="font-size:12px;color:var(--t1)">${esc(b.reason || (S.lang === 'fr' ? 'Sauvegarde système' : S.lang === 'en' ? 'System Snapshot' : 'نسخة احتياطية بدون عنوان'))}</strong>
                  <span style="font-size:11px;color:var(--t3);margin-right:auto" dir="ltr">${dateStr}</span>
                </div>
                <div style="font-size:11px;color:var(--t2);display:flex;gap:12px;align-items:center">
                  <span>👥 ${t('العملاء')}: <strong>${clientCount}</strong></span>
                  <span>🖥️ ${t('البرامج')}: <strong>${programCount}</strong></span>
                </div>
                <div style="display:flex;gap:6px;margin-top:4px;flex-wrap:wrap">
                  <button class="btn btn-outline btn-xs" onclick="downloadBackup('${b.id}', 'json')">📥 JSON</button>
                  <button class="btn btn-outline btn-xs" onclick="downloadBackup('${b.id}', 'dum')">💾 DUM</button>
                  <button class="btn btn-success-soft btn-xs" onclick="triggerRestore('${b.id}')" style="font-weight:bold">🔄 ${S.lang === 'fr' ? 'Restaurer' : S.lang === 'en' ? 'Restore' : 'استرجاع هذه النسخة'}</button>
                  <button class="btn btn-danger-soft btn-xs" onclick="triggerDeleteBackup('${b.id}')">✕ ${t('حذف')}</button>
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
  const localData = item.payload.clientData;
  
  return `
    <div class="mhdr">
      <div class="mtitle" style="color: #ef4444;">⚠️ تعارض في المزامنة (Conflict)</div>
    </div>
    <div class="mbdy">
      <p style="margin-bottom: 15px; font-size: 14px; color: #475569;">
        تم تعديل هذا العميل في الخادم بواسطة مستخدم آخر أثناء انقطاع اتصالك بالإنترنت. يرجى اختيار التعديل الذي ترغب في الاحتفاظ به.
      </p>
      
      <div style="display: flex; gap: 16px; margin-bottom: 20px;">
        <div style="flex: 1; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; background: #f8fafc;">
          <h4 style="margin-top:0; color:#3b82f6; font-size: 14px;">بيانات الخادم (الأحدث)</h4>
          <ul style="padding-right: 20px; font-size: 13px; color: #334155; margin-bottom: 0;">
            <li><strong>الاسم:</strong> ${serverData.fullName || 'غير محدد'}</li>
            <li><strong>الحالة:</strong> ${serverData.status || 'غير محدد'}</li>
            <li><strong>رقم الإصدار:</strong> ${serverData.version || 0}</li>
          </ul>
        </div>
        
        <div style="flex: 1; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; background: #f1f5f9;">
          <h4 style="margin-top:0; color:#10b981; font-size: 14px;">تعديلاتك المحلية (غير المحفوظة)</h4>
          <ul style="padding-right: 20px; font-size: 13px; color: #334155; margin-bottom: 0;">
            <li><strong>الاسم:</strong> ${localData.fullName || 'غير محدد'}</li>
            <li><strong>الحالة:</strong> ${localData.status || 'غير محدد'}</li>
            <li><strong>رقم الإصدار:</strong> ${localData.version || 0}</li>
          </ul>
        </div>
      </div>
    </div>
    <div class="mftr" style="justify-content: flex-start; gap: 8px;">
      <button class="btn" style="background:#10b981; color:white; flex:1;" onclick="resolveConflict('local')">الاحتفاظ بتعديلاتي</button>
      <button class="btn" style="background:#3b82f6; color:white; flex:1;" onclick="resolveConflict('server')">اعتماد بيانات الخادم</button>
      <button class="btn btn-text" onclick="resolveConflict('merge')" style="flex:1; border:1px solid #cbd5e1;">${S.lang === 'fr' ? 'Fusionner les deux' : S.lang === 'en' ? 'Keep both' : 'دمج الخيارين'}</button>
    </div>
  `;
}

function renderDbPurgeModal() {
  const tab = S.purgeTab || 'filtered';
  const filterType = S.purgeFilterType || 'stopped_clients';
  const days = S.purgeOlderThanDays || 30;
  const sim = S.purgeSimulation || { totalClientsAffected: 0, programsCount: 0, issuesCount: 0, reqsCount: 0, contactsCount: 0, estimatedFreedKb: '0', sampleClients: [] };
  const confirmText = S.purgeConfirmText || '';
  const requiredCode = tab === 'all' ? 'DELETE-ALL-DATA' : 'CONFIRM-PURGE';
  const isMatch = confirmText.trim() === requiredCode;
  const selective = S.purgeSelectiveCollections || {};
  const progress = S.purgeProgress;
  const auditLogs = getPurgeAuditLogs();

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
    <div class="mhdr" style="background: #0d1117; color: #f0f6fc; border-bottom: 1px solid #30363d; padding: 16px 20px;">
      <div class="mtitle" style="display:flex;align-items:center;gap:10px;font-size:16px;font-weight:700">
        <span style="font-size:22px">🛡️</span>
        <div>
          <div style="color:#f0f6fc;letter-spacing:-0.3px">${titleText}</div>
          <div style="font-size:11px;font-weight:normal;color:#8b949e">${subTitleText}</div>
        </div>
      </div>
      <button class="mclose" style="color:#8b949e;font-size:24px" onclick="closeModal()">×</button>
    </div>

    <!-- Live Telemetry Banner -->
    <div style="background:#161b22;border-bottom:1px solid #30363d;padding:12px 20px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;font-size:12px;color:#c9d1d9">
      <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
        <span style="background:rgba(56,139,253,0.15);color:#58a6ff;padding:3px 8px;border-radius:6px;border:1px solid rgba(56,139,253,0.3);font-weight:600">☁️ ${S.lang === 'fr' ? 'Firestore connecté' : S.lang === 'en' ? 'Firestore connected' : 'متصل بقاعدة فايرستور'}</span>
        <span>👥 ${t('العملاء')}: <strong style="color:#f0f6fc">${totalClients}</strong></span>
        <span>📦 ${t('البرامج')}: <strong style="color:#f0f6fc">${totalProgs}</strong></span>
        <span>🐛 ${t('التذاكر والمشاكل')}: <strong style="color:#f0f6fc">${totalIssues}</strong></span>
      </div>
      <span style="font-size:11px;color:#8b949e">${S.lang==='fr'?'Opérateur':S.lang==='en'?'Operator':'المشغل'}: <span style="color:#58a6ff" dir="ltr">${esc(S.currentUser?.email || 'Admin')}</span></span>
    </div>

    <!-- Purge Mode Tabs -->
    <div style="display:flex;background:#0d1117;border-bottom:1px solid #30363d;padding:0 20px;gap:4px">
      <button class="btn" style="border:none;border-bottom:2px solid ${tab==='filtered'?'#58a6ff':'transparent'};background:transparent;color:${tab==='filtered'?'#58a6ff':'#8b949e'};font-weight:600;font-size:12px;padding:10px 14px;border-radius:0" onclick="setPurgeTab('filtered')">🎯 ${S.lang==='fr'?'Filtre intelligent':S.lang==='en'?'Smart filter':'تصفية بشرط'}</button>
      <button class="btn" style="border:none;border-bottom:2px solid ${tab==='selective'?'#58a6ff':'transparent'};background:transparent;color:${tab==='selective'?'#58a6ff':'#8b949e'};font-weight:600;font-size:12px;padding:10px 14px;border-radius:0" onclick="setPurgeTab('selective')">🔥 ${S.lang==='fr'?'Portée sélective':S.lang==='en'?'Selective scope':'محو مخصص'}</button>
      <button class="btn" style="border:none;border-bottom:2px solid ${tab==='all'?'#f85149':'transparent'};background:transparent;color:${tab==='all'?'#f85149':'#8b949e'};font-weight:600;font-size:12px;padding:10px 14px;border-radius:0" onclick="setPurgeTab('all')">⚠️ ${S.lang==='fr'?'Réinitialisation totale':S.lang==='en'?'Complete reset':'إعادة ضبط كاملة'}</button>
      <button class="btn" style="border:none;border-bottom:2px solid ${tab==='audit'?'#a371f7':'transparent'};background:transparent;color:${tab==='audit'?'#a371f7':'#8b949e'};font-weight:600;font-size:12px;padding:10px 14px;border-radius:0;margin-right:auto" onclick="setPurgeTab('audit')">📜 ${S.lang==='fr'?'Journaux d\'audit':S.lang==='en'?'Audit Logs':'سجلات التدقيق'} (${auditLogs.length})</button>
    </div>

    <div style="padding:16px 20px;max-height:480px;overflow-y:auto">

      ${tab === 'audit' ? renderAuditTabContent(auditLogs) : `

        <!-- Configuration Panel for Active Tab -->
        ${tab === 'filtered' ? `
          <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-md);padding:14px;margin-bottom:14px">
            <label class="flbl" style="font-weight:700;margin-bottom:8px;display:block">${S.lang==='fr'?'Critère de purge et filtrage :':S.lang==='en'?'Purge and filter criteria:':'اختر معيار التصفية والتطهير:'}</label>
            <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(220px, 1fr));gap:10px;margin-bottom:12px">
              <label style="display:flex;align-items:center;gap:8px;padding:10px;background:var(--bg);border:1px solid ${filterType==='stopped_clients'?'var(--brand)':'var(--border)'};border-radius:var(--r-sm);cursor:pointer">
                <input type="radio" name="pft" ${filterType==='stopped_clients'?'checked':''} onchange="setPurgeFilterType('stopped_clients')">
                <div>
                  <strong style="font-size:12px;display:block">${S.lang==='fr'?'Purger clients inactifs':S.lang==='en'?'Purge inactive clients':'حذف العملاء المتوقفين'}</strong>
                  <span style="font-size:11px;color:var(--t3)">${S.lang==='fr'?'Anciens clients au statut inactif':S.lang==='en'?'Old clients with inactive status':'العملاء بحالة "متوقف" القديمة'}</span>
                </div>
              </label>

              <label style="display:flex;align-items:center;gap:8px;padding:10px;background:var(--bg);border:1px solid ${filterType==='solved_issues'?'var(--brand)':'var(--border)'};border-radius:var(--r-sm);cursor:pointer">
                <input type="radio" name="pft" ${filterType==='solved_issues'?'checked':''} onchange="setPurgeFilterType('solved_issues')">
                <div>
                  <strong style="font-size:12px;display:block">${S.lang==='fr'?'Purger tickets résolus':S.lang==='en'?'Purge solved issues':'تصفية المشاكل المغلقة'}</strong>
                  <span style="font-size:11px;color:var(--t3)">${S.lang==='fr'?'Nettoyer définitivement les tickets résolus':S.lang==='en'?'Clean permanently resolved tickets':'تنظيف التذاكر المحلولة نهائياً'}</span>
                </div>
              </label>



              <label style="display:flex;align-items:center;gap:8px;padding:10px;background:var(--bg);border:1px solid ${filterType==='old_contacts'?'var(--brand)':'var(--border)'};border-radius:var(--r-sm);cursor:pointer">
                <input type="radio" name="pft" ${filterType==='old_contacts'?'checked':''} onchange="setPurgeFilterType('old_contacts')">
                <div>
                  <strong style="font-size:12px;display:block">${S.lang==='fr'?'Purger anciens contacts':S.lang==='en'?'Purge old contact records':'تصفية سجلات التواصل القديمة'}</strong>
                  <span style="font-size:11px;color:var(--t3)">${S.lang==='fr'?'Supprimer les anciens historiques':S.lang==='en'?'Delete historical interactions':'حذف الملاحظات التاريخية القديمة'}</span>
                </div>
              </label>
            </div>

            ${filterType === 'stopped_clients' || filterType === 'old_contacts' ? `
              <div style="display:flex;align-items:center;gap:12px;margin-top:10px;background:var(--bg);padding:10px;border-radius:var(--r-sm);border:1px solid var(--border)">
                <label style="font-size:12px;font-weight:600">${S.lang==='fr'?'Plus ancien que :':S.lang==='en'?'Older than:':'اقدم من كم يوم؟'}</label>
                <input type="number" class="fctl" style="width:100px;margin:0" value="${days}" min="1" max="365" oninput="setPurgeOlderThanDays(this.value)">
                <span style="font-size:12px;color:var(--t3)">${S.lang==='fr'?'jours (30 jours par défaut)':S.lang==='en'?'days (default 30 days)':'يوم (الافتراضي 30 يوم)'}</span>
              </div>
            ` : ''}
          </div>
        ` : ''}

        ${tab === 'selective' ? `
          <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-md);padding:14px;margin-bottom:14px">
            <label class="flbl" style="font-weight:700;margin-bottom:8px;display:block">${S.lang==='fr'?'Sélectionnez les catégories à supprimer du cloud :':S.lang==='en'?'Select categories to purge from cloud:':'حدد الفئات والمجموعات المراد حذفها من السحابة:'}</label>
            <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(180px, 1fr));gap:10px">
              ${[
                { id: 'clients', label: S.lang==='fr'?'👥 Clients':S.lang==='en'?'👥 Clients':'👥 العملاء', sub: S.lang==='fr'?'Tous les clients':S.lang==='en'?'All client records':'سجلات جميع العملاء' },
                { id: 'programs', label: S.lang==='fr'?'📦 Logiciels & Licences':S.lang==='en'?'📦 Software & Licenses':'📦 البرامج والتراخيص', sub: S.lang==='fr'?'Licences et postes':S.lang==='en'?'Licenses and devices':'تراخيص وأجهزة البرامج' },
                { id: 'issues', label: S.lang==='fr'?'🐛 Tickets & Anomalies':S.lang==='en'?'🐛 Issues & Tickets':'🐛 التذاكر والمشاكل', sub: S.lang==='fr'?'Tous les tickets':S.lang==='en'?'All issue tickets':'جميع تذاكر المتابعة' },
                { id: 'requirements', label: S.lang==='fr'?'💡 Demandes & Besoins':S.lang==='en'?'💡 Requirements & Ideas':'💡 المتطلبات والاقتراحات', sub: S.lang==='fr'?'Demandes de fonctionnalités':S.lang==='en'?'Feature requests':'طلبات الميزات' },
                { id: 'contacts', label: S.lang==='fr'?'📋 Historique Contacts':S.lang==='en'?'📋 Contact History':'📋 سجلات التواصل', sub: S.lang==='fr'?'Appels et réunions':S.lang==='en'?'Calls and meetings':'سجلات المكالمات والاجتماعات' },
                { id: 'cache', label: '🧹 IndexedDB Cache', sub: S.lang==='fr'?'Purger cache local':S.lang==='en'?'Clear local cache':'تطهير الذاكرة المحلية' }
              ].map(item => `
                <label style="display:flex;align-items:flex-start;gap:8px;padding:10px;background:var(--bg);border:1px solid ${selective[item.id]?'var(--brand)':'var(--border)'};border-radius:var(--r-sm);cursor:pointer">
                  <input type="checkbox" ${selective[item.id]?'checked':''} onchange="togglePurgeSelectiveCollection('${item.id}')">
                  <div>
                    <strong style="font-size:12px;display:block">${item.label}</strong>
                    <span style="font-size:10px;color:var(--t3)">${item.sub}</span>
                  </div>
                </label>
              `).join('')}
            </div>
          </div>
        ` : ''}

        ${tab === 'all' ? `
          <div style="background:rgba(239, 68, 68, 0.08);border:1px solid rgba(239, 68, 68, 0.3);border-radius:var(--r-md);padding:14px;margin-bottom:14px;color:#ef4444">
            <div style="font-weight:800;font-size:14px;margin-bottom:6px">⚠️ ${S.lang==='fr'?'Avertissement de risque élevé : suppression totale de la base de données':S.lang==='en'?'High-risk warning: complete database wipe':'تحذير عالي الخطورة: محو كامل لقاعدة البيانات'}</div>
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
        <div style="background:#0d1117;border:1px solid #30363d;border-radius:var(--r-md);padding:14px;margin-bottom:14px;color:#f0f6fc">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
            <span style="font-size:12px;font-weight:700;color:#58a6ff;display:flex;align-items:center;gap:6px">📊 ${S.lang==='fr'?'Analyse de Simulation (Dry Run Analysis)':S.lang==='en'?'Simulation Results (Dry Run Analysis)':'نتائج محاكاة المعاينة الفورية (Dry Run Analysis)'}</span>
            <span style="font-size:10px;background:rgba(56,139,253,0.15);color:#58a6ff;padding:2px 8px;border-radius:99px">${S.lang==='fr'?'Aperçu avant exécution':S.lang==='en'?'Pre-execution Preview':'معاينة قبل التنفيذ'}</span>
          </div>

          <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(110px, 1fr));gap:8px;margin-bottom:12px">
            <div style="background:#161b22;border:1px solid #30363d;border-radius:6px;padding:8px;text-align:center">
              <div style="font-size:16px;font-weight:800;color:${sim.totalClientsAffected>0?'#f85149':'#3fb950'}">${sim.totalClientsAffected}</div>
              <div style="font-size:10px;color:#8b949e">${S.lang==='fr'?'Clients affectés':S.lang==='en'?'Clients affected':'عميل متأثر'}</div>
            </div>
            <div style="background:#161b22;border:1px solid #30363d;border-radius:6px;padding:8px;text-align:center">
              <div style="font-size:16px;font-weight:800;color:${sim.programsCount>0?'#e3b341':'#8b949e'}">${sim.programsCount}</div>
              <div style="font-size:10px;color:#8b949e">${S.lang==='fr'?'Logiciels':S.lang==='en'?'Software':'برامج وترخيص'}</div>
            </div>
            <div style="background:#161b22;border:1px solid #30363d;border-radius:6px;padding:8px;text-align:center">
              <div style="font-size:16px;font-weight:800;color:${sim.issuesCount>0?'#e3b341':'#8b949e'}">${sim.issuesCount}</div>
              <div style="font-size:10px;color:#8b949e">${S.lang==='fr'?'Tickets':S.lang==='en'?'Issues':'مشكلة وتذكرة'}</div>
            </div>
            <div style="background:#161b22;border:1px solid #30363d;border-radius:6px;padding:8px;text-align:center">
              <div style="font-size:16px;font-weight:800;color:#58a6ff">${sim.estimatedFreedKb} KB</div>
              <div style="font-size:10px;color:#8b949e">${S.lang==='fr'?'Espace libéré':S.lang==='en'?'Freed space':'مساحة محررة'}</div>
            </div>
          </div>

          ${sim.sampleClients && sim.sampleClients.length > 0 ? `
            <div style="font-size:11px;color:#8b949e;margin-bottom:6px">${S.lang==='fr'?'Échantillon de clients ciblés :':S.lang==='en'?'Sample affected clients:':'عينة المخرجات المشمولة بالحذف:'}</div>
            <div style="display:flex;gap:6px;flex-wrap:wrap">
              ${sim.sampleClients.map(sc => `<span style="background:#21262d;border:1px solid #30363d;padding:2px 8px;border-radius:4px;font-size:11px;color:#c9d1d9">${esc(sc.fullName)} (${sc.company || '—'})</span>`).join('')}
              ${sim.totalClientsAffected > sim.sampleClients.length ? `<span style="font-size:11px;color:#8b949e;align-self:center">+ ${sim.totalClientsAffected - sim.sampleClients.length} ${S.lang==='fr'?'autres clients...':S.lang==='en'?'other clients...':'عميل آخر...'}</span>` : ''}
            </div>
          ` : `<div style="font-size:11px;color:#8b949e;text-align:center">${S.lang==='fr'?'Aucun enregistrement ne correspond actuellement à ces conditions.':S.lang==='en'?'No records currently match these conditions.':'لا توجد سجلات تنطبق عليها هذه الشروط حالياً.'}</div>`}
        </div>

        <!-- Protection & Operator Safeguards -->
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-md);padding:14px;margin-bottom:14px">
          <div style="font-size:12px;font-weight:700;margin-bottom:10px;color:var(--t1)">🛡️ ${S.lang==='fr'?'Options de sécurité et sauvegarde préventive :':S.lang==='en'?'Safety & Backup Safeguards:':'خيارات الأمان والنسخ الوقائي:'}</div>
          
          <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:12px">
            <label style="display:flex;align-items:center;gap:8px;font-size:12px;cursor:pointer">
              <input type="checkbox" id="p_ab" ${S.purgeAutoBackup !== false ? 'checked' : ''} onchange="updateState({ purgeAutoBackup: this.checked })">
              <span><strong>${S.lang==='fr'?'Sauvegarde locale automatique':S.lang==='en'?'Automatic local backup':'أخذ نسخة احتياطية محلية تلقائية'}</strong> ${S.lang==='fr'?'dans IndexedDB avant tout effacement':S.lang==='en'?'in IndexedDB before purging data':'في IndexedDB قبل البدء بمحو أي بيانات'}</span>
            </label>
            <label style="display:flex;align-items:center;gap:8px;font-size:12px;cursor:pointer">
              <input type="checkbox" id="p_db" ${S.purgeDownloadBackup !== false ? 'checked' : ''} onchange="updateState({ purgeDownloadBackup: this.checked })">
              <span><strong>${S.lang==='fr'?'Télécharger le fichier de sauvegarde (.json)':S.lang==='en'?'Download backup file (.json)':'تنزيل ملف النسخة الاحتياطية (.json)'}</strong> ${S.lang==='fr'?'directement sur votre appareil':S.lang==='en'?'directly to your device':'مباشرة لجهازك عند البدء'}</span>
            </label>
          </div>

          <div class="fgroup" style="margin-bottom:12px">
            <label class="flbl" style="font-size:11px">${S.lang==='fr'?'Motif / Note de l\'opérateur :':S.lang==='en'?'Reason / Operator note:':'سبب العملية / ملاحظة مسؤول النظام:'}</label>
            <input class="fctl" style="font-size:12px" value="${esc(S.purgeOperatorNote || '')}" oninput="updateState({ purgeOperatorNote: this.value })" placeholder="${S.lang==='fr'?'Ex: Nettoyage mensuel':S.lang==='en'?'E.g.: Monthly cleanup':'مثال: تنظيف دوري بنهاية الشهر'}">
          </div>

          <!-- Type-to-Confirm Guard -->
          <div style="background:#161b22;border:1px solid #30363d;border-radius:var(--r-sm);padding:12px;color:#f0f6fc">
            <div style="font-size:12px;font-weight:700;color:#f85149;margin-bottom:6px">🔐 ${S.lang==='fr'?'Confirmation par saisie du code :':S.lang==='en'?'Enter the confirmation code:':'تأكيد العملية بكتابة الرمز:'}</div>
            <div style="font-size:11px;color:#8b949e;margin-bottom:8px">
              ${S.lang==='fr'?'Veuillez taper le code suivant':S.lang==='en'?'Please type the following code':'يرجى كتابة الرمز التالي'} <strong style="color:#58a6ff;background:#21262d;padding:2px 6px;border-radius:4px" dir="ltr">${requiredCode}</strong> ${S.lang==='fr'?'pour déverrouiller l\'exécution :':S.lang==='en'?'to enable execution:':'لتفعيل زر التنفيذ:'}
            </div>
            <input class="fctl" style="background:#0d1117;border:1px solid ${isMatch ? '#3fb950' : '#f85149'};color:#f0f6fc;font-family:monospace;font-size:13px;letter-spacing:1px;direction:ltr;text-align:center" value="${esc(confirmText)}" oninput="updateState({ purgeConfirmText: this.value })" placeholder="${requiredCode}">
          </div>
        </div>

        <!-- Progress Tracker Bar during execution -->
        ${progress ? `
          <div style="background:#0d1117;border:1px solid #30363d;border-radius:var(--r-md);padding:12px;margin-bottom:14px;color:#f0f6fc">
            <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:6px">
              <span>${progress.text}</span>
              <strong style="color:#58a6ff">${progress.pct}%</strong>
            </div>
            <div style="width:100%;height:8px;background:#21262d;border-radius:99px;overflow:hidden">
              <div style="width:${progress.pct}%;height:100%;background:linear-gradient(90deg, #3b82f6, #10b981);transition:width 0.3s"></div>
            </div>
          </div>
        ` : ''}

      `}

    </div>

    <!-- Actions Footer -->
    <div class="facts" style="padding:16px 20px;border-top:1px solid var(--border);margin:0">
      <button class="btn btn-ghost" onclick="closeModal()">${t('إلغاء')}</button>
      ${tab !== 'audit' ? `
        <button class="btn ${tab === 'all' ? 'btn-danger' : 'btn-primary'}" ${!isMatch || S.purgeIsExecuting ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''} onclick="handleExecutePurge()">
          ${S.purgeIsExecuting ? (S.lang==='fr'?'⏳ Exécution en cours...':S.lang==='en'?'⏳ Executing...':'⏳ جاري التنفيذ...') : (tab === 'all' ? (S.lang==='fr'?'🔥 Exécuter Réinitialisation Totale':S.lang==='en'?'🔥 Execute Total Zero Wipe':'🔥 تنفيذ المحو والتصفير الشامل') : (S.lang==='fr'?'🎯 Exécuter la purge sélectionnée':S.lang==='en'?'🎯 Execute Selected Purge':'🎯 تنفيذ عملية التصفية المحددة'))}
        </button>
      ` : ''}
    </div>
  `;
}

function renderAuditTabContent(auditLogs) {
  const locale = S.lang === 'fr' ? 'fr-FR' : (S.lang === 'en' ? 'en-US' : 'ar-DZ');

  if (!auditLogs || auditLogs.length === 0) {
    return `
      <div style="text-align:center;padding:3rem 1rem;color:var(--t3);font-size:12px">
        📭 ${S.lang==='fr'
          ?'Aucun journal d\'audit de sécurité enregistré pour le moment. Chaque opération de purge y sera automatiquement répertoriée.'
          :(S.lang==='en'
            ?'No security audit logs recorded yet. Every purge operation will be automatically logged here with full details.'
            :'لا توجد سجلات تدقيق أمني مسجلة بعد. سيتم تسجيل كل عملية محو أو تصفية تنفذها مع تفاصيل العواقب هنا تلقائياً.')}
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
          <div style="background:#0d1117;border:1px solid #30363d;border-radius:var(--r-sm);padding:12px;color:#f0f6fc">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px">
              <span style="font-size:12px;font-weight:700;color:#58a6ff">${esc(log.operatorNote || defaultNote)}</span>
              <span style="font-size:11px;color:#8b949e" dir="ltr">${dStr}</span>
            </div>

            <div style="display:flex;gap:12px;font-size:11px;color:#c9d1d9;margin-bottom:6px;flex-wrap:wrap">
              <span>👤 ${S.lang==='fr'?'Opérateur':S.lang==='en'?'Operator':'المشغل'}: <strong dir="ltr">${esc(log.operatorEmail)}</strong></span>
              <span>🎯 ${S.lang==='fr'?'Portée':S.lang==='en'?'Scope':'النطاق'}: <strong>${scopeLabel}</strong></span>
              <span>👥 ${S.lang==='fr'?'Clients purgés':S.lang==='en'?'Clients purged':'العملاء المحذوفون'}: <strong style="color:#f85149">${log.deletedClientsCount || 0}</strong></span>
              <span>🐛 ${S.lang==='fr'?'Tickets purgés':S.lang==='en'?'Issues purged':'المشاكل المحذوفة'}: <strong style="color:#f85149">${log.deletedIssuesCount || 0}</strong></span>
            </div>

            ${log.backupSnapshotId ? `
              <div style="font-size:10px;color:#3fb950;display:flex;align-items:center;gap:4px">
                <span>✅ ${S.lang==='fr'?'Sauvegarde de sécurité créée sous le N° :':S.lang==='en'?'Pre-purge safety snapshot created:':'تم إنشاء نسخة احتياطية وقائية برقم:'}</span>
                <code style="background:#161b22;padding:1px 6px;border-radius:4px">${log.backupSnapshotId}</code>
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
    wilayaStats[w] = { name: w, total: 0, active: 0, prospective: 0, stopped: 0, scoreSum: 0, issues: 0, progs: 0 };
  });

  clients.forEach(c => {
    const w = (c.wilaya || 'غير محدد').trim();
    if (!wilayaStats[w]) {
      wilayaStats[w] = { name: w, total: 0, active: 0, prospective: 0, stopped: 0, scoreSum: 0, issues: 0, progs: 0 };
    }
    wilayaStats[w].total++;
    if (c.status === 'نشط') wilayaStats[w].active++;
    else if (c.status === 'محتمل') wilayaStats[w].prospective++;
    else if (c.status === 'متوقف') wilayaStats[w].stopped++;
    wilayaStats[w].scoreSum += (c.score !== undefined ? Number(c.score) : computeScore(c).total);
    wilayaStats[w].issues += (c.issues || []).filter(i => i.status === 'مفتوح' || i.status === 'قيد المعالجة').length;
    wilayaStats[w].progs += (c.programs || []).length || Number(c.programsCount) || (c.programNames?.length || 0);
  });

  const allWilayasList = Object.values(wilayaStats).sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, 'ar'));
  const filteredList = geoSearch 
    ? allWilayasList.filter(item => item.name.toLowerCase().includes(geoSearch))
    : allWilayasList;

  const coveredCount = allWilayasList.filter(item => item.total > 0).length;
  const topWilaya = allWilayasList[0] || { name: '—', total: 0 };
  const maxClientsInWilaya = Math.max(1, ...allWilayasList.map(x => x.total));

  return `
    <div class="mhd" style="display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--border);padding-bottom:12px;margin-bottom:16px">
      <div style="display:flex;align-items:center;gap:10px">
        <span style="font-size:24px">📍</span>
        <div>
          <div class="mtitle" style="font-size:17px;font-weight:800;color:var(--t1)">${t('التقرير الجغرافي الشامل للولايات')}</div>
          <div style="font-size:12px;color:var(--t2)">${t('توزيع قاعدة العملاء، التراخيص، ومؤشرات الأداء عبر كل الولايات')}</div>
        </div>
      </div>
      <div style="display:flex;gap:8px;align-items:center">
        <button class="btn btn-outline btn-sm" onclick="exportGeoReport()">
          📥 ${t('تصدير التقرير (CSV)')}
        </button>
        <button class="mcls" onclick="closeModal()">✕</button>
      </div>
    </div>

    <!-- Quick KPIs Summary -->
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:16px">
      <div style="background:var(--border-soft);padding:10px 14px;border-radius:10px">
        <div style="font-size:11px;color:var(--t2);font-weight:600">${t('الولايات المغطاة')}</div>
        <div style="font-size:22px;font-weight:800;color:var(--t1)" class="num">${coveredCount} <span style="font-size:12px;color:var(--t3);font-weight:600">/ ${WILAYAS.length}</span></div>
      </div>
      <div style="background:var(--border-soft);padding:10px 14px;border-radius:10px">
        <div style="font-size:11px;color:var(--t2);font-weight:600">${t('أعلى ولاية كثافة')}</div>
        <div style="font-size:20px;font-weight:800;color:#2a78d6">${esc(topWilaya.name)} <span style="font-size:13px;color:var(--t2)" class="num">(${topWilaya.total})</span></div>
      </div>
      <div style="background:var(--border-soft);padding:10px 14px;border-radius:10px">
        <div style="font-size:11px;color:var(--t2);font-weight:600">${t('نسبة التغطية الوطنية')}</div>
        <div style="font-size:22px;font-weight:800;color:#10b981" class="num">${((coveredCount / (WILAYAS.length || 1)) * 100).toFixed(1)}%</div>
      </div>
      <div style="background:var(--border-soft);padding:10px 14px;border-radius:10px">
        <div style="font-size:11px;color:var(--t2);font-weight:600">${t('إجمالي العملاء')}</div>
        <div style="font-size:22px;font-weight:800;color:var(--t1)" class="num">${clients.length}</div>
      </div>
    </div>

    <!-- Search input -->
    <div style="margin-bottom:12px;position:relative">
      <input 
        type="text" 
        class="fctl" 
        style="padding-right:32px" 
        placeholder="${t('ابحث عن اسم ولاية...')}" 
        value="${esc(geoSearch)}"
        oninput="S.form.geoSearch=this.value; R();"
      >
      <span style="position:absolute;right:10px;top:50%;transform:translateY(-50%);color:var(--t3)">🔍</span>
    </div>

    <!-- Scrollable Wilayas Table -->
    <div style="max-height:420px;overflow-y:auto;border:1px solid var(--border);border-radius:10px;background:var(--surface)">
      <table style="width:100%;border-collapse:collapse;font-size:13px;text-align:right">
        <thead>
          <tr style="background:var(--border-soft);color:var(--t2);border-bottom:1px solid var(--border);font-size:12px">
            <th style="padding:10px 14px">${t('الولاية')}</th>
            <th style="padding:10px 14px;text-align:center">${t('عدد العملاء')}</th>
            <th style="padding:10px 14px">${t('توزيع الحالة (نشط / محتمل / متوقف)')}</th>
            <th style="padding:10px 14px;text-align:center">${t('البرامج')}</th>
            <th style="padding:10px 14px;text-align:center">${t('مشاكل مفتوحة')}</th>
            <th style="padding:10px 14px;text-align:center">${t('صحة العملاء')}</th>
            <th style="padding:10px 14px;text-align:center">${t('إجراء سريع')}</th>
          </tr>
        </thead>
        <tbody>
          ${filteredList.map(item => {
            const avg = item.total ? Math.round(item.scoreSum / item.total) : 100;
            const barW = Math.round((item.total / maxClientsInWilaya) * 100);
            return `
              <tr style="border-bottom:1px solid var(--border-soft);transition:background .15s" onmouseover="this.style.background='var(--border-soft)'" onmouseout="this.style.background=''">
                <td style="padding:10px 14px;font-weight:700;color:var(--t1)">
                  ${esc(item.name)}
                </td>
                <td style="padding:10px 14px;text-align:center;font-weight:800;font-family:Inter" class="num">
                  <div style="display:inline-flex;align-items:center;gap:8px">
                    <span>${item.total}</span>
                    <div style="width:50px;height:6px;background:var(--border-soft);border-radius:3px;overflow:hidden">
                      <div style="width:${barW}%;height:100%;background:#2a78d6"></div>
                    </div>
                  </div>
                </td>
                <td style="padding:10px 14px">
                  ${item.total > 0 ? `
                    <div style="display:flex;gap:6px;font-size:11.5px">
                      <span style="color:#10b981;font-weight:700">${item.active} ${t('نشط')}</span> · 
                      <span style="color:#f59e0b;font-weight:700">${item.prospective} ${t('محتمل')}</span> · 
                      <span style="color:#ef4444;font-weight:700">${item.stopped} ${t('متوقف')}</span>
                    </div>
                  ` : `<span style="color:var(--t3);font-size:11.5px">—</span>`}
                </td>
                <td style="padding:10px 14px;text-align:center" class="num">${item.progs}</td>
                <td style="padding:10px 14px;text-align:center" class="num">
                  ${item.issues > 0 ? `<span style="color:#ef4444;font-weight:700">⚠️ ${item.issues}</span>` : `<span style="color:var(--t3)">0</span>`}
                </td>
                <td style="padding:10px 14px;text-align:center">
                  ${item.total > 0 ? `<span class="pill" style="background:${scoreColor(avg)}18;color:${scoreColor(avg)}">${avg}/100</span>` : '<span style="color:var(--t3)">—</span>'}
                </td>
                <td style="padding:10px 14px;text-align:center">
                  <div style="display:flex;gap:6px;justify-content:center">
                    <button class="btn btn-xs btn-outline" onclick="setDbWilaya('${esc(item.name)}');closeModal();setView('dashboard')" title="${t('تصفية لوحة القيادة بهذه الولاية')}">
                      📊 ${t('تصفية اللوحة')}
                    </button>
                    <button class="btn btn-xs btn-primary" onclick="S.fWilaya='${esc(item.name)}';S.filter='الكل';closeModal();setView('list')" title="${t('عرض العملاء في القائمة')}">
                      👥 ${t('العملاء')}
                    </button>
                  </div>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>

    <div class="facts" style="margin-top:14px;display:flex;justify-content:space-between">
      <span style="font-size:12px;color:var(--t2)">${t('تم العثور على')} <strong>${filteredList.length}</strong> ${t('ولاية')}</span>
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
    <div class="mhd" style="display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--border);padding-bottom:12px;margin-bottom:16px">
      <div style="display:flex;align-items:center;gap:10px">
        <span style="font-size:24px">${curTab === 'issues' ? '🎫' : '💡'}</span>
        <div>
          <div class="mtitle" style="font-size:17px;font-weight:800;color:var(--t1)">${t('مستكشف التذاكر وطلبات الميزات والتطوير')}</div>
          <div style="font-size:12px;color:var(--t2)">${t('استعراض وتتبع كافة مشاكل الدعم الفني وطلبات التحسين البرمجي عبر العملاء')}</div>
        </div>
      </div>
      <button class="mcls" onclick="closeModal()">✕</button>
    </div>

    <!-- Tab Switcher -->
    <div style="display:flex;background:var(--border-soft);border-radius:10px;padding:3px;margin-bottom:14px;gap:4px">
      <button 
        class="btn btn-sm ${curTab === 'issues' ? 'btn-primary' : 'btn-ghost'}" 
        style="flex:1;border-radius:8px;font-weight:700"
        onclick="S.form.tab='issues'; S.form.filter='all'; R();"
      >
        🎫 ${t('تذاكر الدعم والمشاكل التقنية')} (${allIssues.length})
      </button>
      <button 
        class="btn btn-sm ${curTab === 'reqs' ? 'btn-primary' : 'btn-ghost'}" 
        style="flex:1;border-radius:8px;font-weight:700"
        onclick="S.form.tab='reqs'; S.form.filter='all'; R();"
      >
        💡 ${t('طلبات الميزات والتطوير')} (${allReqs.length})
      </button>
    </div>

    <!-- Filters Bar and Search -->
    <div style="display:flex;gap:10px;margin-bottom:14px;align-items:center;flex-wrap:wrap">
      <div style="flex:1;min-width:200px;position:relative">
        <input 
          type="text" 
          class="fctl" 
          style="padding-right:32px" 
          placeholder="${curTab === 'issues' ? t('ابحث عن عنوان تذكرة أو اسم عميل...') : t('ابحث عن طلب ميزة...')}" 
          value="${esc(curSearch)}"
          oninput="S.form.search=this.value; R();"
        >
        <span style="position:absolute;right:10px;top:50%;transform:translateY(-50%);color:var(--t3)">🔍</span>
      </div>

      <!-- Quick Filter Pills -->
      <div class="filter-bar" style="margin:0;border:none;padding:0;gap:4px">
        ${curTab === 'issues' ? `
          ${['all', 'عاجل', 'عالية', 'مفتوح', 'محلول'].map(f => `
            <span 
              class="fpill ${curFilter === f ? 'on' : ''}" 
              onclick="S.form.filter='${f}'; R();"
            >
              ${f === 'all' ? t('الكل') : t(f)}
            </span>
          `).join('')}
        ` : `
          ${['all', 'مقترح', 'قيد الدراسة', 'مخطط', 'منفذ'].map(f => `
            <span 
              class="fpill ${curFilter === f ? 'on' : ''}" 
              onclick="S.form.filter='${f}'; R();"
            >
              ${f === 'all' ? t('الكل') : t(f)}
            </span>
          `).join('')}
        `}
      </div>
    </div>

    <!-- Items List -->
    <div style="max-height:420px;overflow-y:auto;display:flex;flex-direction:column;gap:8px">
      ${displayItems.length ? displayItems.map(item => {
        const isUrgent = item.priority === 'عاجل';
        const isHigh = item.priority === 'عالية' || item.impact === 'عالي';
        const isSolved = item.status === 'محلول' || item.status === 'منفذ';
        return `
          <div 
            class="card" 
            style="padding:12px 16px;cursor:pointer;border-inline-start:4px solid ${isUrgent ? '#ef4444' : (isHigh ? '#f97316' : (isSolved ? '#10b981' : '#2a78d6'))};transition:all .15s"
            onmouseover="this.style.transform='translateY(-1px)'" 
            onmouseout="this.style.transform=''"
            onclick="closeModal(); selClient(${item.clientId}); setTab('${curTab === 'issues' ? 'issues' : 'requirements'}');"
            title="${t('اضغط لفتح بطاقة العميل والتفاصيل الكاملة')}"
          >
            <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px">
              <div>
                <div style="font-weight:700;font-size:14px;color:var(--t1);margin-bottom:3px">
                  ${esc(item.title || item.name || 'بدون عنوان')}
                </div>
                <div style="font-size:12px;color:var(--t2);display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                  <span>👤 <strong>${esc(item.clientName)}</strong></span>
                  <span>📍 ${esc(item.clientWilaya || '—')}</span>
                  ${item.date ? `<span>📅 ${esc(item.date)}</span>` : ''}
                  ${item.repeatCount && Number(item.repeatCount) > 1 ? `<span style="color:#ef4444;font-weight:700">🔄 تكررت ${item.repeatCount} مرات</span>` : ''}
                </div>
              </div>
              <div style="display:flex;gap:6px;align-items:center;flex-shrink:0">
                ${item.priority ? `
                  <span class="pill ${item.priority === 'عاجل' ? 'r' : (item.priority === 'عالية' ? 'w' : 'b')}">
                    ${esc(item.priority)}
                  </span>
                ` : ''}
                ${item.impact ? `
                  <span class="pill ${item.impact === 'عالي' ? 'w' : 'b'}">
                    تأثير ${esc(item.impact)}
                  </span>
                ` : ''}
                <span class="pill ${isSolved ? 'g' : 'w'}">
                  ${esc(item.status || 'مفتوح')}
                </span>
                <span style="font-size:13px;color:var(--t3);margin-inline-start:4px">←</span>
              </div>
            </div>
            ${item.solution ? `
              <div style="font-size:12px;color:#065f46;background:#ecfdf5;border-radius:6px;padding:6px 10px;margin-top:8px">
                ✅ <strong>${t('الحل:')}</strong> ${esc(item.solution)}
              </div>
            ` : (item.notes ? `
              <div style="font-size:12px;color:var(--t2);margin-top:6px;line-height:1.4">
                📝 ${esc(item.notes)}
              </div>
            ` : '')}
          </div>
        `;
      }).join('') : `
        <div style="padding:3rem 1rem;text-align:center;color:var(--t2);background:var(--border-soft);border-radius:10px">
          <div style="font-size:32px;margin-bottom:8px">🔍</div>
          <div style="font-weight:700;font-size:14px">${t('لا توجد عناصر تطابق بحثك حالياً')}</div>
        </div>
      `}
    </div>

    <div class="facts" style="margin-top:14px;display:flex;justify-content:space-between">
      <span style="font-size:12px;color:var(--t2)">${t('تم العثور على')} <strong>${displayItems.length}</strong> ${curTab === 'issues' ? t('تذكرة') : t('طلب ميزة')}</span>
      <button class="btn btn-ghost" onclick="closeModal()">${t('إغلاق')}</button>
    </div>
  `;
}

// ─────────────────────────────────────────────────────────────
// 3. توضيح بطاقة صحة العملاء (Health Score Explainer Modal)
// ─────────────────────────────────────────────────────────────
export function renderHealthScoreExplainerModal() {
  return `
    <div class="mhd" style="display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--border);padding-bottom:12px;margin-bottom:16px">
      <div style="display:flex;align-items:center;gap:10px">
        <span style="font-size:24px">ℹ️</span>
        <div>
          <div class="mtitle" style="font-size:17px;font-weight:800;color:var(--t1)">${t('دليل مؤشر صحة العملاء (Customer Health Score)')}</div>
          <div style="font-size:12px;color:var(--t2)">${t('كيفية احتساب النقاط وتصنيف الحسابات والمعايير الأربعة المعتمدة')}</div>
        </div>
      </div>
      <button class="mcls" onclick="closeModal()">✕</button>
    </div>

    <div style="font-size:13.5px;color:var(--t1);line-height:1.6;margin-bottom:16px">
      <strong>مؤشر صحة العميل</strong> هو مقياس حسابي ذكي من <strong>0 إلى 100 نقطة</strong>، يُحسب آلياً لكل عميل في الوقت الحقيقي بناءً على 4 محاور أساسية تعكس استقرار حسابه ورضاه ومستوى ولائه لنظام PROGILIC CRM.
    </div>

    <!-- Tiers Breakdown -->
    <div style="font-size:13px;font-weight:800;color:var(--t1);margin-bottom:10px">🏷️ التصنيفات الأربعة لمستوى صحة العميل:</div>
    <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-bottom:20px">
      <div style="border:1px solid #10b981;background:rgba(16,185,129,0.08);border-radius:10px;padding:12px">
        <div style="display:flex;align-items:center;gap:8px;font-weight:800;color:#065f46;margin-bottom:4px">
          <span style="font-size:16px">🌟</span> عميل متميز (75 – 100 نقطة)
        </div>
        <div style="font-size:12px;color:var(--t2)">
          حساب نموذجي مستقر، لديه تراخيص نشطة، تواصل دوري مستمر، ولا توجد أي مشاكل معلقة أو أعطال حرجة.
        </div>
      </div>

      <div style="border:1px solid #f59e0b;background:rgba(245,158,11,0.08);border-radius:10px;padding:12px">
        <div style="display:flex;align-items:center;gap:8px;font-weight:800;color:#92400e;margin-bottom:4px">
          <span style="font-size:16px">👍</span> عميل جيد (50 – 74 نقطة)
        </div>
        <div style="font-size:12px;color:var(--t2)">
          حساب مستقر في مساره الطبيعي، قد يحتاج لتواصل اعتيادي أو تجديد ترخيص قادم في وقته.
        </div>
      </div>

      <div style="border:1px solid #f97316;background:rgba(249,115,22,0.08);border-radius:10px;padding:12px">
        <div style="display:flex;align-items:center;gap:8px;font-weight:800;color:#c2410c;margin-bottom:4px">
          <span style="font-size:16px">⚠️</span> يحتاج متابعة (25 – 49 نقطة)
        </div>
        <div style="font-size:12px;color:var(--t2)">
          تظهر عليه مؤشرات الفتور؛ مثل انقطاع الاتصال لأكثر من 30 يوماً، أو وجود مشكلة فنية غير محلولة.
        </div>
      </div>

      <div style="border:1px solid #ef4444;background:rgba(239,68,68,0.08);border-radius:10px;padding:12px">
        <div style="display:flex;align-items:center;gap:8px;font-weight:800;color:#991b1b;margin-bottom:4px">
          <span style="font-size:16px">🚨</span> خطر عالٍ (أقل من 25 نقطة)
        </div>
        <div style="font-size:12px;color:var(--t2)">
          حساب حرج جداً مهدد بالإلغاء أو التوقف؛ تراكم مشاكل عاجلة، عقد منتهي دون تجديد، أو انقطاع التواصل لأكثر من 60 يوماً.
        </div>
      </div>
    </div>

    <!-- The 4 Pillars Breakdown -->
    <div style="font-size:13px;font-weight:800;color:var(--t1);margin-bottom:10px">⚖️ كيف تُوزع الـ 100 نقطة بالتفصيل؟</div>
    <div style="border:1px solid var(--border);border-radius:10px;background:var(--surface);overflow:hidden;margin-bottom:16px">
      <div style="display:flex;align-items:center;padding:10px 14px;border-bottom:1px solid var(--border-soft);gap:12px">
        <div style="width:36px;height:36px;border-radius:8px;background:rgba(42,120,214,0.15);color:#2a78d6;display:grid;place-items:center;font-weight:800">35</div>
        <div>
          <div style="font-weight:700;color:var(--t1)">1. البرامج والتراخيص (35 نقطة كحد أقصى)</div>
          <div style="font-size:12px;color:var(--t2)">يُحتسب بناءً على عدد البرامج النشطة ونسبة الأجهزة المفعلة من التراخيص. الحساب الذي يمتلك تراخيص ممتدة ومحطات متعددة يحصل على كامل النقاط.</div>
        </div>
      </div>

      <div style="display:flex;align-items:center;padding:10px 14px;border-bottom:1px solid var(--border-soft);gap:12px">
        <div style="width:36px;height:36px;border-radius:8px;background:rgba(235,104,52,0.15);color:#eb6834;display:grid;place-items:center;font-weight:800">25</div>
        <div>
          <div style="font-weight:700;color:var(--t1)">2. التواصل الدوري وسجل الاتصالات (25 نقطة كحد أقصى)</div>
          <div style="font-size:12px;color:var(--t2)">25 نقطة إذا تم التواصل خلال آخر 7 أيام · 18 نقطة خلال 30 يوماً · 10 نقاط خلال 60 يوماً · 4 نقاط خلال 90 يوماً · 0 نقطة إذا تجاوز الانقطاع 90 يوماً.</div>
        </div>
      </div>

      <div style="display:flex;align-items:center;padding:10px 14px;border-bottom:1px solid var(--border-soft);gap:12px">
        <div style="width:36px;height:36px;border-radius:8px;background:rgba(27,175,122,0.15);color:#1baf7a;display:grid;place-items:center;font-weight:800">25</div>
        <div>
          <div style="font-weight:700;color:var(--t1)">3. الدعم الفني واستقرار النظام (25 نقطة كحد أقصى)</div>
          <div style="font-size:12px;color:var(--t2)">تبدأ من 25 نقطة؛ ويُخصم (4 نقاط) عن كل مشكلة مفتوحة، و(7 نقاط) عن كل مشكلة عاجلة معلقة، و(3 نقاط) عن المشاكل المتكررة 3 مرات فأكثر.</div>
        </div>
      </div>

      <div style="display:flex;align-items:center;padding:10px 14px;gap:12px">
        <div style="width:36px;height:36px;border-radius:8px;background:rgba(237,161,0,0.15);color:#eda100;display:grid;place-items:center;font-weight:800">15</div>
        <div>
          <div style="font-weight:700;color:var(--t1)">4. الميزات والمقترحات التطويرية (15 نقطة كحد أقصى)</div>
          <div style="font-size:12px;color:var(--t2)">يُمنح العميل 5 نقاط عن كل طلب ميزة أو متطلب ذي تأثير عالي مقدم من طرفه، مما يعكس شراكته وتفاعله الإيجابي في تطوير البرنامج.</div>
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

  // Aggregate all licenses across all clients
  const allLicenses = [];
  clients.forEach(c => {
    const progs = c.programs || [];
    progs.forEach(p => {
      allLicenses.push({
        ...p,
        clientId: c.id,
        clientName: c.fullName || 'عميل غير مسمى',
        clientCompany: c.company || '—',
        clientWilaya: c.wilaya || '—',
        clientPhone: c.phone || '—',
        clientStatus: c.status || 'نشط'
      });
    });
  });

  // Calculate high-level stats
  const totalLicenses = allLicenses.length;
  const desktopLicenses = allLicenses.filter(l => (l.platform || 'Desktop') === 'Desktop').length;
  const mobileLicenses = allLicenses.filter(l => l.platform === 'Mobile').length;
  const webLicenses = allLicenses.filter(l => l.platform === 'Web').length;
  const totalDevices = allLicenses.reduce((sum, l) => sum + (Number(l.installationsCount) || 1), 0);

  // Filter licenses
  let filtered = allLicenses.filter(l => {
    const plat = l.platform || 'Desktop';
    if (curPlatform !== 'all' && plat !== curPlatform) return false;
    if (curVersion !== 'all' && (l.version || '').toUpperCase() !== curVersion.toUpperCase()) return false;
    if (curType !== 'all') {
      const lType = (l.type || '').toLowerCase();
      if (!lType.includes(curType.toLowerCase())) return false;
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

  // Sort by client name
  filtered.sort((a, b) => (a.clientName || '').localeCompare(b.clientName || ''));

  return `
    <div class="mhdr" style="margin-bottom:12px">
      <div>
        <div class="mtitle" style="display:flex;align-items:center;gap:8px">
          <span style="font-size:20px">📦</span>
          <span>${t('مستكشف التراخيص والبرامج حسب الإصدار والمنصة')}</span>
          <span class="bdg bdg-b" style="font-size:12px;font-weight:700">${filtered.length} ${t('ترخيص')}</span>
        </div>
        <div style="font-size:12.5px;color:var(--t2);margin-top:3px">
          ${t('استعراض تفصيلي لكافة تراخيص العملاء والمنصات والإصدارات وعدد الأجهزة المرخصة في الـ CRM')}
        </div>
      </div>
      <button class="mclose" onclick="closeModal()">×</button>
    </div>

    <!-- Quick Stat KPI Pills -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px;margin-bottom:14px">
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-sm);padding:8px 12px;display:flex;align-items:center;justify-content:space-between">
        <span style="font-size:12px;color:var(--t3)">${t('إجمالي التراخيص')}</span>
        <span style="font-weight:800;font-size:15px;color:var(--t1)">${totalLicenses}</span>
      </div>
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-sm);padding:8px 12px;display:flex;align-items:center;justify-content:space-between">
        <span style="font-size:12px;color:var(--t3)">🖥️ Desktop</span>
        <span style="font-weight:800;font-size:15px;color:#2a78d6">${desktopLicenses}</span>
      </div>
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-sm);padding:8px 12px;display:flex;align-items:center;justify-content:space-between">
        <span style="font-size:12px;color:var(--t3)">📱 Mobile</span>
        <span style="font-weight:800;font-size:15px;color:#eda100">${mobileLicenses}</span>
      </div>
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-sm);padding:8px 12px;display:flex;align-items:center;justify-content:space-between">
        <span style="font-size:12px;color:var(--t3)">🌐 Web</span>
        <span style="font-weight:800;font-size:15px;color:#10b981">${webLicenses}</span>
      </div>
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-sm);padding:8px 12px;display:flex;align-items:center;justify-content:space-between">
        <span style="font-size:12px;color:var(--t3)">💻 ${t('إجمالي الأجهزة')}</span>
        <span style="font-weight:800;font-size:15px;color:var(--brand)">${totalDevices}</span>
      </div>
    </div>

    <!-- Platform Selector Tabs -->
    <div style="display:flex;gap:6px;margin-bottom:12px;border-bottom:1px solid var(--border);padding-bottom:10px;flex-wrap:wrap">
      ${[
        { id: 'all', label: 'كافة المنصات', icon: '🌐' },
        { id: 'Desktop', label: 'برامج Desktop (تجاري، إنتاجي، توزيع)', icon: '🖥️' },
        { id: 'Mobile', label: 'تطبيقات Mobile (لوحة القيادة، VDD، التاجر)', icon: '📱' },
        { id: 'Web', label: 'منظومة Web', icon: '🌐' }
      ].map(tab => `
        <button 
          class="btn btn-sm ${curPlatform === tab.id ? 'btn-primary' : 'btn-ghost'}" 
          style="font-size:12px;padding:6px 14px;border-radius:8px;font-weight:700"
          onclick="S.form.platform='${tab.id}'; S.form.type='all'; R();"
        >
          ${tab.icon} ${t(tab.label)}
        </button>
      `).join('')}
    </div>

    <!-- Sub-Filters: Versions, Types, Search & CSV Export -->
    <div style="display:flex;gap:10px;margin-bottom:12px;align-items:center;flex-wrap:wrap">
      
      <!-- Search -->
      <div style="flex:1;min-width:220px;position:relative">
        <input 
          type="text" 
          class="fctl" 
          style="padding-right:32px;font-size:12.5px" 
          placeholder="${t('ابحث: اسم العميل، الشركة، الولاية، أو الإصدار...')}" 
          value="${esc(curSearch)}"
          oninput="S.form.search=this.value; R();"
        >
        <span style="position:absolute;right:10px;top:50%;transform:translateY(-50%);color:var(--t3)">🔍</span>
      </div>

      <!-- Version Pills -->
      <div class="filter-bar" style="margin:0;border:none;padding:0;gap:4px">
        <span style="font-size:11.5px;color:var(--t3);font-weight:700;margin-left:4px">${t('الإصدار')}:</span>
        ${['all', 'V27', 'V26', 'V24', 'V23', 'V21'].map(v => `
          <span 
            class="fpill ${curVersion === v ? 'on' : ''}" 
            onclick="S.form.version='${v}'; R();"
            style="font-size:11.5px;padding:3px 8px"
          >
            ${v === 'all' ? t('الكل') : v}
          </span>
        `).join('')}
      </div>

      <!-- Export CSV Button -->
      <button class="btn btn-outline btn-xs" onclick="exportLicensesCSV()" style="font-size:11.5px;color:var(--brand);font-weight:700;margin-inline-start:auto">
        📊 ${t('تصدير التراخيص CSV')}
      </button>
    </div>

    <!-- Licenses Cards Grid / Table -->
    <div style="max-height:440px;overflow-y:auto;display:flex;flex-direction:column;gap:8px;padding-left:4px">
      ${filtered.length ? filtered.map(item => {
        const plat = item.platform || 'Desktop';
        const platColor = plat === 'Desktop' ? '#2a78d6' : (plat === 'Mobile' ? '#eda100' : '#10b981');
        const platIcon = plat === 'Desktop' ? '🖥️' : (plat === 'Mobile' ? '📱' : '🌐');
        return `
          <div 
            class="card" 
            style="padding:12px 16px;border-inline-start:4px solid ${platColor};transition:all .15s;cursor:pointer"
            onmouseover="this.style.transform='translateY(-1px)'" 
            onmouseout="this.style.transform=''"
            onclick="closeModal(); selClient(${item.clientId}); setTab('programs');"
            title="${t('اضغط لفتح بطاقة العميل وإدارة برامجه وتراخيصه')}"
          >
            <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap">
              <div style="flex:1;min-width:260px">
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
                  <span style="font-weight:800;font-size:14.5px;color:var(--t1)">${esc(item.clientName)}</span>
                  <span style="font-size:12.5px;color:var(--t2)">(${esc(item.clientCompany)})</span>
                  <span class="bdg ${item.clientStatus === 'نشط' ? 'bdg-g' : (item.clientStatus === 'محتمل' ? 'bdg-b' : 'bdg-y')}" style="font-size:11px">
                    ${t(item.clientStatus)}
                  </span>
                </div>
                
                <div style="display:flex;align-items:center;gap:12px;font-size:12px;color:var(--t2);flex-wrap:wrap">
                  <span style="display:flex;align-items:center;gap:4px">📍 ${esc(item.clientWilaya)}</span>
                  <span style="display:flex;align-items:center;gap:4px" dir="ltr">📞 ${esc(item.clientPhone)}</span>
                  <span style="color:var(--brand);font-weight:700">⏳ ${t('ترخيص مدى الحياة')}</span>
                  ${item.startDate ? `<span>📅 ${t('بدء التثبيت')}: ${esc(item.startDate)}</span>` : ''}
                </div>
              </div>

              <!-- Program Badge & Version & Devices -->
              <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                <span style="background:rgba(42,120,214,0.1);color:${platColor};font-weight:700;font-size:11.5px;padding:4px 10px;border-radius:6px;border:1px solid rgba(42,120,214,0.2)">
                  ${platIcon} ${esc(item.platform || 'Desktop')}
                </span>
                <span style="background:var(--surface);border:1px solid var(--border);color:var(--t1);font-weight:700;font-size:11.5px;padding:4px 10px;border-radius:6px">
                  ${esc(item.type || 'تجاري')}
                </span>
                <span style="background:#2563EB;color:#fff;font-weight:800;font-size:11.5px;padding:4px 10px;border-radius:6px">
                  ${esc(item.version || 'V27')}
                </span>
                <span style="background:var(--border-soft);color:var(--ink2);font-weight:800;font-size:11.5px;padding:4px 10px;border-radius:6px">
                  💻 ${item.installationsCount || 1} ${t('أجهزة')}
                </span>
                <button class="btn btn-ghost btn-xs" style="color:var(--brand);font-weight:700;margin-inline-start:4px">
                  ${t('عرض العميل ↗')}
                </button>
              </div>
            </div>
          </div>
        `;
      }).join('') : `
        <div class="empty" style="padding:2.5rem 1rem">
          <div class="empty-icon" style="font-size:36px">📦</div>
          <div class="empty-text" style="font-size:14px;font-weight:700">${t('لا توجد تراخيص أو برامج مطابقة لخيارات الفلترة الحالية')}</div>
          <div style="font-size:12px;color:var(--t3);margin-top:4px">${t('يرجى تغيير المنصة أو الإصدار أو مسح نص البحث')}</div>
        </div>
      `}
    </div>

    <!-- Footer -->
    <div class="facts" style="margin-top:14px;display:flex;justify-content:space-between;align-items:center">
      <span style="font-size:12px;color:var(--t3)">
        ${t('يتم عرض')} <b style="color:var(--t1)">${filtered.length}</b> ${t('من أصل')} <b style="color:var(--t1)">${totalLicenses}</b> ${t('ترخيصًا مسجلًا')}
      </span>
      <button class="btn btn-primary" onclick="closeModal()">${t('إغلاق')}</button>
    </div>
  `;
}

