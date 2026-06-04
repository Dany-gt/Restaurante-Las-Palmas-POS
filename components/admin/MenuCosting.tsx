import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabase';
import {
    Calculator, Save, Info, TrendingUp, DollarSign,
    Clock, Percent, Search, PieChart, ChevronDown, Check,
    Plus, Trash2, ArrowRight, Target, AlertTriangle, ShieldCheck, ToggleLeft, ToggleRight, Printer, X
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useNotify } from '../../hooks/useNotify';
import { Product } from '../../types';
import { registrarAuditoria, detectarCambios } from '../../services/auditService';
import { activityLogService } from '../../services/ActivityLogService';

const CONFIG_POR_CATEGORIA: Record<string, any> = {
  comida: {
    gif: 0.05,          // Gas, aceite, sal, condimentos
    costoPrimoObj: 0.35,
  },
  bebida_preparada: {
    gif: 0.05,          // Hielo, pajillas, sal, limón de guarnición
    costoPrimoObj: 0.22, // Margen más alto porque no hay cocinero ni gas mayor
  },
  bebida_reventa: {
    gif: 0.00,          // Botella cerrada, no hay merma de cocina
    costoPrimoObj: 0.50, // El mercado fija el precio (cerveza, soda)
  },
};

const CONFIG_CONTABLE = {
    comisionPos: 0.035,
    iva: 0.12,
};

function calcularKPIs(costoIngredientes: number, precioVentaActual: number, categoriaBase: string = "comida") {
    if (!costoIngredientes || costoIngredientes <= 0) return null;

    // Normalizar categorías de la base de datos a los 3 pilares contables
    let categoria = "comida";
    const catLower = (categoriaBase || "").toLowerCase();
    
    if (CONFIG_POR_CATEGORIA[catLower]) {
        categoria = catLower; // Si pasa la llave exacta
    } else if (catLower.includes("preparada") || catLower.includes("licor") || catLower === "cafés") {
        categoria = "bebida_preparada";
    } else if (catLower.includes("bebida") || catLower.includes("cerveza") || catLower.includes("embotellada")) {
        categoria = "bebida_reventa";
    }

    const cfg = CONFIG_POR_CATEGORIA[categoria] ?? CONFIG_POR_CATEGORIA.comida;

    const costoConGIF = costoIngredientes * (1 + cfg.gif);
    const precioSugerido = Math.ceil(
        (costoConGIF / cfg.costoPrimoObj) *
        (1 + CONFIG_CONTABLE.comisionPos) *
        (1 + CONFIG_CONTABLE.iva)
    );
    
    const ingresoNeto = precioVentaActual > 0
        ? precioVentaActual / (1 + CONFIG_CONTABLE.iva) / (1 + CONFIG_CONTABLE.comisionPos)
        : null;
        
    const porcentajeCostoPrimo = precioVentaActual > 0
        ? (costoConGIF / precioVentaActual) * 100
        : null;
        
    const margenDisponible = ingresoNeto ? ingresoNeto - costoConGIF : null;

    let salud;
    if (categoria === "bebida_reventa") {
        salud = (porcentajeCostoPrimo && porcentajeCostoPrimo <= 50) ? "excelente"
            : (porcentajeCostoPrimo && porcentajeCostoPrimo <= 55) ? "regular" : "alerta";
    } else if (categoria === "bebida_preparada") {
        salud = (porcentajeCostoPrimo && porcentajeCostoPrimo <= 22) ? "excelente"
            : (porcentajeCostoPrimo && porcentajeCostoPrimo <= 30) ? "regular" : "alerta";
    } else {
        salud = (porcentajeCostoPrimo && porcentajeCostoPrimo <= 35) ? "excelente"
            : (porcentajeCostoPrimo && porcentajeCostoPrimo <= 40) ? "regular" : "alerta";
    }

    return { costoConGIF, precioSugerido, porcentajeCostoPrimo, margenDisponible, salud, categoriaAplicada: categoria };
}

export const MenuCosting: React.FC = () => {
    const currentUser = JSON.parse(localStorage.getItem('currentUser') || 'null');
    const [originalConfig, setOriginalConfig] = useState<any>(null);

    const [products, setProducts] = useState<Product[]>([]);
    const [inventoryItems, setInventoryItems] = useState<any[]>([]);
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [recipeItems, setRecipeItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const notify = useNotify();

    const [isGeneratingReport, setIsGeneratingReport] = useState(false);
    const [globalReportData, setGlobalReportData] = useState<any[] | null>(null);

    // MODULE 1: Recipe States
    const [wastePercentage, setWastePercentage] = useState<Record<string, number>>({});

    // MODULE 2: Labor (MOD) States - 8 Law Concepts GT (all editable)
    const [numberOfCooks, setNumberOfCooks] = useState<number>(4);
    const [monthlyBaseSalary, setMonthlyBaseSalary] = useState<number>(15267.60); // 4 × Q3,816.90
    const [prepTime, setPrepTime] = useState<number>(20);
    // 8 benefit concepts — preloaded with legal values for 4 cooks, all editable:
    const [modIgss, setModIgss] = useState<number>(1629.05);       // 15267.60 × 10.67%
    const [modIntecap, setModIntecap] = useState<number>(152.68);  // 15267.60 × 1%
    const [modIrtra, setModIrtra] = useState<number>(152.68);      // 15267.60 × 1%
    const [modBonificacion, setModBonificacion] = useState<number>(1000.00); // Q250 × 4 cooks
    const [modAguinaldo, setModAguinaldo] = useState<number>(1272.30);  // /12
    const [modBono14, setModBono14] = useState<number>(1272.30);        // /12
    const [modVacaciones, setModVacaciones] = useState<number>(636.15); // /24
    const [modIndemnizacion, setModIndemnizacion] = useState<number>(1272.30); // /12

    // MODULE 3: Variable & Fixed Costs
    const [variableCostsPerPlate, setVariableCostsPerPlate] = useState<number>(0.84);
    const [monthlyFixedCosts, setMonthlyFixedCosts] = useState<number>(69797.20);
    const [totalMonthlyPortions, setTotalMonthlyPortions] = useState<number>(19964);

    // MODULE 4: Pricing Strategy (Divisor Method)
    const [fcTargetFood, setFcTargetFood] = useState<number>(35);
    const [fcTargetPrepDrinks, setFcTargetPrepDrinks] = useState<number>(25);
    const [fcTargetBottled, setFcTargetBottled] = useState<number>(20);
    const [fcTargetLiquor, setFcTargetLiquor] = useState<number>(15);
    const [cardCommission, setCardCommission] = useState<number>(4.5);

    // MODULE 5: IVA Toggle (Global Regime)
    const [isNormalContributor, setIsNormalContributor] = useState<boolean>(true); // true = Régimen Normal

    // MODULE 6: Break-even additional inputs
    const [avgSalePrice, setAvgSalePrice] = useState<number>(55); // Q promedio de venta
    const [operatingDays, setOperatingDays] = useState<number>(26); // días operativos al mes

    const IVA_FACTOR = 1.12;

    const [isSavingConfig, setIsSavingConfig] = useState(false);

    // Auto-recalculate all 8 prestaciones when salary OR numberOfCooks changes
    useEffect(() => {
        setModIgss(parseFloat((monthlyBaseSalary * 0.1067).toFixed(2)));
        setModIntecap(parseFloat((monthlyBaseSalary * 0.01).toFixed(2)));
        setModIrtra(parseFloat((monthlyBaseSalary * 0.01).toFixed(2)));
        setModBonificacion(parseFloat((250 * numberOfCooks).toFixed(2))); // Q250 × n cooks
        setModAguinaldo(parseFloat((monthlyBaseSalary / 12).toFixed(2)));
        setModBono14(parseFloat((monthlyBaseSalary / 12).toFixed(2)));
        setModVacaciones(parseFloat((monthlyBaseSalary / 24).toFixed(2)));
        setModIndemnizacion(parseFloat((monthlyBaseSalary / 12).toFixed(2)));
    }, [monthlyBaseSalary, numberOfCooks]);

    // Load global config on mount
    useEffect(() => {
        fetchProducts();
        loadConfig();
    }, []);

    const loadConfig = async () => {
        const { data, error } = await supabase
            .from('menu_costing_config')
            .select('*')
            .eq('org_id', 'default')
            .single();
        if (error || !data) return;
        setMonthlyBaseSalary(data.monthly_base_salary);
        setPrepTime(data.prep_time_minutes);
        setNumberOfCooks(data.number_of_cooks ?? 4);
        setModIgss(data.mod_igss);
        setModIntecap(data.mod_intecap);
        setModIrtra(data.mod_irtra);
        setModBonificacion(data.mod_bonificacion);
        setModAguinaldo(data.mod_aguinaldo);
        setModBono14(data.mod_bono14);
        setModVacaciones(data.mod_vacaciones);
        setModIndemnizacion(data.mod_indemnizacion);
        setVariableCostsPerPlate(data.variable_costs_per_plate);
        setMonthlyFixedCosts(data.monthly_fixed_costs);
        setTotalMonthlyPortions(data.total_monthly_portions);
        if (data.fc_target_food) setFcTargetFood(data.fc_target_food);
        if (data.fc_target_prep_drinks) setFcTargetPrepDrinks(data.fc_target_prep_drinks);
        if (data.fc_target_bottled) setFcTargetBottled(data.fc_target_bottled);
        if (data.fc_target_liquor) setFcTargetLiquor(data.fc_target_liquor);
        setCardCommission(data.card_commission_pct);
        setIsNormalContributor(data.is_normal_contributor);
        setAvgSalePrice(data.avg_sale_price);
        setOperatingDays(data.operating_days);
        setOriginalConfig(data);
    };

    const saveConfig = async () => {
        setIsSavingConfig(true);
        const payload = {
            org_id: 'default',
            number_of_cooks: numberOfCooks,
            monthly_base_salary: monthlyBaseSalary,
            mod_igss: modIgss,
            mod_intecap: modIntecap,
            mod_irtra: modIrtra,
            mod_bonificacion: modBonificacion,
            mod_aguinaldo: modAguinaldo,
            mod_bono14: modBono14,
            mod_vacaciones: modVacaciones,
            mod_indemnizacion: modIndemnizacion,
            variable_costs_per_plate: variableCostsPerPlate,
            monthly_fixed_costs: monthlyFixedCosts,
            total_monthly_portions: totalMonthlyPortions,
            fc_target_food: fcTargetFood,
            fc_target_prep_drinks: fcTargetPrepDrinks,
            fc_target_bottled: fcTargetBottled,
            fc_target_liquor: fcTargetLiquor,
            card_commission_pct: cardCommission,
            is_normal_contributor: isNormalContributor,
            avg_sale_price: avgSalePrice,
            operating_days: operatingDays,
        };
        const { error } = await supabase
            .from('menu_costing_config')
            .upsert(payload, { onConflict: 'org_id' });

        if (!error && currentUser && originalConfig) {
            // Log Gastos Fijos Modificados / CONFIG_MOD_CAMBIADA consolidado
            const cambios = detectarCambios(originalConfig, payload);
            if (cambios.campos_modificados.length > 0) {

                const oldTotalLabor = originalConfig.monthly_base_salary + originalConfig.mod_igss + originalConfig.mod_intecap + originalConfig.mod_irtra + originalConfig.mod_bonificacion + originalConfig.mod_aguinaldo + originalConfig.mod_bono14 + originalConfig.mod_vacaciones + originalConfig.mod_indemnizacion;
                const oldMins = (originalConfig.number_of_cooks || 4) * originalConfig.operating_days * 8 * 60;
                const oldCpM = oldMins ? oldTotalLabor / oldMins : 0;

                const currentMonthlyLaborTotalReal = monthlyBaseSalary + modIgss + modIntecap + modIrtra + modBonificacion + modAguinaldo + modBono14 + modVacaciones + modIndemnizacion;
                const currentTotalCookMinutesPerMonth = numberOfCooks * operatingDays * 8 * 60;
                const currentCostPerMinute = currentTotalCookMinutesPerMonth > 0 ? currentMonthlyLaborTotalReal / currentTotalCookMinutesPerMonth : 0;

                const hasLaborChange = originalConfig.monthly_base_salary !== monthlyBaseSalary || originalConfig.number_of_cooks !== numberOfCooks;
                const hasFixedCostChange = originalConfig.monthly_fixed_costs !== monthlyFixedCosts;

                if (hasFixedCostChange) {
                    await registrarAuditoria({
                        modulo: 'ESTRATEGIA',
                        sub_modulo: 'FICHA_TECNICA',
                        accion: 'GASTOS_FIJOS_MODIFICADOS',
                        accion_descripcion: `Gastos fijos actualizados: Q${originalConfig.monthly_fixed_costs} → Q${monthlyFixedCosts}`,
                        entidad_tipo: 'configuracion',
                        entidad_nombre: 'menu_costing_config',
                        ...detectarCambios({ monthly_fixed_costs: originalConfig.monthly_fixed_costs }, { monthly_fixed_costs: monthlyFixedCosts }),
                        impacto_financiero: {
                            diferencia_precio: monthlyFixedCosts - originalConfig.monthly_fixed_costs,
                            impacto_mensual_estimado: `Prorrateo cambia de Q${originalConfig.total_monthly_portions ? (originalConfig.monthly_fixed_costs / originalConfig.total_monthly_portions).toFixed(2) : 0} a Q${totalMonthlyPortions ? (monthlyFixedCosts / totalMonthlyPortions).toFixed(2) : 0} por platillo`
                        },
                        es_reversible: true,
                        datos_para_revertir: {
                            tabla: 'menu_costing_config',
                            valores: originalConfig
                        }
                    });
                }

                if (hasLaborChange || cambios.campos_modificados.filter(c => c !== 'monthly_fixed_costs').length > 0) {
                    await registrarAuditoria({
                        modulo: 'ESTRATEGIA',
                        sub_modulo: 'FICHA_TECNICA',
                        accion: 'CONFIG_MOD_CAMBIADA',
                        accion_descripcion: `Configuración operativa actualizada. Campos afectados: ${cambios.campos_modificados.join(', ')}`,
                        entidad_tipo: 'configuracion',
                        entidad_nombre: 'menu_costing_config',
                        ...cambios,
                        impacto_financiero: {
                            impacto_mensual_estimado: hasLaborChange ? `Costo por minuto de MOD cambió de Q${oldCpM.toFixed(2)} a Q${currentCostPerMinute.toFixed(2)}` : 'Sin impacto financiero directo'
                        },
                        es_reversible: true,
                        datos_para_revertir: {
                            tabla: 'menu_costing_config',
                            valores: originalConfig
                        }
                    });
                }
            }

            setOriginalConfig(payload);
        }

        if (error) {
            notify.error('Error al guardar: ' + error.message);
        } else {
            notify.success('✓ Configuración guardada correctamente');
        }
        setIsSavingConfig(false);
    };

    const fetchProducts = async () => {
        // Fetch platillos for the list
        const { data: plats, error: pErr } = await supabase.from('products').select('*, categories(name), menu_categories(nombre)').eq('es_platillo', true).order('name');
        if (!pErr) setProducts(plats || []);

        // Fetch ALL products for mapping (including sub-recipes/misclassified)
        const { data: invItems, error: iErr } = await supabase.from('products').select('id, name, cost_price, unit_measure, conversion_factor');
        if (!iErr) setInventoryItems(invItems || []);
    };

    const fetchRecipe = async (prodId: string) => {
        setLoading(true);
        console.log('[MenuCosting] Fetching recipe for:', prodId);

        // Step 1: Ensure we have inventory items for mapping
        let currentInvItems = inventoryItems;
        if (currentInvItems.length === 0) {
            const { data: invItems } = await supabase.from('products').select('id, name, cost_price, unit_measure, conversion_factor');
            if (invItems) {
                setInventoryItems(invItems);
                currentInvItems = invItems;
            }
        }

        // Step 2: Fetch the recipe rows
        const { data: recipeRows, error } = await supabase
            .from('product_recipes')
            .select('*')
            .eq('product_id', prodId);

        if (error) {
            console.error('[MenuCosting] Error fetching recipes:', error);
            notify.error('Error al cargar receta: ' + error.message);
            setLoading(false);
            return;
        }

        if (recipeRows) {
            // Step 3: Manually join with our inventory items
            const mappedData = recipeRows.map(row => {
                const itemDetail = currentInvItems.find(item => item.id === row.inventory_item_id);
                return {
                    ...row,
                    inventory_items: itemDetail ? {
                        id: itemDetail.id,
                        name: itemDetail.name,
                        cost: itemDetail.cost_price, // Gross cost for invoice alignment
                        unit_measure: itemDetail.unit_measure,
                        conversion_factor: itemDetail.conversion_factor
                    } : null
                };
            });

            console.log('[MenuCosting] Mapped recipe items:', mappedData.length);
            setRecipeItems(mappedData);

            // Restore saved waste percentages from DB
            const wasteMap: Record<string, number> = {};
            mappedData.forEach((item: any) => {
                if (item.waste_percentage != null) {
                    wasteMap[item.inventory_item_id] = item.waste_percentage;
                }
            });
            setWastePercentage(wasteMap);
        } else {
            setRecipeItems([]);
        }
        setLoading(false);
    };

    const handleProductSelect = (prod: Product) => {
        setSelectedProduct(prod);
        fetchRecipe(prod.id);
        if (prod.prep_time) setPrepTime(parseInt(prod.prep_time) || 25);
    };

    // Save individual product configurations (Waste % and Prep Time) back to DB
    const saveProductData = async () => {
        if (!selectedProduct) return;

        // 1. Update waste percentages for the recipe
        const updates = recipeItems.map((item: any) =>
            supabase
                .from('product_recipes')
                .update({ waste_percentage: wastePercentage[item.inventory_item_id] || 0 })
                .eq('product_id', selectedProduct.id)
                .eq('inventory_item_id', item.inventory_item_id)
        );

        // 2. Update the product's preparation time
        updates.push(
            supabase
                .from('products')
                .update({ prep_time: prepTime.toString() })
                .eq('id', selectedProduct.id)
        );

        // --- AUDIT LOGGING PREP ---
        const mermas_modificadas: any[] = [];
        const oldPrepTime = parseInt(selectedProduct.prep_time || '20');

        let oldFoodCost = 0;
        recipeItems.forEach((item: any) => {
            const oldMerma = item.waste_percentage || 0;
            const newMerma = wastePercentage[item.inventory_item_id] || 0;

            if (oldMerma !== newMerma) {
                mermas_modificadas.push({
                    ingrediente: item.inventory_items?.name || item.inventory_item_id,
                    antes: oldMerma,
                    despues: newMerma
                });
            }

            const rawCost = item.inventory_items?.cost || 0;
            const conversionFactor = item.inventory_items?.conversion_factor || 1;
            const unitCostForCalc = isNormalContributor ? rawCost / IVA_FACTOR : rawCost;
            const costPerBaseUnit = unitCostForCalc / conversionFactor;

            const qty = item.quantity || 0;
            let unitFactor = 1;
            const selectedUnit = (item.unit_measure || '').toLowerCase();
            const baseUnit = (item.inventory_items?.unit_measure || '').toLowerCase();

            // LÓGICA DE CONVERSIÓN DE UNIDADES (Prorrateo Inteligente)
            if (selectedUnit.includes('unidad') || selectedUnit.includes('botella') || selectedUnit.includes('barril')) {
                unitFactor = 1;
            }
            else if (baseUnit.includes('libra') || baseUnit === 'lb') {
                if (selectedUnit.includes('onza')) unitFactor = 1 / 16;
                else if (selectedUnit.includes('gramo') || selectedUnit === 'g') unitFactor = 1 / 453.592;
                else if (selectedUnit.includes('kilo') || selectedUnit === 'kg') unitFactor = 2.20462;
            } else if (baseUnit.includes('kilo') || baseUnit === 'kg') {
                if (selectedUnit.includes('gramo') || selectedUnit === 'g') unitFactor = 1 / 1000;
                else if (selectedUnit.includes('onza')) unitFactor = 1 / 35.274;
                else if (selectedUnit.includes('libra') || selectedUnit === 'lb') unitFactor = 0.453592;
            } else if (baseUnit.includes('onza')) {
                if (selectedUnit.includes('gramo') || selectedUnit === 'g') unitFactor = 1 / 28.3495;
                else if (selectedUnit.includes('libra') || selectedUnit === 'lb') unitFactor = 16;
                else if (selectedUnit.includes('kilo') || selectedUnit === 'kg') unitFactor = 35.274;
                else if (selectedUnit.includes('mililitro') || selectedUnit === 'ml') unitFactor = 1 / 29.5735;
                else if (selectedUnit.includes('litro') || selectedUnit === 'lt') unitFactor = 1000 / 29.5735;
                else if (selectedUnit.includes('galón') || selectedUnit.includes('galon')) unitFactor = 3785.41 / 29.5735;
            } else if (baseUnit.includes('gramo') || baseUnit === 'g') {
                if (selectedUnit.includes('onza')) unitFactor = 28.3495;
                else if (selectedUnit.includes('libra') || selectedUnit === 'lb') unitFactor = 453.592;
                else if (selectedUnit.includes('kilo') || selectedUnit === 'kg') unitFactor = 1000;
            } else if (baseUnit.includes('litro') || baseUnit === 'lt' || baseUnit.includes('mililitro') || baseUnit === 'ml' || baseUnit.includes('galón') || baseUnit.includes('galon') || baseUnit.includes('botella') || baseUnit.includes('barril')) {
                let baseInMl = 1;
                if (baseUnit.includes('litro') || baseUnit === 'lt') baseInMl = 1000;
                else if (baseUnit.includes('galón') || baseUnit.includes('galon')) baseInMl = 3785.41;
                else if (baseUnit.includes('botella')) baseInMl = 750; // Estándar
                else if (baseUnit.includes('barril')) baseInMl = 50000; // 50L
                
                let selectedInMl = 1;
                if (selectedUnit.includes('mililitro') || selectedUnit === 'ml') selectedInMl = 1;
                else if (selectedUnit.includes('onza')) selectedInMl = 29.5735;
                else if (selectedUnit.includes('litro') || selectedUnit === 'lt') selectedInMl = 1000;
                else if (selectedUnit.includes('galón') || selectedUnit.includes('galon')) selectedInMl = 3785.41;
                else if (selectedUnit.includes('botella')) selectedInMl = 750;
                else if (selectedUnit.includes('barril')) selectedInMl = 50000;

                if (selectedUnit.includes('mililitro') || selectedUnit === 'ml' || selectedUnit.includes('onza') || selectedUnit.includes('litro') || selectedUnit === 'lt' || selectedUnit.includes('galón') || selectedUnit.includes('galon') || selectedUnit.includes('botella') || selectedUnit.includes('barril')) {
                    unitFactor = selectedInMl / baseInMl;
                }
            }

            const baseCostLine = costPerBaseUnit * qty * unitFactor;
            oldFoodCost += (baseCostLine * (1 / (1 - oldMerma / 100)));
        });

        const oldLaborCost = costPerMinute * oldPrepTime;
        const oldTotalCost = oldFoodCost + oldLaborCost + variableCostsPerPlate + fixedCostPerPlate;

        let activeFoodCostTargetPct = fcTargetFood;
        const cat = (selectedProduct as any)?.categories?.name?.toLowerCase() || '';
        const prodName = selectedProduct.name.toLowerCase();
        if (cat.includes('cerveza') || cat.includes('agua') || cat.includes('gaseosa') || prodName.includes('botella')) activeFoodCostTargetPct = fcTargetBottled;
        else if (cat.includes('licor') || cat.includes('trago')) activeFoodCostTargetPct = fcTargetLiquor;
        else if (cat.includes('bebida') || cat.includes('cafe') || cat.includes('café') || prodName.includes('smoothie') || prodName.includes('mineral') || prodName.includes('michelada') || prodName.includes('limonada')) activeFoodCostTargetPct = fcTargetPrepDrinks;

        const targetDivisor = activeFoodCostTargetPct / 100;
        const oldPriceBase = targetDivisor > 0 ? oldTotalCost / targetDivisor : 0;
        const oldPricePostNeonet = oldPriceBase / (1 - cardCommission / 100);
        const oldSuggestedPriceWithIva = oldPricePostNeonet * IVA_FACTOR;

        // --- END AUDIT LOGGING PREP ---

        await Promise.all(updates);

        if (currentUser) {
            activityLogService.log({
                user: currentUser,
                module: 'FACTURACION', // Using standard module
                action: 'FICHA_TECNICA_GUARDADA' as any,
                severity: 'WARNING',
                entity_id: selectedProduct.id,
                entity_type: 'PRODUCTO',
                details: {
                    platillo_id: selectedProduct.id,
                    nombre: selectedProduct.name,
                    food_cost_anterior: oldFoodCost,
                    food_cost_nuevo: foodCostTotal, // Available via closure
                    precio_sugerido_anterior: oldSuggestedPriceWithIva,
                    precio_sugerido_nuevo: suggestedPriceWithIva, // Available via closure
                    minutos_prep_anterior: oldPrepTime,
                    minutos_prep_nuevo: prepTime,
                    mermas_modificadas: mermas_modificadas
                }
            });
        }

        // 3. Update local products list so the switch is instantaneous next time
        setProducts(prev => prev.map(p =>
            p.id === selectedProduct.id ? { ...p, prep_time: prepTime.toString() } : p
        ));
    };

    const generateGlobalReport = async () => {
        setIsGeneratingReport(true);
        notify.info('Calculando rentabilidad de todo el menú... esto puede tomar unos segundos.');

        // 1. Fetch all recipes & inventory items at once
        const { data: allRecipes } = await supabase.from('product_recipes').select('*, inventory_items:products!inventory_item_id(id, name, cost:cost_price, unit_measure, conversion_factor)');

        // Group recipes by product_id
        const recipesByProduct: Record<string, any[]> = {};
        if (allRecipes) {
            allRecipes.forEach((r: any) => {
                if (!recipesByProduct[r.product_id]) recipesByProduct[r.product_id] = [];
                recipesByProduct[r.product_id].push(r);
            });
        }

        // Calculate Cost & Margins for ALL products
        const report = products.map(prod => {
            const cat = ((prod as any).menu_categories?.nombre || (prod as any).categories?.name || '').toLowerCase();
            const prodName = prod.name.toLowerCase();

            // Determine active FC target for this product
            let activeFc = fcTargetFood;
            if (cat.includes('cerveza') || cat.includes('agua') || cat.includes('gaseosa') || prodName.includes('botella')) activeFc = fcTargetBottled;
            else if (cat.includes('licor') || cat.includes('trago')) activeFc = fcTargetLiquor;
            else if (cat.includes('bebida') || cat.includes('cafe') || cat.includes('café') || prodName.includes('smoothie') || prodName.includes('mineral') || prodName.includes('michelada') || prodName.includes('limonada')) activeFc = fcTargetPrepDrinks;

            // Calculate food cost
            const pRecipes = recipesByProduct[prod.id] || [];
            const foodCost = pRecipes.reduce((acc, item) => {
                const merma = item.waste_percentage || 0;
                const rawCost = item.inventory_items?.cost || 0;
                const conversionFactor = item.inventory_items?.conversion_factor || 1;

                const unitCostForCalc = isNormalContributor ? rawCost / IVA_FACTOR : rawCost;
                const costPerBaseUnit = unitCostForCalc / conversionFactor;

                const qty = item.quantity || 0;
                let unitFactor = 1;
                const selectedUnit = (item.unit_measure || '').toLowerCase();
                const baseUnit = (item.inventory_items?.unit_measure || '').toLowerCase();

                // LÓGICA DE CONVERSIÓN DE UNIDADES (Prorrateo Inteligente)
                if (selectedUnit.includes('unidad') || selectedUnit.includes('botella') || selectedUnit.includes('barril')) {
                    unitFactor = 1;
                }
                else if (baseUnit.includes('libra') || baseUnit === 'lb') {
                    if (selectedUnit.includes('onza')) unitFactor = 1 / 16;
                    else if (selectedUnit.includes('gramo') || selectedUnit === 'g') unitFactor = 1 / 453.592;
                    else if (selectedUnit.includes('kilo') || selectedUnit === 'kg') unitFactor = 2.20462;
                } else if (baseUnit.includes('kilo') || baseUnit === 'kg') {
                    if (selectedUnit.includes('gramo') || selectedUnit === 'g') unitFactor = 1 / 1000;
                    else if (selectedUnit.includes('onza')) unitFactor = 1 / 35.274;
                    else if (selectedUnit.includes('libra') || selectedUnit === 'lb') unitFactor = 0.453592;
                } else if (baseUnit.includes('onza')) {
                    if (selectedUnit.includes('gramo') || selectedUnit === 'g') unitFactor = 1 / 28.3495;
                    else if (selectedUnit.includes('libra') || selectedUnit === 'lb') unitFactor = 16;
                    else if (selectedUnit.includes('kilo') || selectedUnit === 'kg') unitFactor = 35.274;
                    else if (selectedUnit.includes('mililitro') || selectedUnit === 'ml') unitFactor = 1 / 29.5735;
                    else if (selectedUnit.includes('litro') || selectedUnit === 'lt') unitFactor = 1000 / 29.5735;
                    else if (selectedUnit.includes('galón') || selectedUnit.includes('galon')) unitFactor = 3785.41 / 29.5735;
                } else if (baseUnit.includes('gramo') || baseUnit === 'g') {
                    if (selectedUnit.includes('onza')) unitFactor = 28.3495;
                    else if (selectedUnit.includes('libra') || selectedUnit === 'lb') unitFactor = 453.592;
                    else if (selectedUnit.includes('kilo') || selectedUnit === 'kg') unitFactor = 1000;
                } else if (baseUnit.includes('litro') || baseUnit === 'lt' || baseUnit.includes('mililitro') || baseUnit === 'ml' || baseUnit.includes('galón') || baseUnit.includes('galon') || baseUnit.includes('botella') || baseUnit.includes('barril')) {
                    let baseInMl = 1;
                    if (baseUnit.includes('litro') || baseUnit === 'lt') baseInMl = 1000;
                    else if (baseUnit.includes('galón') || baseUnit.includes('galon')) baseInMl = 3785.41;
                    else if (baseUnit.includes('botella')) baseInMl = 750;
                    else if (baseUnit.includes('barril')) baseInMl = 50000;
                    
                    let selectedInMl = 1;
                    if (selectedUnit.includes('mililitro') || selectedUnit === 'ml') selectedInMl = 1;
                    else if (selectedUnit.includes('onza')) selectedInMl = 29.5735;
                    else if (selectedUnit.includes('litro') || selectedUnit === 'lt') selectedInMl = 1000;
                    else if (selectedUnit.includes('galón') || selectedUnit.includes('galon')) selectedInMl = 3785.41;
                    else if (selectedUnit.includes('botella')) selectedInMl = 750;
                    else if (selectedUnit.includes('barril')) selectedInMl = 50000;

                    if (selectedUnit.includes('mililitro') || selectedUnit === 'ml' || selectedUnit.includes('onza') || selectedUnit.includes('litro') || selectedUnit === 'lt' || selectedUnit.includes('galón') || selectedUnit.includes('galon') || selectedUnit.includes('botella') || selectedUnit.includes('barril')) {
                        unitFactor = selectedInMl / baseInMl;
                    }
                }

                const baseCost = costPerBaseUnit * qty * unitFactor;
                return acc + (baseCost * (1 / (1 - merma / 100)));
            }, 0);

            // Calculate MOD
            const pTime = parseInt(prod.prep_time || '20');
            const laborCost = costPerMinute * pTime;

            // Total Cost
            const tCost = foodCost + laborCost + variableCostsPerPlate + fixedCostPerPlate;

            // Suggested Price
            const targetDivisor = activeFc / 100;
            const priceBaseLocal = targetDivisor > 0 ? tCost / targetDivisor : 0;
            const pricePostNeonetLocal = priceBaseLocal / (1 - cardCommission / 100);
            const suggestedPrc = pricePostNeonetLocal * IVA_FACTOR;

            // Real Margins right now
            const currentPriceWithIvaLocal = prod.price || 0;
            const currentPriceNoIvaLocal = currentPriceWithIvaLocal / IVA_FACTOR;
            const neonetComm = currentPriceWithIvaLocal * (cardCommission / 100);
            const netMarginQ = currentPriceNoIvaLocal - neonetComm - tCost;
            const netMarginPct = currentPriceNoIvaLocal > 0 ? (netMarginQ / currentPriceNoIvaLocal) * 100 : 0;

            return {
                id: prod.id,
                name: prod.name,
                category: (prod as any).menu_categories?.nombre || (prod as any).categories?.name || 'SIN CATEGORÍA',
                activeFc,
                foodCost,
                laborCost,
                totalCost: tCost,
                currentPrice: currentPriceWithIvaLocal,
                suggestedPrice: suggestedPrc,
                netMarginPct,
                isRentable: netMarginPct >= activeFc,
                hasRecipe: pRecipes.length > 0
            };
        });

        // Sort by category then name
        report.sort((a, b) => {
            if (a.category < b.category) return -1;
            if (a.category > b.category) return 1;
            return a.name.localeCompare(b.name);
        });

        setGlobalReportData(report);
        setIsGeneratingReport(false);
    };

    // --- CALCULATIONS (THE ENGINE) ---

    // 1. Recipe Cost with Merma + IVA Regime (Module 5)
    const { foodCostTotal, grossFoodCostTotal } = recipeItems.reduce((acc, item) => {
        const productData = Array.isArray(item.inventory_items) ? item.inventory_items[0] : item.inventory_items;

        const merma = wastePercentage[item.inventory_item_id] || 0;
        const rawCost = productData?.cost || 0;
        const conversionFactor = productData?.conversion_factor || 1;

        // Costo Neto (para ROI)
        const unitCostForCalc = isNormalContributor ? rawCost / IVA_FACTOR : rawCost;
        const costPerBaseUnit = unitCostForCalc / conversionFactor;

        // Costo Bruto (para comparación con Factura)
        const grossCostPerBaseUnit = rawCost / conversionFactor;

        const qty = item.quantity || 0;
        let unitFactor = 1;
        const selectedUnit = (item.unit_measure || '').toLowerCase();
        const baseUnit = (productData?.unit_measure || '').toLowerCase();

        // LÓGICA DE CONVERSIÓN DE UNIDADES (Prorrateo Inteligente)
        if (selectedUnit === 'unidad' || selectedUnit === 'unidades') {
            unitFactor = 1;
        }
        else if (baseUnit.includes('libra') || baseUnit === 'lb') {
            if (selectedUnit.includes('onza')) unitFactor = 1 / 16;
            else if (selectedUnit.includes('gramo') || selectedUnit === 'g') unitFactor = 1 / 453.592;
            else if (selectedUnit.includes('kilo') || selectedUnit === 'kg') unitFactor = 2.20462;
        } else if (baseUnit.includes('kilo') || baseUnit === 'kg') {
            if (selectedUnit.includes('gramo') || selectedUnit === 'g') unitFactor = 1 / 1000;
            else if (selectedUnit.includes('onza')) unitFactor = 1 / 35.274;
            else if (selectedUnit.includes('libra') || selectedUnit === 'lb') unitFactor = 0.453592;
        } else if (baseUnit.includes('onza')) {
            if (selectedUnit.includes('gramo') || selectedUnit === 'g') unitFactor = 1 / 28.3495;
            else if (selectedUnit.includes('libra') || selectedUnit === 'lb') unitFactor = 16;
            else if (selectedUnit.includes('kilo') || selectedUnit === 'kg') unitFactor = 35.274;
            else if (selectedUnit.includes('mililitro') || selectedUnit === 'ml') unitFactor = 1 / 29.5735;
            else if (selectedUnit.includes('litro') || selectedUnit === 'lt') unitFactor = 1000 / 29.5735;
            else if (selectedUnit.includes('galón') || selectedUnit.includes('galon')) unitFactor = 3785.41 / 29.5735;
        } else if (baseUnit.includes('gramo') || baseUnit === 'g') {
            if (selectedUnit.includes('onza')) unitFactor = 28.3495;
            else if (selectedUnit.includes('libra') || selectedUnit === 'lb') unitFactor = 453.592;
            else if (selectedUnit.includes('kilo') || selectedUnit === 'kg') unitFactor = 1000;
        } else if (baseUnit.includes('litro') || baseUnit === 'lt' || baseUnit.includes('mililitro') || baseUnit === 'ml' || baseUnit.includes('galón') || baseUnit.includes('galon')) {
            let baseInMl = 1;
            if (baseUnit.includes('litro') || baseUnit === 'lt') baseInMl = 1000;
            else if (baseUnit.includes('galón') || baseUnit.includes('galon')) baseInMl = 3785.41;
            
            let selectedInMl = 1;
            if (selectedUnit.includes('mililitro') || selectedUnit === 'ml') selectedInMl = 1;
            else if (selectedUnit.includes('onza')) selectedInMl = 29.5735;
            else if (selectedUnit.includes('litro') || selectedUnit === 'lt') selectedInMl = 1000;
            else if (selectedUnit.includes('galón') || selectedUnit.includes('galon')) selectedInMl = 3785.41;

            if (selectedUnit.includes('mililitro') || selectedUnit === 'ml' || selectedUnit.includes('onza') || selectedUnit.includes('litro') || selectedUnit === 'lt' || selectedUnit.includes('galón') || selectedUnit.includes('galon')) {
                unitFactor = selectedInMl / baseInMl;
            }
        }

        const baseCost = costPerBaseUnit * qty * unitFactor;
        const costWithMerma = baseCost * (1 / (1 - merma / 100));

        const baseGross = grossCostPerBaseUnit * qty * unitFactor;
        const grossWithMerma = baseGross * (1 / (1 - merma / 100));

        return {
            foodCostTotal: acc.foodCostTotal + costWithMerma,
            grossFoodCostTotal: acc.grossFoodCostTotal + grossWithMerma
        };
    }, { foodCostTotal: 0, grossFoodCostTotal: 0 });

    // 2. Labor Cost Real (Step 4 - 8 Concepts — all user-editable)
    const monthlyLaborTotalReal = monthlyBaseSalary + modIgss + modIntecap + modIrtra + modBonificacion + modAguinaldo + modBono14 + modVacaciones + modIndemnizacion;

    // Cost per minute: total MOD ÷ (n_cooks × operating_days × 8h × 60min)
    // This correctly allocates 1 cook-minute cost to each dish
    const totalCookMinutesPerMonth = numberOfCooks * operatingDays * 8 * 60;
    const costPerMinute = totalCookMinutesPerMonth > 0 ? monthlyLaborTotalReal / totalCookMinutesPerMonth : 0;
    const laborCostPerPlate = costPerMinute * prepTime;

    // 3. Fixed Costs Prorated (Step 9)
    const fixedCostPerPlate = totalMonthlyPortions > 0 ? monthlyFixedCosts / totalMonthlyPortions : 0;

    // 4. Prime Cost (Step 6)
    const primeCost = foodCostTotal + laborCostPerPlate;

    // 5. Total Cost (Step 10)
    const totalCost = primeCost + variableCostsPerPlate + fixedCostPerPlate;

    // --- DETERMINE ACTIVE FOOD COST TARGET ---
    let activeFoodCostTargetPct = fcTargetFood;
    if (selectedProduct) {
        const cat = ((selectedProduct as any)?.menu_categories?.nombre || (selectedProduct as any)?.categories?.name || '').toLowerCase();
        const prodName = selectedProduct.name.toLowerCase();

        if (cat.includes('cerveza') || cat.includes('agua') || cat.includes('gaseosa') || prodName.includes('botella')) {
            activeFoodCostTargetPct = fcTargetBottled;
        } else if (cat.includes('licor') || cat.includes('trago')) {
            activeFoodCostTargetPct = fcTargetLiquor;
        } else if (cat.includes('bebida') || cat.includes('cafe') || cat.includes('café') || prodName.includes('smoothie') || prodName.includes('mineral') || prodName.includes('michelada') || prodName.includes('limonada')) {
            activeFoodCostTargetPct = fcTargetPrepDrinks;
        } else {
            activeFoodCostTargetPct = fcTargetFood; // Default for Platillos Cocinados
        }
    }

    // 6. Pricing - DIVISOR METHOD (Step 12)
    const targetDivisor = activeFoodCostTargetPct / 100;
    const priceBase = targetDivisor > 0 ? primeCost / targetDivisor : 0;

    // 7. Neonet Adjustment (Step 13)
    const pricePostNeonet = priceBase / (1 - cardCommission / 100);

    // 8. Final Suggested Price with IVA (no rounding)
    const suggestedPriceWithIva = pricePostNeonet * IVA_FACTOR;

    // Current Margins
    const currentPriceWithIva = selectedProduct?.price || 0;
    const currentPriceNoIva = currentPriceWithIva / IVA_FACTOR;
    const neonetCommissionVal = currentPriceWithIva * (cardCommission / 100);
    const realNetMargin = currentPriceNoIva - neonetCommissionVal - totalCost;
    const netMarginPercentage = currentPriceNoIva > 0 ? (realNetMargin / currentPriceNoIva) * 100 : 0;

    const kpis = calcularKPIs(foodCostTotal, currentPriceWithIva, selectedProduct?.category);

    // --- MODULE 6: PUNTO DE EQUILIBRIO ---
    // Standard Contribution Margin formula:
    //   PE Units = Fixed Costs / (Avg Sale Price - Variable Cost per Unit)
    // Variable cost per unit = the cost the restaurant incurs per plate sold
    // We use totalCost as variable cost when a product is selected.
    // When no product selected we fall back to (laborCostPerPlate + variableCostsPerPlate).
    const variableCostPerUnit = (foodCostTotal + laborCostPerPlate + variableCostsPerPlate);
    const contributionMarginPerUnit = avgSalePrice - variableCostPerUnit; // Q gained per plate sold
    const contributionMarginRatio = avgSalePrice > 0 ? contributionMarginPerUnit / avgSalePrice : 0;
    const peQuetzales = contributionMarginPerUnit > 0 ? monthlyFixedCosts / contributionMarginRatio : 0;
    const peUnidades = contributionMarginPerUnit > 0 ? monthlyFixedCosts / contributionMarginPerUnit : 0;
    const monthlyRevenueTotal = totalMonthlyPortions * avgSalePrice;
    const dailySales = operatingDays > 0 ? monthlyRevenueTotal / operatingDays : 0;
    const daysToBreakeven = dailySales > 0 ? peQuetzales / dailySales : 0;
    const safetyMargin = monthlyRevenueTotal - peQuetzales;
    const safetyMarginPct = monthlyRevenueTotal > 0 ? (safetyMargin / monthlyRevenueTotal) * 100 : 0;
    const belowBreakeven = peUnidades > totalMonthlyPortions;

    return (
        <div className="w-full h-full bg-[#f8f9fa] flex flex-col overflow-hidden text-[#106ebe]">
            {/* Professional Compact Header */}
            <header className="bg-white border-b border-[#106ebe]/10 px-4 py-2 flex items-center justify-between shadow-sm z-20">
                <div className="flex items-center gap-4 divide-x divide-gray-100 font-sans">
                    <div className="relative min-w-[260px]">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={13} />
                        <select
                            className="w-full bg-gray-50 border border-gray-200 rounded-md pl-8 pr-8 py-1.5 text-[11px] font-medium focus:ring-1 focus:ring-[#106ebe] outline-none appearance-none"
                            onChange={(e) => {
                                const prod = products.find(p => p.id === e.target.value);
                                if (prod) handleProductSelect(prod);
                            }}
                            value={selectedProduct?.id || ''}
                        >
                            <option value="">SELECCIONAR ITEM...</option>
                            {products.map(p => (
                                <option key={p.id} value={p.id}>{p.name.toUpperCase()}</option>
                            ))}
                        </select>
                        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={11} />
                    </div>

                    <div className="pl-4 flex flex-col">
                        <span className="text-[8px] font-semibold text-gray-400 uppercase tracking-widest leading-none mb-1">Categoría</span>
                        <span className="text-[10px] font-semibold uppercase text-[#106ebe] leading-none">
                            {(selectedProduct as any)?.menu_categories?.nombre || (selectedProduct as any)?.categories?.name || '---'}
                        </span>
                    </div>

                    <div className="pl-4 flex flex-col">
                        <span className="text-[8px] font-semibold text-gray-400 uppercase tracking-widest leading-none mb-1">Precio Actual (IVA Inc.)</span>
                        <span className="text-[10px] font-semibold text-indigo-600 leading-none">
                            Q {currentPriceWithIva.toFixed(2)}
                        </span>
                    </div>

                    {/* MODULE 5: IVA Regime Badge */}
                    <div className="pl-4 flex flex-col">
                        <span className="text-[8px] font-semibold text-gray-400 uppercase tracking-widest leading-none mb-1">Régimen IVA</span>
                        <button
                            onClick={() => {
                                setIsNormalContributor(prev => !prev);
                                notify.info(isNormalContributor
                                    ? 'Cambiado a Pequeño Contribuyente — IVA es costo. Fichas recalculadas.'
                                    : 'Cambiado a Régimen Normal — IVA es crédito fiscal. Fichas recalculadas.');
                            }}
                            className={`flex items-center gap-1 px-2 py-0.5 rounded text-[8px] font-semibold uppercase tracking-tight border transition-all ${isNormalContributor
                                ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                                : 'bg-amber-50 border-amber-300 text-amber-700'
                                }`}
                        >
                            {isNormalContributor
                                ? <><ShieldCheck size={10} /> Contrib. Normal</>
                                : <><AlertTriangle size={10} /> Pequeño Contrib.</>}
                        </button>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={generateGlobalReport}
                        disabled={isGeneratingReport}
                        className="px-3 py-1.5 bg-gray-50 border border-gray-200 text-[#106ebe] rounded-md text-[9px] font-semibold uppercase tracking-widest hover:bg-gray-100 transition-all flex items-center gap-2 disabled:opacity-60"
                        title="Imprimir resumen global de precios y rentabilidad"
                    >
                        <Printer size={12} /> {isGeneratingReport ? 'Generando...' : 'Resumen Global'}
                    </button>
                    <button
                        onClick={async () => {
                            await saveProductData();
                            await saveConfig();
                        }}
                        disabled={isSavingConfig}
                        className="px-4 py-1.5 bg-[#106ebe] text-white rounded-md text-[9px] font-semibold uppercase tracking-widest hover:bg-black transition-all shadow-md shadow-gray-200 flex items-center gap-2 disabled:opacity-60"
                    >
                        <Save size={12} /> {isSavingConfig ? 'Guardando...' : 'Guardar Todo'}
                    </button>
                </div>
            </header>

            <main className="flex-1 overflow-y-auto flex gap-6 p-4 custom-scrollbar pb-32">
                {/* Left: Recipe & Details */}
                <div className="flex-1 flex flex-col gap-6">

                    {/* Compact Recipe Table */}
                    <section className="bg-white border border-[#106ebe]/10 rounded-lg overflow-hidden shadow-sm">
                        <div className="bg-[#fcfdfe] px-4 py-2 border-b border-gray-100 flex justify-between items-center">
                            <h3 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#106ebe] flex items-center gap-2">
                                <Plus size={12} className="text-gray-400" /> Detalle de Receta (Insumos)
                            </h3>
                            <span className="text-[9px] font-semibold text-gray-400 uppercase">
                                Total Insumos Factura (con IVA): Q {grossFoodCostTotal.toFixed(2)}
                            </span>
                        </div>

                        <table className="w-full text-left">
                            <thead className="bg-gray-50/50">
                                <tr className="text-[8px] font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-100">
                                    <th className="px-4 py-2">Insumo</th>
                                    <th className="px-4 py-2 text-center">Cantidad</th>
                                    <th className="px-4 py-2">Unidad de Medida</th>
                                    <th className="px-4 py-2 text-right">Precio Unitario (Factura)</th>
                                    <th className="px-4 py-2 text-center">Merma %</th>
                                    <th className="px-4 py-2 text-right">Subtotal Factura</th>
                                    <th className="px-4 py-2 w-10"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {recipeItems.map((item, idx) => {
                                    const productData = Array.isArray(item.inventory_items) ? item.inventory_items[0] : item.inventory_items;
                                    const merma = wastePercentage[item.inventory_item_id] || 0;
                                    const rawCost = productData?.cost || 0;
                                    const conversionFactor = productData?.conversion_factor || 1;

                                    // Cálculo para margen neto (ROI)
                                    const unitCostForCalc = isNormalContributor ? rawCost / IVA_FACTOR : rawCost;
                                    const costPerBaseUnit = unitCostForCalc / conversionFactor;

                                    // Cálculo para validación de factura (Bruto)
                                    const costGrossPerBaseUnit = rawCost / conversionFactor;

                                    const qty = item.quantity || 0;
                                    let unitFactor = 1;
                                    const selectedUnit = (item.unit_measure || '').toLowerCase();
                                    const baseUnit = (productData?.unit_measure || '').toLowerCase();

                                    // LÓGICA DE CONVERSIÓN DE UNIDADES (Prorrateo Inteligente)
                                    if (selectedUnit === 'unidad' || selectedUnit === 'unidades') {
                                        unitFactor = 1;
                                    }
                                    else if (baseUnit.includes('libra') || baseUnit === 'lb') {
                                        if (selectedUnit.includes('onza')) unitFactor = 1 / 16;
                                        else if (selectedUnit.includes('gramo') || selectedUnit === 'g') unitFactor = 1 / 453.592;
                                        else if (selectedUnit.includes('kilo') || selectedUnit === 'kg') unitFactor = 2.20462;
                                    } else if (baseUnit.includes('kilo') || baseUnit === 'kg') {
                                        if (selectedUnit.includes('gramo') || selectedUnit === 'g') unitFactor = 1 / 1000;
                                        else if (selectedUnit.includes('onza')) unitFactor = 1 / 35.274;
                                        else if (selectedUnit.includes('libra') || selectedUnit === 'lb') unitFactor = 0.453592;
                                    } else if (baseUnit.includes('onza')) {
                                        if (selectedUnit.includes('gramo') || selectedUnit === 'g') unitFactor = 1 / 28.3495;
                                        else if (selectedUnit.includes('libra') || selectedUnit === 'lb') unitFactor = 16;
                                        else if (selectedUnit.includes('kilo') || selectedUnit === 'kg') unitFactor = 35.274;
                                        else if (selectedUnit.includes('mililitro') || selectedUnit === 'ml') unitFactor = 1 / 29.5735;
                                        else if (selectedUnit.includes('litro') || selectedUnit === 'lt') unitFactor = 1000 / 29.5735;
                                        else if (selectedUnit.includes('galón') || selectedUnit.includes('galon')) unitFactor = 3785.41 / 29.5735;
                                    } else if (baseUnit.includes('gramo') || baseUnit === 'g') {
                                        if (selectedUnit.includes('onza')) unitFactor = 28.3495;
                                        else if (selectedUnit.includes('libra') || selectedUnit === 'lb') unitFactor = 453.592;
                                        else if (selectedUnit.includes('kilo') || selectedUnit === 'kg') unitFactor = 1000;
                                    } else if (baseUnit.includes('litro') || baseUnit === 'lt' || baseUnit.includes('mililitro') || baseUnit === 'ml' || baseUnit.includes('galón') || baseUnit.includes('galon')) {
                                        let baseInMl = 1;
                                        if (baseUnit.includes('litro') || baseUnit === 'lt') baseInMl = 1000;
                                        else if (baseUnit.includes('galón') || baseUnit.includes('galon')) baseInMl = 3785.41;
                                        
                                        let selectedInMl = 1;
                                        if (selectedUnit.includes('mililitro') || selectedUnit === 'ml') selectedInMl = 1;
                                        else if (selectedUnit.includes('onza')) selectedInMl = 29.5735;
                                        else if (selectedUnit.includes('litro') || selectedUnit === 'lt') selectedInMl = 1000;
                                        else if (selectedUnit.includes('galón') || selectedUnit.includes('galon')) selectedInMl = 3785.41;

                                        if (selectedUnit.includes('mililitro') || selectedUnit === 'ml' || selectedUnit.includes('onza') || selectedUnit.includes('litro') || selectedUnit === 'lt' || selectedUnit.includes('galón') || selectedUnit.includes('galon')) {
                                            unitFactor = selectedInMl / baseInMl;
                                        }
                                    }

                                    const baseCost = costPerBaseUnit * qty * unitFactor;
                                    const costRealManual = baseCost * (1 / (1 - merma / 100)); // NETO

                                    const baseCostGross = costGrossPerBaseUnit * qty * unitFactor;
                                    const grossSubtotal = baseCostGross * (1 / (1 - merma / 100)); // BRUTO (Para factura)

                                    return (
                                        <tr key={idx} className="text-[10px] font-medium text-gray-600 hover:bg-gray-50/30 transition-colors">
                                            <td className="px-4 py-1.5">{productData?.name || 'Insumo sin nombre'}</td>
                                            <td className="px-4 py-1.5 text-center font-semibold text-gray-800">{item.quantity}</td>
                                            <td className="px-4 py-1.5 uppercase text-gray-400">{item.unit_measure}</td>
                                            <td className="px-4 py-1.5 text-right text-gray-500">
                                                <div className="flex flex-col">
                                                    <span>Q {costGrossPerBaseUnit.toFixed(2)}</span>
                                                    <span className="text-[7px] opacity-60">P. Factura</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-1.5 text-center">
                                                <input
                                                    type="number"
                                                    value={merma}
                                                    onChange={e => setWastePercentage(prev => ({ ...prev, [item.inventory_item_id]: Number(e.target.value) }))}
                                                    className="w-12 bg-gray-50 border border-gray-100 rounded text-center text-[10px]"
                                                />
                                            </td>
                                            <td className="px-4 py-1.5 text-right font-semibold text-[#106ebe]">
                                                <div className="flex flex-col">
                                                    <span>Q {grossSubtotal.toFixed(2)}</span>
                                                    <span className="text-[7px] text-gray-400 font-normal">Factura (Neto: Q {costRealManual.toFixed(2)})</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-1.5 text-right text-gray-300 hover:text-rose-500 cursor-pointer transition-colors" onClick={() => setRecipeItems(prev => prev.filter((_, i) => i !== idx))}><Trash2 size={12} /></td>
                                        </tr>
                                    );
                                })}
                                {recipeItems.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="py-12 text-center text-gray-300 text-[10px] uppercase tracking-widest">No hay insumos configurados</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </section>

                    <div className="grid grid-cols-3 gap-4 h-fit w-full">
                        {/* MOD Detailed - 8 Concepts GT (fully editable) */}
                        <div className="bg-white border border-[#106ebe]/10 rounded-lg p-3 shadow-sm">
                            <h4 className="text-[9px] font-semibold uppercase tracking-widest text-orange-600 mb-3 flex items-center gap-2">
                                <Clock size={12} /> Mano de Obra Directa: Desglose Salarial Real
                            </h4>

                            {/* Row 1: Cooks + Base + Prep Time */}
                            <div className="grid grid-cols-3 gap-x-2 gap-y-2 mb-2">
                                <div>
                                    <label className="text-[8px] font-medium text-gray-400 uppercase block mb-0.5">Número de Cocineros</label>
                                    <input type="number" value={numberOfCooks === 0 ? "" : numberOfCooks} placeholder="0" onChange={e => setNumberOfCooks(e.target.value === '' ? 0 : Number(e.target.value))} className="w-full bg-gray-50 border border-gray-100 rounded px-2 py-1 text-[10px] font-semibold text-orange-600" />
                                </div>
                                <div>
                                    <label className="text-[8px] font-medium text-gray-400 uppercase block mb-0.5">Salario Base Total (Mensual)</label>
                                    <input type="number" value={monthlyBaseSalary === 0 ? "" : monthlyBaseSalary} placeholder="0" onChange={e => setMonthlyBaseSalary(e.target.value === '' ? 0 : Number(e.target.value))} className="w-full bg-gray-50 border border-gray-100 rounded px-2 py-1 text-[10px] font-medium" />
                                </div>
                                <div>
                                    <label className="text-[8px] font-medium text-gray-400 uppercase block mb-0.5">Minutos de Preparación</label>
                                    <input type="number" value={prepTime === 0 ? "" : prepTime} placeholder="0" onChange={e => setPrepTime(e.target.value === '' ? 0 : Number(e.target.value))} className="w-full bg-gray-50 border border-gray-100 rounded px-2 py-1 text-[10px] font-medium" />
                                </div>
                            </div>

                            {/* 8 Benefit Concepts */}
                            <div className="bg-orange-50/60 border border-orange-100 rounded-md p-2 space-y-1.5">
                                <span className="text-[7px] font-semibold text-orange-500 uppercase tracking-widest block mb-1">8 Prestaciones de Ley (Mensuales) — Editables</span>

                                {([
                                    { label: 'IGSS Patronal (10.67%)', val: modIgss, set: setModIgss },
                                    { label: 'INTECAP (1.00%)', val: modIntecap, set: setModIntecap },
                                    { label: 'IRTRA (1.00%)', val: modIrtra, set: setModIrtra },
                                    { label: `Bonificación (Q250 ×${numberOfCooks})`, val: modBonificacion, set: setModBonificacion },
                                    { label: 'Aguinaldo (÷12)', val: modAguinaldo, set: setModAguinaldo },
                                    { label: 'Bono 14 (÷12)', val: modBono14, set: setModBono14 },
                                    { label: 'Vacaciones (÷24)', val: modVacaciones, set: setModVacaciones },
                                    { label: 'Indemnización (÷12)', val: modIndemnizacion, set: setModIndemnizacion },
                                ] as { label: string; val: number; set: (v: number) => void }[]).map(({ label, val, set }) => (
                                    <div key={label} className="flex items-center justify-between gap-2">
                                        <span className="text-[7.5px] font-medium text-gray-500 uppercase flex-1 leading-tight">{label}</span>
                                        <input
                                            type="number"
                                            value={val === 0 ? "" : val}
                                            placeholder="0"
                                            onChange={e => set(e.target.value === '' ? 0 : Number(e.target.value))}
                                            className="w-20 bg-white border border-orange-200 rounded px-1.5 py-0.5 text-[9px] font-semibold text-orange-700 text-right"
                                        />
                                    </div>
                                ))}

                                <div className="border-t border-orange-200 pt-1.5 mt-1 flex justify-between items-center">
                                    <span className="text-[7.5px] font-semibold text-orange-600 uppercase">Costo Real Mensual ({numberOfCooks} cocineros)</span>
                                    <span className="text-[12px] font-semibold text-orange-600">Q {monthlyLaborTotalReal.toFixed(2)}</span>
                                </div>
                            </div>

                            {/* Cost per minute breakdown */}
                            <div className="mt-2 bg-[#106ebe]/5 rounded p-2 space-y-1">
                                <div className="flex justify-between text-[7.5px] font-medium text-gray-500 uppercase">
                                    <span>Minutos por mes ({numberOfCooks} cocineros × {operatingDays} días × 8 horas)</span>
                                    <span>{(numberOfCooks * operatingDays * 8 * 60).toLocaleString()} minutos</span>
                                </div>
                                <div className="flex justify-between text-[7.5px] font-medium text-gray-500 uppercase">
                                    <span>Costo por minuto</span>
                                    <span className="text-[#106ebe] font-semibold">Q {costPerMinute.toFixed(4)}</span>
                                </div>
                            </div>

                            <div className="pt-2 border-t border-gray-100 mt-2 flex justify-between items-center px-1">
                                <span className="text-[8px] font-semibold text-gray-400 uppercase">Costo Mano de Obra Directa por Platillo ({prepTime} minutos)</span>
                                <span className="text-[13px] font-semibold text-[#106ebe]">Q {laborCostPerPlate.toFixed(2)}</span>
                            </div>
                        </div>

                        {/* Financials & Gastos Fijos */}
                        <div className="bg-white border border-[#106ebe]/10 rounded-lg p-3 shadow-sm flex flex-col gap-4">
                            <div>
                                <h4 className="text-[9px] font-semibold uppercase tracking-widest text-[#3c7cbc] mb-3 flex items-center gap-2">
                                    <Calculator size={12} /> Gastos Fijos y Gastos Variables
                                </h4>
                                <div className="grid grid-cols-2 gap-3 mb-2">
                                    <div>
                                        <label className="text-[8px] font-medium text-gray-400 uppercase block mb-1">Gastos Fijos Mensuales</label>
                                        <input type="number" value={monthlyFixedCosts === 0 ? "" : monthlyFixedCosts} placeholder="0" onChange={e => setMonthlyFixedCosts(e.target.value === '' ? 0 : Number(e.target.value))} className="w-full bg-gray-50 border border-gray-100 rounded px-2 py-1 text-[10px] font-medium" />
                                    </div>
                                    <div>
                                        <label className="text-[8px] font-medium text-gray-400 uppercase block mb-1">Ventas Mensuales (Unidades)</label>
                                        <input type="number" value={totalMonthlyPortions === 0 ? "" : totalMonthlyPortions} placeholder="0" onChange={e => setTotalMonthlyPortions(e.target.value === '' ? 0 : Number(e.target.value))} className="w-full bg-gray-50 border border-gray-100 rounded px-2 py-1 text-[10px] font-medium" />
                                    </div>
                                    <div>
                                        <label className="text-[8px] font-medium text-gray-400 uppercase block mb-1">Gastos Variables por Plato</label>
                                        <input type="number" value={variableCostsPerPlate === 0 ? "" : variableCostsPerPlate} placeholder="0" onChange={e => setVariableCostsPerPlate(e.target.value === '' ? 0 : Number(e.target.value))} className="w-full bg-gray-50 border border-blue-100 rounded px-2 py-1 text-[10px] font-medium text-blue-700" step="0.01" />
                                    </div>
                                    <div className="flex flex-col justify-end pb-0.5">
                                        <span className="text-[7px] font-semibold text-gray-400 uppercase block mb-1">Prorrateo de Gastos Fijos</span>
                                        <span className="text-[11px] font-semibold text-[#106ebe]">Q {fixedCostPerPlate.toFixed(2)} <span className="text-[7px] font-medium text-gray-400">/ unidad</span></span>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <h4 className="text-[9px] font-semibold uppercase tracking-widest text-[#3c7cbc] mb-3 flex items-center gap-2">
                                    <Percent size={12} /> Metas de Costo de Alimentos por Categoría
                                </h4>
                                <div className="grid grid-cols-2 gap-x-3 gap-y-2 mb-2">
                                    <div>
                                        <label className="text-[8px] font-medium text-gray-400 uppercase block mb-1">Cocinados / Comida</label>
                                        <div className="relative">
                                            <input type="number" value={fcTargetFood === 0 ? "" : fcTargetFood} placeholder="0" onChange={e => setFcTargetFood(e.target.value === '' ? 0 : Number(e.target.value))} className="w-full bg-gray-50 border border-[#3c7cbc]/30 rounded px-2 py-1 text-[10px] font-semibold text-[#3c7cbc]" />
                                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[8px] font-medium text-gray-400">%</span>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-[8px] font-medium text-gray-400 uppercase block mb-1">Bebidas Preparadas</label>
                                        <div className="relative">
                                            <input type="number" value={fcTargetPrepDrinks === 0 ? "" : fcTargetPrepDrinks} placeholder="0" onChange={e => setFcTargetPrepDrinks(e.target.value === '' ? 0 : Number(e.target.value))} className="w-full bg-gray-50 border border-[#3c7cbc]/30 rounded px-2 py-1 text-[10px] font-semibold text-[#3c7cbc]" />
                                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[8px] font-medium text-gray-400">%</span>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-[8px] font-medium text-gray-400 uppercase block mb-1">Bebidas Embotelladas</label>
                                        <div className="relative">
                                            <input type="number" value={fcTargetBottled === 0 ? "" : fcTargetBottled} placeholder="0" onChange={e => setFcTargetBottled(e.target.value === '' ? 0 : Number(e.target.value))} className="w-full bg-gray-50 border border-[#3c7cbc]/30 rounded px-2 py-1 text-[10px] font-semibold text-[#3c7cbc]" />
                                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[8px] font-medium text-gray-400">%</span>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-[8px] font-medium text-gray-400 uppercase block mb-1">Licores / Tragos</label>
                                        <div className="relative">
                                            <input type="number" value={fcTargetLiquor === 0 ? "" : fcTargetLiquor} placeholder="0" onChange={e => setFcTargetLiquor(e.target.value === '' ? 0 : Number(e.target.value))} className="w-full bg-gray-50 border border-[#3c7cbc]/30 rounded px-2 py-1 text-[10px] font-semibold text-[#3c7cbc]" />
                                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[8px] font-medium text-gray-400">%</span>
                                        </div>
                                    </div>
                                    <div className="col-span-2 pt-1">
                                        <label className="text-[8px] font-medium text-gray-400 uppercase block mb-1">Retención de Tarjeta %</label>
                                        <input type="number" value={cardCommission === 0 ? "" : cardCommission} placeholder="0" onChange={e => setCardCommission(e.target.value === '' ? 0 : Number(e.target.value))} className="w-full bg-gray-50 border border-gray-100 rounded px-2 py-1 text-[10px] font-medium" />
                                    </div>
                                </div>
                            </div>

                            <div className="bg-[#106ebe] text-white p-5 rounded-lg flex flex-col items-center gap-2 shadow-lg border border-white/10 shadow-[#106ebe]/20">
                                <span className="text-[11px] font-semibold uppercase tracking-[0.2em] opacity-80">Precio Sugerido de Venta</span>
                                <div className="flex flex-col items-center leading-none">
                                    <span className="text-[32px] font-semibold text-amber-400">Q {suggestedPriceWithIva.toFixed(2)}</span>
                                    <span className="text-[14px] font-semibold text-amber-200/80 mt-1 uppercase">Sin IVA: Q {pricePostNeonet.toFixed(2)}</span>
                                </div>
                                <span className="text-[9px] font-semibold opacity-60 uppercase tracking-widest mt-2 px-3 py-1 bg-black/10 rounded-full">
                                    Método Divisor {activeFoodCostTargetPct}% + IVA
                                </span>
                            </div>
                        </div>

                        {/* MODULE 6: PUNTO DE EQUILIBRIO PANEL */}
                        <section className="bg-white border border-[#106ebe]/10 rounded-lg p-4 shadow-sm">
                        <div className="flex items-center justify-between mb-3">
                            <h4 className="text-[9px] font-semibold uppercase tracking-widest text-[#106ebe] flex items-center gap-2">
                                <Target size={12} className="text-rose-500" /> Punto de Equilibrio del Negocio
                            </h4>
                            <div className="flex gap-2">
                                <div>
                                    <label className="text-[7px] font-medium text-gray-400 uppercase block mb-0.5">Precio Promedio de Venta</label>
                                    <input type="number" value={avgSalePrice === 0 ? "" : avgSalePrice} placeholder="0" onChange={e => setAvgSalePrice(e.target.value === '' ? 0 : Number(e.target.value))} className="w-20 bg-gray-50 border border-gray-100 rounded px-2 py-0.5 text-[9px] font-medium" />
                                </div>
                                <div>
                                    <label className="text-[7px] font-medium text-gray-400 uppercase block mb-0.5">Días Operativos</label>
                                    <input type="number" value={operatingDays === 0 ? "" : operatingDays} placeholder="0" onChange={e => setOperatingDays(e.target.value === '' ? 0 : Number(e.target.value))} className="w-16 bg-gray-50 border border-gray-100 rounded px-2 py-0.5 text-[9px] font-medium" />
                                </div>
                            </div>
                        </div>

                        {/* Alert Banner */}
                        {belowBreakeven ? (
                            <div className="mb-3 bg-rose-50 border border-rose-200 rounded-md px-3 py-2 flex items-start gap-2">
                                <AlertTriangle size={12} className="text-rose-500 shrink-0 mt-0.5" />
                                <p className="text-[8px] font-medium text-rose-700 leading-snug">
                                    Con tu volumen actual ({totalMonthlyPortions.toLocaleString()} uds) NO cubres gastos fijos.
                                    Necesitas vender <span className="font-semibold">{Math.ceil(peUnidades - totalMonthlyPortions).toLocaleString()} unidades más</span> al mes para alcanzar el equilibrio.
                                </p>
                            </div>
                        ) : (
                            <div className="mb-3 bg-emerald-50 border border-emerald-200 rounded-md px-3 py-2 flex items-start gap-2">
                                <ShieldCheck size={12} className="text-emerald-500 shrink-0 mt-0.5" />
                                <p className="text-[8px] font-medium text-emerald-700 leading-snug">
                                    Tu volumen de ventas cubre los gastos fijos. ¡Alcanzas el equilibrio en <span className="font-semibold">{Math.ceil(daysToBreakeven)} días</span> del mes!
                                </p>
                            </div>
                        )}

                        {/* KPI Cards Grid */}
                        <div className="grid grid-cols-2 gap-2 mt-4">
                            <div className="bg-gray-50 border border-gray-100 rounded-md p-2 text-center">
                                <span className="text-[7px] font-semibold text-gray-400 uppercase block mb-1">Punto de Equilibrio Quetzales</span>
                                <span className="text-[13px] font-semibold text-[#106ebe]">Q {peQuetzales.toLocaleString('es-GT', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                                <span className="text-[6.5px] font-medium text-gray-300 uppercase block mt-0.5">Ventas mínimas</span>
                            </div>
                            <div className="bg-gray-50 border border-gray-100 rounded-md p-2 text-center">
                                <span className="text-[7px] font-semibold text-gray-400 uppercase block mb-1">Punto de Equilibrio Unidades</span>
                                <span className="text-[13px] font-semibold text-[#106ebe]">{Math.ceil(peUnidades).toLocaleString()}</span>
                                <span className="text-[6.5px] font-medium text-gray-300 uppercase block mt-0.5">Para cubrir gastos</span>
                            </div>
                            <div className="bg-gray-50 border border-gray-100 rounded-md p-2 text-center">
                                <span className="text-[7px] font-semibold text-gray-400 uppercase block mb-1">Días al Equilibrio</span>
                                <span className="text-[13px] font-semibold text-[#106ebe]">{Math.ceil(daysToBreakeven)}</span>
                                <span className="text-[6.5px] font-medium text-gray-300 uppercase block mt-0.5">Del mes operativo</span>
                            </div>
                            <div className={`border rounded-md p-2 text-center ${safetyMarginPct > 20 ? 'bg-emerald-50 border-emerald-200'
                                : safetyMarginPct > 10 ? 'bg-amber-50 border-amber-200'
                                    : 'bg-rose-50 border-rose-200'
                                }`}>
                                <span className="text-[7px] font-semibold text-gray-400 uppercase block mb-1">Margen Seguridad</span>
                                <span className={`text-[13px] font-semibold ${safetyMarginPct > 20 ? 'text-emerald-600'
                                    : safetyMarginPct > 10 ? 'text-amber-600'
                                        : 'text-rose-600'
                                    }`}>{safetyMarginPct.toFixed(1)}%</span>
                                <span className={`text-[6.5px] font-semibold uppercase block mt-0.5 ${safetyMarginPct > 20 ? 'text-emerald-500'
                                    : safetyMarginPct > 10 ? 'text-amber-500'
                                        : 'text-rose-500'
                                    }`}>{safetyMarginPct > 20 ? 'ESTABLE' : safetyMarginPct > 10 ? 'PRECAUCIÓN' : 'RIESGO'}</span>
                            </div>
                        </div>
                    </section>
                </div>
            </div>

            {/* Right: Executive Report - Narrow & High Density */}
                <div className="w-[360px] shrink-0 flex flex-col gap-6 h-fit pb-10">
                    <div className="bg-white border border-[#106ebe]/20 rounded-xl p-7 shadow-lg shadow-[#106ebe]/5 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-gray-50 -mr-12 -mt-12 rounded-full z-0" />

                        <div className="relative z-10 font-sans space-y-5">
                            <h3 className="text-[14px] font-semibold text-[#106ebe] mb-4 flex items-center justify-between uppercase tracking-widest">
                                Resumen Ejecutivo
                                <span className={`px-2 py-1 rounded text-[8px] font-semibold uppercase tracking-widest ${kpis?.salud === 'excelente' ? 'bg-emerald-100 text-emerald-700' : kpis?.salud === 'regular' ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'}`}>
                                    {kpis?.salud || 'Rentable'}
                                </span>
                            </h3>

                            {/* ── BLOQUE 1: COSTO REAL DE FABRICACIÓN ── */}
                            <div className="bg-gray-50/50 border border-gray-100 rounded-xl p-5 mb-4">
                                <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest block mb-4">📦 Costo Real de Fabricación</span>
                                <div className="space-y-4">
                                    <div className="flex justify-between text-[11px]">
                                        <span className="font-medium text-gray-500 uppercase">Receta (Materias Primas)</span>
                                        <div className="flex flex-col items-end">
                                            {foodCostTotal > 0 && (
                                                <span className="text-[9px] text-gray-500 font-medium">Costo Neto: Q {foodCostTotal.toFixed(2)}</span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex justify-between text-[11px]">
                                        <span className="font-medium text-[#106ebe] uppercase">Costo Real (con GIF)</span>
                                        <span className="font-semibold text-[#106ebe]">Q {kpis?.costoConGIF.toFixed(2) || '0.00'}</span>
                                    </div>
                                    <div className="flex justify-between text-[11px]">
                                        <span className="font-medium text-orange-500 uppercase">Mano de Obra Directa ({prepTime} minutos)</span>
                                        <span className="font-semibold text-orange-600">Q {laborCostPerPlate.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between text-[11px]">
                                        <span className="font-medium text-blue-500 uppercase">Gastos Fijos</span>
                                        <span className="font-semibold text-blue-600">Q {fixedCostPerPlate.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between text-[11px]">
                                        <span className="font-medium text-blue-400 uppercase">Gastos Variables</span>
                                        <span className="font-semibold text-blue-500">Q {variableCostsPerPlate.toFixed(2)}</span>
                                    </div>
                                    <div className="border-t border-gray-300 mt-4 pt-4 flex justify-between items-center">
                                        <span className="text-[12px] font-semibold text-[#106ebe] uppercase">Costo Total</span>
                                        <span className="text-[24px] font-semibold text-[#106ebe]">Q {totalCost.toFixed(2)}</span>
                                    </div>
                                </div>
                            </div>

                            {/* ── BLOQUE 2: ANÁLISIS DEL PRECIO ACTUAL ── */}
                            <div className="space-y-4 border-b border-gray-50 pb-5">
                                <div className="flex justify-between items-end border-b border-gray-50 pb-3">
                                    <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest">Utilidad Neta Actual</span>
                                    <span className={`text-[20px] font-semibold ${realNetMargin >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>Q {realNetMargin.toFixed(2)}</span>
                                </div>

                                <div className="space-y-3">
                                    <div className="flex justify-between text-[11px] font-medium text-gray-500">
                                        <span className="uppercase">Precio actual (con IVA)</span>
                                        <span className="text-indigo-600 font-semibold">Q {currentPriceWithIva.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between text-[11px] font-medium">
                                        <span className="uppercase text-gray-500">(-) IVA 12%</span>
                                        <span className={`font-sans ${isNormalContributor ? 'text-emerald-600' : 'text-rose-500'}`}>
                                            {isNormalContributor ? '✓ Crédito' : '✗ Costo'} Q {(currentPriceWithIva - currentPriceNoIva).toFixed(2)}
                                        </span>
                                    </div>
                                    <div className="flex justify-between text-[11px] font-medium text-gray-500">
                                        <span className="uppercase">(-) Comisiones de Punto de Venta</span>
                                        <span className="text-[#106ebe] font-sans">Q {neonetCommissionVal.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between text-[11px] font-medium text-gray-500">
                                        <span className="uppercase">(-) Costo Total</span>
                                        <span className="text-[#106ebe] font-sans">Q {totalCost.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between text-[11px] font-medium text-gray-500">
                                        <span className="uppercase">% Costo Primo</span>
                                        <span className="text-[#106ebe] font-sans">{kpis?.porcentajeCostoPrimo ? kpis.porcentajeCostoPrimo.toFixed(1) : '0.0'}%</span>
                                    </div>
                                </div>

                                <div className="bg-[#106ebe] text-white p-5 rounded-lg flex flex-col items-center gap-2 shadow-lg border border-white/10 shadow-[#106ebe]/20 mt-4">
                                    <span className="text-[12px] font-semibold uppercase tracking-[0.2em] opacity-80">Margen Disponible</span>
                                    <span className={`text-[44px] font-semibold leading-none ${(kpis?.margenDisponible || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                        Q {kpis?.margenDisponible ? kpis.margenDisponible.toFixed(2) : '0.00'}
                                    </span>
                                </div>
                            </div>

                            <div className="mt-6 pt-4 border-t border-gray-100 space-y-2">
                                <span className="text-[7px] font-semibold text-gray-400 uppercase tracking-widest block mb-2">Simulador Divisores (Precios Netos)</span>
                                <div className="flex justify-between items-center text-[9px] font-medium text-gray-100 bg-[#3c7cbc] p-2 rounded shadow-sm shadow-[#3c7cbc]/20">
                                    <span className="uppercase tracking-widest flex items-center gap-1">
                                        <Target size={10} /> Precio Sugerido de Venta
                                    </span>
                                    <span className="font-semibold uppercase tracking-widest text-[11px] text-amber-300">Q {kpis?.precioSugerido ? kpis.precioSugerido.toFixed(2) : '0.00'}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Compact BCG Matrix Area */}
                    <div className="bg-white border border-[#106ebe]/10 rounded-xl p-6 shadow-sm flex flex-col">
                        <h4 className="text-[10px] font-semibold uppercase tracking-[widest] text-[#106ebe] mb-4 flex items-center gap-2">
                            Matriz de Posicionamiento Estratégico
                        </h4>
                        <div className="flex-1 relative bg-gray-50/50 rounded-lg border border-gray-100 overflow-hidden flex items-center justify-center p-6 text-center">
                            <div className="absolute inset-0 opacity-[0.03] pointer-events-none">
                                <div className="w-full h-full border-l border-b border-[#106ebe] relative">
                                    <div className="absolute top-1/2 left-0 right-0 h-px bg-[#106ebe]" />
                                    <div className="absolute left-1/2 top-0 bottom-0 w-px bg-[#106ebe]" />
                                </div>
                            </div>

                            {selectedProduct ? (
                                (() => {
                                    // Simulation of Miller Matrix until real sales integration
                                    const isRentable = netMarginPercentage > (activeFoodCostTargetPct); // Simplified
                                    const isPopular = true; // Placeholder for sales data

                                    if (isPopular && isRentable) return (
                                        <div className="flex flex-col items-center">
                                            <div className="w-10 h-10 rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/30 flex items-center justify-center text-white mb-2 ring-4 ring-emerald-50">
                                                <TrendingUp size={16} />
                                            </div>
                                            <span className="text-[9px] font-semibold text-emerald-600 uppercase tracking-widest">Plato Estrella ⭐</span>
                                            <p className="text-[7px] text-gray-400 font-medium uppercase mt-1">Protección y Promoción<br />Alta Rentabilidad y Venta</p>
                                        </div>
                                    );
                                    if (isPopular && !isRentable) return (
                                        <div className="flex flex-col items-center">
                                            <div className="w-10 h-10 rounded-full bg-orange-500 shadow-lg shadow-orange-500/30 flex items-center justify-center text-white mb-2 ring-4 ring-orange-50">
                                                <TrendingUp size={16} className="rotate-90" />
                                            </div>
                                            <span className="text-[9px] font-semibold text-orange-600 uppercase tracking-widest">Caballo de Batalla 🐴</span>
                                            <p className="text-[7px] text-gray-400 font-medium uppercase mt-1">Optimizar Costos<br />Alta Venta, Bajo Margen</p>
                                        </div>
                                    );
                                    return (
                                        <div className="flex flex-col items-center">
                                            <div className="w-10 h-10 rounded-full bg-indigo-500 shadow-lg shadow-indigo-500/30 flex items-center justify-center text-white mb-2 ring-4 ring-indigo-50">
                                                <Info size={16} />
                                            </div>
                                            <span className="text-[9px] font-semibold text-indigo-600 uppercase tracking-widest">Acertijo / Puzzle 🧩</span>
                                            <p className="text-[7px] text-gray-400 font-medium uppercase mt-1">Impulsar Venta<br />Rentable pero poco vendido</p>
                                        </div>
                                    );
                                })()
                            ) : (
                                <span className="text-[8px] font-semibold text-gray-300 uppercase">Esperando Selección...</span>
                            )}
                        </div>
                    </div>
                </div>
            </main>

            {/* Global Report Modal Overlay */}
            {globalReportData && (
                <div className="fixed inset-0 bg-[#106ebe]/80 z-50 flex flex-col pt-10 pb-10 px-10 overflow-hidden backdrop-blur-sm print:p-0 print:bg-white print:block">
                    <div className="bg-white mx-auto w-full max-w-6xl flex-1 rounded-xl shadow-2xl flex flex-col overflow-hidden print:shadow-none print:h-auto print:overflow-visible relative">
                        {/* Modal Header */}
                        <div className="flex justify-between items-center p-6 border-b border-gray-100 print:hidden">
                            <h2 className="text-xl font-semibold text-[#106ebe] uppercase tracking-widest flex items-center gap-3">
                                <PieChart size={24} className="text-[#3c7cbc]" /> Resumen de Rentabilidad del Menú
                            </h2>
                            <div className="flex items-center gap-4">
                                <button onClick={() => window.print()} className="px-6 py-2 bg-[#3c7cbc] text-white rounded-lg font-semibold uppercase text-xs tracking-widest shadow-md hover:bg-blue-700 transition-colors flex items-center gap-2">
                                    <Printer size={16} /> Imprimir Reporte
                                </button>
                                <button onClick={() => setGlobalReportData(null)} className="p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-900 rounded-full transition-colors">
                                    <X size={24} />
                                </button>
                            </div>
                        </div>

                        {/* Print Only Header */}
                        <div className="hidden print:block p-8 border-b-4 border-[#106ebe] mb-4">
                            <h1 className="text-3xl font-semibold uppercase text-[#106ebe] mb-2">Restaurante Las Palmas</h1>
                            <p className="text-sm font-medium text-gray-500 uppercase">Resumen de Rentabilidad y Precios Sugeridos — {new Date().toLocaleDateString('es-GT', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                            <p className="text-xs text-gray-500 font-medium uppercase mt-2">G.Fijos: Q{monthlyFixedCosts.toLocaleString()} | G.Var Plato: Q{variableCostsPerPlate} | Régimen: {isNormalContributor ? 'Normal (Crédito)' : 'Pequeño Contribuyente'}</p>
                        </div>

                        {/* Modal Data Content */}
                        <div className="flex-1 space-y-6 overflow-y-auto print:overflow-visible">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-[#f8f9fa] sticky top-0 print:static shadow-sm z-10 print:shadow-none">
                                    <tr className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">
                                        <th className="p-4 border-b border-gray-200">Platillo</th>
                                        <th className="p-4 border-b border-gray-200">Categoría</th>
                                        <th className="p-4 border-b border-gray-200 text-right bg-rose-50/30">Costo Total Real</th>
                                        <th className="p-4 border-b border-gray-200 text-right">Precio Actual</th>
                                        <th className="p-4 border-b border-gray-200 text-right bg-emerald-50/50">Sugerido ({fcTargetFood}% - {fcTargetLiquor}%)</th>
                                        <th className="p-4 border-b border-gray-200 text-right">Margen Neto</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {globalReportData.map((row, i) => {
                                        const delta = row.suggestedPrice - row.currentPrice;
                                        return (
                                            <tr key={i} className="border-b border-gray-100 text-[11px] font-medium hover:bg-gray-50/40 print:break-inside-avoid">
                                                <td className="p-4 text-gray-800">
                                                    {row.name}
                                                    {!row.hasRecipe && <span className="ml-2 text-[8px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded uppercase tracking-widest font-semibold">Sin Receta</span>}
                                                </td>
                                                <td className="p-4 text-gray-400 text-[9px] uppercase tracking-wider">{row.category}</td>
                                                <td className="p-4 text-right text-rose-700 font-semibold bg-rose-50/30">Q {row.totalCost.toFixed(2)}</td>
                                                <td className="p-4 text-right text-gray-600">Q {row.currentPrice.toFixed(2)}</td>
                                                <td className="p-4 text-right bg-emerald-50/50">
                                                    <div className="font-semibold text-emerald-700 text-sm">Q {row.suggestedPrice.toFixed(2)}</div>
                                                    {delta > 0.05 && <div className="text-[9px] text-amber-600 font-semibold mt-0.5 uppercase">+ Q {delta.toFixed(2)} Recomendado</div>}
                                                    {delta < -0.05 && <div className="text-[9px] text-gray-400 font-medium mt-0.5 uppercase mb-[-4px]">Sobre-rentable</div>}
                                                </td>
                                                <td className="p-4 text-right">
                                                    <span className={`inline-block px-2 py-1 rounded-md text-[10px] uppercase font-semibold tracking-widest text-white ${row.isRentable ? 'bg-emerald-500' : 'bg-rose-500'}`}>
                                                        {row.netMarginPct.toFixed(1)}%
                                                    </span>
                                                    <div className="text-[8px] text-gray-400 uppercase tracking-widest font-semibold mt-1">META: {row.activeFc}%</div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
