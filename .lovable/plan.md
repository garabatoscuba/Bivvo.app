

## Plan: Sistema Offline Completo — Sync resiliente, límite 48h, modal Cloud interactivo

### Resumen

Implementar el sistema offline completo con: (1) sync resiliente que no bloquea la cola ante errores, (2) prefijo offline para ventas, (3) límite obligatorio de 48h, (4) banner de advertencia a las 36h, (5) bloqueo total a las 48h, y (6) modal interactivo al tocar el icono de la nube con estadísticas, estado de sync y acciones.

---

### Cambios

#### 1. `src/lib/syncEngine.ts` — Sync resiliente + constantes de tiempo

- Cambiar `SYNC_MANDATORY_INTERVAL_MS` de 24h a 48h (172800000ms)
- Agregar constante `SYNC_WARNING_INTERVAL_MS` = 36h (129600000ms)
- Exportar función `isSyncWarning()` que devuelve `true` si han pasado 36h sin sincronizar
- **Modificar `pushPendingOperations()`**: en vez de detenerse al primer error, marcar la operación como `failed` (agregar campo `status` al PendingOperation), continuar con las demás, y retornar un resumen `{ pushed, failed: number, failedOps: PendingOperation[] }`
- Agregar `executePendingOperation`: para UPDATEs, NO implementar merge por campos (el dueño es el único que edita, last-write-wins es aceptable)

#### 2. `src/lib/offlineDb.ts` — Soporte para operaciones fallidas

- Agregar campo opcional `status?: 'pending' | 'failed'` a `PendingOperation`
- Agregar función `markOperationFailed(id: string)` que actualiza el status a 'failed'
- Agregar función `getFailedOperations()` que filtra por status='failed'
- Agregar función `retryFailedOperation(id: string)` que resetea status a 'pending'
- Agregar función `getStoreCounts()` que retorna un objeto con el count de cada store en IndexedDB (para mostrar en el modal)

#### 3. `src/contexts/OfflineContext.tsx` — Exponer estado de warning/bloqueo

- Agregar estados: `syncWarning: boolean`, `syncBlocked: boolean`, `failedOps: number`
- Calcular `syncWarning` = más de 36h sin sync
- Calcular `syncBlocked` = más de 48h sin sync
- Exponer `failedOps` count en el contexto
- Actualizar `triggerSync` para manejar el nuevo formato de respuesta con operaciones fallidas

#### 4. `src/components/layout/SyncGate.tsx` — Bloqueo a las 48h

- Reactivar como gate real: si `syncBlocked === true`, mostrar pantalla completa de bloqueo
- Pantalla: icono Cloud grande, mensaje "Necesitas sincronizar", texto explicando que han pasado 48h, botón "Sincronizar ahora" que llama `triggerSync()`
- Si no hay conexión: mensaje "Conéctate a internet para continuar"
- Si hay conexión y sync exitosa: desbloquea automáticamente

#### 5. `src/components/layout/SyncStatusModal.tsx` — NUEVO: Modal interactivo del Cloud

Al tocar el icono de la nube en el header, se abre un Sheet/Drawer (no un simple toast) con:

**Sección 1: Estado de conexión**
- Indicador verde/amarillo/rojo con texto (Online / Intermitente / Offline)
- Última sincronización: fecha y hora relativa ("hace 5 minutos")

**Sección 2: Base de datos local**
- Conteo de registros por store principal: Productos, Categorías, Ventas, Empleados, etc.
- Tamaño aproximado de la DB local

**Sección 3: Cola de sincronización**
- Operaciones pendientes: X (con badge)
- Operaciones fallidas: X (con badge rojo + botón "Reintentar")
- Lista expandible de operaciones fallidas con detalle (tabla, tipo, error)

**Sección 4: Acciones**
- Botón principal: "Sincronizar ahora" (disabled si offline o syncing)
- Botón secundario: "Forzar descarga completa" (pull completo sin push)
- Indicador de progreso durante sync

**Sección 5: Límite de uso offline**
- Barra de progreso visual: 0h → 36h (warning) → 48h (bloqueo)
- Horas restantes antes del bloqueo
- Si en warning (36-48h): texto amarillo "Sincroniza pronto"
- Si bloqueado: texto rojo "Sincroniza para continuar"

#### 6. `src/components/layout/AppHeader.tsx` — Conectar modal

- Reemplazar el `onClick={handleCloudSync}` del icono Cloud por `onClick={() => setSyncModalOpen(true)}`
- Agregar estado `syncModalOpen` y renderizar `<SyncStatusModal />`
- Agregar indicador visual en el icono Cloud:
  - Verde: online, sin pendientes
  - Amarillo pulsante: warning (36h+) o hay pendientes
  - Rojo: bloqueado (48h+) u offline
  - Badge numérico: pendientes + fallidos

#### 7. `src/components/layout/OfflineBanner.tsx` — Banner de warning 36h

- Agregar estado de warning desde OfflineContext
- Si `syncWarning && !syncBlocked`: mostrar banner amarillo fijo "Llevas más de 36h sin sincronizar. Conéctate pronto para no perder acceso."
- Si `syncBlocked`: banner rojo "Acceso bloqueado. Sincroniza para continuar."

### Archivos a crear
- `src/components/layout/SyncStatusModal.tsx`

### Archivos a modificar
- `src/lib/syncEngine.ts`
- `src/lib/offlineDb.ts`
- `src/contexts/OfflineContext.tsx`
- `src/components/layout/SyncGate.tsx`
- `src/components/layout/AppHeader.tsx`
- `src/components/layout/OfflineBanner.tsx`

### Lo que NO se toca
- Auth, POS, inventario, sidebar, nómina, empleados, contabilidad
- No se crean tablas nuevas en la base de datos
- No se modifica el flujo de ventas offline (ya funciona con VTA-OFF-prefix)

