
import React from 'react';
import { FoodItem, Batch } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (batchId: string | null) => void;
  item: FoodItem | null;
}

export const ConsumeItemModal: React.FC<Props> = ({ isOpen, onClose, onConfirm, item }) => {
  if (!isOpen || !item) return null;

  // Zoradenie: najstaršie expirácie prvé, null expirácie nakoniec
  const sortedBatches = [...(item.batches || [])].sort((a, b) => {
    if (!a.expiryDate) return 1;
    if (!b.expiryDate) return -1;
    return new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime();
  });

  // Ak položka nemá batches (legacy data) ale má quantity > 0
  const hasLegacyStock = (!item.batches || item.batches.length === 0) && item.currentQuantity > 0;

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 sm:p-6" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-200 flex flex-col max-h-[80vh]">
        <div className="text-center mb-6 shrink-0">
            <h3 className="text-lg font-black text-slate-900 dark:text-white mb-1">Odobrať 1 kus</h3>
            <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400 truncate px-4 mb-2">{item.name}</p>
            <p className="text-[10px] text-slate-400 uppercase tracking-widest">Zvoľte, ktorú šaržu ste spotrebovali</p>
        </div>

        <div className="flex-1 overflow-y-auto no-scrollbar space-y-3 mb-4">
            {sortedBatches.map((batch, index) => (
                <button
                    key={batch.id}
                    onClick={() => onConfirm(batch.id)}
                    className={`w-full p-4 rounded-2xl border-2 flex items-center justify-between transition-all active:scale-95 group text-left ${index === 0 ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-500 shadow-md' : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 hover:border-emerald-500/50'}`}
                >
                    <div>
                        <p className={`text-xs font-black uppercase tracking-wider mb-1 ${index === 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'}`}>
                            {batch.expiryDate ? batch.expiryDate : 'Bez dátumu'}
                        </p>
                        {index === 0 && <span className="text-[8px] bg-emerald-200 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200 px-2 py-0.5 rounded font-bold uppercase">Odporúčané (najstaršie)</span>}
                    </div>
                    <div className="text-right">
                        <span className="block text-xl font-black text-slate-900 dark:text-white">{batch.quantity} ks</span>
                    </div>
                </button>
            ))}

            {hasLegacyStock && (
                 <button
                    onClick={() => onConfirm(null)} // Null ID pre legacy stock
                    className="w-full p-4 rounded-2xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 flex items-center justify-between transition-all active:scale-95 hover:bg-slate-100"
                >
                    <div className="text-left">
                        <p className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                           Neznáma šarža
                        </p>
                        <span className="text-[8px] text-slate-400 uppercase">Pôvodné zásoby</span>
                    </div>
                    <div className="text-right">
                         <span className="block text-xl font-black text-slate-900 dark:text-white">{item.currentQuantity} ks</span>
                    </div>
                </button>
            )}
            
            {sortedBatches.length === 0 && !hasLegacyStock && (
                <div className="text-center py-8 text-slate-400 text-xs font-bold uppercase tracking-widest">
                    Žiadne kusy na odobranie
                </div>
            )}
        </div>
        
        <button onClick={onClose} className="shrink-0 w-full py-3 text-slate-400 text-xs font-bold uppercase tracking-widest hover:text-slate-600 dark:hover:text-slate-200 transition-colors bg-slate-100 dark:bg-slate-800 rounded-2xl">
            Zrušiť
        </button>
      </div>
    </div>
  );
};
