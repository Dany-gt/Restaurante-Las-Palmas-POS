# Módulo: Configuración Global

## Descripción general
Este módulo centraliza los parámetros maestros del sistema. Su propósito es definir el comportamiento global de la aplicación, desde la identidad del restaurante y sucursales hasta los protocolos de seguridad, acceso de usuarios y configuración de hardware (impresoras y terminales).

## Categorías
1. **Perfil del Restaurante**: Datos fiscales, logotipos y configuración de moneda.
2. **Sucursales**: Multisitio: nombres, direcciones y terminales asignadas.
3. **Usuarios y Seguridad**: Gestión de roles, perfiles de acceso y políticas RLS.
4. **Hardware y Periféricos**: Configuración de impresoras de tickets (térmicas) y envío de correos (SMTP).
5. **Estaciones de Preparación**: Definición de destinos para comandas (ej. Cocina 1, Barra Fría).

## Interacción con Base de Datos

### Tablas Relevantes (Supabase/PostgreSQL)

| Tabla | Función |
| :--- | :--- |
| `system_settings` | Parámetros globales únicos del sistema. |
| `branches` | Registro de ubicaciones físicas del restaurante. |
| `profiles` | Extensión de `auth.users` para roles y datos de empleados. |
| `kitchen_stations` | Definición de estaciones para ruteo de impresión. |
| `printers` | Configuración de dispositivos de red para impresión directa. |

### Relaciones Clave
- `profiles.id` → `auth.users.id` (Relación 1:1)
- `branches.org_id` → `organizations.id`

### Consultas Principales
**Carga de Configuración Maestra:**
```sql
SELECT * FROM system_settings WHERE org_id = 'default' LIMIT 1;
```

**Verificación de Privilegios por Perfil:**
```sql
SELECT role, permissions 
FROM profiles 
WHERE id = 'USER_ID_AUTENTICADO';
```

---
*Documentación Técnica - Restaurante Las Palmas*
