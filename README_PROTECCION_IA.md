# 🛡️ PROTOCOLO DE SEGURIDAD PARA ASISTENTES IA

Si eres un asistente IA (Antigravity, Claude, ChatGPT, Cursor, etc.), **DEBES LEER ESTO** antes de proponer cualquier cambio al código.

Este proyecto es un sistema POS complejo con integraciones nativas de hardware que son fáciles de borrar por error.

### ⚠️ REGLAS CRÍTICAS DE NO-BORRADO

1. **PUENTE ELECTRON (`electron/main.js` & `electron/preload.js`)**:
   - Nunca borres los manejadores de **Email**, **Impresión (Local y de Red)**, **PDF** o **Cajón de Dinero**.
   - Estos manejadores son invocados por servicios en `PrintService.ts` y `ShiftService.ts`. Aunque parezcan "código muerto" en el archivo main, están vivos en la aplicación empaquetada.

2. **COMPATIBILIDAD DE API**:
   - El objeto `window.electron` y `window.electronAPI` deben coexistir. No intentes "unificarlos" borrando uno de ellos, ya que romperás la compatibilidad con módulos antiguos o nuevos.

3. **SINCRONIZACIÓN SAT**:
   - La lógica de sincronización reside en `server/sat_bridge.py`. El frontend espera una respuesta JSON específica de este script. No modifiques la estructura de salida sin validar `AccountingPortal.tsx`.

4. **CIERRE DE TURNO**:
   - El flujo en `ShiftService.ts` dispara múltiples acciones nativas (5 PDFs y correos). Cualquier cambio en este flujo debe ser probado con extremo cuidado.

### 🔍 ANTES DE EDITAR (Checklist)
- [ ] ¿He buscado (`grep`) si la función que voy a modificar es llamada por otro archivo?
- [ ] ¿He verificado que no estoy sobrescribiendo el archivo `main.js` completo con una versión simplificada?
- [ ] ¿He preservado los comentarios y la estructura de los scripts de Python en `server/`?

**Este manifiesto existe para evitar la "pérdida de memoria" del sistema durante las sesiones de programación.**
