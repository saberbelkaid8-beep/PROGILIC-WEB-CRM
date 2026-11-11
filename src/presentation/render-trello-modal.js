import { S, clients, setClients, currentUser, currentStaffUser } from '../state/store.js';
import { esc } from '../utils/index.js';
import { t } from '../utils/i18n.js';
import { inMemoryReviewQueue, inMemorySyncStore, syncTrelloChecklistItem, resolveReviewItem } from '../business/trello/trelloSyncService.js';
import { runHistoricalDryRun, executeApprovedBackfill } from '../business/trello/trelloBackfill.js';
import { classifyTrelloItem } from '../business/trello/trelloAiClassifier.js';
import { resolveTrelloCustomer } from '../business/ai/entityResolver.js';
import { determineOperationRoute } from '../business/trello/deterministicRouter.js';
import { showToast } from '../utils/toast.js';

let activeTrelloTab = 'overview';
let dryRunResults = null;
let isRunningDryRun = false;
let testResult = null;
let isTestingAi = false;

export function setTrelloTab(tab) {
  activeTrelloTab = tab;
  if (window.R) window.R();
}

export function renderTrelloIntegrationModal() {
  const direction = (S.lang || 'ar') === 'ar' ? 'rtl' : 'ltr';
  const reviewCount = inMemoryReviewQueue ? inMemoryReviewQueue.size : 0;
  const syncCount = inMemorySyncStore ? inMemorySyncStore.size : 0;

  return `
    <div class="mhdr" style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--b, rgba(255,255,255,0.1)); padding-bottom:12px; margin-bottom:16px;">
      <div style="display:flex; align-items:center; gap:10px;">
        <span style="font-size:24px;">📋</span>
        <div>
          <div class="mtitle" style="font-size:18px; font-weight:800; color:var(--t, #fff);">
            ${t('تكامل Trello الذكي')} <span style="font-size:13px; font-weight:600; color:#38bdf8; background:rgba(56,189,248,0.12); padding:2px 8px; border-radius:6px;">PROGILIC CRM × TRELLO</span>
          </div>
          <div style="font-size:12px; color:var(--t2, #94a3b8); margin-top:2px;">
            ${t('معالجة ذكية قائمة على الذكاء الاصطناعي وبوابة توجيه حتمية لقائمة PROGRAMME DE SERVICES')}
          </div>
        </div>
      </div>
      <button class="mclose" onclick="closeModal()" style="background:none; border:none; font-size:20px; cursor:pointer; color:var(--t2, #94a3b8);">✕</button>
    </div>

    <!-- Navigation Tabs -->
    <div style="display:flex; gap:8px; border-bottom:1px solid var(--b, rgba(255,255,255,0.08)); padding-bottom:8px; margin-bottom:16px;">
      <button class="btn btn-xs ${activeTrelloTab === 'overview' ? 'btn-primary' : 'btn-ghost'}" onclick="window.__setTrelloTab('overview')" style="padding:6px 14px; font-size:12px; font-weight:700;">
        📌 ${t('نظرة عامة والتحقق من النطاق')}
      </button>
      <button class="btn btn-xs ${activeTrelloTab === 'dryRun' ? 'btn-primary' : 'btn-ghost'}" onclick="window.__setTrelloTab('dryRun')" style="padding:6px 14px; font-size:12px; font-weight:700;">
        🧪 ${t('المعاينة الجافة للبيانات السابقة')}
      </button>
      <button class="btn btn-xs ${activeTrelloTab === 'reviewQueue' ? 'btn-primary' : 'btn-ghost'}" onclick="window.__setTrelloTab('reviewQueue')" style="padding:6px 14px; font-size:12px; font-weight:700; position:relative;">
        ⚠️ ${t('طابور المراجعة البشرية')}
        ${reviewCount > 0 ? `<span style="background:#ef4444; color:#fff; font-size:10px; font-weight:800; padding:1px 6px; border-radius:10px; margin-right:4px;">${reviewCount}</span>` : ''}
      </button>
    </div>

    <!-- Tab Content -->
    <div style="min-height:360px; max-height:65vh; overflow-y:auto; padding-right:4px;">
      ${activeTrelloTab === 'overview' ? renderOverviewTab(syncCount, reviewCount) : ''}
      ${activeTrelloTab === 'dryRun' ? renderDryRunTab() : ''}
      ${activeTrelloTab === 'reviewQueue' ? renderReviewQueueTab() : ''}
    </div>
  `;
}

function renderOverviewTab(syncCount, reviewCount) {
  return `
    <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(280px, 1fr)); gap:12px; margin-bottom:16px;">
      <!-- Monitored List Card -->
      <div style="background:var(--card, rgba(255,255,255,0.04)); border:1px solid rgba(56,189,248,0.25); border-radius:10px; padding:14px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
          <span style="font-size:12px; font-weight:700; color:#38bdf8;">🎯 ${t('القائمة المعتمدة الوحيدة')}</span>
          <span style="font-size:11px; font-weight:700; color:#10b981; background:rgba(16,185,129,0.12); padding:2px 8px; border-radius:6px;">✓ ${t('مفعل ومحصور')}</span>
        </div>
        <div style="font-size:15px; font-weight:800; color:var(--t, #fff); margin-bottom:4px;">PROGRAMME DE SERVICES</div>
        <div style="font-size:11.5px; color:var(--t2, #94a3b8); line-height:1.5;">
          ${t('يتم رفض وتجاهل أي بطاقات أو قوائم أخرى (مثل APP VDD أو الاختبارات) بشكل صارم ومزدوج عبر معرّف اللوحة ومعرّف القائمة.')}
        </div>
      </div>

      <!-- Identity & Timeline Attribution Card -->
      <div style="background:var(--card, rgba(255,255,255,0.04)); border:1px solid rgba(168,85,247,0.25); border-radius:10px; padding:14px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
          <span style="font-size:12px; font-weight:700; color:#c084fc;">👤 ${t('هوية المخطط الزمني')}</span>
          <span style="font-size:11px; font-weight:700; color:#a855f7; background:rgba(168,85,247,0.12); padding:2px 8px; border-radius:6px;">Trello Integration</span>
        </div>
        <div style="font-size:15px; font-weight:800; color:var(--t, #fff); margin-bottom:4px;">Trello (Integration)</div>
        <div style="font-size:11.5px; color:var(--t2, #94a3b8); line-height:1.5;">
          ${t('تسجيل جميع الأنشطة المزامنة في المخطط الزمني للعميل والعام تحت هوية Trello، مع الحفاظ الكامل على هوية الموظفين البشريين عند التعديل.')}
        </div>
      </div>

      <!-- Decoupled Completion Card -->
      <div style="background:var(--card, rgba(255,255,255,0.04)); border:1px solid rgba(245,158,11,0.25); border-radius:10px; padding:14px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
          <span style="font-size:12px; font-weight:700; color:#fbbf24;">⚖️ ${t('فك ارتباط الإنجاز')}</span>
          <span style="font-size:11px; font-weight:700; color:#f59e0b; background:rgba(245,158,11,0.12); padding:2px 8px; border-radius:6px;">Anti-False Resolution</span>
        </div>
        <div style="font-size:15px; font-weight:800; color:var(--t, #fff); margin-bottom:4px;">Checkbox ≠ Bug Resolved</div>
        <div style="font-size:11.5px; color:var(--t2, #94a3b8); line-height:1.5;">
          ${t('تحديد إنجاز عنصر التريلو لا يعني إغلاق التذكرة كمحلولة إلا في حال وجود دليل لفظي صريح ومؤكد بحل المشكلة التقنية.')}
        </div>
      </div>
    </div>

    <!-- Live AI Classification & Routing Test Sandbox -->
    <div style="background:var(--card, rgba(255,255,255,0.03)); border:1px solid var(--b, rgba(255,255,255,0.1)); border-radius:12px; padding:16px;">
      <div style="font-size:14px; font-weight:800; color:var(--t, #fff); margin-bottom:6px;">
        🧪 ${t('مختبر الفحص المباشر لعناصر Trello (Live AI & Routing Sandbox)')}
      </div>
      <div style="font-size:12px; color:var(--t2, #94a3b8); margin-bottom:12px;">
        ${t('أدخل نصاً تجريبياً لعنصر قائمة في Trello لاختبار الاستخراج السياقي وتحديد العميل وبوابة التوجيه الحتمية قبل وصول الأحداث الفعلية:')}
      </div>
      <div style="display:flex; gap:8px; margin-bottom:12px;">
        <input id="trelloTestInput" type="text" 
          placeholder="مثال: أحمد بن علي 0550112233 - تدريب على نقاط البيع عبر فيديو" 
          value="أحمد بن علي 0550112233 - تدريب على نقاط البيع عبر فيديو"
          style="flex:1; padding:8px 12px; border-radius:8px; border:1px solid var(--b, rgba(255,255,255,0.15)); background:var(--bg, #111827); color:var(--t, #fff); font-size:13px;" />
        <button class="btn btn-primary" onclick="window.__testTrelloClassification()" style="padding:8px 16px; font-size:12px; font-weight:700;">
          ${isTestingAi ? '⏳ ' + t('جاري التحليل...') : '⚡ ' + t('فحص وتوجيه')}
        </button>
      </div>

      ${testResult ? `
        <div style="background:rgba(0,0,0,0.25); border:1px solid rgba(56,189,248,0.2); border-radius:8px; padding:12px; font-size:12.5px;">
          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:10px; margin-bottom:8px;">
            <div><strong style="color:#94a3b8;">${t('طبيعة العملية')}:</strong> <span style="color:#38bdf8; font-weight:700;">${esc(testResult.extracted.actionNature)}</span></div>
            <div><strong style="color:#94a3b8;">${t('الوسيلة / القناة')}:</strong> <span style="color:#e2e8f0; font-weight:700;">${esc(testResult.extracted.medium)}</span></div>
            <div><strong style="color:#94a3b8;">${t('العميل المستخرج')}:</strong> <span style="color:#e2e8f0; font-weight:700;">${esc(testResult.extracted.customer?.fullName || 'غير محدد')}</span></div>
            <div><strong style="color:#94a3b8;">${t('مطابقة العميل')}:</strong> <span style="color:${testResult.customerResolution.matched ? '#10b981' : '#f59e0b'}; font-weight:700;">${esc(testResult.customerResolution.status)}</span></div>
          </div>
          <div style="border-top:1px solid rgba(255,255,255,0.08); padding-top:8px; display:flex; justify-content:space-between; align-items:center;">
            <div>
              <strong style="color:#94a3b8;">${t('الوجهة المعتمدة')}:</strong>
              <span style="background:rgba(56,189,248,0.15); color:#38bdf8; font-weight:800; padding:2px 8px; border-radius:6px; margin-right:6px;">
                ${esc(testResult.route.destination)}
              </span>
              <span style="color:#94a3b8; font-size:11.5px;">(${esc(testResult.route.auditTitle)})</span>
            </div>
            <div style="font-size:11px; color:#10b981; font-weight:700;">✓ ${t('فحص حتمي ناجح')}</div>
          </div>
        </div>
      ` : ''}
    </div>
  `;
}

function renderDryRunTab() {
  return `
    <div style="margin-bottom:16px;">
      <div style="display:flex; justify-content:space-between; align-items:center; background:var(--card, rgba(255,255,255,0.04)); border:1px solid var(--b, rgba(255,255,255,0.1)); border-radius:10px; padding:14px; margin-bottom:16px;">
        <div>
          <div style="font-size:14px; font-weight:800; color:var(--t, #fff);">
            🧪 ${t('المعاينة الجافة التاريخية (Non-Destructive Dry Run)')}
          </div>
          <div style="font-size:12px; color:var(--t2, #94a3b8); margin-top:2px;">
            ${t('محاكاة فحص واستخراج وتوجيه كافة البطاقات التاريخية في قائمة PROGRAMME DE SERVICES دون كتابة أي سجل للإنتاج')}
          </div>
        </div>
        <button class="btn btn-primary" onclick="window.__runDryRun()" style="padding:8px 18px; font-size:12px; font-weight:700;" ${isRunningDryRun ? 'disabled' : ''}>
          ${isRunningDryRun ? '⏳ ' + t('جاري تشغيل المعاينة...') : '▶️ ' + t('تشغيل المعاينة الآن')}
        </button>
      </div>

      ${dryRunResults ? `
        <!-- Dry Run Summary -->
        <div style="display:grid; grid-template-columns:repeat(4, 1fr); gap:10px; margin-bottom:14px;">
          <div style="background:rgba(56,189,248,0.08); border:1px solid rgba(56,189,248,0.2); border-radius:8px; padding:10px; text-align:center;">
            <div style="font-size:11px; color:#94a3b8;">${t('إجمالي العناصر')}</div>
            <div style="font-size:18px; font-weight:800; color:#38bdf8;">${dryRunResults.totalItemsScanned ?? dryRunResults.totalItems ?? 0}</div>
          </div>
          <div style="background:rgba(16,185,129,0.08); border:1px solid rgba(168,85,247,0.2); border-radius:8px; padding:10px; text-align:center;">
            <div style="font-size:11px; color:#94a3b8;">${t('جاهزة للإدراج')}</div>
            <div style="font-size:18px; font-weight:800; color:#10b981;">${dryRunResults.toCreateCount ?? dryRunResults.summary?.PREPARED ?? 0}</div>
          </div>
          <div style="background:rgba(245,158,11,0.08); border:1px solid rgba(245,158,11,0.2); border-radius:8px; padding:10px; text-align:center;">
            <div style="font-size:11px; color:#94a3b8;">${t('تتطلب مراجعة')}</div>
            <div style="font-size:18px; font-weight:800; color:#f59e0b;">${dryRunResults.toReviewCount ?? dryRunResults.summary?.REVIEW_NEEDED ?? 0}</div>
          </div>
          <div style="background:rgba(148,163,184,0.08); border:1px solid rgba(148,163,184,0.2); border-radius:8px; padding:10px; text-align:center;">
            <div style="font-size:11px; color:#94a3b8;">${t('عناصر مكررة/تم تخطيها')}</div>
            <div style="font-size:18px; font-weight:800; color:#94a3b8;">${dryRunResults.alreadySyncedCount ?? dryRunResults.summary?.SKIPPED_DUPLICATE ?? 0}</div>
          </div>
        </div>

        <!-- Preview Table -->
        <div style="overflow-x:auto; border:1px solid var(--b, rgba(255,255,255,0.1)); border-radius:8px; max-height:280px; overflow-y:auto; margin-bottom:14px;">
          <table style="width:100%; border-collapse:collapse; font-size:12px; text-align:right;">
            <thead>
              <tr style="background:rgba(255,255,255,0.04); border-bottom:1px solid var(--b, rgba(255,255,255,0.1)); color:var(--t2, #94a3b8);">
                <th style="padding:8px 12px;">${t('نص عنصر التريلو')}</th>
                <th style="padding:8px 12px;">${t('العميل المستهدف')}</th>
                <th style="padding:8px 12px;">${t('الوجهة')}</th>
                <th style="padding:8px 12px;">${t('الإجراء المقترح')}</th>
              </tr>
            </thead>
            <tbody>
              ${(dryRunResults.itemsPreview || dryRunResults.items || []).map(item => `
                <tr style="border-bottom:1px solid rgba(255,255,255,0.04);">
                  <td style="padding:8px 12px; font-weight:600; color:var(--t, #fff);">${esc(item.rawText || item.name || '')}</td>
                  <td style="padding:8px 12px;">${esc(item.targetCustomer || item.customer || '—')}</td>
                  <td style="padding:8px 12px;"><span style="background:rgba(56,189,248,0.12); color:#38bdf8; padding:2px 6px; border-radius:4px; font-weight:700;">${esc(item.targetCollection || 'review_queue')}</span></td>
                  <td style="padding:8px 12px; font-weight:700; color:${item.action === 'WILL_CREATE_RECORD' ? '#10b981' : item.action === 'FLAG_FOR_REVIEW' ? '#f59e0b' : '#94a3b8'};">
                    ${esc(item.action || item.status || '—')}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <!-- Explicit Confirmation Gate & Production Lock -->
        <div style="background:rgba(239,68,68,0.06); border:1px solid rgba(239,68,68,0.25); border-radius:10px; padding:12px; display:flex; justify-content:space-between; align-items:center;">
          <div style="font-size:12px; font-weight:700; color:#ef4444; display:flex; align-items:center; gap:8px;">
            <span>🔒</span>
            <span>${t('المزامنة التراكمية الإنتاجية معطلة في هذا الوضع لحماية بيانات CRM (Production Gate Locked). المسموح به فقط هو السحب القراءة فقط والمعاينة الجافة.')}</span>
          </div>
          <button id="trelloBackfillExecuteBtn" class="btn btn-primary" disabled style="padding:6px 16px; font-size:12px; font-weight:800; background:#475569; border-color:#64748b; cursor:not-allowed; opacity:0.7;">
            🔒 ${t('المزامنة الإنتاجية قيد القفل')}
          </button>
        </div>
      ` : `
        <div style="text-align:center; padding:3rem 1rem; color:var(--t2, #94a3b8); font-size:13px; background:rgba(255,255,255,0.02); border-radius:8px; border:1px dashed var(--b, rgba(255,255,255,0.1));">
          🧪 ${t('اضغط على "تشغيل المعاينة الآن" لفحص عناصر القائمة واستخراج التوجيه المقترح دون أي تأثير على بيانات الإنتاج.')}
          <div style="margin-top:8px; font-size:11.5px; color:#38bdf8;">
            (تتيح المعاينة الفحص باستخدام بيانات التريلو القراءة فقط أو العينات المعزولة)
          </div>
        </div>
      `}
    </div>
  `;
}

function renderReviewQueueTab() {
  const items = inMemoryReviewQueue ? Array.from(inMemoryReviewQueue.values()) : [];

  if (items.length === 0) {
    return `
      <div style="text-align:center; padding:3.5rem 1rem; color:var(--t2, #94a3b8); font-size:13px; background:rgba(255,255,255,0.02); border-radius:8px; border:1px dashed var(--b, rgba(255,255,255,0.1));">
        <div style="font-size:32px; margin-bottom:8px;">✅</div>
        <div style="font-size:15px; font-weight:800; color:#10b981; margin-bottom:4px;">${t('طابور المراجعة البشرية خالٍ تماماً')}</div>
        <div>${t('تم توجيه جميع عناصر Trello المزامنة تلقائياً وفق القواعد الحتمية وبثقة مكتملة.')}</div>
      </div>
    `;
  }

  return `
    <div style="display:flex; flex-direction:column; gap:12px;">
      <div style="font-size:12px; color:var(--t2, #94a3b8); margin-bottom:4px;">
        ${t('يحتوي هذا الطابور على العناصر الغامضة أو ذات الثقة المنخفضة أو التي تفتقر لتفاصيل عميل كافية، لحمايتك من التوجيه الخاطئ:')}
      </div>

      ${items.map(item => `
        <div style="background:var(--card, rgba(255,255,255,0.04)); border:1px solid rgba(245,158,11,0.25); border-radius:10px; padding:14px;">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px;">
            <div style="font-size:13.5px; font-weight:800; color:var(--t, #fff);">${esc(item.rawText)}</div>
            <span style="background:rgba(245,158,11,0.15); color:#f59e0b; font-size:11px; font-weight:700; padding:2px 8px; border-radius:6px;">
              ${esc(item.reviewReason || 'REVIEW_REQUIRED')}
            </span>
          </div>

          <div style="font-size:12px; color:#94a3b8; margin-bottom:10px; line-height:1.5;">
            <strong>${t('تفاصيل السبب')}:</strong> ${esc(item.reviewDetails || 'يتطلب تأكيد المشغل البشري')}
          </div>

          <!-- Resolution Action Form -->
          <div style="display:flex; gap:8px; align-items:center; border-top:1px solid rgba(255,255,255,0.08); padding-top:10px;">
            <select id="reviewClientSel_${item.id}" style="padding:6px 10px; border-radius:6px; border:1px solid var(--b, rgba(255,255,255,0.15)); background:var(--bg, #111827); color:var(--t, #fff); font-size:12px;">
              <option value="">-- ${t('اختر العميل يدودياً')} --</option>
              ${clients.map(c => `<option value="${c.id}">${esc(c.fullName)} (${esc(c.company || c.phone || '')})</option>`).join('')}
            </select>

            <select id="reviewDestSel_${item.id}" style="padding:6px 10px; border-radius:6px; border:1px solid var(--b, rgba(255,255,255,0.15)); background:var(--bg, #111827); color:var(--t, #fff); font-size:12px;">
              <option value="contacts">📞 ${t('سجل التواصل والخدمات')}</option>
              <option value="issues">⚠️ ${t('تذكرة مشكلة تقنية')}</option>
              <option value="requirements">💡 ${t('طلب ميزة وتحسين')}</option>
              <option value="programs">💻 ${t('تثبيت / رخصة برنامج')}</option>
            </select>

            <button class="btn btn-primary" onclick="window.__resolveReviewItem('${item.id}', true)" style="padding:6px 14px; font-size:11.5px; font-weight:700;">
              ✓ ${t('اعتماد وإدراج في CRM')}
            </button>
            <button class="btn btn-ghost" onclick="window.__resolveReviewItem('${item.id}', false)" style="padding:6px 12px; font-size:11.5px; color:#ef4444;">
              ✕ ${t('تجاهل')}
            </button>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

// Global window actions for modal interaction
if (typeof window !== 'undefined') {
  window.__setTrelloTab = (tab) => {
    activeTrelloTab = tab;
    if (window.R) window.R();
  };

  window.__testTrelloClassification = async () => {
    const inputEl = document.getElementById('trelloTestInput');
    const text = inputEl ? inputEl.value.trim() : '';
    if (!text) {
      showToast('الرجاء إدخال نص عنصر تريلو للاختبار', 'error');
      return;
    }

    isTestingAi = true;
    if (window.R) window.R();

    try {
      const extracted = await classifyTrelloItem({ name: text, state: 'complete' });
      const customerRes = resolveTrelloCustomer(extracted.customer, clients);
      const route = determineOperationRoute(extracted, customerRes, { name: text, state: 'complete' });

      testResult = { extracted, customerRes, customerResolution: customerRes, route };
      showToast('تم الفحص والتصنيف بنجاح', 'success');
    } catch (e) {
      showToast('خطأ أثناء الفحص: ' + e.message, 'error');
    } finally {
      isTestingAi = false;
      if (window.R) window.R();
    }
  };

  window.__runDryRun = async () => {
    isRunningDryRun = true;
    if (window.R) window.R();

    try {
      const mockHistoricalItems = [
        { id: 'hist_1', name: 'أحمد بن علي 0550112233 - تدريب على نقاط البيع عبر فيديو', state: 'complete', cardId: 'c1' },
        { id: 'hist_2', name: 'محمد قاسم 0770998877 - مشكلة في طباعة الفواتير على سطح المكتب', state: 'incomplete', cardId: 'c2' },
        { id: 'hist_3', name: 'صيدلية الأمل 0555667788 - طلب ميزة إضافة قراءة الباركود السريع', state: 'complete', cardId: 'c3' },
        { id: 'hist_4', name: 'متابعة دورية عامة', state: 'incomplete', cardId: 'c4' }
      ];

      dryRunResults = await runHistoricalDryRun('current_tenant', mockHistoricalItems, clients);
      showToast('اكتملت المعاينة الجافة بدون أي أخطاء وبدون كتابة للإنتاج', 'success');
    } catch (e) {
      showToast('فشل تشغيل المعاينة الجافة: ' + e.message, 'error');
    } finally {
      isRunningDryRun = false;
      if (window.R) window.R();
    }
  };

  window.__executeBackfill = async () => {
    if (!dryRunResults) return;
    try {
      const tenantId = currentUser?.uid || S.activeTenantId || 'current_tenant';
      const itemsToSync = dryRunResults.items || dryRunResults.itemsPreview || [];
      const execRes = await executeApprovedBackfill(tenantId, dryRunResults.runId || 'approved_run', itemsToSync, currentUser?.email || 'admin');
      showToast(`تمت المزامنة بنجاح: تم إدراج ${execRes.successCount || 0} عملية`, 'success');
      setClients([...clients]);
      dryRunResults = null;
      if (window.R) window.R();
    } catch (e) {
      showToast('فشل المزامنة: ' + e.message, 'error');
    }
  };

  window.__resolveReviewItem = async (itemId, isApproved) => {
    const tenantId = currentUser?.uid || S.activeTenantId || 'current_tenant';
    const operatorName = currentStaffUser?.name || currentUser?.email || 'مشرف النظام';

    if (!isApproved) {
      await resolveReviewItem(tenantId, itemId, { approved: false, resolvedBy: operatorName });
      showToast('تم تجاهل العنصر من طابور المراجعة', 'info');
      if (window.R) window.R();
      return;
    }

    const clientSel = document.getElementById(`reviewClientSel_${itemId}`);
    const destSel = document.getElementById(`reviewDestSel_${itemId}`);
    const selectedClientId = clientSel ? clientSel.value : '';
    const destination = destSel ? destSel.value : 'contacts';

    if (!selectedClientId) {
      showToast('الرجاء اختيار العميل لإلحاق العملية به', 'error');
      return;
    }

    try {
      await resolveReviewItem(tenantId, itemId, {
        approved: true,
        selectedClientId,
        destination,
        resolvedBy: operatorName
      });
      showToast('تم اعتماد العملية وتأكيد حفظها سحابياً بنجاح', 'success');
      if (window.R) window.R();
    } catch (e) {
      showToast('فشل اعتماد العملية: ' + e.message, 'error');
    }
  };
}
