import { useState, useCallback, useEffect } from 'react';
import { ShoppingBag, Plus, LayoutGrid, List, Heart, Star, Share2 } from 'lucide-react';
import type { StorefrontProduct, StorefrontReview } from '@/pages/PublicStorefront';
import { useStorefrontCart } from '@/contexts/StorefrontCartContext';
import StorefrontProductDetail from '@/components/storefront/StorefrontProductDetail';
import { useToast } from '@/hooks/use-toast';

type ViewMode = 'grid' | 'list';
type SortMode = 'default' | 'price-asc' | 'price-desc' | 'name-asc' | 'name-desc';

interface Props {
  products: StorefrontProduct[];
  accent: string;
  currencySymbol: string;
}

const StorefrontCatalog = ({ products, accent, currencySymbol }: Props) => {
  const { addItem, items } = useStorefrontCart();
  const { toast } = useToast();
  const categories = Array.from(new Set(products.map(p => p.category).filter(Boolean))) as string[];
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [sortMode, setSortMode] = useState<SortMode>('default');
  const [selectedProduct, setSelectedProduct] = useState<StorefrontProduct | null>(null);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  // Deep-link: open product detail from ?producto= query param
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const productId = params.get('producto');
    if (productId && products.length > 0) {
      const found = products.find(p => p.id === productId);
      if (found) setSelectedProduct(found);
    }
  }, [products]);

  const handleCloseDetail = useCallback(() => {
    setSelectedProduct(null);
    const url = new URL(window.location.href);
    url.searchParams.delete('producto');
    window.history.replaceState({}, '', url.pathname + (url.search || '') + (url.hash || ''));
  }, []);

  const isMobile = typeof navigator !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  const handleShare = useCallback(async (e: React.MouseEvent, product: StorefrontProduct) => {
    e.stopPropagation();
    // Build the visible URL (what the user sees after redirect)
    const visibleUrl = new URL(window.location.href);
    visibleUrl.searchParams.set('producto', product.id);

    // Build the OG-preview URL so bots get proper meta tags
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const pathParts = window.location.pathname.split('/').filter(Boolean);
    const bizSlug = pathParts[1] || '';
    const branchSlug = pathParts.length >= 3 ? pathParts[2] : '';
    const ogParams = new URLSearchParams({ biz: bizSlug, producto: product.id, url: visibleUrl.toString() });
    if (branchSlug) ogParams.set('branch', branchSlug);
    const shareUrl = `${supabaseUrl}/functions/v1/og-preview?${ogParams}`;

    const priceStr = Number.isInteger(Number(product.price)) ? String(Number(product.price)) : Number(product.price).toFixed(2);
    const text = `Mira este producto: ${product.name} - ${currencySymbol}${priceStr} ${shareUrl}`;

    if (isMobile) {
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
      return;
    }

    if (navigator.share) {
      try {
        await navigator.share({ title: product.name, text: `${product.name} - ${currencySymbol}${priceStr}`, url: shareUrl });
      } catch { /* user cancelled */ }
    } else {
      await navigator.clipboard.writeText(shareUrl);
      toast({ title: 'Link copiado' });
    }
  }, [currencySymbol, isMobile, toast]);

  const toggleFavorite = (e: React.MouseEvent, productId: string) => {
    e.stopPropagation();
    setFavorites(prev => {
      const next = new Set(prev);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
    });
  };

  let filtered = activeCategory
    ? products.filter(p => p.category === activeCategory)
    : products;

  // Sort
  filtered = [...filtered].sort((a, b) => {
    switch (sortMode) {
      case 'price-asc': return a.price - b.price;
      case 'price-desc': return b.price - a.price;
      case 'name-asc': return a.name.localeCompare(b.name);
      case 'name-desc': return b.name.localeCompare(a.name);
      default: return 0;
    }
  });

  const getCartQty = (productId: string) => items.find(i => i.product.id === productId)?.quantity || 0;

  return (
    <div>
      {/* Toolbar: categories + sort + view toggle */}
      <div className="flex flex-col gap-4 mb-8">
        {/* Categories */}
        {categories.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
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

        {/* Sort + View toggle + count */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <select
              value={sortMode}
              onChange={e => setSortMode(e.target.value as SortMode)}
              className="h-9 px-3 rounded-lg bg-transparent text-xs text-foreground focus:outline-none cursor-pointer appearance-none"
            >
              <option value="default">Ordenar</option>
              <option value="price-asc">Precio: menor a mayor</option>
              <option value="price-desc">Precio: mayor a menor</option>
              <option value="name-asc">Nombre: A-Z</option>
              <option value="name-desc">Nombre: Z-A</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground hidden sm:inline">
              {filtered.length} {filtered.length === 1 ? 'producto' : 'productos'}
            </span>
            <div className="flex border border-border rounded-lg overflow-hidden">
              <button
                onClick={() => setViewMode('grid')}
                className={`h-8 w-8 flex items-center justify-center transition-colors ${
                  viewMode === 'grid' ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'
                }`}
                aria-label="Vista cuadrícula"
              >
                <LayoutGrid className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`h-8 w-8 flex items-center justify-center transition-colors ${
                  viewMode === 'list' ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'
                }`}
                aria-label="Vista lista"
              >
                <List className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Products */}
      {filtered.length === 0 ? (
        <div className="text-center py-24 text-muted-foreground/40">
          <ShoppingBag className="h-10 w-10 mx-auto mb-3 opacity-50" />
          <p className="text-sm">No hay productos disponibles.</p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
          {filtered.map(product => {
            const cartQty = getCartQty(product.id);
            const isFav = favorites.has(product.id);
            return (
              <div
                key={product.id}
                className="group bg-card rounded-xl border border-border overflow-hidden hover:shadow-sm transition-all duration-200 cursor-pointer"
                onClick={() => setSelectedProduct(product)}
              >
                <div className="relative">
                  {product.image_url ? (
                    <div className="aspect-square overflow-hidden bg-muted/10">
                      <img
                        src={product.image_url}
                        alt={product.name}
                        className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
                        loading="lazy"
                      />
                    </div>
                  ) : (
                    <div className="aspect-square bg-muted/10 flex items-center justify-center">
                      <ShoppingBag className="h-8 w-8 text-muted-foreground/15" />
                    </div>
                  )}
                  {/* Favorite + Share buttons */}
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleFavorite(e, product.id); }}
                    className="absolute top-2.5 right-2.5 h-8 w-8 rounded-full bg-background/70 backdrop-blur flex items-center justify-center transition-colors hover:bg-background"
                  >
                    <Heart className={`h-4 w-4 ${isFav ? 'fill-red-500 text-red-500' : 'text-muted-foreground'}`} />
                  </button>
                  <button
                    onClick={(e) => handleShare(e, product)}
                    className="absolute top-2.5 right-12 h-8 w-8 rounded-full bg-background/70 backdrop-blur flex items-center justify-center transition-colors hover:bg-background"
                    aria-label="Compartir"
                  >
                    <Share2 className="h-4 w-4 text-muted-foreground" />
                  </button>
                </div>
                <div className="p-3 space-y-2">
                  <h3 className="text-sm font-semibold text-foreground leading-snug line-clamp-2">
                    {product.name}
                  </h3>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map(i => (
                      <Star key={i} className="h-3.5 w-3.5 text-muted-foreground/20" />
                    ))}
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    <p className="text-sm font-bold text-foreground">
                      {currencySymbol} {Number(product.price).toFixed(2)}
                    </p>
                    {cartQty > 0 && (
                      <span
                        className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white"
                        style={{ backgroundColor: accent }}
                      >
                        {cartQty}
                      </span>
                    )}
                  </div>
                </div>
                {product.stock > cartQty && (
                  <button
                    onClick={(e) => { e.stopPropagation(); addItem(product); }}
                    className="w-full py-2 flex items-center justify-center gap-1 text-xs font-medium border-t border-border text-muted-foreground hover:text-white hover:bg-foreground transition-all"
                  >
                    <Plus className="h-3.5 w-3.5" /> Agregar
                  </button>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* List view */
        <div className="space-y-2">
          {filtered.map(product => {
            const cartQty = getCartQty(product.id);
            const isFav = favorites.has(product.id);
            return (
              <div
                key={product.id}
                className="flex gap-3 p-3 rounded-xl border border-border bg-card hover:shadow-sm transition-all cursor-pointer"
                onClick={() => setSelectedProduct(product)}
              >
                {product.image_url ? (
                  <img
                    src={product.image_url}
                    alt={product.name}
                    className="h-16 w-16 rounded-lg object-cover shrink-0"
                    loading="lazy"
                  />
                ) : (
                  <div className="h-16 w-16 rounded-lg bg-muted/10 flex items-center justify-center shrink-0">
                    <ShoppingBag className="h-5 w-5 text-muted-foreground/15" />
                  </div>
                )}
                <div className="flex-1 min-w-0 flex flex-col justify-center gap-1">
                  <h3 className="text-sm font-semibold text-foreground leading-snug line-clamp-1">
                    {product.name}
                  </h3>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map(i => (
                      <Star key={i} className="h-3 w-3 text-muted-foreground/20" />
                    ))}
                  </div>
                  <p className="text-sm font-bold text-foreground">
                    {currencySymbol} {Number(product.price).toFixed(2)}
                  </p>
                </div>
                <div className="flex flex-col items-center gap-1.5 shrink-0 justify-center">
                  <button onClick={(e) => { e.stopPropagation(); toggleFavorite(e, product.id); }} className="h-8 w-8 rounded-full flex items-center justify-center hover:bg-muted transition-colors">
                    <Heart className={`h-4 w-4 ${isFav ? 'fill-red-500 text-red-500' : 'text-muted-foreground/40'}`} />
                  </button>
                  <button onClick={(e) => handleShare(e, product)} className="h-8 w-8 rounded-full flex items-center justify-center hover:bg-muted transition-colors" aria-label="Compartir">
                    <Share2 className="h-4 w-4 text-muted-foreground/40" />
                  </button>
                  {cartQty > 0 && (
                    <span
                      className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white"
                      style={{ backgroundColor: accent }}
                    >
                      {cartQty}
                    </span>
                  )}
                  {product.stock > cartQty && (
                    <button
                      onClick={(e) => { e.stopPropagation(); addItem(product); }}
                      className="h-8 w-8 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:text-white hover:bg-foreground transition-all"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Product detail modal */}
      {selectedProduct && (
        <StorefrontProductDetail
          product={selectedProduct}
          accent={accent}
          currencySymbol={currencySymbol}
          onClose={handleCloseDetail}
        />
      )}
    </div>
  );
};

export default StorefrontCatalog;
