
import React, { useState } from 'react';
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

export const InventoryItemRow: React.FC<Props> = ({ item, location, category, onUpdate, onDelete, onEdit, onAddToShoppingList }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const percentage = (item.currentQuantity / item.totalQuantity) * 100;
  const packSize = item.quantityPerPack || item.totalQuantity || 1;
  const currentPacks = Math.ceil(item.currentQuantity / packSize);
  const isRunningLow = percentage > 0 && percentage <= 25;
  const isEmpty = item.currentQuantity <= 0;
  
  const getStatusColor = () => {
    if (item.currentQuantity > item.totalQuantity) return 'bg-blue-500'; 
    if (percentage <= 15) return 'bg-red-500';
    if (isRunningLow) return 'bg-amber-500';
    return 'bg-emerald-500';
  };

  const daysToExpiry = item.expiryDate 
    ? Math.ceil((new Date(item.expiryDate).getTime() - Date.now()) / (86400000))
    : null;

  return (
    <div className={`border-b border-slate-100 dark:border-slate-800 transition-all duration-300 flex flex-col ${isExpanded ? 'bg-slate-50 dark:bg-slate-800/80 shadow-inner' : 'bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/30'} ${isEmpty ? 'opacity-70' : ''}`}>
      
      {/* Main Row Content - Clickable to expand */}
      <div 
        className="flex items-center p-3 sm:p-5 gap-3 sm:gap-4 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {/* Category Icon with status ring */}
        <div className={`hidden sm:flex w-12 h-12 rounded-2xl items-center justify-center text-xl shrink-0 relative p-1 transition-colors ${isRunningLow ? 'bg-amber-500/10' : 'bg-slate-100 dark:bg-slate-800'}`}>
          <div className={`absolute inset-0 rounded-2xl border-2 ${isRunningLow ? 'border-amber-500 animate-pulse' : 'border-transparent'}`}></div>
          {category?.icon}
        </div>

        {/* Name & Location */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <h3 className={`font-black truncate text-sm sm:text-base transition-colors ${isRunningLow ? 'text-amber-700 dark:text-amber-400' : 'text-slate-900 dark:text-white'}`}>
              {item.name}
            </h3>
            {item.isHomemade && (
              <span className="bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-[8px] font-black uppercase px-2 py-0.5 rounded-md shrink-0">domáce</span>
            )}
            {isRunningLow && (
              <span className="bg-amber-500 text-white text-[8px] font-black uppercase px-2 py-0.5 rounded-md shrink-0">dochádza</span>
            )}
          </div>
          <div className="flex items-center gap-3 text-[10px] text-slate-400 dark:text-slate-500 font-black uppercase tracking-widest truncate">
            <span className="sm:hidden">{category?.icon}</span>
            <span className="flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              {location?.name}
            </span>
            {daysToExpiry !== null && (
              <span className={`px-2 py-0.5 rounded-full flex items-center gap-1 ${daysToExpiry <= 7 ? 'bg-red-500 text-white' : 'bg-slate-100 dark:bg-slate-800'}`}>
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                {daysToExpiry}d
              </span>
            )}
          </div>
        </div>

        {/* Progress & Quantity */}
        <div className="flex flex-col items-end gap-1.5 shrink-0 px-2 sm:px-4">
          <div className="flex items-center gap-2">
             <span className={`text-base sm:text-xl font-black ${percentage <= 25 ? 'text-amber-600' : 'text-slate-900 dark:text-white'}`}>
              {currentPacks} <span className="text-[10px] text-slate-400">ks</span>
            </span>
          </div>
          <div className="w-16 sm:w-28 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div 
              className={`h-full rounded-full transition-all duration-500 ${getStatusColor()}`}
              style={{ width: `${Math.min(100, percentage)}%` }}
            ></div>
          </div>
        </div>

        {/* Quick Actions - Always visible */}
        <div className="flex items-center gap-1.5 shrink-0 ml-1">
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onUpdate(item.id, { currentQuantity: Math.max(0, item.currentQuantity - packSize) });
            }}
            className="w-9 h-9 sm:w-11 sm:h-11 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-2xl flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 active:scale-90 transition-all border border-slate-200 dark:border-slate-700"
          >
            <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M20 12H4" /></svg>
          </button>
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onUpdate(item.id, { currentQuantity: item.currentQuantity + packSize });
            }}
            className="w-9 h-9 sm:w-11 sm:h-11 bg-emerald-100 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 rounded-2xl flex items-center justify-center hover:bg-emerald-200 dark:hover:bg-emerald-800 active:scale-90 transition-all border border-emerald-200 dark:border-emerald-800/50"
          >
            <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
          </button>
          
          <div className={`transition-transform duration-300 ml-1 ${isExpanded ? 'rotate-180' : 'rotate-0'}`}>
            <svg className="w-5 h-5 text-slate-300 dark:text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" /></svg>
          </div>
        </div>
      </div>

      {/* Expanded Actions Panel */}
      {isExpanded && (
        <div className="px-3 pb-3 sm:px-5 sm:pb-5 pt-0 grid grid-cols-3 gap-3 animate-in slide-in-from-top-2 duration-200">
          <button 
            onClick={(e) => { e.stopPropagation(); onEdit(item); }}
            className="py-3 bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600 active:scale-95 transition-all flex flex-col items-center gap-1 shadow-sm"
          >
            <svg className="w-5 h-5 mb-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
            Upraviť
          </button>
          
          <button 
            onClick={(e) => { e.stopPropagation(); onAddToShoppingList(item); }}
            className="py-3 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 rounded-xl text-[10px] font-black uppercase tracking-widest border border-emerald-200 dark:border-emerald-800/50 hover:bg-emerald-200 dark:hover:bg-emerald-800/60 active:scale-95 transition-all flex flex-col items-center gap-1 shadow-sm"
          >
            <svg className="w-5 h-5 mb-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>
            Na nákup
          </button>
          
          <button 
            onClick={(e) => { e.stopPropagation(); onDelete(item.id); }}
            className="py-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl text-[10px] font-black uppercase tracking-widest border border-red-100 dark:border-red-900/50 hover:bg-red-100 dark:hover:bg-red-900/40 active:scale-95 transition-all flex flex-col items-center gap-1 shadow-sm"
          >
            <svg className="w-5 h-5 mb-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            Vymazať
          </button>
        </div>
      )}
    </div>
  );
};
