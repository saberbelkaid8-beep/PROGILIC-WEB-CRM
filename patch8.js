import fs from 'fs';
let main = fs.readFileSync('src/main.js', 'utf-8');
main = `
window.addEventListener('unhandledrejection', event => {
  const err = event.reason;
  const eStr = err ? err.stack || err.message || String(err) : "Unknown rejection";
  document.body.innerHTML += "<div style='position:fixed;bottom:0;left:0;right:0;background:red;color:white;padding:10px;z-index:9999;'>Unhandled Rejection: " + eStr + "</div>";
});
window.addEventListener('error', event => {
  const err = event.error;
  const eStr = err ? err.stack || err.message || String(err) : event.message;
  document.body.innerHTML += "<div style='position:fixed;bottom:0;left:0;right:0;background:red;color:white;padding:10px;z-index:9999;'>Uncaught Error: " + eStr + "</div>";
});
` + main;
fs.writeFileSync('src/main.js', main);
