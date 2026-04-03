

## Plan: Limpieza completa al borrar empleado + prevención de duplicados

### Problemas

1. **Residuo al borrar**: `handleDeleteEmployee` solo borra la fila de `employees`. El usuario auth (`auth.users`), su `profiles`, y `user_roles` quedan huérfanos. Cuando recreas el empleado con el mismo nombre, el email `nombre@bivoo.app` ya existe en auth y falla o crea conflicto.

2. **Sin advertencia de duplicado**: Si ya existe un empleado con ese nombre, no se avisa al dueño antes de crear.

### Cambios

#### 1. Edge function `delete-bivoo-employee` (nuevo)

Crear `supabase/functions/delete-bivoo-employee/index.ts`:
- Recibe `employee_id`
- Busca el empleado, obtiene su `auth_user_id`
- Si tiene `auth_user_id` (es @bivoo.app):
  - Borra `user_roles` del auth_user_id
  - Borra `profiles` del auth_user_id
  - Borra el auth user via `admin.auth.admin.deleteUser()`
- Borra `employee_salary_assignments` del employee_id
- Borra `employee_branch_assignments` del employee_id
- Borra `employee_insumo_areas` del employee_id
- Borra la fila de `employees`
- Requiere que el caller sea owner o super_admin (verifica rol)

#### 2. `src/pages/Employees.tsx` — handleDeleteEmployee

Reemplazar el delete directo por una llamada a la edge function `delete-bivoo-employee`. Agregar confirmación antes de borrar ("¿Estás seguro? Se eliminará la cuenta de acceso del empleado").

#### 3. `supabase/functions/create-bivoo-employee/index.ts` — Prevenir duplicados

Antes de crear, verificar si ya existe un empleado con el mismo `full_name` en el mismo `business_id` en la tabla `employees`. Si existe, retornar error claro: "Ya existe un empleado con ese nombre en este negocio. Usa un nombre diferente."

Además, optimizar el check de email: en vez de `listUsers()` (lista TODOS), usar `getUserByEmail()` que es O(1).

#### 4. Admin — Borrado desde panel admin

En `src/pages/admin/AdminBusinesses.tsx` o `BusinessDetailSheet`, si hay botón de borrar empleado, usar la misma edge function `delete-bivoo-employee`.

### Flujo resultante

```text
BORRAR EMPLEADO:
1. Dueño/Admin clickea "Eliminar"
2. Confirmación: "Se eliminará el acceso del empleado"
3. Llama delete-bivoo-employee
4. Edge function: borra auth user + profile + roles + assignments + employee
5. Sin residuos ✅

CREAR EMPLEADO CON NOMBRE REPETIDO:
1. Dueño intenta crear "Juan Pérez" que ya existe
2. Edge function retorna: "Ya existe un empleado con ese nombre"
3. Dueño cambia el nombre → éxito ✅
```

### Archivos a crear
- `supabase/functions/delete-bivoo-employee/index.ts`

### Archivos a modificar
- `src/pages/Employees.tsx` (handleDeleteEmployee → edge function)
- `supabase/functions/create-bivoo-employee/index.ts` (validación duplicados + optimizar check email)

### Lo que NO se toca
- Auth, POS, inventario, nómina, contabilidad, sidebar

