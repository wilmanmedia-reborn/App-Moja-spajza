
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
 * Získa dáta o produkte z OpenFoodFacts API (sub-second rýchlosť)
 */
async function fetchFromOpenFoodFacts(barcode: string) {
  try {
    const response = await fetch(`https://world.openfoodfacts.org/api/v2/product/${barcode}.json?fields=product_name,brands,quantity,product_name_sk,product_name_cs`);
    const data = await response.json();
    
    if (data.status === 1 && data.product) {
      const p = data.product;
      const name = p.product_name_sk || p.product_name_cs || p.product_name || "";
      const brand = p.brands ? p.brands.split(',')[0] : "";
      const fullName = brand ? `${brand} ${name}` : name;
      
      // Pokúsime sa vytiahnuť gramáž z poľa quantity (napr "1 l", "400g")
      let quantity = 1;
      let unit = 'ks';
      
      if (p.quantity) {
        const match = p.quantity.match(/(\d+)\s*([a-zA-Z]+)/);
        if (match) {
          quantity = parseFloat(match[1]);
          const u = match[2].toLowerCase();
          if (['g', 'kg', 'ml', 'l'].includes(u)) unit = u;
        }
      }

      return {
        name: fullName.trim(),
        quantity: quantity,
        unit: unit,
        source: 'OFF'
      };
    }
    return null;
  } catch (e) {
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

  const prompt = `Zoznam zásob: ${stockInfo}. Navrhni 3 bleskové recepty v slovenčine. Max 2 vety na recept.`;

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

export async function parseSmartEntry(input: string, existingCategories: Category[]) {
  const isBarcode = /^\d{8,14}$/.test(input.trim());
  
  // 1. KROK: Ak ide o čiarový kód, skúsime najprv presnú databázu (Bypass Gemini)
  if (isBarcode) {
    const offData = await fetchFromOpenFoodFacts(input.trim());
    if (offData) {
      // Ak sme našli v DB, ešte pošleme Gemini kategóriu, aby to bolo inteligentné
      const apiKey = (process.env as any).API_KEY;
      const ai = new GoogleGenAI({ apiKey });
      const catList = existingCategories.map(c => c.name).join(", ");
      
      try {
        const catResponse = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: `Urči jednu kategóriu zo zoznamu [${catList}] pre produkt: "${offData.name}". Vráť iba názov kategórie.`,
          config: { thinkingConfig: { thinkingBudget: 0 } }
        });
        return { ...offData, categoryName: catResponse.text.trim() };
      } catch (e) {
        return { ...offData, categoryName: existingCategories[0].name };
      }
    }
  }

  // 2. KROK: Fallback na Gemini Flash, ak to nie je v DB alebo to nie je EAN
  const apiKey = (process.env as any).API_KEY;
  const ai = new GoogleGenAI({ apiKey });
  const categoriesList = existingCategories.map(c => c.name).join(", ");
  const modelName = 'gemini-3-flash-preview';

  const prompt = isBarcode 
    ? `EAN KÓD: ${input.trim()}
       Úloha: Identifikuj produkt. Ak kód nepoznáš, ODHADNI ho podľa predvoľby krajiny.
       Názov musí obsahovať značku. 
       Kategória zo zoznamu: [${categoriesList}].
       Odpovedaj výhradne JSONom v slovenčine.`
    : `Analyzuj text: "${input}". Vráť JSON (name, quantity, unit, categoryName).`;

  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
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
    return safeJsonParse(response.text);
  } catch (error) {
    console.error("Gemini Error:", error);
    return null;
  }
}
