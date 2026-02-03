
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, enableIndexedDbPersistence } from "firebase/firestore";

// ------------------------------------------------------------------
// DÔLEŽITÉ: Tu nahraďte hodnoty svojimi kľúčmi z Firebase Console!
// ------------------------------------------------------------------
const firebaseConfig = {
  apiKey: "AIzaSyCiwov4WvhrpLKABMMxBF20gXjtgYaI6lQ",
  authDomain: "moja-spajza.firebaseapp.com",
  projectId: "moja-spajza",
  storageBucket: "moja-spajza.firebasestorage.app",
  messagingSenderId: "828799667228",
  appId: "1:828799667228:web:c49e9171be80eb77b6a3d9",
  measurementId: "G-ELVPCN48PV"
};

// Detekcia či sú kľúče nastavené. 
// Keďže sme ich už vyplnili, nastavíme túto hodnotu napevno na true.
export const isFirebaseConfigured = true;

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
