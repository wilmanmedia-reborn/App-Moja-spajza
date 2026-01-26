
import React, { useState } from 'react';
import { User } from '../types';

interface Props {
  onLogin: (user: User) => void;
}

export const AuthScreen: React.FC<Props> = ({ onLogin }) => {
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [imageError, setImageError] = useState(false);

  const handleAuth = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const users: User[] = JSON.parse(localStorage.getItem('pantry_users') || '[]');

    if (isRegistering) {
      if (users.find(u => u.email === email)) {
        setError('Používateľ s týmto emailom už existuje.');
        return;
      }
      
      const newUser: User = {
        id: Math.random().toString(36).substr(2, 9),
        name: name || 'Používateľ',
        email,
        password,
        householdId: Math.random().toString(36).substr(2, 6).toUpperCase()
      };
      
      localStorage.setItem('pantry_users', JSON.stringify([...users, newUser]));
      onLogin(newUser);
    } else {
      const user = users.find(u => u.email === email && u.password === password);
      if (user) {
        onLogin(user);
      } else {
        setError('Nesprávny email alebo heslo. Dáta sú uložené lokálne v tomto zariadení.');
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-500/20 blur-[120px] rounded-full"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-500/20 blur-[120px] rounded-full"></div>

      <div className="w-full max-w-md bg-white/5 backdrop-blur-3xl border border-white/10 rounded-[3rem] p-8 sm:p-12 shadow-2xl relative z-10">
        <div className="text-center mb-10">
          <div className="w-20 h-20 bg-emerald-600 rounded-[2rem] flex items-center justify-center text-4xl shadow-2xl shadow-emerald-600/30 mx-auto mb-6 overflow-hidden relative group">
            {/* Fallback Emoji */}
            <span className="absolute inset-0 flex items-center justify-center">🥗</span>
            
            {/* Actual Logo Image with error handling */}
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
          <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Inteligentná správa zásob</p>
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

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold p-4 rounded-xl text-center">
              {error}
            </div>
          )}

          <button type="submit" className="w-full py-5 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-2xl shadow-xl shadow-emerald-600/20 transition-all uppercase tracking-widest text-sm active:scale-95">
            {isRegistering ? 'Vytvoriť účet' : 'Prihlásiť sa'}
          </button>
        </form>

        <div className="mt-8 p-4 bg-blue-500/10 border border-blue-500/20 rounded-2xl">
          <p className="text-[9px] font-bold text-blue-300 text-center uppercase tracking-wider leading-relaxed">
            💡 INFO: Táto verzia ukladá dáta priamo do vášho zariadenia. Pre prenos do iného mobilu použite funkciu "Export" v nastaveniach.
          </p>
        </div>

        <div className="mt-8 text-center">
          <button 
            onClick={() => setIsRegistering(!isRegistering)}
            className="text-slate-400 hover:text-white transition-colors text-xs font-black uppercase tracking-widest"
          >
            {isRegistering ? 'Už máte účet? Prihláste sa' : 'Nemáte účet? Zaregistrujte sa'}
          </button>
        </div>
      </div>
    </div>
  );
};
