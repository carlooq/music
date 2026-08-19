import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// 👉 PODMIEŃ TO NA SWOJĄ KONFIGURACJĘ Z FIREBASE CONSOLE
// (Project settings → Your apps → Web app → fragment "firebaseConfig")
// Te wartości NIE są tajne - to standardowa, publiczna konfiguracja
// frontendowa, bezpiecznie trzymać ją w kodzie.
const firebaseConfig = {
  apiKey: "AIzaSyBt2SlXKyRBG-1I5z08iHhA2ZavDbl0YWk",
  authDomain: "music-d496a.firebaseapp.com",
  projectId: "music-d496a",
  storageBucket: "music-d496a.firebasestorage.app",
  messagingSenderId: "608461236555",
  appId: "1:608461236555:web:9fb03d92f2efa81c2820ce",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
