## Problema
En móvil las celdas se ven apretadas entre sí pero a la vez dejan un espacio grande contra la columna de totales (0,0,0,2). Se debe a tres cosas en `WeeklyHeatmap.tsx`:

1. Cada celda usa `width: '92%'` con `margin: 0 auto`, lo que recorta ~8% del ancho disponible (separación contra los totales).
2. La columna derecha reserva `38px` fijos en móvil.
3. El `gap-x-2` entre la grilla y la columna de totales suma más aire.

## Cambios (solo `src/components/dashboard/easy/WeeklyHeatmap.tsx`)

1. **Celdas al 100% de ancho** con un pequeño padding interno para que respiren sin perder alcance:
   - Quitar `width: '92%'` y `margin: '0 auto'`.
   - Subir el `gap` entre celdas en móvil de `2px` a `3px` para que no se vean pegadas.
2. **Columna de totales más estrecha** en móvil: `38px` → `26px`, e igual para la fila de "hora/total" inferior.
3. **Gap horizontal reducido** en móvil: `gap-x-2` → `gap-x-1.5` entre las tres columnas del grid.
4. Mantener todo igual en `sm:` y superiores (desktop intacto).

Resultado: las celdas llegan visiblemente más cerca de los números de la derecha y se ve más equilibrado, sin solaparse.