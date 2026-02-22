import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type { StorefrontProduct } from '@/pages/PublicStorefront';

export interface CartItem {
  product: StorefrontProduct;
  quantity: number;
}

interface CartContextType {
  items: CartItem[];
  addItem: (product: StorefrontProduct, qty?: number) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  totalItems: number;
  subtotal: number;
}

const CartContext = createContext<CartContextType | null>(null);

export const useStorefrontCart = () => {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useStorefrontCart must be used within StorefrontCartProvider');
  return ctx;
};

export const StorefrontCartProvider = ({ children }: { children: ReactNode }) => {
  const [items, setItems] = useState<CartItem[]>([]);

  const addItem = useCallback((product: StorefrontProduct, qty = 1) => {
    setItems(prev => {
      const existing = prev.find(i => i.product.id === product.id);
      if (existing) {
        const newQty = Math.min(existing.quantity + qty, product.stock);
        return prev.map(i => i.product.id === product.id ? { ...i, quantity: newQty } : i);
      }
      return [...prev, { product, quantity: Math.min(qty, product.stock) }];
    });
  }, []);

  const removeItem = useCallback((productId: string) => {
    setItems(prev => prev.filter(i => i.product.id !== productId));
  }, []);

  const updateQuantity = useCallback((productId: string, quantity: number) => {
    if (quantity <= 0) {
      setItems(prev => prev.filter(i => i.product.id !== productId));
      return;
    }
    setItems(prev => prev.map(i =>
      i.product.id === productId
        ? { ...i, quantity: Math.min(quantity, i.product.stock) }
        : i
    ));
  }, []);

  const clearCart = useCallback(() => setItems([]), []);

  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);
  const subtotal = items.reduce((sum, i) => sum + i.quantity * i.product.price, 0);

  return (
    <CartContext.Provider value={{ items, addItem, removeItem, updateQuantity, clearCart, totalItems, subtotal }}>
      {children}
    </CartContext.Provider>
  );
};
