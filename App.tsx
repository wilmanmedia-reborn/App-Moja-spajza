
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { InventoryItemCard } from './components/InventoryItemCard';
import { InventoryItemRow } from './components/InventoryItemRow';
import { AddItemModal } from './components/AddItemModal';
import { ShoppingList } from './components/ShoppingList';
import { ManageMetadataModal } from './components/ManageMetadataModal';
import { AuthScreen } from './components/AuthScreen';
import { QuickAddModal } from './components/QuickAddModal';
import { ConsumeItemModal } from './components/ConsumeItemModal';
import { FoodItem, Location, Category, Unit, ShoppingItem, User, Batch } from './types';
import { INITIAL_LOCATIONS, INITIAL_CATEGORIES } from './constants';
import { getRecipeSuggestions } from './geminiService';
import { auth, db } from './firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { collection, query, where, onSnapshot, doc, getDoc, setDoc, addDoc, updateDoc, deleteDoc } from 'firebase/firestore';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const saved = localStorage.getItem('pantry_theme');
    return (saved as 'dark' | 'light') || 'dark';
  });

  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => {
    const saved = localStorage.getItem('pantry_view_mode');
    return (saved as 'grid' | 'list') || 'list';
  });

  const [activeTab, setActiveTab] = useState<'inventory' | 'shopping'>('inventory');
  
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);

  const [locations, setLocations] = useState<Location[]>(INITIAL_LOCATIONS);
  const [categories, setCategories] = useState<Category[]>(INITIAL_CATEGORIES);
  const [items, setItems] = useState<FoodItem[]>([]);
  const [shoppingList, setShoppingList] = useState<ShoppingItem[]>([]);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'expiring' | 'low' | string>('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<FoodItem | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<string | null>(null);
  
  const [quickAddModalItem, setQuickAddModalItem] = useState<FoodItem | null>(null);
  const [consumeModalItem, setConsumeModalItem] = useState<FoodItem | null>(null);

  const categoryScrollRef = useRef<HTMLDivElement>(null);
  const [scrollFlags, setScrollFlags] = useState({ left: false, right: true });

  const checkScroll = () => {
    if (categoryScrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = categoryScrollRef.current;
      setScrollFlags({
        left: scrollLeft > 10,
        right: scrollLeft < scrollWidth - clientWidth - 10
      });
    }
  };

  useEffect(() => {
    checkScroll();
    window.addEventListener('resize', checkScroll);
    return () => window.removeEventListener('resize', checkScroll);
  }, [categories]);

  const handleCategoryClick = (catId: string, e: React.MouseEvent<HTMLButtonElement>) => {
    setSelectedCategory(catId);
    const container = categoryScrollRef.current;
    const target = e.currentTarget;
    if (container && target) {
      const containerWidth = container.clientWidth;
      const targetWidth = target.offsetWidth;
      const targetLeft = target.offsetLeft;
      const scrollPos = targetLeft - (containerWidth / 2) + (targetWidth / 2);
      container.scrollTo({ left: scrollPos, behavior: 'smooth' });
    }
  };

  useEffect(() => {
    localStorage.setItem('pantry_theme', theme);
    const root = window.document.documentElement;
    if (theme === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('pantry_view_mode', viewMode);
  }, [viewMode]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
        if (firebaseUser) {
            const userDocRef = doc(db, "users", firebaseUser.uid);
            const userSnap = await getDoc(userDocRef);
            
            if (userSnap.exists()) {
                const userData = userSnap.data() as User;
                setCurrentUser(userData);
            } else {
                console.error("User data not found in Firestore");
                signOut(auth);
            }
        } else {
            setCurrentUser(null);
            setItems([]);
            setShoppingList([]);
        }
        setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!currentUser?.householdId) return;

    // Reset items when switching household to avoid mixing data visually before load
    setItems([]);
    setShoppingList([]);

    const householdRef = doc(db, "households", currentUser.householdId);
    
    // 1. Listen for Settings (Locations/Categories)
    const unsubHousehold = onSnapshot(householdRef, (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            if (data.locations) setLocations(data.locations);
            if (data.categories) setCategories(data.categories);
        } else {
            // Ak domácnosť neexistuje (nový kód), vytvoríme ju s default dátami
            setDoc(householdRef, {
                ownerId: currentUser.id,
                locations: INITIAL_LOCATIONS,
                categories: INITIAL_CATEGORIES
            });
        }
    });

    // 2. Listen for Inventory Items
    const itemsQuery = query(collection(householdRef, "items"));
    const unsubItems = onSnapshot(itemsQuery, (snapshot) => {
        const loadedItems = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FoodItem));
        setItems(loadedItems);
    });

    // 3. Listen for Shopping List
    const shoppingQuery = query(collection(householdRef, "shopping"));
    const unsubShopping = onSnapshot(shoppingQuery, (snapshot) => {
        const loadedShopping = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ShoppingItem));
        setShoppingList(loadedShopping);
    });

    return () => {
        unsubHousehold();
        unsubItems();
        unsubShopping();
    };
  }, [currentUser?.householdId]); // DÔLEŽITÉ: Toto sa spustí vždy, keď sa zmení ID

  const handleAddItem = async (newItem: Omit<FoodItem, 'id' | 'lastUpdated' | 'householdId'>) => {
    if (!currentUser) return;
    
    let initialBatches: Batch[] = [];
    let countToAdd = 1;
    let quantityPerBatch = newItem.currentQuantity;

    if (newItem.unit === Unit.KS) {
        countToAdd = Math.max(1, newItem.currentQuantity);
        quantityPerBatch = 1;
    } else if (newItem.quantityPerPack && newItem.quantityPerPack > 0) {
        const packs = newItem.currentQuantity / newItem.quantityPerPack;
        if (Math.abs(Math.round(packs) - packs) < 0.001 && packs >= 1) {
            countToAdd = Math.round(packs);
            quantityPerBatch = newItem.quantityPerPack;
        }
    }

    for (let i = 0; i < countToAdd; i++) {
        initialBatches.push({
            id: Math.random().toString(36).substr(2, 9) + i,
            quantity: quantityPerBatch,
            expiryDate: newItem.expiryDate,
            addedDate: Date.now()
        });
    }

    const itemPayload = {
      ...newItem,
      batches: initialBatches,
      lastUpdated: Date.now(),
      householdId: currentUser.householdId
    };

    await addDoc(collection(db, "households", currentUser.householdId, "items"), itemPayload);
  };

  const handleUpdateItem = async (id: string, updates: Partial<FoodItem>) => {
    if (!currentUser) return;
    const itemRef = doc(db, "households", currentUser.householdId, "items", id);
    await updateDoc(itemRef, { ...updates, lastUpdated: Date.now() });
  };

  const handleDeleteItem = async (id: string) => {
    if (!currentUser) return;
    if (confirm('Naozaj chcete odstrániť túto položku?')) {
        await deleteDoc(doc(db, "households", currentUser.householdId, "items", id));
    }
  };

  const handleTriggerQuickAdd = (item: FoodItem) => setQuickAddModalItem(item);

  const confirmQuickAdd = async (expiryDate: string | undefined, specificQuantity: number) => {
    if (!quickAddModalItem || !currentUser) return;
    
    const qtyToAdd = specificQuantity > 0 ? specificQuantity : (quickAddModalItem.unit === Unit.KS ? 1 : (quickAddModalItem.quantityPerPack || 0));
    if (qtyToAdd <= 0) { setQuickAddModalItem(null); return; }
    
    const currentItem = items.find(i => i.id === quickAddModalItem.id);
    if (!currentItem) return;

    const newBatches = [...(currentItem.batches || [])];

    if (quickAddModalItem.unit === Unit.KS) {
        for (let i = 0; i < qtyToAdd; i++) {
            newBatches.push({
              id: Math.random().toString(36).substr(2, 9) + i,
              quantity: 1,
              expiryDate: expiryDate,
              addedDate: Date.now()
            });
        }
    } else {
        newBatches.push({
          id: Math.random().toString(36).substr(2, 9),
          quantity: qtyToAdd,
          expiryDate: expiryDate,
          addedDate: Date.now()
        });
    }

    const sortedBatches = [...newBatches].sort((a, b) => {
        if (!a.expiryDate) return 1;
        if (!b.expiryDate) return -1;
        return new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime();
    });
    const nearestExpiry = sortedBatches.find(b => b.expiryDate)?.expiryDate;

    await handleUpdateItem(currentItem.id, {
        currentQuantity: currentItem.currentQuantity + qtyToAdd,
        batches: sortedBatches,
        expiryDate: nearestExpiry || currentItem.expiryDate
    });

    setQuickAddModalItem(null);
  };

  const handleTriggerConsume = (item: FoodItem) => {
    if (item.currentQuantity <= 0) return;
    setConsumeModalItem(item);
  };

  const confirmConsume = async (batchId: string | null) => {
    if (!consumeModalItem || !currentUser) return;
    
    const currentItem = items.find(i => i.id === consumeModalItem.id);
    if (!currentItem) return;

    let newBatches = [...(currentItem.batches || [])];
    let newTotalQty = currentItem.currentQuantity;

    if (batchId) {
        const batchIndex = newBatches.findIndex(b => b.id === batchId);
        if (batchIndex !== -1) {
            const batchQty = newBatches[batchIndex].quantity;
            newBatches.splice(batchIndex, 1);
            newTotalQty = Math.max(0, newTotalQty - batchQty);
        }
    } else {
        const qtyToRemove = currentItem.unit === Unit.KS ? 1 : (currentItem.quantityPerPack || 1);
        newTotalQty = Math.max(0, newTotalQty - qtyToRemove);
        let remainingToRemove = qtyToRemove;
        
        newBatches.sort((a, b) => {
             if (!a.expiryDate) return 1;
             if (!b.expiryDate) return -1;
             return new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime();
        });
        
        const keptBatches = [];
        for (const b of newBatches) {
            if (remainingToRemove <= 0) { keptBatches.push(b); continue; }
            if (b.quantity <= remainingToRemove) {
                remainingToRemove -= b.quantity;
            } else {
                keptBatches.push({ ...b, quantity: b.quantity - remainingToRemove });
                remainingToRemove = 0;
            }
        }
        newBatches = keptBatches;
    }

    const sortedBatches = [...newBatches].sort((a, b) => {
        if (!a.expiryDate) return 1;
        if (!b.expiryDate) return -1;
        return new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime();
    });
    const nearestExpiry = sortedBatches.find(b => b.expiryDate)?.expiryDate;

    await handleUpdateItem(currentItem.id, {
        currentQuantity: newTotalQty,
        batches: sortedBatches,
        expiryDate: nearestExpiry || currentItem.expiryDate
    });

    setConsumeModalItem(null);
  };

  const handleAddToShoppingList = async (item: FoodItem) => {
    if (!currentUser) return;
    const exists = shoppingList.find(si => si.sourceItemId === item.id);
    if (!exists) {
        await addDoc(collection(db, "households", currentUser.householdId, "shopping"), {
            name: item.name,
            quantity: 1,
            unit: item.unit,
            completed: false,
            sourceItemId: item.id,
            householdId: currentUser.householdId
        });
    }
  };

  const handleShoppingListUpdate = async (id: string, updates: Partial<ShoppingItem>) => {
      if (!currentUser) return;
      await updateDoc(doc(db, "households", currentUser.householdId, "shopping", id), updates);
  };

  const handleShoppingListDelete = async (id: string) => {
      if (!currentUser) return;
      await deleteDoc(doc(db, "households", currentUser.householdId, "shopping", id));
  };

  const handleShoppingListAdd = async (name: string) => {
      if (!currentUser) return;
      await addDoc(collection(db, "households", currentUser.householdId, "shopping"), {
            name,
            quantity: 1,
            unit: Unit.KS,
            completed: false,
            householdId: currentUser.householdId
      });
  };

  const handleShoppingListClear = async () => {
      if (!currentUser) return;
      const completed = shoppingList.filter(i => i.completed);
      for (const item of completed) {
          await deleteDoc(doc(db, "households", currentUser.householdId, "shopping", item.id));
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
    if (items.length === 0) return;
    setAiSuggestions("Generujem nápady na recepty...");
    try {
      const result = await getRecipeSuggestions(items);
      setAiSuggestions(result || "Nepodarilo sa získať recepty.");
    } catch (e) {
      setAiSuggestions("Chyba pri generovaní receptov.");
    }
  };

  const handleAddCategory = (categoryName: string): string => {
    const existing = categories.find(c => c.name.toLowerCase() === categoryName.toLowerCase());
    if (existing) return existing.id;
    
    const newId = Math.random().toString(36).substr(2, 9);
    const newCat: Category = { id: newId, name: categoryName, icon: '📦' };
    
    if (currentUser) {
        const newCategories = [...categories, newCat];
        updateDoc(doc(db, "households", currentUser.householdId), { categories: newCategories });
    }
    return newId;
  };

  const householdItems = items;
  const filteredItems = useMemo(() => {
    return householdItems.filter(item => {
      const normalizeText = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
      const normalizedSearch = normalizeText(searchTerm);
      const normalizedName = normalizeText(item.name);
      
      const matchesSearch = normalizedName.includes(normalizedSearch);
      
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
    shoppingCount: shoppingList.filter(i => !i.completed).length
  }), [householdItems, shoppingList]);

  if (loading) {
      return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-emerald-500 font-black animate-pulse">NAČÍTAVAM...</div>;
  }

  if (!currentUser) {
    return <AuthScreen onLogin={() => {}} />;
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
              <div className="flex items-center gap-2">
                 <p className="text-[8px] font-black uppercase tracking-[0.15em] text-emerald-600 dark:text-emerald-400">ID Domácnosti: {currentUser.householdId}</p>
                 <span className="text-[8px] bg-emerald-600 text-white px-2 py-0.5 rounded font-black shadow-lg shadow-emerald-500/30">v5.3 Sync Fix</span>
              </div>
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
             {/* Stats Cards */}
             <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <button onClick={() => setFilterMode('all')} className={`text-left p-6 rounded-3xl border transition-all ${filterMode === 'all' ? 'bg-white dark:bg-slate-800 border-slate-900 dark:border-white' : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800/50'}`}>
                <p className="text-[9px] uppercase font-black text-slate-400 tracking-widest">Inventár</p>
                <p className="text-3xl font-black text-slate-900 dark:text-white">{stats.total}</p>
              </button>
              <button onClick={() => setFilterMode('low')} className={`text-left p-6 rounded-3xl border transition-all ${filterMode === 'low' ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-500' : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800/50'}`}>
                <p className="text-[9px] uppercase font-black text-amber-600 tracking-widest">Dochádza</p>
                <p className="text-3xl font-black text-amber-600 dark:text-amber-400">{stats.lowStock}</p>
              </button>
              <button onClick={() => setFilterMode('expiring')} className={`text-left p-6 rounded-3xl border transition-all ${filterMode === 'expiring' ? 'bg-red-50 dark:bg-red-900/30 border-red-500' : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800/50'}`}>
                <p className="text-[9px] uppercase font-black text-red-600 tracking-widest">Expirácia</p>
                <p className="text-3xl font-black text-red-600 dark:text-red-400">{stats.expiring}</p>
              </button>
              <div className="p-6 rounded-3xl bg-indigo-600 text-white cursor-pointer" onClick={handleAiAdvice}>
                <p className="text-[9px] uppercase font-black text-indigo-200 tracking-widest mb-1">Recepty zo špajze</p>
                <p className="text-sm font-black leading-tight">Čo uvariť?</p>
              </div>
            </div>

            {aiSuggestions && (
              <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 mb-8 border border-indigo-500/30 relative">
                <button onClick={() => setAiSuggestions(null)} className="absolute top-4 right-4 text-slate-400">✕</button>
                <div className="prose dark:prose-invert max-w-none text-slate-700 dark:text-slate-300 whitespace-pre-wrap font-medium">{aiSuggestions}</div>
              </div>
            )}

            {/* Controls Row */}
            <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
              <div className="flex gap-2 bg-white dark:bg-slate-900 p-1 rounded-2xl border border-slate-200 dark:border-slate-800 w-full sm:w-auto">
                <button onClick={() => setViewMode('list')} className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest ${viewMode === 'list' ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-md' : 'text-slate-400'}`}>Zoznam</button>
                <button onClick={() => setViewMode('grid')} className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest ${viewMode === 'grid' ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-md' : 'text-slate-400'}`}>Mriežka</button>
              </div>
              <div className="relative w-full sm:w-64 group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none transition-colors group-focus-within:text-emerald-500">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                </div>
                <input type="text" placeholder="Hľadať..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className={`w-full pl-12 pr-12 py-3.5 rounded-2xl border font-bold text-sm outline-none transition-all ${searchTerm ? 'bg-emerald-50/50 dark:bg-emerald-900/10 border-emerald-500/50 text-emerald-900 dark:text-emerald-100' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20'}`}/>
                {searchTerm && (
                    <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 bg-slate-200 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400 rounded-full hover:bg-red-100 hover:text-red-500 dark:hover:bg-red-900/30 dark:hover:text-red-400 transition-all active:scale-90">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                )}
              </div>
            </div>

            {/* Category Filter */}
            <div className="relative mb-6 -mx-4 sm:mx-0 group">
              <div className={`absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-slate-50 dark:from-slate-950 to-transparent z-10 pointer-events-none transition-opacity duration-300 ${scrollFlags.left ? 'opacity-100' : 'opacity-0'}`}></div>
              <div className={`absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-slate-50 dark:from-slate-950 to-transparent z-10 pointer-events-none transition-opacity duration-300 ${scrollFlags.right ? 'opacity-100' : 'opacity-0'}`}></div>
              <div ref={categoryScrollRef} onScroll={checkScroll} className="overflow-x-auto no-scrollbar flex items-center gap-3 px-4 sm:px-0 py-4 select-none snap-x">
                <button onClick={(e) => handleCategoryClick('all', e)} className={`shrink-0 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all active:scale-95 flex items-center gap-2 snap-center ${selectedCategory === 'all' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20 ring-2 ring-emerald-600 border-transparent' : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 6h16M4 12h16M4 18h16" /></svg>
                  Všetko
                </button>
                {categories.map(cat => (
                  <button key={cat.id} onClick={(e) => handleCategoryClick(cat.id, e)} className={`shrink-0 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all active:scale-95 flex items-center gap-2 snap-center ${selectedCategory === cat.id ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20 ring-2 ring-emerald-600 border-transparent' : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                    <span className="text-base leading-none">{cat.icon}</span>
                    {cat.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Inventory Grid/List */}
            <div className="mt-2">
              {viewMode === 'grid' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {filteredItems.map(item => (
                    <InventoryItemCard key={item.id} item={item} location={locations.find(l => l.id === item.locationId)} category={categories.find(c => c.id === item.category)} 
                      onUpdate={(id, updates) => { if (updates.currentQuantity !== undefined && updates.currentQuantity < item.currentQuantity) { handleTriggerConsume(item); } else { handleUpdateItem(id, updates); }}} 
                      onDelete={handleDeleteItem} onEdit={handleEditItemTrigger} onAddToShoppingList={handleAddToShoppingList} onQuickAdd={handleTriggerQuickAdd} onConsume={handleTriggerConsume}
                    />
                  ))}
                </div>
              ) : (
                <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800/50 overflow-hidden">
                  {filteredItems.map(item => (
                    <InventoryItemRow key={item.id} item={item} isExpanded={expandedItemId === item.id} onToggleExpand={() => setExpandedItemId(prev => prev === item.id ? null : item.id)} location={locations.find(l => l.id === item.locationId)} category={categories.find(c => c.id === item.category)} 
                      onUpdate={(id, updates) => { if (updates.currentQuantity !== undefined && updates.currentQuantity < item.currentQuantity) { handleTriggerConsume(item); } else { handleUpdateItem(id, updates); }}} 
                      onDelete={handleDeleteItem} onEdit={handleEditItemTrigger} onAddToShoppingList={handleAddToShoppingList} onQuickAdd={handleTriggerQuickAdd} onConsume={handleTriggerConsume}
                    />
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          <ShoppingList items={shoppingList} 
            onUpdate={handleShoppingListUpdate} 
            onDelete={handleShoppingListDelete} 
            onAdd={handleShoppingListAdd} 
            onClearCompleted={handleShoppingListClear} 
          />
        )}
      </main>

      <AddItemModal isOpen={isModalOpen} onClose={handleCloseModal} onAdd={handleAddItem} onUpdate={handleUpdateItem} onAddCategory={handleAddCategory} editingItem={editingItem} locations={locations} categories={categories} onQuickAdd={handleTriggerQuickAdd} onConsume={handleTriggerConsume} />
      
      <ManageMetadataModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
        locations={locations} 
        categories={categories} 
        setLocations={(newLocs) => {
            if (currentUser && typeof newLocs !== 'function') updateDoc(doc(db, "households", currentUser.householdId), { locations: newLocs });
        }} 
        setCategories={(newCats) => {
            if (currentUser && typeof newCats !== 'function') updateDoc(doc(db, "households", currentUser.householdId), { categories: newCats });
        }} 
        currentUser={currentUser} 
        onUpdateUser={(updatedUser) => {
            if (updatedUser.householdId !== currentUser.householdId) {
                // 1. Zmeníme údaje vo Firestore
                updateDoc(doc(db, "users", currentUser.id), { householdId: updatedUser.householdId });
                // 2. OKAMŽITÁ ZMENA LOKÁLNEHO STAVU - TOTO SPÔSOBÍ PREPNUTIE LISTENEROV
                setCurrentUser(updatedUser);
            }
        }} 
      />
      
      <QuickAddModal isOpen={!!quickAddModalItem} onClose={() => setQuickAddModalItem(null)} onConfirm={confirmQuickAdd} item={quickAddModalItem} />
      <ConsumeItemModal isOpen={!!consumeModalItem} onClose={() => setConsumeModalItem(null)} onConfirm={confirmConsume} item={consumeModalItem} />

      <div className="fixed bottom-0 inset-x-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl border-t border-slate-200 dark:border-slate-800 p-2 pb-8 flex justify-around items-center z-50">
        <button onClick={() => setActiveTab('inventory')} className={`flex-1 flex flex-col items-center gap-1 p-3 rounded-2xl active:bg-slate-100 dark:active:bg-slate-800/50 transition-all ${activeTab === 'inventory' ? 'text-emerald-600' : 'text-slate-400'}`}>
          <span className="text-xl">🧺</span>
          <span className="text-[9px] font-black uppercase tracking-widest">Zásoby</span>
        </button>
        <button onClick={() => setIsModalOpen(true)} className="mx-2 w-12 h-12 bg-emerald-600 hover:bg-emerald-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-emerald-600/20 active:scale-90 transition-all">
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
