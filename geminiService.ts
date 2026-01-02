
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
 * KROK 1: OpenFoodFacts (Globálna databáza)
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
 * KROK 2: DEEP SEARCH (Google Search Grounding pre lokálne SK/CZ značky)
 */
export async function parseSmartEntry(input: string, existingCategories: Category[]) {
  const barcode = input.trim();
  const isBarcode = /^\d+$/.test(barcode);
  const categoriesList = existingCategories.map(c => c.name).join(", ");
  
  // Detekcia Lidl kódov
  const isLidlCode = isBarcode && (barcode.startsWith('20') || barcode.startsWith('405') || barcode.length <= 8);

  // Skúsime najprv OFF (rýchle)
  let initialData = null;
  if (isBarcode) {
    initialData = await fetchFromOpenFoodFacts(barcode);
    // Ak OFF nájde presný názov (dlhší ako 10 znakov a nie je to len "Water")
    if (initialData && initialData.name.length > 10 && !['voda', 'water', 'dzus', 'juice'].includes(initialData.name.toLowerCase())) {
       const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
       try {
         const catRes = await ai.models.generateContent({
           model: 'gemini-3-flash-preview',
           contents: `Priraď kategóriu [${categoriesList}] k produktu: "${initialData.name}". Odpovedz len názvom kategórie.`,
         });
         return { ...initialData, categoryName: catRes.text.trim() };
       } catch (e) {}
    }
  }

  // AGRESÍVNY DEEP SEARCH: Gemini teraz MUSÍ použiť Google Search
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const searchPrompt = isBarcode 
    ? `SI POTRAVINOVÝ DETEKTÍV. Nájdi presné informácie pre EAN kód: ${barcode}.
       
       POKYNY PRE VYHĽADÁVANIE:
       1. Prehľadaj slovenské e-shopy: potravinydomov.itesco.sk, lidl.sk, nakupujvlidli.sk, rohlik.cz, kosik.sk, krajpotravin.sk.
       2. Ak je kód ${barcode} a je to ${isLidlCode ? 'Lidl značka (Saguaro, Pilos, Freshona)' : 'akýkoľvek produkt'}, extrahuj presný názov a gramáž.
       3. Príklad: Ak nájdeš "Relax Benefit Jablko 1l", vráť to ako názov.
       4. Príklad: Ak nájdeš "Saguaro jemne perlivá 1.5l", vráť to ako názov.
       
       Vráť JSON v slovenskom jazyku:
       {
         "name": "Značka + Celý Názov Produktu",
         "quantity": číslo (hmotnosť/objem),
         "unit": "g/kg/ml/l/ks",
         "categoryName": "jedna z týchto: [${categoriesList}]"
       }
       
       DÔLEŽITÉ: Ak na Google vidíš akúkoľvek relevatnú stránku s týmto kódom, použi ju. Nevracaj prázdny výsledok!`
    : `Identifikuj produkt a kategóriu z textu: "${input}". Vyber kategóriu z [${categoriesList}]. Vráť JSON.`;

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
    if (!result || !result.name || result.name === 'null' || result.name.length < 3) {
      if (initialData) return { ...initialData, categoryName: existingCategories[0].name };
      return null;
    }
    return result;
  } catch (error) {
    console.error("Deep Search Error:", error);
    if (initialData) return { ...initialData, categoryName: existingCategories[0].name };
    return null;
  }
}

export async function getRecipeSuggestions(items: FoodItem[]): Promise<string | null> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const stockInfo = items.filter(i => (i.currentQuantity / i.totalQuantity) > 0.1).map(i => `${i.name} (${i.currentQuantity}${i.unit})`).join(", ");
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Mám v špajzi: ${stockInfo}. Navrhni 3 bleskové recepty po slovensky. Buď stručný.`,
    });
    return response.text ?? null;
  } catch (e) { return "Skúste neskôr."; }
}
