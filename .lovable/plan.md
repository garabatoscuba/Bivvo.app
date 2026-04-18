

## Plan: tipo de negocio configurable al crear y editar

### Diagnóstico
1. **Causa raíz**: en la tabla `business_type_configs` solo `store` está `is_active=true`. Restaurante, Punto de Copias y Gimnasio están desactivados → en cualquier selector de tipo solo aparece "Tienda". Por eso todos los negocios terminan siendo tiendas.
2. El selector de tipo ya existe en `OnboardingWizard` y `CreateBusinessModal`, pero al filtrar por `is_active=true` sale una sola opción.
3. **Edición**: el modal "Configurar Negocio" del Sidebar (`AppSidebar.tsx` líneas 1056-1080) y el `updateBizMutation` (líneas 229-242) solo permiten editar el nombre. No hay forma de cambiar `business_type` después.

### Cambios

**1. Activar todos los tipos (migración SQL)**
- `UPDATE business_type_configs SET is_active = true` para los 4 tipos.
- Renombrar etiquetas más limpias: "Tienda", "Restaurante / Cafetería", "Punto de Copias", "Gimnasio".
- Mantener `key` intactos (incluido el legacy `estaurente/safetería` por compatibilidad — regla irrompible).

**2. Editar negocio → añadir selector de tipo (`AppSidebar.tsx`)**
- En el state local agregar `editBizType`.
- En `openEditBiz(biz)` precargar `editBizType = biz.business_type`.
- En el dialog "Configurar Negocio" añadir un `<select>` igual al de "Nuevo Negocio", alimentado por `availableBusinessTypes` (ya existe).
- En `updateBizMutation` aceptar también `business_type` y enviarlo al `update` de la tabla `businesses`.
- Mantener resto del comportamiento (cierra modal, invalida queries).

**3. Crear negocio (Hub) — `CreateBusinessModal.tsx`**
- Ya tiene selector funcional; con la migración aparecerán las 4 opciones automáticamente. No requiere cambios.

**4. Onboarding inicial — `OnboardingWizard.tsx`**
- Ya muestra el selector dinámico desde `business_type_configs`. Con la migración aparecerán los 4 tipos. No requiere cambios de código.
- Verificar que el filtro por país (línea 120) no oculte tipos: actualmente `copy_shop` está marcado `country='cuba'`, lo dejamos así (solo aparece si el usuario eligió Cuba), el resto sin restricción.

### Lo que NO se toca
- Lógica de roles, módulos por tipo, auth, POS, inventario.
- `key` legacy `estaurente/safetería` (no se renombra, regla irrompible).
- Sidebar etiquetas de tipo (líneas 750-806) — ya tienen mapping para los 4 tipos.

### Archivos
- Migración SQL: activar los 4 tipos + actualizar nombres visibles.
- `src/components/layout/AppSidebar.tsx`: añadir selector de tipo en modal de edición y al `updateBizMutation`.

