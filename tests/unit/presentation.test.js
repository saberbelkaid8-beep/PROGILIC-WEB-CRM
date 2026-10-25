import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderList, renderDetail, renderDashboard } from '../../src/presentation/render-views.js';
import { renderModal } from '../../src/presentation/render-modals.js';
import { ACTIVITY_TYPES } from '../../src/constants/index.js';
import { S, setClients, setCurrentStaffUser, setCurrentUser, updateState } from '../../src/state/store.js';
import { setLanguage, t } from '../../src/utils/i18n.js';
import { updateActTypeOpts } from '../../src/utils/index.js';

describe('Presentation Layer - Views', () => {
  beforeEach(() => {
    setCurrentUser({ uid: 'presentation-test-owner', role: 'gerant' });
    setCurrentStaffUser(null);
    updateState({ isLoading: false, filter: 'الكل', q: '' });
  });

  afterEach(() => {
    setCurrentStaffUser(null);
    setCurrentUser(null);
    setClients([]);
    updateState({ modal: null, selId: null });
    setLanguage('ar');
  });

  it('should render loading skeleton when isLoading is true', () => {
    updateState({ isLoading: true });
    const html = renderList();
    expect(html).toContain('skeleton');
  });

  it('should render empty state when no clients', () => {
    setClients([]);
    const html = renderList();
    expect(html).toContain('empty-text');
  });

  it('should render client cards', () => {
    const clients = [{
      id: 1,
      fullName: 'Ahmed Test',
      company: 'Test Co',
      status: 'نشط',
      issues: [],
      requirements: [],
      programs: [],
      wilaya: 'الجزائر'
    }];
    setClients(clients);
    const html = renderList();
    expect(html).toContain('Ahmed Test');
    expect(html).toContain('Test Co');
  });

  it('should render client details', () => {
    const clients = [{
      id: 1,
      fullName: 'Ahmed Test',
      company: 'Test Co',
      status: 'نشط',
      issues: [],
      requirements: [],
      programs: [],
      wilaya: 'الجزائر'
    }];
    setClients(clients);
    updateState({ selId: 1 });
    const html = renderDetail();
    expect(html).toContain('Ahmed Test');
    expect(html).toContain('Test Co');
    expect(html).toContain('نظرة عامة');
  });

  it('should render dashboard without errors', () => {
    const clients = [{
      id: 1,
      fullName: 'Ahmed Test',
      company: 'Test Co',
      status: 'نشط',
      endDate: '2026-10-10',
      issues: [{ id: 101, title: 'Bug', priority: 'عاجل', status: 'مفتوح' }],
      requirements: [],
      programs: [{ id: 201, programName: 'ERP', installationsCount: 2 }],
      wilaya: 'وهران'
    }];
    setClients(clients);
    const html = renderDashboard();
    expect(html).toContain('AI Sentinel Advisor');
  });

  it('should render dashboard gracefully when clients contain malformed or null records', () => {
    setClients([null, undefined, {}, { id: 2, fullName: null, programs: null, issues: null, wilaya: null }]);
    expect(() => {
      const html = renderDashboard();
      expect(html).toBeDefined();
    }).not.toThrow();
  });

  it('should switch interface languages between ar, fr, and en', async () => {
    const { setLanguage, t } = await import('../../src/utils/i18n.js');
    setLanguage('ar');
    expect(S.lang).toBe('ar');
    expect(t('العملاء')).toBe('العملاء');

    setLanguage('fr');
    expect(S.lang).toBe('fr');
    expect(t('العملاء')).toBe('Clients');

    setLanguage('en');
    expect(S.lang).toBe('en');
    expect(t('العملاء')).toBe('Clients');

    // Reset back to Arabic
    setLanguage('ar');
  });

  it('shows packaging, packing, and confectionery specialties in add and edit forms in all languages', () => {
    const specialties = {
      'تجارة جملة': {
        value: 'مواد التغليف والتعليب والحلويات بالجملة',
        ar: 'مواد التغليف والتعليب والحلويات بالجملة',
        fr: "Matériel d'emballage, de conditionnement et confiseries en gros",
        en: 'Packaging, packing materials & confectionery (wholesale)'
      },
      'تجارة تجزئة': {
        value: 'مواد التغليف والتعليب والحلويات بالتجزئة',
        ar: 'مواد التغليف والتعليب والحلويات بالتجزئة',
        fr: "Matériel d'emballage, de conditionnement et confiseries au détail",
        en: 'Packaging, packing materials & confectionery (retail)'
      }
    };

    for (const lang of ['ar', 'fr', 'en']) {
      setLanguage(lang);
      S.modal = 'addClient';
      const addForm = document.createElement('div');
      addForm.innerHTML = renderModal();
      document.body.appendChild(addForm);
      const activitySelect = addForm.querySelector('#f_bt');
      const specialtySelect = addForm.querySelector('#f_bf');

      for (const [activity, specialty] of Object.entries(specialties)) {
        activitySelect.value = activity;
        updateActTypeOpts();
        const option = Array.from(specialtySelect.options).find(item => item.value === specialty.value);
        expect(option?.textContent).toBe(specialty[lang]);
      }
      addForm.remove();

      for (const [activity, specialty] of Object.entries(specialties)) {
        setClients([{
          id: 44,
          fullName: 'Test Client',
          businessType: activity,
          businessField: specialty.value
        }]);
        updateState({ modal: 'editClient', selId: 44 });
        const editForm = document.createElement('div');
        editForm.innerHTML = renderModal();
        const editOption = editForm.querySelector(`#f_bf option[value="${specialty.value}"]`);
        expect(editOption?.textContent).toBe(specialty[lang]);
        expect(editOption?.selected).toBe(true);
      }
    }
  });

  it('translates the activity specialty label and every specialty option in all three languages', () => {
    const allSpecialties = Object.values(ACTIVITY_TYPES).flat();

    for (const lang of ['ar', 'fr', 'en']) {
      setLanguage(lang);
      expect(t('تخصص النشاط')).toBe(
        lang === 'ar' ? 'تخصص النشاط' : lang === 'fr' ? "Spécialité d'activité" : 'Activity Specialty'
      );

      for (const specialty of allSpecialties) {
        const translated = t(specialty);
        if (lang === 'ar') {
          expect(translated).toBe(specialty);
        } else {
          expect(translated, `${specialty} should be translated in ${lang}`).not.toBe(specialty);
        }
      }
    }
  });
});
