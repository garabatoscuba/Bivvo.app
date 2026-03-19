import { useState, useMemo, useEffect } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { Plus, Search, Package, Loader2, Pencil, Trash2, FolderOpen, X, AlertTriangle, DollarSign, PackagePlus, PackageX, ArrowRightLeft, Star, ChefHat } from 'lucide-react';
import { MovementsLog } from '@/components/inventory/MovementsLog';
import { WarehouseOutflowDialog } from '@/components/inventory/WarehouseOutflowDialog';
import { MermaDialog } from '@/components/inventory/MermaDialog';
import { MermasTab } from '@/components/inventory/MermasTab';
import { StockEntryDialog } from '@/components/inventory/StockEntryDialog';
import { ProductionDialog } from '@/components/inventory/ProductionDialog';
import { RecipeManager } from '@/components/inventory/RecipeManager';
import InsumosInventoryTab from '@/components/inventory/InsumosInventoryTab';
import { useProductionCapacity } from '@/hooks/useProductionCapacity';
import { useProductionCapacities } from '@/hooks/useProductionCapacities';
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

const AREA_COLOR_BADGE_MAP: Record<string, string> = {
  blue: 'bg-blue-500 text-white',
  green: 'bg-green-500 text-white',
  orange: 'bg-orange-500 text-white',
  purple: 'bg-purple-500 text-white',
  pink: 'bg-pink-500 text-white',
  red: 'bg-red-500 text-white',
  yellow: 'bg-yellow-500 text-black',
  teal: 'bg-teal-500 text-white',
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
  
  const [mermaOpen, setMermaOpen] = useState(false);
  const [downgradeModalOpen, setDowngradeModalOpen] = useState(false);
  const [productionProduct, setProductionProduct] = useState<Product | null>(null);
  const [recipeProduct, setRecipeProduct] = useState<Product | null>(null);
  const [showGranelPriceEdit, setShowGranelPriceEdit] = useState(false);
  const [granelNewPrice, setGranelNewPrice] = useState('');
  const [granelPriceUpdating, setGranelPriceUpdating] = useState(false);
  const { isDowngraded } = useIsDowngraded();

  const effectiveBranchId = selectedBranch || profile?.branch_id || branches?.[0]?.id;
  const { data: branchStock } = useBranchStock(effectiveBranchId);

  const canManage = isOwner || isManager;

  // Production capacity for elaborado products (detail sheet)
  const isGranelSelected = (selectedProduct as any)?.tipo === 'granel';
  const { data: productionCapacity, isLoading: capacityLoading } = useProductionCapacity(
    ((selectedProduct as any)?.tipo === 'elaborado' || isGranelSelected) ? selectedProduct?.id || null : null,
    effectiveBranchId,
    { onlySellerStock: isGranelSelected }
  );

  // Batch capacity map for list badges (finite values only)
  const elaboradoIds = useMemo(
    () => products.filter((p: any) => p.tipo === 'elaborado' || p.tipo === 'granel').map(p => p.id),
    [products]
  );
  const granelIdSet = useMemo(
    () => new Set(products.filter((p: any) => p.tipo === 'granel').map(p => p.id)),
    [products]
  );
  const { data: productionCapacities } = useProductionCapacities(elaboradoIds, effectiveBranchId, { granelIds: granelIdSet });

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

  // Raw materials query (to include in Productos tab)
  const { data: rawMaterialsForProducts = [] } = useQuery({
    queryKey: ['raw-materials-for-products', businessId],
    queryFn: async () => {
      if (!businessId) return [];
      const { data, error } = await supabase
        .from('raw_materials')
        .select('*')
        .eq('business_id', businessId)
        .order('name');
      if (error) throw error;
      return data || [];
    },
    enabled: !!businessId,
  });

  // Insumo areas query (for area colors)
  const { data: insumoAreas = [] } = useQuery({
    queryKey: ['insumo-areas-colors', businessId],
    queryFn: async () => {
      if (!businessId) return [];
      const { data, error } = await supabase
        .from('insumo_areas')
        .select('id, name, color')
        .eq('business_id', businessId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!businessId,
    staleTime: 5 * 60 * 1000,
  });

  const areaColorMap = useMemo(() => {
    const map = new Map<string, string>();
    insumoAreas.forEach((a: any) => { if (a.color) map.set(a.id, a.color); });
    return map;
  }, [insumoAreas]);

  const areaNameMap = useMemo(() => {
    const map = new Map<string, string>();
    insumoAreas.forEach((a: any) => { if (a.name) map.set(a.id, a.name); });
    return map;
  }, [insumoAreas]);

  // Convert raw materials to Product-like objects for the products tab
  const rawMaterialsAsProducts = useMemo(() => {
    return rawMaterialsForProducts.map((mat: any) => {
      const materialUnit = mat.unit_purchase || mat.unit_use || 'Pieza';

      const category = categories.find((cat) => cat.id === mat.category_id) || null;

      return {
        id: mat.id,
        name: mat.name,
        code: mat.code || '',
        description: mat.description || '',
        sale_price: 0,
        cost_price: mat.costo_unitario || 0,
        min_stock: mat.stock_minimo || 0,
        unit: materialUnit,
        image_url: null,
        is_active: true,
        business_id: mat.business_id,
        category_id: mat.category_id || null,
        created_at: mat.created_at,
        updated_at: mat.updated_at || mat.created_at,
        tipo: 'ingrediente',
        insumo_area_id: mat.area_id,
        status: 'active',
        barcode: null,
        supplier: null,
        unit_of_measure: materialUnit,
        brand: mat.brand || null,
        category,
        _isRawMaterial: true,
        _stockVendedor: mat.stock_vendedor || 0,
        _stockAlmacen: mat.stock_almacen || 0,
        _areaColor: mat.area_id ? (areaColorMap.get(mat.area_id) || null) : null,
        _areaName: mat.area_id ? (areaNameMap.get(mat.area_id) || 'Uso') : 'Uso',
      };
    }) as unknown as (Product & { category: Category | null })[];
  }, [rawMaterialsForProducts, areaColorMap, areaNameMap]);

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

  const getDisplayForSaleStock = (product: Product & { [key: string]: any }) => {
    if (product?.tipo === 'elaborado' || product?.tipo === 'granel') {
      const cap = productionCapacities?.[product.id];
      if (typeof cap === 'number' && Number.isFinite(cap)) return cap;
    }
    return stockMap.get(product.id) || 0;
  };

  // Helpers for raw material stock & badge color
  const getProductStock = (product: any) => {
    if (product._isRawMaterial) return product._stockVendedor || 0;
    return getDisplayForSaleStock(product);
  };
  const getProductWarehouseStock = (product: any) => {
    if (product._isRawMaterial) return product._stockAlmacen || 0;
    return warehouseStockMap.get(product.id) || 0;
  };
  const getProductBadgeColor = (product: any): string | undefined => {
    if (product._isRawMaterial && product._areaColor) {
      return AREA_COLOR_BADGE_MAP[product._areaColor] || undefined;
    }
    // Non-raw-material products with tipo='ingrediente' also get area color
    if (product.tipo === 'ingrediente' && product.insumo_area_id) {
      const color = areaColorMap.get(product.insumo_area_id);
      if (color) return AREA_COLOR_BADGE_MAP[color] || undefined;
    }
    return undefined;
  };

  // Check if business is restaurant type (for kitchen features)
  const { data: inventoryBusinessData } = useQuery({
    queryKey: ['inventory-business-type', profile?.business_id],
    queryFn: async () => {
      if (!profile?.business_id) return null;
      const { data } = await supabase.from('businesses').select('business_type').eq('id', profile.business_id).maybeSingle();
      return data;
    },
    enabled: !!profile?.business_id,
    staleTime: 5 * 60 * 1000,
  });
  const isRestaurantBiz = inventoryBusinessData?.business_type === 'estaurente/safetería';

  // Check if business has kitchen products (only relevant for restaurants)
  const hasKitchenProducts = useMemo(() => 
    isRestaurantBiz && products.some((p: any) => p.tipo === 'ingrediente' || p.tipo === 'elaborado'),
    [products, isRestaurantBiz]
  );

  // Filter products (all statuses except discontinued) + include raw materials
  const filteredProducts = useMemo(() => {
    // Filter regular products
    const filtered = products.filter((product) => {
      const s = search.toLowerCase();
      const matchesSearch = !search || 
        product.name.toLowerCase().includes(s) ||
        product.code.toLowerCase().includes(s) ||
        (product.brand || '').toLowerCase().includes(s) ||
        (product.description || '').toLowerCase().includes(s);
      if (!matchesSearch || product.status === 'discontinued') return false;

      const tipo = (product as any).tipo || 'reventa';

      // Type filter: only apply if business has kitchen products (ingredients always pass)
      if (hasKitchenProducts && tipo !== 'ingrediente') {
        if (productTypeTab === 'reventa' && tipo !== 'reventa') return false;
        if (productTypeTab === 'cocina' && tipo === 'reventa') return false;
      }
      
      return true;
    });

    // Add raw materials (avoid duplicates by checking existing product IDs)
    const existingIds = new Set(filtered.map(p => p.id));
    const rawToAdd = rawMaterialsAsProducts.filter(rm => {
      if (existingIds.has(rm.id)) return false;
      if (!search) return true;
      const s = search.toLowerCase();
      return rm.name.toLowerCase().includes(s) || (rm.brand || '').toLowerCase().includes(s) || (rm.description || '').toLowerCase().includes(s);
    });

    return [...filtered, ...rawToAdd];
  }, [products, rawMaterialsAsProducts, search, stockMap, warehouseStockMap, hasKitchenProducts, productTypeTab, productionCapacities]);

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
    if (!deletingProduct) return;

    const isRawMaterialToDelete = !!(deletingProduct as any)._isRawMaterial;

    if (isRawMaterialToDelete) {
      const { error: recipeIngredientError } = await supabase
        .from('recipe_ingredients')
        .delete()
        .eq('ingredient_id', deletingProduct.id)
        .eq('is_raw_material', true);

      if (recipeIngredientError) {
        toast({ title: 'Error', description: recipeIngredientError.message, variant: 'destructive' });
        return;
      }

      const { error: rawMaterialError } = await supabase
        .from('raw_materials')
        .delete()
        .eq('id', deletingProduct.id);

      if (rawMaterialError) {
        toast({ title: 'Error', description: rawMaterialError.message, variant: 'destructive' });
        return;
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['raw-materials'] }),
        queryClient.invalidateQueries({ queryKey: ['raw-materials-for-products'] }),
        queryClient.invalidateQueries({ queryKey: ['raw-materials-for-recipe'] }),
        queryClient.invalidateQueries({ queryKey: ['recipe'] }),
        queryClient.invalidateQueries({ queryKey: ['recipe-ingredients'] }),
        queryClient.invalidateQueries({ queryKey: ['products'] }),
      ]);

      if (selectedProduct?.id === deletingProduct.id) {
        setSelectedProduct(null);
      }

      toast({ title: 'Insumo eliminado' });
    } else {
      await deleteProduct.mutateAsync(deletingProduct.id);
    }

    setDeletingProduct(null);
  };

  // handleAddStock removed — now handled by StockEntryDialog component

  const handleTransferToSale = async () => {
    if (!selectedProduct || !profile?.user_id || transferQty <= 0) return;
    setTransferring(true);
    try {
      const branchId = selectedBranch || profile.branch_id || branches?.[0]?.id;
      if (!branchId) return;
      const isRM = !!(selectedProduct as any)._isRawMaterial;

      if (isRM) {
        // Raw material: update raw_materials stock fields
        const { data: mat } = await supabase
          .from('raw_materials')
          .select('id, stock_almacen, stock_vendedor')
          .eq('id', selectedProduct.id)
          .single();

        if (!mat || (mat.stock_almacen || 0) < transferQty) {
          toast({ title: 'No hay suficientes unidades en almacén', variant: 'destructive' });
          return;
        }

        await supabase
          .from('raw_materials')
          .update({
            stock_almacen: (mat.stock_almacen || 0) - transferQty,
            stock_vendedor: (mat.stock_vendedor || 0) + transferQty,
          })
          .eq('id', mat.id);

        queryClient.invalidateQueries({ queryKey: ['raw-materials'] });
        queryClient.invalidateQueries({ queryKey: ['raw-materials-for-products'] });
      } else {
        // Regular product: update branch_stock
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

        queryClient.invalidateQueries({ queryKey: ['branch-stock'] });
      }

      const label = (selectedProduct as any).tipo === 'ingrediente' ? 'Transferencia: almacén → uso' : 'Transferencia: almacén → venta';

      // Register inventory movements
      await supabase.from('inventory_movements').insert([
        {
          branch_id: branchId,
          product_id: selectedProduct.id,
          user_id: profile.user_id,
          movement_type: 'transfer_out' as const,
          quantity: transferQty,
          notes: label,
        },
        {
          branch_id: branchId,
          product_id: selectedProduct.id,
          user_id: profile.user_id,
          movement_type: 'transfer_in' as const,
          quantity: transferQty,
          notes: label,
        },
      ]);

      queryClient.invalidateQueries({ queryKey: ['inventory-movements'] });
      toast({ title: (selectedProduct as any).tipo === 'ingrediente' ? `${transferQty} unidades pasadas a uso` : `${transferQty} unidades pasadas a venta` });
      auditLog(
        'stock_transfer',
        `Transferencia de ${transferQty} unidades de ${selectedProduct?.name} de almacén a ${isRM ? 'uso' : 'venta'}`,
        selectedProduct?.id,
        isRM ? 'raw_material' : 'product'
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
      const isRM = !!(selectedProduct as any)._isRawMaterial;

      if (isRM) {
        const { data: mat } = await supabase
          .from('raw_materials')
          .select('id, stock_almacen, stock_vendedor')
          .eq('id', selectedProduct.id)
          .single();

        if (!mat || (mat.stock_vendedor || 0) < transferQty) {
          toast({ title: 'No hay suficientes unidades en uso', variant: 'destructive' });
          return;
        }

        await supabase
          .from('raw_materials')
          .update({
            stock_vendedor: (mat.stock_vendedor || 0) - transferQty,
            stock_almacen: (mat.stock_almacen || 0) + transferQty,
          })
          .eq('id', mat.id);

        queryClient.invalidateQueries({ queryKey: ['raw-materials'] });
        queryClient.invalidateQueries({ queryKey: ['raw-materials-for-products'] });
      } else {
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

        queryClient.invalidateQueries({ queryKey: ['branch-stock'] });
      }

      const label = (selectedProduct as any).tipo === 'ingrediente' ? 'Transferencia: uso → almacén' : 'Transferencia: venta → almacén';

      // Register inventory movements
      await supabase.from('inventory_movements').insert([
        {
          branch_id: branchId,
          product_id: selectedProduct.id,
          user_id: profile.user_id,
          movement_type: 'transfer_out' as const,
          quantity: transferQty,
          notes: label,
        },
        {
          branch_id: branchId,
          product_id: selectedProduct.id,
          user_id: profile.user_id,
          movement_type: 'transfer_in' as const,
          quantity: transferQty,
          notes: label,
        },
      ]);

      queryClient.invalidateQueries({ queryKey: ['inventory-movements'] });
      toast({ title: `${transferQty} unidades devueltas a almacén` });
      auditLog(
        'stock_transfer',
        `Transferencia de ${transferQty} unidades de ${selectedProduct?.name} de ${isRM ? 'uso' : 'venta'} a almacén`,
        selectedProduct?.id,
        isRM ? 'raw_material' : 'product'
      );
      setTransferQty(0);
      setShowTransfer(false);
    } catch (err: any) {
      toast({ title: 'Error al devolver', description: err.message, variant: 'destructive' });
    } finally {
      setTransferring(false);
    }
  };

  // Product detail data
  const isRawMaterial = !!(selectedProduct as any)?._isRawMaterial;
  const isIngredientSelected = (selectedProduct as any)?.tipo === 'ingrediente';
  const selectedAreaName = (selectedProduct as any)?._areaName || areaNameMap.get((selectedProduct as any)?.insumo_area_id) || 'Uso';
  const getRawMaterialStockValue = (
    product: any,
    primaryKey: 'stock_vendedor' | 'stock_almacen',
    fallbackKey: '_stockVendedor' | '_stockAlmacen'
  ) => Number(product?.[primaryKey] ?? product?.[fallbackKey]) || 0;

  const selectedStock = selectedProduct
    ? (isRawMaterial
        ? getRawMaterialStockValue(selectedProduct as any, 'stock_vendedor', '_stockVendedor')
        : (stockMap.get(selectedProduct.id) || 0))
    : 0;
  const selectedWarehouseStock = selectedProduct
    ? (isRawMaterial
        ? getRawMaterialStockValue(selectedProduct as any, 'stock_almacen', '_stockAlmacen')
        : (warehouseStockMap.get(selectedProduct.id) || 0))
    : 0;

  const selectedDisplayStock = selectedProduct && ((selectedProduct as any)?.tipo === 'elaborado' || (selectedProduct as any)?.tipo === 'granel')
    ? (productionCapacity && !capacityLoading && Number.isFinite(productionCapacity.maxUnits)
        ? productionCapacity.maxUnits
        : selectedStock)
    : selectedStock;

  const selectedDisplayTotalStock = selectedDisplayStock + selectedWarehouseStock;
  const selectedUnitCost = Number(selectedProduct?.cost_price) || 0;
  const selectedSalePrice = Number(selectedProduct?.sale_price) || 0;
  const selectedStockValue = selectedDisplayTotalStock * (isRawMaterial ? selectedUnitCost : (selectedSalePrice || selectedUnitCost));

  const selectedMargin = selectedProduct && !isRawMaterial && selectedSalePrice > 0
    ? ((selectedSalePrice - selectedUnitCost) / selectedSalePrice * 100)
    : null;

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
          <div className="overflow-x-auto scrollbar-hide -mx-2 px-2">
            <TabsList className="inline-flex w-auto min-w-full sm:w-full">
              <TabsTrigger value="products" className="flex items-center gap-1.5 text-xs px-3 whitespace-nowrap">
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
              <TabsTrigger value="for-sale" className="text-xs px-3 whitespace-nowrap">
                A la Venta
              </TabsTrigger>
              <TabsTrigger value="warehouse" className="text-xs px-3 whitespace-nowrap">
                Almacén
              </TabsTrigger>
              <TabsTrigger value="insumos" className="text-xs px-3 whitespace-nowrap">
                Insumos
              </TabsTrigger>
              <TabsTrigger value="movements" className="flex items-center gap-1 text-xs px-3 whitespace-nowrap">
                <ArrowRightLeft className="h-3.5 w-3.5 shrink-0" />
                Movim.
              </TabsTrigger>
              <TabsTrigger value="mermas" className="flex items-center gap-1 text-xs px-3 whitespace-nowrap">
                <PackageX className="h-3.5 w-3.5 shrink-0" />
                Mermas
              </TabsTrigger>
            </TabsList>
          </div>

          {/* ─── Productos Tab (master view, all products) ─── */}
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
                  Cocina
                </button>
              </div>
            )}
            {/* Inline summary */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Package className="h-4 w-4" />
              <span><span className="font-semibold text-foreground">{filteredProducts.length}</span> productos registrados</span>
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
                        stock={getProductStock(product)}
                        warehouseStock={getProductWarehouseStock(product)}
                        color={product.category?.color || 'blue'}
                        badgeColorClass={getProductBadgeColor(product)}
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
                        stock={getProductStock(product)}
                        warehouseStock={getProductWarehouseStock(product)}
                        color="blue"
                        badgeColorClass={getProductBadgeColor(product)}
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

          {/* ─── A la Venta Tab (filtered: stock > 0 or sale types, grouped by category) ─── */}
          <TabsContent value="for-sale" className="mt-4 space-y-4">
            {(() => {
              const forSaleProducts = products.filter((p) => {
                const tipo = (p as any).tipo || 'reventa';
                if (tipo === 'ingrediente') return false;
                if (p.status === 'discontinued') return false;
                const saleStock = getDisplayForSaleStock(p as any);
                return saleStock > 0 || ['reventa', 'elaborado', 'granel'].includes(tipo);
              }).filter(p => { const s = search.toLowerCase(); return !search || p.name.toLowerCase().includes(s) || p.code.toLowerCase().includes(s) || (p.brand || '').toLowerCase().includes(s) || (p.description || '').toLowerCase().includes(s); });
              const totalUnits = forSaleProducts.reduce((sum, p) => sum + getDisplayForSaleStock(p as any), 0);

              // Group by category
              const catGroups = new Map<string, { category: Category | null; products: typeof forSaleProducts }>();
              const uncategorized: typeof forSaleProducts = [];
              forSaleProducts.forEach((p) => {
                if (p.category_id && p.category) {
                  const existing = catGroups.get(p.category_id);
                  if (existing) {
                    existing.products.push(p);
                  } else {
                    catGroups.set(p.category_id, { category: p.category, products: [p] });
                  }
                } else {
                  uncategorized.push(p);
                }
              });

              return (
                <>
                  {/* Header with category management */}
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">
                      <span className="font-semibold text-foreground">{totalUnits}</span> unidades en venta
                    </div>
                    {canManage && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (guardDowngrade()) return;
                          if (!canCreateCategory) {
                            toast({ title: `Límite alcanzado`, description: `El plan gratuito permite máximo ${FREE_CATEGORY_LIMIT} categorías.`, variant: 'destructive' });
                            return;
                          }
                          setEditingCategory(null);
                          setCategoryFormOpen(true);
                        }}
                      >
                        <Plus className="mr-1.5 h-3.5 w-3.5" />
                        Categoría
                      </Button>
                    )}
                  </div>

                  {/* Category chips for quick management */}
                  {categories.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {categories.map((cat) => (
                        <div key={cat.id} className="flex items-center gap-1 rounded-full border px-3 py-1 text-xs">
                          <div className={cn('h-2.5 w-2.5 rounded-full flex-shrink-0', colorDotMap[cat.color] || colorDotMap.blue)} />
                          <span className="font-medium">{cat.name}</span>
                          {canManage && (
                            <>
                              <button type="button" className="ml-1 text-muted-foreground hover:text-foreground" onClick={() => handleEditCategory(cat)}>
                                <Pencil className="h-3 w-3" />
                              </button>
                              <button type="button" className="text-muted-foreground hover:text-destructive" onClick={() => setDeletingCategory(cat)}>
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {productsLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                  ) : forSaleProducts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <Package className="h-12 w-12 text-muted-foreground mb-4" />
                      <h3 className="font-semibold">Sin productos a la venta</h3>
                      <p className="text-sm text-muted-foreground mt-1">No hay productos con stock disponible para venta</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {Array.from(catGroups.values()).map(({ category, products: catProducts }) => (
                        <div key={category?.id || 'none'}>
                          <div className="space-y-1">
                            {catProducts.map((product) => (
                              <ProductRow
                                key={product.id}
                                product={product}
                                stock={getDisplayForSaleStock(product as any)}
                                warehouseStock={warehouseStockMap.get(product.id) || 0}
                                color={product.category?.color || 'blue'}
                                onClick={() => handleProductTap(product)}
                                canManage={canManage}
                                onDelete={() => setDeletingProduct(product)}
                                onAddStock={() => { if (!guardDowngrade()) setStockEntryProduct(product); }}
                                onTransferToSale={() => { if (guardDowngrade()) return; setSelectedProduct(product); setShowTransfer(true); setTransferDirection('toSale'); setTransferQty(1); }}
                                onOutflow={() => { if (!guardDowngrade()) setOutflowProduct(product); }}
                                onReturnToWarehouse={() => { if (guardDowngrade()) return; setSelectedProduct(product); setShowTransfer(true); setTransferDirection('toWarehouse'); setTransferQty(1); }}
                                showBadges="sale"
                              />
                            ))}
                          </div>
                          <Separator className="mt-2" />
                        </div>
                      ))}
                      {uncategorized.length > 0 && (
                        <div>
                          <div className="space-y-1">
                            {uncategorized.map((product) => (
                              <ProductRow
                                key={product.id}
                                product={product}
                                stock={getDisplayForSaleStock(product as any)}
                                warehouseStock={warehouseStockMap.get(product.id) || 0}
                                color={product.category?.color || 'blue'}
                                onClick={() => handleProductTap(product)}
                                canManage={canManage}
                                onDelete={() => setDeletingProduct(product)}
                                onAddStock={() => { if (!guardDowngrade()) setStockEntryProduct(product); }}
                                onTransferToSale={() => { if (guardDowngrade()) return; setSelectedProduct(product); setShowTransfer(true); setTransferDirection('toSale'); setTransferQty(1); }}
                                onOutflow={() => { if (!guardDowngrade()) setOutflowProduct(product); }}
                                onReturnToWarehouse={() => { if (guardDowngrade()) return; setSelectedProduct(product); setShowTransfer(true); setTransferDirection('toWarehouse'); setTransferQty(1); }}
                                showBadges="sale"
                              />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </>
              );
            })()}
          </TabsContent>

          {/* ─── Almacén Tab ─── */}
          <TabsContent value="warehouse" className="mt-4 space-y-4">
            {(() => {
              // Combine products + raw materials, then filter for warehouse stock > 0
              const allItems = [...products, ...rawMaterialsAsProducts.filter(rm => !products.some(p => p.id === rm.id))];
              const warehouseProducts = allItems.filter((p) => {
                if (p.status === 'discontinued') return false;
                const wStock = getProductWarehouseStock(p);
                return wStock > 0;
              }).filter(p => { const s = search.toLowerCase(); return !search || p.name.toLowerCase().includes(s) || p.code.toLowerCase().includes(s) || (p.brand || '').toLowerCase().includes(s) || (p.description || '').toLowerCase().includes(s); });
              const totalUnits = warehouseProducts.reduce((sum, p) => sum + getProductWarehouseStock(p), 0);
              return (
                <>
                  <div className="text-sm text-muted-foreground">
                    <span className="font-semibold text-foreground">{totalUnits}</span> unidades en almacén
                  </div>
                  {productsLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                  ) : warehouseProducts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <Package className="h-12 w-12 text-muted-foreground mb-4" />
                      <h3 className="font-semibold">Almacén vacío</h3>
                      <p className="text-sm text-muted-foreground mt-1">No hay productos con stock en almacén</p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {warehouseProducts.map((product) => {
                        const wStock = getProductWarehouseStock(product);
                        const isLow = wStock <= product.min_stock;

                        return (
                          <div key={product.id} className="flex items-center gap-2 py-1.5 px-1 rounded-lg hover:bg-muted/50 transition-colors group">
                            <button
                              className="flex items-center gap-2 flex-1 text-left min-w-0"
                              onClick={() => handleProductTap(product)}
                            >
                              <div className="flex gap-1 flex-shrink-0">
                                <span className="inline-flex items-center justify-center h-8 min-w-[2.2rem] px-1.5 rounded-md text-xs font-semibold bg-muted text-muted-foreground" title="Almacén">
                                  {wStock}
                                </span>
                              </div>
                              <span className="font-medium text-sm truncate flex-1">{product.name}</span>
                              {isLow && <AlertTriangle className="h-3.5 w-3.5 text-warning flex-shrink-0" />}
                            </button>
                            {canManage && (
                              <div className="flex gap-0.5 flex-shrink-0">
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { if (!guardDowngrade()) setStockEntryProduct(product); }} title="Dar entrada">
                                  <PackagePlus className="h-3.5 w-3.5" />
                                </Button>
                                {wStock > 0 && (
                                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { if (guardDowngrade()) return; setSelectedProduct(product); setShowTransfer(true); setTransferDirection('toSale'); setTransferQty(1); }} title="Transferir stock">
                                    <ArrowRightLeft className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                                {wStock > 0 && (
                                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { if (!guardDowngrade()) setOutflowProduct(product); }} title="Salida almacén">
                                    <PackageX className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeletingProduct(product)} title="Eliminar">
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              );
            })()}
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

          {/* ─── Insumos Tab ─── */}
          <TabsContent value="insumos" className="mt-4">
            <InsumosInventoryTab
              products={products as (Product & { category: Category | null })[]}
              stockMap={stockMap}
              warehouseStockMap={warehouseStockMap}
              onSelectProduct={handleProductTap}
              onAddStock={(product) => { if (!guardDowngrade()) setStockEntryProduct(product); }}
              onOutflow={(product) => { if (!guardDowngrade()) setOutflowProduct(product); }}
              onTransfer={(product, direction) => {
                if (guardDowngrade()) return;
                setSelectedProduct(product as Product & { category: Category | null });
                setShowTransfer(true);
                setTransferDirection(direction);
                setTransferQty(1);
              }}
              onDeleteProduct={(product) => setDeletingProduct(product)}
              canManage={canManage}
              searchQuery={search}
            />
          </TabsContent>
        </Tabs>
      </div>

      {/* ─── Product Detail Sheet ─── */}
      <Sheet open={!!selectedProduct} onOpenChange={(open) => !open && setSelectedProduct(null)}>
        <SheetContent side="bottom" className="h-[85dvh] max-h-[85dvh] rounded-t-2xl">
          {selectedProduct && (
            <div className="space-y-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
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
                  {selectedProduct.unit_of_measure && !((selectedProduct as any).tipo === 'ingrediente' && selectedProduct.unit_of_measure === 'Pieza') && <span className="bg-muted px-2 py-1 rounded">{selectedProduct.unit_of_measure}</span>}
                  {selectedProduct.supplier && <span className="bg-muted px-2 py-1 rounded">Prov: {selectedProduct.supplier}</span>}
                </div>
              )}

              {/* Key metrics */}
              <div className="grid grid-cols-2 gap-3">
                <MetricCard
                  label={isIngredientSelected ? `En ${selectedAreaName.toLowerCase()}` : 'En venta'}
                  value={selectedDisplayStock.toString()}
                  sublabel={isIngredientSelected ? 'Disponible' : 'Disponible en POS'}
                  alert={selectedDisplayStock <= selectedProduct.min_stock}
                />
                <MetricCard
                  label="En almacén"
                  value={selectedWarehouseStock.toString()}
                  sublabel="En reserva"
                />
                <MetricCard
                  label={isRawMaterial ? 'Costo unitario' : 'Margen'}
                  value={isRawMaterial ? `$${selectedUnitCost.toFixed(2)}` : (selectedMargin !== null ? `${selectedMargin.toFixed(0)}%` : '—')}
                  sublabel={isRawMaterial ? 'Costo promedio actual' : `Costo $${selectedUnitCost.toFixed(2)}`}
                />
                <MetricCard
                  label="Valor en stock"
                  value={`$${selectedStockValue.toFixed(2)}`}
                  sublabel={`${selectedDisplayTotalStock} ${selectedProduct.unit_of_measure || 'uds.'} total`}
                />
              </div>

              {/* Stock distribution bar */}
              {selectedDisplayTotalStock > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground">Distribución de stock</p>
                  <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
                    <div 
                      className="bg-primary transition-all" 
                      style={{ width: `${(selectedDisplayStock / selectedDisplayTotalStock) * 100}%` }} 
                      title={`${isIngredientSelected ? selectedAreaName : 'Venta'}: ${selectedDisplayStock}`}
                    />
                    <div 
                      className="bg-muted-foreground/30 transition-all" 
                      style={{ width: `${(selectedWarehouseStock / selectedDisplayTotalStock) * 100}%` }} 
                      title={`Almacén: ${selectedWarehouseStock}`}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-primary inline-block" /> {isIngredientSelected ? selectedAreaName : 'Venta'} ({selectedDisplayStock})</span>
                    <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-muted-foreground/30 inline-block" /> Almacén ({selectedWarehouseStock})</span>
                  </div>
                </div>
              )}

              {/* Stock alert */}
              {selectedDisplayStock <= selectedProduct.min_stock && (
                <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm">
                  <AlertTriangle className="h-4 w-4 text-destructive flex-shrink-0" />
                  <span>
                    {selectedDisplayStock <= 0 
                      ? (isIngredientSelected ? `Sin stock disponible en ${selectedAreaName.toLowerCase()}` : 'Sin stock disponible para venta')
                      : `Stock bajo — mínimo recomendado: ${selectedProduct.min_stock}`
                    }
                    {selectedWarehouseStock > 0 && ' — Hay unidades en almacén'}
                  </span>
                </div>
              )}

              {/* Production capacity card for elaborado */}
              {((selectedProduct as any).tipo === 'elaborado' || (selectedProduct as any).tipo === 'granel') && (
                <div className="rounded-lg border bg-muted/50 p-4 space-y-3">
                  {capacityLoading ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Calculando capacidad...
                    </div>
                  ) : !productionCapacity || productionCapacity.maxUnits === 0 && productionCapacity.bottleneck === null ? (
                    <div className="space-y-1.5">
                      <p className="text-sm font-medium text-muted-foreground">
                        Configura una ficha de costo para ver {isGranelSelected ? 'la disponibilidad' : 'la producción posible'}
                      </p>
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="w-full"
                        onClick={() => {
                          setRecipeProduct(selectedProduct);
                          setSelectedProduct(null);
                        }}
                      >
                        <ChefHat className="mr-2 h-4 w-4" />
                        Gestionar ficha de costo
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-baseline gap-2">
                        <ChefHat className="h-5 w-5 text-primary" />
                        <div>
                          <p className="text-sm font-medium">{isGranelSelected ? 'Disponibilidad:' : 'Producción posible:'}</p>
                          <p className="text-2xl font-bold text-primary">
                            {productionCapacity.maxUnits === Infinity ? '∞' : productionCapacity.maxUnits} unidades
                          </p>
                        </div>
                      </div>
                      {productionCapacity.bottleneck && (
                        <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
                          <AlertTriangle className="h-3.5 w-3.5 text-amber-500 mt-0.5 flex-shrink-0" />
                          <p>
                            <span className="font-medium">Limitado por:</span> {productionCapacity.bottleneck.name}
                            {' '}({productionCapacity.bottleneck.available} {productionCapacity.bottleneck.unit} disponible)
                          </p>
                        </div>
                      )}
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="w-full"
                        onClick={() => {
                          setRecipeProduct(selectedProduct);
                          setSelectedProduct(null);
                        }}
                      >
                        <ChefHat className="mr-2 h-4 w-4" />
                        Gestionar ficha de costo
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {/* Transfer warehouse → sale */}
              {canManage && (
                <div className="space-y-2">
                {!showTransfer && !showGranelPriceEdit ? (
                    <div className="flex flex-col gap-2">
                      {/* Nueva Compra - only for reventa and ingrediente (not elaborado, not granel) */}
                      {(selectedProduct as any).tipo !== 'elaborado' && (selectedProduct as any).tipo !== 'granel' && (
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
                      {/* Granel: update sale price */}
                      {(selectedProduct as any).tipo === 'granel' && (
                        <Button 
                          variant="outline" 
                          className="w-full justify-start"
                          onClick={() => {
                            setGranelNewPrice(String(selectedProduct.sale_price || ''));
                            setShowGranelPriceEdit(true);
                          }}
                        >
                          <DollarSign className="mr-2 h-4 w-4" />
                          Actualizar precio de venta
                        </Button>
                      )}
                      {(selectedProduct as any).tipo !== 'elaborado' && (selectedProduct as any).tipo !== 'granel' && (selectedWarehouseStock > 0 || selectedStock > 0) && (
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
                          {(selectedProduct as any).tipo === 'ingrediente'
                            ? (selectedWarehouseStock > 0 ? 'Almacén → Uso' : 'Uso → Almacén')
                            : (selectedWarehouseStock > 0 ? 'Almacén → Venta' : 'Venta → Almacén')}
                        </Button>
                      )}
                      {(selectedProduct as any).tipo !== 'granel' && selectedWarehouseStock > 0 && (
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
                  ) : showGranelPriceEdit ? (
                    <div className="rounded-lg border p-3 space-y-3">
                      <p className="text-sm font-medium">Actualizar precio de venta</p>
                      <div className="space-y-1.5">
                        <Label className="flex items-center gap-1.5 text-xs">
                          <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
                          Nuevo precio
                        </Label>
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          value={granelNewPrice}
                          onChange={(e) => setGranelNewPrice(e.target.value)}
                          placeholder="Precio de venta"
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" className="flex-1" onClick={() => setShowGranelPriceEdit(false)}>
                          Cancelar
                        </Button>
                        <Button
                          size="sm"
                          className="flex-1"
                          disabled={!granelNewPrice || parseFloat(granelNewPrice) <= 0 || granelPriceUpdating}
                          onClick={async () => {
                            if (!selectedProduct) return;
                            setGranelPriceUpdating(true);
                            try {
                              await supabase
                                .from('products')
                                .update({ sale_price: parseFloat(granelNewPrice) })
                                .eq('id', selectedProduct.id);
                              queryClient.invalidateQueries({ queryKey: ['products'] });
                              toast({ title: 'Precio actualizado' });
                              setShowGranelPriceEdit(false);
                            } catch (err: any) {
                              toast({ title: 'Error', description: err.message, variant: 'destructive' });
                            } finally {
                              setGranelPriceUpdating(false);
                            }
                          }}
                        >
                          {granelPriceUpdating && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                          Guardar
                        </Button>
                      </div>
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
                                   {(selectedProduct as any)?.tipo === 'ingrediente'
                                     ? (isToSale ? 'Almacén → Uso' : 'Uso → Almacén')
                                     : (isToSale ? 'Almacén → Venta' : 'Venta → Almacén')}
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
        products={(() => {
          const existingIds = new Set(products.map(p => p.id));
          const allProds = products.map(p => ({
            id: p.id, name: p.name, code: p.code, cost_price: Number(p.cost_price),
            unit_of_measure: p.unit_of_measure || undefined,
            _isRawMaterial: false,
          }));
          rawMaterialsAsProducts.forEach(rm => {
            if (!existingIds.has(rm.id)) {
              allProds.push({
                id: rm.id, name: rm.name, code: (rm as any).code || '', cost_price: Number(rm.cost_price),
                unit_of_measure: rm.unit_of_measure || undefined,
                _isRawMaterial: true,
              });
            }
          });
          return allProds;
        })()}
        stockBreakdownMap={(() => {
          const map = new Map<string, { sale: number; warehouse: number; area: number }>();
          branchStock?.forEach((bs: any) => {
            map.set(bs.product_id, {
              sale: bs.quantity || 0,
              warehouse: bs.warehouse_quantity || 0,
              area: 0,
            });
          });
          rawMaterialsAsProducts.forEach((rm: any) => {
            if (!map.has(rm.id)) {
              map.set(rm.id, {
                sale: 0,
                warehouse: rm._stockAlmacen || 0,
                area: rm._stockVendedor || 0,
              });
            }
          });
          return map;
        })()}
        sellerOnly={!canManage}
      />
      {/* Production Dialog */}
      <ProductionDialog
        open={!!productionProduct}
        onOpenChange={(open) => { if (!open) setProductionProduct(null); }}
        product={productionProduct}
        branchId={selectedBranch || profile?.branch_id || branches?.[0]?.id || ''}
      />
      {/* Recipe Manager */}
      {recipeProduct && (
        <RecipeManager
          open={!!recipeProduct}
          onOpenChange={(open) => { if (!open) setRecipeProduct(null); }}
          product={recipeProduct}
        />
      )}
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
  showBadges?: 'both' | 'sale' | 'warehouse';
  badgeColorClass?: string;
}

const ProductRow = ({ product, stock, warehouseStock, color, onClick, canManage, onDelete, onAddStock, onTransferToSale, onReturnToWarehouse, onOutflow, showBadges = 'both', badgeColorClass }: ProductRowProps) => {
  const bgColor = colorMap[color] || colorMap.blue;
  const isLow = stock <= product.min_stock;

  return (
    <div className="flex items-center gap-1.5 sm:gap-2 py-1.5 px-1 rounded-lg hover:bg-muted/50 transition-colors group">
      <button
        className="flex items-center gap-1.5 sm:gap-2 flex-1 text-left min-w-0"
        onClick={onClick}
      >
        <div className="flex gap-1 flex-shrink-0">
          {(showBadges === 'both' || showBadges === 'sale') && (
            <span className={cn(
              'inline-flex items-center justify-center h-7 sm:h-8 min-w-[1.75rem] sm:min-w-[2.2rem] px-1 sm:px-1.5 rounded-md text-[11px] sm:text-xs font-semibold',
              badgeColorClass || bgColor
            )} title="En uso">
              {stock}
            </span>
          )}
          {(showBadges === 'both' || showBadges === 'warehouse') && (
            <span className="inline-flex items-center justify-center h-7 sm:h-8 min-w-[1.75rem] sm:min-w-[2.2rem] px-1 sm:px-1.5 rounded-md text-[11px] sm:text-xs font-semibold bg-muted text-muted-foreground" title="Almacén">
              {warehouseStock}
            </span>
          )}
        </div>
        <span className="font-medium text-[13px] sm:text-sm truncate flex-1">{product.name}</span>
        {isLow && <AlertTriangle className="h-3.5 w-3.5 text-warning flex-shrink-0" />}
      </button>
      {canManage && (
        <div className="flex gap-0 sm:gap-0.5 flex-shrink-0">
          <Button variant="ghost" size="icon" className="h-7 w-7 sm:h-7 sm:w-7" onClick={onAddStock} title="Dar entrada">
            <PackagePlus className="h-3.5 w-3.5" />
          </Button>
          {(warehouseStock > 0 || stock > 0) && (
            <Button variant="ghost" size="icon" className="h-7 w-7 sm:h-7 sm:w-7" onClick={warehouseStock > 0 ? onTransferToSale : onReturnToWarehouse} title="Transferir stock">
              <ArrowRightLeft className="h-3.5 w-3.5" />
            </Button>
          )}
          {warehouseStock > 0 && (
            <Button variant="ghost" size="icon" className="h-7 w-7 sm:h-7 sm:w-7 hidden sm:inline-flex" onClick={onOutflow} title="Salida almacén">
              <PackageX className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-7 w-7 sm:h-7 sm:w-7 text-destructive" onClick={onDelete} title="Eliminar">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
};


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
