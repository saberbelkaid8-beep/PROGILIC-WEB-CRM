import fs from 'fs';
let render = fs.readFileSync('src/presentation/render-core.js', 'utf-8');
render = render.replace('function performRender() {', 'function performRender() { try {');
render = render.replace('  updateAuditorHUD();\n}', '  updateAuditorHUD();\n} catch(e) { console.error("Crash in performRender:", e); } }');
fs.writeFileSync('src/presentation/render-core.js', render);
