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
    card.style.background = 'var(--surface)';
    card.style.borderRadius = 'var(--r-lg)';
    card.style.width = '100%';
    card.style.maxWidth = '400px';
    card.style.padding = '1.5rem';
    card.style.boxShadow = '0 20px 25px -5px rgb(0 0 0 / 0.3), 0 8px 10px -6px rgb(0 0 0 / 0.3)';
    card.style.margin = '1rem';
    card.style.direction = 'rtl';
    card.style.textAlign = 'right';
    card.style.border = '1px solid var(--border)';
    
    card.innerHTML = `
      <div style="font-size: 16px; font-weight: 700; color: var(--t1); margin-bottom: 0.75rem; display: flex; align-items: center; gap: 8px;">
        <span>⚠️</span>
        <span>${title}</span>
      </div>
      <div style="font-size: 13px; color: var(--t2); margin-bottom: 1.5rem; line-height: 1.6;">
        ${message.replace(/\n/g, '<br>')}
      </div>
      <div style="display: flex; justify-content: flex-end; gap: 8px;">
        <button class="btn btn-outline confirm-cancel" style="padding: 6px 14px; font-size: 12px;">إلغاء</button>
        <button class="btn btn-primary confirm-ok" style="padding: 6px 14px; font-size: 12px; background: var(--r) !important; color: white !important;">تأكيد</button>
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

export function showPrompt(message, title = 'إدخل البيانات', defaultValue = '', placeholder = '') {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'gi-overlay';
    overlay.style.zIndex = '500';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    
    const card = document.createElement('div');
    card.className = 'confirm-card';
    card.style.background = 'var(--surface)';
    card.style.borderRadius = 'var(--r-lg)';
    card.style.width = '100%';
    card.style.maxWidth = '400px';
    card.style.padding = '1.5rem';
    card.style.boxShadow = '0 20px 25px -5px rgb(0 0 0 / 0.3), 0 8px 10px -6px rgb(0 0 0 / 0.3)';
    card.style.margin = '1rem';
    card.style.direction = 'rtl';
    card.style.textAlign = 'right';
    card.style.border = '1px solid var(--border)';
    
    card.innerHTML = `
      <div style="font-size: 16px; font-weight: 700; color: var(--t1); margin-bottom: 0.75rem; display: flex; align-items: center; gap: 8px;">
        <span>📝</span>
        <span>${title}</span>
      </div>
      <div style="font-size: 13px; color: var(--t2); margin-bottom: 1rem; line-height: 1.6;">
        ${message.replace(/\n/g, '<br>')}
      </div>
      <div style="margin-bottom: 1.5rem;">
        <input type="text" class="fctl prompt-input" style="width: 100%; border: 1px solid var(--border); background: var(--bg); color: var(--t1); padding: 8px 12px; border-radius: var(--r-sm); font-size: 13px;" value="${defaultValue}" placeholder="${placeholder}" autofocus>
      </div>
      <div style="display: flex; justify-content: flex-end; gap: 8px;">
        <button class="btn btn-outline prompt-cancel" style="padding: 6px 14px; font-size: 12px;">إلغاء</button>
        <button class="btn btn-primary prompt-ok" style="padding: 6px 14px; font-size: 12px; color: white !important;">متابعة</button>
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
