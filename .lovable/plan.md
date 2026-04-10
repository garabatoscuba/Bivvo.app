

## Plan: Cantidad multiplicadora + Cuenta abierta en Servicios

### Cambios en `src/pages/Services.tsx` (solo dentro de `EmployeeServicesView`)

#### 1 — Estado nuevo
- `quantity: number` (default 1)
- `tabItems: Array<{ id: string, catId: string|null, name: string, icon: string, description: string, quantity: number, unitPrice: number, isLive: boolean }>` (cuenta abierta)
- Reset `quantity` a 1 cuando se selecciona un servicio diferente

#### 2 — Panel derecho: control de cantidad
Debajo del campo Descripción (línea ~482), antes del campo Monto:
- Reemplazar el input libre de monto por un control de cantidad: botones `−` `[cantidad]` `+` × `[precio]` = `$total`
- El precio base viene del `fixed_price` de la categoría (o input manual si es "en vivo")
- Si el servicio tiene precio fijo: mostrar `Precio base: $X` como referencia, permitir editar el precio unitario
- Total línea = `quantity × precio_unitario`
- El campo de monto actual se convierte en el precio unitario editable

#### 3 — Sección "Cuenta abierta"
Debajo del control de cantidad:
- Botón "Agregar a cuenta" que añade el servicio actual (con su cantidad, precio, descripción) a `tabItems`
- Lista de items agregados: cada uno muestra nombre, `qty × $precio`, total, botón × para eliminar
- Subtotal de la cuenta
- Al agregar, se resetea la selección actual (cantidad=1, descripción vacía)

#### 4 — Total y botón Cobrar
- `totalACobrar` = suma de tabItems + servicio seleccionado actual (si hay)
- El botón "Cobrar" muestra el total combinado
- Si no hay tabItems, el comportamiento es idéntico al actual (cobro individual)

#### 5 — Payment Dialog y mutación
- NO se modifica el componente `ServicePaymentSection` ni la estructura del dialog
- Se actualiza el total mostrado en el dialog para usar `totalACobrar`
- La mutación `createEntryMutation` se adapta para insertar múltiples registros:
  - Cada item de la cuenta + el servicio actual se inserta como un `service_entry` individual
  - Cada uno con su propio `amount = qty × unitPrice`
  - Se usa un loop de inserts o un insert con array
- Al confirmar: se limpia `tabItems`, se resetea todo

#### 6 — Audit log
- Se registra un solo audit log con el total combinado y cantidad de servicios

### Archivos a modificar
- `src/pages/Services.tsx` (solo `EmployeeServicesView`, líneas ~200-553)

### Lo que NO se toca
- `ServicePaymentSection` (componente de métodos de pago)
- Vista Owner (`OwnerServicesView`)
- POS, Inventario, Jornadas, Auth
- Base de datos (no se necesitan cambios de schema)

