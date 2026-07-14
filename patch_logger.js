import fs from 'fs';
let main = fs.readFileSync('src/main.js', 'utf-8');
main = main.replace('window.APP_LOGS = [];\nconsole.log("APP BOOTED");', 'window.APP_LOGS = [];\n');
main = main.replace('function renderLogs() {', 'window.APP_LOGS.push("APP BOOTED");\nfunction renderLogs() {');
fs.writeFileSync('src/main.js', main);
