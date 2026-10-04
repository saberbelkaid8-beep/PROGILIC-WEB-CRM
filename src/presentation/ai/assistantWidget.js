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
      summary: 'حدث خطأ غير متوقع أثناء معالجة الطلب.',
      plan: ['يرجى إعادة المحاولة أو التحقق من الاتصال.']
    };
  } finally {
    isProcessing = false;
    S.aiProcessing = false;
    R();
  }
}

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
        width: 58px;
        height: 58px;
        border-radius: 50%;
        background: linear-gradient(135deg, #6366F1 0%, #8B5CF6 50%, #EC4899 100%);
        box-shadow: 0 8px 24px rgba(139, 92, 246, 0.45);
        border: 2px solid rgba(255, 255, 255, 0.3);
        color: #fff;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 24px;
        cursor: pointer;
        transition: transform 0.25s ease, box-shadow 0.25s ease;
      }
      .ai-fab-btn:hover {
        transform: scale(1.08);
        box-shadow: 0 12px 28px rgba(139, 92, 246, 0.6);
      }
      .ai-panel {
        position: fixed;
        bottom: 90px;
        left: 24px;
        z-index: 9991;
        width: 380px;
        max-width: calc(100vw - 48px);
        background: var(--surface, #ffffff);
        border: 1px solid var(--border, #e5e7eb);
        border-radius: 20px;
        box-shadow: 0 20px 50px rgba(0, 0, 0, 0.2);
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 12px;
        backdrop-filter: blur(16px);
        text-align: right;
        direction: rtl;
        font-family: inherit;
        animation: aiPanelSlideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1);
      }
      @keyframes aiPanelSlideUp {
        from { opacity: 0; transform: translateY(20px) scale(0.95); }
        to { opacity: 1; transform: translateY(0) scale(1); }
      }
      .active-listening {
        animation: pulseMic 1.2s infinite;
        background: #EF4444 !important;
        color: white !important;
      }
      @keyframes pulseMic {
        0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.6); }
        70% { box-shadow: 0 0 0 12px rgba(239, 68, 68, 0); }
        100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
      }
      .ai-chip {
        font-size: 11px;
        padding: 4px 10px;
        border-radius: 12px;
        background: var(--border-soft, #f3f4f6);
        color: var(--t2, #374151);
        border: 1px solid var(--border, #e5e7eb);
        cursor: pointer;
        transition: all 0.2s;
      }
      .ai-chip:hover {
        background: rgba(139, 92, 246, 0.1);
        color: #8B5CF6;
        border-color: #8B5CF6;
      }
    </style>

    <!-- FLOATING LAUNCHER FAB BUTTON -->
    <button class="ai-fab-btn" onclick="toggleAiAssistantWidget()" title="المساعد الذكي (Alt + A)">
      ✨
    </button>

    <!-- AI ASSISTANT PANEL WINDOW -->
    ${isOpen ? `
      <div class="ai-panel" style="direction: ${S.lang === 'ar' ? 'rtl' : 'ltr'}; text-align: ${S.lang === 'ar' ? 'right' : 'left'};">
        <!-- HEADER -->
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border); padding-bottom:10px">
          <div style="display:flex; align-items:center; gap:8px">
            <span style="font-size:20px">✨</span>
            <div>
              <div style="font-weight:800; font-size:14px; color:var(--t1)">${t('مساعد CRM الذكي')}</div>
              <div style="font-size:10.5px; color:var(--t3)">${t('أمر صوتي أو نصي لتشغيل المنظومة')}</div>
            </div>
          </div>
          <button class="btn btn-sm" style="padding:4px 8px; border-radius:8px; font-size:12px" onclick="toggleAiAssistantWidget()">×</button>
        </div>

        <!-- QUICK SUGGESTIONS -->
        <div style="display:flex; gap:6px; flex-wrap:wrap">
          <span class="ai-chip" onclick="submitAiPrompt('${S.lang === 'fr' ? 'Ajouter nouveau client nommé Ahmed à Oran' : (S.lang === 'en' ? 'Add new client named Ahmed in Oran' : 'إضافة عميل جديد باسم أحمد من وهران')}')">➕ ${t('إضافة عميل')}</span>
          <span class="ai-chip" onclick="submitAiPrompt('${S.lang === 'fr' ? 'Rechercher pharmacie' : (S.lang === 'en' ? 'Search pharmacy' : 'البحث عن صيدلية')}')">🔍 ${S.lang === 'fr' ? 'Pharmacie' : (S.lang === 'en' ? 'Pharmacy' : 'صيدلية')}</span>
          <span class="ai-chip" onclick="submitAiPrompt('${S.lang === 'fr' ? 'Ouvrir tableau de bord' : (S.lang === 'en' ? 'Open dashboard' : 'لوحة القيادة')}')">📊 ${t('لوحة القيادة')}</span>
        </div>

        <!-- INPUT BOX & MIC -->
        <div style="position:relative; display:flex; align-items:center; gap:6px">
          <input type="text" id="ai-assistant-input" class="premium-search" 
            style="margin:0; width:100%; padding-left:12px; padding-right:12px; font-size:12.5px; border-radius:12px" 
            placeholder="${S.lang === 'fr' ? 'Tapez une commande ou parlez (ex: ajouter client...)' : (S.lang === 'en' ? 'Type a command or speak (e.g. add client...)' : 'اكتب أمراً أو تحدث صوتياً (مثال: اضف عميل...)')}"
            onkeydown="if(event.key==='Enter') submitAiPrompt()" />

          <button id="ai-mic-btn" class="btn ${isListening ? 'active-listening' : 'btn-outline'}" 
            style="padding:6px 10px; border-radius:10px; font-size:14px"
            onclick="toggleSpeechRecognition()" title="${t('المساعد الصوتي')}">
            🎙️
          </button>

          <button class="btn btn-primary" style="padding:6px 12px; border-radius:10px; font-size:13px; font-weight:700" 
            onclick="submitAiPrompt()">
            ${S.lang === 'fr' ? 'Envoyer' : (S.lang === 'en' ? 'Send' : 'إرسال')}
          </button>
        </div>

        <!-- AUDIO WAVEFORM LEVEL -->
        <div style="height:3px; background:var(--border); border-radius:2px; overflow:hidden">
          <div id="ai-audio-bar" style="height:100%; width:0%; background:linear-gradient(90deg, #8B5CF6, #EC4899); transition:width 0.1s ease"></div>
        </div>

        <!-- THINKING LOADER -->
        ${isThinking ? `
          <div style="display:flex; align-items:center; justify-content:center; gap:8px; padding:12px; color:var(--dash-p); font-size:12.5px; font-weight:700">
            <span class="spinner" style="width:16px; height:16px; border:2px solid var(--dash-p); border-top-color:transparent; border-radius:50%; animation:spin 0.8s linear infinite"></span>
            <span>${S.lang === 'fr' ? 'Analyse de l\'intention en cours...' : (S.lang === 'en' ? 'Analyzing intent and data...' : 'جاري تحليل القصد واستخراج البيانات...')}</span>
          </div>
        ` : ''}

        <!-- RESULT PREVIEW & PLAN -->
        ${result ? `
          <div style="background:var(--border-soft); border:1px solid var(--border); border-radius:12px; padding:10px; font-size:12px">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px">
              <strong style="color:var(--t1)">${result.summary || (S.lang === 'fr' ? 'Compris' : (S.lang === 'en' ? 'Understood' : 'تم الفهم'))}</strong>
              <span style="font-size:10px; font-weight:800; padding:2px 6px; border-radius:6px; background:${result.confidence >= 0.85 ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)'}; color:${result.confidence >= 0.85 ? '#10B981' : '#F59E0B'}">
                ${Math.round((result.confidence || 0) * 100)}% ${S.lang === 'fr' ? 'confiance' : (S.lang === 'en' ? 'confidence' : 'ثقة')}
              </span>
            </div>

            ${(result.plan && result.plan.length > 0) ? `
              <ul style="margin:4px 0 0 16px; padding:0; color:var(--t2); font-size:11.5px; line-height:1.5">
                ${result.plan.map(step => `<li>${step}</li>`).join('')}
              </ul>
            ` : ''}

            ${execution ? `
              <div style="margin-top:8px; padding-top:6px; border-top:1px dashed var(--border); font-size:11px; color:${execution.success ? '#10B981' : '#EF4444'}; font-weight:700">
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
