import { useState } from 'react';
import type { StorefrontProduct, StorefrontReview } from '@/pages/PublicStorefront';
import StorefrontCatalog from '@/components/storefront/StorefrontCatalog';
import StorefrontSearch from '@/components/storefront/StorefrontSearch';
import StorefrontReviewForm from '@/components/storefront/StorefrontReviewForm';

interface Props {
  products: StorefrontProduct[];
  accent: string;
  branchId?: string;
  currencySymbol: string;
  reviews?: StorefrontReview[];
}

const StorefrontCatalogView = ({ products, accent, branchId, currencySymbol, reviews = [] }: Props) => {
  const [search, setSearch] = useState('');

  const filteredProducts = search.trim()
    ? products.filter(p =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        (p.description && p.description.toLowerCase().includes(search.toLowerCase())) ||
        (p.category && p.category.toLowerCase().includes(search.toLowerCase()))
      )
    : products;

  return (
    <section className="max-w-6xl mx-auto px-4 sm:px-10 py-10 sm:py-16">
      <div className="flex flex-col items-center gap-4 mb-10">
        <h1
          className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground text-center"
          style={{ fontFamily: 'var(--font-heading)' }}
        >
          Productos
        </h1>
        <div className="w-full max-w-sm">
          <StorefrontSearch value={search} onChange={setSearch} />
        </div>
      </div>
      <StorefrontCatalog
        products={filteredProducts}
        accent={accent}
        currencySymbol={currencySymbol}
        branchId={branchId}
        reviews={reviews}
      />

      {/* Review section */}
      {branchId && (
        <div className="mt-16 pt-10 border-t border-border flex flex-col items-center">
          <StorefrontReviewForm branchId={branchId} accent={accent} />
        </div>
      )}
    </section>
  );
};

export default StorefrontCatalogView;
