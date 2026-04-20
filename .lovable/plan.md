

## Diagnóstico

Usuarios antiguos no ven el Hub en móvil; usuarios nuevos sí. Causa raíz: **caché obsoleta acumulada en dispositivos antiguos**:

1. **Service Worker viejo** (`vite-plugin-pwa` con `autoUpdate`): ya tiene `skipWaiting/clientsClaim`, pero usuarios que estuvieron offline o sin abrir la app durante el cambio Hub pueden tener un SW de hace semanas que sirve `index.html` cacheado apuntando a chunks JS que ya no existen → pantalla en blanco silenciosa.
2. **`supabase-api-cache` y `supabase-auth-cache`**: respuestas viejas (perfiles sin campos nuevos, sesiones con `business_type` legacy) servidas por NetworkFirst cuando hay timeout (5s en móvil con mala señal = común).
3. **localStorage `bivoo-offline-session`**: estructura vieja del perfil sin validación de shape al restaurar → `AuthContext` hidrata estado inválido y Hub falla al renderizar.
4. **Sin guard de versión**: no hay forma de forzar reset del lado cliente cuando se hace un cambio estructural.

Usuarios nuevos no tienen nada de esto cacheado → todo carga limpio.

## Solución: limpieza total automática por versión

### 1. Bump de versión de app + guard al arranque (`src/main.tsx`)
Añadir antes de `createRoot`:
- Constante `APP_CACHE_VERSION = "2026-04-20-hub-v1"`.
- Leer `localStorage["bivoo-cache-version"]`.
- Si difiere o no existe (y existe alguna clave `bivoo-*` previa, indicando usuario antiguo):
  - `await caches.keys()` → `caches.delete()` para todas.
  - `navigator.serviceWorker.getRegistrations()` → `unregister()` todas.
  - `indexedDB.databases()` → borrar las que empiecen por `bivoo` o sean del offline cache (preservando las de Supabase auth `sb-*` para no cerrar sesión).
  - Limpiar `localStorage` excepto: claves `sb-*` (tokens Supabase), `bivoo-offline-credentials`, `bivoo-offline-session`, `bivoo-offline-session-multi` (para no romper login offline existente).
  - Setear `localStorage["bivoo-cache-version"] = APP_CACHE_VERSION`.
  - `window.location.reload()`.
- Usuarios nuevos (sin claves previas) solo escriben la versión y siguen normal.

### 2. Validación shape en sesión offline (`src/lib/offlineSession.ts`)
En `loadOfflineSession` y `loadOfflineSessionByEmail`: validar que `data.profile?.user_id` y `data.profile?.email` existan. Si no, devolver `null` (en vez de hidratar basura).

### 3. Vite PWA: bump de `cacheName`
En `vite.config.ts`, renombrar `supabase-api-cache` → `supabase-api-cache-v2` y `supabase-auth-cache` → `supabase-auth-cache-v2`. Workbox descarta automáticamente los caches con nombres viejos.

### 4. Hub defensivo (`src/pages/Hub.tsx`)
Si `profile` es `null` o la query de negocios falla, mostrar estado vacío con mensaje "No se pudo cargar tu Hub" + botón "Reparar y recargar" que ejecuta la limpieza manual (mismo helper del paso 1, exportado).

## Lo que NO se toca
- Auth tokens Supabase (sesión activa se preserva).
- Credenciales offline (login offline sigue funcionando).
- Tablas BD, RLS, edge functions.
- POS, Inventario, Tesorería, Jornadas, Roles.
- Lógica de módulos por plan.

## Archivos
- `src/main.tsx` — guard de versión + helper de limpieza.
- `src/lib/offlineSession.ts` — validación shape.
- `src/pages/Hub.tsx` — estado vacío + botón reparar.
- `vite.config.ts` — bump nombres de cache.

