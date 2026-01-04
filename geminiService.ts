
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

export async function parseSmartEntry(input: string, existingCategories: Category[]) {
  const barcode = input.trim();
  const isBarcode = /^\d+$/.test(barcode);
  const categoriesList = existingCategories.map(c => c.name).join(", ");
  
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const searchPrompt = isBarcode 
    ? `Identifikuj produkt pre EAN: ${barcode}. 
       Zameraj sa na SLOVENSKÝ trh (napr. Snico, Relax, Sedita).
       
       ÚLOHY:
       1. Nájdi presný názov (Značka + Typ).
       2. Nájdi HMOTNOSŤ/OBJEM v gramoch alebo mililitroch (napr. 350, 500, 1000).
       3. Vyber kategóriu z: [${categoriesList}]. 
          POZOR: Horčica, kečup, dresing patria do "Omáčky & Prísady". Džús do "Nápoje".
       
       Vráť JSON:
       {
         "name": "Presný názov",
         "quantity": číslo (len hodnota, napr. 350),
         "unit": "g" alebo "ml" alebo "ks",
         "categoryName": "názov kategórie"
       }`
    : `Analyzuj text: "${input}". Vyber kategóriu z [${categoriesList}]. Vráť JSON.`;

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
      contents: `Mám v špajzi: ${stockInfo}. Navrhni 3 krátke slovenské recepty.`,
    });
    return response.text ?? null;
  } catch (e) { return "Chyba."; }
}
