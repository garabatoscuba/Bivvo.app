import { useState, useMemo } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ProductForm } from '@/components/inventory/ProductForm';
import { CategoryForm } from '@/components/inventory/CategoryForm';
import { useProducts, useCategories, useBranchStock } from '@/hooks/useProducts';
import { useBranches } from '@/hooks/useBranches';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';
import { Plus, Search, Package, Loader2, Pencil, Trash2, FolderOpen, X, TrendingUp, AlertTriangle, DollarSign, BarChart3, PackagePlus, PackageX } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import type { Product, Category } from '@/types/database';

const colorMap: Record<string, string> = {
  pink: 'bg-category-pink text-category-pink-foreground',
  green: 'bg-category-green text-category-green-foreground',
  blue: 'bg-category-blue text-category-blue-foreground',
  orange: 'bg-category-orange text-category-orange-foreground',
  purple: 'bg-category-purple text-category-purple-foreground',
};

const colorDotMap: Record<string, string> = {
  pink: 'bg-category-pink',
  green: 'bg-category-green',
  blue: 'bg-category-blue',
  orange: 'bg-category-orange',
  purple: 'bg-category-purple',
};

const Inventory = () => {
  const { profile, isOwner, isManager } = useAuth();
  const { products, isLoading: productsLoading, deleteProduct } = useProducts();
  const { categories, isLoading: categoriesLoading, deleteCategory } = useCategories();
  const { data: branches } = useBranches();
  const queryClient = useQueryClient();
  
  const [search, setSearch] = useState('');
  const [selectedBranch, setSelectedBranch] = useState<string>('');
  const [productFormOpen, setProductFormOpen] = useState(false);
  const [categoryFormOpen, setCategoryFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [deletingCategory, setDeletingCategory] = useState<Category | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<(Product & { category: Category | null }) | null>(null);
  const [mainTab, setMainTab] = useState<string>('products');
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);
  const [stockEntryProduct, setStockEntryProduct] = useState<Product | null>(null);
  const [stockQtyForSale, setStockQtyForSale] = useState(0);
  const [stockQtyWarehouse, setStockQtyWarehouse] = useState(0);
  const [addingStock, setAddingStock] = useState(false);

  const { data: branchStock } = useBranchStock(selectedBranch || profile?.branch_id || branches?.[0]?.id);

  const canManage = isOwner || isManager;

  // Stock map
  const stockMap = new Map<string, number>();
  branchStock?.forEach((bs: any) => {
    stockMap.set(bs.product_id, bs.quantity);
  });

  // Filter products (all statuses except discontinued)
  const filteredProducts = useMemo(() => products.filter((product) => {
    const matchesSearch = !search || 
      product.name.toLowerCase().includes(search.toLowerCase()) ||
      product.code.toLowerCase().includes(search.toLowerCase());
    return matchesSearch && product.status !== 'discontinued';
  }), [products, search]);

  // Group products by category
  const groupedProducts = useMemo(() => {
    const groups = new Map<string, { category: Category | null; products: (Product & { category: Category | null })[] }>();
    const uncategorized: (Product & { category: Category | null })[] = [];
    
    filteredProducts.forEach((product) => {
      if (product.category_id && product.category) {
        const group = groups.get(product.category_id);
        if (group) {
          group.products.push(product);
        } else {
          groups.set(product.category_id, {
            category: product.category,
            products: [product],
          });
        }
      } else {
        uncategorized.push(product);
      }
    });

    return { groups, uncategorized };
  }, [filteredProducts]);

  const [expandedStat, setExpandedStat] = useState<string | null>(null);

  // Stats
  const stats = useMemo(() => {
    const forSale = products.filter(p => p.status === 'for_sale').length;
    const warehouse = products.filter(p => p.status === 'warehouse').length;
    const totalStock = Array.from(stockMap.values()).reduce((a, b) => a + b, 0);
    const lowStock = products.filter(p => {
      const stock = stockMap.get(p.id) || 0;
      return stock <= p.min_stock && stock > 0 && p.status === 'for_sale';
    }).length;
    const outOfStock = products.filter(p => {
      const stock = stockMap.get(p.id) || 0;
      return stock <= 0 && p.status === 'for_sale';
    }).length;
    const totalValue = products.reduce((sum, p) => {
      const stock = stockMap.get(p.id) || 0;
      return sum + (stock * Number(p.sale_price));
    }, 0);
    const costValue = products.reduce((sum, p) => {
      const stock = stockMap.get(p.id) || 0;
      return sum + (stock * Number(p.cost_price));
    }, 0);
    return { forSale, warehouse, totalStock, lowStock, outOfStock, totalValue, costValue };
  }, [products, stockMap]);

  const handleProductTap = (product: Product & { category: Category | null }) => {
    setSelectedProduct(product);
  };

  const handleEditProduct = () => {
    if (selectedProduct && canManage) {
      setEditingProduct(selectedProduct);
      setSelectedProduct(null);
      setProductFormOpen(true);
    }
  };

  const handleEditCategory = (category: Category) => {
    setEditingCategory(category);
    setCategoryFormOpen(true);
  };

  const handleDeleteCategory = async () => {
    if (deletingCategory) {
      await deleteCategory.mutateAsync(deletingCategory.id);
      setDeletingCategory(null);
    }
  };

  const handleDeleteProduct = async () => {
    if (deletingProduct) {
      await deleteProduct.mutateAsync(deletingProduct.id);
      setDeletingProduct(null);
    }
  };

  const handleAddStock = async () => {
    if (!stockEntryProduct || !profile?.user_id) return;
    const totalQty = stockQtyForSale + stockQtyWarehouse;
    if (totalQty <= 0) return;

    setAddingStock(true);
    try {
      const branchId = selectedBranch || profile.branch_id || branches?.[0]?.id;
      if (!branchId) return;

      // Upsert branch_stock
      const { data: existing } = await supabase
        .from('branch_stock')
        .select('id, quantity')
        .eq('branch_id', branchId)
        .eq('product_id', stockEntryProduct.id)
        .maybeSingle();

      if (existing) {
        await supabase
          .from('branch_stock')
          .update({ quantity: existing.quantity + totalQty })
          .eq('id', existing.id);
      } else {
        await supabase
          .from('branch_stock')
          .insert({ branch_id: branchId, product_id: stockEntryProduct.id, quantity: totalQty });
      }

      // Registrar movimiento
      await supabase
        .from('inventory_movements')
        .insert({
          branch_id: branchId,
          product_id: stockEntryProduct.id,
          user_id: profile.user_id,
          movement_type: 'purchase' as const,
          quantity: totalQty,
          notes: `Entrada: ${stockQtyForSale} venta, ${stockQtyWarehouse} almacén`,
        });

      queryClient.invalidateQueries({ queryKey: ['branch-stock'] });
      toast({ title: `Entrada de ${totalQty} unidades registrada` });
      setStockEntryProduct(null);
      setStockQtyForSale(0);
      setStockQtyWarehouse(0);
    } catch (err: any) {
      toast({ title: 'Error al dar entrada', description: err.message, variant: 'destructive' });
    } finally {
      setAddingStock(false);
    }
  };

  // Product detail data
  const selectedStock = selectedProduct ? (stockMap.get(selectedProduct.id) || 0) : 0;
  const selectedMargin = selectedProduct 
    ? ((Number(selectedProduct.sale_price) - Number(selectedProduct.cost_price)) / Number(selectedProduct.sale_price) * 100)
    : 0;

  return (
    <AppLayout>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          
          {branches && branches.length > 1 && (
            <Select value={selectedBranch} onValueChange={setSelectedBranch}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Sucursal" />
              </SelectTrigger>
              <SelectContent>
                {branches.map((branch) => (
                  <SelectItem key={branch.id} value={branch.id}>
                    {branch.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Tabs + Action Buttons */}
        <Tabs value={mainTab} onValueChange={setMainTab}>
          <TabsList>
            <TabsTrigger value="products" className="flex items-center gap-2">
              Productos
              {canManage && (
                <button
                  type="button"
                  className="ml-1 inline-flex h-5 w-5 items-center justify-center rounded bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingProduct(null);
                    setProductFormOpen(true);
                  }}
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              )}
            </TabsTrigger>
            <TabsTrigger value="categories" className="flex items-center gap-2">
              Categorías
              {canManage && (
                <button
                  type="button"
                  className="ml-1 inline-flex h-5 w-5 items-center justify-center rounded bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingCategory(null);
                    setCategoryFormOpen(true);
                  }}
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              )}
            </TabsTrigger>
          </TabsList>

          {/* ─── Products Tab ─── */}
          <TabsContent value="products" className="mt-4 space-y-4">
            {/* Quick stats bar */}
            <div className="grid grid-cols-4 gap-1.5">
              <StatPill 
                icon={Package} 
                label="En venta" 
                value={stats.forSale} 
                expanded={expandedStat === 'forSale'}
                onToggle={() => setExpandedStat(expandedStat === 'forSale' ? null : 'forSale')}
                details={[
                  { label: 'Unidades totales', value: `${stats.totalStock}` },
                  { label: 'Valor inventario', value: `$${stats.totalValue.toLocaleString('en', { minimumFractionDigits: 2 })}` },
                ]}
              />
              <StatPill 
                icon={BarChart3} 
                label="Almacén" 
                value={stats.warehouse}
                expanded={expandedStat === 'warehouse'}
                onToggle={() => setExpandedStat(expandedStat === 'warehouse' ? null : 'warehouse')}
                details={[
                  { label: 'Costo total', value: `$${stats.costValue.toLocaleString('en', { minimumFractionDigits: 2 })}` },
                ]}
              />
              <StatPill 
                icon={AlertTriangle} 
                label="Stock bajo" 
                value={stats.lowStock} 
                alert={stats.lowStock > 0}
                expanded={expandedStat === 'lowStock'}
                onToggle={() => setExpandedStat(expandedStat === 'lowStock' ? null : 'lowStock')}
                details={[
                  { label: 'Requieren reabastecimiento pronto', value: '' },
                ]}
              />
              <StatPill 
                icon={PackageX} 
                label="Sin stock" 
                value={stats.outOfStock} 
                alert={stats.outOfStock > 0}
                expanded={expandedStat === 'outOfStock'}
                onToggle={() => setExpandedStat(expandedStat === 'outOfStock' ? null : 'outOfStock')}
                details={[
                  { label: 'No disponibles para venta', value: '' },
                ]}
              />
            </div>

            {productsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Package className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="font-semibold">No hay productos</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {search ? 'No se encontraron resultados' : 'Comienza agregando tu primer producto'}
                </p>
                {canManage && !search && (
                  <Button className="mt-4" onClick={() => setProductFormOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Agregar Producto
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-1">
                {Array.from(groupedProducts.groups.values()).map(({ category, products: groupProducts }) => (
                  <div key={category?.id || 'none'}>
                    {groupProducts.map((product) => (
                      <ProductRow
                        key={product.id}
                        product={product}
                        stock={stockMap.get(product.id) || 0}
                        color={product.category?.color || 'blue'}
                        onClick={() => handleProductTap(product)}
                        canManage={canManage}
                        onDelete={() => setDeletingProduct(product)}
                        onAddStock={() => { setStockEntryProduct(product); setStockQtyForSale(0); setStockQtyWarehouse(0); }}
                      />
                    ))}
                    <Separator className="my-2" />
                  </div>
                ))}
                {groupedProducts.uncategorized.length > 0 && (
                  <div>
                    {groupedProducts.uncategorized.map((product) => (
                      <ProductRow
                        key={product.id}
                        product={product}
                        stock={stockMap.get(product.id) || 0}
                        color="blue"
                        onClick={() => handleProductTap(product)}
                        canManage={canManage}
                        onDelete={() => setDeletingProduct(product)}
                        onAddStock={() => { setStockEntryProduct(product); setStockQtyForSale(0); setStockQtyWarehouse(0); }}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          {/* ─── Categories Tab ─── */}
          <TabsContent value="categories" className="mt-4">
            {categoriesLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : categories.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <FolderOpen className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="font-semibold">No hay categorías</h3>
                <p className="text-sm text-muted-foreground mt-1">Crea tu primera categoría</p>
                {canManage && (
                  <Button className="mt-4" onClick={() => { setEditingCategory(null); setCategoryFormOpen(true); }}>
                    <Plus className="mr-2 h-4 w-4" />
                    Nueva Categoría
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {categories.map((cat) => {
                  const catProducts = products.filter(p => p.category_id === cat.id && p.status !== 'discontinued');
                  return (
                    <div
                      key={cat.id}
                      className="flex items-center justify-between rounded-lg border p-3"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className={cn('h-8 w-8 rounded-full flex-shrink-0', colorDotMap[cat.color] || colorDotMap.blue)} />
                        <div className="min-w-0">
                          <p className="font-medium truncate">{cat.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {catProducts.length} producto{catProducts.length !== 1 ? 's' : ''}
                          </p>
                        </div>
                      </div>
                      {canManage && (
                        <div className="flex gap-1 flex-shrink-0">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEditCategory(cat)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeletingCategory(cat)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* ─── Product Detail Sheet ─── */}
      <Sheet open={!!selectedProduct} onOpenChange={(open) => !open && setSelectedProduct(null)}>
        <SheetContent side="bottom" className="h-auto max-h-[70vh] rounded-t-2xl">
          {selectedProduct && (
            <div className="space-y-4 pb-4">
              <SheetHeader className="text-left">
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <SheetTitle className="text-lg">{selectedProduct.name}</SheetTitle>
                    <p className="text-sm text-muted-foreground">{selectedProduct.code}</p>
                  </div>
                  {selectedProduct.category && (
                    <span className={cn(
                      'text-xs font-medium px-2.5 py-1 rounded-full flex-shrink-0',
                      colorMap[selectedProduct.category.color] || colorMap.blue
                    )}>
                      {selectedProduct.category.name}
                    </span>
                  )}
                </div>
              </SheetHeader>

              {/* Extra info */}
              {(selectedProduct.brand || selectedProduct.supplier || selectedProduct.unit_of_measure) && (
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  {selectedProduct.brand && <span className="bg-muted px-2 py-1 rounded">{selectedProduct.brand}</span>}
                  {selectedProduct.unit_of_measure && <span className="bg-muted px-2 py-1 rounded">{selectedProduct.unit_of_measure}</span>}
                  {selectedProduct.supplier && <span className="bg-muted px-2 py-1 rounded">Prov: {selectedProduct.supplier}</span>}
                </div>
              )}

              {/* Key metrics */}
              <div className="grid grid-cols-2 gap-3">
                <MetricCard
                  label="Stock actual"
                  value={selectedStock.toString()}
                  sublabel={selectedProduct.status === 'for_sale' ? 'En venta' : 'Almacén'}
                  alert={selectedStock <= selectedProduct.min_stock}
                />
                <MetricCard
                  label="Margen"
                  value={`${selectedMargin.toFixed(0)}%`}
                  sublabel={`Costo $${Number(selectedProduct.cost_price).toFixed(2)}`}
                />
                <MetricCard
                  label="Precio venta"
                  value={`$${Number(selectedProduct.sale_price).toFixed(2)}`}
                  sublabel="PVP"
                />
                <MetricCard
                  label="Valor en stock"
                  value={`$${(selectedStock * Number(selectedProduct.sale_price)).toFixed(2)}`}
                  sublabel={`${selectedStock} × $${Number(selectedProduct.sale_price).toFixed(2)}`}
                />
              </div>

              {/* Stock alert */}
              {selectedStock <= selectedProduct.min_stock && (
                <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm">
                  <AlertTriangle className="h-4 w-4 text-destructive flex-shrink-0" />
                  <span>
                    {selectedStock <= 0 
                      ? 'Sin stock disponible' 
                      : `Stock bajo — mínimo recomendado: ${selectedProduct.min_stock}`
                    }
                  </span>
                </div>
              )}

              {/* Actions */}
              {canManage && (
                <div className="flex gap-3 pt-2">
                  <Button variant="outline" className="flex-1" onClick={handleEditProduct}>
                    <Pencil className="mr-2 h-4 w-4" />
                    Editar
                  </Button>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Modals */}
      <ProductForm
        open={productFormOpen}
        onOpenChange={(open) => {
          setProductFormOpen(open);
          if (!open) setEditingProduct(null);
        }}
        product={editingProduct}
      />
      
      <CategoryForm
        open={categoryFormOpen}
        onOpenChange={(open) => {
          setCategoryFormOpen(open);
          if (!open) setEditingCategory(null);
        }}
        category={editingCategory}
      />

      {/* Delete Category Confirmation */}
      <AlertDialog open={!!deletingCategory} onOpenChange={(open) => !open && setDeletingCategory(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar categoría?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará "{deletingCategory?.name}". Los productos de esta categoría quedarán sin categoría.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteCategory} className="bg-destructive text-destructive-foreground">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Product Confirmation */}
      <AlertDialog open={!!deletingProduct} onOpenChange={(open) => !open && setDeletingProduct(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar producto?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará "{deletingProduct?.name}" permanentemente. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteProduct} className="bg-destructive text-destructive-foreground">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Stock Entry Dialog */}
      <AlertDialog open={!!stockEntryProduct} onOpenChange={(open) => { if (!open) { setStockEntryProduct(null); setStockQtyForSale(0); setStockQtyWarehouse(0); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Dar entrada — {stockEntryProduct?.name}</AlertDialogTitle>
            <AlertDialogDescription>
              Ingresa las cantidades a agregar al inventario.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">En venta</label>
              <Input 
                type="number" 
                min="0" 
                value={stockQtyForSale} 
                onChange={(e) => setStockQtyForSale(Math.max(0, parseInt(e.target.value) || 0))} 
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">En almacén</label>
              <Input 
                type="number" 
                min="0" 
                value={stockQtyWarehouse} 
                onChange={(e) => setStockQtyWarehouse(Math.max(0, parseInt(e.target.value) || 0))} 
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleAddStock} 
              disabled={addingStock || (stockQtyForSale + stockQtyWarehouse) <= 0}
            >
              {addingStock ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Dar entrada ({stockQtyForSale + stockQtyWarehouse})
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
};

/* ─── Sub-components ─── */

interface ProductRowProps {
  product: Product & { category: Category | null };
  stock: number;
  color: string;
  onClick: () => void;
  canManage: boolean;
  onDelete: () => void;
  onAddStock: () => void;
}

const ProductRow = ({ product, stock, color, onClick, canManage, onDelete, onAddStock }: ProductRowProps) => {
  const bgColor = colorMap[color] || colorMap.blue;
  const isLow = stock <= product.min_stock;

  return (
    <div className="flex items-center gap-2 py-1.5 px-1 rounded-lg hover:bg-muted/50 transition-colors group">
      <button
        className="flex items-center gap-3 flex-1 text-left min-w-0"
        onClick={onClick}
      >
        <span className={cn(
          'inline-flex items-center justify-center h-8 min-w-[2.5rem] px-2 rounded-md text-sm font-semibold',
          bgColor
        )}>
          {stock.toString().padStart(2, '0')}
        </span>
        <span className="font-medium text-sm truncate flex-1">{product.name}</span>
        {isLow && <AlertTriangle className="h-3.5 w-3.5 text-warning flex-shrink-0" />}
      </button>
      {canManage && (
        <div className="flex gap-0.5 flex-shrink-0">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onAddStock} title="Dar entrada">
            <PackagePlus className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={onDelete} title="Eliminar">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
};

interface StatPillProps {
  icon: React.ElementType;
  label: string;
  value: number;
  alert?: boolean;
  expanded?: boolean;
  onToggle?: () => void;
  details?: { label: string; value: string }[];
}

const StatPill = ({ icon: Icon, label, value, alert, expanded, onToggle, details }: StatPillProps) => (
  <div className="flex flex-col">
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        'flex flex-col items-center rounded-lg border p-2 text-center transition-colors w-full',
        alert && 'border-warning/50 bg-warning/5',
        expanded && !alert && 'border-primary/50 bg-primary/5',
      )}
    >
      <Icon className={cn('h-3.5 w-3.5 mb-0.5', alert ? 'text-warning' : 'text-muted-foreground')} />
      <span className="text-base font-bold leading-none">{value}</span>
      <span className="text-[9px] text-muted-foreground mt-0.5 leading-tight">{label}</span>
    </button>
    {expanded && details && details.length > 0 && (
      <div className="mt-1 rounded-md border bg-muted/30 px-2 py-1.5 space-y-0.5">
        {details.map((d, i) => (
          <div key={i} className="flex justify-between items-center gap-1">
            <span className="text-[10px] text-muted-foreground">{d.label}</span>
            {d.value && <span className="text-[10px] font-semibold">{d.value}</span>}
          </div>
        ))}
      </div>
    )}
  </div>
);

interface MetricCardProps {
  label: string;
  value: string;
  sublabel: string;
  alert?: boolean;
}

const MetricCard = ({ label, value, sublabel, alert }: MetricCardProps) => (
  <div className={cn(
    'rounded-lg border p-3',
    alert && 'border-warning/50 bg-warning/5'
  )}>
    <p className="text-xs text-muted-foreground">{label}</p>
    <p className={cn('text-xl font-bold', alert && 'text-warning')}>{value}</p>
    <p className="text-xs text-muted-foreground">{sublabel}</p>
  </div>
);

export default Inventory;
