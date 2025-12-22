
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
  password?: string;
  householdId: string;
}

export interface Household {
  id: string;
  name: string;
  ownerId: string;
  members: string[]; // IDs of users
}

export interface Location {
  id: string;
  name: string;
  icon: string;
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
  expiryDate?: string;
  isHomemade: boolean;
  lastUpdated: number;
  householdId: string;
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
