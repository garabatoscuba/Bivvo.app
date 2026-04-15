

## Plan: Arreglar cancelaciones de ventas POS y servicios

### Problemas identificados

1. **Empleados (vendedores) no pueden cancelar**: Las políticas RLS de `sales` solo permiten UPDATE a `owner`/`manager`. La tabla `service_entries` tiene la misma restricción. Los vendedores están excluidos del UPDATE.

2. **Stock no se revierte en POS (para dueño/empleado)**: El trigger `restore_stock_on_cancel` existe y está activo en la tabla `sales`. Si el dueño cancela y el estado no cambia a 'cancelled', hay un problema de RLS o del trigger. Revisando el trigger, la lógica parece correcta — actualiza `branch_stock` y crea `inventory_movements` de tipo 'return'. Es posible que el problema sea que el `cancelSale` en `useSales.ts` hace un cast incorrecto (`status: 'cancelled' as const`) que podría no coincidir con el enum. Verificaré y corregiré.

3. **Servicios cancelados no revierten insumos ni registran devolución**: El trigger `deduct_service_recipe_ingredients` descuenta insumos al crear un `service_entry`, pero no existe un trigger inverso para restaurarlos al cancelar. Hay que crear uno.

### Cambios

**1. Migración de base de datos**

- **RLS `sales`**: Agregar política UPDATE para vendedores (`seller` role) que pertenezcan al negocio, permitiendo solo cambiar el status a 'cancelled'.
- **RLS `service_entries`**: Agregar política UPDATE para vendedores del negocio.
- **Trigger `restore_service_ingredients_on_cancel`**: Crear trigger en `service_entries` que al cambiar status a 'cancelled' devuelva los insumos descontados por `deduct_service_recipe_ingredients` (usando la misma lógica inversa: incrementar `raw_materials.stock_vendedor`).

**2. `src/hooks/useSales.ts`**
- En `cancelSale.mutationFn`, quitar el cast `as const` / `as any` y asegurar que el valor 'cancelled' se envía correctamente al update.

**3. Sin cambios en**
- `Sales.tsx` (el botón de cancelar ya aparece correctamente para `canCancel` que incluye `isSeller`)
- POS, inventario, ni ningún otro módulo

### Detalle técnico

```text
Problema actual:
  Vendedor → UPDATE sales → RLS DENY (solo owner/manager)
  Dueño → cancela servicio → status='cancelled' → insumos NO se devuelven

Solución:
  1. RLS: permitir seller UPDATE en sales y service_entries
  2. Trigger: restore_service_ingredients_on_cancel en service_entries
  3. Verificar que el trigger existente restore_stock_on_cancel funciona
```

