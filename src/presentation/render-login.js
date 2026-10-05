import { auth, googleProvider, facebookProvider, appleProvider } from '../firebase/config.js';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  sendEmailVerification, 
  sendPasswordResetEmail, 
  updateProfile,
  signInWithPopup
} from 'firebase/auth';
import { setCurrentUser, S } from '../state/store.js';
import { R } from './render-core.js';
import { showToast } from '../utils/toast.js';
import { checkPasswordStrength, logout } from '../business/actions/authActions.js';
import { stopRealtimeSync, loadDataFromFirestore } from '../business/storage.js';
import { t, setLanguage } from '../utils/i18n.js';

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

window.updatePassStrengthUI = function(val) {
  const score = getLocalPasswordStrength(val);
  const bar = document.getElementById('pass-strength-bar');
  const text = document.getElementById('pass-strength-text');
  if (!bar || !text) return;
  
  bar.style.width = (score * 25) + '%';
  if (score === 0) {
    bar.style.backgroundColor = '#e0e0e0';
    text.innerText = t('قصيرة جداً');
    text.style.color = '#94a3b8';
  } else if (score === 1) {
    bar.style.backgroundColor = '#ef4444';
    text.innerText = t('ضعيفة');
    text.style.color = '#ef4444';
  } else if (score === 2) {
    bar.style.backgroundColor = '#f59e0b';
    text.innerText = t('متوسطة');
    text.style.color = '#f59e0b';
  } else if (score === 3) {
    bar.style.backgroundColor = '#10b981';
    text.innerText = t('قوية');
    text.style.color = '#10b981';
  } else if (score === 4) {
    bar.style.backgroundColor = '#059669';
    text.innerText = t('قوية جداً');
    text.style.color = '#059669';
  }
};

window.togglePasswordVisibility = function(inputId, iconId) {
  const input = document.getElementById(inputId);
  const icon = document.getElementById(iconId);
  if (!input) return;
  if (input.type === 'password') {
    input.type = 'text';
    if (icon) {
      icon.innerHTML = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;
    }
  } else {
    input.type = 'password';
    if (icon) {
      icon.innerHTML = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>`;
    }
  }
};

/**
 * Returns the exact 3D Folded Ribbon "P" Emblem from the reference design.
 */
function renderProgilicLogoSVG(size = 145) {
  return `
    <svg class="progilic-p-logo" width="${size}" height="${size * 0.95}" viewBox="0 0 180 170" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <!-- Top Cyan/Sky Blue Loop Gradient -->
        <linearGradient id="pTopGrad" x1="40" y1="26" x2="160" y2="36" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#0066ff"/>
          <stop offset="60%" stop-color="#0095ff"/>
          <stop offset="100%" stop-color="#38bdf8"/>
        </linearGradient>

        <!-- Right Loop Return Curve Gradient -->
        <linearGradient id="pLoopGrad" x1="165" y1="35" x2="80" y2="105" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#0090ff"/>
          <stop offset="45%" stop-color="#0058ff"/>
          <stop offset="100%" stop-color="#0040e0"/>
        </linearGradient>

        <!-- Stem & Lower Ribbon Fold Gradient -->
        <linearGradient id="pStemGrad" x1="48" y1="50" x2="88" y2="160" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#0058ff"/>
          <stop offset="50%" stop-color="#0048e0"/>
          <stop offset="100%" stop-color="#0035b8"/>
        </linearGradient>

        <!-- Inner Ribbon Fold Crease Gradient -->
        <linearGradient id="pFoldGrad" x1="68" y1="70" x2="108" y2="115" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#002b9e"/>
          <stop offset="60%" stop-color="#0042d0"/>
          <stop offset="100%" stop-color="#0060ff"/>
        </linearGradient>

        <!-- 3D Soft Drop Shadow -->
        <filter id="pLogoShadow" x="-15%" y="-15%" width="130%" height="130%">
          <feDropShadow dx="0" dy="8" stdDeviation="10" flood-color="#0044cc" flood-opacity="0.22"/>
        </filter>
      </defs>

      <g filter="url(#pLogoShadow)">
        <!-- 1. Horizontal Loop returning under (back layer) -->
        <path d="M48 26 L124 26 C152 26 168 44 168 68 C168 92 150 106 122 106 L74 106 L88 82 L118 82 C134 82 144 76 144 68 C144 60 134 52 118 52 L62 52 Z" fill="url(#pLoopGrad)"/>
        
        <!-- 2. Top bar highlight (front layer) -->
        <path d="M48 26 L124 26 C148 26 165 40 168 58 L144 58 C139 48 130 44 118 44 L58 44 L48 26 Z" fill="url(#pTopGrad)"/>

        <!-- 3. Vertical Stem ribbon with bottom angled notch -->
        <path d="M54 52 L88 52 L88 120 L62 158 L62 86 L54 74 Z" fill="url(#pStemGrad)"/>

        <!-- 4. Inner Origami Fold Shadow -->
        <path d="M62 86 L88 82 L88 120 L62 158 Z" fill="url(#pFoldGrad)"/>
      </g>
    </svg>
  `;
}

export function renderLogin() {
  const mode = window.loginMode || 'login';
  const curLang = S.lang || 'fr';
  const isRTL = curLang === 'ar';

  const STRINGS = {
    fr: {
      brandTagline: 'Solutions de gestion commerciale\net institutionnelle',
      brandSubtitle: 'Plus qu’un logiciel ... un partenaire pour votre croissance',
      featureSales: 'Gestion\ncommerciale',
      featureStock: 'Stocks &\nInventaire',
      featureClients: 'Clients &\nFournisseurs',
      featureEnterprise: 'Entreprises &\nEmployés',
      brandKickerLeft: 'P R O G I L I C   •   E R P   •   P O S',
      welcomeTitle: 'Bienvenue',
      welcomeSubtitle: 'Connectez-vous à votre compte pour accéder\nà votre espace PROGILIC.',
      userPlaceholder: "Nom d'utilisateur ou Email",
      passPlaceholder: 'Mot de passe',
      rememberMe: 'Se souvenir de moi',
      forgotPass: 'Mot de passe oublié ?',
      loginBtn: 'Se connecter',
      orContinue: 'OU CONTINUER AVEC',
      kickerBottom: 'J O U E Z   •   C O M P É T E Z   •   É V O L U E Z   E N S E M B L E',
      createAccount: 'Créer un compte',
      haveAccount: 'Déjà un compte ? Se connecter',
      noAccount: "Pas encore de compte ? S'inscrire",
      fullName: 'Nom complet',
      confirmPass: 'Confirmer le mot de passe',
      passStrength: 'Force du mot de passe :',
      registerBtn: 'Créer le compte',
      resetTitle: 'Réinitialiser le mot de passe',
      resetSubtitle: 'Entrez votre adresse email pour recevoir un lien de réinitialisation.',
      sendResetBtn: 'Envoyer le lien',
      backToLogin: 'Retour à la connexion',
      verifTitle: 'Activation du compte requise',
      verifSubtitle: 'Un lien de confirmation a été envoyé à :',
      verifCheckBtn: '⚡ Vérifier le statut',
      verifResendBtn: '✉️ Renvoyer le lien',
      logoutBtn: '🚪 Se déconnecter',
      savePassBtn: 'Enregistrer le nouveau mot de passe'
    },
    en: {
      brandTagline: 'Commercial & Institutional\nManagement Solutions',
      brandSubtitle: 'More than software ... a partner for your growth',
      featureSales: 'Commercial\nManagement',
      featureStock: 'Stocks &\nInventory',
      featureClients: 'Clients &\nSuppliers',
      featureEnterprise: 'Enterprises &\nEmployees',
      brandKickerLeft: 'P R O G I L I C   •   E R P   •   P O S',
      welcomeTitle: 'Welcome',
      welcomeSubtitle: 'Sign in to your account to access\nyour PROGILIC workspace.',
      userPlaceholder: 'Username or Email',
      passPlaceholder: 'Password',
      rememberMe: 'Remember me',
      forgotPass: 'Forgot password?',
      loginBtn: 'Sign In',
      orContinue: 'OR CONTINUE WITH',
      kickerBottom: 'P L A Y   •   C O M P E T E   •   G R O W   T O G E T H E R',
      createAccount: 'Create Account',
      haveAccount: 'Already have an account? Sign in',
      noAccount: "Don't have an account? Sign up",
      fullName: 'Full Name',
      confirmPass: 'Confirm Password',
      passStrength: 'Password Strength:',
      registerBtn: 'Create Account',
      resetTitle: 'Reset Password',
      resetSubtitle: 'Enter your email address to receive a password reset link.',
      sendResetBtn: 'Send Reset Link',
      backToLogin: 'Back to Login',
      verifTitle: 'Account Activation Required',
      verifSubtitle: 'A confirmation link has been sent to:',
      verifCheckBtn: '⚡ Check Status',
      verifResendBtn: '✉️ Resend Link',
      logoutBtn: '🚪 Sign Out',
      savePassBtn: 'Save New Password'
    },
    ar: {
      brandTagline: 'حلول الإدارة التجارية\nوالمؤسساتية المتكاملة',
      brandSubtitle: 'أكثر من مجرد برنامج ... شريك حقيقي لنمو أعمالك',
      featureSales: 'الإدارة\nالتجارية',
      featureStock: 'المخزون\nوالسلع',
      featureClients: 'العملاء\nوالموردون',
      featureEnterprise: 'المؤسسات\nوالموظفون',
      brandKickerLeft: 'P R O G I L I C   •   E R P   •   P O S',
      welcomeTitle: 'مرحباً بك',
      welcomeSubtitle: 'سجل الدخول إلى حسابك للوصول\nإلى مساحة عمل PROGILIC الخاصة بك.',
      userPlaceholder: 'اسم المستخدم أو البريد الإلكتروني',
      passPlaceholder: 'كلمة المرور',
      rememberMe: 'تذكرني',
      forgotPass: 'نسيت كلمة المرور؟',
      loginBtn: 'تسجيل الدخول',
      orContinue: 'أو المتابعة بواسطة',
      kickerBottom: 'إدارة   •   تحليل ذكي   •   نمو مستمر',
      createAccount: 'إنشاء حساب جديد',
      haveAccount: 'لديك حساب بالفعل؟ تسجيل الدخول',
      noAccount: 'ليس لديك حساب؟ إنشاء حساب جديد',
      fullName: 'الاسم الكامل',
      confirmPass: 'تأكيد كلمة المرور',
      passStrength: 'قوة كلمة المرور:',
      registerBtn: 'إنشاء الحساب',
      resetTitle: 'استعادة كلمة المرور',
      resetSubtitle: 'أدخل بريدك الإلكتروني لتلقي رابط فوري لإعادة تعيين كلمة المرور.',
      sendResetBtn: 'إرسال الرابط',
      backToLogin: 'العودة لتسجيل الدخول',
      verifTitle: 'تفعيل الحساب مطلوب',
      verifSubtitle: 'لقد تم إرسال رابط التفعيل إلى بريدك الإلكتروني:',
      verifCheckBtn: '⚡ التحقق من التفعيل والدخول',
      verifResendBtn: '✉️ إعادة إرسال الرابط',
      logoutBtn: '🚪 تسجيل الخروج',
      savePassBtn: 'حفظ كلمة المرور الجديدة'
    }
  };

  const L = STRINGS[curLang] || STRINGS.fr;

  const styles = `
    <style>
      :root {
        --prog-bg: #eef3fb;
        --prog-surface: #ffffff;
        --prog-card-border: rgba(255, 255, 255, 0.95);
        --prog-card-shadow: 0 35px 80px rgba(160, 185, 225, 0.42), 0 10px 25px rgba(160, 185, 225, 0.2);
        --prog-input-bg: #f0f4f9;
        --prog-input-border: #e2e8f0;
        --prog-primary: #1e60f2;
        --prog-btn-grad: linear-gradient(90deg, #0076ff 0%, #1e5ef7 52%, #154ae6 100%);
        --prog-btn-shadow: 0 14px 30px rgba(27, 91, 246, 0.45);
        --prog-text-title: #0f172a;
        --prog-text-sub: #64748b;
        --prog-text-muted: #94a3b8;
        --prog-icon-box-bg: #ebf3fd;
      }

      .dark {
        --prog-bg: #0b1324;
        --prog-surface: #131f38;
        --prog-card-border: rgba(255, 255, 255, 0.08);
        --prog-card-shadow: 0 35px 80px rgba(0, 0, 0, 0.55), 0 10px 25px rgba(0, 0, 0, 0.3);
        --prog-input-bg: #1a294a;
        --prog-input-border: rgba(255, 255, 255, 0.08);
        --prog-primary: #3b82f6;
        --prog-btn-grad: linear-gradient(90deg, #2563eb 0%, #1d4ed8 100%);
        --prog-btn-shadow: 0 14px 30px rgba(37, 99, 235, 0.45);
        --prog-text-title: #f8fafc;
        --prog-text-sub: #94a3b8;
        --prog-text-muted: #64748b;
        --prog-icon-box-bg: #1c2e56;
      }

      * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
      }

      .progilic-login-page {
        position: relative;
        min-height: 100vh;
        width: 100%;
        background-color: var(--prog-bg);
        background-image: 
          radial-gradient(circle at 10% 20%, rgba(255, 255, 255, 0.9) 0%, transparent 40%),
          radial-gradient(circle at 90% 80%, rgba(210, 230, 255, 0.6) 0%, transparent 50%);
        font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
        color: var(--prog-text-title);
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        overflow-x: hidden;
        padding: 1.5rem 1.5rem;
        transition: background 0.3s ease;
      }

      /* Crisp Layered Curved Blue Corner Artwork */
      .prog-wave-top-right {
        position: fixed;
        top: 0;
        right: 0;
        width: 38vw;
        height: 38vw;
        min-width: 280px;
        min-height: 280px;
        max-width: 480px;
        max-height: 480px;
        pointer-events: none;
        z-index: 0;
        overflow: hidden;
      }

      .prog-wave-bottom-left {
        position: fixed;
        bottom: 0;
        left: 0;
        width: 38vw;
        height: 38vw;
        min-width: 280px;
        min-height: 280px;
        max-width: 480px;
        max-height: 480px;
        pointer-events: none;
        z-index: 0;
        overflow: hidden;
      }

      /* Top Utility Controls */
      .prog-top-bar {
        position: absolute;
        top: 1.25rem;
        right: 1.5rem;
        display: flex;
        align-items: center;
        z-index: 50;
        gap: 10px;
      }
      [dir="rtl"] .prog-top-bar {
        right: auto;
        left: 1.5rem;
      }

      .prog-lang-picker {
        display: inline-flex;
        background: rgba(255, 255, 255, 0.85);
        border: 1px solid rgba(226, 232, 240, 0.9);
        border-radius: 12px;
        padding: 3px;
        backdrop-filter: blur(8px);
        box-shadow: 0 4px 12px rgba(180, 205, 235, 0.25);
      }
      .dark .prog-lang-picker {
        background: rgba(19, 31, 56, 0.85);
        border-color: rgba(255, 255, 255, 0.08);
      }

      .prog-lang-btn {
        padding: 4px 10px;
        font-size: 11px;
        font-weight: 700;
        border-radius: 8px;
        border: none;
        cursor: pointer;
        background: transparent;
        color: var(--prog-text-sub);
        transition: all 0.2s ease;
      }
      .prog-lang-btn.active {
        background: var(--prog-primary);
        color: #ffffff;
      }

      .prog-theme-btn {
        width: 36px;
        height: 36px;
        border-radius: 12px;
        background: rgba(255, 255, 255, 0.85);
        border: 1px solid rgba(226, 232, 240, 0.9);
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        font-size: 15px;
        color: var(--prog-text-title);
        backdrop-filter: blur(8px);
        box-shadow: 0 4px 12px rgba(180, 205, 235, 0.25);
        transition: transform 0.2s ease;
      }
      .dark .prog-theme-btn {
        background: rgba(19, 31, 56, 0.85);
        border-color: rgba(255, 255, 255, 0.08);
      }
      .prog-theme-btn:hover {
        transform: translateY(-1px);
      }

      /* Main 2-Column Grid exactly matching reference layout */
      .prog-main-container {
        display: flex;
        align-items: center;
        justify-content: space-between;
        width: 100%;
        max-width: 1240px;
        margin: auto;
        gap: 3.5rem;
        z-index: 10;
        position: relative;
        padding: 1rem 0;
      }

      /* Left Brand Hero Showcase */
      .prog-left-hero {
        flex: 1.1;
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
        padding: 0.5rem 0;
      }

      .prog-brand-title {
        font-size: 40px;
        font-weight: 800;
        color: #0058ff;
        letter-spacing: -0.5px;
        margin-top: 14px;
        margin-bottom: 12px;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }

      .prog-hero-tagline {
        font-size: 18.5px;
        font-weight: 600;
        color: #4a5b74;
        line-height: 1.4;
        max-width: 440px;
        margin-bottom: 8px;
        white-space: pre-line;
      }
      .dark .prog-hero-tagline {
        color: #cbd5e1;
      }

      .prog-hero-sub {
        font-size: 13.5px;
        font-weight: 400;
        color: #8c9bb0;
        margin-bottom: 2.25rem;
      }
      .dark .prog-hero-sub {
        color: #94a3b8;
      }

      /* 4 Feature Cards Row */
      .prog-features-row {
        display: flex;
        align-items: flex-start;
        justify-content: center;
        gap: 1.5rem;
        margin-bottom: 2.75rem;
        width: 100%;
      }

      .prog-feature-card {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 10px;
        width: 100px;
      }

      .prog-feature-icon-box {
        width: 52px;
        height: 52px;
        border-radius: 16px;
        background: var(--prog-icon-box-bg);
        display: flex;
        align-items: center;
        justify-content: center;
        color: #1e60f2;
        box-shadow: 0 4px 12px rgba(190, 215, 245, 0.35);
        transition: transform 0.25s ease, box-shadow 0.25s ease;
      }
      .prog-feature-card:hover .prog-feature-icon-box {
        transform: translateY(-3px);
        box-shadow: 0 8px 18px rgba(30, 96, 242, 0.3);
      }

      .prog-feature-text {
        font-size: 11.5px;
        font-weight: 600;
        color: #475569;
        line-height: 1.35;
        text-align: center;
        white-space: pre-line;
      }
      .dark .prog-feature-text {
        color: #cbd5e1;
      }

      .prog-left-kicker {
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 4px;
        color: #94a3b8;
        text-transform: uppercase;
      }

      /* Right Column: Master Login Card */
      .prog-right-wrapper {
        flex: 0.95;
        display: flex;
        justify-content: flex-end;
      }
      [dir="rtl"] .prog-right-wrapper {
        justify-content: flex-start;
      }

      .prog-card {
        width: 470px;
        max-width: 100%;
        background: var(--prog-surface);
        border: 1px solid var(--prog-card-border);
        border-radius: 36px;
        padding: 2.75rem 2.5rem 2.25rem;
        box-shadow: var(--prog-card-shadow);
        display: flex;
        flex-direction: column;
        position: relative;
        z-index: 15;
        transition: all 0.3s ease;
      }

      .prog-card-header {
        text-align: center;
        width: 100%;
        margin-bottom: 1.5rem;
      }

      .prog-card-title {
        font-size: 26px;
        font-weight: 800;
        color: var(--prog-text-title);
        letter-spacing: -0.5px;
        margin-bottom: 6px;
        text-align: center;
      }

      .prog-card-sub {
        font-size: 13.5px;
        font-weight: 400;
        color: var(--prog-text-sub);
        line-height: 1.5;
        text-align: center;
        white-space: pre-line;
        max-width: 380px;
        margin: 0 auto;
      }

      /* Form & Input Styles */
      .prog-form {
        display: flex;
        flex-direction: column;
        gap: 1.1rem;
      }

      .prog-input-wrap {
        position: relative;
        display: flex;
        align-items: center;
        width: 100%;
      }

      .prog-input {
        width: 100%;
        height: 52px;
        border-radius: 16px;
        background: var(--prog-input-bg);
        border: 1.5px solid transparent;
        padding-left: 3.25rem;
        padding-right: 1.25rem;
        font-size: 14px;
        font-weight: 500;
        color: var(--prog-text-title);
        outline: none;
        transition: all 0.2s ease;
      }
      [dir="rtl"] .prog-input {
        padding-left: 1.25rem;
        padding-right: 3.25rem;
      }

      /* Password input with icon on left AND eye on right in LTR (and vice versa in RTL) */
      .prog-input-pass {
        padding-left: 3.25rem !important;
        padding-right: 3.25rem !important;
      }

      .prog-input::placeholder {
        color: #8a9bb2;
        font-weight: 400;
      }

      .prog-input:focus {
        background: #ffffff;
        border-color: #1e60f2;
        box-shadow: 0 0 0 3.5px rgba(30, 96, 242, 0.15);
      }
      .dark .prog-input:focus {
        background: #1e293b;
      }

      .prog-input-icon {
        position: absolute;
        left: 1.15rem;
        width: 20px;
        height: 20px;
        color: #7b8ea6;
        display: flex;
        align-items: center;
        justify-content: center;
        pointer-events: none;
        transition: color 0.2s;
        z-index: 2;
      }
      [dir="rtl"] .prog-input-icon {
        left: auto;
        right: 1.15rem;
      }

      .prog-input:focus ~ .prog-input-icon {
        color: #1e60f2;
      }

      .prog-eye-toggle {
        position: absolute;
        right: 1.15rem;
        width: 24px;
        height: 24px;
        color: #7b8ea6;
        background: none;
        border: none;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: color 0.2s;
        z-index: 3;
      }
      [dir="rtl"] .prog-eye-toggle {
        right: auto;
        left: 1.15rem;
      }
      .prog-eye-toggle:hover {
        color: var(--prog-text-title);
      }

      /* Options Row: Remember Me & Forgot Password */
      .prog-options-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        font-size: 13px;
        margin-top: -0.15rem;
        margin-bottom: 0.25rem;
      }

      .prog-checkbox-label {
        display: flex;
        align-items: center;
        gap: 8px;
        color: var(--prog-text-title);
        font-weight: 500;
        cursor: pointer;
        user-select: none;
      }

      .prog-checkbox-box {
        width: 18px;
        height: 18px;
        border-radius: 5px;
        background: #1e60f2;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #ffffff;
        font-size: 12px;
        font-weight: 800;
      }

      .prog-forgot-link {
        color: #1e60f2;
        font-weight: 600;
        text-decoration: none;
        font-size: 13px;
        transition: opacity 0.2s;
      }
      .prog-forgot-link:hover {
        opacity: 0.82;
      }

      /* Primary Pill Button */
      .prog-submit-btn {
        width: 100%;
        height: 52px;
        border-radius: 26px;
        background: var(--prog-btn-grad);
        box-shadow: var(--prog-btn-shadow);
        border: none;
        color: #ffffff;
        font-size: 15.5px;
        font-weight: 700;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        position: relative;
        transition: all 0.25s ease;
        margin-top: 0.35rem;
      }
      .prog-submit-btn:hover {
        transform: translateY(-2px);
        box-shadow: 0 16px 32px rgba(27, 91, 246, 0.52);
      }
      .prog-submit-btn:active {
        transform: translateY(0);
      }

      .prog-btn-circle-arrow {
        position: absolute;
        right: 14px;
        width: 32px;
        height: 32px;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.22);
        display: flex;
        align-items: center;
        justify-content: center;
        color: #ffffff;
        transition: transform 0.2s;
      }
      [dir="rtl"] .prog-btn-circle-arrow {
        right: auto;
        left: 14px;
        transform: rotate(180deg);
      }
      .prog-submit-btn:hover .prog-btn-circle-arrow {
        transform: translateX(3px);
      }
      [dir="rtl"] .prog-submit-btn:hover .prog-btn-circle-arrow {
        transform: rotate(180deg) translateX(3px);
      }

      /* Divider: OU CONTINUER AVEC */
      .prog-divider {
        display: flex;
        align-items: center;
        text-align: center;
        margin: 1.5rem 0 1.25rem;
        color: #94a3b8;
        font-size: 10.5px;
        font-weight: 700;
        letter-spacing: 2px;
        text-transform: uppercase;
      }
      [dir="rtl"] .prog-divider {
        letter-spacing: normal !important;
        font-size: 11.5px;
      }

      .prog-divider::before, .prog-divider::after {
        content: '';
        flex: 1;
        border-bottom: 1px solid #e2e8f0;
      }
      .dark .prog-divider::before, .dark .prog-divider::after {
        border-bottom-color: rgba(255, 255, 255, 0.08);
      }
      .prog-divider:not(:empty)::before {
        margin-right: 1.15rem;
      }
      [dir="rtl"] .prog-divider:not(:empty)::before {
        margin-right: 0;
        margin-left: 1.15rem;
      }
      .prog-divider:not(:empty)::after {
        margin-left: 1.15rem;
      }
      [dir="rtl"] .prog-divider:not(:empty)::after {
        margin-left: 0;
        margin-right: 1.15rem;
      }

      /* 3 Social Buttons Row */
      .prog-social-row {
        display: flex;
        justify-content: center;
        gap: 1.25rem;
        margin-bottom: 1.75rem;
      }

      .prog-social-btn {
        width: 58px;
        height: 58px;
        border-radius: 18px;
        background: #ffffff;
        border: 1px solid rgba(226, 232, 240, 0.85);
        box-shadow: 0 6px 16px rgba(185, 205, 235, 0.35), inset 0 1px 2px #fff;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: all 0.25s ease;
      }
      .dark .prog-social-btn {
        background: #1c2b4a;
        border-color: rgba(255, 255, 255, 0.08);
        box-shadow: 0 6px 16px rgba(0, 0, 0, 0.4), inset 0 1px 2px rgba(255, 255, 255, 0.06);
      }
      .prog-social-btn:hover {
        transform: translateY(-3px);
        box-shadow: 0 10px 22px rgba(180, 205, 240, 0.5);
      }

      .prog-card-kicker-bottom {
        text-align: center;
        font-size: 9.5px;
        font-weight: 700;
        letter-spacing: 2px;
        color: #94a3b8;
        text-transform: uppercase;
      }
      [dir="rtl"] .prog-card-kicker-bottom {
        letter-spacing: normal !important;
        font-size: 11px;
      }

      /* Mobile Specific Layout */
      @media (max-width: 991px) {
        .progilic-login-page {
          padding: 1.25rem 1rem 2rem;
          justify-content: center;
          align-items: center;
        }

        .prog-left-hero {
          display: none;
        }

        .prog-main-container {
          justify-content: center;
          margin: 0;
          padding: 0.5rem 0;
        }

        .prog-right-wrapper {
          width: 100%;
          justify-content: center;
        }

        .prog-card {
          width: 100%;
          max-width: 440px;
          padding: 2.25rem 1.75rem 1.75rem;
          border-radius: 30px;
        }

        .prog-mobile-header {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          margin-bottom: 1.25rem;
          width: 100%;
        }
      }

      @media (min-width: 992px) {
        .prog-mobile-header {
          display: none;
        }
      }

      @media (max-width: 420px) {
        .progilic-login-page {
          padding: 0.75rem 0.75rem 1.5rem;
        }
        .prog-card {
          padding: 1.75rem 1.15rem 1.5rem;
          border-radius: 24px;
        }
        .prog-card-title {
          font-size: 22px;
        }
        .prog-card-sub {
          font-size: 13px;
        }
        .prog-input {
          height: 48px;
          font-size: 13.5px;
        }
        .prog-submit-btn {
          height: 48px;
          font-size: 15px;
        }
      }
    </style>
  `;

  const topBarHTML = `
    <div class="prog-top-bar" style="direction: ${isRTL ? 'rtl' : 'ltr'};">
      <div class="prog-lang-picker">
        <button type="button" class="prog-lang-btn ${curLang === 'fr' ? 'active' : ''}" onclick="setLanguage('fr')">FR</button>
        <button type="button" class="prog-lang-btn ${curLang === 'en' ? 'active' : ''}" onclick="setLanguage('en')">EN</button>
        <button type="button" class="prog-lang-btn ${curLang === 'ar' ? 'active' : ''}" onclick="setLanguage('ar')">عربي</button>
      </div>

      <button type="button" class="prog-theme-btn" onclick="toggleDark()" title="${t('الوضع الليلي')}">
        🌙
      </button>
    </div>
  `;

  const leftHeroHTML = `
    <div class="prog-left-hero">
      <!-- 3D Progilic Ribbon P Emblem -->
      ${renderProgilicLogoSVG(145)}

      <div class="prog-brand-title">Progilic</div>

      <h2 class="prog-hero-tagline">${L.brandTagline}</h2>
      <p class="prog-hero-sub">${L.brandSubtitle}</p>

      <!-- 4 Squircle Feature Cards -->
      <div class="prog-features-row">
        <!-- 1. Gestion commerciale -->
        <div class="prog-feature-card">
          <div class="prog-feature-icon-box">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="20" x2="18" y2="10"/>
              <line x1="12" y1="20" x2="12" y2="4"/>
              <line x1="6" y1="20" x2="6" y2="14"/>
            </svg>
          </div>
          <span class="prog-feature-text">${L.featureSales}</span>
        </div>

        <!-- 2. Stocks & Inventaire -->
        <div class="prog-feature-card">
          <div class="prog-feature-icon-box">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
              <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
              <line x1="12" y1="22.08" x2="12" y2="12"/>
            </svg>
          </div>
          <span class="prog-feature-text">${L.featureStock}</span>
        </div>

        <!-- 3. Clients & Fournisseurs -->
        <div class="prog-feature-card">
          <div class="prog-feature-icon-box">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
          </div>
          <span class="prog-feature-text">${L.featureClients}</span>
        </div>

        <!-- 4. Entreprises & Employés -->
        <div class="prog-feature-card">
          <div class="prog-feature-icon-box">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="4" y="2" width="16" height="20" rx="2" ry="2"/>
              <path d="M9 22v-4h6v4"/>
              <line x1="8" y1="6" x2="8.01" y2="6"/><line x1="16" y1="6" x2="16.01" y2="6"/>
              <line x1="12" y1="6" x2="12.01" y2="6"/><line x1="8" y1="10" x2="8.01" y2="10"/>
              <line x1="16" y1="10" x2="16.01" y2="10"/><line x1="12" y1="10" x2="12.01" y2="10"/>
              <line x1="8" y1="14" x2="8.01" y2="14"/><line x1="16" y1="14" x2="16.01" y2="14"/>
            </svg>
          </div>
          <span class="prog-feature-text">${L.featureEnterprise}</span>
        </div>
      </div>

      <!-- Left Bottom Kicker -->
      <div class="prog-left-kicker">${L.brandKickerLeft}</div>
    </div>
  `;

  let cardContentHTML = '';

  if (mode === 'login') {
    cardContentHTML = `
      <!-- Mobile Logo Header -->
      <div class="prog-mobile-header">
        ${renderProgilicLogoSVG(105)}
        <div class="prog-brand-title" style="font-size:32px; margin-top:6px; margin-bottom:4px;">Progilic</div>
      </div>

      <div class="prog-card-header">
        <h1 class="prog-card-title">${L.welcomeTitle}</h1>
        <p class="prog-card-sub">${L.welcomeSubtitle}</p>
      </div>

      <form class="prog-form" onsubmit="event.preventDefault(); loginUser(this.username.value, this.password.value)">
        <!-- Username/Email Input -->
        <div class="prog-input-wrap">
          <input 
            type="email" 
            name="username" 
            class="prog-input" 
            placeholder="${L.userPlaceholder}" 
            required 
            autocomplete="username"
          >
          <div class="prog-input-icon">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
              <circle cx="12" cy="7" r="4"></circle>
            </svg>
          </div>
        </div>

        <!-- Password Input -->
        <div class="prog-input-wrap">
          <input 
            id="prog-login-pass"
            type="password" 
            name="password" 
            class="prog-input prog-input-pass" 
            placeholder="${L.passPlaceholder}" 
            required 
            autocomplete="current-password"
          >
          <div class="prog-input-icon">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>
          </div>
          <button 
            type="button" 
            id="prog-login-eye-btn" 
            class="prog-eye-toggle" 
            onclick="togglePasswordVisibility('prog-login-pass', 'prog-login-eye-btn')" 
            title="Toggle password visibility"
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
              <line x1="1" y1="1" x2="23" y2="23"></line>
            </svg>
          </button>
        </div>

        <!-- Options: Remember Me & Forgot Password -->
        <div class="prog-options-row">
          <label class="prog-checkbox-label">
            <div class="prog-checkbox-box">✓</div>
            <input type="checkbox" name="remember" checked style="display:none;">
            <span>${L.rememberMe}</span>
          </label>
          <a href="#" class="prog-forgot-link" onclick="event.preventDefault(); window.loginMode='forgot'; R()">
            ${L.forgotPass}
          </a>
        </div>

        <!-- Vibrant Blue Pill Submit Button -->
        <button type="submit" class="prog-submit-btn auth-btn">
          <span>${L.loginBtn}</span>
          <div class="prog-btn-circle-arrow">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <line x1="5" y1="12" x2="19" y2="12"></line>
              <polyline points="12 5 19 12 12 19"></polyline>
            </svg>
          </div>
        </button>

        <div style="text-align:center; margin-top:0.25rem;">
          <a href="#" class="prog-forgot-link" style="font-size:12px; color:var(--prog-text-sub);" onclick="event.preventDefault(); window.loginMode='register'; R()">
            ${L.noAccount}
          </a>
        </div>
      </form>

      <!-- Divider: OU CONTINUER AVEC -->
      <div class="prog-divider">${L.orContinue}</div>

      <!-- 3 Squircle Social Buttons (Google, Discord, Facebook) -->
      <div class="prog-social-row">
        <!-- Google -->
        <button type="button" class="prog-social-btn" onclick="loginWithGoogle()" title="Google">
          <svg viewBox="0 0 24 24" width="22" height="22">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
        </button>

        <!-- Discord -->
        <button type="button" class="prog-social-btn" onclick="loginWithDiscord()" title="Discord">
          <svg viewBox="0 0 24 24" width="24" height="24" fill="#5865F2">
            <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.929 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.894.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
          </svg>
        </button>

        <!-- Facebook -->
        <button type="button" class="prog-social-btn" onclick="loginWithFacebook()" title="Facebook">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="#1877F2">
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
          </svg>
        </button>
      </div>

      <!-- Kicker Tagline at bottom of card -->
      <div class="prog-card-kicker-bottom">
        ${L.kickerBottom}
      </div>
    `;
  } else if (mode === 'register') {
    cardContentHTML = `
      <div class="prog-card-header">
        <h1 class="prog-card-title">${L.createAccount}</h1>
        <p class="prog-card-sub">${t('سجل بياناتك للانضمام إلى منصة PROGILIC CRM.')}</p>
      </div>

      <form class="prog-form" onsubmit="event.preventDefault(); loginUser(this.username.value, this.password.value, this.fullname.value)">
        <!-- Full Name -->
        <div class="prog-input-wrap">
          <input type="text" name="fullname" class="prog-input" placeholder="${L.fullName}" required autocomplete="name">
          <div class="prog-input-icon">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
          </div>
        </div>

        <!-- Email -->
        <div class="prog-input-wrap">
          <input type="email" name="username" class="prog-input" placeholder="${L.userPlaceholder}" required autocomplete="email">
          <div class="prog-input-icon">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
          </div>
        </div>

        <!-- Password -->
        <div class="prog-input-wrap">
          <input id="prog-reg-pass" type="password" name="password" class="prog-input prog-input-pass" placeholder="${L.passPlaceholder}" required autocomplete="new-password" oninput="updatePassStrengthUI(this.value)">
          <div class="prog-input-icon">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
          </div>
          <button type="button" id="prog-reg-eye-btn" class="prog-eye-toggle" onclick="togglePasswordVisibility('prog-reg-pass', 'prog-reg-eye-btn')">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
          </button>
        </div>

        <!-- Password Strength Meter -->
        <div style="display:flex; flex-direction:column; gap:4px; margin-top:-4px;">
          <div style="height:5px; background:rgba(180, 205, 235, 0.35); border-radius:3px; overflow:hidden;">
            <div id="pass-strength-bar" style="height:100%; width:0%; background:#e0e0e0; transition:all 0.3s;"></div>
          </div>
          <div style="display:flex; justify-content:space-between; font-size:11px; font-weight:600; color:var(--prog-text-sub);">
            <span>${L.passStrength}</span>
            <span id="pass-strength-text">${t('قصيرة جداً')}</span>
          </div>
        </div>

        <button type="submit" class="prog-submit-btn auth-btn">
          <span>${L.registerBtn}</span>
          <div class="prog-btn-circle-arrow">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
          </div>
        </button>

        <div style="text-align:center; margin-top:0.5rem;">
          <a href="#" class="prog-forgot-link" style="font-size:13px;" onclick="event.preventDefault(); window.loginMode='login'; R()">
            ${L.haveAccount}
          </a>
        </div>
      </form>
    `;
  } else if (mode === 'forgot') {
    cardContentHTML = `
      <div class="prog-card-header">
        <h1 class="prog-card-title">${L.resetTitle}</h1>
        <p class="prog-card-sub">${L.resetSubtitle}</p>
      </div>

      <form class="prog-form" onsubmit="event.preventDefault(); sendPasswordReset(this.username.value)">
        <div class="prog-input-wrap">
          <input type="email" name="username" class="prog-input" placeholder="${L.userPlaceholder}" required autocomplete="email">
          <div class="prog-input-icon">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
          </div>
        </div>

        <button type="submit" class="prog-submit-btn auth-btn">
          <span>${L.sendResetBtn}</span>
          <div class="prog-btn-circle-arrow">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
          </div>
        </button>

        <div style="text-align:center; margin-top:0.75rem;">
          <a href="#" class="prog-forgot-link" style="font-size:13px;" onclick="event.preventDefault(); window.loginMode='login'; R()">
            ${L.backToLogin}
          </a>
        </div>
      </form>
    `;
  } else if (mode === 'verificationPending') {
    cardContentHTML = `
      <div class="prog-card-header" style="text-align:center;">
        <div style="width:70px; height:70px; border-radius:50%; background:rgba(30, 96, 242, 0.1); color:#1e60f2; display:flex; align-items:center; justify-content:center; margin:0 auto 1.25rem;">
          <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
        </div>
        <h1 class="prog-card-title">${L.verifTitle}</h1>
        <p class="prog-card-sub">${L.verifSubtitle}<br><strong style="color:#1e60f2; word-break:break-all;">${auth.currentUser ? auth.currentUser.email : ''}</strong></p>
      </div>

      <div style="display:flex; flex-direction:column; gap:0.75rem;">
        <button id="check-ver-btn" class="prog-submit-btn" onclick="checkVerificationStatus()">
          <span>${L.verifCheckBtn}</span>
        </button>
        <div style="display:flex; gap:0.75rem; margin-top:0.5rem;">
          <button id="resend-ver-btn" class="prog-social-btn" style="flex:1; width:auto; height:46px; border-radius:14px; font-size:13px; font-weight:700; color:var(--prog-text-title);" onclick="resendVerificationEmail()">
            ${L.verifResendBtn}
          </button>
          <button class="prog-social-btn" style="flex:1; width:auto; height:46px; border-radius:14px; font-size:13px; font-weight:700; color:#ef4444; border-color:rgba(239,68,68,0.25);" onclick="logout(true)">
            ${L.logoutBtn}
          </button>
        </div>
      </div>
    `;
  } else if (mode === 'resetPassword') {
    cardContentHTML = `
      <div class="prog-card-header">
        <h1 class="prog-card-title">${t('تعيين كلمة المرور الجديدة')}</h1>
        <p class="prog-card-sub">${t('يرجى إدخال كلمة مرور جديدة لحسابك.')}</p>
      </div>

      <form class="prog-form" onsubmit="event.preventDefault(); if (this.password.value !== this.confirmPassword.value) { showToast(t('كلمتا المرور غير متطابقتين.'), 'error'); return; }; confirmNewPassword(this.password.value)">
        <div class="prog-input-wrap">
          <input id="prog-reset-pass" type="password" name="password" class="prog-input prog-input-pass" placeholder="${t('كلمة المرور الجديدة')}" required autocomplete="new-password" oninput="updatePassStrengthUI(this.value)">
          <div class="prog-input-icon">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
          </div>
          <button type="button" id="prog-reset-eye" class="prog-eye-toggle" onclick="togglePasswordVisibility('prog-reset-pass', 'prog-reset-eye')">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
          </button>
        </div>

        <div class="prog-input-wrap">
          <input type="password" name="confirmPassword" class="prog-input" placeholder="${L.confirmPass}" required autocomplete="new-password">
          <div class="prog-input-icon">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
          </div>
        </div>

        <button type="submit" class="prog-submit-btn auth-btn">
          <span>${L.savePassBtn}</span>
        </button>

        <div style="text-align:center; margin-top:0.75rem;">
          <a href="#" class="prog-forgot-link" style="font-size:13px;" onclick="event.preventDefault(); window.loginMode='login'; R()">
            ${L.backToLogin}
          </a>
        </div>
      </form>
    `;
  }

  return `
    ${styles}
    <div class="progilic-login-page" style="direction: ${isRTL ? 'rtl' : 'ltr'};">
      <!-- Top-Right Smooth Curved Layered Wave -->
      <svg class="prog-wave-top-right" viewBox="0 0 500 500" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMaxYMin meet">
        <path d="M500 0 C450 150, 320 220, 200 180 C80 140, 20 80, 0 0 L500 0 Z" fill="#93c5fd" opacity="0.3"/>
        <path d="M500 0 C420 180, 300 240, 160 210 C40 180, 0 120, 0 0 L500 0 Z" fill="#60a5fa" opacity="0.45"/>
        <path d="M500 0 C400 220, 280 280, 120 240 C30 210, 0 160, 0 0 L500 0 Z" fill="#2563eb" opacity="0.85"/>
        <path d="M500 0 C440 140, 350 190, 250 160 C180 140, 140 80, 100 0 L500 0 Z" fill="#1d4ed8" opacity="0.6"/>
      </svg>

      <!-- Bottom-Left Smooth Curved Layered Wave -->
      <svg class="prog-wave-bottom-left" viewBox="0 0 500 500" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMinYMax meet">
        <path d="M0 500 C150 450, 220 320, 180 200 C140 80, 80 20, 0 0 L0 500 Z" fill="#93c5fd" opacity="0.3"/>
        <path d="M0 500 C180 420, 240 300, 210 160 C180 40, 120 0, 0 0 L0 500 Z" fill="#60a5fa" opacity="0.45"/>
        <path d="M0 500 C220 400, 280 280, 240 120 C210 30, 160 0, 0 0 L0 500 Z" fill="#2563eb" opacity="0.85"/>
        <path d="M0 500 C140 440, 190 350, 160 250 C140 180, 80 140, 0 100 L0 500 Z" fill="#1d4ed8" opacity="0.6"/>
      </svg>

      <!-- Top Utility Controls (Pinned to top corner) -->
      ${topBarHTML}

      <!-- Main Layout: 2 Columns on Desktop, Centered on Mobile -->
      <main class="prog-main-container">
        ${leftHeroHTML}

        <div class="prog-right-wrapper">
          <div class="prog-card">
            ${cardContentHTML}
          </div>
        </div>
      </main>
    </div>
  `;
}

// Authentication Global Bindings
window.loginUser = async function(username, password, fullname = '') {
  const email = username.trim().toLowerCase();
  if (!email || !password.trim()) {
    showToast(t("يرجى إدخال البريد الإلكتروني وكلمة المرور."), 'error');
    return;
  }
  
  stopRealtimeSync();

  const btn = document.querySelector('.auth-btn');
  const originalText = btn ? btn.innerText : '';
  if (btn) {
    btn.disabled = true;
    btn.innerText = window.loginMode === 'register' ? t('جاري إنشاء الحساب...') : t('جاري تسجيل الدخول...');
  }

  if (window.loginMode === 'register') {
    const strength = checkPasswordStrength(password);
    if (strength.score < 2) {
      showToast(t("يرجى استخدام كلمة مرور أقوى (متوسطة على الأقل)."), 'error');
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
        showToast(t("تم إنشاء الحساب بنجاح وإرسال بريد تفعيل الحساب!"), "success");
      } catch (err) {
        console.error("Error sending verification email:", err);
        showToast(t("تم إنشاء الحساب ولكن فشل إرسال بريد التفعيل: ") + err.message, "warning");
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
      let errorMsg = t("حدث خطأ أثناء إنشاء حسابك.");
      if (error.code === 'auth/email-already-in-use') {
        errorMsg = t("البريد الإلكتروني مستخدم بالفعل. يرجى تسجيل الدخول.");
      } else if (error.code === 'auth/invalid-email') {
        errorMsg = t("البريد الإلكتروني غير صحيح.");
      } else if (error.code === 'auth/weak-password') {
        errorMsg = t("كلمة المرور ضعيفة للغاية.");
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
        showToast(t("يرجى تفعيل بريدك الإلكتروني أولاً للوصول إلى النظام."), "warning");
        setCurrentUser({
          uid: user.uid,
          email: user.email,
          emailVerified: false,
        });
        window.loginMode = 'verificationPending';
        R();
        return;
      }

      showToast(t("تم تسجيل الدخول بنجاح!"), "success");
      setCurrentUser({
        uid: user.uid,
        email: user.email,
        emailVerified: true,
      });
      window.loginMode = 'main';
      await loadDataFromFirestore(user);
      R();
    } catch (error) {
      console.error("Login error:", error);
      let errorMsg = t("البريد الإلكتروني أو كلمة المرور غير صحيحة.");
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
        errorMsg = t("البريد الإلكتروني أو كلمة المرور غير صحيحة.");
      } else if (error.code === 'auth/invalid-email') {
        errorMsg = t("صيغة البريد الإلكتروني غير صحيحة.");
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
    btn.innerText = t('جاري إرسال رابط إعادة التعيين...');
  }
  try {
    const cleanEmail = email.trim().toLowerCase();
    await sendPasswordResetEmail(auth, cleanEmail);
    showToast(t("تم إرسال بريد إعادة تعيين كلمة المرور بنجاح. يرجى مراجعة بريدك الوارد."), "success");
    window.loginMode = 'login';
    R();
  } catch (err) {
    console.error("Send password reset error:", err);
    let errMsg = t("فشل إرسال بريد إعادة التعيين.");
    if (err.code === 'auth/user-not-found') {
      errMsg = t("لا يوجد حساب مسجل بهذا البريد الإلكتروني.");
    } else if (err.code === 'auth/invalid-email') {
      errMsg = t("البريد الإلكتروني غير صحيح.");
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
    btn.innerText = t('جاري الإرسال...');
  }
  try {
    if (auth.currentUser) {
      await sendEmailVerification(auth.currentUser);
      showToast(t("تم إعادة إرسال رابط التفعيل بنجاح. يرجى تفقّد بريدك الإلكتروني."), "success");
    } else {
      showToast(t("لم نتمكن من العثور على حسابك الحالي."), "error");
    }
  } catch (err) {
    console.error("Error resending verification email:", err);
    let errMsg = err.message;
    if (err.code === 'auth/too-many-requests') {
      errMsg = t("تم إرسال عدد كبير من طلبات التفعيل مؤخراً. يرجى الانتظار دقيقة قبل المحاولة مرة أخرى.");
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
    btn.innerText = t('جاري التحقق...');
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
        showToast(t("تم تفعيل حسابك بنجاح! جاري تحميل البيانات..."), "success");
        try {
          await user.getIdToken();
        } catch (tokErr) {
          console.warn("Failed to refresh ID token during verification check:", tokErr);
        }
        await loadDataFromFirestore(user);
        window.loginMode = 'main';
        R();
      } else {
        showToast(t("لم يتم تفعيل البريد الإلكتروني بعد. يرجى فتح الرسالة المرسلة وتأكيد حسابك."), "info");
      }
    }
  } catch (err) {
    console.error("Error checking verification status:", err);
    showToast(err.message, "error");
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
    btn.innerText = 'Google...';
  }
  try {
    stopRealtimeSync();
    await signInWithPopup(auth, googleProvider);
  } catch (error) {
    console.error('Error during Google login:', error);
    if (error.code === 'auth/popup-closed-by-user' || error.code === 'auth/cancelled-popup-request') {
      showToast(t("تم إلغاء عملية الدخول بواسطة المستخدم."), "warning");
    } else if (error.code === 'auth/network-request-failed') {
      showToast(t("تعذر الاتصال بخوادم تسجيل الدخول. يرجى التحقق من اتصال الإنترنت وإعادة المحاولة."), "error");
    } else if (error.code === 'auth/popup-blocked') {
      showToast(t("تم حظر النافذة المنبثقة من قِبل المتصفح. يرجى السماح بالنوافذ المنبثقة."), "warning");
    } else if (error.code === 'auth/unauthorized-domain') {
      showToast(t("النطاق الحالي غير مصرح له بتسجيل الدخول عبر Google."), "error");
    } else {
      showToast(t("فشل تسجيل الدخول باستخدام Google: ") + (error.message || error.code), "error");
    }
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerText = originalText;
    }
  }
};

window.loginWithDiscord = async function() {
  showToast(t("تسجيل الدخول عبر Discord غير متوفر حالياً على هذا النطاق."), "info");
};

window.loginWithFacebook = async function() {
  try {
    stopRealtimeSync();
    await signInWithPopup(auth, facebookProvider);
  } catch (error) {
    if (error.code === 'auth/popup-closed-by-user') {
      showToast(t("تم إلغاء عملية الدخول بواسطة المستخدم."), "warning");
    } else {
      showToast(t("فشل تسجيل الدخول باستخدام Facebook: ") + error.message, "error");
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
