

# Corregir la pill "Almacen" para contar productos con stock en almacen

## Problema actual

La pill "Almacen" filtra por `product.status === 'warehouse'`, que es un estado del producto. Pero el concepto real es: "cuantos productos tienen unidades guardadas en almacen", lo cual se determina por `warehouse_quantity > 0` en la tabla `branch_stock`.

## Solucion

Cambiar la logica de calculo en el `useMemo` de stats dentro de `src/pages/Inventory.tsx`:

**Antes:**
```ts
const warehouse = products.filter(p => p.status === 'warehouse').length;
```

**Despues:**
```ts
const warehouse = products.filter(p => (warehouseStockMap.get(p.id) || 0) > 0).length;
```

Esto contara los productos que efectivamente tienen unidades fisicas en almacen, independientemente de su status. Si un producto tiene 5 unidades en venta y 3 en almacen, aparecera tanto en "En venta" como en "Almacen".

## Detalles tecnicos

- Archivo a modificar: `src/pages/Inventory.tsx`, linea 129
- Cambio de una sola linea en el calculo del memo `stats`
- No requiere cambios en base de datos ni migraciones

