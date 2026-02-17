
# Actualizacion inteligente de la PWA

## Problema actual

La app usa `registerType: "autoUpdate"` que descarga actualizaciones en segundo plano, pero:
- El usuario nunca se entera de que hay una version nueva
- La actualizacion solo se aplica al cerrar y reabrir la app
- No hay forma de forzar una sincronizacion de datos

## Solucion

### 1. Cambiar estrategia de actualizacion PWA

Cambiar de `autoUpdate` a `prompt` en `vite.config.ts`. Esto permite que la app detecte la nueva version y le **pregunte** al usuario si quiere actualizar, en vez de hacerlo silenciosamente.

### 2. Hook de actualizacion (`src/hooks/usePWAUpdate.ts`)

Crear un hook que:
- Registra el Service Worker manualmente usando `registerSW` de `vite-plugin-pwa`
- Detecta cuando hay una actualizacion disponible (`onNeedRefresh`)
- Expone `needsUpdate` (boolean) y `updateApp()` (funcion que recarga con la nueva version)
- Verifica actualizaciones periodicamente (cada 60 minutos)

### 3. Banner de actualizacion (`src/components/layout/UpdateBanner.tsx`)

Un banner que aparece en la parte superior cuando se detecta una nueva version:

```text
+----------------------------------------------+
| Nueva version disponible  [Actualizar ahora] |
+----------------------------------------------+
```

Se integra en `AppLayout.tsx` arriba de todo.

### 4. Botones en el header

Agregar dos botones pequenos en el `AppHeader.tsx` junto al centro de notificaciones:

- **Sincronizar** (icono RefreshCw): Invalida los caches de React Query para forzar una recarga de datos frescos desde la base de datos. Util cuando el usuario quiere asegurarse de tener la informacion mas reciente.
- **Actualizar** (icono Download): Solo aparece cuando hay una version nueva disponible. Al tocarlo, aplica la actualizacion y recarga la app.

```text
[RefreshCw] [Download*] [Bell]
             * solo si hay update
```

### 5. Verificacion periodica

En el hook, configurar `intervalMS` para que el Service Worker verifique si hay una nueva version cada 60 minutos automaticamente.

## Detalle tecnico

### Archivos nuevos
- `src/hooks/usePWAUpdate.ts` - Hook para deteccion y aplicacion de actualizaciones

### Archivos modificados
- `vite.config.ts` - Cambiar `registerType` de `"autoUpdate"` a `"prompt"`
- `src/components/layout/AppHeader.tsx` - Agregar botones de Sincronizar y Actualizar
- `src/components/layout/AppLayout.tsx` - Integrar banner de actualizacion (inline, sin componente separado)

### Flujo de actualizacion

```text
Tu publicas cambios
        |
        v
Service Worker detecta nueva version (check cada 60 min)
        |
        v
Aparece banner "Nueva version disponible"
+ Aparece icono de descarga en el header
        |
        v
Usuario toca "Actualizar ahora"
        |
        v
Se activa el nuevo Service Worker y se recarga la pagina
        |
        v
App corriendo con la version mas reciente
```

### Flujo de sincronizacion

```text
Usuario toca icono RefreshCw en el header
        |
        v
Se invalidan todos los caches de React Query
        |
        v
Se refetch automatico de todos los datos visibles
        |
        v
Toast: "Datos sincronizados"
```

### Logica del hook usePWAUpdate

```text
import { useRegisterSW } from 'virtual:pwa-register/react'

- onNeedRefresh -> setNeedsUpdate(true)
- updateApp() -> updateServiceWorker(true) // activa SW y recarga
- intervalMS: 60 * 60 * 1000 // verificar cada hora
```

### Nota para el usuario
Una vez implementado, tus clientes nunca tendran que reinstalar la app. Cada vez que publiques cambios, les aparecera un aviso y con un toque actualizan. El boton de sincronizar les permite refrescar los datos en cualquier momento.
