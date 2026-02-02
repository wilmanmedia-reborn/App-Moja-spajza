
export enum Unit {
  G = 'g',
  KG = 'kg',
  ML = 'ml',
  L = 'l',
  KS = 'ks'
}

export interface User {
  id: string;
  name: string;
  email: string;
  householdId: string;
  // Password neriešime v TS, rieši ho Firebase Auth
}

export interface HouseholdData {
  ownerId: string;
  locations: Location[];
  categories: Category[];
}

export interface Location {
  id: string;
  name: string;
  icon: string;
}

export interface Batch {
  id: string;
  quantity: number;
  expiryDate?: string; // Ak undefined, nemá expiráciu
  addedDate: number;
}

export interface FoodItem {
  id: string;
  name: string;
  category: string;
  locationId: string;
  currentQuantity: number;
  totalQuantity: number;
  unit: Unit;
  quantityPerPack?: number;
  expiryDate?: string; // Legacy field for backwards compatibility or nearest expiry
  batches?: Batch[]; // New field for managing multiple expiration dates
  isHomemade: boolean;
  lastUpdated: number;
  householdId: string; // Pre query filtrovanie
}

export interface ShoppingItem {
  id: string;
  name: string;
  quantity: number;
  unit: Unit;
  completed: boolean;
  sourceItemId?: string;
  householdId: string;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
}
