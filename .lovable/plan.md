

## Problema
Al permitir nombre libre de tipo de negocio (ej "Local del Tecnología"), el sidebar se queda en blanco porque la resolución de módulos depende de `business_type_configs.module_ids` filtrando por `key` exacto. Si el `business_type` no coincide con `store`/`estaurente/safetería`/`copy_shop`/`gym`, no encuentra módulos y no renderiza nada.

Además, en el admin (segunda imagen) cada módulo tiene checkboxes "Tipos de negocio" para limitar dónde aparece. Esto ya no tiene sentido si Bivoo es genérico.

## Decisión
Bivoo pasa a ser **genérico**: todos los módulos disponibles para todos los negocios (sujeto a plan, rol y país). El `business_type` queda solo como **etiqueta visual**.

## Cambios

### 1. Resolución de módulos (sidebar)
Localizar la query en `AppSidebar.tsx` (o hook relacionado) que hace `business_type_configs → module_ids → platform_modules`. Reemplazar por:
- Cargar **todos** los `platform_modules` activos directamente.
- Filtrar por `module_plugin_pricing` según plan del negocio (excluir `unavailable`/`not_available`).
- Mantener filtros por rol, país y jornada (sin tocar esa lógica).

Esto garantiza que el sidebar funcione con cualquier `business_type`, incluido el legacy `estaurente/safetería`.

### 2. Admin de módulos (`AdminModules`)
- Ocultar la sección "Tipos de negocio" del editor de módulo (segunda imagen) — ya no se usa para filtrar.
- Mantener: Ícono, Nombre, Descripción, País, Asignación específica, configuración por plan.
- No borrar la columna `business_type_keys` en BD (regla irrompible: solo añadir). Solo dejar de leerla/escribirla desde la UI.

### 3. Compatibilidad legacy
- `estaurente/safetería` sigue activando KDS/Cocina (regla irrompible). Esa lógica vive en otros lugares (Pedidos, kitchen_orders) y se mantiene intacta — solo aplica si el `business_type` es exactamente ese key.
- Otros módulos especiales por tipo (ej. inventario por área) se mantienen igual; solo cambia la **lista base de módulos visibles**.

## Archivos
- `src/components/layout/AppSidebar.tsx` (resolución de módulos).
- Hook de módulos si existe separado (a confirmar al explorar).
- `src/pages/admin/AdminModules.tsx` (ocultar selector de tipos de negocio).

## Lo que NO se toca
- Tablas BD (no borrar columnas).
- Lógica KDS/Cocina/restaurante.
- Roles, jornada, POS, inventario, planes.
- Filtros por país y plan.

