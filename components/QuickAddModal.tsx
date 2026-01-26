
import React, { useState } from 'react';
import { FoodItem } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (expiryDate: string | undefined) => void;
  item: FoodItem | null;
}

export const QuickAddModal: React.FC<Props> = ({ isOpen, onClose, onConfirm, item }) => {
  const [expiryDate, setExpiryDate] = useState('');

  if (!isOpen || !item) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm(expiryDate || undefined);
    setExpiryDate('');
  };

  const handleSkip = () => {
    onConfirm(undefined);
    setExpiryDate('');
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-200">
        <h3 className="text-lg font-black text-slate-900 dark:text-white mb-1">Pridať 1 kus</h3>
        <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400 mb-6 truncate">{item.name}</p>

        <form onSubmit={handleSubmit}>
          <div className="mb-6 space-y-2">
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Expirácia nového kusu</label>
            <input 
              type="date" 
              value={expiryDate}
              onChange={e => setExpiryDate(e.target.value)}
              className="w-full h-[60px] px-4 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white rounded-2xl outline-none font-bold text-[15px] border-2 border-transparent focus:border-emerald-500/30 text-center"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button 
              type="button" 
              onClick={handleSkip}
              className="py-4 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-black rounded-2xl uppercase tracking-widest text-[10px] active:scale-95 transition-all"
            >
              Bez dátumu
            </button>
            <button 
              type="submit"
              className="py-4 bg-emerald-600 text-white font-black rounded-2xl shadow-lg shadow-emerald-600/20 uppercase tracking-widest text-[10px] active:scale-95 transition-all"
            >
              Potvrdiť
            </button>
          </div>
        </form>
        <button onClick={onClose} className="mt-4 w-full py-2 text-slate-400 text-xs font-bold uppercase tracking-widest">Zrušiť</button>
      </div>
    </div>
  );
};
