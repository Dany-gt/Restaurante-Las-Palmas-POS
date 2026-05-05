import { GoogleGenerativeAI } from '@google/generative-ai';

export function aiProxyPlugin(env: any) {
    return {
        name: 'ai-proxy-plugin',
        configureServer(server: any) {
            console.log('\x1b[34m[AI-INFO] Canal de Inteligencia Artificial Activado\x1b[0m');
            
            server.middlewares.use(async (req: any, res: any, next: any) => {
                if (req.url === '/api/ai/generate' && req.method === 'POST') {
                    let body = '';
                    req.on('data', (chunk: any) => body += chunk.toString());
                    req.on('end', async () => {
                        try {
                            const params = JSON.parse(body);
                            const apiKeys = [
                                env.GOOGLE_API_KEY,
                                env.GOOGLE_API_KEY_2,
                                env.GOOGLE_API_KEY_3,
                                env.GOOGLE_API_KEY_4,
                                env.VITE_GEMINI_API_KEY,
                                env.GEMINI_API_KEY
                            ].filter(Boolean);
                            
                            if (apiKeys.length === 0) {
                                res.writeHead(500, { 'Content-Type': 'application/json' });
                                return res.end(JSON.stringify({ success: false, error: 'API Keys no configuradas (.env)' }));
                            }

                            let responseText = null;
                            let lastError = null;

                            for (const apiKey of apiKeys) {
                                try {
                                    const genAI = new GoogleGenerativeAI(apiKey);
                                    const model = genAI.getGenerativeModel({ model: params.model || 'gemini-2.0-flash' });

                                    const result = await model.generateContent({
                                        contents: [{ role: 'user', parts: [{ text: params.prompt }] }],
                                        generationConfig: {
                                            temperature: params.temperature || 0.7,
                                        }
                                    });
                                    
                                    responseText = result.response.text();
                                    break; // Éxito, salir del loop
                                } catch (e: any) {
                                    lastError = e;
                                    console.warn(`[AI-WARNING] Falló la key (probando siguiente si hay)...`, e.message);
                                    // Si no es error de cuota (429) o limits, podríamos querer no seguir, pero
                                    // para simplificar seguimos probando hasta que una funcione o se acaben.
                                }
                            }

                            if (!responseText) {
                                throw lastError || new Error("No se pudo generar respuesta con ninguna API Key");
                            }

                            res.writeHead(200, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({
                                success: true,
                                text: responseText
                            }));
                        } catch (e: any) {
                            console.error("[AI-ERROR]", e);
                            res.writeHead(500, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ success: false, error: e.message || 'Error procesando IA' }));
                        }
                    });
                } else {
                    next();
                }
            });
        }
    };
}
