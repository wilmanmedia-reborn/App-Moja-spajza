
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
    const response = await fetch(`https://world.openfoodfacts.org/api/v2/product/${barcode}.json?fields=product_name,brands,quantity,product_name_sk,product_name_cs,product_name_en,net_weight_unit,net_weight_value`);
    const data = await response.json();
    
    if (data.status === 1 && data.product) {
      const p = data.product;
      const name = p.product_name_sk || p.product_name_cs || p.product_name || p.product_name_en || "";
      const brand = p.brands ? p.brands.split(',')[0] : "";
      const fullName = brand && !name.toLowerCase().includes(brand.toLowerCase()) ? `${brand} ${name}` : name;
      
      let quantity = 1;
      let unit = 'ks';
      
      // Pokročilejšia extrakcia gramáže
      const weightStr = p.quantity || "";
      const match = weightStr.match(/(\d+(?:[\.,]\d+)?)\s*([a-zA-Z]+)/);
      if (match) {
        quantity = parseFloat(match[1].replace(',', '.'));
        const u = match[2].toLowerCase();
        if (['g', 'kg', 'ml', 'l'].includes(u)) unit = u;
      } else if (p.net_weight_value) {
        quantity = parseFloat(p.net_weight_value);
        unit = p.net_weight_unit?.toLowerCase() || 'g';
      }

      return {
        name: fullName.trim(),
        quantity: quantity,
        unit: unit
      };
    }
    return null;
  } catch (e) {
    return null;
  }
}

export async function parseSmartEntry(input: string, existingCategories: Category[]) {
  const isBarcode = /^\d{8,14}$/.test(input.trim());
  const categoriesList = existingCategories.map(c => c.name).join(", ");
  
  // 1. Priorita: Rýchla databáza
  if (isBarcode) {
    const directResult = await fetchFromOpenFoodFacts(input.trim());
    if (directResult && directResult.name) {
      const apiKey = (process.env as any).API_KEY;
      const ai = new GoogleGenAI({ apiKey });
      try {
        const catResponse = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: `Urči kategóriu zo zoznamu [${categoriesList}] pre: "${directResult.name}". Vráť IBA názov kategórie.`,
          config: { thinkingConfig: { thinkingBudget: 0 } }
        });
        return { ...directResult, categoryName: catResponse.text.trim() };
      } catch (e) {
        return { ...directResult, categoryName: existingCategories[0].name };
      }
    }
  }

  // 2. Priorita: Google Search fallback (pre Relax, Pfanner a iné, čo nie sú v OFF)
  const apiKey = (process.env as any).API_KEY;
  const ai = new GoogleGenAI({ apiKey });
  
  const prompt = isBarcode 
    ? `HĽADAJ NA WEBE PRODUKT PODĽA EAN: ${input.trim()}.
       Zameraj sa na slovenské a české e-shopy s potravinami (Tesco, Potraviny Domov, Kosik).
       Potrebujem presný názov (značka + typ) a balenie (napr. 1l, 250g).
       Ak nič nenájdeš, skús odhadnúť podľa predvoľby (858=SK, 859=CZ).
       Kategória zo zoznamu: [${categoriesList}].
       Odpovedaj JSONom v slovenčine.`
    : `Analyzuj text: "${input}". Vráť JSON (name, quantity, unit, categoryName).`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
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
    
    return safeJsonParse(response.text);
  } catch (error) {
    console.error("Gemini Error:", error);
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

  const prompt = `Zoznam zásob: ${stockInfo}. Navrhni 3 bleskové recepty v slovenčine. Max 2 vety na recept. Reaguj štýlovo a chutne.`;

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
