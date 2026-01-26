
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
  // NATVRDO NASTAVENÝ TESTER PRE PRESKOČENIE PRIHLASOVANIA
  const [currentUser, setCurrentUser] = useState<User | null>({
    id: 'test-user',
    name: 'Tester',
    email: 'test@test.sk',
    householdId: 'DOMOV-123'
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
    localStorage.setItem('pantry_items', JSON.stringify(items));
    localStorage.setItem('pantry_shopping', JSON.stringify(shoppingList));
    localStorage.setItem('pantry_locations', JSON.stringify(locations));
    localStorage.setItem('pantry_categories', JSON.stringify(categories));
    localStorage.setItem('pantry_view_mode', viewMode);
  }, [items, shoppingList, locations, categories, viewMode]);

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
    // Odhlásenie teraz len resetne Test-Usera v pamäti (pri reštarte sa vráti)
    setCurrentUser(null);
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
      setAiSuggestions(suggestions);
    } catch (error) {
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
    const newCat: Category = { id: newId, name: categoryName, icon: '📦' };
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
        <div className="max-w-7xl mx-auto flex justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 sm:w-11 sm:h-11 bg-emerald-600 rounded-2xl flex items-center justify-center text-white text-2xl shadow-lg">
              🥗
            </div>
            <div>
              <h1 className="text-base font-black text-slate-900 dark:text-white leading-tight">Špajza</h1>
              <p className="text-[8px] font-black uppercase tracking-[0.15em] text-emerald-600 dark:text-emerald-400">Režim testovania</p>
            </div>
          </div>

          <div className="flex gap-2">
            <button 
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="p-3 bg-slate-100 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 rounded-2xl"
            >
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
            <button onClick={() => setIsSettingsOpen(true)} className="p-3 bg-slate-100 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 rounded-2xl">
              ⚙️
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6">
        {activeTab === 'inventory' ? (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <button onClick={() => setFilterMode('all')} className={`text-left p-6 rounded-[2rem] border transition-all ${filterMode === 'all' ? 'bg-white dark:bg-slate-800 border-slate-900 dark:border-white' : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800/50'}`}>
                <p className="text-[9px] uppercase font-black text-slate-400 tracking-widest">Inventár</p>
                <p className="text-3xl font-black text-slate-900 dark:text-white">{stats.total}</p>
              </button>
              <button onClick={() => setFilterMode('low')} className={`text-left p-6 rounded-[2rem] border transition-all ${filterMode === 'low' ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-500' : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800/50'}`}>
                <p className="text-[9px] uppercase font-black text-amber-600 tracking-widest">Dochádza</p>
                <p className="text-3xl font-black text-amber-600 dark:text-amber-400">{stats.lowStock}</p>
              </button>
              <button onClick={() => setFilterMode('expiring')} className={`text-left p-6 rounded-[2rem] border transition-all ${filterMode === 'expiring' ? 'bg-red-50 dark:bg-red-900/30 border-red-500' : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800/50'}`}>
                <p className="text-[9px] uppercase font-black text-red-600 tracking-widest">Expirácia</p>
                <p className="text-3xl font-black text-red-600 dark:text-red-400">{stats.expiring}</p>
              </button>
              <div className="p-6 rounded-[2rem] bg-indigo-600 text-white cursor-pointer" onClick={handleAiAdvice}>
                <p className="text-[9px] uppercase font-black text-indigo-200 tracking-widest mb-1">AI Recepty</p>
                <p className="text-sm font-black leading-tight">Čo uvariť?</p>
              </div>
            </div>

            {aiSuggestions && (
              <div className="bg-white dark:bg-slate-900 rounded-[3rem] p-8 mb-8 border border-indigo-500/30 relative">
                <button onClick={() => setAiSuggestions(null)} className="absolute top-4 right-4 text-slate-400">✕</button>
                <div className="prose dark:prose-invert max-w-none text-slate-700 dark:text-slate-300 whitespace-pre-wrap font-medium">{aiSuggestions}</div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
              <div className="flex gap-2 bg-white dark:bg-slate-900 p-1 rounded-2xl border border-slate-200 dark:border-slate-800 w-full sm:w-auto">
                <button onClick={() => setViewMode('grid')} className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest ${viewMode === 'grid' ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-md' : 'text-slate-400'}`}>Mriežka</button>
                <button onClick={() => setViewMode('list')} className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest ${viewMode === 'list' ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-md' : 'text-slate-400'}`}>Zoznam</button>
              </div>
              <div className="relative w-full sm:w-64">
                <input type="text" placeholder="Hľadať..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full px-4 py-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-sm font-bold" />
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
                <div className="bg-white dark:bg-slate-900 rounded-[3rem] border border-slate-100 dark:border-slate-800/50 overflow-hidden">
                  {filteredItems.map(item => (
                    <InventoryItemRow key={item.id} item={item} location={locations.find(l => l.id === item.locationId)} category={categories.find(c => c.id === item.category)} onUpdate={handleUpdateItem} onDelete={handleDeleteItem} onEdit={handleEditItemTrigger} onAddToShoppingList={handleAddToShoppingList} />
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          <ShoppingList items={householdShoppingList} onUpdate={(id, up) => setShoppingList(prev => prev.map(i => i.id === id ? {...i, ...up} : i))} onDelete={id => setShoppingList(prev => prev.filter(i => i.id !== id))} onAdd={name => currentUser && setShoppingList(prev => [...prev, { id: Math.random().toString(36).substr(2, 9), name, quantity: 1, unit: Unit.KS, completed: false, householdId: currentUser.householdId }])} onClearCompleted={() => setShoppingList(prev => prev.filter(i => !i.completed))} />
        )}
      </main>

      <AddItemModal isOpen={isModalOpen} onClose={handleCloseModal} onAdd={handleAddItem} onUpdate={handleUpdateItem} onAddCategory={handleAddCategory} editingItem={editingItem} locations={locations} categories={categories} />
      <ManageMetadataModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} locations={locations} categories={categories} setLocations={setLocations} setCategories={setCategories} currentUser={currentUser} onUpdateUser={setCurrentUser} />

      <div className="fixed bottom-0 inset-x-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl border-t border-slate-200 dark:border-slate-800 p-2 pb-8 flex justify-around items-center z-50">
        <button onClick={() => setActiveTab('inventory')} className={`flex-1 flex flex-col items-center gap-1 p-3 rounded-2xl active:bg-slate-100 dark:active:bg-slate-800/50 transition-all ${activeTab === 'inventory' ? 'text-emerald-600' : 'text-slate-400'}`}>
          <span className="text-xl">🧺</span>
          <span className="text-[9px] font-black uppercase tracking-widest">Zásoby</span>
        </button>
        
        <button 
          onClick={() => setIsModalOpen(true)} 
          className="mx-2 w-12 h-12 bg-emerald-600 hover:bg-emerald-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-emerald-600/20 active:scale-90 transition-all"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 4v16m8-8H4" /></svg>
        </button>
        
        <button onClick={() => setActiveTab('shopping')} className={`flex-1 flex flex-col items-center gap-1 p-3 rounded-2xl active:bg-slate-100 dark:active:bg-slate-800/50 transition-all ${activeTab === 'shopping' ? 'text-emerald-600' : 'text-slate-400'}`}>
          <span className="text-xl">🛒</span>
          <span className="text-[9px] font-black uppercase tracking-widest">Nákup</span>
        </button>
      </div>
    </div>
  );
};

export default App;
