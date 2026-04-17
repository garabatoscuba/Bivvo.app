

## Plan: hacer responsive el Hub para móvil/PWA

### Diagnóstico
El Hub está hecho 100% para desktop. En móvil:
- Topbar usa `grid-cols-[1fr_2fr_1fr]` + `px-10` → el bloque de acciones (cloud, soporte, divider, avatar+nombre+chevron) no cabe y empuja la grid, rompe layout.
- Hero usa `flex items-center justify-between` con `<h1>` de 46px + tarjetas stat al lado → no cabe, se desborda u ocupa pantalla entera.
- `HubEditorial` y `HubSearchAndExplore` tampoco están adaptados (paddings grandes).

No es un crash de JS, es un layout que no entra. Para móvil hay que **reflujar a una columna** y **encoger** padding/tipografía.

### Cambios

**1. `src/pages/Hub.tsx` topbar (línea 265)**
- En móvil: `flex items-center justify-between` (logo a la izq, acciones compactas a la dcha), search baja a una segunda fila debajo.
- En `md+`: mantener el grid actual.
- Reducir padding: `px-4 md:px-10`.
- Acciones móvil: ocultar nombre del usuario (`hidden sm:inline`) y el `divider`; mantener avatar, cloud, soporte.
- Search: en móvil ocupa fila completa debajo del topbar (dentro del mismo contenedor sticky para que se oculte junto con la barra).

**2. Hero row (línea 414)**
- `flex-col md:flex-row`, `items-start md:items-center`, `gap-4`, `px-4 md:px-10`, `pt-5 md:pt-8`.
- Heading: `text-[32px] md:text-[46px]`.
- Stats: contenedor `w-full md:w-auto` con `grid grid-cols-3 md:flex` y tarjetas que se encojan (`min-w-0`).

**3. `HubEditorial` y `HubSearchAndExplore`**
- Revisar y ajustar paddings horizontales a `px-4 md:px-10` (o equivalente) y reducir tamaños hero. Solo si tienen `px-10`/grids fijos que rompen.

**4. CSS `hub-stat` en `src/index.css`**
- Si tiene anchos mínimos fijos (ej. `min-width: 140px`), añadir variante móvil o usar `min-w-0` + tipografía menor.

### No se toca
- Lógica de queries, scroll, dropdowns, navegación.
- Diseño desktop (todos los cambios son responsive con breakpoint `md`).
- Otras rutas.

### Archivos
- `src/pages/Hub.tsx` (topbar + hero responsive).
- `src/components/hub/HubEditorial.tsx` (paddings/tamaños móvil donde haga falta).
- `src/components/hub/HubSearchAndExplore.tsx` (idem).
- `src/index.css` (clases `hub-*` solo si bloquean en móvil).

