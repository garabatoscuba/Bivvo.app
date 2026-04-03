

## Plan: Mejorar tarjeta "Ventas del día" con desglose personal vs sucursal

### Cambio

En `src/components/employees/MyEmploymentDashboard.tsx`, modificar la tarjeta "Ventas del día" (líneas 280-304) para mostrar:

1. **Total sucursal** (como ahora): `$6,000.00` con el desglose por tipo (productos/servicios/impresiones)
2. **Venta personal** debajo: una línea separada que muestre cuánto de ese total hizo el empleado, usando `dailySalary.todaySalesTotal + dailySalary.todayServiceTotal + dailySalary.todayPrintTotal`
3. Si la venta personal es igual al total (solo 1 empleado), no mostrar la línea de sucursal por separado

Los datos ya existen en el hook `useDailySalary`:
- `todaySalesTotal` = ventas de productos del empleado
- `todayServiceTotal` = servicios del empleado
- `todayPrintTotal` = impresiones del empleado

### Diseño de la tarjeta

```text
┌─────────────────────────────────┐
│ 🛒 Ventas del día               │
│ $6,000.00          ← sucursal   │
│ 📦 $3000  🔧 $3000              │
│ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─   │
│ 👤 Tu aporte: $3,000.00         │
│    📦 $2000  🔧 $1000           │
└─────────────────────────────────┘
```

### Archivo a modificar
- `src/components/employees/MyEmploymentDashboard.tsx` (líneas 279-304)

### Lo que NO se toca
- `useDailySalary.ts` (los datos ya están)
- Tarjeta de salario, POS, inventario, nómina

