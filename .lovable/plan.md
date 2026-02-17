
# Pagina de Configuracion

## Que se va a construir

Crear una pagina de Configuracion completa (`/settings`) que reemplace el Dashboard que se muestra actualmente en esa ruta. La pagina incluira varias secciones organizadas con tabs.

## Secciones

### 1. Perfil de Usuario
- Nombre completo (editable, se guarda en `profiles.full_name`)
- Email (solo lectura)
- Telefono (editable, se guarda en `profiles.phone`)
- Boton "Guardar cambios"

### 2. Apariencia
- Toggle de modo oscuro / claro / sistema usando `next-themes` (ya instalado como dependencia)
- Tres opciones visuales: Claro, Oscuro, Sistema
- Se aplica inmediatamente al seleccionar

### 3. Negocio
- Nombre del negocio (editable, se guarda en `businesses.name`)
- Logo del negocio (solo visualizacion por ahora, campo `businesses.logo_url`)
- Solo visible para usuarios con rol `owner` o `manager`

### 4. Seguridad
- Boton para cambiar contrasena (usa `supabase.auth.updateUser`)
- Campos: contrasena actual (no requerido por Supabase), nueva contrasena, confirmar contrasena

## Cambios tecnicos

### 1. Agregar ThemeProvider en `src/App.tsx`
- Importar `ThemeProvider` de `next-themes`
- Envolver la app con `ThemeProvider` con `attribute="class"` (ya configurado en tailwind con `darkMode: ["class"]`)
- Los estilos dark ya estan definidos en `index.css`

### 2. Crear `src/pages/Settings.tsx`
- Pagina nueva con `AppLayout`
- Usa `Tabs` de radix para organizar las secciones (Perfil, Apariencia, Negocio, Seguridad)
- Cada tab con su formulario correspondiente
- Seccion de Apariencia usa `useTheme()` de `next-themes` para cambiar entre light/dark/system
- Formularios usan `useState` y llamadas directas a Supabase para guardar

### 3. Actualizar ruta en `src/App.tsx`
- Cambiar la ruta `/settings` para que renderice `Settings` en lugar de `Dashboard`

### Archivos a crear/modificar
- `src/pages/Settings.tsx` (nuevo)
- `src/App.tsx` (agregar ThemeProvider + cambiar ruta /settings)

### Sin migraciones de base de datos
Todos los campos necesarios ya existen en las tablas `profiles` y `businesses`.
