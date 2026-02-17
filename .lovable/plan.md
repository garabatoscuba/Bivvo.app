

# Modulo de Ventas - Historial, Detalle y Cuentas por Cobrar

## Que se va a construir

Una pagina completa en `/sales` con cuatro secciones principales:

### 1. Resumen rapido (cards superiores)
Cuatro tarjetas con metricas clave, filtradas por la sucursal activa:
- **Ventas hoy**: cantidad y monto total del dia
- **Ventas del mes**: cantidad y monto total del mes actual
- **Ticket promedio**: monto promedio por venta en el mes
- **Pendientes de cobro**: total de ventas a credito con status "pending"

### 2. Historial de ventas (tabla principal)
Tabla con todas las ventas de la sucursal activa, mostrando:
- Numero de venta (VTA-000001)
- Fecha y hora
- Vendedor (nombre del usuario que realizo la venta)
- Cliente (si se registro, sino "Publico general")
- Metodo de pago (badge con color: efectivo, tarjeta, transferencia, credito)
- Total
- Estado (badge: completada verde, pendiente amarillo, cancelada rojo)
- Boton para ver detalle

**Filtros disponibles:**
- Rango de fechas (fecha inicio / fecha fin)
- Metodo de pago (todos, efectivo, tarjeta, transferencia, credito)
- Estado (todos, completada, pendiente, cancelada)

### 3. Detalle de venta (Sheet lateral)
Al hacer clic en una venta, se abre un panel lateral con:
- Informacion general: numero, fecha, vendedor, cliente, notas
- Tabla de productos vendidos: nombre, cantidad, precio unitario, descuento, total por linea
- Resumen: subtotal, descuento, total, monto pagado, cambio/saldo pendiente
- Boton "Cancelar venta" (solo owner/manager) que cambiara el estado a "cancelled" -- la devolucion de stock se implementara despues

### 4. Pestana de Cuentas por Cobrar
Una segunda pestana (Tabs) que muestra solo las ventas con status "pending" (credito):
- Misma tabla pero filtrada a credito pendiente
- En el detalle de cada una, boton "Registrar pago" que actualiza `amount_paid` y cambia status a "completed" cuando se paga el total

## Cambios necesarios

### 1. Nueva pagina `src/pages/Sales.tsx`
- Layout con AppLayout
- Cards de resumen arriba
- Tabs: "Historial" y "Cuentas por Cobrar"
- Tabla de ventas con filtros
- Sheet de detalle

### 2. Actualizar `src/hooks/useSales.ts`
- Agregar query para obtener ventas con joins a profiles (vendedor) y customers
- Agregar query para obtener sale_items de una venta especifica
- Agregar mutation para cancelar venta (update status)
- Agregar mutation para registrar pago en venta a credito

### 3. Actualizar `src/App.tsx`
- Cambiar la ruta `/sales` para usar el nuevo componente Sales

## Detalles tecnicos

### Consulta de ventas
```sql
-- La query traera ventas de la sucursal activa con datos del vendedor
SELECT sales.*, 
  profiles.full_name as seller_name,
  customers.name as customer_name
FROM sales
LEFT JOIN profiles ON profiles.user_id = sales.user_id
LEFT JOIN customers ON customers.id = sales.customer_id
WHERE sales.branch_id = :currentBranch
ORDER BY sales.created_at DESC
```

En codigo se hara con el SDK de Supabase usando selects con relaciones.

### Consulta de items de una venta
```sql
SELECT sale_items.*, products.name, products.code
FROM sale_items
LEFT JOIN products ON products.id = sale_items.product_id
WHERE sale_items.sale_id = :saleId
```

### Cancelar venta
```typescript
await supabase.from('sales').update({ status: 'cancelled' }).eq('id', saleId);
```
Nota: la devolucion automatica de stock al cancelar se implementara en una fase posterior con un trigger de base de datos.

### Registrar pago (cuentas por cobrar)
```typescript
const newAmountPaid = currentAmountPaid + paymentAmount;
const newStatus = newAmountPaid >= total ? 'completed' : 'pending';
await supabase.from('sales').update({ 
  amount_paid: newAmountPaid, 
  status: newStatus 
}).eq('id', saleId);
```

### Estructura de archivos
- `src/pages/Sales.tsx` - Pagina principal con tabs, filtros, tabla y detalle
- `src/hooks/useSales.ts` - Se extiende con queries y mutations adicionales

### No se requieren migraciones
Las tablas `sales`, `sale_items`, `customers` y `profiles` ya existen con las columnas necesarias. Las RLS policies ya estan configuradas.

### Permisos
- Todos los roles pueden ver las ventas de su sucursal
- Solo `owner` y `manager` pueden cancelar ventas
- Todos pueden registrar pagos en cuentas por cobrar (el vendedor necesita poder cobrar)

