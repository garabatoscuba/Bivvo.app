

## Plan: logo del Hub según tema + mejor contraste de textos

### 1. Logo del Hub (modo claro arregla)
**`src/pages/Hub.tsx` líneas 252-256**: hoy el `<img>` tiene `src="/logo-dark.png"` fijo. Replicar lo que hace el sidebar:
```tsx
src={isDark ? "/logo-dark.png" : "/logo-light.png"}
```
La variable `isDark` ya existe en el componente (línea 48). Cero lógica nueva.

### 2. Mejor contraste de textos (claro y oscuro)
En `src/index.css`, los tokens del Hub `--hub-text2` y `--hub-text3` son los que generan los textos secundarios/dim que se ven lavados en la captura.

**Modo claro (`:root` bloque `─── HUB ───`):**
- `--hub-text2`: `#6b6970` → `#3f3d44` (texto secundario más oscuro y legible sobre `#f6f5f3`).
- `--hub-text3`: `#9b99a0` → `#6b6970` (dim/labels más visibles).
- `--hub-text` ya es `#1a1a1a`, queda igual.

**Modo oscuro (`.dark` bloque Hub):**
- `--hub-text2`: `#888690` → `#b8b6c0` (más claro sobre `#0b0b0d`).
- `--hub-text3`: `#555360` → `#85838f` (dim ya no se pierde con el fondo).
- `--hub-text` ya es `#eeeae4`, queda igual.

Estos tokens los consumen las clases `hub-text-muted`, `hub-text-dim`, `hub-search-input::placeholder`, `hub-stat-label`, `hub-anuncio-eyebrow`, `hub-anuncio-desc`, `hub-portal-type`, etc. → todo el Hub se beneficia automáticamente.

### Lo que NO se toca
- Tipografías, tamaños, layout, espaciados.
- Topbar visual (solo cambia el `src` del `<img>`).
- Tokens `--foreground`, `--muted-foreground` globales (solo los `--hub-*`).
- Dashboard, sidebar, módulos internos.

### Archivos
- `src/pages/Hub.tsx` (1 línea, el `src` del logo).
- `src/index.css` (4 valores HEX dentro del bloque `─── HUB ───` claro y oscuro).

