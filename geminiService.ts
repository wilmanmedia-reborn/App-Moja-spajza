
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

function mapCategoryFromTags(tags: string[] = []): string | null {
  const t = tags.join(' ').toLowerCase();
  if (t.includes('pastas') || t.includes('rice') || t.includes('noodles')) return 'Cestoviny & Ryža';
  if (t.includes('sauces') || t.includes('condiments') || t.includes('spices') || t.includes('mustards') || t.includes('ketchup')) return 'Omáčky & Prísady';
  if (t.includes('beverages') || t.includes('drinks') || t.includes('juices') || t.includes('waters')) return 'Nápoje';
  if (t.includes('canned') || t.includes('tins')) return 'Konzervy';
  if (t.includes('legumes') || t.includes('beans') || t.includes('lentils')) return 'Strukoviny';
  if (t.includes('snacks') || t.includes('biscuits') || t.includes('chocolates') || t.includes('chips')) return 'Sladkosti & Slané';
  if (t.includes('flours') || t.includes('baking') || t.includes('sugars')) return 'Pečenie';
  return null;
}

async function fetchFromOpenFoodFacts(barcode: string) {
  try {
    const response = await fetch(`https://world.openfoodfacts.org/api/v2/product/${barcode}.json?fields=product_name,brands,quantity,product_name_sk,product_name_cs,product_name_en,net_weight_unit,net_weight_value,generic_name_sk,categories_tags`);
    const data = await response.json();
    if (data.status === 1 && data.product) {
      const p = data.product;
      const nameSk = p.product_name_sk || p.generic_name_sk || p.product_name_cs || p.product_name || p.product_name_en || "";
      const brand = p.brands ? p.brands.split(',')[0] : "";
      const fullName = (brand && !nameSk.toLowerCase().includes(brand.toLowerCase()) ? `${brand} ${nameSk}` : nameSk).trim();
      
      // Skúsime získať hmotnosť buď z metaúdajov alebo parsovaním textu (napr. "350 g")
      let weight = parseFloat(p.net_weight_value);
      if (isNaN(weight) || weight === 0) {
        const weightMatch = (p.quantity || fullName).match(/(\d+(?:[.,]\d+)?)\s*(g|ml|kg|l)/i);
        if (weightMatch) weight = parseFloat(weightMatch[1].replace(',', '.'));
      }

      return {
        name: fullName,
        quantity: weight || 0,
        unit: p.net_weight_unit?.toLowerCase() || 'g',
        categoriesTags: p.categories_tags || []
      };
    }
    return null;
  } catch (e) { return null; }
}

export async function parseSmartEntry(input: string, existingCategories: Category[]) {
  const barcode = input.trim();
  const isBarcode = /^\d+$/.test(barcode);
  const categoriesList = existingCategories.map(c => c.name).join(", ");

  if (isBarcode) {
    const fastData = await fetchFromOpenFoodFacts(barcode);
    if (fastData && fastData.name.length > 3) {
      try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const catResponse = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: `Produkt: "${fastData.name}". Priraď jednu kategóriu zo zoznamu: [${categoriesList}]. Vráť iba názov kategórie.`,
        });
        return { ...fastData, categoryName: catResponse.text.trim() };
      } catch (aiError) {
        const mappedCat = mapCategoryFromTags(fastData.categoriesTags);
        return { ...fastData, categoryName: mappedCat || "" }; 
      }
    }
  }
  
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const searchPrompt = isBarcode 
      ? `Identifikuj produkt pre EAN: ${barcode}. Hľadaj názov, kategóriu z [${categoriesList}] a hmotnosť. Vráť JSON.`
      : `Identifikuj produkt: "${input}". Vyber kategóriu z [${categoriesList}]. Vráť JSON.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: searchPrompt,
      config: {
        tools: isBarcode ? [{ googleSearch: {} }] : [],
        responseMimeType: "application/json",
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
    console.error("AI Error:", error);
    return null;
  }
}

export async function getRecipeSuggestions(items: FoodItem[]): Promise<string | null> {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const stockInfo = items.filter(i => (i.currentQuantity / i.totalQuantity) > 0.1).map(i => `${i.name}`).join(", ");
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Mám v špajzi: ${stockInfo}. Navrhni 3 bleskové slovenské recepty.`,
    });
    return response.text ?? null;
  } catch (e) { return "Funkcia receptov momentálne nie je dostupná."; }
}
