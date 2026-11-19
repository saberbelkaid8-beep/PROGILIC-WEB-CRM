import { esc } from './index.js';
import { t } from './i18n.js';
import { S } from '../state/store.js';

const CONFIRM_WARN_SVG = `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="color:var(--wt);flex-shrink:0"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>`;
const CONFIRM_EDIT_SVG = `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="color:var(--bt);flex-shrink:0"><path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.375 2.625a1 1 0 0 1 3 3l-9.013 9.014a2 2 0 0 1-.853.505l-2.873.84a.5.5 0 0 1-.62-.62l.84-2.873a2 2 0 0 1 .506-.852z"/></svg>`;

function applyGlassCardStyle(card) {
  const isDark = document.body.classList.contains('dark');
  card.style.background = isDark ? 'rgba(16, 20, 28, 0.90)' : 'rgba(255, 255, 255, 0.92)';
  card.style.backdropFilter = 'blur(32px) saturate(180%)';
  card.style.webkitBackdropFilter = 'blur(32px) saturate(180%)';
  card.style.borderRadius = 'var(--r-lg, 24px)';
  card.style.width = '100%';
  card.style.maxWidth = '420px';
  card.style.padding = '1.5rem';
  card.style.boxShadow = isDark
    ? '0 24px 64px rgba(0, 0, 0, 0.65), inset 0 1px 0 rgba(255, 255, 255, 0.22)'
    : '0 24px 56px rgba(0, 0, 0, 0.14), inset 0 1px 0 rgba(255, 255, 255, 0.95)';
  card.style.margin = '1rem';
  card.style.direction = S.lang === 'ar' ? 'rtl' : 'ltr';
  card.style.textAlign = S.lang === 'ar' ? 'right' : 'left';
  card.style.border = isDark ? '1px solid rgba(255, 255, 255, 0.18)' : '1px solid rgba(0, 0, 0, 0.08)';
}

export function showConfirm(message, title = 'تأكيد الإجراء') {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'gi-overlay';
    overlay.style.zIndex = '500';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    
    // Create the modal card
    const card = document.createElement('div');
    card.className = 'confirm-card';
    applyGlassCardStyle(card);
    
    card.innerHTML = `
      <div style="font-size: 16px; font-weight: 700; color: var(--t1); margin-bottom: 0.75rem; display: flex; align-items: center; gap: 8px;">
        ${CONFIRM_WARN_SVG}
        <span>${esc(t(title))}</span>
      </div>
      <div style="font-size: 13px; color: var(--t2); margin-bottom: 1.5rem; line-height: 1.65;">
        ${esc(t(message)).replace(/\n/g, '<br>')}
      </div>
      <div style="display: flex; justify-content: flex-end; gap: 8px;">
        <button class="btn btn-outline confirm-cancel" style="padding: 7px 15px; font-size: 12.5px;">${t('إلغاء')}</button>
        <button class="btn btn-danger confirm-ok" style="padding: 7px 15px; font-size: 12.5px;">${t('تأكيد')}</button>
      </div>
    `;
    
    overlay.appendChild(card);
    document.body.appendChild(overlay);
    
    const cancelBtn = card.querySelector('.confirm-cancel');
    const okBtn = card.querySelector('.confirm-ok');
    
    const cleanup = () => {
      overlay.style.opacity = '0';
      overlay.style.transition = 'opacity 0.15s ease';
      setTimeout(() => {
        overlay.remove();
      }, 150);
    };
    
    cancelBtn.addEventListener('click', () => {
      cleanup();
      resolve(false);
    });
    
    okBtn.addEventListener('click', () => {
      cleanup();
      resolve(true);
    });
  });
}

export function showPrompt(message, title = 'إدخال البيانات', defaultValue = '', placeholder = '') {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'gi-overlay';
    overlay.style.zIndex = '500';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    
    const card = document.createElement('div');
    card.className = 'confirm-card';
    applyGlassCardStyle(card);
    
    card.innerHTML = `
      <div style="font-size: 16px; font-weight: 700; color: var(--t1); margin-bottom: 0.75rem; display: flex; align-items: center; gap: 8px;">
        ${CONFIRM_EDIT_SVG}
        <span>${esc(t(title))}</span>
      </div>
      <div style="font-size: 13px; color: var(--t2); margin-bottom: 1rem; line-height: 1.65;">
        ${esc(t(message)).replace(/\n/g, '<br>')}
      </div>
      <div style="margin-bottom: 1.5rem;">
        <input type="text" class="fctl prompt-input" style="width: 100%; font-size: 13px;" value="${esc(defaultValue)}" placeholder="${esc(t(placeholder))}" autofocus>
      </div>
      <div style="display: flex; justify-content: flex-end; gap: 8px;">
        <button class="btn btn-outline prompt-cancel" style="padding: 7px 15px; font-size: 12.5px;">${t('إلغاء')}</button>
        <button class="btn btn-primary prompt-ok" style="padding: 7px 15px; font-size: 12.5px;">${S.lang === 'fr' ? 'Continuer' : S.lang === 'en' ? 'Continue' : 'متابعة'}</button>
      </div>
    `;
    
    overlay.appendChild(card);
    document.body.appendChild(overlay);
    
    const inputEl = card.querySelector('.prompt-input');
    const cancelBtn = card.querySelector('.prompt-cancel');
    const okBtn = card.querySelector('.prompt-ok');
    
    setTimeout(() => { if (inputEl) inputEl.focus(); }, 50);
    
    const cleanup = () => {
      overlay.style.opacity = '0';
      overlay.style.transition = 'opacity 0.15s ease';
      setTimeout(() => {
        overlay.remove();
      }, 150);
    };
    
    cancelBtn.addEventListener('click', () => {
      cleanup();
      resolve(null);
    });
    
    okBtn.addEventListener('click', () => {
      const val = inputEl ? inputEl.value : '';
      cleanup();
      resolve(val);
    });
    
    inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        okBtn.click();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        cancelBtn.click();
      }
    });
  });
}
