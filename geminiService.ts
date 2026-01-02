
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
 * 1. KROK: Priame volanie databázy (najrýchlejšie a najpresnejšie)
 */
async function fetchFromOpenFoodFacts(barcode: string) {
  try {
    // Skúsime globálnu databázu s preferenciou slovenských názvov
    const response = await fetch(`https://world.openfoodfacts.org/api/v2/product/${barcode}.json?fields=product_name,brands,quantity,product_name_sk,product_name_cs,product_name_en`);
    const data = await response.json();
    
    if (data.status === 1 && data.product) {
      const p = data.product;
      const name = p.product_name_sk || p.product_name_cs || p.product_name || p.product_name_en || "";
      const brand = p.brands ? p.brands.split(',')[0] : "";
      const fullName = brand && !name.includes(brand) ? `${brand} ${name}` : name;
      
      let quantity = 1;
      let unit = 'ks';
      
      if (p.quantity) {
        // Extrakcia napr. "1 l" -> 1, "l"
        const match = p.quantity.match(/(\d+(?:[\.,]\d+)?)\s*([a-zA-Z]+)/);
        if (match) {
          quantity = parseFloat(match[1].replace(',', '.'));
          const u = match[2].toLowerCase();
          if (['g', 'kg', 'ml', 'l'].includes(u)) unit = u;
        }
      }

      return {
        name: fullName.trim(),
        quantity: quantity,
        unit: unit,
        confidence: 1.0 // 100% istota z databázy
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
  
  // 1. Priorita: Databáza (Bleskové, žiadna AI)
  if (isBarcode) {
    const directResult = await fetchFromOpenFoodFacts(input.trim());
    if (directResult) {
      // Máme meno, len necháme AI bleskovo určiť kategóriu (to Flash nepokazí)
      const apiKey = (process.env as any).API_KEY;
      const ai = new GoogleGenAI({ apiKey });
      try {
        const catResponse = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: `Urči kategóriu zo zoznamu [${categoriesList}] pre: "${directResult.name}". Vráť iba názov kategórie.`,
          config: { thinkingConfig: { thinkingBudget: 0 } }
        });
        return { ...directResult, categoryName: catResponse.text.trim() };
      } catch (e) {
        return { ...directResult, categoryName: existingCategories[0].name };
      }
    }
  }

  // 2. Priorita: Ak to nie je v DB, použijeme Gemini ALE s Google Search, aby to bolo presné
  const apiKey = (process.env as any).API_KEY;
  const ai = new GoogleGenAI({ apiKey });
  
  const prompt = isBarcode 
    ? `VYHĽADAJ NA GOOGLI EAN KÓD: ${input.trim()}.
       Úloha: Zisti presný názov produktu a balenie.
       Dôležité: Ak produkt na webe nenájdeš, vráť v JSON "name": null. Nikdy si nevymýšľaj "Ryžu" ani nič iné.
       Kategória: jedna z [${categoriesList}].
       Odpovedaj JSONom.`
    : `Analyzuj text: "${input}". Vráť JSON (name, quantity, unit, categoryName).`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        tools: isBarcode ? [{ googleSearch: {} }] : [], // Search len pre EAN
        responseMimeType: "application/json",
        thinkingConfig: { thinkingBudget: 0 },
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING, nullable: true },
            quantity: { type: Type.NUMBER },
            unit: { type: Type.STRING },
            categoryName: { type: Type.STRING }
          },
          required: ["name", "quantity", "unit", "categoryName"]
        }
      }
    });
    
    const result = safeJsonParse(response.text);
    // Ak AI nič nenašlo na webe, radšej vrátime null ako blbosť
    if (result && !result.name) return null;
    return result;
  } catch (error) {
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
