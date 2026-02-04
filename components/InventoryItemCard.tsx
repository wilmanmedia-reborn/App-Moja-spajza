
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
  onQuickAdd: (item: FoodItem) => void;
  onConsume: (item: FoodItem) => void;
}

export const InventoryItemCard: React.FC<Props> = ({ item, location, category, onDelete, onEdit, onAddToShoppingList, onQuickAdd, onConsume }) => {
  const percentage = (item.currentQuantity / item.totalQuantity) * 100;
  const isOverstocked = item.currentQuantity > item.totalQuantity;
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

  const currentPacks = item.unit === Unit.KS 
    ? item.currentQuantity 
    : (item.batches?.length || 0);

  return (
    <div className={`bg-white dark:bg-slate-900 rounded-3xl shadow-sm border-2 transition-all duration-300 relative overflow-hidden flex flex-col group ${isUrgent ? 'border-red-500/50 dark:border-red-500/30' : isRunningLow ? 'border-amber-500/50 dark:border-amber-500/30 shadow-lg shadow-amber-500/5' : 'border-slate-100 dark:border-slate-800 hover:border-emerald-500/50 dark:hover:border-emerald-500/30'}`}>
      
      {/* Action floating buttons (Visible on Hover/Tap) */}
      <div className="absolute top-3 right-3 z-20 flex gap-2">
         <button 
          onClick={(e) => {
            e.stopPropagation();
            onEdit(item);
          }}
          className="w-8 h-8 flex items-center justify-center bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-slate-200 dark:hover:bg-slate-700 active:scale-90"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
        </button>
        <button 
          onClick={(e) => {
            e.stopPropagation();
            onDelete(item.id);
          }}
          className="w-8 h-8 flex items-center justify-center bg-red-50 dark:bg-red-950/30 text-red-500 dark:text-red-400 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500 hover:text-white dark:hover:bg-red-500 dark:hover:text-white active:scale-90"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
        </button>
      </div>

      <div className="p-4 flex flex-col h-full gap-3">
        
        {/* Compact Header: Category + Location */}
        <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
           <span className="flex items-center gap-1 truncate max-w-[50%]">
              {category?.icon} {category?.name}
           </span>
           <span className="flex items-center gap-1 truncate max-w-[40%] justify-end">
              {location?.icon} {location?.name}
           </span>
        </div>
        
        {/* Badges - Inline */}
        <div className="flex flex-wrap gap-2 min-h-[20px]">
           {item.isHomemade && (
             <span className="bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 text-[8px] font-black uppercase px-2 py-0.5 rounded-md">domáce</span>
           )}
           {isRunningLow && (
             <span className="bg-amber-500 text-white text-[8px] font-black uppercase px-2 py-0.5 rounded-md animate-pulse">dochádza</span>
           )}
           {isEmpty && (
             <span className="bg-slate-900 text-white text-[8px] font-black uppercase px-2 py-0.5 rounded-md">minuté</span>
           )}
           {item.expiryDate && (
             <span className={`flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-md ${isUrgent ? 'bg-red-100 text-red-600' : 'bg-slate-50 dark:bg-slate-800 text-slate-400'}`}>
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                {daysToExpiry !== null && (daysToExpiry < 0 ? 'Expirované' : `${daysToExpiry}d`)}
             </span>
           )}
        </div>

        {/* Product Name - Compact */}
        <div className="flex items-center min-h-[40px]">
          <h3 className={`text-sm font-black leading-tight line-clamp-2 ${isEmpty ? 'text-slate-300 dark:text-slate-700' : 'text-slate-900 dark:text-white'}`}>
            {item.name}
          </h3>
        </div>

        {/* Quantity and Progress - Compact */}
        <div className="mt-auto">
          <div className="flex items-baseline justify-between mb-1.5">
            <span className={`text-2xl font-black ${isEmpty ? 'text-slate-300' : isRunningLow ? 'text-amber-600' : 'text-slate-900 dark:text-slate-100'}`}>
                {currentPacks} 
                <span className="text-xs text-slate-400 dark:text-slate-600 ml-1">ks</span>
            </span>
            <span className={`text-[10px] font-black uppercase tracking-wider ${percentage <= 25 ? 'text-amber-600' : 'text-slate-400'}`}>
                {Math.round(percentage)}%
            </span>
          </div>
          <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
            <div 
               className={`h-full rounded-full transition-all duration-700 ease-out ${getStatusColor()}`}
               style={{ width: `${Math.min(100, percentage)}%` }}
            ></div>
          </div>
        </div>

        {/* Single Row Actions */}
        <div className="grid grid-cols-3 gap-2 mt-2 pt-3 border-t border-slate-50 dark:border-slate-800/50">
           <button 
             onClick={() => onConsume(item)}
             className="h-10 bg-slate-50 dark:bg-slate-800 hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-400 hover:text-red-500 rounded-xl flex items-center justify-center transition-colors active:scale-95"
           >
             <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M20 12H4" /></svg>
           </button>
           
           <button 
             onClick={() => onQuickAdd(item)}
             className="h-10 bg-slate-50 dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 text-slate-400 hover:text-emerald-500 rounded-xl flex items-center justify-center transition-colors active:scale-95"
           >
             <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
           </button>

           <button 
             onClick={() => onAddToShoppingList(item)}
             className={`h-10 rounded-xl flex items-center justify-center transition-colors active:scale-95 shadow-sm ${isRunningLow || isEmpty ? 'bg-amber-500 text-white hover:bg-amber-600' : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'}`}
           >
             <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
           </button>
        </div>
      </div>
    </div>
  );
};
