
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
 * KROK 1: Globálna databáza OpenFoodFacts (Nutella, Barilla, globálne značky)
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
 * KROK 2: UNIVERZÁLNY OMNI-SEARCH (Google Search Grounding)
 * Funguje na VŠETKY produkty (Saguaro, Relax, Maggi, Opavia, privátne značky všetkých reťazcov)
 */
export async function parseSmartEntry(input: string, existingCategories: Category[]) {
  const barcode = input.trim();
  const isBarcode = /^\d+$/.test(barcode);
  const categoriesList = existingCategories.map(c => c.name).join(", ");
  
  let initialData = null;
  if (isBarcode) {
    initialData = await fetchFromOpenFoodFacts(barcode);
    // Ak OFF nájde presný a dlhý názov, končíme (ušetríme AI tokeny)
    if (initialData && initialData.name.length > 12) {
       return { ...initialData, categoryName: existingCategories[0].name };
    }
  }

  // AGRESÍVNY OMNI-SEARCH MÓD (Gemini 3 Flash + Google Search)
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const searchPrompt = isBarcode 
    ? `SI ABSOLÚTNY EXPERT NA POTRAVINY A DROGÉRIU. Tvojou úlohou je identifikovať produkt pre kód: ${barcode}.
       
       POSTUP:
       1. Použi Google Search na nájdenie tohto EAN kódu.
       2. Prehľadaj weby: itesco.sk, kaufland.sk, billa.sk, lidl.sk, rohlik.cz, kosik.sk, krajpotravin.sk, drmax.sk, mojadm.sk.
       3. Nájdi presný názov, značku a balenie (napr. "Saguaro jemne perlivá 1.5l", "Relax 100% Jablko 1l", "Opavia Miňonky 50g").
       4. Priraď kategóriu zo zoznamu: [${categoriesList}].
       
       Vráť JSON:
       {
         "name": "Celý názov produktu so značkou a objemom",
         "quantity": číslo,
         "unit": "g/kg/ml/l/ks",
         "categoryName": "jedna zo zoznamu"
       }
       
       DÔLEŽITÉ: Ak nájdeš produkt na akomkoľvek webe, musíš ho vrátiť. Ak nevieš kategóriu, použi prvú zo zoznamu. Nevracaj null!`
    : `Analyzuj text a identifikuj produkt: "${input}". Vyber kategóriu z [${categoriesList}]. Vráť JSON.`;

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
    if (result && result.name && result.name !== 'null' && result.name.length > 2) {
      return result;
    }
    
    // Posledný pokus - vráť aspoň to, čo našiel OFF, ak Google zlyhal
    return initialData;
  } catch (error) {
    console.error("Omni-Search Failed:", error);
    return initialData;
  }
}

export async function getRecipeSuggestions(items: FoodItem[]): Promise<string | null> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const stockInfo = items.filter(i => (i.currentQuantity / i.totalQuantity) > 0.1).map(i => `${i.name} (${i.currentQuantity}${i.unit})`).join(", ");
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Mám v zásobách: ${stockInfo}. Navrhni 3 bleskové recepty po slovensky. Stručne.`,
    });
    return response.text ?? null;
  } catch (e) { return "Momentálne neviem navrhnúť recepty."; }
}
