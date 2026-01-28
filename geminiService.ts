
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

// Pomocná funkcia na extrakciu čísla a jednotky z textu (fallback)
function parseQuantityFromText(text: string): { value: number, unit: string } | null {
  if (!text) return null;
  // Hľadá vzory ako: 310g, 310 g, 0.5 l, 1kg, 5x10g
  const regex = /(\d+[.,]?\d*)\s*(g|ml|kg|l|ks|kusov|pcs)/i;
  const match = text.match(regex);
  if (match) {
    let val = parseFloat(match[1].replace(',', '.'));
    let unit = match[2].toLowerCase();
    
    // Normalizácia
    if (unit === 'kusov' || unit === 'pcs') unit = 'ks';
    
    return { value: val, unit };
  }
  return null;
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

      // Zbierame "všeobecné názvy"
      const possibleGenerics = [
        p.generic_name_sk,
        p.generic_name_cs,
        p.generic_name
      ].filter(Boolean);

      const name = possibleNames[0] || "";
      const generic = possibleGenerics[0] || "";
      const brand = p.brands ? p.brands.split(',')[0].trim() : "";
      
      return {
        rawName: name,
        rawGeneric: generic,
        brand: brand,
        quantityStr: p.quantity || "", // Napr "310 g"
        netWeight: p.net_weight_value, // Napr 310
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

  // 1. SCENÁR: EAN Kód
  if (isBarcode) {
    const fastData = await fetchFromOpenFoodFacts(barcode);
    
    if (fastData) {
      try {
        const prompt = `
          Mám produkt z databázy (OFF) s týmito surovými dátami:
          - Značka (brands): "${fastData.brand}"
          - Názov (product_name): "${fastData.rawName}"
          - Popis/Druh (generic_name): "${fastData.rawGeneric}"
          - Množstvo text (quantity): "${fastData.quantityStr}"
          - Kategórie tagy: "${fastData.categoriesTags.slice(0, 5).join(', ')}"

          Tvojou úlohou je vrátiť JSON objekt s týmito kľúčmi:
          1. "name": Zlož PRESNÝ a ÚPLNÝ názov v slovenčine v tvare: "Značka Názov Druh". 
             (Príklad: Ak Značka="OTMA" a Názov="Gurmán", výsledok MUSÍ byť "OTMA Gurmán Kečup").
             Názov musí obsahovať značku (ak je známa) a typ produktu.
          2. "quantity": Číslo predstavujúce hmotnosť/objem jedného balenia.
          3. "unit": Jednotka (g, ml, kg, l, ks).
          4. "categoryName": Vyber najvhodnejšiu kategóriu zo zoznamu: [${categoriesList}].
          5. "shelfLifeDays": Odhadni bežnú trvanlivosť tohto typu produktu v dňoch (napr. kečup=365, mlieko=7).

          Dôležité: Ak v dátach nevidíš hmotnosť, skús ju nájsť v texte (napr "310g").
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
                categoryName: { type: Type.STRING },
                shelfLifeDays: { type: Type.NUMBER }
              },
              required: ["name", "quantity", "unit", "categoryName"]
            }
          }
        });

        const result = safeJsonParse(response.text);
        
        // Post-processing: Ak AI vráti 0 quantity, skúsime regex na quantityStr
        if (result && (!result.quantity || result.quantity === 0)) {
           const manualParse = parseQuantityFromText(fastData.quantityStr);
           if (manualParse) {
             result.quantity = manualParse.value;
             result.unit = manualParse.unit;
           } else if (fastData.netWeight) {
             result.quantity = parseFloat(fastData.netWeight);
             result.unit = fastData.netUnit || 'g';
           }
        }

        // Dopočítanie expirácie
        if (result && result.shelfLifeDays) {
            const date = new Date();
            date.setDate(date.getDate() + result.shelfLifeDays);
            result.expiryDate = date.toISOString().split('T')[0];
        }

        return result;

      } catch (aiError) {
        console.error("AI cleanup failed, using robust fallback", aiError);
        
        // ROBUST FALLBACK - manuálne skladanie
        let fullName = fastData.rawName || "Neznámy produkt";
        
        // 1. Pridaj generic ak chýba (napr "Gurmán" -> "Gurmán Kečup")
        if (fastData.rawGeneric && !fullName.toLowerCase().includes(fastData.rawGeneric.toLowerCase())) {
           fullName += ` ${fastData.rawGeneric}`;
        }
        // 2. Pridaj značku na začiatok ak chýba (napr "Gurmán..." -> "OTMA Gurmán...")
        if (fastData.brand && !fullName.toLowerCase().includes(fastData.brand.toLowerCase())) {
           fullName = `${fastData.brand} ${fullName}`;
        }

        // 3. Extrahuj quantity
        let q = parseFloat(fastData.netWeight) || 0;
        let u = fastData.netUnit || 'g';
        
        // Ak nemáme netWeight, skúsime parsovať string
        if (q === 0 && fastData.quantityStr) {
            const parsed = parseQuantityFromText(fastData.quantityStr);
            if (parsed) {
                q = parsed.value;
                u = parsed.unit;
            }
        }

        const mappedCat = mapCategoryFromTags(fastData.categoriesTags);
        
        return { 
          name: fullName, 
          quantity: q,
          unit: u,
          categoryName: mappedCat || "" 
        };
      }
    }
  }
  
  // 2. SCENÁR: Vyhľadávanie textu alebo neznámy EAN
  try {
    const searchPrompt = isBarcode 
      ? `Nájdi produkt s EAN kódom "${barcode}". Vráť JSON: {name (Značka+Názov), quantity, unit, categoryName (z [${categoriesList}]), shelfLifeDays (odhad dní trvanlivosti)}.`
      : `Identifikuj produkt: "${input}". Vráť JSON: {name, quantity, unit, categoryName (z [${categoriesList}]), shelfLifeDays}.`;

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
            categoryName: { type: Type.STRING },
            shelfLifeDays: { type: Type.NUMBER }
          },
          required: ["name", "quantity", "unit", "categoryName"]
        }
      }
    });
    
    const result = safeJsonParse(response.text);
    if (result && result.shelfLifeDays) {
        const date = new Date();
        date.setDate(date.getDate() + result.shelfLifeDays);
        result.expiryDate = date.toISOString().split('T')[0];
    }
    return result;

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
