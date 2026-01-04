
import React, { useState, useEffect } from 'react';
import { FoodItem, Unit, Location, Category } from '../types';
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
      <div className="fixed inset-0 z-50 flex items-center justify-center p-2 bg-slate-950/80 backdrop-blur-sm">
        <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] w-full max-w-sm max-h-[96vh] shadow-2xl flex flex-col animate-in zoom-in duration-200 overflow-hidden border border-white/10">
          
          <div className="px-4 py-3 flex justify-between items-center border-b border-slate-100 dark:border-slate-800 shrink-0">
            <h2 className="text-[12px] font-black text-slate-900 dark:text-white uppercase tracking-tighter">
              {editingItem ? 'Upraviť' : 'Pridať položku'}
            </h2>
            <button onClick={onClose} className="p-2 text-slate-400">✕</button>
          </div>

          <div className="overflow-y-auto no-scrollbar flex-1 overscroll-contain">
            <form onSubmit={handleSubmit} className="px-4 py-4 space-y-4">
              
              {/* Názov Produktu */}
              <div>
                <label className="block text-[8px] font-black text-slate-400 mb-1 uppercase tracking-widest ml-1">Názov produktu</label>
                <div className="flex gap-2">
                  <input 
                    required disabled={isAiProcessing} type="text" value={formData.name}
                    onChange={e => setFormData({...formData, name: e.target.value})}
                    placeholder="Napr. Snico Horčica..."
                    className="flex-1 px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl outline-none font-bold text-[14px]"
                  />
                  {!editingItem && (
                    <button type="button" onClick={() => setShowScanner(true)} className="p-2.5 bg-emerald-600 text-white rounded-xl shadow-lg active:scale-90 transition-transform">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 4v1m-3.322 3.322l-.707.707M5 12h1m3.322 3.322l-.707.707M12 19v1m3.322-3.322l.707.707M19 12h1m-3.322-3.322l.707-.707M12 12a4 4 0 110-8 4 4 0 010 8z" /></svg>
                    </button>
                  )}
                </div>
                {scannedCode && <p className="text-[7px] text-emerald-500 font-bold mt-1 uppercase ml-1">Kód: {scannedCode}</p>}
              </div>

              {/* Lokácia a Kategória */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Lokalita</label>
                  <select value={formData.locationId} onChange={e => setFormData({...formData, locationId: e.target.value})} className="w-full px-3 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl font-bold appearance-none text-[12px] outline-none border-none">
                    {locations.map(l => <option key={l.id} value={l.id}>{l.icon} {l.name}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Kategória</label>
                  <select value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className="w-full px-3 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl font-bold appearance-none text-[12px] outline-none border-none">
                    {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                  </select>
                </div>
              </div>

              {/* Množstvá a jednotky - Fix centrovania */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[7px] font-black text-slate-400 mb-1 uppercase tracking-widest text-center">Jednotka</label>
                    <select value={formData.unit} onChange={e => setFormData({...formData, unit: e.target.value as Unit})} className="w-full px-2 py-2 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-lg font-bold text-[12px] border border-slate-200 dark:border-slate-700 text-center outline-none">
                      {Object.values(Unit).map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[7px] font-black text-slate-400 mb-1 uppercase tracking-widest text-center">Obsah 1ks</label>
                    <input required={formData.unit !== Unit.KS} type="number" step="any" disabled={formData.unit === Unit.KS} value={formData.quantityPerPack} onChange={e => setFormData({...formData, quantityPerPack: Number(e.target.value)})} className="w-full px-2 py-2 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-lg font-black text-center text-[12px] border border-slate-200 dark:border-slate-700 outline-none" />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[7px] font-black text-emerald-600 mb-1 uppercase tracking-widest text-center">Mám (ks)</label>
                    <input required type="number" value={formData.currentPacks} min="0" onChange={e => setFormData({...formData, currentPacks: Number(e.target.value)})} className="w-full px-2 py-2 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-100 rounded-lg font-black text-center text-[12px] outline-none border border-emerald-200 dark:border-emerald-800" />
                  </div>
                  <div>
                    <label className="block text-[7px] font-black text-slate-400 mb-1 uppercase tracking-widest text-center">Cieľ (ks)</label>
                    <input required type="number" value={formData.targetPacks} min="1" onChange={e => setFormData({...formData, targetPacks: Number(e.target.value)})} className="w-full px-2 py-2 bg-white dark:bg-slate-900 dark:text-white rounded-lg font-black text-center text-[12px] border border-slate-200 dark:border-slate-700 outline-none" />
                  </div>
                </div>
              </div>

              {/* Expirácia - Samostatný riadok */}
              <div className="space-y-1">
                <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Spotrebujte do</label>
                <input 
                  type="date" value={formData.expiryDate}
                  onChange={e => setFormData({...formData, expiryDate: e.target.value})}
                  className="w-full px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl outline-none font-bold text-[12px] border-none"
                />
              </div>

              {/* Vlastná výroba - Moderný Prepínač */}
              <div 
                onClick={() => setFormData(prev => ({ ...prev, isHomemade: !prev.isHomemade }))}
                className={`flex items-center justify-between p-3.5 rounded-2xl cursor-pointer transition-all border-2 ${formData.isHomemade ? 'bg-amber-500/10 border-amber-500' : 'bg-slate-50 dark:bg-slate-800 border-transparent'}`}
              >
                <div className="flex flex-col">
                  <span className={`text-[9px] font-black uppercase tracking-widest ${formData.isHomemade ? 'text-amber-600' : 'text-slate-400'}`}>Pôvod produktu</span>
                  <span className={`text-[11px] font-bold ${formData.isHomemade ? 'text-amber-800 dark:text-amber-400' : 'text-slate-500'}`}>Vlastná / Lokálna výroba</span>
                </div>
                <div className={`w-10 h-6 rounded-full relative transition-colors ${formData.isHomemade ? 'bg-amber-500' : 'bg-slate-200 dark:bg-slate-700'}`}>
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${formData.isHomemade ? 'left-5' : 'left-1'}`}></div>
                </div>
              </div>

              {/* Hlavné tlačidlo */}
              <div className="pt-2">
                <button type="submit" disabled={isAiProcessing} className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-400 text-white font-black rounded-2xl shadow-xl transition-all uppercase tracking-widest text-[11px] active:scale-95">
                  {isAiProcessing ? 'Spracúvam údaje...' : (editingItem ? 'Uložiť zmeny' : 'Uložiť do systému')}
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
