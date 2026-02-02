
import React, { useState } from 'react';
import { User } from '../types';
import { auth, db, isFirebaseConfigured } from '../firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { INITIAL_LOCATIONS, INITIAL_CATEGORIES } from '../constants';

interface Props {
  onLogin: (user: User) => void;
}

export const AuthScreen: React.FC<Props> = ({ onLogin }) => {
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [imageError, setImageError] = useState(false);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!isFirebaseConfigured) {
        setError('CHYBA: Firebase nie je nakonfigurovaný. Pridajte API kľúče do firebase.ts');
        setLoading(false);
        return;
    }

    try {
        if (isRegistering) {
            // REGISTRÁCIA
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const firebaseUser = userCredential.user;
            
            // Vygenerujeme nové householdId
            const newHouseholdId = Math.random().toString(36).substr(2, 6).toUpperCase();

            // Uložíme profil užívateľa do Firestore
            const userData: User = {
                id: firebaseUser.uid,
                name: name || 'Užívateľ',
                email: email,
                householdId: newHouseholdId
            };
            
            await setDoc(doc(db, "users", firebaseUser.uid), userData);

            // Vytvoríme defaultné nastavenia pre novú domácnosť
            await setDoc(doc(db, "households", newHouseholdId), {
                ownerId: firebaseUser.uid,
                locations: INITIAL_LOCATIONS,
                categories: INITIAL_CATEGORIES
            });

            // Update display name vo Firebase Auth
            await updateProfile(firebaseUser, { displayName: name });

        } else {
            // PRIHLÁSENIE
            await signInWithEmailAndPassword(auth, email, password);
            // Poznámka: samotný callback onAuthStateChanged v App.tsx sa postará o načítanie dát
        }
    } catch (err: any) {
        console.error(err);
        if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password') {
            setError('Nesprávny email alebo heslo.');
        } else if (err.code === 'auth/email-already-in-use') {
            setError('Tento email sa už používa.');
        } else if (err.code === 'auth/weak-password') {
            setError('Heslo je príliš slabé (min. 6 znakov).');
        } else {
            setError('Nastala chyba pri prihlasovaní: ' + err.message);
        }
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-500/20 blur-[120px] rounded-full"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-500/20 blur-[120px] rounded-full"></div>

      <div className="w-full max-w-md bg-white/5 backdrop-blur-3xl border border-white/10 rounded-[3rem] p-8 sm:p-12 shadow-2xl relative z-10">
        <div className="text-center mb-10">
          <div className="w-20 h-20 bg-emerald-600 rounded-[2rem] flex items-center justify-center text-4xl shadow-2xl shadow-emerald-600/30 mx-auto mb-6 overflow-hidden relative group">
            <span className="absolute inset-0 flex items-center justify-center">🥗</span>
            {!imageError && (
              <img 
                src="/icon.png" 
                alt="" 
                className="absolute inset-0 w-full h-full object-cover z-10" 
                onError={() => setImageError(true)} 
              />
            )}
          </div>
          <h1 className="text-3xl font-black text-white mb-2">Moja Špajza</h1>
          <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Synchronizovaná domácnosť</p>
        </div>

        <form onSubmit={handleAuth} className="space-y-6">
          {isRegistering && (
            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Vaše meno</label>
              <input 
                required type="text" value={name} onChange={e => setName(e.target.value)}
                className="w-full px-6 py-4 bg-white/5 border border-white/10 rounded-2xl text-white outline-none focus:ring-2 focus:ring-emerald-500 transition-all font-bold"
                placeholder="napr. Peter"
              />
            </div>
          )}
          
          <div>
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">E-mailová adresa</label>
            <input 
              required type="email" value={email} onChange={e => setEmail(e.target.value)}
              className="w-full px-6 py-4 bg-white/5 border border-white/10 rounded-2xl text-white outline-none focus:ring-2 focus:ring-emerald-500 transition-all font-bold"
              placeholder="peter@priklad.sk"
            />
          </div>

          <div>
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Heslo</label>
            <input 
              required type="password" value={password} onChange={e => setPassword(e.target.value)}
              className="w-full px-6 py-4 bg-white/5 border border-white/10 rounded-2xl text-white outline-none focus:ring-2 focus:ring-emerald-500 transition-all font-bold"
              placeholder="••••••••"
            />
          </div>

          {!isFirebaseConfigured && (
             <div className="bg-amber-500/20 text-amber-400 p-4 rounded-xl text-xs font-bold border border-amber-500/30 text-center">
                 ⚠️ Pre fungovanie aplikácie musíte nastaviť Firebase kľúče v súbore firebase.ts
             </div>
          )}

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold p-4 rounded-xl text-center">
              {error}
            </div>
          )}

          <button 
            type="submit" 
            disabled={loading}
            className="w-full py-5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-black rounded-2xl shadow-xl shadow-emerald-600/20 transition-all uppercase tracking-widest text-sm active:scale-95 flex items-center justify-center gap-2"
          >
            {loading && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>}
            {isRegistering ? 'Vytvoriť účet' : 'Prihlásiť sa'}
          </button>
        </form>

        <div className="mt-8 text-center">
          <button 
            onClick={() => {
                setIsRegistering(!isRegistering);
                setError('');
            }}
            className="text-slate-400 hover:text-white transition-colors text-xs font-black uppercase tracking-widest"
          >
            {isRegistering ? 'Už máte účet? Prihláste sa' : 'Nemáte účet? Zaregistrujte sa'}
          </button>
        </div>
      </div>
    </div>
  );
};
