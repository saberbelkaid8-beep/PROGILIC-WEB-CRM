import fs from 'fs';
let render = fs.readFileSync('src/presentation/render-core.js', 'utf-8');
render = render.replace("const tempWrapper = document.createElement('div');\n  tempWrapper.innerHTML = nextHTML;", "const tempWrapper = document.createElement('div');\n  tempWrapper.id = app.id;\n  tempWrapper.className = app.className;\n  tempWrapper.innerHTML = nextHTML;");
fs.writeFileSync('src/presentation/render-core.js', render);
