/**
 * Floating AI Assistant UI Component & Interaction Controller
 */

import { S } from '../../state/store.js';
import { R } from '../../presentation/render-core.js';
import { processAiRequest } from '../../business/ai/aiGateway.js';
import { dispatchAiAction } from '../../business/ai/actionDispatcher.js';
import { SpeechEngine } from '../../business/ai/speechEngine.js';
import { t } from '../../utils/i18n.js';

let speechEngineInstance = null;
let conversationHistory = [];
let isProcessing = false;
let audioLevel = 0;

export function initAiAssistantWidget() {
  if (!speechEngineInstance) {
    speechEngineInstance = new SpeechEngine({
      onResult: ({ final, interim }) => {
        const inputEl = document.getElementById('ai-assistant-input');
        if (inputEl) {
          inputEl.value = final || interim;
        }
        if (final && final.length > 2) {
          submitAiPrompt(final);
        }
      },
      onAudioLevel: (level) => {
        audioLevel = level;
        const barEl = document.getElementById('ai-audio-bar');
        if (barEl) {
          barEl.style.width = `${Math.round(level * 100)}%`;
        }
      },
      onStatusChange: ({ listening }) => {
        S.aiListening = listening;
        const micBtn = document.getElementById('ai-mic-btn');
        if (micBtn) {
          micBtn.classList.toggle('active-listening', listening);
        }
      }
    });
  }

  // Bind global keyboard shortcut: Alt + A
  window.addEventListener('keydown', (e) => {
    if (e.altKey && (e.key === 'a' || e.key === 'A' || e.key === 'ش')) {
      e.preventDefault();
      toggleAiAssistantWidget();
    }
  });
}

export function toggleAiAssistantWidget() {
  S.aiWidgetOpen = !S.aiWidgetOpen;
  R();
  if (S.aiWidgetOpen) {
    setTimeout(() => {
      const inputEl = document.getElementById('ai-assistant-input');
      if (inputEl) inputEl.focus();
    }, 100);
  }
}

export async function submitAiPrompt(userText) {
  const text = (userText || (document.getElementById('ai-assistant-input')?.value || '')).trim();
  if (!text || isProcessing) return;

  isProcessing = true;
  S.aiProcessing = true;
  S.aiCurrentResult = null;
  R();

  // Stop speech if running
  if (speechEngineInstance) speechEngineInstance.stop();

  // Context gathering
  const activeContext = {
    currentPage: S.view || 'dashboard',
    selectedClientId: S.selId || null,
    language: S.lang || 'ar',
    currentFilters: {
      wilaya: S.dbFilterWilaya,
      program: S.dbFilterProg,
      search: S.dbSearchQuery
    }
  };

  conversationHistory.push({ role: 'user', content: text });

  try {
    const aiResult = await processAiRequest(text, activeContext, conversationHistory);
    S.aiCurrentResult = aiResult;
    
    if (aiResult && aiResult.summary) {
      conversationHistory.push({ role: 'assistant', content: aiResult.summary });
    }

    // Auto-dispatch if confidence >= 0.85
    if (aiResult && aiResult.confidence >= 0.85) {
      const actionRes = await dispatchAiAction(aiResult, text);
      S.aiLastExecution = actionRes;
    }
  } catch (err) {
    console.error('AI Assistant submit error:', err);
    S.aiCurrentResult = {
      intent: 'ERROR',
      confidence: 0,
      summary: S.lang === 'fr' ? 'Une erreur est survenue pendant le traitement de la demande.' : S.lang === 'en' ? 'An unexpected error occurred while processing the request.' : 'حدث خطأ غير متوقع أثناء معالجة الطلب.',
      plan: [S.lang === 'fr' ? 'Réessayez ou vérifiez votre connexion.' : S.lang === 'en' ? 'Please try again or check your connection.' : 'يرجى إعادة المحاولة أو التحقق من الاتصال.']
    };
  } finally {
    isProcessing = false;
    S.aiProcessing = false;
    R();
  }
}

const AI_SVG = {
  spark: '<path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/><path d="M20 3v4"/><path d="M22 5h-4"/><path d="M4 17v2"/><path d="M5 18H3"/>',
  plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  dash: '<rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/>',
  mic: '<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/>',
  send: '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>'
};

const aIc = (name, size = 15, sw = 2) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex-shrink:0">${AI_SVG[name] || ''}</svg>`;

export function renderAiAssistantWidget() {
  const isOpen = !!S.aiWidgetOpen;
  const isListening = !!S.aiListening;
  const isThinking = !!S.aiProcessing;
  const result = S.aiCurrentResult;
  const execution = S.aiLastExecution;

  return `
    <style>
      .ai-fab-btn {
        position: fixed;
        bottom: 24px;
        left: 24px;
        z-index: 9990;
        width: 54px;
        height: 54px;
        border-radius: 50%;
        background: linear-gradient(135deg, rgba(10, 132, 255, 0.94), rgba(94, 92, 230, 0.94));
        box-shadow: 0 10px 28px rgba(10, 132, 255, 0.40), inset 0 1px 0 rgba(255, 255, 255, 0.35);
        border: 1px solid rgba(255, 255, 255, 0.28);
        backdrop-filter: blur(18px);
        -webkit-backdrop-filter: blur(18px);
        color: #fff;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.2s ease;
      }
      .ai-fab-btn:hover {
        transform: translateY(-2px) scale(1.04);
        box-shadow: 0 14px 34px rgba(10, 132, 255, 0.52), inset 0 1px 0 rgba(255, 255, 255, 0.45);
      }
      .ai-panel {
        position: fixed;
        bottom: 90px;
        left: 24px;
        z-index: 9991;
        width: 390px;
        max-width: calc(100vw - 48px);
        background: rgba(255, 255, 255, 0.92);
        border: 1px solid rgba(0, 0, 0, 0.08);
        border-radius: 22px;
        box-shadow: 0 24px 60px rgba(0, 0, 0, 0.16), inset 0 1px 0 rgba(255, 255, 255, 0.9);
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 12px;
        backdrop-filter: blur(32px) saturate(180%);
        -webkit-backdrop-filter: blur(32px) saturate(180%);
        text-align: right;
        direction: rtl;
        font-family: inherit;
        animation: aiPanelSlideUp 0.22s cubic-bezier(0.16, 1, 0.3, 1);
      }
      body.dark .ai-panel {
        background: rgba(16, 20, 28, 0.90);
        border: 1px solid rgba(255, 255, 255, 0.16);
        box-shadow: 0 28px 68px rgba(0, 0, 0, 0.68), inset 0 1px 0 rgba(255, 255, 255, 0.22);
      }
      @keyframes aiPanelSlideUp {
        from { opacity: 0; transform: translateY(16px) scale(0.96); }
        to { opacity: 1; transform: translateY(0) scale(1); }
      }
      .active-listening {
        background: var(--sys-red, #FF453A) !important;
        border-color: rgba(255, 69, 58, 0.65) !important;
        color: #fff !important;
      }
      .ai-chip {
        font-family: inherit;
        font-size: 11.5px;
        font-weight: 600;
        padding: 5px 10px;
        border-radius: 10px;
        background: rgba(0, 0, 0, 0.04);
        color: var(--t2);
        border: 1px solid var(--border);
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 5px;
        transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
      }
      body.dark .ai-chip {
        background: rgba(255, 255, 255, 0.05);
      }
      .ai-chip:hover {
        background: rgba(10, 132, 255, 0.14);
        color: var(--bt);
        border-color: rgba(10, 132, 255, 0.35);
      }
    </style>

    <!-- FLOATING LAUNCHER FAB BUTTON -->
    <button type="button" class="ai-fab-btn" onclick="toggleAiAssistantWidget()" title="المساعد الذكي (Alt + A)" aria-label="${t('مساعد CRM الذكي')}">
      ${aIc('spark', 22, 2)}
    </button>

    <!-- AI ASSISTANT PANEL WINDOW -->
    ${isOpen ? `
      <div class="ai-panel" style="direction: ${S.lang === 'ar' ? 'rtl' : 'ltr'}; text-align: ${S.lang === 'ar' ? 'right' : 'left'};">
        <!-- HEADER -->
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border); padding-bottom:10px">
          <div style="display:flex; align-items:center; gap:9px">
            <span style="width:30px;height:30px;border-radius:9px;background:rgba(10,132,255,0.16);border:1px solid rgba(10,132,255,0.3);color:var(--bt);display:inline-flex;align-items:center;justify-content:center">${aIc('spark', 15)}</span>
            <div>
              <div style="font-weight:800; font-size:13.5px; color:var(--t1)">${t('مساعد CRM الذكي')}</div>
              <div style="font-size:11px; color:var(--t3)">${t('أمر صوتي أو نصي لتشغيل المنظومة')}</div>
            </div>
          </div>
          <button type="button" class="mclose" onclick="toggleAiAssistantWidget()" aria-label="${t('إغلاق')}">×</button>
        </div>

        <!-- QUICK SUGGESTIONS -->
        <div style="display:flex; gap:6px; flex-wrap:wrap">
          <button type="button" class="ai-chip" onclick="submitAiPrompt('${S.lang === 'fr' ? 'Ajouter un nouveau client nommé Ahmed à Oran' : (S.lang === 'en' ? 'Add a new client named Ahmed in Oran' : 'إضافة عميل جديد باسم أحمد من وهران')}')">${aIc('plus', 12)} ${t('إضافة عميل')}</button>
          <button type="button" class="ai-chip" onclick="submitAiPrompt('${S.lang === 'fr' ? 'Rechercher une pharmacie' : (S.lang === 'en' ? 'Search for a pharmacy' : 'البحث عن صيدلية')}')">${aIc('search', 12)} ${S.lang === 'fr' ? 'Pharmacie' : (S.lang === 'en' ? 'Pharmacy' : 'صيدلية')}</button>
          <button type="button" class="ai-chip" onclick="submitAiPrompt('${S.lang === 'fr' ? 'Ouvrir tableau de bord' : (S.lang === 'en' ? 'Open dashboard' : 'لوحة القيادة')}')">${aIc('dash', 12)} ${t('لوحة القيادة')}</button>
        </div>

        <!-- INPUT BOX & MIC -->
        <div style="position:relative; display:flex; align-items:center; gap:6px">
          <input type="text" id="ai-assistant-input" class="fctl" 
            style="margin:0; flex:1; font-size:12.5px; border-radius:11px" 
            placeholder="${S.lang === 'fr' ? 'Tapez une commande ou parlez (ex: ajouter client...)' : (S.lang === 'en' ? 'Type a command or speak (e.g. add client...)' : 'اكتب أمراً أو تحدث صوتياً (مثال: اضف عميل...)')}"
            onkeydown="if(event.key==='Enter') submitAiPrompt()" />

          <button type="button" id="ai-mic-btn" class="btn ${isListening ? 'active-listening' : 'btn-outline'}" 
            style="padding:7px 10px; border-radius:10px"
            onclick="toggleSpeechRecognition()" title="${t('المساعد الصوتي')}">
            ${aIc('mic', 15)}
          </button>

          <button type="button" class="btn btn-primary" style="padding:7px 12px; border-radius:10px; font-size:12.5px; font-weight:700" 
            onclick="submitAiPrompt()">
            ${S.lang === 'fr' ? 'Envoyer' : (S.lang === 'en' ? 'Send' : 'إرسال')}
          </button>
        </div>

        <!-- AUDIO WAVEFORM LEVEL -->
        <div style="height:3px; background:var(--border); border-radius:2px; overflow:hidden">
          <div id="ai-audio-bar" style="height:100%; width:0%; background:linear-gradient(90deg, var(--sys-blue, #0A84FF), var(--sys-green, #30D158)); transition:width 0.1s ease"></div>
        </div>

        <!-- THINKING LOADER -->
        ${isThinking ? `
          <div style="display:flex; align-items:center; justify-content:center; gap:8px; padding:12px; color:var(--bt); font-size:12.5px; font-weight:700">
            <span class="spinner" style="width:16px; height:16px; border:2px solid var(--bt); border-top-color:transparent; border-radius:50%; animation:spin 0.8s linear infinite"></span>
            <span>${S.lang === 'fr' ? 'Analyse de l\'intention en cours...' : (S.lang === 'en' ? 'Analyzing intent and data...' : 'جاري تحليل القصد واستخراج البيانات...')}</span>
          </div>
        ` : ''}

        <!-- RESULT PREVIEW & PLAN -->
        ${result ? `
          <div style="background:rgba(255,255,255,0.04); border:1px solid var(--border); border-radius:12px; padding:10px 12px; font-size:12px">
            <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; margin-bottom:6px">
              <strong data-user-content="true" style="color:var(--t1)">${result.summary || (S.lang === 'fr' ? 'Compris' : (S.lang === 'en' ? 'Understood' : 'تم الفهم'))}</strong>
              <span class="num" style="font-size:11px; font-weight:700; white-space:nowrap; color:${result.confidence >= 0.85 ? 'var(--gt)' : 'var(--wt)'}">
                ${Math.round((result.confidence || 0) * 100)}% ${S.lang === 'fr' ? 'confiance' : (S.lang === 'en' ? 'confidence' : 'ثقة')}
              </span>
            </div>

            ${(result.plan && result.plan.length > 0) ? `
              <ul style="margin:4px 0 0; padding-inline-start:16px; color:var(--t2); font-size:11.5px; line-height:1.55">
                ${result.plan.map(step => `<li data-user-content="true">${step}</li>`).join('')}
              </ul>
            ` : ''}

            ${execution ? `
              <div data-user-content="true" style="margin-top:8px; padding-top:6px; border-top:1px dashed var(--border); font-size:11.5px; color:${execution.success ? 'var(--gt)' : 'var(--rt)'}; font-weight:700">
                ${execution.message}
              </div>
            ` : ''}
          </div>
        ` : ''}
      </div>
    ` : ''}
  `;
}

window.toggleSpeechRecognition = function() {
  if (!speechEngineInstance) initAiAssistantWidget();
  if (speechEngineInstance.isListening) {
    speechEngineInstance.stop();
  } else {
    const speechLang = S.lang === 'fr' ? 'fr-FR' : (S.lang === 'en' ? 'en-US' : 'ar-DZ');
    speechEngineInstance.setLanguage(speechLang);
    speechEngineInstance.start();
  }
};

window.toggleAiAssistantWidget = toggleAiAssistantWidget;
window.submitAiPrompt = submitAiPrompt;
