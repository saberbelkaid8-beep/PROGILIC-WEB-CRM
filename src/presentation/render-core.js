import { S, clients, currentUser, scheduleRender } from '../state/store.js';
import { _isSyncing, _lastSyncedTime, _saveError } from '../business/storage.js';
import { computeAlerts, autoDetectFeatureOpp } from '../business/intelligence.js';
import { renderLogin } from './render-login.js';
import { renderList, renderDetail, renderGlobalIntelligence, renderDashboard } from './render-views.js';
import { renderModal } from './render-modals.js';

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

  // Login View Router
  if (!currentUser) {
    const tempLogin = document.createElement('div');
    tempLogin.id = app.id;
    tempLogin.className = app.className;
    tempLogin.innerHTML = renderLogin();
    morph(app, tempLogin);
    updateAuditorHUD();
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
  if (S.view === 'list') {
    pageContent = renderList();
  } else if (S.view === 'dashboard') {
    pageContent = renderDashboard();
  } else {
    pageContent = renderDetail();
  }

  const nextHTML = 
    renderHdr(alerts.length) +
    (S.view === 'list' || S.view === 'dashboard' ? renderAlertBanner(alerts) : '') +
    `<div class="page ${S.view === 'dashboard' ? 'dashboard-page' : ''}" style="${S.view === 'dashboard' ? 'max-width:1300px; padding:1.5rem;' : ''}">` + pageContent + '</div>' +
    (S.view === 'list' || S.view === 'dashboard' ? renderStorageBar() : '') +
    modalHTML +
    (S.gi ? renderGlobalIntelligence() : '');

  // Parse HTML into virtual DOM wrapper
  const tempWrapper = document.createElement('div');
  tempWrapper.id = app.id;
  tempWrapper.className = app.className;
  tempWrapper.innerHTML = nextHTML;

  // Perform surgical DOM updates using Morphing Reconciliation
  morph(app, tempWrapper);

  // Trigger Recharts rendering if dashboard chart container exists
  if (typeof window.renderRechartsChart === 'function') {
    window.renderRechartsChart();
  }

  // Synchronize separate Performance Audit HUD
  updateAuditorHUD();
} catch(e) { document.getElementById("app").innerHTML = "<div style='color:red;padding:20px;'><h1>CRASH in performRender:</h1><pre>" + e.stack + "</pre></div>"; } }

// Master Render Function - Automatically debounces and schedules on microtask queue
export function R() {
  if (window.__isProcessingMicrotasks) {
    performRender();
  } else {
    scheduleRender();
  }
}

import { t, toggleLanguage } from '../utils/i18n.js';

// Helper to render Header Panel
function renderHdr(alertCount) {
  const ac = clients.filter(c => c.status === 'نشط').length;
  return `<div class="hdr">
    <div class="logo" onclick="setView('list')" style="cursor:pointer" title="الرئيسية">PROGI<em>LIC</em></div>
    <span class="hdr-ver">CRM v3</span>
    
    <!-- View Switcher Tabs -->
    <div style="display:inline-flex;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.1);padding:2px;border-radius:var(--r-md);margin-right:12px;gap:2px">
      <button class="btn btn-xs ${S.view === 'list' ? 'btn-primary' : 'btn-ghost'}" onclick="setView('list')" style="margin:0;font-size:11px;padding:3px 8px;color:#fff">👥 ${t('العملاء')}</button>
      <button class="btn btn-xs ${S.view === 'dashboard' ? 'btn-primary' : 'btn-ghost'}" onclick="setView('dashboard')" style="margin:0;font-size:11px;padding:3px 8px;color:#fff">📊 ${t('لوحة القيادة')}</button>
    </div>

    <span class="hdr-pill">${ac} ${t('نشط')} / ${clients.length}</span>
    <div class="hdr-right">
      <button class="btn btn-ghost btn-xs" onclick="toggleLanguage()" title="تغيير اللغة" style="margin-left:10px;font-weight:bold;">${S.lang === 'fr' ? 'AR' : 'FR'}</button>
      <span style="font-size:13px;font-weight:600;margin-left:10px;color:var(--t2)">👤 ${currentUser ? currentUser.email : ''}</span>
      <button class="btn btn-ghost btn-xs" onclick="logout()" title="${t('تسجيل الخروج')}" style="margin-left:10px;color:var(--r)">${t('تسجيل الخروج')}</button>
      <button class="dm-btn" title="الوضع الليلي" onclick="toggleDark()" id="dmBtn">🌙</button>
      <button class="bell-btn" title="الذكاء الاصطناعي العالمي" onclick="S.gi=!S.gi;R()" style="font-size:14px">🧠</button>
      ${alertCount > 0 ? `<button class="bell-btn" title="${alertCount} تنبيه نشط" onclick="S.gi=!S.gi;R()">🔔<span class="bell-dot"></span></button>` : ''}
      ${S.view === 'list' || S.view === 'dashboard' ? `<button class="btn btn-primary" onclick="openModal('addClient')">+ ${t('إضافة عميل')}</button>` : ''}
    </div>
  </div>`;
}

// Helper to render Alerts Banner
function renderAlertBanner(alerts) {
  if (!alerts || alerts.length === 0) return '';
  const top = alerts.slice(0, 3);
  return `<div class="alert-banner-wrap">
    ${top.map(a => `<div class="abanner ${a.level}" onclick="selClient(${a.cid})">
      <span class="ab-icon">${a.icon}</span>
      <div class="ab-body"><div class="ab-title">${a.msg}</div><div class="ab-sub">${a.sub}</div></div>
      <span class="ab-arr">←</span>
    </div>`).join('')}
    ${alerts.length > 3 ? `<div class="more-alerts">و ${alerts.length - 3} تنبيهات أخرى...</div>` : ''}
  </div>`;
}

// Helper to render Storage & Sync Status Bar
function renderStorageBar() {
  const isOnline = S.isOnline;
  const queueCount = (S.syncQueue || []).length;
  
  let statusHTML = '';
  if (!isOnline) {
    statusHTML = `
      <span style="color:#e0a800; font-weight:600; display:flex; align-items:center; gap:6px;" title="أنت تعمل في وضع غير متصل بالإنترنت. تم حفظ التغييرات محلياً وسيتم رفعها تلقائياً عند استعادة الاتصال.">
        <span class="pulse-offline" style="width:10px; height:10px; border-radius:50%; background:#e0a800; display:inline-block; animation: pulse 1.5s infinite;"></span>
        وضع الأوفلاين ${queueCount > 0 ? `— تم حفظ ${queueCount} عمليات محلياً` : ''}
      </span>
    `;
  } else if (queueCount > 0) {
    statusHTML = `
      <span style="color:#1A73E8; font-weight:600; display:flex; align-items:center; gap:6px;">
        <span class="spin-online" style="width:10px; height:10px; border:2px solid transparent; border-top-color:#1A73E8; border-radius:50%; display:inline-block; animation: spin 1s linear infinite;"></span>
        جاري رفع المزامنة (${queueCount} عمليات معلقة)...
      </span>
    `;
  } else if (_saveError) {
    statusHTML = `
      <span style="color:#ff4d4f; font-weight:600; display:flex; align-items:center; gap:6px;" title="حدثت مشكلة أثناء محاولة مزامنة البيانات. سيتم إعادة المحاولة تلقائياً.">
        <span style="width:10px; height:10px; border-radius:50%; background:#ff4d4f; display:inline-block;"></span>
        ⚠️ خطأ في المزامنة، سيتم إعادة المحاولة...
      </span>
    `;
  } else if (_lastSyncedTime) {
    statusHTML = `
      <span style="color:var(--g); font-weight:500; display:flex; align-items:center; gap:6px;">
        <span style="width:8px; height:8px; border-radius:50%; background:var(--g); display:inline-block;"></span>
        ☁️ تم المزامنة تلقائياً (${_lastSyncedTime.toLocaleTimeString('ar-DZ')})
      </span>
    `;
  } else {
    statusHTML = `
      <span style="color:var(--t3); display:flex; align-items:center; gap:6px;">
        <span style="width:8px; height:8px; border-radius:50%; background:var(--t3); display:inline-block;"></span>
        ☁️ متصل بالسحابة
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
        <button class="btn btn-ghost btn-xs" onclick="openModal('backupManager')" title="إدارة النسخ الاحتياطية المؤرشفة في المتصفح" style="color:var(--brand);font-weight:600">💾 النسخ الاحتياطية</button>
        <button class="btn btn-ghost btn-xs" onclick="exportData()" title="تصدير النسخة الاحتياطية">📤 تصدير JSON</button>
        <button class="btn btn-ghost btn-xs" onclick="exportToCSV()" title="تصدير جدول العملاء والإحصائيات إلى ملف CSV">📊 تصدير CSV</button>
        <label class="btn btn-ghost btn-xs" title="استيراد من ملف" style="cursor:pointer;margin:0">
          📥 استيراد
          <input type="file" accept=".json" style="display:none" onchange="importData(this.files[0]);this.value=''">
        </label>
      </div>
    </div>
  </div>`;
}

// Isolated Auditor HUD Manager (Render-Loop Safe)
function updateAuditorHUD() {
  let container = document.getElementById('render-auditor-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'render-auditor-container';
    document.body.appendChild(container);
  }

  const audit = window.__renderAudit;
  if (!audit) return;

  const totalNodes = (audit.domNodesReused + audit.domNodesRecreated) || 1;
  const reusePercent = Math.round((audit.domNodesReused / totalNodes) * 100);

  // HUD Visibility Control (Toggled by Shift+Alt+A or floating trigger)
  if (!audit.showAuditorUI) {
    container.innerHTML = `
      <div class="fixed bottom-4 right-4 z-[9999] bg-slate-900/90 hover:bg-slate-900 text-white rounded-full shadow-2xl border border-slate-700/50 p-3 cursor-pointer flex items-center justify-center transition-all duration-300 transform hover:scale-105" 
           title="افتح مراقب الأداء ومراجعة محرك الصيرورة (Shift+Alt+A)" 
           onclick="window.__renderAudit.showAuditorUI=true; window.__updateAuditorUI()">
        <span class="text-base">📊</span>
      </div>
    `;
    return;
  }

  // Diagnostic Status Indicators
  const fpsColor = audit.fps >= 55 ? 'text-emerald-400' : audit.fps >= 40 ? 'text-amber-400' : 'text-rose-400';
  const latencyColor = audit.lastRenderDurationMs <= 8 ? 'text-emerald-400' : audit.lastRenderDurationMs <= 16 ? 'text-amber-400' : 'text-rose-400';

  container.innerHTML = `
    <div id="render-auditor-overlay" class="fixed bottom-4 right-4 z-[9999] bg-slate-900/95 text-slate-200 rounded-xl shadow-2xl border border-slate-700/80 font-mono text-[11px] p-4 w-80 select-none transition-all duration-300">
      <div class="flex items-center justify-between border-b border-slate-800 pb-2 mb-3">
        <span class="font-bold text-xs text-indigo-400 flex items-center gap-1">⚡ PROGILIC DOM Profiler</span>
        <button class="text-slate-400 hover:text-white transition-colors text-sm font-sans" onclick="window.__renderAudit.showAuditorUI=false; window.__updateAuditorUI()">×</button>
      </div>

      <div class="grid grid-cols-2 gap-3 mb-3">
        <div class="bg-slate-950/60 p-2 rounded border border-slate-800/50">
          <div class="text-slate-500 text-[9px] uppercase">Frame Rate</div>
          <div class="text-lg font-bold ${fpsColor}">${audit.fps} FPS</div>
          <div class="text-[9px] text-slate-400">Target 60 FPS (16.6ms)</div>
        </div>
        <div class="bg-slate-950/60 p-2 rounded border border-slate-800/50">
          <div class="text-slate-500 text-[9px] uppercase">Render Latency</div>
          <div class="text-lg font-bold ${latencyColor}">${audit.lastRenderDurationMs.toFixed(2)}ms</div>
          <div class="text-[9px] text-slate-400">Avg: ${audit.avgRenderDurationMs.toFixed(1)}ms</div>
        </div>
      </div>

      <div class="space-y-1.5 text-slate-300">
        <div class="flex justify-between items-center bg-slate-950/30 px-2 py-1 rounded">
          <span>Total Renders</span>
          <span class="font-semibold text-white">${audit.renderCount}</span>
        </div>
        <div class="flex justify-between items-center bg-slate-950/30 px-2 py-1 rounded">
          <span>Unnecessary Renders Prevented</span>
          <span class="font-semibold text-emerald-400">${audit.unnecessaryRendersPrevented}</span>
        </div>
        <div class="flex justify-between items-center bg-slate-950/30 px-2 py-1 rounded">
          <span>Recursive Updates Safely Stopped</span>
          <span class="font-semibold ${audit.recursiveRendersPrevented > 0 ? 'text-amber-400' : 'text-slate-400'}">${audit.recursiveRendersPrevented}</span>
        </div>
        <div class="flex justify-between items-center bg-slate-950/30 px-2 py-1 rounded">
          <span>Render Loops Blocked</span>
          <span class="font-semibold ${audit.renderLoopsPrevented > 0 ? 'text-rose-400' : 'text-slate-400'}">${audit.renderLoopsPrevented}</span>
        </div>
        <div class="flex justify-between items-center bg-slate-950/30 px-2 py-1 rounded">
          <span>DOM Node Reuse Efficiency</span>
          <span class="font-semibold text-indigo-400">${reusePercent}%</span>
        </div>
      </div>

      <div class="mt-3 pt-2 border-t border-slate-800/60 text-[9px] text-slate-500 flex justify-between">
        <span>Nodes Reused: ${audit.domNodesReused}</span>
        <span>Nodes Recreated: ${audit.domNodesRecreated}</span>
      </div>
    </div>
  `;
}

// Expose update auditor HUD helper globally so store.js can trigger it directly
window.__updateAuditorUI = updateAuditorHUD;

// Register Shift+Alt+A Hotkey to toggle Auditor UI dynamically
window.addEventListener('keydown', (e) => {
  if (e.shiftKey && e.altKey && e.code === 'KeyA') {
    if (window.__renderAudit) {
      window.__renderAudit.showAuditorUI = !window.__renderAudit.showAuditorUI;
      updateAuditorHUD();
    }
  }
});
