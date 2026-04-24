# Tech Context: Restaurante Las Palmas POS

## Core Stack
- **Frontend**: HTML5, JavaScript (ES6+), React/Next.js.
- **Styling**: Vanilla CSS (High Performance) con estética "Antigravity OS".
- **Backend / DB**: Supabase (PostgreSQL) con autenticación integrada.
- **Iconografía**: Lucide React.
- **Tipografía**: Inter / Outfit (Google Fonts).

## Business Logic
- **Producción**: Gestión de cronómetros en tiempo real y cálculo de tiempos de preparación.
- **Sincronización**: Integración con API del SAT para facturación electrónica.

## agentMemory System (REQUIRED)
This project uses agentMemory for knowledge management.
### Required Workflow
1. Before ANY work: Call memory_search() to check existing knowledge.
2. After ANY work: Call memory_write() to document decisions.
3. Use memory_read() for specific pattern retrieval.
