# Guía de Implementación: Ingesta Automatizada de Facturas SAT (Guatemala)

Esta guía detalla la arquitectura técnica y los "hacks" necesarios para integrar la Agencia Virtual de la SAT en un sistema POS/ERP moderno, superando las protecciones de PrimeFaces/JSF.

---

## 🏗️ 1. Arquitectura del Sistema

El sistema utiliza un enfoque de **3 Capas** para garantizar estabilidad y seguridad:

1.  **Capa de Scraping (Python):** Un motor especializado en navegar el portal de la SAT (`farm3.sat.gob.gt`). Es el único que "conversa" con el portal.
2.  **Capa de Puente (Node.js/Vite Plugin):** Actúa como middleware. Llama al script de Python, recibe los datos limpios en JSON e interactúa con la base de datos y la IA.
3.  **Capa Visual (React/TypeScript):** La interfaz de usuario donde el administrador inicia la sincronización y visualiza los libros contables.

---

## 🛠️ 2. El Desafío: PrimeFaces y JSF

La mayoría de scrapers fallan porque el portal de la SAT usa **JavaServer Faces (JSF)** con **PrimeFaces**. Esto implica dos grandes barreras:

### A. El `javax.faces.ViewState`
Cada petición POST debe incluir un token de estado (`ViewState`) que el servidor entrega en el HTML anterior. Sin este token, el servidor rechaza la sesión (`Error 500` o expiración).

### B. El Redireccionamiento Criptográfico (La Clave)
Al pasar del menú principal (`farm3`) al módulo de DTEs (`felcons`), la SAT genera un aviso JavaScript interno:
`location.replace('https://felcons.../dte-consulta?Nit=XXXX&Clave=YYYY')`

> [!IMPORTANT]
> **El Hack Crítico:** No basta con tener la cookie de sesión. Si no extraes esa `Clave` dinámica del código fuente de la respuesta AJAX, el subdominio de facturas te dará un **Error 403 Forbidden**.

---

## 🐍 3. Lógica del Scraper (Python)

El proceso de navegación consta de 4 pasos obligatorios:

1.  **Login:** Envía credenciales a `init.do` y captura la cookie `felTokc`.
2.  **Selección de Menú:** Simula un clic en el componente PrimeFaces usando la cabecera `Faces-Request: partial/ajax`.
3.  **Extracción de URL:** Analiza la respuesta XML de PrimeFaces para encontrar el enlace con el parámetro `&Clave=`.
4.  **Consulta API:** Con la cookie y la URL validada, se hace una petición GET al endpoint de la API de la SAT (`/api/consulta-dte`) que devuelve un JSON puro.

---

## 🚀 4. El Puente Middleware (Node.js)

Para que el sistema web pueda usar el script de Python sin exponer credenciales en el navegador, usamos un **Vite Plugin** que crea un endpoint interno `/api/sat-sync`.

### Flujo del Plugin:
1.  **Spawning:** Usa `child_process.spawn` para ejecutar el script de Python.
2.  **Seguridad:** Pasa las credenciales por `stdin` (entrada estándar), nunca por línea de comandos, para evitar que el password sea visible en el administrador de tareas del SO.
3.  **Deduplicación:** Antes de guardar en Supabase, el plugin verifica el `fel_uuid` de la factura. Si ya existe, la omite para evitar registros dobles.

---

## 🧠 5. Categorización Inteligente (Gemini AI)

Para las facturas de **Compra**, el sistema no sabe si el gasto es "Energía", "Materia Prima" o "Mantenimiento". 

1.  **Regex Primero:** Usamos expresiones regulares rápidas para proveedores conocidos (ej. "EEGSA" -> Gas y Energía).
2.  **IA de Respaldo:** Si el Regex no sabe qué es, enviamos el nombre del proveedor a **Gemini 2.0 Flash**.
3.  **Batching:** Enviamos todas las facturas desconocidas en un solo "prompt" para ahorrar tiempo y tokens, recibiendo un array JSON de categorías en una sola respuesta.

---

## 📊 6. Esquema de Base de Datos (SQL)

Se necesitan dos tablas idénticas para separar los libros contables:

- `purchase_invoices`: Almacena lo que recibimos (Egresos).
- `sales_invoices`: Almacena lo que emitimos (Ingresos).

### Campos fundamentales:
- `fel_uuid` (TEXT UNIQUE): La llave maestra para evitar duplicados.
- `items` (JSONB): Permite guardar el detalle de productos sin crear tablas relacionales complejas si no es necesario.

---

## 📝 7. Checklist para Futuras Implementaciones

Si decides replicar esto en otro sistema, asegúrate de:
1.  **User-Agent Real:** Usa un User-Agent de un navegador moderno para evitar bloqueos del WAF de la SAT.
2.  **Cookies Fallback:** Busca tanto la cookie `ACCESS_TOKEN` como `felTokc` (la SAT las cambia de nombre ocasionalmente).
3.  **Timeout:** Las peticiones a la SAT son lentas. El tiempo de espera (timeout) de tu bridge debe ser de al menos **60 a 90 segundos**.
4.  **Limpieza:** Siempre ejecuta un `logout` al final del scraping para no dejar sesiones colgadas en el servidor de la SAT.

---
*Este documento sirve como base para cualquier integración de Agencia Virtual SAT basada en web scraping robusto.*
