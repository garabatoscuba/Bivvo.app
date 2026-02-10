import { useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ProductForm } from '@/components/inventory/ProductForm';
import { CategoryForm } from '@/components/inventory/CategoryForm';
import { CategoryBadge } from '@/components/inventory/CategoryBadge';
import { useProducts, useCategories, useBranchStock } from '@/hooks/useProducts';
import { useBranches } from '@/hooks/useBranches';
import { useAuth } from '@/contexts/AuthContext';
import { Plus, Search, Package, Loader2, Pencil, Trash2, FolderOpen } from 'lucide-react';
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

const Inventory = () => {
  const { profile, isOwner, isManager } = useAuth();
  const { products, isLoading: productsLoading, deleteProduct } = useProducts();
  const { categories, isLoading: categoriesLoading, deleteCategory } = useCategories();
  const { data: branches } = useBranches();
  
  const [search, setSearch] = useState('');
  const [selectedBranch, setSelectedBranch] = useState<string>('');
  const [productFormOpen, setProductFormOpen] = useState(false);
  const [categoryFormOpen, setCategoryFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [deletingCategory, setDeletingCategory] = useState<Category | null>(null);
  const [mainTab, setMainTab] = useState<string>('products');
  const [statusTab, setStatusTab] = useState<string>('for_sale');

  const { data: branchStock } = useBranchStock(selectedBranch || profile?.branch_id || branches?.[0]?.id);

  const canManage = isOwner || isManager;

  // Stock map
  const stockMap = new Map<string, number>();
  branchStock?.forEach((bs: any) => {
    stockMap.set(bs.product_id, bs.quantity);
  });

  // Filter products by status tab and search
  const filteredProducts = products.filter((product) => {
    const matchesSearch = !search || 
      product.name.toLowerCase().includes(search.toLowerCase()) ||
      product.code.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = product.status === statusTab;
    return matchesSearch && matchesStatus;
  });

  // Group products by category
  const groupedProducts = new Map<string, { category: Category | null; products: (Product & { category: Category | null })[] }>();
  
  // Products without category
  const uncategorized: (Product & { category: Category | null })[] = [];
  
  filteredProducts.forEach((product) => {
    if (product.category_id && product.category) {
      const group = groupedProducts.get(product.category_id);
      if (group) {
        group.products.push(product);
      } else {
        groupedProducts.set(product.category_id, {
          category: product.category,
          products: [product],
        });
      }
    } else {
      uncategorized.push(product);
    }
  });

  const handleEditProduct = (product: Product) => {
    if (canManage) {
      setEditingProduct(product);
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

  return (
    <AppLayout>
      <div className="space-y-4">
        {/* Header with search */}
        <div className="flex items-center gap-3">
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
              <SelectTrigger className="w-36">
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

        {/* Main Tabs: Products / Categories */}
        <Tabs value={mainTab} onValueChange={setMainTab}>
          <div className="flex items-center justify-between">
            <TabsList>
              <TabsTrigger value="products">Productos</TabsTrigger>
              <TabsTrigger value="categories">Categorías</TabsTrigger>
            </TabsList>

            {canManage && (
              <div className="flex gap-2">
                {mainTab === 'products' ? (
                  <Button size="sm" onClick={() => { setEditingProduct(null); setProductFormOpen(true); }}>
                    <Plus className="mr-1 h-4 w-4" />
                    Producto
                  </Button>
                ) : (
                  <Button size="sm" onClick={() => { setEditingCategory(null); setCategoryFormOpen(true); }}>
                    <Plus className="mr-1 h-4 w-4" />
                    Categoría
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Products Tab */}
          <TabsContent value="products" className="mt-4">
            {/* Status sub-tabs like the reference: En venta / Almacén */}
            <Tabs value={statusTab} onValueChange={setStatusTab}>
              <TabsList className="bg-transparent p-0 h-auto gap-4 border-b rounded-none w-full justify-start">
                <TabsTrigger 
                  value="for_sale" 
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-1 pb-2"
                >
                  En venta
                </TabsTrigger>
                <TabsTrigger 
                  value="warehouse" 
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-1 pb-2"
                >
                  Almacén
                </TabsTrigger>
              </TabsList>

              <TabsContent value={statusTab} className="mt-4">
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
                    {/* Grouped by category */}
                    {Array.from(groupedProducts.values()).map(({ category, products: groupProducts }) => (
                      <div key={category?.id || 'none'}>
                        {groupProducts.map((product) => (
                          <ProductRow
                            key={product.id}
                            product={product}
                            stock={stockMap.get(product.id) || 0}
                            color={product.category?.color || 'blue'}
                            onClick={() => handleEditProduct(product)}
                          />
                        ))}
                        <Separator className="my-3" />
                      </div>
                    ))}
                    {/* Uncategorized */}
                    {uncategorized.length > 0 && (
                      <div>
                        {uncategorized.map((product) => (
                          <ProductRow
                            key={product.id}
                            product={product}
                            stock={stockMap.get(product.id) || 0}
                            color="blue"
                            onClick={() => handleEditProduct(product)}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </TabsContent>

          {/* Categories Tab */}
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
                  <Button className="mt-4" onClick={() => setCategoryFormOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Nueva Categoría
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {categories.map((cat) => (
                  <div
                    key={cat.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn('h-8 w-8 rounded-full', colorMap[cat.color] || colorMap.blue)} />
                      <div>
                        <p className="font-medium">{cat.name}</p>
                        {cat.description && (
                          <p className="text-xs text-muted-foreground">{cat.description}</p>
                        )}
                      </div>
                    </div>
                    {canManage && (
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleEditCategory(cat)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => setDeletingCategory(cat)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

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

// Product row component matching the reference design
interface ProductRowProps {
  product: Product & { category: Category | null };
  stock: number;
  color: string;
  onClick: () => void;
}

const ProductRow = ({ product, stock, color, onClick }: ProductRowProps) => {
  const bgColor = colorMap[color] || colorMap.blue;

  return (
    <button
      className="flex items-center gap-3 w-full text-left py-2 px-1 rounded-lg hover:bg-muted/50 active:bg-muted transition-colors"
      onClick={onClick}
    >
      <span className={cn(
        'inline-flex items-center justify-center h-8 min-w-[2.5rem] px-2 rounded-md text-sm font-semibold',
        bgColor
      )}>
        {stock.toString().padStart(2, '0')}
      </span>
      <span className="font-medium text-sm truncate">{product.name}</span>
    </button>
  );
};

export default Inventory;
