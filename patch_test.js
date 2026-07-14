import fs from 'fs';
let main = fs.readFileSync('src/main.js', 'utf-8');
main = main.replace('window.APP_LOGS = [];', 'window.APP_LOGS = [];\nconsole.log("APP BOOTED");');
fs.writeFileSync('src/main.js', main);
