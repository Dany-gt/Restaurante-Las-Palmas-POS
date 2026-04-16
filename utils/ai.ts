import { GoogleGenerativeAI } from "@google/generative-ai";
import { supabase } from "../supabase";

const apiKeys = [
    process.env.GOOGLE_API_KEY,
    "AIzaSyDMMkHXj1dBGKHVIdS3Pd0zWM0yP5GJTFg"
].filter(k => !!k && k.length > 10);

const apiKey = apiKeys.find(k => k.startsWith("AIza")) || apiKeys[0];

if (!apiKey) {
    console.warn("No valid Google API Key found!");
}

const genAI = new GoogleGenerativeAI(apiKey || "");

// Usamos 'gemini-flash-latest' que es el nombre válido actual en la API
const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

export async function generateAIResponse(prompt: string): Promise<string> {
    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        return response.text();
    } catch (error) {
        console.error("Error AI:", error);
        return "Error al generar respuesta.";
    }
}

export async function interpretOrderWithAI(text: string): Promise<any> {
    try {
        // 1. Fetch simplified product list
        const { data: products, error } = await supabase
            .from('products')
            .select('id, name')
            .eq('is_available', true);

        if (error || !products) {
            console.error("Error fetching products:", error);
            return null;
        }

        const productContext = products.map(p => `${p.id}:${p.name}`).join('\n');

        const prompt = `
        Eres un mesero experto en un restaurante de Guatemala.
        DICCIONARIO CHAPÍN (Jerga Local):
        - "Chela", "Fría", "Birria" = Cerveza (Busca en categoría Cervezas).
        - "Miche" = Michelada.
        - "Pico", "Piconcito" = Pichel (Jarra).
        - "Sencilla" = Hamburguesa o producto base sin extras.
        - "La dolorosa", "La cuenta", "Pre-cuenta", "Cobrar" = Solicitar cobro.
        - "Ya estuvo", "Manda la orden", "Marcha" = Enviar a cocina.

        MENÚ DISPONIBLE: ${JSON.stringify(products)}.
        
        EL USUARIO DICE: "${text}"

        ACCIONES DEL SISTEMA: Tu respuesta debe ser un JSON Array. Analiza la intención del usuario:
        - Si pide comida/bebida -> action: "add"
        - Si quiere quitar algo -> action: "remove"
        - Si quiere separar cuentas ("esto es de Juan") -> action: "split"
        - Si dice "Ya estuvo", "Manda la orden", "Marcha" -> action: "send_order"
        - Si pide la cuenta ("Pre-cuenta", "Cobrar", "La dolorosa") -> action: "print_bill"

        ESTRUCTURA JSON REQUERIDA (Responde ÚNICAMENTE esto): 
        [ { "action": "add" | "remove" | "split" | "send_order" | "print_bill", "productId": "uuid..." (null si es send_order o print_bill), "quantity": number, "targetName": "NombreCliente" | "Mesa" (Por defecto "Mesa"), "notes": "string" } ]
        
        Si no hay coincidencias claras o acciones, responde: []
        `;

        console.log("AI Prompt sent (simplified)");

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const jsonString = response.text().replace(/```json|```/g, '').trim();

        console.log("AI Response:", jsonString);

        return JSON.parse(jsonString);

    } catch (error) {
        console.error("Error interpreting order with AI:", error);
        return null;
    }
}

