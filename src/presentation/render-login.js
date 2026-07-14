window.loginMode = window.loginMode || 'login';

export function renderLogin() {
  const isLogin = true; // Always login now
  window.loginMode = 'login'; // Force login

  return `
  <div class="auth-wrapper">
    <div class="auth-card" style="direction: rtl;">
      <div class="auth-left">
        <div class="auth-header">
          <div class="auth-logo">
            <svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M 40 30 H 130 C 180 30 180 110 130 110 H 40 C 90 110 100 50 40 30 Z" fill="#1A73E8"/>
              <path d="M 40 110 C 90 110 100 170 60 190 L 40 140 C 60 130 60 120 40 110 Z" fill="#0D47A1"/>
            </svg>
          </div>
          <h1 class="auth-title">مرحباً بك في نظام Progilic</h1>
          <p class="auth-subtitle">هذا النظام خاص بموظفي الشركة فقط. الرجاء تسجيل الدخول للوصول إلى لوحة التحكم.</p>
        </div>

        <form class="auth-form" onsubmit="event.preventDefault(); loginUser(this.username.value, this.password.value)">
          <div class="auth-input-group">
            <input name="username" type="email" placeholder="البريد الإلكتروني للشركة" required autocomplete="username">
            <svg class="input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
          </div>
          <div class="auth-input-group">
            <input name="password" type="password" placeholder="كلمة المرور" required autocomplete="current-password">
            <svg class="input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
          </div>
          
          <div class="auth-options">
            <label class="auth-checkbox">
              <input type="checkbox" name="remember">
              <span class="checkmark"></span>
              تذكرني
            </label>
            <a href="#" class="auth-forgot" onclick="alert('الرجاء التواصل مع مدير النظام لإعادة تعيين كلمة المرور')">نسيت كلمة المرور؟</a>
          </div>

          <button type="submit" class="auth-btn">تسجيل الدخول</button>
        </form>

        <div class="auth-divider">
          <span>أو الدخول بواسطة</span>
        </div>

        <div class="auth-social">
          <button type="button" class="social-btn" onclick="loginWithGoogle()" title="Google Workspace الخاص بالشركة">
            <svg viewBox="0 0 24 24" width="20" height="20"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
          </button>
          <button type="button" class="social-btn" onclick="loginWithFacebook()" title="Facebook">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="#4267B2"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
          </button>
        </div>
        <p style="text-align:center; margin-top: 15px; font-size: 0.85rem; color: #666;">
          أو استخدم البريد الإلكتروني وكلمة المرور إذا لم يكن لديك حساب Google أو Facebook.
        </p>
      </div>
      
      <div class="auth-right">
        <div class="auth-bg-abstract"></div>
        <div class="auth-bg-wave"></div>
        <div class="auth-right-logo">
          <svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M 40 30 H 130 C 180 30 180 110 130 110 H 40 C 90 110 100 50 40 30 Z" fill="rgba(255,255,255,0.9)"/>
            <path d="M 40 110 C 90 110 100 170 60 190 L 40 140 C 60 130 60 120 40 110 Z" fill="rgba(255,255,255,0.6)"/>
          </svg>
          <div class="auth-right-brand">Progilic</div>
        </div>
      </div>
    </div>
  </div>`;
}
