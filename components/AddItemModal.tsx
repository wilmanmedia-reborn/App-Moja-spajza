
import React, { useState, useEffect } from 'react';
import { FoodItem, Unit, Location, Category } from '../types';
import { BarcodeScanner } from './BarcodeScanner';
import { parseSmartEntry } from '../geminiService';

declare var window: any;

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
    currentPacks: 1,
    quantityPerPack: 0,
    unit: Unit.G,
    expiryDate: '',
    isHomemade: false
  });

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
      alert(`Kód ${codeUsed} sa nepodarilo analyzovať. Skúste ručne.`);
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
    const isKs = formData.unit === Unit.KS;
    const total = isKs ? formData.targetPacks : formData.targetPacks * formData.quantityPerPack;
    const current = isKs ? formData.currentPacks : formData.currentPacks * formData.quantityPerPack;
    
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

    if (editingItem) onUpdate(editingItem.id, payload);
    else onAdd(payload);

    onClose();
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/80 backdrop-blur-md">
        <div className="bg-white dark:bg-slate-900 rounded-t-[2.5rem] sm:rounded-[2.5rem] w-full max-w-md max-h-[92vh] shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col animate-in slide-in-from-bottom duration-300">
          
          <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50 sticky top-0 z-10 shrink-0">
            <h2 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tighter">
              {editingItem ? 'Upraviť' : 'Pridať zásoby'}
            </h2>
            <button onClick={onClose} className="p-2 bg-white dark:bg-slate-800 text-slate-400 rounded-xl border border-slate-100 dark:border-slate-700">✕</button>
          </div>

          <div className="overflow-y-auto no-scrollbar flex-1 overscroll-contain">
            <form id="add-item-form" onSubmit={handleSubmit} className="px-6 py-6 space-y-4">
              
              {isAiProcessing && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center gap-3 animate-pulse">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                  <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Prehľadávam obchody...</span>
                </div>
              )}

              <div>
                <label className="block text-[9px] font-black text-slate-400 mb-1.5 uppercase tracking-widest">Názov produktu</label>
                <div className="flex gap-2">
                  <input 
                    required disabled={isAiProcessing} type="text" value={formData.name}
                    onChange={e => setFormData({...formData, name: e.target.value})}
                    placeholder="Názov..."
                    className="flex-1 px-4 py-3 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white border-none rounded-xl outline-none font-bold placeholder:text-slate-400"
                  />
                  {!editingItem && (
                    <button type="button" onClick={() => setShowScanner(true)} className="p-3 bg-emerald-600 text-white rounded-xl shadow-lg active:scale-90 transition-transform">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 4v1m-3.322 3.322l-.707.707M5 12h1m3.322 3.322l-.707.707M12 19v1m3.322-3.322l.707.707M19 12h1m-3.322-3.322l.707-.707M12 12a4 4 0 110-8 4 4 0 010 8z" /></svg>
                    </button>
                  )}
                </div>
                {scannedCode && <p className="text-[8px] text-slate-400 font-bold mt-1 uppercase tracking-tighter ml-1">Kód: {scannedCode}</p>}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest">Lokalita</label>
                  <select value={formData.locationId} onChange={e => setFormData({...formData, locationId: e.target.value})} className="w-full px-4 py-3 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl font-bold appearance-none outline-none border-none">
                    {locations.map(l => <option key={l.id} value={l.id}>{l.icon} {l.name}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest">Kategória</label>
                  <select value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className="w-full px-4 py-3 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl font-bold appearance-none outline-none border-none">
                    {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="p-4 bg-slate-50 dark:bg-slate-800/30 rounded-2xl border border-slate-100 dark:border-slate-800/50 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[8px] font-black text-slate-400 mb-1 uppercase tracking-widest">Jednotka</label>
                    <select value={formData.unit} onChange={e => setFormData({...formData, unit: e.target.value as Unit})} className="w-full px-2 py-2.5 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-lg font-bold border border-slate-200 dark:border-slate-700 outline-none">
                      {Object.values(Unit).map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[8px] font-black text-slate-400 mb-1 uppercase tracking-widest">Obsah 1ks</label>
                    <input required={formData.unit !== Unit.KS} type="number" step="any" disabled={formData.unit === Unit.KS} value={formData.quantityPerPack} onChange={e => setFormData({...formData, quantityPerPack: Number(e.target.value)})} className="w-full px-2 py-2.5 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-lg font-black text-center disabled:opacity-30 border border-slate-200 dark:border-slate-700 outline-none" />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[8px] font-black text-emerald-600 mb-1 uppercase tracking-widest">Aktuálne (ks)</label>
                    <input required type="number" value={formData.currentPacks} min="0" onChange={e => setFormData({...formData, currentPacks: Number(e.target.value)})} className="w-full px-2 py-2.5 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-100 rounded-lg font-black text-center outline-none border border-emerald-200 dark:border-emerald-800" />
                  </div>
                  <div>
                    <label className="block text-[8px] font-black text-slate-400 mb-1 uppercase tracking-widest">Cieľ (ks)</label>
                    <input required type="number" value={formData.targetPacks} min="1" onChange={e => setFormData({...formData, targetPacks: Number(e.target.value)})} className="w-full px-2 py-2.5 bg-white dark:bg-slate-900 dark:text-white rounded-lg font-black text-center border border-slate-200 dark:border-slate-700 outline-none" />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[9px] font-black text-slate-400 mb-1 uppercase tracking-widest">Dátum expirácie</label>
                <input 
                  type="date" value={formData.expiryDate}
                  onChange={e => setFormData({...formData, expiryDate: e.target.value})}
                  className="w-full px-4 py-3 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white border-none rounded-xl outline-none font-bold"
                />
              </div>

              <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/30 rounded-xl">
                <input 
                  type="checkbox" id="isHomemade" checked={formData.isHomemade}
                  onChange={e => setFormData({...formData, isHomemade: e.target.checked})}
                  className="w-5 h-5 accent-emerald-600 rounded-md"
                />
                <label htmlFor="isHomemade" className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest cursor-pointer">Vlastná výroba / Lokálne</label>
              </div>

              <div className="pt-2">
                <button type="submit" disabled={isAiProcessing} className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-400 text-white font-black rounded-2xl shadow-xl transition-all uppercase tracking-widest text-xs active:scale-95">
                  {editingItem ? 'Uložiť zmeny' : 'Uložiť do systému'}
                </button>
              </div>
            </form>
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
    </>
  );
};
