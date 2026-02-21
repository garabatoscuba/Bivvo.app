import { useState } from 'react';
import { ShoppingBag } from 'lucide-react';
import type { StorefrontProduct } from '@/pages/PublicStorefront';

interface Props {
  products: StorefrontProduct[];
  accent: string;
}

const StorefrontCatalog = ({ products, accent }: Props) => {
  const categories = Array.from(new Set(products.map(p => p.category).filter(Boolean))) as string[];
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const filtered = activeCategory
    ? products.filter(p => p.category === activeCategory)
    : products;

  return (
    <div>
      {/* Category filters — minimal pill style */}
      {categories.length > 1 && (
        <div className="flex gap-2 mb-10 overflow-x-auto pb-1 scrollbar-hide">
          <button
            onClick={() => setActiveCategory(null)}
            className={`shrink-0 text-xs font-medium px-4 py-2 rounded-full border transition-colors ${
              !activeCategory
                ? 'border-foreground bg-foreground text-background'
                : 'border-border text-muted-foreground hover:text-foreground hover:border-foreground/30'
            }`}
          >
            Todos
          </button>
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`shrink-0 text-xs font-medium px-4 py-2 rounded-full border transition-colors ${
                activeCategory === cat
                  ? 'border-foreground bg-foreground text-background'
                  : 'border-border text-muted-foreground hover:text-foreground hover:border-foreground/30'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="text-center py-24 text-muted-foreground/40">
          <ShoppingBag className="h-10 w-10 mx-auto mb-3 opacity-50" />
          <p className="text-sm">No hay productos disponibles.</p>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(product => (
            <div
              key={product.id}
              className="group bg-card rounded-2xl border border-border overflow-hidden hover:shadow-md transition-all duration-300"
            >
              {product.image_url ? (
                <div className="aspect-[4/3] overflow-hidden bg-muted/10">
                  <img
                    src={product.image_url}
                    alt={product.name}
                    className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500"
                    loading="lazy"
                  />
                </div>
              ) : (
                <div className="aspect-[4/3] bg-muted/10 flex items-center justify-center">
                  <ShoppingBag className="h-8 w-8 text-muted-foreground/20" />
                </div>
              )}
              <div className="p-5 space-y-2">
                {product.category && (
                  <span className="text-[10px] uppercase tracking-[0.15em] font-medium text-muted-foreground">
                    {product.category}
                  </span>
                )}
                <h3 className="text-sm font-semibold text-foreground leading-snug">
                  {product.name}
                </h3>
                {product.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                    {product.description}
                  </p>
                )}
                <p className="text-base font-bold text-foreground pt-1">
                  Bs {Number(product.price).toFixed(2)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default StorefrontCatalog;
