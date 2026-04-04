

## Plan: Corregir SyncGate que bloquea con internet + login offline que no funciona

### Problemas encontrados

**Bug 1 — SyncGate bloquea usuarios con internet (GRAVE)**

`SyncGate` envuelve TODA la app incluyendo `/auth`. La función `isSyncRequired()` retorna `true` cuando `lastSyncTimestamp` es `null` en IndexedDB (línea 28 de syncEngine.ts). 

En una máquina que nunca ha sincronizado (o si se borra IndexedDB), esto causa un DEADLOCK:
- SyncGate bloquea → no se puede llegar a `/auth` → no hay login → no hay `profile` → el botón "Sincronizar ahora" no hace nada (línea 90 de OfflineContext: `if (!profile?.business_id) return`)
- Resultado: pantalla "Necesitas sincronizar" sin salida posible, incluso con internet

Esto es exactamente lo que les pasó en tu trabajo.

**Bug 2 — Login offline no funciona pese a descarga forzada**

`useOfflineCache` (descarga forzada) escribe datos a IndexedDB pero **nunca llama `setSyncMeta('lastSyncTimestamp')`**. Solo escribe a `localStorage` (`bivoo-last-sync-${user.id}`). Entonces aunque los datos estén descargados, SyncGate sigue bloqueando porque `lastSyncTimestamp` nunca se setea en IndexedDB.

---

### Solución

#### 1. SyncGate: no bloquear cuando hay internet ni cuando no hay sesión
**Archivo:** `src/components/layout/SyncGate.tsx`

Agregar dos condiciones de escape:
- Si `navigator.onLine` y hay conectividad real → no bloquear (el sync debería correr automáticamente en background, no impedir el uso)
- Si no hay usuario autenticado → no bloquear (dejar pasar a `/auth`)

```text
// Pseudocódigo del cambio
const { user } = useAuth();

// No bloquear si:
// 1. No hay sync pendiente (!syncBlocked)
// 2. El usuario tiene internet (isOnline) 
// 3. No hay usuario logueado (dejar pasar a /auth)
if (!syncBlocked || isOnline || !user) return children;
```

Con esto:
- Máquinas nuevas con internet → pasan directo al login, sincronizan después
- Offline sin sync en 48h → sigue bloqueando (correcto)
- Sin sesión offline → ven login, no gate

#### 2. useOfflineCache: setear lastSyncTimestamp en IndexedDB
**Archivo:** `src/hooks/useOfflineCache.ts`

Después de escribir todos los stores, agregar:
```typescript
import { setSyncMeta } from '@/lib/offlineDb';
// Al final del run(), después de Promise.all(writes):
await setSyncMeta('lastSyncTimestamp', Date.now());
```

Así la descarga forzada también marca el sync como completado, y SyncGate no bloqueará offline.

---

### Archivos a modificar
- `src/components/layout/SyncGate.tsx` (agregar guards para online y sin sesión)
- `src/hooks/useOfflineCache.ts` (agregar setSyncMeta al final)

### Lo que NO se toca
- Auth, POS, inventario, empleados, sidebar, nómina, contabilidad
- No se crean tablas ni edge functions

### Resultado esperado
- Las máquinas de tu trabajo dejarán de ver la pantalla de "Necesitas sincronizar" porque tienen internet
- La descarga forzada realmente preparará todo para uso offline
- El login offline funcionará después de haber forzado la descarga al menos una vez

