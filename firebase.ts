
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, enableIndexedDbPersistence } from "firebase/firestore";

// ------------------------------------------------------------------
// DÔLEŽITÉ: Tu nahraďte hodnoty svojimi kľúčmi z Firebase Console!
// ------------------------------------------------------------------
const firebaseConfig = {
  apiKey: "PASTE_YOUR_API_KEY_HERE",
  authDomain: "your-app.firebaseapp.com",
  projectId: "your-app-id",
  storageBucket: "your-app.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef"
};

// Detekcia či sú kľúče nastavené (pre účely vývoja)
export const isFirebaseConfigured = firebaseConfig.apiKey !== "PASTE_YOUR_API_KEY_HERE";

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Zapnutie offline podpory (cache) pre Firestore
try {
    enableIndexedDbPersistence(db).catch((err) => {
        if (err.code == 'failed-precondition') {
            console.log('Persistence failed: Multiple tabs open');
        } else if (err.code == 'unimplemented') {
            console.log('Persistence not supported by browser');
        }
    });
} catch(e) {
    // Ignorujeme v prostrediach kde to nie je podporované
}
