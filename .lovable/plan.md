

## Plan: Módulo de Clientes

### Situación actual

Ya existe una tabla `customers` con `id, business_id, name, email, phone, address, notes, created_at, updated_at`. Las ventas del POS ya tienen `customer_id` como FK a `customers`. El módulo "Clientes" ya existe en `platform_modules`. Falta la página, la ruta, el mapeo en sidebar, la columna `client_id` en `service_entries`, y los selectores de cliente en POS y Servicios.

### Cambios

**1. Migración de base de datos**
- Agregar columnas `branch_id` (uuid, nullable, FK a branches) y `created_by` (uuid, nullable) a `customers`
- Agregar columna `customer_id` (uuid, nullable, FK a customers) a `service_entries`
- Agregar RLS policy para sellers (insert) en `customers` para que vendedores puedan crear clientes desde POS/Servicios

**2. Nueva página `src/pages/Clients.tsx`**
- Lista de clientes con búsqueda por nombre o teléfono
- Botón "Nuevo cliente" con formulario (nombre obligatorio, teléfono y email opcionales, notas opcionales)
- Al tocar un cliente: ficha con datos + historial de ventas POS (`sales` con `customer_id`) + historial de servicios (`service_entries` con `customer_id`)
- Editar datos del cliente

**3. Ruta en `App.tsx`**
- Agregar `/clients` con lazy load

**4. Sidebar en `AppSidebar.tsx`**
- Agregar `Clientes: "/clients"` al `moduleUrlMap`
- Agregar "Clientes" al set de módulos permitidos para gerente (`MANAGER_ALLOWED_MODULES`)

**5. Componente `ClientSearchSelect`**
- Input con búsqueda por nombre o teléfono que muestra sugerencias de `customers`
- Opción para crear cliente rápido si no existe
- Reutilizable en POS y Servicios

**6. POS — `PaymentDialog.tsx`**
- Agregar el campo opcional "Cliente" usando `ClientSearchSelect` antes de los métodos de pago
- Pasar `customerId` al `onConfirm` callback
- Actualizar `PaymentDialogProps` y `POS.tsx` → `handlePayment` para enviar `customerId` a `createSale`

**7. Servicios — `Services.tsx`**
- En ambas mutaciones de cobro (`chargeMutation` y `createEntryMutation`), agregar estado `selectedClientId`
- Agregar `ClientSearchSelect` en el diálogo de pago de servicios
- Incluir `customer_id` en el payload del insert a `service_entries`

### Archivos nuevos
- `src/pages/Clients.tsx`
- `src/components/clients/ClientSearchSelect.tsx`

### Archivos editados
- `src/App.tsx` — nueva ruta
- `src/components/layout/AppSidebar.tsx` — moduleUrlMap + MANAGER_ALLOWED_MODULES
- `src/components/pos/PaymentDialog.tsx` — campo cliente opcional
- `src/pages/POS.tsx` — pasar customerId
- `src/pages/Services.tsx` — campo cliente opcional en cobros
- `src/types/database.ts` — agregar customer_id a interfaces si es necesario

### No se toca
- Flujo de cobro existente (montos, métodos de pago, descuentos)
- Edge functions, auth, roles, POS cart, inventario

