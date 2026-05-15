import { supabase } from '../supabase';
import { printNodeService } from './PrintNodeService';

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
        };
        this.restaurantInfo = {
          name: data.commercial_name || data.restaurant_name || 'RESTAURANTE LAS PALMAS',
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
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('⚠️ El navegador bloqueó la ventana de impresión. Permite ventanas emergentes para este sitio e intenta de nuevo.');
      return;
    }
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 500);
    };
  }

  // ─── CORE HTML TEMPLATE ───────────────────────────────────────────

  private generateTicketHTML(title: string, content: string, footer?: string, paperWidth: string = '80mm', hideHeader: boolean = false): string {
    const isSmall = paperWidth === '58mm';
    const maxWidth = isSmall ? '48mm' : '68mm';
    const fontSize = isSmall ? '8.5px' : '9.5px';
    const padding = isSmall ? '1mm 2mm 1mm 2mm' : '1mm 4mm 1mm 4mm';

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700;900&display=swap');
    @page { margin: 0; }
    @media print {
      @page { margin: 0; }
      body { margin: 0; padding: 0; }
    }
    * { box-sizing: border-box; }
    body {
      font-family: 'Roboto', 'Segoe UI', Arial, sans-serif;
      font-size: ${fontSize};
      margin: 0;
      padding: ${padding} !important;
      width: ${maxWidth};
      line-height: 1.1;
      letter-spacing: -0.5px;
      color: #000;
      background: #fff;
    }
    .header { text-align: center; margin-bottom: 5px; }
    .restaurant-name { font-size: ${isSmall ? '11px' : '13px'}; font-weight: 900; }
    .restaurant-info { font-size: ${isSmall ? '8px' : '10px'}; line-height: 1.1; font-weight: 500; }
    .ticket-title {
      text-align: center; font-weight: 900; font-size: ${isSmall ? '12px' : '14px'};
      border-top: 1px dashed #000; border-bottom: 1px dashed #000;
      padding: 3px 0; margin: 5px 0; text-transform: uppercase;
      width: 100%;
    }
    .info-grid { display: grid; grid-template-columns: 3fr 2fr; font-size: ${isSmall ? '9.5px' : '11.5px'}; margin: 8px 0; row-gap: 2px; }
    .info-label { font-weight: bold; width: ${isSmall ? '45px' : '65px'}; display: inline-block; }
    .info-line { display: flex; align-items: flex-start; }
    .dotted-divider { border-top: 1px dotted #000; margin: 8px 0; }
    .divider { border-top: 1px dashed #000; margin: 8px 0; }
    .thick-divider { border-top: 2px solid #000; margin: 8px 0; }
    .item-row { display: flex; align-items: flex-start; margin-bottom: 5px; font-size: ${isSmall ? '9px' : '11px'}; }
    .qty { width: 25px; font-weight: 700; }
    .description { flex: 1; font-weight: 600; text-transform: uppercase; }
    .price { width: ${isSmall ? '50px' : '65px'}; text-align: right; font-weight: 700; }
    .note { font-size: ${isSmall ? '8.5px' : '10.5px'}; font-style: italic; margin-left: 20px; margin-top: -3px; }
    .totals-container { margin-top: 10px; }
    .total-line { display: flex; justify-content: flex-end; font-size: ${isSmall ? '10.5px' : '12.5px'}; margin-bottom: 1px; }
    .total-label { width: ${isSmall ? '65px' : '85px'}; text-align: right; margin-right: 15px; }
    .total-value { width: ${isSmall ? '50px' : '60px'}; text-align: right; font-weight: 700; }
    .grand-total { font-size: ${isSmall ? '12px' : '15px'}; font-weight: 900; padding-top: 4px; border-top: 1px solid #000; margin-top: 4px; }
    .data-box { border: 1px solid #000; margin-top: 5px; padding: 2px; min-height: 30px; }
    .data-label { font-size: ${isSmall ? '9.5px' : '11px'}; font-weight: bold; margin-top: 8px; }
    .footer { text-align: center; font-size: ${isSmall ? '9px' : '11px'}; margin-top: 20px; font-weight: 700; }
  </style>
</head>
<body>
  ${!hideHeader ? `
  <div class="header">
    <div class="restaurant-name">${this.restaurantInfo?.name || 'RESTAURANTE LAS PALMAS'}</div>
    <div class="restaurant-info">${this.restaurantInfo?.phone ? 'Tel: ' + this.restaurantInfo.phone : ''}</div>
    <div class="restaurant-info">${this.restaurantInfo?.email || ''}</div>
    <div class="restaurant-info" style="font-weight:bold;">${(this.restaurantInfo?.website || '').toLowerCase()}</div>
  </div>
  ` : ''}
  ${title ? '<div class="ticket-title">' + title + '</div>' : '<div class="dotted-divider"></div>'}
  <div class="content">${content}</div>
  ${footer ? '<div class="footer">' + footer + '</div>' : ''}
</body>
</html>`;
  }

  // ─── PRINTER RESOLUTION ───────────────────────────────────────────

  private async getNetworkPrinter(): Promise<{ address: string; port: number; paperWidth: string; opens_cash_drawer?: boolean } | null> {
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

  private async executePrint(title: string, htmlContent: string | ((pw: string) => string), options?: { silent: boolean }): Promise<void> {
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

    // Web/Mobile → browser dialog
    if (!this.isElectron()) {
      console.log('🌐 [PrintService] Entorno Web detectado. Abriendo diálogo de impresión del navegador.');
      this.openPrintWindow(html);
      return;
    }

    const electron = (window as any).electronAPI || (window as any).electron;
    console.log('🖥️ [PrintService] Entorno Electron detectado.');

    // PrintNode (cloud)
    if (this.settings?.printnode_enabled && this.settings?.printnode_printer_id) {
      console.log('☁️ [PrintService] PrintNode habilitado. Intentando imprimir vía nube...');
      if (!printNodeService.isEnabled) await printNodeService.init();
      const ok = await printNodeService.printHtml(this.settings.printnode_printer_id, title, html);
      if (ok) { console.log('✅ [PrintService] Impresión exitosa vía PrintNode'); return; }
      console.warn('⚠️ [PrintService] Falló PrintNode, intentando local/red...');
    }

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
    if (electron && electron.printToNetwork) {
      if (netPrinter) {
        console.log(`🌐 [PrintService] Intentando impresora de red: ${netPrinter.address}:${netPrinter.port}`);
        
        // 🛠️ TRADUCCIÓN CRÍTICA: Convertimos HTML a texto limpio con comandos ESC/POS básicos
        const rawContent = this.htmlToEscPos(html, { openDrawer: netPrinter.opens_cash_drawer });
        
        const r = await electron.printToNetwork(netPrinter.address, netPrinter.port, rawContent, true);
        if (r.success) { 
            console.log('✅ [PrintService] Impresión exitosa vía red TCP'); 
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
        ${item.notes ? '<div class="note">(' + item.notes + ')</div>' : ''}
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
  }): Promise<void> {
    if (!this.settings) await this.loadSettings();

    const content = `
      <div style="border-bottom: 1px dashed #000; margin-bottom: 5px;"></div>
      
      <div style="display: grid; grid-template-columns: 1fr 1fr; font-size: 12px; row-gap: 2px;">
        <div><span style="font-weight: bold;">Fecha:</span> ${new Date(data.createdAt).toLocaleString('es-GT', { dateStyle: 'short', timeStyle: 'medium' })}</div>
        <div style="text-align: right;"><span style="font-weight: bold;">Orden:</span> ${data.orderNumber || '---'}</div>
        
        <div><span style="font-weight: bold;">Sección:</span> ${data.tableName || '---'}</div>
        <div style="text-align: right;"><span style="font-weight: bold;">Mesa:</span> ${data.tableNumber || '---'}</div>
        
        <div style="grid-column: span 2;"><span style="font-weight: bold;">Atendió:</span> ${data.waiterName || '---'}</div>
        <div style="grid-column: span 2;"><span style="font-weight: bold;">Cuenta:</span> ${data.customerName || 'Cuenta 1'}</div>
      </div>

      <div style="border-bottom: 1px dashed #000; margin: 8px 0;"></div>

      <div style="display:flex; font-weight:bold; font-size:12px; margin-bottom:5px; align-items: center;">
        <span style="width:35px; text-align: center;">Cant.</span>
        <span style="flex:1; text-align: center;">Descripción</span>
        <span style="width:60px; text-align: right;">Total</span>
      </div>
      
      <div style="border-bottom: 1px dashed #000; margin-bottom: 5px;"></div>

      ${data.items.map(item => `
        <div class="item-row" style="margin-bottom: 6px;">
          <span class="qty" style="width:35px; text-align: center;">${item.quantity}</span>
          <div class="description" style="flex:1; padding-right: 5px;">
            ${item.name}
            ${item.notes ? '<br><span style="font-size:11px; font-weight:normal;">(' + item.notes + ')</span>' : ''}
          </div>
          <span class="price" style="width:60px; text-align: right;">Q${((item.price || 0) * item.quantity).toFixed(2)}</span>
        </div>
      `).join('')}

      <div style="border-bottom: 1px dashed #000; margin: 10px 0;"></div>

      <div class="totals-container">
        <div class="total-line"><span class="total-label">Sub-Total:</span> <span class="total-value">Q${(data.subtotal || 0).toFixed(2)}</span></div>
        <div class="total-line"><span class="total-label">Otros:</span> <span class="total-value">Q0.00</span></div>
        <div class="total-line"><span class="total-label">Propina:</span> <span class="total-value">Q${(data.tipAmount || 0).toFixed(2)}</span></div>
        <div class="total-line grand-total" style="font-size: 14px; margin-top: 5px;"><span class="total-label">Total:</span> <span class="total-value">Q${(data.total || 0).toFixed(2)}</span></div>
      </div>

      <div style="border-bottom: 1px dashed #000; margin: 10px 0;"></div>

      <div style="display: flex; align-items: center; margin-top: 5px;">
        <span style="font-weight: bold; margin-right: 5px; font-size: 12px;">Nit:</span>
        <div style="border: 1px solid #000; height: 25px; flex: 1;"></div>
      </div>

      <div style="margin-top: 5px;">
        <div style="font-weight: bold; font-size: 12px; margin-bottom: 2px;">Nombre / Dirección</div>
        <div style="border: 1px solid #000; height: 60px; width: 100%;"></div>
      </div>

      <div style="text-align:center; font-size:11px; margin-top:15px; font-weight:bold;">
        *** Esto no es un documento contable. ***
      </div>
    `;

    await this.executePrint('PRE-CUENTA', (pw) => this.generateTicketHTML('PRE-CUENTA', content, 'Gracias por preferirnos.', pw), { silent: true });
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
          <div class="info-line" style="grid-column: span 2;"><span class="info-label">Serie:</span> ${data.dteInfo.serie}</div>
          <div class="info-line" style="grid-column: span 2;"><span class="info-label">Número:</span> ${data.dteInfo.numero}</div>
          <div class="info-line" style="grid-column: span 2;"><span class="info-label">Fecha:</span> ${data.dteInfo.fechaCertificacion}</div>
        </div>
        <div style="font-size:9px; word-break:break-all; margin-bottom:8px; text-align:center;">
          <span style="font-weight:bold;">UUID:</span><br>${data.dteInfo.autorizacion}
        </div>
      ` : '<div style="text-align:center;font-weight:bold;margin:10px 0;">*** MODO CONTINGENCIA ***</div>'}
      <div class="dotted-divider"></div>
      <div style="font-size:12px; margin-bottom:10px;">
        <div class="info-line"><span class="info-label">Nit:</span> ${data.customerNit || 'CF'}</div>
        <div class="info-line"><span class="info-label">Nombre:</span> ${data.customerName || 'Consumidor Final'}</div>
      </div>
      <div class="dotted-divider"></div>
      <div style="display:flex; font-weight:900; font-size:12px; margin-bottom:5px;">
        <span style="width:30px;">Cant.</span>
        <span style="flex:1;">Descripción</span>
        <span style="width:75px; text-align:right;">Total</span>
      </div>
      ${(data.items || []).map((item: any) => `
        <div class="item-row">
          <span class="qty">${item.quantity}</span>
          <span class="description">${item.name}</span>
          <span class="price">Q${((item.price || 0) * item.quantity).toFixed(2)}</span>
        </div>
      `).join('')}
      <div class="dotted-divider"></div>
      <div class="totals-container">
        <div class="total-line"><span class="total-label">Sub-Total:</span> <span class="total-value">Q${(data.subtotal || 0).toFixed(2)}</span></div>
        <div class="total-line"><span class="total-label">Impuesto:</span> <span class="total-value">Q${(data.taxAmount || 0).toFixed(2)}</span></div>
        ${data.paymentMethod === 'TARJETA' && data.tipAmount > 0
        ? `<div class="total-line"><span class="total-label">Propina:</span> <span class="total-value">Q${data.tipAmount.toFixed(2)}</span></div>
             <div class="total-line grand-total"><span class="total-label">Total:</span> <span class="total-value">Q${(legalTotal + data.tipAmount).toFixed(2)}</span></div>`
        : `<div class="total-line grand-total"><span class="total-label">Total:</span> <span class="total-value">Q${legalTotal.toFixed(2)}</span></div>
             ${data.tipAmount > 0 ? '<div class="total-line" style="font-style:italic;margin-top:5px;font-size:10px;"><span class="total-label">Propina (Exenta de IVA):</span> <span class="total-value">Q' + data.tipAmount.toFixed(2) + '</span></div>' : ''}`
      }
      </div>
      <div class="dotted-divider"></div>
      <div style="text-align:center;margin-top:10px;font-size:10px;">
        <div style="font-weight:900;">DOCUMENTO TRIBUTARIO ELECTRÓNICO</div>
        <div style="font-weight:bold;margin-top:2px;">${this.restaurantInfo?.invoice_phrases || ''}</div>
        <div style="font-size:9px;margin-top:2px;">${this.restaurantInfo?.certifier_legend || ''}</div>
      </div>
      ${qrImg}
      <div style="text-align:center;font-size:10px;font-style:italic;">
        Orden: #${data.orderNumber} | Mesa: ${data.tableNumber}<br>
        ${new Date(data.createdAt).toLocaleString('es-GT')}
      </div>
    `;
    const title = data.isCancelled ? 'FACTURA ANULADA' : (data.dteInfo ? 'FACTURA ELECTRÓNICA' : 'FACTURA EN CONTINGENCIA');
    return this.generateTicketHTML(title, content, '', paperWidth);
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
        <div class="info-line" style="grid-column: span 2;"><span class="info-label">Fecha:</span> ${new Date().toLocaleString('es-GT')}</div>
        <div class="info-line" style="grid-column: span 2;"><span class="info-label">Orden:</span> #${data.orderNumber || data.orderId.substring(0, 8)}</div>
        <div class="info-line" style="grid-column: span 2;"><span class="info-label">Cliente:</span> ${data.customerName.toUpperCase()}</div>
        <div class="info-line" style="grid-column: span 2;"><span class="info-label">Teléfono:</span> ${data.customerPhone}</div>
      </div>
      <div class="data-label">Dirección de Entrega:</div>
      <div style="font-size:12px;font-weight:500;border:1.5px solid #000;padding:6px;margin-bottom:8px;">
        ${data.deliveryAddress.toUpperCase()}
        ${data.reference ? '<br><span style="font-weight:700;">REF: ' + data.reference.toUpperCase() + '</span>' : ''}
      </div>
      <div class="dotted-divider"></div>
      <div style="display:flex;font-weight:900;font-size:12px;margin-bottom:5px;">
        <span style="width:30px;">Cant.</span><span style="flex:1;">Descripción</span><span style="width:75px;text-align:right;">Total</span>
      </div>
      ${data.items.map((item: any) => `
        <div class="item-row">
          <span class="qty">${item.quantity}</span>
          <span class="description">${item.name}</span>
          <span class="price">Q${((item.price || 0) * item.quantity).toFixed(2)}</span>
        </div>
        ${item.notes ? '<div class="note">(' + item.notes + ')</div>' : ''}
      `).join('')}
      <div class="dotted-divider"></div>
      <div class="totals-container">
        <div class="total-line grand-total"><span class="total-label">Total:</span> <span class="total-value">Q${(data.total || currentSubtotal).toFixed(2)}</span></div>
      </div>
      ${data.paymentMethod ? '<div class="dotted-divider"></div><div style="font-size:12px;font-weight:bold;background:#eee;padding:5px;text-align:center;">PAGO: ' + data.paymentMethod.toUpperCase().replace(/\n/g, ' ') + '</div>' : ''}
      ${data.driverName ? '<div class="dotted-divider"></div><div style="font-weight:bold;">Motorista: ' + data.driverName + '</div>' : ''}
      <div style="text-align:center;font-size:11px;margin-top:15px;font-weight:900;">*** COMPROBANTE DE ENTREGA ***</div>
    `;
    await this.executePrint('TICKET DOMICILIO', (pw) => this.generateTicketHTML('ORDEN DOMICILIO', content, '¡Gracias por su compra!', pw), { silent: true });
  }

  // ─── CANCELLED TICKET ─────────────────────────────────────────────

  async printCancelledTicket(data: any, reason: string): Promise<void> {
    if (!this.settings) await this.loadSettings();
    const content = `
      <div style="text-align:center; border:2px solid #000; padding:8px; margin-bottom:15px;">
        <div style="font-size:16px; font-weight:900; letter-spacing: 1px;">ORDEN ANULADA</div>
        <div style="font-size:12px; margin-top:5px; font-weight:bold;">ORDEN #${data.orderNumber}</div>
      </div>
      
      <div class="info-grid" style="margin-bottom: 8px;">
        <div class="info-line"><span class="info-label" style="width:55px;">HORA:</span> ${new Date(data.createdAt).toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit' })}</div>
        <div class="info-line" style="text-align: right;"><span class="info-label" style="width:45px;">MESA:</span> ${data.tableNumber || '---'}</div>
        <div class="info-line" style="grid-column: span 2;"><span class="info-label" style="width:55px;">FECHA:</span> ${new Date().toLocaleString('es-GT', { dateStyle: 'short', timeStyle: 'short' })}</div>
      </div>

      <div class="thick-divider"></div>

      <div style="font-size:10px; font-weight:bold; color:#cc0000; margin-bottom:5px; text-transform:uppercase;">Motivo de Anulación:</div>
      <div style="font-size:12px; font-weight:800; background:#f9f9f9; padding:8px; border:1px solid #000; border-radius:4px; margin-bottom:15px; text-align: left;">
        ${reason.toUpperCase()}
      </div>

      <div style="font-size:10px; font-weight:bold; margin-bottom:5px; text-transform:uppercase; border-bottom: 1px solid #000; padding-bottom: 2px;">PLATILLOS ANULADOS:</div>
      <div style="margin-bottom:15px;">
        ${(data.items || []).map((item: any) => `
          <div style="display:flex; font-size:11px; margin-bottom:4px; align-items: flex-start;">
            <span style="width:25px; font-weight:bold;">${item.quantity}</span>
            <span style="flex:1; text-transform:uppercase;">${item.name || item.product_name || 'PRODUCTO'}</span>
          </div>
        `).join('')}
      </div>

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
      
      <div class="info-grid" style="margin-bottom: 5px;">
        <div class="info-line"><span class="info-label" style="width:55px;">CAJERO:</span> ${data.cashierName.toUpperCase()}</div>
        <div class="info-line" style="text-align: right;"><span class="info-label" style="width:45px;">MESA:</span> ${data.tableNumber}</div>
        <div class="info-line"><span class="info-label" style="width:55px;">MESERO:</span> ${data.waiterName.toUpperCase()}</div>
        <div class="info-line" style="text-align: right;"><span class="info-label" style="width:55px;">SECCIÓN:</span> ${data.sectionName.toUpperCase()}</div>
        <div class="info-line" style="grid-column: span 2;"><span class="info-label" style="width:55px;">HORA:</span> ${data.voidedAt}</div>
      </div>

      <div class="thick-divider"></div>
      
      <div style="font-size:10px; font-weight:bold; color:#cc0000; margin-bottom:5px; text-transform:uppercase; border-bottom: 1px solid #eee;">Detalle de Eliminación:</div>
      <div class="item-row" style="padding: 5px 0; margin-bottom: 10px; display: flex; align-items: center;">
        <span class="qty" style="font-size:18px; width:45px; font-weight: 900;">${data.quantity}x</span>
        <span class="description" style="font-size:15px; flex:1; font-weight: 700;">${data.productName.toUpperCase()}</span>
      </div>

      <div class="divider"></div>
      
      <div style="font-size:10px; font-weight:bold; color:#cc0000; margin-bottom:5px; text-transform:uppercase;">Motivo de Anulación:</div>
      <div style="font-size:13px; font-weight:800; background:#f9f9f9; padding:10px; border:1px solid #000; border-radius:4px; line-height: 1.2; text-align: left;">
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

  // ─── DETAILED EXPENSE TICKET ──────────────────────────────────────

  async printDetailedExpense(expense: any): Promise<void> {
    if (!this.settings) await this.loadSettings();
    const content = `
      <div style="font-size: 11px; margin-bottom: 2px;"><strong>CATEGORÍA:</strong> ${expense.category}</div>
      <div style="font-size: 11px; margin-bottom: 5px;"><strong>DESCRIPCIÓN:</strong> ${expense.description}</div>
      
      <div class="divider"></div>
      
      <div class="item-row" style="font-weight: bold; border-bottom: 1px solid #000; margin-bottom: 5px; font-size: 10px; padding-bottom: 2px;">
        <span class="description">PRODUCTO</span>
        <span class="price">MONTO</span>
      </div>

      ${(expense.items || []).map((item: any) => `
        <div class="item-row">
          <span class="description" style="text-transform:none;">${item.name}</span>
          <span class="price">Q${Number(item.price).toFixed(2)}</span>
        </div>
      `).join('')}
      
      <div class="thick-divider"></div>
      <div class="grand-total" style="text-align:right; font-weight: 900; font-size: 15px;">TOTAL: Q${Number(expense.amount).toFixed(2)}</div>
    `;
    
    // Pass true as 5th argument to hide the restaurant header/logo
    await this.executePrint('GASTO', (pw) => this.generateTicketHTML('GASTO', content, 'COMPROBANTE DE GASTO', pw, true), { silent: false });
  }

  // ─── Z REPORT ─────────────────────────────────────────────────────

  async printZReport(data: any): Promise<void> {
    if (!this.settings) await this.loadSettings();
    const fmt = (val: number) => 'Q' + Number(val || 0).toFixed(2);
    const dateStr = (d: string) => { try { return new Date(d).toLocaleString('es-GT', { day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch { return d; } };
    const content = `
      <div class="info-grid">
        <div><strong>CAJA:</strong> ${(this.restaurantInfo?.name || 'PRINCIPAL').split(' ')[0]}</div>
        <div><strong>CAJERO:</strong> ${data.cashierName}</div>
        <div><strong>APERTURA:</strong> ${dateStr(data.startTime)}</div>
        <div><strong>CIERRE:</strong> ${dateStr(data.endTime)}</div>
      </div>
      <div class="thick-divider"></div>
      <div class="info-grid" style="font-size:10px;">
        <div>Ordenes: ${data.stats?.ordersAttended || 0}</div>
        <div>Borrados: ${data.stats?.deletedPlates || 0}</div>
        <div>Anuladas: ${data.stats?.cancelledOrders || 0}</div>
        <div>Comensales: ${data.stats?.commensals || 0}</div>
        <div>Abiertas: ${data.stats?.openOrders || 0}</div>
      </div>
      <div class="thick-divider"></div>
      <div style="text-align:center;font-weight:bold;margin-bottom:5px;">VENTAS</div>
      ${data.salesByMethod.map((s: any) => '<div class="item-row"><span class="description" style="text-transform:none;">' + s.method + ':</span> <span class="price">' + fmt(s.amount) + '</span></div>').join('')}
      <div class="divider"></div>
      <div class="total-line" style="font-weight:bold;">
        <span class="total-label">Total Ventas:</span> <span class="total-value">${fmt(data.salesTotal)}</span>
      </div>
      <div style="text-align:center;font-weight:bold;margin:15px 0 5px 0;border-top:1px solid #000;padding-top:5px;">CUADRE EFECTIVO</div>
      <div class="item-row"><span class="description" style="text-transform:none;">(+) INICIAL:</span> <span class="price">${fmt(data.cashDetail.initial)}</span></div>
      <div class="item-row"><span class="description" style="text-transform:none;">(+) VENTAS:</span> <span class="price">${fmt(data.cashDetail.sales)}</span></div>
      <div class="item-row"><span class="description" style="text-transform:none;">(+) ABONOS:</span> <span class="price">${fmt(data.cashDetail.abonos)}</span></div>
      <div class="item-row"><span class="description" style="text-transform:none;">(+) PROPINAS:</span> <span class="price">${fmt(data.cashDetail.tips)}</span></div>
      <div class="item-row"><span class="description" style="text-transform:none;">(-) GASTOS:</span> <span class="price">${fmt(data.cashDetail.expenses)}</span></div>
      <div class="thick-divider"></div>
      <div class="total-line" style="font-weight:bold;">
        <span class="total-label">ESPERADO:</span> <span class="total-value">${fmt(data.cashDetail.total)}</span>
      </div>
      <div class="total-line" style="font-weight:bold;">
        <span class="total-label">CONTADO:</span> <span class="total-value">${fmt(data.countedCash)}</span>
      </div>
      <div class="total-line" style="font-weight:bold; ${data.difference !== 0 ? 'color:red;' : ''}">
        <span class="total-label">DIFERENCIA:</span> <span class="total-value">${data.difference === 0 ? 'CUADRADO' : fmt(data.difference)}</span>
      </div>
      <div style="margin-top:40px;border-top:1px solid #000;text-align:center;font-size:11px;">FIRMA CAJERO: ${data.cashierName}</div>
      ${data.notes ? '<div style="margin-top:20px;border-top:1px dashed #000;padding-top:5px;"><strong>OBSERVACIONES:</strong><br>' + data.notes + '</div>' : ''}
    `;
    await this.executePrint('CIERRE DE CAJA', (pw) => this.generateTicketHTML('CIERRE DE CAJA', content, undefined, pw), { silent: false });
  }

  // ─── GENERAL REPORT ───────────────────────────────────────────────

  async printGeneralReport(reportData: any, startDate: string, endDate: string, branchName: string): Promise<void> {
    if (!this.settings) await this.loadSettings();
    const fmt = (val: number) => 'Q' + Number(val || 0).toFixed(2);

    const content = `
      <div style="text-align:center; font-weight:bold; font-size:14px; margin-bottom:10px; border-bottom: 2px solid #000; padding-bottom:5px;">REPORTE GENERAL</div>
      <div class="info-grid">
        <div><strong>DEL:</strong> ${startDate}</div>
        <div><strong>AL:</strong> ${endDate}</div>
        <div style="grid-column: span 2;"><strong>SUCURSAL:</strong> ${branchName.toUpperCase()}</div>
      </div>
      
      <div class="thick-divider"></div>
      <div style="text-align:center;font-weight:bold;margin-bottom:5px;">VENTAS</div>
      <div class="item-row"><span class="description" style="text-transform:none;">Efectivo:</span> <span class="price">${fmt(reportData.ventas.efectivo)}</span></div>
      <div class="item-row"><span class="description" style="text-transform:none;">Tarjeta:</span> <span class="price">${fmt(reportData.ventas.tarjeta)}</span></div>
      <div class="item-row"><span class="description" style="text-transform:none;">Al Crédito:</span> <span class="price">${fmt(reportData.ventas.credito)}</span></div>
      <div class="item-row"><span class="description" style="text-transform:none;">Otros:</span> <span class="price">${fmt(reportData.ventas.otros)}</span></div>
      <div class="total-line" style="font-weight:bold; margin-top:5px;">
        <span class="total-label">TOTAL VENTAS:</span> <span class="total-value">${fmt(reportData.ventas.total)}</span>
      </div>

      <div class="divider"></div>
      <div style="text-align:center;font-weight:bold;margin-bottom:5px;">PROPINAS</div>
      <div class="item-row"><span class="description" style="text-transform:none;">Efectivo:</span> <span class="price">${fmt(reportData.propinas.efectivo)}</span></div>
      <div class="item-row"><span class="description" style="text-transform:none;">Tarjeta:</span> <span class="price">${fmt(reportData.propinas.tarjeta)}</span></div>
      <div class="item-row"><span class="description" style="text-transform:none;">Otros:</span> <span class="price">${fmt(reportData.propinas.otros)}</span></div>
      <div class="total-line" style="font-weight:bold; margin-top:5px;">
        <span class="total-label">TOTAL PROPINAS:</span> <span class="total-value">${fmt(reportData.propinas.total)}</span>
      </div>
      
      <div class="divider"></div>
      <div style="text-align:center;font-weight:bold;margin-bottom:5px;">EGRESOS Y DESCUENTOS</div>
      <div class="item-row"><span class="description" style="text-transform:none;">Compras c/Caja:</span> <span class="price">${fmt(reportData.egresos.compras)}</span></div>
      <div class="item-row"><span class="description" style="text-transform:none;">Gastos Mnl.:</span> <span class="price">${fmt(reportData.egresos.gastos)}</span></div>
      <div class="item-row"><span class="description" style="text-transform:none;">Descuentos:</span> <span class="price">${fmt(reportData.egresos.descuentos)}</span></div>
      <div class="total-line" style="font-weight:bold; color:red; margin-top:5px;">
        <span class="total-label" style="color:#000;">TOTAL EGRESOS:</span> <span class="total-value">${fmt(reportData.egresos.total)}</span>
      </div>

      <div class="thick-divider"></div>
      <div style="text-align:center;font-weight:bold;margin-bottom:5px;">MÉTRICAS</div>
      <div class="info-grid" style="font-size:10px;">
        <div>Atendidas: ${reportData.ordenes.atendidas}</div>
        <div>Anuladas: ${reportData.ordenes.anuladas}</div>
        <div style="grid-column: span 2;">Comensales: ${reportData.ordenes.comensales}</div>
      </div>
      <div class="divider"></div>
      <div class="item-row"><span class="description" style="text-transform:none;">Ticket Prom. / Orden:</span> <span class="price">${fmt(reportData.ticket.porOrden)}</span></div>
      <div class="item-row"><span class="description" style="text-transform:none;">Ticket Prom. / Persona:</span> <span class="price">${fmt(reportData.ticket.porPersona)}</span></div>
      
      <div style="text-align:center; font-size:9px; font-style:italic; margin-top:15px;">
        Impreso el: ${new Date().toLocaleString('es-GT')}
      </div>
    `;

    await this.executePrint('REPORTE GENERAL', (pw) => this.generateTicketHTML('REPORTE', content, undefined, pw), { silent: false });
  }

  // ─── SOLD DISHES REPORT ──────────────────────────────────────────

  async printSoldDishesReport(data: any[], startDate: string, endDate: string, categoryLabel: string): Promise<void> {
    if (!this.settings) await this.loadSettings();

    const content = `
      <div style="text-align:center; margin-bottom:10px;">
        <div style="font-size:12px; font-weight:bold;">REPORTE DE PLATILLOS VENDIDOS</div>
        <div style="font-size:10px;">${categoryLabel}</div>
      </div>
      
      <div style="font-size:10px; margin-bottom:10px; border-bottom:1px dashed #000; padding-bottom:5px;">
        <div><strong>Desde:</strong> ${startDate}</div>
        <div><strong>Hasta:</strong> ${endDate}</div>
      </div>

      <div style="display:flex; font-weight:bold; font-size:11px; border-bottom:1px solid #000; margin-bottom:5px; padding-bottom:2px;">
        <span style="width:40px; text-align:center;">CANT</span>
        <span style="flex:1;">DESCRIPCIÓN</span>
      </div>

      ${data.map(item => `
        <div style="display:flex; font-size:10px; margin-bottom:4px; align-items: flex-start;">
          <span style="width:40px; text-align:center; font-weight:bold;">${item.quantity}</span>
          <span style="flex:1; text-transform:uppercase;">${item.name}</span>
        </div>
      `).join('')}

      <div style="border-top:1px solid #000; margin-top:10px; padding-top:5px; text-align:right;">
        <div style="font-size:11px; font-weight:bold;">TOTAL UNIDADES: ${data.reduce((acc, curr) => acc + curr.quantity, 0)}</div>
      </div>

      <div style="text-align:center; font-size:9px; font-style:italic; margin-top:20px;">
        Impreso el: ${new Date().toLocaleString('es-GT')}
      </div>
    `;

    await this.executePrint('REPORTE PLATILLOS', (pw) => this.generateTicketHTML('REPORTE COCINA', content, undefined, pw), { silent: false });
  }

  // ─── RECIPE TICKET ───────────────────────────────────────────────

  async printRecipe(productName: string, recipeItems: any[], inventoryItems: any[]): Promise<void> {
    if (!this.settings) await this.loadSettings();

    const content = `
      <div style="text-align:center; margin-bottom:10px;">
        <div style="font-size:12px; font-weight:bold;">RECETA EXACTA</div>
        <div style="font-size:14px; font-weight:900; margin-top:4px;">${productName.toUpperCase()}</div>
      </div>
      
      <div class="dotted-divider"></div>
      <div style="display:flex; font-weight:bold; font-size:11px; border-bottom:1px solid #000; margin-bottom:5px; padding-bottom:4px;">
        <span style="flex:1;">INSUMO</span>
        <span style="width:40px; text-align:center;">CANT.</span>
        <span style="width:50px; text-align:center;">MEDIDA</span>
      </div>

      ${recipeItems.map(item => {
      const invItem = inventoryItems.find(i => i.id === item.inventory_item_id);
      const itemName = invItem?.name || 'Insumo desconocido';
      return `
        <div style="display:flex; font-size:10px; margin-bottom:6px; align-items: flex-start; border-bottom:1px dashed #eee; padding-bottom:3px;">
          <span style="flex:1; text-transform:uppercase; font-weight:600;">${itemName}</span>
          <span style="width:40px; text-align:center; font-weight:900;">${item.quantity}</span>
          <span style="width:50px; text-align:center; font-weight:bold; text-transform:uppercase; font-size:9px;">${item.unit_measure.substring(0, 5)}</span>
        </div>
        `;
    }).join('')}
      <div class="dotted-divider"></div>

      <div style="text-align:center; font-size:9px; font-style:italic; margin-top:20px;">
        ${this.restaurantInfo?.name || 'Restaurante Las Palmas'}<br>
        Documento de Control Interno<br>
        Impreso el: ${new Date().toLocaleString('es-GT')}
      </div>
    `;

    await this.executePrint('IMPRESIÓN RECETA', (pw) => this.generateTicketHTML('RECETA INTERNA', content, undefined, pw), { silent: false });
  }

  // ─── CASH DRAWER ──────────────────────────────────────────────────

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
        // Try to find a printer explicitly configured for cash drawer
        let { data: drawerPrinter } = await supabase
          .from('printers')
          .select('name, address, connection_type')
          .eq('opens_cash_drawer', true)
          .eq('is_active', true)
          .limit(1)
          .single();

        // Fallback: If no printer is explicitly marked for drawer, try the first active system printer
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
          console.log(`📠 [PrintService] Usando impresora "${drawerPrinter.name}" para pulso de gaveta.`);
        } else {
          console.warn('⚠️ No se encontró ninguna impresora configurada para abrir la gaveta.');
        }

        // Anti-collision delay: wait a bit if a print job might be starting
        await new Promise(resolve => setTimeout(resolve, 300));

        const r = await electron.openCashDrawer({ target, type });
        if (r.success) {
          console.log('✅ Cash drawer pulse sent successfully.');
          return;
        } else {
          console.warn('⚠️ electron.openCashDrawer failed:', r.error);
        }
      }

      // 3. Fallback to PrintNode
      if (this.settings?.printnode_enabled && this.settings?.printnode_printer_id) {
        if (!this.settings) await this.loadSettings();
        const cmd1 = 'G3AAGfo='; // ESC p 0 25 250 (Base64)
        const cmd2 = 'G3ABGfo='; // ESC p 1 25 250 (Base64)
        await printNodeService.printRaw(this.settings.printnode_printer_id, cmd1, 'ABRIR CAJON 1');
        await printNodeService.printRaw(this.settings.printnode_printer_id, cmd2, 'ABRIR CAJON 2');
        console.log('✅ Cash drawer pulse sent via PrintNode.');
      }
    } catch (e) {
      console.error('Error in openCashDrawer:', e);
    }
  }

  /**
   * 🛠️ TRADUCTOR QUIRÚRGICO: HTML -> COMANDOS EPSON (ESC/POS)
   * Convierte tickets diseñados para pantalla en datos binarios para impresoras térmicas.
   */
  public htmlToEscPos(html: string, options: { openDrawer?: boolean } = {}): Uint8Array {
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
        const isBold = el.style.fontWeight === 'bold' || el.style.fontWeight === '900' || ['H1', 'H2', 'H3', 'STRONG', 'B'].includes(tagName);
        const isBig = tagName === 'H1' || (el.style.fontSize && parseInt(el.style.fontSize) > 16);
        const isMedium = tagName === 'H2' || tagName === 'H3' || (el.style.fontSize && parseInt(el.style.fontSize) > 12);

        if (isBold) commands.push(ESC, 0x45, 0x01); // Bold ON
        if (isBig) commands.push(GS, 0x21, 0x11); // Double width & height
        else if (isMedium) commands.push(GS, 0x21, 0x01); // Double height

        // Alineación
        const textAlign = el.style.textAlign || (el.classList.contains('header') || el.classList.contains('text-center') ? 'center' : 'left');
        if (textAlign === 'center') commands.push(ESC, 0x61, 0x01);
        else if (textAlign === 'right') commands.push(ESC, 0x61, 0x02);

        // Caso especial: Separador (HR o clase divider)
        if (tagName === 'HR' || el.classList.contains('divider') || el.classList.contains('thick-divider')) {
          const char = el.classList.contains('thick-divider') ? '=' : '-';
          const line = char.repeat(42) + '\n';
          for (let i = 0; i < line.length; i++) commands.push(line.charCodeAt(i));
          return; // No procesar hijos de un HR
        }

        // Caso especial: Item de ticket (Item-Row) - Intentar alinear columnas
        if (el.classList.contains('item-row')) {
          // Extraer descripción y precio para alineación quirúrgica
          const desc = el.querySelector('.description')?.textContent?.trim() || '';
          const price = el.querySelector('.price')?.textContent?.trim() || '';
          const qty = el.querySelector('.qty')?.textContent?.trim() || '';
          
          if (desc || price) {
            let line = '';
            if (qty) line += `${qty} `;
            const remainingSpace = 42 - line.length - price.length;
            const truncatedDesc = desc.substring(0, Math.max(0, remainingSpace - 1));
            line += truncatedDesc.padEnd(remainingSpace) + price + '\n';
            
            for (let i = 0; i < line.length; i++) commands.push(line.charCodeAt(i));
            return; // Ya procesamos la fila manualmente
          }
        }

        // Procesar hijos
        for (let i = 0; i < el.childNodes.length; i++) {
          walk(el.childNodes[i]);
        }

        // Resetear estilos para el siguiente elemento
        if (isBig || isMedium) commands.push(GS, 0x21, 0x00); // Font size Normal
        if (isBold) commands.push(ESC, 0x45, 0x00); // Bold OFF
        if (textAlign !== 'left') commands.push(ESC, 0x61, 0x00); // Reset Align

        // Saltos de línea para bloques
        if (['DIV', 'H1', 'H2', 'H3', 'P', 'BR', 'TR'].includes(tagName)) {
          commands.push(LF);
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
