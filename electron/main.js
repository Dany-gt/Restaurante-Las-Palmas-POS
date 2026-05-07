const { app, BrowserWindow, ipcMain, session } = require('electron');
const path = require('path');
const net = require('net');
const nodemailer = require('nodemailer');

let mainWindow = null;

// Comprobamos si estamos en desarrollo
const isDev = process.env.NODE_ENV !== 'production' && !app.isPackaged;
const VERCEL_BASE_URL = 'https://restaurante-las-palmas-pos.vercel.app';

function createMainWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        backgroundColor: '#00000000',
        title: 'Restaurante Las Palmas POS',
        frame: false,
        transparent: true,
        autoHideMenuBar: true,
        show: false,
        icon: path.join(__dirname, '../build/icon.png'),
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
        },
    });

    if (isDev) {
        mainWindow.loadURL('http://localhost:3000');
    } else {
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    }

    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });
}

// --- Manejadores de Ventana ---
ipcMain.on('window-minimize', () => {
    if (mainWindow) mainWindow.minimize();
});

ipcMain.on('window-maximize', () => {
    if (mainWindow) {
        if (mainWindow.isMaximized()) mainWindow.unmaximize();
        else mainWindow.maximize();
    }
});

ipcMain.on('window-close', () => {
    if (mainWindow) mainWindow.close();
});

// --- Funciones de Memoria (IMPRESION, EMAIL, PDF, SAT) ---

ipcMain.handle('get-printers', async () => {
    return await mainWindow.webContents.getPrintersAsync();
});

ipcMain.handle('print-html', async (event, { html, printerName, silent }) => {
    // Implementación interna de impresión
    return new Promise((resolve) => {
        let printWindow = new BrowserWindow({ show: false });
        printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
        printWindow.webContents.on('did-finish-load', () => {
            printWindow.webContents.print({
                silent: silent || false,
                printBackground: true,
                deviceName: printerName || ''
            }, () => {
                printWindow.close();
                resolve({ success: true });
            });
        });
    });
});

ipcMain.handle('print-to-network', async (event, { ip, port, html }) => {
    return new Promise((resolve) => {
        const client = new net.Socket();
        client.setTimeout(5000);
        client.connect(port || 9100, ip, () => {
            client.write(html, 'utf-8', () => {
                client.end();
                resolve({ success: true });
            });
        });
        client.on('error', (err) => resolve({ success: false, error: err.message }));
        client.on('timeout', () => { client.destroy(); resolve({ success: false, error: 'Timeout' }); });
    });
});

ipcMain.handle('check-connection', async (event, { ip, port }) => {
    return new Promise((resolve) => {
        const socket = new net.Socket();
        socket.setTimeout(2000);
        socket.on('connect', () => { socket.destroy(); resolve(true); });
        socket.on('error', () => { socket.destroy(); resolve(false); });
        socket.on('timeout', () => { socket.destroy(); resolve(false); });
        socket.connect(port || 9100, ip);
    });
});

ipcMain.handle('open-cash-drawer', async (event, { target, type }) => {
    return new Promise((resolve) => {
        if (type === 'NETWORK' && target) {
            // Pulso ESC/POS estándar: ESC p 0 25 250
            const pulse = Buffer.from([0x1b, 0x70, 0x00, 0x19, 0xfa]);
            const client = new net.Socket();
            client.setTimeout(3000);
            client.connect(9100, target, () => {
                client.write(pulse, () => {
                    client.end();
                    resolve({ success: true });
                });
            });
            client.on('error', (err) => resolve({ success: false, error: err.message }));
            client.on('timeout', () => { client.destroy(); resolve({ success: false, error: 'Timeout' }); });
        } else {
            // Para impresoras de sistema, se asume que el driver está configurado 
            // para abrir el cajón al recibir cualquier trabajo de impresión,
            // o se requiere una librería nativa adicional.
            resolve({ success: true, message: 'Driver-dependent pulse' });
        }
    });
});

ipcMain.handle('send-email', async (event, { to, subject, body, smtpConfig, attachments }) => {
    try {
        const transporter = nodemailer.createTransport({
            host: smtpConfig.host,
            port: smtpConfig.port,
            secure: smtpConfig.port === 465,
            auth: { user: smtpConfig.user, pass: smtpConfig.pass }
        });
        const mailOptions = {
            from: smtpConfig.user,
            to,
            subject,
            text: body,
            attachments: attachments ? attachments.map(a => ({
                filename: a.filename,
                content: Buffer.from(a.content, 'base64')
            })) : []
        };
        const info = await transporter.sendMail(mailOptions);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('generate-pdf', async (event, { html, name }) => {
    return new Promise((resolve) => {
        let workerWindow = new BrowserWindow({ show: false });
        workerWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
        workerWindow.webContents.on('did-finish-load', async () => {
            try {
                const data = await workerWindow.webContents.printToPDF({
                    marginsType: 0,
                    printBackground: true,
                    pageSize: 'A4'
                });
                workerWindow.close();
                resolve({ success: true, data: data.toString('base64') });
            } catch (error) {
                workerWindow.close();
                resolve({ success: false, error: error.message });
            }
        });
    });
});

ipcMain.on('login-success', () => {
    if (mainWindow) {
        mainWindow.setAlwaysOnTop(false);
        mainWindow.maximize();
        mainWindow.show();
    }
});

// Manejo de Sincronización SAT Local (Python Bridge)
ipcMain.handle('sat-sync', async (event, params) => {
    const { spawn } = require('node:child_process');
    return new Promise((resolve) => {
        let baseDir = app.getAppPath();
        if (app.isPackaged) baseDir = baseDir.replace('app.asar', 'app.asar.unpacked');
        
        const scriptPath = path.join(baseDir, 'server', 'sat_bridge.py');
        const pyProcess = spawn('python', [scriptPath], { env: { ...process.env, PYTHONIOENCODING: 'utf-8' } });

        let stdoutData = '', stderrData = '';
        pyProcess.stdout.on('data', (d) => stdoutData += d);
        pyProcess.stderr.on('data', (d) => stderrData += d);

        pyProcess.on('close', async (code) => {
            if (code !== 0) return resolve({ success: false, error: stderrData || `Error ${code}` });
            try {
                const jsonStart = stdoutData.indexOf('{'), jsonEnd = stdoutData.lastIndexOf('}');
                const satResult = JSON.parse(stdoutData.substring(jsonStart, jsonEnd + 1));
                
                if (!satResult.success || !satResult.invoices || satResult.invoices.length === 0) {
                    return resolve(satResult);
                }

                let imported = 0, errors = 0, lastError = null;
                const cleanTipo = (params.tipo || '').toLowerCase().trim();
                const tableName = (cleanTipo.includes('emit') || cleanTipo.includes('venta')) ? 'sales_invoices' : 'purchase_invoices';
                
                const opRecords = [];
                for (let rawInv of satResult.invoices) {
                    const inv = rawInv.data || rawInv;
                    const currentUuid = inv.uuid || inv.fel_uuid || inv.NumeroAutorizacion || inv.NumeroDocumento || inv.id;
                    if (!currentUuid) continue;

                    try {
                        const total = Number(inv.total || inv.granTotal || inv.raw?.granTotal || 0);
                        const iva = Number(inv.iva || inv.montoIva || inv.totalIva || inv.raw?.totalIva || 0);
                        
                        const opBody = {
                            org_id: inv.org_id || 'default',
                            invoice_date: inv.fecha || inv.fechaEmision || inv.raw?.fechaEmision || new Date().toISOString().split('T')[0],
                            invoice_number: (inv.serie && inv.numero) ? `${inv.serie}-${inv.numero}` : currentUuid.slice(0, 8),
                            description: inv.nombre_emisor || inv.nombre_receptor || inv.raw?.nombreEmisor || inv.raw?.nombreReceptor || 'Factura SAT',
                            total_amount: total,
                            iva_amount: iva,
                            net_amount: total - iva,
                            category: inv.category || (tableName === 'sales_invoices' ? 'Ventas' : 'Compras'),
                            fel_uuid: currentUuid,
                            status: (inv.estado === 'ANULADO' || inv.estado === 'A') ? 'annulled' : 'paid',
                            idp_monto: Number(inv.idp_monto || 0),
                            iva_retenido: Number(inv.iva_retenido || 0),
                            isr_retenido: Number(inv.isr_retenido || 0),
                            tipo_dte: inv.tipo_dte || inv.tipo || inv.tipoDocumento || inv.raw?.tipo || 'FACT',
                            items: Array.isArray(inv.items) && inv.items.length > 0 ? inv.items : (Array.isArray(inv.detalles) ? inv.detalles : [])
                        };

                        if (tableName === 'purchase_invoices') {
                            opBody.supplier_nit = inv.nit_emisor || inv.raw?.nitEmisor;
                            opBody.supplier_name = inv.nombre_emisor || inv.raw?.nombreEmisor;
                        } else {
                            opBody.customer_nit = inv.nit_receptor || inv.raw?.nitReceptor;
                            opBody.customer_name = inv.nombre_receptor || inv.raw?.nombreReceptor;
                        }

                        opRecords.push(opBody);
                    } catch(e) { errors++; }
                }

                if (opRecords.length > 0 && params.supabaseUrl && params.supabaseKey) {
                    try {
                        const headers = { 
                            'apikey': params.supabaseKey, 
                            'Authorization': 'Bearer ' + params.supabaseKey, 
                            'Content-Type': 'application/json',
                            'Prefer': 'resolution=merge-duplicates'
                        };
                        const res = await fetch(`${params.supabaseUrl}/rest/v1/${tableName}?on_conflict=fel_uuid`, {
                            method: 'POST', headers, body: JSON.stringify(opRecords)
                        });
                        
                        if (res.ok) { imported = opRecords.length; } 
                        else { 
                            lastError = await res.text();
                            errors += opRecords.length;
                        }
                    } catch (e) {
                        errors += opRecords.length;
                        lastError = e.message;
                    }
                }

                resolve({ success: true, total: satResult.total, imported, errors, lastError });
            } catch (e) { resolve({ success: false, error: 'JSON Error: ' + e.message }); }
        });

        pyProcess.stdin.write(JSON.stringify(params));
        pyProcess.stdin.end();
    });
});

app.whenReady().then(async () => {
    try { await session.defaultSession.clearCache(); } catch (e) { }
    createMainWindow();
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createMainWindow(); });
