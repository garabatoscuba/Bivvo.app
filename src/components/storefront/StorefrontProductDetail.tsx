import { X, ShoppingBag, Plus, Minus } from 'lucide-react';
import { useState } from 'react';
import type { StorefrontProduct } from '@/pages/PublicStorefront';
import { useStorefrontCart } from '@/contexts/StorefrontCartContext';

interface Props {
  product: StorefrontProduct;
  accent: string;
  currencySymbol: string;
  onClose: () => void;
}

const StorefrontProductDetail = ({ product, accent, currencySymbol, onClose }: Props) => {
  const { items, addItem } = useStorefrontCart();
  const [qty, setQty] = useState(1);

  const inCart = items.find(i => i.product.id === product.id);
  const availableStock = product.stock - (inCart?.quantity || 0);

  return (
    <div className="fixed inset-0 z-[90]">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute inset-4 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-full sm:max-w-lg bg-background rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 h-8 w-8 rounded-full bg-background/80 backdrop-blur flex items-center justify-center hover:bg-muted transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Image */}
        {product.image_url ? (
          <div className="aspect-square sm:aspect-[4/3] overflow-hidden bg-muted/10">
            <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
          </div>
        ) : (
          <div className="aspect-square sm:aspect-[4/3] bg-muted/10 flex items-center justify-center">
            <ShoppingBag className="h-12 w-12 text-muted-foreground/15" />
          </div>
        )}

        {/* Info */}
        <div className="p-6 space-y-4 overflow-y-auto">
          {product.category && (
            <span className="text-[10px] uppercase tracking-[0.15em] font-medium text-muted-foreground">
              {product.category}
            </span>
          )}
          <h2 className="text-xl font-bold text-foreground" style={{ fontFamily: 'var(--font-heading)' }}>
            {product.name}
          </h2>
          {product.description && (
            <p className="text-sm text-muted-foreground leading-relaxed">{product.description}</p>
          )}
          <p className="text-2xl font-bold text-foreground">{currencySymbol} {Number(product.price).toFixed(2)}</p>

          {product.stock > 0 && (
            <p className="text-xs text-muted-foreground">
              {product.stock <= 5 ? `¡Solo ${product.stock} disponibles!` : 'En stock'}
            </p>
          )}

          {/* Add to cart */}
          {availableStock > 0 ? (
            <div className="flex items-center gap-3 pt-2">
              <div className="flex items-center gap-2 border border-border rounded-lg px-1">
                <button
                  onClick={() => setQty(q => Math.max(1, q - 1))}
                  className="h-9 w-9 flex items-center justify-center hover:bg-muted rounded-md transition-colors"
                  disabled={qty <= 1}
                >
                  <Minus className="h-3.5 w-3.5" />
                </button>
                <span className="w-8 text-center text-sm font-medium">{qty}</span>
                <button
                  onClick={() => setQty(q => Math.min(availableStock, q + 1))}
                  className="h-9 w-9 flex items-center justify-center hover:bg-muted rounded-md transition-colors"
                  disabled={qty >= availableStock}
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
              <button
                onClick={() => { addItem(product, qty); onClose(); }}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90"
                style={{ backgroundColor: accent }}
              >
                Agregar · Bs {(qty * product.price).toFixed(2)}
              </button>
            </div>
          ) : (
            <div className="pt-2">
              <span className="text-sm text-muted-foreground">Ya tienes el máximo disponible en tu carrito</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StorefrontProductDetail;
