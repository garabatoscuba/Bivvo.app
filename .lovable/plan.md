

## Plan: No borrar el rol owner al vincular empleado

### Problema

La edge function `invite-employee` borra el rol `owner` del usuario al vincularlo como empleado (líneas 76, 118 y 163). Esto fue pensado para usuarios **nuevos** que reciben un `owner` automático del trigger de signup, pero también afecta a usuarios que **ya son dueños legítimos** de su negocio.

### Solución

Cambiar la lógica: en vez de borrar siempre el rol `owner`, solo borrarlo si el usuario fue **recién invitado** (usuario nuevo creado por `inviteUserByEmail`). Para usuarios existentes que ya tienen negocios, preservar todos sus roles y solo **agregar** el nuevo rol de empleado.

### Cambios

**1. `supabase/functions/invite-employee/index.ts`**

- **Línea 76**: Eliminar `await admin.from("user_roles").delete()...eq("role", "owner")` del bloque de usuario existente
- **Línea 118**: Eliminar la misma línea del bloque de retry (race condition)
- **Línea 163**: Mantener solo en el bloque de usuario **nuevo invitado** (creado por `inviteUserByEmail`), donde el trigger de signup sí crea un owner accidental

**2. Restaurar el rol owner del usuario afectado** (migración de datos)

- Insertar de vuelta el rol `owner` para el usuario que perdió su rol

### No se toca
- Ningún otro archivo, módulo, ni lógica

