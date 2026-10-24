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

function localizedMessage(ar, fr, en) {
  return S.lang === 'fr' ? fr : S.lang === 'en' ? en : ar;
}

export async function dispatchAiAction(aiResult, rawPrompt = '') {
  if (!aiResult) {
    return {
      success: false,
      message: localizedMessage('لم يتم تلقي أي استجابة من المساعد', 'Aucune réponse de l’assistant n’a été reçue.', 'No response was received from the assistant.')
    };
  }

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
      message: summary || localizedMessage(
        'نسبة الثقة منخفضة جداً لتنفيذ الأمر تلقائياً. يرجى توضيح المطلوب بعبارة أكثر دقة.',
        'Le niveau de confiance est trop faible pour exécuter cette action. Veuillez préciser votre demande.',
        'Confidence is too low to run this action automatically. Please clarify your request.'
      ),
      clarificationNeeded: aiResult.clarificationNeeded || []
    };
  }

  switch (intent) {
    case 'NAVIGATE': {
      const target = extractedData.targetPage || 'dashboard';
      setView(target);
      const destination = target === 'dashboard'
        ? localizedMessage('لوحة التحكم', 'le tableau de bord', 'the dashboard')
        : localizedMessage('قائمة العملاء', 'la liste des clients', 'the client list');
      showToast(localizedMessage(`تم التنقل إلى ${destination}`, `Navigation vers ${destination}`, `Navigated to ${destination}`));
      return {
        success: true,
        message: localizedMessage(`تم فتح ${destination}`, `Ouverture de ${destination}`, `Opened ${destination}`)
      };
    }

    case 'SEARCH_CLIENTS': {
      const query = extractedData.query || '';
      setDbFilter('dbSearchQuery', query);
      setView('list');
      showToast(localizedMessage(
        `تم تصفية القائمة بناءً على: "${query}"`,
        `Liste filtrée selon : "${query}"`,
        `List filtered by: "${query}"`
      ));
      return {
        success: true,
        message: localizedMessage(
          `تم تصفية القائمة بالبحث عن ${query}`,
          `Liste filtrée pour la recherche « ${query} »`,
          `List filtered for "${query}"`
        )
      };
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
            message: localizedMessage(
              'تم العثور على أكثر من عميل مطابق، يرجى اختيار العميل المطلوب:',
              'Plusieurs clients correspondent. Veuillez sélectionner le client souhaité :',
              'More than one matching client was found. Please select one:'
            )
          };
        }
      }

      if (targetClient) {
        await selClient(targetClient.id);
        showToast(localizedMessage(
          `تم فتح ملف العميل: ${targetClient.fullName}`,
          `Fiche du client ouverte : ${targetClient.fullName}`,
          `Opened client record: ${targetClient.fullName}`
        ));
        return {
          success: true,
          message: localizedMessage(
            `تم فتح تفاصيل ${targetClient.fullName}`,
            `Détails du client ouverts : ${targetClient.fullName}`,
            `Opened details for ${targetClient.fullName}`
          )
        };
      } else {
        return {
          success: false,
          message: localizedMessage('تعذر العثور على عميل مطابق لفتحه.', 'Aucun client correspondant n’a été trouvé.', 'No matching client was found.')
        };
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
        message: localizedMessage(
          `تم تجهيز مسودة إضافة العميل "${extractedData.fullName || ''}". يرجى المراجعة والتأكيد.`,
          `Le brouillon du client « ${extractedData.fullName || ''} » est prêt. Vérifiez-le et confirmez.`,
          `The draft for client "${extractedData.fullName || ''}" is ready. Review and confirm it.`
        ),
        duplicates: duplicates.length > 0 ? duplicates : null
      };
    }

    case 'UPDATE_CLIENT': {
      const c = clients.find(x => String(x.id) === String(S.selId || extractedData.clientId));
      if (!c) {
        return {
          success: false,
          message: localizedMessage('يرجى اختيار العميل المراد تعديله أو ذكر اسمه بوضوح.', 'Sélectionnez le client à modifier ou indiquez clairement son nom.', 'Select the client to update or specify its name.')
        };
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

      return {
        success: true,
        message: localizedMessage(
          `تم تعبئة مسودة تعديل بيانات العميل "${c.fullName}".`,
          `Le brouillon de modification du client « ${c.fullName} » est prêt.`,
          `The update draft for client "${c.fullName}" is ready.`
        )
      };
    }

    case 'ADD_ISSUE': {
      const c = clients.find(x => String(x.id) === String(S.selId || extractedData.clientId));
      if (!c) {
        return {
          success: false,
          message: localizedMessage('يرجى فتح ملف العميل أولاً لإضافة تذكرة دعم.', 'Ouvrez d’abord la fiche du client pour ajouter un ticket.', 'Open the client record before adding a support ticket.')
        };
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

      return {
        success: true,
        message: localizedMessage(
          `تم تجهيز مسودة التذكرة للعميل "${c.fullName}".`,
          `Le brouillon du ticket pour le client « ${c.fullName} » est prêt.`,
          `The ticket draft for client "${c.fullName}" is ready.`
        )
      };
    }

    case 'DELETE_CLIENT': {
      const c = clients.find(x => String(x.id) === String(S.selId || extractedData.clientId));
      if (!c) {
        return {
          success: false,
          message: localizedMessage('يرجى تحديد العميل المراد حذفه.', 'Sélectionnez le client à supprimer.', 'Select the client to delete.')
        };
      }

      const confirmed = await showConfirm(
        localizedMessage(
          `تأكيد حساس: هل أنت متأكد من حذف العميل "${c.fullName}" وجميع بياناته؟`,
          `Confirmez-vous la suppression du client « ${c.fullName} » et de toutes ses données ?`,
          `Are you sure you want to delete client "${c.fullName}" and all its data?`
        ),
        localizedMessage('حذف العميل عبر المساعد', 'Suppression du client par l’assistant', 'Delete client via assistant')
      );

      if (confirmed) {
        await delClient(c.id);
        return {
          success: true,
          message: localizedMessage(
            `تم حذف العميل "${c.fullName}" بنجاح.`,
            `Le client « ${c.fullName} » a été supprimé.`,
            `Client "${c.fullName}" was deleted successfully.`
          )
        };
      } else {
        return {
          success: false,
          message: localizedMessage('تم إلغاء عملية الحذف.', 'La suppression a été annulée.', 'Deletion was cancelled.')
        };
      }
    }

    default:
      return {
        success: false,
        message: summary || localizedMessage(
          'تم تحليل الطلب ولكن لم يتم العثور على إجراء مناسب للتنفيذ المباشر.',
          'La demande a été analysée, mais aucune action adaptée n’a été trouvée.',
          'The request was analyzed, but no suitable action was found.'
        )
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
