
<final-text>
Hallazgo
- Sí existen portales activos. La prueba es que `store_settings` ya está devolviendo 7 filas con `is_active = true`.
- El problema real no es falta de datos: las consultas siguientes a `branches` y `businesses` están fallando con error 500.
- El error exacto en red es: `infinite recursion detected in policy` para `branches` y `businesses`.

Qué pasó
- La última migración agregó estas políticas públicas:
  - `Anyone can view active store settings`
  - `Anyone can view branches with active storefront`
  - `Anyone can view businesses with active storefront`
- Esas políticas se cruzan con políticas previas ya existentes de `branches` y `businesses`, y terminan referenciándose entre sí.
- Resultado: el hub no puede resolver ni el directorio “Explorar” ni algunas consultas personales del Hub.

Plan de corrección
1. Revertir solo la apertura pública defectuosa del último cambio.
- Crear una nueva migración que haga `DROP POLICY IF EXISTS` de esas 3 políticas públicas recientes.
- Esto elimina la recursión y devuelve estabilidad a `businesses`/`branches`.

2. Exponer el directorio público de forma segura, sin abrir tablas completas.
- Crear una función SQL `SECURITY DEFINER`, por ejemplo `public.list_public_storefronts()`.
- Esa función hará internamente el join entre:
  - `businesses`
  - `branches`
  - `store_settings`
- Filtrará solo negocios con portal activo (`store_settings.is_active = true`) y negocio activo.
- Devolverá únicamente los campos que el Hub necesita:
  - id
  - name
  - slug
  - business_type
  - keywords
  - logo_url
  - hero_image_url
  - accent_color
  - schedule
  - address
- Así evitamos exponer columnas sensibles de tablas base y evitamos RLS recursivo.

3. Cambiar solo la carga de datos del directorio en `src/components/hub/HubSearchAndExplore.tsx`.
- Sustituir la cadena actual de 3 queries (`store_settings` → `branches` → `businesses`) por una sola llamada `supabase.rpc(...)`.
- Mantener intactos:
  - buscador
  - dropdown en tiempo real
  - tarjetas
  - badge Abierto/Cerrado
  - chips
  - layout y estilos

4. No tocar nada más del Hub.
- No cambiar `Hub.tsx`
- No cambiar rutas
- No tocar estilos visuales
- No tocar dashboard, auth, sidebar ni otras pantallas

Por qué esta es la solución correcta
- Corrige la causa real del bug: la recursión en RLS.
- Evita dejar lectura abierta sobre tablas completas como `businesses` y `branches`.
- Mantiene el comportamiento visual ya implementado.
- Además, al quitar la política recursiva de `businesses`, también debería volver a cargar bien la parte de “Mis negocios” del Hub sin tocar esa lógica.

Validación después del fix
- Entrar a `/` y confirmar que ya no hay 500 en requests a `businesses` y `branches`.
- Ver en “Explorar en Bivoo” negocios reales como “Vision Habana” y “Mercadito Dito”.
- Buscar por nombre y keywords y confirmar resultados en tiempo real.
- Tocar una tarjeta o resultado y abrir `/s/{slug}` correctamente.
- Verificar dos casos:
  - usuario sin contextos: bienvenida + buscador + directorio primero
  - usuario con contextos: secciones personales arriba + directorio abajo

Archivos implicados
- Nueva migración SQL para quitar políticas recursivas y crear la función segura
- `src/components/hub/HubSearchAndExplore.tsx`

No voy a tocar
- `src/pages/Hub.tsx`
- estilos del Hub
- otras rutas o módulos
- auth, roles o permisos fuera de este fix puntual
</final-text>
