
import React, { useState, useEffect } from 'react';
import { FoodItem, Unit } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (expiryDate: string | undefined, quantity: number) => void;
  item: FoodItem | null;
}

export const QuickAddModal: React.FC<Props> = ({ isOpen, onClose, onConfirm, item }) => {
  const [expiryDate, setExpiryDate] = useState('');
  const [quantity, setQuantity] = useState<number>(0);

  useEffect(() => {
    if (item && isOpen) {
        // Ak je to KS, predvolíme 1, inak predvolíme quantityPerPack (napr. 500g)
        const defaultQty = item.unit === Unit.KS ? 1 : (item.quantityPerPack || 0);
        setQuantity(defaultQty);
        setExpiryDate('');
    }
  }, [item, isOpen]);

  if (!isOpen || !item) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm(expiryDate || undefined, quantity);
  };

  const handleSkip = () => {
    onConfirm(undefined, quantity);
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 sm:p-6" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-200 flex flex-col">
        <div className="text-center mb-6">
            <h3 className="text-lg font-black text-slate-900 dark:text-white mb-1">Doplniť zásobu</h3>
            <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400 truncate px-4">{item.name}</p>
        </div>

        <form onSubmit={handleSubmit} className="w-full flex flex-col gap-5">
          
          {/* Hmotnosť / Množstvo */}
          <div className="w-full space-y-2">
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 text-center">
                {item.unit === Unit.KS ? 'Počet kusov' : `Obsah balenia (${item.unit})`}
            </label>
            <div className="relative flex items-center">
                 <button 
                    type="button"
                    onClick={() => setQuantity(Math.max(0, quantity - (item.unit === Unit.KS ? 1 : 10)))}
                    className="w-12 h-[50px] bg-slate-100 dark:bg-slate-800 rounded-l-2xl text-slate-500 font-bold hover:bg-slate-200 active:scale-95 transition-colors"
                 >-</button>
                 <input 
                    type="number" 
                    step="any"
                    value={quantity}
                    onChange={e => setQuantity(Number(e.target.value))}
                    className="flex-1 h-[50px] bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white outline-none font-black text-xl text-center border-y border-transparent focus:border-emerald-500/30 appearance-none z-10"
                 />
                 <button 
                    type="button"
                    onClick={() => setQuantity(quantity + (item.unit === Unit.KS ? 1 : 10))}
                    className="w-12 h-[50px] bg-slate-100 dark:bg-slate-800 rounded-r-2xl text-slate-500 font-bold hover:bg-slate-200 active:scale-95 transition-colors"
                 >+</button>
            </div>
          </div>

          {/* Expirácia */}
          <div className="w-full space-y-2">
            <div className="flex items-center justify-center gap-2 mb-1">
                <span className="text-lg">📅</span>
                <label className="block text-[10px] font-black text-slate-900 dark:text-white uppercase tracking-widest">
                    Dátum expirácie nového kusu
                </label>
            </div>
            
            <p className="text-[9px] text-slate-400 text-center px-4 mb-2 leading-tight">
                Zadajte dátum spotreby uvedený na obale tohto nového kusu.
            </p>

            <div className="relative">
                <input 
                  type="date" 
                  value={expiryDate}
                  onChange={e => setExpiryDate(e.target.value)}
                  className={`block w-full py-[19px] px-4 bg-slate-100 dark:bg-slate-800 rounded-2xl outline-none font-bold text-[15px] border-2 border-transparent focus:border-emerald-500/30 text-center shadow-sm appearance-none ${expiryDate ? 'text-slate-900 dark:text-white' : 'text-transparent empty-date'}`}
                  style={{ WebkitAppearance: 'none' }}
                />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 w-full mt-2">
            <button 
              type="button" 
              onClick={handleSkip}
              className="w-full py-4 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-black rounded-2xl uppercase tracking-widest text-[10px] active:scale-95 transition-all hover:bg-slate-200 dark:hover:bg-slate-700"
            >
              Bez expirácie
            </button>
            <button 
              type="submit"
              className="w-full py-4 bg-emerald-600 text-white font-black rounded-2xl shadow-lg shadow-emerald-600/20 uppercase tracking-widest text-[10px] active:scale-95 transition-all hover:bg-emerald-500"
            >
              Potvrdiť a pridať
            </button>
          </div>
        </form>
        
        <button onClick={onClose} className="mt-6 w-full py-2 text-slate-400 text-xs font-bold uppercase tracking-widest hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
            Zrušiť
        </button>
      </div>
    </div>
  );
};
