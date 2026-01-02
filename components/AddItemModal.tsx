
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
    
    if (result && result.name && result.name !== 'null') {
      let catId = formData.category;
      if (result.categoryName) {
        catId = onAddCategory(result.categoryName);
      }

      setFormData(prev => ({
        ...prev,
        name: result.name,
        quantityPerPack: result.quantity || prev.quantityPerPack,
        unit: (result.unit?.toLowerCase() as Unit) || prev.unit,
        category: catId
      }));
    } else {
      alert(`Kód ${codeUsed} sa nenašiel v databáze ani na webe. Zadajte názov produktu ručne.`);
    }
  };

  const handleBarcodeScan = async (code: string) => {
    setScannedCode(code);
    setIsAiProcessing(true);
    try {
      const result = await parseSmartEntry(code, categories);
      handleApplyResult(result, code);
    } catch (e: any) {
      setIsAiProcessing(false);
      alert("Chyba spojenia pri rozpoznávaní.");
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
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
        <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] w-full max-w-md max-h-[90vh] shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col animate-in fade-in zoom-in duration-200">
          <div className="px-8 py-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50 sticky top-0 z-10 shrink-0">
            <div>
              <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">
                {editingItem ? 'Upraviť' : 'Pridať zásoby'}
              </h2>
              {isAiProcessing && (
                <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest animate-pulse flex items-center gap-1.5 mt-1">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
                  Analýza webov a databáz...
                </p>
              )}
            </div>
            <button onClick={onClose} className="p-3 bg-white dark:bg-slate-800 text-slate-400 rounded-2xl border border-slate-100 dark:border-slate-700">✕</button>
          </div>

          <div className="overflow-y-auto no-scrollbar flex-1 overscroll-contain">
            <form onSubmit={handleSubmit} className="px-8 pt-8 pb-32 space-y-6">
              <div>
                <label className="block text-[10px] font-black text-slate-400 mb-2 uppercase tracking-widest">Názov produktu</label>
                <div className="flex gap-2">
                  <input 
                    required disabled={isAiProcessing} type="text" value={formData.name}
                    onChange={e => setFormData({...formData, name: e.target.value})}
                    placeholder="Názov produktu..."
                    className="flex-1 px-5 py-3 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white border-none rounded-2xl outline-none font-bold placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:ring-2 focus:ring-emerald-500 transition-all"
                  />
                  {!editingItem && (
                    <button type="button" onClick={() => setShowScanner(true)} className="p-3.5 bg-emerald-600 text-white rounded-2xl shadow-lg active:scale-90 transition-transform flex items-center justify-center">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v1m-3.322 3.322l-.707.707M5 12h1m3.322 3.322l-.707.707M12 19v1m3.322-3.322l.707.707M19 12h1m-3.322-3.322l.707-.707M12 12a4 4 0 110-8 4 4 0 010 8z" /></svg>
                    </button>
                  )}
                </div>
                {scannedCode && (
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest">EAN: {scannedCode}</span>
                    <button type="button" onClick={() => handleBarcodeScan(scannedCode)} className="text-[9px] text-emerald-500 font-black uppercase underline tracking-tighter">Skúsiť znova</button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 mb-2 uppercase tracking-widest">Lokalita</label>
                  <select value={formData.locationId} onChange={e => setFormData({...formData, locationId: e.target.value})} className="w-full px-5 py-3 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white rounded-2xl font-bold appearance-none outline-none">
                    {locations.map(l => <option key={l.id} value={l.id}>{l.icon} {l.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 mb-2 uppercase tracking-widest">Kategória</label>
                  <select value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className="w-full px-5 py-3 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white rounded-2xl font-bold appearance-none outline-none">
                    {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="p-5 bg-slate-50 dark:bg-slate-800/50 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-4 shadow-inner">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[9px] font-black text-slate-400 mb-2 uppercase tracking-widest">Jednotka</label>
                    <select value={formData.unit} onChange={e => setFormData({...formData, unit: e.target.value as Unit})} className="w-full px-3 py-3 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl font-bold appearance-none text-center border border-slate-200 dark:border-slate-700 outline-none">
                      {Object.values(Unit).map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[9px] font-black text-slate-400 mb-2 uppercase tracking-widest">Obsah 1ks</label>
                    <input required={formData.unit !== Unit.KS} type="number" step="any" disabled={formData.unit === Unit.KS} value={formData.quantityPerPack} onChange={e => setFormData({...formData, quantityPerPack: Number(e.target.value)})} className="w-full px-3 py-3 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl font-black text-center disabled:opacity-30 border border-slate-200 dark:border-slate-700 outline-none" />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                  <div>
                    <label className="block text-[9px] font-black text-emerald-600 mb-2 uppercase tracking-widest">AKTUÁLNY STAV (KS)</label>
                    <input required type="number" value={formData.currentPacks} min="0" onChange={e => setFormData({...formData, currentPacks: Number(e.target.value)})} className="w-full px-3 py-3 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-100 rounded-xl font-black text-center focus:ring-2 focus:ring-emerald-500 outline-none border border-emerald-200 dark:border-emerald-800/50" />
                  </div>
                  <div>
                    <label className="block text-[9px] font-black text-slate-400 mb-2 uppercase tracking-widest">CIEĽOVÝ STAV (KS)</label>
                    <input required type="number" value={formData.targetPacks} min="1" onChange={e => setFormData({...formData, targetPacks: Number(e.target.value)})} className="w-full px-3 py-3 bg-white dark:bg-slate-900 dark:text-white rounded-xl font-black text-center focus:ring-2 focus:ring-emerald-500 outline-none border border-slate-200 dark:border-slate-700" />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 mb-2 uppercase tracking-widest">Dátum expirácie (nepovinné)</label>
                <input 
                  type="date" value={formData.expiryDate}
                  onChange={e => setFormData({...formData, expiryDate: e.target.value})}
                  className="w-full px-5 py-3 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white border-none rounded-2xl outline-none font-bold"
                />
              </div>

              <div className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl">
                <input 
                  type="checkbox" id="isHomemade" checked={formData.isHomemade}
                  onChange={e => setFormData({...formData, isHomemade: e.target.checked})}
                  className="w-5 h-5 accent-emerald-600 rounded-md"
                />
                <label htmlFor="isHomemade" className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest cursor-pointer">Vlastná výroba / Lokálne</label>
              </div>

              <div>
                <button type="submit" disabled={isAiProcessing} className="w-full py-5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-400 text-white font-black rounded-[2rem] shadow-xl transition-all uppercase tracking-widest text-sm active:scale-95">
                  {editingItem ? 'Uložiť zmeny' : 'Uložiť do systému'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {showScanner && (
        <BarcodeScanner 
          onScan={handleBarcodeScan} 
          onClose={() => setShowScanner(false)} 
          isAnalyzing={isAiProcessing}
        />
      )}
    </>
  );
};
