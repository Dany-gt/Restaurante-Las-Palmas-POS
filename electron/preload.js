const { contextBridge, ipcRenderer } = require('electron');

/**
 * Exponer funciones nativas de Electron al contexto de React de forma segura
 * Esto crea window.electronAPI en el sitio de Vercel
 */
contextBridge.exposeInMainWorld('electronAPI', {
    // Enviar señal de éxito en login detectada
    sendLoginSuccess: () => {
        ipcRenderer.send('login-success');
    },

    // Envío de cierre de sesión (Opcional, futuro uso)
    sendLogout: () => {
        ipcRenderer.send('logout');
    },

    // Funciones de control de ventana (Nativo)
    minimizeWindow: () => {
        ipcRenderer.send('window-minimize');
    },

    closeWindow: () => {
        ipcRenderer.send('window-close');
    }
});
