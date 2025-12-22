
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { InventoryItemCard } from './components/InventoryItemCard';
import { InventoryItemRow } from './components/InventoryItemRow';
import { AddItemModal } from './components/AddItemModal';
import { ShoppingList } from './components/ShoppingList';
import { ManageMetadataModal } from './components/ManageMetadataModal';
import { AuthScreen } from './components/AuthScreen';
import { FoodItem, Location, Category, Unit, ShoppingItem, User } from './types';
import { INITIAL_LOCATIONS, INITIAL_CATEGORIES, MOCK_ITEMS } from './constants';
import { getRecipeSuggestions } from './geminiService';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('pantry_current_user');
    return saved ? JSON.parse(saved) : null;
  });

  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const saved = localStorage.getItem('pantry_theme');
    return (saved as 'dark' | 'light') || 'dark';
  });

  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => {
    const saved = localStorage.getItem('pantry_view_mode');
    return (saved as 'grid' | 'list') || 'grid';
  });

  const [activeTab, setActiveTab] = useState<'inventory' | 'shopping'>('inventory');
  
  const [locations, setLocations] = useState<Location[]>(() => {
    const saved = localStorage.getItem('pantry_locations');
    return saved ? JSON.parse(saved) : INITIAL_LOCATIONS;
  });

  const [categories, setCategories] = useState<Category[]>(() => {
    const saved = localStorage.getItem('pantry_categories');
    return saved ? JSON.parse(saved) : INITIAL_CATEGORIES;
  });

  const [items, setItems] = useState<FoodItem[]>(() => {
    const saved = localStorage.getItem('pantry_items');
    return saved ? JSON.parse(saved) : MOCK_ITEMS;
  });

  const [shoppingList, setShoppingList] = useState<ShoppingItem[]>(() => {
    const saved = localStorage.getItem('pantry_shopping');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'expiring' | 'low' | string>('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<FoodItem | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  const locationScrollRef = useRef<HTMLDivElement>(null);
  const categoryScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem('pantry_theme', theme);
    const root = window.document.documentElement;
    if (theme === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');
  }, [theme]);

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('pantry_current_user', JSON.stringify(currentUser));
      const users: User[] = JSON.parse(localStorage.getItem('pantry_users') || '[]');
      const updatedUsers = users.map(u => u.id === currentUser.id ? currentUser : u);
      localStorage.setItem('pantry_users', JSON.stringify(updatedUsers));
    } else {
      localStorage.removeItem('pantry_current_user');
    }
  }, [currentUser]);

  useEffect(() => {
    localStorage.setItem('pantry_items', JSON.stringify(items));
    localStorage.setItem('pantry_shopping', JSON.stringify(shoppingList));
    localStorage.setItem('pantry_locations', JSON.stringify(locations));
    localStorage.setItem('pantry_categories', JSON.stringify(categories));
    localStorage.setItem('pantry_view_mode', viewMode);
  }, [items, shoppingList, locations, categories, viewMode]);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const scroll = (ref: React.RefObject<HTMLDivElement | null>, direction: 'left' | 'right') => {
    if (ref.current) {
      const scrollAmount = 300;
      ref.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  const handleLogin = (user: User) => {
    setCurrentUser(user);
  };

  const handleLogout = () => {
    if (confirm('Naozaj sa chcete odhlásiť?')) {
      setCurrentUser(null);
    }
  };

  const handleAddItem = (newItem: Omit<FoodItem, 'id' | 'lastUpdated' | 'householdId'>) => {
    if (!currentUser) return;
    const item: FoodItem = {
      ...newItem,
      id: Math.random().toString(36).substr(2, 9),
      lastUpdated: Date.now(),
      householdId: currentUser.householdId
    };
    setItems(prev => [item, ...prev]);
  };

  const handleUpdateItem = (id: string, updates: Partial<FoodItem>) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, ...updates, lastUpdated: Date.now() } : item));
  };

  const handleDeleteItem = (id: string) => {
    if (confirm('Naozaj chcete odstrániť túto položku?')) {
      setItems(prev => prev.filter(item => item.id !== id));
    }
  };

  const handleEditItemTrigger = (item: FoodItem) => {
    setEditingItem(item);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingItem(null);
  };

  const handleAiAdvice = async () => {
    if (householdItems.length === 0) {
      setAiSuggestions("Zatiaľ nemáte žiadne zásoby na analýzu.");
      return;
    }
    setAiSuggestions("AI analyzuje vaše zásoby...");
    try {
      const suggestions = await getRecipeSuggestions(householdItems);
      // Ošetrenie undefined pre TSC: ak je undefined, nastavíme null
      setAiSuggestions(suggestions ?? null);
    } catch (error) {
      console.error(error);
      setAiSuggestions("Nepodarilo sa získať nápady na recepty.");
    }
  };

  const handleAddToShoppingList = (item: FoodItem) => {
    if (!currentUser) return;
    const exists = shoppingList.find(si => si.sourceItemId === item.id);
    if (!exists) {
      setShoppingList(prev => [...prev, {
        id: Math.random().toString(36).substr(2, 9),
        name: item.name,
        quantity: 1,
        unit: item.unit,
        completed: false,
        sourceItemId: item.id,
        householdId: currentUser.householdId
      }]);
    }
  };

  const handleAddCategory = (categoryName: string): string => {
    const existing = categories.find(c => c.name.toLowerCase() === categoryName.toLowerCase());
    if (existing) return existing.id;
    
    const newId = Math.random().toString(36).substr(2, 9);
    const newCat: Category = {
      id: newId,
      name: categoryName,
      icon: '✨' 
    };
    setCategories(prev => [...prev, newCat]);
    return newId;
  };

  const householdItems = useMemo(() => {
    if (!currentUser) return [];
    return items.filter(i => i.householdId === currentUser.householdId);
  }, [items, currentUser]);

  const householdShoppingList = useMemo(() => {
    if (!currentUser) return [];
    return shoppingList.filter(i => i.householdId === currentUser.householdId);
  }, [shoppingList, currentUser]);

  const filteredItems = useMemo(() => {
    return householdItems.filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
      
      let matchesStatus = true;
      if (filterMode === 'expiring') {
        const days = item.expiryDate ? Math.ceil((new Date(item.expiryDate).getTime() - Date.now()) / (86400000)) : 999;
        matchesStatus = days <= 30;
      } else if (filterMode === 'low') {
        matchesStatus = (item.currentQuantity / item.totalQuantity) <= 0.25;
      }

      const isLocationFilter = locations.some(l => l.id === filterMode);
      const matchesLocation = isLocationFilter ? item.locationId === filterMode : true;
      const matchesCategory = selectedCategory === 'all' ? true : item.category === selectedCategory;

      return matchesSearch && matchesStatus && matchesLocation && matchesCategory;
    });
  }, [householdItems, searchTerm, filterMode, selectedCategory, locations]);

  const stats = useMemo(() => ({
    lowStock: householdItems.filter(i => (i.currentQuantity / i.totalQuantity) <= 0.25 && i.currentQuantity > 0).length,
    expiring: householdItems.filter(i => i.expiryDate && new Date(i.expiryDate).getTime() < (Date.now() + 2592000000)).length,
    total: householdItems.length,
    shoppingCount: householdShoppingList.filter(i => !i.completed).length
  }), [householdItems, householdShoppingList]);

  if (!currentUser) {
    return <AuthScreen onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen transition-colors duration-300 bg-slate-50 dark:bg-slate-950 pb-24 lg:pb-12">
      <header className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 sticky top-0 z-40 px-4 py-4 sm:px-6 shadow-sm">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center justify-between w-full md:w-auto gap-8">
            <div className="flex items-center gap-3 shrink-0">
              <div className="w-10 h-10 sm:w-11 sm:h-11 bg-emerald-600 rounded-2xl flex items-center justify-center text-white text-2xl shadow-lg shadow-emerald-500/20">
                🥗
              </div>
              <div className="hidden xs:block">
                <h1 className="text-base font-black text-slate-900 dark:text-white leading-tight">Moja Špajza</h1>
                <p className="text-[8px] font-black uppercase tracking-[0.15em] text-emerald-600 dark:text-emerald-400">
                  {currentUser.name} • {currentUser.householdId}
                </p>
              </div>
            </div>

            <nav className="flex items-center bg-slate-100 dark:bg-slate-800/80 p-1 rounded-2xl border border-slate-200 dark:border-slate-700/50">
              <button 
                onClick={() => setActiveTab('inventory')}
                className={`px-5 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeTab === 'inventory' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
              >
                Inventár
              </button>
              <button 
                onClick={() => setActiveTab('shopping')}
                className={`px-5 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-2 relative ${activeTab === 'shopping' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
              >
                Nákup
                {stats.shoppingCount > 0 && (
                  <span className="w-4 h-4 bg-red-500 text-white text-[8px] font-black rounded-full flex items-center justify-center border border-white dark:border-slate-700">
                    {stats.shoppingCount}
                  </span>
                )}
              </button>
            </nav>
          </div>

          <div className="flex w-full md:w-auto gap-2 items-center">
            <div className="relative flex-1 md:w-72 group">
              <input 
                type="text" 
                placeholder="Hľadať v zásobách..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-slate-100 dark:bg-slate-800/50 border-none rounded-2xl focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white text-sm font-bold outline-none transition-all"
              />
              <svg className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            </div>
            
            <button 
              onClick={() => setIsModalOpen(true)}
              className="hidden sm:flex p-3 bg-emerald-600 text-white rounded-2xl shadow-lg shadow-emerald-500/20 active:scale-90 transition-transform hover:bg-emerald-500"
              title="Pridať položku"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
            </button>

            <button 
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="p-3 bg-slate-100 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 rounded-2xl transition-all hover:scale-105 active:scale-95"
              title={theme === 'dark' ? 'Prepnúť na svetlý režim' : 'Prepnúť na tmavý režim'}
            >
              {theme === 'dark' ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.364 17.636l-.707.707M6.364 6.364l-.707-.707m12.728 12.728l-.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z" /></svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
              )}
            </button>

            <button 
              onClick={() => setIsSettingsOpen(true)}
              className="p-3 bg-slate-100 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 rounded-2xl transition-all hover:scale-105 active:scale-95"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            </button>
            
            <button 
              onClick={handleLogout}
              className="p-3 bg-red-50 dark:bg-red-950/30 text-red-500 rounded-2xl transition-all hover:scale-105 active:scale-95"
              title="Odhlásiť sa"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6">
        {activeTab === 'inventory' ? (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
              <button onClick={() => setFilterMode('all')} className={`text-left p-6 rounded-[2rem] border transition-all ${filterMode === 'all' ? 'bg-white dark:bg-slate-800 border-slate-900 dark:border-white ring-4 ring-slate-100 dark:ring-slate-800' : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800/50'}`}>
                <p className="text-[9px] uppercase font-black text-slate-400 tracking-[0.2em] mb-1">Inventár</p>
                <p className="text-3xl font-black text-slate-900 dark:text-white">{stats.total}</p>
              </button>
              <button onClick={() => setFilterMode('low')} className={`text-left p-6 rounded-[2rem] border transition-all ${filterMode === 'low' ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-500 ring-4 ring-amber-100 dark:ring-amber-900/20' : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800/50'}`}>
                <p className="text-[9px] uppercase font-black text-amber-600/60 tracking-[0.2em] mb-1">Dochádza</p>
                <p className="text-3xl font-black text-amber-600 dark:text-amber-400">{stats.lowStock}</p>
              </button>
              <button onClick={() => setFilterMode('expiring')} className={`text-left p-6 rounded-[2rem] border transition-all ${filterMode === 'expiring' ? 'bg-red-50 dark:bg-red-900/30 border-red-500 ring-4 ring-red-100 dark:ring-red-900/20' : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800/50'}`}>
                <p className="text-[9px] uppercase font-black text-red-600/60 tracking-[0.2em] mb-1">Expirácia</p>
                <p className="text-3xl font-black text-red-600 dark:text-red-400">{stats.expiring}</p>
              </button>
              <div className="p-6 rounded-[2rem] bg-indigo-600 shadow-xl shadow-indigo-500/20 text-white cursor-pointer hover:scale-[1.02] transition-all active:scale-95" onClick={handleAiAdvice}>
                <p className="text-[9px] uppercase font-black text-indigo-200 tracking-[0.2em] mb-1">AI Šéfkuchár</p>
                <p className="text-sm font-black leading-tight">Recepty zo zásob</p>
                <div className="mt-3 text-[8px] font-black uppercase bg-black/20 px-3 py-1.5 rounded-xl w-fit">Spustiť analýzu</div>
              </div>
            </div>

            {aiSuggestions && (
              <div className="bg-white dark:bg-slate-900 rounded-[3rem] p-10 mb-12 border-2 border-indigo-500/30 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4">
                  <button onClick={() => setAiSuggestions(null)} className="p-3 bg-slate-50 dark:bg-slate-800 text-slate-400 rounded-2xl hover:text-red-500 transition-colors shadow-sm">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
                <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-8 pr-12">Inšpirácia zo špajze ✨</h2>
                <div className="prose dark:prose-invert max-w-none text-slate-700 dark:text-slate-300 whitespace-pre-wrap font-medium leading-relaxed">{aiSuggestions}</div>
              </div>
            )}

            <div className="space-y-8 mb-12">
              <div className="group relative">
                <h3 className="text-[9px] font-black uppercase tracking-[0.25em] text-slate-400 dark:text-slate-600 mb-4 ml-1">Lokalita uskladnenia</h3>
                <div className="relative">
                  <button 
                    onClick={() => scroll(locationScrollRef, 'left')} 
                    className="invisible lg:group-hover:visible opacity-0 lg:group-hover:opacity-100 absolute -left-4 top-1/2 -translate-y-[calc(50%+8px)] z-10 p-2.5 bg-white dark:bg-slate-800 rounded-full shadow-xl hover:scale-110 transition-all duration-300 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15 19l-7-7 7-7" /></svg>
                  </button>
                  <div ref={locationScrollRef} className="flex items-center gap-3 overflow-x-auto pb-4 no-scrollbar scroll-smooth w-full">
                    <button onClick={() => setFilterMode('all')} className={`px-8 py-3.5 rounded-[1.25rem] text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap shadow-sm border ${filterMode === 'all' || !locations.some(l => l.id === filterMode) ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-950 border-transparent shadow-xl' : 'bg-white dark:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-800'}`}>Všetky miesta</button>
                    {locations.map(loc => (
                      <button key={loc.id} onClick={() => setFilterMode(loc.id)} className={`px-8 py-3.5 rounded-[1.25rem] text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all shadow-sm border ${filterMode === loc.id ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-950 border-transparent shadow-xl' : 'bg-white dark:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-800'}`}>{loc.icon} {loc.name}</button>
                    ))}
                  </div>
                  <button 
                    onClick={() => scroll(locationScrollRef, 'right')} 
                    className="invisible lg:group-hover:visible opacity-0 lg:group-hover:opacity-100 absolute -right-4 top-1/2 -translate-y-[calc(50%+8px)] z-10 p-2.5 bg-white dark:bg-slate-800 rounded-full shadow-xl hover:scale-110 transition-all duration-300 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M9 5l7 7-7 7" /></svg>
                  </button>
                </div>
              </div>

              <div className="group relative">
                <h3 className="text-[9px] font-black uppercase tracking-[0.25em] text-slate-400 dark:text-slate-600 mb-4 ml-1">Kategória produktu</h3>
                <div className="relative">
                  <button 
                    onClick={() => scroll(categoryScrollRef, 'left')} 
                    className="invisible lg:group-hover:visible opacity-0 lg:group-hover:opacity-100 absolute -left-4 top-1/2 -translate-y-[calc(50%+8px)] z-10 p-2.5 bg-white dark:bg-slate-800 rounded-full shadow-xl hover:scale-110 transition-all duration-300 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15 19l-7-7 7-7" /></svg>
                  </button>
                  <div ref={categoryScrollRef} className="flex items-center gap-3 overflow-x-auto pb-4 no-scrollbar scroll-smooth w-full">
                    <button onClick={() => setSelectedCategory('all')} className={`px-8 py-3.5 rounded-[1.25rem] text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap shadow-sm border ${selectedCategory === 'all' ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-950 border-transparent shadow-xl' : 'bg-white dark:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-800'}`}>Všetky kategórie</button>
                    {categories.map(cat => (
                      <button key={cat.id} onClick={() => setSelectedCategory(cat.id)} className={`px-8 py-3.5 rounded-[1.25rem] text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all shadow-sm border ${selectedCategory === cat.id ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-950 border-transparent shadow-xl' : 'bg-white dark:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-800'}`}>{cat.icon} {cat.name}</button>
                    ))}
                  </div>
                  <button 
                    onClick={() => scroll(categoryScrollRef, 'right')} 
                    className="invisible lg:group-hover:visible opacity-0 lg:group-hover:opacity-100 absolute -right-4 top-1/2 -translate-y-[calc(50%+8px)] z-10 p-2.5 bg-white dark:bg-slate-800 rounded-full shadow-xl hover:scale-110 transition-all duration-300 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M9 5l7 7-7 7" /></svg>
                  </button>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row justify-between items-end sm:items-center mb-6 px-1 gap-4">
               <div className="w-full sm:w-auto">
                  <h2 className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400 dark:text-slate-600 mb-1">Zoznam zásob</h2>
                  <p className="text-xs font-bold text-slate-600 dark:text-slate-400">Zobrazených {filteredItems.length} produktov v domácnosti</p>
               </div>
               <div className="flex items-center gap-3 bg-white dark:bg-slate-900 p-1.5 rounded-[1.5rem] border border-slate-200 dark:border-slate-800 shadow-sm w-full sm:w-auto">
                  <button onClick={() => setViewMode('grid')} className={`flex-1 sm:flex-none px-5 py-2.5 rounded-xl transition-all flex items-center justify-center gap-2 ${viewMode === 'grid' ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-md' : 'text-slate-400 hover:text-slate-600'}`}>
                    <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
                    <span className="text-[10px] font-black uppercase tracking-widest">Mriežka</span>
                  </button>
                  <button onClick={() => setViewMode('list')} className={`flex-1 sm:flex-none px-5 py-2.5 rounded-xl transition-all flex items-center justify-center gap-2 ${viewMode === 'list' ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-md' : 'text-slate-400 hover:text-slate-600'}`}>
                    <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                    </svg>
                    <span className="text-[10px] font-black uppercase tracking-widest">Zoznam</span>
                  </button>
               </div>
            </div>

            <div className="mt-2">
              {viewMode === 'grid' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {filteredItems.map(item => (
                    <InventoryItemCard key={item.id} item={item} location={locations.find(l => l.id === item.locationId)} category={categories.find(c => c.id === item.category)} onUpdate={handleUpdateItem} onDelete={handleDeleteItem} onEdit={handleEditItemTrigger} onAddToShoppingList={handleAddToShoppingList} />
                  ))}
                </div>
              ) : (
                <div className="bg-white dark:bg-slate-900 rounded-[3rem] shadow-xl border border-slate-100 dark:border-slate-800/50 overflow-hidden">
                  {filteredItems.map(item => (
                    <InventoryItemRow key={item.id} item={item} location={locations.find(l => l.id === item.locationId)} category={categories.find(c => c.id === item.category)} onUpdate={handleUpdateItem} onDelete={handleDeleteItem} onEdit={handleEditItemTrigger} onAddToShoppingList={handleAddToShoppingList} />
                  ))}
                </div>
              )}
              {filteredItems.length === 0 && (
                <div className="py-24 text-center bg-white dark:bg-slate-900 rounded-[3.5rem] border-2 border-dashed border-slate-100 dark:border-slate-800/50">
                  <div className="text-5xl mb-6 opacity-30">📦</div>
                  <p className="text-slate-400 dark:text-slate-500 font-bold max-w-xs mx-auto">V tejto kategórii zatiaľ nemáte žiadne zásoby.</p>
                </div>
              )}
            </div>
          </>
        ) : (
          <ShoppingList items={householdShoppingList} onUpdate={(id, up) => setShoppingList(prev => prev.map(i => i.id === id ? {...i, ...up} : i))} onDelete={id => setShoppingList(prev => prev.filter(i => i.id !== id))} onAdd={name => currentUser && setShoppingList(prev => [...prev, { id: Math.random().toString(36).substr(2, 9), name, quantity: 1, unit: Unit.KS, completed: false, householdId: currentUser.householdId }])} onClearCompleted={() => setShoppingList(prev => prev.filter(i => !i.completed))} />
        )}
      </main>

      <AddItemModal 
        isOpen={isModalOpen} 
        onClose={handleCloseModal} 
        onAdd={handleAddItem} 
        onUpdate={handleUpdateItem} 
        onAddCategory={handleAddCategory}
        editingItem={editingItem} 
        locations={locations} 
        categories={categories} 
      />
      <ManageMetadataModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} locations={locations} categories={categories} setLocations={setLocations} setCategories={setCategories} currentUser={currentUser} onUpdateUser={setCurrentUser} />

      <div className="fixed bottom-0 inset-x-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl border-t border-slate-200 dark:border-slate-800 p-2 pb-8 md:hidden flex justify-around items-center z-50">
        <button onClick={() => setActiveTab('inventory')} className={`flex-1 flex flex-col items-center gap-2 p-3 transition-all ${activeTab === 'inventory' ? 'text-emerald-600 dark:text-emerald-400 scale-110' : 'text-slate-400'}`}>
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
          <span className="text-[9px] font-black uppercase tracking-widest">Špajza</span>
        </button>
        
        <div className="flex-1 flex justify-center">
           <button onClick={() => setIsModalOpen(true)} className="w-14 h-14 bg-slate-900 dark:bg-emerald-600 rounded-full flex items-center justify-center text-white shadow-2xl active:scale-90 transition-all">
            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3.5" d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
          </button>
        </div>

        <button onClick={() => setActiveTab('shopping')} className={`flex-1 flex flex-col items-center gap-2 p-3 transition-all ${activeTab === 'shopping' ? 'text-emerald-600 dark:text-emerald-400 scale-110' : 'text-slate-400'}`}>
          <div className="relative">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>
            {stats.shoppingCount > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[8px] font-black rounded-full flex items-center justify-center border border-white dark:border-slate-800">{stats.shoppingCount}</span>}
          </div>
          <span className="text-[9px] font-black uppercase tracking-widest">Nákup</span>
        </button>
      </div>
    </div>
  );
};

export default App;
