
## Plan: simplificar menú de usuario en Hub y mover Perfil a modal flotante

### Contexto
En el header del Hub (imagen 1) el dropdown del avatar muestra: Mi perfil, Configuración, Cerrar sesión. Hoy "Mi perfil" / "Configuración" llevan a `/settings`, que está envuelto en `AppLayout` → renderiza el sidebar con módulos del negocio. Eso confunde cuando se accede desde el Hub.

Quiero:
1. Dejar SOLO **Perfil** y **Cerrar sesión** en el dropdown del Hub.
2. **Perfil** no navega — abre un **modal flotante** con el mismo contenido de `Settings.tsx` (Perfil + Seguridad), **sin** el bloque "Gestión de Datos" (ese es de negocio).

### Hallazgos clave
- El dropdown del avatar está en `src/components/layout/AppHeader.tsx` (lo usan tanto Hub como AppLayout). Debo confirmar si el Hub usa `AppHeader` o tiene su propio header — voy a revisar `Hub.tsx` y el header que se ve en la imagen.
- `Settings.tsx` ya tiene `ProfileSection` y `SecuritySection` como componentes locales en el mismo archivo + `<DataManagement />` (este último solo si `isOwner`).
- Necesito extraer Perfil + Seguridad a un modal reutilizable **sin tocar** `Settings.tsx` (la ruta `/settings` sigue existiendo igual para quien la use desde el AppLayout del negocio).

### Cambios

**1. Nuevo componente `src/components/hub/ProfileModal.tsx`**
- `Dialog` de shadcn, estilo Bivoo (mismo look que `CreateBusinessModal`).
- Tabs internos: **Perfil** | **Seguridad** (mismos íconos `User` / `Shield`).
- Reimplementa el contenido de `ProfileSection` y `SecuritySection` de `Settings.tsx` (copy/paste de la lógica: nombre, email, displayName, teléfono, cambio de contraseña con toggles de visibilidad).
- **No incluye** `DataManagement`.
- Header fijo + scroll interno (regla de modales móvil).

**2. Editar el header del Hub (probablemente `AppHeader.tsx` con un flag `isHub`, o un header propio del Hub)**
- Detectar si estamos en contexto Hub (ruta `/`) o pasar prop.
- En el dropdown del avatar, cuando es Hub, mostrar SOLO:
  - **Perfil** → abre `ProfileModal` (no navega)
  - **Cerrar sesión** → comportamiento actual
- Eliminar la entrada "Configuración" y la duplicación Mi perfil/Configuración en ese contexto.
- Fuera del Hub (dentro de un negocio en `AppLayout`), **no toco nada** — el menú actual sigue igual.

### Lo que NO se toca
- `src/pages/Settings.tsx` (ruta `/settings` sigue funcionando para el contexto de negocio).
- `DataManagement.tsx`.
- Sidebar, AppLayout, rutas, auth.
- Otros menús o headers.

### Archivos
- **Nuevo**: `src/components/hub/ProfileModal.tsx`
- **Editar**: el header que muestra ese dropdown en el Hub (lo confirmaré al implementar — `AppHeader.tsx` o el header propio del Hub).
