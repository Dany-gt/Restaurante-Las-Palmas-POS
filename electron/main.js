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
        width: 820,
        height: 540,
        frame: false,           // Sin bordes ni barra superior
        transparent: true,     // Para soportar los bordes redondeados flotantes
        resizable: true,
        center: true,
        icon: path.join(__dirname, '../public/pwa-192.png'),
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true
        }
    });

    // Cargamos el React local / o Vercel prod
    mainWindow.loadURL(startUrl);

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}


ipcMain.on('window-minimize', () => {
    const win = BrowserWindow.getFocusedWindow() || mainWindow;
    if (win) win.minimize();
});

ipcMain.on('window-close', () => {
    const win = BrowserWindow.getFocusedWindow() || mainWindow;
    if (win) {
        win.close();
        if (BrowserWindow.getAllWindows().length === 0) {
            app.quit();
        }
    }
});

// Cuando el sitio en React envía 'login-success'
ipcMain.on('login-success', () => {
    console.log('Nativo: Login exitoso detectado. Maximizando ventana...');
    if (mainWindow) {
        mainWindow.setAlwaysOnTop(false);
        mainWindow.maximize();
        mainWindow.show();
    }
});

// Cuando el sitio en React envía 'logout'
ipcMain.on('logout', () => {
    console.log('Nativo: Logout detectado. Restaurando tamaño de ventana...');
    if (mainWindow) {
        if (mainWindow.isMaximized() || mainWindow.isFullScreen()) {
            mainWindow.setFullScreen(false);
            mainWindow.unmaximize();
        }
        mainWindow.setResizable(true);
        mainWindow.setSize(820, 540, true);
        mainWindow.center();
    }
});

// Inicio de la aplicación
app.whenReady().then(async () => {
    console.log('Nativo: Aplicación lista. Limpiando almacenamiento y caché...');
    try {
        // Limpiamos caché
        await session.defaultSession.clearCache();
    } catch (e) {
        console.error('Error al limpiar la sesión:', e);
    }
    createMainWindow();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createMainWindow();
    }
});
