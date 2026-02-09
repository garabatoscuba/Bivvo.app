import { useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ProductCard } from '@/components/inventory/ProductCard';
import { ProductForm } from '@/components/inventory/ProductForm';
import { CategoryForm } from '@/components/inventory/CategoryForm';
import { CategoryBadge } from '@/components/inventory/CategoryBadge';
import { useProducts, useCategories, useBranchStock } from '@/hooks/useProducts';
import { useBranches } from '@/hooks/useBranches';
import { useAuth } from '@/contexts/AuthContext';
import { Plus, Search, Package, FolderOpen, Loader2 } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Product, Category } from '@/types/database';

const Inventory = () => {
  const { profile, isOwner, isManager } = useAuth();
  const { products, isLoading: productsLoading } = useProducts();
  const { categories, isLoading: categoriesLoading } = useCategories();
  const { data: branches } = useBranches();
  
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedBranch, setSelectedBranch] = useState<string>('');
  const [productFormOpen, setProductFormOpen] = useState(false);
  const [categoryFormOpen, setCategoryFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const { data: branchStock } = useBranchStock(selectedBranch || profile?.branch_id || branches?.[0]?.id);

  const canManage = isOwner || isManager;

  // Crear mapa de stock por producto
  const stockMap = new Map<string, number>();
  branchStock?.forEach((bs: any) => {
    stockMap.set(bs.product_id, bs.quantity);
  });

  // Filtrar productos
  const filteredProducts = products.filter((product) => {
    const matchesSearch = product.name.toLowerCase().includes(search.toLowerCase()) ||
                         product.code.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || product.category_id === selectedCategory;
    const matchesStatus = product.status !== 'discontinued';
    return matchesSearch && matchesCategory && matchesStatus;
  });

  const handleProductClick = (product: Product) => {
    if (canManage) {
      setEditingProduct(product);
      setProductFormOpen(true);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl font-bold">Inventario</h1>
          {canManage && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCategoryFormOpen(true)}
              >
                <FolderOpen className="mr-2 h-4 w-4" />
                Nueva Categoría
              </Button>
              <Button size="sm" onClick={() => setProductFormOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Nuevo Producto
              </Button>
            </div>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar productos..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          
          {branches && branches.length > 1 && (
            <Select value={selectedBranch} onValueChange={setSelectedBranch}>
              <SelectTrigger className="w-full sm:w-48">
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

        {/* Category Tabs */}
        <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
          <TabsList className="flex h-auto flex-wrap justify-start gap-2 bg-transparent p-0">
            <TabsTrigger
              value="all"
              className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              Todos
            </TabsTrigger>
            {categories.map((cat) => (
              <TabsTrigger
                key={cat.id}
                value={cat.id}
                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                <CategoryBadge name={cat.name} color={cat.color} />
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value={selectedCategory} className="mt-4">
            {productsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Package className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="font-semibold">No hay productos</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {search ? 'No se encontraron productos con ese nombre' : 'Comienza agregando tu primer producto'}
                </p>
                {canManage && !search && (
                  <Button className="mt-4" onClick={() => setProductFormOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Agregar Producto
                  </Button>
                )}
              </div>
            ) : (
              <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {filteredProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    stock={stockMap.get(product.id) || 0}
                    onClick={() => handleProductClick(product)}
                  />
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
        onOpenChange={setCategoryFormOpen}
      />
    </AppLayout>
  );
};

export default Inventory;
