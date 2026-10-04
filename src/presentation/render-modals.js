import { S, clients } from '../state/store.js';
import { BUSINESS_TYPES, PLATFORMS, PROGRAM_TYPES, ISSUE_TYPES, PRIORITY_LEVELS, ISSUE_STATUSES, ISSUE_SOURCES, REQ_STATUSES, IMPACT_LEVELS, WILAYAS } from '../constants/index.js';
import { gc, selOpts, td, wOpts, actTypeOpts, esc } from '../utils/index.js';
import { getPurgeAuditLogs } from '../business/purgeService.js';

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
  return`<div class="mbk" onclick="bkClose(event)"><div class="msheet" style="direction: ${S.lang === 'ar' ? 'rtl' : 'ltr'};">${html}</div></div>`;
}

import { t } from '../utils/i18n.js';
import { cOpts } from '../utils/index.js';

function renderClientModal(){
  const isEdit=S.modal==='editClient';
  let c={};if(isEdit)c=clients.find(x=>x.id===S.selId)||{};
  const curStatus = c.status || 'نشط';
  return`
    <div class="mhdr">
      <div class="mtitle">${isEdit?t('تعديل'):t('إضافة عميل جديد')}</div>
      <button class="mclose" onclick="closeModal()">×</button>
    </div>
    <div class="frow">
      <div class="fgroup"><label class="flbl">${t('الاسم الكامل')} *</label><input class="fctl" id="f_fn" value="${esc(c.fullName)}"></div>
      <div class="fgroup"><label class="flbl">${t('المؤسسة / الشركة')}</label><input class="fctl" id="f_co" value="${esc(c.company)}"></div>
    </div>
    <div class="frow">
      <div class="fgroup"><label class="flbl">${t('الهاتف')}</label><input class="fctl" id="f_ph" dir="ltr" value="${esc(c.phone)}"></div>
      <div class="fgroup"><label class="flbl">${t('الولاية')}</label><select class="fctl" id="f_wi" onchange="updateCommunesOpts()"><option value="">${t('اختر الولاية')}</option>${wOpts(c.wilaya)}</select></div>
    </div>
    <div class="frow">
      <div class="fgroup"><label class="flbl">${t('البلدية')}</label><select class="fctl" id="f_cm"><option value="">${t('اختر البلدية')}</option>${cOpts(c.wilaya, c.commune)}</select></div>
      <div class="fgroup"><label class="flbl">${t('العنوان')} / ${t('المنطقة / الحي')}</label><input class="fctl" id="f_lo" value="${esc(c.location)}"></div>
    </div>
    <div class="frow">
      <div class="fgroup"><label class="flbl">${t('النشاط الرئيسي')}</label><select class="fctl" id="f_bt" onchange="updateActTypeOpts()"><option value="">${t('اختر النشاط')}</option>${selOpts(ACTIVITIES,c.businessType)}</select></div>
      <div class="fgroup"><label class="flbl">${t('تخصص النشاط')}</label><select class="fctl" id="f_bf">${actTypeOpts(c.businessType||'',c.businessField)}</select></div>
    </div>
    <div class="fsec">${t('حالة العقد والارتباط')}</div>
    <div class="frow">
      <div class="fgroup"><label class="flbl">${t('الحالة')}</label><select class="fctl" id="f_st" onchange="onClientStatusChange()">${selOpts(CSTATUSES,curStatus)}</select></div>
      <div class="fgroup"><label class="flbl">${t('آخر تواصل')}</label><input type="date" class="fctl" id="f_lc" value="${c.lastContact||td()}"></div>
    </div>
    <div class="frow">
      <div class="fgroup"><label class="flbl">${t('تاريخ البداية')}</label><input type="date" class="fctl" id="f_sd" value="${c.startDate||(curStatus==='نشط'?td():'')}"></div>
      <div class="fgroup"><label class="flbl">${t('تاريخ النهاية')}</label><input type="date" class="fctl" id="f_ed" value="${c.endDate||''}"></div>
    </div>
    ${!isEdit ? `
    <div id="active_client_prog_sec" style="background:var(--bg); border:1px solid var(--border); border-radius:var(--r-sm); padding:12px; margin-top:10px; ${curStatus==='نشط'?'':'display:none;'}">
      <div class="fsec" style="margin-top:0; color:var(--brand)">${t('📦 تسجيل أول برنامج ترخيص (اختياري للعميل النشط)')}</div>
      <div class="fgroup">
        <label class="flbl">${t('اسم البرنامج المرخص')}</label>
        <input class="fctl" id="f_p_nm" placeholder="PROGILIC POS...">
      </div>
      <div class="frow">
        <div class="fgroup">
          <label class="flbl">${t('المنصة')}</label>
          <select class="fctl" id="f_p_pl">${selOpts(PROGRAM_PLATFORMS, 'Desktop')}</select>
        </div>
        <div class="fgroup">
          <label class="flbl">${t('نوع البرنامج')}</label>
          <select class="fctl" id="f_p_ty">${selOpts(PROGRAM_TYPES, 'تجاري')}</select>
        </div>
        <div class="fgroup">
          <label class="flbl">${t('عدد الأجهزة')}</label>
          <input type="number" class="fctl" id="f_p_ic" min="1" value="1">
        </div>
      </div>
    </div>
    ` : ''}
    <div class="fgroup" style="margin-top:10px"><label class="flbl">${t('ملاحظات عامة')}</label><textarea class="fctl" id="f_no">${esc(c.notes)}</textarea></div>
    <div class="facts">
      <button class="btn btn-ghost" onclick="closeModal()">${t('إلغاء')}</button>
      <button class="btn btn-primary" onclick="saveClient(${isEdit?c.id:null})">${isEdit?t('تعديل'):t('حفظ العميل')}</button>
    </div>`;
}

function renderProgramModal(){
  const isEdit=S.modal==='editProgram';
  const cid=S.selId;const c=clients.find(x=>x.id===cid);if(!c)return'';
  let p={};
  if(isEdit){const eid=S.form.eid;p=c.programs.find(x=>x.id===eid)||{};}
  return`
    <div class="mhdr">
      <div class="mtitle">${isEdit?t('تعديل البرنامج'):t('إضافة برنامج جديد')}</div>
      <button class="mclose" onclick="closeModal()">×</button>
    </div>
    <div class="fgroup">
      <label class="flbl">${t('البرنامج / المنتج *')}</label>
      <input class="fctl" id="fp_nm" value="${esc(p.programName)}" placeholder="PROGILIC POS...">
    </div>
    <div class="frow">
      <div class="fgroup">
        <label class="flbl">${t('المنصة')}</label>
        <select class="fctl" id="fp_pl">${selOpts(PROGRAM_PLATFORMS,p.platform||'Desktop')}</select>
      </div>
      <div class="fgroup">
        <label class="flbl">${t('النوع')}</label>
        <select class="fctl" id="fp_ty">${selOpts(PROGRAM_TYPES,p.type||'تجاري')}</select>
      </div>
    </div>
    <div class="fgroup">
      <label class="flbl">${t('عدد الأجهزة المرخصة')}</label>
      <input type="number" class="fctl" id="fp_ic" min="1" value="${p.installationsCount||1}">
    </div>
    <div class="frow">
      <div class="fgroup">
        <label class="flbl">${t('تاريخ البداية / التثبيت')}</label>
        <input type="date" class="fctl" id="fp_sd" value="${p.startDate||td()}">
      </div>
      <div class="fgroup">
        <label class="flbl">${t('تاريخ الانتهاء')}</label>
        <input type="date" class="fctl" id="fp_ed" value="${p.endDate||''}">
        <div class="fhint">${t('اتركه فارغاً إذا كان مدى الحياة')}</div>
      </div>
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
      <div class="mtitle" style="display:flex;align-items:center;gap:8px">💾 ${t('إدارة النسخ الاحتياطية')} <span style="font-size:11px;font-weight:normal;background:var(--border);padding:2px 8px;border-radius:99px;color:var(--t2)">rolling 30 snapshots</span></div>
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
      <button class="btn btn-primary btn-sm" onclick="triggerManualBackup()">💾 ${t('إنشاء نسخة الآن')}</button>
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
                <div style="display:flex;gap:6px;margin-top:4px">
                  <button class="btn btn-outline btn-xs" onclick="downloadBackup('${b.id}')">📥 ${S.lang === 'fr' ? 'Télécharger' : S.lang === 'en' ? 'Download' : 'تحميل الملف'} (.json)</button>
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
      <button class="btn btn-text" onclick="resolveConflict('merge')" style="flex:1; border:1px solid #cbd5e1;">دمج (Keep Both)</button>
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
    ? 'Console de Purge & Nettoyage de Base de Données'
    : (S.lang === 'en' 
      ? 'Database Purge & Maintenance Console' 
      : 'لوحة تصفية ومحو قاعدة البيانات — Copilot Enterprise DB Console');

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
        <span style="background:rgba(56,139,253,0.15);color:#58a6ff;padding:3px 8px;border-radius:6px;border:1px solid rgba(56,139,253,0.3);font-weight:600">☁️ Firestore Connected</span>
        <span>👥 ${t('العملاء')}: <strong style="color:#f0f6fc">${totalClients}</strong></span>
        <span>📦 ${t('البرامج')}: <strong style="color:#f0f6fc">${totalProgs}</strong></span>
        <span>🐛 ${t('التذاكر والمشاكل')}: <strong style="color:#f0f6fc">${totalIssues}</strong></span>
      </div>
      <span style="font-size:11px;color:#8b949e">${S.lang==='fr'?'Opérateur':S.lang==='en'?'Operator':'المشغل'}: <span style="color:#58a6ff" dir="ltr">${esc(S.currentUser?.email || 'Admin')}</span></span>
    </div>

    <!-- Purge Mode Tabs -->
    <div style="display:flex;background:#0d1117;border-bottom:1px solid #30363d;padding:0 20px;gap:4px">
      <button class="btn" style="border:none;border-bottom:2px solid ${tab==='filtered'?'#58a6ff':'transparent'};background:transparent;color:${tab==='filtered'?'#58a6ff':'#8b949e'};font-weight:600;font-size:12px;padding:10px 14px;border-radius:0" onclick="setPurgeTab('filtered')">🎯 ${S.lang==='fr'?'Filtre Intelligent (Smart Filter)':S.lang==='en'?'Smart Filter':'تصفية بشرط (Smart Filter)'}</button>
      <button class="btn" style="border:none;border-bottom:2px solid ${tab==='selective'?'#58a6ff':'transparent'};background:transparent;color:${tab==='selective'?'#58a6ff':'#8b949e'};font-weight:600;font-size:12px;padding:10px 14px;border-radius:0" onclick="setPurgeTab('selective')">🔥 ${S.lang==='fr'?'Portée Sélective (Selective Scope)':S.lang==='en'?'Selective Scope':'محو مخصص (Selective Scope)'}</button>
      <button class="btn" style="border:none;border-bottom:2px solid ${tab==='all'?'#f85149':'transparent'};background:transparent;color:${tab==='all'?'#f85149':'#8b949e'};font-weight:600;font-size:12px;padding:10px 14px;border-radius:0" onclick="setPurgeTab('all')">⚠️ ${S.lang==='fr'?'Réinitialisation Totale (Zero Wipe)':S.lang==='en'?'Zero Wipe Reset':'إعادة ضبط كاملة (Zero Wipe)'}</button>
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

              <label style="display:flex;align-items:center;gap:8px;padding:10px;background:var(--bg);border:1px solid ${filterType==='expired_programs'?'var(--brand)':'var(--border)'};border-radius:var(--r-sm);cursor:pointer">
                <input type="radio" name="pft" ${filterType==='expired_programs'?'checked':''} onchange="setPurgeFilterType('expired_programs')">
                <div>
                  <strong style="font-size:12px;display:block">${S.lang==='fr'?'Purger licences expirées':S.lang==='en'?'Purge expired licenses':'تصفية التراخيص المنتهية'}</strong>
                  <span style="font-size:11px;color:var(--t3)">${S.lang==='fr'?'Supprimer logiciels arrivés à expiration':S.lang==='en'?'Delete expired software programs':'حذف البرامج المنتهية الصلاحية'}</span>
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
            <div style="font-weight:800;font-size:14px;margin-bottom:6px">⚠️ ${S.lang==='fr'?'Avertissement à haut risque : Effacement total de la base (Zero Wipe)':S.lang==='en'?'High Risk Warning: Total Database Wipe (Zero Wipe)':'تحذير عالي الخطورة: محو وتصفير شامل لكل قاعدة البيانات (Zero Wipe)'}</div>
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
            <div style="font-size:12px;font-weight:700;color:#f85149;margin-bottom:6px">🔐 ${S.lang==='fr'?'Confirmation par code (Type to Confirm) :':S.lang==='en'?'Type to Confirm:':'تأكيد العملية رمزياً (Type to Confirm):'}</div>
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
        ${S.lang==='fr'?'Journal d\'audit des opérations de purge (Enterprise Security Audit Trail) :':S.lang==='en'?'Purge & Wipe Audit Trail (Enterprise Security Audit Trail):':'سجل العمليات التاريخية للمحو والتصفية (Enterprise Security Audit Trail):'}
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
