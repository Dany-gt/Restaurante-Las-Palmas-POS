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

                            // 1. Intentar llamar a 9Router Local Proxy
                            try {
                                const controller = new AbortController();
                                const timeoutId = setTimeout(() => controller.abort(), 12000);
                                
                                const routerResp = await fetch('http://localhost:20128/v1/chat/completions', {
                                    method: 'POST',
                                    headers: {
                                        'Content-Type': 'application/json',
                                        'Authorization': 'Bearer 9r-laspalmas-dev-2026'
                                    },
                                    body: JSON.stringify({
                                        model: 'FREE_CODING_FALLBACK',
                                        messages: [{ role: 'user', content: params.prompt }],
                                        temperature: params.temperature || 0.7,
                                        stream: false
                                    }),
                                    signal: controller.signal
                                });
                                clearTimeout(timeoutId);

                                if (routerResp.ok) {
                                    const routerJson = await routerResp.json();
                                    if (routerJson.choices && routerJson.choices[0]?.message?.content) {
                                        responseText = routerJson.choices[0].message.content;
                                        console.log(`\x1b[32m[AI-SUCCESS] Respondido por 9Router Local (Modelo: ${routerJson.model || 'FREE_CODING_FALLBACK'})\x1b[0m`);
                                    }
                                } else {
                                    const errText = await routerResp.text();
                                    console.warn(`[AI-WARNING] 9Router respondió con error (código ${routerResp.status}):`, errText);
                                }
                            } catch (err: any) {
                                console.warn(`[AI-WARNING] 9Router fuera de línea o falló. Usando fallback de API Keys locales...`, err.message);
                            }

                            // 2. Fallback de API Keys directas si 9Router no respondió
                            if (!responseText) {
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
                                        console.log(`\x1b[32m[AI-SUCCESS] Respondido por API Key directa de Google AI Studio\x1b[0m`);
                                        break; // Éxito, salir del loop
                                    } catch (e: any) {
                                        lastError = e;
                                        console.warn(`[AI-WARNING] Falló la key directa (probando siguiente si hay)...`, e.message);
                                    }
                                }
                            }

                            if (!responseText) {
                                throw lastError || new Error("No se pudo generar respuesta con 9Router ni con ninguna API Key directa");
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
