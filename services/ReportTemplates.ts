import { ShiftReportData } from './ShiftService';

/**
 * Service to generate high-fidelity HTML for professional reports
 * matching the physical ticket format.
 */
export const reportTemplates = {
    /**
     * Helper to format currency in Quetzales (Q)
     */
    formatQ(amount: number): string {
        return `Q${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    },

    /**
     * Helper to format dates
     */
    formatDate(dateStr: string): string {
        try {
            const date = new Date(dateStr);
            return date.toLocaleString('es-GT', {
                day: '2-digit', month: '2-digit', year: 'numeric',
                hour: '2-digit', minute: '2-digit', second: '2-digit'
            }).replace(',', '');
        } catch (e) {
            return dateStr;
        }
    },

    /**
     * 1. CIERRE DE CAJA (X/Z Cut)
     */
    generateCierreCaja(data: ShiftReportData): string {
        const formatDate = (d: string) => this.formatDate(d);
        const formatQ = (n: number) => this.formatQ(n);

        return `
            <div class="header">
                <div class="logo-text">RESTAURANTE LAS PALMAS</div>
                <div>7771-0845</div>
                <div>cevicheriyrestlaspalmas@gmail.com</div>
                <div>https://restaurantelaspalmas.com.gt/</div>
            </div>

            <div class="title">Cierre de Caja</div>

            <div class="row"><span>Turno:</span><span>${data.registerName || 'CAJA'}: ${data.cashierName}</span></div>
            <div class="row"><span>Apertura:</span><span>${formatDate(data.startTime)}</span></div>
            <div class="row"><span>Cierre:</span><span>${formatDate(data.endTime)}</span></div>

            <div class="divider"></div>

            <div class="row"><span>Órdenes Atendidas:</span><span>${data.stats.ordersAttended}</span></div>
            <div class="row"><span>Órdenes Anuladas:</span><span>${data.stats.cancelledOrders}</span></div>
            <div class="row"><span>Comensales:</span><span>${data.stats.commensals}</span></div>
            
            <div class="divider"></div>

            <div class="row bold"><span>Total:</span><span>${formatQ(data.salesTotal)}</span></div>

            <div class="divider"></div>
            <div class="section-title">VENTAS POR CANAL</div>
            ${(data.salesByChannel || []).map(c => `
                <div class="row"><span>${c.channel}:</span><span>${formatQ(c.amount)}</span></div>
            `).join('')}

            <div class="divider"></div>

            <div class="section-title">ABONOS A CRÉDITO</div>
            ${data.abonosByMethod.map(m => `
                <div class="row"><span>${m.method}:</span><span>${formatQ(m.amount)}</span></div>
            `).join('')}
            <div class="row bold"><span>Total:</span><span>${formatQ(data.abonosByMethod.reduce((acc, curr) => acc + curr.amount, 0))}</span></div>

            <div class="divider"></div>

            <div class="section-title">PROPINAS</div>
            ${data.tipsByMethod.map(m => `
                <div class="row"><span>${m.method}:</span><span>${formatQ(m.amount)}</span></div>
            `).join('')}
            <div class="row bold"><span>Total:</span><span>${formatQ(data.tipsByMethod.reduce((acc, curr) => acc + curr.amount, 0))}</span></div>

            <div class="divider"></div>

            <div class="section-title">INGRESO TOTAL</div>
             ${data.salesByMethod.map(m => `
                <div class="row"><span>${m.method}:</span><span>${formatQ(m.amount)}</span></div>
            `).join('')}
            <div class="row bold"><span>Total:</span><span>${formatQ(
            data.salesTotal +
            data.abonosByMethod.reduce((acc, curr) => acc + curr.amount, 0) +
            data.tipsByMethod.reduce((acc, curr) => acc + curr.amount, 0)
        )}</span></div>

            <div class="divider"></div>

            <div class="section-title">CUADRE EFECTIVO</div>
            <div class="row"><span>(+) Inicial:</span><span>${formatQ(data.startAmount)}</span></div>
            <div class="row"><span>(+) Ventas:</span><span>${formatQ(data.cashDetail.sales)}</span></div>
            <div class="row"><span>(+) Abonos:</span><span>${formatQ(data.cashDetail.abonos)}</span></div>
            <div class="row"><span>(+) Propinas:</span><span>${formatQ(data.cashDetail.tips)}</span></div>
            <div class="row"><span>(-) Gastos:</span><span>${formatQ(data.cashDetail.expenses)}</span></div>
            <div class="row total-row"><span>Total Efectivo:</span><span>${formatQ(data.expectedCash)}</span></div>

            <div class="footer-info">
                Impreso: ${formatDate(new Date().toISOString())}
            </div>
        `;
    },

    /**
     * 2. CUADRE POS TARJETAS
     */
    generateCuadreTarjetas(data: ShiftReportData): string {
        const formatQ = (n: number) => this.formatQ(n);
        const total = data.posCardDetail.reduce((acc, curr) => acc + curr.total, 0);

        return `
            <div class="header">
                <div class="logo-text">RESTAURANTE LAS PALMAS</div>
            </div>
            <div class="title">Cuadre POS Tarjetas</div>
            
            <div class="row"><span>Turno:</span><span>${data.registerName || 'CAJA'}: ${data.cashierName}</span></div>
            <div class="row"><span>Fecha:</span><span>${this.formatDate(data.endTime)}</span></div>

            <div class="divider"></div>

            <table>
                <thead>
                    <tr>
                        <th style="text-align:center;">POS</th>
                        <th class="text-right">Total</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.posCardDetail.map(t => `
                        <tr>
                            <td style="text-align:center;">${t.name}</td>
                            <td class="text-right">${formatQ(t.total)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>

            <div class="divider"></div>
            <div class="row bold"><span>Total</span><span>${formatQ(total)}</span></div>
        `;
    },

    /**
     * 3. RESUMEN DE GASTOS
     */
    generateGastos(data: ShiftReportData): string {
        const formatQ = (n: number) => this.formatQ(n);

        // Group by category if available, or just list
        const expenses = data.expenses || [];
        const categories: Record<string, any[]> = {};
        expenses.forEach(e => {
            const cat = e.category || 'VARIOS';
            if (!categories[cat]) categories[cat] = [];
            categories[cat].push(e);
        });

        return `
            <div class="header">
                <div class="logo-text">RESTAURANTE LAS PALMAS</div>
                <div>Resumen de Gastos</div>
            </div>

            <div class="row"><span>Turno:</span><span>${data.registerName || 'CAJA'}: ${data.cashierName}</span></div>
            <div class="divider"></div>

            ${Object.entries(categories).map(([cat, list]) => `
                <div class="section-title">Categoría: ${cat}</div>
                <table>
                    <thead>
                        <tr><th>Gasto</th><th class="text-right">Total</th></tr>
                    </thead>
                    <tbody>
                        ${list.map(e => `
                            <tr>
                                <td>- ${e.description}</td>
                                <td class="text-right">${formatQ(e.amount)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `).join('')}

            <div class="divider"></div>
            <div class="row bold"><span>Total:</span><span>${formatQ(data.expensesTotal)}</span></div>
        `;
    },

    /**
     * 4. REPORTE DE INVENTARIO (Punto de Reorden)
     */
    generateInventario(items: any[]): string {
        const categories: Record<string, any[]> = {};
        items.forEach(item => {
            const cat = item.category_name || 'VARIOS';
            if (!categories[cat]) categories[cat] = [];
            categories[cat].push(item);
        });

        return `
            <div class="header">
                <div class="logo-text">RESTAURANTE LAS PALMAS</div>
                <div>Existencias en Punto de Reorden</div>
            </div>

            ${Object.entries(categories).map(([cat, list]) => `
                <div class="section-title">Categoría: ${cat}</div>
                <table>
                    <thead>
                        <tr><th>Producto</th><th class="text-right">Existencia</th></tr>
                    </thead>
                    <tbody>
                        ${list.map(i => `
                            <tr>
                                <td>${i.name}</td>
                                <td class="text-right">${i.stock} ${i.unit || ''}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `).join('')}

            <div class="footer-info">
                Generado: ${this.formatDate(new Date().toISOString())}
            </div>
        `;
    },

    /**
     * 5. REPORTE DE PLATOS VENDIDOS
     */
    generatePlatosVendidos(items: any[], dateRange: string): string {
        return `
            <div class="header">
                <div class="logo-text">RESTAURANTE LAS PALMAS</div>
                <div>Reporte de Ventas por Producto</div>
                <div>${dateRange}</div>
            </div>

            <div class="divider"></div>

            <table>
                <thead>
                    <tr>
                        <th>Producto</th>
                        <th class="text-right">Cant.</th>
                        <th class="text-right">Total</th>
                    </tr>
                </thead>
                <tbody>
                    ${items.map(i => `
                        <tr>
                            <td>${i.name}</td>
                            <td class="text-right">${i.quantity}</td>
                            <td class="text-right">${this.formatQ(i.total)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>

            <div class="divider"></div>
            <div class="row bold">
                <span>TOTAL GENERAL</span>
                <span>${this.formatQ(items.reduce((acc, curr) => acc + curr.total, 0))}</span>
            </div>
        `;
    },

    /**
     * 6. A4 REPORTE DE GASTOS (Detailed List)
     */
    generateA4ExpenseReport(expenses: any[], startDate: string, endDate: string): string {
        const formatQ = (n: number) => this.formatQ(n);
        const formatD = (d: string) => this.formatDate(d);

        let headerDateStr = '';
        if (startDate && endDate && startDate !== endDate) {
            headerDateStr = `Fecha Del ${startDate} Al ${endDate}`;
        } else if (startDate) {
            headerDateStr = `Fecha ${startDate}`;
        }

        const css = `
            * { box-sizing: border-box; }
            body { 
                font-family: 'Segoe UI', Arial, sans-serif; 
                margin: 0; padding: 20px; 
                color: #333;
                background-color: white;
            }
            .report-header { margin-bottom: 20px; }
            .report-title { font-size: 18px; font-weight: bold; margin-bottom: 2px; }
            .company-name { font-size: 14px; margin-bottom: 2px; }
            .report-dates { font-size: 14px; margin-bottom: 10px; }
            table { 
                width: 100%; 
                border-collapse: collapse; 
                font-size: 11px; 
            }
            th, td { 
                border: 1px solid #ccc; 
                padding: 6px 8px; 
                text-align: left; 
            }
            th { 
                background-color: #f2f2f2; 
                font-weight: bold; 
                text-transform: uppercase;
                color: #000;
            }
            .text-right { text-align: right; }
            .text-center { text-align: center; }
            @page {
                size: A4 portrait;
                margin: 15mm;
            }
            @media print {
                body { margin: 0; padding: 0; }
                table { page-break-inside: auto; }
                tr    { page-break-inside: avoid; page-break-after: auto; }
                thead { display: table-header-group; }
                tfoot { display: table-footer-group; }
            }
        `;

        const content = `
            <div class="report-header">
                <div class="report-title">Reporte de Gastos</div>
                <div class="company-name">Cevicheria y Rest. Las Palmas</div>
                <div class="report-dates">${headerDateStr}</div>
            </div>
            <table>
                <thead>
                    <tr>
                        <th>Fecha</th>
                        <th>Hora</th>
                        <th>Caja</th>
                        <th>Turno No</th>
                        <th>Número</th>
                        <th>Categoría</th>
                        <th>Descripción</th>
                        <th class="text-right">Monto</th>
                        <th>Usuario</th>
                        <th class="text-center">Anulado</th>
                    </tr>
                </thead>
                <tbody>
                    ${expenses.map(e => {
            const dateObj = new Date(e.created_at);
            const dateStr = dateObj.toLocaleDateString('es-GT', { day: '2-digit', month: '2-digit', year: 'numeric' });
            const timeStr = dateObj.toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit' });
            return `
                        <tr>
                            <td>${dateStr}</td>
                            <td>${timeStr}</td>
                            <td>${e.cash_registers?.name?.split(' ')[0] || 'PRINCIPAL'}</td>
                            <td class="text-center">${e.shifts?.shift_number || '1'}</td>
                            <td class="text-center">${e.id.toString().substring(0, 4)}</td>
                            <td>${e.category?.toUpperCase() || ''}</td>
                            <td>${e.description}</td>
                            <td class="text-right">${formatQ(e.amount)}</td>
                            <td>${e.profiles?.name || 'Admin'}</td>
                            <td class="text-center">
                                <input type="checkbox" ${e.is_void ? 'checked' : ''} disabled />
                            </td>
                        </tr>
                        `;
        }).join('')}
                </tbody>
            </table>
        `;

        return `<!DOCTYPE html><html><head><style>${css}</style></head><body>${content}</body></html>`;
    },

    /**
     * Wrap content in professional report HTML boilerplate
     */
    wrap(content: string, css: string): string {
        return `
            <!DOCTYPE html>
            <html>
            <head>
                <style>${css}</style>
            </head>
            <body>
                ${content}
            </body>
            </html>
        `;
    }
};
