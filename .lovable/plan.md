# Arreglar dashboard cacheado en el preview de Lovable

## Problema

En el preview de Lovable la app se ejecuta dentro de un iframe. El service worker (vite-plugin-pwa) se registra dentro de ese iframe y empieza a servir HTML/JS cacheados, así que después de publicar cambios el usuario sigue viendo el dashboard **viejo** hasta que algo fuerza un refresh.

Esto es un problema conocido de service workers en iframes/previews — el SW persiste entre sesiones y sigue interfiriendo aunque actualicemos el código.

## Solución

Bloquear el registro del SW dentro de iframes y hosts de preview, y desregistrar cualquier SW que ya esté instalado en esos contextos. El SW solo debe activarse en producción (dominio publicado real).

### Cambios

**1. `src/hooks/usePWAUpdate.ts`** — añadir guarda al inicio:

- Detectar si estamos dentro de un iframe (`window.self !== window.top`, con try/catch para cross-origin).
- Detectar host de preview (`id-preview--`, `lovableproject.com`, `lovable.app` en subdominios de preview).
- Si cualquiera de las dos es true:
  - Llamar `navigator.serviceWorker.getRegistrations()` y `.unregister()` en todos.
  - Llamar `caches.keys()` y `caches.delete()` para limpiar caches viejos.
  - **Retornar antes** de llamar `useRegisterSW` → el SW no se registra en preview.
- Si es producción real (host publicado, no iframe): mantener el comportamiento actual de `useRegisterSW` con `registerType: autoUpdate`.

**2. No tocar `vite.config.ts`** — la config del plugin está bien; solo controlamos el registro en runtime.

### Resultado esperado

- En el preview de Lovable: nunca hay SW activo → siempre se sirve la versión más reciente, sin caché vieja.
- En producción publicada (`bivoo.app`, `test-bivoo.lovable.app`): el SW funciona normal con `autoUpdate` para ofrecer experiencia offline / instalable.
- Usuarios que ya tienen un SW viejo registrado en el preview lo pierden la próxima vez que carguen.

### Detalle técnico

`useRegisterSW` es un hook — no se puede llamar condicionalmente. La guarda se implementa exportando dos caminos: si es preview/iframe, el hook hace cleanup en un `useEffect` y no llama `useRegisterSW`. Si es producción, llama `useRegisterSW` normalmente. Para mantener la regla de hooks, separamos en dos componentes-hook internos seleccionados antes del render (la detección de iframe/host es estable durante la vida de la página).
