

## Plan: Ajustar toggles de conteo y enlazar cierre de jornada correctamente

### Resumen

Actualmente existe un solo toggle (`is_jefe` = "Responsable de conteo") que controla si el empleado cuenta productos al cerrar jornada. Si no es `is_jefe`, va al modal simple (`CerrarJornadaModal`) que no tiene conteo de efectivo ni de productos.

**Problema**: No hay forma de separar "contar productos" de "contar dinero de caja". Además, empleados sin `is_jefe` cierran con un modal básico sin conteo de caja.

**Solución**: Agregar un segundo campo `is_cash_counter` (boolean) en la tabla `employees` para indicar si el empleado debe contar efectivo. Modificar la lógica de cierre para que `ContarYCerrarModal` soporte ambos toggles independientemente.

---

### Cambios

#### 1. Migración de base de datos
Agregar columna `is_cash_counter` (boolean, default false) a la tabla `employees`.

#### 2. `src/pages/Employees.tsx` — Formulario de empleado
- **Renombrar** el toggle actual de "Responsable de conteo" → descripción genérica:
  - Label: "Responsable de conteo"
  - Sublabel: "Cuenta productos de su área al cerrar jornada" (sin diferenciar ventas/área)
- **Agregar nuevo toggle** debajo:
  - Label: "Conteo de caja"
  - Sublabel: "Cuenta el dinero de caja al cerrar jornada"
  - Campo: `is_cash_counter`
- Ambos toggles visibles para **todos los roles** (vendedor, operario, gerente), no solo seller/operator
- Guardar `is_cash_counter` en create y update

#### 3. `src/pages/MyEmployment.tsx` — Lógica de cierre
- Leer `is_cash_counter` del registro del empleado
- Nueva lógica de decisión:
  - Si `is_jefe` O `is_cash_counter` → abrir `ContarYCerrarModal` (pasando flags)
  - Si ninguno → abrir `CerrarJornadaModal` (cierre simple)
- Pasar nuevas props `needsInventoryCount` y `needsCashCount` a `ContarYCerrarModal`

#### 4. `src/components/employees/ContarYCerrarModal.tsx` — Modal de cierre
- Recibir props `needsInventoryCount` y `needsCashCount`
- Ajustar los pasos dinámicamente:
  - Si solo `needsInventoryCount`: paso 1 = inventario, cierra sin conteo de caja
  - Si solo `needsCashCount`: paso 1 = conteo de caja directo (sin inventario)
  - Si ambos: paso 1 = inventario, paso 2 = caja (flujo actual)
  - El indicador "Paso X de Y" se adapta al número de pasos reales

#### 5. Employee type interface
- Agregar `is_cash_counter?: boolean` a la interfaz `Employee` en `MyEmployment.tsx` y `Employees.tsx`
- Agregar al `formDefaults` en `Employees.tsx`

### Lo que NO se toca
- Auth, POS, inventario, sidebar, vendedores, tesorería
- No se cambia el contenido de `CashCalculator` ni `InventoryCountStep`
- No se modifica `CerrarJornadaModal` (sigue como fallback para empleados sin ningún conteo)

