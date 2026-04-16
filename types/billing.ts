// Types for Guatemala FEL (Factura Electrónica en Línea)

export interface BillingSettings {
    enable_billing: boolean;
    billing_copies: number;
    print_logo_on_invoice: boolean;
    commercial_name: string;
    legal_name: string;
    nit: string;
    billing_email: string;
    billing_address_1: string;
    billing_address_2: string;
    municipality: string;
    department: string;
    branch_code: string;
    branch_id: string;
    scenario_code: string;
    ws_prefix: string;
    ws_key: string;
    signer_token: string;
    invoice_phrases: string;
    certifier_legend: string;
    isr_retention: boolean;
    iva_retention: boolean;
    no_iva_credit: boolean;
    exempt_iva: boolean;
}

export interface CustomerData {
    nit: string;
    name: string;
    email?: string;
    address?: string;
    phone?: string;
    is_contingency?: boolean;
    is_por_consumo?: boolean;
    is_por_almuerzo?: boolean;
}

export interface InvoiceItem {
    description: string;
    quantity: number;
    unit_price: number;
    discount: number;
    tax_amount: number;
    total: number;
}

export interface InvoiceRequest {
    customer: CustomerData;
    items: InvoiceItem[];
    subtotal: number;
    tax_total: number;
    discount_total: number;
    grand_total: number;
    tip_amount?: number;
    payment_method: 'CASH' | 'CARD' | 'TRANSFER' | 'CREDIT';
    order_id?: string;
}

export interface InvoiceResponse {
    success: boolean;
    uuid?: string;
    authorization_number?: string;
    series?: string;
    document_number?: string;
    certification_date?: string;
    pdf_url?: string;
    xml_url?: string;
    error?: string;
}

export interface InvoiceRecord {
    id: string;
    order_id: string;
    customer_nit: string;
    customer_name: string;
    uuid: string;
    authorization_number: string;
    series: string;
    document_number: string;
    subtotal: number;
    tax_total: number;
    grand_total: number;
    status: 'ACTIVE' | 'CANCELLED';
    created_at: string;
    pdf_url?: string;
    xml_url?: string;
}

// Common NIT for "Consumidor Final" in Guatemala
export const CONSUMIDOR_FINAL_NIT = 'CF';
export const CONSUMIDOR_FINAL_NAME = 'CONSUMIDOR FINAL';
