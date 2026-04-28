## Accion 1 — Knowledge optimizado (reescritura)

Objetivo: Reemplazar `<project-knowledge>` por version estructurada clara, ~5KB.

Secciones (10):
1. REGLAS IRROMPIBLES — No tocar: POS, Tesoreria, Caja, BalancePersonalCards, TreasuryMovimientos, auth/roles, tablas existentes. Patron V2 antes de editar. Solo anadir columnas/tablas.
2. STACK — Lovable+Supabase, multi-tenant, roles: SuperAdmin>Partner>Dueno>Gerente>Vendedor>Operario>Cocina>Cliente. Cuba CUP +53.
3. AUTH/SESIONES — Sesion persistente: NUNCA cerrar por error transitorio de profile fetch, solo si profile === null. useSessionKeepAlive: stateRef, <5min refresh, throttle 2min. Login terminos obligatorio (checkbox bloquea Google/Apple/Email). Empleados sin @bivoo.app: buscar email existente desde 5to caracter, no crear cuenta nueva.
4. HUB/ROUTING — / = Hub (Mis Negocios + Mi Empleo si empleo activo), /dashboard = Dashboard. Auto-redirect si 1 solo contexto.
5. EMPLEADOS — Creacion atomica edge function, edicion sin cambio de contrasena. useResolvedBusinessId. Roles multiples (casillas). Operario por area (position=operator+is_jefe). QR onboarding JSON{type,employee_id,business_id}. Borrado via delete-bivoo-employee limpia auth+profiles+roles+employee.
6. MODULOS DINAMICOS — business_type_configs x plan x rol. Sidebar spinner mientras employeeRecordLoading. Modulos desde platform_modules via module_plugin_pricing.
7. MODULOS CLAVE (resumen):
- POS/Ventas: metodo exacto efectivo/transferencia/mixto, monto recibido vacio inicial, confirmar deshabilitado si vacio/cero.
- Caja: integra POS+jornadas, apertura fondo dia anterior automatico, cierre neto>0 crea treasury_pending_entries.
- Contabilidad: solo Dueno, solo Enterprise. 4 tabs: Balance, Gastos, Activos, Analisis. Costos inmutables.
- Reportes: /cobros, 3 tabs Resumen/Historial/Comparativa. TabsContent Historial con onMouseDown stopPropagation.
- Nomina: modalidades desde salary_modalities, salario base=piso minimo, fijo+% suma aditiva.
- Inventario: 5 tabs Productos/A la Venta/Almacen/Insumos/Movim. WAC costeo. Anulacion trazable. sessionStorage para tab activo.
- Servicios: fichas independientes service_recipes. 3 metodos indirectos.
- Impresiones: interfaz tipo POS, CMYK tracking.
- Cocina KDS: solo restaurante, elaborado crea kitchen_orders.
- Portal publico: /s/{slug}, free usa bivoo-demo.
- Bitacora: audit_logs code BIV-YYYYMMDD-XXXX, 15 acciones, RLS owner+super_admin.
- Cierre jornada: 2 pasos (conteo inventario + efectivo). Negativo>$1 bloquea.
- Gestion datos: Cerrar Periodo (archived=true), Reset Completo (CONFIRMAR, edge function).
8. PERSISTENCIA UI — sessionStorage para tabs activos (inventory-main-tab). No reiniciar estado al volver de background/WhatsApp.
9. PATRONES TECNICOS — Sanitizar payloads update (eliminar virtuales). .maybeSingle() para opcionales. RLS por business_id/branch_id. Imagenes: Canvas->WEBP. Offline 48h. Camara: BarcodeDetector nativo fallback ZXing. Modales movil: header+botones fijos, scroll interno. Tabs scroll horizontal scrollbar-hide. Focus con outline.
10. PLANES/PERMISOS — Free$0/Pro$10/Enterprise$15. Trial 7d. Free: portal demo, sin Contabilidad. Pro: portal propio, sin Contabilidad. Enterprise: todo. Downgrade: useIsDowngraded bloquea Inventario/Servicios clave.

Reglas nuevas explicitas:
- Sesion solo cierra si profile === null (no en error de red).
- useSessionKeepAlive usa stateRef (evita "Rendered more hooks").
- sessionStorage para tabs al minimizar app.
- Hub muestra Mi Empleo SIEMPRE con registro activo en employees.
- Crear empleado: autocomplete email busca desde 5to char, si no hay match NO crear cuenta.
- Editar empleado: SIN campo cambiar contrasena.

Entrega: Bloque de texto listo para pegar en Project Settings -> Knowledge.

---

## Accion 2 — Mejorar Asistente IA (Solo contexto y precision)

Objetivo: Asistente SIEMPRE use datos reales del modulo activo, NUNCA invente rutas/funciones/tablas. Sin escritura BD.

Cambios:
A) Reforzar fetchModuleContext en supabase/functions/bivoo-assistant/index.ts:
- Inventario: top 10 stock bajo, total productos, valor inventario, ultimas 5 mermas.
- POS: ventas hoy/semana, ticket promedio, top 5 vendidos hoy.
- Caja: estado (abierta/cerrada), saldo, ultimo cierre.
- Nomina: empleados activos, total devengado periodo, proximo cierre.
- Contabilidad: ingresos/gastos mes, margen, gastos pendientes.
- Reportes: KPIs periodo seleccionado.
- Cocina: pedidos pendientes/en preparacion.
Limite ~2KB por consulta.

B) Prompt sistema endurecido:
- Citar valores numericos SOLO si vienen del contexto inyectado.
- Si dato no esta: "no tengo ese dato disponible".
- Nunca mencionar rutas que no esten en whitelist.
- Nunca mencionar nombres tablas/columnas Supabase al usuario.
- NUNCA proponer modificar datos — solo explicar, resumir, sugerir acciones manuales.

C) Tabla nueva assistant_known_routes:
- route_path, module_key, description, min_role.
- Edge function inyecta lista filtrada por rol del usuario en prompt.
- IA solo recomienda rutas de esta lista.

D) Ampliar assistant_module_instructions (existe, max 800 chars) con:
- "Datos disponibles en contexto".
- "Acciones permitidas al usuario" (solo sugerir, no ejecutar).
- "Prohibido mencionar" (nombres internos, rutas no whitelisted).

E) (Opcional UI) Badges fuente en AssistantChat.tsx:
- Dato de contexto: badge "dato actual".
- Conocimiento general: badge "sugerencia general".

F) Tests regresion (opcional):
- Documentar 10 prompts de prueba en mem://logic/assistant-quality.

NO se toca:
- Estructura UI panel/menu/boton flotante.
- Modelo (Groq llama-3.1-8b-instant o actual).
- Historial 24h/10msg/500chars.
- Feature flags useAssistantFeatures.
- NINGUNA capacidad de escritura en BD.

Entregables:
1. Migracion: tabla assistant_known_routes + seed.
2. Edicion supabase/functions/bivoo-assistant/index.ts (fetchModuleContext + system prompt).
3. Actualizacion assistant_module_instructions.
4. (Opcional) Badges en AssistantChat.tsx.

---

Orden: Ejecutar Accion 1 primero (entrego texto Knowledge). Luego confirmas para Accion 2 (codigo + migracion).