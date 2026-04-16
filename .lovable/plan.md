

## Plan: Hacer visible la sección "Explorar en Bivoo" — fix de permisos RLS

### Problema
Las tablas `store_settings`, `branches` y `businesses` tienen políticas RLS que solo permiten leer datos del propio negocio del usuario. Cuando el componente `HubSearchAndExplore` consulta negocios con portal activo, las filas de otros negocios son filtradas por RLS y el resultado queda vacío.

### Solución
Agregar políticas RLS de lectura pública (para usuarios autenticados) que permitan descubrir negocios con portales activos. Solo lectura, solo los campos necesarios para el directorio.

### Cambios

**1. Migración SQL — 3 nuevas políticas RLS**

- **`store_settings`**: Permitir SELECT a usuarios autenticados donde `is_active = true` (solo pueden ver portales activos).
- **`branches`**: Permitir SELECT a usuarios autenticados para sucursales que tengan un `store_settings` con `is_active = true` (necesario para resolver el `business_id` y `address`).
- **`businesses`**: Permitir SELECT a usuarios autenticados para negocios que tengan al menos una sucursal con portal activo (`is_active = true` en `store_settings`).

```sql
-- Allow authenticated users to discover active storefronts
CREATE POLICY "Anyone can view active store settings"
ON public.store_settings FOR SELECT TO authenticated
USING (is_active = true);

-- Allow authenticated users to view branches that have an active storefront
CREATE POLICY "Anyone can view branches with active storefront"
ON public.branches FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.store_settings ss
    WHERE ss.branch_id = branches.id AND ss.is_active = true
  )
);

-- Allow authenticated users to view businesses that have an active storefront
CREATE POLICY "Anyone can view businesses with active storefront"
ON public.businesses FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.branches br
    JOIN public.store_settings ss ON ss.branch_id = br.id
    WHERE br.business_id = businesses.id AND ss.is_active = true
  )
);
```

**2. Sin cambios en código frontend**
El componente `HubSearchAndExplore.tsx` ya tiene las queries correctas. Una vez que RLS permita la lectura, los negocios aparecerán automáticamente.

### Qué NO se toca
- Ningún archivo de código frontend
- Ninguna otra tabla ni política existente
- Ningún otro flujo del hub

### Seguridad
- Las políticas solo exponen datos de negocios que han activado su portal público voluntariamente (`is_active = true`)
- Solo lectura (SELECT), no permiten modificaciones
- Solo para usuarios autenticados

