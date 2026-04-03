

## Plan: Hacer que el login offline funcione definitivamente

### Problemas encontrados

1. **`pullCloudData` no guarda profiles ni user_roles** — Los stores existen en IndexedDB (`profiles`, `user_roles`) pero `pullCloudData` nunca escribe en ellos. El botón "Forzar descarga completa" no prepara los datos de autenticación para offline.

2. **OAuth (Google/Apple) nunca guarda credenciales offline** — `saveOfflineCredentials` solo se llama en `signIn` (email+password). Los usuarios que entran con Google/Apple no pueden autenticarse offline.

3. **`useOfflineCache` tampoco guarda profiles ni roles** — Es un segundo sistema de cache que corre en `AppLayout`, pero tampoco guarda los datos de auth.

4. **No hay forma de iniciar sesión offline sin credenciales previas** — Si nunca se guardaron las credenciales (por ser OAuth o por ser la primera vez), el usuario queda bloqueado en `/auth`.

### Estrategia

Dado que solo el dueño puede editar y los empleados solo venden (operaciones aditivas), la solución es:
- Guardar SIEMPRE la sesión offline completa (ya se hace)
- Para OAuth: permitir restaurar sesión sin verificar credenciales (ya se hace en `initializeAuth` con `loadOfflineSession`)
- El problema real es que cuando la app ARRANCA offline, intenta restaurar desde localStorage y funciona... PERO si el usuario cerró sesión y quiere re-loguearse offline, necesita credenciales

### Cambios

#### 1. `src/lib/syncEngine.ts` — Guardar profiles y roles en pullCloudData

Agregar al `pullCloudData` la descarga de:
- `profiles`: todos los profiles del negocio (para que cada empleado tenga su perfil en IndexedDB)
- `user_roles`: todos los roles de los usuarios del negocio

Esto se logra descargando los `employees` (ya se hace), luego consultando profiles y user_roles por los `auth_user_id` de esos empleados. Pero dado que hay RLS, simplificar: guardar al menos el profile y roles del usuario actual que está ejecutando el pull.

En realidad, lo más práctico: en el pull, guardar el profile del usuario actual y sus roles. Para multi-usuario offline (varios empleados en el mismo dispositivo), guardar los profiles de todos los empleados que tienen `auth_user_id`.

#### 2. `src/contexts/AuthContext.tsx` — Guardar credenciales OAuth implícitamente

Cuando un usuario OAuth inicia sesión exitosamente (via `onAuthStateChange` con `SIGNED_IN`), guardar una credencial "especial" que permita el auto-restore sin password. Esto ya se hace parcialmente con `saveOfflineSession` — pero el flujo de `signIn` offline requiere email+password.

Solución: en el flujo offline inicial (`initializeAuth`), ya se restaura desde `loadOfflineSession()` sin necesitar credenciales. El problema solo ocurre si el usuario CIERRA SESION y luego quiere re-entrar offline. Para eso:
- Modificar `signOut` para NO borrar la sesión offline si está offline (avisar que no puede cerrar sesión offline)
- O: al detectar offline en Auth.tsx, intentar restaurar automáticamente la última sesión cached sin pedir credenciales

#### 3. `src/pages/Auth.tsx` — Auto-restore offline

Si el usuario llega a Auth.tsx y está offline, intentar restaurar la sesión cached automáticamente sin pedir credenciales. Mostrar un botón "Continuar sin conexión" que restaure la última sesión. Si hay credenciales guardadas, también permitir login con email+password.

#### 4. `src/hooks/useOfflineCache.ts` — Incluir profiles y roles

Agregar la descarga de profiles (al menos del usuario actual) y user_roles al cache automático que corre en AppLayout.

### Flujo resultante

```text
USUARIO ONLINE (primera vez):
1. Login (email o Google/Apple) → sesión guardada en localStorage
2. AppLayout monta → useOfflineCache guarda datos + profile + roles en IndexedDB
3. Sync automático → pullCloudData guarda todo incluyendo profiles/roles

USUARIO OFFLINE (app ya abierta):
→ initializeAuth detecta offline → loadOfflineSession → funciona ✅

USUARIO OFFLINE (app cerrada y reabierta):
→ initializeAuth detecta offline → loadOfflineSession → funciona ✅

USUARIO OFFLINE (cerró sesión y quiere re-entrar):
→ Auth.tsx detecta offline → muestra "Continuar sin conexión"
→ Click → restaura última sesión → funciona ✅
→ O: ingresa email+password → verifyOfflineCredentials → funciona ✅
```

### Archivos a modificar
- `src/lib/syncEngine.ts` (agregar profiles/roles al pull)
- `src/hooks/useOfflineCache.ts` (agregar profiles/roles al cache)
- `src/pages/Auth.tsx` (botón "Continuar sin conexión" cuando offline)
- `src/contexts/AuthContext.tsx` (proteger signOut cuando offline)

### Lo que NO se toca
- POS, inventario, sidebar, nómina, empleados, contabilidad
- No se crean tablas nuevas
- No se modifica el flujo de OAuth online

