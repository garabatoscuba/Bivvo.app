## Mejorar el formulario de productos del inventario

### Resumen

Agregar nuevos campos al formulario de productos para hacerlo mas completo y profesional: codigo interno automatico, codigo de barras, proveedor, unidad de medida, marca, precio mayoreo, y mostrar existencias actuales.

### Cambios en la base de datos

Agregar las siguientes columnas a la tabla `products`:


| Campo             | Tipo                  | Descripcion                      |
| ----------------- | --------------------- | -------------------------------- |
| `barcode`         | text, nullable        | Codigo de barras EAN/SKU externo |
| `supplier`        | text, nullable        | Nombre del proveedor             |
| `unit_of_measure` | text, default 'pieza' | Unidad de medida                 |
| `brand`           | text, nullable        | Marca del producto               |
| &nbsp;            | &nbsp;                | &nbsp;                           |


**Nota sobre el codigo interno:** El sistema actual ya genera codigos tipo `PRD-00001`. Cambiaremos el formato a `0001A` como solicitas, actualizando la funcion SQL `generate_product_code`.

### Cambios en el formulario de productos

El formulario quedara organizado en secciones logicas:

**Seccion 1 - Identificacion:**

- Codigo (solo lectura, auto-generado) + Codigo de barras (opcional)
- Nombre del producto
- Descripcion
- Marca

**Seccion 2 - Clasificacion:**

- Categoria + Unidad de medida

**Seccion 3 - Precios:**

- Costo + Precio venta + Precio mayoreo

**Seccion 4 - Inventario:**

- Stock minimo + Estado
- Dar entrada a los productos, ya sea solo para el almacen o la venta, o ambas 
- Existencia en venta y almacen (solo lectura, informativo al editar)

**Seccion 5 - Adicional:**

- Proveedor
  &nbsp;

### Archivos a modificar

1. **Nueva migracion SQL** — agregar columnas a `products` y actualizar funcion `generate_product_code` para formato `0001A`
2. `**src/types/database.ts**` — agregar los nuevos campos al tipo `Product` (se actualizara automaticamente)
3. `**src/components/inventory/ProductForm.tsx**` — redisenar el formulario con los nuevos campos organizados en secciones
4. `**src/hooks/useProducts.ts**` — incluir los nuevos campos en las mutaciones de crear/actualizar
5. `**src/pages/Inventory.tsx**` — mostrar marca y proveedor en el panel de detalle del producto (Sheet)

### Detalles tecnicos

**Formato del codigo:** La funcion `generate_product_code` se actualizara para generar codigos tipo `0001A`, `0002A`, etc. incrementando el numero secuencialmente por negocio.

**Unidades de medida disponibles:** Pieza, Kilogramo, Gramo, Litro, Mililitro, Metro, Centimetro, Caja, Paquete, Par, Docena, Rollo.

**Existencias:** Al editar un producto, se mostraran las cantidades actuales de stock por sucursal como campos de solo lectura. Al crear un producto nuevo, no se muestran (el stock se ingresa despues mediante movimientos de inventario).