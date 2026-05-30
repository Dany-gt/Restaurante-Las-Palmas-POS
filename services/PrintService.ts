import { supabase } from '../supabase';
import { printNodeService } from './PrintNodeService';

export interface PrintOptions {
  silent?: boolean;
  openDrawer?: boolean;
}

export interface TicketData {
  orderId: string;
  orderNumber?: number;
  tableNumber?: number;
  tableName?: string;
  waiterName?: string;
  items: Array<{
    name: string;
    quantity: number;
    notes?: string;
    price?: number;
  }>;
  subtotal?: number;
  taxAmount?: number;
  tipAmount?: number;
  total?: number;
  createdAt: string;
}

export interface PrintSettings {
  print_expense_ticket: boolean;
  print_order_num_ticket: boolean;
  print_charge_ticket: boolean;
  print_cancelled_ticket: boolean;
  print_deleted_ticket: boolean;
  group_kitchen_by_name: boolean;
  printnode_enabled: boolean;
  printnode_printer_id: number | null;
  main_printer_id: number | null;
  restaurant_logo?: string;
}

class PrintService {
  private settings: PrintSettings | null = null;
  private restaurantInfo: any = null;

  constructor() { }

  // ─── CONNECTION HELPERS ───────────────────────────────────────────

  async checkConnection(ip: string, port: number = 9100): Promise<boolean> {
    const electron = (window as any).electronAPI || (window as any).electron;
    if (!electron) return false;
    try {
      return await electron.checkConnection(ip, port);
    } catch (e) {
      console.error('Check connection failed:', e);
      return false;
    }
  }

  async getPrinterInfo(area: string): Promise<{ type: 'SYSTEM' | 'NETWORK'; target: string; paperWidth: string } | null> {
    try {
      const { data } = await supabase
        .from('printers')
        .select('name, address, connection_type, paper_width')
        .or(`name.ilike.%${area}%,address.ilike.%${area}%`)
        .eq('is_active', true)
        .limit(1)
        .single();

      if (!data) return null;

      const result = {
        type: data.connection_type as 'SYSTEM' | 'NETWORK',
        target: data.connection_type === 'SYSTEM' ? data.name : data.address,
        paperWidth: data.paper_width || '80mm'
      };

      return result;
    } catch (e) {
      console.error(`Error fetching printer info for ${area}`, e);
      return null;
    }
  }

  async getPrinterIP(area: string): Promise<string | null> {
    const info = await this.getPrinterInfo(area);
    if (info?.type === 'NETWORK') return info.target;
    return null; // Legacy compatibility
  }

  // ─── SETTINGS ─────────────────────────────────────────────────────

  async loadSettings(): Promise<void> {
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('*')
        .eq('id', 1)
        .single();
      if (error) throw error;
      if (data) {
        this.settings = {
          print_expense_ticket: data.print_expense_ticket ?? true,
          print_order_num_ticket: data.print_order_num_ticket ?? true,
          print_charge_ticket: data.print_charge_ticket ?? false,
          print_cancelled_ticket: data.print_cancelled_ticket ?? true,
          print_deleted_ticket: data.print_deleted_ticket ?? true,
          group_kitchen_by_name: data.group_kitchen_by_name ?? false,
          printnode_enabled: data.printnode_enabled ?? false,
          printnode_printer_id: data.printnode_printer_id ? parseInt(data.printnode_printer_id) : null,
          main_printer_id: data.main_printer_id ? parseInt(data.main_printer_id) : null,
          restaurant_logo: data.restaurant_logo || '',
        };
        this.restaurantInfo = {
          name: data.restaurant_name || 'RESTAURANTE LAS PALMAS',
          commercial_name: data.commercial_name || data.restaurant_name || 'RESTAURANTE LAS PALMAS',
          legal_name: data.legal_name || '',
          address: data.billing_address_1 || data.address || '',
          phone: data.phone || '',
          email: data.email || 'cevicheriayrestlaspalmas@gmail.com',
          website: 'WWW.RESTAURANTELASPALMAS.COM.GT',
          nit: data.nit || 'CF',
          invoice_phrases: data.invoice_phrases || 'Sujeto a Pagos Trimestrales',
          certifier_legend: data.certifier_legend || 'Certificador: INFILE, S.A. NIT: 12521337',
        };
        await printNodeService.init();
      }
    } catch (err) {
      console.error('Error loading print settings:', err);
    }
  }

  // ─── BROWSER PRINT ────────────────────────────────────────────────

  private openPrintWindow(html: string) {
    try {
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      document.body.appendChild(iframe);

      const doc = iframe.contentWindow?.document || iframe.contentDocument;
      if (!doc) throw new Error('No se pudo acceder al documento del iframe');

      doc.open();
      doc.write(html);
      doc.close();

      iframe.onload = () => {
        setTimeout(() => {
          try {
            iframe.contentWindow?.focus();
            iframe.contentWindow?.print();
          } catch (e) {
            console.error('Error executing print on tablet/mobile:', e);
          } finally {
            setTimeout(() => {
              if (document.body.contains(iframe)) {
                document.body.removeChild(iframe);
              }
            }, 1000);
          }
        }, 500);
      };
    } catch (error) {
      console.error('Error creating print iframe:', error);
      // Fallback clásico por si falla el iframe
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.onload = () => {
          setTimeout(() => {
            printWindow.print();
            printWindow.close();
          }, 500);
        };
      } else {
        alert('⚠️ El navegador bloqueó la ventana de impresión. Permite ventanas emergentes para este sitio e intenta de nuevo.');
      }
    }
  }

  // ─── CORE HTML TEMPLATE ───────────────────────────────────────────

  private generateTicketHTML(title: string, content: string, footer?: string, paperWidth: string = '80mm', hideHeader: boolean = false, customHeaderName?: string): string {
    const isSmall = paperWidth === '58mm';
    const maxWidth = isSmall ? '48mm' : '72mm';
    const fontSize = isSmall ? '8.5px' : '10.5px';
    const padding = isSmall ? '1mm 1mm' : '1mm 3mm';

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    @page { margin: 0; }
    @media print {
      @page { margin: 0; }
      body { margin: 0; padding: 0; }
    }
    * { box-sizing: border-box; }
    body {
      font-family: 'Courier New', Courier, monospace;
      font-size: ${fontSize};
      font-weight: bold; /* Forzamos negrita en todo para que se vea bien negro */
      margin: 0;
      padding: ${padding} !important;
      width: ${maxWidth};
      line-height: 1.2;
      color: #000;
      background: #fff;
      -webkit-print-color-adjust: exact;
    }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    th, td { padding: 2px 0; vertical-align: top; overflow: hidden; color: #000; }
    .col-qty { width: ${isSmall ? '25px' : '35px'}; font-weight: 900; }
    .col-price { width: ${isSmall ? '60px' : '85px'}; text-align: right; font-weight: 900; }
    .col-desc { text-align: left; font-weight: bold; text-transform: uppercase; }
    
    .header { text-align: center; margin-bottom: 8px; color: #000; }
    .restaurant-name { font-size: ${isSmall ? '12px' : '15px'}; font-weight: 900; text-transform: uppercase; }
    .ticket-title {
      text-align: center; font-weight: 900; font-size: ${isSmall ? '11px' : '13px'};
      border-top: 1.5px solid #000; border-bottom: 1.5px solid #000;
      padding: 4px 0; margin: 6px 0; text-transform: uppercase;
    }
    .divider { border-top: 1px solid #000; margin: 8px 0; width: 100%; }
    .dotted-divider { border-top: 1px dashed #000; margin: 8px 0; }
    .thick-divider { border-top: 2px solid #000; margin: 8px 0; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 5px; margin: 8px 0; }
    .info-line { display: flex; font-weight: bold; gap: 4px; margin-bottom: 2px; align-items: baseline; }
    .total-line { display: flex; justify-content: space-between; font-weight: 900; margin: 3px 0; }
    .grand-total { 
      font-size: ${isSmall ? '13px' : '16px'}; 
      border-top: 1.5px solid #000; 
      padding-top: 5px; 
      margin-top: 5px; 
      /* Eliminamos cualquier borde inferior para que sea más limpio */
    }
    .footer { text-align: center; margin-top: 15px; font-weight: bold; font-size: ${isSmall ? '8px' : '10px'}; }
    .data-box { border: 1.5px solid #000; margin-top: 5px; padding: 2px; }
    .note { font-size: 0.9em; padding-left: 5px; font-weight: bold; }
  </style>
</head>
<body>
    ${!hideHeader ? `
    <div class="header">
      ${this.settings?.restaurant_logo && this.settings.restaurant_logo.length > 5 ? `
        <div style="text-align:center; margin-bottom: 10px;">
          <img src="${this.settings?.restaurant_logo}" style="max-width: 140px; max-height: 70px; filter: grayscale(1);" />
        </div>
      ` : ''}
      <div class="restaurant-name">${customHeaderName || this.restaurantInfo?.name || 'RESTAURANTE LAS PALMAS'}</div>
      <div style="font-size: 0.9em;">${this.restaurantInfo?.address || ''}</div>
      <div style="font-size: 0.9em;">${this.restaurantInfo?.phone ? 'Tel: ' + this.restaurantInfo.phone : ''}</div>
    </div>
    ` : ''}
  ${title ? `
    <div style="text-align: center; font-weight: 900; font-size: ${isSmall ? '12px' : '14px'}; margin: 10px 0 5px 0; text-transform: uppercase;">
      ${title}
    </div>
    <div style="border-top: 1px solid #000; margin-bottom: 10px;"></div>
  ` : '<div class="dotted-divider"></div>'}
  <div class="content">${content}</div>
  ${footer ? '<div class="footer">' + footer + '</div>' : ''}
</body>
</html>`;
  }

  // ─── PRINTER RESOLUTION ───────────────────────────────────────────

  private async getNetworkPrinter(): Promise<{ address: string; port: number; name: string; paperWidth: string; opens_cash_drawer?: boolean } | null> {
    try {
      const { data, error } = await supabase
        .from('printers').select('id, name, address, port, paper_width, opens_cash_drawer')
        .eq('connection_type', 'NETWORK').eq('is_active', true);

      if (!data || data.length === 0) return null;

      // 1. Prioridad Máxima: Impresora llamada "CAJA", "PRINCIPAL" o con la IP específica del usuario
      let printer = data.find(p =>
        p.name.toUpperCase().includes('CAJA') ||
        p.name.toUpperCase().includes('PRINCIPAL') ||
        p.address === '192.168.88.11' ||
        p.name.toUpperCase().includes('EPSON')
      );

      // 2. Segunda Prioridad: La marcada como principal en settings
      if (!printer && this.settings?.main_printer_id) {
        printer = data.find(p => p.id === this.settings.main_printer_id);
      }

      // 3. Fallback: La primera que encuentre
      if (!printer) printer = data[0];

      if (!printer?.address) return null;
      return {
        address: printer.address,
        port: printer.port || 9100,
        name: printer.name || '',
        paperWidth: printer.paper_width || '80mm',
        opens_cash_drawer: !!printer.opens_cash_drawer
      };
    } catch { return null; }
  }

  private async getSystemPrinter(): Promise<{ name: string; paperWidth: string } | null> {
    try {
      const { data, error } = await supabase
        .from('printers').select('id, name, paper_width')
        .eq('connection_type', 'SYSTEM').eq('is_active', true)
        .order('id', { ascending: true });

      let printer = data?.find(p => p.id === this.settings?.main_printer_id) || data?.[0];

      if (!printer?.name) return null;
      return { name: printer.name, paperWidth: printer.paper_width || '80mm' };
    } catch { return null; }
  }

  private isElectron(): boolean {
    return !!(window && ((window as any).electronAPI || (window as any).electron));
  }

  // ─── EXECUTE PRINT ────────────────────────────────────────────────

  private async executePrint(title: string, htmlContent: string | ((pw: string) => string), options?: { silent?: boolean; openDrawer?: boolean }): Promise<void> {
    let paperWidth = '80mm';

    // Automatic context detection: if called from Admin, silent = false, else silent = true (POS)
    const isPOS = !window.location.hash.toLowerCase().includes('admin') && !window.location.pathname.toLowerCase().includes('admin');
    const silent = options?.silent ?? isPOS;

    console.log(`🖨️ [PrintService] Iniciando impresión de "${title}" | Silencioso: ${silent} | Es POS: ${isPOS}`);

    // 1. Determine paperWidth if possible
    const sysPrinter = await this.getSystemPrinter();
    const netPrinter = await this.getNetworkPrinter();

    if (sysPrinter) paperWidth = sysPrinter.paperWidth;
    else if (netPrinter) paperWidth = netPrinter.paperWidth;

    const html = typeof htmlContent === 'function' ? htmlContent(paperWidth) : htmlContent;

    // PrintNode (cloud) - Se ejecuta en TODOS los entornos (Web, Móvil, Tablet, Desktop)
    if (this.settings?.printnode_enabled && this.settings?.printnode_printer_id) {
      console.log('☁️ [PrintService] PrintNode habilitado. Intentando imprimir vía nube...');
      if (!printNodeService.isEnabled) await printNodeService.init();
      const ok = await printNodeService.printHtml(this.settings.printnode_printer_id, title, html);
      if (ok) { console.log('✅ [PrintService] Impresión exitosa vía PrintNode'); return; }
      console.warn('⚠️ [PrintService] Falló PrintNode, intentando local/red...');
    }

    // Web/Mobile → browser dialog
    if (!this.isElectron()) {
      console.log('🌐 [PrintService] Entorno Web detectado. Abriendo diálogo de impresión del navegador.');
      this.openPrintWindow(html);
      return;
    }

    const electron = (window as any).electronAPI || (window as any).electron;
    console.log('🖥️ [PrintService] Entorno Electron detectado.');

    // SYSTEM printer (Windows driver)
    if (electron && electron.printHtml) {
      if (sysPrinter) {
        console.log(`📠 [PrintService] Intentando impresora de sistema: "${sysPrinter.name}"`);
        const r = await electron.printHtml(html, sysPrinter.name, silent);
        if (r.success) {
          console.log('✅ [PrintService] Impresión exitosa vía driver de sistema');
          return;
        }
        console.warn(`❌ [PrintService] Error en impresora de sistema:`, r.error);
      } else {
        console.warn('⚠️ [PrintService] No hay impresora de sistema configurada en la tabla "printers".');
      }
    }

    // NETWORK printer (TCP)
    // ESTRATEGIA HÍBRIDA: Diseño Windows + Apertura IP
    if (electron && (electron.printToNetwork || electron.openCashDrawer)) {
      if (netPrinter) {
        // Determinamos si REALMENTE debemos abrir el cajón (parámetro manda sobre config de impresora)
        const shouldOpenDrawer = options?.openDrawer === true;

        // 1. APERTURA VELOZ: Solo si el parámetro es estrictamente TRUE
        if (shouldOpenDrawer) {
          console.log(`⚡ [PrintService] Apertura veloz de gaveta vía IP: ${netPrinter.address}`);
          electron.openCashDrawer({ target: netPrinter.address, type: 'NETWORK' });
        }

        // 2. IMPRESIÓN DE DISEÑO
        if (electron.printHtml) {
          console.log(`🎨 [PrintService] Usando diseño de Windows para impresora de red`);
          // Pasamos silent: true siempre en el POS para evitar diálogos
          const r = await electron.printHtml(html, netPrinter.name, silent);
          if (r.success) return;
        }

        // 3. FALLBACK RAW: Si todo lo anterior falla, usamos el modo IP clásico (rápido pero diseño básico)
        console.log(`🌐 [PrintService] Usando modo RAW por IP: ${netPrinter.address}:${netPrinter.port}`);
        const shouldOpenDrawerRaw = options?.openDrawer !== undefined ? options.openDrawer : !!netPrinter.opens_cash_drawer;
        const rawContent = this.htmlToEscPos(html, { openDrawer: shouldOpenDrawerRaw, paperWidth: netPrinter.paperWidth });

        const r = await electron.printToNetwork(netPrinter.address, netPrinter.port, rawContent, true);
        if (r.success) {
          console.log('✅ [PrintService] Impresión exitosa vía red TCP (RAW)');
          return;
        }
        console.warn('❌ [PrintService] Error en impresión de red:', r.error);
      }
    }

    // Saved local printer fallback (Last resort for Electron)
    if (electron && electron.printHtml) {
      const saved = localStorage.getItem('pos_printer_name');
      const pName = saved && saved !== 'null' ? saved : undefined;
      console.log(`💾 [PrintService] Intentando fallback con impresora guardada en localStorage: ${pName || 'PREDETERMINADA'}`);
      const r = await electron.printHtml(html, pName, silent);
      if (r.success) {
        console.log('✅ [PrintService] Impresión exitosa vía fallback local');
        return;
      }
      console.warn('❌ [PrintService] Fallback local también falló:', r.error);
    }

    // Ultimate fallback (Open Window)
    console.warn('🚨 [PrintService] Todos los métodos fallaron. Forzando ventana de impresión del navegador.');
    this.openPrintWindow(html);
  }

  async openCashDrawer(data?: { orderId?: string; userId?: string; userName?: string; amount?: number; reason?: string }): Promise<void> {
    try {
      // 1. Audit Log in Supabase
      if (data?.userId && data?.userName) {
        const { error } = await supabase.from('cash_drawer_logs').insert([{
          user_id: data.userId,
          user_name: data.userName,
          order_id: data.orderId || null,
          amount: data.amount || 0,
          reason: data.reason || 'Apertura Manual'
        }]);
        if (error) console.error('Error logging cash drawer opening:', error);
      }

      // 2. Local ESC/POS (Electron)
      const electron = (window as any).electronAPI || (window as any).electron;
      if (this.isElectron() && electron && electron.openCashDrawer) {
        let { data: drawerPrinter } = await supabase
          .from('printers')
          .select('name, address, connection_type')
          .eq('opens_cash_drawer', true)
          .eq('is_active', true)
          .limit(1)
          .single();

        if (!drawerPrinter) {
          const { data: fallbackPrinter } = await supabase
            .from('printers')
            .select('name, address, connection_type')
            .eq('is_active', true)
            .limit(1)
            .single();
          drawerPrinter = fallbackPrinter;
        }

        let target = undefined;
        let type = undefined;

        if (drawerPrinter) {
          target = drawerPrinter.connection_type === 'NETWORK' ? drawerPrinter.address : drawerPrinter.name;
          type = drawerPrinter.connection_type;
        }

        // Eliminamos el delay de 300ms para que la apertura sea instantánea
        await electron.openCashDrawer({ target, type });
      }
    } catch (e) {
      console.error('Error in openCashDrawer:', e);
    }
  }

  async printToSpecificIP(ip: string, html: string): Promise<boolean> {
    const electron = (window as any).electronAPI || (window as any).electron;
    if (!electron || !electron.printToNetwork) return false;
    try {
      const r = await electron.printToNetwork(ip, 9100, html);
      return r.success;
    } catch { return false; }
  }

  // ─── REQUEST REMOTE PRINT (Tablet → Caja) ────────────────────────

  async requestPreCheckPrint(orderId: string): Promise<void> {
    try {
      console.log('📡 Requesting remote pre-check print for order:', orderId);
      await supabase.from('orders').update({
        print_status: 'pre_check_pending',
        requires_printing: true
      }).eq('id', orderId);
    } catch (e) {
      console.error('Error requesting pre-check print:', e);
    }
  }

  // ─── KITCHEN TICKET ───────────────────────────────────────────────

  async printKitchenTicket(data: TicketData, targetInfo?: { type: 'SYSTEM' | 'NETWORK'; target: string; paperWidth: string }): Promise<boolean> {
    // ═══ KITCHEN PRINTING DISABLED — KDS replaces physical tickets ═══
    console.log('🖨️ Kitchen print skipped (KDS active). Order:', data.orderNumber);
    return true;

    /* 
    if (!this.settings) await this.loadSettings();
    const content = `
      <div class="info-grid">
        <div class="info-line"><span class="info-label">ORDEN:</span> #${data.orderNumber || '---'}</div>
        <div class="info-line"><span class="info-label">MESA:</span> ${data.tableNumber || 'RAP'}</div>
        <div class="info-line"><span class="info-label">MESERO:</span> ${data.waiterName || '---'}</div>
        <div class="info-line"><span class="info-label">HORA:</span> ${new Date(data.createdAt).toLocaleTimeString()}</div>
      </div>
      <div class="thick-divider"></div>
      ${data.items.map(item => `
        <div class="item-row">
          <span class="qty">${item.quantity}</span>
          <span class="description">${item.name.toUpperCase()}</span>
        </div>
        ${(item.notes && item.notes.replace('*NO IMPRIMIR*', '').trim()) ? '<div class="note">(' + item.notes.replace('*NO IMPRIMIR*', '').trim() + ')</div>' : ''}
      `).join('')}
      <div class="divider"></div>
      <div style="text-align:center; font-size:10px;">ID: ${data.orderId.substring(0, 8)}</div>
    `;
    const paperWidth = targetInfo?.paperWidth || '80mm';
    const html = this.generateTicketHTML('COMANDA COCINA', content, undefined, paperWidth);

    // If target info is provided, use it
    if (targetInfo) {
      if (targetInfo.type === 'NETWORK') {
        return await this.printToSpecificIP(targetInfo.target, html);
      } else if (targetInfo.type === 'SYSTEM') {
        if (electron && electron.printHtml) {
          const r = await electron.printHtml(html, targetInfo.target, true); // Kitchen is always silent
          return r.success;
        }
      }
    }

    // Otherwise use default logic
    await this.executePrint('COMANDA COCINA', (pw) => this.generateTicketHTML('COMANDA COCINA', content, undefined, pw), { silent: true });
    return true;
    */
  }

  // ─── PRE-ACCOUNT TICKET ───────────────────────────────────────────

  async printPreAccountTicket(data: TicketData & {
    customerName?: string;
    orderType?: string;
    paymentMethod?: string;
    customerPhone?: string;
    deliveryAddress?: string;
    driverName?: string;
  }, options?: PrintOptions): Promise<void> {
    if (!this.settings) await this.loadSettings();

    const content = `
      <div class="info-grid" style="grid-template-columns: 65% 35%; margin-top: 5px; margin-bottom: 10px;">
        <div class="info-line"><span>Fecha:</span> ${new Date(data.createdAt).toLocaleString('es-GT', { dateStyle: 'short', timeStyle: 'medium' })}</div>
        <div class="info-line"><span>Orden:</span> ${data.orderNumber || '---'}</div>
        
        <div class="info-line"><span>Sección:</span> ${data.tableName || '---'}</div>
        <div class="info-line"><span>Mesa:</span> ${data.tableNumber || '---'}</div>
        
        <div class="info-line" style="grid-column: span 2;"><span>Atendió:</span> ${data.waiterName || '---'}</div>
        <div class="info-line" style="grid-column: span 2;"><span>Cuenta:</span> ${data.customerName?.toUpperCase() === 'TODAS LAS CUENTAS' ? 'Cuenta Completa' : (data.customerName || 'Cuenta 1')}</div>
      </div>

      <table>
        <tr class="item-row" style="border-bottom:1px dashed #000;">
          <td class="col-qty qty" style="padding-bottom: 4px;">Cant.</td>
          <td class="col-desc description" style="padding-bottom: 4px;">Descripción</td>
          <td class="col-price price" style="padding-bottom: 4px; text-align: right;">Total</td>
        </tr>
        ${data.items.map(item => `
          <tr class="item-row">
            <td class="col-qty qty" style="text-align: center;">${item.quantity}</td>
            <td class="col-desc">
              <div class="description">${item.name.toUpperCase()}</div>
              ${(item.notes && item.notes.replace('*NO IMPRIMIR*', '').trim()) ? `<div class="note">${item.notes.replace('*NO IMPRIMIR*', '').trim()}</div>` : ''}
            </td>
            <td class="col-price price" style="text-align: right;">Q${((item.price || 0) * item.quantity).toFixed(2)}</td>
          </tr>
        `).join('')}
      </table>

      <div class="dotted-divider"></div>

      <div class="totals-container" style="display: flex; flex-direction: column; align-items: flex-end; width: 100%;">
        <div style="display: flex; margin-bottom: 3px;">
          <div style="text-align: right; width: 80px; margin-right: 10px;">Sub-Total:</div>
          <div style="text-align: right; width: 65px;">Q${(data.subtotal || 0).toFixed(2)}</div>
        </div>
        <div style="display: flex; margin-bottom: 3px;">
          <div style="text-align: right; width: 80px; margin-right: 10px;">Otros:</div>
          <div style="text-align: right; width: 65px;">Q0.00</div>
        </div>
        <div style="display: flex; margin-bottom: 3px;">
          <div style="text-align: right; width: 80px; margin-right: 10px;">Propina:</div>
          <div style="text-align: right; width: 65px;">Q${(data.tipAmount || 0).toFixed(2)}</div>
        </div>
        <div style="display: flex; margin-top: 5px; font-size: 13px;">
          <div style="text-align: right; width: 80px; margin-right: 10px;">Total:</div>
          <div style="text-align: right; width: 65px;">Q${(data.total || 0).toFixed(2)}</div>
        </div>
      </div>

      <div class="dotted-divider"></div>

      <div style="display: flex; align-items: center; margin-top: 8px;">
        <span style="margin-right: 5px;">Nit:</span>
        <div style="flex-grow: 1; border: 1px solid #000; height: 20px;"></div>
      </div>

      <div style="margin-top: 8px;">
        <div style="margin-bottom: 2px;">Nombre / Dirección</div>
        <div style="border: 1px solid #000; height: 40px;"></div>
      </div>

      <div style="text-align:center; font-size:8.5px; margin-top:20px; font-weight:bold;">
        *** Esto no es un documento contable. ***
      </div>
    `;

    // Pasamos un string vacío en el título para que no se genere la caja gruesa ni el título de "PRE-CUENTA", dejando solo el "dotted-divider" superior original.
    await this.executePrint('', (pw) => this.generateTicketHTML('', content, 'Gracias por preferirnos.', pw), {
      silent: options?.silent ?? true,
      openDrawer: options?.openDrawer ?? false
    });
  }


  // ─── CREDIT PAYMENT RECEIPT (ABONO) ────────────────────────────────

  async printCreditPaymentReceipt(data: {
    customerName: string;
    previousBalance: number;
    amountPaid: number;
    paymentMethod: string;
    newBalance: number;
    receivedBy?: string;
  }, options?: PrintOptions): Promise<void> {
    if (!this.settings) await this.loadSettings();

    const isEfectivo = data.paymentMethod === 'EFECTIVO' ? data.amountPaid : 0;
    const isTarjeta = data.paymentMethod === 'TARJETA' ? data.amountPaid : 0;
    const isOtros = data.paymentMethod === 'OTROS' ? data.amountPaid : 0;

    const content = `
      <div class="thick-divider"></div>
      
      <div class="info-grid">
        <div class="info-line" style="grid-column: span 2;"><span>FECHA:</span> ${new Date().toLocaleString('es-GT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })}</div>
        <div class="info-line" style="grid-column: span 2; margin-top: 5px;"><span>RECIBÍ DE:</span> <span style="font-weight: bold; text-transform: uppercase;">${data.customerName}</span></div>
      </div>

      <div class="divider"></div>

      <div class="totals-container" style="margin-left: auto; width: 85%;">
        <div class="total-line"><span class="total-label">Saldo Anterior:</span> <span class="total-value text-right">Q${data.previousBalance.toFixed(2)}</span></div>
        <div class="total-line"><span class="total-label">Abono Efectivo:</span> <span class="total-value text-right">Q${isEfectivo.toFixed(2)}</span></div>
        <div class="total-line"><span class="total-label">Abono Tarjeta:</span> <span class="total-value text-right">Q${isTarjeta.toFixed(2)}</span></div>
        <div class="total-line"><span class="total-label">Abonos Otros:</span> <span class="total-value text-right">Q${isOtros.toFixed(2)}</span></div>
        
        <div class="divider" style="margin: 5px 0;"></div>
        
        <div class="total-line" style="font-weight: bold; font-size: 14px;"><span class="total-label">Nuevo Saldo:</span> <span class="total-value text-right">Q${data.newBalance.toFixed(2)}</span></div>
      </div>

      <div class="divider"></div>

      <div style="margin-top: 60px; text-align: center; border-top: 1px solid #000; width: 70%; margin-left: auto; margin-right: auto;">
        <div style="font-size: 10px; margin-top: 5px;">(f) __________________________________</div>
        <div style="font-weight: bold; font-size: 11px; margin-top: 5px; text-transform: uppercase;">${data.receivedBy || 'ADMINISTRACIÓN'}</div>
      </div>
    `;

    await this.executePrint('RECIBO DE ABONO', (pw) => this.generateTicketHTML('RECIBO DE ABONO', content, 'Gracias por su abono.', pw), {
      silent: options?.silent ?? true,
      openDrawer: true // Open drawer for payments
    });
  }

  // ─── INVOICE TICKET (FEL) ─────────────────────────────────────────

  async printInvoiceTicket(data: any): Promise<void> {
    if (!this.settings) await this.loadSettings();

    // Si es contingencia (no tiene dteInfo) y no es una anulación ni reimpresión, no imprimir para ahorrar papel
    if (!data.dteInfo && !data.isCancelled && !data.isReprint) {
      console.log('Skipping physical print for contingency invoice to save paper.');
      return;
    }

    let title = 'FACTURA FEL';
    if (data.isCancelled) title = 'ANULACIÓN FACTURA';
    else if (data.isReprint) title = 'COMPROBANTE DE PAGO';
    await this.executePrint(title, (pw) => this.generateInvoiceHTML(data, pw), { silent: true });
  }

  private generateInvoiceHTML(data: any, paperWidth: string = '80mm'): string {
    const legalTotal = (data.subtotal || 0) + (data.taxAmount || 0);
    const qrUrl = data.dteInfo
      ? 'https://report.feel.com.gt/ingfacereport/ingfacereport_documento?uuid=' + data.dteInfo.autorizacion + '&formato=pdf&tipo_operacion=CERTIFICACION'
      : '';
    const qrImg = qrUrl
      ? '<div style="text-align:center;margin:10px 0;"><img src="https://quickchart.io/qr?text=' + encodeURIComponent(qrUrl) + '&size=200" style="width:130px;height:130px;"/></div>'
      : '';

    const content = `
      ${data.isCancelled ? '<div style="text-align:center;color:red;font-weight:bold;margin-bottom:10px;font-size:12px;border:2px solid red;padding:5px;">ANULADA: ' + (data.cancellationReason || 'ERROR EN POS') + '</div>' : ''}
      ${data.dteInfo ? `
        <div class="info-grid">
          <div class="info-line" style="grid-column: span 2;"><span>Serie:</span> ${data.dteInfo.serie}</div>
          <div class="info-line" style="grid-column: span 2;"><span>Número:</span> ${data.dteInfo.numero}</div>
          <div class="info-line" style="grid-column: span 2;"><span>Fecha:</span> ${data.dteInfo.fechaCertificacion}</div>
        </div>
        <div style="font-size:9px; word-break:break-all; margin-bottom:8px; text-align:center;">
          <span style="font-weight:bold;">UUID:</span><br>${data.dteInfo.autorizacion}
        </div>
      ` : '<div style="text-align:center;font-weight:bold;margin:10px 0;">*** MODO CONTINGENCIA ***</div>'}
      <div class="divider"></div>
      <div style="font-size:11px; margin-bottom:10px;">
        <div class="info-line"><span>Nit:</span> ${data.customerNit || 'CF'}</div>
        <div class="info-line"><span>Nombre:</span> ${data.customerName || 'Consumidor Final'}</div>
      </div>
      <div class="divider"></div>
      
      <table>
        <tr class="item-row" style="font-weight:bold; border-bottom:1px solid #000;">
          <td class="col-qty qty">CANT.</td>
          <td class="col-desc description">DESCRIPCIÓN</td>
          <td class="col-price price">TOTAL</td>
        </tr>
        ${(data.items || []).map((item: any) => `
          <tr class="item-row">
            <td class="col-qty qty">${item.quantity}</td>
            <td class="col-desc">
              <div class="description">${item.name.toUpperCase()}</div>
            </td>
            <td class="col-price price">Q${((item.price || 0) * item.quantity).toFixed(2)}</td>
          </tr>
        `).join('')}
      </table>

      <div class="divider"></div>
      <div class="totals-container">
        <div class="total-line"><span>Sub-Total:</span> <span>Q${(data.subtotal || 0).toFixed(2)}</span></div>
        <div class="total-line"><span>Impuesto:</span> <span>Q${(data.taxAmount || 0).toFixed(2)}</span></div>
        ${data.paymentMethod === 'TARJETA' && data.tipAmount > 0
        ? `<div class="total-line"><span>Propina:</span> <span>Q${data.tipAmount.toFixed(2)}</span></div>
             <div class="total-line grand-total"><span>Total:</span> <span>Q${(legalTotal + data.tipAmount).toFixed(2)}</span></div>`
        : `<div class="total-line grand-total"><span>Total:</span> <span>Q${legalTotal.toFixed(2)}</span></div>
             ${data.tipAmount > 0 ? '<div class="total-line" style="font-style:italic;margin-top:5px;font-size:9px;"><span>Propina (Exenta de IVA):</span> <span>Q' + data.tipAmount.toFixed(2) + '</span></div>' : ''}`
      }
      </div>
      <div class="divider"></div>
      <div style="text-align:center;margin-top:10px;font-size:9px;">
        <div style="font-weight:bold;">DOCUMENTO TRIBUTARIO ELECTRÓNICO</div>
        <div style="margin-top:2px;">${this.restaurantInfo?.invoice_phrases || ''}</div>
        <div style="margin-top:2px;">${this.restaurantInfo?.certifier_legend || ''}</div>
      </div>
      ${qrImg}
      <div style="text-align:center;font-size:10px;font-style:italic;">
        Orden: #${data.orderNumber} | Mesa: ${data.tableNumber}<br>
        ${new Date(data.createdAt).toLocaleString('es-GT')}
      </div>
    `;
    const title = data.isCancelled ? 'FACTURA ANULADA' : (data.dteInfo ? 'FACTURA ELECTRÓNICA' : 'FACTURA EN CONTINGENCIA');
    return this.generateTicketHTML(title, content, '', paperWidth, false, this.restaurantInfo?.commercial_name);
  }

  // ─── DELIVERY TICKET ──────────────────────────────────────────────

  async printDeliveryTicket(data: TicketData & {
    customerName: string;
    customerPhone: string;
    deliveryAddress: string;
    reference?: string;
    driverName?: string;
    notes?: string;
    paymentMethod?: string;
  }): Promise<void> {
    if (!this.settings) await this.loadSettings();
    const currentSubtotal = (data.items || []).reduce((acc, i) => acc + ((i.price || 0) * i.quantity), 0);
    const content = `
      <div class="info-grid">
        <div class="info-line"><span>Fecha:</span> ${new Date().toLocaleString('es-GT', { dateStyle: 'short', timeStyle: 'short' })}</div>
        <div class="info-line" style="text-align: right;"><span>Orden:</span> #${data.orderNumber || data.orderId.substring(0, 8)}</div>
        <div class="info-line" style="grid-column: span 2;"><span>Cliente:</span> ${data.customerName.toUpperCase()}</div>
        <div class="info-line" style="grid-column: span 2;"><span>Teléfono:</span> ${data.customerPhone}</div>
      </div>
      <div style="font-weight: bold; font-size: 11px; margin-top: 5px;">Dirección de Entrega:</div>
      <div style="font-size:12px;font-weight:bold;border:2px solid #000;padding:6px;margin:5px 0;">
        ${data.deliveryAddress.toUpperCase()}
        ${data.reference ? '<br><span style="font-size:10px; font-weight:normal;">REF: ' + data.reference.toUpperCase() + '</span>' : ''}
      </div>
      <div class="divider"></div>
      
      <table>
        <tr class="item-row" style="font-weight:bold; border-bottom:1px solid #000;">
          <td class="col-qty qty">CANT.</td>
          <td class="col-desc description">DESCRIPCIÓN</td>
          <td class="col-price price">TOTAL</td>
        </tr>
        ${data.items.map((item: any) => `
          <tr class="item-row">
            <td class="col-qty qty">${item.quantity}</td>
            <td class="col-desc">
              <div class="description">${item.name.toUpperCase()}</div>
              ${(item.notes && item.notes.replace('*NO IMPRIMIR*', '').trim()) ? `<div class="note">(${item.notes.replace('*NO IMPRIMIR*', '').trim()})</div>` : ''}
            </td>
            <td class="col-price price">Q${((item.price || 0) * item.quantity).toFixed(2)}</td>
          </tr>
        `).join('')}
      </table>

      <div class="divider"></div>
      <div class="totals-container">
        <div class="total-line grand-total"><span>Total:</span> <span>Q${(data.total || currentSubtotal).toFixed(2)}</span></div>
      </div>
      ${data.paymentMethod ? '<div class="divider"></div><div style="font-size:11px;font-weight:bold;background:#eee;padding:5px;text-align:center;border:1px solid #000;">PAGO: ' + data.paymentMethod.toUpperCase().replace(/\n/g, ' ') + '</div>' : ''}
      ${data.driverName ? '<div class="divider"></div><div style="font-weight:bold;text-align:center;">Motorista: ' + data.driverName + '</div>' : ''}
      <div style="text-align:center;font-size:11px;margin-top:20px;font-weight:bold;">*** COMPROBANTE DE ENTREGA ***</div>
    `;
    await this.executePrint('TICKET DOMICILIO', (pw) => this.generateTicketHTML('ORDEN DOMICILIO', content, '¡Gracias por su compra!', pw), { silent: true });
  }

  // ─── CANCELLED TICKET ─────────────────────────────────────────────

  async printCancelledTicket(data: any, reason: string): Promise<void> {
    if (!this.settings) await this.loadSettings();

    let serviceType = 'MESA';
    if (data.orderType === 'TAKEOUT') serviceType = 'PARA LLEVAR';
    else if (data.orderType === 'DELIVERY') serviceType = 'A DOMICILIO';
    else if (data.orderType === 'FAST_FOOD') serviceType = 'VENTA RÁPIDA';

    const content = `
      <div style="text-align:center; border:2px solid #000; padding:8px; margin-bottom:15px;">
        <div style="font-size:16px; font-weight:900; letter-spacing: 1px;">ORDEN ANULADA</div>
        <div style="font-size:12px; margin-top:5px; font-weight:bold;">ORDEN #${data.orderNumber}</div>
      </div>
      
      <div class="info-grid">
        <div class="info-line"><span>SERVICIO:</span> ${serviceType}</div>
        <div class="info-line" style="text-align: right;"><span>MESA:</span> ${data.tableNumber || '---'}</div>
        <div class="info-line"><span>HORA:</span> ${new Date(data.createdAt).toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit' })}</div>
        <div class="info-line" style="text-align: right;"><span>FECHA:</span> ${new Date().toLocaleString('es-GT', { dateStyle: 'short', timeStyle: 'short' })}</div>
        
        ${data.customerName ? `<div class="info-line" style="grid-column: span 2;"><span>CLIENTE:</span> ${data.customerName.toUpperCase() === 'TODAS LAS CUENTAS' ? 'CUENTA COMPLETA' : data.customerName.toUpperCase()}</div>` : ''}
        ${data.customerPhone ? `<div class="info-line" style="grid-column: span 2;"><span>TELÉFONO:</span> ${data.customerPhone}</div>` : ''}
        ${data.deliveryAddress ? `<div class="info-line" style="grid-column: span 2; font-weight: bold; border: 1px solid #000; padding: 4px; margin-top: 5px;"><span>DIRECCIÓN:</span> ${data.deliveryAddress.toUpperCase()}</div>` : ''}
      </div>

      <div class="thick-divider"></div>

      <div style="font-size:10px; font-weight:bold; color:#cc0000; margin-bottom:5px; text-transform:uppercase;">Motivo de Anulación:</div>
      <div style="font-size:12px; font-weight:bold; background:#f9f9f9; padding:8px; border:1px solid #000; margin-bottom:15px;">
        ${reason.toUpperCase()}
      </div>

      <div style="font-size:10px; font-weight:bold; margin-bottom:5px; text-transform:uppercase;">PLATILLOS ANULADOS:</div>
      <table>
        <tr class="item-row" style="font-weight:bold; border-bottom:1px solid #000;">
          <td class="col-qty qty">CANT.</td>
          <td class="col-desc description">DESCRIPCIÓN</td>
        </tr>
        ${(data.items || []).map((item: any) => `
          <tr class="item-row">
            <td class="col-qty qty">${item.quantity}</td>
            <td class="col-desc description">${(item.name || item.product_name || 'PRODUCTO').toUpperCase()}</td>
          </tr>
        `).join('')}
      </table>

      <div style="text-align:center; font-size:9px; font-style:italic; margin-top:20px; border-top: 1px dotted #000; padding-top: 8px;">
        DOCUMENTO DE CONTROL INTERNO<br>
        <strong>NO VÁLIDO COMO FACTURA</strong>
      </div>
    `;
    await this.executePrint('AVISO ANULACION', (pw) => this.generateTicketHTML('ANULACIÓN', content, '', pw), { silent: true });
  }

  // ─── VOID TICKET (Single Item) ────────────────────────────────────

  async printVoidTicket(data: {
    waiterName: string;
    cashierName: string;
    sectionName: string;
    tableNumber: string | number;
    productName: string;
    quantity: number;
    voidReason: string;
    voidedAt: string;
    orderNumber?: string | number;
  }): Promise<boolean> {
    const content = `
      <div style="text-align:center; margin-bottom:10px;">
        <div style="font-size:16px; font-weight:900; letter-spacing: 1px;">PLATILLO ANULADO</div>
        ${data.orderNumber ? `<div style="font-size:11px; margin-top:2px; font-weight:bold;">ORDEN #${data.orderNumber}</div>` : ''}
      </div>
      
      <div class="info-grid">
        <div class="info-line"><span>CAJERO:</span> ${data.cashierName.toUpperCase()}</div>
        <div class="info-line" style="text-align: right;"><span>MESA:</span> ${data.tableNumber}</div>
        <div class="info-line"><span>MESERO:</span> ${data.waiterName.toUpperCase()}</div>
        <div class="info-line" style="text-align: right;"><span>SECCIÓN:</span> ${data.sectionName.toUpperCase()}</div>
        <div class="info-line" style="grid-column: span 2;"><span>HORA:</span> ${data.voidedAt}</div>
      </div>

      <div class="thick-divider"></div>
      
      <div style="font-size:10px; font-weight:bold; color:#cc0000; margin-bottom:5px; text-transform:uppercase;">Detalle de Eliminación:</div>
      <table>
        <tr class="item-row">
          <td class="col-qty qty" style="font-size:18px;">${data.quantity}x</td>
          <td class="col-desc description" style="font-size:15px;">${data.productName.toUpperCase()}</td>
        </tr>
      </table>

      <div class="divider"></div>
      
      <div style="font-size:10px; font-weight:bold; color:#cc0000; margin-bottom:5px; text-transform:uppercase;">Motivo de Anulación:</div>
      <div style="font-size:13px; font-weight:bold; background:#f9f9f9; padding:10px; border:1px solid #000;">
        ${data.voidReason.toUpperCase()}
      </div>

      <div style="text-align:center; font-size:9px; font-style:italic; margin-top:30px; border-top: 1px dotted #000; padding-top: 8px;">
        DOCUMENTO DE CONTROL INTERNO<br>
        <strong>REST. LAS PALMAS POS</strong>
      </div>
    `;
    const title = 'ANULACIÓN DE PRODUCTO';
    const htmlContent = (pw: string) => this.generateTicketHTML('', content, undefined, pw, true);

    await this.executePrint(title, htmlContent, { silent: true });
    return true;
  }

  // ─── CREDIT VOUCHER TICKET ────────────────────────────────────────

  async printCreditVoucher(data: {
    orderNumber: string | number;
    tableNumber: string | number;
    waiterName: string;
    customerName: string;
    items: any[];
    subtotal: number;
    tipAmount: number;
    total: number;
    discountAmount: number;
    newBalance: number;
    otherPaymentsAmount: number;
  }): Promise<void> {
    if (!this.settings) await this.loadSettings();
    const fmt = (val: number) => 'Q' + Number(val || 0).toFixed(2);

    const content = `
      <div style="text-align:center; border:2px solid #000; padding:8px; margin-bottom:15px;">
        <div style="font-size:16px; font-weight:900; letter-spacing: 1px;">VALE DE CRÉDITO</div>
      </div>
      
      <div class="info-grid">
        <div class="info-line"><span>FECHA:</span> ${new Date().toLocaleDateString('es-GT')}</div>
        <div class="info-line" style="text-align: right;"><span>HORA:</span> ${new Date().toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit' })}</div>
        <div class="info-line"><span>ORDEN:</span> #${data.orderNumber}</div>
        <div class="info-line" style="text-align: right;"><span>MESA:</span> ${data.tableNumber}</div>
        <div class="info-line" style="grid-column: span 2;"><span>MESERO:</span> ${data.waiterName?.toUpperCase()}</div>
        <div class="info-line" style="grid-column: span 2;"><span>CLIENTE:</span> ${data.customerName?.toUpperCase()}</div>
      </div>

      <div class="divider"></div>
      
      <table>
        <tr class="item-row" style="font-weight:bold; border-bottom:1px solid #000;">
          <td class="col-qty qty">CANT.</td>
          <td class="col-desc description">DESCRIPCIÓN</td>
          <td class="col-price price">TOTAL</td>
        </tr>
        ${data.items.map((item: any) => `
          <tr class="item-row">
            <td class="col-qty qty">${item.quantity}</td>
            <td class="col-desc description">${(item.product_name || item.name)?.toUpperCase()}</td>
            <td class="col-price price">${fmt(item.price * item.quantity)}</td>
          </tr>
        `).join('')}
      </table>

      <div class="divider"></div>
      
      <div class="totals-container">
        <div class="total-line"><span>Subtotal:</span> <span>${fmt(data.subtotal)}</span></div>
        ${data.discountAmount > 0 ? `<div class="total-line"><span>Descuento:</span> <span>-${fmt(data.discountAmount)}</span></div>` : ''}
        ${data.tipAmount > 0 ? `<div class="total-line"><span>Propina:</span> <span>${fmt(data.tipAmount)}</span></div>` : ''}
        <div class="thick-divider"></div>
        <div class="total-line grand-total"><span>TOTAL:</span> <span>${fmt(data.total)}</span></div>
      </div>

      <div class="divider" style="margin-top: 15px;"></div>
      <div style="font-size: 11px; font-weight: bold; margin-bottom: 5px;">ESTADO DE CUENTA:</div>
      <div class="info-grid" style="font-size: 11px;">
        <div class="info-line"><span>NUEVO SALDO:</span></div>
        <div class="info-line" style="text-align: right; font-weight: bold; font-size: 12px;">${fmt(data.newBalance)}</div>
      </div>
      
      <div style="margin-top: 40px; text-align: center;">
        <div>_________________________________</div>
        <div style="font-size: 10px; margin-top: 5px;">Firma del Cliente</div>
      </div>
    `;

    await this.executePrint('VALE DE CREDITO', (pw) => this.generateTicketHTML('VALE DE CRÉDITO', content, 'Comprobante de deuda', pw, false), { silent: true, openDrawer: true });
  }

  // ─── DETAILED EXPENSE TICKET ──────────────────────────────────────

  async printDetailedExpense(expense: any): Promise<void> {
    if (!this.settings) await this.loadSettings();

    const content = `
      <div style="padding-left: 5px; font-size: 11px;">
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 5px;">
          <tr>
            <td style="width: 50%; white-space: nowrap;"><strong>FECHA:</strong> ${expense.date || new Date().toLocaleDateString('es-GT')}</td>
            <td style="width: 50%; white-space: nowrap;"><strong>HORA:</strong> ${expense.time || new Date().toLocaleTimeString('es-GT')}</td>
          </tr>
          <tr>
            <td style="white-space: nowrap;"><strong>NÚMERO:</strong> #${expense.expenseNumber || '1'}</td>
            <td style="white-space: nowrap;"><strong>CAJA:</strong> ${expense.registerName?.toUpperCase().replace('CAJA ', '') || 'PRINCIPAL'}</td>
          </tr>
          <tr>
            <td style="white-space: nowrap;"><strong>TURNO:</strong> ${expense.shiftNumber || '1'}</td>
            <td style="white-space: nowrap;"><strong>CAJERO:</strong> ${expense.cashierName?.split(' ')[0]?.toUpperCase() || 'ADMIN'}</td>
          </tr>
          <tr>
            <td colspan="2" style="padding-top: 3px;"><strong>CATEGORÍA:</strong> ${expense.category?.toUpperCase() || ''}</td>
          </tr>
        </table>
        
        <div class="divider"></div>
        
        <table>
          <tr class="item-row" style="font-weight:bold; border-bottom:1px solid #000;">
            <td class="col-desc description">DESCRIPCIÓN</td>
            <td class="col-price price">MONTO</td>
          </tr>
          ${(expense.items || []).map((item: any) => `
            <tr class="item-row">
              <td class="col-desc description">${item.name}</td>
              <td class="col-price price">Q${Number(item.price).toFixed(2)}</td>
            </tr>
          `).join('')}
        </table>
        
        <div class="thick-divider"></div>
        <div class="grand-total" style="text-align:right;">TOTAL: Q${Number(expense.amount).toFixed(2)}</div>
      </div>
    `;

    // Pasamos 'COMPROBANTE DE GASTO' como título y string vacío como footer
    await this.executePrint('COMPROBANTE DE GASTO', (pw) => this.generateTicketHTML('COMPROBANTE DE GASTO', content, '', pw, true), { silent: true, openDrawer: true });
  }

  // ─── EXPENSES SUMMARY TICKET (SHIFT CLOSURE) ────────────────────

  async printExpensesSummary(data: any, returnHtml: boolean = false): Promise<void | string> {
    if (!this.settings) await this.loadSettings();
    const expenses = data.expenses || [];
    if (expenses.length === 0) return returnHtml ? '' : undefined;

    const fmt = (val: number) => 'Q' + Number(val || 0).toFixed(2);
    const dateStr = (d: string) => { try { return new Date(d).toLocaleString('es-GT', { day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch { return d; } };

    const content = `
      <div style="padding-left: 5px;">
        <div class="info-grid">
          <div class="info-line"><span>Caja:</span> ${data.registerName || 'PRINCIPAL'}</div>
          <div class="info-line" style="text-align: right;"><span>Turno:</span> ${data.shiftNumber || '---'}</div>
          <div class="info-line" style="grid-column: span 2;"><span>Cajero:</span> ${data.cashierName}</div>
        </div>
        
        <div class="thick-divider"></div>
        
        ${expenses.map((exp: any) => `
          <div style="margin-bottom: 10px;">
            <div style="font-size: 11px; font-weight: bold; text-transform: uppercase;">CATEGORÍA: ${exp.category}</div>
            <div class="divider" style="margin: 3px 0;"></div>
            
            <table>
              <tr class="item-row" style="font-weight: bold; font-size: 9px;">
                <td class="col-desc description">GASTO</td>
                <td class="col-price price">TOTAL</td>
              </tr>

              ${Array.isArray(exp.items) && exp.items.length > 0 ?
        exp.items.map((item: any) => `
                  <tr class="item-row">
                    <td class="col-desc description" style="font-size: 9px;">- ${item.name}</td>
                    <td class="col-price price">${fmt(item.price)}</td>
                  </tr>
                `).join('')
        : `
                  <tr class="item-row">
                    <td class="col-desc description" style="font-size: 9px;">- ${exp.description}</td>
                    <td class="col-price price">${fmt(exp.amount)}</td>
                  </tr>
                `
      }
            </table>
            
            <div style="text-align: right; font-weight: bold; border-top: 1px dotted #ccc; margin-top: 4px;">
              Subtotal: ${fmt(exp.amount)}
            </div>
          </div>
        `).join('')}

        <div class="thick-divider"></div>
        <div class="grand-total" style="text-align:right;">TOTAL EGRESOS: ${fmt(data.expensesTotal || 0)}</div>
        
        <div style="text-align:center; font-size:9px; font-style:italic; margin-top:15px;">
          Impreso: ${new Date().toLocaleString('es-GT')}
        </div>
      </div>
    `;

    if (returnHtml) return this.generateTicketHTML('RESUMEN DE GASTOS', content, 'RESUMEN DE GASTOS', '80mm');
    await this.executePrint('RESUMEN DE GASTOS', (pw) => this.generateTicketHTML('RESUMEN DE GASTOS', content, 'RESUMEN DE GASTOS', pw, false), { silent: true });
  }

  // ─── POS CARD RECONCILIATION REPORT ───────────────────────────────

  async printPOSTarjetasReport(data: any, returnHtml: boolean = false): Promise<void | string> {
    if (!this.settings) await this.loadSettings();
    const fmt = (val: number) => 'Q' + Number(val || 0).toFixed(2);
    const dateStr = (d: string) => { try { return new Date(d).toLocaleString('es-GT', { day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch { return d; } };

    const cardTerminals = data.posCardDetail || [];
    const totalCards = cardTerminals.reduce((acc: number, item: any) => acc + (Number(item.total) || 0), 0);

    const content = `
      <div class="info-grid">
        <div class="info-line"><span>Caja:</span> ${data.cashierName?.toUpperCase()}</div>
        <div class="info-line" style="text-align: right;"><span>Turno:</span> ${data.shiftNumber || '---'}</div>
        <div class="info-line" style="grid-column: span 2;"><span>Fecha:</span> ${dateStr(data.endTime)}</div>
      </div>
      
      <div class="divider"></div>
      
      <table>
        <tr class="item-row" style="font-weight:bold; border-bottom:1px solid #000;">
          <td class="col-desc description" style="font-weight:bold; text-align:center;">POS</td>
          <td class="col-price price" style="font-weight:bold; text-align:right;">Total</td>
        </tr>
        ${cardTerminals.map((item: any) => `
          <tr class="item-row">
            <td class="col-desc description" style="text-align:center;">${item.name.toUpperCase()}</td>
            <td class="col-price price" style="text-align:right;">${fmt(item.total)}</td>
          </tr>
        `).join('')}
      </table>
      
      <div class="divider"></div>
      
      <div class="total-line grand-total">
        <span class="total-label">Total</span>
        <span class="total-value">${fmt(totalCards)}</span>
      </div>
    `;

    if (returnHtml) return this.generateTicketHTML('Cuadre POS Tarjetas', content, undefined, '80mm');
    await this.executePrint('CUADRE POS TARJETAS', (pw) => this.generateTicketHTML('Cuadre POS Tarjetas', content, undefined, pw), { silent: true, openDrawer: false });
  }

  // ─── Z REPORT ─────────────────────────────────────────────────────

  async printZReport(data: any, returnHtml: boolean = false): Promise<void | string> {
    if (!this.settings) await this.loadSettings();
    const fmt = (val: number) => 'Q' + Number(val || 0).toFixed(2);
    const dateStr = (d: string) => { try { return new Date(d).toLocaleString('es-GT', { day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch { return d; } };

    const getSalesByMethod = (method: string) => {
      return Number(data.salesByMethod?.find((s: any) => s.method === method)?.amount || 0);
    };
    const getAbonosByMethod = (method: string) => {
      return Number(data.abonosByMethod?.find((s: any) => s.method === method)?.amount || 0);
    };
    const getTipsByMethod = (method: string) => {
      return Number(data.tipsByMethod?.find((s: any) => s.method === method)?.amount || 0);
    };

    const salesEfectivo = getSalesByMethod('EFECTIVO');
    const salesTarjeta = getSalesByMethod('TARJETA');
    const salesCredito = getSalesByMethod('CRÉDITO');
    const salesOtros = getSalesByMethod('OTROS');
    const salesTotalVal = salesEfectivo + salesTarjeta + salesCredito + salesOtros;

    const abonosEfectivo = getAbonosByMethod('EFECTIVO');
    const abonosTarjeta = getAbonosByMethod('TARJETA');
    const abonosOtros = (data.abonosByMethod || []).reduce((acc: number, s: any) => s.method !== 'EFECTIVO' && s.method !== 'TARJETA' ? acc + s.amount : acc, 0);
    const abonosTotal = abonosEfectivo + abonosTarjeta + abonosOtros;

    const tipsEfectivo = getTipsByMethod('EFECTIVO');
    const tipsTarjeta = getTipsByMethod('TARJETA');
    const tipsOtros = getTipsByMethod('OTROS');
    const tipsTotal = tipsEfectivo + tipsTarjeta + tipsOtros;

    const ingresoEfectivo = salesEfectivo + abonosEfectivo + tipsEfectivo;
    const ingresoTarjeta = salesTarjeta + abonosTarjeta + tipsTarjeta;
    const ingresoCredito = salesCredito;
    const ingresoOtros = salesOtros + abonosOtros + tipsOtros;
    const ingresoTotalVal = ingresoEfectivo + ingresoTarjeta + ingresoCredito + ingresoOtros;

    const getChannelAmount = (channelKey: string) => {
      return data.salesByChannel?.find((c: any) => c.channel === channelKey)?.amount || 0;
    };
    const channelRestaurante = getChannelAmount('SERVICIO MESAS');
    const channelLlevar = getChannelAmount('PARA LLEVAR');
    const channelDomicilio = getChannelAmount('A DOMICILIO');
    const channelPlataformas = getChannelAmount('PLATAFORMAS');
    const channelVentaRapida = getChannelAmount('VENTA RÁPIDA');
    const channelTotal = channelRestaurante + channelLlevar + channelDomicilio + channelPlataformas + channelVentaRapida;

    const monedas = [
      { label: 'Q0.01', val: 0.01 },
      { label: 'Q0.05', val: 0.05 },
      { label: 'Q0.10', val: 0.10 },
      { label: 'Q0.25', val: 0.25 },
      { label: 'Q0.50', val: 0.50 },
      { label: 'Q1.00', val: 1.00 },
    ];
    const billetes = [
      { label: 'Q1.00', val: 1.00 },
      { label: 'Q5.00', val: 5.00 },
      { label: 'Q10.00', val: 10.00 },
      { label: 'Q20.00', val: 20.00 },
      { label: 'Q50.00', val: 50.00 },
      { label: 'Q100.00', val: 100.00 },
      { label: 'Q200.00', val: 200.00 },
    ];

    const getCount = (label: string) => {
      if (!data.denominations) return 0;
      if (typeof data.denominations === 'object' && !Array.isArray(data.denominations)) {
        return Number(data.denominations[label] || 0);
      }
      return 0;
    };

    const content = `
      <div class="info-grid">
        <div class="info-line"><span>CAJA:</span> ${(this.restaurantInfo?.name || 'PRINCIPAL').split(' ')[0]}</div>
        <div class="info-line" style="text-align: right;"><span>CAJERO:</span> ${data.cashierName}</div>
        <div class="info-line"><span>APERTURA:</span> ${dateStr(data.startTime)}</div>
        <div class="info-line" style="text-align: right;"><span>CIERRE:</span> ${dateStr(data.endTime)}</div>
      </div>
      <div class="thick-divider"></div>
      <div class="info-grid" style="font-size:10px;">
        <div>Ordenes: ${data.stats?.ordersAttended || 0}</div>
        <div>Borrados: ${data.stats?.deletedPlates || 0}</div>
        <div>Anuladas: ${data.stats?.cancelledOrders || 0}</div>
        <div>Comensales: ${data.stats?.commensals || 0}</div>
        <div>Abiertas: ${data.stats?.openOrders || 0}</div>
      </div>
      
      <div style="text-align:center;font-weight:bold;margin:10px 0 5px 0;border-top:1px solid #000;padding-top:5px;">VENTAS</div>
      <table>
        <tr class="item-row"><td class="description">EFECTIVO:</td><td class="price">${fmt(salesEfectivo)}</td></tr>
        <tr class="item-row"><td class="description">TARJETA:</td><td class="price">${fmt(salesTarjeta)}</td></tr>
        <tr class="item-row"><td class="description">AL CRÉDITO:</td><td class="price">${fmt(salesCredito)}</td></tr>
        <tr class="item-row"><td class="description">OTROS:</td><td class="price">${fmt(salesOtros)}</td></tr>
      </table>
      <div class="total-line">
        <span class="total-label">Total:</span> <span class="total-value">${fmt(salesTotalVal)}</span>
      </div>

      <div style="text-align:center;font-weight:bold;margin:10px 0 5px 0;border-top:1px solid #000;padding-top:5px;">ABONOS A CRÉDITOS</div>
      <table>
        <tr class="item-row"><td class="description">EFECTIVO:</td><td class="price">${fmt(abonosEfectivo)}</td></tr>
        <tr class="item-row"><td class="description">TARJETA:</td><td class="price">${fmt(abonosTarjeta)}</td></tr>
        <tr class="item-row"><td class="description">OTROS:</td><td class="price">${fmt(abonosOtros)}</td></tr>
      </table>
      <div class="total-line">
        <span class="total-label">Total:</span> <span class="total-value">${fmt(abonosTotal)}</span>
      </div>

      <div style="text-align:center;font-weight:bold;margin:10px 0 5px 0;border-top:1px solid #000;padding-top:5px;">PROPINAS</div>
      <table>
        <tr class="item-row"><td class="description">EFECTIVO:</td><td class="price">${fmt(tipsEfectivo)}</td></tr>
        <tr class="item-row"><td class="description">TARJETA:</td><td class="price">${fmt(tipsTarjeta)}</td></tr>
        <tr class="item-row"><td class="description">OTROS:</td><td class="price">${fmt(tipsOtros)}</td></tr>
      </table>
      <div class="total-line">
        <span class="total-label">Total:</span> <span class="total-value">${fmt(tipsTotal)}</span>
      </div>

      <div style="text-align:center;font-weight:bold;margin:10px 0 5px 0;border-top:1px solid #000;padding-top:5px;">INGRESO TOTAL</div>
      <table>
        <tr class="item-row"><td class="description">EFECTIVO:</td><td class="price">${fmt(ingresoEfectivo)}</td></tr>
        <tr class="item-row"><td class="description">TARJETA:</td><td class="price">${fmt(ingresoTarjeta)}</td></tr>
        <tr class="item-row"><td class="description">AL CRÉDITO:</td><td class="price">${fmt(ingresoCredito)}</td></tr>
        <tr class="item-row"><td class="description">OTROS:</td><td class="price">${fmt(ingresoOtros)}</td></tr>
      </table>
      <div class="total-line">
        <span class="total-label">Total:</span> <span class="total-value">${fmt(ingresoTotalVal)}</span>
      </div>

      <div style="text-align:center;font-weight:bold;margin:10px 0 5px 0;border-top:1px solid #000;padding-top:5px;">RESUMEN VENTAS POR CANAL</div>
      <table>
        <tr class="item-row"><td class="description">Restaurante:</td><td class="price">${fmt(channelRestaurante)}</td></tr>
        <tr class="item-row"><td class="description">Para Llevar:</td><td class="price">${fmt(channelLlevar)}</td></tr>
        <tr class="item-row"><td class="description">A Domicilio:</td><td class="price">${fmt(channelDomicilio)}</td></tr>
        <tr class="item-row"><td class="description">Plataformas:</td><td class="price">${fmt(channelPlataformas)}</td></tr>
        ${channelVentaRapida > 0 ? `<tr class="item-row"><td class="description">Venta Rápida:</td><td class="price">${fmt(channelVentaRapida)}</td></tr>` : ''}
      </table>
      <div class="total-line">
        <span class="total-label">Total:</span> <span class="total-value">${fmt(channelTotal)}</span>
      </div>
      
      <div style="text-align:center;font-weight:bold;margin:15px 0 5px 0;border-top:1px solid #000;padding-top:5px;">CUADRE EFECTIVO</div>
      <table>
        <tr class="item-row"><td class="description">(+) INICIAL:</td><td class="price">${fmt(data.cashDetail.initial)}</td></tr>
        <tr class="item-row"><td class="description">(+) VENTAS:</td><td class="price">${fmt(data.cashDetail.sales)}</td></tr>
        <tr class="item-row"><td class="description">(+) ABONOS:</td><td class="price">${fmt(data.cashDetail.abonos)}</td></tr>
        <tr class="item-row"><td class="description">(+) PROPINAS:</td><td class="price">${fmt(data.cashDetail.tips)}</td></tr>
        <tr class="item-row"><td class="description">(-) GASTOS:</td><td class="price">${fmt(data.cashDetail.expenses)}</td></tr>
      </table>
      
      <div class="divider"></div>
      <div class="total-line">
        <span class="total-label">Total Efectivo:</span> <span class="total-value">${fmt(data.cashDetail.total)}</span>
      </div>

      <div style="text-align:center;font-weight:bold;margin:15px 0 5px 0;border-top:1.5px solid #000;padding-top:5px;">CONTEO DE EFECTIVO</div>
      <div style="font-size: 8.5px; margin-bottom: 5px;">
        <table style="width: 100%; table-layout: fixed;">
          <thead>
            <tr style="border-bottom: 1px solid #000; font-weight: bold;">
              <th style="text-align: left; width: 50%; font-size: 8.5px; font-weight: 900;">MONEDAS</th>
              <th style="text-align: left; width: 50%; font-size: 8.5px; font-weight: 900;">BILLETES</th>
            </tr>
          </thead>
          <tbody>
            ${Array.from({ length: Math.max(monedas.length, billetes.length) }).map((_, idx) => {
      const m = monedas[idx];
      const b = billetes[idx];

      const mQty = m ? getCount(m.label) : 0;
      const mTotal = m ? mQty * m.val : 0;

      const bQty = b ? getCount(b.label) : 0;
      const bTotal = b ? bQty * b.val : 0;

      return `
                <tr>
                  <td style="font-size: 8.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding: 1px 0;">
                    ${m ? `${m.label} x${mQty} = Q${mTotal.toFixed(2)}` : ''}
                  </td>
                  <td style="font-size: 8.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding: 1px 0;">
                    ${b ? `${b.label} x${bQty} = Q${bTotal.toFixed(2)}` : ''}
                  </td>
                </tr>
              `;
    }).join('')}
          </tbody>
        </table>
      </div>

      <div class="divider"></div>
      <div class="total-line">
        <span class="total-label">Efec. (Sistema):</span> <span class="total-value">${fmt(data.cashDetail.total)}</span>
      </div>
      <div class="total-line">
        <span class="total-label">Efec. (Caja):</span> <span class="total-value">${fmt(data.countedCash)}</span>
      </div>
      <div class="total-line" style="${data.difference !== 0 ? 'color:red;' : ''}">
        <span class="total-label">Diferencia:</span> <span class="total-value">${data.difference === 0 ? 'CUADRADO' : fmt(data.difference)}</span>
      </div>
      <div style="margin-top:40px;border-top:1px solid #000;text-align:center;font-size:11px;">FIRMA CAJERO: ${data.cashierName}</div>
      ${data.notes ? '<div style="margin-top:20px;border-top:1px dashed #000;padding-top:5px;"><strong>OBSERVACIONES:</strong><br>' + data.notes + '</div>' : ''}
    `;
    if (returnHtml) return this.generateTicketHTML('CIERRE DE CAJA', content, undefined, '80mm');
    await this.executePrint('CIERRE DE CAJA', (pw) => this.generateTicketHTML('CIERRE DE CAJA', content, undefined, pw), { silent: true, openDrawer: true });
  }

  // ─── GENERAL REPORT ───────────────────────────────────────────────

  async printGeneralReport(reportData: any, startDate: string, endDate: string, branchName: string): Promise<void> {
    if (!this.settings) await this.loadSettings();
    const fmt = (val: number) => 'Q' + Number(val || 0).toFixed(2);

    const content = `
      <div style="text-align:center; font-weight:bold; font-size:14px; margin-bottom:10px; border-bottom: 2px solid #000; padding-bottom:5px;">REPORTE GENERAL</div>
      <div class="info-grid">
        <div class="info-line"><span>DEL:</span> ${startDate}</div>
        <div class="info-line" style="text-align: right;"><span>AL:</span> ${endDate}</div>
        <div class="info-line" style="grid-column: span 2;"><span>SUCURSAL:</span> ${branchName.toUpperCase()}</div>
      </div>
      
      <div class="thick-divider"></div>
      <div style="text-align:center;font-weight:bold;margin-bottom:5px;">VENTAS</div>
      <table>
        <tr class="item-row"><td class="description">Efectivo:</td><td class="price">${fmt(reportData.ventas.efectivo)}</td></tr>
        <tr class="item-row"><td class="description">Tarjeta:</td><td class="price">${fmt(reportData.ventas.tarjeta)}</td></tr>
        <tr class="item-row"><td class="description">Al Crédito:</td><td class="price">${fmt(reportData.ventas.credito)}</td></tr>
        <tr class="item-row"><td class="description">Otros:</td><td class="price">${fmt(reportData.ventas.otros)}</td></tr>
      </table>
      <div class="total-line">
        <span class="total-label">TOTAL VENTAS:</span> <span class="total-value">${fmt(reportData.ventas.total)}</span>
      </div>

      <div class="divider"></div>
      <div style="text-align:center;font-weight:bold;margin-bottom:5px;">PROPINAS</div>
      <table>
        <tr class="item-row"><td class="description">Efectivo:</td><td class="price">${fmt(reportData.propinas.efectivo)}</td></tr>
        <tr class="item-row"><td class="description">Tarjeta:</td><td class="price">${fmt(reportData.propinas.tarjeta)}</td></tr>
        <tr class="item-row"><td class="description">Otros:</td><td class="price">${fmt(reportData.propinas.otros)}</td></tr>
      </table>
      <div class="total-line">
        <span class="total-label">TOTAL PROPINAS:</span> <span class="total-value">${fmt(reportData.propinas.total)}</span>
      </div>
      
      <div class="divider"></div>
      <div style="text-align:center;font-weight:bold;margin-bottom:5px;">EGRESOS Y DESCUENTOS</div>
      <table>
        <tr class="item-row"><td class="description">Compras c/Caja:</td><td class="price">${fmt(reportData.egresos.compras)}</td></tr>
        <tr class="item-row"><td class="description">Gastos Mnl.:</td><td class="price">${fmt(reportData.egresos.gastos)}</td></tr>
        <tr class="item-row"><td class="description">Descuentos:</td><td class="price">${fmt(reportData.egresos.descuentos)}</td></tr>
      </table>
      <div class="total-line" style="color:red;">
        <span class="total-label" style="color:#000;">TOTAL EGRESOS:</span> <span class="total-value">${fmt(reportData.egresos.total)}</span>
      </div>

      <div class="thick-divider"></div>
      <div style="text-align:center;font-weight:bold;margin-bottom:5px;">MÉTRICAS</div>
      <div class="info-grid" style="font-size:10px;">
        <div>Atendidas: ${reportData.ordenes.atendidas}</div>
        <div style="text-align:right;">Anuladas: ${reportData.ordenes.anuladas}</div>
        <div style="grid-column: span 2;">Comensales: ${reportData.ordenes.comensales}</div>
      </div>
      <div class="divider"></div>
      <table>
        <tr class="item-row"><td class="description">Ticket Prom. / Orden:</td><td class="price">${fmt(reportData.ticket.porOrden)}</td></tr>
        <tr class="item-row"><td class="description">Ticket Prom. / Pers.:</td><td class="price">${fmt(reportData.ticket.porPersona)}</td></tr>
      </table>
      
      <div style="text-align:center; font-size:9px; font-style:italic; margin-top:20px; border-top:1px dotted #000; padding-top:8px;">
        Impreso el: ${new Date().toLocaleString('es-GT')}
      </div>
    `;

    await this.executePrint('REPORTE GENERAL', (pw) => this.generateTicketHTML('REPORTE', content, undefined, pw), { silent: true });
  }

  // ─── SOLD DISHES REPORT ──────────────────────────────────────────

  async printSoldDishesReport(data: any[], startDate: string, endDate: string, categoryLabel: string): Promise<void> {
    if (!this.settings) await this.loadSettings();

    const content = `
      <div style="text-align:center; margin-bottom:10px;">
        <div style="font-size:12px; font-weight:bold;">REPORTE DE PLATILLOS VENDIDOS</div>
        <div style="font-size:10px;">${categoryLabel}</div>
      </div>
      
      <div style="font-size:10px; margin-bottom:10px;">
        <div><strong>Desde:</strong> ${startDate}</div>
        <div><strong>Hasta:</strong> ${endDate}</div>
      </div>

      <table>
        <tr class="item-row" style="font-weight:bold; border-bottom:1px solid #000;">
          <td class="col-qty qty">CANT.</td>
          <td class="col-desc description">DESCRIPCIÓN</td>
        </tr>
        ${data.map(item => `
          <tr class="item-row">
            <td class="col-qty qty">${item.quantity}</td>
            <td class="col-desc description">${item.name.toUpperCase()}</td>
          </tr>
        `).join('')}
      </table>

      <div class="divider"></div>
      <div style="text-align:right;">
        <div style="font-size:11px; font-weight:bold;">TOTAL UNIDADES: ${data.reduce((acc, curr) => acc + curr.quantity, 0)}</div>
      </div>

      <div style="text-align:center; font-size:9px; font-style:italic; margin-top:20px;">
        Impreso el: ${new Date().toLocaleString('es-GT')}
      </div>
    `;

    await this.executePrint('REPORTE PLATILLOS', (pw) => this.generateTicketHTML('REPORTE COCINA', content, undefined, pw), { silent: true });
  }

  // ─── RECIPE TICKET ───────────────────────────────────────────────

  async printRecipe(productName: string, recipeItems: any[], inventoryItems: any[]): Promise<void> {
    if (!this.settings) await this.loadSettings();

    const content = `
      <div style="text-align:center; margin-bottom:10px;">
        <div style="font-size:12px; font-weight:bold;">RECETA EXACTA</div>
        <div style="font-size:14px; font-weight:900; margin-top:4px;">${productName.toUpperCase()}</div>
      </div>
      
      <div class="divider"></div>
      <table>
        <tr class="item-row" style="font-weight:bold; border-bottom:1px solid #000;">
          <td class="col-desc description">INSUMO</td>
          <td class="col-qty qty">CANT.</td>
          <td style="width:50px; text-align:center;">UNIDAD</td>
        </tr>

        ${recipeItems.map(item => {
      const invItem = inventoryItems.find(i => i.id === item.inventory_item_id);
      const itemName = invItem?.name || 'Insumo desconocido';
      return `
        <tr class="item-row">
          <td class="col-desc description">${itemName.toUpperCase()}</td>
          <td class="col-qty qty">${item.quantity}</td>
          <td style="text-align:center; font-size:9px;">${item.unit_measure.substring(0, 5).toUpperCase()}</td>
        </tr>
        `;
    }).join('')}
      </table>
      <div class="divider"></div>

      <div style="text-align:center; font-size:9px; font-style:italic; margin-top:20px;">
        ${this.restaurantInfo?.name || 'Restaurante Las Palmas'}<br>
        Documento de Control Interno<br>
        Impreso el: ${new Date().toLocaleString('es-GT')}
      </div>
    `;

    await this.executePrint('IMPRESIÓN RECETA', (pw) => this.generateTicketHTML('RECETA INTERNA', content, undefined, pw), { silent: false });
  }

  // ─── CASH DRAWER ──────────────────────────────────────────────────

  // ─── TRADUCTOR QUIRÚRGICO: HTML -> COMANDOS EPSON (ESC/POS)
  public htmlToEscPos(html: string, options: { openDrawer?: boolean; paperWidth?: string } = {}): Uint8Array {
    const ESC = 0x1B;
    const GS = 0x1D;
    const LF = 0x0A;
    const commands: number[] = [];

    // 1. Inicializar impresora
    commands.push(ESC, 0x40);

    // 2. Pulso de gaveta (opcional, al inicio para evitar esperas)
    if (options.openDrawer) {
      commands.push(ESC, 0x70, 0x00, 0x19, 0xFA);
    }

    // 3. Procesar el HTML
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const paperWidth = options.paperWidth === '58mm' ? 32 : 42;

    const walk = (node: Node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        let text = (node.textContent || '')
          .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Quitar acentos
          .replace(/[^\x20-\x7E\x0A\x0D]/g, ""); // Solo ASCII básico

        // Trim text to avoid extra spaces if it's just whitespace between tags
        if (!text.trim() && text.length > 0) return;

        for (let i = 0; i < text.length; i++) {
          commands.push(text.charCodeAt(i));
        }
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as HTMLElement;
        const tagName = el.tagName.toUpperCase();

        // Estilos de texto (Negrita y Tamaño)
        const isBold = el.style.fontWeight === 'bold' || el.style.fontWeight === '900' || ['H1', 'H2', 'H3', 'STRONG', 'B'].includes(tagName) || el.classList.contains('restaurant-name') || el.classList.contains('ticket-title');
        const isBig = tagName === 'H1' || el.classList.contains('restaurant-name') || (el.style.fontSize && parseInt(el.style.fontSize) > 16);
        const isMedium = tagName === 'H2' || tagName === 'H3' || el.classList.contains('ticket-title') || (el.style.fontSize && parseInt(el.style.fontSize) > 12);

        if (isBold) commands.push(ESC, 0x45, 0x01); // Bold ON
        if (isBig) commands.push(GS, 0x21, 0x11); // Double width & height
        else if (isMedium) commands.push(GS, 0x21, 0x01); // Double height

        // Alineación
        const textAlign = el.style.textAlign || (el.classList.contains('header') || el.classList.contains('text-center') || el.classList.contains('restaurant-name') || el.classList.contains('ticket-title') || el.classList.contains('footer') ? 'center' : 'left');
        if (textAlign === 'center') commands.push(ESC, 0x61, 0x01);
        else if (textAlign === 'right') commands.push(ESC, 0x61, 0x02);

        // Caso especial: Separador (HR o clase divider)
        let handledCustom = false;

        if (tagName === 'HR' || el.classList.contains('divider') || el.classList.contains('thick-divider') || el.classList.contains('dotted-divider')) {
          const char = el.classList.contains('thick-divider') ? '=' : (el.classList.contains('dotted-divider') ? '.' : '-');
          const line = char.repeat(paperWidth) + '\n';
          for (let i = 0; i < line.length; i++) commands.push(line.charCodeAt(i));
          handledCustom = true;
        }

        // Caso especial: Grilla de información (info-grid) - Alinear 2 columnas
        else if (el.classList.contains('info-grid')) {
          const children = Array.from(el.children) as HTMLElement[];
          for (let i = 0; i < children.length; i++) {
            const child = children[i];
            const isFullWidth = child.style.gridColumn.includes('span 2') || child.classList.contains('full-width');

            if (isFullWidth || i === children.length - 1) {
              const text = child.textContent?.trim() || '';
              const line = text + '\n';
              for (let j = 0; j < line.length; j++) commands.push(line.charCodeAt(j));
            } else {
              const nextChild = children[i + 1];
              const nextIsFullWidth = nextChild.style.gridColumn.includes('span 2') || nextChild.classList.contains('full-width');

              if (nextIsFullWidth) {
                const text = child.textContent?.trim() || '';
                const line = text + '\n';
                for (let j = 0; j < line.length; j++) commands.push(line.charCodeAt(j));
              } else {
                const leftText = child.textContent?.trim() || '';
                const rightText = nextChild.textContent?.trim() || '';
                const spaceLen = Math.max(1, paperWidth - leftText.length - rightText.length);
                const line = leftText + ' '.repeat(spaceLen) + rightText + '\n';
                for (let j = 0; j < line.length; j++) commands.push(line.charCodeAt(j));
                i++; // Skip next child
              }
            }
          }
          handledCustom = true;
        }

        // Caso especial: Recuadro de datos (Nit/Nombre)
        else if (el.classList.contains('data-box')) {
          const line = '|' + ' '.repeat(paperWidth - 2) + '|\n';
          const topBottom = '+' + '-'.repeat(paperWidth - 2) + '+\n';
          for (let i = 0; i < topBottom.length; i++) commands.push(topBottom.charCodeAt(i));

          const height = parseInt(el.style.height) || 20;
          const linesCount = Math.max(1, Math.floor(height / 15));
          for (let h = 0; h < linesCount; h++) {
            for (let i = 0; i < line.length; i++) commands.push(line.charCodeAt(i));
          }
          for (let i = 0; i < topBottom.length; i++) commands.push(topBottom.charCodeAt(i));
          handledCustom = true;
        }

        // Caso especial: Item de ticket (Item-Row)
        else if (el.classList.contains('item-row')) {
          const descNode = el.querySelector('.description');
          const priceNode = el.querySelector('.price');
          const qtyNode = el.querySelector('.qty');

          const desc = descNode ? descNode.textContent?.trim() || '' : '';
          const price = priceNode ? priceNode.textContent?.trim() || '' : '';
          const qty = qtyNode ? qtyNode.textContent?.trim() : null;

          if (desc || price) {
            const qtyStr = qty !== null ? `${qty.padStart(3)} ` : '';
            const priceStr = price.padStart(8);
            const maxDescLen = Math.max(5, paperWidth - qtyStr.length - priceStr.length);

            const descCorta = desc.length > maxDescLen
              ? desc.substring(0, maxDescLen - 3) + "..."
              : desc.padEnd(maxDescLen);

            let line = qtyStr + descCorta + priceStr + '\n';
            for (let i = 0; i < line.length; i++) commands.push(line.charCodeAt(i));

            handledCustom = true;
          }
        }

        // Caso especial: Total Line
        else if (el.classList.contains('total-line') || el.classList.contains('grand-total')) {
          const isGrand = el.classList.contains('grand-total');
          if (isGrand) {
            commands.push(ESC, 0x45, 0x01); // Bold ON
            commands.push(GS, 0x21, 0x01); // Double height
          }

          const label = el.querySelector('.total-label')?.textContent?.trim() || '';
          const val = el.querySelector('.total-value')?.textContent?.trim() || '';

          if (label && val) {
            const spaceLen = Math.max(1, paperWidth - label.length - val.length);
            const line = label + ' '.repeat(spaceLen) + val + '\n';
            for (let i = 0; i < line.length; i++) commands.push(line.charCodeAt(i));
          } else {
            const text = el.textContent?.trim() || '';
            const spaceLen = Math.max(0, paperWidth - text.length);
            const line = ' '.repeat(spaceLen) + text + '\n';
            for (let i = 0; i < line.length; i++) commands.push(line.charCodeAt(i));
          }

          if (isGrand) {
            commands.push(ESC, 0x45, 0x00); // Bold OFF
            commands.push(GS, 0x21, 0x00); // Normal size
          }
          handledCustom = true;
        }

        if (!handledCustom) {
          for (let i = 0; i < el.childNodes.length; i++) {
            walk(el.childNodes[i]);
          }
        }

        // Resetear estilos para el siguiente elemento
        if (isBig || isMedium) commands.push(GS, 0x21, 0x00); // Font size Normal
        if (isBold) commands.push(ESC, 0x45, 0x00); // Bold OFF
        if (textAlign !== 'left') commands.push(ESC, 0x61, 0x00); // Reset Align

        // Saltos de línea para bloques
        if (['DIV', 'H1', 'H2', 'H3', 'P', 'BR', 'TR'].includes(tagName)) {
          if (!handledCustom) commands.push(LF);
        }
      }
    };

    walk(doc.body);

    // 4. Finalización: Alimentar papel y Cortar
    commands.push(LF, LF, LF, LF, LF); // 5 líneas de avance
    commands.push(GS, 0x56, 0x42, 0x00); // Comando de corte (Full Cut)

    return new Uint8Array(commands);
  }
}

export const printService = new PrintService();
