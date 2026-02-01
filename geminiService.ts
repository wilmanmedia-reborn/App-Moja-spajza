
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

function parseQuantityFromText(text: string): { value: number, unit: string } | null {
  if (!text) return null;
  const regex = /(\d+[.,]?\d*)\s*(g|ml|kg|l|ks|kusov|pcs|gram|gramov|litrov)/i;
  const match = text.match(regex);
  
  if (match) {
    let val = parseFloat(match[1].replace(',', '.'));
    let rawUnit = match[2].toLowerCase();
    let unit = 'g';

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

async function fetchFromOpenFoodFacts(barcode: string) {
  try {
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
      
      let brand = p.brands ? p.brands.split(',')[0].trim() : "";
      if (!brand && p.brands_tags && p.brands_tags.length > 0) {
          brand = p.brands_tags[0].replace('brands:', '').replace(/-/g, ' '); 
      }
      
      return {
        rawName: name, 
        rawGeneric: generic,
        brand: brand,
        quantityStr: p.quantity || "", 
        // Priorita pre presnú váhu z databázy
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
        const hasExactWeight = fastData.netWeight !== undefined && fastData.netWeight !== null;

        const prompt = `
          Mám produkt z databázy (OFF):
          - Názov produktu: "${fastData.rawName}"
          - Druh (Generic): "${fastData.rawGeneric}"
          - Značka (Brand): "${fastData.brand}"
          - Množstvo text: "${fastData.quantityStr}"
          ${hasExactWeight ? `- PRESNÁ VÁHA Z DB: ${fastData.netWeight} ${fastData.netUnit}` : ''}
          - Kategórie: "${fastData.categoriesTags.slice(0, 5).join(', ')}"

          Vráť JSON:
          1. "name": Formát MUSÍ BYŤ: "DRUH (všeobecný názov) + ZNAČKA + ZVYŠOK".
             - Príklad 1: Vstup="Gurmán", Brand="OTMA", Generic="Kečup". Výstup="Kečup OTMA Gurmán".
             - Príklad 2: Vstup="Ryža gulatá", Brand="Lagris". Výstup="Ryža guľatá Lagris".
             - Vždy začni všeobecným názvom potraviny (Kečup, Horčica, Ryža, Múka...).
          
          2. "quantity": ${hasExactWeight ? `POVINNE POUŽI hodnotu ${fastData.netWeight}. Nehádaj inú!` : 'Vytiahni číslo z textu.'}
          3. "unit": Jednotka (g, ml, kg, l, ks).
          4. "categoryName": Vyber z: [${categoriesList}].
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

        const result = safeJsonParse(response.text);
        
        // --- AGRESÍVNY FALLBACK PRE HMOTNOSŤ ---
        // Ak máme presnú váhu z DB, prepíšeme čokoľvek čo AI vymyslela
        if (fastData.netWeight) {
             result.quantity = parseFloat(fastData.netWeight);
             result.unit = fastData.netUnit || 'g';
        } else if (result && (!result.quantity || result.quantity === 0)) {
           // Fallbacky ak AI zlyhá a nemáme netWeight
           let manualParse = parseQuantityFromText(fastData.quantityStr);
           if (!manualParse) manualParse = parseQuantityFromText(fastData.rawName);
           if (!manualParse) manualParse = parseQuantityFromText(fastData.rawGeneric);

           if (manualParse) {
             result.quantity = manualParse.value;
             result.unit = manualParse.unit;
           }
        }

        // POZNÁMKA: Expiry date (dátum spotreby) úmyselne nevraciame,
        // aby užívateľ musel zvoliť dátum sám (podľa požiadavky).
        
        return result;

      } catch (aiError) {
        console.error("AI cleanup failed, using robust fallback", aiError);
        
        // ROBUST FALLBACK - manuálne skladanie bez AI
        // Formát: Generic (ak je) + Brand + Name
        let parts = [];
        if (fastData.rawGeneric) parts.push(fastData.rawGeneric);
        else parts.push("Potravina"); // Default

        if (fastData.brand) parts.push(fastData.brand);
        if (fastData.rawName && !fastData.rawName.includes(fastData.rawGeneric)) parts.push(fastData.rawName);
        
        let fullName = parts.join(" ");
        
        let q = parseFloat(fastData.netWeight) || 0;
        let u = fastData.netUnit || 'g';
        
        if (q === 0) {
            let parsed = parseQuantityFromText(fastData.quantityStr);
            if (!parsed) parsed = parseQuantityFromText(fastData.rawName);
            
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
    const searchPrompt = `Identifikuj produkt: "${input}". Vráť JSON: {name (Formát: Druh + Značka + Názov), quantity, unit, categoryName (z [${categoriesList}])}.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: searchPrompt,
      config: {
        tools: [],
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
