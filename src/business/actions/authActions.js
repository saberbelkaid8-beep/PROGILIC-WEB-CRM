import { S, clients, setClients, updateState, currentUser, setCurrentUser } from '../../state/store.js';
import { persist, loadClientSubcollectionsIfNeeded, enqueueSyncAction } from '../storage.js';
import { R } from '../../presentation/render-core.js';
import { logActivity, ActivityType, getTimeline } from '../timelineService.js';
import { getBackups, deleteBackup } from '../idbStorage.js';
import { createSnapshotBackup, restoreFromBackup, downloadBackupJSON } from '../backupService.js';
import { auth, googleProvider, facebookProvider, appleProvider } from '../../firebase/config.js';
import { signInWithPopup, signOut, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail, sendEmailVerification, updateProfile } from 'firebase/auth';
import { gv, gc2, gc, gn, td } from '../../utils/index.js';
import { autoDetectFeatureOpp, computeScore } from '../intelligence.js';
import { showToast } from '../../utils/toast.js';
import { showConfirm, showPrompt } from '../../utils/confirm.js';
import { 
  addClientTransaction, 
  updateClientTransaction, 
  deleteClientTransaction, 
  saveClientSubItemTransaction, 
  deleteClientSubItemTransaction 
} from '../../firebase/service.js';



export function checkPasswordStrength(password) {
  let score = 0;
  if (!password) return { score: 0, text: '', color: 'transparent', width: '0%' };
  if (password.length >= 8) score++;
  if (password.match(/[a-zA-Z]/)) score++;
  if (password.match(/\d/)) score++;
  if (password.match(/[^a-zA-Z\d]/)) score++;
  
  if (score <= 1) return { score, text: 'ضعيفة', color: '#ff4d4f', width: '25%' };
  if (score === 2) return { score, text: 'متوسطة', color: '#faad14', width: '50%' };
  if (score === 3) return { score, text: 'جيدة', color: '#52c41a', width: '75%' };
  return { score, text: 'قوية جداً', color: '#13c2c2', width: '100%' };
}

export function updatePasswordStrength(val) {
  const res = checkPasswordStrength(val);
  const bar = document.getElementById('pwd-strength-bar');
  const txt = document.getElementById('pwd-strength-text');
  if(bar) {
    bar.style.width = res.width;
    bar.style.backgroundColor = res.color;
  }
  if(txt) {
    txt.innerText = res.text;
    txt.style.color = res.color;
  }
}

export function loginUser(username, password, fullname = '') {
  const email = username.trim().toLowerCase();
  if (!email || !password.trim()) {
    showToast("Please enter both email and password.", 'error');
    return;
  }
  
  const btn = document.querySelector('.auth-btn');
  const originalText = btn ? btn.innerText : '';
  if (btn) {
    btn.disabled = true;
    btn.innerText = window.loginMode === 'register' ? 'Registering account...' : 'Logging in...';
  }

  if (window.loginMode === 'register') {
    const strength = checkPasswordStrength(password);
    if (strength.score < 2) {
      showToast("Please use a stronger password (at least medium).", 'error');
      if (btn) {
        btn.disabled = false;
        btn.innerText = originalText;
      }
      return;
    }

    createUserWithEmailAndPassword(auth, email, password)
      .then((userCredential) => {
        const user = userCredential.user;
        updateProfile(user, {
          displayName: fullname.trim() || email.split('@')[0]
        }).then(() => {
          console.log("User profile displayName updated successfully.");
        }).catch((err) => {
          console.error("Error updating profile displayName:", err);
        });
      })
      .catch((error) => {
        console.error("Registration error:", error);
        let errorMsg = "An error occurred while creating your account.";
        if (error.code === 'auth/email-already-in-use') {
          errorMsg = "This email is already in use. Please log in.";
        } else if (error.code === 'auth/invalid-email') {
          errorMsg = "The email address is invalid.";
        } else if (error.code === 'auth/weak-password') {
          errorMsg = "The password is too weak.";
        }
        showToast(errorMsg, 'error');
        if (btn) {
          btn.disabled = false;
          btn.innerText = originalText;
        }
      });
  } else {
    signInWithEmailAndPassword(auth, email, password)
      .catch((error) => {
        console.error("Login error:", error);
        let errorMsg = "Incorrect email or password.";
        if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
          errorMsg = "Incorrect email or password.";
        } else if (error.code === 'auth/invalid-email') {
          errorMsg = "The email address is invalid.";
        } else if (error.code === 'auth/user-disabled') {
          errorMsg = "This account has been disabled.";
        }
        showToast(errorMsg, 'error');
        if (btn) {
          btn.disabled = false;
          btn.innerText = originalText;
        }
      });
  }
}

export async function logout() {
  const confirmed = await showConfirm("هل أنت متأكد من رغبتك في تسجيل الخروج؟", "تسجيل الخروج");
  if (confirmed) {
    auth.signOut().then(() => {
      setCurrentUser(null);
      try {
        localStorage.removeItem('crm_currentUser');
      } catch (e) {
        console.warn("localStorage.removeItem failed for crm_currentUser", e);
      }
      setClients([]);
      S.view = 'list';
      S.selId = null;
      R();
    }).catch((err) => {
      console.error("Logout error:", err);
      showToast("حدث خطأ أثناء تسجيل الخروج.", "error");
    });
  }
}

// 1. Contact History Operations (Transactional - Now Enqueued with Optimistic Updates)

export async function loginWithGoogle() {
  const btn = document.querySelector('.auth-btn');
  const originalText = btn ? btn.innerText : '';
  if (btn) {
    btn.disabled = true;
    btn.innerText = 'Redirecting to Google...';
  }
  try {
    await signInWithPopup(auth, googleProvider);
  } catch (error) {
    if (error.code === 'auth/popup-closed-by-user') {
      console.log('User closed the Google login popup.');
      showToast('تم إلغاء عملية تسجيل الدخول.', 'info');
    } else {
      console.error('Error during Google login:', error);
      showToast('فشل تسجيل الدخول بـ Google', 'error');
    }
    if (btn) {
      btn.disabled = false;
      btn.innerText = originalText;
    }
  }
}

export async function resetPassword(email) {
  try {
    await sendPasswordResetEmail(auth, email);
    showToast('تم إرسال رابط إعادة تعيين كلمة المرور');
  } catch (e) {
    showToast('خطأ: ' + e.message, 'error');
  }
}

export async function verifyEmail() {
  try {
    await sendEmailVerification(auth.currentUser);
    showToast('تم إرسال رابط التوثيق');
  } catch(e) {
    showToast('خطأ: ' + e.message, 'error');
  }
}

export async function loginWithFacebook() {
  try {
    await signInWithPopup(auth, facebookProvider);
  } catch (error) {
    if (error.code === 'auth/popup-closed-by-user') {
      showToast('تم إلغاء عملية تسجيل الدخول.', 'info');
    } else {
      console.error('Error during Facebook login:', error);
      showToast('فشل تسجيل الدخول بـ Facebook', 'error');
    }
  }
}

export async function loginWithApple() {
  try {
    await signInWithPopup(auth, appleProvider);
  } catch (error) {
    if (error.code === 'auth/popup-closed-by-user') {
      showToast('تم إلغاء عملية تسجيل الدخول.', 'info');
    } else {
      console.error('Error during Apple login:', error);
      showToast('فشل تسجيل الدخول بـ Apple', 'error');
    }
  }
}

export function showSocialLoginUnavailable(provider) {
  showToast(`تسجيل الدخول عبر ${provider} غير متوفر حالياً. يرجى استخدام البريد الإلكتروني أو حساب Google.`, 'info', 5000);
}

