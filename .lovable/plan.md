
## Plan: loader único y consistente entre Hub, portales y negocios

### Problema real (confirmado en el código)
Cuando navegas Hub → /dashboard → portal, **se montan 3-4 loaders distintos en cascada**, cada uno con tamaño/color diferente. Eso es lo que se ve como "el círculo cargando que cambia mucho":

1. **`App.tsx` `PageLoader`** — gris pequeño `h-5 text-muted-foreground` (carga el chunk lazy de la página).
2. **`ProtectedRoute`** — **azul grande `h-8 text-primary`** (espera `loading` de auth y `subLoading` de subscription).
3. **`Hub.tsx`** loader interno — verde apagado `h-6 hub-text-muted`.
4. **`PublicStorefront.tsx`** — gris `h-5 text-muted-foreground`.
5. **`LazyErrorBoundary`** fallback — gris pequeño.

Resultado: el spinner aparece, cambia de tamaño, cambia de color, salta de posición. Además `ProtectedRoute` re-monta el spinner cada vez que `useSubscription` re-corre (queries nuevas), lo que añade un parpadeo extra al cambiar de ruta.

### Solución (mínima, sin romper nada)

**1. Crear `src/components/ui/AppLoader.tsx`** — un único componente:
```tsx
<div className="min-h-screen flex items-center justify-center bg-background">
  <Loader2 className="h-6 w-6 animate-spin" style={{ color: 'var(--hub-green)' }} />
</div>
```
- Tamaño único `h-6 w-6`.
- Color verde Bivoo (`--hub-green` = `#1D9E75`, ya definido y disponible en light y dark).
- Fondo `bg-background` para que combine con cualquier ruta (Hub usa el mismo tono claro/oscuro que `--hub-bg` ≈ `bg-background`; el negocio usa `bg-background` directo; portal idem).

**2. Sustituir todos los loaders de pantalla completa por `<AppLoader />`** en estos archivos (solo el bloque del spinner, nada más):
- `src/App.tsx` → `PageLoader` usa `AppLoader`.
- `src/components/auth/ProtectedRoute.tsx` → ambos `if (loading)` y `if (subLoading)`.
- `src/pages/Hub.tsx` → el `if (loading)` del editorial.
- `src/pages/PublicStorefront.tsx` → el `if (loading)`.
- `src/components/LazyErrorBoundary.tsx` → fallback.
- `src/pages/Auth.tsx` y `src/pages/AuthCallback.tsx` → spinners de pantalla completa.

Esto garantiza que cuando un loader se desmonte y otro se monte, **sea visualmente idéntico** (mismo tamaño, mismo color verde, mismo fondo, misma posición centrada). El usuario percibe **un solo spinner continuo**.

**3. Evitar parpadeo extra de `ProtectedRoute` al navegar entre rutas protegidas**
- Hoy `ProtectedRoute` muestra spinner mientras `subLoading` sea true. `useSubscription` se ejecuta una vez y queda en cache de react-query, así que en navegaciones internas ya no debe mostrarse — pero conviene confirmar que no re-fetch en cada cambio de ruta. **No tocar la lógica**, solo el visual del spinner.

### Lo que NO se toca
- Lógica de auth, subscription, sync, rutas, lazy loading.
- Loaders **inline pequeños** dentro de botones, modales, tablas, cards (esos son contextuales y no causan el problema).
- Sidebar, módulos, permisos.
- Ningún flujo de Hub, portal o negocio fuera del componente del loader.

### Archivos
- **Nuevo**: `src/components/ui/AppLoader.tsx`
- **Editar (solo el bloque del spinner full-screen)**: `src/App.tsx`, `src/components/auth/ProtectedRoute.tsx`, `src/pages/Hub.tsx`, `src/pages/PublicStorefront.tsx`, `src/components/LazyErrorBoundary.tsx`, `src/pages/Auth.tsx`, `src/pages/AuthCallback.tsx`
