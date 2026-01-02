
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

/**
 * Rýchla kontrola v OpenFoodFacts (funguje na globálne veci ako Nutella alebo Barilla)
 */
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
        quantity: parseFloat(p.net_weight_value) || 1,
        unit: p.net_weight_unit?.toLowerCase() || 'ks'
      };
    }
    return null;
  } catch (e) { return null; }
}

/**
 * HLAVNÁ ANALÝZA: Ak zlyhá OFF, nastupuje Google Search Grounding
 */
export async function parseSmartEntry(input: string, existingCategories: Category[]) {
  const barcode = input.trim();
  const isBarcode = /^\d+$/.test(barcode);
  const categoriesList = existingCategories.map(c => c.name).join(", ");
  
  // Identifikácia Lidl kódov (často 20xxxxxx alebo 405xxxxxx)
  const isLidlInternal = isBarcode && (barcode.startsWith('20') || (barcode.startsWith('405') && barcode.length <= 13));

  let initialData = null;
  if (isBarcode) {
    initialData = await fetchFromOpenFoodFacts(barcode);
    // Ak OFF našiel kvalitný názov, ktorý nie je len "Water", vrátime ho rýchlo
    if (initialData && initialData.name.length > 8 && !['voda', 'water', 'dzus', 'juice'].includes(initialData.name.toLowerCase())) {
       return { ...initialData, categoryName: existingCategories[0].name };
    }
  }

  // AGRESÍVNY DEEP SEARCH MÓD
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const searchPrompt = isBarcode 
    ? `SI EXPERT NA POTRAVINY V SR/ČR. Nájdi produkt pre EAN kód: ${barcode}.
       
       MIESTA NA HĽADANIE:
       1. Ak je to Lidl kód (Saguaro, Pilos, Freshona, Argus), hľadaj na lidl.sk alebo nakupujvlidli.sk.
       2. Inak hľadaj na: Tesco Potraviny Domov SK, Rohlik.cz, Kosik.sk, Potraviny Domov.
       3. Hľadaj aj v obrázkoch a katalógoch (napr. Relax džúsy, Pfanner, minerálky).
       
       POKYNY:
       - Musíš nájsť presný názov a gramáž (napr. "Relax Jablko 100% 1l").
       - Priraď kategóriu zo zoznamu: [${categoriesList}].
       - Ak na Google vidíš výsledok, NESMIEŠ vrátiť null.
       
       Vráť JSON:
       {
         "name": "Značka + Názov Produktu",
         "quantity": číslo,
         "unit": "g/kg/ml/l/ks",
         "categoryName": "jedna zo zoznamu"
       }`
    : `Identifikuj produkt z textu: "${input}". Vyber kategóriu z [${categoriesList}]. Vráť JSON.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: searchPrompt,
      config: {
        tools: isBarcode ? [{ googleSearch: {} }] : [],
        responseMimeType: "application/json",
        thinkingConfig: { thinkingBudget: 0 },
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
    
    const result = safeJsonParse(response.text);
    // Ak Deep Search našiel čokoľvek lepšie ako nič, berieme to
    if (result && result.name && result.name !== 'null' && result.name.length > 2) {
      return result;
    }
    
    // Ak Deep Search zlyhal, ale máme aspoň niečo z OFF
    return initialData;
  } catch (error) {
    console.error("Deep Search zlyhal:", error);
    return initialData;
  }
}

export async function getRecipeSuggestions(items: FoodItem[]): Promise<string | null> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const stockInfo = items.filter(i => (i.currentQuantity / i.totalQuantity) > 0.1).map(i => `${i.name} (${i.currentQuantity}${i.unit})`).join(", ");
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Mám v špajzi: ${stockInfo}. Navrhni 3 bleskové recepty po slovensky. Buď stručný a vtipný.`,
    });
    return response.text ?? null;
  } catch (e) { return "Nepodarilo sa uvariť recepty."; }
}
