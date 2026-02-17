# Dashboard Moderno con Analiticas y Graficas

## Que se va a construir

Reemplazar el dashboard actual (que muestra datos estaticos "$0.00") por un dashboard completo con datos reales, graficas interactivas y un selector de periodo (dia, semana, mes, ano).

## Estructura del nuevo Dashboard

### 1. Barra superior: Selector de periodo

Un grupo de botones (ToggleGroup) para cambiar entre:

- **Hoy** - datos del dia actual, en vivo
- **Semana** - ultimos 7 dias
- **Mes** - mes actual
- **Ano** - ano actual

### 2. KPIs principales (4 cards)

Cuatro tarjetas con datos reales filtrados por el periodo seleccionado:

- **Total Ventas**: monto total de ventas completadas en el periodo
- **Cantidad de Ventas**: numero de transacciones completadas
- **Ticket Promedio**: total / cantidad de ventas
- **Cuentas por Cobrar**: total de ventas con status "pending" (credito vigente, no afectado por periodo)

Cada card mostrara la comparacion porcentual vs el periodo anterior (ej: "hoy vs ayer", "esta semana vs la anterior", etc.)

### 3. Grafica de ventas (Area/Bar chart)

- Grafica principal usando recharts (ya instalado)
- Eje X: fechas/horas segun el periodo (horas si es "hoy", dias si es semana/mes, meses si es ano)
- Eje Y: monto de ventas
- Tooltip con detalle al pasar el mouse

### 4. Grafica de metodos de pago (Pie/Donut chart)

- Distribucion de ventas por metodo de pago (efectivo, tarjeta, transferencia, credito)
- Colores diferenciados por metodo
- Leyenda con montos y porcentajes

### 5. Top 5 productos mas vendidos (Bar chart horizontal)

- Los 5 productos con mayor cantidad vendida en el periodo
- Nombre del producto y cantidad

### 6. Seccion de alertas (se mantiene)

- Productos con stock bajo (ya existente, se conserva)

### 7. Acciones rapidas (se mantienen)

- Botones de acceso rapido a POS, Inventario, Empleados

## Cambios necesarios

### 1. Nuevo hook `src/hooks/useDashboardStats.ts`

- Recibe `branchId` y `period` (today/week/month/year)
- Calcula rango de fechas segun el periodo
- Hace queries a `sales` y `sale_items` filtrados por branch y rango
- Calcula KPIs, datos para graficas y comparaciones con periodo anterior
- Query a `sale_items` con join a `products` para top productos

### 2. Reescribir `src/pages/Dashboard.tsx`

- Importar y usar el nuevo hook
- Selector de periodo con ToggleGroup
- Cards con datos reales y variacion porcentual
- Graficas con componentes de recharts (AreaChart, PieChart, BarChart)
- Usar los componentes ChartContainer, ChartTooltip del archivo chart.tsx existente
- Mantener alertas de stock bajo y acciones rapidas

### 3. No se requieren cambios en App.tsx ni migraciones

La ruta `/` ya apunta a Dashboard. Los datos se obtienen de tablas existentes.

## Detalles tecnicos

### Calculo de periodos

```typescript
// Ejemplo para "today"
const startOfToday = new Date(); startOfToday.setHours(0,0,0,0);
// Para comparacion: ayer
const startOfYesterday = subDays(startOfToday, 1);

// "week": ultimos 7 dias vs 7 dias anteriores
// "month": dia 1 del mes actual vs dia 1 del mes anterior
// "year": dia 1 de enero vs ano anterior
```

### Datos para grafica de ventas por tiempo

```typescript
// Para "hoy": agrupar por hora (0-23)
// Para "semana": agrupar por dia (lun-dom)
// Para "mes": agrupar por dia (1-28/31)
// Para "ano": agrupar por mes (ene-dic)
```

### Query de top productos

```sql
SELECT products.name, SUM(sale_items.quantity) as total_qty
FROM sale_items
JOIN sales ON sales.id = sale_items.sale_id
JOIN products ON products.id = sale_items.product_id
WHERE sales.branch_id = :branch AND sales.created_at >= :start
  AND sales.status = 'completed'
GROUP BY products.name
ORDER BY total_qty DESC LIMIT 5
```

En codigo se hara con el SDK procesando los datos en el cliente ya que Supabase JS no soporta GROUP BY directamente.

### Archivos a crear/modificar

- `src/hooks/useDashboardStats.ts` (nuevo)
- `src/pages/Dashboard.tsx` (reescribir)

### Dependencias

- `recharts` (ya instalado)
- `date-fns` (ya instalado)
- Componentes chart.tsx (ya existen)