
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
 * 1. KROK: Blesková databáza (OpenFoodFacts)
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
 * 2. KROK: Deep Search cez Google (pre Relax, Pfanner, Saguaro a pod.)
 */
export async function parseSmartEntry(input: string, existingCategories: Category[]) {
  const barcode = input.trim();
  const isBarcode = /^\d+$/.test(barcode);
  const categoriesList = existingCategories.map(c => c.name).join(", ");
  
  // Špecifická heuristika pre Lidl (často začínajú na 20 alebo 405)
  const isPossibleLidl = isBarcode && (barcode.startsWith('20') || barcode.startsWith('405') || barcode.length <= 8);

  // Vyskúšame OFF ako rýchly filter
  if (isBarcode) {
    const offResult = await fetchFromOpenFoodFacts(barcode);
    if (offResult && offResult.name && offResult.name.length > 5) {
      // Ak máme kvalitný výsledok z OFF, len mu priradíme kategóriu
      const ai = new GoogleGenAI({ apiKey: (process.env as any).API_KEY });
      try {
        const catRes = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: `Priraď kategóriu [${categoriesList}] k produktu: "${offResult.name}". Odpovedz len názvom kategórie.`,
        });
        return { ...offResult, categoryName: catRes.text.trim() };
      } catch (e) {
        return { ...offResult, categoryName: existingCategories[0].name };
      }
    }
  }

  // DEEP SEARCH MODE: Ak OFF zlyhá alebo je to neznámy kód (Relax/Saguaro)
  const ai = new GoogleGenAI({ apiKey: (process.env as any).API_KEY });
  
  const searchPrompt = isBarcode 
    ? `SI DETEKTÍV POTRAVÍN. Tvojou úlohou je nájsť produkt pre EAN kód: ${barcode}.
       ${isPossibleLidl ? 'Tento kód vyzerá ako produkt značky LIDL (Saguaro, Freshona, Pilos, Argus). Hľadaj primárne na lidl.sk alebo nakupujvlidli.sk.' : 'Hľadaj na slovenských e-shopoch: Tesco Potraviny, Kosik.sk, Rohlik.cz, Kraj, Potraviny Domov.'}
       POKYNY:
       1. Použi Google Search na zistenie presného názvu, značky a objemu/hmotnosti.
       2. Ak nájdeš akúkoľvek zmienku, extrahuj z nej údaje. 
       3. Priraď kategóriu zo zoznamu: [${categoriesList}].
       4. Vráť JSON: {"name": "Presný názov a značka", "quantity": číslo, "unit": "g/kg/ml/l/ks", "categoryName": "názov"}.
       DÔLEŽITÉ: Ak vidíš výsledok na Google, nesmieš vrátiť null. Ak je to Relax džús, napíš "Relax [Príchuť] 1l".`
    : `Analyzuj: "${input}". Vráť JSON s kategóriou z [${categoriesList}].`;

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
    // Posledná poistka pred zobrazením chyby
    if (!result || !result.name || result.name === 'null' || result.name.length < 3) return null;
    return result;
  } catch (error) {
    console.error("Deep Search Failure:", error);
    return null;
  }
}

export async function getRecipeSuggestions(items: FoodItem[]): Promise<string | null> {
  const ai = new GoogleGenAI({ apiKey: (process.env as any).API_KEY });
  const stockInfo = items
    .filter(i => (i.currentQuantity / i.totalQuantity) > 0.1)
    .map(i => `${i.name} (${i.currentQuantity}${i.unit})`)
    .join(", ");

  const prompt = `Zoznam zásob: ${stockInfo}. Navrhni 3 bleskové recepty v slovenčine. Buď stručný a inšpiratívny.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    return response.text ?? null;
  } catch (error) {
    return "Skúste neskôr.";
  }
}
