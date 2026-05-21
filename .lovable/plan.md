# Rediseñar tarjeta móvil de actividad con curva orgánica

## Objetivo

Reemplazar la tarjeta `MobileHourlyChart` (la "actividad por hora" en vista móvil del Dashboard Easy) por la **Opción 1 — Curva orgánica** del HTML adjunto. Misma tarjeta para los 4 períodos (`Hoy`, `Semana`, `Mes`, `Año`), adaptando contenido según el filtro del Dashboard (no se añade filtro propio en la tarjeta).

Se conserva el resto del dashboard intacto. La vista escritorio (`WeeklyHeatmap`) no se toca.

## Alcance

Solo la tarjeta. No se replica del HTML: el wrapper del teléfono, el filtro Hoy/Semana/Mes/Año, el nombre "Bivoo", ni los bloques de comparación entre opciones.

## Contenido por período

La tarjeta se alimenta de datos que ya existen:

- `salesOverTime` de `useDashboardStats` (buckets ya calculados según `period`).
- `matrix` 7×24 de `useWeeklySalesHeatmap` (solo para `today` → curva por hora real).

| Período  | Título            | Eje X                  | Puntos | Stat 1 (brand)            | Stat 2          | Insight                                       |
|----------|-------------------|------------------------|--------|---------------------------|-----------------|-----------------------------------------------|
| today    | Patrón del día    | 00h · 06h · 12h · 18h · 23h | 24     | Hora pico (HH:00)         | Promedio / h    | "Pico a las HH:00 con N ventas"               |
| week     | Patrón de la semana | lun · mar · mié · jue · vie · sáb · dom | 7      | Mejor día (LUN…)          | Promedio / día  | "Tu mejor día fue el {día} con N ventas"      |
| month    | Patrón del mes    | 1 · 7 · 14 · 21 · 28   | 28-31  | Mejor día (Dn)            | Promedio / día  | "El día N fue tu mejor momento"               |
| year     | Patrón del año    | ene · abr · jul · oct · dic | 12     | Mejor mes (MMM)           | Promedio / mes  | "{mes} fue tu mes más fuerte"                 |

Meta superior: `N ventas` + sufijo del período (`hoy`, `en 7 días`, `este mes`, `este año`).

## Detalles visuales (Opción 1 del HTML)

- Contenedor `bg-[var(--bg-surface)]`, borde sutil, `rounded-[var(--te-r-lg)]`.
- Header con icono cuadrado (Clock para today, Calendar para resto) + título.
- Línea meta con número en `--te-text-secondary`.
- Grid 2 stats: label uppercase mono pequeño, valor 22px; el primero en color brand `#10D9A0`.
- SVG curva orgánica:
  - Path interpolado tipo monotone (Catmull-Rom → bezier) sobre los puntos del período.
  - Relleno con gradient brand (0.32 → 0).
  - Stroke `#10D9A0` 2px.
  - Línea punteada vertical en el pico + dot relleno + halo translúcido.
  - Etiqueta flotante itálica serif "Pico a las **HH:00**" / "Mejor: **sábado**" posicionada sobre el pico.
- Eje X con 5 ticks (o 7 en semana) en mono pequeño, el pico en color brand.
- Bloque insight inferior con borde izquierdo brand y texto editorial.

## Implementación

1. Reescribir `src/components/dashboard/easy/MobileHourlyChart.tsx`:
   - Quitar Recharts; pintar SVG manual con `viewBox="0 0 292 130"` para reproducir la curva editorial del HTML.
   - Aceptar `period` y derivar `points: { label, value }[]` desde `salesOverTime` (props nueva) o `matrix` cuando `today`.
   - Calcular peak, promedio y posición del peak en el viewBox.
   - Construir el path con interpolación suave (monotone cubic) entre puntos normalizados.
   - Renderizar etiqueta flotante, línea punteada y dot del pico.
   - Renderizar eje X según período (ticks fijos descritos arriba).
   - Render insight según período.
   - Usar tokens existentes: `var(--bg-surface)`, `var(--bg-surface-elevated)`, `var(--border-subtle)`, `var(--te-text-*)`, `var(--te-brand)` (#10D9A0).
2. Actualizar `EasyDashboard.tsx` para pasar `salesOverTime` (además de `matrix` y `period`) al componente móvil. Ya están disponibles en `stats`.
3. No tocar `WeeklyHeatmap` ni la rama desktop.

## Datos técnicos

- `salesOverTime[i].total` ya viene en moneda (suma `$`), no en cantidad de ventas. Para que la curva represente intensidad de actividad sirve igual (lo importante es la forma). Las stats de "ventas" se siguen mostrando en cantidad solo cuando `today` (desde `matrix`); en el resto se etiquetan como "Total" / "Promedio" en CUP para no inventar conteos. Alternativa si se prefiere: usar `salesCount` para todos los períodos — confirmar en una iteración futura si hace falta.
- Componente: 100% presentacional, sin queries nuevas.
