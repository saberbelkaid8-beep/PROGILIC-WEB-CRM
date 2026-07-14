import fs from 'fs';

let service = fs.readFileSync('src/firebase/service.js', 'utf-8');
const regex = /\/\/ 3\. Automated Legacy Schema Migration Layer[\s\S]*?(?=\n\/\/|$)/;
service = service.replace(regex, '');
fs.writeFileSync('src/firebase/service.js', service);
