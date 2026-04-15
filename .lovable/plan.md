

## Plan: Nuevo flujo de creación de empleados — búsqueda por correo + invitación

### Situación actual

El formulario de nuevo empleado tiene un checkbox "Crear identificador @bivoo.app" que genera una cuenta interna con contraseña. Alternativamente permite escribir un email manualmente. La creación pasa por la edge function `create-bivoo-employee`.

### Nuevo flujo

1. El campo principal del formulario es **"Buscar usuario por correo electrónico"** con autocompletado desde la tabla `profiles`
2. Al seleccionar un usuario existente: se autocompletan nombre y correo, se vincula al crear
3. Si el correo no existe: se muestra un botón **"Enviar invitación"** que usa `auth.admin.inviteUserByEmail` desde una nueva edge function
4. Se elimina completamente: el checkbox `use_bivoo_id`, el campo de contraseña inicial, y la llamada a `create-bivoo-employee`

### Cambios

**1. Nueva edge function `supabase/functions/invite-employee/index.ts`**
- Recibe `email`, `business_id`, `branch_id`, `position`, `employee_id`
- Usa `admin.auth.admin.inviteUserByEmail(email)` para enviar invitación nativa de Supabase
- Registra el `auth_user_id` resultante en el employee record
- Crea el perfil/roles necesarios

**2. Editar `src/pages/Employees.tsx`**
- Eliminar del `EmployeeForm`: `use_bivoo_id`, `bivoo_password`
- Reemplazar la sección de email/bivoo toggle (líneas ~1083-1134) con un campo de búsqueda por correo que:
  - Al escribir, busca en `profiles` por email (usando query con `ilike`)
  - Muestra dropdown con sugerencias (nombre + email)
  - Al seleccionar: autocompleta `full_name` y `email`
  - Si no hay resultados: muestra botón "Enviar invitación a [email]"
- En `handleSaveEmployee`: eliminar bloque `create-bivoo-employee` (líneas 499-522), reemplazar con lógica de vinculación directa si el usuario existe, o invocación de `invite-employee` si es nuevo
- Mantener password update para empleados ya vinculados (edición)

**3. Sin cambios en**
- `delete-bivoo-employee` (sigue funcionando para limpiar cuentas existentes)
- Roles, sucursales, salario, áreas de insumos — todo igual
- Ningún otro módulo

### Detalle técnico

```text
Flujo anterior:
  Nombre + Contraseña → create-bivoo-employee → cuenta @bivoo.app → vinculado

Flujo nuevo:
  Buscar email → ¿Existe en profiles?
    SÍ → Autocompleta nombre, vincula auth_user_id al guardar
    NO → "Enviar invitación" → invite-employee → email de registro → vincula al aceptar
```

### Archivos nuevos
- `supabase/functions/invite-employee/index.ts`

### Archivos editados
- `src/pages/Employees.tsx` — formulario + lógica de guardado

