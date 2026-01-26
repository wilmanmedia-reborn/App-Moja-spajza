
import React, { useState, useEffect } from 'react';
import { FoodItem, Unit, Location, Category, Batch } from '../types';
import { BarcodeScanner } from './BarcodeScanner';
import { parseSmartEntry } from '../geminiService';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (item: Omit<FoodItem, 'id' | 'lastUpdated' | 'householdId'>) => void;
  onUpdate: (id: string, updates: Partial<FoodItem>) => void;
  onAddCategory: (categoryName: string) => string;
  editingItem: FoodItem | null;
  locations: Location[];
  categories: Category[];
}

export const AddItemModal: React.FC<Props> = ({ isOpen, onClose, onAdd, onUpdate, onAddCategory, editingItem, locations, categories }) => {
  const [showScanner, setShowScanner] = useState(false);
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [scannedCode, setScannedCode] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    locationId: '',
    targetPacks: 1,
    currentPacks: 1, // Používame pre celkový súčet alebo pre novú položku
    quantityPerPack: 0,
    unit: Unit.G,
    expiryDate: '', // Používame pre "hlavný" alebo "prvý" batch pri vytváraní
    isHomemade: false
  });
  
  const [tempBatches, setTempBatches] = useState<Batch[]>([]);

  // Zabránenie scrolovaniu pozadia pri otvorenom modale
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      // Fix pre iOS bounce
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
    } else {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
    }
    return () => {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
    };
  }, [isOpen]);

  useEffect(() => {
    if (editingItem) {
      const packSize = editingItem.quantityPerPack || editingItem.totalQuantity || 1;
      setFormData({
        name: editingItem.name,
        category: editingItem.category,
        locationId: editingItem.locationId,
        targetPacks: Math.round(editingItem.totalQuantity / packSize),
        currentPacks: Math.round(editingItem.currentQuantity / packSize),
        quantityPerPack: editingItem.quantityPerPack || 0,
        unit: editingItem.unit,
        expiryDate: editingItem.expiryDate || '',
        isHomemade: editingItem.isHomemade
      });
      setTempBatches(editingItem.batches || []);
    } else {
      setFormData({
        name: '',
        category: categories[0]?.id || '',
        locationId: locations[0]?.id || '',
        targetPacks: 1,
        currentPacks: 1,
        quantityPerPack: 0,
        unit: Unit.G,
        expiryDate: '',
        isHomemade: false
      });
      setTempBatches([]);
    }
  }, [editingItem, categories, locations, isOpen]);

  if (!isOpen) return null;

  const handleApplyResult = (result: any, codeUsed: string) => {
    setIsAiProcessing(false);
    setShowScanner(false);
    
    if (result && result.name) {
      let catId = formData.category;
      if (result.categoryName) {
        const foundCat = categories.find(c => c.name.toLowerCase() === result.categoryName.toLowerCase());
        catId = foundCat ? foundCat.id : onAddCategory(result.categoryName);
      }

      setFormData(prev => ({
        ...prev,
        name: result.name,
        quantityPerPack: result.quantity || prev.quantityPerPack,
        unit: (result.unit?.toLowerCase() as Unit) || prev.unit,
        category: catId
      }));
    } else {
      alert(`Kód ${codeUsed} sa nepodarilo rozpoznať. Zadajte ho ručne.`);
    }
  };

  const handleBarcodeSearch = async (code: string) => {
    setScannedCode(code);
    setIsAiProcessing(true);
    try {
      const result = await parseSmartEntry(code, categories);
      handleApplyResult(result, code);
    } catch (e: any) {
      setIsAiProcessing(false);
      alert("Chyba spojenia.");
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) return;

    const isKs = formData.unit === Unit.KS;
    const total = isKs ? formData.targetPacks : formData.targetPacks * formData.quantityPerPack;
    
    // Ak editujeme, prepočítame currentQuantity z batches
    let current = isKs ? formData.currentPacks : formData.currentPacks * formData.quantityPerPack;
    let finalBatches = tempBatches;

    if (editingItem) {
        // Pri editácii sa spoliehame na tempBatches
        current = tempBatches.reduce((acc, b) => acc + b.quantity, 0);
        
        // Update nearest expiry based on batches
        const sortedBatches = [...tempBatches].sort((a, b) => {
          if (!a.expiryDate) return 1;
          if (!b.expiryDate) return -1;
          return new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime();
        });
        
        const nearestExpiry = sortedBatches.find(b => b.expiryDate)?.expiryDate || sortedBatches[0]?.expiryDate || '';

        onUpdate(editingItem.id, {
            name: formData.name,
            category: formData.category,
            locationId: formData.locationId,
            totalQuantity: total,
            currentQuantity: current,
            unit: formData.unit,
            quantityPerPack: isKs ? undefined : formData.quantityPerPack,
            isHomemade: formData.isHomemade,
            batches: tempBatches,
            expiryDate: nearestExpiry
        });
    } else {
        // Pri pridávaní novej položky vytvárame item, batch sa vytvorí v App.tsx
        // Alebo, ak chceme byť konzistentní, App.tsx by mala dostať rovno batch.
        // Pre zjednodušenie (lebo App.tsx handleAddItem očakáva Omit<FoodItem...>)
        // pošleme základné dáta a App.tsx vytvorí prvý batch.
        
        // POZOR: App.tsx handleAddItem používa expiryDate z payloadu pre prvý batch.
        
        const payload = {
            name: formData.name,
            category: formData.category,
            locationId: formData.locationId,
            totalQuantity: total,
            currentQuantity: current,
            unit: formData.unit,
            quantityPerPack: isKs ? undefined : formData.quantityPerPack,
            expiryDate: formData.expiryDate,
            isHomemade: formData.isHomemade
        };
        onAdd(payload);
    }

    onClose();
  };
  
  const removeBatch = (batchId: string) => {
      setTempBatches(prev => prev.filter(b => b.id !== batchId));
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/80 backdrop-blur-md px-0 sm:px-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
        <div className="bg-white dark:bg-slate-900 w-full max-w-md h-[92vh] sm:h-auto sm:max-h-[85vh] rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col border border-white/10 overflow-hidden animate-in slide-in-from-bottom duration-300">
          
          {/* Header */}
          <div className="px-6 py-5 flex justify-between items-center border-b border-slate-100 dark:border-slate-800 shrink-0">
            <h2 className="text-[14px] font-black text-slate-900 dark:text-white uppercase tracking-tighter">
              {editingItem ? 'Upraviť položku' : 'Pridať položku'}
            </h2>
            <button onClick={onClose} className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors text-xl">✕</button>
          </div>

          {/* Form Content - Scrollable */}
          <div className="flex-1 overflow-y-auto no-scrollbar overscroll-contain px-6 py-6 pb-12">
            <div className="space-y-6">
              
              {/* Názov Produktu */}
              <div className="space-y-2">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Názov produktu</label>
                <div className="flex gap-3">
                  <input 
                    required disabled={isAiProcessing} type="text" value={formData.name}
                    onChange={e => setFormData({...formData, name: e.target.value})}
                    placeholder="Napr. Snico Horčica..."
                    className="flex-1 px-5 py-4 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white rounded-2xl outline-none font-bold text-[15px] border-2 border-transparent focus:border-emerald-500/30 transition-all"
                  />
                  {!editingItem && (
                    <button type="button" onClick={() => setShowScanner(true)} className="w-[56px] h-[56px] shrink-0 flex items-center justify-center bg-emerald-600 text-white rounded-2xl shadow-lg active:scale-90 transition-transform">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 4v1m-3.322 3.322l-.707.707M5 12h1m3.322 3.322l-.707.707M12 19v1m3.322-3.322l.707.707M19 12h1m-3.322-3.322l.707-.707M12 12a4 4 0 110-8 4 4 0 010 8z" /></svg>
                    </button>
                  )}
                </div>
                {scannedCode && <p className="text-[8px] text-emerald-500 font-bold uppercase ml-1">Kód: {scannedCode}</p>}
              </div>

              {/* Lokácia a Kategória */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Lokalita</label>
                  <div className="relative">
                    <select 
                      value={formData.locationId} 
                      onChange={e => setFormData({...formData, locationId: e.target.value})} 
                      className="w-full px-4 py-4 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white rounded-2xl font-bold appearance-none text-[13px] outline-none border-none"
                    >
                      {locations.map(l => <option key={l.id} value={l.id}>{l.icon} {l.name}</option>)}
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none opacity-30">▼</div>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Kategória</label>
                  <div className="relative">
                    <select 
                      value={formData.category} 
                      onChange={e => setFormData({...formData, category: e.target.value})} 
                      className="w-full px-4 py-4 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white rounded-2xl font-bold appearance-none text-[13px] outline-none border-none"
                    >
                      {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none opacity-30">▼</div>
                  </div>
                </div>
              </div>

              {/* Množstvá a jednotky - Fix centrovania a vizuálu */}
              <div className="p-6 bg-slate-50 dark:bg-slate-800/40 rounded-3xl space-y-6 border border-slate-100 dark:border-slate-800">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest text-center">Jednotka</label>
                    <select 
                      value={formData.unit} 
                      onChange={e => setFormData({...formData, unit: e.target.value as Unit})} 
                      className="w-full px-2 py-3.5 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-xl font-black text-[15px] border border-slate-200 dark:border-slate-700 outline-none text-center appearance-none"
                      style={{ textAlignLast: 'center', textAlign: 'center' }}
                    >
                      {Object.values(Unit).map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest text-center">Obsah 1ks</label>
                    <div className="relative flex items-center">
                      <input 
                        required={formData.unit !== Unit.KS} 
                        type="number" step="any" disabled={formData.unit === Unit.KS} 
                        value={formData.quantityPerPack || ''} 
                        onChange={e => setFormData({...formData, quantityPerPack: Number(e.target.value)})} 
                        className="w-full px-4 py-3.5 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-xl font-black text-center text-[15px] border border-slate-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-emerald-500/20" 
                      />
                      {formData.unit !== Unit.KS && (
                        <span className="absolute right-4 text-[11px] font-black text-slate-400 pointer-events-none lowercase">
                          {formData.unit}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-[8px] font-black text-emerald-600 uppercase tracking-widest text-center">
                      {editingItem ? 'Mám celkom (auto)' : 'Mám (ks)'}
                    </label>
                    {editingItem ? (
                      <div className="w-full px-4 py-3.5 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-100 rounded-xl font-black text-center text-[15px] border border-emerald-200 dark:border-emerald-800 opacity-60">
                        {tempBatches.reduce((acc, b) => acc + b.quantity, 0)}
                      </div>
                    ) : (
                      <input required type="number" value={formData.currentPacks} min="0" onChange={e => setFormData({...formData, currentPacks: Number(e.target.value)})} className="w-full px-4 py-3.5 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-100 rounded-xl font-black text-center text-[15px] outline-none border border-emerald-200 dark:border-emerald-800" />
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest text-center">Cieľ (ks)</label>
                    <input required type="number" value={formData.targetPacks} min="1" onChange={e => setFormData({...formData, targetPacks: Number(e.target.value)})} className="w-full px-4 py-3.5 bg-white dark:bg-slate-900 dark:text-white rounded-xl font-black text-center text-[15px] border border-slate-200 dark:border-slate-700 outline-none" />
                  </div>
                </div>
              </div>

              {/* Batches Management Section (Only visible when editing) */}
              {editingItem && (
                <div className="space-y-3">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Jednotlivé šarže a expirácie</label>
                    <div className="bg-slate-50 dark:bg-slate-800/40 rounded-3xl p-4 border border-slate-100 dark:border-slate-800 space-y-2 max-h-40 overflow-y-auto">
                        {tempBatches.map((batch, index) => (
                            <div key={batch.id} className="flex items-center gap-3 bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-100 dark:border-slate-800">
                                <div className="flex-1">
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                                        {batch.expiryDate ? batch.expiryDate : 'Bez dátumu'}
                                    </p>
                                </div>
                                <div className="text-sm font-black text-slate-900 dark:text-white">
                                    {batch.quantity}ks
                                </div>
                                <button 
                                    type="button"
                                    onClick={() => removeBatch(batch.id)}
                                    className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                </button>
                            </div>
                        ))}
                        {tempBatches.length === 0 && (
                            <p className="text-center text-[10px] text-slate-400 italic py-2">Žiadne naskladnené kusy</p>
                        )}
                    </div>
                </div>
              )}

              {/* Expirácia a Vlastná výroba v jednom riadku - Fix layoutu */}
              <div className="grid grid-cols-2 gap-4 items-stretch">
                {!editingItem && (
                    <div className="space-y-2">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Spotrebujte do</label>
                    <input 
                        type="date" value={formData.expiryDate}
                        onChange={e => setFormData({...formData, expiryDate: e.target.value})}
                        className="w-full h-[60px] px-4 py-3 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white rounded-2xl outline-none font-bold text-[13px] border-none flex items-center justify-center text-center"
                    />
                    </div>
                )}
                
                <div className={`space-y-2 ${editingItem ? 'col-span-2' : ''}`}>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Pôvod produktu</label>
                  <div className="flex h-[60px] bg-slate-100 dark:bg-slate-800 rounded-2xl overflow-hidden p-1">
                     <button
                       type="button"
                       onClick={() => setFormData(prev => ({ ...prev, isHomemade: false }))}
                       className={`flex-1 flex items-center justify-center rounded-xl text-[8px] font-black uppercase tracking-widest transition-all ${!formData.isHomemade ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                     >
                       Obchod
                     </button>
                     <button
                       type="button"
                       onClick={() => setFormData(prev => ({ ...prev, isHomemade: true }))}
                       className={`flex-1 flex items-center justify-center rounded-xl text-[8px] font-black uppercase tracking-widest transition-all ${formData.isHomemade ? 'bg-amber-500 text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                     >
                       Domáce
                     </button>
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* Footer - Fixed at bottom */}
          <div className="px-6 py-6 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 shrink-0 shadow-[0_-10px_20px_rgba(0,0,0,0.05)]">
            <button 
              onClick={handleSubmit}
              disabled={isAiProcessing || !formData.name} 
              className="w-full py-5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-300 dark:disabled:bg-slate-800 text-white font-black rounded-2xl shadow-xl shadow-emerald-600/20 transition-all uppercase tracking-widest text-[14px] active:scale-95 flex items-center justify-center gap-3"
            >
              {isAiProcessing ? (
                <>
                  <div className="w-5 h-5 border-3 border-white/30 border-t-white rounded-full animate-spin"></div>
                  <span>Identifikujem...</span>
                </>
              ) : (
                <span>{editingItem ? 'Uložiť zmeny' : 'Uložiť do systému'}</span>
              )}
            </button>
          </div>
        </div>
      </div>

      {showScanner && (
        <BarcodeScanner 
          onScan={handleBarcodeSearch} 
          onClose={() => setShowScanner(false)} 
          isAnalyzing={isAiProcessing}
        />
      )}
      
      <style>{`
        /* Fix pre centrovanie textu v selecte */
        select {
          text-align-last: center;
        }
        /* Custom scrollbar pre čistý vzhľad */
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </>
  );
};
