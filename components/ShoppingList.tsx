
import React, { useState } from 'react';
import { ShoppingItem, Unit } from '../types';

interface Props {
  items: ShoppingItem[];
  onUpdate: (id: string, updates: Partial<ShoppingItem>) => void;
  onDelete: (id: string) => void;
  onAdd: (name: string) => void;
  onClearCompleted: () => void;
}

export const ShoppingList: React.FC<Props> = ({ items, onUpdate, onDelete, onAdd, onClearCompleted }) => {
  const [newItemName, setNewItemName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newItemName.trim()) {
      onAdd(newItemName.trim());
      setNewItemName('');
    }
  };

  const completedCount = items.filter(i => i.completed).length;

  return (
    <div className="max-w-2xl mx-auto px-2">
      <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden mb-6">
        <form onSubmit={handleSubmit} className="p-6 border-b border-slate-100 dark:border-slate-800 flex gap-3 bg-slate-50/50 dark:bg-slate-800/50">
          <input 
            type="text" 
            value={newItemName}
            onChange={(e) => setNewItemName(e.target.value)}
            placeholder="Potrebujeme kúpiť..."
            className="flex-1 bg-white dark:bg-slate-800 border-none rounded-2xl px-5 py-3 text-sm dark:text-white font-bold focus:ring-2 focus:ring-emerald-500 outline-none shadow-inner"
          />
          <button type="submit" className="bg-emerald-600 text-white p-3 rounded-2xl shadow-lg shadow-emerald-600/20 active:scale-90 transition-all">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 4v16m8-8H4" /></svg>
          </button>
        </form>

        <div className="divide-y divide-slate-50 dark:divide-slate-800">
          {items.length === 0 ? (
            <div className="p-16 text-center">
              <div className="text-6xl mb-6 grayscale opacity-50">🛒</div>
              <p className="text-slate-400 dark:text-slate-600 font-black uppercase tracking-widest text-xs">Váš nákupný zoznam je prázdny</p>
            </div>
          ) : (
            items.map(item => (
              <div key={item.id} className="p-5 flex items-center justify-between group hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                <div className="flex items-center gap-4">
                  <button 
                    onClick={() => onUpdate(item.id, { completed: !item.completed })}
                    className={`w-7 h-7 rounded-xl border-2 flex items-center justify-center transition-all ${item.completed ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'}`}
                  >
                    {item.completed && <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>}
                  </button>
                  <span className={`text-base font-bold transition-all ${item.completed ? 'line-through text-slate-400 dark:text-slate-600' : 'text-slate-800 dark:text-slate-200'}`}>
                    {item.name}
                  </span>
                </div>
                <button 
                  onClick={() => onDelete(item.id)}
                  className="p-3 text-slate-300 dark:text-slate-700 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
              </div>
            ))
          )}
        </div>

        {completedCount > 0 && (
          <div className="p-6 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center">
            <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">{completedCount} vybavené položky</span>
            <button 
              onClick={onClearCompleted}
              className="text-[10px] font-black text-red-500 hover:text-red-600 transition-colors uppercase tracking-widest"
            >
              Vymazať vybavené
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
