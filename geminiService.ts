
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

async function fetchFromOpenFoodFacts(barcode: string) {
  try {
    const response = await fetch(`https://world.openfoodfacts.org/api/v2/product/${barcode}.json?fields=product_name,brands,quantity,product_name_sk,product_name_cs,product_name_en,net_weight_unit,net_weight_value,generic_name_sk`);
    const data = await response.json();
    if (data.status === 1 && data.product) {
      const p = data.product;
      const name = p.product_name_sk || p.generic_name_sk || p.product_name_cs || p.product_name || p.product_name_en || "";
      const brand = p.brands ? p.brands.split(',')[0] : "";
      return {
        name: (brand && !name.toLowerCase().includes(brand.toLowerCase()) ? `${brand} ${name}` : name).trim(),
        quantity: parseFloat(p.net_weight_value) || 0,
        unit: p.net_weight_unit?.toLowerCase() || 'ks'
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
  
  const searchPrompt = isBarcode 
    ? `SI POTRAVINOVÝ DETEKTÍV. Identifikuj produkt pre EAN: ${barcode}.
       
       POKYNY:
       1. Nájdi presný názov (Značka + Typ). Príklad: "Snico Horčica plnotučná".
       2. Nájdi PRESNÚ HMOTNOSŤ/OBJEM. Príklad: ak je to Snico horčica, má 350g. Ak Relax, má 1l.
       3. PRIRAĎ SPRÁVNU KATEGÓRIU z tohto zoznamu: [${categoriesList}].
          - Horčica/Kečup/Koreniny patrí do "Omáčky & Prísady".
          - Džús/Voda patrí do "Nápoje".
       
       Vráť JSON:
       {
         "name": "Názov bez gramáže",
         "quantity": číslo (hmotnosť napr. 350),
         "unit": "g/kg/ml/l/ks",
         "categoryName": "presný názov kategórie zo zoznamu"
       }`
    : `Identifikuj produkt z textu: "${input}". Vyber kategóriu z [${categoriesList}]. Vráť JSON.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: searchPrompt,
      config: {
        tools: isBarcode ? [{ googleSearch: {} }] : [],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            quantity: { type: Type.NUMBER },
            unit: { type: Type.STRING },
            categoryName: { type: Type.STRING }
          },
          required: ["name", "quantity", "unit", "categoryName"]
        }
      }
    });
    
    return safeJsonParse(response.text);
  } catch (error) {
    return null;
  }
}

export async function getRecipeSuggestions(items: FoodItem[]): Promise<string | null> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const stockInfo = items.filter(i => (i.currentQuantity / i.totalQuantity) > 0.1).map(i => `${i.name} (${i.currentQuantity}${i.unit})`).join(", ");
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Mám v zásobách: ${stockInfo}. Navrhni 3 bleskové recepty po slovensky. Buď stručný.`,
    });
    return response.text ?? null;
  } catch (e) { return "Chyba pripojenia."; }
}
