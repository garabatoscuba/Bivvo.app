import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import AppLayout from '@/components/layout/AppLayout';
import { useJornadaActiva } from '@/hooks/useJornadaActiva';
import SinJornadaActiva from '@/components/employees/SinJornadaActiva';
import SinJornadaAutorizada from '@/components/employees/SinJornadaAutorizada';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { ProductCard } from '@/components/inventory/ProductCard';
import { POSCart } from '@/components/pos/POSCart';
import { PaymentDialog } from '@/components/pos/PaymentDialog';
import { useProducts, useCategories, useBranchStock } from '@/hooks/useProducts';
import { useBranches } from '@/hooks/useBranches';
import { useSales } from '@/hooks/useSales';
import { useAuth } from '@/contexts/AuthContext';
import { useResolvedBusinessId } from '@/hooks/useResolvedBusinessId';
import { useProductionCapacities } from '@/hooks/useProductionCapacities';
import { supabase } from '@/integrations/supabase/client';
import { Search, ShoppingCart, Loader2, Package, PackageX, AlertTriangle } from 'lucide-react';
import { MermaDialog } from '@/components/inventory/MermaDialog';
import { AgregoModal } from '@/components/pos/AgregoModal';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from '@/components/ui/sheet';
import type { CartItem, Product, Category, PaymentType, AgregoSelection } from '@/types/database';
import { cn } from '@/lib/utils';

const POS = () => {
  const { profile, isOwner, isManager, isSuperAdmin, user } = useAuth();
  const isPrivileged = isOwner || isManager || isSuperAdmin;
  const canBypassJornada = isOwner || isSuperAdmin;
  const { businessId: resolvedBusinessId, branchId: resolvedBranchId } = useResolvedBusinessId();

  const { jornadaActiva, jornada, isLoading: jornadaLoading } = useJornadaActiva();
  const { products, isLoading } = useProducts(resolvedBusinessId || undefined);
  const { categories } = useCategories(resolvedBusinessId || undefined);
  const { data: branches } = useBranches();
  const { createSale, isCreating } = useSales();
  

  const currentBranch = resolvedBranchId || jornada?.sucursal_id || profile?.branch_id || branches?.[0]?.id;
  const { data: branchStock } = useBranchStock(currentBranch);

  // Get elaborado + granel product IDs for production capacity calculation
  const elaboradoIds = products
    .filter(p => (p as any).tipo === 'elaborado' || (p as any).tipo === 'granel')
    .map(p => p.id);
  
  const granelIdSet = new Set(
    products.filter(p => (p as any).tipo === 'granel').map(p => p.id)
  );

  const { data: productionCapacities } = useProductionCapacities(elaboradoIds, currentBranch, { granelIds: granelIdSet });

  // Check if the user has an open cash register
  const { data: openCashRegister } = useQuery({
    queryKey: ['pos-open-register', user?.id, currentBranch],
    queryFn: async () => {
      const { data } = await supabase
        .from('cash_registers')
        .select('id')
        .eq('user_id', user!.id)
        .eq('status', 'open')
        .maybeSingle();
      return data;
    },
    enabled: !!user?.id && !isPrivileged,
  });

  const hasCajaOpen = isPrivileged || !!openCashRegister;

  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discount, setDiscount] = useState(0);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [mobileCartOpen, setMobileCartOpen] = useState(false);
  const [mermaOpen, setMermaOpen] = useState(false);
  const [tabletCartOpen, setTabletCartOpen] = useState(false);
  const [agregoModalOpen, setAgregoModalOpen] = useState(false);
  const [pendingAgregoProduct, setPendingAgregoProduct] = useState<(Product & { category: Category | null }) | null>(null);

  const stockMap = new Map<string, number>();
  branchStock?.forEach((bs: any) => {
    stockMap.set(bs.product_id, bs.quantity);
  });

  const hasIngredients = products.some((p) => (p as any).tipo === 'ingrediente');

  // Helper to get the real available stock (considering production capacity for elaborados)
  const getDisplayStock = useCallback((productId: string) => {
    const product = products.find(p => p.id === productId);
    if (product && (product as any).tipo === 'elaborado') {
      const capacity = productionCapacities?.[productId];
      if (typeof capacity === 'number' && Number.isFinite(capacity)) {
        return capacity;
      }
    }
    return stockMap.get(productId) || 0;
  }, [products, productionCapacities, stockMap]);

  const availableProducts = products.filter((p) => {
    if (p.status !== 'for_sale') return false;
    // Only filter out ingredients if the business uses them
    if (hasIngredients && (p as any).tipo === 'ingrediente') return false;
    const stock = getDisplayStock(p.id);
    return stock > 0;
  });

  const filteredProducts = availableProducts.filter((product) => {
    const matchesSearch = product.name.toLowerCase().includes(search.toLowerCase()) ||
      product.code.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = !selectedCategory || product.category_id === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const getCartQuantity = useCallback((productId: string) => {
    const item = cart.find((i) => i.product.id === productId);
    return item ? item.quantity : 0;
  }, [cart]);

  const getAvailableStock = useCallback((productId: string) => {
    const realStock = getDisplayStock(productId);
    const inCart = getCartQuantity(productId);
    return realStock - inCart;
  }, [getDisplayStock, getCartQuantity]);

  const addToCart = useCallback((product: Product & { category: Category | null }, agregoSelections?: AgregoSelection[]) => {
    const realStock = getDisplayStock(product.id);

    // Build selectedAgregos (flat list of ingredient IDs, repeated for multiples) for stock deduction
    const selectedAgregos = agregoSelections?.flatMap(a => Array(a.count).fill(a.ingredientId));
    const agregoTotal = agregoSelections?.reduce((sum, a) => sum + a.surcharge * a.count, 0) || 0;

    setCart((prev) => {
      // For elaborado products with agregos, always add as new line (different agrego combos)
      const isElaborado = (product as any).tipo === 'elaborado';
      const existing = isElaborado && agregoSelections?.length ? null : prev.find((item) => item.product.id === product.id);
      const currentQty = prev.filter(i => i.product.id === product.id).reduce((s, i) => s + i.quantity, 0);

      if (currentQty >= realStock) return prev;

      const basePrice = Number(product.sale_price);
      const unitPriceWithAgregos = basePrice + agregoTotal;

      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id && item === existing
            ? {
                ...item,
                quantity: item.quantity + 1,
                total: (item.quantity + 1) * item.unitPrice - item.discount,
              }
            : item
        );
      }
      return [
        ...prev,
        {
          product,
          quantity: 1,
          unitPrice: unitPriceWithAgregos,
          discount: 0,
          total: unitPriceWithAgregos,
          selectedAgregos,
          agregoSelections,
          agregoTotal,
        },
      ];
    });
  }, [getDisplayStock]);

  // Handle adding elaborado products - check for agregos first
  const handleAddProduct = useCallback((product: Product & { category: Category | null }) => {
    if ((product as any).tipo === 'elaborado') {
      setPendingAgregoProduct(product);
      setAgregoModalOpen(true);
    } else {
      addToCart(product);
    }
  }, [addToCart]);

  const handleAgregoConfirm = useCallback((agregoSelections: AgregoSelection[]) => {
    if (pendingAgregoProduct) {
      addToCart(pendingAgregoProduct, agregoSelections.length > 0 ? agregoSelections : undefined);
      setPendingAgregoProduct(null);
    }
  }, [pendingAgregoProduct, addToCart]);

  const updateQuantity = useCallback((productId: string, quantity: number) => {
    if (quantity <= 0) {
      setCart((prev) => prev.filter((item) => item.product.id !== productId));
    } else {
      const maxStock = getDisplayStock(productId);
      const clampedQty = Math.min(quantity, maxStock);
      setCart((prev) =>
        prev.map((item) =>
          item.product.id === productId
            ? { ...item, quantity: clampedQty, total: clampedQty * item.unitPrice - item.discount }
            : item
        )
      );
    }
  }, [getDisplayStock]);

  const removeItem = useCallback((productId: string) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
    setDiscount(0);
  }, []);

  const handlePayment = async (paymentType: PaymentType, amountPaid: number, mixedAmounts?: { cash: number; transfer: number }) => {
    if (!currentBranch) return;

    const subtotal = cart.reduce((sum, item) => sum + item.total, 0);
    const total = subtotal - discount;

    // Derive cash_amount and transfer_amount for ALL payment types
    let cashAmount = 0;
    let transferAmount = 0;
    if (mixedAmounts) {
      cashAmount = mixedAmounts.cash;
      transferAmount = mixedAmounts.transfer;
    } else if (paymentType === 'cash') {
      cashAmount = total;
      transferAmount = 0;
    } else if (paymentType === 'transfer') {
      cashAmount = 0;
      transferAmount = total;
    } else if (paymentType === 'card') {
      cashAmount = 0;
      transferAmount = total;
    }

    await createSale.mutateAsync({
      branchId: currentBranch,
      items: cart,
      paymentType,
      discount,
      amountPaid,
      cashAmount,
      transferAmount,
    });

    setPaymentOpen(false);
    clearCart();
  };

  const cartTotal = cart.reduce((sum, item) => sum + item.total, 0) - discount;
  const cartItemsCount = cart.reduce((sum, item) => sum + item.quantity, 0);


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
      {!hasCajaOpen && (
        <div className="mb-3 flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          <span>Debes abrir tu caja antes de realizar ventas. Ve a <strong>Caja</strong> para abrirla.</span>
        </div>
      )}
      <div className="flex flex-col lg:flex-row h-[calc(100vh-6.5rem)] md:h-[calc(100vh-8rem)] gap-0 lg:gap-4 overflow-hidden max-w-full">
        {/* Products Section */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          {/* Search & Categories */}
          <div className="space-y-2 md:space-y-3 pb-2 md:pb-4 flex-shrink-0">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar productos..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Button
                variant="outline"
                size="icon"
                className="shrink-0 text-destructive hover:text-destructive"
                onClick={() => setMermaOpen(true)}
                title="Registrar merma"
              >
                <PackageX className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
              <button
                onClick={() => setSelectedCategory(null)}
                className={cn(
                  "px-3 py-1.5 rounded-md text-sm font-medium flex-shrink-0 transition-colors border-b-2",
                  !selectedCategory
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-muted text-muted-foreground hover:bg-accent border-transparent"
                )}
              >
                Todos
              </button>
              {categories.map((cat) => {
                const isActive = selectedCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={cn(
                      "px-3 py-1.5 rounded-md text-sm font-medium flex-shrink-0 transition-colors",
                      isActive
                        ? "ring-2 ring-primary ring-offset-2 ring-offset-background"
                        : "hover:opacity-80"
                    )}
                    style={{
                      backgroundColor: `hsl(var(--category-${cat.color}))`,
                      color: `hsl(var(--category-${cat.color}-foreground))`,
                    }}
                  >
                    {cat.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Product Grid */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden pb-20 md:pb-20 lg:pb-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Package className="h-12 w-12 mb-2" />
                <p>No se encontraron productos</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3 gap-3 md:gap-4 px-0.5">
                {filteredProducts.map((product) => {
                  const availableStock = getAvailableStock(product.id);
                  return (
                    <ProductCard
                      key={product.id}
                      product={product}
                      stock={availableStock}
                      onClick={() => handleAddProduct(product)}
                      compact
                      disabled={availableStock <= 0}
                    />
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Desktop Cart (lg+) */}
        <Card className="hidden lg:flex w-80 lg:w-96 flex-col overflow-hidden flex-shrink-0">
          <POSCart
            items={cart}
            discount={discount}
            onUpdateQuantity={updateQuantity}
            onRemoveItem={removeItem}
            onClearCart={clearCart}
            onDiscountChange={setDiscount}
            stockMap={stockMap}
          />
          {cart.length > 0 && (
            <div className="p-4 border-t">
              <Button className="w-full h-11 font-bold" onClick={() => setPaymentOpen(true)} disabled={!hasCajaOpen}>
                <ShoppingCart className="h-5 w-5 mr-2" />
                Cobrar ${cartTotal.toFixed(2)}
              </Button>
            </div>
          )}
        </Card>

        {/* Tablet Cart - Bottom Panel (md to lg) */}
        {tabletCartOpen && (
          <div className="hidden md:block lg:hidden fixed bottom-0 left-0 right-0 z-50 border-t bg-card shadow-[0_-4px_20px_rgba(0,0,0,0.15)]" style={{ maxHeight: '45vh' }}>
            <div className="flex flex-col h-full max-h-[45vh] overflow-hidden">
              <POSCart
                items={cart}
                discount={discount}
                onUpdateQuantity={updateQuantity}
                onRemoveItem={removeItem}
                onClearCart={clearCart}
                onDiscountChange={setDiscount}
                stockMap={stockMap}
              />
              {cart.length > 0 && (
                <div className="flex-shrink-0 p-3 border-t bg-background">
                  <Button className="w-full h-11 font-bold" onClick={() => { setTabletCartOpen(false); setPaymentOpen(true); }} disabled={!hasCajaOpen}>
                    <ShoppingCart className="h-5 w-5 mr-2" />
                    Cobrar ${cartTotal.toFixed(2)}
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tablet Cart FAB (md to lg) */}
        <div className="hidden md:flex lg:hidden fixed bottom-4 left-1/2 -translate-x-1/2 z-[51]">
          <Button
            size="lg"
            className={cn(
              "rounded-full shadow-lg relative",
              cartItemsCount > 0 ? "h-14 px-5 gap-2" : "h-14 w-14"
            )}
            onClick={() => setTabletCartOpen(!tabletCartOpen)}
          >
            <ShoppingCart className="h-5 w-5" />
            {cartItemsCount > 0 && (
              <span className="text-sm font-bold">${cartTotal.toFixed(2)}</span>
            )}
            {cartItemsCount > 0 && (
              <Badge className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-[10px]">
                {cartItemsCount}
              </Badge>
            )}
          </Button>
        </div>

        {/* Mobile Cart FAB + Sheet (<md) */}
        <div className="md:hidden fixed bottom-4 left-1/2 -translate-x-1/2 z-50">
          <Sheet open={mobileCartOpen} onOpenChange={setMobileCartOpen}>
            <SheetTrigger asChild>
              <Button size="lg" className={cn(
                "rounded-full shadow-lg relative",
                cartItemsCount > 0 ? "h-14 px-5 gap-2" : "h-14 w-14"
              )}>
                <ShoppingCart className="h-5 w-5" />
                {cartItemsCount > 0 && (
                  <span className="text-sm font-bold">${cartTotal.toFixed(2)}</span>
                )}
                {cartItemsCount > 0 && (
                  <Badge className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-[10px]">
                    {cartItemsCount}
                  </Badge>
                )}
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="h-[85vh] p-0 overflow-hidden">
              <div className="flex flex-col h-full overflow-hidden">
                <POSCart
                  items={cart}
                  discount={discount}
                  onUpdateQuantity={updateQuantity}
                  onRemoveItem={removeItem}
                  onClearCart={clearCart}
                  onDiscountChange={setDiscount}
                  stockMap={stockMap}
                />
                {cart.length > 0 && (
                  <div className="flex-shrink-0 p-3 border-t bg-background">
                    <Button className="w-full h-12 text-base font-bold" onClick={() => { setMobileCartOpen(false); setPaymentOpen(true); }} disabled={!hasCajaOpen}>
                      <ShoppingCart className="h-5 w-5 mr-2" />
                      Cobrar ${cartTotal.toFixed(2)}
                    </Button>
                  </div>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      <PaymentDialog
        open={paymentOpen}
        onOpenChange={setPaymentOpen}
        items={cart}
        discount={discount}
        onConfirm={handlePayment}
        isProcessing={isCreating}
      />

      <MermaDialog
        open={mermaOpen}
        onOpenChange={setMermaOpen}
        branchId={currentBranch || ''}
        products={products.map(p => ({ id: p.id, name: p.name, code: p.code, cost_price: Number(p.cost_price) }))}
        stockMap={stockMap}
      />

      <AgregoModal
        open={agregoModalOpen}
        onOpenChange={(open) => {
          setAgregoModalOpen(open);
          if (!open) setPendingAgregoProduct(null);
        }}
        product={pendingAgregoProduct}
        onConfirm={handleAgregoConfirm}
      />
    </AppLayout>
  );
};

export default POS;
