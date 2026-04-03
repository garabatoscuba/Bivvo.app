

## Plan: Cierre de Jornada Offline

### Problema
`ContarYCerrarModal`, `CashCalculator` e `InventoryCountStep` hacen queries directas a Supabase con `useQuery`. Si no hay conexión, las queries fallan y el cierre no funciona.

### Estrategia
NO cacheamos todo el sitio. Solo agregamos 2 tablas al pull y creamos un patrón "offline-first" para los 3 componentes del cierre: leer de IndexedDB cuando offline, encolar escrituras como `pending_operations`.

---

### Cambios

#### 1. `src/lib/offlineDb.ts` — Agregar stores faltantes
- Agregar stores: `tip_config`, `service_entries`
- Incrementar versión de la DB (4)
- Agregar función helper `getFromStoreByIndex(store, indexName, value)` para queries filtradas desde IndexedDB

#### 2. `src/lib/syncEngine.ts` — Agregar al pull
En `pullCloudData`, agregar:
- `tip_config` (by business_id, single row)
- `service_entries` (by branch_id, today only, no archived)

#### 3. `src/hooks/useOfflineQuery.ts` — Hook genérico offline-first
Crear/refactorizar hook que:
- Si `isOnline`: hace query normal a Supabase (como ahora)
- Si `!isOnline`: lee de IndexedDB con los mismos filtros
- Retorna misma interfaz que useQuery (`data`, `isLoading`)

#### 4. `src/components/cobro/CashCalculator.tsx` — Lectura offline
Reemplazar las 3 queries directas (`service_entries`, `sales`, `jornadas`) por el hook offline-first:
- Offline: leer `sales` del store IndexedDB filtrando por fecha de hoy y branch
- Offline: leer `service_entries` del store filtrando por fecha y branch
- Offline: leer `jornadas` del store filtrando por fecha y branch
- La lógica de cálculo (breakdown, tips) NO cambia

#### 5. `src/components/employees/InventoryCountStep.tsx` — Lectura y escritura offline
**Lecturas** (ya cacheadas):
- `employees` → IndexedDB
- `employee_insumo_areas` → IndexedDB
- `raw_materials` → IndexedDB
- `branch_stock` + `products` → IndexedDB

**Escritura** offline:
- `inventory_counts` INSERT → encolar como `pending_operation`
- Audit log → encolar como `pending_operation` (ya usa función que puede adaptarse)

#### 6. `src/components/employees/ContarYCerrarModal.tsx` — Escritura offline
Las 6 escrituras del cierre, cuando offline, se encolan como `pending_operations`:
- `tip_entries` INSERT
- `daily_reports` UPSERT → convertir a INSERT con conflict handling en el server
- `notifications` INSERT
- `jornadas` UPDATE
- `cash_registers` UPDATE
- `employee_salary_records` INSERT

Además:
- La query de `activeWorkersCount` lee de IndexedDB offline
- La query de `tipConfig` lee de IndexedDB offline
- Al cerrar offline: actualizar el registro de jornada en IndexedDB local también (para que la UI refleje el cierre inmediatamente)
- Toast de éxito dice "Jornada cerrada (se sincronizará al conectar)" cuando offline

#### 7. `src/lib/offlineDb.ts` — Helper para actualizar store local
Agregar función `updateInStore(store, id, changes)` para que al cerrar jornada offline, el registro local se actualice y la UI no muestre la jornada como activa.

### Flujo resultante

```text
EMPLEADO OFFLINE cierra jornada:
1. Cuenta inventario → lee branch_stock/raw_materials de IndexedDB
2. Guarda conteo → pending_operation (INSERT inventory_counts)
3. Cuenta billetes → lee sales/service_entries de IndexedDB
4. Confirma cierre:
   - 6 pending_operations (tip, report, notification, jornada, caja, salary)
   - Actualiza jornada local en IndexedDB (cierre_at = now)
   - UI muestra "Sin jornada activa"
   - Badge en nube: +7 pendientes

EMPLEADO CONECTA:
1. Sync push: envía las 7 operaciones
2. Servidor procesa (triggers de stock, etc.)
3. Pull: descarga datos frescos
4. Badge en nube: 0 pendientes ✅
```

### Archivos a crear
- Ninguno nuevo (reutilizamos `useOfflineQuery` existente)

### Archivos a modificar
- `src/lib/offlineDb.ts` (2 stores + helpers)
- `src/lib/syncEngine.ts` (2 tablas al pull)
- `src/components/cobro/CashCalculator.tsx` (queries offline-first)
- `src/components/employees/InventoryCountStep.tsx` (queries + escritura offline)
- `src/components/employees/ContarYCerrarModal.tsx` (queries + 6 escrituras offline)

### Lo que NO se toca
- Auth, POS, sidebar, nómina, contabilidad, tesorería
- No se crean tablas nuevas
- No se modifica la lógica de cálculo de salarios ni tips
- El modal `CerrarJornadaModal` (simple, sin conteo) no se modifica

