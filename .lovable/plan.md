# Plan: Knowledge optimizado + Mejora de IA (2 acciones separadas)

Vas a recibir **dos entregables independientes**, cada uno aplicable por separado sin afectar al otro.

---

## Acción 1 — Reescritura completa optimizada del Knowledge de Lovable

### Objetivo
Reemplazar el bloque actual `<project-knowledge>` por una versión estructurada con encabezados claros, sin perder ninguna regla crítica e incorporando todo lo aprendido en sesiones recientes.

### Estructura propuesta (10 secciones)

1. **REGLAS IRROMPIBLES** — qué nunca tocar (POS, Tesorería, Empleados, Caja, BalancePersonalCards, TreasuryMovimientos, auth/roles, tablas existentes). Patrón V2 antes de editar. Solo añadir columnas/tablas.
2. **STACK Y ARQUITECTURA** — Lovable + Supabase, multi-tenant, jerarquía de roles, tipos de negocio, mercado Cuba (CUP, +53).
3. **AUTENTICACIÓN Y SESIONES** — sesión persistente (nunca cerrar por error transitorio de profile fetch), keep-alive con umbral 5min/throttle 2min, login con términos, Google/Apple, empleados sin `@bivoo.app` (búsqueda por email existente desde 5to carácter, no crear cuenta nueva).
4. **HUB Y ROUTING** — `/` Hub selector (Mis Negocios + Mi Empleo si tiene empleo activo), `/dashboard` Dashboard, auto-redirect si 1 solo contexto.
5. **EMPLEADOS Y ROLES** — creación atómica vía edge function, edición sin cambio de contraseña, `useResolvedBusinessId`, roles múltiples, operario por área, gerente, vendedor, cocina. QR onboarding.
6. **MÓDULOS DINÁMICOS** — `business_type_configs` × plan × rol. Sidebar con spinner mientras `employeeRecordLoading`. Reglas por rol resumidas.
7. **MÓDULOS DE NEGOCIO** (resumen por módulo, una sub-sección cada uno):
   - POS y Ventas / Caja / Tesorería / Contabilidad / Reportes / Nómina / Inventario / Servicios y Fichas de costo / Impresiones / Cocina KDS / Portal público / Bitácora / Cierre de jornada / Gestión de datos
8. **PERSISTENCIA DE UI** — `sessionStorage` para tabs activos en Inventory (y patrón replicable). No reiniciar estado al volver de WhatsApp/background.
9. **PATRONES TÉCNICOS** — Supabase (sanitizar payloads, `.maybeSingle()`, RLS por business_id/branch_id), imágenes (Canvas → WEBP), offline 48h, cámara (BarcodeDetector + ZXing fallback), modales móviles (header+botones fijos, scroll interno), tabs con scroll horizontal `scrollbar-hide`, focus con `outline`.
10. **PLANES Y PERMISOS** — Free/Pro/Enterprise, Trial 7d, matriz corta de permisos por rol, downgrade behavior.

### Reglas nuevas a incorporar (que hoy no están explícitas)
- Sesión NUNCA se cierra por error transitorio de fetch de profile; solo si profile es estrictamente `null`.
- `useSessionKeepAlive` usa `stateRef` consolidado (evita "Rendered more hooks") y solo refresca si quedan <5min de token.
- Persistencia de tabs en `sessionStorage` al minimizar app.
- Hub muestra "Mi Empleo" SIEMPRE que el usuario tenga al menos un registro en `employees` activo.
- Crear empleado: autocompletado de email busca coincidencias desde el 5to carácter; si no hay match en BD, NO se crea cuenta.
- Editar empleado: NO mostrar campo "cambiar contraseña" (el usuario entra con su cuenta existente).

### Tamaño estimado
~6–8 KB, denso pero legible (similar al actual en peso, mejor organizado).

### Entrega
Un único bloque de texto listo para pegar en **Project Settings → Knowledge** reemplazando el actual.

---

## Acción 2 — Instrucción separada: mejorar el Asistente IA (Solo contexto y precisión)

### Objetivo
Que el asistente **siempre tenga datos reales** del módulo activo y **nunca invente** rutas, funciones, tablas ni campos. **Sin acciones de escritura** — solo lectura, explicación y sugerencias.

### Cambios técnicos propuestos

**A) Reforzar `fetchModuleContext` en `supabase/functions/bivoo-assistant/index.ts`**
- Para cada módulo activo, inyectar un snapshot resumido y reciente:
  - **Inventario**: top 10 productos con stock bajo, total productos, valor total inventario, últimas 5 mermas.
  - **POS/Ventas**: ventas hoy, ventas semana, ticket promedio, top 5 productos vendidos hoy.
  - **Caja**: estado caja activa (abierta/cerrada), saldo actual, último cierre.
  - **Nómina**: empleados activos, total devengado período actual, próximo cierre.
  - **Contabilidad**: ingresos/gastos mes, margen, gastos pendientes.
  - **Reportes**: KPIs período seleccionado.
  - **Cocina**: pedidos pendientes/en preparación.
- Limitar tamaño total inyectado a ~2 KB por consulta (resúmenes, no listas completas).

**B) Sistema de "datos verificados" vs "inferencia"**
- Prompt del sistema obliga a:
  - Citar valores numéricos SOLO si vienen del contexto inyectado.
  - Si el dato no está, responder "no tengo ese dato disponible en este momento" en lugar de inventarlo.
  - Nunca mencionar rutas (`/inventario`, `/pos`, etc.) que no estén en una whitelist incluida en el prompt.
  - Nunca mencionar nombres de tablas/columnas de Supabase al usuario final.

**C) Whitelist de rutas y funciones**
- Tabla nueva `assistant_known_routes` (solo añadir, no toca existentes):
  - `route_path`, `module_key`, `description`, `min_role`.
- El edge function inyecta esta lista filtrada por rol del usuario en el prompt.
- Si la IA recomienda navegar, debe usar SOLO una ruta de esa lista.

**D) Instrucciones por módulo más estrictas**
- Ampliar `assistant_module_instructions` (ya existe, max 800 chars) con:
  - "Datos disponibles en contexto" (qué campos puede citar).
  - "Acciones permitidas al usuario" (qué puede sugerir hacer).
  - "Prohibido mencionar" (lista negra: nombres internos, rutas no whitelisted).

**E) Indicador visual de fuente en el chat**
- Cuando la IA cita un dato del contexto, marcarlo con un badge sutil "📊 dato actual" (opcional, solo UI).
- Si responde con conocimiento general (sin datos del negocio), badge "💡 sugerencia general".

**F) Endurecer prompt base**
- Añadir al `system prompt`:
  > "Eres asistente de Bivoo. SOLO puedes mencionar datos, rutas y funciones que aparezcan en el contexto inyectado. Si te preguntan por algo fuera del contexto, di 'no tengo esa información disponible'. NUNCA inventes nombres de páginas, botones o funciones. NUNCA propongas modificar datos — solo explica, resume y sugiere acciones que el usuario debe realizar manualmente."

**G) Tests de regresión (opcional pero recomendado)**
- 10 prompts de prueba documentados en `mem://logic/assistant-quality` con respuestas esperadas para validar tras cada cambio.

### Lo que NO se toca
- Estructura UI del asistente (panel, menú contextual, botón flotante).
- Modelo (sigue Groq llama-3.1-8b-instant o el actual).
- Historial 24h / 10 mensajes / 500 chars.
- Acceso por feature flags (`useAssistantFeatures`).
- **NO se añade ninguna capacidad de escritura en BD.**

### Entrega
1. Migración: tabla `assistant_known_routes` + seed inicial.
2. Edición de `supabase/functions/bivoo-assistant/index.ts` (fetchModuleContext + system prompt).
3. Actualización de `assistant_module_instructions` existentes.
4. (Opcional) Badges de fuente en `AssistantChat.tsx`.

---

## Orden sugerido de ejecución
1. Apruebas este plan.
2. Ejecuto **Acción 1** (Knowledge) — te entrego el texto listo para pegar.
3. Confirmas que quieres seguir con **Acción 2** (IA) y la implemento como cambios de código + migración.

¿Apruebas?