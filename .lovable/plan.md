
# 📦 Sistema de Gestión Empresarial - MVP

## Visión General
Una plataforma SaaS multi-tenant que permite a pequeños y grandes negocios gestionar inventario, punto de venta, gastos y personal. Tú como Super Admin controlas las suscripciones y tus clientes (dueños de negocios) acceden a su propio espacio de trabajo.

---

## Fase 1: Fundamentos y Autenticación

### Portal de Super Admin
- Panel para ver todos los negocios registrados
- Activar/desactivar suscripciones manualmente
- Ver estadísticas generales de la plataforma

### Sistema de Autenticación
- Login para Super Admin, Dueños de negocio y Empleados
- Registro de nuevos negocios (pendiente de activación)
- Sistema de roles: Super Admin → Dueño → Gerente → Vendedor → Contable

### Gestión de Negocios
- Cada negocio tiene su espacio aislado
- Configuración de múltiples sucursales por negocio
- Datos completamente separados entre negocios

---

## Fase 2: Inventario y Productos

### Catálogo de Productos
- Crear productos con: nombre, imagen, costo, precio de venta
- Organización por grupos/categorías (con colores como en tu diseño)
- Estados: "En venta" vs "Almacén"
- Código de producto automático

### Control de Stock
- Stock separado por sucursal
- Registro de entradas (compras/producción)
- Registro de salidas (ventas/pérdidas)
- **Alertas de stock bajo** con notificaciones

### Movimientos de Inventario
- Historial de todos los movimientos
- Transferencias entre sucursales
- Registro de pérdidas/mermas con motivo

---

## Fase 3: Punto de Venta (POS)

### Interfaz de Ventas
- Vista de productos organizados por categorías (estilo de tu diseño Figma)
- Selección rápida con teclado numérico
- Carrito de compras con cantidades
- Cálculo automático de total y vuelto

### Procesamiento de Ventas
- Ventas al contado
- Ventas a crédito (cuentas por cobrar)
- Aplicar descuentos
- Ticket/recibo de venta

### Historial de Ventas
- Listado completo de transacciones
- Filtros por fecha, vendedor, producto
- Detalle de cada venta
- Opción de anular ventas (con permisos)

---

## Fase 4: Gestión de Gastos

### Categorías de Gastos
- **Fijos**: Renta, seguros (recurrentes)
- **Variables**: Impuestos, electricidad, agua
- **Salarios**: Pagos a empleados con frecuencia
- **Activos**: Compras de equipamiento

### Registro de Gastos
- Nombre, importe, frecuencia
- Fecha de pago
- Estado: pagado/pendiente

---

## Fase 5: Recursos Humanos

### Gestión de Empleados
- Crear usuarios por negocio
- Asignar roles (Gerente, Vendedor, Contable)
- Asignar a sucursales específicas
- Registro de salarios

### Permisos por Rol
- **Dueño**: Acceso total al negocio
- **Gerente**: Inventario, ventas, empleados de su sucursal
- **Vendedor**: Solo POS y ventas
- **Contable**: Reportes, gastos, cuentas

---

## Fase 6: Cuentas y Finanzas

### Cuentas por Cobrar
- Clientes con deudas pendientes
- Historial de pagos parciales
- Alertas de cuentas vencidas

### Cuentas por Pagar
- Proveedores pendientes de pago
- Fecha de vencimiento
- Estado de pagos

---

## Fase 7: Dashboard y Reportes

### Dashboard Principal
- Ventas del día/semana/mes
- Productos más vendidos
- Gráficos de tendencias
- Resumen de gastos vs ingresos
- Alertas de stock bajo

### Reportes
- Ventas por período
- Rentabilidad por producto
- Movimientos de inventario
- Estado financiero general

---

## Diseño y Experiencia

- Diseño **mobile-first** siguiendo tu mockup de Figma
- Colores por categoría de productos (rosa, verde, azul)
- Navegación lateral con: Dashboard, Inventario, Gastos, Rec. Humanos, Configuración
- Header con logo, búsqueda y menú hamburguesa
- Interfaz limpia, minimalista y fácil de usar

---

## Tecnología

- **Frontend**: React con diseño responsivo
- **Backend**: Supabase (base de datos, autenticación, almacenamiento)
- **Tiempo real**: Actualizaciones instantáneas entre sucursales
- **Seguridad**: Aislamiento completo de datos por negocio
