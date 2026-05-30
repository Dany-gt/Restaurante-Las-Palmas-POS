import { supabase } from '../supabase';

// FIX A5: Timeout helper — evita que fetch a PrintNode cuelgue el POS indefinidamente
const PRINTNODE_TIMEOUT_MS = 8000; // 8 segundos máximo para respuesta de impresora en la nube

async function fetchWithTimeout(url: string, options: RequestInit = {}): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), PRINTNODE_TIMEOUT_MS);
    
    // Si no estamos en Electron y no es localhost, usar el proxy de Vercel para evadir CORS
    const isElectron = !!(window && ((window as any).electronAPI || (window as any).electron));
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    
    let finalUrl = url;
    if (!isElectron && !isLocalhost) {
        finalUrl = `/api/proxy?url=${encodeURIComponent(url)}`;
    }

    try {
        const response = await fetch(finalUrl, { ...options, signal: controller.signal });
        return response;
    } finally {
        clearTimeout(timeout);
    }
}

class PrintNodeService {
    private apiKey: string | null = null;
    private enabled: boolean = false;

    async init() {
        try {
            const { data } = await supabase
                .from('system_settings')
                .select('printnode_api_key, printnode_enabled')
                .eq('id', 1)
                .single();
            if (data) {
                this.apiKey = data.printnode_api_key;
                this.enabled = data.printnode_enabled || false;
            }
        } catch (e) {
            console.warn('PrintNodeService: Error al cargar configuración:', e);
        }
    }

    get isEnabled() {
        return this.enabled && !!this.apiKey;
    }

    async getPrinters() {
        if (!this.apiKey) return [];
        try {
            const response = await fetchWithTimeout('https://api.printnode.com/printers', {
                headers: {
                    'Authorization': 'Basic ' + btoa(this.apiKey + ':')
                }
            });
            if (!response.ok) {
                console.warn(`PrintNode getPrinters: HTTP ${response.status}`);
                return [];
            }
            return await response.json();
        } catch (err: any) {
            if (err?.name === 'AbortError') {
                console.warn(`🖨️ PrintNode: Timeout (>${PRINTNODE_TIMEOUT_MS}ms) al obtener impresoras`);
            } else {
                console.error('PrintNode Error:', err);
            }
            return [];
        }
    }

    async printHtml(printerId: number, title: string, html: string): Promise<boolean> {
        if (!this.apiKey) return false;

        try {
            const response = await fetchWithTimeout('https://api.printnode.com/printjobs', {
                method: 'POST',
                headers: {
                    'Authorization': 'Basic ' + btoa(this.apiKey + ':'),
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    printerId: printerId,
                    title: title,
                    contentType: 'raw_html',
                    content: html,
                    source: 'RESTAURANTE LAS PALMAS POS'
                })
            });

            if (!response.ok) {
                console.warn(`🖨️ PrintNode printHtml: HTTP ${response.status} para "${title}"`);
                return false;
            }
            return true;
        } catch (err: any) {
            if (err?.name === 'AbortError') {
                console.warn(`🖨️ PrintNode: Timeout (>${PRINTNODE_TIMEOUT_MS}ms) imprimiendo "${title}" — usando fallback`);
            } else {
                console.error('PrintNode Print Error:', err);
            }
            return false;
        }
    }

    async printRaw(printerId: number, contentBase64: string, title: string = 'RAW COMMAND'): Promise<boolean> {
        if (!this.apiKey) return false;

        try {
            const response = await fetchWithTimeout('https://api.printnode.com/printjobs', {
                method: 'POST',
                headers: {
                    'Authorization': 'Basic ' + btoa(this.apiKey + ':'),
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    printerId: printerId,
                    title: title,
                    contentType: 'raw_base64',
                    content: contentBase64,
                    source: 'RESTAURANTE LAS PALMAS POS'
                })
            });

            if (!response.ok) {
                console.warn(`🖨️ PrintNode printRaw: HTTP ${response.status} para "${title}"`);
                return false;
            }
            return true;
        } catch (err: any) {
            if (err?.name === 'AbortError') {
                console.warn(`🖨️ PrintNode: Timeout (>${PRINTNODE_TIMEOUT_MS}ms) en printRaw "${title}"`);
            } else {
                console.error('PrintNode Raw Error:', err);
            }
            return false;
        }
    }
}

export const printNodeService = new PrintNodeService();
