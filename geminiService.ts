
// @ts-nocheck
import { GoogleGenAI, Type } from "@google/genai";
import { FoodItem, Category } from "./types";

function safeJsonParse(text: string | undefined) {
  if (!text) return null;
  try {
    const cleanText = text.replace(/```json/gi, '').replace(/```/gi, '').trim();
    return JSON.parse(cleanText);
  } catch (e) {
    console.error("JSON Parse Error. Original text:", text);
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      try { return JSON.parse(match[0]); } catch (innerE) { return null; }
    }
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

  const prompt = `Moje zásoby sú: ${stockInfo}. Na základe týchto trvanlivých potravín navrhni 3 rýchle a chutné recepty. Reaguj v slovenčine.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    return response.text ?? null;
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Nepodarilo sa získať recepty.";
  }
}

export async function parseSmartEntry(input: string, existingCategories: Category[]) {
  const apiKey = (process.env as any).API_KEY;
  const ai = new GoogleGenAI({ apiKey });
  const isBarcode = /^\d{8,14}$/.test(input.trim());
  
  const categoriesList = existingCategories.map(c => c.name).join(", ");
  
  const modelName = isBarcode ? 'gemini-3-pro-preview' : 'gemini-3-flash-preview';

  // Výrazne vylepšený prompt pre EAN kódy
  const prompt = isBarcode 
    ? `HĽADAJ V GOOGLE: Aký konkrétny potravinový produkt sa predáva v EÚ (najmä Slovensko/Česko) s EAN kódom "${input.trim()}"? 
       Prehľadaj katalógy ako Tesco Online, Billa, Lidl, PotravinyDomov.sk alebo EAN databázy.
       Nájdi: Celý názov, značku, gramáž (napr. 500g) alebo objem (napr. 1l).
       Vráť JSON v slovenčine:
       {
         "name": "Presný názov produktu so značkou a veľkosťou",
         "quantity": číslo vyjadrujúce veľkosť balenia,
         "unit": "g" alebo "ml" alebo "ks" alebo "l",
         "categoryName": "najvhodnejšia kategória zo zoznamu [${categoriesList}] alebo nová logická",
         "isHomemade": false
       }`
    : `Analyzuj text: "${input}". Extrahuj názov, množstvo, jednotku a kategóriu (zo zoznamu: [${categoriesList}]). Vráť JSON v slovenčine.`;

  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        tools: isBarcode ? [{ googleSearch: {} }] : [],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            quantity: { type: Type.NUMBER },
            unit: { type: Type.STRING },
            categoryName: { type: Type.STRING },
            isHomemade: { type: Type.BOOLEAN }
          },
          required: ["name", "quantity", "unit", "categoryName"]
        }
      }
    });
    return safeJsonParse(response.text);
  } catch (error) {
    console.error("Parse Error:", error);
    return null;
  }
}
