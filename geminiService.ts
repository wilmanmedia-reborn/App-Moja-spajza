
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
 * Rýchle vyhľadávanie v databáze OpenFoodFacts (zdarma a bleskové)
 */
async function fetchFromOpenFoodFacts(barcode: string) {
  try {
    const response = await fetch(`https://world.openfoodfacts.org/api/v2/product/${barcode}.json?fields=product_name,brands,quantity,product_name_sk,product_name_cs,product_name_en,net_weight_unit,net_weight_value,generic_name_sk`);
    const data = await response.json();
    if (data.status === 1 && data.product) {
      const p = data.product;
      const nameSk = p.product_name_sk || p.generic_name_sk || p.product_name_cs || p.product_name || p.product_name_en || "";
      const brand = p.brands ? p.brands.split(',')[0] : "";
      return {
        name: (brand && !nameSk.toLowerCase().includes(brand.toLowerCase()) ? `${brand} ${nameSk}` : nameSk).trim(),
        quantity: parseFloat(p.net_weight_value) || 0,
        unit: p.net_weight_unit?.toLowerCase() || 'g'
      };
    }
    return null;
  } catch (e) { return null; }
}

export async function parseSmartEntry(input: string, existingCategories: Category[]) {
  const barcode = input.trim();
  const isBarcode = /^\d+$/.test(barcode);
  const categoriesList = existingCategories.map(c => c.name).join(", ");

  // 1. KROK: Skúsime rýchlu databázu
  if (isBarcode) {
    const fastData = await fetchFromOpenFoodFacts(barcode);
    if (fastData && fastData.name.length > 3) {
      // Máme dáta z OFF, ale AI nám priradí správnu kategóriu
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const catResponse = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Produkt: "${fastData.name}". Priraď jednu kategóriu zo zoznamu: [${categoriesList}]. Vráť iba názov kategórie.`,
      });
      return { ...fastData, categoryName: catResponse.text.trim() };
    }
  }
  
  // 2. KROK: Ak sme nič nenašli, použijeme Google Search cez Gemini
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const searchPrompt = isBarcode 
    ? `Identifikuj slovenský/český produkt pre EAN: ${barcode}. 
       Hľadaj názov, kategóriu z [${categoriesList}] a hmotnosť/objem (napr. 350g). 
       Vráť JSON: {"name": string, "quantity": number, "unit": "g"|"ml"|"ks", "categoryName": string}`
    : `Identifikuj produkt: "${input}". Vyber kategóriu z [${categoriesList}]. Vráť JSON.`;

  try {
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
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const stockInfo = items.filter(i => (i.currentQuantity / i.totalQuantity) > 0.1).map(i => `${i.name}`).join(", ");
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Mám v špajzi: ${stockInfo}. Navrhni 3 bleskové slovenské recepty.`,
    });
    return response.text ?? null;
  } catch (e) { return "Chyba."; }
}
