
import React, { useState, useRef, useEffect } from 'react';
import { Location, Category, User } from '../types';
import { auth } from '../firebase';
import { signOut } from 'firebase/auth';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  locations: Location[];
  categories: Category[];
  setLocations: React.Dispatch<React.SetStateAction<Location[]>>;
  setCategories: React.Dispatch<React.SetStateAction<Category[]>>;
  currentUser: User | null;
  onUpdateUser: (user: User) => void;
}

export const ManageMetadataModal: React.FC<Props> = ({ 
  isOpen, onClose, locations, categories, setLocations, setCategories, currentUser, onUpdateUser 
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'locations' | 'categories' | 'household'>('locations');
  const [newName, setNewName] = useState('');
  const [newIcon, setNewIcon] = useState('📦');
  const [joinCode, setJoinCode] = useState('');

  // Refs pre automatické scrollovanie
  const tabsContainerRef = useRef<HTMLDivElement>(null);
  const tabsRef = useRef<{ [key: string]: HTMLButtonElement | null }>({
    locations: null,
    categories: null,
    household: null
  });

  // Efekt pre automatické centrovanie aktívnej záložky
  useEffect(() => {
    if (isOpen && tabsContainerRef.current && tabsRef.current[activeSubTab]) {
      const container = tabsContainerRef.current;
      const tab = tabsRef.current[activeSubTab];

      if (tab) {
        const containerWidth = container.offsetWidth;
        const tabWidth = tab.offsetWidth;
        const tabLeft = tab.offsetLeft;

        // Výpočet pozície tak, aby bol tab v strede
        const scrollPosition = tabLeft - (containerWidth / 2) + (tabWidth / 2);

        container.scrollTo({
          left: scrollPosition,
          behavior: 'smooth'
        });
      }
    }
  }, [activeSubTab, isOpen]);

  if (!isOpen) return null;

  const handleLogout = async () => {
      if(confirm('Naozaj sa chcete odhlásiť?')) {
          await signOut(auth);
          onClose();
      }
  };

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    const newItem = {
      id: Math.random().toString(36).substr(2, 9),
      name: newName.trim(),
      icon: newIcon.trim() || '📦'
    };

    if (activeSubTab === 'locations') {
      // V App.tsx táto funkcia robí updateDoc do Firestore
      setLocations([...locations, newItem]);
    } else {
      setCategories([...categories, newItem]);
    }

    setNewName('');
    setNewIcon('📦');
  };

  const handleDelete = (id: string, type: 'locations' | 'categories') => {
    if (confirm('Naozaj chcete odstrániť túto položku? Položky v inventári, ktoré ju používajú, môžu zobraziť predvolenú hodnotu.')) {
      if (type === 'locations') {
        const newLocs = locations.filter(l => l.id !== id);
        setLocations(newLocs);
      } else {
        const newCats = categories.filter(c => c.id !== id);
        setCategories(newCats);
      }
    }
  };

  const handleJoinHousehold = (e: React.FormEvent) => {
    e.preventDefault();
    if (currentUser && joinCode.trim().length >= 4) {
      if (confirm(`Naozaj sa chcete pripojiť k domácnosti ${joinCode.toUpperCase()}? Vaše aktuálne zásoby budú nahradené zásobami novej domácnosti.`)) {
        onUpdateUser({ ...currentUser, householdId: joinCode.toUpperCase() });
        // Alert odstránený pre plynulejší zážitok - loading stav v App.tsx preberie vizuálnu odozvu
        onClose();
      }
    }
  };

  const TabButton = ({ id, label, active }: { id: 'locations' | 'categories' | 'household', label: string, active: boolean }) => (
    <button 
      ref={el => { tabsRef.current[id] = el; }}
      onClick={() => setActiveSubTab(id)}
      className={`shrink-0 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all duration-300 whitespace-nowrap scroll-ml-4 ${
        active 
          ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-950 shadow-lg scale-100' 
          : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 scale-95 opacity-70 hover:opacity-100'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col h-full sm:h-[85vh]">
        
        {/* Header */}
        <div className="px-8 py-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50 shrink-0">
          <div>
            <h2 className="text-2xl font-black text-slate-900 dark:text-white">Nastavenia</h2>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-black uppercase tracking-widest mt-0.5">Spravujte dáta aplikácie</p>
          </div>
          <button onClick={onClose} className="p-3 bg-white dark:bg-slate-800 text-slate-400 dark:text-slate-500 hover:text-red-500 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 transition-all active:scale-90">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Navigation Tabs - Auto Scroll Container */}
        <div className="bg-slate-100 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800 py-4 shrink-0 relative">
           {/* Fade effect on sides to indicate scroll */}
           <div className="absolute left-0 top-0 bottom-0 w-4 bg-gradient-to-r from-slate-100 dark:from-slate-900 to-transparent z-10 pointer-events-none"></div>
           <div className="absolute right-0 top-0 bottom-0 w-4 bg-gradient-to-l from-slate-100 dark:from-slate-900 to-transparent z-10 pointer-events-none"></div>
           
           <div 
             ref={tabsContainerRef}
             className="flex gap-2 overflow-x-auto no-scrollbar px-4 items-center snap-x"
           >
            <TabButton id="locations" label="Lokality" active={activeSubTab === 'locations'} />
            <TabButton id="categories" label="Kategórie" active={activeSubTab === 'categories'} />
            <TabButton id="household" label="Synchronizácia" active={activeSubTab === 'household'} />
           </div>
        </div>

        {/* Content Area - Scrollable */}
        <div className="flex-1 overflow-y-auto no-scrollbar p-6 relative">
            {activeSubTab === 'household' ? (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300 pb-4">
                
                <div className="bg-slate-50 dark:bg-slate-800 p-6 rounded-3xl border border-slate-100 dark:border-slate-700 text-center">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Váš kód domácnosti</p>
                  <div className="text-4xl font-black text-emerald-600 dark:text-emerald-400 tracking-[0.2em] mb-2 selection:bg-emerald-200">
                    {currentUser?.householdId}
                  </div>
                  <p className="text-[9px] font-bold text-slate-500 dark:text-slate-400">
                      Tento kód zadajte na druhom zariadení (napr. manželkin mobil), aby ste zdieľali rovnakú špajzu.
                  </p>
                </div>

                <div className="p-6 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-700">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Pripojiť sa k inej domácnosti</h4>
                  <form onSubmit={handleJoinHousehold} className="space-y-3">
                      <input 
                        type="text" 
                        value={joinCode}
                        onChange={e => setJoinCode(e.target.value.toUpperCase())}
                        placeholder="ZADAJTE KÓD (NAPR. XY92)"
                        className="w-full px-5 py-4 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white rounded-2xl outline-none font-black text-center text-lg tracking-widest uppercase focus:ring-2 focus:ring-emerald-500"
                        maxLength={6}
                      />
                      <button 
                        type="submit"
                        disabled={joinCode.length < 4}
                        className="w-full py-4 bg-slate-900 dark:bg-white hover:bg-emerald-600 dark:hover:bg-emerald-400 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 text-white dark:text-slate-900 font-black rounded-2xl transition-all active:scale-95 uppercase text-[10px] tracking-widest"
                      >
                        Synchronizovať
                      </button>
                  </form>
                </div>
                
                <div className="pt-6 border-t border-slate-100 dark:border-slate-800">
                    <button 
                        onClick={handleLogout}
                        className="w-full py-4 text-red-500 font-black rounded-2xl text-[10px] uppercase tracking-widest hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    >
                        Odhlásiť sa ({currentUser?.email})
                    </button>
                </div>
              </div>
            ) : (
              <div className="animate-in fade-in slide-in-from-left-4 duration-300 pb-2">
                <div className="space-y-3">
                  {(activeSubTab === 'locations' ? locations : categories).map(item => (
                    <div key={item.id} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 group">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{item.icon}</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">{item.name}</span>
                      </div>
                      <button 
                        onClick={() => handleDelete(item.id, activeSubTab)}
                        className="p-2 text-slate-300 dark:text-slate-600 hover:text-red-500 transition-colors"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
        </div>

        {/* Footer Form - Fixed at Bottom for Locations & Categories */}
        {activeSubTab !== 'household' && (
          <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0 z-10">
            <form onSubmit={handleAdd} className="p-4 bg-emerald-50 dark:bg-emerald-950/20 rounded-3xl border-2 border-emerald-100 dark:border-emerald-900/50">
                <h4 className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mb-3">Pridať novú {activeSubTab === 'locations' ? 'lokalitu' : 'kategóriu'}</h4>
                <div className="flex gap-3">
                  <input 
                    type="text" 
                    value={newIcon}
                    onChange={e => setNewIcon(e.target.value)}
                    placeholder="🏠"
                    className="w-14 px-2 py-3 bg-white dark:bg-slate-800 text-slate-900 dark:text-white border-none rounded-2xl text-center font-bold outline-none focus:ring-2 focus:ring-emerald-500 shadow-sm"
                  />
                  <input 
                    type="text" 
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    placeholder="Názov..."
                    className="flex-1 min-w-0 px-5 py-3 bg-white dark:bg-slate-800 text-slate-900 dark:text-white border-none rounded-2xl font-bold outline-none focus:ring-2 focus:ring-emerald-500 shadow-sm"
                  />
                </div>
                <button 
                  type="submit"
                  className="w-full mt-3 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-2xl transition-all active:scale-95 uppercase text-[10px] tracking-widest shadow-lg shadow-emerald-600/20"
                >
                  Potvrdiť
                </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
