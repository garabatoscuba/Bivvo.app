import { useState, useMemo, useEffect } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ProductForm } from '@/components/inventory/ProductForm';
import { CategoryForm } from '@/components/inventory/CategoryForm';
import { useProducts, useCategories, useBranchStock } from '@/hooks/useProducts';
import { useBranches } from '@/hooks/useBranches';
import { useAuth } from '@/contexts/AuthContext';
import { useJornadaActiva } from '@/hooks/useJornadaActiva';
import SinJornadaActiva from '@/components/employees/SinJornadaActiva';
import SinJornadaAutorizada from '@/components/employees/SinJornadaAutorizada';
import { useSubscription } from '@/hooks/useSubscription';
import { useIsDowngraded } from '@/hooks/useIsDowngraded';
import DowngradeModal from '@/components/DowngradeModal';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';
import { useAuditLog } from '@/hooks/useAuditLog';
import { Plus, Search, Package, Loader2, Pencil, Trash2, FolderOpen, X, AlertTriangle, DollarSign, BarChart3, PackagePlus, PackageX, ArrowRightLeft, Star, ChefHat } from 'lucide-react';
import { MovementsLog } from '@/components/inventory/MovementsLog';
import { WarehouseOutflowDialog } from '@/components/inventory/WarehouseOutflowDialog';
import { MermaDialog } from '@/components/inventory/MermaDialog';
import { MermasTab } from '@/components/inventory/MermasTab';
import { StockEntryDialog } from '@/components/inventory/StockEntryDialog';
import { ProductionDialog } from '@/components/inventory/ProductionDialog';
import { RecipeManager } from '@/components/inventory/RecipeManager';
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
  const { profile, isOwner, isManager, isSuperAdmin } = useAuth();
  const { jornadaActiva, jornada, isLoading: jornadaLoading } = useJornadaActiva();
  const { planType } = useSubscription();
  const { products, isLoading: productsLoading, deleteProduct } = useProducts();
  const { categories, isLoading: categoriesLoading, deleteCategory } = useCategories();
  const { data: branches } = useBranches();
  const queryClient = useQueryClient();
  const auditLog = useAuditLog();
  
  const [search, setSearch] = useState('');
  const [selectedBranch, setSelectedBranch] = useState<string>(() => {
    return localStorage.getItem('last-branch') || '';
  });

  // Default to profile branch or main branch, and remember selection
  // Also validate that saved branch still exists in the branches list
  useEffect(() => {
    if (!branches?.length) return;
    // If selectedBranch is set, validate it exists in current branches
    if (selectedBranch) {
      const exists = branches.some(b => b.id === selectedBranch);
      if (exists) return; // valid, keep it
    }
    // Fallback to profile branch, main branch, or first branch
    const profileBranch = branches.find(b => b.id === profile?.branch_id);
    const mainBranch = branches.find(b => b.is_main);
    const fallback = profileBranch || mainBranch || branches[0];
    if (fallback) {
      setSelectedBranch(fallback.id);
      localStorage.setItem('last-branch', fallback.id);
    }
  }, [branches, profile?.branch_id, selectedBranch]);

  const handleBranchChange = (branchId: string) => {
    setSelectedBranch(branchId);
    localStorage.setItem('last-branch', branchId);
  };
  const [productFormOpen, setProductFormOpen] = useState(false);
  const [categoryFormOpen, setCategoryFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [deletingCategory, setDeletingCategory] = useState<Category | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<(Product & { category: Category | null }) | null>(null);
  const [mainTab, setMainTab] = useState<string>('products');
  const [productTypeTab, setProductTypeTab] = useState<'reventa' | 'cocina'>('reventa');
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);
  const [stockEntryProduct, setStockEntryProduct] = useState<Product | null>(null);
  const [transferQty, setTransferQty] = useState(0);
  const [transferring, setTransferring] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [transferDirection, setTransferDirection] = useState<'toSale' | 'toWarehouse'>('toSale');
  const [outflowProduct, setOutflowProduct] = useState<Product | null>(null);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [mermaOpen, setMermaOpen] = useState(false);
  const [downgradeModalOpen, setDowngradeModalOpen] = useState(false);
  const [productionProduct, setProductionProduct] = useState<Product | null>(null);
  const [recipeProduct, setRecipeProduct] = useState<Product | null>(null);
  const { isDowngraded } = useIsDowngraded();

  const { data: branchStock } = useBranchStock(selectedBranch || profile?.branch_id || branches?.[0]?.id);

  const canManage = isOwner || isManager;

  // Product review stats from portal
  const businessId = profile?.business_id;
  const { data: productReviewStats } = useQuery({
    queryKey: ['product-review-stats', businessId],
    queryFn: async () => {
      if (!businessId) return {};
      const { data: branchIds } = await supabase
        .from('branches').select('id').eq('business_id', businessId);
      if (!branchIds?.length) return {};
      const ids = branchIds.map(b => b.id);
      const { data: reviews } = await supabase
        .from('reviews')
        .select('product_name, rating')
        .in('branch_id', ids)
        .not('product_name', 'is', null);
      if (!reviews?.length) return {};
      const stats: Record<string, { total: number; sum: number; count: number }> = {};
      reviews.forEach((r: any) => {
        const key = (r.product_name as string).toLowerCase();
        if (!stats[key]) stats[key] = { total: 0, sum: 0, count: 0 };
        stats[key].total++;
        if (r.rating && r.rating > 0) {
          stats[key].sum += r.rating;
          stats[key].count++;
        }
      });
      return stats;
    },
    enabled: !!businessId && (isOwner || isSuperAdmin),
  });

  // Plan limits
  const FREE_PRODUCT_LIMIT = 5;
  const FREE_CATEGORY_LIMIT = 2;
  const isFree = planType === 'free';
  const canCreateProduct = !isFree || products.length < FREE_PRODUCT_LIMIT;
  const canCreateCategory = !isFree || categories.length < FREE_CATEGORY_LIMIT;

  // Stock maps
  const stockMap = new Map<string, number>();
  const warehouseStockMap = new Map<string, number>();
  branchStock?.forEach((bs: any) => {
    stockMap.set(bs.product_id, bs.quantity);
    warehouseStockMap.set(bs.product_id, bs.warehouse_quantity || 0);
  });

  // Check if business has kitchen products
  const hasKitchenProducts = useMemo(() => 
    products.some((p: any) => p.tipo === 'ingrediente' || p.tipo === 'elaborado'),
    [products]
  );

  // Filter products (all statuses except discontinued)
  const filteredProducts = useMemo(() => products.filter((product) => {
    const matchesSearch = !search || 
      product.name.toLowerCase().includes(search.toLowerCase()) ||
      product.code.toLowerCase().includes(search.toLowerCase());
    if (!matchesSearch || product.status === 'discontinued') return false;

    // Type filter: only apply if business has kitchen products
    if (hasKitchenProducts) {
      const tipo = (product as any).tipo || 'reventa';
      if (productTypeTab === 'reventa' && tipo !== 'reventa') return false;
      if (productTypeTab === 'cocina' && tipo === 'reventa') return false;
    }
    
    if (!activeFilter) return true;
    
    const stock = stockMap.get(product.id) || 0;
    const wStock = warehouseStockMap.get(product.id) || 0;
    
    switch (activeFilter) {
      case 'forSale': return product.status === 'for_sale';
      case 'warehouse': return wStock > 0;
      case 'lowStock': return stock <= product.min_stock && stock > 0 && product.status === 'for_sale';
      case 'outOfStock': return stock <= 0 && product.status === 'for_sale';
      default: return true;
    }
  }), [products, search, activeFilter, stockMap, warehouseStockMap, hasKitchenProducts, productTypeTab]);

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

  const handleStatClick = (key: string) => {
    if (activeFilter === key) {
      setActiveFilter(null);
      setExpandedStat(null);
    } else {
      setActiveFilter(key);
      setExpandedStat(key);
    }
  };

  // Stats
  const stats = useMemo(() => {
    const forSale = products.filter(p => p.status === 'for_sale').length;
    const warehouse = products.filter(p => (warehouseStockMap.get(p.id) || 0) > 0).length;
    const totalStock = Array.from(stockMap.values()).reduce((a, b) => a + b, 0);
    const totalWarehouseStock = Array.from(warehouseStockMap.values()).reduce((a, b) => a + b, 0);
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
      const wStock = warehouseStockMap.get(p.id) || 0;
      return sum + ((stock + wStock) * Number(p.sale_price));
    }, 0);
    const costValue = products.reduce((sum, p) => {
      const stock = stockMap.get(p.id) || 0;
      const wStock = warehouseStockMap.get(p.id) || 0;
      return sum + ((stock + wStock) * Number(p.cost_price));
    }, 0);
    return { forSale, warehouse, totalStock, totalWarehouseStock, lowStock, outOfStock, totalValue, costValue };
  }, [products, stockMap, warehouseStockMap]);

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

  // handleAddStock removed — now handled by StockEntryDialog component

  const handleTransferToSale = async () => {
    if (!selectedProduct || !profile?.user_id || transferQty <= 0) return;
    setTransferring(true);
    try {
      const branchId = selectedBranch || profile.branch_id || branches?.[0]?.id;
      if (!branchId) return;

      const { data: existing } = await supabase
        .from('branch_stock')
        .select('id, quantity, warehouse_quantity')
        .eq('branch_id', branchId)
        .eq('product_id', selectedProduct.id)
        .maybeSingle();

      if (!existing || (existing.warehouse_quantity || 0) < transferQty) {
        toast({ title: 'No hay suficientes unidades en almacén', variant: 'destructive' });
        return;
      }

      await supabase
        .from('branch_stock')
        .update({
          quantity: existing.quantity + transferQty,
          warehouse_quantity: existing.warehouse_quantity - transferQty,
        })
        .eq('id', existing.id);

      // Register movements
      await supabase.from('inventory_movements').insert([
        {
          branch_id: branchId,
          product_id: selectedProduct.id,
          user_id: profile.user_id,
          movement_type: 'transfer_out' as const,
          quantity: transferQty,
          notes: 'Transferencia: almacén → venta',
        },
        {
          branch_id: branchId,
          product_id: selectedProduct.id,
          user_id: profile.user_id,
          movement_type: 'transfer_in' as const,
          quantity: transferQty,
          notes: 'Transferencia: almacén → venta',
        },
      ]);

      queryClient.invalidateQueries({ queryKey: ['branch-stock'] });
      toast({ title: `${transferQty} unidades pasadas a venta` });
      auditLog(
        'stock_transfer',
        `Transferencia de ${transferQty} unidades de ${selectedProduct?.name} de almacén a venta`,
        selectedProduct?.id,
        'product'
      );
      setTransferQty(0);
      setShowTransfer(false);
    } catch (err: any) {
      toast({ title: 'Error al transferir', description: err.message, variant: 'destructive' });
    } finally {
      setTransferring(false);
    }
  };

  const handleReturnToWarehouse = async () => {
    if (!selectedProduct || !profile?.user_id || transferQty <= 0) return;
    setTransferring(true);
    try {
      const branchId = selectedBranch || profile.branch_id || branches?.[0]?.id;
      if (!branchId) return;

      const { data: existing } = await supabase
        .from('branch_stock')
        .select('id, quantity, warehouse_quantity')
        .eq('branch_id', branchId)
        .eq('product_id', selectedProduct.id)
        .maybeSingle();

      if (!existing || existing.quantity < transferQty) {
        toast({ title: 'No hay suficientes unidades en venta', variant: 'destructive' });
        return;
      }

      await supabase
        .from('branch_stock')
        .update({
          quantity: existing.quantity - transferQty,
          warehouse_quantity: (existing.warehouse_quantity || 0) + transferQty,
        })
        .eq('id', existing.id);

      await supabase.from('inventory_movements').insert([
        {
          branch_id: branchId,
          product_id: selectedProduct.id,
          user_id: profile.user_id,
          movement_type: 'transfer_out' as const,
          quantity: transferQty,
          notes: 'Transferencia: venta → almacén',
        },
        {
          branch_id: branchId,
          product_id: selectedProduct.id,
          user_id: profile.user_id,
          movement_type: 'transfer_in' as const,
          quantity: transferQty,
          notes: 'Transferencia: venta → almacén',
        },
      ]);

      queryClient.invalidateQueries({ queryKey: ['branch-stock'] });
      toast({ title: `${transferQty} unidades devueltas a almacén` });
      setTransferQty(0);
      setShowTransfer(false);
    } catch (err: any) {
      toast({ title: 'Error al devolver', description: err.message, variant: 'destructive' });
    } finally {
      setTransferring(false);
    }
  };

  // Product detail data
  const selectedStock = selectedProduct ? (stockMap.get(selectedProduct.id) || 0) : 0;
  const selectedWarehouseStock = selectedProduct ? (warehouseStockMap.get(selectedProduct.id) || 0) : 0;
  const selectedTotalStock = selectedStock + selectedWarehouseStock;
  const selectedMargin = selectedProduct 
    ? ((Number(selectedProduct.sale_price) - Number(selectedProduct.cost_price)) / Number(selectedProduct.sale_price) * 100)
    : 0;

  const isPrivileged = isOwner || isManager || isSuperAdmin;
  const canBypassJornada = isOwner || isSuperAdmin;

  // Downgrade guard: returns true (blocked) if downgraded, showing the modal
  const guardDowngrade = (): boolean => {
    if (isDowngraded) {
      setDowngradeModalOpen(true);
      return true;
    }
    return false;
  };

  if (!canBypassJornada && jornadaLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  if (!canBypassJornada && !jornadaActiva) {
    return (
      <AppLayout>
        <SinJornadaActiva />
      </AppLayout>
    );
  }

  if (!canBypassJornada && jornadaActiva && jornada?.metodo_apertura !== 'manual_gerente') {
    return (
      <AppLayout>
        <SinJornadaAutorizada />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-3 overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          
          {branches && branches.length > 1 && (
            <Select value={selectedBranch} onValueChange={handleBranchChange}>
              <SelectTrigger className="w-auto shrink-0">
                <SelectValue />
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
          <TabsList className="w-full">
            <TabsTrigger value="products" className="flex items-center gap-1 flex-1 text-xs px-2">
              Productos
              {canManage && (
                <button
                  type="button"
                  className="inline-flex h-4 w-4 items-center justify-center rounded bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (guardDowngrade()) return;
                    if (!canCreateProduct) {
                      toast({ title: `Límite alcanzado`, description: `El plan gratuito permite máximo ${FREE_PRODUCT_LIMIT} productos. Mejora tu plan para agregar más.`, variant: 'destructive' });
                      return;
                    }
                    setEditingProduct(null);
                    setProductFormOpen(true);
                  }}
                >
                  <Plus className="h-3 w-3" />
                </button>
              )}
            </TabsTrigger>
            <TabsTrigger value="categories" className="flex items-center gap-1 flex-1 text-xs px-2">
              Categorías
              {canManage && (
                <button
                  type="button"
                  className="inline-flex h-4 w-4 items-center justify-center rounded bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (guardDowngrade()) return;
                    if (!canCreateCategory) {
                      toast({ title: `Límite alcanzado`, description: `El plan gratuito permite máximo ${FREE_CATEGORY_LIMIT} categorías. Mejora tu plan para agregar más.`, variant: 'destructive' });
                      return;
                    }
                    setEditingCategory(null);
                    setCategoryFormOpen(true);
                  }}
                >
                  <Plus className="h-3 w-3" />
                </button>
              )}
            </TabsTrigger>
            <TabsTrigger value="movements" className="flex items-center gap-1 flex-1 text-xs px-2">
              <ArrowRightLeft className="h-3.5 w-3.5 shrink-0" />
              Movim.
            </TabsTrigger>
            <TabsTrigger value="mermas" className="flex items-center gap-1 flex-1 text-xs px-2">
              <PackageX className="h-3.5 w-3.5 shrink-0" />
              Mermas
            </TabsTrigger>
          </TabsList>

          {/* ─── Products Tab ─── */}
          <TabsContent value="products" className="mt-4 space-y-4">
            {/* Sub-tabs: Reventa / Cocina (only if business has kitchen products) */}
            {hasKitchenProducts && (
              <div className="flex gap-1 rounded-lg bg-muted p-1">
                <button
                  type="button"
                  onClick={() => setProductTypeTab('reventa')}
                  className={cn(
                    "flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                    productTypeTab === 'reventa'
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Reventa
                </button>
                <button
                  type="button"
                  onClick={() => setProductTypeTab('cocina')}
                  className={cn(
                    "flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                    productTypeTab === 'cocina'
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  🍳 Cocina
                </button>
              </div>
            )}
            {/* Quick stats bar */}
            <div className="grid grid-cols-4 gap-1.5">
              <StatPill 
                icon={Package} 
                label="En venta" 
                value={stats.forSale} 
                active={activeFilter === 'forSale'}
                expanded={expandedStat === 'forSale'}
                onToggle={() => handleStatClick('forSale')}
                details={[
                  { label: 'Unidades en venta', value: `${stats.totalStock}` },
                  { label: 'Valor inventario', value: `$${stats.totalValue.toLocaleString('en', { minimumFractionDigits: 2 })}` },
                ]}
              />
              <StatPill 
                icon={BarChart3} 
                label="Almacén" 
                value={stats.warehouse}
                active={activeFilter === 'warehouse'}
                expanded={expandedStat === 'warehouse'}
                onToggle={() => handleStatClick('warehouse')}
                details={[
                  { label: 'Unidades en almacén', value: `${stats.totalWarehouseStock}` },
                  { label: 'Costo total', value: `$${stats.costValue.toLocaleString('en', { minimumFractionDigits: 2 })}` },
                ]}
              />
              <StatPill 
                icon={AlertTriangle} 
                label="Stock bajo" 
                value={stats.lowStock} 
                alert={stats.lowStock > 0}
                active={activeFilter === 'lowStock'}
                expanded={expandedStat === 'lowStock'}
                onToggle={() => handleStatClick('lowStock')}
                details={[
                  { label: 'Requieren reabastecimiento pronto', value: '' },
                ]}
              />
              <StatPill 
                icon={PackageX} 
                label="Sin stock" 
                value={stats.outOfStock} 
                alert={stats.outOfStock > 0}
                active={activeFilter === 'outOfStock'}
                expanded={expandedStat === 'outOfStock'}
                onToggle={() => handleStatClick('outOfStock')}
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
                  <Button className="mt-4" onClick={() => {
                    if (guardDowngrade()) return;
                    if (!canCreateProduct) {
                      toast({ title: `Límite alcanzado`, description: `El plan gratuito permite máximo ${FREE_PRODUCT_LIMIT} productos.`, variant: 'destructive' });
                      return;
                    }
                    setProductFormOpen(true);
                  }}>
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
                        warehouseStock={warehouseStockMap.get(product.id) || 0}
                        color={product.category?.color || 'blue'}
                        onClick={() => handleProductTap(product)}
                        canManage={canManage}
                        onDelete={() => setDeletingProduct(product)}
                        onAddStock={() => { if (!guardDowngrade()) setStockEntryProduct(product); }}
                        onTransferToSale={() => { if (guardDowngrade()) return; setSelectedProduct(product); setShowTransfer(true); setTransferDirection('toSale'); setTransferQty(1); }}
                        onOutflow={() => { if (!guardDowngrade()) setOutflowProduct(product); }}
                        onReturnToWarehouse={() => { if (guardDowngrade()) return; setSelectedProduct(product); setShowTransfer(true); setTransferDirection('toWarehouse'); setTransferQty(1); }}
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
                        warehouseStock={warehouseStockMap.get(product.id) || 0}
                        color="blue"
                        onClick={() => handleProductTap(product)}
                        canManage={canManage}
                        onDelete={() => setDeletingProduct(product)}
                        onAddStock={() => { if (!guardDowngrade()) setStockEntryProduct(product); }}
                        onTransferToSale={() => { if (guardDowngrade()) return; setSelectedProduct(product); setShowTransfer(true); setTransferDirection('toSale'); setTransferQty(1); }}
                        onOutflow={() => { if (!guardDowngrade()) setOutflowProduct(product); }}
                        onReturnToWarehouse={() => { if (guardDowngrade()) return; setSelectedProduct(product); setShowTransfer(true); setTransferDirection('toWarehouse'); setTransferQty(1); }}
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
                  <Button className="mt-4" onClick={() => {
                    if (!canCreateCategory) {
                      toast({ title: `Límite alcanzado`, description: `El plan gratuito permite máximo ${FREE_CATEGORY_LIMIT} categorías.`, variant: 'destructive' });
                      return;
                    }
                    setEditingCategory(null);
                    setCategoryFormOpen(true);
                  }}>
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
          {/* ─── Movements Tab ─── */}
          <TabsContent value="movements" className="mt-4">
            <MovementsLog branchId={selectedBranch || profile?.branch_id || branches?.[0]?.id || ''} />
          </TabsContent>

          {/* ─── Mermas Tab ─── */}
          <TabsContent value="mermas" className="mt-4">
            <MermasTab
              branchId={selectedBranch || profile?.branch_id || branches?.[0]?.id || ''}
              onRegisterMerma={() => { if (!guardDowngrade()) setMermaOpen(true); }}
            />
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
                    {/* Portal review stats */}
                    {(() => {
                      const stats = productReviewStats?.[selectedProduct.name.toLowerCase()];
                      const avg = stats && stats.count > 0 ? stats.sum / stats.count : 0;
                      return (
                        <div className="flex items-center gap-1.5 mt-1">
                          <div className="flex gap-0.5">
                            {[1, 2, 3, 4, 5].map(i => (
                              <Star key={i} size={12} className={i <= Math.round(avg) ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/20'} />
                            ))}
                          </div>
                          <span className="text-[10px] text-muted-foreground">
                            {stats?.count ? `${avg.toFixed(1)} (${stats.count})` : 'Sin valoraciones'}
                            {stats?.total ? ` · ${stats.total} mensajes` : ''}
                          </span>
                        </div>
                      );
                    })()}
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
                  label="En venta"
                  value={selectedStock.toString()}
                  sublabel={(selectedProduct as any).tipo === 'ingrediente' ? 'Materia prima' : 'Disponible en POS'}
                  alert={selectedStock <= selectedProduct.min_stock}
                />
                <MetricCard
                  label="En almacén"
                  value={selectedWarehouseStock.toString()}
                  sublabel="En reserva"
                />
                <MetricCard
                  label="Margen"
                  value={`${selectedMargin.toFixed(0)}%`}
                  sublabel={`Costo $${Number(selectedProduct.cost_price).toFixed(2)}`}
                />
                <MetricCard
                  label="Valor en stock"
                  value={`$${(selectedTotalStock * Number(selectedProduct.sale_price)).toFixed(2)}`}
                  sublabel={`${selectedTotalStock} uds. total`}
                />
              </div>

              {/* Stock distribution bar */}
              {selectedTotalStock > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground">Distribución de stock</p>
                  <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
                    <div 
                      className="bg-primary transition-all" 
                      style={{ width: `${(selectedStock / selectedTotalStock) * 100}%` }} 
                      title={`Venta: ${selectedStock}`}
                    />
                    <div 
                      className="bg-muted-foreground/30 transition-all" 
                      style={{ width: `${(selectedWarehouseStock / selectedTotalStock) * 100}%` }} 
                      title={`Almacén: ${selectedWarehouseStock}`}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-primary inline-block" /> Venta ({selectedStock})</span>
                    <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-muted-foreground/30 inline-block" /> Almacén ({selectedWarehouseStock})</span>
                  </div>
                </div>
              )}

              {/* Stock alert */}
              {selectedStock <= selectedProduct.min_stock && (
                <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm">
                  <AlertTriangle className="h-4 w-4 text-destructive flex-shrink-0" />
                  <span>
                    {selectedStock <= 0 
                      ? 'Sin stock disponible para venta' 
                      : `Stock bajo — mínimo recomendado: ${selectedProduct.min_stock}`
                    }
                    {selectedWarehouseStock > 0 && ' — Hay unidades en almacén'}
                  </span>
                </div>
              )}

              {/* Transfer warehouse → sale */}
              {canManage && (
                <div className="space-y-2">
                  {!showTransfer ? (
                    <div className="flex flex-col gap-2">
                      {/* Nueva Compra - only for reventa and ingrediente */}
                      {(selectedProduct as any).tipo !== 'elaborado' && (
                        <Button 
                          variant="outline" 
                          className="w-full justify-start"
                          onClick={() => {
                            if (guardDowngrade()) return;
                            const prod = selectedProduct;
                            setStockEntryProduct(prod);
                            setSelectedProduct(null);
                          }}
                        >
                          <PackagePlus className="mr-2 h-4 w-4" />
                          Nueva Compra
                        </Button>
                      )}
                      {/* Gestionar receta + Registrar producción - only for elaborado */}
                      {(selectedProduct as any).tipo === 'elaborado' && (
                        <>
                          <Button 
                            variant="outline" 
                            className="w-full justify-start"
                            onClick={() => {
                              setRecipeProduct(selectedProduct);
                              setSelectedProduct(null);
                            }}
                          >
                            <ChefHat className="mr-2 h-4 w-4" />
                            Gestionar receta
                          </Button>
                          <Button 
                            variant="outline" 
                            className="w-full justify-start"
                            onClick={() => {
                              if (guardDowngrade()) return;
                              setProductionProduct(selectedProduct);
                              setSelectedProduct(null);
                            }}
                          >
                            <PackagePlus className="mr-2 h-4 w-4" />
                            Registrar producción
                          </Button>
                        </>
                      )}
                      {(selectedWarehouseStock > 0 || selectedStock > 0) && (
                        <Button 
                          variant="outline" 
                          className="w-full justify-start"
                          onClick={() => {
                            if (guardDowngrade()) return;
                            const dir = selectedWarehouseStock > 0 ? 'toSale' : 'toWarehouse';
                            setTransferDirection(dir);
                            setShowTransfer(true);
                            setTransferQty(1);
                          }}
                        >
                          <ArrowRightLeft className="mr-2 h-4 w-4" />
                          {selectedWarehouseStock > 0 ? 'Almacén → Venta' : 'Venta → Almacén'}
                        </Button>
                      )}
                      {selectedWarehouseStock > 0 && (
                        <Button 
                          variant="outline" 
                          className="w-full justify-start"
                          onClick={() => {
                            if (guardDowngrade()) return;
                            setOutflowProduct(selectedProduct);
                            setSelectedProduct(null);
                          }}
                        >
                          <PackageX className="mr-2 h-4 w-4" />
                          Salida almacén
                         </Button>
                       )}
                     </div>
                  ) : (
                     (() => {
                       const isToSale = transferDirection === 'toSale';
                       const maxQty = isToSale ? selectedWarehouseStock : selectedStock;
                       const canFlip = isToSale ? selectedStock > 0 : selectedWarehouseStock > 0;
                       return (
                         <div className="rounded-lg border p-3 space-y-3">
                           <div className="flex items-center justify-between">
                             <div className="flex items-center gap-2">
                               <p className="text-sm font-medium">
                                 {isToSale ? 'Almacén → Venta' : 'Venta → Almacén'}
                               </p>
                               {canFlip && (
                                 <Button
                                   variant="ghost"
                                   size="icon"
                                   className="h-6 w-6"
                                   onClick={() => {
                                     setTransferDirection(isToSale ? 'toWarehouse' : 'toSale');
                                     setTransferQty(1);
                                   }}
                                   title="Cambiar dirección"
                                 >
                                   <ArrowRightLeft className="h-3.5 w-3.5" />
                                 </Button>
                               )}
                             </div>
                             <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowTransfer(false)}>
                               <X className="h-3.5 w-3.5" />
                             </Button>
                           </div>
                           <div className="flex items-center gap-3">
                             <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setTransferQty(Math.max(1, transferQty - 1))} disabled={transferQty <= 1}>
                               <span className="text-lg leading-none">−</span>
                             </Button>
                             <Input type="number" min={1} max={maxQty} value={transferQty} onChange={(e) => setTransferQty(Math.min(maxQty, Math.max(1, parseInt(e.target.value) || 1)))} className="w-20 text-center" />
                             <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setTransferQty(Math.min(maxQty, transferQty + 1))} disabled={transferQty >= maxQty}>
                               <span className="text-lg leading-none">+</span>
                             </Button>
                             <span className="text-xs text-muted-foreground">/ {maxQty}</span>
                           </div>
                           <Button
                             className="w-full"
                             onClick={isToSale ? handleTransferToSale : handleReturnToWarehouse}
                             disabled={transferring || transferQty <= 0 || transferQty > maxQty}
                           >
                             {transferring && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                             {isToSale ? 'Transferir' : 'Devolver'} {transferQty} unidad{transferQty !== 1 ? 'es' : ''}
                           </Button>
                         </div>
                       );
                     })()
                  )}
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
      <StockEntryDialog
        open={!!stockEntryProduct}
        onOpenChange={(open) => { if (!open) setStockEntryProduct(null); }}
        product={stockEntryProduct}
        branchId={selectedBranch || profile?.branch_id || branches?.[0]?.id || ''}
      />
      {/* Warehouse Outflow Dialog */}
      <WarehouseOutflowDialog
        open={!!outflowProduct}
        onOpenChange={(open) => { if (!open) setOutflowProduct(null); }}
        product={outflowProduct}
        warehouseStock={outflowProduct ? (warehouseStockMap.get(outflowProduct.id) || 0) : 0}
        branchId={selectedBranch || profile?.branch_id || branches?.[0]?.id || ''}
      />
      {/* Merma Dialog */}
      <MermaDialog
        open={mermaOpen}
        onOpenChange={setMermaOpen}
        branchId={selectedBranch || profile?.branch_id || branches?.[0]?.id || ''}
        products={products.map(p => ({ id: p.id, name: p.name, code: p.code, cost_price: Number(p.cost_price) }))}
        stockMap={stockMap}
      />
      <DowngradeModal open={downgradeModalOpen} onOpenChange={setDowngradeModalOpen} />
    </AppLayout>
  );
};

/* ─── Sub-components ─── */

interface ProductRowProps {
  product: Product & { category: Category | null };
  stock: number;
  warehouseStock: number;
  color: string;
  onClick: () => void;
  canManage: boolean;
  onDelete: () => void;
  onAddStock: () => void;
  onTransferToSale: () => void;
  onReturnToWarehouse: () => void;
  onOutflow: () => void;
}

const ProductRow = ({ product, stock, warehouseStock, color, onClick, canManage, onDelete, onAddStock, onTransferToSale, onReturnToWarehouse, onOutflow }: ProductRowProps) => {
  const bgColor = colorMap[color] || colorMap.blue;
  const isLow = stock <= product.min_stock;

  return (
    <div className="flex items-center gap-2 py-1.5 px-1 rounded-lg hover:bg-muted/50 transition-colors group">
      <button
        className="flex items-center gap-2 flex-1 text-left min-w-0"
        onClick={onClick}
      >
        <div className="flex gap-1 flex-shrink-0">
          <span className={cn(
            'inline-flex items-center justify-center h-8 min-w-[2.2rem] px-1.5 rounded-md text-xs font-semibold',
            bgColor
          )} title="En venta">
            {stock}
          </span>
          <span className="inline-flex items-center justify-center h-8 min-w-[2.2rem] px-1.5 rounded-md text-xs font-semibold bg-muted text-muted-foreground" title="Almacén">
            {warehouseStock}
          </span>
        </div>
        <span className="font-medium text-sm truncate flex-1">{product.name}</span>
        {isLow && <AlertTriangle className="h-3.5 w-3.5 text-warning flex-shrink-0" />}
      </button>
      {canManage && (
        <div className="flex gap-0.5 flex-shrink-0">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onAddStock} title="Dar entrada">
            <PackagePlus className="h-3.5 w-3.5" />
          </Button>
          {(warehouseStock > 0 || stock > 0) && (
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={warehouseStock > 0 ? onTransferToSale : onReturnToWarehouse} title="Transferir stock">
              <ArrowRightLeft className="h-3.5 w-3.5" />
            </Button>
          )}
          {warehouseStock > 0 && (
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onOutflow} title="Salida almacén">
              <PackageX className="h-3.5 w-3.5" />
            </Button>
          )}
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
  active?: boolean;
  expanded?: boolean;
  onToggle?: () => void;
  details?: { label: string; value: string }[];
}

const StatPill = ({ icon: Icon, label, value, alert, active, expanded, onToggle, details }: StatPillProps) => (
  <div className="flex flex-col min-w-0">
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        'flex flex-col items-center rounded-lg border p-2 text-center transition-all w-full gap-0.5',
        alert && !active && 'border-warning/40 bg-warning/5',
        alert && active && 'border-warning bg-warning/15',
        !alert && active && 'border-primary bg-primary/10',
        !alert && !active && 'border-border hover:border-muted-foreground/30',
      )}
    >
      <Icon className={cn('h-3.5 w-3.5', alert ? 'text-warning' : active ? 'text-primary' : 'text-muted-foreground')} />
      <span className={cn(
        'text-lg font-bold leading-none',
        alert ? 'text-warning' : active ? 'text-primary' : 'text-foreground',
      )}>{value}</span>
      <span className={cn(
        'text-[10px] leading-tight truncate w-full',
        active ? 'text-foreground/80 font-medium' : 'text-muted-foreground',
      )}>{label}</span>
    </button>
    {expanded && details && details.length > 0 && (
      <div className="mt-1 rounded-md border bg-muted/40 px-2 py-1.5 space-y-0.5">
        {details.map((d, i) => (
          <div key={i} className="flex justify-between items-center gap-1">
            <span className="text-[10px] text-muted-foreground truncate">{d.label}</span>
            {d.value && <span className="text-[10px] font-semibold text-foreground shrink-0">{d.value}</span>}
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
