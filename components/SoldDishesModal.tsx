import React, { useState } from 'react';
import { X } from 'lucide-react';
import { supabase } from '../supabase';
import { printService } from '../services/PrintService';
import { DateUtils } from '../utils/DateUtils';

interface SoldDishesModalProps {
    onClose: () => void;
}

export const SoldDishesModal: React.FC<SoldDishesModalProps> = ({ onClose }) => {
    // Current date for default values
    // Current date for default values in Guatemala time
    const nowLocal = new Date(Date.now());
    const formattedDate = nowLocal.toLocaleDateString('en-CA'); // YYYY-MM-DD
    const formattedTime = nowLocal.toLocaleTimeString('es-GT', { hour12: false, hour: '2-digit', minute: '2-digit' });

    const [selectedCategory, setSelectedCategory] = useState('ALL');
    const [startDate, setStartDate] = useState(formattedDate);
    const [startTime, setStartTime] = useState('00:00');
    const [endDate, setEndDate] = useState(formattedDate);
    const [endTime, setEndTime] = useState(formattedTime);
    const printService = PrintService.getInstance();

    // Hardcoded categories based on the user's reference image
    const categories = [
        { id: 'ALL', label: 'Todas las Cocinas' },
        { id: 'GENERAL', label: 'GENERAL' },
        { id: 'CEVICHERIA', label: 'CEVICHERIA' },
        { id: 'BEBIDAS', label: 'BEBIDAS' },
        { id: 'COCINA', label: 'COCINA' },
    ];

    const handlePrint = async () => {
        try {
            // 1. Calculate full ISO Timestamps (UTC) for the query
            // We append the Guatemala offset (-06:00) so Supabase knows it's local time
            const startTimestamp = `${startDate}T${startTime}:00-06:00`;
            const endTimestamp = `${endDate}T${endTime}:59-06:00`;

            // 2. Fetch data from Supabase
            // We join with products and categories to filter by area
            const { data, error } = await supabase
                .from('order_items')
                .select(`
                    quantity,
                    products:products (
                        name,
                        categories:categories (
                            name
                        )
                    )
                `)
                .gte('created_at', startTimestamp)
                .lte('created_at', endTimestamp)
                .neq('status', 'voided'); // Exclude voided items

            if (error) throw error;
            
            console.log('DEBUG KITCHEN REPORT:', {
                startTimestamp,
                endTimestamp,
                count: data?.length || 0,
                firstItem: data?.[0]
            });

            if (!data || data.length === 0) {
                alert(`No se encontraron platos vendidos. (Rango: ${startTime} - ${endTime})`);
                return;
            }

            // 3. Define STATION_CATEGORY_MAP (Synced with KitchenView)
            const STATION_CATEGORY_MAP: Record<string, string[]> = {
                'COCINA CALIENTE': ['HAMBURGUESAS', 'CALDOS', 'CARNES', 'DESAYUNOS', 'ALMUERZOS', 'EXTRAS', 'GUARNICIONES', 'MENU INFANTIL', 'SOPAS', 'PLATOS FUERTES', 'GUARNICIONES CALIENTES', 'TACOS', 'REFACCIONES'],
                'COCINA': ['HAMBURGUESAS', 'CALDOS', 'CARNES', 'DESAYUNOS', 'ALMUERZOS', 'EXTRAS', 'GUARNICIONES', 'MENU INFANTIL', 'SOPAS', 'PLATOS FUERTES', 'GUARNICIONES CALIENTES', 'TACOS', 'REFACCIONES'],
                'CEVICHERIA': ['CEVICHES', 'COCTELES', 'CRUDOS', 'MARISCOS', 'ENTRADAS', 'AGUACHILES', 'TOSTADAS', 'ENTRADAS FRIAS', 'TIKAS', 'CEVICHE TIPO COCTEL (SALSA DULCE)'],
                'BARRA': ['BEBIDAS', 'CERVEZAS', 'SODAS', 'LICUADOS', 'CAFÉ', 'COCTELERIA', 'BEBIDAS CALIENTES', 'JUGOS', 'MICHELADAS', 'LICORES', 'VINOS', 'TRAGOS', 'AGUA PURA'],
                'BEBIDAS': ['BEBIDAS', 'CERVEZAS', 'SODAS', 'LICUADOS', 'CAFÉ', 'COCTELERIA', 'BEBIDAS CALIENTES', 'JUGOS', 'MICHELADAS', 'LICORES', 'VINOS', 'TRAGOS', 'AGUA PURA', 'LICUADO'],
                'POSTRES': ['POSTRES', 'HELADOS', 'PASTELES', 'MILKSHAKES']
            };

            // 4. Filter by Area
            let filteredData = data;
            if (selectedCategory !== 'ALL') {
                const allowedCategories = STATION_CATEGORY_MAP[selectedCategory];

                if (selectedCategory === 'GENERAL') {
                    // GENERAL shows anything NOT in the other specific maps
                    const allMappedKeywords = Object.values(STATION_CATEGORY_MAP).flat();
                    filteredData = data.filter((item: any) => {
                        const catName = item.products?.categories?.name?.toUpperCase() || '';
                        if (!catName) return true; // No category -> General
                        // If the category name contains ANY of the keywords from other stations, EXCLUDE it from General
                        const isMapped = allMappedKeywords.some(keyword => catName.includes(keyword));
                        return !isMapped;
                    });
                } else if (allowedCategories) {
                    filteredData = data.filter((item: any) => {
                        const catName = item.products?.categories?.name?.toUpperCase() || '';
                        return catName && allowedCategories.some(allowed => catName.includes(allowed));
                    });
                }
            }

            if (filteredData.length === 0) {
                alert(`No hay ventas registradas para ${selectedCategory} en este periodo.`);
                return;
            }

            // 5. Group by Name and Sum Quantity
            const grouped: Record<string, { name: string, quantity: number }> = {};
            filteredData.forEach((item: any) => {
                const name = item.products?.name || 'Producto Desconocido';
                const qty = item.quantity || 0;
                if (grouped[name]) {
                    grouped[name].quantity += qty;
                } else {
                    grouped[name] = { name, quantity: qty };
                }
            });

            const finalData = Object.values(grouped).sort((a, b) => b.quantity - a.quantity);

            // 6. Call Printing Service
            const categoryLabel = categories.find(c => c.id === selectedCategory)?.label || selectedCategory;
            await printService.printSoldDishesReport(
                finalData,
                `${startDate} ${startTime}`,
                `${endDate} ${endTime}`,
                categoryLabel
            );

        } catch (err) {
            console.error('Error generando reporte de platillos:', err);
            alert('Error al generar el reporte. Revisa la consola.');
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-fade-in">
            <div className="w-full max-w-4xl bg-[#1e232f] rounded-sm shadow-2xl flex flex-col overflow-hidden border border-white/10">
                {/* Header */}
                <div className="px-4 py-3 bg-[#2a2f3d] flex justify-between items-center border-b border-white/5">
                    <span className="text-gray-200 font-medium text-sm">Cocinas</span>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                        <X size={18} />
                    </button>
                </div>

                <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8 bg-[#222733]">
                    {/* Left Column: Categories Buttons */}
                    <div className="flex flex-col gap-3">
                        {categories.map(cat => (
                            <button
                                key={cat.id}
                                onClick={() => setSelectedCategory(cat.id)}
                                className={`py-4 px-6 rounded-md font-bold text-left transition-all text-xs uppercase tracking-wide
                                    ${selectedCategory === cat.id
                                        ? 'bg-[#373d4d] text-white shadow-md'
                                        : 'bg-[#2b303d] text-gray-400 hover:bg-[#323746] hover:text-gray-300'
                                    }`}
                            >
                                {cat.label}
                            </button>
                        ))}
                    </div>

                    {/* Right Column: Date Range & Actions */}
                    <div className="flex flex-col h-full">
                        {/* Date Pickers */}
                        <div className="flex flex-col gap-6 mb-8">
                            <div className="flex gap-4 items-center">
                                <div className="w-full">
                                    <label className="block text-gray-400 text-xs font-bold mb-1 text-center">Del</label>
                                    <div className="flex rounded border border-gray-600 overflow-hidden bg-[#1a1d26]">
                                        <input
                                            type="date"
                                            value={startDate}
                                            onChange={(e) => setStartDate(e.target.value)}
                                            className="bg-transparent text-white p-2 w-full outline-none text-center text-xs uppercase"
                                        />
                                        <div className="w-[1px] bg-gray-600"></div>
                                        <input
                                            type="time"
                                            value={startTime}
                                            onChange={(e) => setStartTime(e.target.value)}
                                            className="bg-transparent text-white p-2 w-24 outline-none text-center text-xs"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-4 items-center">
                                <div className="w-full">
                                    <label className="block text-gray-400 text-xs font-bold mb-1 text-center">Al</label>
                                    <div className="flex rounded border border-gray-600 overflow-hidden bg-[#1a1d26]">
                                        <input
                                            type="date"
                                            value={endDate}
                                            onChange={(e) => setEndDate(e.target.value)}
                                            className="bg-transparent text-white p-2 w-full outline-none text-center text-xs uppercase"
                                        />
                                        <div className="w-[1px] bg-gray-600"></div>
                                        <input
                                            type="time"
                                            value={endTime}
                                            onChange={(e) => setEndTime(e.target.value)}
                                            className="bg-transparent text-white p-2 w-24 outline-none text-center text-xs"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Spacer */}
                        <div className="flex-1"></div>

                        {/* Action Buttons */}
                        <div className="flex flex-col gap-3 mt-4">
                            <button
                                onClick={handlePrint}
                                className="w-full py-3 bg-[#333947] hover:bg-[#3e4556] text-white rounded-md font-bold uppercase tracking-widest text-[10px] transition-all shadow-lg border-b-2 border-[#20242e] active:scale-[0.99]"
                            >
                                IMPRIMIR
                            </button>
                            <button
                                onClick={onClose}
                                className="w-full py-3 bg-[#333947] hover:bg-[#3e4556] text-white rounded-md font-bold uppercase tracking-widest text-[10px] transition-all shadow-lg border-b-2 border-rose-500/50 active:scale-[0.99]"
                            >
                                CERRAR
                            </button>
                        </div>
                    </div>
                </div>

                <div className="px-6 py-2 bg-[#2a2f3d] border-t border-white/5 text-[10px] text-gray-500">
                    *En el reporte aparecerán Platillos de órdenes Abiertas y Cerradas.
                </div>
            </div>
        </div>
    );
};
