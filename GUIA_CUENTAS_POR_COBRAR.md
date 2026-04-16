# GUÍA COMPLETA: SISTEMA DE CUENTAS POR COBRAR
## RESTAURANTE LAS PALMAS POS

---

## 📋 DESCRIPCIÓN

Este sistema permite gestionar **créditos comerciales** y realizar un seguimiento completo de todas las ventas al crédito y pagos realizados por los clientes.

### Características principales:
✅ **Registro automático** de ventas al crédito desde el punto de venta  
✅ **Vista completa** con todas las columnas: Nombre, NIT, Teléfono, Límite, Descuento, Saldo  
✅ **Historial detallado** de cargos y abonos por cliente  
✅ **Actualización en tiempo real** del saldo cuando se realiza un pago  
✅ **Alertas de límite** cuando un cliente se acerca a su límite de crédito  

---

## 🚀 PASO 1: CONFIGURACIÓN INICIAL (BASE DE DATOS)

### 1.1 Ejecutar el script SQL

1. Abre **Supabase** → **SQL Editor**
2. Copia todo el contenido del archivo: `CREATE_RECEIVABLES_TABLE.sql`
3. Pégalo en el editor SQL
4. Haz clic en **"Run"** o **"Ejecutar"**
5. Verifica que aparezca el mensaje: ✅ `Sistema de Cuentas por Cobrar configurado correctamente`

### 1.2 Verificar la instalación

Ejecuta esta consulta para ver los clientes de ejemplo:

```sql
SELECT 
    customer_name as "Cliente",
    client_nit as "NIT",
    telephone as "Teléfono",
    limite_credito as "Límite de Crédito",
    descuento as "Descuento %",
    saldo as "Saldo Actual"
FROM public.receivables_summary;
```

---

## 💼 PASO 2: CONFIGURAR CLIENTES CON CRÉDITO

### 2.1 Desde el Panel de Administración

1. Ve a **ADMINISTRACIÓN** → **Gestión de Clientes**
2. Haz clic en **"NUEVO CLIENTE"**
3. Llena los datos del cliente:
   - **Nombre**: HOTEL LAS PALMAS
   - **NIT**: 12345678-9
   - **Teléfono**: 5555-1234
   - **Email**: hotel@example.com
   - **Límite de Crédito**: Q50,000.00
   - **Descuento Autorizado**: 5.00%
4. Haz clic en **"GUARDAR"**

### 2.2 Manualmente en SQL (Opcional)

```sql
INSERT INTO public.customers (
    name, nit, phone, email, address, 
    credit_limit, authorized_discount, current_balance, is_active
) VALUES (
    'MUNICIPALIDAD GUATEMALTECA',
    '987654321-0',
    '5555-5678',
    'municipalidad@example.com',
    'Centro Cívico',
    100000.00,  -- Límite de crédito
    10.00,      -- Descuento autorizado (%)
    0.00,       -- Saldo inicial
    true
);
```

---

## 🛒 PASO 3: REALIZAR UNA VENTA AL CRÉDITO

### 3.1 En el Punto de Venta (Cajero)

1. Selecciona una mesa y agrega productos a la orden
2. Haz clic en **"COBRAR"**
3. Selecciona el método de pago: **"AL CRÉDITO"**
4. Se abrirá el **Selector de Cliente**:
   - Busca al cliente por nombre, NIT o teléfono
   - Verifica que el **Nuevo Saldo** no exceda el **Límite de Crédito**
   - Haz clic en **"ACEPTAR"**
5. Completa la facturación normalmente

### 3.2 ¿Qué sucede automáticamente?

Cuando completas una venta al crédito, el sistema:

1. ✅ **Actualiza el saldo** del cliente sumando el monto de la orden
2. ✅ **Registra una transacción** de tipo **CARGO** en `credit_transactions`
3. ✅ **Vincula la orden** con el cliente en la tabla `orders`
4. ✅ **Actualiza la vista** en tiempo real en "Cuentas por Cobrar"

---

## 💰 PASO 4: REGISTRAR UN ABONO / PAGO

### 4.1 Desde Cuentas por Cobrar

1. Ve a **ADMINISTRACIÓN** → **Cuentas por Cobrar**
2. Localiza al cliente en la tabla
3. Haz clic en **"ABONAR"** (botón verde)
4. Ingresa:
   - **Monto a Abonar**: Q500.00
   - **Método de Pago**: EFECTIVO / TARJETA / TRANSFERENCIA / CHEQUE
   - **Descripción** (opcional): "Abono parcial"
5. Haz clic en **"REGISTRAR PAGO"**
6. Se mostrará un mensaje con:
   - Saldo anterior
   - Monto del abono
   - Nuevo saldo

### 4.2 ¿Qué sucede automáticamente?

El sistema:

1. ✅ **Reduce el saldo** del cliente
2. ✅ **Registra una transacción** de tipo **PAYMENT** en `credit_transactions`
3. ✅ **Actualiza la vista** en tiempo real

---

## 📊 PASO 5: VER HISTORIAL DE UN CLIENTE

### 5.1 Ver Detalles y Transacciones

1. Ve a **ADMINISTRACIÓN** → **Cuentas por Cobrar**
2. Haz clic en el **ícono de ojo** (👁️) junto al cliente
3. Se abrirá un modal con:
   - **Lista de cargos** (ventas al crédito) en rojo
   - **Lista de abonos** (pagos) en verde
   - Fecha y hora de cada transacción
   - Número de orden (si aplica)
   - Monto de cada movimiento

---

## 📈 DASHBOARDS Y MÉTRICAS

En la pantalla de **Cuentas por Cobrar** verás:

### Métricas principales:
- **Total en la Calle**: Suma de todos los saldos pendientes
- **Clientes Activos**: Número de clientes con saldo mayor a 0
- **Límite Total Autorizado**: Suma de todos los límites de crédito

### Tabla de Clientes:
| Columna | Descripción |
|---------|-------------|
| **Nombre** |Nombre del cliente con contador de cargos/pagos |
| **Cliente (NIT)** | NIT o "CF" si no tiene |
| **Teléfono** | Número de contacto |
| **Límite de Crédito** | Monto máximo autorizado en verde |
| **Descuento %** | Porcentaje de descuento autorizado en amarillo |
| **Saldo** | Saldo actual en rojo + % usado del límite |
| **Acciones** | Botones para ver historial y abonar |

---

## 🔧 FUNCIONES AVANZADAS

### Función SQL: `register_credit_payment`

Puedes registrar un pago manualmente desde SQL:

```sql
SELECT public.register_credit_payment(
    'UUID_DEL_CLIENTE'::UUID,
    500.00,  -- Monto del abono
    'EFECTIVO',
    'Abono parcial',
    'UUID_DEL_USUARIO'::UUID
);
```

Retorna un JSON con:
```json
{
  "success": true,
  "transaction_id": "...",
  "previous_balance": 1500.00,
  "payment_amount": 500.00,
  "new_balance": 1000.00
}
```

---

## 🔍 CONSULTAS ÚTILES

### Ver todos los clientes con saldo pendiente

```sql
SELECT * FROM receivables_summary 
WHERE saldo > 0 
ORDER BY saldo DESC;
```

### Ver historial completo de un cliente

```sql
SELECT * FROM receivables_transactions_detail 
WHERE customer_name = 'HOTEL LAS PALMAS'
ORDER BY fecha_transaccion DESC;
```

### Ver clientes cerca del límite de crédito

```sql
SELECT 
    customer_name,
    saldo,
    limite_credito,
    ROUND((saldo / limite_credito * 100), 2) as porcentaje_usado
FROM receivables_summary
WHERE saldo > (limite_credito * 0.8)
ORDER BY porcentaje_usado DESC;
```

---

## ⚠️ IMPORTANTE - ALERTAS Y VALIDACIONES

### El sistema automáticamente:

1. ✅ **Impide cobros al crédito** si el nuevo saldo excede el límite
2. ✅ **Valida** que los abonos no sean mayores al saldo pendiente
3. ✅ **Actualiza en tiempo real** cuando hay cambios
4. ✅ **Registra el usuario** que realizó cada transacción

---

## 📞 SOPORTE

Si encuentras algún problema:

1. Verifica que hayas ejecutado `CREATE_RECEIVABLES_TABLE.sql`
2. Revisa la consola del navegador (F12) para errores
3. Verifica que la tabla `customers` tenga clientes con `credit_limit > 0`
4. Comprueba que el trigger `trigger_register_credit_sale` esté activo en Supabase

---

## ✅ CHECKLIST DE VERIFICACIÓN

- [ ] Script SQL ejecutado en Supabase
- [ ] Vista `receivables_summary` creada correctamente
- [ ] Al menos un cliente con `credit_limit > 0` configurado
- [ ] Prueba: Realizar una venta al crédito desde el POS
- [ ] Verificar: El saldo del cliente se actualizó automáticamente
- [ ] Prueba: Registrar un abono desde "Cuentas por Cobrar"
- [ ] Verificar: El saldo se redujo correctamente
- [ ] Prueba: Ver historial de transacciones

---

**Sistema listo para producción ✅**

*Versión: 1.0*  
*Última actualización: 2026-01-29*
