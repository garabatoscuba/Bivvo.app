import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Minus, Plus, Trash2, X } from 'lucide-react';
import type { CartItem } from '@/types/database';
import { cn } from '@/lib/utils';

interface POSCartProps {
  items: CartItem[];
  onUpdateQuantity: (productId: string, quantity: number) => void;
  onRemoveItem: (productId: string) => void;
  onClearCart: () => void;
  discount: number;
  onDiscountChange: (discount: number) => void;
}

export const POSCart = ({
  items,
  onUpdateQuantity,
  onRemoveItem,
  onClearCart,
  discount,
  onDiscountChange,
}: POSCartProps) => {
  const subtotal = items.reduce((sum, item) => sum + item.total, 0);
  const total = subtotal - discount;

  if (items.length === 0) {
    return (
      <div className="flex flex-col h-full items-center justify-center text-center p-6">
        <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
          <X className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="font-semibold">Carrito vacío</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Selecciona productos para agregar
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <h3 className="font-semibold">Carrito ({items.length})</h3>
        <Button variant="ghost" size="sm" onClick={onClearCart}>
          <Trash2 className="h-4 w-4 mr-1" />
          Vaciar
        </Button>
      </div>

      {/* Items */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-3">
          {items.map((item) => (
            <Card key={item.product.id} className="overflow-hidden">
              <CardContent className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-sm truncate">
                      {item.product.name}
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      ${item.unitPrice.toFixed(2)} c/u
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-destructive"
                    onClick={() => onRemoveItem(item.product.id)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                <div className="flex items-center justify-between mt-2">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => onUpdateQuantity(item.product.id, item.quantity - 1)}
                      disabled={item.quantity <= 1}
                    >
                      <Minus className="h-3 w-3" />
                    </Button>
                    <span className="w-8 text-center font-medium">
                      {item.quantity}
                    </span>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => onUpdateQuantity(item.product.id, item.quantity + 1)}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                  <span className="font-bold text-primary">
                    ${item.total.toFixed(2)}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </ScrollArea>

      {/* Totals */}
      <div className="border-t p-4 space-y-3 bg-muted/30">
        <div className="flex justify-between text-sm">
          <span>Subtotal</span>
          <span>${subtotal.toFixed(2)}</span>
        </div>
        
        <div className="flex items-center justify-between text-sm">
          <span>Descuento</span>
          <div className="flex items-center gap-1">
            <span>$</span>
            <input
              type="number"
              min="0"
              max={subtotal}
              step="0.01"
              value={discount}
              onChange={(e) => onDiscountChange(Math.min(Number(e.target.value), subtotal))}
              className="w-20 h-7 rounded border bg-background px-2 text-right text-sm"
            />
          </div>
        </div>

        <Separator />
        
        <div className="flex justify-between text-lg font-bold">
          <span>Total</span>
          <span className="text-primary">${total.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
};
