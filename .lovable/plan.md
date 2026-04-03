

## Plan: Corregir residuos en creación/eliminación de empleados @bivoo.app

### Problemas encontrados

1. **Perfil sin negocio**: `create-bivoo-employee` crea el auth user, el trigger `handle_new_user` genera un profile con `business_id = NULL` y `branch_id = NULL`. La función **nunca actualiza el profile** con el `business_id`/`branch_id` del empleado. Por eso tito@bivoo.app aparece "sin negocio asociado".

2. **`getUserByEmail` lanza error en vez de null**: La API de Supabase Admin `getUserByEmail()` lanza un error cuando el usuario no existe (en vez de retornar `{data: null}`). El loop de unicidad de email se rompe en la primera iteración si el email no existe, pero si SÍ existe un residuo, el error puede confundir la lógica.

3. **Residuos previos**: Si `tito@bivoo.app` fue borrado parcialmente antes de que existiera `delete-bivoo-employee`, el auth user sigue en `auth.users` con ese email. Al recrear, `getUserByEmail` lo encuentra, incrementa a `tito1@bivoo.app`, y el empleado queda con un email diferente al esperado. Además el profile viejo puede seguir huérfano.

4. **Aviso de nombre duplicado**: Funciona correctamente (query `.ilike` en employees), no se toca.

### Cambios

#### 1. `supabase/functions/create-bivoo-employee/index.ts`

**a)** Después de crear el auth user y esperar el trigger, actualizar el profile del nuevo usuario con `business_id` y `branch_id`:

```typescript
// Después del setTimeout de 1500ms
await admin.from("profiles")
  .update({ business_id, branch_id: branch_id || null })
  .eq("user_id", userId);
```

**b)** Envolver `getUserByEmail` en try/catch para manejar el error 404 correctamente:

```typescript
while (true) {
  try {
    const { data: existing } = await admin.auth.admin.getUserByEmail(email);
    if (!existing?.user) break;
  } catch {
    break; // User doesn't exist, email is available
  }
  attempt++;
  email = `${baseSlug}${attempt}@bivoo.app`;
  if (attempt > 20) { ... }
}
```

**c)** Antes de crear el auth user, limpiar residuos: si existe un auth user con ese email que NO tiene empleado activo, eliminarlo automáticamente (cleanup de borrados parciales previos).

#### 2. `supabase/functions/delete-bivoo-employee/index.ts`

Sin cambios estructurales — la lógica es correcta. Solo agregar manejo de errores más robusto: si `deleteUser` falla, loguear pero no fallar la operación completa (ya lo hace).

#### 3. Admin panel

El admin (`BusinessDetailSheet`) no tiene botón de borrar empleados, por lo que no necesita cambios. Solo `Employees.tsx` usa `delete-bivoo-employee`, y eso ya está correcto.

### Flujo corregido

```text
CREAR EMPLEADO @bivoo.app:
1. Insert en employees (business_id, branch_id)
2. Verificar nombre duplicado en employees ✅
3. Generar email slug, verificar en auth (con try/catch)
4. Si hay residuo auth con ese email → limpiarlo primero
5. Crear auth user → trigger crea profile (sin business)
6. Esperar 1.5s → actualizar profile con business_id + branch_id ✅
7. Vincular employee.auth_user_id + email
8. Asignar rol correcto

BORRAR EMPLEADO:
→ delete-bivoo-employee borra todo atómicamente ✅ (ya implementado)
```

### Archivos a modificar
- `supabase/functions/create-bivoo-employee/index.ts`

### Lo que NO se toca
- El formulario de nombre de usuario en Employees.tsx (sigue rellenándose igual)
- `delete-bivoo-employee` (ya funciona correctamente)
- Auth, POS, inventario, nómina, sidebar

