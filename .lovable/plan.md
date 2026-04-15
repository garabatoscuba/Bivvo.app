

## Plan: Implementar Hub Principal de Bivoo

### Resumen

Crear una nueva página Hub (`/hub`) que actúa como punto de entrada post-login. Muestra tres secciones: negocios propios, empleos, y afiliaciones. Si el usuario tiene un solo contexto (solo un negocio propio, o solo un empleo), redirige directamente al dashboard sin mostrar el hub.

### Arquitectura

```text
Login → ProtectedRoute "/" → Hub.tsx
  ├─ Solo 1 contexto → redirect a /dashboard (o /mi-empleo)
  └─ Múltiples contextos → Render Hub con topbar propia
       ├─ Mis negocios (businesses donde owner_id = profile.id)
       ├─ Donde trabajo (employees donde auth_user_id = user.id)
       └─ Mis afiliaciones (affiliates donde email = profile.email)
```

### Archivos

**1. Crear `src/pages/Hub.tsx`** — Página principal del hub
- Topbar flotante personalizada (sin sidebar): logo Bivoo, switch tema, nube, soporte WhatsApp, avatar dropdown (nombre, email, cerrar sesión)
- Scroll listener para efecto transparent→blur
- Query `businesses` por `owner_id = profile.id` con branches count
- Query `employees` por `auth_user_id = user.id` con join a businesses y jornada activa
- Query `affiliates` por `email = profile.email` con join a branches→businesses
- Si total de contextos === 1: redirect automático
- Click en negocio propio → switchBranch + navigate `/dashboard`
- Click en empleo → navigate `/mi-empleo`
- Click en afiliación → navigate `/s/{slug}`
- "Crear negocio" → reutiliza la lógica existente de create-business
- Estilos CSS exactos del HTML: colores, tipografías Cormorant Garamond + DM Sans, animaciones fadeUp con stagger, efectos hover (línea lateral, flecha, shimmer sweep)
- Sin "Unirme a un negocio" ni "Afiliarme" — solo datos reales
- Sin datos de dinero en tarjetas

**2. Editar `src/index.css`**
- Agregar import de Cormorant Garamond font
- Agregar keyframes: `fadeUp`, `dotPulse`, `ripple`, `sweep`
- Agregar CSS variables del hub (colores oscuro/claro)

**3. Editar `src/App.tsx`**
- Ruta `/` apunta a Hub (en vez de Dashboard)
- Ruta `/dashboard` apunta a Dashboard (con AppLayout)
- Hub envuelto en ProtectedRoute sin AppLayout

**4. Editar `src/components/layout/AppSidebar.tsx`**
- Eliminar el `SidebarFooter` completo (tema toggle, avatar, logout)
- Agregar link al hub (logo/home) en el SidebarHeader

**5. Editar `src/components/auth/ProtectedRoute.tsx`**
- Sin cambios funcionales, solo asegurar que `/hub` no sea bloqueado por subscription

### CSS del Hub (fidelidad total al HTML)

Los colores, border-radius (14px), tipografías (Cormorant Garamond serif para nombres y números, DM Sans para body), tamaños de iconos (34px cards, 36px feed), espaciados (18px padding cards), y todas las transiciones/animaciones se replican exactamente del HTML adjunto. Soporte dark/light con variables CSS.

### Lógica de auto-redirect

```text
contextos = owned_businesses.length + employments.length
if contextos === 1:
  if owned_businesses.length === 1 → switchBranch(main) → /dashboard
  if employments.length === 1 → /mi-empleo
// afiliaciones no cuentan como contexto operativo
```

### No se toca
- Auth, roles, permisos
- POS, Inventario, Jornadas, Tesorería
- Módulos internos existentes
- Lógica de sidebar (excepto footer)

