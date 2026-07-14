import fs from 'fs';
const v = fs.readFileSync('src/presentation/render-core.js', 'utf8');
console.log(v.includes('try { clients.forEach'));
