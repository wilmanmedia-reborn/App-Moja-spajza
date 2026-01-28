
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

// Vylepšená funkcia na extrakciu čísla a jednotky z textu
function parseQuantityFromText(text: string): { value: number, unit: string } | null {
  if (!text) return null;
  // Hľadá vzory ako: 310g, 310 g, 0,5 l, 1.5kg, 5x10g
  // Nové: podporuje desatinnú čiarku (3,5 g) a medzery
  const regex = /(\d+[.,]?\d*)\s*(g|ml|kg|l|ks|kusov|pcs|gram|gramov|litrov)/i;
  const match = text.match(regex);
  
  if (match) {
    // Nahradí čiarku bodkou pre parseFloat
    let val = parseFloat(match[1].replace(',', '.'));
    let rawUnit = match[2].toLowerCase();
    let unit = 'g'; // default

    // Normalizácia jednotiek
    if (rawUnit.startsWith('k')) {
        if (rawUnit === 'kg') unit = 'kg';
        else unit = 'ks';
    } else if (rawUnit.startsWith('l')) {
        unit = 'l';
    } else if (rawUnit === 'ml') {
        unit = 'ml';
    } else if (rawUnit.startsWith('p') || rawUnit.startsWith('kus')) {
        unit = 'ks';
    }

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
    // Pridanie fields: brands_tags, product_quantity
    const response = await fetch(`https://world.openfoodfacts.org/api/v2/product/${barcode}.json?fields=product_name,brands,brands_tags,quantity,product_name_sk,product_name_cs,product_name_en,generic_name_sk,generic_name_cs,generic_name,net_weight_value,net_weight_unit,categories_tags`);
    const data = await response.json();
    if (data.status === 1 && data.product) {
      const p = data.product;
      
      const possibleNames = [
        p.product_name_sk, 
        p.product_name_cs, 
        p.product_name, 
        p.product_name_en
      ].filter(Boolean);

      const possibleGenerics = [
        p.generic_name_sk,
        p.generic_name_cs,
        p.generic_name
      ].filter(Boolean);

      let name = possibleNames[0] || "";
      let generic = possibleGenerics[0] || "";
      
      // Získanie značky - skúsime brands field, potom brands_tags
      let brand = p.brands ? p.brands.split(',')[0].trim() : "";
      if (!brand && p.brands_tags && p.brands_tags.length > 0) {
          brand = p.brands_tags[0].replace('brands:', '').replace(/-/g, ' '); // napr 'brands:otma-gurman' -> 'otma gurman'
      }

      // MANUÁLNA OPRAVA: Ak názov neobsahuje značku, pridaj ju hneď.
      // Toto rieši problém "Gurmán" -> "OTMA Gurmán"
      if (brand && name && !name.toLowerCase().includes(brand.toLowerCase())) {
          name = `${brand} ${name}`;
      }
      
      return {
        rawName: name, // Toto už obsahuje značku ak sa dala zistiť
        rawGeneric: generic,
        brand: brand,
        quantityStr: p.quantity || "", 
        netWeight: p.net_weight_value,
        netUnit: p.net_weight_unit,
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
          - Zložený Názov: "${fastData.rawName}" (Už môže obsahovať značku)
          - Značka (Brand): "${fastData.brand}"
          - Druh: "${fastData.rawGeneric}"
          - Množstvo text: "${fastData.quantityStr}"
          - Kategórie: "${fastData.categoriesTags.slice(0, 5).join(', ')}"

          Tvojou úlohou je vrátiť JSON objekt:
          1. "name": Finálny názov produktu v slovenčine. Musí byť v tvare "ZNAČKA + NÁZOV + DRUH". 
             Príklad: Ak vstup je "Gurmán" a značka "OTMA", výstup je "OTMA Gurmán Kečup".
          2. "quantity": Číslo (hmotnosť/objem). Ak chýba v číslach, vytiahni z textu "${fastData.quantityStr}" alebo priamo z názvu produktu.
          3. "unit": Jednotka (g, ml, kg, l, ks).
          4. "categoryName": Vyber z: [${categoriesList}].
          5. "shelfLifeDays": Odhadni trvanlivosť v dňoch.

          Ak je v názve "Kečup" alebo "Horčica" a quantity je 0, skús nájsť štandardnú váhu (napr. 350g, 520g) v texte.
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
        
        // --- AGRESÍVNY FALLBACK PRE HMOTNOSŤ ---
        // Ak AI vráti 0 alebo null, skúsime regex na všetkých textoch
        if (result && (!result.quantity || result.quantity === 0)) {
           // 1. Skús quantityStr z OFF
           let manualParse = parseQuantityFromText(fastData.quantityStr);
           
           // 2. Ak nič, skús názov produktu (napr "Kečup 310g")
           if (!manualParse) manualParse = parseQuantityFromText(fastData.rawName);
           
           // 3. Ak nič, skús generic name
           if (!manualParse) manualParse = parseQuantityFromText(fastData.rawGeneric);

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
        
        // ROBUST FALLBACK - manuálne skladanie bez AI
        let fullName = fastData.rawName || "Neznámy produkt";
        
        // Extrahuj quantity manuálne
        let q = parseFloat(fastData.netWeight) || 0;
        let u = fastData.netUnit || 'g';
        
        // Regex na quantity
        if (q === 0) {
            let parsed = parseQuantityFromText(fastData.quantityStr);
            if (!parsed) parsed = parseQuantityFromText(fullName); // Skús v názve
            
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
  
  // 2. SCENÁR: Fulltext
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
