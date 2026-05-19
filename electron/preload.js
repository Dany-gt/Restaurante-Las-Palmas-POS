const { contextBridge, ipcRenderer } = require('electron');

/**
 * Exponer funciones nativas de Electron al contexto de React de forma segura
 */
const api = {
    // Window Controls
    minimizeWindow: () => ipcRenderer.send('window-minimize'),
    maximizeWindow: () => ipcRenderer.send('window-maximize'),
    closeWindow: () => ipcRenderer.send('window-close'),

    // Authentication Signal
    sendLoginSuccess: () => ipcRenderer.send('login-success'),

    // SAT Synchronization (Local)
    satSync: (params) => ipcRenderer.invoke('sat-sync', params),

    // Printing API
    getPrinters: () => ipcRenderer.invoke('get-printers'),
    printHtml: (html, printerName, silent) => ipcRenderer.invoke('print-html', { html, printerName, silent }),
    printToNetwork: (ip, port, content, isRaw) => ipcRenderer.invoke('print-to-network', { ip, port, content, isRaw }),
    checkConnection: (ip, port) => ipcRenderer.invoke('check-connection', { ip, port }),
    openCashDrawer: (options) => ipcRenderer.invoke('open-cash-drawer', options),

    // Email
    sendEmail: (params) => ipcRenderer.invoke('send-email', params),

    // PDF
    generatePdf: (html, name) => ipcRenderer.invoke('generate-pdf', { html, name }),

    // ── Image Filesystem Cache (Electron-native) ────────────────────────────
    // Downloads images to userData/images/ and returns { originalUrl -> app-image:///file.jpg }
    downloadImages: (imageList) => ipcRenderer.invoke('download-images', imageList),
    // Returns the path of the local images folder (for display/debugging)
    getImagesDir: () => ipcRenderer.invoke('get-images-dir'),
};

// Expose with both names for total backwards compatibility
contextBridge.exposeInMainWorld('electronAPI', api);
contextBridge.exposeInMainWorld('electron', api);
