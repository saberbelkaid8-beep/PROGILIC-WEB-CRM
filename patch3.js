import fs from 'fs';
let render = fs.readFileSync('src/presentation/render-core.js', 'utf-8');
render = render.replace('clients.forEach(c => autoDetectFeatureOpp(c.issues));', 'try { clients.forEach(c => autoDetectFeatureOpp(c.issues || [])); } catch(e) { console.error("Error in autoDetectFeatureOpp:", e); }');
fs.writeFileSync('src/presentation/render-core.js', render);
