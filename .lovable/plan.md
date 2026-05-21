# Reorganizar Sidebar

## Cambios

1. **Quitar bloque de usuario del footer** (Avatar + nombre + email + sucursal). El `SidebarFooter` queda vacío y se elimina del componente.

2. **Nueva sección después de Portal**, separada por una línea elegante (`Separator`):
   - Descargar App (solo si `!isInstalled`)
   - Planes
   - Configuración

   Se renderiza como un `SidebarGroup` final, justo después del módulo Portal/sección Partner, con un `Separator` arriba para crear la división visual limpia.

3. **Header del sidebar**: quitar los botones-icono de Settings (engranaje) y Planes (tarjeta). En su lugar va el **toggle de modo oscuro** (icono Sol/Luna) como `Button ghost icon`. El logo se mantiene a la izquierda.

4. Eliminar el `Switch` de modo oscuro del footer (ya queda arriba como icono).

## Archivo

- `src/components/layout/AppSidebar.tsx`
  - Header (líneas ~581-595): reemplazar los dos botones por un único botón con `Sun`/`Moon` que alterna tema.
  - Bloque `Descargar App` existente (líneas ~999-1014): mover dentro del nuevo grupo unificado.
  - Nuevo `SidebarGroup` con `Separator` arriba y 3 items: Descargar App, Planes (`/plans`), Configuración (`/settings`).
  - `SidebarFooter` (líneas ~1018-1052): eliminar completo.

Los cambios aplican a todas las vistas (Dueño, Gerente, Vendedor, Operario, Cocina, SuperAdmin, Partner) ya que el footer y header son compartidos.
