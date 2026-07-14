import fs from 'fs';
let main = fs.readFileSync('src/main.js', 'utf-8');
main = `
window.addEventListener('unhandledrejection', event => {
  console.error("Unhandled rejection:", event.reason);
});
window.addEventListener('error', event => {
  console.error("Uncaught error:", event.error);
});
` + main;
fs.writeFileSync('src/main.js', main);
