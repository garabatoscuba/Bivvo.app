

## Plan: separación uniforme y profesional entre secciones del Hub

### Problema (visto en captura)
El portal "Vision" (hero) queda pegado al bloque "Probar Bivoo como negocio ahora", y este pegado al grid de portales debajo. No hay respiración consistente entre secciones.

### Cambios

**1. `src/components/hub/HubEditorial.tsx` — espaciado vertical uniforme**
- Contenedor raíz del componente: pasar a `space-y-12` (o `space-y-14`) para que **todas** las secciones (hero del portal destacado, CTA "Probar Bivoo", grid de portales/comunidad, anuncios) tengan la misma separación profesional.
- Ajustar márgenes internos hardcodeados que rompen el ritmo:
  - Hero del portal destacado: quitar `mb-*` extra, dejar que el `space-y` del padre lo controle.
  - Bloque CTA "Probar Bivoo como negocio ahora": quitar `mt-*`/`mb-*` propios.
  - Grid de portales (Comunidad): mismo trato.
  - Bloque de anuncios (ya tiene `mt-10 pt-8 border-t`): mantener el separador pero alinear el `mt` al ritmo general (`mt-12`).

**2. `src/pages/Hub.tsx` — ritmo del contenedor principal**
- Confirmar que el wrapper que envuelve hero (saludo+tarjetas), `<HubEditorial />` y `<HubSearchAndExplore />` use `space-y-12` consistente, sin paddings extra que dupliquen separación.

### Resultado
Todas las secciones del Hub separadas por el mismo gap vertical (~48-56px), look profesional y consistente.

### Lo que NO se toca
- Contenido de cada sección, tarjetas, tipografía, colores.
- Topbar, buscador, dropdown, modales.
- HubSearchAndExplore interno.
- Lógica, queries, navegación.

### Archivos
- `src/components/hub/HubEditorial.tsx`
- `src/pages/Hub.tsx`

