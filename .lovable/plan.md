

# Modulo de Gestion de Sucursales

## Que se va a construir

Una pagina completa en `/branches` donde el usuario podra:
1. **Ver** todas las sucursales de su negocio
2. **Crear** nuevas sucursales (con un aviso de que cada sucursal adicional eleva el costo del plan)
3. **Editar** los datos de una sucursal existente (nombre, direccion, telefono)
4. **Seleccionar** la sucursal activa en la que se trabajara -- esto afecta inventario, ventas, empleados, etc.
5. La sucursal activa se guardara en el perfil del usuario (`branch_id` en `profiles`) y sera visible en el sidebar/header

## Concepto clave: independencia por sucursal

Toda la operacion (inventario, ventas, empleados asignados) ya esta ligada a `branch_id` en la base de datos. Al cambiar la sucursal activa en el perfil, el sistema automaticamente filtra los datos correspondientes.

## Cambios necesarios

### 1. Nueva pagina `src/pages/Branches.tsx`
- Lista de sucursales en tarjetas con:
  - Nombre, direccion, telefono
  - Badge "Principal" para la sucursal main
  - Badge "Activa" para la sucursal seleccionada actualmente
  - Botones de Editar y Seleccionar
- Boton "Nueva Sucursal" con un aviso: "Cada sucursal adicional incrementara el costo de tu plan"
- Dialog para crear/editar sucursal (nombre*, direccion, telefono)
- Al seleccionar una sucursal, se actualiza `profiles.branch_id` y se refresca el contexto de autenticacion

### 2. Actualizar `src/contexts/AuthContext.tsx`
- Agregar funcion `switchBranch(branchId)` que actualiza el `branch_id` en el perfil y en el estado local
- Exponer `switchBranch` en el contexto para que cualquier componente pueda cambiar de sucursal

### 3. Actualizar `src/App.tsx`
- Cambiar la ruta `/branches` para que use el nuevo componente `Branches` en lugar de `Dashboard`

### 4. Indicador de sucursal activa en el sidebar
- Mostrar el nombre de la sucursal activa en el footer del sidebar, debajo del nombre del usuario
- Esto da visibilidad constante de en cual sucursal se esta trabajando

## Detalles tecnicos

### Pagina Branches.tsx
- Usa `useBranches()` hook existente para obtener las sucursales
- Crear sucursal: `INSERT INTO branches` con el `business_id` del usuario
- Editar sucursal: `UPDATE branches SET name, address, phone WHERE id = X`
- Seleccionar sucursal: `UPDATE profiles SET branch_id = X WHERE user_id = auth.uid()`
- Solo roles `owner` y `manager` pueden crear/editar sucursales (los vendedores solo pueden seleccionar)
- No se permite eliminar la sucursal principal (`is_main = true`)

### AuthContext - switchBranch
```
const switchBranch = async (branchId: string) => {
  await supabase.from('profiles').update({ branch_id: branchId }).eq('user_id', user.id);
  setProfile(prev => prev ? { ...prev, branch_id: branchId } : null);
};
```

### Sidebar - indicador
Debajo del nombre del usuario, una linea con el icono de Building2 y el nombre de la sucursal activa obtenido de `useBranches()`.

### No se requieren migraciones
La tabla `branches` y el campo `profiles.branch_id` ya existen. Las RLS policies ya estan configuradas correctamente.

