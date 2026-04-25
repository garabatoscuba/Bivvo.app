## Diagnóstico

### 1. Error al crear negocio (RLS violation)
La tabla `businesses` **no tiene política INSERT** para usuarios normales. Las políticas existentes son solo:
- SELECT (varias variantes para ver)
- UPDATE (owners)
- DELETE / ALL (solo super_admin)
- **No hay INSERT para usuarios autenticados** → cualquier intento desde `CreateBusinessModal` falla con "new row violates row-level security policy for table businesses".

Mismo problema potencial con `branches` (verificar y agregar si falta).

### 2. Módulos invisibles al usar nombre custom de tipo
Revisé el código:
- **`AppSidebar.tsx`** ya es genérico: lee TODOS los módulos activos de `platform_modules` y solo filtra por plan. **No depende del `business_type` ni de `business_type_configs.module_ids`**. ✓
- Sin embargo, la pestaña **"Tipos de Negocio"** en `/admin/modules` sigue exponiendo configuración (`module_ids` por tipo) que ya no se usa para decidir qué ve cada negocio. Solo se usa en `AdminDashboard` y `BusinessDetailSheet` para mostrar estadísticas/info histórica.
- Lo único que aún depende del nombre concreto `'estaurente/safetería'` es la lógica de Cocina (KDS restaurant). Eso se mantiene como excepción de comportamiento (no de visibilidad de módulos).

Conclusión: la pestaña ya no decide nada operativo. La quitamos del admin tal como pides.

## Cambios

### A. Migración SQL
1. **Crear política INSERT en `public.businesses`** permitiendo a cualquier usuario autenticado insertar SI `owner_id = get_user_profile_id(auth.uid())` (es decir, solo se asigna a sí mismo como dueño).
2. **Asegurar política INSERT en `public.branches`** para que el dueño del negocio pueda crear sucursales (`business_id IN (negocios cuyo owner_id sea el profile del usuario)`). Verificar si ya existe; si no, crearla.
3. No se tocan políticas existentes ni otras tablas.

### B. Admin: quitar pestaña "Tipos de Negocio"
En `src/pages/admin/AdminModules.tsx`:
- Eliminar el `TabsTrigger` "Tipos de Negocio" y su `TabsContent` correspondiente (todo el bloque de gestión de `business_type_configs`).
- Mantener las pestañas: **Módulos**, **Plugins**, **Precios**.
- No borrar la tabla `business_type_configs` (sigue alimentando sugerencias de nombre en `CreateBusinessModal` y `OnboardingWizard`, y stats en AdminDashboard).

### C. Lo que NO se toca
- `CreateBusinessModal` (la lógica está bien, solo falla por RLS).
- `AppSidebar` (ya es genérico).
- Lógica de Cocina/Restaurante (sigue usando `business_type === 'estaurente/safetería'` como caso especial documentado).
- `business_type_configs` como tabla (se conserva para sugerencias y stats).
- POS, Inventario, Caja, Tesorería, Empleados, etc.

## Archivos
- `supabase/migrations/<nuevo>.sql` — políticas INSERT para `businesses` y (si falta) `branches`.
- `src/pages/admin/AdminModules.tsx` — eliminar pestaña "Tipos de Negocio".
