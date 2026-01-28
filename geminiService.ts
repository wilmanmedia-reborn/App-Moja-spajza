
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

// Rozšírené polia pre lepší kontext
async function fetchFromOpenFoodFacts(barcode: string) {
  try {
    const response = await fetch(`https://world.openfoodfacts.org/api/v2/product/${barcode}.json?fields=product_name,brands,quantity,product_name_sk,product_name_cs,product_name_en,generic_name_sk,generic_name_cs,generic_name,net_weight_value,net_weight_unit,categories_tags`);
    const data = await response.json();
    if (data.status === 1 && data.product) {
      const p = data.product;
      
      // Zbierame všetky možné názvy
      const possibleNames = [
        p.product_name_sk, 
        p.product_name_cs, 
        p.product_name, 
        p.product_name_en
      ].filter(Boolean);

      // Zbierame "všeobecné názvy" (napr. "Kečup jemný", "Horčica plnotučná")
      const possibleGenerics = [
        p.generic_name_sk,
        p.generic_name_cs,
        p.generic_name
      ].filter(Boolean);

      const name = possibleNames[0] || "";
      const generic = possibleGenerics[0] || "";
      const brand = p.brands ? p.brands.split(',')[0] : "";
      
      // Surové dáta pre AI
      return {
        rawName: name,
        rawGeneric: generic,
        brand: brand,
        quantityStr: p.quantity || "", // Napr "520 g"
        netWeight: p.net_weight_value, // Napr 520
        netUnit: p.net_weight_unit,    // Napr "g"
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
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  // 1. SCENÁR: Máme čiarový kód -> Získame dáta z OFF -> Pošleme AI na "upratanie"
  if (isBarcode) {
    const fastData = await fetchFromOpenFoodFacts(barcode);
    
    if (fastData) {
      try {
        // Vytvoríme prompt pre AI, aby skombinovala dáta do pekného názvu
        // Príklad: Brand="OTMA", Name="Gurmán", Generic="Kečup" -> "OTMA Gurmán Kečup"
        const prompt = `
          Mám produkt z databázy s týmito surovými dátami:
          - Značka: "${fastData.brand}"
          - Názov: "${fastData.rawName}"
          - Popis/Druh: "${fastData.rawGeneric}"
          - Množstvo text: "${fastData.quantityStr}"
          - Kategórie tagy: "${fastData.categoriesTags.slice(0, 5).join(', ')}"

          Tvojou úlohou je:
          1. Vytvoriť PRESNÝ a PEKNÝ názov produktu v slovenčine. Spoj Značku + Názov + Druh tak, aby to dávalo zmysel. 
             (Príklad: ak je Značka="OTMA" a Názov="Gurmán", výsledok musí byť "OTMA Gurmán Kečup").
             Ak názov už obsahuje značku, neopakuj ju.
          2. Extrahovať presnú váhu/objem (číslo) a jednotku (g, ml, kg, l, ks).
          3. Priradiť kategóriu zo zoznamu: [${categoriesList}].

          Odpovedz iba JSON objektom.
        `;

        const response = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: prompt,
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

        return safeJsonParse(response.text);

      } catch (aiError) {
        // Fallback ak AI zlyhá - použijeme aspoň to čo máme z OFF
        console.error("AI cleanup failed, using raw OFF data", aiError);
        
        // Jednoduchá logika pre názov
        let fullName = fastData.rawName;
        if (fastData.rawGeneric && !fullName.toLowerCase().includes(fastData.rawGeneric.toLowerCase())) {
           fullName += ` ${fastData.rawGeneric}`;
        }
        if (fastData.brand && !fullName.toLowerCase().includes(fastData.brand.toLowerCase())) {
           fullName = `${fastData.brand} ${fullName}`;
        }

        const mappedCat = mapCategoryFromTags(fastData.categoriesTags);
        
        return { 
          name: fullName, 
          quantity: parseFloat(fastData.netWeight) || 0,
          unit: fastData.netUnit || 'g',
          categoryName: mappedCat || "" 
        };
      }
    }
  }
  
  // 2. SCENÁR: Čiarový kód sa nenašiel v OFF alebo ide o full-text vyhľadávanie
  // Použijeme AI s Google Search groundingom
  try {
    const searchPrompt = isBarcode 
      ? `Nájdi produkt podľa EAN kódu "${barcode}". Zisti jeho presný názov (Značka + Názov produktu), hmotnosť/objem a zaraď ho do kategórie z [${categoriesList}]. Vráť JSON.`
      : `Identifikuj produkt: "${input}". Vyber kategóriu z [${categoriesList}]. Vráť JSON.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: searchPrompt,
      config: {
        tools: isBarcode ? [{ googleSearch: {} }] : [], // Search použijeme len pre EAN
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
    console.error("AI Search Error:", error);
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
