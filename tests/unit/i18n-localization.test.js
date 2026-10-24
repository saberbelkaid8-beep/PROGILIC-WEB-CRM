import { afterEach, describe, expect, it } from 'vitest';
import { S } from '../../src/state/store.js';
import { localizeRenderedDom, setLanguage, t } from '../../src/utils/i18n.js';
import { renderStaffLogin, renderStaffManagerModal } from '../../src/presentation/render-staff.js';
import { renderLogin } from '../../src/presentation/render-login.js';
import { showPrompt } from '../../src/utils/confirm.js';

describe('interface localization', () => {
  afterEach(() => {
    S.showStaffManager = false;
    setLanguage('ar');
  });

  it('translates hard-coded interface labels without translating client-provided text', () => {
    const root = document.createElement('div');
    root.innerHTML = `
      <section style="direction: rtl; text-align: right">
        <h1>بوابة تسجيل دخول المستخدمين</h1>
        <table><tr><th>نقاط Health ▼</th></tr></table>
        <div>🗺️ Geographic Distribution (1 ولاية)</div>
        <span class="btn">البرامج</span>
        <span class="btn">Licensed Software</span>
        <span class="staff-count">3 مستخدم مسجل</span>
        <button title="اللغة العربية">العملاء</button>
        <span class="client-name">حمزة بلقايد</span>
        <p>وصف العميل: تفاصيل مخصصة</p>
      </section>
    `;

    setLanguage('fr');
    localizeRenderedDom(root);

    expect(root.querySelector('h1').textContent).toBe('Portail de connexion des utilisateurs');
    expect(root.querySelector('th').textContent).toBe('Score de santé ▼');
    expect(root.querySelector('div').textContent).toBe('🗺️ Répartition géographique (1 wilaya(s))');
    expect(root.querySelector('.btn').textContent).toBe('Logiciels');
    expect(root.querySelectorAll('.btn')[1].textContent).toBe('Logiciels licenciés');
    expect(root.querySelector('.staff-count').textContent).toBe('3 utilisateur(s) enregistré(s)');
    expect(root.querySelector('button').textContent).toBe('Clients');
    expect(root.querySelector('button').title).toBe('Arabe');
    expect(root.querySelector('.client-name').textContent).toBe('حمزة بلقايد');
    expect(root.querySelector('section').style.direction).toBe('ltr');
    expect(root.querySelector('section').style.textAlign).toBe('left');
    expect(document.documentElement.dir).toBe('ltr');
    expect(document.documentElement.lang).toBe('fr');
  });

  it('localizes the actual staff login screen when the language changes', () => {
    const root = document.createElement('div');
    root.innerHTML = renderStaffLogin();
    setLanguage('en');
    localizeRenderedDom(root);

    expect(root.querySelector('h1').textContent).toContain('User Sign-in Portal');
    expect(root.querySelector('button[title="Select the administrator account to enter its password"]')).not.toBeNull();
    expect(root.textContent).not.toContain('بوابة تسجيل دخول المستخدمين');

    setLanguage('fr');
    root.innerHTML = renderStaffLogin();
    localizeRenderedDom(root);
    expect(root.textContent).toContain("PORTAIL D'ACCÈS UTILISATEUR PROGILIC CRM");
    expect(root.textContent).not.toContain('USER ACCESS PORTAL');
  });

  it('does not leave untranslated Arabic UI in the staff login screen', () => {
    const root = document.createElement('div');
    setLanguage('en');
    root.innerHTML = renderStaffLogin();
    localizeRenderedDom(root);

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const untranslated = [];
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (/[\u0600-\u06FF]/.test(node.nodeValue) && !node.parentElement.closest('.staff-name, .staff-position, .staff-supervisor, code')) {
        untranslated.push(node.nodeValue.trim());
      }
    }
    expect(untranslated).toEqual([]);
  });

  it('renders the main sign-in screen entirely in the selected language', () => {
    const root = document.createElement('div');
    setLanguage('fr');
    window.loginMode = 'login';
    root.innerHTML = renderLogin();
    localizeRenderedDom(root);

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const untranslated = [];
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (/[\u0600-\u06FF]/.test(node.nodeValue) && !node.parentElement.closest('input, textarea, code, [data-user-content="true"]')) {
        untranslated.push(node.nodeValue.trim());
      }
    }
    expect(untranslated).toEqual([]);
  });

  it('localizes confirmation prompts and keeps typed input intact', async () => {
    setLanguage('fr');
    const promptPromise = showPrompt(
      'الرجاء إدخال عنوان الطلب',
      'تأكيد الإجراء',
      'Valeur saisie',
      'بحث عن عميل أو رقم هاتف...'
    );
    const card = document.querySelector('.confirm-card');
    expect(card.style.direction).toBe('ltr');
    expect(card.textContent).toContain("Confirmer l'action");
    expect(card.querySelector('.prompt-input').placeholder).toBe('Rechercher un client, téléphone...');
    expect(card.querySelector('.prompt-input').value).toBe('Valeur saisie');
    expect(card.querySelector('.prompt-cancel').textContent).toBe('Annuler');
    expect(card.querySelector('.prompt-ok').textContent).toBe('Continuer');
    card.querySelector('.prompt-cancel').click();
    await expect(promptPromise).resolves.toBeNull();
  });

  it('localizes the staff administration modal while preserving employee-entered values', () => {
    S.showStaffManager = true;
    const root = document.createElement('div');
    setLanguage('fr');
    root.innerHTML = renderStaffManagerModal();
    localizeRenderedDom(root);

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const untranslated = [];
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (/[\u0600-\u06FF]/.test(node.nodeValue) && !node.parentElement.closest('.staff-name, .staff-position, .staff-supervisor, code, input, textarea')) {
        untranslated.push(node.nodeValue.trim());
      }
    }
    expect(untranslated).toEqual([]);
  });

  it('translates newly covered authentication and permission messages in both languages', () => {
    setLanguage('ar');
    expect(t('Portail de connexion des utilisateurs')).toBe('بوابة تسجيل دخول المستخدمين');

    setLanguage('fr');
    expect(t('الموظف غير موجود في هذا الحساب.')).toBe('Cet employé n\'existe pas dans ce compte.');
    expect(t('Licensed Software')).toBe('Logiciels licenciés');

    setLanguage('en');
    expect(t('الموظف غير موجود في هذا الحساب.')).toBe('Employee not found in this account.');
    expect(t('Logiciels licenciés')).toBe('Licensed Software');
    expect(t('التقرير يعرض 3 عملية مطابقة؛ استخدم تصدير CSV لتنزيل تفاصيل هذه العمليات.')).toBe(
      'The report shows 3 matching activities; export CSV to download their details.'
    );
    expect(t('🗺️ Geographic Distribution (1 ولاية)')).toBe('🗺️ Geographic Distribution (1 wilayas)');
    expect(S.lang).toBe('en');
    expect(document.documentElement.dir).toBe('ltr');
  });

  it('restores right-to-left direction when Arabic is selected', () => {
    const root = document.createElement('div');
    root.innerHTML = '<section style="direction: rtl; text-align: right"><span>Licensed Software</span></section>';
    setLanguage('en');
    localizeRenderedDom(root);
    setLanguage('ar');
    localizeRenderedDom(root);

    expect(root.dir).toBe('rtl');
    expect(document.documentElement.dir).toBe('rtl');
    expect(root.querySelector('section').style.direction).toBe('rtl');
    expect(root.querySelector('section').style.textAlign).toBe('right');
    expect(root.querySelector('span').textContent).toBe('البرامج المرخصة');
  });

  it('localizes control hints and explicit RTL fields without changing entered values', () => {
    const root = document.createElement('div');
    root.innerHTML = `
      <section dir="rtl">
        <input placeholder="بحث عن عميل أو رقم هاتف..." value="حمزة">
        <textarea placeholder="ملاحظات عامة">ملاحظات العميل اليدوية</textarea>
        <span class="client-name">حمزة بلقايد</span>
      </section>
    `;

    setLanguage('fr');
    localizeRenderedDom(root);
    expect(root.querySelector('section').dir).toBe('ltr');
    expect(root.querySelector('input').placeholder).toBe('Rechercher un client, téléphone...');
    expect(root.querySelector('input').value).toBe('حمزة');
    expect(root.querySelector('textarea').placeholder).not.toBe('ملاحظات عامة');
    expect(root.querySelector('textarea').value).toBe('ملاحظات العميل اليدوية');
    expect(root.querySelector('.client-name').textContent).toBe('حمزة بلقايد');

    setLanguage('ar');
    localizeRenderedDom(root);
    expect(root.querySelector('section').dir).toBe('rtl');
    expect(root.querySelector('input').placeholder).toBe('بحث عن عميل أو رقم هاتف...');
    expect(root.querySelector('textarea').placeholder).toBe('ملاحظات عامة');
    expect(root.querySelector('textarea').value).toBe('ملاحظات العميل اليدوية');
  });

  it('updates localized content outside the main application root when language changes', () => {
    const toast = document.createElement('div');
    toast.className = 'toast-container';
    toast.innerHTML = '<span>Licensed Software</span>';
    document.body.appendChild(toast);

    setLanguage('fr');
    expect(toast.textContent).toBe('Logiciels licenciés');
    expect(document.body.dir).toBe('ltr');
    expect(document.title).toBe('CRM clients et intelligence commerciale — PROGILIC CRM v3');

    setLanguage('ar');
    expect(toast.textContent).toBe('البرامج المرخصة');
    expect(document.body.dir).toBe('rtl');
    expect(document.title).toBe('إدارة العملاء والذكاء التجاري — PROGILIC CRM v3');
    toast.remove();
  });

  it('translates mixed-language text outside labeled controls and localizes displayed digits', () => {
    const root = document.createElement('div');
    root.innerHTML = `
      <p>تاريخ التقرير: 12</p>
      <span class="client-name">12 حمزة بلقايد</span>
      <p>12</p>
    `;

    setLanguage('fr');
    localizeRenderedDom(root);
    expect(root.querySelector('p').textContent).toBe('Date du rapport : 12');
    expect(root.querySelector('.client-name').textContent).toBe('12 حمزة بلقايد');

    setLanguage('en');
    localizeRenderedDom(root);
    expect(root.querySelector('p').textContent).toBe('Report Date: 12');
    expect(root.querySelectorAll('p')[1].textContent).toBe('12');

    setLanguage('ar');
    localizeRenderedDom(root);
    expect(root.querySelector('p').textContent).toBe('تاريخ التقرير: ١٢');
    expect(root.querySelectorAll('p')[1].textContent).toBe('١٢');
    expect(root.querySelector('.client-name').textContent).toBe('12 حمزة بلقايد');
  });
});
