

## Plan: Completar Reset de datos + Crear área "Uso Interno" faltante

### Tres problemas identificados

1. **Reset Completo** no borra: `service_entries`, `kitchen_orders`, `print_jobs`/`print_job_items`, `print_ink_usage`, `print_active_sheets`, `print_shrinkage`, `raw_material_entries`, `raw_material_transfers`, `inventory_counts` (la tabla sí existe pero el delete falla silenciosamente)
2. **Cerrar Período** solo archiva 5 tablas (`sales`, `cash_register_movements`, `treasury_movements`, `jornadas`, `daily_reports`) — le falta `service_entries` y otros registros operativos. Además, varias tablas NO tienen columna `archived`, así que el update falla silenciosamente.
3. **Área "Uso Interno"** no existe para negocios creados antes de que se implementara. El negocio "visionlahabana" solo tiene "Cocina" sin área interna.

---

### Cambios

#### 1. Migración: agregar columna `archived` a `service_entries`
Para que el cierre de período pueda archivar servicios.

```sql
ALTER TABLE service_entries ADD COLUMN IF NOT EXISTS archived boolean DEFAULT false;
ALTER TABLE service_entries ADD COLUMN IF NOT EXISTS archived_at timestamptz;
```

#### 2. Migración: crear área "Uso Interno" para negocios que no la tienen
```sql
INSERT INTO insumo_areas (business_id, name, icon, color, is_internal)
SELECT b.id, 'Uso Interno', 'Home', 'primary', true
FROM businesses b
WHERE NOT EXISTS (
  SELECT 1 FROM insumo_areas ia 
  WHERE ia.business_id = b.id AND ia.is_internal = true
);
```

#### 3. `supabase/functions/reset-business-data/index.ts` — Agregar tablas faltantes
Agregar borrado de:
- `service_entries` (by business_id)
- `kitchen_orders` (by business_id)  
- `print_job_items` (via print_jobs.id)
- `print_jobs` (by business_id)
- `print_ink_usage` (by business_id)
- `print_active_sheets` (by branch_id)
- `print_shrinkage` (by business_id)
- `raw_material_entries` (by business_id)
- `raw_material_transfers` (by business_id)

Orden: borrar hijos antes que padres (print_job_items antes de print_jobs).

**NO borra**: employees, products, raw_materials, branches, businesses, insumo_areas, salary_modalities, salary_modality_presets, employee_salary_assignments, cash_register_config, recipes, recipe_ingredients, categories, service_categories, service_cost_ingredients, print_service_types, print_material_types, print_printers.

#### 4. `src/components/settings/DataManagement.tsx` — Cerrar Período
Agregar `service_entries` a la lista de `archiveTables` para que los cobros de servicios también se archiven.

### Lo que NO se toca
- Auth, POS, inventario, sidebar, nómina, empleados, contabilidad
- La UI de áreas ya protege "Uso Interno" de edición/borrado (línea 599 verifica `!isInternal`)
