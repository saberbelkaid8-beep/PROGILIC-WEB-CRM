import { S, clients, setClients, updateState, currentUser, setCurrentUser } from '../../state/store.js';
import { persist, loadClientSubcollectionsIfNeeded, enqueueSyncAction, stopRealtimeSync } from '../storage.js';
import { R } from '../../presentation/render-core.js';
import { logActivity, ActivityType, getTimeline } from '../timelineService.js';
import { getBackups, deleteBackup } from '../idbStorage.js';
import { createSnapshotBackup, restoreFromBackup, downloadBackupJSON } from '../backupService.js';
import { auth, googleProvider, facebookProvider, appleProvider } from '../../firebase/config.js';
import { 
  signInWithPopup, 
  signOut, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  sendPasswordResetEmail, 
  sendEmailVerification, 
  updateProfile,
  verifyPasswordResetCode,
  confirmPasswordReset
} from 'firebase/auth';
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
    showToast("يرجى إدخال البريد الإلكتروني وكلمة المرور.", 'error');
    return;
  }
  
  // Clean up any active listeners before authenticating a new session to prevent permissions race conditions
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

    createUserWithEmailAndPassword(auth, email, password)
      .then(async (userCredential) => {
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
      })
      .catch((error) => {
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
      });
  } else {
    signInWithEmailAndPassword(auth, email, password)
      .then(async (userCredential) => {
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
        const { loadDataFromFirestore } = await import('../storage.js');
        await loadDataFromFirestore(user);
        R();
      })
      .catch((error) => {
        console.error("Login error:", error);
        let errorMsg = "البريد الإلكتروني أو كلمة المرور غير صحيحة.";
        if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
          errorMsg = "البريد الإلكتروني أو كلمة المرور غير صحيحة.";
        } else if (error.code === 'auth/invalid-email') {
          errorMsg = "البريد الإلكتروني غير صحيح.";
        } else if (error.code === 'auth/user-disabled') {
          errorMsg = "تم تعطيل هذا الحساب من قبل المسؤول.";
        }
        showToast(errorMsg, 'error');
        if (btn) {
          btn.disabled = false;
          btn.innerText = originalText;
        }
      });
  }
}

export async function logout(force = false) {
  const confirmed = force ? true : await showConfirm("هل أنت متأكد من رغبتك في تسجيل الخروج؟", "تسجيل الخروج");
  if (confirmed) {
    stopRealtimeSync();
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

export async function sendPasswordReset(email) {
  const cleanEmail = email.trim();
  if (!cleanEmail) {
    showToast("يرجى إدخال البريد الإلكتروني.", "error");
    return;
  }
  const btn = document.querySelector('.auth-btn');
  const originalText = btn ? btn.innerText : '';
  if (btn) {
    btn.disabled = true;
    btn.innerText = 'جاري الإرسال...';
  }
  try {
    await sendPasswordResetEmail(auth, cleanEmail);
    showToast("تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك الإلكتروني بنجاح.", "success");
    window.loginMode = 'login';
    R();
  } catch (err) {
    console.error("Password reset error:", err);
    let errMsg = "حدث خطأ أثناء إرسال الرابط.";
    if (err.code === 'auth/user-not-found') {
      errMsg = "هذا البريد الإلكتروني غير مسجل لدينا.";
    } else if (err.code === 'auth/invalid-email') {
      errMsg = "البريد الإلكتروني غير صحيح.";
    } else if (err.code === 'auth/too-many-requests') {
      errMsg = "تم إرسال عدد كبير من الطلبات مؤخراً. يرجى الانتظار دقيقة قبل المحاولة مرة أخرى.";
    }
    showToast(errMsg, "error");
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerText = originalText;
    }
  }
}

export async function confirmNewPassword(password) {
  const oobCode = window.resetOobCode;
  if (!oobCode) {
    showToast("رمز تفعيل غير صالح أو منتهي الصلاحية.", "error");
    return;
  }
  const btn = document.querySelector('.auth-btn');
  const originalText = btn ? btn.innerText : '';
  if (btn) {
    btn.disabled = true;
    btn.innerText = 'جاري الحفظ...';
  }
  try {
    await confirmPasswordReset(auth, oobCode, password);
    showToast("تم تغيير كلمة المرور بنجاح! يمكنك الآن تسجيل الدخول بكلمة المرور الجديدة.", "success");
    // Clean up URL queries
    const cleanUrl = window.location.origin + window.location.pathname;
    window.history.replaceState({}, document.title, cleanUrl);
    window.loginMode = 'login';
    R();
  } catch (err) {
    console.error("Confirm password reset error:", err);
    let errMsg = "فشل تغيير كلمة المرور.";
    if (err.code === 'auth/weak-password') {
      errMsg = "كلمة المرور ضعيفة للغاية.";
    } else if (err.code === 'auth/expired-action-code') {
      errMsg = "انتهت صلاحية الرابط، يرجى طلب رابط جديد.";
    } else if (err.code === 'auth/invalid-action-code') {
      errMsg = "رابط غير صالح أو تم استخدامه مسبقاً.";
    }
    showToast(errMsg, "error");
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerText = originalText;
    }
  }
}

export async function resendVerificationEmail() {
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
}

export async function checkVerificationStatus() {
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
        const { loadDataFromFirestore } = await import('../storage.js');
        await loadDataFromFirestore(user);
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
    stopRealtimeSync();
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
    stopRealtimeSync();
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
    stopRealtimeSync();
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

