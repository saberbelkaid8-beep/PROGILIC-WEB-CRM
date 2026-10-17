import { S, clients, currentUser, currentStaffUser, isGerant, scheduleRender } from '../state/store.js';
import { _isSyncing, _lastSyncedTime, _saveError } from '../business/storage.js';
import { computeAlerts, autoDetectFeatureOpp } from '../business/intelligence.js';
import { esc } from '../utils/index.js';
import { renderLogin } from './render-login.js';
import { renderStaffLogin, renderStaffManagerModal } from './render-staff.js';
import { renderList, renderDetail, renderGlobalIntelligence, renderDashboard } from './render-views.js';
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

  // Dark Mode Configuration safely
  let isDark = false;
  try {
    isDark = localStorage.getItem('crm_dark') === '1';
  } catch (e) {
    console.warn("localStorage read blocked for dark mode config:", e);
  }

  if (isDark) {
    document.body.classList.add('dark');
  } else {
    document.body.classList.remove('dark');
  }

  // Floating Action Button Responsive State Sync
  const fab = document.querySelector(".fab");
  if (fab) {
    fab.style.display = currentUser && S.view === "list" ? (!document.body.classList.contains('dark') ? 'flex' : 'flex') : 'none';
  }

  // Login View Router - Direct clean HTML render to avoid morph collision with desktop UI
  if (!currentUser) {
    app.innerHTML = renderLogin();
    return;
  }

  // Verification Pending View Router
  if (currentUser && !currentUser.emailVerified) {
    window.loginMode = 'verificationPending';
    app.innerHTML = renderLogin();
    return;
  }

  // Staff Login View Router (After Google/Firebase account login)
  if (currentUser && currentUser.emailVerified && !currentStaffUser) {
    let modalHTML = '';
    if (S.modal) {
      modalHTML = renderModal();
    }
    app.innerHTML = renderStaffLogin() + modalHTML + renderStaffManagerModal();
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
    if (S.view === 'list') {
      pageContent = renderList();
    } else if (S.view === 'dashboard') {
      pageContent = renderDashboard();
    } else if (S.view === 'employees') {
      pageContent = renderEmployeesView();
    } else {
      pageContent = renderDetail();
    }
  } catch (viewError) {
    console.error("View rendering error boundary caught:", viewError);
    pageContent = `
      <div class="dash-error-boundary" style="padding:2.5rem; text-align:center; max-width:650px; margin:2rem auto; background:rgba(239,68,68,0.06); border:1px solid #EF4444; border-radius:12px">
        <h2 style="color:#EF4444; margin-bottom:8px">⚠️ ${S.lang === 'fr' ? 'Erreur d’affichage' : S.lang === 'en' ? 'Display Error' : 'خطأ في عرض الصفحة'}</h2>
        <p style="color:var(--t2); font-size:13px; margin-bottom:1rem">${S.lang === 'fr' ? 'Impossible de charger la vue demandée.' : S.lang === 'en' ? 'Unable to render the requested view.' : 'تعذر تحميل الواجهة المطلوبة بسبب خطأ غير متوقع.'}</p>
        <button class="btn btn-primary" onclick="S.view='list'; if(window.R) window.R();">📋 ${S.lang === 'fr' ? 'Retour aux clients' : S.lang === 'en' ? 'Back to Clients' : 'العودة لقائمة العملاء'}</button>
      </div>
    `;
  }

  const nextHTML = 
    renderHdr(alerts.length) +
    (S.view === 'list' || S.view === 'dashboard' ? renderAlertBanner(alerts) : '') +
    `<div class="page ${S.view === 'dashboard' ? 'dashboard-page' : ''}" style="${S.view === 'dashboard' ? 'max-width:1300px; padding:1.5rem;' : ''}">` + pageContent + '</div>' +
    (S.view === 'list' || S.view === 'dashboard' ? renderStorageBar() : '') +
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

  // Perform surgical DOM updates using Morphing Reconciliation with graceful fallback
  try {
    morph(app, tempWrapper);
  } catch (morphErr) {
    console.warn("DOM Morph notice, falling back to innerHTML:", morphErr);
    app.innerHTML = nextHTML;
  }

  // Trigger Recharts rendering if dashboard chart container exists
  if (typeof window.renderRechartsChart === 'function') {
    window.renderRechartsChart();
  }
} catch(e) {
  console.error("performRender recovery caught:", e);
  const appEl = document.getElementById("app");
  if (appEl) {
    if (!currentUser) {
      appEl.innerHTML = renderLogin();
    } else {
      appEl.innerHTML = `
        <div style="padding:2rem; max-width:680px; margin:2rem auto; background:var(--card, #fff); border:1px solid #EF4444; border-radius:12px; box-shadow:0 8px 24px rgba(0,0,0,0.1); font-family:sans-serif; text-align:center">
          <div style="font-size:36px; margin-bottom:12px">⚠️</div>
          <h2 style="color:#EF4444; margin-top:0">خطأ في معالجة واجهة التطبيق</h2>
          <p style="color:var(--t2, #666); font-size:14px">تم تحديث واجهة المستخدم. يمكنك العودة للقائمة الرئيسية أو إعادة المحاولة.</p>
          <div style="display:flex; justify-content:center; gap:10px; margin-top:1rem">
            <button onclick="if(window.S) window.S.view='list'; if(window.R) window.R();" style="padding:8px 16px; background:#2563EB; color:#fff; border:none; border-radius:8px; cursor:pointer; font-weight:bold">العودة للواجهة الرئيسية</button>
            <button onclick="window.location.reload();" style="padding:8px 16px; background:#e5e7eb; color:#374151; border:none; border-radius:8px; cursor:pointer; font-weight:bold">إعادة تحميل الصفحة</button>
          </div>
        </div>
      `;
    }
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

import { t, toggleLanguage, setLanguage } from '../utils/i18n.js';

// Helper to render Header Panel
function renderHdr(alertCount) {
  const ac = clients.filter(c => c.status === 'نشط').length;
  return `<div class="hdr">
    <div class="logo" onclick="setView('list')" style="cursor:pointer" title="${t('الرئيسية')}">PROGI<em>LIC</em></div>
    <span class="hdr-ver">CRM v3</span>
    
    <!-- View Switcher Tabs -->
    <div style="display:inline-flex;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.1);padding:2px;border-radius:var(--r-md);margin-right:12px;gap:2px">
      <button class="btn btn-xs ${S.view === 'list' ? 'btn-primary' : 'btn-ghost'}" onclick="setView('list')" style="margin:0;font-size:11px;padding:3px 8px;color:#fff">👥 ${t('العملاء')}</button>
      <button class="btn btn-xs ${S.view === 'dashboard' ? 'btn-primary' : 'btn-ghost'}" onclick="setView('dashboard')" style="margin:0;font-size:11px;padding:3px 8px;color:#fff">📊 ${t('لوحة القيادة')}</button>
      ${isGerant() ? `<button class="btn btn-xs ${S.view === 'employees' ? 'btn-primary' : 'btn-ghost'}" onclick="setView('employees')" style="margin:0;font-size:11px;padding:3px 8px;color:#fff">👔 ${t('الموظفون والأقسام')}</button>` : ''}
    </div>

    <span class="hdr-pill">${ac} ${t('نشط')} / ${clients.length}</span>
    <div class="hdr-right">
      <!-- 3-Way Language Selector -->
      <div class="lang-switch-group language-toggle" id="lang-toggle" role="group" aria-label="Language selector" style="display:inline-flex; align-items:center; background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.12); border-radius:var(--r-md); padding:2px; margin-left:8px; margin-right:8px; gap:2px">
        <button class="btn btn-xs ${S.lang === 'ar' ? 'btn-primary' : 'btn-ghost'}" onclick="setLanguage('ar')" title="اللغة العربية" style="margin:0; font-size:10.5px; padding:2px 7px; font-weight:700; color:#fff">عربي</button>
        <button class="btn btn-xs ${S.lang === 'fr' ? 'btn-primary' : 'btn-ghost'}" onclick="setLanguage('fr')" title="Français" style="margin:0; font-size:10.5px; padding:2px 7px; font-weight:700; color:#fff">FR</button>
        <button class="btn btn-xs ${S.lang === 'en' ? 'btn-primary' : 'btn-ghost'}" onclick="setLanguage('en')" title="English" style="margin:0; font-size:10.5px; padding:2px 7px; font-weight:700; color:#fff">EN</button>
      </div>

      <!-- Management Controls in Main Interface for Gérant -->
      ${isGerant() ? `
        <button class="btn btn-xs btn-outline" onclick="openModal('editStaffMember', {})" style="margin-left:4px; border:1px solid rgba(56,189,248,0.5); color:#38bdf8; font-weight:700; font-size:11px;" title="إضافة موظف/مستخدم جديد">
          ＋ ${t('إضافة مستخدم')}
        </button>
        <button class="btn btn-xs" onclick="toggleStaffManagerModal(true)" style="margin-left:4px; background:rgba(56,189,248,0.18); border:1px solid #38bdf8; color:#38bdf8; font-weight:700; font-size:11px;" title="إدارة الموظفين والأقسام وتعديل الصلاحيات">
          ⚙️ ${t('إدارة الصلاحيات')}
        </button>
      ` : ''}

      <span style="font-size:13px;font-weight:600;margin-left:8px;color:var(--t2)">
        👤 ${currentStaffUser ? esc(currentStaffUser.name) : (currentUser ? currentUser.email : '')}
      </span>
      <button class="btn btn-ghost btn-xs" onclick="logoutStaff()" title="تغيير الموظف" style="margin-left:4px; color:#94a3b8;">🔄 تبديل</button>
      <button class="btn btn-ghost btn-xs" onclick="logout()" title="${t('تسجيل الخروج')}" style="margin-left:10px;color:var(--r)">${t('تسجيل الخروج')}</button>
      <button class="dm-btn" title="${t('الوضع الليلي')}" onclick="toggleDark()" id="dmBtn">🌙</button>
      <button class="bell-btn" title="${t('الذكاء الاصطناعي')}" onclick="S.gi=!S.gi;R()" style="font-size:14px">🧠</button>
      ${alertCount > 0 ? `<button class="bell-btn" title="${alertCount} ${t('تنبيه نشط')}" onclick="S.gi=!S.gi;R()">🔔<span class="bell-dot"></span></button>` : ''}
      <button class="btn btn-primary" onclick="openModal('addClient')">+ ${t('إضافة عميل')}</button>
    </div>
  </div>`;
}

// Helper to render Alerts Banner
function renderAlertBanner(alerts) {
  if (!alerts || alerts.length === 0) return '';
  const top = alerts.slice(0, 3);
  const arr = S.lang === 'ar' ? '←' : '→';
  return `<div class="alert-banner-wrap">
    ${top.map(a => `<div class="abanner ${a.level}" onclick="selClient(${a.cid})">
      <span class="ab-icon">${a.icon}</span>
      <div class="ab-body"><div class="ab-title">${esc(t(a.msg))}</div><div class="ab-sub">${esc(t(a.sub))}</div></div>
      <span class="ab-arr">${arr}</span>
    </div>`).join('')}
    ${alerts.length > 3 ? `<div class="more-alerts">+ ${alerts.length - 3} ${S.lang === 'fr' ? 'autres alertes...' : S.lang === 'en' ? 'more alerts...' : 'تنبيهات أخرى...'}</div>` : ''}
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
      <span style="color:#e0a800; font-weight:600; display:flex; align-items:center; gap:6px;">
        <span class="pulse-offline" style="width:10px; height:10px; border-radius:50%; background:#e0a800; display:inline-block; animation: pulse 1.5s infinite;"></span>
        ${t('وضع الأوفلاين')} ${queueCount > 0 ? `— (${queueCount}) ${t('عمليات محلياً')}` : ''}
      </span>
    `;
  } else if (queueCount > 0) {
    statusHTML = `
      <span style="color:#1A73E8; font-weight:600; display:flex; align-items:center; gap:6px;">
        <span class="spin-online" style="width:10px; height:10px; border:2px solid transparent; border-top-color:#1A73E8; border-radius:50%; display:inline-block; animation: spin 1s linear infinite;"></span>
        ${t('جاري رفع المزامنة')} (${queueCount} ${t('عمليات معلقة')})...
      </span>
    `;
  } else if (_saveError) {
    statusHTML = `
      <span style="color:#ff4d4f; font-weight:600; display:flex; align-items:center; gap:6px;">
        <span style="width:10px; height:10px; border-radius:50%; background:#ff4d4f; display:inline-block;"></span>
        ⚠️ ${t('خطأ في المزامنة، سيتم إعادة المحاولة...')}
      </span>
    `;
  } else if (_lastSyncedTime) {
    statusHTML = `
      <span style="color:var(--g); font-weight:500; display:flex; align-items:center; gap:6px;">
        <span style="width:8px; height:8px; border-radius:50%; background:var(--g); display:inline-block;"></span>
        ☁️ ${t('تم المزامنة تلقائياً')} (${_lastSyncedTime.toLocaleTimeString(locale)})
      </span>
    `;
  } else {
    statusHTML = `
      <span style="color:var(--t3); display:flex; align-items:center; gap:6px;">
        <span style="width:8px; height:8px; border-radius:50%; background:var(--t3); display:inline-block;"></span>
        ☁️ ${t('متصل بالسحابة')}
      </span>
    `;
  }

  return `<div style="max-width:680px;margin:0 auto;padding:.5rem 1.25rem 1rem">
    <style>
      @keyframes pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.5; transform: scale(1.1); } }
      @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    </style>
    <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:.625rem .875rem;background:var(--surface);border:1px solid var(--border);border-radius:var(--r-md);flex-wrap:wrap;">
      <div id="sync-status-container" style="display:flex;align-items:center;font-size:11px;">
        ${statusHTML}
      </div>
      <div style="display:flex;align-items:center;gap:6px;">
        <button class="btn btn-ghost btn-xs" onclick="openModal('backupManager')" title="${t('إدارة النسخ الاحتياطية')}" style="color:var(--brand);font-weight:600">💾 ${t('النسخ الاحتياطية')}</button>
        <button class="btn btn-ghost btn-xs" onclick="openDbPurgeModal()" title="${t('تصفية/محو البيانات')}" style="color:var(--r);font-weight:700">🗑️ ${t('تصفية/محو البيانات')}</button>
        <button class="btn btn-ghost btn-xs" onclick="exportData('json')" title="${t('تصدير JSON')}">📤 ${t('تصدير JSON')}</button>
        <button class="btn btn-ghost btn-xs" onclick="exportData('dum')" title="${t('تصدير DUM')}">💾 ${t('تصدير DUM')}</button>
        <button class="btn btn-ghost btn-xs" onclick="exportToCSV()" title="${t('تصدير CSV')}">📊 ${t('تصدير CSV')}</button>
        <label class="btn btn-ghost btn-xs" title="${t('استيراد ملف JSON أو DUM')}" style="cursor:pointer;margin:0">
          📥 ${t('استيراد (.json / .dum)')}
          <input type="file" accept=".json,.dum,.dump,.txt,.csv" style="display:none" onchange="importData(this.files[0]);this.value=''">
        </label>
      </div>
    </div>
  </div>`;
}

// Clean UI: No telemetry indicators
function updateAuditorHUD() {}
window.__updateAuditorUI = updateAuditorHUD;
