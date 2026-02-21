import { useState } from 'react';
import type { StorefrontProduct } from '@/pages/PublicStorefront';
import StorefrontCatalog from '@/components/storefront/StorefrontCatalog';
import StorefrontSearch from '@/components/storefront/StorefrontSearch';

interface Props {
  products: StorefrontProduct[];
  accent: string;
}

const StorefrontCatalogView = ({ products, accent }: Props) => {
  const [search, setSearch] = useState('');

  const filteredProducts = search.trim()
    ? products.filter(p =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        (p.description && p.description.toLowerCase().includes(search.toLowerCase())) ||
        (p.category && p.category.toLowerCase().includes(search.toLowerCase()))
      )
    : products;

  return (
    <section className="max-w-6xl mx-auto px-6 sm:px-10 py-10 sm:py-16">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-10">
        <h1
          className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground"
          style={{ fontFamily: 'var(--font-serif)' }}
        >
          Products
        </h1>
        <div className="w-full sm:w-72">
          <StorefrontSearch value={search} onChange={setSearch} />
        </div>
      </div>
      <StorefrontCatalog products={filteredProducts} accent={accent} />
    </section>
  );
};

export default StorefrontCatalogView;
