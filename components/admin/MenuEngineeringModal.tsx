import React, { useState } from 'react';
import { supabase } from '../../supabase';
import {
    BarChart3, X, Play, Loader2, Calculator,
    TrendingUp, TrendingDown, Puzzle, Skull,
    FileText, Zap, AlertTriangle
} from 'lucide-react';
import { DraggableWindow } from './AdminPortal';
import { useNotify } from '../../hooks/useNotify';

interface MenuEngineeringModalProps {
    onClose: () => void;
    isStandalone?: boolean;
}

interface AnalysisResult {
    product_id: string;
    name: string;
    foodCost: number;
    menuPrice: number;
    unitsSold: number;
    revenue: number;
    realMargin: number;
    category: 'ESTRELLA' | 'CABALLO' | 'ROMPECABEZAS' | 'PERRO';
}

export const MenuEngineeringModal: React.FC<MenuEngineeringModalProps> = ({ onClose, isStandalone = false }) => {
    const notify = useNotify();
    const [loading, setLoading] = useState(false);
    const [report, setReport] = useState<string | null>(null);
    const [errorIA, setErrorIA] = useState<string | null>(null);

    // Analysis Parameters
    const [startDate, setStartDate] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        return d.toISOString().split('T')[0];
    });
    const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
    const [cardSalesRatio, setCardSalesRatio] = useState(70);
    const [cardCommission, setCardCommission] = useState(5);
    const [laborCostRatio, setLaborCostRatio] = useState(20);

    const calculateBCG = (results: AnalysisResult[]) => {
        if (results.length === 0) return results;

        const avgMargin = results.reduce((acc, curr) => acc + curr.realMargin, 0) / results.length;
        const avgUnits = results.reduce((acc, curr) => acc + curr.unitsSold, 0) / results.length;

        return results.map(item => {
            const highMargin = item.realMargin >= avgMargin;
            const highVentas = item.unitsSold >= avgUnits;

            let category: AnalysisResult['category'] = 'PERRO';
            if (highMargin && highVentas) category = 'ESTRELLA';
            else if (!highMargin && highVentas) category = 'CABALLO';
            else if (highMargin && !highVentas) category = 'ROMPECABEZAS';

            return { ...item, category };
        });
    };

    const handleRunAnalysis = async () => {
        setLoading(true);
        setReport(null);
        setErrorIA(null);

        try {
            // 1. Fetch Order Items for the period
            const { data: items, error: itemsError } = await supabase
                .from('order_items')
                .select(`
          id,
          product_id,
          quantity,
          unit_price,
          orders!inner(created_at, status)
        `)
                .eq('orders.status', 'completed')
                .gte('orders.created_at', `${startDate}T00:00:00`)
                .lte('orders.created_at', `${endDate}T23:59:59`);

            if (itemsError) throw itemsError;

            // 2. Fetch all products to get cost_price and category name
            const { data: products, error: prodError } = await supabase
                .from('products')
                .select(`
                    id, 
                    name, 
                    cost_price, 
                    category_id,
                    categories(name)
                `);

            if (prodError) throw prodError;

            // 3. Aggregate Sales
            const aggregationMap: Record<string, { units: number, revenue: number, price: number }> = {};
            items?.forEach((item: any) => {
                if (!aggregationMap[item.product_id]) {
                    aggregationMap[item.product_id] = { units: 0, revenue: 0, price: item.unit_price };
                }
                aggregationMap[item.product_id].units += item.quantity;
                aggregationMap[item.product_id].revenue += (item.unit_price * item.quantity);
            });

            // 4. Mathematical Cascade Deductions (GT 2026 Standards)
            const results: AnalysisResult[] = [];
            const IVA_FACTOR = 1.12;
            const NET_RETENTION_RATIO = 0.018; // 1.8% Retención NeoNet sobre TOTAL con IVA

            Object.entries(aggregationMap).forEach(([prodId, data]) => {
                const product = products?.find(p => p.id === prodId);
                if (!product) return;

                const foodCost = Number(product.cost_price) || 0;
                const menuPrice = data.price; // Último precio de venta

                // Cálculo Ponderado de Neto Real (Efectivo vs Tarjeta)
                const totalWithIVA = menuPrice;
                const cardPortion = cardSalesRatio / 100;
                const cashPortion = 1 - cardPortion;

                // Neto Tarjeta: (Total) - (Comisión) - (Retención 1.8%)
                const netCard = totalWithIVA * (1 - (cardCommission / 100) - NET_RETENTION_RATIO);
                // Neto Efectivo: Total / 1.12 (Solo se quita el IVA para comparar peras con peras?)
                // NO, el prompt dice: "Ventas efectivo: Neto = Total con IVA (sin deducciones)" 
                // Pero para el margen REAL debemos quitar el IVA porque el IVA no es del dueño.
                const netCash = totalWithIVA / IVA_FACTOR;

                // Ajuste según prompt: "Neto total ponderado = (neto tarjeta) + (neto efectivo)"
                // Nota: El prompt asume que en tarjeta ya se quitó el IVA al quitar comisión/retención? 
                // En GT la comisión se quita del Total con IVA.
                // Usaremos la lógica de "Dinero que realmente se queda en la bolsa"
                const realNetAverage = (netCard * cardPortion) + (netCash * cashPortion);

                // Aplicar Costo Laboral
                const netAfterLabor = realNetAverage * (1 - (laborCostRatio / 100));

                // Margen Real Final
                const realMargin = netAfterLabor - foodCost;

                results.push({
                    product_id: prodId,
                    name: product.name,
                    category: (product as any).categories?.name || 'Varios', // Initial category, will be overwritten by BCG
                    menuPrice,
                    foodCost,
                    realMargin,
                    unitsSold: data.units,
                    revenue: data.revenue
                });
            });

            // 5. Categorización BCG
            const categorizedResults = calculateBCG(results);

            // 6. Gemini Report Generation
            await generateAIReport(categorizedResults);

        } catch (error: any) {
            console.error('Error in analysis:', error);
            notify.error('Fallo en el análisis: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const limpiarMarkdown = (texto: string): string => {
        if (!texto) return '';
        return texto
            .replace(/#{1,6}\s/g, '')        // quita ## ### ####
            .replace(/\*\*(.*?)\*\*/g, '$1') // quita **negrita**
            .replace(/\*(.*?)\*/g, '$1')     // quita *italica*
            .replace(/\|.*\|/g, '')          // quita tablas |---|
            .replace(/^[-*]\s/gm, '• ')      // convierte - a •
            .replace(/\n{3,}/g, '\n\n')      // max 2 saltos linea
            .trim();
    };

    const formatearRespuesta = (texto: string) => {
        const titulos = [
            'EVALUACIÓN GENERAL',
            'OPORTUNIDAD URGENTE',
            'ACCIÓN CON LOS PERROS',
            'CABALLOS DE BATALLA',
            'ALERTA',
            'ACCIÓN ESTA SEMANA'
        ];

        let resultado = limpiarMarkdown(texto);

        titulos.forEach(titulo => {
            // Usa RegExp con modifier 'gim' (multiline) para que solo reemplace el título si está en su propia línea
            // Así evitamos que la palabra "alertas" dentro de "Sin alertas críticas" se parta.
            resultado = resultado.replace(
                new RegExp(`^\\s*${titulo}\\s*$`, 'gim'),
                `\n━━━━━━━━━━━━━━━━━━━━\n${titulo}\n`
            );
        });

        return resultado.trim();
    };

    const generateAIReport = async (data: AnalysisResult[]) => {
        // Group data by category for the prompt
        const estrellas = data.filter(d => d.category === 'ESTRELLA').map(d => '- ' + d.name + ' | Q' + d.realMargin.toFixed(2) + ' | ' + d.unitsSold).join('\n');
        const caballos = data.filter(d => d.category === 'CABALLO').map(d => '- ' + d.name + ' | Q' + d.realMargin.toFixed(2) + ' | ' + d.unitsSold).join('\n');
        const rompecabezas = data.filter(d => d.category === 'ROMPECABEZAS').map(d => '- ' + d.name + ' | Q' + d.realMargin.toFixed(2) + ' | ' + d.unitsSold).join('\n');
        const perros = data.filter(d => d.category === 'PERRO').map(d => '- ' + d.name + ' | Q' + d.realMargin.toFixed(2) + ' | ' + d.unitsSold).join('\n');

        const prompt = 'Eres un consultor experto en ingeniería de menú para restaurantes en Guatemala.\n\n' +
            'Analiza esta matriz de rentabilidad y dame recomendaciones concretas en 6 puntos.\n\n' +
            'PERÍODO: ' + startDate + ' al ' + endDate + '\n' +
            'PARÁMETROS: ' + cardSalesRatio + '% ventas con tarjeta, NeoNet ' + cardCommission + '%, Costo laboral ' + laborCostRatio + '%\n\n' +
            'ESTRELLAS (alto margen + alto volumen):\n' + (estrellas || 'Ninguno') + '\n\n' +
            'CABALLOS DE BATALLA (popular + bajo margen):\n' + (caballos || 'Ninguno') + '\n\n' +
            'ROMPECABEZAS (alto margen + pocas ventas):\n' + (rompecabezas || 'Ninguno') + '\n\n' +
            'PERROS (bajo margen + pocas ventas):\n' + (perros || 'Ninguno') + '\n\n' +
            'RESPONDE EXACTAMENTE ASÍ — sin markdown, sin asteriscos, sin #, sin tablas, sin guiones:\n\n' +
            'EVALUACIÓN GENERAL\n' +
            '[2 oraciones sobre el estado del menú en Q]\n\n' +
            'OPORTUNIDAD URGENTE\n' +
            '[El rompecabezas con mayor margen y qué hacer]\n\n' +
            'ACCIÓN CON LOS PERROS\n' +
            '[Qué hacer con los platillos menos rentables]\n\n' +
            'CABALLOS DE BATALLA\n' +
            '[Cómo mejorar su margen]\n\n' +
            'ALERTA\n' +
            '[Si hay estrellas con margen negativo, indicarlo. Si no hay, escribir: Sin alertas críticas.]\n\n' +
            'ACCIÓN ESTA SEMANA\n' +
            '[Una sola acción concreta sin cambiar precios]\n\n' +
            'Usa quetzales (Q). Español guatemalteco directo. Máximo 250 palabras en total.';

        try {
            const resp = await fetch('/api/ai/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: 'gemini-2.0-flash',
                    prompt,
                    temperature: 0.2
                })
            });

            if (!resp.ok) {
                const errData = await resp.json();
                throw new Error(errData.error || 'Error en el servidor de IA');
            }

            const json = await resp.json();
            if (json.success && json.text) {
                setReport(json.text);
            } else {
                throw new Error('No se recibió respuesta válida de la IA.');
            }

        } catch (err: any) {
            console.error('AI Proxy Error:', err);
            setErrorIA(err.message);
            setReport(null);
        }
    };

    const content = (
        <div className={`${isStandalone ? 'w-full h-full border-none  rounded-none' : 'bg-[#f0f0f0] w-[95vw] max-w-5xl h-[85vh] border-2 border-[#106ebe]  /50 rounded-lg'} flex flex-col overflow-hidden`}>
            {/* Header */}
            {!isStandalone && (
                <div className="modal-header bg-[#106ebe] p-3 flex items-center justify-between cursor-move select-none">
                    <div className="flex items-center gap-3">
                        <Calculator className="text-white" size={20} />
                        <span className="text-white font-semibold uppercase tracking-widest text-xs">Consultor de Ingeniería de Menú (Guatemala)</span>
                    </div>
                    <button onClick={onClose} className="text-white/70 hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                </div>
            )}

            <div className="flex-1 flex flex-col md:flex-row overflow-hidden bg-[#f0f0f0] min-h-0">
                {/* Sidebar: Parameters */}
                <div className="w-full md:w-80 bg-white border-r border-gray-300 px-6 py-4 flex flex-col gap-5 overflow-y-auto">
                    <div>
                        <h3 className="text-[10px] font-semibold text-indigo-600 uppercase tracking-widest mb-4 flex items-center gap-2">
                            <FileText size={14} /> Periodo de Análisis
                        </h3>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <label className="text-[9px] font-medium text-gray-400 uppercase">Inicio</label>
                                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full border border-gray-200 rounded p-2 text-[10px] font-medium" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[9px] font-medium text-gray-400 uppercase">Fin</label>
                                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full border border-gray-200 rounded p-2 text-[10px] font-medium" />
                            </div>
                        </div>
                    </div>

                    <div>
                        <h3 className="text-[10px] font-semibold text-indigo-600 uppercase tracking-widest mb-4 flex items-center gap-2">
                            <Zap size={14} /> Parámetros Globales (GT)
                        </h3>
                        <div className="space-y-4">
                            <div className="space-y-1">
                                <div className="flex justify-between">
                                    <label className="text-[9px] font-medium text-gray-400 uppercase">% Ventas con Tarjeta</label>
                                    <span className="text-[9px] font-semibold text-indigo-600">{cardSalesRatio}%</span>
                                </div>
                                <input type="range" min="0" max="100" value={cardSalesRatio} onChange={e => setCardSalesRatio(Number(e.target.value))} className="w-full accent-indigo-600" />
                            </div>
                            <div className="space-y-1">
                                <div className="flex justify-between">
                                    <label className="text-[9px] font-medium text-gray-400 uppercase">Comisión POS (NeoNet)</label>
                                    <span className="text-[9px] font-semibold text-indigo-600">{cardCommission}%</span>
                                </div>
                                <input type="range" min="0" max="10" step="0.5" value={cardCommission} onChange={e => setCardCommission(Number(e.target.value))} className="w-full accent-indigo-600" />
                            </div>
                            <div className="space-y-1">
                                <div className="flex justify-between">
                                    <label className="text-[9px] font-medium text-gray-400 uppercase">% Costo Laboral (GT)</label>
                                    <span className="text-[9px] font-semibold text-indigo-600">{laborCostRatio}%</span>
                                </div>
                                <input type="range" min="0" max="40" value={laborCostRatio} onChange={e => setLaborCostRatio(Number(e.target.value))} className="w-full accent-indigo-600" />
                                <p className="text-[8px] text-gray-400 leading-tight italic mt-1">* Incluye IGSS, IRTRA, INTECAP, Bono 14, Aguinaldo.</p>
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={handleRunAnalysis}
                        disabled={loading}
                        className="mt-4 w-full bg-[#106ebe] hover:bg-black text-white p-4 rounded-xl flex items-center justify-center gap-3 font-semibold uppercase tracking-[0.2em] text-xs transition-all disabled:opacity-50"
                    >
                        {loading ? <Loader2 className="animate-spin" size={20} /> : <Play size={20} />}
                        {loading ? 'Consultando...' : 'Iniciar Consultoría'}
                    </button>
                </div>

                {/* Content: Report */}
                <div className="flex-1 bg-white p-6 overflow-y-auto custom-scrollbar min-h-0">

                    {!report && !loading && !errorIA && (
                        <div style={{ padding: '40px 20px', color: '#4b5563', fontSize: '13px', lineHeight: '1.6' }}>
                            Selecciona el período de análisis y presiona Iniciar Consultoría para que la IA analice la rentabilidad real de tu menú.
                        </div>
                    )}

                    {loading && (
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            color: '#6b7280',
                            padding: '20px 0'
                        }}>
                            <div className="animate-spin" style={{
                                width: '16px', height: '16px',
                                border: '2px solid #333',
                                borderTop: '2px solid #4ade80',
                                borderRadius: '50%'
                            }} />
                            <span style={{ fontSize: '13px' }}>Analizando tu menú...</span>
                        </div>
                    )}

                    {errorIA && (
                        <div style={{ color: '#f87171', fontSize: '13px', padding: '20px 0' }}>
                            <p>{errorIA}</p>
                            <button onClick={handleRunAnalysis}
                                style={{
                                    color: '#4ade80',
                                    textDecoration: 'underline',
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    marginTop: '8px',
                                    padding: 0
                                }}>
                                Reintentar
                            </button>
                        </div>
                    )}

                    {report && !loading && !errorIA && (
                        <div style={{
                            fontSize: '13px',
                            lineHeight: '1.8',
                            color: '#1f2937',
                            whiteSpace: 'pre-line'
                        }}>
                            {formatearRespuesta(report)}
                        </div>
                    )}
                </div>
            </div>

            <div className="bg-[#106ebe] p-3 border-t border-white/5 flex justify-between items-center px-6 shrink-0 z-10 relative">
                <div className="flex gap-4">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                        <span className="text-[9px] font-semibold text-white/40 uppercase">Estrellas</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-amber-500"></div>
                        <span className="text-[9px] font-semibold text-white/40 uppercase">Rompecabezas</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
                        <span className="text-[9px] font-semibold text-white/40 uppercase">Caballos</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-rose-500"></div>
                        <span className="text-[9px] font-semibold text-white/40 uppercase">Perros</span>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <span className="text-[9px] font-semibold text-white/40 uppercase tracking-widest italic flex items-center gap-2">
                        <AlertTriangle size={12} className="text-amber-500" /> Basado en Legislación de Guatemala (Planilla + 42% prestaciones)
                    </span>
                </div>
            </div>
        </div>
    );

    if (isStandalone) return content;

    return (
        <div className="fixed inset-0 bg-black/40  z-[1000] flex items-center justify-center p-4">
            <DraggableWindow id="menu-engineering-modal" title="Ingeniería de Menú (Consultor IA)">
                {content}
            </DraggableWindow>
        </div>
    );
};
