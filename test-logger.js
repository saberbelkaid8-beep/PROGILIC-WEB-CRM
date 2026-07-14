import fs from 'fs';
let main = fs.readFileSync('src/main.js', 'utf-8');
const logger = `
window.APP_LOGS = [];
const originalLog = console.log;
const originalError = console.error;
console.log = function(...args) {
  originalLog.apply(console, args);
  window.APP_LOGS.push("LOG: " + args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' '));
  renderLogs();
};
console.error = function(...args) {
  originalError.apply(console, args);
  window.APP_LOGS.push("ERR: " + args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' '));
  renderLogs();
};
function renderLogs() {
  let logDiv = document.getElementById('debug-logs');
  if (!logDiv) {
    logDiv = document.createElement('div');
    logDiv.id = 'debug-logs';
    logDiv.style.position = 'fixed';
    logDiv.style.bottom = '0';
    logDiv.style.left = '0';
    logDiv.style.width = '100%';
    logDiv.style.height = '300px';
    logDiv.style.overflowY = 'scroll';
    logDiv.style.background = 'black';
    logDiv.style.color = 'lime';
    logDiv.style.zIndex = '999999';
    document.body.appendChild(logDiv);
  }
  logDiv.innerHTML = window.APP_LOGS.join('<br/>');
}
`;
fs.writeFileSync('src/main.js', logger + main);
