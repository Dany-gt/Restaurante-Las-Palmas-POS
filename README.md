# 🍽️ Restaurante Las Palmas POS

Sistema de Punto de Venta (POS) integral diseñado para la gestión eficiente de restaurantes, con soporte para ventas, inventarios, facturación, y despacho de domicilios.

[![GitHub visibility](https://img.shields.io/badge/Visibility-Private-red)](https://github.com/Dany-gt/Restaurante-Las-Palmas-POS)
[![Technology](https://img.shields.io/badge/Powered%20by-React%20%2B%20Electron-blue)](https://reactjs.org/)
[![Database](https://img.shields.io/badge/Database-Supabase-green)](https://supabase.com/)

## 🚀 Características Principales

- **💻 Aplicación de Escritorio:** Desarrollada con Electron para una experiencia fluida en Windows.
- **📦 Gestión de Inventarios:** Control de insumos, stock en tiempo real y alertas de bajas.
- **🧾 Facturación y Cuentas:** Módulo de cuentas por cobrar, integración con impresoras POS y exportación a PDF/Excel.
- **🛵 Despacho de Domicilios:** Soporte para repartidores con aplicación móvil integrada vía Capacitor.
- **🤖 Inteligencia Artificial:** Integración con Google Gemini para asistencia y análisis de datos.
- **🗺️ Mapas:** Integración con Google Maps API para geolocalización de pedidos.

## 🛠️ Stack Tecnológico

- **Core:** React 19 (TypeScript) + Vite
- **Escritorio:** Electron 33
- **Móvil:** Capacitor 8
- **Base de Datos:** Supabase (PostgreSQL)
- **Estilos:** Tailwind CSS + Framer Motion (animaciones)
- **Componentes:** Lucide React (iconos), Recharts (gráficas), react-simple-keyboard (teclado táctil)
- **Utilidades:** Dayjs, XLSX, JSPDF, Nodemailer

## 📦 Instalación y Configuración

Sigue estos pasos para ejecutar el proyecto en tu entorno local:

### 1. Requisitos Previos
- [Node.js](https://nodejs.org/) (Versión recomendada: 18 o superior)
- Git

### 2. Clonar el Repositorio
```bash
git clone https://github.com/Dany-gt/Restaurante-Las-Palmas-POS.git
cd Restaurante-Las-Palmas-POS
```

### 3. Instalar Dependencias
```bash
npm install
```

### 4. Variables de Entorno
Crea un archivo `.env.local` en la raíz del proyecto y agrega las siguientes llaves (solicítalas al administrador):
```env
VITE_SUPABASE_URL=tu_url_de_supabase
VITE_SUPABASE_ANON_KEY=tu_llave_anon_de_supabase
GOOGLE_API_KEY=tu_llave_de_google_gemini
```

## 🛠️ Comandos Disponibles

- **`npm run dev`**: Inicia el servidor de desarrollo para la versión web.
- **`npm run electron`**: Inicia la aplicación en modo escritorio (Windows).
- **`npm run build`**: Genera la compilación de producción del frontend.
- **`npm run electron:build`**: Empaqueta la aplicación para distribución (.exe).

## 📂 Estructura del Proyecto

- `/src`: Lógica principal de la aplicación React.
- `/electron`: Archivos de configuración y main process de Electron.
- `/components`: Componentes UI reutilizables.
- `/services`: Conexiones a servicios externos (Supabase, API).
- `/utils`: Helper functions y lógica de negocio.
- `/android`: Archivos para la plataforma móvil (Capacitor).

## 📄 Licencia

Este proyecto es privado y propiedad de **Restaurante Las Palmas**. Todos los derechos reservados.
