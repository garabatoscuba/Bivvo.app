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
import { Plus, Search, Package, Loader2, Pencil, Trash2, FolderOpen, X, TrendingUp, AlertTriangle, DollarSign, BarChart3 } from 'lucide-react';
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
  const { products, isLoading: productsLoading } = useProducts();
  const { categories, isLoading: categoriesLoading, deleteCategory } = useCategories();
  const { data: branches } = useBranches();
  
  const [search, setSearch] = useState('');
  const [selectedBranch, setSelectedBranch] = useState<string>('');
  const [productFormOpen, setProductFormOpen] = useState(false);
  const [categoryFormOpen, setCategoryFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [deletingCategory, setDeletingCategory] = useState<Category | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<(Product & { category: Category | null }) | null>(null);
  const [mainTab, setMainTab] = useState<string>('products');

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
    return { forSale, warehouse, totalStock, lowStock, outOfStock, totalValue };
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
          <div className="flex items-center justify-between">
            <TabsList>
              <TabsTrigger value="products">Productos</TabsTrigger>
              <TabsTrigger value="categories">Categorías</TabsTrigger>
            </TabsList>

            {canManage && (
              <div className="flex gap-2">
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => { setEditingCategory(null); setCategoryFormOpen(true); }}
                >
                  <Plus className="mr-1 h-4 w-4" />
                  <span className="hidden sm:inline">Categoría</span>
                </Button>
                <Button 
                  size="sm" 
                  onClick={() => { setEditingProduct(null); setProductFormOpen(true); }}
                >
                  <Plus className="mr-1 h-4 w-4" />
                  <span className="hidden sm:inline">Producto</span>
                </Button>
              </div>
            )}
          </div>

          {/* ─── Products Tab ─── */}
          <TabsContent value="products" className="mt-4 space-y-4">
            {/* Quick stats bar */}
            <div className="grid grid-cols-3 gap-2">
              <StatPill icon={Package} label="En venta" value={stats.forSale} />
              <StatPill icon={BarChart3} label="Almacén" value={stats.warehouse} />
              <StatPill 
                icon={AlertTriangle} 
                label="Stock bajo" 
                value={stats.lowStock + stats.outOfStock} 
                alert={stats.lowStock + stats.outOfStock > 0}
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
    </AppLayout>
  );
};

/* ─── Sub-components ─── */

interface ProductRowProps {
  product: Product & { category: Category | null };
  stock: number;
  color: string;
  onClick: () => void;
}

const ProductRow = ({ product, stock, color, onClick }: ProductRowProps) => {
  const bgColor = colorMap[color] || colorMap.blue;
  const isLow = stock <= product.min_stock;

  return (
    <button
      className="flex items-center gap-3 w-full text-left py-2.5 px-1 rounded-lg hover:bg-muted/50 active:bg-muted transition-colors"
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
  );
};

interface StatPillProps {
  icon: React.ElementType;
  label: string;
  value: number;
  alert?: boolean;
}

const StatPill = ({ icon: Icon, label, value, alert }: StatPillProps) => (
  <div className={cn(
    'flex flex-col items-center rounded-lg border p-2.5 text-center',
    alert && 'border-warning/50 bg-warning/5'
  )}>
    <Icon className={cn('h-4 w-4 mb-1', alert ? 'text-warning' : 'text-muted-foreground')} />
    <span className="text-lg font-bold leading-none">{value}</span>
    <span className="text-[10px] text-muted-foreground mt-0.5">{label}</span>
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
