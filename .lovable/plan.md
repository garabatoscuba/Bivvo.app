

## Plan: arreglar topbar del Hub para que se oculte/muestre con scroll

### Problema
La topbar quedó fija arriba y no responde al scroll. Aunque añadimos `hideTopbar` state, el listener probablemente está escuchando `window` pero el scroll real ocurre dentro de un contenedor interno (overflow), por eso `window.scrollY` siempre es 0 y nunca cambia.

### Diagnóstico
El Hub renderiza dentro de `AppLayout` o tiene su propio wrapper con `overflow-y-auto`. Necesito verificar:
- En `Hub.tsx`: identificar el contenedor que scrollea (probablemente un `<div>` con `overflow-y-auto` o `h-screen overflow-auto`).
- Adjuntar el listener a ese contenedor (via ref) en vez de `window`.

### Cambios en `src/pages/Hub.tsx`

1. **Crear ref del contenedor scrolleable**: `scrollRef = useRef<HTMLDivElement>(null)` y asignarlo al div principal con overflow.

2. **Reemplazar listener `window`** por listener sobre `scrollRef.current`:
```tsx
useEffect(() => {
  const el = scrollRef.current;
  if (!el) return;
  const onScroll = () => {
    const y = el.scrollTop;
    if (y < 80) { setHideTopbar(false); lastScrollY.current = y; return; }
    if (y > lastScrollY.current + 8) setHideTopbar(true);
    else if (y < lastScrollY.current - 8) setHideTopbar(false);
    lastScrollY.current = y;
  };
  el.addEventListener('scroll', onScroll, { passive: true });
  return () => el.removeEventListener('scroll', onScroll);
}, []);
```

3. **Topbar**: confirmar que tiene `sticky top-0 z-50 transition-transform duration-300` y aplica `-translate-y-full` cuando `hideTopbar`. Si está como `fixed`, cambiar a `sticky` para que viva dentro del contenedor scrolleable y la animación funcione.

### Lo que NO se toca
- Diseño visual de la barra (logo, dropdown, botones).
- Resto del Hub (HubEditorial, HubSearchAndExplore).
- Otras rutas/AppLayout.

### Archivo
- `src/pages/Hub.tsx` (ref + listener al contenedor + verificar `sticky`).

