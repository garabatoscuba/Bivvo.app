import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Minus, Plus, Trash2, X } from 'lucide-react';
import type { CartItem } from '@/types/database';

interface POSCartProps {
  items: CartItem[];
  onUpdateQuantity: (productId: string, quantity: number) => void;
  onRemoveItem: (productId: string) => void;
  onClearCart: () => void;
  discount: number;
  onDiscountChange: (discount: number) => void;
  stockMap: Map<string, number>;
}

export const POSCart = ({
  items,
  onUpdateQuantity,
  onRemoveItem,
  onClearCart,
  discount,
  onDiscountChange,
  stockMap,
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
    <div className="flex flex-col flex-1 overflow-hidden min-w-0">
      {/* Header */}
      <div className="flex items-center justify-between p-3 md:p-4 border-b flex-shrink-0">
        <h3 className="font-semibold">Carrito ({items.length})</h3>
        <Button variant="ghost" size="sm" onClick={onClearCart}>
          <Trash2 className="h-4 w-4 mr-1" />
          Vaciar
        </Button>
      </div>

      {/* Items - vertical scroll only */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0">
        <div className="p-3 space-y-2">
          {items.map((item, idx) => (
            <div key={`${item.product.id}-${idx}`} className="rounded-lg border bg-card p-2.5 min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                <div className="flex-1 min-w-0 overflow-hidden">
                  <h4 className="font-medium text-sm leading-tight break-words line-clamp-2">
                    {item.product.name}
                  </h4>
                  <span className="text-xs text-muted-foreground">
                    ${Number(item.product.sale_price).toFixed(2)} c/u
                    {item.agregoTotal && item.agregoTotal > 0 ? (
                      <span className="text-primary"> +${item.agregoTotal.toFixed(2)} agregos</span>
                    ) : null}
                  </span>
                  {item.agregoSelections && item.agregoSelections.length > 0 && (
                    <div className="text-[10px] text-muted-foreground mt-0.5">
                      {item.agregoSelections.map((a, i) => (
                        <span key={i}>
                          {i > 0 ? ', ' : ''}
                          {a.count > 1 ? `${a.count}× ` : ''}{a.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 flex-shrink-0 text-destructive"
                  onClick={() => onRemoveItem(item.product.id)}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>

              <div className="flex items-center justify-between mt-1.5">
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7 flex-shrink-0"
                    onClick={() => onUpdateQuantity(item.product.id, item.quantity - 1)}
                    disabled={item.quantity <= 1}
                  >
                    <Minus className="h-3 w-3" />
                  </Button>
                  <span className="w-7 text-center font-medium text-sm flex-shrink-0">
                    {item.quantity}
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7 flex-shrink-0"
                    onClick={() => onUpdateQuantity(item.product.id, item.quantity + 1)}
                    disabled={item.quantity >= (stockMap.get(item.product.id) || 0)}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
                <span className="font-bold text-primary text-sm flex-shrink-0">
                  ${item.total.toFixed(2)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Totals */}
      <div className="border-t p-3 md:p-4 space-y-2 md:space-y-3 bg-muted/30 flex-shrink-0">
        <div className="flex justify-between text-sm">
          <span>Subtotal</span>
          <span>${subtotal.toFixed(2)}</span>
        </div>
        
        <div className="flex items-center justify-between text-sm">
          <span>Descuento</span>
          <div className="flex items-center gap-1 flex-shrink-0">
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
