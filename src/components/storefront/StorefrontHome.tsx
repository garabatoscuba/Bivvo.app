import { Store, Truck, ArrowRight } from 'lucide-react';
import type { StorefrontData } from '@/pages/PublicStorefront';
import StorefrontReviewForm from '@/components/storefront/StorefrontReviewForm';

interface Props {
  data: StorefrontData;
  accent: string;
  portalPath: string;
  onGoToCatalog: () => void;
}

const StorefrontHome = ({ data, accent, portalPath, onGoToCatalog }: Props) => {
  return (
    <>
      {/* Delivery banner */}
      {data.settings.has_delivery && (
        <div
          className="text-center text-xs tracking-widest uppercase py-2.5 font-medium"
          style={{ backgroundColor: accent, color: 'white' }}
        >
          <Truck className="inline h-3.5 w-3.5 mr-1.5 -mt-0.5" />
          Delivery disponible
        </div>
      )}

      {/* Hero */}
      <section className="relative bg-card overflow-hidden">
        <div className="max-w-5xl mx-auto px-6 sm:px-10 py-20 sm:py-32 text-center">
          <h1
            className="text-4xl sm:text-6xl font-bold tracking-tight text-foreground leading-[1.1]"
            style={{ fontFamily: 'var(--font-serif)' }}
          >
            {data.business.name}
          </h1>
          <p className="mt-4 text-base sm:text-lg text-muted-foreground max-w-lg mx-auto leading-relaxed">
            {data.branch.name}
          </p>
          <button
            onClick={onGoToCatalog}
            className="mt-8 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Ver catálogo <ArrowRight className="h-4 w-4" />
          </button>
        </div>
        <div
          className="absolute inset-0 opacity-[0.04] pointer-events-none"
          style={{ background: `radial-gradient(ellipse at 50% 0%, ${accent}, transparent 70%)` }}
        />
      </section>

      {/* About — two text blocks, editorial style */}
      {data.settings.about_text && (
        <section className="border-t border-border">
          <div className="max-w-3xl mx-auto px-6 sm:px-10 py-20 sm:py-28 text-center">
            <p
              className="text-xl sm:text-3xl font-bold tracking-tight text-foreground leading-snug"
              style={{ fontFamily: 'var(--font-serif)' }}
            >
              {data.settings.about_text}
            </p>
            <button
              onClick={onGoToCatalog}
              className="mt-8 text-sm font-medium hover:opacity-70 transition-opacity"
              style={{ color: accent }}
            >
              Ver productos →
            </button>
          </div>
        </section>
      )}

      {/* Leave a review */}
      <section className="border-t border-border">
        <div className="max-w-md mx-auto px-6 sm:px-10 py-14 sm:py-20">
          <StorefrontReviewForm
            branchId={data.branch.id}
            accent={accent}
          />
        </div>
      </section>
    </>
  );
};

export default StorefrontHome;
