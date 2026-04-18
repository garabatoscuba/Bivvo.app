

## Plan: tipo de negocio con nombre libre

### Entendimiento
El usuario no quiere un dropdown con 4 opciones fijas. Quiere escribir libremente el nombre del tipo de negocio (ej. "Barbería", "Taller mecánico", "Floristería"). Los 4 tipos preconfigurados (Tienda, Restaurante, Punto de Copias, Gimnasio) siguen siendo válidos como atajos rápidos, pero debe poder poner cualquier texto.

### Decisión clave
Mantener `business_type` como string libre en `businesses`. Cambiar el `<select>` por un **input de texto** con sugerencias rápidas de los 4 tipos preconfigurados (chips clickeables que rellenan el input). Así se respeta:
- Lógica de módulos: si el tipo coincide con un `key` de `business_type_configs` (`store`, `estaurente/safetería`, `copy_shop`, `gym`), aplica módulos de ese tipo. Si es libre, cae en comportamiento por defecto (genérico = como tienda).
- El campo es solo etiqueta visual cuando es libre.

### Cambios

**1. `src/components/layout/AppSidebar.tsx` — modal "Configurar Negocio"**
- Reemplazar `<select>` por `<Input>` de texto libre para `editBizType`.
- Debajo, una fila de chips "Sugerencias:" con los 4 tipos activos de `availableBusinessTypes` (al hacer clic, rellenan el input con su `key`).
- `updateBizMutation` sigue enviando el string tal cual al campo `business_type`.

**2. `src/components/hub/CreateBusinessModal.tsx` — crear negocio**
- Misma sustitución: input libre + chips de sugerencias.

**3. `src/components/onboarding/OnboardingWizard.tsx` — onboarding inicial**
- Misma sustitución: input libre + chips de sugerencias.

**4. Visualización del tipo (Sidebar líneas 750-806, etc.)**
- El mapping actual traduce `key` → label bonito ("Tienda", "Restaurante / Cafetería"...). Si el valor no coincide con ningún key conocido, mostrar el string tal cual (capitalizado). Pequeño helper `formatBusinessTypeLabel(type)`.

### Lo que NO se toca
- Tabla `business_type_configs` (sigue con sus 4 entradas para módulos).
- Lógica de módulos por tipo (solo se activan módulos especiales si el tipo coincide con un `key` conocido).
- Roles, auth, POS, inventario.

### Archivos
- `src/components/layout/AppSidebar.tsx`
- `src/components/hub/CreateBusinessModal.tsx`
- `src/components/onboarding/OnboardingWizard.tsx`

