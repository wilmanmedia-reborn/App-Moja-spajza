
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
 * 1. KROK: OpenFoodFacts (Primárna databáza)
 */
async function fetchFromOpenFoodFacts(barcode: string) {
  try {
    const response = await fetch(`https://world.openfoodfacts.org/api/v2/product/${barcode}.json?fields=product_name,brands,quantity,product_name_sk,product_name_cs,product_name_en,net_weight_unit,net_weight_value,generic_name_sk`);
    const data = await response.json();
    
    if (data.status === 1 && data.product) {
      const p = data.product;
      const name = p.product_name_sk || p.generic_name_sk || p.product_name_cs || p.product_name || p.product_name_en || "";
      const brand = p.brands ? p.brands.split(',')[0] : "";
      const fullName = brand && !name.toLowerCase().includes(brand.toLowerCase()) ? `${brand} ${name}` : name;
      
      let quantity = 0;
      let unit = 'ks';
      
      const weightStr = p.quantity || "";
      const match = weightStr.match(/(\d+(?:[\.,]\d+)?)\s*([a-zA-Z]+)/);
      if (match) {
        quantity = parseFloat(match[1].replace(',', '.'));
        const u = match[2].toLowerCase();
        if (['g', 'kg', 'ml', 'l'].includes(u)) unit = u;
      }

      return {
        name: fullName.trim(),
        quantity: quantity || 1,
        unit: unit,
        source: 'OFF'
      };
    }
    return null;
  } catch (e) {
    return null;
  }
}

/**
 * HLAVNÁ FUNKCIA: Inteligentné rozpoznávanie
 */
export async function parseSmartEntry(input: string, existingCategories: Category[]) {
  const barcode = input.trim();
  const isBarcode = /^\d+$/.test(barcode);
  const isShortCode = isBarcode && barcode.length <= 8; // Typické pre Lidl / interné kódy
  const categoriesList = existingCategories.map(c => c.name).join(", ");
  
  // 1. Skúsime OFF
  if (isBarcode) {
    const offResult = await fetchFromOpenFoodFacts(barcode);
    if (offResult && offResult.name && offResult.name.length > 2) {
      const apiKey = (process.env as any).API_KEY;
      const ai = new GoogleGenAI({ apiKey });
      try {
        const catResponse = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: `Produkt: "${offResult.name}". Priraď mu najvhodnejšiu kategóriu zo zoznamu: [${categoriesList}]. Vráť iba názov kategórie.`,
          config: { thinkingConfig: { thinkingBudget: 0 } }
        });
        return { ...offResult, categoryName: catResponse.text.trim() };
      } catch (e) {
        return { ...offResult, categoryName: existingCategories[0].name };
      }
    }
  }

  // 2. Skúsime Google Search Grounding (Pre Pfanner, Relax a neúspešné kódy)
  const apiKey = (process.env as any).API_KEY;
  const ai = new GoogleGenAI({ apiKey });
  
  const searchPrompt = isBarcode 
    ? `HĽADAJ NA GOOGLI: EAN kód "${barcode}" ${isShortCode ? 'Lidl produkt' : 'potraviny slovensko'}.
       Prehľadaj stránky ako Tesco, Lidl, Rohlik, Kosik, Potraviny Domov.
       MUSÍŠ NÁJSŤ: Presný názov produktu a gramáž/objem.
       DÔLEŽITÉ: Ak nájdeš akúkoľvek zmienku o produkte pod týmto kódom, použi ju. Nevracaj null, ak existuje zhoda na webe.
       Výstup v JSON (name, quantity, unit, categoryName). 
       Kategória musí byť jedna z: [${categoriesList}].`
    : `Analyzuj text: "${input}". Vráť JSON (name, quantity, unit, categoryName).`;

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
    if (!result || !result.name || result.name.toLowerCase().includes('nenašlo') || result.name === 'null') {
      return null;
    }
    return result;
  } catch (error) {
    console.error("Critical Search Error:", error);
    return null;
  }
}

export async function getRecipeSuggestions(items: FoodItem[]): Promise<string | null> {
  const apiKey = (process.env as any).API_KEY;
  const ai = new GoogleGenAI({ apiKey });
  const stockInfo = items
    .filter(i => (i.currentQuantity / i.totalQuantity) > 0.1)
    .map(i => `${i.name} (${i.currentQuantity}${i.unit})`)
    .join(", ");

  const prompt = `Zoznam zásob: ${stockInfo}. Navrhni 3 bleskové recepty v slovenčine. Reaguj štýlovo.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: { thinkingConfig: { thinkingBudget: 0 } }
    });
    return response.text ?? null;
  } catch (error) {
    return "Skúste neskôr.";
  }
}
