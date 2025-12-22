
import { Unit, Location, Category, FoodItem } from './types';

export const INITIAL_LOCATIONS: Location[] = [
  { id: 'l1', name: 'Špajza', icon: '🧺' },
  { id: 'l2', name: 'Pivnica', icon: '❄️' },
  { id: 'l3', name: 'Kuchynská linka', icon: '🍳' },
  { id: 'l4', name: 'Sklad v garáži', icon: '📦' }
];

export const INITIAL_CATEGORIES: Category[] = [
  { id: 'c1', name: 'Cestoviny & Ryža', icon: '🍝' },
  { id: 'c2', name: 'Konzervy', icon: '🥫' },
  { id: 'c3', name: 'Pečenie', icon: '🍰' },
  { id: 'c4', name: 'Strukoviny', icon: '🫘' },
  { id: 'c5', name: 'Sladkosti & Slané', icon: '🍪' },
  { id: 'c6', name: 'Domáce / Vlastné', icon: '🏠' }
];

export const MOCK_ITEMS: FoodItem[] = [
  {
    id: '1',
    name: 'Penne Rigate (Tesco)',
    category: 'c1',
    locationId: 'l1',
    currentQuantity: 500,
    totalQuantity: 500,
    unit: Unit.G,
    quantityPerPack: 500,
    expiryDate: '2025-12-31',
    isHomemade: false,
    lastUpdated: Date.now(),
    householdId: 'MOCK_HOUSEHOLD'
  },
  {
    id: '2',
    name: 'Paradajkový pretlak',
    category: 'c2',
    locationId: 'l1',
    currentQuantity: 2,
    totalQuantity: 3,
    unit: Unit.KS,
    quantityPerPack: 1,
    expiryDate: '2026-06-15',
    isHomemade: false,
    lastUpdated: Date.now(),
    householdId: 'MOCK_HOUSEHOLD'
  },
  {
    id: '3',
    name: 'Domáci jahodový džem',
    category: 'c6',
    locationId: 'l2',
    currentQuantity: 250,
    totalQuantity: 400,
    unit: Unit.ML,
    quantityPerPack: 400,
    expiryDate: '2025-09-01',
    isHomemade: true,
    lastUpdated: Date.now(),
    householdId: 'MOCK_HOUSEHOLD'
  },
  {
    id: '4',
    name: 'Hladká múka 00',
    category: 'c3',
    locationId: 'l3',
    currentQuantity: 400,
    totalQuantity: 1000,
    unit: Unit.G,
    quantityPerPack: 1000,
    expiryDate: '2025-11-20',
    isHomemade: false,
    lastUpdated: Date.now(),
    householdId: 'MOCK_HOUSEHOLD'
  }
];
