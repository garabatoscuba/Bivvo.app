# Arreglar caché viejo del dashboard (Service Worker)

## Problema

Al abrir la app a veces se ve la versión **vieja** del dashboard hasta que algo (otro mensaje, navegación) la refresca. El service worker (PWA) sirve assets cacheados y solo busca actualizaciones cada 24 h, así que los cambios publicados tardan mucho en aparecer en el navegador del usuario.

## Solución

Hacer que el service worker chequee actualizaciones de forma agresiva y recargue una sola vez cuando detecta una versión nueva.

### Cambios

Editar `src/hooks/usePWAUpdate.ts`:

1. **Chequeo inmediato** al registrar el SW (no esperar 24 h).
2. **Chequeo periódico** cada 5 minutos mientras el tab está abierto.
3. **Chequeo en eventos**:
   - `visibilitychange` → cuando el usuario vuelve al tab.
   - `focus` de la ventana.
   - `online` → al recuperar red.
4. **Auto-reload controlado** en `onNeedRefresh`: llamar `updateServiceWorker(true)` con un flag en `sessionStorage` (`bivoo-sw-reloaded`) para evitar bucles de recarga. El flag se limpia 5 s después de que cargue la nueva versión, permitiendo futuras actualizaciones.

No se toca `vite.config.ts` — ya tiene `skipWaiting: true` y `clientsClaim: true` correctos.

### Detalles técnicos

- Usa `useRegisterSW` de `virtual:pwa-register/react` (ya importado).
- `immediate: true` fuerza registro temprano.
- El callback `onRegisteredSW` recibe el `ServiceWorkerRegistration` y arma los listeners.
- `onNeedRefresh` dispara cuando hay un SW nuevo en `waiting`; reload única vía flag.

### Resultado esperado

- Usuario abre la app → SW chequea actualización al toque.
- Si hay versión nueva publicada, se activa y la página se recarga una sola vez automáticamente.
- Mientras navega, cada vuelta al tab vuelve a chequear, así nunca se queda atascado en una versión vieja por más de unos segundos.
