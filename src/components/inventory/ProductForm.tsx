import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
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
// Native selects used for mobile compatibility inside dialogs
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
import { Loader2, Package, Camera, X, ChefHat } from 'lucide-react';
import { RecipeManager } from '@/components/inventory/RecipeManager';
import { Separator } from '@/components/ui/separator';
import { toast } from '@/hooks/use-toast';
import { useIsRestaurant } from '@/hooks/useIsRestaurant';

const MAX_IMAGE_SIZE = 512000; // 500 KB

const productSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido').max(100),
  description: z.string().max(500).optional(),
  category_id: z.string().optional(),
  barcode: z.string().max(50).optional(),
  unit_of_measure: z.string().min(1),
  brand: z.string().max(100).optional(),
  tipo: z.enum(['reventa', 'ingrediente', 'elaborado', 'granel']).default('reventa'),
  sale_price: z.string().optional(),
});

type ProductFormData = z.infer<typeof productSchema>;

interface ProductFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product?: Product | null;
  defaultTipo?: 'reventa' | 'ingrediente' | 'elaborado' | 'granel';
}


const unitOptions = [
  'Pieza', 'Kilogramo', 'Gramo', 'Libra', 'Litro', 'Mililitro',
  'Metro', 'Metro cuadrado (m²)', 'Centímetro', 'Caja', 'Paquete', 'Par', 'Docena', 'Rollo',
];

export const ProductForm = ({ open, onOpenChange, product, defaultTipo }: ProductFormProps) => {
  const { profile } = useAuth();
  const { isRestaurant } = useIsRestaurant();
  const { categories } = useCategories();
  const { createProduct, updateProduct } = useProducts();
  const { data: branches } = useBranches();
  const mainBranchId = branches?.find(b => b.is_main)?.id || branches?.[0]?.id;
  const { data: branchStock } = useBranchStock(mainBranchId);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [recipeOpen, setRecipeOpen] = useState(false);
  const [insumoAreaId, setInsumoAreaId] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Insumo areas for ingrediente products
  const { data: insumoAreas = [] } = useQuery({
    queryKey: ['insumo-areas', profile?.business_id],
    queryFn: async () => {
      if (!profile?.business_id) return [];
      const { data, error } = await supabase
        .from('insumo_areas')
        .select('*')
        .eq('business_id', profile.business_id)
        .order('name');
      if (error) throw error;
      return data || [];
    },
    enabled: !!profile?.business_id,
  });

  // Stock info for editing
  const productStock = product && branchStock
    ? branchStock.find((bs: any) => bs.product_id === product.id)?.quantity || 0
    : 0;

  // Set image preview when editing
  useEffect(() => {
    setImagePreview(product?.image_url || null);
    setImageFile(null);
    setInsumoAreaId((product as any)?.insumo_area_id || '');
  }, [product]);

  const form = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: '', description: '', category_id: undefined,
      barcode: '', unit_of_measure: 'Pieza', brand: '', tipo: 'reventa', sale_price: '',
    },
  });

  useEffect(() => {
    if (product) {
      form.reset({
        name: product.name,
        description: product.description || '',
        category_id: product.category_id || undefined,
        barcode: product.barcode || '',
        unit_of_measure: product.unit_of_measure || 'Pieza',
        brand: product.brand || '',
        tipo: (product as any).tipo || 'reventa',
        sale_price: product.sale_price ? String(product.sale_price) : '',
      });
    } else {
      form.reset({
        name: '', description: '', category_id: undefined,
        barcode: '', unit_of_measure: 'Pieza', brand: '', tipo: defaultTipo || 'reventa', sale_price: '',
      });
    }
  }, [product, form]);

  const uploadImage = async (productId: string): Promise<string | null> => {
    if (!imageFile) return product?.image_url || null;
    
    setUploadingImage(true);
    try {
      const ext = imageFile.name.split('.').pop() || 'jpg';
      const path = `${profile?.business_id}/${productId}.${ext}`;
      
      const { error } = await supabase.storage
        .from('product-images')
        .upload(path, imageFile, { upsert: true });

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('product-images')
        .getPublicUrl(path);

      return publicUrl;
    } catch (err: any) {
      toast({ title: 'Error al subir imagen', description: err.message, variant: 'destructive' });
      return product?.image_url || null;
    } finally {
      setUploadingImage(false);
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_IMAGE_SIZE) {
      toast({ title: 'Imagen muy grande', description: 'El tamaño máximo es 500 KB', variant: 'destructive' });
      return;
    }

    if (!file.type.startsWith('image/')) {
      toast({ title: 'Archivo no válido', description: 'Solo se permiten imágenes', variant: 'destructive' });
      return;
    }

    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const onSubmit = async (data: ProductFormData) => {
    if (!profile?.business_id) {
      toast({ title: 'Error', description: 'No se encontró tu negocio. Recarga la página.', variant: 'destructive' });
      return;
    }
    const businessId = profile.business_id;

    const salePrice = (data.tipo === 'elaborado' || data.tipo === 'granel') && data.sale_price
      ? parseFloat(data.sale_price)
      : (product?.sale_price ?? 0);

    const payload: any = {
      name: data.name,
      description: data.description || null,
      category_id: data.category_id || null,
      cost_price: product?.cost_price ?? 0,
      sale_price: salePrice,
      min_stock: product?.min_stock ?? 0,
      status: 'for_sale' as Product['status'],
      barcode: data.barcode || null,
      supplier: product?.supplier ?? null,
      unit_of_measure: data.unit_of_measure,
      brand: data.brand || null,
      tipo: data.tipo,
      insumo_area_id: data.tipo === 'ingrediente' ? (insumoAreaId || null) : null,
    };

    if (product) {
      const imageUrl = await uploadImage(product.id);
      await updateProduct.mutateAsync({ id: product.id, ...payload, image_url: imageUrl });
    } else {
      const created = await createProduct.mutateAsync({
        ...payload,
        business_id: businessId,
        image_url: null,
      });
      if (created?.id) {
        const imageUrl = await uploadImage(created.id);
        if (imageUrl) {
          await updateProduct.mutateAsync({ id: created.id, image_url: imageUrl });
        }
      }
    }

    onOpenChange(false);
    form.reset();
  };


  const isLoading = createProduct.isPending || updateProduct.isPending || uploadingImage;

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

              {/* Foto del producto */}
              <div className="flex items-center gap-3">
                <div 
                  className="relative h-20 w-20 rounded-lg border-2 border-dashed border-muted-foreground/30 flex items-center justify-center overflow-hidden cursor-pointer hover:border-primary/50 transition-colors flex-shrink-0"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {imagePreview ? (
                    <img src={imagePreview} alt="Producto" className="h-full w-full object-cover" />
                  ) : (
                    <Camera className="h-6 w-6 text-muted-foreground/50" />
                  )}
                  {imagePreview && (
                    <button
                      type="button"
                      className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center"
                      onClick={(e) => { e.stopPropagation(); removeImage(); }}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
                <div className="text-xs text-muted-foreground space-y-0.5">
                  <p className="font-medium">Foto del producto</p>
                  <p>Máx. 500 KB · JPG, PNG, WebP</p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handleImageSelect}
                />
              </div>
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
              
              <FormField
                control={form.control}
                name="tipo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de producto</FormLabel>
                    <FormControl>
                      <select
                        value={field.value}
                        onChange={(e) => field.onChange(e.target.value)}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <option value="ingrediente">Insumo (materia prima)</option>
                        <option value="reventa">Reventa (comprado para vender)</option>
                        <option value="elaborado">Elaborado (producción propia)</option>
                        <option value="granel">A granel (venta fraccionada)</option>
                      </select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Área de insumo (only for ingrediente) */}
              {form.watch('tipo') === 'ingrediente' && insumoAreas.length > 0 && (
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Área de insumo</label>
                  <select
                    value={insumoAreaId}
                    onChange={(e) => setInsumoAreaId(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="">Sin área</option>
                    {insumoAreas.map((area: any) => (
                      <option key={area.id} value={area.id}>{area.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="category_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Categoría</FormLabel>
                      <FormControl>
                        <select
                          value={field.value || ''}
                          onChange={(e) => field.onChange(e.target.value || undefined)}
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <option value="">Seleccionar</option>
                          {categories.map((cat) => (
                            <option key={cat.id} value={cat.id}>{cat.name}</option>
                          ))}
                        </select>
                      </FormControl>
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
                      <FormControl>
                        <select
                          value={field.value}
                          onChange={(e) => field.onChange(e.target.value)}
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          {unitOptions.map((unit) => (
                            <option key={unit} value={unit}>{unit}</option>
                          ))}
                        </select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <Separator />

            {/* ─── Sección 3: Inventario (solo lectura) ─── */}
            <div className="space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Inventario</p>
              <div className="rounded-lg border bg-muted/30 p-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  Existencia actual
                </div>
                <p className="text-lg font-bold mt-1">{product ? productStock : 0}</p>
                {!product && (
                  <p className="text-xs text-muted-foreground">Usa el botón de entrada en la lista para agregar stock</p>
                )}
              </div>
            </div>

            {/* ─── Sección 4: Precio de venta (solo elaborado) ─── */}
            {form.watch('tipo') === 'elaborado' && (
              <>
                <Separator />
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Precio</p>
                  <FormField
                    control={form.control}
                    name="sale_price"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Precio de venta</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={0}
                            step="0.01"
                            placeholder="Precio al público"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </>
            )}

            {/* ─── Sección 5: Receta (solo elaborado, al editar) ─── */}
            {product && form.watch('tipo') === 'elaborado' && (
              <>
                <Separator />
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Receta</p>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={() => setRecipeOpen(true)}
                  >
                    <ChefHat className="h-4 w-4 mr-2" />
                    Gestionar receta
                  </Button>
                </div>
              </>
            )}

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

        {product && (
          <RecipeManager
            open={recipeOpen}
            onOpenChange={setRecipeOpen}
            product={product}
          />
        )}
      </DialogContent>
    </Dialog>
  );
};
