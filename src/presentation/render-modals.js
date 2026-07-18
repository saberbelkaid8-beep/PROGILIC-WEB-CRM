import { S, clients } from '../state/store.js';
import { BUSINESS_TYPES, PLATFORMS, PROGRAM_TYPES, ISSUE_TYPES, PRIORITY_LEVELS, ISSUE_STATUSES, ISSUE_SOURCES, REQ_STATUSES, IMPACT_LEVELS, WILAYAS } from '../constants/index.js';
import { gc, selOpts, td, wOpts, actTypeOpts, esc } from '../utils/index.js';

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
  return`<div class="mbk" onclick="bkClose(event)"><div class="msheet">${html}</div></div>`;
}

import { t } from '../utils/i18n.js';
import { cOpts } from '../utils/index.js';

function renderClientModal(){
  const isEdit=S.modal==='editClient';
  let c={};if(isEdit)c=clients.find(x=>x.id===S.selId)||{};
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
      <div class="fgroup"><label class="flbl">${t('الولاية')}</label><select class="fctl" id="f_wi" onchange="updateCommunesOpts()"><option value="">${S.lang === 'fr' ? 'Sélectionner Wilaya' : 'اختر الولاية'}</option>${wOpts(c.wilaya)}</select></div>
    </div>
    <div class="frow">
      <div class="fgroup"><label class="flbl">${t('البلدية')}</label><select class="fctl" id="f_cm"><option value="">${S.lang === 'fr' ? 'Sélectionner Commune' : 'اختر البلدية'}</option>${cOpts(c.wilaya, c.commune)}</select></div>
      <div class="fgroup"><label class="flbl">${t('العنوان')} / ${t('المنطقة / الحي')}</label><input class="fctl" id="f_lo" value="${esc(c.location)}"></div>
    </div>
    <div class="frow">
      <div class="fgroup"><label class="flbl">النشاط الرئيسي</label><select class="fctl" id="f_bt" onchange="updateActTypeOpts()"><option value="">اختر النشاط</option>${selOpts(ACTIVITIES,c.businessType)}</select></div>
      <div class="fgroup"><label class="flbl">تخصص النشاط</label><select class="fctl" id="f_bf">${actTypeOpts(c.businessType||'',c.businessField)}</select></div>
    </div>
    <div class="fsec">حالة العقد والارتباط</div>
    <div class="frow">
      <div class="fgroup"><label class="flbl">الحالة</label><select class="fctl" id="f_st">${selOpts(CSTATUSES,c.status||'نشط')}</select></div>
      <div class="fgroup"><label class="flbl">آخر تواصل</label><input type="date" class="fctl" id="f_lc" value="${c.lastContact||''}"></div>
    </div>
    <div class="frow">
      <div class="fgroup"><label class="flbl">تاريخ بداية العقد</label><input type="date" class="fctl" id="f_sd" value="${c.startDate||''}"></div>
      <div class="fgroup"><label class="flbl">تاريخ نهاية العقد</label><input type="date" class="fctl" id="f_ed" value="${c.endDate||''}"></div>
    </div>
    <div class="fgroup"><label class="flbl">${t('ملاحظات عامة')}</label><textarea class="fctl" id="f_no">${esc(c.notes)}</textarea></div>
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
      <div class="mtitle">${isEdit?'تعديل البرنامج':'إضافة برنامج جديد'}</div>
      <button class="mclose" onclick="closeModal()">×</button>
    </div>
    <div class="fgroup">
      <label class="flbl">البرنامج / المنتج *</label>
      <input class="fctl" id="fp_nm" value="${esc(p.programName)}" placeholder="مثال: برنامج المبيعات، نظام المخزون...">
    </div>
    <div class="frow">
      <div class="fgroup">
        <label class="flbl">المنصة</label>
        <select class="fctl" id="fp_pl">${selOpts(PROGRAM_PLATFORMS,p.platform||'Desktop')}</select>
      </div>
      <div class="fgroup">
        <label class="flbl">النوع</label>
        <select class="fctl" id="fp_ty">${selOpts(PROGRAM_TYPES,p.type||'تجاري')}</select>
      </div>
    </div>
    <div class="fgroup">
      <label class="flbl">عدد الأجهزة المرخصة</label>
      <input type="number" class="fctl" id="fp_ic" min="1" value="${p.installationsCount||1}">
    </div>
    <div class="frow">
      <div class="fgroup">
        <label class="flbl">تاريخ البداية / التثبيت</label>
        <input type="date" class="fctl" id="fp_sd" value="${p.startDate||td()}">
      </div>
      <div class="fgroup">
        <label class="flbl">تاريخ الانتهاء</label>
        <input type="date" class="fctl" id="fp_ed" value="${p.endDate||''}">
        <div class="fhint">اتركه فارغاً إذا كان مدى الحياة</div>
      </div>
    </div>
    <div class="facts">
      <button class="btn btn-ghost" onclick="closeModal()">إلغاء</button>
      <button class="btn btn-primary" onclick="saveProgram(${isEdit?p.id:null})">${isEdit?'حفظ التغييرات':'إضافة البرنامج'}</button>
    </div>`;
}

function renderIssueModal(){
  const isEdit=S.modal==='editIssue';
  const cid=S.selId;const c=clients.find(x=>x.id===cid);if(!c)return'';
  let i={};if(isEdit){const eid=S.form.eid;i=c.issues.find(x=>x.id===eid)||{};}
  return`
    <div class="mhdr">
      <div class="mtitle">${isEdit?'تعديل المشكلة':'تسجيل مشكلة جديدة'}</div>
      <button class="mclose" onclick="closeModal()">×</button>
    </div>
    <div class="fgroup"><label class="flbl">عنوان المشكلة باختصار *</label><input class="fctl" id="fi_t" value="${esc(i.title)}" oninput="autoFillConf()"></div>
    <div class="frow">
      <div class="fgroup"><label class="flbl">التصنيف</label><select class="fctl" id="fi_ty" onchange="autoFillConf()">${selOpts(ITYPES,i.type||'خطأ تقني')}</select></div>
      <div class="fgroup"><label class="flbl">مصدر المشكلة</label><select class="fctl" id="fi_src" onchange="autoFillConf()">${selOpts(ISOURCES,i.source||'غير محدد')}</select></div>
    </div>
    <div class="frow">
      <div class="fgroup"><label class="flbl">الأولوية</label><select class="fctl" id="fi_p">${selOpts(PRIOS,i.priority||'متوسطة')}</select></div>
      <div class="fgroup"><label class="flbl">الحالة</label><select class="fctl" id="fi_s">${selOpts(ISTATUSES,i.status||'مفتوح')}</select></div>
    </div>
    <div class="frow">
      <div class="fgroup"><label class="flbl">مرات التكرار (للعميل)</label><input type="number" class="fctl" id="fi_rc" min="1" value="${i.repeatCount||1}" oninput="autoFillConf()"></div>
      <div class="fgroup"><label class="flbl">التاريخ</label><input type="date" class="fctl" id="fi_d" value="${i.date||td()}"></div>
    </div>
    <div class="fgroup" style="background:var(--bg);padding:10px;border-radius:var(--r-sm);border:1px solid var(--border)">
      <label class="flbl" style="display:flex;justify-content:space-between">
        <span>مؤشر دقة التشخيص التلقائي</span>
        <span id="fi_cov" style="color:var(--brand)">${i.confidence||50}%</span>
      </label>
      <div class="conf-row">
        <input type="range" class="conf-range" id="fi_co" min="0" max="100" value="${i.confidence||50}" oninput="document.getElementById('fi_cov').textContent=this.value+'%'">
      </div>
      <div class="fhint">يُحسب تلقائياً ويمكنك تعديله. ثقة أقل = يحتاج تحقيق أعمق.</div>
    </div>
    <div class="fgroup" style="margin-top:10px">
      <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer">
        <input type="checkbox" id="fi_fo" ${i.featureOpp?'checked':''}>
        <strong>💡 تصنيف كفرصة لميزة جديدة</strong> (تحويل المشكلة إلى طلب)
      </label>
    </div>
    <div class="fgroup"><label class="flbl">تفاصيل المشكلة / السياق</label><textarea class="fctl" id="fi_no">${esc(i.notes)}</textarea></div>
    <div class="fgroup"><label class="flbl">الحل المقدم (إن وُجد)</label><textarea class="fctl" id="fi_sol">${esc(i.solution)}</textarea></div>
    <div class="facts">
      <button class="btn btn-ghost" onclick="closeModal()">إلغاء</button>
      <button class="btn btn-primary" onclick="saveIssue(${isEdit?i.id:null})">${isEdit?'حفظ التغييرات':'تسجيل المشكلة'}</button>
    </div>`;
}

function renderReqModal(){
  const isEdit=S.modal==='editReq';
  const cid=S.selId;const c=clients.find(x=>x.id===cid);if(!c)return'';
  let r={};if(isEdit){const eid=S.form.eid;r=c.requirements.find(x=>x.id===eid)||{};}
  return`
    <div class="mhdr">
      <div class="mtitle">${isEdit?'تعديل الطلب':'طلب ميزة جديدة'}</div>
      <button class="mclose" onclick="closeModal()">×</button>
    </div>
    <div class="fgroup"><label class="flbl">عنوان الطلب *</label><input class="fctl" id="fr_t" value="${esc(r.title)}"></div>
    <div class="frow">
      <div class="fgroup"><label class="flbl">النوع</label><select class="fctl" id="fr_ty">${selOpts(RTYPES,r.type||'ميزة جديدة')}</select></div>
      <div class="fgroup"><label class="flbl">التأثير المتوقع</label><select class="fctl" id="fr_im">${selOpts(IMPACTS,r.impact||'متوسط')}</select></div>
    </div>
    <div class="frow">
      <div class="fgroup"><label class="flbl">الأولوية للعميل</label><select class="fctl" id="fr_p">${selOpts(PRIOS,r.priority||'متوسطة')}</select></div>
      <div class="fgroup"><label class="flbl">حالة الطلب</label><select class="fctl" id="fr_s">${selOpts(RSTATUSES,r.status||'مقترح')}</select></div>
    </div>
    <div class="fgroup"><label class="flbl">التاريخ</label><input type="date" class="fctl" id="fr_d" value="${r.date||td()}"></div>
    <div class="fgroup"><label class="flbl">وصف الحاجة (لماذا؟ وكيف؟)</label><textarea class="fctl" id="fr_no">${esc(r.notes)}</textarea></div>
    <div class="facts">
      <button class="btn btn-ghost" onclick="closeModal()">إلغاء</button>
      <button class="btn btn-primary" onclick="saveReq(${isEdit?r.id:null})">${isEdit?'حفظ التغييرات':'تسجيل الطلب'}</button>
    </div>`;
}

function renderAddContactModal(){
  return`
    <div class="mhdr">
      <div class="mtitle">تسجيل تواصل جديد</div>
      <button class="mclose" onclick="closeModal()">×</button>
    </div>
    <div class="fgroup"><label class="flbl">تاريخ التواصل *</label><input type="date" class="fctl" id="fch_d" value="${td()}"></div>
    <div class="fgroup"><label class="flbl">ملخص التواصل / ما تم مناقشته *</label><textarea class="fctl" id="fch_n" placeholder="مثال: مكالمة هاتفية لحل مشكلة الطباعة..."></textarea></div>
    <div class="facts">
      <button class="btn btn-ghost" onclick="closeModal()">إلغاء</button>
      <button class="btn btn-primary" onclick="saveContact()">حفظ السجل</button>
    </div>`;
}

function renderBackupManagerModal() {
  const list = S.backups || [];
  return `
    <div class="mhdr">
      <div class="mtitle" style="display:flex;align-items:center;gap:8px">💾 إدارة النسخ الاحتياطية للبيانات <span style="font-size:11px;font-weight:normal;background:var(--border);padding:2px 8px;border-radius:99px;color:var(--t2)">rolling 30 snapshots</span></div>
      <button class="mclose" onclick="closeModal()">×</button>
    </div>
    <div style="background:var(--bg);border:1px solid var(--border);border-radius:var(--r-sm);padding:12px;margin-bottom:1rem;font-size:12px;color:var(--t2);line-height:1.6">
      🔐 يتم حفظ النسخ الاحتياطية <strong>تلقائياً وبشكل دوري في جهازك (IndexedDB)</strong> بشكل معزول لكل مستخدم. يحتفظ النظام بحد أقصى <strong>30 نسخة متعاقبة</strong>، ويقوم بحذف النسخ القديمة تلقائياً لتوفير المساحة.
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;gap:10px;flex-wrap:wrap">
      <button class="btn btn-primary btn-sm" onclick="triggerManualBackup()">💾 إنشاء نسخة احتياطية جديدة</button>
      <button class="btn btn-outline btn-sm" onclick="loadBackupsList()">🔄 تحديث القائمة</button>
    </div>
    <div style="max-height:300px;overflow-y:auto;display:flex;flex-direction:column;gap:8px" class="custom-scrollbar">
      ${list.length === 0
        ? `<div style="text-align:center;padding:2rem;color:var(--t3);font-size:12px">📭 لا توجد نسخ احتياطية مسجلة بعد. سيتم إنشاؤها تلقائياً عند قيامك بالمزامنة أو إدخال بيانات جديدة.</div>`
        : list.map((b) => {
            const dateStr = new Date(b.timestamp).toLocaleString('ar-DZ', {
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
                  <strong style="font-size:12px;color:var(--t1)">${esc(b.reason || 'نسخة احتياطية بدون عنوان')}</strong>
                  <span style="font-size:11px;color:var(--t3);margin-right:auto" dir="ltr">${dateStr}</span>
                </div>
                <div style="font-size:11px;color:var(--t2);display:flex;gap:12px;align-items:center">
                  <span>👥 العملاء: <strong>${clientCount}</strong></span>
                  <span>🖥️ البرامج والأجهزة: <strong>${programCount}</strong></span>
                </div>
                <div style="display:flex;gap:6px;margin-top:4px">
                  <button class="btn btn-outline btn-xs" onclick="downloadBackup('${b.id}')">📥 تحميل الملف (.json)</button>
                  <button class="btn btn-success-soft btn-xs" onclick="triggerRestore('${b.id}')" style="font-weight:bold">🔄 استرجاع هذه النسخة</button>
                  <button class="btn btn-danger-soft btn-xs" onclick="triggerDeleteBackup('${b.id}')">✕ حذف</button>
                </div>
              </div>
            `;
          }).join('')}
    </div>
    <div class="facts" style="margin-top:1.5rem;padding-top:1rem;border-top:1px solid var(--border)">
      <button class="btn btn-ghost" onclick="closeModal()">إغلاق</button>
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
