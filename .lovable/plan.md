
## Plan: Corregir Tito/Alex definitivamente y blindar el flujo para todos los @bivoo.app

### Qué encontré
Hay 2 causas reales del problema:

1. **`/mi-empleo` sigue resolviendo al empleado por `email` y no por `auth_user_id`**  
   En `src/pages/MyEmployment.tsx` se busca:
```text
employees.email = profile.email
```
Hoy existen **dos filas de Tito con el mismo email** en negocios distintos. Entonces el sistema puede tomar la fila vieja, y eso explica exactamente:
- que **no salga con su equipo activo**
- que le aparezca **un salario raro**
- que se mezcle con datos de otro negocio

2. **El alta de empleados deja “fantasmas” si falla la creación del @bivoo.app**  
   En `src/pages/Employees.tsx` primero se inserta `employees`, luego se llama `create-bivoo-employee`.  
   Si esa función falla, **la fila del empleado queda creada igual** y después todavía se guardan salario/asignaciones.  
   Eso deja residuos como:
- empleado con `auth_user_id = null`
- salario asignado a una fila inválida
- mismo email repetido en otra fila

### Datos corruptos que ya existen
Ahora mismo hay datos malos en vivo:
- **Tito** tiene una fila vieja en otro negocio, sin `auth_user_id`, pero con salario asignado
- **Alex** tiene cuenta vinculada, pero su `profile` quedó sin `business_id/branch_id`
- Los dos están activos, pero la resolución por email hace que Tito pueda caer en la fila incorrecta

---

## Lo que voy a implementar

### 1. Arreglar `Mi Empleo` para que use la fila correcta siempre
**Archivo:** `src/pages/MyEmployment.tsx`

Cambiar la resolución del empleado actual para que:
1. primero busque por `employees.auth_user_id = profile.user_id`
2. solo use email como fallback para casos legacy no vinculados

Con eso, Tito y cualquier empleado @bivoo.app:
- tomarán su **negocio real**
- leerán su **salario real**
- verán su **equipo activo real**

También haré que el resto de queries de esa página reutilicen ese mismo empleado resuelto, no una búsqueda paralela por email.

---

### 2. Blindar el alta para que no deje empleados fantasma
**Archivos:**
- `src/pages/Employees.tsx`
- `supabase/functions/create-bivoo-employee/index.ts`

#### En `Employees.tsx`
Haré que el flujo sea bloqueante para cuentas @bivoo.app:

```text
crear fila employee mínima
→ invocar create-bivoo-employee
→ si falla: rollback inmediato y abortar
→ solo si sale bien: guardar salario, sucursales y demás asignaciones
```

Así no volverán a quedar:
- empleados huérfanos
- salarios pegados a filas inválidas
- duplicados silenciosos

#### En `create-bivoo-employee`
Endureceré la validación del identificador generado para que revise:
- **Auth**
- **tabla `employees`**

La regla será:
- si el slug base está ocupado, **seguir autogenerando con sufijo** (`tito1`, `tito2`, etc.)
- si encuentra residuos claros, limpiarlos o bloquear con error controlado
- mantener el comportamiento que pediste: **que siga rellenando el nombre de usuario automáticamente**

También validaré que, tras crear la cuenta, el vínculo quede completo:
- `employees.auth_user_id`
- `employees.email`
- `profiles.business_id`
- `profiles.branch_id`

Si algo de eso falla, la creación no quedará a medias.

---

### 3. Quitar ambigüedad en “Equipo activo”
**Archivo:** `src/components/employees/EquipoActivoSection.tsx`

Ahora se relaciona empleado ↔ perfil principalmente por email.  
Lo ajustaré para que, cuando exista `auth_user_id`, use esa relación como prioridad y deje el email solo como fallback legacy.

Eso evita que un email duplicado en otra fila termine afectando la tarjeta del equipo.

---

### 4. Limpiar los datos dañados que ya existen
Haré una limpieza puntual de datos existentes:

1. **Eliminar la fila fantasma de Tito** del negocio viejo
2. **Eliminar su salario fantasma** asociado a esa fila vieja
3. **Reparar el profile de Alex** para que tenga `business_id` y `branch_id` correctos
4. Ejecutar una revisión global sobre usuarios `@bivoo.app` para detectar y corregir:
   - perfiles sin negocio/sucursal
   - empleados duplicados por email
   - salarios activos colgados de filas sin vínculo real

Esto es importante: aunque el código quede bien, **si no limpio esos residuos, Tito seguirá viendo mezcla de datos**.

---

## Verificación que haré después
Probaré estos escenarios:

1. **Tito entra a `/mi-empleo`**
   - sale en el negocio correcto
   - ve a Alex en su equipo activo
   - no aparece el salario de la fila vieja

2. **Alex entra a `/mi-empleo`**
   - mantiene negocio/sucursal correctos
   - sigue apareciendo activo normalmente

3. **Vista de dueño / equipo activo**
   - Alex y Tito aparecen correctamente en el mismo equipo activo

4. **Prueba preventiva**
   - crear un empleado @bivoo.app nuevo
   - provocar un fallo controlado
   - confirmar que no queda fila fantasma ni salario huérfano
   - borrar y recrear para validar que no reaparece el conflicto

---

## Detalles técnicos
### Archivos a modificar
- `src/pages/MyEmployment.tsx`
- `src/pages/Employees.tsx`
- `src/components/employees/EquipoActivoSection.tsx`
- `supabase/functions/create-bivoo-employee/index.ts`

### Datos a corregir
- fila fantasma de Tito
- salario huérfano de Tito
- perfil incompleto de Alex
- revisión global de otros `@bivoo.app` con el mismo patrón

### Lo que NO voy a tocar
- permisos/roles del sistema
- POS
- inventario
- lógica de jornadas fuera de lo estrictamente necesario para este conflicto
- esquema de base de datos (no hace falta crear tablas nuevas)

### Resultado esperado
Después de esto:
- Tito dejará de tomar la fila equivocada
- el salario “raro” desaparecerá
- Alex y Tito saldrán juntos en el equipo activo correcto
- no se volverán a generar empleados fantasma ni salarios colgados para otros usuarios
