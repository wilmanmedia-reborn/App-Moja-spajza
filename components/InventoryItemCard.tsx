
import React from 'react';
import { FoodItem, Unit, Location, Category } from '../types';

interface Props {
  item: FoodItem;
  location?: Location;
  category?: Category;
  onUpdate: (id: string, updates: Partial<FoodItem>) => void;
  onDelete: (id: string) => void;
  onEdit: (item: FoodItem) => void;
  onAddToShoppingList: (item: FoodItem) => void;
}

export const InventoryItemCard: React.FC<Props> = ({ item, location, category, onUpdate, onDelete, onEdit, onAddToShoppingList }) => {
  const percentage = (item.currentQuantity / item.totalQuantity) * 100;
  const isOverstocked = item.currentQuantity > item.totalQuantity;
  const isStarted = item.currentQuantity < item.totalQuantity && item.currentQuantity > 0;
  const isRunningLow = percentage > 0 && percentage <= 25;
  const isEmpty = item.currentQuantity <= 0;
  
  const getStatusColor = () => {
    if (isOverstocked) return 'bg-blue-500'; 
    if (percentage <= 15) return 'bg-red-500';
    if (isRunningLow) return 'bg-amber-500';
    return 'bg-emerald-500';
  };

  const daysToExpiry = item.expiryDate 
    ? Math.ceil((new Date(item.expiryDate).getTime() - Date.now()) / (86400000))
    : null;

  const isUrgent = daysToExpiry !== null && daysToExpiry <= 7;
  const isExpiringSoon = daysToExpiry !== null && daysToExpiry <= 30;

  const packSize = item.quantityPerPack || item.totalQuantity || 1;
  const currentPacks = Math.ceil(item.currentQuantity / packSize);
  const totalPacks = Math.ceil(item.totalQuantity / packSize);

  const isSegmented = totalPacks > 0 && totalPacks <= 12;

  return (
    <div className={`bg-white dark:bg-slate-900 rounded-3xl shadow-sm border-2 transition-all duration-300 relative overflow-hidden flex flex-col group ${isUrgent ? 'border-red-500/50 dark:border-red-500/30' : isRunningLow ? 'border-amber-500/50 dark:border-amber-500/30 shadow-lg shadow-amber-500/5' : 'border-slate-100 dark:border-slate-800 hover:border-emerald-500/50 dark:hover:border-emerald-500/30'}`}>
      
      {/* Action floating buttons */}
      <div className="absolute top-4 left-4 z-10 flex gap-2">
        <button 
          onClick={(e) => {
            e.stopPropagation();
            onDelete(item.id);
          }}
          className="p-2.5 bg-red-50 dark:bg-red-950/30 text-red-500 dark:text-red-400 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500 hover:text-white dark:hover:bg-red-500 dark:hover:text-white active:scale-90"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
        <button 
          onClick={(e) => {
            e.stopPropagation();
            onEdit(item);
          }}
          className="p-2.5 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity hover:bg-slate-900 dark:hover:bg-white hover:text-white dark:hover:text-slate-900 active:scale-90"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
        </button>
      </div>

      {/* Dynamic Status Badges */}
      <div className="absolute top-0 right-0 z-10 flex flex-col items-end">
        {item.isHomemade && (
          <div className="bg-amber-500 text-white text-[8px] font-black px-3 py-1.5 rounded-bl-xl uppercase tracking-widest">
            domáce
          </div>
        )}
        {isRunningLow && (
          <div className="bg-amber-600 dark:bg-amber-500 text-white text-[8px] font-black px-3 py-1.5 rounded-bl-xl uppercase tracking-widest animate-pulse flex items-center gap-1">
            <span className="w-1.5 h-1.5 bg-white rounded-full"></span>
            dochádza
          </div>
        )}
        {isStarted && !isRunningLow && (
          <div className="bg-blue-500 text-white text-[8px] font-black px-3 py-1.5 rounded-bl-xl uppercase tracking-widest">
            načaté
          </div>
        )}
        {isEmpty && (
          <div className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[8px] font-black px-3 py-1.5 rounded-bl-xl uppercase tracking-widest">
            minuté
          </div>
        )}
      </div>
      
      <div className="p-7 flex flex-col h-full">
        <div className="text-center mt-6">
          <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2 truncate">
            {category?.icon} {category?.name.toLowerCase()}
          </p>
          
          <div className="h-14 flex items-center justify-center mb-1">
            <h3 className={`text-lg font-black leading-tight transition-colors line-clamp-2 px-2 overflow-hidden ${isEmpty ? 'text-slate-300 dark:text-slate-700' : 'text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400'}`}>
              {item.name}
            </h3>
          </div>

          <div className="h-10 flex flex-col justify-start">
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center justify-center gap-1.5 lowercase truncate">
              <span className="opacity-70">{location?.icon}</span>
              {location?.name.toLowerCase()}
            </p>
          </div>
        </div>

        {/* Quantity and Progress Section */}
        <div className="space-y-4 mt-4">
          <div className="flex justify-between items-end">
            <div className="flex flex-col">
              <span className={`text-4xl font-black leading-none transition-colors ${isEmpty ? 'text-slate-300' : isRunningLow ? 'text-amber-600' : 'text-slate-900 dark:text-slate-100'}`}>
                {currentPacks} 
                <span className="text-sm font-black text-slate-400 dark:text-slate-600 ml-1.5">ks</span>
              </span>
              <span className="text-[11px] font-bold text-slate-400 dark:text-slate-600 mt-2 lowercase">
                ostáva: {item.currentQuantity}{item.unit.toLowerCase()}
              </span>
            </div>
            <div className="text-right">
                <span className={`text-xs font-black uppercase tracking-widest block mb-1 ${percentage <= 25 ? 'text-amber-600' : 'text-slate-400'}`}>
                {Math.round(percentage)}%
                </span>
                {isRunningLow && <span className="text-[8px] font-black text-amber-500 uppercase tracking-tighter">kritická hladina</span>}
            </div>
          </div>

          <div className="flex gap-1 h-3.5 w-full">
            {isSegmented ? (
              Array.from({ length: totalPacks }).map((_, i) => (
                <div 
                  key={i}
                  className={`flex-1 rounded-full transition-all duration-500 ${i < currentPacks ? getStatusColor() : 'bg-slate-100 dark:bg-slate-800'}`}
                ></div>
              ))
            ) : (
              <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-full overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all duration-700 ease-out ${getStatusColor()}`}
                  style={{ width: `${Math.min(100, percentage)}%` }}
                ></div>
              </div>
            )}
          </div>
        </div>

        {/* Expiry Section */}
        <div className="mt-6 h-20">
          {item.expiryDate ? (
            <>
              <p className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2 ml-1">Spotrebujte do</p>
              <div className={`p-3.5 rounded-2xl flex items-center justify-between text-[11px] font-black uppercase tracking-wider ${isUrgent ? 'bg-red-500 text-white shadow-lg shadow-red-500/20' : isExpiringSoon ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' : 'bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400'}`}>
                <span className="flex items-center gap-2">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  {item.expiryDate}
                </span>
                <span>
                  {daysToExpiry !== null && (daysToExpiry < 0 ? 'expirované' : daysToExpiry === 0 ? 'dnes' : `${daysToExpiry}d`)}
                </span>
              </div>
            </>
          ) : (
            <div className="h-full flex flex-col justify-center items-center opacity-20 italic">
               <p className="text-[10px] font-bold text-slate-400">Bez dátumu expirácie</p>
            </div>
          )}
        </div>

        {/* Buttons Section */}
        <div className="mt-auto grid grid-cols-2 gap-3 pt-6">
          <button 
            onClick={() => {
              const step = packSize;
              onUpdate(item.id, { currentQuantity: Math.max(0, item.currentQuantity - step) });
            }}
            className="py-4 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-slate-100 dark:border-slate-700 transition-all flex flex-col items-center active:scale-95"
          >
            <span>odobral som</span>
            <span className="opacity-50 text-[9px] lowercase">-1 ks</span>
          </button>
          <button 
            onClick={() => {
              const step = packSize;
              onUpdate(item.id, { currentQuantity: item.currentQuantity + step });
            }}
            className="py-4 bg-emerald-50 dark:bg-emerald-950/30 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 text-emerald-700 dark:text-emerald-400 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-emerald-100 dark:border-emerald-800/50 transition-all flex flex-col items-center active:scale-95"
          >
            <span>doplnil som</span>
            <span className="opacity-50 text-[9px] lowercase">+1 ks</span>
          </button>
          
          <button 
            onClick={() => onAddToShoppingList(item)}
            className={`col-span-2 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-lg ${isRunningLow || isEmpty ? 'bg-amber-500 hover:bg-amber-400 text-white shadow-amber-500/20' : 'bg-slate-900 dark:bg-white text-white dark:text-slate-950 hover:bg-slate-800 dark:hover:bg-slate-100'}`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>
            {isRunningLow || isEmpty ? 'Rýchlo kúpiť' : 'dať na nákup'}
          </button>
        </div>
      </div>
    </div>
  );
};
