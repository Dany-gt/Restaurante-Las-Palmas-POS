const { app, BrowserWindow, ipcMain, session, protocol } = require('electron');
const path = require('path');
const net = require('net');
const fs = require('fs');
const https = require('https');
const http = require('http');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const { autoUpdater } = require('electron-updater');
const log = require('electron-log');
const { dialog } = require('electron');

// Configuración del log de actualizaciones (crea un archivo de log para diagnosticar errores)
log.transports.file.level = "info";
autoUpdater.logger = log;

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
        hasShadow: false,
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
    try {
        const printers = await mainWindow.webContents.getPrintersAsync();
        console.log(`🖨️ [Electron] ${printers.length} impresoras detectadas en el sistema`);
        return printers;
    } catch (err) {
        console.error('❌ [Electron] Error al obtener impresoras:', err);
        return [];
    }
});

ipcMain.handle('print-html', async (event, { html, printerName, silent }) => {
    console.log(`🖨️ [Electron] Iniciando flujo de impresión: "${printerName || 'Predeterminada'}" (Silencioso: ${silent})`);
    
    return new Promise((resolve) => {
        let printWindow = new BrowserWindow({ 
            show: false
        });
        
        // Timeout de seguridad: 30 segundos para evitar fugas de memoria
        const timeout = setTimeout(() => {
            if (!printWindow.isDestroyed()) {
                printWindow.close();
                console.error('❌ [Electron] Timeout alcanzado esperando did-finish-load');
                resolve({ success: false, error: 'Timeout cargando contenido de impresión' });
            }
        }, 30000);

        printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
        
        printWindow.webContents.on('did-finish-load', () => {
            console.log('📄 [Electron] Contenido HTML cargado. Iniciando impresión inmediata...');
            
            // Reducimos el delay a 100ms para tickets simples, es suficiente para renderizar texto
            setTimeout(() => {
                if (printWindow.isDestroyed()) return;
                
                const printOptions = {
                    silent: !!silent,
                    printBackground: true,
                    deviceName: printerName || '',
                    color: false,
                    margins: { marginType: 'none' }
                };

                // REFUERZO DE SEGURIDAD: Si no hay nombre de impresora y es silent, 
                // Electron a veces falla. Aseguramos un deviceName vacío o válido.
                printWindow.webContents.print(printOptions, (success, failureReason) => {
                    clearTimeout(timeout);
                    console.log(`🏁 [Electron] Impresión finalizada. Éxito: ${success}`);
                    
                    if (!printWindow.isDestroyed()) {
                        // Cerramos rápido pero dejando un margen para que el driver reciba la info
                        setTimeout(() => {
                            if (!printWindow.isDestroyed()) printWindow.close();
                        }, 500);
                    }
                    resolve({ success, error: failureReason });
                });
            }, 100);
        });

        printWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
            clearTimeout(timeout);
            console.error(`❌ [Electron] Error al cargar el data URI: ${errorDescription} (${errorCode})`);
            if (!printWindow.isDestroyed()) {
                printWindow.close();
            }
            resolve({ success: false, error: `Error de carga: ${errorDescription}` });
        });
    });
});

ipcMain.handle('print-to-network', async (event, { ip, port, content, isRaw }) => {
    return new Promise((resolve) => {
        const net = require('net');
        const client = new net.Socket();
        const timeout = 10000;
        
        client.setTimeout(timeout);
        
        client.connect(port || 9100, ip, () => {
            console.log(`🔌 [Electron] Conectado a impresora en ${ip}:${port || 9100}`);
            
            // Si es raw (Buffer/Uint8Array), lo enviamos tal cual
            // Si es texto, lo convertimos a Buffer con encoding adecuado
            const buffer = isRaw ? Buffer.from(content) : Buffer.from(content, 'utf-8');
            
            client.write(buffer, () => {
                // Pequeño delay antes de cerrar para asegurar que el buffer se vacíe
                setTimeout(() => {
                    client.end();
                    resolve({ success: true });
                }, 200);
            });
        });

        client.on('error', (err) => {
            console.error(`❌ [Electron] Error de red en impresora: ${err.message}`);
            resolve({ success: false, error: err.message });
        });

        client.on('timeout', () => {
            console.error('❌ [Electron] Timeout conectando a impresora');
            client.destroy();
            resolve({ success: false, error: 'No se pudo conectar a la impresora (Timeout)' });
        });
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
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] 💰 [Electron] Solicitud de apertura de gaveta recibida. Tipo: ${type}, Destino: ${target || 'PREDETERMINADO'}`);
    
    return new Promise((resolve) => {
        if (type === 'NETWORK' && target) {
            // Pulso ESC/POS estándar: ESC p 0 25 250
            const pulse = Buffer.from([0x1b, 0x70, 0x00, 0x19, 0xfa]);
            const client = new net.Socket();
            client.setTimeout(3000);
            
            console.log(`[${timestamp}] 🔌 [Electron] Enviando pulso TCP a ${target}:9100...`);
            
            client.connect(9100, target, () => {
                client.write(pulse, () => {
                    console.log(`[${timestamp}] ✅ [Electron] Pulso TCP enviado con éxito a ${target}`);
                    client.end();
                    resolve({ success: true });
                });
            });
            
            client.on('error', (err) => {
                console.error(`[${timestamp}] ❌ [Electron] Error enviando pulso TCP: ${err.message}`);
                resolve({ success: false, error: err.message });
            });
            
            client.on('timeout', () => {
                console.error(`[${timestamp}] ❌ [Electron] Timeout enviando pulso TCP a ${target}`);
                client.destroy();
                resolve({ success: false, error: 'Timeout' });
            });
        } else if (type === 'SYSTEM' && target) {
            console.log(`[${timestamp}] 🔌 [Electron] Generando pulso vía Driver Windows para: ${target}`);
            
            // Creamos un trabajo de impresión que contenga un carácter invisible pero real para que el spooler no lo ignore.
            let workerWindow = new BrowserWindow({ show: false });
            const dummyHtml = `
                <html>
                    <body style="margin:0;padding:0;overflow:hidden;">
                        <div style="font-size:1px;color:rgba(0,0,0,0.01); line-height:1px;">.</div>
                    </body>
                </html>
            `;
            workerWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(dummyHtml)}`);
            
            workerWindow.webContents.on('did-finish-load', () => {
                console.log(`[${timestamp}] 📄 [Electron] Dummy Job cargado. Ejecutando pulso de gaveta...`);
                
                workerWindow.webContents.print({
                    silent: true,
                    deviceName: target,
                    margins: { marginType: 'none' }
                }, (success, failureReason) => {
                    console.log(`[${timestamp}] 🏁 [Electron] Resultado pulso gaveta: ${success}${failureReason ? `. Motivo: ${failureReason}` : ''}`);
                    
                    // Delay para que el spooler termine de enviar el comando antes de cerrar la ventana
                    setTimeout(() => {
                        if (!workerWindow.isDestroyed()) {
                            workerWindow.close();
                        }
                    }, 1000);
                    
                    if (success) {
                        resolve({ success: true });
                    } else {
                        resolve({ success: false, error: failureReason });
                    }
                });
            });

            workerWindow.webContents.on('did-fail-load', (e, code, desc) => {
                console.error(`[${timestamp}] ❌ [Electron] Error cargando dummy job: ${desc} (${code})`);
                if (!workerWindow.isDestroyed()) workerWindow.close();
                resolve({ success: false, error: 'Failed to load dummy print job: ' + desc });
            });
        } else {
            const errorMsg = !target ? 'Destino no especificado' : 'Tipo de impresora no soportado para pulso';
            console.warn(`[${timestamp}] ⚠️ [Electron] ${errorMsg}`);
            resolve({ success: false, error: errorMsg });
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
            setTimeout(async () => {
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
            }, 500);
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

// ─── Image filesystem cache (Electron-native) ────────────────────────────────
// Generates a stable filename from a URL using a short SHA-1 hash + extension
function urlToFilename(url) {
    const hash = crypto.createHash('sha1').update(url).digest('hex').slice(0, 16);
    const ext = url.split('?')[0].split('.').pop().toLowerCase();
    const safeExt = ['jpg','jpeg','png','webp','gif','svg','avif'].includes(ext) ? ext : 'jpg';
    return `${hash}.${safeExt}`;
}

// Downloads a single file from a URL to a local path
function downloadFile(url, destPath) {
    return new Promise((resolve, reject) => {
        const proto = url.startsWith('https') ? https : http;
        const file = fs.createWriteStream(destPath);
        proto.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                file.close();
                fs.unlink(destPath, () => {});
                return downloadFile(res.headers.location, destPath).then(resolve).catch(reject);
            }
            if (res.statusCode !== 200) {
                file.close();
                fs.unlink(destPath, () => {});
                return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
            }
            res.pipe(file);
            file.on('finish', () => file.close(resolve));
            file.on('error', (e) => { fs.unlink(destPath, () => {}); reject(e); });
        }).on('error', (e) => { fs.unlink(destPath, () => {}); reject(e); });
    });
}

// IPC: Download a list of images to userData/images/ and return url→local mapping
ipcMain.handle('download-images', async (event, imageList) => {
    const imagesDir = path.join(app.getPath('userData'), 'images');
    if (!fs.existsSync(imagesDir)) fs.mkdirSync(imagesDir, { recursive: true });

    const results = {};
    const errors = [];

    await Promise.allSettled(
        imageList.map(async ({ originalUrl, directUrl }) => {
            try {
                const filename = urlToFilename(directUrl);
                const localPath = path.join(imagesDir, filename);
                const localProtocolUrl = `app-image:///${filename}`;

                // Skip download if file already exists and has content
                const exists = fs.existsSync(localPath) && fs.statSync(localPath).size > 0;
                if (!exists) {
                    await downloadFile(directUrl, localPath);
                }
                results[originalUrl] = localProtocolUrl;
            } catch (e) {
                errors.push({ url: directUrl, error: e.message });
            }
        })
    );

    console.log(`📁 [Electron] Images cached: ${Object.keys(results).length} OK, ${errors.length} failed`);
    if (errors.length > 0) console.warn('⚠️ [Electron] Failed images:', errors);
    return results;
});

// IPC: Get the images directory path
ipcMain.handle('get-images-dir', () => {
    return path.join(app.getPath('userData'), 'images');
});

app.whenReady().then(async () => {
    // Register app-image:// protocol to serve files from userData/images/ and download on the fly
    protocol.registerFileProtocol('app-image', async (request, callback) => {
        try {
            const imagesDir = path.join(app.getPath('userData'), 'images');
            
            // Allow full URL in the format: app-image:///<remote_url>
            let remoteUrl = decodeURIComponent(request.url.replace(/^app-image:\/+/, ''));
            
            if (remoteUrl.startsWith('http')) {
                // Keep it as is
            } else if (remoteUrl.includes('supabase.co')) {
                remoteUrl = 'https://' + remoteUrl;
            } else {
                // If it's just a filename (the old behavior), serve it
                const filePath = path.join(imagesDir, path.basename(remoteUrl));
                return callback({ path: filePath });
            }

            // Convert remoteUrl to filename
            const hash = crypto.createHash('sha1').update(remoteUrl).digest('hex').slice(0, 16);
            const ext = remoteUrl.split('?')[0].split('.').pop().toLowerCase();
            const safeExt = ['jpg','jpeg','png','webp','gif','svg','avif'].includes(ext) ? ext : 'jpg';
            const filename = `${hash}.${safeExt}`;
            const filePath = path.join(imagesDir, filename);

            if (!fs.existsSync(imagesDir)) fs.mkdirSync(imagesDir, { recursive: true });

            if (!fs.existsSync(filePath) || fs.statSync(filePath).size === 0) {
                // Download on the fly
                await downloadFile(remoteUrl, filePath);
            }
            
            callback({ path: filePath });
        } catch (e) {
            console.error('[app-image protocol] Error:', e.message);
            callback({ error: -2 }); // net::ERR_FAILED
        }
    });

    try { await session.defaultSession.clearCache(); } catch (e) { }
    createMainWindow();

    // Iniciar búsqueda de actualizaciones si estamos en producción (instalados)
    if (!isDev) {
        autoUpdater.checkForUpdatesAndNotify();
    }
});

// Escuchar cuando la actualización está lista para ser instalada
autoUpdater.on('update-downloaded', (info) => {
    dialog.showMessageBox({
        type: 'info',
        title: 'Actualización Disponible',
        message: 'Se ha descargado una nueva versión del POS. ¿Deseas reiniciar para instalarla ahora?',
        buttons: ['Reiniciar e Instalar', 'Más tarde']
    }).then((result) => {
        if (result.response === 0) {
            autoUpdater.quitAndInstall();
        }
    });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createMainWindow(); });
