const { contextBridge, ipcRenderer } = require('electron');

/**
 * Exponer funciones nativas de Electron al contexto de React de forma segura
 * Esto crea window.electronAPI en el sitio de Vercel
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

    // --- RESTORED MEMORY FUNCTIONS ---
    
    // Printing
    getPrinters: () => ipcRenderer.invoke('get-printers'),
    printHtml: (html, printerName, silent) => ipcRenderer.invoke('print-html', { html, printerName, silent }),
    printToNetwork: (ip, port, html) => ipcRenderer.invoke('print-to-network', { ip, port, html }),
    checkConnection: (ip, port) => ipcRenderer.invoke('check-connection', { ip, port }),
    openCashDrawer: (options) => ipcRenderer.invoke('open-cash-drawer', options),

    // Email
    sendEmail: (params) => ipcRenderer.invoke('send-email', params),

    // PDF
    generatePdf: (html, name) => ipcRenderer.invoke('generate-pdf', { html, name })
};

// Expose with both names for total backwards compatibility
contextBridge.exposeInMainWorld('electronAPI', api);
contextBridge.exposeInMainWorld('electron', api);
