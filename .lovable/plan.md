

## Plan: Eliminar cierre automático por inactividad + asegurar persistencia de sesión

### Problemas

1. **Jornadas se cierran solas por inactividad**: `useJornadaActiva` tiene un timer de 30 min que muestra una alerta, y `AlertaInactividad` tiene otro timer de 10 min que ejecuta `cerrarPorInactividad()` automáticamente. Esto no conviene — las jornadas solo deben cerrarse manualmente.

2. **Sesiones de dueños**: El cliente Supabase ya tiene `persistSession: true` y `autoRefreshToken: true`, y existe `useSessionKeepAlive` que refresca cada 10 min. La sesión persiste al cerrar/abrir el navegador. No hay código que cierre la sesión automáticamente. Esto ya funciona correctamente.

### Solución

#### 1. Eliminar toda la lógica de inactividad del hook
**Archivo:** `src/hooks/useJornadaActiva.ts`

- Eliminar las constantes `INACTIVITY_TIMEOUT` y `ACTIVITY_EVENTS`
- Eliminar los estados `mostrarAlertaInactividad`, `timerRef`
- Eliminar las funciones `clearTimer`, `startTimer`, `resetInactividad`, `cerrarPorInactividad`
- Eliminar el `useEffect` de activity listeners
- Eliminar las propiedades del return (`mostrarAlertaInactividad`, `resetInactividad`, `cerrarPorInactividad`)
- El hook queda solo con la query de jornada activa y retorna `{ jornadaActiva, jornada, isLoading }`

#### 2. Eliminar el componente AlertaInactividad
**Archivo:** `src/components/employees/AlertaInactividad.tsx` — eliminar archivo completo

#### 3. Quitar AlertaInactividad del layout
**Archivo:** `src/components/layout/AppLayout.tsx`
- Eliminar el import y el `<AlertaInactividad />` (líneas 7 y 34)

#### 4. Edge function auto-cerrar-jornadas — se mantiene
La edge function `auto-cerrar-jornadas` cierra jornadas de >13 horas o de días anteriores. Esto es una limpieza de servidor legítima (jornadas olvidadas), **no** cierre por inactividad del cliente. Se deja tal cual.

### Sesión de dueños
Ya está correctamente configurado:
- `persistSession: true` en el cliente Supabase
- `autoRefreshToken: true` refresca tokens automáticamente
- `useSessionKeepAlive` refresca al volver al tab o cada 10 min
- La sesión sobrevive al cerrar/abrir navegador sin problema

No se requieren cambios para la sesión.

### Archivos a modificar
- `src/hooks/useJornadaActiva.ts` (limpiar inactividad)
- `src/components/layout/AppLayout.tsx` (quitar AlertaInactividad)
- `src/components/employees/AlertaInactividad.tsx` (eliminar)

### Lo que NO se toca
- Edge function `auto-cerrar-jornadas` (limpieza servidor legítima)
- Auth, POS, inventario, nómina, sidebar, contabilidad

