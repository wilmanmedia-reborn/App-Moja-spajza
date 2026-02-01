
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

// Pomocná funkcia na preklad tagov na "Typ produktu"
function getProductTypeFromTags(tags: string[] = []): string | null {
    const tagMap: Record<string, string> = {
        'ketchup': 'Kečup',
        'ketchups': 'Kečup',
        'tomato-sauces': 'Paradajková omáčka',
        'mustards': 'Horčica',
        'mustard': 'Horčica',
        'rice': 'Ryža',
        'indica-rice': 'Ryža',
        'japonica-rice': 'Ryža',
        'pastas': 'Cestoviny',
        'spaghetti': 'Špagety',
        'macaroni': 'Kolienka',
        'fusilli': 'Vrtuľky',
        'penne': 'Penne',
        'flours': 'Múka',
        'wheat-flours': 'Múka pšeničná',
        'sugars': 'Cukor',
        'milks': 'Mlieko',
        'cows-milk': 'Mlieko',
        'vinegars': 'Ocot',
        'oils': 'Olej',
        'sunflower-oils': 'Olej slnečnicový',
        'rapeseed-oils': 'Olej repkový',
        'olive-oils': 'Olej olivový',
        'waters': 'Voda',
        'mineral-waters': 'Minerálka',
        'fruit-juices': 'Džús',
        'carbonated-drinks': 'Limonáda',
        'legumes': 'Strukoviny',
        'lentils': 'Šošovica',
        'beans': 'Fazuľa',
        'canned-vegetables': 'Konzerva',
        'canned-fishes': 'Rybičky',
        'tunas': 'Tuniak',
        'chocolates': 'Čokoláda',
        'biscuits': 'Sušienky',
        'crisps': 'Chipsy',
        'jams': 'Džem',
        'honeys': 'Med',
        'spices': 'Korenie',
        'salts': 'Soľ'
    };

    for (const t of tags) {
        // Tagy sú často v formáte "en:ketchups"
        const cleanTag = t.split(':')[1] || t;
        if (tagMap[cleanTag]) return tagMap[cleanTag];
    }
    return null;
}

// Vylepšený parser hmotnosti
function parseQuantityFromText(text: string): { value: number, unit: string } | null {
  if (!text) return null;
  // Regex chytá: "500g", "500 g", "500ml", "0.5 l", "1kg", "520 g e"
  const regex = /(\d+[.,]?\d*)\s*(g|ml|kg|l|ks|kusov|pcs|gram|gramov|litrov)\b/i;
  const match = text.match(regex);
  
  if (match) {
    let val = parseFloat(match[1].replace(',', '.'));
    let rawUnit = match[2].toLowerCase();
    let unit = 'g';

    if (rawUnit.startsWith('kg')) {
        unit = 'kg';
    } else if (rawUnit === 'l' || rawUnit === 'litrov') {
        unit = 'l';
    } else if (rawUnit === 'ml') {
        unit = 'ml';
    } else if (rawUnit.startsWith('p') || rawUnit.startsWith('kus') || rawUnit === 'ks') {
        unit = 'ks';
    }
    
    if (val <= 0) return null;

    return { value: val, unit };
  }
  return null;
}

async function fetchFromOpenFoodFacts(barcode: string) {
  try {
    // Pridávame generic_name a categories_hierarchy
    const response = await fetch(`https://world.openfoodfacts.org/api/v2/product/${barcode}.json?fields=product_name,product_name_sk,product_name_cs,product_name_en,generic_name,generic_name_sk,generic_name_cs,quantity,brands,net_weight_value,net_weight_unit,categories_tags`);
    const data = await response.json();
    
    if (data.status === 1 && data.product) {
      const p = data.product;
      
      const name = p.product_name_sk || p.product_name_cs || p.product_name || p.product_name_en || "";
      const generic = p.generic_name_sk || p.generic_name_cs || p.generic_name || "";
      const brand = p.brands ? p.brands.split(',')[0].trim() : "";
      
      return {
        rawName: name,
        genericName: generic,
        brand: brand,
        quantityStr: p.quantity || "", 
        netWeight: p.net_weight_value,
        netUnit: p.net_weight_unit,
        categories: p.categories_tags || []
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

  // 1. SCENÁR: EAN Kód - STRIKTNÝ FORMÁT NÁZVU
  if (isBarcode) {
    const fastData = await fetchFromOpenFoodFacts(barcode);
    
    if (fastData) {
        // --- A. Zostavenie Názvu (Logika: Typ + Značka + Názov) ---
        
        // 1. Zistíme typ produktu (Kečup, Ryža...)
        let productType = getProductTypeFromTags(fastData.categories);
        if (!productType && fastData.genericName) {
            productType = fastData.genericName.split(' ')[0]; // Skúsime prvé slovo z generic name
        }

        // 2. Vyčistíme značku
        let brand = fastData.brand;

        // 3. Vyčistíme marketingový názov
        let specificName = fastData.rawName;

        // ODSTRÁNENIE DUPLICÍT
        // Ak názov už obsahuje typ (napr. "Kečup Gurmán"), tak typ z premennej vymažeme, aby nebolo "Kečup Kečup Gurmán"
        if (productType && specificName.toLowerCase().includes(productType.toLowerCase())) {
            productType = ""; 
        }
        // Ak názov už obsahuje značku, vymažeme značku
        if (brand && specificName.toLowerCase().includes(brand.toLowerCase())) {
            brand = "";
        }

        // SKLADANIE: Typ -> Značka -> Názov
        let parts = [];
        if (productType) parts.push(productType);
        if (brand) parts.push(brand);
        parts.push(specificName);

        // Odstránime prázdne časti a spojíme
        let finalName = parts.filter(Boolean).join(' ');
        
        // Capitalize first letter
        finalName = finalName.charAt(0).toUpperCase() + finalName.slice(1);

        // --- B. Hmotnosť ---
        let finalQuantity = 0;
        let finalUnit = 'g';

        // 1. Skúsime presnú hodnotu z DB
        if (fastData.netWeight) {
            finalQuantity = parseFloat(fastData.netWeight);
            finalUnit = fastData.netUnit ? fastData.netUnit.toLowerCase() : 'g';
        }
        
        // 2. Ak zlyhalo, skúsime "quantity" string (napr. "520 g")
        if (finalQuantity === 0) {
            const parsed = parseQuantityFromText(fastData.quantityStr);
            if (parsed) {
                finalQuantity = parsed.value;
                finalUnit = parsed.unit;
            }
        }

        // 3. Ak zlyhalo, skúsime nájsť váhu v názve
        if (finalQuantity === 0) {
            const parsedName = parseQuantityFromText(fastData.rawName);
            if (parsedName) {
                finalQuantity = parsedName.value;
                finalUnit = parsedName.unit;
            }
        }

        // Normalizácia jednotiek
        if (finalUnit === 'gram') finalUnit = 'g';
        if (finalUnit === 'kilogram') finalUnit = 'kg';
        if (finalUnit === 'liter' || finalUnit === 'litre') finalUnit = 'l';
        if (finalUnit === 'milliliter') finalUnit = 'ml';

        // --- C. Kategória (AI) ---
        let categoryName = "";
        try {
            const prompt = `Zoraď produkt "${finalName}" (tags: ${fastData.categories.slice(0,5).join(',')}) do jednej z kategórií: [${categoriesList}]. Vráť JSON {"categoryName": "..."}`;
            const response = await ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: prompt,
                config: { responseMimeType: "application/json" }
            });
            const resJson = safeJsonParse(response.text);
            if (resJson && resJson.categoryName) categoryName = resJson.categoryName;
        } catch (e) { }

        return {
            name: finalName,
            quantity: finalQuantity,
            unit: finalUnit,
            categoryName: categoryName,
            expiryDate: "" 
        };
    }
  }
  
  // 2. SCENÁR: Fulltext
  try {
    const searchPrompt = `Analyzuj text: "${input}". 
    Vráť JSON: 
    {
      "name": "Názov produktu (Typ + Značka + Názov)", 
      "quantity": číslo, 
      "unit": "g/kg/ml/l/ks", 
      "categoryName": "jedna z [${categoriesList}]"
    }`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: searchPrompt,
      config: { responseMimeType: "application/json" }
    });
    
    return safeJsonParse(response.text);

  } catch (error) {
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
