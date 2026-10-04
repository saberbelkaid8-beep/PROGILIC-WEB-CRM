import { esc } from './index.js';
import { t } from './i18n.js';
import { S } from '../state/store.js';

export function showToast(message, type = 'success', duration = 3000) {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    container.dir = S.lang === 'ar' ? 'rtl' : 'ltr';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  let icon = '✓';
  if (type === 'error') icon = '✕';
  if (type === 'info') icon = 'ℹ';

  toast.innerHTML = `
    <div class="toast-icon">${icon}</div>
    <div class="toast-body">${esc(t(message))}</div>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('hide');
    setTimeout(() => {
      toast.remove();
      if (container.children.length === 0) {
        container.remove();
      }
    }, 200);
  }, duration);
}
