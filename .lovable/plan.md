
Objetivo: hacer que la ruta raíz `/` funcione como Hub real y se quede en el Hub, sin el pestañeo ni el salto automático a `/dashboard`.

Hallazgo
- La ruta ya está bien configurada: `src/App.tsx` ya apunta `/` → `Hub`.
- El problema no es de publicación ni de hosting.
- El salto ocurre dentro de `src/pages/Hub.tsx`: hay un `useEffect` que, si el usuario tiene exactamente 1 contexto, redirige automáticamente a `/dashboard` o `/mi-empleo`.
- El parche actual con `location.state?.fromNav` solo cubre algunos clics desde la navegación, pero no resuelve acceso directo a `/`, refresh, login, ni apertura desde la URL publicada.

Implementación propuesta
1. Quitar el auto-redirect de contexto único en `src/pages/Hub.tsx`.
   - Eliminar la lógica que manda a `/dashboard` o `/mi-empleo` al entrar en `/`.
   - Con esto, entrar a la raíz siempre mostrará el Hub completo.

2. Mantener intacta la navegación intencional desde el Hub.
   - Las tarjetas de negocio seguirán entrando a `/dashboard`.
   - Las tarjetas de empleo seguirán entrando a `/mi-empleo`.
   - O sea: el dashboard se abre desde una tarjeta del Hub, no automáticamente al cargar `/`.

3. Limpiar solo lo que quede sobrando en `Hub.tsx`.
   - `redirectedRef`
   - `explicitNav`
   - el `return null` usado solo para esconder la pantalla mientras redirigía
   - sin tocar estilos, layout, buscador, secciones ni animaciones

Qué NO voy a tocar
- `src/App.tsx` y el resto de rutas
- `ProtectedRoute`
- login, callback de auth, roles o permisos
- estilos visuales del Hub
- dashboard, POS, inventario, jornadas o cualquier módulo ajeno

Detalles técnicos
- Archivo principal: `src/pages/Hub.tsx`
- Cambio exacto:
  - remover el `useEffect` de líneas donde calcula `total === 1`
  - conservar `handleBusinessClick()` y `handleEmploymentClick()`
  - conservar toda la UI actual del Hub tal como está

Validación después del cambio
- Abrir `/` directamente: debe quedarse en el Hub
- Hacer login: debe terminar en `/` y quedarse en el Hub
- Tocar el logo/raíz desde `/dashboard`: debe abrir el Hub sin salto de vuelta
- Probar un usuario con:
  - 1 solo negocio
  - 1 solo empleo
  - sin contextos
- Verificar que las tarjetas sigan entrando correctamente a `/dashboard` o `/mi-empleo`

Resultado esperado
- `/` pasa a ser siempre el Hub
- desaparece el pestañeo
- el dashboard solo se abre cuando el usuario elige un negocio desde el Hub
