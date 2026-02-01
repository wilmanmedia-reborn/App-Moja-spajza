
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

  // Reset pri otvorení
  useEffect(() => {
    if (isOpen) {
        setExpiryDate('');
    }
  }, [isOpen]);

  if (!isOpen || !item) return null;

  // Vypočítame, koľko "váži" jedno balenie.
  // Ak je to KS, je to 1. Ak je to napr. múka (kg), a quantityPerPack je 1kg, tak je to 1.
  // Ak je to 500g balenie, tak je to 500.
  const quantityToAdd = item.unit === Unit.KS ? 1 : (item.quantityPerPack || 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm(expiryDate || undefined, quantityToAdd);
  };

  const handleSkip = () => {
    onConfirm(undefined, quantityToAdd);
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 sm:p-6" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-200 flex flex-col">
        <div className="text-center mb-6">
            <h3 className="text-lg font-black text-slate-900 dark:text-white mb-1">Doplniť zásobu</h3>
            <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400 truncate px-4">{item.name}</p>
        </div>

        <form onSubmit={handleSubmit} className="w-full flex flex-col gap-5">
          
          {/* Info o pridávanom množstve (Statické) */}
          <div className="w-full py-3 px-4 bg-emerald-50 dark:bg-emerald-950/30 rounded-2xl border border-emerald-100 dark:border-emerald-800/50 text-center">
             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                Pridávate 1 balenie
             </p>
             <p className="text-2xl font-black text-emerald-700 dark:text-emerald-400">
                + {quantityToAdd} <span className="text-sm align-middle">{item.unit}</span>
             </p>
          </div>

          {/* Expirácia */}
          <div className="w-full space-y-2">
            <div className="flex items-center justify-center gap-2 mb-1">
                <span className="text-lg">📅</span>
                <label className="block text-[10px] font-black text-slate-900 dark:text-white uppercase tracking-widest">
                    Dátum expirácie
                </label>
            </div>
            
            <p className="text-[9px] text-slate-400 text-center px-4 mb-2 leading-tight">
                Zadajte dátum spotreby uvedený na obale tohto kusu.
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
              Bez dátumu
            </button>
            <button 
              type="submit"
              className="w-full py-4 bg-emerald-600 text-white font-black rounded-2xl shadow-lg shadow-emerald-600/20 uppercase tracking-widest text-[10px] active:scale-95 transition-all hover:bg-emerald-500"
            >
              Potvrdiť
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
