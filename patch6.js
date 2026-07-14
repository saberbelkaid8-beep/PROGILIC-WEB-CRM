import fs from 'fs';
let svc = fs.readFileSync('src/firebase/service.js', 'utf-8');
svc = svc.replace('export async function getUserData(userId) {', 'export async function getUserData(userId) {\nconsole.log("getUserData: start");\n');
svc = svc.replace('const snap = await getDoc(docRef);', 'console.log("getUserData: before getDoc");\nconst snap = await getDoc(docRef);\nconsole.log("getUserData: after getDoc");\n');
fs.writeFileSync('src/firebase/service.js', svc);
