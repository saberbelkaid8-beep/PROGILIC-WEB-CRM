import fs from 'fs';

// Update storage.js
let storage = fs.readFileSync('src/business/storage.js', 'utf-8');
storage = storage.replace("migrateLegacyDataIfNeeded,", "");
storage = storage.replace("} from '../firebase/service.js';", "} from '../firebase/service.js';\nimport { migrateLegacyDataIfNeeded } from '../firebase/migration.js';");
fs.writeFileSync('src/business/storage.js', storage);

// Update service.js
let service = fs.readFileSync('src/firebase/service.js', 'utf-8');
const startIndex = service.indexOf('export async function migrateLegacyDataIfNeeded');
const endIndex = service.indexOf('// 4. Client Contacts Management'); // Assuming this follows
if(startIndex > -1 && endIndex > -1) {
  service = service.substring(0, startIndex) + service.substring(endIndex);
  fs.writeFileSync('src/firebase/service.js', service);
  console.log('Removed migration from service.js');
} else {
  console.log('Could not find migration bounds in service.js');
}
