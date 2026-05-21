# Plan: Rediseño de EasyTopbar en Dashboard

## Cambios en `src/components/dashboard/easy/EasyTopbar.tsx`

1. **Importar `SidebarTrigger`** desde `@/components/ui/sidebar` para poder abrir la sidebar desde la top bar del easy dashboard.

2. **Quitar el nombre del negocio de la ruta.** Actualmente se muestra `{businessName} / Dashboard`. Se cambiará para que solo muestre `Dashboard` directamente.

3. **Agregar botón de abrir sidebar antes del título.** Colocar un `SidebarTrigger` a la izquierda del texto "Dashboard", ya que en esta vista el `AppHeader` está oculto (`hideHeader`) y no hay otra forma de abrir la sidebar.

4. **En móvil: solo icono de soporte.** Ocultar los botones de sincronización (nube) y escáner en vista móvil (`sm:hidden`), dejando únicamente el icono de WhatsApp/Soporte. El texto "Soporte" también se oculta en móvil (`hidden sm:inline`), mostrando solo el icono.

## Archivos afectados
- `src/components/dashboard/easy/EasyTopbar.tsx`
