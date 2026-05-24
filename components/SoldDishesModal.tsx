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
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 animate-fade-in pointer-events-auto">
            <div className="w-[750px] bg-[#2a2d3e] rounded-md  /50 flex flex-col overflow-hidden border border-white/5">

                <div className="p-6 flex gap-6">
                    {/* Left Column: Categories */}
                    <div className="flex-1 flex flex-col">
                        {/* Title bar for Cocinas */}
                        <div className="w-full bg-[#383b4d] py-2 mb-3 rounded-sm flex items-center justify-center">
                            <span className="text-white font-medium text-sm tracking-wide">Cocinas</span>
                        </div>
                        
                        {/* Categories Buttons in 2-col grid */}
                        <div className="grid grid-cols-2 gap-3 content-start">
                            {categories.map(cat => (
                                <button
                                    key={cat.id}
                                    onClick={() => setSelectedCategory(cat.id)}
                                    className={`h-[60px] flex items-center justify-center rounded-sm font-bold text-center transition-all text-xs text-white
                                        ${selectedCategory === cat.id
                                            ? 'bg-[#4a4e69] '
                                            : 'bg-[#383b4d] hover:bg-[#42465c]'
                                        }`}
                                >
                                    {cat.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Right Column: Date Range & Actions */}
                    <div className="flex flex-col w-[260px] flex-shrink-0 justify-between">
                        {/* Date Pickers */}
                        <div className="flex flex-col gap-4 mb-6">
                            <div>
                                <label className="block text-gray-300 text-xs text-center mb-1">Del</label>
                                <div className="flex rounded-sm bg-transparent border border-[#414558] overflow-hidden">
                                    <input
                                        type="date"
                                        value={startDate}
                                        onChange={(e) => setStartDate(e.target.value)}
                                        className="bg-transparent text-white p-2 w-full outline-none text-center text-xs border-r border-[#414558]"
                                        style={{ colorScheme: 'dark' }}
                                    />
                                    <input
                                        type="time"
                                        value={startTime}
                                        onChange={(e) => setStartTime(e.target.value)}
                                        className="bg-transparent text-white p-2 w-[80px] outline-none text-center text-xs"
                                        style={{ colorScheme: 'dark' }}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-gray-300 text-xs text-center mb-1 mt-2">Al</label>
                                <div className="flex rounded-sm bg-transparent border border-[#414558] overflow-hidden">
                                    <input
                                        type="date"
                                        value={endDate}
                                        onChange={(e) => setEndDate(e.target.value)}
                                        className="bg-transparent text-white p-2 w-full outline-none text-center text-xs border-r border-[#414558]"
                                        style={{ colorScheme: 'dark' }}
                                    />
                                    <input
                                        type="time"
                                        value={endTime}
                                        onChange={(e) => setEndTime(e.target.value)}
                                        className="bg-transparent text-white p-2 w-[80px] outline-none text-center text-xs"
                                        style={{ colorScheme: 'dark' }}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex flex-col gap-3 mt-6">
                            <button
                                onClick={handlePrint}
                                className="w-full py-3 bg-[#383b4d] hover:bg-[#42465c] text-white rounded-sm font-bold uppercase tracking-widest text-[10px] transition-all relative overflow-hidden"
                            >
                                IMPRIMIR
                                <div className="absolute top-0 right-0 w-0 h-0 border-t-[8px] border-t-yellow-500 border-l-[8px] border-l-transparent pointer-events-none" />
                            </button>
                            <button
                                onClick={onClose}
                                className="w-full py-3 bg-[#383b4d] hover:bg-[#42465c] text-white rounded-sm font-bold uppercase tracking-widest text-[10px] transition-all relative overflow-hidden"
                            >
                                CERRAR
                                <div className="absolute top-0 right-0 w-0 h-0 border-t-[8px] border-t-red-500 border-l-[8px] border-l-transparent pointer-events-none" />
                            </button>
                        </div>
                    </div>
                </div>

                <div className="px-6 pb-4 bg-transparent text-[10px] text-gray-300 font-medium">
                    *En el reporte aparecerán Platillos de órdenes Abiertas y Cerradas.
                </div>
            </div>
        </div>
    );
};
