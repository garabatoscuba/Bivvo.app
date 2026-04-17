
## Plan: buscador en vivo del Hub con resultados agrupados

### Problema
El input de la topbar (`Hub.tsx` líneas 191-199) hoy solo guarda el texto en `search` pero no muestra nada. Necesito un dropdown live con dos secciones, respetando que solo aparezcan negocios con portal activo.

### Backend — nueva RPC `search_public_catalog(q text)`
Crear migración con función `SECURITY DEFINER` que devuelva resultados unificados (porque `products` y `service_categories` tienen RLS que bloquea acceso anónimo/cross-business). Devuelve filas con:
- `kind` ('business' | 'product' | 'service')
- `id`, `name`, `price` (nullable), `business_id`, `business_name`, `business_slug`

Lógica:
- **Negocios**: igual que `list_public_storefronts` (JOIN a `branches` + `store_settings.is_active = true`), filtrando por `b.name ILIKE '%q%' OR b.keywords ILIKE '%q%'`. Limit 8.
- **Productos**: `products` filtrado por `name ILIKE '%q%'`, solo de negocios cuyo branch tenga storefront activo, solo `tipo IN ('reventa','elaborado','granel')` y `status NOT IN ('discontinued','warehouse')`. Devuelve `sale_price` y nombre del negocio + slug. Limit 10.
- **Servicios**: `service_categories` filtrado por `name ILIKE '%q%'`, solo de negocios con storefront activo. Devuelve `fixed_price`. Limit 10.

Permisos: `GRANT EXECUTE ... TO anon, authenticated`.

### Frontend — `Hub.tsx`

1. **Estado nuevo**: `searchOpen` (boolean), `searchResults` agrupados, `searchLoading`. Usar `useQuery` con `queryKey: ['hub-search', search]`, `enabled: search.trim().length >= 2`, debounce simple con `useEffect` + `setTimeout(250ms)` que actualiza un `debouncedSearch` para evitar disparar en cada tecla.
2. **Wrapper relativo** alrededor del input (`hub-search-box`) con `ref` para detectar clicks fuera (`useEffect` listener en `document.mousedown` → si target fuera del wrapper, cerrar).
3. **Dropdown** posicionado `absolute` debajo del input, mismo ancho, fondo `hub-card`, sombra, `max-h-[420px] overflow-y-auto`, `z-[60]`. Solo render si `debouncedSearch.length >= 2 && searchOpen`.
4. **Contenido del dropdown**:
   - Loading: spinner pequeño verde inline.
   - `businesses.length + items.length === 0`: `Sin resultados para "{search}"`.
   - Sección **"Negocios"** (header tipo `text-[10px] uppercase tracking-wider hub-text-dim px-3 py-1.5`): cada item = avatar/inicial + nombre + tipo. Click → `navigate('/s/' + slug)` y cerrar.
   - Sección **"Productos y servicios"**: cada item = nombre + `· {nombre del negocio}` + precio formateado a la derecha. Click → `navigate('/s/' + business_slug)` y cerrar.
5. **Cerrar dropdown** cuando: (a) `search` queda vacío, (b) click fuera, (c) selección de un resultado, (d) `Escape`.
6. Los estilos reutilizan tokens existentes (`hub-card`, `hub-text-dim`, `hub-text-muted`, etc.) — sin tocar CSS.

### Lo que NO se toca
- Topbar visual (logo, switch, iconos, avatar, dropdown de usuario).
- Layout del input (`hub-search-box`, placeholder, icono Search).
- HubEditorial, HubSearchAndExplore (este último vive en otra parte y queda igual).
- Tarjetas, hero, modales, lógica de negocios/empleos/afiliaciones.
- RPC `list_public_storefronts` existente.

### Archivos
- **Nueva migración**: crear RPC `search_public_catalog(q text)` con `GRANT EXECUTE ... TO anon, authenticated`.
- **Editar**: `src/pages/Hub.tsx` (estado de búsqueda, debounce, query, dropdown JSX dentro del wrapper del input, listener click-fuera).
