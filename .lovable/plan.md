

## Diagnóstico

### Problema 1 — Hub móvil
En `Hub.tsx` el topbar usa `grid-cols-2` en móvil con el cluster derecho saturado (theme switch ancho + cloud + soporte + avatar). En 360–414px se desborda y rompe el layout.

### Problema 2 — Sidebar en blanco al renombrar tipo
La query `sidebar-modules` ya no filtra por `business_type` (correcto). Pero al guardar el cambio en el modal de edición:
- `updateBizMutation` invalida `user-businesses-with-branches` pero **no recarga** la página ni invalida otras queries cacheadas (`manager-business-type`, `sidebar-modules`).
- El `activeBusiness` se actualiza en cliente, pero queries que dependen de `resolvedBusiness?.business_type` (ej. `isOwnerRestaurant` línea 471) no se reevalúan limpiamente.
- Resultado: el sidebar puede quedar en estado intermedio sin renderizar `businessItems`.

Además, el `useSubscription` puede devolver `loading: true` momentáneamente si `serverNow` no está, y como la query `sidebar-modules` está `enabled: !!planType`, mientras `planType` no esté disponible no carga módulos. Al recargar la página tras editar, esto se nota más.

## Cambios

### 1. `src/pages/Hub.tsx` — topbar móvil compacto
- En móvil (`< sm` = 640px) reducir el cluster derecho:
  - **Theme switch**: en móvil mostrar solo el icono (sun/moon) sin el toggle pill. El pill solo desde `sm:`.
  - Quitar el divider entre cloud/soporte y avatar en móvil (ya está `hidden sm:block`, OK).
  - Reducir `gap` del cluster de `gap-1` a `gap-0.5` en móvil.
- Mantener el avatar siempre visible (sin nombre en móvil, ya está `hidden sm:inline`).
- Layout: cambiar `grid-cols-2` por `flex items-center justify-between` en móvil para mejor distribución, y mantener el grid `md:grid-cols-[1fr_2fr_1fr]` desde `md:`.
- Search siempre debajo en móvil (ya está `col-span-2`), conservar comportamiento.

### 2. `src/components/layout/AppSidebar.tsx` — refresh tras editar tipo
- En `updateBizMutation.onSuccess` (línea 236) invalidar también:
  - `["sidebar-modules"]`
  - `["manager-business-type"]`
  - `["app-sidebar-employee-session-record"]`
- Tras guardar, hacer `window.location.reload()` (igual que `switchBusiness`) para garantizar que toda la cadena de queries y el contexto auth se reevalúen con el nuevo `business_type`. Es la solución más robusta y consistente con el patrón ya usado en el archivo.

### 3. Helper de etiqueta (opcional, mejora visual)
- En `AppSidebar.tsx` extraer las cadenas ternarias de `business_type → label` (líneas 747-755 y 793-801) a un helper local `formatBusinessTypeLabel(type)`. Si el tipo no coincide con un key conocido, retornar el string capitalizado tal cual. Sin cambios funcionales — solo limpieza.

## Lo que NO se toca
- Lógica de módulos por plan (ya genérica, correcta).
- KDS/Cocina (sigue dependiendo de `estaurente/safetería` exacto — regla irrompible).
- Roles, jornada, POS, inventario.
- Tabla `business_type_configs` ni schemas.

## Archivos
- `src/pages/Hub.tsx` (topbar móvil).
- `src/components/layout/AppSidebar.tsx` (invalidación + reload tras editar tipo, helper de label).

