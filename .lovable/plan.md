# Rediseño visual — Dashboard modo easy

Alcance puramente estético sobre `src/pages/Dashboard.tsx` (vista del dueño). Lógica, queries, rutas, sidebar (estructura/iconos/orden), AppHeader (estructura/lógica) y demás módulos quedan intactos.

## 1. Design tokens (scoped al dashboard easy)

Añadir tokens en `src/index.css` bajo un selector `.theme-easy` (o `[data-theme="easy"]`) para no afectar el resto del producto. Variables CSS exactas del HTML de referencia: `--bg-app`, `--bg-surface`, `--bg-surface-elevated`, `--border-subtle/default/strong`, `--text-primary/secondary/tertiary/quaternary`, brand `#10D9A0` + soft, `amber/red/blue/indigo` + soft, radios `--r-sm/md/lg/xl`.

Cargar fuentes Google en `index.html`: Inter (400/500/600/700), Instrument Serif (regular + itálica), JetBrains Mono (400/500). Exponer como `--font-sans`, `--font-serif`, `--font-mono`.

El wrapper raíz del dashboard aplicará `className="theme-easy font-sans bg-[var(--bg-app)] text-[var(--text-primary)]"` para aislar la paleta sin tocar el theme global.

## 2. Estructura de componentes nuevos

Todos bajo `src/components/dashboard/easy/`:

- `HumanGreeting.tsx` — saludo contextual por hora; nombre en serif itálica verde; sub-botón "modo easy" (visual, sin menú); línea meta con fecha + ventas hoy + facturado + pill de caja abierta.
- `EasyAlertsCard.tsx` — sólo renderiza si hay alertas. Borde izq ámbar, icono cuadrado, pill con conteo, lista con dot + texto + link contextual. Consume las mismas listas (`lowStockProducts`, `lowStockMaterials`) que ya calcula `Dashboard.tsx`.
- `KPICard.tsx` — props `{ label, value, unit?, hint, badge?, sparklineData, sparklineColor }`. Sparkline SVG inline absolute `left:0 right:0 bottom:0` con relleno gradiente sutil. Card con `overflow:hidden`.
- `TopProductsCard.tsx` — header con "Ver todo" y "+ Añadir" (link al modal de creación de producto existente). Sub-card "Producto estrella" para el #1 con stats (Vendidos / Ingresos / Margen). Lista #2…#N con ranking en serif, nombre, barra de progreso `flex-1`, unidades. Scroll vertical con `scrollbar-width:none` + `::-webkit-scrollbar{display:none}` y fade `::after` de 50px.
- `LatestSalesCard.tsx` — lista de 6 ventas recientes. Icono cuadrado CT/TR/TJ por método con colores soft. Divisores `border-t border-[var(--border-subtle)]`. Padding vertical 17px por item para empatar altura.
- `WeeklyHeatmap.tsx` — grid 7×24, celdas con 5 niveles de verde por volumen, tooltip al hover, totales día derecha (↑ verde para el máximo), eje horas inferior cada 3h con pico destacado, insight editorial al pie.
- `RecommendationCard.tsx` — variantes `"garabatos"` (ámbar, estática) y `"bivoo"` (verde, dinámica vía props). Patrón común icono + label + título mixto sans/serif itálica + descripción + CTA pill.

Componente contenedor `EasyDashboard.tsx` que orquesta layout vertical, recibe `period`, `stats`, `branchStock`, etc. desde `Dashboard.tsx`.

## 3. Conexión a datos existentes

Reusar exactamente lo que ya hay en `Dashboard.tsx`:

- `useDashboardStats(branchId, period)` — alimenta los 3 KPIs (Ventas → `totalSales` + `salesOverTime` para sparkline; Caja → `OwnerFinancialCards` o consulta caja existente; Stock crítico → conteo desde `branchStock` + `products`).
- `lowStockProducts`, `lowStockMaterials` → `EasyAlertsCard`.
- `stats.topProducts` se amplía: el hook devuelve top 5 actualmente; lo extendemos a top 10 (solo cambio `.slice(0, 5)` → `.slice(0, 10)` y se añade `revenue`/`margin` por producto agregando un cálculo simple sobre `sale_items` ya cargados). Si añadir esos campos resulta invasivo, se renderizan vacíos/mock en esta iteración.
- "Últimas ventas" → nueva query mínima `sales` orderby `created_at` desc limit 6 con `client_name`, `payment_type`, `total`, `items_count`. Se añade como hook `useLatestSales(branchId)` (lectura pura, sin tocar nada existente).
- Heatmap → nuevo hook `useWeeklyHeatmap(branchId)` que agrega `sales.created_at` por día×hora de los últimos 7 días. Si lo dejamos para una iteración posterior, se renderiza con datos mock pero estructura final.

Filtro de período: se aplica nuevo estilo a `PeriodFilter` mediante una prop `variant="easy"` (pill segmentada con fondo `brand-soft` en el activo). Cero cambios a su API.

## 4. Topbar

El AppHeader global se mantiene tal cual fuera del dashboard. Para el modo easy se monta una variante visual de "breadcrumb + iconos" **dentro** del propio dashboard (no se toca `AppHeader.tsx`) usando los mismos handlers expuestos (scanner, soporte, sync). Esto evita afectar otras pantallas. Si el usuario prefiere reemplazar el header global, se hace en una iteración separada.

> Decisión a confirmar: ¿topbar sólo en el dashboard easy o reemplazar `AppHeader` para toda la app? Por defecto aplico la primera opción.

## 5. Sidebar

Sólo retoque de paleta dentro del scope `.theme-easy` o vía override CSS muy puntual en `AppSidebar`: fondo `var(--bg-app)`, borde derecho `var(--border-subtle)`, ítem activo con fondo `var(--brand-soft)` y texto `var(--brand)`. Sin tocar estructura, iconos, orden ni textos.

## 6. Reemplazo en Dashboard.tsx

Dentro de `Dashboard.tsx`, sustituir el JSX del bloque del dueño (líneas ~180–425) por `<EasyDashboard />` envuelto en `.theme-easy`. Se preservan:

- Redirect a `/mi-empleo` para empleados.
- Vista de afiliados (`isAffiliated`).
- `OnboardingWizard` y `planInfoPopupOpen` dialogs.
- `OwnerFinancialCards`, `EquipoActivoSection`, `PerformanceWidget` quedan disponibles pero **fuera del primer scroll**, al final, hasta que se rediseñen en iteraciones futuras (o se ocultan si el usuario lo prefiere — confirmar).

> Decisión a confirmar: ¿conservar `OwnerFinancialCards` / `EquipoActivoSection` / `PerformanceWidget` debajo del nuevo diseño, o esconderlos en modo easy?

## 7. Detalles visuales no negociables

- Fade gradient (50px) al final de la lista de Más vendidos vía `::after`.
- Scrollbar oculta sólo en esa lista.
- Barra de progreso del podio con `grid-template-columns: auto 1fr auto`.
- Sparkline absoluto edge-to-edge, card con `overflow:hidden`.
- Grid inferior con `align-items:stretch` y cards `flex flex-col` para igualar alturas.
- Heatmap `grid-template-columns: repeat(24, 1fr)` con gap 4px, sin scroll.
- Botón "modo easy" con offset `-8px` respecto al saludo grande.

## 8. Fuera de alcance (explícito)

- POS, Tesorería, Caja, Empleados, Inventario, Ventas, Servicios, Cocina, Impresiones, Portal público, Admin, Asistente IA.
- Lógica de detección de alertas, queries existentes, edge functions, RLS, hooks ya en producción.
- Menú "modo easy" (sólo botón visual).
- Lógica dinámica de la card "Activar capa" (sólo se deja la estructura preparada).

## 9. QA visual antes de cerrar

- Verificar paleta en `1640×926` (viewport actual) y en mobile.
- Confirmar que Más vendidos y Últimas ventas tienen exactamente la misma altura.
- Confirmar que la card de Alertas no se renderiza cuando no hay alertas.
- Confirmar que el sidebar mantiene todos sus módulos y sólo cambió color.

---

**Antes de implementar necesito confirmar 2 puntos:**

1. Topbar nuevo: ¿sólo en dashboard easy, o reemplazo global de `AppHeader`?
2. `OwnerFinancialCards` / `EquipoActivoSection` / `PerformanceWidget` en el modo easy: ¿se conservan abajo o se ocultan hasta su rediseño?
