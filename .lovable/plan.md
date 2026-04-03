

## Plan: Filtrar conteo de caja según modalidad de nómina

### Problema

Cuando hay 2 empleados con modalidad **Mixto Personalizado** (`custom_mixed`), el ingreso se reparte entre ambos. Pero `CashCalculator` muestra TODAS las ventas de la sucursal como "efectivo esperado", así que si el Empleado A solo tiene su propio efectivo, las ventas del Empleado B aparecen como faltante o sobrante falso.

**La regla es:**
- **Mixto Personalizado (`custom_mixed`)**: Las ventas se fusionan — ver TODAS las ventas de la sucursal (el conteo es compartido)
- **Cualquier otra modalidad** (fijo, por hora, % individual, etc.): Filtrar solo las ventas del propio empleado (`user_id`)

### Cambios

#### 1. `src/components/cobro/CashCalculator.tsx` — Agregar prop y lógica de filtrado

- Agregar nueva prop opcional `employeeModalityType?: string`
- Agregar `userId` desde `useAuth` (ya existe `profile`)
- Lógica de filtrado:
  - Si `employeeModalityType === 'custom_mixed'`: mantener queries actuales sin filtro por user (todas las ventas de la sucursal)
  - Si es cualquier otra modalidad O no se pasa la prop: agregar `.eq('user_id', userId)` a las queries de `sales` y `service_entries`
- Actualizar `queryKey` para incluir modalidad y userId

#### 2. `src/components/employees/ContarYCerrarModal.tsx` — Pasar modalidad al CashCalculator

- Agregar nueva prop `employeeModalityType?: string` al modal
- Pasarla a `<CashCalculator employeeModalityType={employeeModalityType} />`

#### 3. `src/pages/MyEmployment.tsx` — Obtener y pasar la modalidad

- Del query existente de `employee_salary_assignments` + `salary_modalities`, extraer el `modality_type`
- Pasarlo como prop `employeeModalityType` a `ContarYCerrarModal`

### Resultado

```text
MIXTO PERSONALIZADO (custom_mixed):
  Ambos empleados ven TODAS las ventas de la sucursal
  El "efectivo esperado" es el total de la sucursal
  El conteo de caja es compartido (deben contar juntos o uno cuenta todo)
  Propinas = lo que sobra del total de la sucursal

CUALQUIER OTRA MODALIDAD:
  Cada empleado ve SOLO sus ventas
  "Efectivo esperado" = solo lo que ese empleado cobró en efectivo
  Propinas = solo lo que le sobra a ese empleado
```

### Archivos a modificar
- `src/components/cobro/CashCalculator.tsx`
- `src/components/employees/ContarYCerrarModal.tsx`
- `src/pages/MyEmployment.tsx`

### Lo que NO se toca
- No se modifican tablas, auth, POS, inventario, sidebar ni nómina

