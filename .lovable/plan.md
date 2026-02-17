

# Sistema de Planes, Suscripciones y Prueba Gratuita

## Resumen

Implementar un sistema completo de planes y suscripciones con prueba gratuita por tiempo, cobro manual via WhatsApp, y bloqueo de acceso cuando la suscripcion expira. Los usuarios veran los planes de forma clara e intuitiva, con un boton de WhatsApp siempre visible para contacto.

## Modelo de negocio

- **Prueba gratuita**: 14 dias desde el registro, acceso completo
- **Plan MVP**: $10 USD/mes por negocio (1 sucursal incluida)
- **Sucursales extra**: $10 USD/mes cada una
- **Cobro**: Manual. El usuario contacta por WhatsApp, paga, y el Super Admin activa/extiende la suscripcion
- **Futuro**: Pasarela de pago automatica (no se implementa ahora, pero se deja preparado el campo `payment_method` en la BD)

## Cambios en la base de datos

### Migracion: agregar campos a `businesses`

```sql
ALTER TABLE businesses
  ADD COLUMN trial_ends_at timestamptz DEFAULT (now() + interval '14 days'),
  ADD COLUMN subscription_ends_at timestamptz,
  ADD COLUMN plan_type text DEFAULT 'trial',
  ADD COLUMN max_branches integer DEFAULT 1;
```

- `trial_ends_at`: fecha de fin de prueba (se calcula al crear el negocio)
- `subscription_ends_at`: fecha hasta la cual esta pagada la suscripcion (null = no pagada)
- `plan_type`: 'trial', 'mvp', o futuros planes
- `max_branches`: cuantas sucursales puede tener (1 por defecto, el admin lo ajusta al cobrar extras)

### Actualizar trigger `handle_new_user`

El trigger ya crea el negocio con status `pending`. Se ajustara para que `trial_ends_at` se calcule automaticamente (ya lo hara el DEFAULT de la columna).

## Nuevos archivos y componentes

### 1. Pagina de Planes `/plans` (nueva)

Pagina publica accesible desde el sidebar y desde banners. Muestra:

- **Card de prueba gratuita**: "14 dias gratis, acceso completo"
- **Card Plan MVP ($10/mes)**: lista de funciones incluidas (POS, inventario, empleados, reportes, 1 sucursal)
- **Card Sucursales Extra**: "+$10/mes por sucursal adicional"
- **Boton de WhatsApp prominente**: "Contactar para activar" con enlace directo `https://wa.me/NUMERO`
- **Estado actual del usuario**: muestra si esta en prueba (y cuantos dias le quedan), activo, o vencido

### 2. Hook `useSubscription` (nuevo)

Hook que calcula el estado de la suscripcion del negocio:

```typescript
// Logica:
// 1. Si plan_type === 'trial' y trial_ends_at > now() => en prueba, mostrar dias restantes
// 2. Si subscription_status === 'active' y subscription_ends_at > now() => activo
// 3. Si subscription_status === 'active' y subscription_ends_at <= now() => vencido (bloquear)
// 4. Si subscription_status === 'suspended' o 'cancelled' => bloqueado
// 5. Si trial vencido y no tiene suscripcion => bloqueado
```

Retorna: `{ status, daysLeft, isBlocked, planType, trialEndsAt, subscriptionEndsAt }`

### 3. Componente `SubscriptionBanner` (nuevo)

Banner que aparece en el layout principal:
- **En prueba**: banner azul "Te quedan X dias de prueba gratuita. Ver planes"
- **Por vencer (menos de 3 dias)**: banner amarillo/naranja de urgencia
- **Vencido/bloqueado**: banner rojo con boton de WhatsApp para renovar
- No se muestra si la suscripcion esta activa y vigente

### 4. Componente `SubscriptionGate` (nuevo)

Wrapper que bloquea el acceso a las rutas protegidas cuando la suscripcion esta vencida:
- Si esta bloqueado, redirige a `/plans` en lugar de mostrar el contenido
- Permite siempre acceso a `/settings` y `/plans`
- El Super Admin nunca es bloqueado

### 5. Boton flotante de WhatsApp (nuevo)

Boton circular flotante en la esquina inferior derecha con icono de WhatsApp. Visible en toda la app. Abre enlace directo al chat de WhatsApp con un mensaje predefinido como "Hola, me interesa activar/renovar mi plan de GestorPro".

## Cambios en archivos existentes

### `src/App.tsx`
- Agregar ruta `/plans` (publica para usuarios autenticados)
- Agregar componente `WhatsAppButton` flotante global

### `src/components/layout/AppLayout.tsx`
- Insertar `SubscriptionBanner` arriba del contenido

### `src/components/layout/AppSidebar.tsx`
- Agregar item "Planes" en el menu con icono de `CreditCard` o `Crown`

### `src/components/auth/ProtectedRoute.tsx`
- Integrar `SubscriptionGate`: si el negocio esta bloqueado y la ruta no es `/plans` ni `/settings`, redirigir a `/plans`

### `src/pages/admin/AdminBusinesses.tsx`
- Agregar columnas visibles: `plan_type`, `trial_ends_at`, `subscription_ends_at`
- Agregar accion para que el Super Admin pueda extender la suscripcion (input de fecha `subscription_ends_at`) y cambiar `plan_type` a 'mvp'
- Agregar accion para ajustar `max_branches`

### `src/contexts/AuthContext.tsx`
- Agregar datos de suscripcion del negocio al contexto (o delegarlo al hook `useSubscription`)

## Flujo del usuario

```text
1. Usuario se registra
   -> Se crea negocio con plan_type='trial', trial_ends_at=+14 dias, status='pending'

2. Durante la prueba (14 dias)
   -> Banner azul: "Te quedan X dias de prueba"
   -> Acceso completo a todas las funciones
   -> Item "Planes" visible en el menu

3. Prueba por vencer (ultimos 3 dias)
   -> Banner naranja: "Tu prueba vence en X dias. Contactanos por WhatsApp"

4. Prueba vencida
   -> Banner rojo: "Tu prueba ha vencido"
   -> Se bloquea acceso a POS, Inventario, etc.
   -> Solo acceso a /plans y /settings
   -> Boton de WhatsApp prominente

5. Usuario paga via WhatsApp
   -> Super Admin va a /admin/businesses
   -> Cambia plan_type a 'mvp'
   -> Pone subscription_status='active'
   -> Establece subscription_ends_at (ej: +30 dias)

6. Suscripcion activa
   -> Sin banners, acceso completo
   -> Si se acercan los ultimos 3 dias, banner de renovacion
```

## Flujo del Super Admin

```text
1. Va a /admin/businesses
2. Ve la tabla con columnas: Negocio, Dueno, Plan, Estado, Vence, Sucursales
3. Click en "Gestionar" abre un dialog con:
   - Selector de plan (trial/mvp)
   - Input de fecha de vencimiento
   - Input de max sucursales
   - Selector de estado (active/suspended/cancelled)
   - Boton guardar
```

## Archivos a crear

| Archivo | Descripcion |
|---------|-------------|
| `src/pages/Plans.tsx` | Pagina de planes y precios |
| `src/hooks/useSubscription.ts` | Hook de estado de suscripcion |
| `src/components/layout/SubscriptionBanner.tsx` | Banner de estado de suscripcion |
| `src/components/layout/WhatsAppButton.tsx` | Boton flotante de WhatsApp |

## Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `src/App.tsx` | Ruta /plans + WhatsAppButton |
| `src/components/layout/AppLayout.tsx` | SubscriptionBanner |
| `src/components/layout/AppSidebar.tsx` | Item "Planes" en menu |
| `src/components/auth/ProtectedRoute.tsx` | SubscriptionGate logic |
| `src/pages/admin/AdminBusinesses.tsx` | Gestion de suscripciones |

## Detalles tecnicos

### Numero de WhatsApp
Se usara el numero que el usuario proporcione. El enlace sera:
`https://wa.me/NUMERO?text=Hola%2C%20me%20interesa%20activar%20mi%20plan%20de%20GestorPro`

### No se necesitan edge functions
Todo el control de suscripcion se hace desde el cliente leyendo los campos del negocio. El Super Admin actualiza manualmente. No hay logica de backend adicional necesaria por ahora.

### Preparado para pasarela de pago futura
El campo `plan_type` y la estructura de la pagina de planes permiten agregar Stripe u otra pasarela mas adelante sin cambios estructurales grandes.

