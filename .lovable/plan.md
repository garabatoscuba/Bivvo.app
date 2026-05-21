# Ajustes vista móvil del Dashboard

## 1. Filtro de período al ancho de las tarjetas

En `EasyDashboard.tsx` el header con saludo + `EasyPeriodFilter` está dentro del contenedor padded (`px-3 sm:px-10`), pero el `EasyPeriodFilter` es `inline-flex` y queda corto. En móvil debe ocupar todo el ancho disponible (igual que las KPI cards de abajo), sin pasarse de los márgenes laterales.

- En `EasyPeriodFilter.tsx`: hacer el contenedor `flex w-full sm:inline-flex sm:w-auto`, y los botones `flex-1 sm:flex-none` para que se repartan equitativamente en móvil y mantengan el tamaño compacto en desktop.

## 2. Top bar auto-hide en móvil (scroll up muestra, scroll down oculta)

En `EasyTopbar.tsx` la barra es `sticky top-0`. Añadir comportamiento de auto-hide solo en móvil:

- Hook interno con `useEffect` que escucha `window.scroll`, compara `scrollY` con el valor previo, y togglea un estado `hidden`.
- Umbral pequeño (≈8px) para evitar parpadeos, y siempre visible cerca del top (scrollY < 40).
- Aplicar `translate-y-[-100%]` cuando `hidden && scrollingDown`, con `transition-transform duration-300`.
- Solo activo en móvil (`sm:translate-y-0` para anular en ≥640px) o gateado por `window.innerWidth < 640`.

## 3. Botones de la top bar en móvil

Hoy en móvil solo se ve el icono de soporte. Pedido:

- Mostrar **nube** (sync) en móvil (quitar `hidden sm:inline-flex`).
- Mostrar **cámara** (escáner) en móvil (quitar `hidden sm:inline-flex`).
- Mantener **soporte** (WhatsApp).
- Añadir un **botón de perfil** al final, idéntico en estilo al del Hub: avatar circular con iniciales, dropdown con nombre/email, opción "Perfil" (abre `ProfileModal` del Hub) y "Cerrar sesión" (`signOut` de `AuthContext`).
- Orden final: `[SidebarTrigger] [Dashboard]  ...  [Nube] [Cámara] [Soporte] [Perfil ▾]`.

## 4. Quitar "Cerrar sesión" de la sidebar

En `AppSidebar.tsx` (línea ~1051) hay un botón ghost con `signOut`. Eliminar ese botón (y label asociado si queda huérfano) — el cierre de sesión vivirá solo en el menú de perfil de la top bar.

## Archivos afectados

- `src/components/dashboard/easy/EasyPeriodFilter.tsx` — filtro full-width en móvil.
- `src/components/dashboard/easy/EasyTopbar.tsx` — auto-hide on scroll, mostrar nube/cámara en móvil, añadir dropdown de perfil.
- `src/components/layout/AppSidebar.tsx` — quitar botón "Cerrar sesión".
- Reutiliza `ProfileModal` de `@/components/hub/ProfileModal` y `signOut` de `useAuth`.
