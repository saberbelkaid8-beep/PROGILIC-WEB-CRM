/**
 * PROGILIC CRM × TRELLO INTEGRATION
 * Deterministic Routing & Validation Gatekeeper
 * 
 * Enforces business rules, schema constraints, and safety boundaries.
 * AI produces understanding and extraction; THIS module determines the authoritative CRM destination.
 */

import { OPERATION_DESTINATION, REVIEW_REASONS } from './trelloTypes.js';

export const AI_CONFIDENCE_THRESHOLD = 0.70;

export function determineOperationRoute(extractedData, customerMatch, trelloItem, env = (typeof process !== 'undefined' ? process.env : {})) {
  // 0. Mandatory Human Approval Override (If enabled, ALL items route to Review Queue first)
  if (env.MANDATORY_HUMAN_APPROVAL === 'true' || env.TRELLO_MANDATORY_APPROVAL === 'true') {
    return {
      destination: OPERATION_DESTINATION.REVIEW_QUEUE,
      reason: 'MANDATORY_HUMAN_APPROVAL',
      details: 'المصادقة البشرية اليدوية الإلزامية مفعلة. تنتظر مراجعة وموافقة المدير.',
      payload: null
    };
  }

  // 1. Mandatory Safeguards: Check AI confidence (>= 0.70) and uncertainties
  if (!extractedData || typeof extractedData.confidence !== 'number' || extractedData.confidence < AI_CONFIDENCE_THRESHOLD) {
    return {
      destination: OPERATION_DESTINATION.REVIEW_QUEUE,
      reason: REVIEW_REASONS.LOW_AI_CONFIDENCE,
      details: `AI confidence below ${AI_CONFIDENCE_THRESHOLD} threshold or extraction failed.`,
      payload: null
    };
  }

  if (Array.isArray(extractedData.uncertainties) && extractedData.uncertainties.length > 0) {
    return {
      destination: OPERATION_DESTINATION.REVIEW_QUEUE,
      reason: REVIEW_REASONS.UNCLEAR_OPERATION_NATURE,
      details: extractedData.uncertainties.join('; '),
      payload: null
    };
  }

  // 2. Customer Resolution Guardrails
  if (!customerMatch) {
    return {
      destination: OPERATION_DESTINATION.REVIEW_QUEUE,
      reason: REVIEW_REASONS.AMBIGUOUS_CUSTOMER,
      details: 'No customer matching evaluation provided.',
      payload: null
    };
  }

  if (customerMatch.status === 'AMBIGUOUS' || customerMatch.candidates?.length > 1) {
    return {
      destination: OPERATION_DESTINATION.REVIEW_QUEUE,
      reason: REVIEW_REASONS.AMBIGUOUS_CUSTOMER,
      details: `Multiple customer candidates match (${customerMatch.candidates?.length || 0}). Human review required.`,
      payload: null
    };
  }

  if (customerMatch.status === 'NEW_CLIENT_INSUFFICIENT_INFO') {
    return {
      destination: OPERATION_DESTINATION.REVIEW_QUEUE,
      reason: REVIEW_REASONS.INSUFFICIENT_CUSTOMER_INFO,
      details: 'Customer is unrecorded in CRM, but available identifiers are insufficient to create a high-integrity profile.',
      payload: null
    };
  }

  // 3. Operation Nature Routing Logic
  const nature = extractedData.actionNature || 'unspecified';
  const trelloChecked = trelloItem.state === 'complete';
  const hasConfirmedResolution = Boolean(
    extractedData.confirmedResolved && extractedData.outcomeEvidence
  );

  // A. Software License Provisioning / Installation
  if (nature === 'installation' || nature === 'software_license') {
    const programName = typeof extractedData.programName === 'string' ? extractedData.programName.trim() : '';
    const platform = extractedData.platform;
    const type = extractedData.programType;
    const installationsCount = Number(extractedData.installationsCount);
    if (!programName
      || !['Desktop', 'Mobile', 'Web', 'Hybrid'].includes(platform)
      || typeof type !== 'string'
      || !type.trim()
      || type.length > 100
      || !Number.isSafeInteger(installationsCount)
      || installationsCount < 1) {
      return {
        destination: OPERATION_DESTINATION.REVIEW_QUEUE,
        reason: REVIEW_REASONS.UNSUPPORTED_DATA_SHAPE,
        details: 'License registration is missing an explicit name, platform, type, or valid installation count.',
        payload: null
      };
    }

    return {
      destination: OPERATION_DESTINATION.PROGRAMS,
      targetAction: 'REGISTER_PROGRAM',
      payload: {
        programName: String(programName).slice(0, 100),
        platform,
        type,
        version: typeof extractedData.version === 'string' ? extractedData.version.slice(0, 20) : '',
        installationsCount,
        startDate: typeof extractedData.date === 'string' ? extractedData.date : '',
        endDate: ''
      },
      auditTitle: 'تسجيل / تحديث ترخيص برنامج',
      auditDescription: `تم استيراد ترخيص البرنامج "${programName}" من Trello.`
    };
  }

  // B. Technical Issue / Bug / Malfunction
  if (nature === 'technical_issue' || nature === 'bug' || nature === 'defect') {
    // Decouple Trello task completion from issue resolution
    let issueStatus = 'مفتوح';
    let solutionNote = '';

    if (trelloChecked) {
      if (hasConfirmedResolution) {
        issueStatus = 'محلول';
        solutionNote = extractedData.outcomeEvidence || 'تم حل المشكلة وتأكيد المعالجة بنجاح.';
      } else {
        issueStatus = 'قيد المعالجة';
        solutionNote = 'تم تنفيذ المهمة في Trello وهي قيد المتابعة والتحقق مع العميل.';
      }
    }

    const title = String(extractedData.title || extractedData.actionDescription || 'مشكلة تقنية مستوردة من Trello').slice(0, 200);

    return {
      destination: OPERATION_DESTINATION.ISSUES,
      targetAction: 'SAVE_ISSUE',
      payload: {
        title,
        type: ['خطأ تقني', 'أداء', 'استفسار', 'طلب ميزة', 'خطأ مستخدم', 'أخرى'].includes(extractedData.issueType) ? extractedData.issueType : 'خطأ تقني',
        priority: ['عاجل', 'عالية', 'متوسطة', 'منخفضة'].includes(extractedData.priority) ? extractedData.priority : 'متوسطة',
        status: issueStatus,
        source: 'عميل',
        date: extractedData.date || new Date().toISOString().split('T')[0],
        notes: String(extractedData.actionDescription || extractedData.rawText || '').slice(0, 1000),
        solution: String(solutionNote).slice(0, 1000)
      },
      auditTitle: issueStatus === 'محلول' ? 'حل تذكرة مشكلة (Trello)' : 'تسجيل مشكلة تقنية (Trello)',
      auditDescription: `[Trello] ${title} — الحالة: (${issueStatus}).`
    };
  }

  // C. Feature Requirement / Custom Request
  if (nature === 'requirement' || nature === 'feature_request' || nature === 'modification') {
    const title = String(extractedData.title || extractedData.actionDescription || 'متطلب ميزة من Trello').slice(0, 200);
    const status = trelloChecked ? 'منفذ' : 'قيد الدراسة';

    return {
      destination: OPERATION_DESTINATION.REQUIREMENTS,
      targetAction: 'SAVE_REQUIREMENT',
      payload: {
        title,
        type: 'تطوير / تعديل',
        priority: ['عاجل', 'عالية', 'متوسطة', 'منخفضة'].includes(extractedData.priority) ? extractedData.priority : 'متوسطة',
        status: ['مقترح', 'قيد الدراسة', 'مخطط', 'منفذ', 'مرفوض'].includes(status) ? status : 'قيد الدراسة',
        impact: ['عالي', 'متوسط', 'منخفض'].includes(extractedData.impact) ? extractedData.impact : 'متوسط',
        date: extractedData.date || new Date().toISOString().split('T')[0],
        notes: String(extractedData.actionDescription || extractedData.rawText || '').slice(0, 1000)
      },
      auditTitle: 'تسجيل متطلب ميزة (Trello)',
      auditDescription: `[Trello] متطلب: "${title}".`
    };
  }

  // D. Contact / Training / Guidance / Interaction / Follow-up / Field Service (No bug)
  if (nature === 'training' || nature === 'assistance' || nature === 'contact' || nature === 'service' || nature === 'service_intervention' || nature === 'follow_up') {
    const mediumPrefix = extractedData.extractedInterventionMedium ? `[${extractedData.extractedInterventionMedium}] ` : '';
    const noteText = `${mediumPrefix}${extractedData.actionDescription || extractedData.rawText}`.trim().slice(0, 2000);

    return {
      destination: OPERATION_DESTINATION.CONTACTS,
      targetAction: 'SAVE_CONTACT',
      payload: {
        date: extractedData.date || new Date().toISOString().split('T')[0],
        note: noteText
      },
      auditTitle: 'تسجيل تواصل وخدمة (Trello)',
      auditDescription: `[Trello] ${noteText}`
    };
  }

  // E. Fallback: If nature could not be safely determined
  return {
    destination: OPERATION_DESTINATION.REVIEW_QUEUE,
    reason: REVIEW_REASONS.UNCLEAR_OPERATION_NATURE,
    details: `Unrecognized operational nature "${nature}". Routed to review queue.`,
    payload: null
  };
}
