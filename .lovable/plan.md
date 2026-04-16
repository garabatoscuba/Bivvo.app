

## Plan: Mejorar HubSearchAndExplore con directorio enriquecido

### Contexto
El componente `HubSearchAndExplore` ya existe con un buscador y sección "Explorar" basicos. Se necesita enriquecer con: placeholder actualizado, logo desde `store_settings` (no solo `businesses.logo_url`), keywords como chips, badge Abierto/Cerrado segun horario, y ciudad (campo `address` de `branches`).

**Nota**: No existe columna `city` en branches, solo `address`. Se usara el address como referencia de ubicacion. El `schedule` en `store_settings` contiene el horario para determinar abierto/cerrado.

### Cambios en `src/components/hub/HubSearchAndExplore.tsx`

1. **Actualizar query** para traer datos adicionales:
   - De `store_settings`: `hero_image_url`, `schedule`, `accent_color` (para usar como logo del portal si no hay `logo_url` en businesses)
   - De `branches`: `address` (para mostrar ciudad/ubicacion)
   - Mapear cada negocio con su store_settings y branch info

2. **Actualizar placeholder** del buscador a "Buscar negocios, servicios, productos..."

3. **Funcion `isOpenNow`**: Parsear el campo `schedule` (JSON con dias y horarios) para determinar si el negocio esta abierto o cerrado en este momento.

4. **Tarjetas del directorio ("Explorar en Bivoo")**:
   - Avatar cuadrado redondeado: logo del negocio (de `businesses.logo_url` o `store_settings.hero_image_url`) o iniciales con color de fondo generado del nombre
   - Nombre del negocio
   - Tipo de negocio
   - Address/ciudad si disponible
   - Keywords como chips pequenos (split por coma)
   - Badge "Abierto" verde o "Cerrado" gris segun horario

5. **Resultados de busqueda**: Mantener dropdown actual pero filtrar tambien en el grid de tarjetas (mostrar solo las que coinciden cuando hay busqueda activa).

6. **Titulo de seccion**: Cambiar "Explorar" a "Explorar en Bivoo"

### Archivos a modificar
- `src/components/hub/HubSearchAndExplore.tsx` (unico archivo)

### Lo que NO se toca
- Hub.tsx ni su integracion
- Estilos globales ni CSS del hub
- Ninguna otra pagina o componente

