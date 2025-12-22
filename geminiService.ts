
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
    // Skúsime nájsť JSON blok pomocou regexu ak zlyhalo priame čistenie
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
  
  // Pre EAN kódy používame Pro model s Google Search pre maximálnu presnosť
  const modelName = isBarcode ? 'gemini-3-pro-preview' : 'gemini-3-flash-preview';

  const prompt = isBarcode 
    ? `Hľadaj v Google: Aký konkrétny potravinový produkt má EAN kód "${input.trim()}"? 
       Vráť JSON v slovenčine s poliami: name (celý názov), quantity (číslo), unit (g, ml, ks, l), categoryName (vyber z [${categoriesList}] alebo navrhni novú), isHomemade: false.`
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

export async function analyzeProductImage(base64Image: string, existingCategories: Category[]) {
  const apiKey = (process.env as any).API_KEY;
  const ai = new GoogleGenAI({ apiKey });
  const categoriesList = existingCategories.map(c => c.name).join(", ");

  try {
    // Najprv skúsime len OCR na nájdenie čiarového kódu
    const ocrResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
          { text: "Ak vidíš na produkte čiarový kód (číslo EAN), napíš ho. Ak nie, napíš 'NONE'." },
        ],
      },
    });

    const detectedCode = ocrResponse.text?.trim().match(/\d{8,14}/)?.[0];
    if (detectedCode) {
      return await parseSmartEntry(detectedCode, existingCategories);
    }

    // Ak kód nenašlo, analyzujeme produkt vizuálne
    const visualResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [
            { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
            { text: `Identifikuj potravinu na fotke. Priraď kategóriu z: [${categoriesList}]. Vráť JSON.` }
          ],
        },
        config: {
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
    return safeJsonParse(visualResponse.text);
  } catch (error) {
    console.error("Image Analysis Error:", error);
    return null;
  }
}
