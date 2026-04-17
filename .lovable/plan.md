
## Plan: Logo de Bivoo unificado en portal público + consistencia con Hub y Sidebar

### Estado actual
- **Sidebar** (`AppSidebar.tsx` línea 552-553): logo imagen `/logo-light.png` o `/logo-dark.png`, `h-6`, esquina superior izquierda, link a `/` (Hub).
- **Hub** (`Hub.tsx` línea 152-157): logo de **texto** "Bivoo" en DM_Sans, esquina superior izquierda. **No coincide visualmente con el sidebar.**
- **Portal público** (`StorefrontNavbar.tsx` línea 61-75): muestra logo + nombre del **negocio** a la izquierda. No hay logo de Bivoo en ningún lado.

### Cambios

**1. Portal público — `StorefrontNavbar.tsx`**
- **Esquina superior izquierda**: agregar logo pequeño de Bivoo (`/logo-light.png` / `/logo-dark.png`, `h-6 w-auto`), envuelto en un `<a href="/">` que lleva al Hub. Title: "Volver a Bivoo".
  - Como la navbar tiene fondo oscuro semi-transparente (texto blanco), usar siempre `/logo-dark.png` (versión clara sobre oscuro) para que se vea bien independiente del tema.
- **Centro**: mover el nombre + logo del negocio al centro de la barra (donde hoy están los tabs Home/Productos/Contacto).
- **Tabs Home/Productos/Contacto**: moverlos a la derecha junto a los iconos, o reducirlos. Para mantener jerarquía: el nombre del negocio queda centrado y los tabs justo debajo o como parte del cluster derecho compacto. → **Opción más limpia**: nombre del negocio centrado, tabs absorbidos en el menú móvil siempre, y en desktop se muestran como una fila secundaria pequeña debajo del nombre o junto a los iconos derechos.
  - **Decisión**: nombre del negocio centrado (text-sm font-bold). Tabs desktop se mantienen pero en el cluster derecho, antes de los iconos, como links discretos. Esto deja: `[Bivoo logo]  ...  [Nombre negocio]  ...  [tabs] [icons]`.
- **Hero**: no se toca. El nombre grande del negocio en el hero ya existe en `StorefrontHome`.

**2. Hub — `Hub.tsx` (línea 150-157)**
- Reemplazar el texto "Bivoo" por la misma imagen de logo que usa el sidebar:
  ```tsx
  <img src={isDark ? "/logo-dark.png" : "/logo-light.png"} alt="Bivoo" className="h-6 w-auto cursor-pointer" />
  ```
- Mantener el `onClick` para volver al top.
- Esto garantiza que **Hub, Sidebar y Portal** muestren exactamente el mismo logo, mismo tamaño (`h-6`), misma posición (esquina superior izquierda).

**3. Posición consistente**
- Todos: `flex items-center`, padding-left equivalente (sidebar: `p-4`, Hub: `px-10`, Portal: `px-4 sm:px-10`). El logo siempre es el primer elemento del header/nav.

### Lo que NO se toca
- Hero del portal, catálogo, contacto, footer, carrito, popups.
- Tabs internos del portal (solo se reposicionan visualmente).
- Resto del Hub (stats, editorial, dropdowns, etc.).
- Sidebar (ya está correcto, solo se confirma como referencia).
- Auth, módulos, rutas.

### Archivos
- `src/components/storefront/StorefrontNavbar.tsx`
- `src/pages/Hub.tsx` (solo el bloque del logo, líneas 152-157)
