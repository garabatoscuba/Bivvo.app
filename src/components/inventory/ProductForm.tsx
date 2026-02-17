import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useCategories, useProducts, useBranchStock } from '@/hooks/useProducts';
import { useBranches } from '@/hooks/useBranches';
import { useAuth } from '@/contexts/AuthContext';
import type { Product } from '@/types/database';
import { Loader2, Package } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

const productSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido').max(100),
  description: z.string().max(500).optional(),
  category_id: z.string().optional(),
  cost_price: z.coerce.number().min(0, 'El costo debe ser positivo'),
  sale_price: z.coerce.number().min(0, 'El precio debe ser positivo'),
  min_stock: z.coerce.number().int().min(0),
  status: z.enum(['for_sale', 'warehouse', 'discontinued']),
  barcode: z.string().max(50).optional(),
  supplier: z.string().max(200).optional(),
  unit_of_measure: z.string().min(1),
  brand: z.string().max(100).optional(),
});

type ProductFormData = z.infer<typeof productSchema>;

interface ProductFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product?: Product | null;
}

const statusOptions = [
  { value: 'for_sale', label: 'En venta' },
  { value: 'warehouse', label: 'Almacén' },
  { value: 'discontinued', label: 'Descontinuado' },
];

const unitOptions = [
  'Pieza', 'Kilogramo', 'Gramo', 'Litro', 'Mililitro',
  'Metro', 'Centímetro', 'Caja', 'Paquete', 'Par', 'Docena', 'Rollo',
];

export const ProductForm = ({ open, onOpenChange, product }: ProductFormProps) => {
  const { profile } = useAuth();
  const { categories } = useCategories();
  const { createProduct, updateProduct } = useProducts();
  const { data: branches } = useBranches();
  const mainBranchId = branches?.find(b => b.is_main)?.id || branches?.[0]?.id;
  const { data: branchStock } = useBranchStock(mainBranchId);

  // Stock info for editing
  const productStock = product && branchStock
    ? branchStock.find((bs: any) => bs.product_id === product.id)?.quantity || 0
    : 0;

  const form = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: '', description: '', category_id: undefined,
      cost_price: 0, sale_price: 0, min_stock: 5, status: 'for_sale',
      barcode: '', supplier: '', unit_of_measure: 'Pieza', brand: '',
    },
  });

  useEffect(() => {
    if (product) {
      form.reset({
        name: product.name,
        description: product.description || '',
        category_id: product.category_id || undefined,
        cost_price: product.cost_price,
        sale_price: product.sale_price,
        min_stock: product.min_stock,
        status: product.status,
        barcode: product.barcode || '',
        supplier: product.supplier || '',
        unit_of_measure: product.unit_of_measure || 'Pieza',
        brand: product.brand || '',
      });
    } else {
      form.reset({
        name: '', description: '', category_id: undefined,
        cost_price: 0, sale_price: 0, min_stock: 5, status: 'for_sale',
        barcode: '', supplier: '', unit_of_measure: 'Pieza', brand: '',
      });
    }
  }, [product, form]);

  const onSubmit = async (data: ProductFormData) => {
    if (!profile?.business_id) return;

    const payload = {
      name: data.name,
      description: data.description || null,
      category_id: data.category_id || null,
      cost_price: data.cost_price,
      sale_price: data.sale_price,
      min_stock: data.min_stock,
      status: data.status as Product['status'],
      barcode: data.barcode || null,
      supplier: data.supplier || null,
      unit_of_measure: data.unit_of_measure,
      brand: data.brand || null,
    };

    if (product) {
      await updateProduct.mutateAsync({ id: product.id, ...payload });
    } else {
      await createProduct.mutateAsync({
        ...payload,
        business_id: profile.business_id,
        image_url: null,
      });
    }

    onOpenChange(false);
    form.reset();
  };

  const isLoading = createProduct.isPending || updateProduct.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {product ? 'Editar Producto' : 'Nuevo Producto'}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            {/* ─── Sección 1: Identificación ─── */}
            <div className="space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Identificación</p>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Código</label>
                  <Input 
                    value={product?.code || 'Auto'} 
                    disabled 
                    className="bg-muted text-muted-foreground"
                  />
                </div>
                <FormField
                  control={form.control}
                  name="barcode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Código de barras</FormLabel>
                      <FormControl>
                        <Input placeholder="EAN / SKU" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre *</FormLabel>
                    <FormControl>
                      <Input placeholder="Nombre del producto" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descripción</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Descripción opcional" className="resize-none" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="brand"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Marca</FormLabel>
                    <FormControl>
                      <Input placeholder="Marca del producto" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Separator />

            {/* ─── Sección 2: Clasificación ─── */}
            <div className="space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Clasificación</p>
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="category_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Categoría</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {categories.map((cat) => (
                            <SelectItem key={cat.id} value={cat.id}>
                              {cat.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="unit_of_measure"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Unidad</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {unitOptions.map((unit) => (
                            <SelectItem key={unit} value={unit}>
                              {unit}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <Separator />

            {/* ─── Sección 3: Precios ─── */}
            <div className="space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Precios</p>
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="cost_price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Costo</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" min="0" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="sale_price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Precio de Venta</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" min="0" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <Separator />

            {/* ─── Sección 4: Inventario ─── */}
            <div className="space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Inventario</p>
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="min_stock"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Stock Mínimo</FormLabel>
                      <FormControl>
                        <Input type="number" min="0" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Estado</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {statusOptions.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Existencias (solo al editar) */}
              {product && (
                <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Package className="h-4 w-4 text-muted-foreground" />
                    Existencias actuales
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-muted-foreground">En sucursal</p>
                      <p className="text-lg font-bold">{productStock}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <Separator />

            {/* ─── Sección 5: Adicional ─── */}
            <div className="space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Adicional</p>
              <FormField
                control={form.control}
                name="supplier"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Proveedor</FormLabel>
                    <FormControl>
                      <Input placeholder="Nombre del proveedor" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" className="flex-1" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {product ? 'Guardar' : 'Crear'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
