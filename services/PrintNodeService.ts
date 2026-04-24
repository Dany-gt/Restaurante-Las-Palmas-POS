import { supabase } from '../supabase';

class PrintNodeService {
  private apiKey: string | null = null;
  private enabled: boolean = false;

  async init() {
    const { data } = await supabase.from('system_settings').select('printnode_api_key, printnode_enabled').eq('id', 1).single();
    if (data) {
      this.apiKey = data.printnode_api_key;
      this.enabled = data.printnode_enabled || false;
    }
  }

  get isEnabled() {
    return this.enabled && !!this.apiKey;
  }

  async getPrinters() {
    if (!this.apiKey) return [];
    try {
      const response = await fetch('https://api.printnode.com/printers', {
        headers: {
          'Authorization': 'Basic ' + btoa(this.apiKey + ':')
        }
      });
      return await response.json();
    } catch (err) {
      console.error('PrintNode Error:', err);
      return [];
    }
  }

  async printHtml(printerId: number, title: string, html: string) {
    if (!this.apiKey) return false;

    try {
      const response = await fetch('https://api.printnode.com/printjobs', {
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

      return response.ok;
    } catch (err) {
      console.error('PrintNode Print Error:', err);
      return false;
    }
  }

  async printRaw(printerId: number, contentBase64: string, title: string = 'RAW COMMAND') {
    if (!this.apiKey) return false;

    try {
      const response = await fetch('https://api.printnode.com/printjobs', {
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

      return response.ok;
    } catch (err) {
      console.error('PrintNode Raw Error:', err);
      return false;
    }
  }
}

export const printNodeService = new PrintNodeService();
