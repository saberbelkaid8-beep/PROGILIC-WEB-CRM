import fs from 'fs';
import path from 'path';

// Wilaya French to Arabic normalized mapping
const WILAYA_MAP = {
  'ALGER': 'الجزائر',
  'BLIDA': 'البليدة',
  'OUM BOUAKI': 'أم البواقي',
  'OM BOUAKI': 'أم البواقي',
  'BATNA': 'باتنة',
  'TIARET': 'تيارت',
  'AIN DEFLA': 'عين الدفلى',
  'BOUMERDES': 'بومرداس',
  'SETIF': 'سطيف',
  'BOUIRA': 'البويرة',
  'CHLEF': 'الشلف',
  'ANNABA': 'عنابة',
  'JIJEL': 'جيجل',
  'TIPAZA': 'تيبازة',
  'GHILIZANE': 'غليزان',
  'TIZI OUZOU': 'تيزي وزو',
  'MOSTAGHANEM': 'مستغانم',
  'MSILA': 'المسيلة',
  'MEDEA': 'المدية',
  'TISEMSILT': 'تيسمسيلت',
  'BOUSAADA': 'المسيلة',
  'OUED SOUF': 'الوادي',
  'DJELFA': 'الجلفة',
  'BECHAR': 'بشار',
  'BEJAYA': 'بجاية',
  'MILA': 'ميلة',
  'BISKRA': 'بسكرة',
  'BORDJ BOUARIRIDJ': 'برج بوعريريج',
  'MASCARA': 'معسكر',
  'ORAN': 'وهران',
  'OUREGLA': 'ورقلة',
  'TARAF': 'الطارف',
  'TAMANRASTE': 'تمنراست',
  'EL BAYAD': 'البيض'
};

const rawCsv = fs.readFileSync('scripts/raw_clients.csv', 'utf8');
const lines = rawCsv.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);

const header = lines[0];
const dataLines = lines.slice(1);

const parsedClients = [];
let maxId = 0;

for (const line of dataLines) {
  // Parse CSV line handling potential whitespace around commas
  const parts = line.split(',').map(p => p.trim());
  if (!parts[0] || isNaN(parseFloat(parts[0]))) continue;

  const contId = parseInt(parseFloat(parts[0]));
  const nom = parts[1] || '';
  const prenom = parts[2] || '';
  const adresse = parts[3] || '';
  const wilayaRaw = (parts[4] || '').toUpperCase();
  const telephone = parts[5] || '';
  const poste = parseInt(parseFloat(parts[6])) || 1;
  const version = parts[7] || '21';
  const installationYear = parts[8] ? parseInt(parseFloat(parts[8])) : 2023;
  const logiciel = parts[9] || 'COMMERCIAL';

  // Construct Full Name & Company
  let fullName = '';
  let company = '';
  if (nom === 'SARL' || nom === 'EURL' || nom === 'DR' || nom === 'CUISIN' || nom === 'PASTRY') {
    fullName = `${nom} ${prenom}`.trim();
    company = `${nom} ${prenom}`.trim();
  } else {
    fullName = `${nom} ${prenom}`.trim();
    company = `${nom} ${prenom}`.trim();
  }

  // Determine Arabic Wilaya
  const wilayaAr = WILAYA_MAP[wilayaRaw] || wilayaRaw;

  // Software & Business Type
  const isProduction = (logiciel && logiciel.toUpperCase().includes('PROD'));
  const bType = isProduction ? 'إنتاج وصناعة' : 'تجارة تجزئة';
  const bField = isProduction ? 'صناعة / إنتاج' : 'تجاري / نقاط بيع';
  const progType = isProduction ? 'إنتاجي' : 'تجاري';

  const startDate = installationYear ? `${installationYear}-01-01` : '2023-01-01';
  const progName = `PROGILIC ${isProduction ? 'PRODUCTION' : 'COMMERCIAL'} v${version}`.trim();

  const clientObj = {
    id: contId,
    fullName: fullName || `عميل #${contId}`,
    company: company || '',
    phone: telephone || '',
    wilaya: wilayaAr,
    commune: adresse || '',
    location: adresse || '',
    businessType: bType,
    businessField: bField,
    status: 'نشط',
    startDate: startDate,
    endDate: '',
    lastContact: '',
    notes: `تم الاستيراد والدمج من قاعدة عقود بروغيليك (${nom} ${prenom} - إصدار ${version} - ${poste} جهاز)`,
    gps: { lat: null, lng: null },
    score: 100,
    openIssuesCount: 0,
    requirementsCount: 0,
    programsCount: 1,
    installationsCount: poste,
    programs: [
      {
        id: contId * 100 + 1,
        programName: progName,
        platform: 'Desktop',
        type: progType,
        installationsCount: poste,
        startDate: startDate,
        endDate: ''
      }
    ],
    issues: [],
    requirements: [],
    contactHistory: [],
    _subcollectionsLoaded: true
  };

  parsedClients.push(clientObj);
  if (contId > maxId) maxId = contId;
}

console.log(`Successfully parsed ${parsedClients.length} clients. Max Contract ID: ${maxId}`);

// Save to JSON
fs.mkdirSync('src/data', { recursive: true });
fs.writeFileSync('src/data/importedClients.json', JSON.stringify(parsedClients, null, 2), 'utf8');

// Also create JS module for direct import
const jsContent = `/**
 * Seed & Initial Database for saberbelkaid8@gmail.com and active session
 * Contains 441 Algerian CRM clients with licenses, wilayas, installations, and software versions.
 */
export const INITIAL_IMPORTED_CLIENTS = ${JSON.stringify(parsedClients, null, 2)};
`;

fs.writeFileSync('src/data/importedClients.js', jsContent, 'utf8');
console.log('Successfully written src/data/importedClients.json and src/data/importedClients.js');
