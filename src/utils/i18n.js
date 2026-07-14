import { S } from '../state/store.js';

const frDict = {
  "لوحة القيادة": "Tableau de bord",
  "العملاء": "Clients",
  "إضافة عميل": "Ajouter client",
  "أهلاً بك في منصة إدارة العملاء": "Bienvenue sur la plateforme CRM",
  "تبدو لوحة التحكم فارغة حالياً. ابدأ بإضافة أول عميل لك لتتمكن من تتبع البرامج، التراخيص، وإدارة تذاكر الدعم الفني بكل سهولة.": "Le tableau de bord semble vide. Commencez par ajouter votre premier client pour suivre les programmes, licences et tickets de support.",
  "إضافة عميل جديد": "Ajouter un nouveau client",
  "ابدأ بإضافة أول عميل": "Commencer par ajouter le premier client",
  "المشاكل المفتوحة": "Tickets ouverts",
  "تراخيص فعالة": "Licences actives",
  "تنبيهات النظام": "Alertes système",
  "بحث عن عميل أو رقم هاتف...": "Rechercher un client ou téléphone...",
  "تصفية وتحديد": "Filtrer et sélectionner",
  "الكل": "Tous",
  "نشط": "Actif",
  "مغلق": "Fermé",
  "قيد المتابعة": "En suivi",
  "إعدادات": "Paramètres",
  "تسجيل الخروج": "Déconnexion",
  "النسخ الاحتياطية": "Sauvegardes",
  "جميع العملاء": "Tous les clients",
  "عميل نشط": "Client Actif",
  "حالة العميل": "Statut du client",
  "تمت إضافته في": "Ajouté le",
  "تعديل": "Modifier",
  "عرض التفاصيل": "Voir détails",
  "الولاية": "Wilaya",
  "البلدية": "Commune",
  "الاسم الكامل": "Nom complet",
  "المؤسسة / الشركة": "Entreprise / Société",
  "رقم الهاتف": "Numéro de téléphone",
  "الهاتف": "Téléphone",
  "العنوان": "Adresse",
  "ملاحظات": "Remarques",
  "إلغاء": "Annuler",
  "حفظ العميل": "Enregistrer le client",
  "المنطقة / الحي": "Quartier / Secteur",
  "ملاحظات عامة": "Notes générales"
};

export function t(arString) {
  if (!S.lang || S.lang === 'ar') return arString;
  return frDict[arString] || arString;
}

export function toggleLanguage() {
  S.lang = S.lang === 'ar' ? 'fr' : 'ar';
  document.documentElement.dir = S.lang === 'ar' ? 'rtl' : 'ltr';
  document.documentElement.lang = S.lang;
  if (window.R) window.R();
}
