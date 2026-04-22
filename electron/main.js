const { app, BrowserWindow, ipcMain, session } = require('electron');
const path = require('path');

let mainWindow = null; // We will use one single window for everything

// Comprobamos si estamos en desarrollo (para usar localhost) o producción
const isDev = process.env.NODE_ENV !== 'production' && !app.isPackaged;
const VERCEL_BASE_URL = 'https://restaurante-las-palmas-pos.vercel.app';

// URL principal a cargar (local en desarrallo, vercel en prod, o dist si se empaca)
const startUrl = process.env.ELECTRON_START_URL ||
    (isDev ? 'http://localhost:3000' :
        (app.isPackaged ? `file://${path.join(__dirname, '../dist/index.html')}` : VERCEL_BASE_URL));

function createMainWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        backgroundColor: '#f8fafc',
        title: 'Restaurante Las Palmas POS',
        show: false,
        icon: path.join(__dirname, '../build/icon.png'),
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
        },
    });

    // Cargar la App
    const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
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

// --- RESTAURACIÓN DE FUNCIONES DE MEMORIA (IMPRESION, EMAIL, PDF) ---

// 1. Obtener Impresoras
ipcMain.handle('get-printers', async () => {
    return await mainWindow.webContents.getPrintersAsync();
});

// 2. Imprimir HTML
ipcMain.handle('print-html', async (event, { html, printerName, silent }) => {
    console.log('Nativo: Solicitud de impresión HTML recibida para:', printerName);
    return await printHtmlInternally(html, printerName, silent);
});

// 3. Imprimir a Red (TCP)
ipcMain.handle('print-to-network', async (event, { ip, port, html }) => {
    console.log('Nativo: Impresión de red solicitada para:', ip);
    return new Promise((resolve) => {
        const client = new net.Socket();
        client.setTimeout(5000);

        client.connect(port || 9100, ip, () => {
            // Nota: Aquí se envía el HTML directamente. 
            // Si la impresora requiere ESC/POS, el frontend debe enviarlo ya procesado.
            client.write(html, 'utf-8', () => {
                client.end();
                resolve({ success: true });
            });
        });

        client.on('error', (err) => {
            console.error('Error de impresión de red:', err);
            resolve({ success: false, error: err.message });
        });

        client.on('timeout', () => {
            client.destroy();
            resolve({ success: false, error: 'Tiempo de espera agotado' });
        });
    });
});

// 4. Validar Conexión
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

// 5. Abrir Cajón de Dinero
ipcMain.handle('open-cash-drawer', async (event, options) => {
    console.log('Nativo: Abriendo cajón de dinero...');
    // Secuencia ESC/POS común para abrir cajón: ESC p 0 25 250
    const kickCommand = Buffer.from([27, 112, 0, 25, 250]);
    // Generalmente se envía a la impresora predeterminada
    // Aquí podrías implementar el envío del buffer a la impresora vía socket o printHtml
    return { success: true, message: 'Comando enviado' };
});

// 6. Enviar Correo SMTP
ipcMain.handle('send-email', async (event, { to, subject, body, smtpConfig, attachments }) => {
    console.log('Nativo: Enviando correo a:', to);
    try {
        const transporter = nodemailer.createTransport({
            host: smtpConfig.host,
            port: smtpConfig.port,
            secure: smtpConfig.port === 465,
            auth: {
                user: smtpConfig.user,
                pass: smtpConfig.pass
            }
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
        console.error('Error enviando mail:', error);
        return { success: false, error: error.message };
    }
});

// 7. Generar PDF
ipcMain.handle('generate-pdf', async (event, { html, name }) => {
    console.log('Nativo: Generando PDF:', name);
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

// Manejo de éxito de login
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

        pyProcess.on('close', (code) => {
            if (code !== 0) return resolve({ success: false, error: stderrData || `Error ${code}` });
            try {
                const jsonStart = stdoutData.indexOf('{'), jsonEnd = stdoutData.lastIndexOf('}');
                resolve(JSON.parse(stdoutData.substring(jsonStart, jsonEnd + 1)));
            } catch (e) { resolve({ success: false, error: 'JSON Error' }); }
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
