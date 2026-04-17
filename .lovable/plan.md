

## Plan: optimizar espaciados y compactar ofertas/novedades del Hub

### Problema (visto en captura)
- Las tarjetas de "Ofertas/Novedades" (anuncios editoriales) ocupan **media pantalla cada una** porque el grid es `sm:grid-cols-2` → solo 2 por fila a todo lo ancho.
- Falta separación visual clara entre el bloque de **portales (los 5 negocios)** y la fila de **anuncios** debajo.
- Las secciones del Hub se ven pegadas, sin respiración.

### Cambios

**1. `src/components/hub/HubEditorial.tsx` — anuncios más pequeños**
- Cambiar grid de anuncios a `grid-cols-2 md:grid-cols-3 lg:grid-cols-4` (4 por fila en desktop, en vez de 2).
- Reducir padding interno de cada tarjeta (`p-4` → `p-3`), avatar más chico (`h-10 w-10` → `h-8 w-8`), título `text-sm` → `text-[13px]`, subtítulo más compacto.
- Mantener el mismo estilo visual (badge "Oferta"/"Nuevo", colores, hover).

**2. `src/components/hub/HubEditorial.tsx` — separación entre secciones**
- Aumentar el `space-y` entre el carrusel de portales y el grid de anuncios (`space-y-6` → `space-y-10`).
- Añadir un separador sutil opcional (`border-t border-border/30 pt-8`) entre el carrusel de negocios y los anuncios para marcar el corte.
- Header de la sección "Ayúdanos a crecer / Ofertas y novedades" con más margen inferior (`mb-3` → `mb-4`).

**3. `src/pages/Hub.tsx` — respiración general entre bloques**
- Confirmar que entre el hero (saludo + tarjetas), el editorial y la sección de explorar haya `space-y-10` o `gap-10` consistente (hoy es más apretado).
- Solo tocar el contenedor principal del Hub, no los componentes internos.

### Lo que NO se toca
- Topbar, buscador, dropdown de búsqueda.
- Tarjetas de "Mis negocios / Mi empleo / Afiliaciones".
- Lógica de queries, navegación, modales.
- Estilos globales (`hub-card`, `hub-text-*`).
- Carrusel de portales (solo su separación con lo de abajo).

### Archivos
- `src/components/hub/HubEditorial.tsx` (grid, padding, tipografía de anuncios + espaciados internos).
- `src/pages/Hub.tsx` (espaciado vertical entre secciones principales).

