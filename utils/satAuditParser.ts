/**
 * Antigravity SAT Audit Parser v1.0
 * Motor de procesamiento inteligente de Documentos Tributarios Electrónicos (DTE)
 * Guatemala - 2025-2026
 */

export type DTEType = 'FACT' | 'FCAM' | 'FPEQ' | 'FESP' | 'NABN' | 'NDEB' | 'NCRE' | 'RDON' | 'RECI' | 'CRE' | 'CEX';
export type GiroNegocio = 'COMBUSTIBLE' | 'SUPERMERCADO' | 'RESTAURANTE' | 'MATERIA_PRIMA' | 'BEBIDAS' | 'SERVICIOS_BASICOS' | 'LIMPIEZA' | 'MANTENIMIENTO' | 'SERVICIOS_PROF' | 'ARRENDAMIENTO' | 'SEGURIDAD' | 'PUBLICIDAD' | 'EQUIPO_COCINA' | 'TECNOLOGIA' | 'GOBIERNO' | 'PAPELERIA' | 'OTRO';
export type ClasificacionContable = 'GASTO_OPERACION' | 'ACTIVO_FIJO';

export interface AuditItem {
  numero_linea: number;
  descripcion: string;
  cantidad: number;
  unidad: string;
  precio_unitario: number;
  precio_total: number;
  clasificacion_contable: ClasificacionContable;
  subcategoria_contable: string;
  es_activo_fijo: boolean;
  vida_util_años: number | null;
  tasa_depreciacion: number | null;
  es_combustible: boolean;
  tipo_combustible: 'SUPER' | 'REGULAR' | 'DIESEL' | 'GLP' | null;
}

export interface AuditResult {
  /* ── IDENTIDAD DIGITAL ── */
  uuid: string;
  serie: string;
  numero: string;
  tipo_dte: DTEType;
  tipo_dte_descripcion: string;
  fecha_emision: string;
  fecha_certificacion: string | null;

  /* ── ESTADO DEL DOCUMENTO ── */
  estado: 'VIGENTE' | 'ANULADO';
  fecha_anulacion: string | null;
  motivo_anulacion: string | null;
  afecta_credito_fiscal: boolean;

  /* ── EMISOR ── */
  emisor_nit: string;
  emisor_nombre: string;
  emisor_direccion: string;
  emisor_tipo_contribuyente: 'NORMAL' | 'PEQUENO' | 'ESPECIAL';
  emisor_giro: GiroNegocio;
  emisor_giro_confianza: 'ALTA' | 'MEDIA' | 'BAJA';

  /* ── RECEPTOR ── */
  receptor_nit: string;
  receptor_nombre: string;

  /* ── MONTOS ── */
  moneda: string;
  monto_total: number;
  monto_base_imponible: number;
  iva_monto: number;
  iva_credito_fiscal: number;
  iva_retenido: number;
  idp_monto: number;
  impuesto_bebidas_alcoh: number;
  impuesto_bebidas_no_alcoh: number;
  otros_impuestos: number;
  isr_retenido: number;
  descuentos: number;

  /* ── ÍTEMS DETALLADOS ── */
  items: AuditItem[];

  /* ── CLASIFICACION GENERAL ── */
  clasificacion_compra: ClasificacionContable;
  categoria_gasto: string;
  requiere_revision_manual: boolean;

  /* ── CONTABILIDAD ── */
  cuenta_contable: string;
  cuenta_contable_nombre: string;

  /* ── PROVEEDOR FRECUENTE ── */
  es_proveedor_frecuente: boolean;
  numero_compras_proveedor: number;

  /* ── ALERTAS ── */
  alertas: string[];

  /* ── METADATOS ── */
  org_id: string;
  procesado_fecha: string;
  procesado_por: string;
  xml_origen: string;
  periodo_fiscal_mes: number;
  periodo_fiscal_anio: number;
  
  uuid_referencia?: string | null; // Mantenido para lógica interna de NC
}

export function parseAuditDTE(raw: any): AuditResult {
  const items: AuditItem[] = [];
  const alertas: string[] = [];
  let idpTotal = 0;
  let hasMixedItems = false;
  let bebalTotal = Number(raw.impuesto_bebidas_alcoh || 0);
  let bebnTotal = Number(raw.impuesto_bebidas_no_alcoh || 0);

  // 1. Clasificar Documento
  const tipo = (raw.tipo_dte || 'FACT').toUpperCase() as DTEType;
  const descripciones: Record<DTEType, string> = {
    'FACT': 'Factura', 
    'FCAM': 'Factura Cambiaria', 
    'FPEQ': 'Factura Pequeño Contribuyente',
    'FESP': 'Factura Especial', 
    'NABN': 'Nota de Abono', 
    'NDEB': 'Nota de Débito',
    'NCRE': 'Nota de Crédito', 
    'RDON': 'Recibo por Donación', 
    'RECI': 'Recibo',
    'CRE': 'Constancia de Retención', 
    'CEX': 'Constancia de Exención'
  };

  const isAnulado = raw.estado === 'ANULADO' || raw.estado === 'A';
  const isNegativeType = ['NCRE', 'NABN'].includes(tipo); // Reducen crédito
  const isPositiveAdj = tipo === 'NDEB'; // Aumenta deuda
  const isZeroImpact = ['CRE', 'CEX', 'RDON'].includes(tipo); // Informativos/Acreditables
  
  const afectaIVA = !['FPEQ', 'RECI', 'RDON', 'CRE', 'CEX'].includes(tipo) && !isAnulado;

  // 2. Giro de Negocio
  const emisorRaw = (raw.nombre_emisor || raw.nombre_comercial || '').toUpperCase();
  let giro: GiroNegocio = 'OTRO';
  let giroConfianza: 'ALTA' | 'MEDIA' | 'BAJA' = 'BAJA';

  if (/PUMA|SHELL|TEXACO|GULF|UNO|PETROGAS|ESTACION DE SERVICIO|FUEL|GASOLIN|DIESEL/.test(emisorRaw)) { 
      giro = 'COMBUSTIBLE'; giroConfianza = 'ALTA'; 
  }
  else if (/TORRE|WALMART|MAXI BODEGA|SELECTOS|PAIZ|COLONIA|DESPENSA|SUPERMERCADO|UNISUPER|\bSUPER\b/.test(emisorRaw)) { giro = 'SUPERMERCADO'; giroConfianza = 'ALTA'; }
  else if (/RESTAURANT|COMIDA|ALIMENTOS|PIZZA|POLLO|BURGER|CAFE|TACO/.test(emisorRaw)) { giro = 'RESTAURANTE'; giroConfianza = 'MEDIA'; }
  else if (/MARISCO|PESCAD|CARNE|CARNICER|VERDUR|FRUT|LACTEO|QUESO|HUEVO|DISTRIBUIDOR|ALIMENTARIA/.test(emisorRaw)) { giro = 'MATERIA_PRIMA'; giroConfianza = 'ALTA'; }
  else if (/BEBID|LICOR|CERVEZ|REFRESCO|PEPSI|COCA|BRAHVA|CABRO|AGUA PURA|HIELO/.test(emisorRaw)) { giro = 'BEBIDAS'; giroConfianza = 'ALTA'; }
  else if (/EEGSA|ENERGUATE|EMPAGUA|TIGO|CLARO|MOVISTAR|TELECOM|LIZ|AGUA|SOLAR|KW\/H|VATIOS/.test(emisorRaw)) { giro = 'SERVICIOS_BASICOS'; giroConfianza = 'ALTA'; }
  else if (/PLAN MENSUAL|INTERNET|FIBRA OPTICA|TELEFONIA|CABLE/.test(emisorRaw)) { giro = 'SERVICIOS_BASICOS'; giroConfianza = 'ALTA'; }
  else if (/HIGIENE|LIMPIEZA|DESECHABLE|PLASTICO|QUIMIC/.test(emisorRaw)) { giro = 'LIMPIEZA'; giroConfianza = 'ALTA'; }
  else if (/TALLER|REPUESTO|REPARACION|AIRE ACONDICIONADO|EXTRACTOR|MANTENIM/.test(emisorRaw)) { giro = 'MANTENIMIENTO'; giroConfianza = 'ALTA'; }
  else if (/CONTAD|ABOGAD|NOTARI|AUDIT|CONSULT/.test(emisorRaw)) { giro = 'SERVICIOS_PROF'; giroConfianza = 'ALTA'; }
  else if (/ALQUILER|ARRENDAMIENTO|LOCAL|BODEGA/.test(emisorRaw)) { giro = 'ARRENDAMIENTO'; giroConfianza = 'ALTA'; }
  else if (/SEGURIDAD|GUARDIAN|MONITOREO/.test(emisorRaw)) { giro = 'SEGURIDAD'; giroConfianza = 'ALTA'; }
  else if (/PUBLICIDAD|IMPUEST|AGENCIA|MARKETING|ROTULO/.test(emisorRaw)) { giro = 'PUBLICIDAD'; giroConfianza = 'ALTA'; }
  else if (/VAJILLA|EQUIPO COCINA|UTENSILIO/.test(emisorRaw)) { giro = 'EQUIPO_COCINA'; giroConfianza = 'ALTA'; }
  else if (/SOFTWARE|HARDWARE|COMPUTAD|SISTEMA|TECH|DATOS/.test(emisorRaw)) { giro = 'TECNOLOGIA'; giroConfianza = 'ALTA'; }
  else if (/SAT|MUNICIPALIDAD|IGSS|INTECAP|IRTRA/.test(emisorRaw)) { giro = 'GOBIERNO'; giroConfianza = 'ALTA'; }

  // 3. Procesar Ítems
  (raw.items || []).forEach((it: any) => {
    const desc = (it.descripcion || '').toUpperCase();
    let cat: ClasificacionContable = 'GASTO_OPERACION';
    let sub: GiroNegocio = giro;
    let esActivo = false;
    let vidaUtil: number | null = null;
    let tasaDep: number | null = null;
    let fuel: 'SUPER' | 'REGULAR' | 'DIESEL' | 'GLP' | null = null;
    let idpItem = 0;

    // Detector de Activo Fijo
    if (/ESTUFA|REFRIGERADOR|CONGELADOR|EXTRACTOR|AIRE ACOND|VEHICULO|COMPUTADOR|MESA|SILLA|VITRINA|POS|CAMARA|MAQUINARIA|HORNO|LICUADORA|BATIDOR|MOLINO/.test(desc)) {
      cat = 'ACTIVO_FIJO';
      esActivo = true;
      if (/COMPUTADOR|LAPTOP|TABLET|SERVIDOR/.test(desc)) { vidaUtil = 3; tasaDep = 33.33; }
      else if (/VEHICULO|MOTO|CARRO/.test(desc)) { vidaUtil = 5; tasaDep = 20; }
      else { vidaUtil = 5; tasaDep = 20; }
    }

    // Detector de Combustible e IDP
    const canBeFuel = giro === 'COMBUSTIBLE' || /GASOLINA|DIESEL|PROPANO/.test(desc);
    
    if (canBeFuel) {
      if (desc.includes('SUPER') && (giro === 'COMBUSTIBLE' || desc.includes('GASOLIN'))) { fuel = 'SUPER'; idpItem = it.cantidad * 4.70; }
      else if (desc.includes('REGULAR')) { fuel = 'REGULAR'; idpItem = it.cantidad * 4.60; }
      else if (desc.includes('DIESEL')) { fuel = 'DIESEL'; idpItem = it.cantidad * 1.30; }
      else if ((/\bGAS\b|PROPANO/.test(desc)) && !desc.includes('GASEOSA')) { fuel = 'GLP'; idpItem = it.cantidad * 0.50; }
      
      if (fuel) {
        idpTotal += idpItem;
        sub = 'COMBUSTIBLE';
      }
    }

    // Especialista Contable
    if (/ACEITE|MANTECA|GRASA VEGETAL|HARINA|POLLO|CARNE|QUESO|LECHE|ARROZ|FRIJOL|AZUCAR|SAL/.test(desc)) { sub = 'MATERIA_PRIMA'; }
    else if (/CAMARON|PESCADO|CONCHA|CALAMAR|PULPO|MARISCO|FILETE|MOJARRA/.test(desc)) { sub = 'MATERIA_PRIMA'; }
    else if (/LAVAPLATO|CLORO|DESINFECTAN|JABON|DETERGENTE|ESCOBA|DESECHABLE|VASO|PLATO|BOLSA|SERVILLETA/.test(desc)) { sub = 'LIMPIEZA'; }
    else if (/PAPEL|TINTA|ROYO|LAPICERO|CUADERNO|FACTURERO|RECIBO|BOLIGR/.test(desc)) { sub = 'PAPELERIA'; }
    else if (/KW\/H|VATIOS|ENERGIA|TRANSFORMADOR|LECTURA/.test(desc)) { sub = 'SERVICIOS_BASICOS'; }
    else if (/INTERNET|TELEFONIA|PLAN MENSUAL|CABLE|FIBRA/.test(desc)) { sub = 'SERVICIOS_BASICOS'; }
    else if (/PROPANO|CILINDRO|GAS/.test(desc) && !desc.includes('GASEOSA') && !desc.includes('GASOLINA')) { sub = 'COMBUSTIBLE'; }

    items.push({
      numero_linea: it.numero_linea || items.length + 1,
      descripcion: it.descripcion,
      cantidad: it.cantidad,
      unidad: it.unidad || 'Unidad',
      precio_unitario: it.precio_unitario,
      precio_total: it.total,
      clasificacion_contable: cat,
      subcategoria_contable: sub,
      es_activo_fijo: esActivo,
      vida_util_años: vidaUtil,
      tasa_depreciacion: tasaDep,
      es_combustible: !!fuel,
      tipo_combustible: fuel
    });

    if (esActivo) hasMixedItems = true;
  });

  // 4. Totales y Cuentas (Reglas Críticas SAT)
  const totalRaw = raw.total || 0;
  
  // Lógica de Signos: Notas de Crédito/Abono restan (-). CEX/RDON no suman al flujo de compras.
  // IMPORTANTE: Para CRE (Retenciones), el 'total' del documento es el valor retenido.
  const total = tipo === 'CRE' ? totalRaw : (isZeroImpact ? 0 : (isNegativeType ? -Math.abs(totalRaw) : (isPositiveAdj ? Math.abs(totalRaw) : totalRaw)));
  
  const isFPEQ = tipo === 'FPEQ';
  const isSpecial = tipo === 'FESP';
  const isCRE = tipo === 'CRE';
  
  // Base Imponible
  const baseImponibleRaw = afectaIVA ? ((Math.abs(totalRaw) - idpTotal) / 1.12) : Math.abs(totalRaw);
  const baseImponible = isNegativeType ? -Number(baseImponibleRaw.toFixed(2)) : Number(baseImponibleRaw.toFixed(2));
  
  // IVA
  const ivaTotalRaw = afectaIVA ? (baseImponibleRaw * 0.12) : 0;
  const ivaTotal = isNegativeType ? -Number(ivaTotalRaw.toFixed(2)) : Number(ivaTotalRaw.toFixed(2));

  // Retenciones (Extract from raw or calculate)
  let isrRet = Number(raw.isr_retenido || 0);
  let ivaRet = Number(raw.iva_retenido || 0);

  // Si es Factura Especial, auto-calculamos si no vienen
  if (isSpecial && isrRet === 0) isrRet = Number((baseImponibleRaw * 0.05).toFixed(2));
  if (isSpecial && ivaRet === 0) ivaRet = Number((baseImponibleRaw * 0.12).toFixed(2));

  // Si es CRE (Constancia de Retención de Clientes), el monto total de la retención 
  // es lo que realmente nos interesa como activo.
  const montoRetencion = isCRE ? totalRaw : (isrRet + ivaRet);

  // Cuentas Contables
  const counts = items.reduce((acc: any, cur) => { acc[cur.subcategoria_contable] = (acc[cur.subcategoria_contable] || 0) + cur.precio_total; return acc; }, {});
  const mainCat = Object.keys(counts).sort((a,b) => counts[b] - counts[a])[0] as GiroNegocio || giro;

  const accounts: Record<string, { code: string; name: string }> = {
    'MATERIA_PRIMA': { code: '5101', name: 'Materia prima y suministros' },
    'COMBUSTIBLE': { code: '5102', name: 'Combustibles y lubricantes' },
    'SERVICIOS_BASICOS': { code: '5103', name: 'Servicios públicos' },
    'MANTENIMIENTO': { code: '5104', name: 'Mantenimiento y reparaciones' },
    'ARRENDAMIENTO': { code: '5105', name: 'Arrendamientos' },
    'SERVICIOS_PROF': { code: '5106', name: 'Honorarios profesionales' },
    'PUBLICIDAD': { code: '5107', name: 'Publicidad y mercadeo' },
    'LIMPIEZA': { code: '5108', name: 'Limpieza y seguridad' },
    'SEGURIDAD': { code: '5108', name: 'Limpieza y seguridad' },
    'PAPELERIA': { code: '5109', name: 'Papelería y útiles' },
    'OTRO': { code: '5110', name: 'Otros gastos de operación' },
    'EQUIPO_COCINA': { code: '1201', name: 'Equipo de cocina' },
    'SUPERMERCADO': { code: '5101', name: 'Materia prima y suministros' },
  };

  const account = accounts[mainCat] || accounts['OTRO'];

  // Alertas
  if (isFPEQ) alertas.push("IVA NO deducible — pequeño contribuyente");
  if (isAnulado) alertas.push("Documento ANULADO — no sumar al crédito fiscal");
  if (hasMixedItems) alertas.push("Contiene activos fijos — requiere control");
  if (idpTotal > 0) alertas.push("IDP detectado — combustible no deducible");
  if (isSpecial) alertas.push("Factura especial — retener ISR y IVA");
  if (Math.abs(total) > 10000) alertas.push("Monto alto — revisar aprobación");
  if (hasMixedItems) alertas.push("Items mixtos — separar activo fijo y gasto");

  // Extraer fecha limpia (YYYY-MM-DD)
  const parseDate = (dtr: any): string => {
    if (!dtr) return new Date().toISOString().split('T')[0];
    const str = String(dtr).split(' ')[0];
    if (str.includes('/')) {
      const parts = str.split('/');
      if (parts.length === 3) {
          // Si es DD/MM/YYYY
          if (parts[2].length === 4) return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
          // Si es YYYY/MM/DD
          if (parts[0].length === 4) return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
      }
    }
    try {
        const iso = new Date(dtr).toISOString();
        return iso.split('T')[0];
    } catch (e) { return new Date().toISOString().split('T')[0]; }
  };

  const safeFecha = parseDate(raw.fecha || raw.fecha_emision || raw.fecha_hora_emision || raw.fechaEmision || raw.FechaHoraEmision);
  const safeCert = raw.fecha_certificacion ? parseDate(raw.fecha_certificacion) : safeFecha;
  const mesFiscal = parseInt(safeFecha.split('-')[1] || "0", 10);
  const anioFiscal = parseInt(safeFecha.split('-')[0] || "0", 10);

  return {
    uuid: raw.uuid,
    serie: raw.serie,
    numero: raw.numero,
    tipo_dte: tipo,
    tipo_dte_descripcion: descripciones[tipo],
    fecha_emision: safeFecha,
    fecha_certificacion: safeCert,
    estado: isAnulado ? 'ANULADO' : 'VIGENTE',
    fecha_anulacion: isAnulado ? (raw.fecha_anulacion || raw.fecha) : null,
    motivo_anulacion: isAnulado ? (raw.motivo_anulacion || "Anulación reportada por SAT") : null,
    afecta_credito_fiscal: afectaIVA,
    emisor_nit: raw.nit_emisor,
    emisor_nombre: raw.nombre_emisor,
    emisor_direccion: raw.direccion_emisor || "Ciudad de Guatemala",
    emisor_tipo_contribuyente: isFPEQ ? 'PEQUENO' : (isSpecial ? 'ESPECIAL' : 'NORMAL'),
    emisor_giro: giro,
    emisor_giro_confianza: giroConfianza,
    receptor_nit: raw.nit_receptor || "98765432-1", // Def para Restaurante
    receptor_nombre: raw.nombre_receptor || "Restaurante Las Palmas",
    moneda: raw.moneda || "GTQ",
    monto_total: total,
    monto_base_imponible: baseImponible,
    iva_monto: ivaTotal,
    iva_credito_fiscal: afectaIVA ? ivaTotal : 0,
    iva_retenido: ivaRet,
    idp_monto: Number((idpTotal * (isNegativeType ? -1 : 1)).toFixed(2)),
    impuesto_bebidas_alcoh: Number((bebalTotal * (isNegativeType ? -1 : 1)).toFixed(2)),
    impuesto_bebidas_no_alcoh: Number((bebnTotal * (isNegativeType ? -1 : 1)).toFixed(2)),
    otros_impuestos: raw.otros_impuestos || 0.00,
    isr_retenido: isrRet,
    descuentos: raw.descuentos || 0.00,
    items,
    clasificacion_compra: hasMixedItems ? 'ACTIVO_FIJO' : 'GASTO_OPERACION',
    categoria_gasto: mainCat,
    requiere_revision_manual: hasMixedItems || Math.abs(total) > 10000 || giro === 'OTRO',
    cuenta_contable: account.code,
    cuenta_contable_nombre: account.name,
    es_proveedor_frecuente: false, // Se calcula en el plugin/DB
    numero_compras_proveedor: 1,
    alertas,
    org_id: raw.org_id || 'default',
    procesado_fecha: new Date().toISOString(),
    procesado_por: "Antigravity FEL Parser v1.0",
    xml_origen: raw.xml_origen || "Agencia Virtual SAT",
    periodo_fiscal_mes: mesFiscal,
    periodo_fiscal_anio: anioFiscal,
    uuid_referencia: raw.uuid_referencia
  };
}

/**
 * Procesa un string XML de DTE SAT y devuelve el resultado de la auditoría.
 * @param xmlText El contenido del archivo XML
 */
export function parseAuditXML(xmlText: string): AuditResult {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
  
  const getTag = (tag: string) => xmlDoc.getElementsByTagNameNS('*', tag)[0];
  const getTags = (tag: string) => Array.from(xmlDoc.getElementsByTagNameNS('*', tag));

  const emisor = getTag('Emisor');
  const receptor = getTag('Receptor');
  const dte = getTag('DatosEmision');
  const totales = getTag('Totales');
  const items_nodes = getTags('Item');

  const uuid = xmlDoc.getElementsByTagNameNS('*', 'NumeroAutorizacion')[0]?.textContent || '';
  const nitEmisor = emisor?.getAttribute('NIT') || '';
  const nombreEmisor = emisor?.getAttribute('NombreEmisor') || '';
  const direccionEmisor = emisor?.getElementsByTagNameNS('*', 'Direccion')[0]?.textContent || '';
  
  const nitReceptor = receptor?.getAttribute('IDReceptor') || '';
  const nombreReceptor = receptor?.getAttribute('NombreReceptor') || '';

  const fecha = dte?.getAttribute('FechaHoraEmision')?.split('T')[0] || '';
  const total = parseFloat(totales?.getElementsByTagNameNS('*', 'GranTotal')[0]?.textContent || '0');
  const tipo = dte?.getAttribute('Tipo')?.toUpperCase() || 'FACT';
  
  const moneda = totales?.getElementsByTagNameNS('*', 'GranTotal')[0]?.getAttribute('CodigoMoneda') || 'GTQ';
  const totalDescuentos = parseFloat(totales?.getElementsByTagNameNS('*', 'TotalDescuento')[0]?.textContent || '0');

  // Retenciones (Específico para FESP o CRE)
  const isr_retenido = parseFloat(totales?.getElementsByTagNameNS('*', 'RetencionISR')[0]?.textContent || '0');
  const iva_retenido = parseFloat(totales?.getElementsByTagNameNS('*', 'RetencionIVA')[0]?.textContent || '0');

  // Impuestos Adicionales (Bebidas, IDP por tags)
  let bebalXML = 0;
  let bebnXML = 0;
  let idpXML = 0;

  getTags('Impuesto').forEach(imp => {
      const nombre = imp.getElementsByTagNameNS('*', 'NombreCorto')[0]?.textContent || '';
      const monto = parseFloat(imp.getElementsByTagNameNS('*', 'Monto')[0]?.textContent || '0');
      if (nombre.toUpperCase().includes('ALCOHOLI')) bebalXML += monto;
      if (nombre.toUpperCase().includes('NO ALCOHOLI')) bebnXML += monto;
      if (nombre.toUpperCase() === 'IDP' || nombre.toUpperCase().includes('PETROLEO')) idpXML += monto;
  });

  // Referencia para NC/NA
  const complementosLine = getTags('Complemento');
  let uuidRef = null;
  complementosLine.forEach(comp => {
      const ref = comp.getElementsByTagNameNS('*', 'ReferenciaPersonalizada')[0]?.textContent;
      if (ref) uuidRef = ref;
  });

  const rawItems = items_nodes.map(node => ({
    numero_linea: parseInt(node.getAttribute('NumeroLinea') || '0'),
    cantidad: parseFloat(node.getElementsByTagNameNS('*', 'Cantidad')[0]?.textContent || '0'),
    descripcion: node.getElementsByTagNameNS('*', 'Descripcion')[0]?.textContent || '',
    precio_unitario: parseFloat(node.getElementsByTagNameNS('*', 'PrecioUnitario')[0]?.textContent || '0'),
    total: parseFloat(node.getElementsByTagNameNS('*', 'Total')[0]?.textContent || '0'),
    unidad: node.getElementsByTagNameNS('*', 'UnidadMedida')[0]?.textContent || 'UND'
  }));

  // Revisión especial para Documento de Anulación (que no tiene Totales ni Items estándar, sino un DatosAnulacion)
  const anulacionNode = xmlDoc.getElementsByTagNameNS('*', 'GTAnulacionDocumento')[0];
  const datosAnulacion = anulacionNode?.getElementsByTagNameNS('*', 'DatosGenerales')[0];
  
  if (anulacionNode && datosAnulacion) {
      return parseAuditDTE({
          uuid: datosAnulacion.getAttribute('NumeroDocumentoAAnular') || uuid,
          serie: '', numero: '',
          nit_emisor: datosAnulacion.getAttribute('NITEmisor') || nitEmisor,
          nombre_emisor: nombreEmisor || 'Emisor Desconocido',
          nit_receptor: datosAnulacion.getAttribute('IDReceptor') || nitReceptor,
          nombre_receptor: nombreReceptor || 'Receptor Desconocido',
          fecha: datosAnulacion.getAttribute('FechaHoraAnulacion') || fecha,
          total: 0, tipo_dte: tipo, moneda, descuentos: 0,
          estado: 'ANULADO',
          fecha_anulacion: datosAnulacion.getAttribute('FechaHoraAnulacion') || '',
          motivo_anulacion: datosAnulacion.getAttribute('MotivoAnulacion') || 'Anulación reportada por XML',
          isr_retenido: 0, iva_retenido: 0, items: []
      });
  }

  const raw = {
    uuid,
    serie: xmlDoc.getElementsByTagNameNS('*', 'Serie')[0]?.textContent || '',
    numero: xmlDoc.getElementsByTagNameNS('*', 'Numero')[0]?.textContent || '',
    nit_emisor: nitEmisor,
    nombre_emisor: nombreEmisor,
    direccion_emisor: direccionEmisor,
    nit_receptor: nitReceptor,
    nombre_receptor: nombreReceptor,
    fecha,
    total,
    tipo_dte: tipo,
    moneda,
    descuentos: totalDescuentos,
    uuid_referencia: uuidRef,
    isr_retenido,
    iva_retenido,
    impuesto_bebidas_alcoh: bebalXML,
    impuesto_bebidas_no_alcoh: bebnXML,
    idp_monto: idpXML,
    items: rawItems
  };

  return parseAuditDTE(raw);
}

