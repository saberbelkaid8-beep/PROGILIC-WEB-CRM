import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { S, setCurrentUser } from '../../src/state/store.js';
import {
  renderAdminPasswordModal,
  renderChangePasswordModal,
  renderEditPermissionsModal,
  renderEmployeeFormModal,
  renderEmployeesView,
  renderViewEmployeeTasksModal
} from '../../src/presentation/render-employees.js';
import { localizeRenderedDom, setLanguage } from '../../src/utils/i18n.js';

const employee = {
  id: 'staff-localization-test',
  fullName: 'Mouna Ben Salah',
  username: 'mouna.login',
  department: 'pre_vente',
  position: 'Employee-provided position',
  supervisor: 'Employee-provided supervisor',
  tasks: 'Employee-provided task text',
  status: 'نشط',
  permissions: {}
};

describe('employee management localization', () => {
  beforeEach(() => {
    setCurrentUser({ uid: 'employee-localization-test', role: 'gerant' });
    S.staffUsers = [employee];
    window.__editingEmpId = employee.id;
    window.__permTargetEmpId = employee.id;
    window.__passwordTargetEmpId = employee.id;
    window.__viewingEmpId = employee.id;
    window.__deleteTargetEmpId = employee.id;
  });

  afterEach(() => {
    setLanguage('ar');
    setCurrentUser(null);
    S.staffUsers = [];
    S.modal = null;
    window.__empFilterDept = 'all';
    window.__empFilterStatus = 'all';
    window.__empSearchQuery = '';
  });

  it('localizes employee views while preserving employee-provided content', () => {
    const expectations = {
      fr: {
        title: 'Employés et départements — PROGILIC',
        department: 'Service Pré-vente',
        formLabel: "Nom complet de l'employé *"
      },
      en: {
        title: 'Employees and Departments — PROGILIC',
        department: 'Pre-Sales Department',
        formLabel: 'Employee Full Name *'
      }
    };

    for (const [language, expected] of Object.entries(expectations)) {
      setLanguage(language);
      S.modal = 'editEmployee';

      const main = renderEmployeesView();
      const form = renderEmployeeFormModal();
      const permissions = renderEditPermissionsModal();
      const password = renderChangePasswordModal();
      const tasks = renderViewEmployeeTasksModal();
      const deletion = renderAdminPasswordModal();
      window.__empSearchQuery = 'no matching employee';
      const emptyState = renderEmployeesView();
      window.__empSearchQuery = '';
      const combined = [main, emptyState, form, permissions, password, tasks, deletion].join('\n');

      expect(main).toContain(expected.title);
      expect(main).toContain(expected.department);
      expect(main).toContain('Employee-provided position');
      expect(main).toContain('Employee-provided supervisor');
      expect(main).toContain('Employee-provided task text');
      expect(emptyState).toContain(language === 'fr' ? 'Aucun employé ne correspond aux critères de recherche.' : 'No employees match the search criteria.');
      expect(form).toContain(expected.formLabel);
      expect(form).toContain('Employee-provided task text');
      expect(tasks).toContain('Employee-provided task text');
      expect(combined).not.toContain('موظفون يطابقون خيارات البحث');
      expect(combined).not.toContain('اسم الموظف الكامل *');

      const root = document.createElement('div');
      root.innerHTML = combined;
      localizeRenderedDom(root);
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      const visibleText = [];
      while (walker.nextNode()) {
        if (/[\u0600-\u06FF]/.test(walker.currentNode.nodeValue)) {
          visibleText.push(walker.currentNode.nodeValue.trim());
        }
      }
      visibleText.push(...Array.from(root.querySelectorAll('[title], [placeholder]'), element =>
        [element.title, element.placeholder].filter(value => /[\u0600-\u06FF]/.test(value)).join(' ')
      ));
      expect(visibleText.filter(Boolean)).toEqual([]);
    }
  });

  it('keeps employee-provided Arabic content unchanged in translated views', () => {
    const arabicEmployee = {
      ...employee,
      fullName: 'منى بن صالح',
      position: 'مسؤولة خاصة',
      supervisor: 'مشرف الموظفة',
      tasks: 'نص مهام كتبته الموظفة'
    };
    S.staffUsers = [arabicEmployee];
    window.__viewingEmpId = arabicEmployee.id;
    window.__editingEmpId = arabicEmployee.id;
    S.modal = 'editEmployee';
    setLanguage('en');

    const root = document.createElement('div');
    root.innerHTML = `
      <section id="main">${renderEmployeesView()}</section>
      <section id="form">${renderEmployeeFormModal()}</section>
      <section id="tasks">${renderViewEmployeeTasksModal()}</section>
    `;
    localizeRenderedDom(root);
    const main = root.querySelector('#main').innerHTML;
    const form = root.querySelector('#form').innerHTML;
    const tasks = root.querySelector('#tasks').innerHTML;

    expect(main).toContain('منى بن صالح');
    expect(main).toContain('مسؤولة خاصة');
    expect(main).toContain('مشرف الموظفة');
    expect(main).toContain('نص مهام كتبته الموظفة');
    expect(form).toContain('منى بن صالح');
    expect(form).toContain('نص مهام كتبته الموظفة');
    expect(tasks).toContain('منى بن صالح');
    expect(tasks).toContain('نص مهام كتبته الموظفة');
  });
});
