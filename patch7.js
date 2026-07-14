import fs from 'fs';
let render = fs.readFileSync('src/presentation/render-core.js', 'utf-8');
render = render.replace('} catch(e) { console.error("Crash in performRender:", e); } }', '} catch(e) { document.getElementById("app").innerHTML = "<div style=\'color:red;padding:20px;\'><h1>CRASH in performRender:</h1><pre>" + e.stack + "</pre></div>"; } }');
fs.writeFileSync('src/presentation/render-core.js', render);
