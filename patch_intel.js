import fs from 'fs';
let code = fs.readFileSync('src/business/intelligence.js', 'utf-8');
code = code.replace("export function autoDetectFeatureOpp(issues){", "export function autoDetectFeatureOpp(issues){\n  if (!issues || !Array.isArray(issues)) return;");
fs.writeFileSync('src/business/intelligence.js', code);
