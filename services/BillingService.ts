import { supabase } from '../supabase';
import dayjs from 'dayjs';
import { DateUtils } from '../utils/DateUtils';
import {
    BillingSettings,
    CustomerData,
    InvoiceRequest,
    InvoiceResponse,
    InvoiceItem,
    CONSUMIDOR_FINAL_NIT,
    CONSUMIDOR_FINAL_NAME
} from '../types/billing';

class BillingService {
    private settingsByBranch: Record<string, BillingSettings> = {};

    async loadSettings(branchId: string): Promise<BillingSettings | null> {
        if (!branchId) {
            console.error('BillingService: branchId is required');
            return null;
        }

        if (this.settingsByBranch[branchId]) return this.settingsByBranch[branchId];

        const { data } = await supabase
            .from('branches')
            .select(`
                enable_billing, billing_copies, print_logo_on_invoice, commercial_name, legal_name,
                nit, billing_email, billing_address_1, billing_address_2, municipality, department,
                branch_code, scenario_code, ws_prefix, ws_key, signer_token, invoice_phrases,
                certifier_legend, isr_retention, iva_retention, no_iva_credit, exempt_iva
            `)
            .eq('id', branchId)
            .single();

        if (data) {
            this.settingsByBranch[branchId] = {
                enable_billing: data.enable_billing ?? false,
                billing_copies: data.billing_copies ?? 1,
                print_logo_on_invoice: data.print_logo_on_invoice ?? true,
                commercial_name: data.commercial_name ?? '',
                legal_name: data.legal_name ?? '',
                nit: data.nit ?? '',
                billing_email: data.billing_email ?? '',
                billing_address_1: data.billing_address_1 ?? '',
                billing_address_2: data.billing_address_2 ?? '',
                municipality: data.municipality ?? '',
                department: data.department ?? '',
                branch_code: data.branch_code ?? '',
                branch_id: branchId,
                scenario_code: data.scenario_code ?? '1',
                ws_prefix: data.ws_prefix ?? '',
                ws_key: data.ws_key ?? '',
                signer_token: data.signer_token ?? '',
                invoice_phrases: data.invoice_phrases ?? '',
                certifier_legend: data.certifier_legend ?? '',
                isr_retention: data.isr_retention ?? false,
                iva_retention: data.iva_retention ?? false,
                no_iva_credit: data.no_iva_credit ?? false,
                exempt_iva: data.exempt_iva ?? false,
            };
        } else {
            // Default fallback if no data
            return null;
        }

        return this.settingsByBranch[branchId];
    }

    async isEnabled(branchId: string): Promise<boolean> {
        const settings = await this.loadSettings(branchId);
        return settings?.enable_billing ?? false;
    }

    validateNIT(nit: string): boolean {
        if (nit.toUpperCase() === 'CF') return true;
        const cleanNit = nit.replace(/[\s-]/g, '');
        if (!/^\d{8,12}$/.test(cleanNit)) return false;
        return true;
    }

    calculateTax(total: number): number {
        const taxRate = 0.12;
        return total - (total / (1 + taxRate));
    }

    buildInvoiceItems(orderItems: any[], taxRate = 0.12): InvoiceItem[] {
        return orderItems.map(item => {
            const lineTotal = item.quantity * item.unit_price;
            const taxAmount = lineTotal - (lineTotal / (1 + taxRate));
            return {
                description: item.product_name || item.name,
                quantity: item.quantity,
                unit_price: item.unit_price,
                discount: 0,
                tax_amount: taxAmount,
                total: lineTotal,
            };
        });
    }

    async processInvoice(request: InvoiceRequest, branchId: string): Promise<InvoiceResponse> {
        const settings = await this.loadSettings(branchId);
        if (!settings) return { success: false, error: 'Configuración de facturación no encontrada para la sucursal' };
        if (!settings.enable_billing) return { success: false, error: 'Facturación electrónica deshabilitada en esta sucursal' };
        if (!settings.ws_key || !settings.signer_token || !settings.ws_prefix) {
            return { success: false, error: 'Credenciales Infile incompletas en esta sucursal' };
        }

        try {
            const tempUuid = crypto.randomUUID();
            const rawXml = this.buildFELXML(request, tempUuid, settings);
            const signedXml = await this.signInvoice(rawXml, false, settings);
            const certificationParams = await this.certifyInvoice(signedXml, false, settings);
            if (!certificationParams.success) return certificationParams;
            await this.saveInvoiceRecord(request, certificationParams);
            return certificationParams;
        } catch (error: any) {
            console.error('Billing error:', error);
            return { success: false, error: error.message || 'Error crítico al procesar factura' };
        }
    }

    async voidInvoice(orderId: string, reason: string = 'ANULACION POR ERROR EN POS', branchId: string, nitOverride?: string): Promise<InvoiceResponse> {
        const settings = await this.loadSettings(branchId);
        if (!settings) return { success: false, error: 'Configuración de facturación no encontrada' };
        if (!settings.enable_billing) return { success: false, error: 'Facturación electrónica deshabilitada' };

        try {
            // 1. Fetch active invoice for this order
            const { data: invoices, error: fetchError } = await supabase
                .from('invoices')
                .select('*')
                .eq('order_id', orderId)
                .order('created_at', { ascending: false })
                .limit(1);

            const invoice = invoices?.[0];

            if (fetchError || !invoice) return { success: false, error: 'No se encontró una factura para anular' };

            // If it's a contingency invoice (no UUID), just mark cancelled locally
            if (!invoice.uuid) {
                await supabase.from('invoices').update({ status: 'CANCELLED' }).eq('id', invoice.id);
                return {
                    success: true,
                    uuid: '',
                    authorization_number: '',
                    series: invoice.series || 'CONT',
                    document_number: invoice.document_number || '---',
                    certification_date: new Date().toISOString()
                };
            }

            if (invoice.status === 'CANCELLED') {
                console.warn('BillingService: Attempting to re-annul a locally CANCELLED invoice. This is expected if fixing a sync error.');
            }

            // 2. Build Annulment XML
            const rawXml = this.buildAnnulmentXML({ ...invoice, customer_nit: nitOverride || invoice.customer_nit }, reason, settings);

            // 3. Sign as Annulment
            const signedXml = await this.signInvoice(rawXml, true, settings);

            // 4. Certify
            const certificationParams = await this.certifyInvoice(signedXml, true, settings);

            if (!certificationParams.success) {
                const errLower = (certificationParams.error || '').toLowerCase();
                if (errLower.includes('ya se encuentra anulado') || errLower.includes('dte anulado') || errLower.includes('previamente anulado')) {
                    await supabase.from('invoices').update({ status: 'CANCELLED' }).eq('id', invoice.id);
                    return { ...certificationParams, success: true, error: 'Documento ya estaba anulado en SAT. Se actualizó localmente.' };
                }
                return certificationParams;
            }

            // 5. Update Local DB
            await supabase.from('invoices').update({ status: 'CANCELLED' }).eq('id', invoice.id);

            return { ...certificationParams, success: true, error: 'Anulación procesada exitosamente por SAT.' };

        } catch (error: any) {
            console.error('Void error:', error);
            return { success: false, error: error.message || 'Error al anular factura' };
        }
    }

    private buildFELXML(request: InvoiceRequest, uuid: string, settings: BillingSettings): string {
        const date = this.formatFELDate(new Date());
        const customerName = request.customer.name || CONSUMIDOR_FINAL_NAME;
        const customerNit = request.customer.nit || CONSUMIDOR_FINAL_NIT;
        const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

        let calculatedTotalTax = 0;
        let calculatedGrandTotal = 0;
        let xmlItems = '';

        let itemsToProcess = [...request.items];

        if (request.payment_method === 'CARD' && request.tip_amount && request.tip_amount > 0) {
            const tipVal = request.tip_amount;
            const tipTax = tipVal - (tipVal / 1.12);

            itemsToProcess.push({
                description: 'PROPINA',
                quantity: 1,
                unit_price: tipVal,
                discount: 0,
                tax_amount: tipTax,
                total: tipVal
            });
        }

        if (request.customer.is_por_consumo || request.customer.is_por_almuerzo) {
            const baseItemsTotal = request.subtotal + request.tax_total;

            const collapsedItems: InvoiceItem[] = [{
                description: request.customer.is_por_almuerzo ? 'POR ALMUERZO' : 'CONSUMO DE ALIMENTOS',
                quantity: 1,
                unit_price: baseItemsTotal,
                discount: 0,
                tax_amount: request.tax_total,
                total: baseItemsTotal
            }];

            const tipItem = itemsToProcess.find(i => i.description === 'PROPINA');
            if (tipItem) {
                collapsedItems.push(tipItem);
            }

            itemsToProcess = collapsedItems;
        }

        itemsToProcess.forEach((item, idx) => {
            const lineNum = idx + 1;
            const lineTotalInclusive = parseFloat(item.total.toFixed(2));
            const base = parseFloat((lineTotalInclusive / 1.12).toFixed(6));
            const tax = parseFloat((lineTotalInclusive - base).toFixed(6));
            const unitPriceInclusive = parseFloat((lineTotalInclusive / item.quantity).toFixed(6));

            calculatedTotalTax += tax;
            calculatedGrandTotal += lineTotalInclusive;

            xmlItems += `
            <dte:Item BienOServicio="B" NumeroLinea="${lineNum}">
                <dte:Cantidad>${item.quantity.toFixed(2)}</dte:Cantidad>
                <dte:UnidadMedida>UND</dte:UnidadMedida>
                <dte:Descripcion>${esc(item.description)}</dte:Descripcion>
                <dte:PrecioUnitario>${unitPriceInclusive.toFixed(6)}</dte:PrecioUnitario>
                <dte:Precio>${lineTotalInclusive.toFixed(6)}</dte:Precio>
                <dte:Descuento>0.00</dte:Descuento>
                <dte:Impuestos>
                    <dte:Impuesto>
                        <dte:NombreCorto>IVA</dte:NombreCorto>
                        <dte:CodigoUnidadGravable>1</dte:CodigoUnidadGravable>
                        <dte:MontoGravable>${base.toFixed(6)}</dte:MontoGravable>
                        <dte:MontoImpuesto>${tax.toFixed(6)}</dte:MontoImpuesto>
                    </dte:Impuesto>
                </dte:Impuestos>
                <dte:Total>${lineTotalInclusive.toFixed(6)}</dte:Total>
            </dte:Item>`;
        });

        const formattedDate = date.split('.')[0];
        return `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<dte:GTDocumento xmlns:dte="http://www.sat.gob.gt/dte/fel/0.2.0" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" Version="0.1">
    <dte:SAT ClaseDocumento="dte">
        <dte:DTE ID="DatosCertificados">
            <dte:DatosEmision ID="DatosEmision">
                <dte:DatosGenerales CodigoMoneda="GTQ" FechaHoraEmision="${formattedDate}" Tipo="FACT"/>
                <dte:Emisor AfiliacionIVA="GEN" CodigoEstablecimiento="${settings.branch_code || '1'}" CorreoEmisor="${settings.billing_email || ''}" NITEmisor="${(settings.nit || '').replace(/-/g, '')}" NombreComercial="${esc(settings.commercial_name || '')}" NombreEmisor="${esc(settings.legal_name || '')}">
                    <dte:DireccionEmisor>
                        <dte:Direccion>${esc(settings.billing_address_1 || '')}</dte:Direccion>
                        <dte:CodigoPostal>0</dte:CodigoPostal>
                        <dte:Municipio>${esc(settings.municipality || 'Guatemala')}</dte:Municipio>
                        <dte:Departamento>${esc(settings.department || 'Guatemala')}</dte:Departamento>
                        <dte:Pais>GT</dte:Pais>
                    </dte:DireccionEmisor>
                </dte:Emisor>
                <dte:Receptor CorreoReceptor="${request.customer.email || ''}" IDReceptor="${(customerNit || '').replace(/-/g, '')}" NombreReceptor="${esc(customerName)}">
                    <dte:DireccionReceptor>
                        <dte:Direccion>${esc(request.customer.address || 'CIUDAD')}</dte:Direccion>
                        <dte:CodigoPostal>0</dte:CodigoPostal>
                        <dte:Municipio>Guatemala</dte:Municipio>
                        <dte:Departamento>Guatemala</dte:Departamento>
                        <dte:Pais>GT</dte:Pais>
                    </dte:DireccionReceptor>
                </dte:Receptor>
                <dte:Frases>
                    <dte:Frase CodigoEscenario="${settings.scenario_code || '1'}" TipoFrase="1"/>
                </dte:Frases>
                <dte:Items>
                    ${xmlItems}
                </dte:Items>
                <dte:Totales>
                    <dte:TotalImpuestos>
                        <dte:TotalImpuesto NombreCorto="IVA" TotalMontoImpuesto="${calculatedTotalTax.toFixed(6)}"/>
                    </dte:TotalImpuestos>
                    <dte:GranTotal>${calculatedGrandTotal.toFixed(6)}</dte:GranTotal>
                </dte:Totales>
            </dte:DatosEmision>
        </dte:DTE>
    </dte:SAT>
</dte:GTDocumento>`;
    }

    private formatFELDate(d: string | Date): string {
        const dateObj = typeof d === 'string' ? new Date(d) : d;
        return DateUtils.toGuatemalaISO(dateObj);
    }

    private buildAnnulmentXML(invoice: any, reason: string, settings: BillingSettings): string {
        const date = new Date().toISOString();
        const formattedAnnulDate = this.formatFELDate(date);
        const formattedCertDate = this.formatFELDate(invoice.certification_date || date);
        const esc = (s: string) => (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

        return `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<dte:GTAnulacionDocumento xmlns:dte="http://www.sat.gob.gt/dte/fel/0.1.0" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" Version="0.1">
    <dte:SAT>
        <dte:AnulacionDTE ID="DatosCertificados">
            <dte:DatosGenerales
                ID="DatosAnulacion"
                NumeroDocumentoAAnular="${invoice.uuid}"
                NITEmisor="${(settings.nit || '').replace(/-/g, '')}"
                IDReceptor="${(invoice.customer_nit || '').replace(/-/g, '')}"
                FechaEmisionDocumentoAnular="${formattedCertDate}"
                FechaHoraAnulacion="${formattedAnnulDate}"
                MotivoAnulacion="${esc(reason)}"
            />
        </dte:AnulacionDTE>
    </dte:SAT>
</dte:GTAnulacionDocumento>`;
    }

    private async signInvoice(xml: string, isAnnulment: boolean = false, settings: BillingSettings): Promise<string> {
        const cleanNit = (settings.nit || '').replace(/-/g, '');
        const payload = {
            llave: settings.signer_token,
            archivo: btoa(unescape(encodeURIComponent(xml))),
            codigo: cleanNit,
            alias: settings.ws_prefix,
            es_anulacion: isAnnulment ? 'S' : 'N'
        };

        const signerUrl = 'https://signer-emisores.feel.com.gt/sign_solicitud_firmas/firma_xml';
        const proxies = [
            'https://corsproxy.io/?url=',
            'https://cors-anywhere.herokuapp.com/'
        ];

        let lastError = null;
        for (const proxy of proxies) {
            try {
                const fullUrl = proxy.includes('?') ? proxy + encodeURIComponent(signerUrl) : proxy + signerUrl;
                const response = await fetch(fullUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (response.status === 403 && proxy.includes('herok')) continue;
                if (!response.ok) continue;

                const data = await response.json();
                if (data.resultado === false) throw new Error('Error del firmador: ' + data.descripcion);
                return data.archivo;
            } catch (e: any) {
                lastError = e;
                continue;
            }
        }

        throw lastError || new Error('No se pudo firmar la factura a través de ningún proxy disponible.');
    }

    private async certifyInvoice(signedXmlVal: string, isAnnulment: boolean = false, settings: BillingSettings): Promise<InvoiceResponse> {
        const baseUrl = 'https://certificador.feel.com.gt/fel/';
        const endpoint = isAnnulment ? 'anulacion/v2/dte/' : 'certificacion/v2/dte/';
        const certUrl = baseUrl + endpoint;
        const payload = {
            nit_emisor: (settings.nit || '').replace(/-/g, ''),
            correo_copia: settings.billing_email || '',
            xml_dte: signedXmlVal
        };

        const proxies = [
            'https://corsproxy.io/?url=',
            'https://cors-anywhere.herokuapp.com/'
        ];

        let lastError = null;
        for (const proxy of proxies) {
            try {
                const fullUrl = proxy.includes('?') ? proxy + encodeURIComponent(certUrl) : proxy + certUrl;
                const response = await fetch(fullUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'usuario': settings.ws_prefix || '',
                        'llave': settings.ws_key || ''
                    },
                    body: JSON.stringify(payload)
                });

                if (response.status === 403 && proxy.includes('herok')) continue;
                if (!response.ok) continue;

                const data = await response.json();
                if (data.resultado === false) return { success: false, error: 'Rechazo SAT: ' + (data.descripcion_errores?.[0]?.mensaje_error || 'Error desconocido') };

                return {
                    success: true,
                    uuid: data.uuid,
                    authorization_number: data.numero,
                    series: data.serie,
                    document_number: data.numero,
                    certification_date: data.fecha,
                    xml_url: data.xml_certificado,
                    pdf_url: `https://report.feel.com.gt/ingfacereport/ingfacereport_documento?uuid=${data.uuid}`,
                };
            } catch (e: any) {
                lastError = e;
                continue;
            }
        }

        throw lastError || new Error('Error crítico al certificar factura a través de los proxies.');
    }

    private async saveInvoiceRecord(request: InvoiceRequest, response: InvoiceResponse): Promise<void> {
        if (!response.success) return;

        const { error } = await supabase.from('invoices').insert({
            order_id: request.order_id,
            customer_nit: request.customer.nit,
            customer_name: request.customer.name,
            uuid: response.uuid,
            authorization_number: response.authorization_number,
            series: response.series,
            document_number: response.document_number,
            certification_date: response.certification_date,
            subtotal: request.subtotal,
            tax_total: request.tax_total,
            grand_total: request.grand_total,
            tip_amount: request.tip_amount || 0,
            discount_amount: request.discount_total || 0,
            status: 'ACTIVE',
            pdf_url: response.pdf_url,
            xml_url: response.xml_url,
        });

        if (error) {
            console.error('Error saving invoice record:', error);
            throw new Error(`Failed to save invoice: ${error.message}`);
        }
    }

    async saveContingencyInvoice(request: InvoiceRequest, orderNumber: string): Promise<void> {
        const { error } = await supabase.from('invoices').insert({
            order_id: request.order_id,
            customer_nit: request.customer.nit,
            customer_name: request.customer.name,
            series: 'CONT',
            document_number: `PEND-${orderNumber}`,
            subtotal: request.subtotal,
            tax_total: request.tax_total,
            grand_total: request.grand_total,
            tip_amount: request.tip_amount || 0,
            discount_amount: request.discount_total || 0,
            status: 'ACTIVE',
        });

        if (error) {
            console.error('Error saving contingency invoice:', error);
            throw new Error(`Failed to save contingency invoice: ${error.message}`);
        }
    }

    async saveCustomer(customer: CustomerData): Promise<void> {
        if (!customer.nit || customer.nit === 'CF' || customer.nit === CONSUMIDOR_FINAL_NIT) return;

        const { error } = await supabase.from('customers').upsert({
            nit: customer.nit,
            name: customer.name,
            address: customer.address,
            email: customer.email,
            phone: customer.phone
        }, { onConflict: 'nit' });

        if (error) {
            console.error('Error saving customer:', error);
        }
    }

    getConsumidorFinal(): CustomerData {
        return { nit: CONSUMIDOR_FINAL_NIT, name: CONSUMIDOR_FINAL_NAME };
    }

    async lookupNIT(nit: string, branchId: string): Promise<CustomerData | null> {
        if (!nit || nit.toUpperCase() === 'CF') return this.getConsumidorFinal();

        const cleanNit = nit.replace(/[\s-]/g, '');

        try {
            // STEP: EXCLUSIVE EXTERNAL SAT LOOKUP (STRICT POLICY)
            const settings = await this.loadSettings(branchId);
            if (!settings?.ws_key || !settings?.ws_prefix) {
                throw new Error('Configuración de facturación incompleta');
            }

            const alias = settings.ws_prefix;
            const llave = settings.ws_key;

            const proxies = [
                '',
                'https://corsproxy.io/?url=',
                'https://api.allorigins.win/raw?url=',
                'https://thingproxy.freeboard.io/fetch/',
                'https://cors-anywhere.herokuapp.com/'
            ];

            const configs = [
                {
                    name: 'Zaraki-Infile (rest/action)',
                    url: 'https://consultareceptores.feel.com.gt/rest/action',
                    body: { emisor_codigo: alias, emisor_clave: llave, nit_consulta: cleanNit }
                },
                {
                    name: 'Infile Assistant',
                    url: 'https://fel.infile.com.gt/asistente/api/consultar_nit',
                    body: { nit: cleanNit, usuario: alias, llave: llave }
                },
                {
                    name: 'Flexzo v1',
                    url: 'https://api.flexzopack.com/consulta-nit',
                    headers: { alias: alias, llave: llave },
                    body: { nit: cleanNit }
                }
            ];

            for (const proxy of proxies) {
                for (const config of configs) {
                    try {
                        const targetUrl = config.url;
                        const fullUrl = proxy === '' ? targetUrl : (proxy.includes('?') ? proxy + encodeURIComponent(targetUrl) : proxy + targetUrl);

                        const response = await fetch(fullUrl, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', ...(config.headers || {}) },
                            body: JSON.stringify(config.body)
                        });

                        if (response.status === 429 || response.status === 403) continue;
                        if (!response.ok) continue;

                        const data = await response.json();
                        const res = data.data || data.receptor || data;
                        const nombre = (res.nombre || res.nombre_completo || res.razon_social || res.NOMBRE || '').trim();
                        const direccion = res.direccion || res.DIRECCION || 'CIUDAD';

                        if (nombre && !/NO ENCONTRADO|NOT FOUND|ERROR|NULL/i.test(nombre)) {
                            console.log(`✅ [NIT] Fresh SAT Data via ${config.name}`);
                            return { nit: cleanNit, name: nombre, address: direccion, email: '' };
                        }
                    } catch (e) { }
                }
            }

            // If we are here, SAT lookup found nothing or failed
            throw new Error('NIT NO VÁLIDO');
        } catch (error: any) {
            console.error('Strict NIT Lookup error:', error);
            throw new Error('NIT NO VÁLIDO');
        }
    }

    async getReceivedInvoices(month: string, branchId: string): Promise<any[]> {
        const settings = await this.loadSettings(branchId);
        if (!settings || !settings.ws_key || !settings.ws_prefix) {
            throw new Error('Configuración de facturación incompleta para sincronización');
        }

        const start = dayjs(month + '-01').startOf('month').format('YYYY-MM-DD');
        const end = dayjs(month + '-01').endOf('month').format('YYYY-MM-DD');

        // URL específica para el reporte de documentos recibidos en Infile
        const reportUrl = 'https://report.feel.com.gt/ingfacereport/service/consultar_documentos_recibidos';
        
        const configs = [
            {
                name: 'Infile Reports v2',
                url: reportUrl,
                body: {
                    nit_emisor: (settings.nit || '').replace(/-/g, ''),
                    fecha_inicial: start,
                    fecha_final: end,
                    usuario: settings.ws_prefix || '',
                    llave: settings.ws_key || ''
                }
            },
            {
                name: 'Infile Assistant API',
                url: 'https://fel.infile.com.gt/asistente/api/documentos_recibidos',
                body: {
                    nit_consulta: (settings.nit || '').replace(/-/g, ''),
                    usuario: settings.ws_prefix || '',
                    llave: settings.ws_key || '',
                    fecha_desde: start,
                    fecha_hasta: end
                }
            }
        ];

        const proxies = [
            'https://corsproxy.io/?url=',
            'https://api.allorigins.win/raw?url=',
            'https://thingproxy.freeboard.io/fetch/',
            'https://cors-anywhere.herokuapp.com/'
        ];

        let lastErrorDesc = '';
        for (const proxy of proxies) {
            for (const config of configs) {
                try {
                    const fullUrl = proxy.includes('?') ? proxy + encodeURIComponent(config.url) : proxy + config.url;
                    const response = await fetch(fullUrl, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'usuario': settings.ws_prefix || '',
                            'llave': settings.ws_key || ''
                        },
                        body: JSON.stringify(config.body)
                    });

                    if (response.status === 403) {
                        lastErrorDesc = `403 Forbidden en ${config.name} (Falta de permisos en Infile)`;
                        continue;
                    }

                    if (!response.ok) continue;

                    const data = await response.json();
                    const docs = data.documentos || data.data || (Array.isArray(data) ? data : null);
                    
                    if (docs && Array.isArray(docs)) {
                        return docs;
                    }
                } catch (e: any) {
                    lastErrorDesc = e.message;
                    continue;
                }
            }
        }

        throw new Error(`No se pudo conectar con SAT/Infile. Detalle: ${lastErrorDesc || 'Error de red o CORS'}`);
    }
}

export const billingService = new BillingService();
