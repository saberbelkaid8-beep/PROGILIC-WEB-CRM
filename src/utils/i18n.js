import { S } from '../state/store.js';

export const SUPPORTED_LANGUAGES = ['ar', 'fr', 'en'];

export const frDict = {
  // Navigation & Headers
  "لوحة القيادة": "Tableau de bord",
  "العملاء": "Clients",
  "إضافة عميل": "Ajouter un client",
  "إضافة عميل جديد": "Ajouter un nouveau client",
  "تعديل": "Modifier",
  "عرض التفاصيل": "Voir les détails",
  "حفظ العميل": "Enregistrer le client",
  "حفظ التغييرات": "Enregistrer les modifications",
  "إلغاء": "Annuler",
  "تسجيل الخروج": "Déconnexion",
  "الوضع الليلي": "Mode sombre",
  "تغيير اللغة": "Changer de langue",
  "النسخ الاحتياطية": "Sauvegardes",
  "الرئيسية": "Accueil",
  "قائمة العملاء": "Liste des clients",
  "← قائمة العملاء": "← Liste des clients",
  "العميل غير موجود": "Client introuvable",
  "تأكيد الإجراء": "Confirmer l'action",
  "تأكيد": "Confirmer",
  "حذف": "Supprimer",
  "إغلاق": "Fermer",
  "مسح": "Effacer",
  "مسح الفلاتر": "Effacer les filtres",
  "تحديث": "Actualiser",
  "تصدير JSON": "Exporter JSON",
  "تصدير CSV": "Exporter CSV",
  "استيراد": "Importer",
  "تصفية/محو البيانات": "Purger / Réinitialiser",
  "المخطط الزمني العام": "Chronologie générale",
  "المخطط الزمني وسجل العمليات الشامل": "Chronologie & Journal d'Audit Global",
  "سجل الأنشطة المعتمدة": "Journal des activités validées",
  "تتبع زمني فوري وشامل لجميع العمليات المعتمدة في النظام مع توثيق اسم المستخدم المنفذ والتاريخ والوقت بدقة.": "Suivi temporel complet de toutes les opérations validées avec attribution à l'utilisateur.",
  "إجمالي العمليات المسجلة": "Opérations enregistrées",
  "عمليات اليوم": "Opérations d'aujourd'hui",
  "المستخدم الأكثر نشاطاً": "Utilisateur le plus actif",
  "مشاكل تم حلها": "Anomalies résolues",
  "تصفية باسم المستخدم المنفذ:": "Filtrer par utilisateur exécutant :",
  "جميع المستخدمين (الكل)": "Tous les utilisateurs (Tous)",
  "نوع العملية / القسم:": "Type d'opération / Dépt :",
  "جميع الأقسام والعمليات": "Toutes les opérations",
  "العملاء وحساباتهم": "Clients et comptes",
  "المشاكل والدعم الفني": "Anomalies et support",
  "البرامج والتراخيص": "Logiciels et licences",
  "المتطلبات والميزات": "Exigences et fonctionnalités",
  "سجل التواصل والمكالمات": "Historique des contacts",
  "النسخ الاحتياطي والأمان": "Sauvegarde et sécurité",
  "المستخدمون والصلاحيات": "Utilisateurs et permissions",
  "بحث فوري في العمليات:": "Recherche dans les opérations :",
  "ابحث: اسم المستخدم، العميل، تفاصيل الإجراء...": "Rechercher: utilisateur, client, détails...",
  "الفترة الزمنية:": "Période :",
  "اليوم": "Aujourd'hui",
  "أمس": "Hier",
  "آخر 7 أيام": "7 derniers jours",
  "هذا الشهر": "Ce mois-ci",
  "كل الأوقات": "Tout le temps",
  "مخصص 📅": "Personnalisé 📅",
  "من تاريخ:": "Du :",
  "إلى تاريخ:": "Au :",
  "إلغاء التواريخ": "Effacer dates",
  "عرض": "Affichage de",
  "عملية من أصل": "opérations sur",
  "عملية مسجلة": "enregistrées",
  "توثيق فوري معتمد": "Audit validé en temps réel",
  "لا توجد عمليات تطابق معايير البحث والفلترة": "Aucune opération ne correspond aux critères",
  "لم يتم العثور على أية عمليات للمستخدم أو الفترة الزمنية أو القسم المختار. يمكنك تجربة تغيير الفلاتر أو مسحها.": "Aucun résultat trouvé pour cette sélection. Essayez d'ajuster ou de réinitialiser vos filtres.",
  "إعادة ضبط ومسح الفلاتر": "Réinitialiser les filtres",
  "مسح جميع الفلاتر": "Effacer tous les filtres",
  "عملية معتمدة ومسجلة في النظام": "Opération validée et consignée",
  "فتح ملف العميل": "Ouvrir la fiche client",
  "طباعة": "Imprimer",

  // Statuses & Filters
  "الكل": "Tous",
  "نشط": "Actif",
  "نشطون": "Actifs",
  "محتمل": "Prospect",
  "متوقف": "Inactif",
  "مغلق": "Fermé",
  "قيد المتابعة": "En suivi",
  "قادم": "À venir",
  "منتهي": "Expiré",
  "إعدادات": "Paramètres",
  "تصفية وتحديد": "Filtrer & Sélectionner",
  "فلترة": "Filtres",
  "بحث عن عميل أو رقم هاتف...": "Rechercher un client, téléphone...",
  "ابحث: اسم، شركة، ولاية، نشاط، تخصص، هاتف...": "Rechercher: nom, société, wilaya, téléphone...",
  "بحث سريع في اللوحة...": "Recherche rapide dans le tableau...",
  "تصدير البيانات": "Exporter les données",
  "إعادة ضبط": "Réinitialiser",
  "جميع العملاء": "Tous les clients",
  "عميل نشط": "Client actif",
  "حالة العميل": "Statut du client",
  "تمت إضافته في": "Ajouté le",
  "ترتيب:": "Trier par :",
  "رقم العميل": "N° Client",
  "نقاط التقييم": "Score d'évaluation",
  "تاريخ التواصل": "Date de contact",
  "انتهاء العقد": "Fin du contrat",
  "تصاعدي": "Croissant",
  "تنازلي": "Décroissant",
  "نتيجة لـ": "résultats pour",
  "الاسم": "Nom",
  "الشركة": "Société",
  "الولاية": "Wilaya",
  "النشاط": "Activité",
  "التخصص": "Spécialité",
  "الهاتف": "Téléphone",
  "البرنامج": "Programme",

  // Form Fields & Modals
  "الاسم الكامل": "Nom complet",
  "المؤسسة / الشركة": "Entreprise / Société",
  "الشركة / المؤسسة": "Entreprise / Société",
  "رقم الهاتف": "Numéro de téléphone",
  "العنوان": "Adresse",
  "البلدية": "Commune",
  "المنطقة / الحي": "Quartier / Secteur",
  "العنوان / المنطقة / الحي": "Adresse / Quartier",
  "ملاحظات": "Remarques",
  "ملاحظات عامة": "Notes générales",
  "اختر الولاية": "Sélectionner la wilaya",
  "اختر البلدية": "Sélectionner la commune",
  "اختر النشاط": "Sélectionner l'activité",
  "اختر التخصص": "Sélectionner la spécialité",
  "النشاط الرئيسي": "Activité principale",
  "تخصص النشاط": "Spécialité d'activité",
  "حالة العقد والارتباط": "Statut du contrat",
  "الحالة": "Statut",
  "آخر تواصل": "Dernier contact",
  "تاريخ البداية": "Date de début",
  "تاريخ النهاية": "Date d'échéance",
  "تاريخ البداية / التثبيت": "Date de début / Installation",
  "تاريخ الانتهاء": "Date d'expiration",
  "اتركه فارغاً إذا كان مدى الحياة": "Laisser vide si licence à vie",
  "عدد الأجهزة": "Nombre d'appareils",
  "عدد الأجهزة المرخصة": "Appareils sous licence",
  "البرنامج / المنتج *": "Programme / Produit *",
  "المنصة": "Plateforme",
  "نوع البرنامج": "Type de programme",
  "النوع": "Type",
  "📦 تسجيل أول برنامج ترخيص (اختياري للعميل النشط)": "📦 Enregistrer le premier programme (facultatif)",
  "اسم البرنامج المرخص": "Nom du programme licencié",
  "تعديل البرنامج": "Modifier le programme",
  "إضافة برنامج جديد": "Ajouter un nouveau programme",
  "إضافة البرنامج": "Ajouter le programme",

  // Issues & Tickets
  "المشاكل والتذاكر": "Tickets et Incidents",
  "+ مشكلة جديدة": "+ Nouveau ticket",
  "تعديل المشكلة": "Modifier le ticket",
  "تسجيل مشكلة جديدة": "Enregistrer un nouveau ticket",
  "عنوان المشكلة باختصار *": "Titre du problème *",
  "نوع المشكلة": "Type de ticket",
  "المصدر": "Source",
  "أولوية المشكلة": "Priorité du ticket",
  "حالة المشكلة": "Statut du ticket",
  "نسبة الثقة التقريبية (%)": "Niveau de confiance (%)",
  "ملاحظات تقنية / تشخيص": "Notes techniques / Diagnostic",
  "الحل المقترح أو المنفذ": "Solution proposée ou appliquée",
  "فرصة ميزة جديدة في المنظومة": "Opportunité d'amélioration produit",
  "مشاكل مفتوحة": "Tickets ouverts",
  "فرص ميزات": "Opportunités",
  "لا توجد مشاكل مسجلة لهذا العميل": "Aucun ticket enregistré pour ce client",
  "تسجيل أول مشكلة": "Enregistrer le premier ticket",
  "✓ تم الحل": "✓ Résolu",
  "ثقة": "confiance",
  "فرصة ميزة": "Opportunité produit",
  "الحل:": "Solution :",

  // Requirements
  "المتطلبات والاقتراحات": "Exigences & Suggestions",
  "+ طلب جديد": "+ Nouvelle demande",
  "تعديل الطلب": "Modifier la demande",
  "تسجيل طلب أو ميزة جديدة": "Enregistrer une exigence ou suggestion",
  "عنوان الطلب *": "Titre de l'exigence *",
  "نوع الطلب": "Type de demande",
  "الأثر المتوقع": "Impact attendu",
  "أولوية التنفيذ": "Priorité de réalisation",
  "حالة الطلب": "Statut de la demande",
  "تفاصيل الطلب ومبرراته": "Détails et justifications",
  "لا توجد متطلبات مسجلة": "Aucune exigence enregistrée",
  "تسجيل أول طلب": "Enregistrer la première demande",
  "تأثير": "Impact",

  // Contacts
  "سجل الاتصال": "Historique des contacts",
  "📞 التواصل": "📞 Contacts",
  "سجلات تواصل": "Historique des contacts",
  "تواصل مسجل": "contacts enregistrés",
  "+ تسجيل تواصل": "+ Enregistrer un contact",
  "تسجيل تواصل مع العميل": "Enregistrer un échange client",
  "طريقة التواصل": "Canal de contact",
  "ملاحظات التواصل": "Notes de l'échange",
  "لا توجد سجلات تواصل بعد": "Aucun historique d'échange pour l'instant",
  "سجّل أول تواصل مع هذا العميل": "Enregistrez le premier contact avec ce client",

  // Programs Tab & Badges
  "إجمالي البرامج": "Total programmes",
  "إجمالي الأجهزة": "Total appareils",
  "نشط /": "Actif /",
  "منتهي": "Expiré",
  "قائمة البرامج": "Liste des programmes",
  "+ برنامج جديد": "+ Nouveau programme",
  "لا توجد برامج مرتبطة بهذا العميل": "Aucun programme associé à ce client",
  "إضافة أول برنامج": "Ajouter le premier programme",
  "جهاز مُرخَّص": "appareil(s) licencié(s)",
  "بدون انتهاء": "Illimité / À vie",
  "لا برامج": "Aucun programme",
  "برامج": "programmes",
  "جهاز": "appareil(s)",

  // Timeline
  "الخط الزمني": "Chronologie",
  "⏱️ الخط الزمني": "⏱️ Chronologie",
  "الخط الزمني للنشاط": "Chronologie des activités",
  "🔄 تحديث": "🔄 Actualiser",
  "لا توجد أحداث مسجلة للعميل حتى الآن. سيتم تسجيل التفاعلات تلقائياً هنا.": "Aucun événement enregistré pour ce client. Les interactions apparaîtront ici automatiquement.",
  "المنفذ:": "Effectué par :",

  // Report
  "التقرير": "Rapport",
  "📊 التقرير": "📊 Rapport",
  "مستوى الخطر": "Niveau de risque",
  "مستوى الفرصة": "Niveau d'opportunité",
  "متطلبات": "Exigences",
  "🏢 الملف التجاري": "🏢 Profil commercial",
  "📦 البرامج والتراخيص": "📦 Logiciels et licences",
  "الفترة:": "Période :",
  "تاريخ التقرير:": "Date du rapport :",
  "خطر عالٍ": "Risque élevé",
  "تحت المراقبة": "Sous surveillance",
  "وضع مستقر": "Situation stable",
  "عالية": "Haute",
  "متوسطة": "Moyenne",
  "منخفضة": "Basse",

  // Intelligence & Advisor
  "الذكاء": "Intelligence",
  "🧠 الذكاء": "🧠 Intelligence",
  "الذكاء الاصطناعي العالمي": "Intelligence Globale",
  "تحليل ذكي تلقائي": "Analyse intelligente automatisée",
  "مرصاد PROGILIC الذكي": "Sentinelle Intelligente PROGILIC",
  "تنبيهات استباقية وتوصيات وقائية مبنية على تحليل المخاطر": "Alertes préventives et recommandations basées sur l'analyse des risques",
  "مؤشر السلامة العامة": "Indice de santé global",
  "مؤشر السلامة العام": "Indice de santé global",
  "نقاط الصحة والتشغيل": "Score santé & opérations",
  "نقاط العميل": "Score client",
  "عميل متميز": "Client remarquable",
  "عميل جيد": "Bon client",
  "يحتاج متابعة": "Nécessite un suivi",
  "خطر عالي": "Risque critique",
  "ممتاز": "Excellent",
  "مستقر": "Stable",
  "متابعة": "À suivre",
  "خطر": "Critique",

  // Dashboard & Metrics
  "أهلاً بك في منصة إدارة العملاء": "Bienvenue sur la plateforme CRM",
  "تبدو لوحة التحكم فارغة حالياً. ابدأ بإضافة أول عميل لك لتتمكن من تتبع البرامج، التراخيص، وإدارة تذاكر الدعم الفني بكل سهولة.": "Le tableau de bord semble vide. Commencez par ajouter votre premier client pour suivre vos licences et tickets.",
  "المشاكل المفتوحة": "Tickets ouverts",
  "تراخيص فعالة": "Licences actives",
  "تنبيهات النظام": "Alertes système",
  "إجمالي العملاء": "Total clients",
  "الأجهزة المرخصة": "Appareils licenciés",
  "الطلبات المعلقة": "Tickets en attente",
  "البرامج المرخصة": "Logiciels licenciés",
  "الطلبات الفنية المعلقة": "Demandes support en attente",
  "الولاية الجغرافية": "Wilaya géographique",
  "آخر نشاط": "Dernière activité",
  "الملف": "Fiche",
  "استعراض": "Consulter",
  "اسم الشريك والشركة": "Partenaire & Société",
  "لوحة القيادة والمؤشرات الاستراتيجية": "Tableau de bord stratégique",
  "نظام المراقبة الاستباقية والتحليلات المتطورة للمنظومة": "Système de veille proactive et d'analytique CRM",
  "التوزيع الجغرافي للعملاء": "Répartition géographique des clients",
  "توزيع البرامج والتراخيص": "Répartition des programmes et licences",
  "تحليل مؤشر الصحة التشغيلية": "Analyse de la santé opérationnelle",
  "قائمة المتابعة الاستباقية للعملاء": "Liste de surveillance proactive",
  "العميل والمؤسسة": "Client & Entreprise",
  "البرامج والتراخيص": "Programmes & Licences",
  "الطلبات": "Tickets",
  "الصحة": "Santé",
  "الإجراء": "Action",
  "جميع الولايات": "Toutes les wilayas",
  "جميع البرامج": "Tous les programmes",
  "جميع الفئات": "Toutes les catégories",

  // Business Activities & Specialties
  "تجارة جملة": "Commerce de gros",
  "تجارة تجزئة": "Commerce de détail",
  "مواد التغليف والتعليب والحلويات بالجملة": "Matériel d'emballage, de conditionnement et confiseries en gros",
  "مواد التغليف والتعليب والحلويات بالتجزئة": "Matériel d'emballage, de conditionnement et confiseries au détail",
  "مواد غذائية بالجملة": "Produits alimentaires en gros",
  "إلكترونيات بالجملة": "Électronique en gros",
  "ملابس وأقمشة بالجملة": "Vêtements et tissus en gros",
  "مواد بناء بالجملة": "Matériaux de construction en gros",
  "أدوية وشبه صيدلاني بالجملة": "Médicaments et produits parapharmaceutiques en gros",
  "أخرى (جملة)": "Autres (gros)",
  "سوبرماركت / بقالة": "Supermarché / Épicerie",
  "محل ملابس وأزياء": "Magasin de vêtements et mode",
  "عطور وتجميل": "Parfumerie et produits de beauté",
  "خردوات ومواد بناء": "Quincaillerie et matériaux de construction",
  "أثاث ومفروشات": "Meubles et ameublement",
  "قطع غيار سيارات": "Pièces automobiles",
  "إلكترونيات وكهرومنزلية": "Électronique et électroménager",
  "أخرى (تجزئة)": "Autres (détail)",
  "وكالة سياحة وأسفار": "Agence de tourisme et de voyages",
  "وكالة إعلانات واتصال": "Agence de publicité et de communication",
  "خدمات تنظيف وصيانة": "Services de nettoyage et de maintenance",
  "خدمات استشارية": "Services de conseil",
  "كراء السيارات": "Location de voitures",
  "أخرى (خدمات)": "Autres (services)",
  "صناعة غذائية": "Industrie agroalimentaire",
  "صناعة بلاستيك": "Industrie plastique",
  "صناعة نسيج": "Industrie textile",
  "صناعة معدنية": "Industrie métallurgique",
  "أخرى (صناعة)": "Autres (industrie)",
  "مطعم تقليدي": "Restaurant traditionnel",
  "وجبات سريعة": "Restauration rapide",
  "مقهى / قاعة شاي": "Café / Salon de thé",
  "فندق / نزل": "Hôtel / Auberge",
  "قاعة حفلات": "Salle des fêtes",
  "أخرى (إطعام)": "Autres (restauration)",
  "صيدلية / شبه صيدلي": "Pharmacie / Parapharmacie",
  "عيادة طبية": "Cabinet médical",
  "مخبر تحاليل": "Laboratoire d'analyses",
  "عيادة أسنان": "Cabinet dentaire",
  "أخرى (صحة)": "Autres (santé)",
  "مدرسة خاصة": "École privée",
  "معهد تكوين": "Institut de formation",
  "مدرسة لغات": "École de langues",
  "أخرى (تعليم)": "Autres (éducation)",
  "ترقية عقارية": "Promotion immobilière",
  "مقاولات بناء": "Entreprise de construction",
  "مكتب دراسات": "Bureau d'études",
  "أخرى (بناء)": "Autres (construction)",
  "نقل بضائع": "Transport de marchandises",
  "نقل مسافرين": "Transport de voyageurs",
  "خدمات توصيل": "Services de livraison",
  "أخرى (نقل)": "Autres (transport)",
  "إنتاج زراعي": "Production agricole",
  "تربية مواشي ودواجن": "Élevage de bétail et de volailles",
  "أخرى (زراعة)": "Autres (agriculture)",
  "برمجيات وتطوير": "Logiciels et développement",
  "بيع وصيانة حواسيب": "Vente et maintenance informatique",
  "أخرى (تقنية)": "Autres (technologie)",
  "وكالة تأمين": "Agence d'assurance",
  "مكتب محاسبة": "Cabinet comptable",
  "أخرى (مالية)": "Autres (finance)",
  "نشاط غير مصنف": "Activité non classée",
  "شركة خدمات": "Société de services",
  "صناعة / تصنيع": "Industrie / Fabrication",
  "مطاعم وفنادق": "Restauration & Hôtellerie",
  "صحة وصيدلة": "Santé & Pharmacie",
  "تعليم وتكوين": "Éducation & Formation",
  "بناء وعقارات": "Bâtiment & Immobilier",
  "نقل ولوجستيك": "Transport & Logistique",
  "زراعة وأغذية": "Agriculture & Agroalimentaire",
  "تقنية ومعلوماتية": "Technologies & Informatique",
  "مالية وتأمين": "Finance & Assurances",
  "أخرى": "Autres",

  // Program Types & Platforms
  "تجاري": "Commercial",
  "إنتاجي": "Production",
  "لوحة تحكم": "Tableau de bord",
  "خدمي": "Services",

  // Priorities & Issue Statuses
  "أولوية": "Priorité",
  "عاجل": "Urgent",
  "عالية": "Haute",
  "عالي": "Élevé",
  "متوسطة": "Moyenne",
  "متوسط": "Moyen",
  "منخفضة": "Basse",
  "منخفض": "Faible",
  "مفتوح": "Ouvert",
  "قيد المعالجة": "En cours",
  "محلول": "Résolu",
  "مقترح": "Proposé",
  "قيد الدراسة": "À l'étude",
  "مخطط": "Planifié",
  "منفذ": "Réalisé",
  "مرفوض": "Rejeté",
  "خطأ تقني": "Bug technique",
  "أداء": "Performance",
  "استفسار": "Question / Support",
  "طلب ميزة": "Demande de fonctionnalité",
  "خطأ مستخدم": "Erreur utilisateur",
  "نظام": "Système",
  "عميل": "Client",
  "سوء استخدام": "Mauvaise manipulation",
  "شبكة": "Réseau",
  "غير محدد": "Non défini",
  "ميزة جديدة": "Nouvelle fonctionnalité",
  "تحسين": "Amélioration",

  // Sync & Storage Bar
  "وضع الأوفلاين": "Mode hors-ligne",
  "عمليات محلياً": "opérations enregistrées localement",
  "جاري رفع المزامنة": "Synchronisation en cours",
  "عمليات معلقة": "opérations en attente",
  "خطأ في المزامنة، سيتم إعادة المحاولة...": "Erreur de synchro, nouvelle tentative en cours...",
  "تم المزامنة تلقائياً": "Synchronisé avec le cloud",
  "متصل بالسحابة": "Connecté au cloud",
  "النسخ الاحتياطية المؤرشفة": "Sauvegardes archivées",
  "إدارة النسخ الاحتياطية": "Gestion des sauvegardes",
  "إنشاء نسخة الآن": "Créer une sauvegarde maintenant",

  // Danger Zone
  "منطقة الخطر": "Zone de danger",
  "حذف هذا العميل يحذف جميع مشاكله ومتطلباته نهائياً ولا يمكن التراجع": "La suppression de ce client effacera définitivement ses données associées (irréversible).",
  "حذف العميل نهائياً": "Supprimer définitivement le client",

  // AI Assistant Widget
  "المساعد الذكي": "Assistant Intelligent",
  "مساعد CRM الذكي": "Assistant CRM Intelligent",
  "أمر صوتي أو نصي لتشغيل المنظومة": "Commande vocale ou textuelle pour piloter le CRM",
  "اكتب أمراً أو استفساراً...": "Tapez une commande ou question...",
  "تحدث الآن...": "Parlez maintenant...",
  "تنفيذ الإجراء": "Exécuter l'action",
  "استمع": "Écouter",
  "الذكاء الاصطناعي": "Intelligence Artificielle",

  // Auth Screen
  "تسجيل الدخول": "Connexion",
  "إنشاء حساب جديد": "Créer un compte",
  "أهلاً بك مجدداً! يرجى إدخال بياناتك للوصول إلى لوحة التحكم.": "Bienvenue ! Veuillez renseigner vos identifiants pour accéder au CRM.",
  "سجل بياناتك للانضمام إلى منصة PROGILIC CRM.": "Inscrivez vos informations pour rejoindre la plateforme PROGILIC CRM.",
  "البريد الإلكتروني للشركة": "Adresse email professionnelle",
  "البريد الإلكتروني": "Adresse email",
  "الاسم الكامل": "Nom complet",
  "كلمة المرور": "Mot de passe",
  "كلمة المرور الجديدة": "Nouveau mot de passe",
  "تأكيد كلمة المرور الجديدة": "Confirmer le nouveau mot de passe",
  "تذكرني": "Se souvenir de moi",
  "نسيت كلمة المرور؟": "Mot de passe oublié ?",
  "أو الدخول بواسطة": "Ou se connecter avec",
  "أو التسجيل بواسطة": "Ou s'inscrire avec",
  "قوة كلمة المرور:": "Force du mot de passe :",
  "قصيرة جداً": "Très court",
  "ضعيفة": "Faible",
  "متوسطة": "Moyenne",
  "قوية": "Fort",
  "قوية جداً": "Très fort",
  "إنشاء الحساب وتفعيل البريد": "Créer le compte et envoyer l'email de validation",
  "استعادة كلمة المرور": "Réinitialisation du mot de passe",
  "إعادة تعيين كلمة المرور": "Réinitialiser le mot de passe",
  "أدخل بريدك الإلكتروني المسجل وسنقوم بإرسال رابط فوري لإعادة تعيين كلمة المرور الخاصة بك.": "Entrez votre e-mail enregistré et nous vous enverrons un lien pour réinitialiser votre mot de passe.",
  "إرسال رابط إعادة التعيين": "Envoyer le lien de réinitialisation",
  "العودة لصفحة تسجيل الدخول": "Retour à la page de connexion",
  "تعيين كلمة المرور الجديدة": "Définir le nouveau mot de passe",
  "يرجى تعيين كلمة مرور قوية وجديدة لحسابك المسجل:": "Veuillez définir un nouveau mot de passe robuste pour votre compte :",
  "حفظ كلمة المرور الجديدة": "Enregistrer le nouveau mot de passe",
  "إلغاء والعودة للدخول": "Annuler et revenir à la connexion",
  "تفعيل الحساب مطلوب": "Validation de compte requise",
  "لقد أرسلنا رابط تفعيل إلى البريد الإلكتروني:": "Nous avons envoyé un lien de confirmation à l'adresse email :",
  "التعليمات:": "Instructions :",
  "1. افتح علبة الوارد لبريدك الإلكتروني واضغط على الرابط المرسل لتفعيل حسابك.": "1. Ouvrez votre boîte mail et cliquez sur le lien pour activer votre compte.",
  "2. إذا تم التفعيل بنجاح، انقر على زر \"التحقق من حالة التفعيل\" بالأسفل.": "2. Si validé avec succès, cliquez sur le bouton \"Vérifier la validation\" ci-dessous.",
  "3. إذا لم تصلك الرسالة بعد بضع دقائق، تفقّد مجلد \"الرسائل غير المرغوب فيها (Spam)\" أو اضغط على \"إعادة إرسال رابط التفعيل\".": "3. Si vous ne recevez rien après quelques minutes, vérifiez vos spams ou cliquez sur \"Renvoyer le lien\".",
  "⚡ التحقق من حالة التفعيل والدخول": "⚡ Vérifier la validation et accéder",
  "✉️ إعادة إرسال الرابط": "✉️ Renvoyer le lien",
  "🚪 تسجيل الخروج": "🚪 Déconnexion",
  "التحقق من حالة التفعيل والدخول": "Vérifier le statut de validation et se connecter",
  "إعادة إرسال الرابط": "Renvoyer l'email",
  "لوحة التحكم والمتابعة الذكية وإدارة علاقات العملاء في بيئة سحابية فائقة الأداء وعالية الأمان.": "Tableau de bord intelligent et CRM d'entreprise dans un environnement cloud haute performance et sécurisé.",
  "جاري تسجيل الدخول...": "Connexion en cours...",
  "جاري إنشاء الحساب...": "Création du compte en cours...",
  "يرجى إدخال البريد الإلكتروني وكلمة المرور.": "Veuillez saisir votre adresse email et votre mot de passe.",
  "يرجى استخدام كلمة مرور أقوى (متوسطة على الأقل).": "Veuillez utiliser un mot de passe plus sécurisé (moyen au minimum).",
  "تم إنشاء الحساب بنجاح وإرسال بريد تفعيل الحساب!": "Compte créé avec succès et email de vérification envoyé !",
  "تم إنشاء الحساب ولكن فشل إرسال بريد التفعيل: ": "Compte créé mais échec de l'envoi de l'email de vérification : ",
  "حدث خطأ أثناء إنشاء حسابك.": "Une erreur s'est produite lors de la création de votre compte.",
  "البريد الإلكتروني مستخدم بالفعل. يرجى تسجيل الدخول.": "Cette adresse email est déjà utilisée. Veuillez vous connecter.",
  "البريد الإلكتروني غير صحيح.": "Adresse email non valide.",
  "صيغة البريد الإلكتروني غير صحيحة.": "Format d'adresse email non valide.",
  "كلمة المرور ضعيفة للغاية.": "Le mot de passe est trop faible.",
  "يرجى تفعيل بريدك الإلكتروني أولاً للوصول إلى النظام.": "Veuillez d'abord vérifier votre email pour accéder au système.",
  "تم تسجيل الدخول بنجاح!": "Connexion réussie !",
  "البريد الإلكتروني أو كلمة المرور غير صحيحة.": "Adresse email ou mot de passe incorrect.",
  "جاري إرسال رابط إعادة التعيين...": "Envoi du lien de réinitialisation...",
  "تم إرسال بريد إعادة تعيين كلمة المرور بنجاح. يرجى مراجعة بريدك الوارد.": "Email de réinitialisation envoyé avec succès. Veuillez vérifier votre boîte mail.",
  "فشل إرسال بريد إعادة التعيين.": "Échec de l'envoi de l'email de réinitialisation.",
  "لا يوجد حساب مسجل بهذا البريد الإلكتروني.": "Aucun compte trouvé avec cet email.",
  "جاري الإرسال...": "Envoi en cours...",
  "تم إعادة إرسال رابط التفعيل بنجاح. يرجى تفقّد بريدك الإلكتروني.": "Lien de vérification renvoyé avec succès. Veuillez vérifier votre boîte mail.",
  "لم نتمكن من العثور على حسابك الحالي.": "Compte actuel introuvable.",
  "تم إرسال عدد كبير من طلبات التفعيل مؤخراً. يرجى الانتظار دقيقة قبل المحاولة مرة أخرى.": "Trop de requêtes récentes. Veuillez patienter une minute avant de réessayer.",
  "جاري التحقق...": "Vérification en cours...",
  "تم تفعيل حسابك بنجاح! جاري تحميل البيانات...": "Compte vérifié avec succès ! Chargement des données...",
  "لم يتم تفعيل البريد الإلكتروني بعد. يرجى فتح الرسالة المرسلة وتأكيد حسابك.": "Email non encore vérifié. Veuillez ouvrir le mail et confirmer votre compte.",
  "تم إلغاء عملية الدخول بواسطة المستخدم.": "Connexion annulée par l'utilisateur.",
  "فشل تسجيل الدخول باستخدام Google: ": "Échec de connexion avec Google : ",
  "فشل تسجيل الدخول باستخدام Facebook: ": "Échec de connexion avec Facebook : ",
  "كلمتا المرور غير متطابقتين.": "Les mots de passe ne correspondent pas.",
  "اللغة": "Langue",
  "العربية": "Arabe",
  "الفرنسية": "Français",
  "الإنجليزية": "Anglais"
};

export const enDict = {
  // Navigation & Headers
  "لوحة القيادة": "Dashboard",
  "العملاء": "Clients",
  "إضافة عميل": "Add Client",
  "إضافة عميل جديد": "Add New Client",
  "تعديل": "Edit",
  "عرض التفاصيل": "View Details",
  "حفظ العميل": "Save Client",
  "حفظ التغييرات": "Save Changes",
  "إلغاء": "Cancel",
  "تسجيل الخروج": "Log Out",
  "الوضع الليلي": "Dark Mode",
  "تغيير اللغة": "Change Language",
  "النسخ الاحتياطية": "Backups",
  "الرئيسية": "Home",
  "قائمة العملاء": "Clients List",
  "← قائمة العملاء": "← Clients List",
  "العميل غير موجود": "Client not found",
  "تأكيد الإجراء": "Confirm Action",
  "تأكيد": "Confirm",
  "حذف": "Delete",
  "إغلاق": "Close",
  "مسح": "Clear",
  "مسح الفلاتر": "Clear Filters",
  "تحديث": "Refresh",
  "تصدير JSON": "Export JSON",
  "تصدير CSV": "Export CSV",
  "استيراد": "Import",
  "تصفية/محو البيانات": "Purge / Reset DB",
  "المخطط الزمني العام": "Global Timeline",
  "المخطط الزمني وسجل العمليات الشامل": "Global Timeline & Audit Activity Log",
  "سجل الأنشطة المعتمدة": "Validated Activities Log",
  "تتبع زمني فوري وشامل لجميع العمليات المعتمدة في النظام مع توثيق اسم المستخدم المنفذ والتاريخ والوقت بدقة.": "Comprehensive real-time tracking of all validated CRM operations with precise user attribution and timestamps.",
  "إجمالي العمليات المسجلة": "Total Operations Logged",
  "عمليات اليوم": "Today's Operations",
  "المستخدم الأكثر نشاطاً": "Most Active User",
  "مشاكل تم حلها": "Resolved Issues",
  "تصفية باسم المستخدم المنفذ:": "Filter by user performing action:",
  "جميع المستخدمين (الكل)": "All Users (All)",
  "نوع العملية / القسم:": "Operation Type / Category:",
  "جميع الأقسام والعمليات": "All Categories & Actions",
  "العملاء وحساباتهم": "Clients & Accounts",
  "المشاكل والدعم الفني": "Issues & Support",
  "البرامج والتراخيص": "Software & Licenses",
  "المتطلبات والميزات": "Requirements & Features",
  "سجل التواصل والمكالمات": "Contact History & Calls",
  "النسخ الاحتياطي والأمان": "Backups & Security",
  "المستخدمون والصلاحيات": "Users & Permissions",
  "بحث فوري في العمليات:": "Instant Search in Logs:",
  "ابحث: اسم المستخدم، العميل، تفاصيل الإجراء...": "Search: user name, client, action details...",
  "الفترة الزمنية:": "Time Period:",
  "اليوم": "Today",
  "أمس": "Yesterday",
  "آخر 7 أيام": "Last 7 Days",
  "هذا الشهر": "This Month",
  "كل الأوقات": "All Time",
  "مخصص 📅": "Custom Range 📅",
  "من تاريخ:": "From Date:",
  "إلى تاريخ:": "To Date:",
  "إلغاء التواريخ": "Clear Dates",
  "عرض": "Showing",
  "عملية من أصل": "operations of",
  "عملية مسجلة": "recorded",
  "توثيق فوري معتمد": "Verified Real-Time Audit",
  "لا توجد عمليات تطابق معايير البحث والفلترة": "No operations found matching filter criteria",
  "لم يتم العثور على أية عمليات للمستخدم أو الفترة الزمنية أو القسم المختار. يمكنك تجربة تغيير الفلاتر أو مسحها.": "No logged activities found for this user, date range, or category. Try clearing or adjusting filters.",
  "إعادة ضبط ومسح الفلاتر": "Reset & Clear Filters",
  "مسح جميع الفلاتر": "Clear All Filters",
  "عملية معتمدة ومسجلة في النظام": "Operation validated and committed to system",
  "فتح ملف العميل": "Open client profile",
  "طباعة": "Print",

  // Statuses & Filters
  "الكل": "All",
  "نشط": "Active",
  "نشطون": "Active",
  "محتمل": "Prospect",
  "متوقف": "Inactive",
  "مغلق": "Closed",
  "قيد المتابعة": "In Follow-up",
  "قادم": "Upcoming",
  "منتهي": "Expired",
  "إعدادات": "Settings",
  "تصفية وتحديد": "Filter & Select",
  "فلترة": "Filters",
  "بحث عن عميل أو رقم هاتف...": "Search client, phone...",
  "ابحث: اسم، شركة، ولاية، نشاط، تخصص، هاتف...": "Search: name, company, wilaya, phone...",
  "بحث سريع في اللوحة...": "Quick search in dashboard...",
  "تصدير البيانات": "Export Data",
  "إعادة ضبط": "Reset",
  "جميع العملاء": "All Clients",
  "عميل نشط": "Active Client",
  "حالة العميل": "Client Status",
  "تمت إضافته في": "Added on",
  "ترتيب:": "Sort by:",
  "رقم العميل": "Client ID",
  "نقاط التقييم": "Score",
  "تاريخ التواصل": "Last Contact Date",
  "انتهاء العقد": "Contract End Date",
  "تصاعدي": "Ascending",
  "تنازلي": "Descending",
  "نتيجة لـ": "results for",
  "الاسم": "Name",
  "الشركة": "Company",
  "الولاية": "Province",
  "النشاط": "Business",
  "التخصص": "Specialty",
  "الهاتف": "Phone",
  "البرنامج": "Software",

  // Form Fields & Modals
  "الاسم الكامل": "Full Name",
  "المؤسسة / الشركة": "Company / Organization",
  "الشركة / المؤسسة": "Company / Organization",
  "رقم الهاتف": "Phone Number",
  "العنوان": "Address",
  "البلدية": "Municipality",
  "المنطقة / الحي": "District / Sector",
  "العنوان / المنطقة / الحي": "Address / District",
  "ملاحظات": "Notes",
  "ملاحظات عامة": "General Notes",
  "اختر الولاية": "Select Province (Wilaya)",
  "اختر البلدية": "Select Municipality",
  "اختر النشاط": "Select Business Field",
  "اختر التخصص": "Select Specialty",
  "النشاط الرئيسي": "Main Activity",
  "تخصص النشاط": "Activity Specialty",
  "حالة العقد والارتباط": "Contract Status",
  "الحالة": "Status",
  "آخر تواصل": "Last Contact",
  "تاريخ البداية": "Start Date",
  "تاريخ النهاية": "End Date",
  "تاريخ البداية / التثبيت": "Start / Installation Date",
  "تاريخ الانتهاء": "Expiration Date",
  "اتركه فارغاً إذا كان مدى الحياة": "Leave empty for lifetime license",
  "عدد الأجهزة": "Device Count",
  "عدد الأجهزة المرخصة": "Licensed Devices",
  "البرنامج / المنتج *": "Software / Product *",
  "المنصة": "Platform",
  "نوع البرنامج": "Software Type",
  "النوع": "Type",
  "📦 تسجيل أول برنامج ترخيص (اختياري للعميل النشط)": "📦 Register First Software License (Optional)",
  "اسم البرنامج المرخص": "Licensed Software Name",
  "تعديل البرنامج": "Edit Software",
  "إضافة برنامج جديد": "Add New Software",
  "إضافة البرنامج": "Add Software",

  // Issues & Tickets
  "المشاكل والتذاكر": "Issues & Support Tickets",
  "+ مشكلة جديدة": "+ New Ticket",
  "تعديل المشكلة": "Edit Ticket",
  "تسجيل مشكلة جديدة": "Log New Issue",
  "عنوان المشكلة باختصار *": "Issue Title *",
  "نوع المشكلة": "Issue Type",
  "المصدر": "Source",
  "أولوية المشكلة": "Ticket Priority",
  "حالة المشكلة": "Ticket Status",
  "نسبة الثقة التقريبية (%)": "Confidence Level (%)",
  "ملاحظات تقنية / تشخيص": "Technical Notes / Diagnosis",
  "الحل المقترح أو المنفذ": "Proposed or Applied Solution",
  "فرصة ميزة جديدة في المنظومة": "New System Feature Opportunity",
  "مشاكل مفتوحة": "Open Tickets",
  "فرص ميزات": "Opportunities",
  "لا توجد مشاكل مسجلة لهذا العميل": "No issues recorded for this client",
  "تسجيل أول مشكلة": "Log First Issue",
  "✓ تم الحل": "✓ Resolved",
  "ثقة": "confidence",
  "فرصة ميزة": "Feature Opportunity",
  "الحل:": "Solution:",

  // Requirements
  "المتطلبات والاقتراحات": "Requirements & Feedback",
  "+ طلب جديد": "+ New Request",
  "تعديل الطلب": "Edit Request",
  "تسجيل طلب أو ميزة جديدة": "Record Requirement or Feature",
  "عنوان الطلب *": "Request Title *",
  "نوع الطلب": "Request Type",
  "الأثر المتوقع": "Expected Impact",
  "أولوية التنفيذ": "Implementation Priority",
  "حالة الطلب": "Request Status",
  "تفاصيل الطلب ومبرراته": "Details and Justifications",
  "لا توجد متطلبات مسجلة": "No requirements recorded",
  "تسجيل أول طلب": "Record First Request",
  "تأثير": "Impact",

  // Contacts
  "سجل الاتصال": "Contact History",
  "📞 التواصل": "📞 Contacts",
  "سجلات تواصل": "Contact Logs",
  "تواصل مسجل": "recorded contacts",
  "+ تسجيل تواصل": "+ Log Contact",
  "تسجيل تواصل مع العميل": "Log Client Communication",
  "طريقة التواصل": "Contact Method",
  "ملاحظات التواصل": "Interaction Notes",
  "لا توجد سجلات تواصل بعد": "No contact logs yet",
  "سجّل أول تواصل مع هذا العميل": "Record the first contact with this client",

  // Programs Tab & Badges
  "إجمالي البرامج": "Total Programs",
  "إجمالي الأجهزة": "Total Devices",
  "نشط /": "Active /",
  "منتهي": "Expired",
  "قائمة البرامج": "Software List",
  "+ برنامج جديد": "+ New Software",
  "لا توجد برامج مرتبطة بهذا العميل": "No software associated with this client",
  "إضافة أول برنامج": "Add First Software",
  "جهاز مُرخَّص": "licensed device(s)",
  "بدون انتهاء": "Lifetime License",
  "لا برامج": "No Software",
  "برامج": "software",
  "جهاز": "device(s)",

  // Timeline
  "الخط الزمني": "Timeline",
  "⏱️ الخط الزمني": "⏱️ Timeline",
  "الخط الزمني للنشاط": "Activity Timeline",
  "🔄 تحديث": "🔄 Refresh",
  "لا توجد أحداث مسجلة للعميل حتى الآن. سيتم تسجيل التفاعلات تلقائياً هنا.": "No activity recorded yet for this client. Events will appear here automatically.",
  "المنفذ:": "Actor:",

  // Report
  "التقرير": "Report",
  "📊 التقرير": "📊 Report",
  "مستوى الخطر": "Risk Level",
  "مستوى الفرصة": "Opportunity Level",
  "متطلبات": "Requirements",
  "🏢 الملف التجاري": "🏢 Business Profile",
  "📦 البرامج والتراخيص": "📦 Software & Licenses",
  "الفترة:": "Period:",
  "تاريخ التقرير:": "Report Date:",
  "خطر عالٍ": "High Risk",
  "تحت المراقبة": "Under Watch",
  "وضع مستقر": "Stable Status",
  "عالية": "High",
  "متوسطة": "Medium",
  "منخفضة": "Low",

  // Intelligence & Advisor
  "الذكاء": "Intelligence",
  "🧠 الذكاء": "🧠 Intelligence",
  "الذكاء الاصطناعي العالمي": "Global Intelligence",
  "تحليل ذكي تلقائي": "Automated Smart Analysis",
  "مرصاد PROGILIC الذكي": "PROGILIC Smart Sentinel",
  "تنبيهات استباقية وتوصيات وقائية مبنية على تحليل المخاطر": "Proactive alerts and preventive recommendations based on risk analysis",
  "مؤشر السلامة العامة": "Overall Health Index",
  "مؤشر السلامة العام": "Overall Health Index",
  "نقاط الصحة والتشغيل": "Health & Operations",
  "نقاط العميل": "Client Score",
  "عميل متميز": "Top Tier Client",
  "عميل جيد": "Good Client",
  "يحتاج متابعة": "Needs Follow-up",
  "خطر عالي": "Critical Risk",
  "ممتاز": "Excellent",
  "مستقر": "Stable",
  "متابعة": "Attention",
  "خطر": "Critical",

  // Dashboard & Metrics
  "أهلاً بك في منصة إدارة العملاء": "Welcome to the CRM Platform",
  "تبدو لوحة التحكم فارغة حالياً. ابدأ بإضافة أول عميل لك لتتمكن من تتبع البرامج، التراخيص، وإدارة تذاكر الدعم الفني بكل سهولة.": "The dashboard is currently empty. Start by adding your first client to easily track software licenses, programs, and support tickets.",
  "المشاكل المفتوحة": "Open Tickets",
  "تراخيص فعالة": "Active Licenses",
  "تنبيهات النظام": "System Alerts",
  "إجمالي العملاء": "Total Clients",
  "الأجهزة المرخصة": "Licensed Devices",
  "الطلبات المعلقة": "Pending Tickets",
  "البرامج المرخصة": "Licensed Software",
  "الطلبات الفنية المعلقة": "Pending Support Requests",
  "الولاية الجغرافية": "Geographic Region",
  "آخر نشاط": "Last Activity",
  "الملف": "Profile",
  "استعراض": "View",
  "اسم الشريك والشركة": "Partner & Company Name",
  "لوحة القيادة والمؤشرات الاستراتيجية": "Strategic Dashboard & KPIs",
  "نظام المراقبة الاستباقية والتحليلات المتطورة للمنظومة": "Proactive Monitoring & Advanced CRM Analytics",
  "التوزيع الجغرافي للعملاء": "Geographic Distribution of Clients",
  "توزيع البرامج والتراخيص": "Software & License Distribution",
  "تحليل مؤشر الصحة التشغيلية": "Operational Health Index Analysis",
  "قائمة المتابعة الاستباقية للعملاء": "Proactive Client Watchlist",
  "العميل والمؤسسة": "Client & Company",
  "البرامج والتراخيص": "Programs & Licenses",
  "الطلبات": "Tickets",
  "الصحة": "Health",
  "الإجراء": "Action",
  "جميع الولايات": "All Provinces",
  "جميع البرامج": "All Software",
  "جميع الفئات": "All Tiers",

  // Business Activities & Specialties
  "تجارة جملة": "Wholesale Trade",
  "تجارة تجزئة": "Retail Trade",
  "مواد التغليف والتعليب والحلويات بالجملة": "Packaging, packing materials & confectionery (wholesale)",
  "مواد التغليف والتعليب والحلويات بالتجزئة": "Packaging, packing materials & confectionery (retail)",
  "مواد غذائية بالجملة": "Food products (wholesale)",
  "إلكترونيات بالجملة": "Electronics (wholesale)",
  "ملابس وأقمشة بالجملة": "Clothing and fabrics (wholesale)",
  "مواد بناء بالجملة": "Building materials (wholesale)",
  "أدوية وشبه صيدلاني بالجملة": "Medicines and parapharmaceuticals (wholesale)",
  "أخرى (جملة)": "Other (wholesale)",
  "سوبرماركت / بقالة": "Supermarket / Grocery store",
  "محل ملابس وأزياء": "Clothing and fashion store",
  "عطور وتجميل": "Perfumes and beauty products",
  "خردوات ومواد بناء": "Hardware and building materials",
  "أثاث ومفروشات": "Furniture and furnishings",
  "قطع غيار سيارات": "Automotive parts",
  "إلكترونيات وكهرومنزلية": "Electronics and home appliances",
  "أخرى (تجزئة)": "Other (retail)",
  "وكالة سياحة وأسفار": "Tourism and travel agency",
  "وكالة إعلانات واتصال": "Advertising and communications agency",
  "خدمات تنظيف وصيانة": "Cleaning and maintenance services",
  "خدمات استشارية": "Consulting services",
  "كراء السيارات": "Car rental",
  "أخرى (خدمات)": "Other (services)",
  "صناعة غذائية": "Food manufacturing",
  "صناعة بلاستيك": "Plastics manufacturing",
  "صناعة نسيج": "Textile manufacturing",
  "صناعة معدنية": "Metal manufacturing",
  "أخرى (صناعة)": "Other (manufacturing)",
  "مطعم تقليدي": "Traditional restaurant",
  "وجبات سريعة": "Fast food",
  "مقهى / قاعة شاي": "Cafe / Tea room",
  "فندق / نزل": "Hotel / Inn",
  "قاعة حفلات": "Event venue",
  "أخرى (إطعام)": "Other (food service)",
  "صيدلية / شبه صيدلي": "Pharmacy / Parapharmacy",
  "عيادة طبية": "Medical clinic",
  "مخبر تحاليل": "Medical testing laboratory",
  "عيادة أسنان": "Dental clinic",
  "أخرى (صحة)": "Other (healthcare)",
  "مدرسة خاصة": "Private school",
  "معهد تكوين": "Training institute",
  "مدرسة لغات": "Language school",
  "أخرى (تعليم)": "Other (education)",
  "ترقية عقارية": "Real estate development",
  "مقاولات بناء": "Construction contractor",
  "مكتب دراسات": "Engineering and consulting office",
  "أخرى (بناء)": "Other (construction)",
  "نقل بضائع": "Freight transport",
  "نقل مسافرين": "Passenger transport",
  "خدمات توصيل": "Delivery services",
  "أخرى (نقل)": "Other (transport)",
  "إنتاج زراعي": "Agricultural production",
  "تربية مواشي ودواجن": "Livestock and poultry farming",
  "أخرى (زراعة)": "Other (agriculture)",
  "برمجيات وتطوير": "Software and development",
  "بيع وصيانة حواسيب": "Computer sales and maintenance",
  "أخرى (تقنية)": "Other (technology)",
  "وكالة تأمين": "Insurance agency",
  "مكتب محاسبة": "Accounting firm",
  "أخرى (مالية)": "Other (finance)",
  "نشاط غير مصنف": "Unclassified activity",
  "شركة خدمات": "Services Company",
  "صناعة / تصنيع": "Industry / Manufacturing",
  "مطاعم وفنادق": "Hospitality & Dining",
  "صحة وصيدلة": "Healthcare & Pharma",
  "تعليم وتكوين": "Education & Training",
  "بناء وعقارات": "Construction & Real Estate",
  "نقل ولوجستيك": "Transport & Logistics",
  "زراعة وأغذية": "Agriculture & Food",
  "تقنية ومعلوماتية": "Tech & IT Solutions",
  "مالية وتأمين": "Finance & Insurance",
  "أخرى": "Others",

  // Program Types & Platforms
  "تجاري": "Commercial",
  "إنتاجي": "Production",
  "لوحة تحكم": "Dashboard",
  "خدمي": "Services",

  // Priorities & Issue Statuses
  "أولوية": "Priority",
  "عاجل": "Urgent",
  "عالية": "High",
  "عالي": "High",
  "متوسطة": "Medium",
  "متوسط": "Medium",
  "منخفضة": "Low",
  "منخفض": "Low",
  "مفتوح": "Open",
  "قيد المعالجة": "In Progress",
  "محلول": "Resolved",
  "مقترح": "Proposed",
  "قيد الدراسة": "Under Review",
  "مخطط": "Planned",
  "منفذ": "Completed",
  "مرفوض": "Rejected",
  "خطأ تقني": "Bug / Issue",
  "أداء": "Performance",
  "استفسار": "Support / Inquiry",
  "طلب ميزة": "Feature Request",
  "خطأ مستخدم": "User Mistake",
  "نظام": "System",
  "عميل": "Client",
  "سوء استخدام": "Misuse",
  "شبكة": "Network",
  "غير محدد": "Unspecified",
  "ميزة جديدة": "New Feature",
  "تحسين": "Enhancement",

  // Sync & Storage Bar
  "وضع الأوفلاين": "Offline Mode",
  "عمليات محلياً": "operations saved locally",
  "جاري رفع المزامنة": "Syncing changes",
  "عمليات معلقة": "pending operations",
  "خطأ في المزامنة، سيتم إعادة المحاولة...": "Sync error, retrying automatically...",
  "تم المزامنة تلقائياً": "Synced with Cloud",
  "متصل بالسحابة": "Connected to Cloud",
  "النسخ الاحتياطية المؤرشفة": "Archived Backups",
  "إدارة النسخ الاحتياطية": "Backup Manager",
  "إنشاء نسخة الآن": "Create Backup Now",

  // Danger Zone
  "منطقة الخطر": "Danger Zone",
  "حذف هذا العميل يحذف جميع مشاكله ومتطلباته نهائياً ولا يمكن التراجع": "Deleting this client will permanently erase all associated data (irreversible).",
  "حذف العميل نهائياً": "Permanently Delete Client",

  // AI Assistant Widget
  "المساعد الذكي": "Smart Assistant",
  "مساعد CRM الذكي": "Smart CRM Assistant",
  "أمر صوتي أو نصي لتشغيل المنظومة": "Voice or text command to operate the CRM",
  "اكتب أمراً أو استفساراً...": "Type a command or query...",
  "تحدث الآن...": "Speak now...",
  "تنفيذ الإجراء": "Execute Action",
  "استمع": "Listen",
  "الذكاء الاصطناعي": "Artificial Intelligence",

  // Auth Screen
  "تسجيل الدخول": "Sign In",
  "إنشاء حساب جديد": "Create Account",
  "أهلاً بك مجدداً! يرجى إدخال بياناتك للوصول إلى لوحة التحكم.": "Welcome back! Please enter your credentials to access the CRM.",
  "سجل بياناتك للانضمام إلى منصة PROGILIC CRM.": "Register your details to join the PROGILIC CRM platform.",
  "البريد الإلكتروني للشركة": "Work email address",
  "البريد الإلكتروني": "Email address",
  "الاسم الكامل": "Full name",
  "كلمة المرور": "Password",
  "كلمة المرور الجديدة": "New password",
  "تأكيد كلمة المرور الجديدة": "Confirm new password",
  "تذكرني": "Remember me",
  "نسيت كلمة المرور؟": "Forgot password?",
  "أو الدخول بواسطة": "Or sign in with",
  "أو التسجيل بواسطة": "Or register with",
  "قوة كلمة المرور:": "Password Strength:",
  "قصيرة جداً": "Too short",
  "ضعيفة": "Weak",
  "متوسطة": "Medium",
  "قوية": "Strong",
  "قوية جداً": "Very strong",
  "إنشاء الحساب وتفعيل البريد": "Create Account & Send Verification",
  "استعادة كلمة المرور": "Password Reset",
  "إعادة تعيين كلمة المرور": "Reset Password",
  "أدخل بريدك الإلكتروني المسجل وسنقوم بإرسال رابط فوري لإعادة تعيين كلمة المرور الخاصة بك.": "Enter your registered email and we will send an instant link to reset your password.",
  "إرسال رابط إعادة التعيين": "Send Reset Link",
  "العودة لصفحة تسجيل الدخول": "Back to Login",
  "تعيين كلمة المرور الجديدة": "Set New Password",
  "يرجى تعيين كلمة مرور قوية وجديدة لحسابك المسجل:": "Please set a strong new password for your registered account:",
  "حفظ كلمة المرور الجديدة": "Save New Password",
  "إلغاء والعودة للدخول": "Cancel & Return to Login",
  "تفعيل الحساب مطلوب": "Account Verification Required",
  "لقد أرسلنا رابط تفعيل إلى البريد الإلكتروني:": "We have sent a verification link to the email address:",
  "التعليمات:": "Instructions:",
  "1. افتح علبة الوارد لبريدك الإلكتروني واضغط على الرابط المرسل لتفعيل حسابك.": "1. Open your inbox and click the verification link sent to activate your account.",
  "2. إذا تم التفعيل بنجاح، انقر على زر \"التحقق من حالة التفعيل\" بالأسفل.": "2. Once activated, click \"Check Verification Status & Enter\" below.",
  "3. إذا لم تصلك الرسالة بعد بضع دقائق، تفقّد مجلد \"الرسائل غير المرغوب فيها (Spam)\" أو اضغط على \"إعادة إرسال رابط التفعيل\".": "3. If not received within a few minutes, check your Spam folder or click \"Resend Link\".",
  "⚡ التحقق من حالة التفعيل والدخول": "⚡ Check Verification Status & Enter",
  "✉️ إعادة إرسال الرابط": "✉️ Resend Link",
  "🚪 تسجيل الخروج": "🚪 Log Out",
  "التحقق من حالة التفعيل والدخول": "Verify Status & Enter",
  "إعادة إرسال الرابط": "Resend Link",
  "لوحة التحكم والمتابعة الذكية وإدارة علاقات العملاء في بيئة سحابية فائقة الأداء وعالية الأمان.": "Intelligent dashboard and enterprise CRM in a high-performance, ultra-secure cloud environment.",
  "جاري تسجيل الدخول...": "Signing in...",
  "جاري إنشاء الحساب...": "Creating account...",
  "يرجى إدخال البريد الإلكتروني وكلمة المرور.": "Please enter your email and password.",
  "يرجى استخدام كلمة مرور أقوى (متوسطة على الأقل).": "Please use a stronger password (at least medium).",
  "تم إنشاء الحساب بنجاح وإرسال بريد تفعيل الحساب!": "Account created successfully and verification email sent!",
  "تم إنشاء الحساب ولكن فشل إرسال بريد التفعيل: ": "Account created but failed to send verification email: ",
  "حدث خطأ أثناء إنشاء حسابك.": "An error occurred while creating your account.",
  "البريد الإلكتروني مستخدم بالفعل. يرجى تسجيل الدخول.": "Email is already in use. Please sign in.",
  "البريد الإلكتروني غير صحيح.": "Invalid email address.",
  "صيغة البريد الإلكتروني غير صحيحة.": "Invalid email format.",
  "كلمة المرور ضعيفة للغاية.": "Password is too weak.",
  "يرجى تفعيل بريدك الإلكتروني أولاً للوصول إلى النظام.": "Please verify your email first to access the system.",
  "تم تسجيل الدخول بنجاح!": "Signed in successfully!",
  "البريد الإلكتروني أو كلمة المرور غير صحيحة.": "Incorrect email or password.",
  "جاري إرسال رابط إعادة التعيين...": "Sending reset link...",
  "تم إرسال بريد إعادة تعيين كلمة المرور بنجاح. يرجى مراجعة بريدك الوارد.": "Password reset email sent successfully. Please check your inbox.",
  "فشل إرسال بريد إعادة التعيين.": "Failed to send reset email.",
  "لا يوجد حساب مسجل بهذا البريد الإلكتروني.": "No account registered with this email.",
  "جاري الإرسال...": "Sending...",
  "تم إعادة إرسال رابط التفعيل بنجاح. يرجى تفقّد بريدك الإلكتروني.": "Verification link resent successfully. Please check your email.",
  "لم نتمكن من العثور على حسابك الحالي.": "Unable to find your current account.",
  "تم إرسال عدد كبير من طلبات التفعيل مؤخراً. يرجى الانتظار دقيقة قبل المحاولة مرة أخرى.": "Too many requests recently. Please wait a minute before trying again.",
  "جاري التحقق...": "Verifying...",
  "تم تفعيل حسابك بنجاح! جاري تحميل البيانات...": "Account verified successfully! Loading data...",
  "لم يتم تفعيل البريد الإلكتروني بعد. يرجى فتح الرسالة المرسلة وتأكيد حسابك.": "Email not verified yet. Please open the email sent to confirm your account.",
  "تم إلغاء عملية الدخول بواسطة المستخدم.": "Sign in cancelled by user.",
  "فشل تسجيل الدخول باستخدام Google: ": "Failed to sign in with Google: ",
  "فشل تسجيل الدخول باستخدام Facebook: ": "Failed to sign in with Facebook: ",
  "كلمتا المرور غير متطابقتين.": "Passwords do not match.",
  "اللغة": "Language",
  "العربية": "Arabic",
  "الفرنسية": "French",
  "الإنجليزية": "English"
};

const extraTranslations = {
  "👑 لوحة تحكم المسؤول العام (الرئيس)": ["👑 Tableau de bord du gérant", "👑 Administrator dashboard"],
  "إدارة المستخدمين والصلاحيات الـ 68": ["Gestion des utilisateurs et des 68 autorisations", "User and all 68 permissions management"],
  "＋ إضافة مستخدم جديد": ["＋ Ajouter un nouvel utilisateur", "＋ Add new user"],
  "المعرف": ["Identifiant", "ID"],
  "التاريخ والوقت": ["Date et heure", "Date and time"],
  "اسم المستخدم": ["Nom d'utilisateur", "Username"],
  "القسم / المنصب": ["Département / poste", "Department / position"],
  "نوع العملية": ["Type d'opération", "Activity type"],
  "القسم": ["Département", "Department"],
  "العميل": ["Client", "Client"],
  "عنوان الإجراء": ["Titre de l'action", "Action title"],
  "تفاصيل العملية": ["Détails de l'opération", "Activity details"],
  "تم إلغاء عملية تسجيل الدخول.": ["Connexion annulée.", "Sign-in was cancelled."],
  "تعذر الاتصال بخوادم المصادقة. يرجى التحقق من اتصال الإنترنت.": ["Impossible de joindre les serveurs d'authentification. Vérifiez votre connexion Internet.", "Could not reach authentication servers. Check your internet connection."],
  "تم حظر النافذة المنبثقة. يرجى السماح بالنوافذ المنبثقة في المتصفح.": ["La fenêtre contextuelle a été bloquée. Autorisez les fenêtres contextuelles dans votre navigateur.", "The pop-up was blocked. Allow pop-ups in your browser."],
  "فشل تسجيل الدخول بـ Google: ": ["Échec de la connexion avec Google : ", "Google sign-in failed: "],
  "إنشاء نسخة احتياطية": ["Créer une sauvegarde", "Create Backup"],
  "تم إنشاء النسخة الاحتياطية بنجاح!": ["Sauvegarde créée avec succès !", "Backup created successfully!"],
  "فشل إنشاء النسخة الاحتياطية.": ["Échec de la création de la sauvegarde.", "Failed to create backup."],
  "تأكيد الاسترجاع": ["Confirmer la restauration", "Confirm Restore"],
  "حذف نسخة احتياطية": ["Supprimer la sauvegarde", "Delete Backup"],
  "تم حذف النسخة الاحتياطية بنجاح.": ["Sauvegarde supprimée avec succès.", "Backup deleted successfully."],
  "تأكيد الحذف": ["Confirmer la suppression", "Confirm Deletion"],
  "الرجاء اختيار اسم البرنامج": ["Veuillez sélectionner un nom de logiciel.", "Please select a software name."],
  "الرجاء إدخال اسم العميل": ["Veuillez saisir le nom du client.", "Please enter the client name."],
  "تم تحديث بيانات العميل": ["Les données du client ont été mises à jour.", "Client information updated."],
  "تم إضافة العميل بنجاح": ["Client ajouté avec succès.", "Client added successfully."],
  "حذف العميل": ["Supprimer le client", "Delete Client"],
  "المتصفح لا يدعم تحديد الموقع الجغرافي": ["La géolocalisation n'est pas prise en charge par ce navigateur.", "Geolocation is not supported by this browser."],
  "تعذر تحديد الموقع: ": ["Impossible de déterminer la position : ", "Could not determine location: "],
  "تأكد من منح الإذن للمتصفح": ["Vérifiez que l'autorisation a été accordée au navigateur.", "Make sure the browser has permission."],
  "فشلت عملية المحو: ": ["Échec de l'effacement : ", "Clear operation failed: "],
  "يرجى إدخال كلمة المرور للمتابعة.": ["Veuillez saisir le mot de passe pour continuer.", "Please enter your password to continue."],
  "الموظف غير موجود في هذا الحساب.": ["Cet employé n'existe pas dans ce compte.", "Employee not found in this account."],
  "كلمة المرور غير صحيحة. يرجى إدخال كلمة المرور الصحيحة.": ["Mot de passe incorrect. Veuillez saisir le bon mot de passe.", "Incorrect password. Please enter the correct password."],
  "مرحباً بك، ": ["Bienvenue, ", "Welcome, "],
  "تم التبديل وتجربة حساب: ": ["Le compte a été changé et testé : ", "Switched to and tested account: "],
  "تم تسجيل خروج الموظف وفتح بوابة تبديل المستخدمين.": ["L'employé a été déconnecté et le portail de changement d'utilisateur est ouvert.", "Employee signed out and the user-switching portal opened."],
  "عذراً، فقط المسؤول العام (GERANT) يمكنه الوصول إلى لوحة إدارة الصلاحيات والبيانات.": ["Désolé, seul le gérant peut accéder au panneau de gestion des autorisations et des données.", "Sorry, only the administrator can access permission and data management."],
  "عذراً، فقط المسؤول العام (GERANT) يمكنه تعديل أو إضافة بيانات الموظفين والأقسام.": ["Désolé, seul le gérant peut modifier ou ajouter des employés et des départements.", "Sorry, only the administrator can edit or add employee and department data."],
  "تم حفظ بيانات الموظف بنجاح في قاعدة البيانات!": ["Les données de l'employé ont été enregistrées avec succès.", "Employee data saved successfully."],
  "عذراً، فقط المسؤول العام (GERANT) يمكنه حذف الموظفين.": ["Désolé, seul le gérant peut supprimer des employés.", "Sorry, only the administrator can delete employees."],
  "لا يمكن حذف حساب المسؤول العام (Gérant).": ["Le compte du gérant ne peut pas être supprimé.", "The administrator account cannot be deleted."],
  "عذراً، فقط المسؤول العام (GERANT) يمكنه تعديل الصلاحيات.": ["Désolé, seul le gérant peut modifier les autorisations.", "Sorry, only the administrator can change permissions."],
  "تم تحديث الصلاحية بنجاح": ["Autorisation mise à jour avec succès.", "Permission updated successfully."],
  "تم منح جميع الصلاحيات بنجاح": ["Toutes les autorisations ont été accordées.", "All permissions granted successfully."],
  "تم إلغاء جميع الصلاحيات": ["Toutes les autorisations ont été révoquées.", "All permissions revoked."],
  "تم منح صلاحيات المجموعة بنجاح": ["Les autorisations du groupe ont été accordées.", "Group permissions granted successfully."],
  "تم إلغاء صلاحيات المجموعة": ["Les autorisations du groupe ont été révoquées.", "Group permissions revoked."],
  "⚠️ لا تملك صلاحية إنشاء نسخ احتياطية.": ["⚠️ Vous n'êtes pas autorisé à créer des sauvegardes.", "⚠️ You do not have permission to create backups."],
  "⚠️ لا تملك صلاحية استرجاع واستيراد البيانات.": ["⚠️ Vous n'êtes pas autorisé à restaurer ou importer des données.", "⚠️ You do not have permission to restore or import data."],
  "⚠️ لا تملك صلاحية تحميل ملفات النسخ الاحتياطي.": ["⚠️ Vous n'êtes pas autorisé à télécharger les sauvegardes.", "⚠️ You do not have permission to download backups."],
  "⚠️ لا تملك صلاحية حذف النسخ الاحتياطية.": ["⚠️ Vous n'êtes pas autorisé à supprimer les sauvegardes.", "⚠️ You do not have permission to delete backups."],
  "⚠️ لا تملك صلاحية حذف البرامج والتراخيص.": ["⚠️ Vous n'êtes pas autorisé à supprimer des logiciels et licences.", "⚠️ You do not have permission to delete software and licenses."],
  "⚠️ لا تملك صلاحية إضافة برامج وتراخيص جديدة.": ["⚠️ Vous n'êtes pas autorisé à ajouter des logiciels et licences.", "⚠️ You do not have permission to add software and licenses."],
  "⚠️ لا تملك صلاحية تعديل بيانات البرامج والتراخيص.": ["⚠️ Vous n'êtes pas autorisé à modifier les logiciels et licences.", "⚠️ You do not have permission to edit software and licenses."],
  "⚠️ لا تملك صلاحية تسجيل تواصل جديد.": ["⚠️ Vous n'êtes pas autorisé à enregistrer un nouveau contact.", "⚠️ You do not have permission to record a new contact."],
  "⚠️ لا تملك صلاحية حذف سجلات التواصل.": ["⚠️ Vous n'êtes pas autorisé à supprimer l'historique des contacts.", "⚠️ You do not have permission to delete contact history."],
  "⚠️ لا تملك صلاحية تسجيل مشاكل جديدة.": ["⚠️ Vous n'êtes pas autorisé à enregistrer de nouveaux problèmes.", "⚠️ You do not have permission to create new issues."],
  "⚠️ لا تملك صلاحية تعديل المشاكل والتذاكر.": ["⚠️ Vous n'êtes pas autorisé à modifier les problèmes et tickets.", "⚠️ You do not have permission to edit issues and tickets."],
  "⚠️ لا تملك صلاحية حل وإغلاق تذاكر المشاكل.": ["⚠️ Vous n'êtes pas autorisé à résoudre et clôturer des tickets.", "⚠️ You do not have permission to resolve and close issue tickets."],
  "⚠️ لا تملك صلاحية حذف تذاكر المشاكل.": ["⚠️ Vous n'êtes pas autorisé à supprimer des tickets.", "⚠️ You do not have permission to delete issue tickets."],
  "⚠️ لا تملك صلاحية تسجيل طلبات أو متطلبات جديدة.": ["⚠️ Vous n'êtes pas autorisé à enregistrer de nouvelles demandes.", "⚠️ You do not have permission to create new requests."],
  "⚠️ لا تملك صلاحية تعديل المتطلبات والطلبات.": ["⚠️ Vous n'êtes pas autorisé à modifier les demandes et exigences.", "⚠️ You do not have permission to edit requests and requirements."],
  "⚠️ لا تملك صلاحية حذف المتطلبات والطلبات.": ["⚠️ Vous n'êtes pas autorisé à supprimer les demandes et exigences.", "⚠️ You do not have permission to delete requests and requirements."],
  "⚠️ لا تملك صلاحية إضافة عميل جديد. الصلاحية مقتصرة ومحددة من طرف الرئيس (Gérant).": ["⚠️ Vous n'êtes pas autorisé à ajouter un client. Cette permission est réservée au gérant.", "⚠️ You cannot add a client. This permission is restricted to the administrator."],
  "⚠️ لا تملك صلاحية تعديل بيانات العملاء.": ["⚠️ Vous n'êtes pas autorisé à modifier les données clients.", "⚠️ You do not have permission to edit client data."],
  "⚠️ لا تملك صلاحية تعديل البرامج والتراخيص.": ["⚠️ Vous n'êtes pas autorisé à modifier les logiciels et licences.", "⚠️ You do not have permission to edit software and licenses."],
  "⚠️ لا تملك صلاحية تسجيل مشاكل أو تذاكر جديدة.": ["⚠️ Vous n'êtes pas autorisé à enregistrer de nouveaux problèmes ou tickets.", "⚠️ You do not have permission to create new issues or tickets."],
  "⚠️ لا تملك صلاحية تعديل بيانات التذاكر.": ["⚠️ Vous n'êtes pas autorisé à modifier les tickets.", "⚠️ You do not have permission to edit tickets."],
  "⚠️ لا تملك صلاحية تسجيل متطلبات أو ميزات جديدة.": ["⚠️ Vous n'êtes pas autorisé à enregistrer de nouvelles exigences ou fonctionnalités.", "⚠️ You do not have permission to create requirements or feature requests."],
  "⚠️ لا تملك صلاحية تعديل متطلبات التطوير.": ["⚠️ Vous n'êtes pas autorisé à modifier les exigences de développement.", "⚠️ You do not have permission to edit development requirements."],
  "⚠️ لا تملك صلاحية تسجيل تواصل أو مكالمة جديدة.": ["⚠️ Vous n'êtes pas autorisé à enregistrer un contact ou appel.", "⚠️ You do not have permission to record a contact or call."],
  "⚠️ لا تملك صلاحية استعراض النسخ الاحتياطية.": ["⚠️ Vous n'êtes pas autorisé à consulter les sauvegardes.", "⚠️ You do not have permission to view backups."],
  "⚠️ تعديل وإضافة المستخدمين محجوز حصرياً للرئيس (Gérant).": ["⚠️ Seul le gérant peut modifier et ajouter des utilisateurs.", "⚠️ Only the administrator can edit and add users."],
  "⚠️ لا تملك صلاحية تصدير البيانات. يتم ضبط الصلاحيات من طرف الرئيس (Gérant).": ["⚠️ Vous n'êtes pas autorisé à exporter les données. Les autorisations sont gérées par le gérant.", "⚠️ You do not have permission to export data. Permissions are managed by the administrator."],
  "الرجاء اختيار تاريخ التواصل": ["Veuillez sélectionner la date du contact.", "Please select the contact date."],
  "الرجاء إدخال ملاحظة التواصل": ["Veuillez saisir une note de contact.", "Please enter a contact note."],
  "الرجاء إدخال عنوان المشكلة": ["Veuillez saisir le titre du problème.", "Please enter an issue title."],
  "حل التذكرة": ["Résoudre le ticket", "Resolve Ticket"],
  "تم الحل": ["Résolu", "Resolved"],
  "الرجاء إدخال عنوان الطلب": ["Veuillez saisir le titre de la demande.", "Please enter a request title."],
  "ليس لديك صلاحية عرض الخط الزمني للعميل": ["Vous n'êtes pas autorisé à consulter la chronologie du client.", "You do not have permission to view the client timeline."],
  "تم تحديث المخطط الزمني وسجل العمليات بنجاح": ["La chronologie et le journal des opérations ont été mis à jour.", "Timeline and activity log updated successfully."],
  "لا توجد عمليات لتصديرها وفق الفلاتر الحالية": ["Aucune opération à exporter avec les filtres actuels.", "No activities match the current filters for export."],
  "تم تصدير تقرير المخطط الزمني بنجاح!": ["Rapport chronologique exporté avec succès !", "Timeline report exported successfully!"],
  "ليس لديك صلاحية عرض المخطط الزمني": ["Vous n'êtes pas autorisé à consulter la chronologie.", "You do not have permission to view the timeline."],
  "فشل التصدير: ": ["Échec de l'exportation : ", "Export failed: "],
  "فشل تصدير CSV: ": ["Échec de l'exportation CSV : ", "CSV export failed: "],
  "الملف فارغ أو غير صالح": ["Le fichier est vide ou invalide.", "The file is empty or invalid."],
  "تعذر قراءة بيانات العملاء من ملف الـ DUM / JSON. تأكد من صحة تنسيق الملف.": ["Impossible de lire les données clients du fichier DUM / JSON. Vérifiez son format.", "Could not read client data from the DUM / JSON file. Check the file format."],
  "الملف لا يحتوي على بيانات عملاء صالحة": ["Le fichier ne contient aucune donnée client valide.", "The file contains no valid client data."],
  "استيراد البيانات": ["Importer les données", "Import Data"],
  "خطأ في الاستيراد: ": ["Erreur d'importation : ", "Import error: "],
  "مسح جميع البيانات": ["Effacer toutes les données", "Clear All Data"],
  "تأكيد الحذف النهائي": ["Confirmer la suppression définitive", "Confirm Permanent Deletion"],
  "حدث خطأ أثناء مسح البيانات: ": ["Une erreur est survenue lors de l'effacement des données : ", "An error occurred while clearing data: "],
  "المساعد الصوتي": ["Assistant vocal", "Voice Assistant"],
  "إدارة الصلاحيات (الرئيس)": ["Gestion des autorisations (Gérant)", "Permission Management (Administrator)"],
  "تنبيه نشط": ["Alerte active", "Active Alert"],
  "استيراد ملف JSON أو DUM": ["Importer un fichier JSON ou DUM", "Import JSON or DUM File"],
  "استيراد (.json / .dum)": ["Importer (.json / .dum)", "Import (.json / .dum)"],
  "يرجى إدخال كلمة المرور للمتابعة. لا يمكن الدخول بدون التحقق من كلمة المرور.": ["Veuillez saisir le mot de passe pour continuer. La vérification est obligatoire.", "Enter your password to continue. Password verification is required."],
  "يرجى إدخال كلمة المرور الخاصة بحسابك للمتابعة.": ["Veuillez saisir le mot de passe de votre compte pour continuer.", "Enter your account password to continue."],
  "يرجى تفعيل بريدك الإلكتروني أو إعادة تسجيل الدخول للمتابعة.": ["Veuillez vérifier votre adresse e-mail ou vous reconnecter pour continuer.", "Verify your email or sign in again to continue."],
  "يرجى إدخال كلمة مرور جديدة لحسابك.": ["Veuillez saisir un nouveau mot de passe pour votre compte.", "Please enter a new password for your account."],
  "بيانات الدخول غير صحيحة. إذا كنت قد سجلت مسبقاً بواسطة Google، يرجى الضغط على زر 'متابعة باستخدام Google'.": ["Identifiants incorrects. Si vous vous êtes inscrit avec Google, cliquez sur « Continuer avec Google ».", "Invalid credentials. If you registered with Google, select 'Continue with Google'."],
  "تم تعطيل هذا الحساب من قبل إدارة النظام.": ["Ce compte a été désactivé par l'administration.", "This account has been disabled by system administration."],
  "تم حظر محاولات الدخول مؤقتاً لكثرة المحاولات الخاطئة. يرجى المحاولة لاحقاً.": ["Les tentatives de connexion sont temporairement bloquées après plusieurs échecs. Réessayez plus tard.", "Sign-in attempts are temporarily blocked after too many failures. Try again later."],
  "بوابة تسجيل دخول المستخدمين": ["Portail de connexion des utilisateurs", "User Sign-in Portal"],
  "التركيز على حساب الرئيس لإدخال كلمة المرور": ["Sélectionner le compte du gérant pour saisir le mot de passe", "Select the administrator account to enter its password"],
  "حساب الرئيس (كلمة المرور مطلوبة)": ["Compte du gérant (mot de passe requis)", "Administrator Account (Password Required)"],
  "تسجيل الخروج والعودة لصفحة التسجيل": ["Se déconnecter et retourner à la page de connexion", "Sign out and return to the sign-in page"],
  "الحساب المسجل:": ["Compte connecté :", "Signed-in account:"],
  "اختر حساب المستخدم وأدخل كلمة المرور الصحيحة للمتابعة. يتحكم الرئيس (GERANT) في تحديد وتوزيع الصلاحيات على المستخدمين.": ["Sélectionnez un compte et saisissez son mot de passe. Le gérant définit et attribue les autorisations.", "Select a user account and enter its password. The administrator assigns user permissions."],
  "مستخدم مسجل": ["utilisateur(s) enregistré(s)", "registered user(s)"],
  "تبديل المستخدم": ["Changer d'utilisateur", "Switch User"],
  "لغة الواجهة": ["Langue de l'interface", "Interface language"],
  "اللغة العربية": ["Arabe", "Arabic"],
  "اللغة الفرنسية": ["Français", "French"],
  "اللغة الإنجليزية": ["Anglais", "English"],
  "ابحث باسم العميل أو البريد الإلكتروني": ["Rechercher par nom de client ou e-mail", "Search by client name or email"],
  "لا توجد بيانات لعرضها": ["Aucune donnée à afficher", "No data to display"],
  "جاري التحميل...": ["Chargement...", "Loading..."],
  "إعادة المحاولة": ["Réessayer", "Try Again"],
  "العودة للواجهة الرئيسية": ["Retour à l'accueil", "Return to Home"],
  "إعادة تحميل الصفحة": ["Recharger la page", "Reload Page"],
  "خطأ في معالجة واجهة التطبيق": ["Erreur lors du traitement de l'interface", "Application interface error"],
  "تم تحديث واجهة المستخدم. يمكنك العودة للقائمة الرئيسية أو إعادة المحاولة.": ["L'interface a été mise à jour. Retournez à l'accueil ou réessayez.", "The interface was updated. Return to the main page or try again."],
  "عذراً، ليس لديك صلاحية عرض قائمة العملاء": ["Désolé, vous n'êtes pas autorisé à consulter la liste des clients.", "Sorry, you do not have permission to view the client list."],
  "عذراً، ليس لديك صلاحية عرض لوحة المعلومات الإحصائية": ["Désolé, vous n'êtes pas autorisé à consulter le tableau de bord.", "Sorry, you do not have permission to view the dashboard."],
  "البحث محجوز للمصرح لهم": ["La recherche est réservée aux utilisateurs autorisés.", "Search is restricted to authorized users."],
  "مدى الحياة (Licence à vie)": ["À vie", "Lifetime"],
  "مدى الحياة": ["À vie", "Lifetime"],
  "مشاكل مفتوحة": ["Problèmes ouverts", "Open Issues"],
  "برامج": ["Logiciels", "Software"],
  "سجلات تواصل": ["Historique des contacts", "Contact History"],
  "مستوى الخطر": ["Niveau de risque", "Risk Level"],
  "مستوى الفرصة": ["Niveau d'opportunité", "Opportunity Level"],
  "متطلبات": ["Exigences", "Requirements"],
  "🏢 الملف التجاري": ["🏢 Profil commercial", "🏢 Business Profile"],
  "النشاط:": ["Activité :", "Business:"],
  "الموقع:": ["Emplacement :", "Location:"],
  "الحالة:": ["Statut :", "Status:"],
  "العقد:": ["Contrat :", "Contract:"],
  "ملاحظات:": ["Notes :", "Notes:"],
  "📦 البرامج والتراخيص": ["📦 Logiciels et licences", "📦 Software and Licenses"],
  "لا توجد برامج مرتبطة": ["Aucun logiciel associé", "No linked software"],
  "🐛 تحليل المشاكل": ["🐛 Analyse des problèmes", "🐛 Issue Analysis"],
  "✅ لا توجد مشاكل مسجلة": ["✅ Aucun problème enregistré", "✅ No issues recorded"],
  "مشكلة محلولة": ["Problème résolu", "Resolved Issue"],
  "مشاكل متكررة (repeatCount ≥ 3) — تشير إلى خلل بنيوي": ["Problèmes récurrents (repeatCount ≥ 3) — possible défaut structurel", "Recurring issues (repeatCount ≥ 3) — potential structural defect"],
  "فرصة لتحويل مشكلة إلى ميزة منتج 💡": ["Possibilité de transformer un problème en fonctionnalité 💡", "Opportunity to turn an issue into a product feature 💡"],
  "المشاكل المفتوحة:": ["Problèmes ouverts :", "Open issues:"],
  "📞 تحليل التواصل": ["📞 Analyse des contacts", "📞 Contact Analysis"],
  "إجمالي التواصلات:": ["Total des contacts :", "Total Contacts:"],
  "خلال 30 يوم الأخيرة:": ["Au cours des 30 derniers jours :", "In the last 30 days:"],
  "آخر تواصل:": ["Dernier contact :", "Last Contact:"],
  "آخر ملاحظة:": ["Dernière note :", "Latest Note:"],
  "⭐ تقييم العميل": ["⭐ Évaluation du client", "⭐ Client Rating"],
  "⚠️ ملف المخاطر": ["⚠️ Profil de risque", "⚠️ Risk Profile"],
  "✅ لا توجد مخاطر مكتشفة": ["✅ Aucun risque détecté", "✅ No risks detected"],
  "💡 فرص النمو": ["💡 Opportunités de croissance", "💡 Growth Opportunities"],
  "مستوى الفرصة:": ["Niveau d'opportunité :", "Opportunity Level:"],
  "عميل محتمل — لم يُغلق العقد بعد": ["Client potentiel — contrat non encore conclu", "Potential client — contract not yet closed"],
  "🤖 الملاحظة الذكية التلقائية": ["🤖 Note intelligente automatique", "🤖 Automated Smart Note"],
  "🎯 الإجراءات المقترحة": ["🎯 Actions suggérées", "🎯 Suggested Actions"],
  "🖨️ طباعة / تصدير PDF": ["🖨️ Imprimer / Exporter en PDF", "🖨️ Print / Export PDF"],
  "نتيجة العميل": ["Score du client", "Client Score"],
  "تقييم مبني على 4 محاور: برامج نشطة، تواصل، صحة المشاكل، قيمة المتطلبات": ["Évaluation basée sur 4 axes : logiciels actifs, contacts, état des problèmes et valeur des exigences", "Rating based on 4 factors: active software, contacts, issue health, and requirement value"],
  "ملف المخاطر": ["Profil de risque", "Risk Profile"],
  "تحليل المشاكل": ["Analyse des problèmes", "Issue Analysis"],
  "لا توجد مشاكل مسجلة لهذا العميل": ["Aucun problème enregistré pour ce client", "No issues recorded for this client"],
  "🔁 مشاكل متكررة — تحتاج حلاً جذرياً": ["🔁 Problèmes récurrents — une solution durable est nécessaire", "🔁 Recurring issues — a permanent solution is needed"],
  "💡 فرص تحويلها لميزات جديدة": ["💡 Possibilités de les transformer en nouvelles fonctionnalités", "💡 Opportunities to turn them into new features"],
  "📊 توزيع مصادر المشاكل": ["📊 Répartition des sources de problèmes", "📊 Issue Source Breakdown"],
  "✅ لا توجد مشاكل متكررة — الوضع جيد": ["✅ Aucun problème récurrent — tout va bien", "✅ No recurring issues — looking good"],
  "🔬 تحليل الجذر لكل مشكلة": ["🔬 Analyse des causes profondes", "🔬 Root Cause Analysis"],
  "تنبيهات خاصة بهذا العميل": ["Alertes pour ce client", "Client Alerts"],
  "✅ لا توجد تنبيهات نشطة لهذا العميل": ["✅ Aucune alerte active pour ce client", "✅ No active alerts for this client"],
  "🧠 لوحة الذكاء العالمي": ["🧠 Tableau d'intelligence globale", "🧠 Global Intelligence Dashboard"],
  "فرص ميزات": ["Opportunités de fonctionnalités", "Feature Opportunities"],
  "عملاء في خطر": ["Clients à risque", "At-Risk Clients"],
  "متوسط نقاط العملاء": ["Score moyen des clients", "Average Client Score"],
  "تنبيهات عاجلة": ["Alertes urgentes", "Urgent Alerts"],
  "⚠️ عملاء في وضع خطر": ["⚠️ Clients à risque élevé", "⚠️ At-Risk Clients"],
  "خطر عالي": ["Risque élevé", "High Risk"],
  "🔁 مشاكل متكررة عبر عدة عملاء — مشاكل نظامية": ["🔁 Problèmes récurrents chez plusieurs clients — problèmes systémiques", "🔁 Recurring issues across multiple clients — systemic issues"],
  "💡 فرص ميزات محتملة (من المشاكل)": ["💡 Opportunités de fonctionnalités potentielles (issues)", "💡 Potential Feature Opportunities (from Issues)"],
  "📋 أهم المتطلبات (مرتبة بالتأثير والأولوية)": ["📋 Principales exigences (par impact et priorité)", "📋 Top Requirements (by Impact and Priority)"],
  "عذراً، ليس لديك صلاحية عرض الخط الزمني للعميل": ["Désolé, vous n'êtes pas autorisé à consulter la chronologie du client.", "Sorry, you do not have permission to view the client timeline."],
  "📈 تقرير الإدارة عن الأنشطة": ["📈 Rapport de gestion des activités", "📈 Activity Management Report"],
  "تحليل العمليات الظاهرة وفق الفلاتر الحالية، وليس تقرير طباعة.": ["Analyse des opérations affichées selon les filtres actuels, et non un rapport imprimé.", "Analysis of visible activity using the current filters; this is not a print report."],
  "توزيع العمليات حسب القسم": ["Répartition des opérations par département", "Activities by Department"],
  "لا توجد عمليات ضمن الفلاتر الحالية.": ["Aucune opération ne correspond aux filtres actuels.", "No activities match the current filters."],
  "أكثر المستخدمين نشاطاً": ["Utilisateurs les plus actifs", "Most Active Users"],
  "لا يوجد مستخدمون ضمن النتائج.": ["Aucun utilisateur dans les résultats.", "No users in the results."],
  "حركة العمليات حسب اليوم": ["Activité par jour", "Activity by Day"],
  "لا توجد تواريخ صالحة لعرض الحركة اليومية.": ["Aucune date valide pour afficher l'activité quotidienne.", "No valid dates to display daily activity."],
  "أكثر أنواع الإجراءات تكراراً": ["Types d'actions les plus fréquents", "Most Frequent Action Types"],
  "لا توجد إجراءات ضمن النتائج.": ["Aucune action dans les résultats.", "No actions in the results."],
  "الموظفون والأقسام — PROGILIC": ["Employés et départements — PROGILIC", "Employees and Departments — PROGILIC"],
  "الأقسام الأربعة في PROGILIC": ["Les quatre départements de PROGILIC", "PROGILIC's Four Departments"],
  "انقر على أي قسم لتصفية موظفيه أو مراجعة اختصاصاته": ["Cliquez sur un département pour filtrer ses employés ou consulter ses fonctions.", "Select a department to filter its employees or review its responsibilities."],
  "القسم:": ["Département :", "Department:"],
  "الكل": ["Tous", "All"],
  "نشط": ["Actif", "Active"],
  "معطل": ["Désactivé", "Disabled"],
  "جدول الموظفين والصلاحيات الممنوحة": ["Tableau des employés et des autorisations accordées", "Employee and Granted Permissions Table"],
  "المدير العام يحدد ويعدل الصلاحيات في أي وقت": ["Le gérant peut définir et modifier les autorisations à tout moment.", "The administrator can set and change permissions at any time."],
  "لا يوجد موظفون يطابقون خيارات البحث": ["Aucun employé ne correspond aux critères de recherche.", "No employees match the search criteria."],
  "جرب تغيير كلمات البحث أو إلغاء فلتر الأقسام.": ["Essayez de modifier la recherche ou de supprimer le filtre des départements.", "Try changing the search terms or clearing the department filter."],
  "الموظف وبيانات الدخول": ["Employé et identifiants", "Employee and Sign-in Details"],
  "الصلاحيات (من الـ Gérant)": ["Autorisations (gérant)", "Permissions (Administrator)"],
  "الإجراءات": ["Actions", "Actions"],
  "أنت الآن": ["Vous êtes maintenant", "You are now"],
  "إضافة عملاء": ["Ajouter des clients", "Add Clients"],
  "مشاكل تقنية": ["Problèmes techniques", "Technical Issues"],
  "رخص وبرامج": ["Licences et logiciels", "Licenses and Software"],
  "سياسة الحوكمة والتحكم في الصلاحيات": ["Politique de gouvernance et de gestion des autorisations", "Governance and Permission Control Policy"],
  "RBAC Security v3": ["Sécurité RBAC v3", "RBAC Security v3"],
  "هيكلة الأقسام الأربعة، توزيع المهام والمسؤوليات، وتحديد الصلاحيات الدقيقة لكل موظف تحت إشراف المسؤول العام (Gérant).": ["Structure des quatre départements, répartition des tâches et responsabilités, et gestion précise des autorisations de chaque employé sous la supervision du gérant.", "Structure of the four departments, distribution of tasks and responsibilities, and precise permissions for each employee under the administrator's supervision."],
  "المسؤول العام (Gérant):": ["Administrateur (Gérant) :", "Administrator (Gérant):"],
  "حساب المدير": ["Compte administrateur", "Administrator Account"],
  "المدير العام": ["Administrateur général", "General Administrator"],
  "عودة لحساب المدير": ["Retour au compte administrateur", "Return to Administrator Account"],
  "عرض جميع الأقسام": ["Afficher tous les départements", "Show All Departments"],
  "القسم": ["Département", "Department"],
  "موظف": ["employé", "employee"],
  "موظفين": ["employés", "employees"],
  "المسؤول الافتراضي:": ["Responsable par défaut :", "Default Manager:"],
  "محدد": ["Sélectionné", "Selected"],
  "عرض الموظفين": ["Afficher les employés", "View Employees"],
  "جميع الأقسام": ["Tous les départements", "All Departments"],
  "الحالة:": ["Statut :", "Status:"],
  "إلغاء التصفية": ["Effacer les filtres", "Clear Filters"],
  "المنصب": ["Poste", "Position"],
  "المسؤول المباشر": ["Responsable direct", "Direct Manager"],
  "المهام والمسؤوليات": ["Tâches et responsabilités", "Tasks and Responsibilities"],
  "صلاحية": ["autorisation(s)", "permission(s)"],
  "عرض كامل المهام": ["Voir toutes les tâches", "View All Tasks"],
  "تعديل الصلاحيات الممنوحة": ["Modifier les autorisations accordées", "Edit Granted Permissions"],
  "ضبط": ["Configurer", "Configure"],
  "تجربة واستعراض الواجهة بصلاحيات هذا الموظف": ["Tester et afficher l'interface avec les autorisations de cet employé", "Preview the interface with this employee's permissions"],
  "تجربة": ["Tester", "Preview"],
  "تعديل بيانات الموظف والمنصب": ["Modifier les informations et le poste de l'employé", "Edit Employee Details and Position"],
  "تغيير كلمة المرور": ["Changer le mot de passe", "Change Password"],
  "حذف حساب الموظف": ["Supprimer le compte de l'employé", "Delete Employee Account"],
  "تفاصيل": ["Détails", "Details"],
  "تطبيق مبدأ أقل الصلاحيات المطلوبة (Least Privilege Principle). فقط المسؤول العام (Gérant) يملك صلاحية منح أو سحب الصلاحيات الحساسة كحذف العملاء وتصدير البيانات وإدارة فريق العمل، بينما يركز كل موظف على مهامه وفق قسمه المحدد في PROGILIC.": ["Application du principe du moindre privilège. Seul le gérant peut accorder ou retirer les autorisations sensibles, comme la suppression de clients, l'exportation de données et la gestion de l'équipe ; chaque employé se concentre sur les tâches de son département dans PROGILIC.", "The least-privilege principle applies. Only the administrator (Gérant) can grant or revoke sensitive permissions, such as deleting clients, exporting data, and managing the team; each employee focuses on their assigned PROGILIC department tasks."],
  "مثال: سليم بن علي": ["Exemple : Salim Ben Ali", "Example: Salim Ben Ali"],
  "مثال: salim.benali": ["Exemple : salim.benali", "Example: salim.benali"],
  "مثال: مسؤول عروض وشروحات ما قبل البيع": ["Exemple : Responsable des présentations et démonstrations avant-vente", "Example: Pre-sales demonstrations and presentations manager"],
  "ابحث باسم الموظف، المنصب، اسم المستخدم، أو المسؤول المباشر...": ["Rechercher un employé par nom, poste, nom d'utilisateur ou responsable direct...", "Search by employee name, position, username, or direct manager..."],
  "المدير العام (Gérant)": ["Administrateur (Gérant)", "Administrator (Gérant)"],
  "كلمة المرور (اتركها فارغة للإبقاء على الحالية)": ["Mot de passe (laisser vide pour conserver l'actuel)", "Password (leave blank to keep current)"],
  "كلمة المرور الابتدائية *": ["Mot de passe initial *", "Initial Password *"],
  "كلمة المرور للدخول": ["Mot de passe de connexion", "Sign-in Password"],
  "تحميل مهام القسم الافتراضية": ["Charger les tâches par défaut du département", "Load Department Default Tasks"],
  "تفاصيل المهام والمسؤوليات الموكلة لهذا الموظف...": ["Détails des tâches et responsabilités confiées à cet employé...", "Details of this employee's assigned tasks and responsibilities..."],
  "تم تحميل مهام القسم الافتراضية.": ["Les tâches par défaut du département ont été chargées.", "Department default tasks loaded."],
  "حفظ التعديلات": ["Enregistrer les modifications", "Save Changes"],
  "إنشاء حساب الموظف": ["Créer le compte employé", "Create Employee Account"],
  "إضافة موظف جديد وتحديد المسؤوليات": ["Ajouter un employé et définir ses responsabilités", "Add Employee and Set Responsibilities"],
  "يرجى إدخال اسم الموظف واسم المستخدم.": ["Veuillez saisir le nom de l'employé et son nom d'utilisateur.", "Enter the employee's name and username."],
  "يرجى تحديد كلمة مرور للموظف الجديد.": ["Veuillez définir un mot de passe pour le nouvel employé.", "Set a password for the new employee."],
  "تم تحديث بيانات الموظف بنجاح.": ["Les informations de l'employé ont été mises à jour.", "Employee details updated successfully."],
  "تم إنشاء حساب الموظف بنجاح.": ["Le compte employé a été créé avec succès.", "Employee account created successfully."],
  "تحديد وضبط الصلاحيات": ["Définir et configurer les autorisations", "Set and Configure Permissions"],
  "استعادة صلاحيات القسم الافتراضية": ["Restaurer les autorisations par défaut du département", "Restore Department Default Permissions"],
  "تحديد الكل": ["Tout sélectionner", "Select All"],
  "حفظ وتطبيق الصلاحيات": ["Enregistrer et appliquer les autorisations", "Save and Apply Permissions"],
  "تم تطبيق الصلاحيات الافتراضية لقسم": ["Les autorisations par défaut du département ont été appliquées :", "Applied default permissions for department:"],
  "تم حفظ الصلاحيات المحدثة للموظف بنجاح.": ["Les autorisations de l'employé ont été mises à jour.", "Employee permissions updated successfully."],
  "بصفتك المسؤول العام (Gérant)، يمكنك تعيين كلمة مرور جديدة للموظف": ["En tant que gérant, vous pouvez définir un nouveau mot de passe pour l'employé", "As the administrator (Gérant), you can set a new password for the employee"],
  "أدخل كلمة مرور جديدة...": ["Saisissez un nouveau mot de passe...", "Enter a new password..."],
  "تحديث كلمة المرور": ["Mettre à jour le mot de passe", "Update Password"],
  "يرجى إدخال كلمة مرور من 4 أحرف على الأقل.": ["Veuillez saisir un mot de passe d'au moins 4 caractères.", "Enter a password of at least 4 characters."],
  "تم تحديث كلمة المرور للموظف بنجاح.": ["Le mot de passe de l'employé a été mis à jour.", "Employee password updated successfully."],
  "بطاقة الموظف والمسؤوليات": ["Fiche de l'employé et responsabilités", "Employee Profile and Responsibilities"],
  "المنصب:": ["Poste :", "Position:"],
  "المسؤول المباشر:": ["Responsable direct :", "Direct Manager:"],
  "اسم المستخدم:": ["Nom d'utilisateur :", "Username:"],
  "الهاتف:": ["Téléphone :", "Phone:"],
  "غير مسجل": ["Non renseigné", "Not provided"],
  "اختصاصات قسم": ["Responsabilités du département", "Department Responsibilities"],
  "في PROGILIC:": ["dans PROGILIC :", "in PROGILIC:"],
  "الموظف": ["l'employé", "employee"],
  "تنبيه أمني: هذا الإجراء لا رجعة فيه وسيؤدي لمسح حساب الموظف وجميع صلاحياته وسجلاته من قاعدة البيانات نهائياً.": ["Alerte de sécurité : cette action est irréversible et supprimera définitivement le compte de l'employé, ses autorisations et ses journaux de la base de données.", "Security warning: This action is irreversible and will permanently delete the employee account, permissions, and records from the database."],
  "أدخل كلمة المرور الخاصة بالمسؤول العام...": ["Saisissez le mot de passe de l'administrateur...", "Enter the administrator's password..."],
  "إظهار / إخفاء كلمة المرور": ["Afficher / masquer le mot de passe", "Show / Hide Password"],
  "يتطلب النظام إدخال كلمة مرور المسؤول العام للتأكد من هوية صاحب القرار قبل تنفيذ حذف المستخدمين.": ["Le système exige le mot de passe de l'administrateur pour vérifier l'identité du décideur avant de supprimer des utilisateurs.", "The administrator's password is required to verify the decision-maker before deleting users."],
  "تأكيد وحذف الموظف نهائياً": ["Confirmer et supprimer définitivement l'employé", "Confirm and Permanently Delete Employee"],
  "يرجى إدخال كلمة مرور المسؤول العام.": ["Veuillez saisir le mot de passe de l'administrateur.", "Enter the administrator's password."],
  "تم التبديل لتجربة الواجهة بصلاحيات: ": ["Interface ouverte pour tester les autorisations de : ", "Switched to preview the interface with permissions for: "],
  "تمت العودة بنجاح إلى حساب المسؤول العام (Gérant): ": ["Retour au compte administrateur (Gérant) effectué avec succès : ", "Successfully returned to the administrator (Gérant) account: "],
  ". كامل الصلاحيات مفعلة.": [". Toutes les autorisations sont activées.", ". All permissions are enabled."],
  "خطأ": ["Erreur", "Error"],
  "قسم ما قبل البيع": ["Service Pré-vente", "Pre-Sales Department"],
  "القسم التجاري": ["Service Commercial", "Commercial Department"],
  "قسم المتابعة": ["Service Suivi", "Follow-up Department"],
  "القسم التقني": ["Service Technique", "Technical Department"],
  "التواصل الأولي مع العملاء، التعريف ببرنامج PROGILIC، فهم احتياجاتهم، تقديم الشروحات والعروض، ومتابعة العملاء المحتملين.": ["Premier contact avec les clients, présentation de PROGILIC, analyse de leurs besoins, démonstrations et suivi des prospects.", "Initial customer contact, introduction to PROGILIC, needs assessment, demonstrations, and prospect follow-up."],
  "التواصل الأولي والترحيب بالعملاء الجدد والمحتملين": ["Prendre contact et accueillir les nouveaux clients et prospects", "Make initial contact and welcome new and prospective customers"],
  "التعريف ببرنامج PROGILIC بمختلف نسخه وحلوله": ["Présenter PROGILIC, ses différentes versions et solutions", "Introduce PROGILIC, its versions, and solutions"],
  "فهم وتحليل احتياجات نشاط العميل وتحديد البرنامج الأنسب": ["Comprendre et analyser les besoins du client afin de choisir le logiciel adapté", "Understand and analyze customer needs to identify the most suitable software"],
  "تقديم الشروحات التفصيلية والعروض التجريبية (Démos)": ["Fournir des explications détaillées et des démonstrations", "Provide detailed explanations and product demonstrations"],
  "متابعة العملاء المحتملين والإجابة على استفساراتهم وتأهيلهم": ["Suivre les prospects, répondre à leurs questions et qualifier leurs besoins", "Follow up with prospects, answer questions, and qualify their needs"],
  "مسؤول ما قبل البيع وعلاقات العملاء": ["Responsable avant-vente et relations clients", "Pre-Sales and Customer Relations Manager"],
  "تسيير الجانب التجاري، متابعة الصفقات والبيع، العروض التجارية، والتنسيق مع العملاء بخصوص شراء الحلول والبرامج.": ["Gestion commerciale, suivi des ventes et des contrats, offres commerciales et coordination des achats de solutions et logiciels.", "Commercial operations, sales and contract follow-up, proposals, and coordination with customers purchasing solutions and software."],
  "تسيير وإدارة الجانب التجاري والصفقات اليومية": ["Gérer les activités commerciales et les transactions quotidiennes", "Manage commercial operations and daily deals"],
  "متابعة عمليات البيع، الفواتير، وتجديد العقود والاشتراكات": ["Suivre les ventes, la facturation et le renouvellement des contrats et abonnements", "Track sales, invoicing, and contract and subscription renewals"],
  "إعداد وتقديم العروض التجارية والتفاوض مع الزبائن": ["Préparer les offres commerciales et négocier avec les clients", "Prepare commercial proposals and negotiate with customers"],
  "التنسيق مع العملاء بخصوص شراء الحلول والبرامج، تراخيص POS، وتوسيع الشبكة": ["Coordonner les achats de solutions et logiciels, les licences POS et le développement du réseau avec les clients", "Coordinate customer purchases of solutions, software and POS licenses, and network expansion"],
  "مسؤول المبيعات والعقود التجارية": ["Responsable des ventes et contrats commerciaux", "Sales and Commercial Contracts Manager"],
  "متابعة العملاء ومراقبة سير العمل بين الأقسام، خصوصاً قسم ما قبل البيع والقسم التقني، مع متابعة المهام والمشكلات والتأكد من تقدمها.": ["Suivi des clients et coordination entre les départements, notamment avant-vente et technique, avec suivi des tâches et problèmes.", "Customer follow-up and workflow coordination across departments, especially pre-sales and technical, tracking tasks and issues through completion."],
  "متابعة دورية للعملاء وقياس مدى رضاهم واستقرار البرنامج لديهم": ["Assurer le suivi régulier des clients et mesurer leur satisfaction ainsi que la stabilité du logiciel", "Follow up with customers regularly and measure satisfaction and software stability"],
  "مراقبة سير العمل والتنسيق المشترك بين الأقسام": ["Surveiller les processus et coordonner le travail entre les départements", "Monitor workflows and coordinate work across departments"],
  "الربط المباشر والفعال بين قسم ما قبل البيع والقسم التقني": ["Assurer une liaison directe et efficace entre les départements avant-vente et technique", "Provide an effective direct link between pre-sales and technical departments"],
  "متابعة المهام والمشكلات والتذاكر المفتوحة والتأكد من تقدمها وإغلاقها بنجاح": ["Suivre les tâches, problèmes et tickets ouverts jusqu'à leur résolution", "Track tasks, issues, and open tickets through successful resolution"],
  "منسق جودة المتابعة وسير العمل": ["Coordinateur qualité du suivi et des processus", "Follow-up Quality and Workflow Coordinator"],
  "الجانب التقني المرتبط بالمطوّر، معالجة المشكلات البرمجية، تطوير البرنامج، إصلاح الأخطاء، وتنفيذ التعديلات التقنية.": ["Activités techniques avec le développeur : traitement des problèmes logiciels, développement, correction des erreurs et évolutions techniques.", "Technical work with the developer: resolving software issues, development, bug fixes, and technical changes."],
  "التكفل بالجانب التقني المباشر المرتبط بالمطوّر والأنظمة البرمجية": ["Prendre en charge les activités techniques liées au développeur et aux systèmes logiciels", "Handle technical work related to the developer and software systems"],
  "معالجة المشكلات البرمجية، الأخطاء والـ Bugs بدقة وسرعة": ["Traiter avec précision et rapidité les problèmes logiciels et les bugs", "Resolve software issues and bugs accurately and promptly"],
  "تطوير ميزات البرنامج، تحديث إصدارات PROGILIC (v21, v23, v25)": ["Développer des fonctionnalités et mettre à jour PROGILIC (v21, v23, v25)", "Develop software features and update PROGILIC versions (v21, v23, v25)"],
  "إصلاح الأخطاء وتنفيذ التعديلات التقنية الخاصة بطلبات الزبائن": ["Corriger les erreurs et réaliser les modifications techniques demandées par les clients", "Fix bugs and implement technical changes requested by customers"],
  "مهندس برمجيات ودعم تقني": ["Ingénieur logiciel et support technique", "Software Engineer and Technical Support"],
  "اسم الموظف الكامل *": ["Nom complet de l'employé *", "Employee Full Name *"],
  "اسم المستخدم (لتسجيل الدخول) *": ["Nom d'utilisateur (connexion) *", "Username (for sign-in) *"],
  "القسم التابع له (من الأقسام الأربعة) *": ["Département (parmi les quatre) *", "Department (one of four) *"],
  "منصبه / المسمى الوظيفي *": ["Poste / intitulé du poste *", "Position / Job Title *"],
  "المسؤول المباشر *": ["Responsable direct *", "Direct Manager *"],
  "رقم الهاتف (اختياري)": ["Téléphone (facultatif)", "Phone Number (Optional)"],
  "البريد الإلكتروني (اختياري)": ["E-mail (facultatif)", "Email (Optional)"],
  "المهام والمسؤوليات الموكلة للموظف *": ["Tâches et responsabilités de l'employé *", "Employee Tasks and Responsibilities *"],
  "حالة الحساب": ["Statut du compte", "Account Status"],
  "نشط (يمكنه تسجيل الدخول)": ["Actif (connexion autorisée)", "Active (can sign in)"],
  "معطل (موقوف مؤقتاً)": ["Désactivé (suspendu temporairement)", "Disabled (temporarily suspended)"],
  "لم يتم العثور على الموظف.": ["Employé introuvable.", "Employee not found."],
  "👑 هذه الصلاحيات يتحكم بها المسؤول العام (Gérant) حصرياً.": ["👑 Ces autorisations sont exclusivement gérées par le gérant.", "👑 These permissions are managed exclusively by the administrator."],
  "كلمة المرور الجديدة *": ["Nouveau mot de passe *", "New Password *"],
  "بطاقة الموظف والمسؤوليات": ["Fiche de l'employé et responsabilités", "Employee Profile and Responsibilities"],
  "المهام والمسؤوليات التفصيلية:": ["Tâches et responsabilités détaillées :", "Detailed Tasks and Responsibilities:"],
  "التثبيت على حساب الرئيس لإدخال كلمة المرور": ["Sélectionner le compte du gérant pour saisir le mot de passe", "Select the administrator account to enter its password"],
  "تأكيد حذف حساب الموظف نهائياً وحظر وصوله للنظام": ["Confirmer la suppression définitive du compte et le blocage de son accès.", "Confirm permanent deletion of the employee account and revoke system access."],
  "كلمة مرور المسؤول العام (Gérant) للتأكيد *": ["Mot de passe du gérant pour confirmation *", "Administrator password for confirmation *"],
  "بيانات الخادم (الأحدث)": ["Données du serveur (plus récentes)", "Server Data (Latest)"],
  "الاسم:": ["Nom :", "Name:"],
  "رقم الإصدار:": ["Numéro de version :", "Version Number:"],
  "تعديلاتك المحلية (غير المحفوظة)": ["Vos modifications locales (non enregistrées)", "Your Local Changes (Unsaved)"],
  "الاحتفاظ بتعديلاتي": ["Conserver mes modifications", "Keep My Changes"],
  "اعتماد بيانات الخادم": ["Utiliser les données du serveur", "Use Server Data"],
  "دمج (Keep Both)": ["Fusionner (garder les deux)", "Merge (Keep Both)"],
  "اسم الموظف *": ["Nom de l'employé *", "Employee Name *"],
  "اسم المستخدم / المعرّف": ["Nom d'utilisateur / identifiant", "Username / ID"],
  "كلمة السر (الدخول) *": ["Mot de passe (connexion) *", "Password (Sign-in) *"],
  "حفظ الموظف": ["Enregistrer l'employé", "Save Employee"],
  "فضاء الموظفين — Espace Collaborateurs": ["Espace des employés", "Employee Workspace"],
  "سجل الدخول بحساب الموظف وكلمة المرور المحددة لك من طرف المسؤول العام (Gérant).": ["Connectez-vous avec le compte employé et le mot de passe fourni par le gérant.", "Sign in with your employee account and the password provided by the administrator."],
  "تسجيل الدخول كموظف": ["Connexion en tant qu'employé", "Sign in as Employee"],
  "⚡ تخطي التفعيل والدخول الفوري للنظام (Gérant)": ["⚡ Ignorer la vérification et accéder au système (gérant)", "⚡ Skip verification and enter the system as administrator."],
  "اسم الحساب:": ["Nom du compte :", "Account Name:"],
  "المسؤول:": ["Responsable :", "Manager:"],
  "المسمى الوظيفي:": ["Intitulé du poste :", "Job Title:"],
  "تلقائياً وبشكل دوري في جهازك (IndexedDB)": ["Automatiquement et périodiquement sur votre appareil (IndexedDB)", "Automatically and periodically on your device (IndexedDB)"],
  "بشكل معزول لكل مستخدم. يحتفظ النظام بحد أقصى": ["De manière isolée pour chaque utilisateur. Le système conserve au maximum", "Separately for each user. The system keeps up to"],
  "30 نسخة متعاقبة": ["30 sauvegardes successives", "30 rolling backups"],
  "⚠️ تعارض في المزامنة (Conflict)": ["⚠️ Conflit de synchronisation", "⚠️ Sync Conflict"],
  "تفاصيل التقنية للخطأ": ["Détails techniques de l'erreur", "Technical Error Details"],
  "فشل تشغيل المخطط التفاعلي:": ["Échec du chargement du graphique interactif :", "Failed to load interactive chart:"],
  "تبديل": ["Changer", "Switch"],
  "👥 إجمالي الشركاء": ["👥 Total des partenaires", "👥 Total Partners"],
  "💻 الأجهزة والتراخيص": ["💻 Appareils et licences", "💻 Devices and Licenses"],
  "🛡️ مؤشر السلامة العامة": ["🛡️ Indice de santé global", "🛡️ Overall Health Score"],
  "🛠️ التذاكر والطلبات الفنية": ["🛠️ Tickets et demandes techniques", "🛠️ Technical Tickets and Requests"],
  "📍 الولاية الأولى": ["📍 Principale wilaya", "📍 Top Wilaya"],
  "📦 البرنامج الأكثر نشراً": ["📦 Logiciel le plus déployé", "📦 Most Deployed Software"],
  "🏢 نقاط البيع المتعددة": ["🏢 Points de vente multiples", "🏢 Multiple Sales Locations"],
  "🚀 فرص الترقية لـ v23": ["🚀 Opportunités de mise à niveau vers v23", "🚀 Upgrade Opportunities to v23"],
  "مراقبة حية ونشطة": ["Surveillance en direct", "Live Monitoring"],
  "🗺️ خريطة التغطية الوطنية للولايات الجزائرية": ["🗺️ Carte nationale de couverture des wilayas algériennes", "🗺️ National Coverage Map of Algerian Wilayas"],
  "انقر على أي ولاية لتصفية الشركاء والاطلاع على الأجهزة المنصبة في تلك المنطقة": ["Cliquez sur une wilaya pour filtrer les partenaires et consulter les appareils installés dans la région.", "Select a wilaya to filter partners and view devices installed in that region."],
  "💻 منظومة برمجيات PROGILIC وحصص الإصدارات": ["💻 Écosystème logiciel PROGILIC et répartition des versions", "💻 PROGILIC Software Ecosystem and Version Breakdown"],
  "تحليل تراخيص Commercial والإصدارات المنصبة وفرص الترقية": ["Analyse des licences Commercial, versions installées et opportunités de mise à niveau", "Analysis of Commercial licenses, installed versions, and upgrade opportunities"],
  "عدد الشركاء:": ["Nombre de partenaires :", "Partner Count:"],
  "الأجهزة:": ["Appareils :", "Devices:"],
  "🚀 مسار الترقية إلى PROGILIC Commercial v23": ["🚀 Parcours de mise à niveau vers PROGILIC Commercial v23", "🚀 Upgrade Path to PROGILIC Commercial v23"],
  "🚀 إصدارات قديمة (v15 / v16)": ["🚀 Anciennes versions (v15 / v16)", "🚀 Older Versions (v15 / v16)"],
  "💻 محطات متعددة (2+ أجهزة)": ["💻 Plusieurs postes (2+ appareils)", "💻 Multiple Workstations (2+ Devices)"],
  "انقر على عناوين الأعمدة للترتيب. انقر على أي شريك لاستعراض ملفه الفني وإجراء الاتصال السريع.": ["Cliquez sur les en-têtes pour trier. Cliquez sur un partenaire pour consulter sa fiche et le contacter rapidement.", "Select column headings to sort. Select a partner to view their profile and contact them."],
  "الهاتف والتواصل": ["Téléphone et contact", "Phone and Contact"],
  "من إجمالي": ["sur un total de", "out of"],
  "الترخيص:": ["Licence :", "License:"],
  "تحكم كامل ومباشر من طرف الرئيس في منح وسحب وتوزيع الصلاحيات الدقيقة على جميع مستخدمي وموظفي النظام": ["Le gérant contrôle directement l'attribution et le retrait des autorisations de tous les utilisateurs et employés.", "The administrator directly controls permissions for all system users and employees."],
  "اسم المستخدم:": ["Nom d'utilisateur :", "Username:"],
  "مجموع الصلاحيات الممنوحة:": ["Total des autorisations accordées :", "Total Permissions Granted:"],
  "المسؤول الافتراضي:": ["Responsable par défaut :", "Default Manager:"],
  "الرئيس:": ["Gérant :", "Administrator:"],
  "حساب موظف:": ["Compte employé :", "Employee Account:"],
  "تحديد وضبط الصلاحيات": ["Définir et configurer les autorisations", "Set and Configure Permissions"],
  "تغيير كلمة المرور": ["Modifier le mot de passe", "Change Password"],
  "اختصاصات القسم في PROGILIC:": ["Fonctions du département dans PROGILIC :", "Department Responsibilities in PROGILIC:"],
  "التحقق من كلمة مرور المسؤول العام (Admin Verification)": ["Vérification du mot de passe du gérant", "Administrator Password Verification"],
  "مستخدم": ["Utilisateur", "User"],
  "التقرير يعرض": ["Le rapport affiche", "Report displays"],
  "📊 Dashboard وIntelligence الCommercial": ["📊 Tableau de bord et intelligence Commercial", "📊 Dashboard and Commercial Intelligence"],
  "📊 Dashboard والذكاء التجاري": ["📊 Tableau de bord et intelligence commerciale", "📊 Dashboard and Commercial Intelligence"],
  "👤 الحساب النشط:": ["👤 Compte actif :", "👤 Active Account:"],
  "حساب المدير العام (Gérant)": ["Compte du gérant", "Administrator Account"],
  "مزامنة السحابة": ["Synchronisation cloud", "Cloud Sync"],
  "📈 نظرة عامة والتحليلات": ["📈 Vue d'ensemble et analyses", "📈 Overview and Analytics"],
  "🗺️ التوزيع الجغرافي": ["🗺️ Répartition géographique", "🗺️ Geographic Distribution"],
  "💻 برمجيات PROGILIC": ["💻 Logiciels PROGILIC", "💻 PROGILIC Software"],
  "📋 دليل الشركاء والAttention": ["📋 Répertoire des partenaires et attention", "📋 Partner Directory and Attention"],
  "🔍 تصفية سريعة:": ["🔍 Filtre rapide :", "🔍 Quick Filter:"],
  "النتائج:": ["Résultats :", "Results:"],
  "✓ نسبة تشغيل نشطة": ["✓ Taux d'activité", "✓ Active Rate"],
  "بمعدل": ["Moyenne :", "Average:"],
  "جهاز/عميل": ["appareils/client", "devices/client"],
  "ممتاز": ["Excellent", "Excellent"],
  "مستقر": ["Stable", "Stable"],
  "✨ استقرار تشغيلي نموذجي": ["✨ Stabilité opérationnelle exemplaire", "✨ Excellent Operational Stability"],
  "ترخيص منشور": ["licence déployée", "deployed license"],
  "مؤسسات تمتلك أكثر من جهاز": ["Organisations avec plusieurs appareils", "Organizations with Multiple Devices"],
  "عملاء على نسخ v15 / v16": ["Clients utilisant les versions v15 / v16", "Clients on v15 / v16"],
  "📈 حركية نمو التراخيص وقاعدة Clients (6 أشهر الأخيرة)": ["📈 Croissance des licences et de la clientèle (6 derniers mois)", "📈 License and Client Growth (Last 6 Months)"],
  "تتبع منحنى انتشار البرامج والتراخيص عبر نقاط البيع المعتمدة": ["Suivi de la diffusion des logiciels et licences dans les points de vente agréés", "Tracking software and license adoption across authorized sales locations"],
  "التراخيص المنصبة": ["Licences installées", "Installed Licenses"],
  "العملاء": ["Clients", "Clients"],
  "ترخيص": ["Licence", "License"],
  "عميل": ["Client", "Client"],
  "مايو": ["Mai", "May"],
  "يونيو": ["Juin", "June"],
  "يوليو": ["Juillet", "July"],
  "أغسطس": ["Août", "August"],
  "سبتمبر": ["Septembre", "September"],
  "أكتوبر": ["Octobre", "October"],
  "نوفمبر": ["Novembre", "November"],
  "ديسمبر": ["Décembre", "December"],
  "يناير": ["Janvier", "January"],
  "فبراير": ["Février", "February"],
  "مارس": ["Mars", "March"],
  "أبريل": ["Avril", "April"],
  "نظرة عامة": ["Vue d'ensemble", "Overview"],
  "المشاكل": ["Problèmes", "Issues"],
  "البرامج": ["Logiciels", "Software"],
  "المتطلبات": ["Exigences", "Requirements"],
  "الSoftware": ["Logiciels", "Software"],
  "نوع الترخيص": ["Type de licence", "License Type"],
  "حساب Gmail": ["Compte Gmail", "Gmail Account"],
  "غياب تواصل": ["Absence de contact", "No Contact"],
  "أولوية: جدولة مكالمة متابعة": ["Priorité : planifier un appel de suivi", "Priority: Schedule a Follow-up Call"],
  "جدولة مكالمة متابعة": ["Planifier un appel de suivi", "Schedule a Follow-up Call"],
  "دخول الرئيس": ["Connexion du gérant", "Administrator Sign-in"],
  "👑 دخول الرئيس": ["👑 Connexion du gérant", "👑 Administrator Sign-in"],
  "مسؤول عام (الرئيس)": ["Administrateur (gérant)", "Administrator"],
  "المسؤول": ["Responsable", "Manager"],
  "سجل عمليات موحد لحساب المؤسسة، مع اسم الموظف المنفذ والتاريخ والوقت والتصفية والتقرير الإداري.": ["Journal centralisé des opérations du compte, avec auteur, date, heure, filtres et rapport de gestion.", "Centralized organization activity log with actor, date, time, filters, and management report."],
  "يعرض السجل المحلي فقط لعدم وجود حساب سحابي": ["Affichage du journal local uniquement : aucun compte cloud n'est connecté.", "Showing the local log only because no cloud account is connected."],
  "👤 المسؤول العام": ["👤 Administrateur", "👤 Administrator"],
  "⚙️ عمليات الSystem": ["⚙️ Opérations système", "⚙️ System Activities"],
  "كل العمليات المسجلة": ["Toutes les opérations enregistrées", "All Recorded Activities"],
  "إجمالي العمليات": ["Total des opérations", "Total Activities"],
  "مستخدمون نشطون": ["Utilisateurs actifs", "Active Users"],
  "عملاء جدد": ["Nouveaux clients", "New Clients"],
  "حذف عملاء": ["Suppression de clients", "Client Deletions"],
  "مشاكل مسجلة / محلولة": ["Problèmes enregistrés / résolus", "Issues Recorded / Resolved"],
  "اختر حساب المستخدم وأدخل كلمة المرور الصحيحة للمتابعة. يتحكم الرئيس (": ["Sélectionnez un compte utilisateur et saisissez le bon mot de passe. Le gérant (", "Select a user account and enter the correct password. The administrator ("],
  ") في تحديد وتوزيع الصلاحيات على المستخدمين.": [") définit et attribue les autorisations des utilisateurs.", ") defines and assigns user permissions."],
  "💡 Demandes & Besoins": ["💡 Demandes et besoins", "💡 Requests and Needs"],
  "طلبات الميزات": ["Demandes de fonctionnalités", "Feature Requests"]
  ,
  "⚙️ عمليات النظام": ["⚙️ Opérations système", "⚙️ System Activities"],
  "غياب تواصل لـ": ["Absence de contact pendant", "No contact for"],
  "يوم — يستدعي المتابعة العاجلة.": ["jours — un suivi urgent est nécessaire.", "days — urgent follow-up is needed."],
  "🔵 أولوية: جدولة مكالمة متابعة": ["🔵 Priorité : planifier un appel de suivi", "🔵 Priority: Schedule a Follow-up Call"],
  "+ إضافة": ["+ Ajouter", "+ Add"],
  "📋 دليل الشركاء والمتابعة": ["📋 Répertoire des partenaires et suivi", "📋 Partner Directory and Follow-up"],
  "نسبة تشغيل نشطة": ["Taux d'activité", "Active Rate"],
  "معدل": ["Moyenne", "Average"],
  "0 ممتاز · 0 مستقر": ["0 excellent · 0 stable", "0 excellent · 0 stable"],
  "💻 أجهزة": ["💻 Appareils", "💻 Devices"],
  "أجهزة": ["Appareils", "Devices"],
  "برنامج مرخص": ["logiciel sous licence", "licensed software"],
  "التوزيع الجغرافي (أعلى 5 ولايات)": ["Répartition géographique (5 principales wilayas)", "Geographic Distribution (Top 5 Wilayas)"],
  "تنبيهات استباقية وتوصيات تجارية مبنية على قاعدة بيانات العملاء والتراخيص": ["Alertes proactives et recommandations commerciales basées sur les clients et les licences.", "Proactive alerts and business recommendations based on client and license data."],
  "نقاط Health ▼": ["Score de santé ▼", "Health Score ▼"],
  "مطابق:": ["Correspondances :", "Matches:"],
  "صفحة": ["Page", "Page"],
  "الولاية": ["Wilaya", "Wilaya"],
  "متابعة": ["Suivi", "Follow-up"],
  "الأحدث": ["Plus récent", "Newest"],
  "الرائد": ["Leader", "Leading"],
  "والذكاء التجاري": ["et intelligence commerciale", "and Commercial Intelligence"],
  "Dashboard": ["Tableau de bord", "Dashboard"],
  "📈 حركية نمو التراخيص وقاعدة العملاء (6 أشهر الأخيرة)": ["📈 Croissance des licences et de la clientèle (6 derniers mois)", "📈 License and Client Growth (Last 6 Months)"],
  "الأجهزة ↕️": ["Appareils ↕️", "Devices ↕️"],
  "من": ["De", "From"]
};

Object.assign(extraTranslations, {
  "العملاء (Clients)": ["Clients", "Clients"],
  "عرض دليل العملاء": ["Consulter le répertoire des clients", "View Client Directory"],
  "الاطلاع على قائمة العملاء والبحث فيها": ["Consulter et rechercher dans la liste des clients", "View and search the client list"],
  "إضافة عملاء جدد": ["Ajouter de nouveaux clients", "Add New Clients"],
  "تسجيل عملاء جدد في قاعدة البيانات": ["Enregistrer de nouveaux clients dans la base de données", "Register new clients in the database"],
  "تعديل بيانات العملاء": ["Modifier les informations des clients", "Edit Client Details"],
  "تحديث بيانات التواصل، الحالة والعنوان": ["Mettre à jour les coordonnées, le statut et l'adresse", "Update contact details, status, and address"],
  "حذف سجلات العملاء (حساسة)": ["Supprimer les dossiers clients (sensible)", "Delete Client Records (Sensitive)"],
  "إمكانية مسح سجلات العملاء نهائياً": ["Supprimer définitivement les dossiers clients", "Permanently delete client records"],
  "تصدير بيانات العملاء (CSV/JSON)": ["Exporter les données clients (CSV/JSON)", "Export Client Data (CSV/JSON)"],
  "تحميل وتصدير نسخ من بيانات العملاء": ["Télécharger et exporter des copies des données clients", "Download and export copies of client data"],
  "عرض البيانات الحساسة وأرقام الهاتف": ["Consulter les données sensibles et les numéros de téléphone", "View Sensitive Data and Phone Numbers"],
  "الاطلاع على تفاصيل الاتصال الحساسة للعملاء": ["Consulter les coordonnées sensibles des clients", "View sensitive client contact details"],
  "إدارة وتغيير حالة العميل": ["Gérer et modifier le statut du client", "Manage and Change Client Status"],
  "تغيير حالة العميل بين نشط، محتمل، ومتوقف": ["Modifier le statut du client : actif, prospect ou inactif", "Change client status between active, prospect, and inactive"],
  "عرض الخط الزمني للأنشطة": ["Consulter la chronologie des activités", "View Activity Timeline"],
  "استعراض تاريخ الأنشطة والتفاعلات اليومية": ["Consulter l'historique des activités et des interactions quotidiennes", "Review activity history and daily interactions"],
  "عرض سجل التواصل والمكالمات": ["Consulter l'historique des contacts et appels", "View Contact and Call History"],
  "الاطلاع على المكالمات والزيارات المسجلة": ["Consulter les appels et visites enregistrés", "View logged calls and visits"],
  "المخطط الزمني (Activity Timeline)": ["Chronologie des activités", "Activity Timeline"],
  "عرض المخطط الزمني وتقريره": ["Consulter la chronologie et son rapport", "View Timeline and Report"],
  "عرض سجل العمليات وتصفية الأنشطة وإعداد تقرير الإدارة": ["Consulter le journal, filtrer les activités et préparer un rapport de gestion", "View the activity log, filter activities, and prepare a management report"],
  "البرامج والتراخيص (Programs & Licenses)": ["Logiciels et licences", "Programs and Licenses"],
  "عرض البرامج والتراخيص": ["Consulter les logiciels et licences", "View Programs and Licenses"],
  "الاطلاع على البرامج المرخصة والأجهزة": ["Consulter les logiciels sous licence et les appareils", "View licensed software and devices"],
  "إضافة برامج ورخص جديدة": ["Ajouter des logiciels et licences", "Add Programs and Licenses"],
  "تسجيل رخص برامج جديدة للعملاء": ["Enregistrer de nouvelles licences logicielles pour les clients", "Register new software licenses for clients"],
  "تعديل بيانات التراخيص": ["Modifier les informations des licences", "Edit License Details"],
  "تحديث المنصة، عدد الأجهزة وتواريخ العقد": ["Mettre à jour la plateforme, le nombre d'appareils et les dates du contrat", "Update platform, device count, and contract dates"],
  "حذف البرامج والتراخيص": ["Supprimer les logiciels et licences", "Delete Programs and Licenses"],
  "إلغاء وحذف ترخيص البرنامج من حساب العميل": ["Annuler et supprimer une licence du compte client", "Cancel and delete a program license from the client account"],
  "عرض تفاصيل مفاتيح التراخيص": ["Consulter les détails des clés de licence", "View License Key Details"],
  "الاطلاع على مفاتيح التفعيل ورخص POS": ["Consulter les clés d'activation et licences POS", "View activation keys and POS licenses"],
  "إدارة التراخيص والتجديد": ["Gérer les licences et renouvellements", "Manage Licenses and Renewals"],
  "تجديد فترات التراخيص وتعديل صلاحيتها": ["Renouveler les licences et modifier leur validité", "Renew licenses and adjust their validity"],
  "عرض الأجهزة والمحطات المرخصة": ["Consulter les appareils et postes sous licence", "View Licensed Devices and Workstations"],
  "متابعة عدد المحطات والأجهزة المنصبة": ["Suivre le nombre de postes et appareils installés", "Track the number of installed workstations and devices"],
  "الدعم الفني والأعطال (Technical Issues)": ["Support technique et incidents", "Technical Support and Issues"],
  "عرض البلاغات والمشاكل التقنية": ["Consulter les signalements et problèmes techniques", "View Technical Reports and Issues"],
  "الاطلاع على قائمة المشاكل والتذاكر": ["Consulter la liste des problèmes et tickets", "View the list of issues and tickets"],
  "تسجيل بلاغ/مشكلة جديدة": ["Enregistrer un nouveau signalement ou problème", "Create a New Report or Issue"],
  "إنشاء تذكرة دعم فني أو بلاغ عطل": ["Créer un ticket de support ou signaler un incident", "Create a support ticket or report an issue"],
  "تعديل بيانات التذكرة": ["Modifier les informations du ticket", "Edit Ticket Details"],
  "تحديث وصف وتفاصيل المشكلة": ["Mettre à jour la description et les détails du problème", "Update the issue description and details"],
  "حذف التذاكر التقنية": ["Supprimer les tickets techniques", "Delete Technical Tickets"],
  "مسح سجل التذكرة أو البلاغ نهائياً": ["Supprimer définitivement le ticket ou signalement", "Permanently delete the ticket or report"],
  "تغيير حالة التذكرة": ["Modifier le statut du ticket", "Change Ticket Status"],
  "تحديث حالة المشكلة (مفتوح، قيد المعالجة، محلول، مغلق)": ["Mettre à jour le statut du problème (ouvert, en cours, résolu, fermé)", "Update issue status (open, in progress, resolved, closed)"],
  "تعديل أولوية المشكلة": ["Modifier la priorité du problème", "Change Issue Priority"],
  "تحديد درجة الإلحاح (عاجل، عالية، متوسطة، منخفضة)": ["Définir le niveau d'urgence (urgent, élevé, moyen, faible)", "Set urgency (urgent, high, medium, low)"],
  "تصنيف نوع العطل": ["Classer le type d'incident", "Classify Issue Type"],
  "تحديد نوع المشكلة (تقني، أداء، خطأ مستخدم...)": ["Définir le type de problème (technique, performance, erreur utilisateur...)", "Set issue type (technical, performance, user error...)"],
  "إضافة ملاحظات وحلول تقنية": ["Ajouter des notes et solutions techniques", "Add Technical Notes and Solutions"],
  "تدوين الحلول التقنية والملاحظات التشخيصية": ["Consigner les solutions techniques et notes de diagnostic", "Record technical solutions and diagnostic notes"],
  "حل وإصلاح المشكلة": ["Résoudre et corriger le problème", "Resolve and Fix Issue"],
  "تأكيد إصلاح العطل البرمجي": ["Confirmer la correction de l'incident logiciel", "Confirm the software issue is fixed"],
  "إعادة فتح المشكلة": ["Rouvrir le problème", "Reopen Issue"],
  "إعادة تنشيط تذكرة في حال تكرار العطل": ["Réactiver un ticket si le problème réapparaît", "Reopen a ticket if the issue recurs"],
  "الإغلاق النهائي للتذكرة": ["Clôturer définitivement le ticket", "Permanently Close Ticket"],
  "إغلاق وأرشفة البلاغ بعد التحقق": ["Clôturer et archiver le signalement après vérification", "Close and archive the report after verification"],
  "الميزات والمتطلبات (Features & Requirements)": ["Fonctionnalités et exigences", "Features and Requirements"],
  "عرض طلبات الميزات والمتطلبات": ["Consulter les demandes de fonctionnalités et exigences", "View Feature and Requirement Requests"],
  "استعراض مقترحات تطوير النظام": ["Consulter les propositions d'amélioration du système", "Review system improvement proposals"],
  "تسجيل ميزة/متطلب جديد": ["Enregistrer une fonctionnalité ou exigence", "Register a New Feature or Requirement"],
  "إضافة طلب تطوير ميزة جديدة من العميل": ["Ajouter une demande client pour une nouvelle fonctionnalité", "Add a client request for a new feature"],
  "تعديل المتطلب والمواصفات": ["Modifier l'exigence et ses spécifications", "Edit Requirement and Specifications"],
  "تحديث مواصفات الميزة المطلوبة": ["Mettre à jour les spécifications de la fonctionnalité demandée", "Update requested feature specifications"],
  "حذف متطلبات التطوير": ["Supprimer les exigences de développement", "Delete Development Requirements"],
  "إلغاء وحذف طلب الميزة نهائياً": ["Annuler et supprimer définitivement la demande de fonctionnalité", "Cancel and permanently delete the feature request"],
  "تحديث مسار تنفيذ الميزة": ["Mettre à jour l'avancement de la fonctionnalité", "Update Feature Implementation Progress"],
  "تغيير مسار التنفيذ (مقترح، قيد الدراسة، مخطط، منفذ)": ["Modifier l'avancement (proposé, à l'étude, planifié, réalisé)", "Change progress (proposed, under review, planned, implemented)"],
  "إضافة ملاحظات تحليلية للميزة": ["Ajouter des notes d'analyse à la fonctionnalité", "Add Feature Analysis Notes"],
  "تدوين ملاحظات تحليل الجدوى والتنفيذ": ["Consigner les notes d'analyse de faisabilité et de mise en œuvre", "Record feasibility and implementation analysis notes"],
  "سجلات التواصل (Contacts)": ["Historique des contacts", "Contact Records"],
  "عرض سجل الاتصالات والمواعيد": ["Consulter l'historique des appels et rendez-vous", "View Call and Appointment History"],
  "مراجعة المواعيد والاتصالات السابقة": ["Consulter les rendez-vous et contacts précédents", "Review previous appointments and contacts"],
  "تسجيل مكالمة أو زيارة": ["Enregistrer un appel ou une visite", "Log a Call or Visit"],
  "إضافة مدخل تواصل جديد مع التاريخ": ["Ajouter une nouvelle entrée de contact avec sa date", "Add a new contact entry with its date"],
  "تعديل مدخل التواصل": ["Modifier l'entrée de contact", "Edit Contact Entry"],
  "تعديل تفاصيل المكالمة أو الملاحظة": ["Modifier les détails de l'appel ou de la note", "Edit call or note details"],
  "حذف سجل تواصل": ["Supprimer l'entrée de contact", "Delete Contact Entry"],
  "مسح سجل مكالمة أو موعد": ["Supprimer l'historique d'un appel ou rendez-vous", "Delete a call or appointment record"],
  "لوحة القيادة والتقارير (Dashboard & Reports)": ["Tableau de bord et rapports", "Dashboard and Reports"],
  "عرض لوحة القيادة والمؤشرات": ["Consulter le tableau de bord et les indicateurs", "View Dashboard and Metrics"],
  "الاطلاع على الإحصائيات والمؤشرات العامة": ["Consulter les statistiques et indicateurs généraux", "View general statistics and metrics"],
  "استعراض التقارير الإحصائية": ["Consulter les rapports statistiques", "View Statistical Reports"],
  "عرض تقارير التوزيع الجغرافي والولايات": ["Consulter les rapports de répartition géographique par wilaya", "View geographic and wilaya reports"],
  "تصدير التقارير الإحصائية": ["Exporter les rapports statistiques", "Export Statistical Reports"],
  "تصدير التقارير والرسوم البيانية": ["Exporter les rapports et graphiques", "Export reports and charts"],
  "التحليلات والذكاء الاصطناعي (Analytics & AI)": ["Analyses et intelligence artificielle", "Analytics and AI"],
  "استعراض التحليلات الذكية": ["Consulter les analyses intelligentes", "View Smart Analytics"],
  "عرض المؤشرات التحليلية المتقدمة": ["Consulter les indicateurs analytiques avancés", "View advanced analytics metrics"],
  "تحليل مخاطر انقطاع العملاء": ["Analyser le risque de perte de clients", "Analyze Customer Churn Risk"],
  "مراقبة تقييمات الصحة ومخاطر فقدان العملاء": ["Surveiller les scores de santé et le risque de perte de clients", "Monitor health scores and customer loss risk"],
  "رؤى المساعد الذكي (AI Copilot)": ["Analyses de l'assistant IA (AI Copilot)", "AI Copilot Insights"],
  "استخدام المساعد الصوتي والتحليلي الذكي": ["Utiliser l'assistant vocal et analytique intelligent", "Use the voice and analytics assistant"],
  "البحث والفلاتر (Search & Filters)": ["Recherche et filtres", "Search and Filters"],
  "البحث الشامل في النظام": ["Recherche globale dans le système", "Global System Search"],
  "البحث السريع في كافة البيانات": ["Rechercher rapidement dans toutes les données", "Search all data quickly"],
  "البحث في سجلات العملاء": ["Rechercher dans les dossiers clients", "Search Client Records"],
  "البحث المتخصص حسب النشاط والاسم": ["Rechercher par activité et nom", "Search by activity and name"],
  "استخدام الفلاتر المتقدمة": ["Utiliser les filtres avancés", "Use Advanced Filters"],
  "تطبيق معايير التصفية المتعددة والمركبة": ["Appliquer plusieurs critères de filtrage combinés", "Apply multiple combined filter criteria"],
  "التصفية الجغرافية بالولايات": ["Filtrer géographiquement par wilaya", "Filter Geographically by Wilaya"],
  "فرز العملاء جغرافياً حسب الولاية والبلدية": ["Trier les clients par wilaya et commune", "Sort clients by wilaya and municipality"],
  "التصفية حسب البرامج": ["Filtrer par logiciel", "Filter by Program"],
  "فرز العملاء حسب نوع البرنامج المرخص": ["Trier les clients selon le type de logiciel sous licence", "Sort clients by licensed program type"],
  "النسخ الاحتياطي والأرشيف (Backups)": ["Sauvegardes et archives", "Backups and Archive"],
  "عرض النسخ الاحتياطية وسجلات الأمان": ["Consulter les sauvegardes et journaux de sécurité", "View Backups and Security Logs"],
  "الاطلاع على قائمة النسخ وسجلات التدقيق": ["Consulter la liste des sauvegardes et les journaux d'audit", "View the backup list and audit logs"],
  "إنشاء نسخ احتياطية يدوية": ["Créer des sauvegardes manuelles", "Create Manual Backups"],
  "أخذ لقطة فورية لقاعدة البيانات": ["Créer un instantané de la base de données", "Take an immediate database snapshot"],
  "تحميل ملفات النسخ الاحتياطي": ["Télécharger les fichiers de sauvegarde", "Download Backup Files"],
  "تنزيل ملف .dum أو .json محلياً": ["Télécharger localement un fichier .dum ou .json", "Download a .dum or .json file locally"],
  "استرجاع واستيراد البيانات": ["Restaurer et importer les données", "Restore and Import Data"],
  "استعادة بيانات من نسخة سابقة": ["Restaurer les données d'une sauvegarde précédente", "Restore data from a previous backup"],
  "حذف النسخ الاحتياطية": ["Supprimer les sauvegardes", "Delete Backups"],
  "تنظيف ومسح النسخ القديمة": ["Nettoyer et supprimer les anciennes sauvegardes", "Clean up and delete old backups"],
  "المستخدمون والموظفون (Users & Staff)": ["Utilisateurs et employés", "Users and Staff"],
  "عرض دليل الموظفين والمستخدمين": ["Consulter le répertoire des employés et utilisateurs", "View Employee and User Directory"],
  "الاطلاع على فريق العمل والمناصب": ["Consulter l'équipe et les postes", "View the team and positions"],
  "إضافة موظف/مستخدم جديد": ["Ajouter un employé ou utilisateur", "Add an Employee or User"],
  "تسجيل حساب مستخدم جديد": ["Enregistrer un nouveau compte utilisateur", "Register a new user account"],
  "تعديل بيانات الموظفين والمناصب": ["Modifier les informations et postes des employés", "Edit Employee Details and Positions"],
  "تحديث المنصب والمسمى والمسؤول المباشر": ["Mettre à jour le poste, l'intitulé et le responsable direct", "Update position, job title, and direct manager"],
  "تعطيل وتنشيط الحسابات": ["Désactiver et activer les comptes", "Disable and Enable Accounts"],
  "إيقاف حساب موظف مؤقتاً أو إعادة تنشيطه": ["Suspendre temporairement ou réactiver un compte employé", "Temporarily suspend or reactivate an employee account"],
  "حذف حساب مستخدم (يتطلب كلمة سر المسؤول)": ["Supprimer un compte utilisateur (mot de passe administrateur requis)", "Delete User Account (Administrator Password Required)"],
  "مسح حساب موظف نهائياً مع التحقق الإلزامي من كلمة مرور المسؤول العام (Gérant)": ["Supprimer définitivement un compte employé après vérification obligatoire du mot de passe du gérant", "Permanently delete an employee account after verifying the administrator's password"],
  "الأقسام والهيكلة (Departments)": ["Départements et structure", "Departments and Structure"],
  "استعراض هيكل الأقسام الأربعة": ["Consulter la structure des quatre départements", "View the Four-Department Structure"],
  "الاطلاع على اختصاصات ومهام الأقسام": ["Consulter les fonctions et tâches des départements", "View department responsibilities and tasks"],
  "إضافة قسم جديد": ["Ajouter un département", "Add a Department"],
  "استحداث قسم إداري جديد": ["Créer un nouveau département administratif", "Create a new administrative department"],
  "تعديل مهام واختصاصات القسم": ["Modifier les tâches et fonctions du département", "Edit Department Tasks and Responsibilities"],
  "تحديث المسؤوليات وتفاصيل القسم": ["Mettre à jour les responsabilités et détails du département", "Update department responsibilities and details"],
  "حذف الأقسام": ["Supprimer les départements", "Delete Departments"],
  "حذف قسم إداري": ["Supprimer un département administratif", "Delete an administrative department"],
  "الصلاحيات والنظام (Permissions & Settings)": ["Autorisations et paramètres", "Permissions and Settings"],
  "عرض مصفوفة الصلاحيات (60+)": ["Consulter la matrice des autorisations (60+)", "View Permission Matrix (60+)"],
  "الاطلاع على تفاصيل مصفوفة الصلاحيات الممنوحة": ["Consulter le détail des autorisations accordées", "View granted permission matrix details"],
  "منح الصلاحيات للموظفين": ["Accorder des autorisations aux employés", "Grant Permissions to Employees"],
  "تفعيل صلاحيات إضافية للموظف": ["Activer des autorisations supplémentaires pour l'employé", "Enable additional employee permissions"],
  "سحب الصلاحيات من الموظفين": ["Retirer des autorisations aux employés", "Revoke Employee Permissions"],
  "تعطيل صلاحيات معينة لموظف": ["Désactiver certaines autorisations d'un employé", "Disable specific employee permissions"],
  "عرض إعدادات النظام": ["Consulter les paramètres système", "View System Settings"],
  "استعراض تفضيلات النظام واللغات": ["Consulter les préférences et langues du système", "View system preferences and languages"],
  "تعديل وضبط النظام": ["Modifier et configurer le système", "Edit and Configure System"],
  "تعديل الإعدادات العامة للنظام": ["Modifier les paramètres généraux du système", "Edit general system settings"],
  "الحساب والجلسات (Account & Sessions)": ["Compte et sessions", "Account and Sessions"],
  "عرض الملف الشخصي": ["Consulter le profil", "View Profile"],
  "الاطلاع على بيانات الجلسة النشطة": ["Consulter les informations de la session active", "View active session details"],
  "تغيير كلمة المرور الشخصية": ["Modifier le mot de passe personnel", "Change Personal Password"],
  "تحديث كلمة المرور الشخصية للمستخدم": ["Mettre à jour le mot de passe personnel de l'utilisateur", "Update the user's personal password"],
  "إدارة الجلسات وتبديل المستخدمين": ["Gérer les sessions et changer d'utilisateur", "Manage Sessions and Switch Users"],
  "التحكم في تسجيلات الدخول وبوابة التبديل": ["Gérer les connexions et le portail de changement d'utilisateur", "Manage sign-ins and the user-switching portal"]
});

const frFullDict = { ...frDict, ...Object.fromEntries(Object.entries(extraTranslations).map(([key, values]) => [key, values[0]])) };
const enFullDict = { ...enDict, ...Object.fromEntries(Object.entries(extraTranslations).map(([key, values]) => [key, values[1]])) };

function createUniqueReverseDictionary(dictionary) {
  const reverse = new Map();
  const ambiguousValues = new Set();
  for (const [key, value] of Object.entries(dictionary)) {
    if (ambiguousValues.has(value)) continue;
    if (reverse.has(value) && reverse.get(value) !== key) {
      reverse.delete(value);
      ambiguousValues.add(value);
    } else {
      reverse.set(value, key);
    }
  }
  return reverse;
}

const frReverseDict = createUniqueReverseDictionary(frFullDict);
const enReverseDict = createUniqueReverseDictionary(enFullDict);
const literalUiTranslations = {
  "PROGILIC CRM • USER ACCESS PORTAL": {
    ar: "بوابة مستخدمي PROGILIC CRM",
    fr: "PORTAIL D'ACCÈS UTILISATEUR PROGILIC CRM",
    en: "PROGILIC CRM • USER ACCESS PORTAL"
  },
  "USER ACCESS PORTAL": {
    ar: "بوابة المستخدمين",
    fr: "PORTAIL D'ACCÈS UTILISATEUR",
    en: "USER ACCESS PORTAL"
  }
};
const phraseKeys = {
  fr: Object.keys(frFullDict).filter(key => key && /[\u0600-\u06FF]/.test(key)).sort((a, b) => b.length - a.length),
  en: Object.keys(enFullDict).filter(key => key && /[\u0600-\u06FF]/.test(key)).sort((a, b) => b.length - a.length)
};
const sourcePhraseEntries = {
  fr: [...enReverseDict.entries()].sort(([a], [b]) => b.length - a.length),
  en: [...frReverseDict.entries()].sort(([a], [b]) => b.length - a.length),
  ar: [...new Map([...frReverseDict, ...enReverseDict]).entries()].sort(([a], [b]) => b.length - a.length)
};

function getDictionary(lang) {
  if (lang === 'fr') return frFullDict;
  if (lang === 'en') return enFullDict;
  return {};
}

function translateExactUiText(text, lang) {
  if (literalUiTranslations[text]) return literalUiTranslations[text][lang] || text;
  const literalSource = Object.values(literalUiTranslations)
    .find(translations => Object.values(translations).includes(text));
  if (literalSource) return literalSource[lang] || text;
  const dictionary = getDictionary(lang);
  if (dictionary[text]) return dictionary[text];
  const sourceArabicKey = lang === 'fr'
    ? enReverseDict.get(text)
    : lang === 'en'
      ? frReverseDict.get(text)
      : frReverseDict.get(text) || enReverseDict.get(text);
  if (!sourceArabicKey) return text;
  if (lang === 'fr') return frFullDict[sourceArabicKey] || text;
  if (lang === 'en') return enFullDict[sourceArabicKey] || text;
  return sourceArabicKey;
}

export function t(str) {
  if (!str) return '';
  const lang = S.lang || 'ar';
  const exactTranslation = translateExactUiText(str, lang);
  if (exactTranslation !== str) return exactTranslation;
  if (lang === 'ar') return str;
  const dictionary = getDictionary(lang);
  if (dictionary[str]) return dictionary[str];
  const dynamicTranslation = translateDynamicText(str, lang);
  if (dynamicTranslation) return dynamicTranslation;
  const dynamicPrefix = Object.keys(dictionary)
    .filter(key => (key.endsWith(': ') || key.endsWith(':')) && str.startsWith(key))
    .sort((a, b) => b.length - a.length)[0];
  return dynamicPrefix ? dictionary[dynamicPrefix] + str.slice(dynamicPrefix.length) : str;
}

function translateDynamicText(str, lang) {
  const importMatch = str.match(/^تم استيراد (\d+) عميل بنجاح من ملف (.+)!$/);
  if (importMatch) {
    return lang === 'fr'
      ? `${importMatch[1]} client(s) importé(s) avec succès depuis le fichier ${importMatch[2]} !`
      : `Successfully imported ${importMatch[1]} client(s) from ${importMatch[2]}!`;
  }
  const reportMatch = str.match(/^التقرير يعرض (\d+) عملية مطابقة؛ استخدم تصدير CSV لتنزيل تفاصيل هذه العمليات\.$/);
  if (reportMatch) {
    return lang === 'fr'
      ? `Le rapport affiche ${reportMatch[1]} opération(s) correspondante(s) ; exportez le CSV pour télécharger les détails.`
      : `The report shows ${reportMatch[1]} matching activities; export CSV to download their details.`;
  }
  const employeesMatch = str.match(/^المعروض: (\d+) من إجمالي (\d+) موظف$/);
  if (employeesMatch) {
    return lang === 'fr'
      ? `Affichés : ${employeesMatch[1]} sur ${employeesMatch[2]} employés`
      : `Showing ${employeesMatch[1]} of ${employeesMatch[2]} employees`;
  }
  const userCountMatch = str.match(/^(\d+) مستخدم مسجل$/);
  if (userCountMatch) {
    return lang === 'fr'
      ? `${userCountMatch[1]} utilisateur(s) enregistré(s)`
      : `${userCountMatch[1]} registered user(s)`;
  }
  const contactGapMatch = str.match(/^غياب تواصل لـ (\d+) يوم — يستدعي المتابعة العاجلة\.$/);
  if (contactGapMatch) {
    return lang === 'fr'
      ? `Absence de contact pendant ${contactGapMatch[1]} jours — un suivi urgent est nécessaire.`
      : `No contact for ${contactGapMatch[1]} days — urgent follow-up is needed.`;
  }
  const partnerCountMatch = str.match(/^📋 دليل الشركاء والمتابعة \((\d+)\)$/);
  if (partnerCountMatch) {
    return lang === 'fr'
      ? `📋 Répertoire des partenaires et suivi (${partnerCountMatch[1]})`
      : `📋 Partner Directory and Follow-up (${partnerCountMatch[1]})`;
  }
  const resultsMatch = str.match(/^المطابق: (\d+) عميل$/);
  if (resultsMatch) {
    return lang === 'fr'
      ? `${resultsMatch[1]} client(s) correspondant(s)`
      : `${resultsMatch[1]} matching client(s)`;
  }
  const pageSizeMatch = str.match(/^(\d+) \/ صفحة$/);
  if (pageSizeMatch) return lang === 'fr' ? `${pageSizeMatch[1]} / page` : `${pageSizeMatch[1]} / page`;
  const licensedSoftwareMatch = str.match(/^(\d+) برنامج مرخص$/);
  if (licensedSoftwareMatch) {
    return lang === 'fr'
      ? `${licensedSoftwareMatch[1]} logiciel(s) sous licence`
      : `${licensedSoftwareMatch[1]} licensed software item(s)`;
  }
  const deviceCountMatch = str.match(/^💻 (\d+) أجهزة$/);
  if (deviceCountMatch) {
    return lang === 'fr'
      ? `💻 ${deviceCountMatch[1]} appareil(s)`
      : `💻 ${deviceCountMatch[1]} device(s)`;
  }
  const clientPercentMatch = str.match(/^(\d+) عميل \((\d+)%\)$/);
  if (clientPercentMatch) {
    return lang === 'fr'
      ? `${clientPercentMatch[1]} client(s) (${clientPercentMatch[2]} %)`
      : `${clientPercentMatch[1]} client(s) (${clientPercentMatch[2]}%)`;
  }
  const geographicMatch = str.match(/^🗺️ Geographic Distribution \((\d+) ولاية\)$/);
  if (geographicMatch) {
    return lang === 'fr'
      ? `🗺️ Répartition géographique (${geographicMatch[1]} wilaya(s))`
      : `🗺️ Geographic Distribution (${geographicMatch[1]} wilayas)`;
  }
  const activeRateMatch = str.match(/^✓ ([\d.]+)% نسبة تشغيل نشطة$/);
  if (activeRateMatch) {
    return lang === 'fr'
      ? `✓ Taux d'activité : ${activeRateMatch[1]} %`
      : `✓ Active Rate: ${activeRateMatch[1]}%`;
  }
  const averageDevicesMatch = str.match(/^بمعدل ([\d.]+) جهاز\/عميل$/);
  if (averageDevicesMatch) {
    return lang === 'fr'
      ? `Moyenne : ${averageDevicesMatch[1]} appareil(s)/client`
      : `Average: ${averageDevicesMatch[1]} device(s)/client`;
  }
  const installedLicensesMatch = str.match(/^التراخيص المنصبة \((\d+)\)$/);
  if (installedLicensesMatch) {
    return lang === 'fr'
      ? `Licences installées (${installedLicensesMatch[1]})`
      : `Installed Licenses (${installedLicensesMatch[1]})`;
  }
  const clientsMatch = str.match(/^العملاء \((\d+)\)$/);
  if (clientsMatch) return lang === 'fr' ? `Clients (${clientsMatch[1]})` : `Clients (${clientsMatch[1]})`;
  const clientCountMatch = str.match(/^(\d+) عميل$/);
  if (clientCountMatch) {
    return lang === 'fr'
      ? `${clientCountMatch[1]} client(s)`
      : `${clientCountMatch[1]} client(s)`;
  }
  const licenseCountMatch = str.match(/^(\d+) ترخيص$/);
  if (licenseCountMatch) {
    return lang === 'fr'
      ? `${licenseCountMatch[1]} licence(s)`
      : `${licenseCountMatch[1]} license(s)`;
  }
  const deployedLicenseMatch = str.match(/^(\d+) ترخيص منشور$/);
  if (deployedLicenseMatch) {
    return lang === 'fr'
      ? `${deployedLicenseMatch[1]} licence(s) déployée(s)`
      : `${deployedLicenseMatch[1]} deployed license(s)`;
  }
  return '';
}

const protectedContentSelector = [
  '.client-name', '.client-company', '.client-email', '.client-phone',
  '.cc-name', '.cc-company', '.ch-name', '.ch-company', '.rh-name',
  '.notes-box', '.tl-note', '.prog-name',
  '.ival', '.staff-name', '.staff-position', '.staff-supervisor',
  '.client-notes', '.client-description', '.activity-description',
  '.timeline-description', '.user-name', '.staff-name', '.data-value',
  '[data-user-content="true"]', '[contenteditable="true"]',
  'input', 'textarea', 'code', 'pre'
].join(',');

function replaceKnownPhrases(text, dictionary, lang) {
  const keys = phraseKeys[lang] || [];
  let result = text;
  for (const key of keys) {
    if (!result.includes(key)) continue;
    const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const phrase = new RegExp(`(^|[^\\u0600-\\u06FF])${escapedKey}(?=$|[^\\u0600-\\u06FF])`, 'g');
    result = result.replace(phrase, (_, prefix) => prefix + dictionary[key]);
  }
  return result;
}

function replaceKnownSourcePhrases(text, lang) {
  const entries = sourcePhraseEntries[lang] || [];
  const targetDictionary = getDictionary(lang);
  let result = text;
  for (const [key, arabicKey] of entries) {
    if (!key || !result.includes(key)) continue;
    const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const phrase = new RegExp(`(^|[^A-Za-z0-9])${escapedKey}(?=$|[^A-Za-z0-9])`, 'g');
    result = result.replace(phrase, (_, prefix) => {
      return prefix + (lang === 'ar' ? arabicKey : targetDictionary[arabicKey] || key);
    });
  }
  return result;
}

function localizeDigits(text, lang) {
  const targetDigits = lang === 'ar' ? '٠١٢٣٤٥٦٧٨٩' : '0123456789';
  return text.replace(/[0-9\u0660-\u0669\u06F0-\u06F9]/g, digit => {
    const code = digit.charCodeAt(0);
    const value = code >= 0x06F0 ? code - 0x06F0 : code >= 0x0660 ? code - 0x0660 : code - 0x30;
    return targetDigits[value];
  });
}

function translateRenderedText(text, dictionary, lang) {
  const exactTranslation = translateExactUiText(text, lang);
  if (exactTranslation !== text) return exactTranslation;

  const dynamicTranslation = translateDynamicText(text, lang);
  if (dynamicTranslation) return dynamicTranslation;

  return replaceKnownSourcePhrases(
    replaceKnownPhrases(text, dictionary, lang),
    lang
  );
}

export function localizeRenderedDom(root) {
  if (!root || !root.ownerDocument) return;
  const lang = S.lang || 'ar';
  const direction = lang === 'ar' ? 'rtl' : 'ltr';
  const doc = root.ownerDocument;
  doc.documentElement.lang = lang;
  doc.documentElement.dir = direction;
  if (doc.body) doc.body.dir = direction;
  root.dir = direction;

  if (lang === 'ar') {
    for (const element of root.querySelectorAll('[data-i18n-direction]')) {
      element.style.direction = element.dataset.i18nDirection;
      delete element.dataset.i18nDirection;
    }
    for (const element of root.querySelectorAll('[data-i18n-align]')) {
      element.style.textAlign = element.dataset.i18nAlign;
      delete element.dataset.i18nAlign;
    }
  }
  const dictionary = getDictionary(lang);
  const walker = doc.createTreeWalker(root, doc.defaultView.NodeFilter.SHOW_TEXT);
  const textNodes = [];
  while (walker.nextNode()) textNodes.push(walker.currentNode);

  for (const node of textNodes) {
    const element = node.parentElement;
    if (!element) continue;
    if (element.closest('style, script')) continue;
    const statusBadge = element.closest('.bdg, .badge');
    const clientValue = element.closest('.ival');
    if (
      element.closest(protectedContentSelector) &&
      !(statusBadge && clientValue)
    ) continue;
    const original = node.nodeValue;
    const trimmed = original.trim();
    if (!trimmed) continue;
    const translated = translateRenderedText(trimmed, dictionary, lang);
    const localized = localizeDigits(translated, lang);
    if (localized !== trimmed) {
      const start = original.indexOf(trimmed);
      node.nodeValue = original.slice(0, start) + localized + original.slice(start + trimmed.length);
    }
  }

  for (const element of root.querySelectorAll('[title], [placeholder], [aria-label]')) {
    if (!element.matches('input, textarea') && element.closest(protectedContentSelector)) continue;
    for (const attribute of ['title', 'placeholder', 'aria-label']) {
      const value = element.getAttribute(attribute);
      if (value) {
        const translated = localizeDigits(translateRenderedText(value, dictionary, lang), lang);
        if (translated !== value) element.setAttribute(attribute, translated);
      }
    }
  }

  if (lang === 'ar') {
    for (const element of root.querySelectorAll('[data-i18n-dir]')) {
      element.setAttribute('dir', element.dataset.i18nDir);
      delete element.dataset.i18nDir;
    }
  } else {
    for (const element of root.querySelectorAll('[dir="rtl"]')) {
      element.dataset.i18nDir = 'rtl';
      element.setAttribute('dir', 'ltr');
    }
  }

  if (lang !== 'ar') {
    for (const element of root.querySelectorAll('[style]')) {
      if (element.style.direction === 'rtl') {
        element.dataset.i18nDirection = 'rtl';
        element.style.direction = 'ltr';
      }
      if (element.style.textAlign === 'right') {
        element.dataset.i18nAlign = 'right';
        element.style.textAlign = 'left';
      }
    }
  }
}

export function setLanguage(lang) {
  if (!SUPPORTED_LANGUAGES.includes(lang)) return;
  S.lang = lang;
  try {
    localStorage.setItem('crm_lang', lang);
  } catch (e) {}
  applyLanguageToDocument(lang);
  if (window.R) window.R();
  if (document.body) localizeRenderedDom(document.body);
}

export function applyLanguageToDocument(lang = S.lang || 'ar') {
  const direction = lang === 'ar' ? 'rtl' : 'ltr';
  document.documentElement.dir = direction;
  document.documentElement.lang = lang;
  if (document.body) document.body.dir = direction;

  const metadata = {
    ar: {
      title: 'إدارة العملاء والذكاء التجاري — PROGILIC CRM v3',
      description: 'نظام لإدارة العملاء والبرامج والتراخيص والدعم الفني مع تقارير ومزامنة آمنة.'
    },
    fr: {
      title: 'CRM clients et intelligence commerciale — PROGILIC CRM v3',
      description: 'Gestion des clients, logiciels, licences et support avec rapports et synchronisation sécurisée.'
    },
    en: {
      title: 'Client CRM and Business Intelligence — PROGILIC CRM v3',
      description: 'Manage clients, software, licenses, and support with reports and secure synchronization.'
    }
  }[SUPPORTED_LANGUAGES.includes(lang) ? lang : 'ar'];

  document.title = metadata.title;
  for (const selector of ['meta[name="description"]', 'meta[property="og:description"]']) {
    const element = document.head?.querySelector(selector);
    if (element) element.setAttribute('content', metadata.description);
  }
  const openGraphTitle = document.head?.querySelector('meta[property="og:title"]');
  if (openGraphTitle) openGraphTitle.setAttribute('content', metadata.title);
}

export function toggleLanguage() {
  const current = S.lang || 'ar';
  const order = ['ar', 'fr', 'en'];
  const next = order[(order.indexOf(current) + 1) % order.length];
  setLanguage(next);
}
