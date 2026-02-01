
// @ts-nocheck
import { GoogleGenAI, Type } from "@google/genai";
import { FoodItem, Category } from "./types";

function safeJsonParse(text: string | undefined) {
  if (!text) return null;
  try {
    const cleanText = text.replace(/```json/gi, '').replace(/```/gi, '').trim();
    return JSON.parse(cleanText);
  } catch (e) {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      try { return JSON.parse(match[0]); } catch (innerE) { return null; }
    }
    return null;
  }
}

// Vylepšený parser hmotnosti
function parseQuantityFromText(text: string): { value: number, unit: string } | null {
  if (!text) return null;
  // Hľadáme vzory ako: 500g, 500 g, 0.5l, 0,5 l, 100ml...
  const regex = /(\d+[.,]?\d*)\s*(g|ml|kg|l|ks|kusov|pcs|gram|gramov|litrov)\b/i;
  const match = text.match(regex);
  
  if (match) {
    let val = parseFloat(match[1].replace(',', '.'));
    let rawUnit = match[2].toLowerCase();
    let unit = 'g';

    if (rawUnit.startsWith('kg')) {
        unit = 'kg';
    } else if (rawUnit === 'l' || rawUnit === 'litrov') {
        unit = 'l';
    } else if (rawUnit === 'ml') {
        unit = 'ml';
    } else if (rawUnit.startsWith('p') || rawUnit.startsWith('kus') || rawUnit === 'ks') {
        unit = 'ks';
    }
    
    // Sanity check - ak nájde 0, ignoruj
    if (val <= 0) return null;

    return { value: val, unit };
  }
  return null;
}

async function fetchFromOpenFoodFacts(barcode: string) {
  try {
    const response = await fetch(`https://world.openfoodfacts.org/api/v2/product/${barcode}.json?fields=product_name,product_name_sk,product_name_cs,product_name_en,quantity,brands,net_weight_value,net_weight_unit,categories_tags`);
    const data = await response.json();
    
    if (data.status === 1 && data.product) {
      const p = data.product;
      
      // Hľadáme najlepší dostupný názov
      const name = p.product_name_sk || p.product_name_cs || p.product_name || p.product_name_en || "";
      const brand = p.brands ? p.brands.split(',')[0].trim() : "";
      
      return {
        name: name,
        brand: brand,
        quantityStr: p.quantity || "", 
        netWeight: p.net_weight_value,
        netUnit: p.net_weight_unit,
        categories: p.categories_tags || []
      };
    }
    return null;
  } catch (e) { return null; }
}

export async function parseSmartEntry(input: string, existingCategories: Category[]) {
  const barcode = input.trim();
  const isBarcode = /^\d+$/.test(barcode);
  const categoriesList = existingCategories.map(c => c.name).join(", ");
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  // 1. SCENÁR: EAN Kód - PRIORITY: DATABÁZA (AI len na kategóriu)
  if (isBarcode) {
    const fastData = await fetchFromOpenFoodFacts(barcode);
    
    if (fastData) {
        // --- 1. Zostavenie názvu (Bez AI) ---
        // Ak máme názov, použijeme ho. Ak máme aj značku a nie je v názve, pridáme ju.
        let finalName = fastData.name;
        
        // Ak je názov prázdny, skúsime aspoň značku
        if (!finalName && fastData.brand) {
            finalName = fastData.brand;
        } else if (!finalName) {
            finalName = "Neznámy produkt";
        } else {
            // Formátovanie: Ak názov neobsahuje značku, môžeme ju skúsiť doplniť, 
            // ale user chcel "Kečup", nie "Gurmán Kečup". 
            // OFF väčšinou vracia celý názov "Gurmán Kečup jemný".
            // Necháme to tak, ako to je v DB, je to najpresnejšie.
        }

        // --- 2. Získanie hmotnosti (Bez AI halucinácií) ---
        let finalQuantity = 0;
        let finalUnit = 'g';

        // A) Priamo z DB poľa net_weight
        if (fastData.netWeight) {
            finalQuantity = parseFloat(fastData.netWeight);
            finalUnit = fastData.netUnit ? fastData.netUnit.toLowerCase() : 'g';
            // Normalizácia jednotiek z OFF
            if (finalUnit === 'gram') finalUnit = 'g';
            if (finalUnit === 'kilogram') finalUnit = 'kg';
            if (finalUnit === 'liter') finalUnit = 'l';
            if (finalUnit === 'milliliter') finalUnit = 'ml';
        } 
        
        // B) Ak A zlyhalo, Regex na "quantity" string (napr. "500 g e")
        if (finalQuantity === 0) {
            const parsed = parseQuantityFromText(fastData.quantityStr);
            if (parsed) {
                finalQuantity = parsed.value;
                finalUnit = parsed.unit;
            }
        }

        // C) Ak B zlyhalo, Regex na Názov (napr. "Mlieko 1L")
        if (finalQuantity === 0) {
            const parsedName = parseQuantityFromText(finalName);
            if (parsedName) {
                finalQuantity = parsedName.value;
                finalUnit = parsedName.unit;
            }
        }

        // --- 3. Kategória (Tu použijeme AI, lebo to vie dobre odhadnúť) ---
        let categoryName = "";
        try {
            const prompt = `Zoraď produkt "${finalName}" (tags: ${fastData.categories.slice(0,5).join(',')}) do jednej z kategórií: [${categoriesList}]. Vráť JSON {"categoryName": "..."}`;
            const response = await ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: prompt,
                config: { responseMimeType: "application/json" }
            });
            const resJson = safeJsonParse(response.text);
            if (resJson && resJson.categoryName) categoryName = resJson.categoryName;
        } catch (e) {
            console.log("AI Category failed");
        }

        return {
            name: finalName,
            quantity: finalQuantity, // Ak 0, user si doplní
            unit: finalUnit,
            categoryName: categoryName,
            expiryDate: "" // Vždy prázdne, user si doplní
        };
    }
  }
  
  // 2. SCENÁR: Fulltext vyhľadávanie (napr. "Mlieko 1l") - tu musí ísť AI
  try {
    const searchPrompt = `Analyzuj text: "${input}". 
    Vráť JSON: 
    {
      "name": "Názov produktu (bez hmotnosti)", 
      "quantity": číslo, 
      "unit": "g/kg/ml/l/ks", 
      "categoryName": "jedna z [${categoriesList}]"
    }`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: searchPrompt,
      config: { responseMimeType: "application/json" }
    });
    
    return safeJsonParse(response.text);

  } catch (error) {
    return null;
  }
}

export async function getRecipeSuggestions(items: FoodItem[]): Promise<string | null> {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const stockInfo = items.filter(i => (i.currentQuantity / i.totalQuantity) > 0.1).map(i => `${i.name}`).join(", ");
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Mám v špajzi: ${stockInfo}. Navrhni 3 bleskové slovenské recepty.`,
    });
    return response.text ?? null;
  } catch (e) { return "Funkcia receptov momentálne nie je dostupná."; }
}
