import { useState, useCallback } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ProductCard } from '@/components/inventory/ProductCard';
import { CategoryBadge } from '@/components/inventory/CategoryBadge';
import { POSCart } from '@/components/pos/POSCart';
import { PaymentDialog } from '@/components/pos/PaymentDialog';
import { useProducts, useCategories, useBranchStock } from '@/hooks/useProducts';
import { useBranches } from '@/hooks/useBranches';
import { useSales } from '@/hooks/useSales';
import { useAuth } from '@/contexts/AuthContext';
import { Search, ShoppingCart, Loader2 } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetTrigger } from
'@/components/ui/sheet';
import type { CartItem, Product, Category, PaymentType } from '@/types/database';
import { cn } from '@/lib/utils';

const POS = () => {
  const { profile } = useAuth();
  const { products, isLoading } = useProducts();
  const { categories } = useCategories();
  const { data: branches } = useBranches();
  const { createSale, isCreating } = useSales();

  const currentBranch = profile?.branch_id || branches?.[0]?.id;
  const { data: branchStock } = useBranchStock(currentBranch);

  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discount, setDiscount] = useState(0);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [mobileCartOpen, setMobileCartOpen] = useState(false);

  // Stock map
  const stockMap = new Map<string, number>();
  branchStock?.forEach((bs: any) => {
    stockMap.set(bs.product_id, bs.quantity);
  });

  // Filtrar productos disponibles para venta
  const availableProducts = products.filter((p) => p.status === 'for_sale');

  const filteredProducts = availableProducts.filter((product) => {
    const matchesSearch = product.name.toLowerCase().includes(search.toLowerCase()) ||
    product.code.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = !selectedCategory || product.category_id === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Cart functions
  const addToCart = useCallback((product: Product & {category: Category | null;}) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        return prev.map((item) =>
        item.product.id === product.id ?
        {
          ...item,
          quantity: item.quantity + 1,
          total: (item.quantity + 1) * item.unitPrice - item.discount
        } :
        item
        );
      }
      return [
      ...prev,
      {
        product,
        quantity: 1,
        unitPrice: Number(product.sale_price),
        discount: 0,
        total: Number(product.sale_price)
      }];

    });
  }, []);

  const updateQuantity = useCallback((productId: string, quantity: number) => {
    if (quantity <= 0) {
      setCart((prev) => prev.filter((item) => item.product.id !== productId));
    } else {
      setCart((prev) =>
      prev.map((item) =>
      item.product.id === productId ?
      { ...item, quantity, total: quantity * item.unitPrice - item.discount } :
      item
      )
      );
    }
  }, []);

  const removeItem = useCallback((productId: string) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
    setDiscount(0);
  }, []);

  const handlePayment = async (paymentType: PaymentType, amountPaid: number) => {
    if (!currentBranch) return;

    await createSale.mutateAsync({
      branchId: currentBranch,
      items: cart,
      paymentType,
      discount,
      amountPaid
    });

    setPaymentOpen(false);
    clearCart();
  };

  const cartTotal = cart.reduce((sum, item) => sum + item.total, 0) - discount;
  const cartItemsCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <AppLayout>
      <div className="flex h-[calc(100vh-6.5rem)] md:h-[calc(100vh-8rem)] gap-3 md:gap-4">
        {/* Products Section */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Search & Categories */}
          <div className="space-y-2 md:space-y-3 pb-3 md:pb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar productos..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10" />

            </div>

            <div className="gap-2 overflow-x-auto pb-2 flex items-end justify-start my-0 py-[10px]">
              <button
                onClick={() => setSelectedCategory(null)}
                className={cn("px-3 py-1.5 rounded-md text-sm font-medium flex-shrink-0 transition-colors border-b-2",

                !selectedCategory ?
                "bg-primary text-primary-foreground border-primary" :
                "bg-muted text-muted-foreground hover:bg-accent border-transparent"
                )}>

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
                      isActive ?
                      "ring-2 ring-primary ring-offset-2 ring-offset-background" :
                      "hover:opacity-80"
                    )}
                    style={{
                      backgroundColor: `hsl(var(--category-${cat.color}))`,
                      color: `hsl(var(--category-${cat.color}-foreground))`
                    }}>

                    {cat.name}
                  </button>);

              })}
            </div>
          </div>

          {/* Products Grid */}
          <div className="flex-1 overflow-auto border-4">
            {isLoading ?
            <div className="flex items-center justify-center h-full">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div> :
            filteredProducts.length === 0 ?
            <div className="flex flex-col items-center justify-center h-full text-center">
                <p className="text-muted-foreground">No se encontraron productos</p>
              </div> :

            <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {filteredProducts.map((product) =>
              <ProductCard
                key={product.id}
                product={product}
                stock={stockMap.get(product.id) || 0}
                onClick={() => addToCart(product)}
                compact />

              )}
              </div>
            }
          </div>
        </div>

        {/* Cart Section - Desktop */}
        <Card className="hidden lg:flex w-80 flex-col overflow-hidden">
          <POSCart
            items={cart}
            onUpdateQuantity={updateQuantity}
            onRemoveItem={removeItem}
            onClearCart={clearCart}
            discount={discount}
            onDiscountChange={setDiscount} />

          
          {cart.length > 0 &&
          <div className="p-4 border-t">
              <Button
              className="w-full h-12 text-lg"
              onClick={() => setPaymentOpen(true)}>

                Cobrar ${cartTotal.toFixed(2)}
              </Button>
            </div>
          }
        </Card>

        {/* Mobile Cart Button */}
        <div className="fixed bottom-4 left-4 right-4 lg:hidden">
          <Sheet open={mobileCartOpen} onOpenChange={setMobileCartOpen}>
            <SheetTrigger asChild>
              <Button className="w-full h-14 text-lg relative">
                <ShoppingCart className="mr-2 h-5 w-5" />
                Ver Carrito (${cartTotal.toFixed(2)})
                {cartItemsCount > 0 &&
                <Badge className="absolute -top-2 -right-2 h-6 w-6 p-0 flex items-center justify-center">
                    {cartItemsCount}
                  </Badge>
                }
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="h-[80vh] p-0">
              <div className="flex flex-col h-full">
                <POSCart
                  items={cart}
                  onUpdateQuantity={updateQuantity}
                  onRemoveItem={removeItem}
                  onClearCart={clearCart}
                  discount={discount}
                  onDiscountChange={setDiscount} />

                
                {cart.length > 0 &&
                <div className="p-4 border-t">
                    <Button
                    className="w-full h-12 text-lg"
                    onClick={() => {
                      setMobileCartOpen(false);
                      setPaymentOpen(true);
                    }}>

                      Cobrar ${cartTotal.toFixed(2)}
                    </Button>
                  </div>
                }
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {/* Payment Dialog */}
      <PaymentDialog
        open={paymentOpen}
        onOpenChange={setPaymentOpen}
        items={cart}
        discount={discount}
        onConfirm={handlePayment}
        isProcessing={isCreating} />

    </AppLayout>);

};

export default POS;