
## Plan: limpiar tarjetas del Hub + selector de negocio cuando hay varios

### Cambios en `src/pages/Hub.tsx`

**1. Tarjetas condicionales (líneas 248-270)**
Hoy siempre se renderizan las 3 tarjetas (Mis negocios, Mi empleo, Mis puntos). Cambio:

- **Mis negocios**: 
  - Si `ownedBusinesses.length === 0` → tarjeta "Agregar negocio" (estilo dashed/CTA, abre `setCreateBizOpen(true)`).
  - Si hay 1+ → tarjeta normal con conteo y alertas.
- **Mi empleo**: solo renderizar si `employments.length > 0`. Si es 0, nada.
- **Mis puntos / afiliaciones**: solo renderizar si `affiliations.length > 0`. Si es 0, nada.

El contenedor `flex gap-2` se mantiene; simplemente filtra hijos.

**2. Selector de negocio al click en "Mis negocios"**
Lógica nueva en el click handler de la tarjeta de negocios:

- `ownedBusinesses.length === 0` → abrir modal crear negocio (caso ya cubierto por la tarjeta CTA).
- `ownedBusinesses.length === 1` → comportamiento actual: si el negocio activo en el perfil ya es ese, navegar `/dashboard`; si no, hacer `switchBusiness` (cambiar `profiles.business_id` + `branch_id` al main) y luego navegar a `/dashboard`.
- `ownedBusinesses.length > 1` → abrir un nuevo modal **`BusinessSelectorModal`** con la lista de negocios del usuario. Click en uno → mismo `switchBusiness` y navegar a `/dashboard`.

**3. Datos para el selector**
La query `hub-owned-stat` hoy solo trae `id`. Ampliar el `select` a `id, name, business_type, base_currency` (los datos del negocio mismos no cambian la lógica de alertas; las alertas se siguen agregando) para mostrar nombre/tipo en el selector. Mantener compatibilidad: el conteo y `ownedAlerts` siguen igual.

### Componente nuevo: `src/components/hub/BusinessSelectorModal.tsx`

- Dialog simple, mismo estilo que `CreateBusinessModal` (header + lista vertical).
- Cada item: avatar/letra + nombre + tipo de negocio + chip "Activo" si coincide con `profile.business_id`.
- Botón inferior "Crear nuevo negocio" que cierra este modal y abre `CreateBusinessModal`.
- Al seleccionar: 
  ```ts
  // Buscar main branch del biz, actualizar profile, recargar y navegar.
  await supabase.from("branches").select("id").eq("business_id", bizId).eq("is_main", true).limit(1)
  await supabase.from("profiles").update({ business_id, branch_id }).eq("user_id", profile.user_id)
  navigate("/dashboard"); // y forzar refresh de auth context si hace falta
  ```
  (Reutilizar la misma lógica que `switchBusiness` del sidebar, en una helper local del Hub, evitando duplicar.)

### Lo que NO se toca
- Lógica de auth, roles, permisos.
- Sidebar, AppLayout, ruta `/dashboard`, ruta `/mi-empleo`.
- HubEditorial, CreateBusinessModal, ProfileModal.
- Queries de empleos y afiliaciones (solo cambia su renderizado).
- Estilos globales del Hub (clases `hub-stat`, etc.). Se reutilizan.

### Archivos
- **Editar**: `src/pages/Hub.tsx` (bloque de tarjetas + handler + query select ampliado + import del nuevo modal).
- **Nuevo**: `src/components/hub/BusinessSelectorModal.tsx`.
