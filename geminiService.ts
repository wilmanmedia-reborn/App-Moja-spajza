
import { GoogleGenAI, Type } from "@google/genai";
import { FoodItem, Category } from "./types";

/**
 * Pomocná funkcia na bezpečné parsovanie JSON z textu modelu.
 */
function safeJsonParse(text: string | undefined) {
  if (!text) return null;
  try {
    const cleanText = text.replace(/```json/gi, '').replace(/```/gi, '').trim();
    return JSON.parse(cleanText);
  } catch (e) {
    console.error("JSON Parse Error. Original text:", text);
    return null;
  }
}

/**
 * Funkcia na získanie receptov zo zásob.
 */
export async function getRecipeSuggestions(items: FoodItem[]): Promise<string | null> {
  // @ts-ignore - process.env je dostupný cez Vite define
  const apiKey = process.env.API_KEY;
  const ai = new GoogleGenAI({ apiKey });
  const stockInfo = items
    .filter(i => (i.currentQuantity / i.totalQuantity) > 0.1)
    .map(i => `${i.name} (${i.currentQuantity}${i.unit})`)
    .join(", ");

  const prompt = `Moje zásoby sú: ${stockInfo}. Na základe týchto trvanlivých potravín navrhni 3 rýchle a chutné recepty, ktoré by som mohol pripraviť. Reaguj v slovenčine.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        temperature: 0.7,
      }
    });
    return response.text ?? null;
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Prepáčte, nepodarilo sa získať nápady na recepty.";
  }
}

/**
 * Funkcia na spracovanie textu alebo EAN kódu.
 */
export async function parseSmartEntry(input: string, existingCategories: Category[]) {
  // @ts-ignore - process.env je dostupný cez Vite define
  const apiKey = process.env.API_KEY;
  const ai = new GoogleGenAI({ apiKey });
  const isBarcode = /^\d{8,14}$/.test(input.trim());
  
  const categoriesList = existingCategories.map(c => c.name).join(", ");
  
  const prompt = isBarcode 
    ? `Identifikuj presný názov a detaily potraviny podľa EAN kódu: "${input}". 
       Použi Google Search na zistenie názvu a veľkosti balenia. 
       Priraď k produktu najvhodnejšiu kategóriu zo zoznamu: [${categoriesList}]. 
       Ak žiadna nesedí, navrhni nový krátky názov kategórie. 
       Vráť JSON v slovenčine.`
    : `Analyzuj text o potravine: "${input}". Extrahuj názov, množstvo a jednotku. 
       Priraď k produktu najvhodnejšiu kategóriu zo zoznamu: [${categoriesList}]. 
       Vráť JSON v slovenčine.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
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

/**
 * Funkcia na analýzu fotky.
 */
export async function analyzeProductImage(base64Image: string, existingCategories: Category[]) {
  // @ts-ignore - process.env je dostupný cez Vite define
  const apiKey = process.env.API_KEY;
  const ai = new GoogleGenAI({ apiKey });
  const categoriesList = existingCategories.map(c => c.name).join(", ");

  try {
    const ocrResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
          { text: "Prečítaj EAN kód z obrázku. Ak nie je, napíš 'UNKNOWN'." },
        ],
      },
    });

    const detectedCode = ocrResponse.text?.trim() || "";
    if (/^\d{8,14}$/.test(detectedCode)) {
      return await parseSmartEntry(detectedCode, existingCategories);
    }

    const visualResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [
            { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
            { text: `Identifikuj produkt. Kategórie: [${categoriesList}]. Vráť JSON.` }
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
