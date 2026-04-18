import { supabase } from "../supabase";

/**
 * Función genérica para llamar al proxy de IA del servidor.
 * Esto protege las llaves y permite rotación/fallback automático.
 */
async function callAIProxy(prompt: string, model: string = 'gemini-2.0-flash', temperature: number = 0.7): Promise<string> {
    try {
        const resp = await fetch('/api/ai/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model, prompt, temperature })
        });

        if (!resp.ok) {
            const errData = await resp.json();
            throw new Error(errData.error || 'Error en el servidor de IA');
        }

        const json = await resp.json();
        if (json.success && json.text) {
            return json.text;
        }
        throw new Error('No se recibió respuesta válida de la IA.');
    } catch (error: any) {
        console.error('AI Proxy Error:', error.message);
        return '';
    }
}

export async function generateAIResponse(prompt: string): Promise<string> {
    return await callAIProxy(prompt);
}

export async function interpretOrderWithAI(text: string): Promise<any> {
    try {
        // 1. Obtener lista de productos disponibles
        const { data: products, error } = await supabase
            .from('products')
            .select('id, name')
            .eq('is_available', true);

        if (error || !products) {
            console.error("Error fetching products:", error);
            return null;
        }

        const prompt = 'Eres un mesero experto en un restaurante de Guatemala.\n' +
            'DICCIONARIO CHAPÍN (Jerga Local):\n' +
            '- "Chela", "Fría", "Birria" = Cerveza.\n' +
            '- "Miche" = Michelada.\n' +
            '- "Pico", "Piconcito" = Pichel (Jarra).\n' +
            '- "Sencilla" = Hamburguesa o producto base sin extras.\n' +
            '- "La dolorosa", "La cuenta", "Pre-cuenta", "Cobrar" = Solicitar cobro.\n' +
            '- "Ya estuvo", "Manda la orden", "Marcha" = Enviar a cocina.\n\n' +
            'MENÚ DISPONIBLE: ' + JSON.stringify(products) + '.\n\n' +
            'EL USUARIO DICE: "' + text + '"\n\n' +
            'ACCIONES DEL SISTEMA: Tu respuesta debe ser un JSON Array. Analiza la intención del usuario:\n' +
            '- Si pide comida/bebida -> action: "add"\n' +
            '- Si quiere quitar algo -> action: "remove"\n' +
            '- Si quiere separar cuentas -> action: "split"\n' +
            '- Si dice "Ya estuvo", "Manda la orden", "Marcha" -> action: "send_order"\n' +
            '- Si pide la cuenta -> action: "print_bill"\n\n' +
            'ESTRUCTURA JSON REQUERIDA (Responde ÚNICAMENTE esto):\n' +
            '[ { "action": "add" | "remove" | "split" | "send_order" | "print_bill", "productId": "uuid...", "quantity": number, "targetName": "Mesa", "notes": "string" } ]\n\n' +
            'Si no hay coincidencias claras, responde: []';

        const aiResponse = await callAIProxy(prompt, 'gemini-2.0-flash', 0.1);
        if (!aiResponse) return null;

        const jsonString = aiResponse.replace(/```json|```/g, '').trim();
        return JSON.parse(jsonString);

    } catch (error) {
        console.error("Error interpreting order with AI:", error);
        return null;
    }
}
