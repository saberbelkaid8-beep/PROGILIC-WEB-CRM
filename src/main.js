
// Global error logging and diagnostic screen for developers and users
function showErrorScreen(error, type = "خطأ غير متوقع") {
  const app = document.getElementById('app');
  if (app) {
    const errorDetails = error ? (error.stack || error.message || String(error)) : "تفاصيل غير متوفرة";
    app.innerHTML = `
      <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; min-height:100vh; padding:24px; font-family:system-ui, -apple-system, sans-serif; background:#f8fafc; color:#1e293b; direction:rtl; text-align:center;">
        <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:16px; padding:32px; max-width:500px; width:100%; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.05);">
          <div style="font-size:48px; margin-bottom:16px;">⚠️</div>
          <h2 style="font-size:20px; font-weight:700; margin-bottom:8px; color:#0f172a;">عذراً، حدث خطأ أثناء تشغيل النظام</h2>
          <p style="font-size:14px; color:#64748b; margin-bottom:20px; line-height:1.6;">
            قد يكون ذلك بسبب قيود الخصوصية في هذا المتصفح، أو حظر الملفات المؤقتة في وضع المتصفح الخفي، أو مشكلة مؤقتة في المزامنة. يرجى محاولة تحديث الصفحة أو مسح الذاكرة المؤقتة.
          </p>
          <div style="background:#f1f5f9; border-radius:8px; padding:12px; margin-bottom:24px; font-family:monospace; font-size:11px; color:#475569; text-align:left; overflow-x:auto; white-space:pre-wrap; max-height:120px; border:1px solid #cbd5e1;">
            <strong>[${type}]</strong>: ${errorDetails}
          </div>
          <div style="display:flex; gap:12px; justify-content:center;">
            <button onclick="window.location.reload()" style="background:#1a73e8; color:#ffffff; border:none; padding:10px 20px; border-radius:8px; font-size:14px; font-weight:600; cursor:pointer; transition:background 0.2s;">
              تحديث الصفحة
            </button>
            <button onclick="try { localStorage.clear(); sessionStorage.clear(); window.location.reload(); } catch(e) { window.location.reload(); }" style="background:transparent; color:#64748b; border:1px solid #cbd5e1; padding:10px 20px; border-radius:8px; font-size:14px; font-weight:600; cursor:pointer; transition:background 0.2s;">
              مسح الذاكرة وتحديث
            </button>
          </div>
        </div>
        <div style="margin-top:16px; font-size:12px; color:#94a3b8;">PROGILIC CRM v3</div>
      </div>
    `;
  }
}

window.addEventListener('unhandledrejection', event => {
  console.error("Unhandled rejection:", event.reason);
  // Only show the visual screen if the app isn't already rendered or if it's a fatal startup error
  const app = document.getElementById('app');
  if (app && (!app.innerHTML || app.innerHTML.includes('Connecting to Secure Cloud Database'))) {
    showErrorScreen(event.reason, "خطأ مزامنة غير معالج");
  }
});

window.addEventListener('error', event => {
  console.error("Uncaught error:", event.error || event.message);
  const app = document.getElementById('app');
  if (app && (!app.innerHTML || app.innerHTML.includes('Connecting to Secure Cloud Database'))) {
    showErrorScreen(event.error || event.message, "خطأ تشغيل قاتل");
  }
});
import './firebase/config.js';
import * as actions from './business/actions.js';
import { R } from './presentation/render-core.js';
import { updateActTypeOpts, updateCommunesOpts } from './utils/index.js';
import { exportData, exportToCSV, importData, clearAllData } from './business/storage.js';
import { toggleLanguage } from './utils/i18n.js';

import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase/config.js';
import { S, setCurrentUser, setClients, subscribe } from './state/store.js';
import { loadDataFromFirestore, stopRealtimeSync, loadCache } from './business/storage.js';

// Subscribe render-core's R function to state changes for automatic reactivity
subscribe(R);

// Expose all actions and utils to the global window object for inline HTML event handlers
Object.assign(window, actions);
window.S = S;
window.updateActTypeOpts = updateActTypeOpts;
window.updateCommunesOpts = updateCommunesOpts;
window.exportData = exportData;
window.exportToCSV = exportToCSV;
window.importData = importData;
window.clearAllData = clearAllData;
window.toggleLanguage = toggleLanguage;
window.R = R;

// Boot application
function boot() {
  document.documentElement.dir = 'rtl';
  document.documentElement.lang = 'ar';
  actions.initDark();
  loadCache(); // Restore offline local cache immediately on startup
  const app = document.getElementById('app');

  // Register Global Keyboard Shortcuts
  window.addEventListener('keydown', (e) => {
    // Ctrl + K to focus search
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      const searchInput = document.getElementById('search-input');
      if (searchInput) {
        searchInput.focus();
      }
    }
    
    // Alt + N for New Client
    if (e.altKey && e.key === 'n') {
      e.preventDefault();
      actions.openModal('addClient');
    }

    // Esc to close modal or clear search
    if (e.key === 'Escape') {
      if (S.modal) {
        actions.closeModal();
      } else {
        const searchInput = document.getElementById('search-input');
        if (searchInput && document.activeElement === searchInput) {
          actions.onQ('');
          searchInput.blur();
        }
      }
    }
  });

  let lastUserUid = undefined;
  let lastUserEmail = undefined;
  let lastUserVerified = undefined;

  onAuthStateChanged(auth, async (user) => {
    const currentUid = user ? user.uid : null;
    const currentEmail = user ? user.email : null;
    const currentVerified = user ? user.emailVerified : null;

    // Memoize/deduplicate identical auth state callbacks to avoid redundant render loops
    // and multiple active Firestore listeners during rapid token/state triggers on startup.
    if (
      currentUid === lastUserUid &&
      currentEmail === lastUserEmail &&
      currentVerified === lastUserVerified
    ) {
      console.log("onAuthStateChanged: Redundant auth state update prevented via memoization");
      return;
    }

    lastUserUid = currentUid;
    lastUserEmail = currentEmail;
    lastUserVerified = currentVerified;

    if (user) {
      setCurrentUser({
        uid: user.uid,
        email: user.email,
        emailVerified: user.emailVerified,
      });
      
      if (app) {
        app.innerHTML = `
          <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100vh; font-family:sans-serif; background:var(--bg); color:var(--t1); transition: background 0.3s;">
            <style>
              @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
              @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }
            </style>
            <div class="auth-logo" style="width:100px; height:100px; margin-bottom:24px; animation: pulse 2s infinite ease-in-out;">
              <svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M 40 30 H 130 C 180 30 180 110 130 110 H 40 C 90 110 100 50 40 30 Z" fill="#1A73E8"/>
                <path d="M 40 110 C 90 110 100 170 60 190 L 40 140 C 60 130 60 120 40 110 Z" fill="#0D47A1"/>
              </svg>
            </div>
            <div style="font-size:18px; font-weight:700; margin-bottom:8px; letter-spacing: -0.5px;">Connecting to Secure Cloud Database...</div>
            <div style="font-size:13px; color:var(--t3); font-weight: 500;">PROGILIC Real-time Firestore Cloud CRM</div>
            <div style="width:32px; height:32px; border:3px solid var(--border); border-top-color:#1A73E8; border-radius:50%; animation:spin 0.8s linear infinite; margin-top:24px;"></div>
          </div>
        `;
      }
      
      console.log("Before loadDataFromFirestore"); await loadDataFromFirestore(user); console.log("After loadDataFromFirestore");
    } else {
      stopRealtimeSync();
      setCurrentUser(null);
      setClients([]);
    }
    R();
  });
}

boot();

// Passive, throttled scroll and resize listeners for high-performance list virtualization
let lastScrollY = 0;
let scrollTicking = false;

window.addEventListener('scroll', () => {
  lastScrollY = window.scrollY;
  if (!scrollTicking) {
    window.requestAnimationFrame(() => {
      if (S.view === 'list') {
        const threshold = 50; // pixels to cross before triggering a render
        if (Math.abs(lastScrollY - (S.virtualScrollTop || 0)) > threshold) {
          S.virtualScrollTop = lastScrollY;
        }
      }
      scrollTicking = false;
    });
    scrollTicking = true;
  }
}, { passive: true });

window.addEventListener('resize', () => {
  if (S.view === 'list') {
    S.viewportHeight = window.innerHeight;
  }
}, { passive: true });

// Reset scroll on navigation away from list
subscribe(() => {
  if (S.view !== 'list' && S.virtualScrollTop !== 0) {
    S.virtualScrollTop = 0;
  }
});
