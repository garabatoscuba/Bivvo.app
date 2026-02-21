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
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-foreground">Productos</h2>
        <span className="text-xs text-muted-foreground">{filtered.length} items</span>
      </div>

      {/* Category filters */}
      {categories.length > 1 && (
        <div className="flex gap-2 mb-6 overflow-x-auto pb-1 scrollbar-none">
          <button
            onClick={() => setActiveCategory(null)}
            className="shrink-0 text-xs font-medium px-3.5 py-1.5 rounded-full transition-colors"
            style={!activeCategory
              ? { backgroundColor: accent, color: 'white' }
              : {}
            }
          >
            {!activeCategory ? 'Todos' : <span className="text-muted-foreground bg-muted/50 px-3.5 py-1.5 rounded-full">Todos</span>}
          </button>
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className="shrink-0 text-xs font-medium px-3.5 py-1.5 rounded-full transition-colors"
              style={activeCategory === cat
                ? { backgroundColor: accent, color: 'white' }
                : {}
              }
            >
              {activeCategory === cat ? cat : <span className="text-muted-foreground">{cat}</span>}
            </button>
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground/50">
          <ShoppingBag className="h-10 w-10 mx-auto mb-3 opacity-50" />
          <p className="text-sm">No hay productos disponibles.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {filtered.map(product => (
            <div
              key={product.id}
              className="group flex gap-4 p-3 rounded-xl border border-border hover:border-border/80 transition-all hover:shadow-sm bg-card"
            >
              {product.image_url ? (
                <img
                  src={product.image_url}
                  alt={product.name}
                  className="h-24 w-24 rounded-lg object-cover shrink-0"
                  loading="lazy"
                />
              ) : (
                <div className="h-24 w-24 rounded-lg bg-muted/20 flex items-center justify-center shrink-0">
                  <ShoppingBag className="h-6 w-6 text-muted-foreground/30" />
                </div>
              )}
              <div className="flex flex-col justify-between flex-1 min-w-0 py-0.5">
                <div>
                  {product.category && (
                    <span className="text-[10px] uppercase tracking-widest font-medium text-muted-foreground">
                      {product.category}
                    </span>
                  )}
                  <h3 className="text-sm font-medium text-foreground leading-snug truncate">
                    {product.name}
                  </h3>
                  {product.description && (
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">
                      {product.description}
                    </p>
                  )}
                </div>
                <p className="text-sm font-semibold text-foreground">
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
