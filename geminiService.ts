
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
 * 1. KROK: Rýchla kontrola OpenFoodFacts
 */
async function fetchFromOpenFoodFacts(barcode: string) {
  try {
    const response = await fetch(`https://world.openfoodfacts.org/api/v2/product/${barcode}.json?fields=product_name,brands,quantity,product_name_sk,product_name_cs,product_name_en,net_weight_unit,net_weight_value`);
    const data = await response.json();
    if (data.status === 1 && data.product) {
      const p = data.product;
      const name = p.product_name_sk || p.product_name_cs || p.product_name || p.product_name_en || "";
      const brand = p.brands ? p.brands.split(',')[0] : "";
      return {
        name: (brand && !name.includes(brand) ? `${brand} ${name}` : name).trim(),
        quantity: p.net_weight_value || 1,
        unit: p.net_weight_unit?.toLowerCase() || 'ks'
      };
    }
    return null;
  } catch (e) { return null; }
}

/**
 * HLAVNÁ LOGIKA: Agresívny Deep Search
 */
export async function parseSmartEntry(input: string, existingCategories: Category[]) {
  const barcode = input.trim();
  const isBarcode = /^\d+$/.test(barcode);
  const categoriesList = existingCategories.map(c => c.name).join(", ");
  
  let initialData = null;
  if (isBarcode) {
    initialData = await fetchFromOpenFoodFacts(barcode);
  }

  const ai = new GoogleGenAI({ apiKey: (process.env as any).API_KEY });
  
  // Tento prompt je navrhnutý tak, aby Gemini "nasilu" našiel informáciu na webe
  const searchPrompt = isBarcode 
    ? `VYHĽADAJ PRODUKT PRE EAN: ${barcode}. 
       Hľadaj na Google, Lidl.sk, Tesco.sk, Rohlik.cz, Kosik.sk.
       
       MOJE TIPY PRE TEBA:
       - Ak kód začína 4056489, je to pravdepodobne minerálka SAGUARO z Lidlu.
       - Ak kód začína 859, hľadaj české/slovenské produkty (Relax, Pfanner, Sedita).
       - Ak kód začína 2016, hľadaj privátne značky Lidlu (napr. Fazuľa, Pilos).
       
       ÚLOHA:
       Zisti názov produktu, značku a objem/hmotnosť. 
       MUSÍŠ vrátiť JSON aj keby si si mal byť istý len na 70%. Nevracaj "null".
       Kategóriu vyber z: [${categoriesList}].
       
       FORMÁT: {"name": "Značka a názov", "quantity": číslo, "unit": "g/kg/ml/l/ks", "categoryName": "..."}`
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
    
    // Ak Gemini zlyhá úplne (čo by nemal), skúsime použiť aspoň dáta z OFF ak existujú
    if (!result || !result.name) {
      if (initialData) return { ...initialData, categoryName: existingCategories[0].name };
      return null;
    }
    
    return result;
  } catch (error) {
    console.error("Gemini Search Error:", error);
    if (initialData) return { ...initialData, categoryName: existingCategories[0].name };
    return null;
  }
}

export async function getRecipeSuggestions(items: FoodItem[]): Promise<string | null> {
  const ai = new GoogleGenAI({ apiKey: (process.env as any).API_KEY });
  const stockInfo = items.map(i => `${i.name} (${i.currentQuantity}${i.unit})`).join(", ");
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Mám v špajzi: ${stockInfo}. Navrhni 3 rýchle recepty po slovensky.`,
    });
    return response.text ?? null;
  } catch (e) { return "Skúste neskôr."; }
}
