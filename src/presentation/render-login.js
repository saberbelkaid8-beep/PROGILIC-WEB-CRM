import { auth, googleProvider, facebookProvider, appleProvider } from '../firebase/config.js';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  sendEmailVerification, 
  sendPasswordResetEmail, 
  updateProfile,
  signInWithPopup
} from 'firebase/auth';
import { setCurrentUser } from '../state/store.js';
import { R } from './render-core.js';
import { showToast } from '../utils/toast.js';
import { checkPasswordStrength, logout } from '../business/actions/authActions.js';
import { stopRealtimeSync } from '../business/storage.js';

window.loginMode = window.loginMode || 'login';

// Local Password Strength Checker
function getLocalPasswordStrength(p) {
  let score = 0;
  if (!p) return score;
  if (p.length >= 6) score++;
  if (/[A-Z]/.test(p)) score++;
  if (/[0-9]/.test(p)) score++;
  if (/[^A-Za-z0-9]/.test(p)) score++;
  return score;
}

// Global hook to update strength UI dynamically on input
window.updatePassStrengthUI = function(val) {
  const score = getLocalPasswordStrength(val);
  const bar = document.getElementById('pass-strength-bar');
  const text = document.getElementById('pass-strength-text');
  if (!bar || !text) return;
  
  bar.style.width = (score * 25) + '%';
  if (score === 0) {
    bar.style.backgroundColor = '#e0e0e0';
    text.innerText = 'قصيرة جداً';
    text.style.color = 'var(--t3)';
  } else if (score === 1) {
    bar.style.backgroundColor = '#ef4444';
    text.innerText = 'ضعيفة';
    text.style.color = '#ef4444';
  } else if (score === 2) {
    bar.style.backgroundColor = '#f59e0b';
    text.innerText = 'متوسطة';
    text.style.color = '#f59e0b';
  } else if (score === 3) {
    bar.style.backgroundColor = '#10b981';
    text.innerText = 'قوية';
    text.style.color = '#10b981';
  } else if (score === 4) {
    bar.style.backgroundColor = '#059669';
    text.innerText = 'قوية جداً';
    text.style.color = '#059669';
  }
};

export function renderLogin() {
  const mode = window.loginMode || 'login';
  
  // Custom styles for breathtakingly beautiful authentication experience
  const styleBlock = `
    <style>
      :root {
        --auth-primary: #1A73E8;
        --auth-primary-hover: #1557b0;
        --auth-bg: #f8fafc;
        --auth-card-bg: #ffffff;
        --auth-text: #1e293b;
        --auth-muted: #64748b;
        --auth-border: #e2e8f0;
      }
      
      .dark {
        --auth-bg: #0f172a;
        --auth-card-bg: #1e293b;
        --auth-text: #f8fafc;
        --auth-muted: #94a3b8;
        --auth-border: #334155;
      }

      .auth-wrapper {
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 100vh;
        background: var(--auth-bg);
        font-family: 'system-ui', -apple-system, sans-serif;
        padding: 1.5rem;
        transition: background 0.3s ease;
      }

      .auth-card {
        display: flex;
        width: 1000px;
        max-width: 100%;
        background: var(--auth-card-bg);
        border-radius: 1.25rem;
        box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.05);
        overflow: hidden;
        border: 1px solid var(--auth-border);
        transition: all 0.3s ease;
      }

      .auth-left {
        flex: 1.2;
        padding: 3rem;
        display: flex;
        flex-direction: column;
        justify-content: center;
      }

      .auth-right {
        flex: 0.8;
        background: linear-gradient(135deg, #1e3a8a 0%, #1e40af 100%);
        padding: 3rem;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        color: white;
        position: relative;
        text-align: center;
      }

      @media (max-width: 768px) {
        .auth-card {
          flex-direction: column;
        }
        .auth-right {
          display: none;
        }
        .auth-left {
          padding: 2rem;
        }
      }

      .auth-header {
        margin-bottom: 2rem;
      }

      .auth-logo {
        width: 60px;
        height: 60px;
        margin-bottom: 1.25rem;
      }

      .auth-title {
        font-size: 1.75rem;
        font-weight: 800;
        color: var(--auth-text);
        margin-bottom: 0.5rem;
        letter-spacing: -0.5px;
      }

      .auth-subtitle {
        font-size: 0.9rem;
        color: var(--auth-muted);
        line-height: 1.5;
      }

      /* Tabs Switcher */
      .auth-tabs {
        display: flex;
        border-bottom: 2px solid var(--auth-border);
        margin-bottom: 2rem;
        gap: 1.5rem;
      }

      .auth-tab {
        padding-bottom: 0.75rem;
        font-weight: 600;
        font-size: 0.95rem;
        color: var(--auth-muted);
        cursor: pointer;
        position: relative;
        background: none;
        border: none;
        transition: all 0.2s;
      }

      .auth-tab.active {
        color: var(--auth-primary);
      }

      .auth-tab.active::after {
        content: '';
        position: absolute;
        bottom: -2px;
        left: 0;
        right: 0;
        height: 2px;
        background: var(--auth-primary);
        border-radius: 2px;
      }

      .auth-form {
        display: flex;
        flex-direction: column;
        gap: 1.25rem;
      }

      .auth-input-group {
        position: relative;
        display: flex;
        align-items: center;
      }

      .auth-input-group input {
        width: 100%;
        padding: 0.875rem 1rem 0.875rem 2.75rem; /* left padding for icon */
        font-size: 0.95rem;
        border: 1px solid var(--auth-border);
        border-radius: 0.625rem;
        background: var(--auth-bg);
        color: var(--auth-text);
        outline: none;
        transition: all 0.2s ease;
      }

      /* RTL Mode */
      [dir="rtl"] .auth-input-group input {
        padding: 0.875rem 2.75rem 0.875rem 1rem; /* right padding for icon in RTL */
      }

      .auth-input-group input:focus {
        border-color: var(--auth-primary);
        box-shadow: 0 0 0 4px rgba(26, 115, 232, 0.15);
      }

      .input-icon {
        position: absolute;
        left: 1rem;
        width: 1.25rem;
        height: 1.25rem;
        color: var(--auth-muted);
        pointer-events: none;
        transition: color 0.2s;
      }

      [dir="rtl"] .input-icon {
        left: auto;
        right: 1rem;
      }

      .auth-input-group input:focus + .input-icon {
        color: var(--auth-primary);
      }

      .auth-options {
        display: flex;
        align-items: center;
        justify-content: space-between;
        font-size: 0.875rem;
      }

      .auth-checkbox {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        color: var(--auth-muted);
        cursor: pointer;
      }

      .auth-forgot {
        color: var(--auth-primary);
        font-weight: 600;
        text-decoration: none;
        transition: color 0.2s;
      }

      .auth-forgot:hover {
        color: var(--auth-primary-hover);
      }

      .auth-btn {
        background: var(--auth-primary);
        color: white;
        padding: 0.875rem 1.5rem;
        border-radius: 0.625rem;
        font-weight: 700;
        font-size: 1rem;
        border: none;
        cursor: pointer;
        transition: all 0.2s ease;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
        box-shadow: 0 4px 6px -1px rgba(26, 115, 232, 0.1), 0 2px 4px -1px rgba(26, 115, 232, 0.06);
      }

      .auth-btn:hover {
        background: var(--auth-primary-hover);
        transform: translateY(-1px);
        box-shadow: 0 10px 15px -3px rgba(26, 115, 232, 0.2), 0 4px 6px -2px rgba(26, 115, 232, 0.1);
      }

      .auth-btn:disabled {
        opacity: 0.7;
        cursor: not-allowed;
        transform: none !important;
        box-shadow: none !important;
      }

      .auth-divider {
        display: flex;
        align-items: center;
        text-align: center;
        margin: 1.75rem 0;
        color: var(--auth-muted);
        font-size: 0.825rem;
        font-weight: 500;
      }

      .auth-divider::before, .auth-divider::after {
        content: '';
        flex: 1;
        border-bottom: 1px solid var(--auth-border);
      }

      .auth-divider:not(:empty)::before {
        margin-left: .5em;
      }

      .auth-divider:not(:empty)::after {
        margin-right: .5em;
      }

      .auth-social {
        display: flex;
        gap: 1rem;
        justify-content: center;
      }

      .social-btn {
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.75rem;
        padding: 0.75rem 1rem;
        border: 1px solid var(--auth-border);
        border-radius: 0.625rem;
        background: var(--auth-card-bg);
        color: var(--auth-text);
        font-weight: 600;
        font-size: 0.9rem;
        cursor: pointer;
        transition: all 0.2s ease;
      }

      .social-btn:hover {
        background: var(--auth-bg);
        border-color: var(--auth-muted);
      }

      /* Password Strength Bar styling */
      .pass-strength-container {
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
        margin-top: -0.5rem;
      }

      .pass-strength-bg {
        height: 6px;
        background: var(--auth-border);
        border-radius: 3px;
        overflow: hidden;
      }

      .pass-strength-bar {
        height: 100%;
        width: 0%;
        background: #e0e0e0;
        border-radius: 3px;
        transition: all 0.3s ease;
      }

      .pass-strength-label {
        display: flex;
        justify-content: space-between;
        font-size: 0.75rem;
        font-weight: 600;
        color: var(--auth-muted);
      }

      /* Verification screen styling */
      .ver-icon-box {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 90px;
        height: 90px;
        border-radius: 50%;
        background: rgba(26, 115, 232, 0.1);
        color: var(--auth-primary);
        margin: 0 auto 1.5rem;
        animation: pulse-ver 2s infinite ease-in-out;
      }

      @keyframes pulse-ver {
        0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(26, 115, 232, 0.2); }
        50% { transform: scale(1.05); box-shadow: 0 0 0 12px rgba(26, 115, 232, 0); }
      }

      .ver-buttons-row {
        display: grid;
        grid-template-cols: 1fr;
        gap: 0.75rem;
        margin-top: 1.5rem;
      }

      /* Decorative Waves in Banner */
      .auth-bg-abstract {
        position: absolute;
        top: -10%;
        right: -10%;
        width: 300px;
        height: 300px;
        background: rgba(255, 255, 255, 0.05);
        border-radius: 50%;
        pointer-events: none;
      }

      .auth-right-logo {
        width: 90px;
        height: 90px;
        margin-bottom: 1.5rem;
        z-index: 2;
      }

      .auth-right-brand {
        font-size: 2.25rem;
        font-weight: 900;
        letter-spacing: -1px;
        margin-bottom: 0.5rem;
        z-index: 2;
      }

      .auth-right-desc {
        font-size: 0.95rem;
        opacity: 0.85;
        line-height: 1.6;
        max-width: 280px;
        z-index: 2;
      }
    </style>
  `;

  // Left Content rendering based on current screen mode
  let leftContentHTML = '';

  if (mode === 'login') {
    leftContentHTML = `
      <div class="auth-header">
        <h1 class="auth-title">تسجيل الدخول</h1>
        <p class="auth-subtitle">أهلاً بك مجدداً! يرجى إدخال بياناتك للوصول إلى لوحة التحكم.</p>
      </div>

      <div class="auth-tabs">
        <button class="auth-tab active" onclick="window.loginMode='login'; R()">تسجيل الدخول</button>
        <button class="auth-tab" onclick="window.loginMode='register'; R()">إنشاء حساب جديد</button>
      </div>

      <form class="auth-form" onsubmit="event.preventDefault(); loginUser(this.username.value, this.password.value)">
        <div class="auth-input-group">
          <input name="username" type="email" placeholder="البريد الإلكتروني للشركة" required autocomplete="username">
          <svg class="input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
        </div>
        
        <div class="auth-input-group">
          <input name="password" type="password" placeholder="كلمة المرور" required autocomplete="current-password">
          <svg class="input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
        </div>
        
        <div class="auth-options">
          <label class="auth-checkbox">
            <input type="checkbox" name="remember" checked>
            تذكرني
          </label>
          <a href="#" class="auth-forgot" onclick="event.preventDefault(); window.loginMode='forgot'; R()">نسيت كلمة المرور؟</a>
        </div>

        <button type="submit" class="auth-btn">تسجيل الدخول</button>
      </form>

      <div class="auth-divider">أو الدخول بواسطة</div>

      <div class="auth-social">
        <button type="button" class="social-btn" onclick="loginWithGoogle()" title="Google Workspace">
          <svg viewBox="0 0 24 24" width="20" height="20" class="me-2"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
          Google
        </button>
        <button type="button" class="social-btn" onclick="loginWithFacebook()" title="Facebook">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="#4267B2" class="me-2"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
          Facebook
        </button>
      </div>
    `;
  } else if (mode === 'register') {
    leftContentHTML = `
      <div class="auth-header">
        <h1 class="auth-title">إنشاء حساب جديد</h1>
        <p class="auth-subtitle">سجل بياناتك للانضمام إلى منصة PROGILIC CRM.</p>
      </div>

      <div class="auth-tabs">
        <button class="auth-tab" onclick="window.loginMode='login'; R()">تسجيل الدخول</button>
        <button class="auth-tab active" onclick="window.loginMode='register'; R()">إنشاء حساب جديد</button>
      </div>

      <form class="auth-form" onsubmit="event.preventDefault(); loginUser(this.username.value, this.password.value, this.fullname.value)">
        <div class="auth-input-group">
          <input name="fullname" type="text" placeholder="الاسم الكامل" required autocomplete="name">
          <svg class="input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
        </div>

        <div class="auth-input-group">
          <input name="username" type="email" placeholder="البريد الإلكتروني" required autocomplete="email">
          <svg class="input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
        </div>
        
        <div class="auth-input-group">
          <input name="password" type="password" placeholder="كلمة المرور" required autocomplete="new-password" oninput="updatePassStrengthUI(this.value)">
          <svg class="input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
        </div>

        <div class="pass-strength-container">
          <div class="pass-strength-bg">
            <div id="pass-strength-bar" class="pass-strength-bar"></div>
          </div>
          <div class="pass-strength-label">
            <span>قوة كلمة المرور:</span>
            <span id="pass-strength-text">قصيرة جداً</span>
          </div>
        </div>

        <button type="submit" class="auth-btn" style="margin-top: 0.5rem;">إنشاء الحساب وتفعيل البريد</button>
      </form>

      <div class="auth-divider">أو التسجيل بواسطة</div>

      <div class="auth-social">
        <button type="button" class="social-btn" onclick="loginWithGoogle()" title="Google Workspace">
          <svg viewBox="0 0 24 24" width="20" height="20" class="me-2"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
          Google
        </button>
        <button type="button" class="social-btn" onclick="loginWithFacebook()" title="Facebook">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="#4267B2" class="me-2"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
          Facebook
        </button>
      </div>
    `;
  } else if (mode === 'forgot') {
    leftContentHTML = `
      <div class="auth-header">
        <h1 class="auth-title">إعادة تعيين كلمة المرور</h1>
        <p class="auth-subtitle">أدخل بريدك الإلكتروني المسجل وسنقوم بإرسال رابط فوري لإعادة تعيين كلمة المرور الخاصة بك.</p>
      </div>

      <form class="auth-form" onsubmit="event.preventDefault(); sendPasswordReset(this.username.value)">
        <div class="auth-input-group">
          <input name="username" type="email" placeholder="البريد الإلكتروني" required autocomplete="email">
          <svg class="input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
        </div>

        <button type="submit" class="auth-btn" style="margin-top: 0.5rem;">إرسال رابط إعادة التعيين</button>
        
        <div style="text-align: center; margin-top: 1rem;">
          <a href="#" class="auth-forgot" onclick="event.preventDefault(); window.loginMode='login'; R()">العودة لصفحة تسجيل الدخول</a>
        </div>
      </form>
    `;
  } else if (mode === 'resetPassword') {
    leftContentHTML = `
      <div class="auth-header">
        <h1 class="auth-title">تعيين كلمة المرور الجديدة</h1>
        <p class="auth-subtitle">يرجى تعيين كلمة مرور قوية وجديدة لحسابك المسجل: <strong style="color:var(--auth-primary)">${window.resetEmail || ''}</strong></p>
      </div>

      <form class="auth-form" onsubmit="event.preventDefault(); if (this.password.value !== this.confirmPassword.value) { showToast('كلمتا المرور غير متطابقتين.', 'error'); return; }; confirmNewPassword(this.password.value)">
        <div class="auth-input-group">
          <input name="password" type="password" placeholder="كلمة المرور الجديدة" required autocomplete="new-password" oninput="updatePassStrengthUI(this.value)">
          <svg class="input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
        </div>

        <div class="pass-strength-container">
          <div class="pass-strength-bg">
            <div id="pass-strength-bar" class="pass-strength-bar"></div>
          </div>
          <div class="pass-strength-label">
            <span>قوة كلمة المرور:</span>
            <span id="pass-strength-text">قصيرة جداً</span>
          </div>
        </div>

        <div class="auth-input-group">
          <input name="confirmPassword" type="password" placeholder="تأكيد كلمة المرور الجديدة" required autocomplete="new-password">
          <svg class="input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
        </div>

        <button type="submit" class="auth-btn" style="margin-top: 0.5rem;">حفظ كلمة المرور الجديدة</button>
        
        <div style="text-align: center; margin-top: 1rem;">
          <a href="#" class="auth-forgot" onclick="event.preventDefault(); window.loginMode='login'; R()">إلغاء والعودة للدخول</a>
        </div>
      </form>
    `;
  } else if (mode === 'verificationPending') {
    leftContentHTML = `
      <div style="text-align: center;">
        <div class="ver-icon-box">
          <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
        </div>
        
        <h1 class="auth-title">تفعيل الحساب مطلوب</h1>
        <p class="auth-subtitle" style="margin-bottom: 1.5rem;">
          لقد أرسلنا رابط تفعيل إلى البريد الإلكتروني:<br>
          <strong style="color: var(--auth-primary); word-break: break-all;">${auth.currentUser ? auth.currentUser.email : ''}</strong>
        </p>
        
        <p class="auth-subtitle" style="background: var(--auth-bg); padding: 1rem; border-radius: 0.5rem; border: 1px solid var(--auth-border); font-size: 0.85rem; margin-bottom: 2rem; text-align: right; line-height: 1.6;">
          💡 <strong>التعليمات:</strong><br>
          1. افتح علبة الوارد لبريدك الإلكتروني واضغط على الرابط المرسل لتفعيل حسابك.<br>
          2. إذا تم التفعيل بنجاح، انقر على زر <strong>"التحقق من حالة التفعيل"</strong> بالأسفل.<br>
          3. إذا لم تصلك الرسالة بعد بضع دقائق، تفقّد مجلد "الرسائل غير المرغوب فيها (Spam)" أو اضغط على <strong>"إعادة إرسال رابط التفعيل"</strong>.
        </p>

        <div style="display: flex; flex-direction: column; gap: 0.75rem;">
          <button id="check-ver-btn" class="auth-btn" onclick="checkVerificationStatus()">
            ⚡ التحقق من حالة التفعيل والدخول
          </button>
          
          <div style="display: grid; grid-template-cols: 1fr 1fr; gap: 0.75rem;">
            <button id="resend-ver-btn" class="social-btn" onclick="resendVerificationEmail()">
              ✉️ إعادة إرسال الرابط
            </button>
            <button class="social-btn" style="color: #ef4444; border-color: rgba(239, 68, 68, 0.3);" onclick="logout(true)">
              🚪 تسجيل الخروج
            </button>
          </div>
        </div>
      </div>
    `;
  }

  return `
    ${styleBlock}
    <div class="auth-wrapper">
      <div class="auth-card" style="direction: rtl;">
        <div class="auth-left">
          ${leftContentHTML}
        </div>
        
        <div class="auth-right">
          <div class="auth-bg-abstract"></div>
          <div class="auth-right-logo">
            <svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M 40 30 H 130 C 180 30 180 110 130 110 H 40 C 90 110 100 50 40 30 Z" fill="rgba(255,255,255,0.95)"/>
              <path d="M 40 110 C 90 110 100 170 60 190 L 40 140 C 60 130 60 120 40 110 Z" fill="rgba(255,255,255,0.6)"/>
            </svg>
          </div>
          <div class="auth-right-brand">PROGILIC</div>
          <p class="auth-right-desc">لوحة التحكم والمتابعة الذكية وإدارة علاقات العملاء في بيئة سحابية فائقة الأداء وعالية الأمان.</p>
        </div>
      </div>
    </div>
  `;
}

// Expose authentication functions globally, ensuring proper scoping with the local 'auth' object
window.loginUser = async function(username, password, fullname = '') {
  const email = username.trim().toLowerCase();
  if (!email || !password.trim()) {
    showToast("يرجى إدخال البريد الإلكتروني وكلمة المرور.", 'error');
    return;
  }
  
  stopRealtimeSync();

  const btn = document.querySelector('.auth-btn');
  const originalText = btn ? btn.innerText : '';
  if (btn) {
    btn.disabled = true;
    btn.innerText = window.loginMode === 'register' ? 'جاري إنشاء الحساب...' : 'جاري تسجيل الدخول...';
  }

  if (window.loginMode === 'register') {
    const strength = checkPasswordStrength(password);
    if (strength.score < 2) {
      showToast("يرجى استخدام كلمة مرور أقوى (متوسطة على الأقل).", 'error');
      if (btn) {
        btn.disabled = false;
        btn.innerText = originalText;
      }
      return;
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      try {
        await updateProfile(user, {
          displayName: fullname.trim() || email.split('@')[0]
        });
        console.log("User profile displayName updated successfully.");
      } catch (err) {
        console.error("Error updating profile displayName:", err);
      }

      try {
        await sendEmailVerification(user);
        showToast("تم إنشاء الحساب بنجاح وإرسال بريد تفعيل الحساب!", "success");
      } catch (err) {
        console.error("Error sending verification email:", err);
        showToast("تم إنشاء الحساب ولكن فشل إرسال بريد التفعيل: " + err.message, "warning");
      }

      setCurrentUser({
        uid: user.uid,
        email: user.email,
        emailVerified: false,
      });
      window.loginMode = 'verificationPending';
      R();
    } catch (error) {
      console.error("Registration error:", error);
      let errorMsg = "حدث خطأ أثناء إنشاء حسابك.";
      if (error.code === 'auth/email-already-in-use') {
        errorMsg = "البريد الإلكتروني مستخدم بالفعل. يرجى تسجيل الدخول.";
      } else if (error.code === 'auth/invalid-email') {
        errorMsg = "البريد الإلكتروني غير صحيح.";
      } else if (error.code === 'auth/weak-password') {
        errorMsg = "كلمة المرور ضعيفة للغاية.";
      }
      showToast(errorMsg, 'error');
      if (btn) {
        btn.disabled = false;
        btn.innerText = originalText;
      }
    }
  } else {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      const isVerified = user.emailVerified || user.providerData.some(p => p.providerId === 'google.com' || p.providerId === 'facebook.com');
      
      if (!isVerified) {
        showToast("يرجى تفعيل بريدك الإلكتروني أولاً للوصول إلى النظام.", "warning");
        setCurrentUser({
          uid: user.uid,
          email: user.email,
          emailVerified: false,
        });
        window.loginMode = 'verificationPending';
        R();
        return;
      }

      showToast("تم تسجيل الدخول بنجاح!", "success");
      setCurrentUser({
        uid: user.uid,
        email: user.email,
        emailVerified: true,
      });
      window.loginMode = 'main';
      const { loadDataFromFirestore } = await import('../business/storage.js');
      await loadDataFromFirestore(user);
      R();
    } catch (error) {
      console.error("Login error:", error);
      let errorMsg = "البريد الإلكتروني أو كلمة المرور غير صحيحة.";
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
        errorMsg = "البريد الإلكتروني أو كلمة المرور غير صحيحة.";
      } else if (error.code === 'auth/invalid-email') {
        errorMsg = "صيغة البريد الإلكتروني غير صحيحة.";
      }
      showToast(errorMsg, 'error');
      if (btn) {
        btn.disabled = false;
        btn.innerText = originalText;
      }
    }
  }
};

window.sendPasswordReset = async function(email) {
  const btn = document.querySelector('.auth-btn');
  const originalText = btn ? btn.innerText : '';
  if (btn) {
    btn.disabled = true;
    btn.innerText = 'جاري إرسال رابط إعادة التعيين...';
  }
  try {
    const cleanEmail = email.trim().toLowerCase();
    await sendPasswordResetEmail(auth, cleanEmail);
    showToast("تم إرسال بريد إعادة تعيين كلمة المرور بنجاح. يرجى مراجعة بريدك الوارد.", "success");
    window.loginMode = 'login';
    R();
  } catch (err) {
    console.error("Send password reset error:", err);
    let errMsg = "فشل إرسال بريد إعادة التعيين.";
    if (err.code === 'auth/user-not-found') {
      errMsg = "لا يوجد حساب مسجل بهذا البريد الإلكتروني.";
    } else if (err.code === 'auth/invalid-email') {
      errMsg = "البريد الإلكتروني غير صحيح.";
    }
    showToast(errMsg, "error");
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerText = originalText;
    }
  }
};

window.resendVerificationEmail = async function() {
  const btn = document.getElementById('resend-ver-btn');
  const originalText = btn ? btn.innerText : '';
  if (btn) {
    btn.disabled = true;
    btn.innerText = 'جاري الإرسال...';
  }
  try {
    if (auth.currentUser) {
      await sendEmailVerification(auth.currentUser);
      showToast("تم إعادة إرسال رابط التفعيل بنجاح. يرجى تفقّد بريدك الإلكتروني.", "success");
    } else {
      showToast("لم نتمكن من العثور على حسابك الحالي.", "error");
    }
  } catch (err) {
    console.error("Error resending verification email:", err);
    let errMsg = "فشل إرسال البريد: " + err.message;
    if (err.code === 'auth/too-many-requests') {
      errMsg = "تم إرسال عدد كبير من طلبات التفعيل مؤخراً. يرجى الانتظار دقيقة قبل المحاولة مرة أخرى.";
    }
    showToast(errMsg, "error");
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerText = originalText;
    }
  }
};

window.checkVerificationStatus = async function() {
  const btn = document.getElementById('check-ver-btn');
  const originalText = btn ? btn.innerText : '';
  if (btn) {
    btn.disabled = true;
    btn.innerText = 'جاري التحقق...';
  }
  try {
    if (auth.currentUser) {
      await auth.currentUser.reload();
      const user = auth.currentUser;
      const isVerified = user.emailVerified || user.providerData.some(p => p.providerId === 'google.com' || p.providerId === 'facebook.com');
      
      setCurrentUser({
        uid: user.uid,
        email: user.email,
        emailVerified: isVerified,
      });

      if (isVerified) {
        showToast("تم تفعيل حسابك بنجاح! جاري تحميل البيانات...", "success");
        try {
          await user.getIdToken(true);
        } catch (tokErr) {
          console.warn("Failed to force refresh ID token during verification check:", tokErr);
        }
        const { loadDataFromFirestore } = await import('../business/storage.js');
        await loadDataFromFirestore(user);
        window.loginMode = 'main';
        R();
      } else {
        showToast("لم يتم تفعيل البريد الإلكتروني بعد. يرجى فتح الرسالة المرسلة وتأكيد حسابك.", "info");
      }
    }
  } catch (err) {
    console.error("Error checking verification status:", err);
    showToast("فشل التحقق: " + err.message, "error");
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerText = originalText;
    }
  }
};

window.loginWithGoogle = async function() {
  const btn = document.querySelector('.auth-btn');
  const originalText = btn ? btn.innerText : '';
  if (btn) {
    btn.disabled = true;
    btn.innerText = 'Redirecting to Google...';
  }
  try {
    stopRealtimeSync();
    await signInWithPopup(auth, googleProvider);
  } catch (error) {
    if (error.code === 'auth/popup-closed-by-user') {
      showToast("تم إلغاء عملية الدخول بواسطة المستخدم.", "warning");
    } else {
      showToast("فشل تسجيل الدخول باستخدام Google: " + error.message, "error");
    }
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerText = originalText;
    }
  }
};

window.loginWithFacebook = async function() {
  try {
    stopRealtimeSync();
    await signInWithPopup(auth, facebookProvider);
  } catch (error) {
    if (error.code === 'auth/popup-closed-by-user') {
      showToast("تم إلغاء عملية الدخول بواسطة المستخدم.", "warning");
    } else {
      showToast("فشل تسجيل الدخول باستخدام Facebook: " + error.message, "error");
    }
  }
};

window.loginWithApple = async function() {
  try {
    stopRealtimeSync();
    await signInWithPopup(auth, appleProvider);
  } catch (error) {
    if (error.code === 'auth/popup-closed-by-user') {
      showToast("تم إلغاء عملية الدخول بواسطة المستخدم.", "warning");
    } else {
      showToast("فشل تسجيل الدخول باستخدام Apple: " + error.message, "error");
    }
  }
};

window.logout = logout;
