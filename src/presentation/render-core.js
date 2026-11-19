import { S, clients, currentUser, currentStaffUser, isGerant, hasPermission, scheduleRender } from '../state/store.js';
import { _isSyncing, _lastSyncedTime, _saveError } from '../business/storage.js';
import { computeAlerts, autoDetectFeatureOpp } from '../business/intelligence.js';
import { esc } from '../utils/index.js';
import { renderLogin } from './render-login.js';
import { renderStaffLogin, renderStaffManagerModal } from './render-staff.js';
import { renderList, renderDetail, renderGlobalIntelligence, renderDashboard } from './render-views.js';
import { renderGlobalTimeline } from './render-timeline-view.js';
import { renderModal } from './render-modals.js';
import { renderAiAssistantWidget } from './ai/assistantWidget.js';
import { renderEmployeesView } from './render-employees.js';


// DOM Morphing/Reconciliation Engine (Reuses DOM, prevents recreation, maintains inputs, selection and focus)
function morph(dom, vdom) {
  // 1. Handle mismatched Node Types - Replace the entire subtree
  if (dom.nodeType !== vdom.nodeType) {
    if (dom.parentNode) {
      try { dom.parentNode.replaceChild(vdom.cloneNode(true), dom); } catch(e) {}
    }
    if (window.__renderAudit) window.__renderAudit.domNodesRecreated++;
    return;
  }

  // 2. Handle Text and Comment Nodes - Update textContent inline
  if (dom.nodeType === Node.TEXT_NODE || dom.nodeType === Node.COMMENT_NODE) {
    if (dom.nodeValue !== vdom.nodeValue) {
      dom.nodeValue = vdom.nodeValue;
      if (window.__renderAudit) window.__renderAudit.domNodesReused++;
    }
    return;
  }

  // 3. Handle mismatched Tag Names - Replace element entirely
  if (dom.nodeName !== vdom.nodeName) {
    if (dom.parentNode) {
      try { dom.parentNode.replaceChild(vdom.cloneNode(true), dom); } catch(e) {}
    }
    if (window.__renderAudit) window.__renderAudit.domNodesRecreated++;
    return;
  }

  // Skip morphing for 3rd party managed containers
  if (dom.nodeType === Node.ELEMENT_NODE && dom.id === 'recharts-chart-container') {
    return;
  }

  // 4. Handle Element Nodes - Synchronize attributes, properties, and states
  if (dom.nodeType === Node.ELEMENT_NODE) {
    if (window.__renderAudit) window.__renderAudit.domNodesReused++;
    const isInput = dom.tagName === 'INPUT' || dom.tagName === 'TEXTAREA';
    
    // Preserve focus and text selection ranges on input fields
    let hasFocus = false;
    let selStart = 0;
    let selEnd = 0;
    if (isInput && document.activeElement === dom) {
      hasFocus = true;
      try {
        selStart = dom.selectionStart;
        selEnd = dom.selectionEnd;
      } catch (e) {}
    }

    // Sync input specific values and selection values
    if (isInput) {
      if (dom.value !== vdom.value) {
        dom.value = vdom.value;
      }
      if (dom.checked !== vdom.checked) {
        dom.checked = vdom.checked;
      }
    } else if (dom.tagName === 'SELECT') {
      if (dom.value !== vdom.value) {
        dom.value = vdom.value;
      }
    } else if (dom.tagName === 'OPTION') {
      if (dom.selected !== vdom.selected) {
        dom.selected = vdom.selected;
      }
    }

    // Sync HTML attributes
    const domAttrs = dom.attributes;
    const vdomAttrs = vdom.attributes;

    // Remove old attributes that are no longer present
    for (let i = domAttrs.length - 1; i >= 0; i--) {
      const name = domAttrs[i].name;
      if (!vdom.hasAttribute(name)) {
        dom.removeAttribute(name);
      }
    }

    // Add or update attributes
    for (let i = 0; i < vdomAttrs.length; i++) {
      const attr = vdomAttrs[i];
      if (dom.getAttribute(attr.name) !== attr.value) {
        dom.setAttribute(attr.name, attr.value);
      }
    }

    // Restore focus and precise cursor/selection coordinates
    if (hasFocus) {
      dom.focus();
      try {
        dom.setSelectionRange(selStart, selEnd);
      } catch (e) {}
    }
  }

  // 5. Morph Child Nodes Recursively using key-aware optimization (ID matching)
  const domChildren = Array.from(dom.childNodes);
  const vdomChildren = Array.from(vdom.childNodes);

  const domLen = domChildren.length;
  const vdomLen = vdomChildren.length;

  let dIdx = 0;
  let vIdx = 0;

  while (dIdx < domLen || vIdx < vdomLen) {
    const dChild = domChildren[dIdx];
    const vChild = vdomChildren[vIdx];

    if (!dChild && vChild) {
      // Append extra new children
      dom.appendChild(vChild.cloneNode(true));
      if (window.__renderAudit) window.__renderAudit.domNodesRecreated++;
      vIdx++;
    } else if (dChild && !vChild) {
      // Remove excess old children
      try { dom.removeChild(dChild); } catch(e) {}
      dIdx++;
    } else {
      // Both children exist, check for unique 'id' attributes to optimize updates
      const dId = dChild.nodeType === Node.ELEMENT_NODE ? dChild.getAttribute('id') : null;
      const vId = vChild.nodeType === Node.ELEMENT_NODE ? vChild.getAttribute('id') : null;

      if (dId && vId && dId !== vId) {
        // Look ahead in the remaining live children to find the matching element
        let matchedIdx = -1;
        for (let j = dIdx + 1; j < domLen; j++) {
          const sib = domChildren[j];
          if (sib.nodeType === Node.ELEMENT_NODE && sib.getAttribute('id') === vId) {
            matchedIdx = j;
            break;
          }
        }

        if (matchedIdx !== -1) {
          // Found matching sibling: bring it forward and morph it recursively
          const sibNode = domChildren[matchedIdx];
          try { dom.insertBefore(sibNode, dChild); } catch(e) {}
          morph(sibNode, vChild);
          
          // Re-index remaining array to reflect DOM insertion
          domChildren.splice(matchedIdx, 1);
          domChildren.splice(dIdx, 0, sibNode);
          dIdx++;
          vIdx++;
        } else {
          // No match found: replace the current DOM node with a clone of the vDOM node
          try { dom.replaceChild(vChild.cloneNode(true), dChild); } catch(e) {}
          if (window.__renderAudit) window.__renderAudit.domNodesRecreated++;
          dIdx++;
          vIdx++;
        }
      } else {
        // ID matching or both lack IDs: morph in-place recursively
        morph(dChild, vChild);
        dIdx++;
        vIdx++;
      }
    }
  }
}

// Synchronous Drawing/Rendering Operation
function performRender() { try {
  const app = document.getElementById('app');
  if (!app) return;
  const direction = (S.lang || 'ar') === 'ar' ? 'rtl' : 'ltr';
  document.documentElement.lang = S.lang || 'ar';
  document.documentElement.dir = direction;
  document.body.dir = direction;

  // Dark Mode Configuration safely (Dark Glassmorphism ON by default)
  let isDark = true;
  try {
    const stored = localStorage.getItem('crm_dark');
    isDark = stored === null ? true : stored === '1';
  } catch (e) {
    console.warn("localStorage read blocked for dark mode config:", e);
  }

  if (isDark) {
    document.body.classList.add('dark');
  } else {
    document.body.classList.remove('dark');
  }

  // Floating Action Button Responsive State Sync (Respects clients.create permission)
  const fab = document.querySelector(".fab");
  if (fab) {
    fab.style.display = currentUser && S.view === "list" && hasPermission('clients.create') ? 'flex' : 'none';
  }

  // Login View Router - Direct clean HTML render to avoid morph collision with desktop UI
  if (!currentUser) {
    app.innerHTML = renderLogin();
    localizeRenderedDom(app);
    return;
  }

  // Verification Pending View Router
  if (currentUser && !currentUser.emailVerified) {
    window.loginMode = 'verificationPending';
    app.innerHTML = renderLogin();
    localizeRenderedDom(app);
    return;
  }

  // Users Login Portal Router (Shows users login page after Gmail login until a user logs in)
  if (currentUser && (!currentStaffUser || S.showStaffPortal)) {
    let modalHTML = '';
    if (S.modal) {
      modalHTML = renderModal();
    }
    app.innerHTML = renderStaffLogin() + modalHTML + renderStaffManagerModal();
    localizeRenderedDom(app);
    return;
  }
  
  const alerts = computeAlerts();
  try { clients.forEach(c => autoDetectFeatureOpp(c.issues || [])); } catch(e) { console.error("Error in autoDetectFeatureOpp:", e); }

  let modalHTML = '';
  if (S.modal) {
    modalHTML = renderModal();
  }

  // Build the complete next UI frame
  let pageContent = '';
  try {
    if (S.view === 'dashboard') {
      pageContent = renderDashboard();
    } else if (S.view === 'list') {
      pageContent = renderList();
    } else if (S.view === 'global-timeline' || S.view === 'timeline') {
      pageContent = renderGlobalTimeline();
    } else if (S.view === 'employees') {
      pageContent = renderEmployeesView();
    } else {
      pageContent = renderDetail();
    }
  } catch (viewError) {
    console.error("View rendering error boundary caught:", viewError);
    pageContent = `
      <div class="dashboard-root">
        <div class="card" style="max-width:620px;margin:32px auto;text-align:center;gap:12px">
          <h2 style="color:var(--bad-t)">${S.lang === 'fr' ? 'Erreur d’affichage' : S.lang === 'en' ? 'Display Error' : 'خطأ في عرض الصفحة'}</h2>
          <p style="color:var(--muted);font-size:13px">${S.lang === 'fr' ? 'Impossible de charger la vue demandée.' : S.lang === 'en' ? 'Unable to render the requested view.' : 'تعذر تحميل الواجهة المطلوبة بسبب خطأ غير متوقع.'}</p>
          <div style="display:flex;justify-content:center">
            <button class="db-btn" onclick="S.view='dashboard'; if(window.R) window.R();">${S.lang === 'fr' ? 'Retour au tableau de bord' : S.lang === 'en' ? 'Back to Dashboard' : 'العودة للوحة القيادة'}</button>
          </div>
        </div>
      </div>
    `;
  }

  const offlineWarningBanner = (!S.isOnline || (typeof navigator !== 'undefined' && !navigator.onLine)) ? `
    <div style="background:rgba(255,69,58,0.92); backdrop-filter:blur(12px); color:#ffffff; padding:10px 16px; font-weight:700; font-size:12.5px; text-align:center; display:flex; align-items:center; justify-content:center; gap:8px; border-bottom:1px solid rgba(255,255,255,0.2); position:sticky; top:0; z-index:9999;">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
      <span>${S.lang === 'fr' ? 'PROGILIC CRM fonctionne exclusivement en ligne. Connexion Internet requise pour synchroniser vos opérations en temps réel.' : S.lang === 'en' ? 'PROGILIC CRM operates strictly online. Internet connection is required to sync operations in real time.' : 'تنبيه هام: نظام PROGILIC CRM يعمل حصرياً عبر السحابة أونلاين. يلزم توفر اتصال بالإنترنت لمزامنة كافة العمليات مباشرة وحفظها لحظياً.'}</span>
    </div>
  ` : '';

  const nextHTML = 
    offlineWarningBanner +
    renderHdr(alerts.length, isDark) +
    (S.view === 'list' ? renderAlertBanner(alerts) : '') +
    pageContent +
    (S.view === 'list' ? renderStorageBar() : '') +
    modalHTML +
    renderStaffManagerModal() +
    (S.gi ? renderGlobalIntelligence() : '') +
    renderAiAssistantWidget();

  // Parse HTML safely without triggering image loads or inline scripts
  const doc = new DOMParser().parseFromString(nextHTML, 'text/html');
  const tempWrapper = document.createElement('div');
  tempWrapper.id = app.id;
  tempWrapper.className = app.className;
  while (doc.body.firstChild) {
    tempWrapper.appendChild(doc.body.firstChild);
  }
  localizeRenderedDom(tempWrapper);

  // Perform surgical DOM updates using Morphing Reconciliation with graceful fallback
  try {
    morph(app, tempWrapper);
  } catch (morphErr) {
    console.warn("DOM Morph notice, falling back to innerHTML:", morphErr);
    app.innerHTML = tempWrapper.innerHTML;
  }
} catch(e) {
  console.error("performRender recovery caught:", e);
  const appEl = document.getElementById("app");
  if (appEl) {
    if (!currentUser) {
      appEl.innerHTML = renderLogin();
    } else {
      appEl.innerHTML = `
        <div class="dashboard-root">
          <div class="card" style="padding:2rem; max-width:640px; margin:2rem auto; border-color:rgba(255,69,58,0.35); text-align:center; gap:12px">
            <h2 style="color:var(--bad-t); margin-top:0">خطأ في معالجة واجهة التطبيق</h2>
            <p style="color:var(--t2); font-size:14px">تم تحديث واجهة المستخدم. يمكنك العودة للقائمة الرئيسية أو إعادة المحاولة.</p>
            <div style="display:flex; justify-content:center; gap:10px; margin-top:0.5rem">
              <button class="btn btn-primary" onclick="if(window.S) window.S.view='list'; if(window.R) window.R();">العودة للواجهة الرئيسية</button>
              <button class="btn btn-outline" onclick="window.location.reload();">إعادة تحميل الصفحة</button>
            </div>
          </div>
        </div>
      `;
    }
    localizeRenderedDom(appEl);
  }
} }

// Master Render Function - Automatically debounces and schedules on microtask queue
export function R() {
  if (window.__isProcessingMicrotasks) {
    performRender();
  } else {
    scheduleRender();
  }
}

import { t, toggleLanguage, setLanguage, localizeRenderedDom } from '../utils/i18n.js';

const HDR_SVG = {
  dash: '<rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  shield: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>',
  user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  switchUser: '<path d="M16 3h5v5"/><path d="M8 21H3v-5"/><path d="M21 3 14 10"/><path d="M3 21l7-7"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>',
  moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
  brain: '<path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"/><path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z"/><path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4"/>',
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
  plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
  warn: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  cloud: '<path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/>',
  db: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14a9 3 0 0 0 18 0V5"/><path d="M3 12a9 3 0 0 0 18 0"/>',
  trash: '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/>'
};

const hIc = (name, size = 15, sw = 2) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${HDR_SVG[name] || ''}</svg>`;

// Helper to render Header Panel
function renderHdr(alertCount, isDark) {
  const ac = clients.filter(c => c.status === 'نشط').length;
  const activeUserLabel = currentStaffUser ? esc(currentStaffUser.name) : (currentUser ? esc(currentUser.email) : '');

  return `<header class="hdr">
    <div class="hdr-brand" onclick="setView('dashboard')" title="${t('الرئيسية')}">
      <div class="hdr-brand-mark">${hIc('dash', 17, 2.2)}</div>
      <div class="logo">PROGI<em>LIC</em></div>
    </div>

    <!-- View Switcher Tabs -->
    <nav class="hdr-nav" aria-label="${t('التنقل')}">
      <button class="hdr-nav-btn ${S.view === 'dashboard' ? 'on' : ''}" onclick="setView('dashboard')">
        ${hIc('dash', 14)} <span>${t('لوحة القيادة')}</span>
      </button>
      <button class="hdr-nav-btn ${S.view === 'list' ? 'on' : ''}" onclick="setView('list')">
        ${hIc('users', 14)} <span>${t('العملاء')}</span>
      </button>
      ${hasPermission('timeline.view') ? `
        <button class="hdr-nav-btn ${S.view === 'global-timeline' || S.view === 'timeline' ? 'on' : ''}" onclick="setView('global-timeline')">
          ${hIc('clock', 14)} <span>${t('المخطط الزمني العام')}</span>
        </button>
      ` : ''}
      ${isGerant() || hasPermission('staff.view') ? `
        <button class="hdr-nav-btn ${S.view === 'employees' ? 'on' : ''}" onclick="setView('employees')">
          ${hIc('shield', 14)} <span>${t('الموظفون والأقسام')}</span>
        </button>
      ` : ''}
    </nav>

    <span class="hdr-count-meta num">${ac} ${t('نشط')} · ${clients.length}</span>

    <div class="hdr-right">
      <!-- 3-Way Language Selector -->
      <div class="hdr-lang language-toggle" id="lang-toggle" role="group" aria-label="${t('تغيير اللغة')}">
        <button class="hdr-lang-btn ${S.lang === 'ar' ? 'on' : ''}" onclick="setLanguage('ar')" title="${t('اللغة العربية')}">${t('العربية')}</button>
        <button class="hdr-lang-btn ${S.lang === 'fr' ? 'on' : ''}" onclick="setLanguage('fr')" title="Français">FR</button>
        <button class="hdr-lang-btn ${S.lang === 'en' ? 'on' : ''}" onclick="setLanguage('en')" title="English">EN</button>
      </div>

      <!-- Management Controls in Main Interface for President (Gérant) -->
      ${isGerant() || hasPermission('permissions.assign') ? `
        <button class="hdr-admin-btn" onclick="toggleStaffManagerModal(true)" title="${t('إدارة الصلاحيات (الرئيس)')}">
          ${hIc('shield', 14)} <span>${t('إدارة الصلاحيات (الرئيس)')}</span>
        </button>
      ` : ''}

      <span class="hdr-user-label" title="${activeUserLabel}">
        ${hIc('user', 14)} <span>${activeUserLabel}</span>
      </span>

      <button class="btn btn-ghost btn-xs" onclick="logoutStaff()" title="${t('تبديل المستخدم')}">
        ${hIc('switchUser', 13)} <span>${t('تبديل المستخدم')}</span>
      </button>
      <button class="btn btn-ghost btn-xs" onclick="logout()" title="${t('تسجيل الخروج')}" style="color:var(--rt)">
        ${hIc('logout', 13)} <span>${t('تسجيل الخروج')}</span>
      </button>

      <button class="dm-btn" title="${t('الوضع الليلي')}" onclick="toggleDark()" id="dmBtn">
        ${isDark ? hIc('sun', 16) : hIc('moon', 16)}
      </button>
      ${hasPermission('analytics.view') ? `
        <button class="bell-btn" title="${t('لوحة الذكاء العالمي')}" onclick="S.gi=!S.gi;R()">
          ${hIc('brain', 16)}
        </button>
      ` : ''}
      ${alertCount > 0 ? `
        <button class="bell-btn" title="${alertCount} ${t('تنبيه نشط')}" onclick="S.gi=!S.gi;R()">
          ${hIc('bell', 16)}<span class="bell-dot"></span>
        </button>
      ` : ''}
      ${hasPermission('clients.create') ? `
        <button class="btn btn-primary btn-sm hdr-add-btn" onclick="openModal('addClient')">
          ${hIc('plus', 14)} <span>${t('إضافة عميل')}</span>
        </button>
      ` : ''}
    </div>
  </header>`;
}

// Helper to render Alerts Banner
function renderAlertBanner(alerts) {
  if (!alerts || alerts.length === 0) return '';
  const top = alerts.slice(0, 3);
  const arr = S.lang === 'ar' ? '←' : '→';
  return `<div class="alert-banner-wrap">
    ${top.map(a => `<div class="abanner ${a.level}" onclick="selClient(${a.cid})">
      <span class="ab-icon">${hIc('warn', 15)}</span>
      <div class="ab-body"><div class="ab-title">${esc(t(a.msg))}</div><div class="ab-sub">${esc(t(a.sub))}</div></div>
      <span class="ab-arr">${arr}</span>
    </div>`).join('')}
    ${alerts.length > 3 ? `<div class="more-alerts num">+ ${alerts.length - 3} ${S.lang === 'fr' ? 'autres alertes...' : S.lang === 'en' ? 'more alerts...' : 'تنبيهات أخرى...'}</div>` : ''}
  </div>`;
}

// Helper to render Storage & Sync Status Bar
function renderStorageBar() {
  const isOnline = S.isOnline;
  const queueCount = (S.syncQueue || []).length;
  const locale = S.lang === 'fr' ? 'fr-FR' : (S.lang === 'en' ? 'en-US' : 'ar-DZ');
  
  let statusHTML = '';
  if (!isOnline) {
    statusHTML = `
      <span style="color:var(--rt); font-weight:700; display:inline-flex; align-items:center; gap:7px;">
        ${hIc('warn', 15)}
        <span>${t('غير متصل - مطلوب اتصال بالإنترنت (نظام سحابي أونلاين فقط)')}</span>
      </span>
    `;
  } else if (queueCount > 0) {
    statusHTML = `
      <span style="color:var(--bt); font-weight:600; display:inline-flex; align-items:center; gap:7px;">
        ${hIc('cloud', 15)}
        <span>${t('جاري المزامنة السحابية الفورية')} (<span class="num">${queueCount}</span> ${t('عمليات معلقة')})</span>
      </span>
    `;
  } else if (_saveError) {
    statusHTML = `
      <span style="color:var(--wt); font-weight:600; display:inline-flex; align-items:center; gap:7px;">
        ${hIc('warn', 15)}
        <span>${t('جاري إعادة الاتصال بالسحابة...')}</span>
      </span>
    `;
  } else {
    statusHTML = `
      <span style="color:var(--gt); font-weight:600; display:inline-flex; align-items:center; gap:7px;">
        ${hIc('cloud', 15)}
        <span>${t('متصل بالسحابة أونلاين')} (${t('مزامنة حية لحظية لكافة المستخدمين')})${_lastSyncedTime ? ` · <span class="num">${_lastSyncedTime.toLocaleTimeString(locale)}</span>` : ''}</span>
      </span>
    `;
  }

  return `<div class="sync-bar-wrap">
    <div class="sync-bar-card">
      <div id="sync-status-container" style="display:flex;align-items:center;font-size:12px;">
        ${statusHTML}
      </div>
      <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
        ${hasPermission('backup.view') ? `<button class="btn btn-outline btn-xs" onclick="openModal('backupManager')" title="${t('إدارة النسخ الاحتياطية')}">${hIc('db', 13)} <span>${t('النسخ الاحتياطية')}</span></button>` : ''}
        ${isGerant() ? `<button class="btn btn-danger-soft btn-xs" onclick="openDbPurgeModal()" title="${t('تصفية/محو البيانات')}">${hIc('trash', 13)} <span>${t('تصفية/محو البيانات')}</span></button>` : ''}
        ${hasPermission('clients.export') ? `<button class="btn btn-outline btn-xs" onclick="exportToCSV()" title="${t('تصدير CSV')}">${hIc('download', 13)} <span>${t('تصدير CSV')}</span></button>` : ''}
        ${isGerant() || hasPermission('backup.restore') ? `
          <label class="btn btn-outline btn-xs" title="${t('استيراد ملف JSON أو DUM')}" style="cursor:pointer;margin:0">
            ${hIc('upload', 13)} <span>${t('استيراد (.json / .dum)')}</span>
            <input type="file" accept=".json,.dum,.dump,.txt,.csv" style="display:none" onchange="importData(this.files[0]);this.value=''">
          </label>
        ` : ''}
      </div>
    </div>
  </div>`;
}

// Clean UI: No telemetry indicators
function updateAuditorHUD() {}
window.__updateAuditorUI = updateAuditorHUD;
