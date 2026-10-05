/**
 * Action Dispatcher - Translates AI Intents into CRM execution steps.
 */

import { S, clients } from '../../state/store.js';
import { R } from '../../presentation/render-core.js';
import { openModal, closeModal, setDbFilter, setView, selClient, delClient } from '../actions.js';
import { logActivity, ActivityType } from '../timelineService.js';
import { showToast } from '../../utils/toast.js';
import { showConfirm } from '../../utils/confirm.js';
import { findMatchingClients, checkForDuplicates } from './entityResolver.js';

export async function dispatchAiAction(aiResult, rawPrompt = '') {
  if (!aiResult) return { success: false, message: 'لم يتم تلقي أي استجابة من المساعد' };

  const { intent, confidence, extractedData = {}, summary, plan = [], warning } = aiResult;

  // Log intent activity
  const activeClientId = S.selId || extractedData.clientId;
  if (activeClientId) {
    logActivity(
      activeClientId,
      ActivityType.SYSTEM_INFO,
      'أمر المساعد الذكي',
      `أمر المساعد: "${rawPrompt || summary}". النية: ${intent} (نسبة الثقة: ${Math.round(confidence * 100)}%).`,
      { source: 'AI Assistant', confidence, prompt: rawPrompt }
    ).catch(err => console.warn('Activity log error:', err));
  }

  // Handle Low Confidence
  if (confidence < 0.70) {
    return {
      success: false,
      message: summary || 'نسبة الثقة منخفضة جداً لتنفيذ الأمر تلقائياً. يرجى توضيح المطلوب بعبارة أكثر دقة.',
      clarificationNeeded: aiResult.clarificationNeeded || []
    };
  }

  switch (intent) {
    case 'NAVIGATE': {
      const target = extractedData.targetPage || 'dashboard';
      setView(target);
      showToast(`تم التنقل إلى ${target === 'dashboard' ? 'لوحة التحكم' : 'قائمة العملاء'}`);
      return { success: true, message: `تم فتح ${target}` };
    }

    case 'SEARCH_CLIENTS': {
      const query = extractedData.query || '';
      setDbFilter('dbSearchQuery', query);
      setView('list');
      showToast(`تم تصفية القائمة بناءً على: "${query}"`);
      return { success: true, message: `تم تصفية القائمة بالبحث عن ${query}` };
    }

    case 'OPEN_CLIENT_DETAILS': {
      let targetClient = null;
      if (extractedData.clientId) {
        targetClient = clients.find(c => String(c.id) === String(extractedData.clientId));
      } else if (extractedData.fullName || extractedData.query) {
        const matches = findMatchingClients(extractedData.fullName || extractedData.query);
        if (matches.length === 1) {
          targetClient = matches[0];
        } else if (matches.length > 1) {
          return {
            success: true,
            needsChoice: true,
            clients: matches,
            message: 'تم العثور على أكثر من عميل مطابق، يرجى اختيار العميل المطلوب:'
          };
        }
      }

      if (targetClient) {
        await selClient(targetClient.id);
        showToast(`تم فتح ملف العميل: ${targetClient.fullName}`);
        return { success: true, message: `تم فتح تفاصيل ${targetClient.fullName}` };
      } else {
        return { success: false, message: 'تعذر العثور على عميل مطابق لفتحه.' };
      }
    }

    case 'CREATE_CLIENT': {
      const duplicates = checkForDuplicates(extractedData);
      
      // Auto fill form draft in S.formDraft
      S.modal = 'addClient';
      S.aiFormDraft = {
        fullName: extractedData.fullName || '',
        phone: extractedData.phone || '',
        company: extractedData.company || '',
        wilaya: extractedData.wilaya || '',
        commune: extractedData.commune || '',
        status: extractedData.status || 'نشط',
        notes: extractedData.notes || 'تم الإنشاء عن طريق المساعد الذكي'
      };
      R();

      // Populate DOM elements after render
      setTimeout(() => {
        populateFormElements('f_', S.aiFormDraft);
      }, 50);

      return {
        success: true,
        message: `تم تجهيز مسودة إضافة العميل "${extractedData.fullName || ''}". يرجى المراجعة والتأكيد.`,
        duplicates: duplicates.length > 0 ? duplicates : null
      };
    }

    case 'UPDATE_CLIENT': {
      const c = clients.find(x => String(x.id) === String(S.selId || extractedData.clientId));
      if (!c) {
        return { success: false, message: 'يرجى اختيار العميل المراد تعديله أو ذكر اسمه بوضوح.' };
      }

      S.modal = 'editClient';
      S.form = { eid: c.id };
      S.aiFormDraft = {
        fullName: extractedData.fullName || c.fullName,
        phone: extractedData.phone || c.phone,
        company: extractedData.company || c.company,
        wilaya: extractedData.wilaya || c.wilaya,
        commune: extractedData.commune || c.commune,
        status: extractedData.status || c.status,
        notes: extractedData.notes || c.notes
      };
      R();

      setTimeout(() => {
        populateFormElements('f_', S.aiFormDraft);
      }, 50);

      return { success: true, message: `تم تعبئة مسودة تعديل بيانات العميل "${c.fullName}".` };
    }

    case 'ADD_ISSUE': {
      const c = clients.find(x => String(x.id) === String(S.selId || extractedData.clientId));
      if (!c) {
        return { success: false, message: 'يرجى فتح ملف العميل أولاً لإضافة تذكرة دعم.' };
      }

      S.modal = 'addIssue';
      S.aiFormDraft = {
        title: extractedData.issueTitle || 'مشكلة فنية معلنة عبر المساعد الذكي',
        priority: extractedData.issuePriority || 'متوسط',
        source: 'المساعد الذكي',
        status: 'مفتوح'
      };
      R();

      setTimeout(() => {
        populateFormElements('fi_', S.aiFormDraft);
      }, 50);

      return { success: true, message: `تم تجهيز مسودة التذكرة للعميل "${c.fullName}".` };
    }

    case 'DELETE_CLIENT': {
      const c = clients.find(x => String(x.id) === String(S.selId || extractedData.clientId));
      if (!c) {
        return { success: false, message: 'يرجى تحديد العميل المراد حذفه.' };
      }

      const confirmed = await showConfirm(
        `تأكيد حساس: هل أنت متأكد من حذف العميل "${c.fullName}" وجميع بياناته؟`,
        'حذف العميل عبر المساعد'
      );

      if (confirmed) {
        await delClient(c.id);
        return { success: true, message: `تم حذف العميل "${c.fullName}" بنجاح.` };
      } else {
        return { success: false, message: 'تم إلغاء عملية الحذف.' };
      }
    }

    default:
      return {
        success: false,
        message: summary || 'تم تحليل الطلب ولكن لم يتم العثور على إجراء مناسب للتنفيذ المباشر.'
      };
  }
}

function populateFormElements(prefix, draftObj) {
  if (!draftObj) return;
  Object.keys(draftObj).forEach(key => {
    const el = document.getElementById(`${prefix}${key}`);
    if (el) {
      el.value = draftObj[key];
      // Highlight AI auto-filled inputs softly
      el.style.border = '2px solid #8B5CF6';
      el.style.backgroundColor = 'rgba(139, 92, 246, 0.05)';
      setTimeout(() => {
        el.style.border = '';
        el.style.backgroundColor = '';
      }, 3000);
    }
  });
}
