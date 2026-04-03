

## Plan: Corregir cálculo de salario Mixto Personalizado y unificar tarjetas

### Problema encontrado

En `useDailySalary.ts`, la modalidad `custom_mixed` calcula:
```
earning = ingresosSucursal * (33 / 100) = $3,016.20
```
Pero **NO divide entre los trabajadores activos**. La UI muestra "33% ÷ 2" pero el cálculo real no divide. El resultado correcto debería ser $3,016.20 / 2 = **$1,508.10** por empleado.

### Cambios

#### 1. `src/hooks/useDailySalary.ts` — Corregir cálculo custom_mixed

Línea 338, cambiar:
```typescript
earning += getSharedApplicableIncome(appliesTo) * (servicePercent / 100);
```
A:
```typescript
earning += (getSharedApplicableIncome(appliesTo) * (servicePercent / 100)) / activeWorkersCount;
```

Esto aplica para `custom_mixed` porque es un esquema compartido donde los ingresos de la sucursal se reparten entre los trabajadores activos.

#### 2. `src/components/employees/MyEmploymentDashboard.tsx` — Unificar tarjetas

Fusionar la tarjeta "Salario estimado" (líneas 306-327) y la tarjeta "Salary breakdown" (líneas 330-369) en **una sola tarjeta**:

```text
┌─────────────────────────────────┐
│ $ Salario estimado              │
│   $1,508.10          (verde)    │
│   Mixto Personalizado           │
│ ────────────────────────────── │
│ % Ingresos (33% ÷ 2)  $1508.10 │
│ Comisiones                $0.00 │
│ Propinas                  $0.00 │
│ ─────────────────────────────── │
│ Total               $1,508.10   │
└─────────────────────────────────┘
```

La tarjeta de "Ventas del día" queda sola ocupando todo el ancho, y debajo la tarjeta unificada de salario con el desglose integrado.

### Lo que NO se toca
- Auth, POS, inventario, sidebar, empleados, contabilidad
- Las demás modalidades (fixed, hourly, etc.) no usan división compartida

