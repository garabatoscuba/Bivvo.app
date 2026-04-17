
## Plan: ajustar navbar del portal público

### Cambios en `StorefrontNavbar.tsx`
1. **Centro de la navbar**: devolver los tabs Home / Productos / Contacto al centro (donde estaban originalmente).
2. **Quitar del centro**: el botón con logo + nombre del negocio que puse en el centro.
3. **Izquierda**: mantener solo el logo de Bivoo (link al hub) — sin agregar nada más.
4. **Derecha**: quitar los tabs del cluster derecho. Dejar solo los iconos (anuncios, buscar, carrito, separador, badge abierto/cerrado, tema, menú móvil).

### Cambios en el hero (`StorefrontHome.tsx`)
1. Agregar el **logo del negocio** (sin el nombre al lado) **arriba del título grande** del hero, centrado y en tamaño grande (ej. `h-20 sm:h-28 w-auto`, redondeado si aplica).
2. Si el negocio no tiene `logo_url`, no renderizar nada (el título grande ya cumple).
3. El nombre del negocio sigue siendo el título grande de siempre — no se duplica.

### Resultado
- Navbar: `[Logo Bivoo] ... [Home Productos Contacto] ... [iconos]` (igual que antes pero con Bivoo a la izquierda).
- Hero: logo grande del negocio centrado arriba del nombre grande.

### Lo que NO se toca
- Resto del hero, catálogo, contacto, footer, popups, carrito.
- Hub, sidebar, otras rutas.

### Archivos
- `src/components/storefront/StorefrontNavbar.tsx`
- `src/components/storefront/StorefrontHome.tsx` (solo el bloque del hero — agregar logo arriba del título)
