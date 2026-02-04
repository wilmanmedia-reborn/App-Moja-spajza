
import React, { useState } from 'react';
import { User } from '../types';
import { auth, db, isFirebaseConfigured } from '../firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
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
  
  // State pre viditeľnosť hesla
  const [showPassword, setShowPassword] = useState(false);

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

  const handleAddAtSign = (e: React.MouseEvent) => {
      e.preventDefault(); 
      setEmail(prev => prev + '@');
      const emailInput = document.getElementById('email-input');
      emailInput?.focus();
  };

  return (
    // POUŽITIE FIXED INSET-0: Toto napevno pripne kontajner k okrajom okna a zabráni scrolovaniu stránky (body)
    <div className="fixed inset-0 bg-slate-950 flex items-center justify-center p-4 overflow-hidden z-50">
      
      {/* Pozadie */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-500/20 blur-[120px] rounded-full pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-500/20 blur-[120px] rounded-full pointer-events-none"></div>

      {/* Karta */}
      <div className="w-full max-w-md bg-white/5 backdrop-blur-3xl border border-white/10 rounded-[2.5rem] p-8 shadow-2xl relative z-10 flex flex-col max-h-[90vh]">
        
        {/* Hlavička - fixná */}
        <div className="text-center mb-6 shrink-0">
          <div className="w-16 h-16 bg-emerald-600 rounded-2xl flex items-center justify-center text-3xl shadow-2xl shadow-emerald-600/30 mx-auto mb-4 overflow-hidden relative group">
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
          <h1 className="text-2xl font-black text-white mb-1">Moja Špajza</h1>
          <p className="text-slate-400 font-bold uppercase tracking-widest text-[9px]">Synchronizovaná domácnosť</p>
        </div>

        {/* Form - skrolovateľný iba vnútri karty, ak je klávesnica otvorená */}
        <div className="overflow-y-auto no-scrollbar -mx-4 px-4 pb-2 flex-1">
            <form onSubmit={handleAuth} className="space-y-5">
            {isRegistering && (
                <div>
                <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Vaše meno</label>
                <input 
                    required type="text" value={name} onChange={e => setName(e.target.value)}
                    className="w-full px-5 py-3.5 bg-white/5 border border-white/10 rounded-2xl text-white outline-none focus:ring-2 focus:ring-emerald-500 transition-all font-bold placeholder:text-slate-600"
                    placeholder="napr. David"
                />
                </div>
            )}
            
            <div>
                <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">E-mailová adresa</label>
                <div className="relative">
                    <input 
                        id="email-input"
                        required type="email" value={email} onChange={e => setEmail(e.target.value)}
                        className="w-full pl-5 pr-14 py-3.5 bg-white/5 border border-white/10 rounded-2xl text-white outline-none focus:ring-2 focus:ring-emerald-500 transition-all font-bold placeholder:text-slate-600"
                        placeholder="moja@spajza.sk"
                    />
                    <button 
                        type="button"
                        onClick={handleAddAtSign}
                        className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center text-emerald-500 hover:text-emerald-400 font-black text-lg bg-white/5 hover:bg-white/10 rounded-xl transition-all active:scale-95"
                        title="Vložiť @"
                    >
                        @
                    </button>
                </div>
            </div>

            <div>
                <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Heslo</label>
                <div className="relative">
                    <input 
                        required 
                        type={showPassword ? "text" : "password"} 
                        value={password} 
                        onChange={e => setPassword(e.target.value)}
                        className="w-full pl-5 pr-12 py-3.5 bg-white/5 border border-white/10 rounded-2xl text-white outline-none focus:ring-2 focus:ring-emerald-500 transition-all font-bold placeholder:text-slate-600"
                        placeholder="••••••••"
                    />
                    <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
                        title={showPassword ? "Skryť heslo" : "Zobraziť heslo"}
                    >
                        {showPassword ? (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                        ) : (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                        )}
                    </button>
                </div>
            </div>

            {!isFirebaseConfigured && (
                <div className="bg-amber-500/20 text-amber-400 p-3 rounded-xl text-[10px] font-bold border border-amber-500/30 text-center">
                    ⚠️ Nastavte Firebase kľúče v firebase.ts
                </div>
            )}

            {error && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold p-3 rounded-xl text-center">
                {error}
                </div>
            )}

            <button 
                type="submit" 
                disabled={loading}
                className="w-full py-4 mt-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-black rounded-2xl shadow-xl shadow-emerald-600/20 transition-all uppercase tracking-widest text-xs active:scale-95 flex items-center justify-center gap-2"
            >
                {loading && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>}
                {isRegistering ? 'Vytvoriť účet' : 'Prihlásiť sa'}
            </button>
            </form>
        </div>

        {/* Prepínač režimu - fixný dole v karte */}
        <div className="mt-4 text-center shrink-0">
          <button 
            onClick={() => {
                setIsRegistering(!isRegistering);
                setError('');
            }}
            className="text-slate-400 hover:text-white transition-colors text-[10px] font-black uppercase tracking-widest py-2 px-4"
          >
            {isRegistering ? 'Už máte účet? Prihláste sa' : 'Nemáte účet? Zaregistrujte sa'}
          </button>
        </div>
      </div>
    </div>
  );
};
