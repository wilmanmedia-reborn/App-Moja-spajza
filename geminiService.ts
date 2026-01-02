
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
 * 1. KROK: OpenFoodFacts (Blesková databáza pre globálne a privátne značky ako Lidl/Freshona)
 */
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
      
      const weightStr = p.quantity || "";
      const match = weightStr.match(/(\d+(?:[\.,]\d+)?)\s*([a-zA-Z]+)/);
      if (match) {
        quantity = parseFloat(match[1].replace(',', '.'));
        const u = match[2].toLowerCase();
        if (['g', 'kg', 'ml', 'l'].includes(u)) unit = u;
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

/**
 * 2. KROK: Google Search Grounding (Pre Relax, Pfanner a slovenské špecifiká)
 */
export async function parseSmartEntry(input: string, existingCategories: Category[]) {
  const isBarcode = /^\d{8,14}$/.test(input.trim());
  const categoriesList = existingCategories.map(c => c.name).join(", ");
  
  // Skúsime najprv OFF (zadarmo a rýchlo)
  if (isBarcode) {
    const offResult = await fetchFromOpenFoodFacts(input.trim());
    if (offResult && offResult.name) {
      // Máme dáta, len necháme AI priradiť kategóriu
      const apiKey = (process.env as any).API_KEY;
      const ai = new GoogleGenAI({ apiKey });
      try {
        const catResponse = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: `Priraď kategóriu [${categoriesList}] pre produkt: "${offResult.name}". Vráť len názov.`,
          config: { thinkingConfig: { thinkingBudget: 0 } }
        });
        return { ...offResult, categoryName: catResponse.text.trim() };
      } catch (e) {
        return { ...offResult, categoryName: existingCategories[0].name };
      }
    }
  }

  // Ak to nie je v OFF, použijeme Google Search Grounding
  const apiKey = (process.env as any).API_KEY;
  const ai = new GoogleGenAI({ apiKey });
  
  // Prísny prompt pre vyhľadávanie
  const searchPrompt = isBarcode 
    ? `VYHĽADAJ NA GOOGLI PRESNÉ INFORMÁCIE PRE EAN KÓD: ${input.trim()}.
       Zameraj sa na webe na slovenské e-shopy: potravinydomov.itesco.sk, kosik.sk, rohlik.cz, alebo lidl.sk.
       Zisti: Presný názov produktu, Značku a Hmotnosť/Objem balenia.
       DÔLEŽITÉ: Ak produkt na webe nenájdeš pod týmto EAN kódom, vráť v JSON "name": null. Nikdy si nič nevymýšľaj!
       Kategória: jedna zo zoznamu [${categoriesList}].
       Odpovedaj JSONom v slovenčine.`
    : `Analyzuj text: "${input}". Vráť JSON (name, quantity, unit, categoryName).`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: searchPrompt,
      config: {
        tools: isBarcode ? [{ googleSearch: {} }] : [], // AKTIVÁCIA GOOGLE SEARCH
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
    // Ak AI nenašlo produkt na Google, vrátime null, aby sme neklamali používateľa
    if (!result || !result.name || result.name.toLowerCase() === 'null') return null;
    return result;
  } catch (error) {
    console.error("Search Grounding Error:", error);
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
