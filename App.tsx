
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
  
  // State pre sledovanie rozbalenej položky v zozname (akordeón)
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);

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
    let parsedItems = saved ? JSON.parse(saved) : MOCK_ITEMS;
    
    // MIGRÁCIA: Ak položka nemá batches, vytvoríme defaultný batch zo súčasných dát
    parsedItems = parsedItems.map((item: FoodItem) => {
      if (!item.batches || item.batches.length === 0) {
        if (item.currentQuantity > 0) {
          return {
            ...item,
            batches: [{
              id: Math.random().toString(36).substr(2, 9),
              quantity: item.currentQuantity,
              expiryDate: item.expiryDate,
              addedDate: Date.now()
            }]
          };
        } else {
          return { ...item, batches: [] };
        }
      }
      return item;
    });
    
    return parsedItems;
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
  
  // State pre Quick Add Modal
  const [quickAddModalItem, setQuickAddModalItem] = useState<FoodItem | null>(null);
  // State pre Consume Modal
  const [consumeModalItem, setConsumeModalItem] = useState<FoodItem | null>(null);

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

  const handleLogin = (user: User) => {
    setCurrentUser(user);
  };

  const handleAddItem = (newItem: Omit<FoodItem, 'id' | 'lastUpdated' | 'householdId'>) => {
    if (!currentUser) return;
    
    let initialBatches: Batch[] = [];

    // Logika rozdelenia na samostatné šarže (balenia)
    let countToAdd = 1;
    let quantityPerBatch = newItem.currentQuantity;

    if (newItem.unit === Unit.KS) {
        // PRE KUSY: Ak pridávam 5 ks, chcem 5 samostatných riadkov po 1 ks
        countToAdd = Math.max(1, newItem.currentQuantity);
        quantityPerBatch = 1;
    } else if (newItem.quantityPerPack && newItem.quantityPerPack > 0) {
        // PRE GRAMY/ML: Ak pridávam 10 balení horčice (10 x 350g = 3500g),
        // a celková hmotnosť je deliteľná veľkosťou balenia,
        // rozdelíme to na 10 samostatných batchov po 350g.
        const packs = newItem.currentQuantity / newItem.quantityPerPack;
        
        // Overíme, či ide o celé násobky balení (s toleranciou pre float math)
        if (Math.abs(Math.round(packs) - packs) < 0.001 && packs >= 1) {
            countToAdd = Math.round(packs);
            quantityPerBatch = newItem.quantityPerPack;
        }
    }

    // Vygenerujeme samostatné batche
    for (let i = 0; i < countToAdd; i++) {
        initialBatches.push({
            id: Math.random().toString(36).substr(2, 9) + i,
            quantity: quantityPerBatch,
            expiryDate: newItem.expiryDate,
            addedDate: Date.now()
        });
    }

    const item: FoodItem = {
      ...newItem,
      id: Math.random().toString(36).substr(2, 9),
      batches: initialBatches,
      lastUpdated: Date.now(),
      householdId: currentUser.householdId
    };
    setItems(prev => [item, ...prev]);
  };

  const handleUpdateItem = (id: string, updates: Partial<FoodItem>) => {
    setItems(prev => prev.map(item => {
      if (item.id !== id) return item;
      return { ...item, ...updates, lastUpdated: Date.now() };
    }));
  };

  // --- LOGIKA PRE QUICK ADD (+1 / Doplniť zásobu) ---
  const handleTriggerQuickAdd = (item: FoodItem) => {
    setQuickAddModalItem(item);
  };

  const confirmQuickAdd = (expiryDate: string | undefined, specificQuantity: number) => {
    if (!quickAddModalItem) return;
    
    // Použijeme špecifickú hmotnosť z modalu.
    const qtyToAdd = specificQuantity > 0 ? specificQuantity : (quickAddModalItem.unit === Unit.KS ? 1 : (quickAddModalItem.quantityPerPack || 0));

    if (qtyToAdd <= 0) {
        setQuickAddModalItem(null);
        return;
    }

    // 1. Nájdeme aktuálnu položku (aby sme pracovali s fresh dátami)
    const currentItem = items.find(i => i.id === quickAddModalItem.id);
    if (!currentItem) return;

    // 2. Vytvoríme nové batches (Rozdielna logika pre KS a pre G/ML)
    const newBatches = [...(currentItem.batches || [])];

    if (quickAddModalItem.unit === Unit.KS) {
        // PRE KS: Vytvoríme N samostatných dávok po 1ks
        // Príklad: Pridávam 3ks Leča -> Vzniknú 3 riadky po 1ks
        for (let i = 0; i < qtyToAdd; i++) {
            newBatches.push({
              id: Math.random().toString(36).substr(2, 9) + i,
              quantity: 1, // Vždy 1 kus
              expiryDate: expiryDate,
              addedDate: Date.now()
            });
        }
    } else {
        // PRE OSTATNÉ (g, ml): Vytvoríme jednu dávku s celkovou hmotnosťou
        // Tu zatiaľ necháme logiku "jeden batch", pretože QuickAdd zvyčajne slúži na doplnenie jednej konkrétnej veci.
        // Ak by sme chceli podporiť "kúpil som 5x350g" cez quick add, museli by sme to riešiť podobne ako v handleAddItem,
        // ale modal QuickAddCurrently vracia len celkovú quantity.
        newBatches.push({
          id: Math.random().toString(36).substr(2, 9),
          quantity: qtyToAdd,
          expiryDate: expiryDate,
          addedDate: Date.now()
        });
    }

    // 3. Zoradíme a updatneme item
    const sortedBatches = [...newBatches].sort((a, b) => {
        if (!a.expiryDate) return 1;
        if (!b.expiryDate) return -1;
        return new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime();
    });
    const nearestExpiry = sortedBatches.find(b => b.expiryDate)?.expiryDate;

    const updatedItem: FoodItem = {
      ...currentItem,
      currentQuantity: currentItem.currentQuantity + qtyToAdd,
      batches: sortedBatches,
      expiryDate: nearestExpiry || currentItem.expiryDate 
    };

    // 4. Aktualizujeme stav položiek
    setItems(prev => prev.map(i => i.id === updatedItem.id ? updatedItem : i));

    // 5. Ak sme v režime editácie tej istej položky, aktualizujeme aj editingItem
    if (editingItem && editingItem.id === updatedItem.id) {
        setEditingItem(updatedItem);
    }

    setQuickAddModalItem(null);
  };

  // --- LOGIKA PRE CONSUME (-1) ---
  
  const handleTriggerConsume = (item: FoodItem) => {
    if (item.currentQuantity <= 0) return;
    setConsumeModalItem(item);
  };

  const confirmConsume = (batchId: string | null) => {
    if (!consumeModalItem) return;

    // 1. Nájdeme aktuálnu položku (fresh dáta)
    const currentItem = items.find(i => i.id === consumeModalItem.id);
    if (!currentItem) return;

    let newBatches = [...(currentItem.batches || [])];
    let newTotalQty = currentItem.currentQuantity;

    if (batchId) {
        // Odstránenie konkrétneho batchu
        const batchIndex = newBatches.findIndex(b => b.id === batchId);
        if (batchIndex !== -1) {
            const batchQty = newBatches[batchIndex].quantity;
            newBatches.splice(batchIndex, 1);
            newTotalQty = Math.max(0, newTotalQty - batchQty);
        }
    } else {
        // Legacy/Fallback logika (ak by prišlo null)
        const qtyToRemove = currentItem.unit === Unit.KS ? 1 : (currentItem.quantityPerPack || 1);
        newTotalQty = Math.max(0, newTotalQty - qtyToRemove);
        
        let remainingToRemove = qtyToRemove;
        
        // Zoradíme najprv podľa expirácie, aby sme odoberali zo starých
        newBatches.sort((a, b) => {
             if (!a.expiryDate) return 1;
             if (!b.expiryDate) return -1;
             return new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime();
        });
        
        const keptBatches = [];
        for (const b of newBatches) {
            if (remainingToRemove <= 0) {
                keptBatches.push(b);
                continue;
            }
            
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

    // 2. Vytvoríme aktualizovaný objekt položky
    const updatedItem: FoodItem = {
        ...currentItem,
        currentQuantity: newTotalQty,
        batches: sortedBatches,
        expiryDate: nearestExpiry || currentItem.expiryDate
    };

    // 3. Aktualizujeme hlavný zoznam
    setItems(prev => prev.map(item => item.id === updatedItem.id ? updatedItem : item));

    // 4. Synchronizácia pre AddItemModal: Ak práve editujeme túto položku, pošleme tam novú verziu
    // TOTO JE KĽÚČOVÉ PRE OPRAVU CHYBY, KTORÚ POŽADOVAL UŽÍVATEĽ
    if (editingItem && editingItem.id === updatedItem.id) {
        setEditingItem(updatedItem);
    }

    setConsumeModalItem(null);
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
                    <InventoryItemCard 
                      key={item.id} 
                      item={item} 
                      location={locations.find(l => l.id === item.locationId)} 
                      category={categories.find(c => c.id === item.category)} 
                      onUpdate={(id, updates) => {
                         // Priamy update cez kartu (napr. len odobranie)
                         if (updates.currentQuantity !== undefined && updates.currentQuantity < item.currentQuantity) {
                           handleTriggerConsume(item);
                         } else {
                           handleUpdateItem(id, updates);
                         }
                      }} 
                      onDelete={handleDeleteItem} 
                      onEdit={handleEditItemTrigger} 
                      onAddToShoppingList={handleAddToShoppingList} 
                      onQuickAdd={handleTriggerQuickAdd}
                      onConsume={handleTriggerConsume}
                    />
                  ))}
                </div>
              ) : (
                <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800/50 overflow-hidden">
                  {filteredItems.map(item => (
                    <InventoryItemRow 
                      key={item.id} 
                      item={item} 
                      isExpanded={expandedItemId === item.id} // Posielame informáciu, či má byť tento riadok rozbalený
                      onToggleExpand={() => setExpandedItemId(prev => prev === item.id ? null : item.id)} // Funkcia na prepínanie rozbalenia
                      location={locations.find(l => l.id === item.locationId)} 
                      category={categories.find(c => c.id === item.category)} 
                      onUpdate={(id, updates) => {
                         if (updates.currentQuantity !== undefined && updates.currentQuantity < item.currentQuantity) {
                           handleTriggerConsume(item);
                         } else {
                           handleUpdateItem(id, updates);
                         }
                      }} 
                      onDelete={handleDeleteItem} 
                      onEdit={handleEditItemTrigger} 
                      onAddToShoppingList={handleAddToShoppingList} 
                      onQuickAdd={handleTriggerQuickAdd}
                      onConsume={handleTriggerConsume}
                    />
                  ))}
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
        onQuickAdd={handleTriggerQuickAdd}
        onConsume={handleTriggerConsume}
      />
      <ManageMetadataModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} locations={locations} categories={categories} setLocations={setLocations} setCategories={setCategories} currentUser={currentUser} onUpdateUser={setCurrentUser} />
      
      {/* Quick Add Modal pre zadanie expirácie */}
      <QuickAddModal 
        isOpen={!!quickAddModalItem} 
        onClose={() => setQuickAddModalItem(null)} 
        onConfirm={confirmQuickAdd}
        item={quickAddModalItem}
      />
      
      {/* Consume Modal pre výber šarže */}
      <ConsumeItemModal
        isOpen={!!consumeModalItem}
        onClose={() => setConsumeModalItem(null)}
        onConfirm={confirmConsume}
        item={consumeModalItem}
      />

      <div className="fixed bottom-0 inset-x-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl border-t border-slate-200 dark:border-slate-800 p-2 pb-8 flex justify-around items-center z-50">
        {/* ... navigation buttons ... */}
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
