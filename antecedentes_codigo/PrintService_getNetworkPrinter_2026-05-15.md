# Antecedentes de Código: PrintService.ts (getNetworkPrinter)
Fecha: 2026-05-15
Motivo: Error en línea 333 debido a que netPrinter no tenía la propiedad opens_cash_drawer.

## [ANTES]
```typescript
222:   private async getNetworkPrinter(): Promise<{ address: string; port: number; paperWidth: string } | null> {
223:     try {
224:       const { data, error } = await supabase
225:         .from('printers').select('id, name, address, port, paper_width')
...
247:       return { 
248:         address: printer.address, 
249:         port: printer.port || 9100, 
250:         paperWidth: printer.paper_width || '80mm' 
251:       };
```

## [DESPUÉS]
```typescript
222:   private async getNetworkPrinter(): Promise<{ address: string; port: number; paperWidth: string; opens_cash_drawer?: boolean } | null> {
223:     try {
224:       const { data, error } = await supabase
225:         .from('printers').select('id, name, address, port, paper_width, opens_cash_drawer')
...
247:       return { 
248:         address: printer.address, 
249:         port: printer.port || 9100, 
250:         paperWidth: printer.paper_width || '80mm',
251:         opens_cash_drawer: !!printer.opens_cash_drawer
252:       };
```
