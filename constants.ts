
import { Unit, Location, Category, FoodItem } from './types';

export const INITIAL_LOCATIONS: Location[] = [
  { id: 'l1', name: 'Špajza', icon: '🧺' },
  { id: 'l2', name: 'Pivnica', icon: '❄️' },
  { id: 'l3', name: 'Kuchyňa', icon: '🍳' },
  { id: 'l4', name: 'Sklad', icon: '📦' }
];

export const INITIAL_CATEGORIES: Category[] = [
  { id: 'c7', name: 'Omáčky & Prísady', icon: '🍯' },
  { id: 'c1', name: 'Cestoviny & Ryža', icon: '🍝' },
  { id: 'c8', name: 'Nápoje', icon: '🧃' },
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
  }
];
