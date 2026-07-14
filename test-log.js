import fs from 'fs';

let main = fs.readFileSync('src/main.js', 'utf-8');
main = main.replace('await loadDataFromFirestore(user);', 'console.log("Before loadDataFromFirestore"); await loadDataFromFirestore(user); console.log("After loadDataFromFirestore");');
fs.writeFileSync('src/main.js', main);

let storage = fs.readFileSync('src/business/storage.js', 'utf-8');
storage = storage.replace('setLoading(true);', 'console.log("loadDataFromFirestore: start"); setLoading(true);');
storage = storage.replace('const data = await getUserData(user.uid);', 'console.log("loadDataFromFirestore: before getUserData"); const data = await getUserData(user.uid); console.log("loadDataFromFirestore: after getUserData", data);');
storage = storage.replace('startRealtimeSync(user.uid);', 'console.log("loadDataFromFirestore: before startRealtimeSync"); startRealtimeSync(user.uid); console.log("loadDataFromFirestore: after startRealtimeSync");');
fs.writeFileSync('src/business/storage.js', storage);
