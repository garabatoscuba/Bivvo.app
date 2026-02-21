import { Truck } from 'lucide-react';
import type { StorefrontData } from '@/pages/PublicStorefront';
import StorefrontReviewForm from '@/components/storefront/StorefrontReviewForm';

interface Props {
  data: StorefrontData;
  accent: string;
  portalPath: string;
  onGoToCatalog: () => void;
}

const StorefrontHome = ({ data, accent, portalPath }: Props) => {
  const heroTitle = data.settings.hero_title || data.business.name;
  const heroSubtitle = data.settings.hero_subtitle || data.branch.name;
  const heroImage = data.settings.hero_image_url;

  const hasDelivery = data.settings.has_delivery;
  // Delivery bar height offset so hero starts below it
  const deliveryBarHeight = hasDelivery ? '36px' : '0px';

  return (
    <>
      {/* Delivery banner — fixed below navbar, outside hero */}
      {hasDelivery && (
        <div
          className="fixed top-[48px] sm:top-[56px] left-0 right-0 z-40 text-center text-xs tracking-widest uppercase py-2 font-medium"
          style={{ backgroundColor: accent, color: 'white' }}
        >
          <Truck className="inline h-3.5 w-3.5 mr-1.5 -mt-0.5" />
          Delivery disponible
        </div>
      )}

      {/* Hero — full viewport height minus delivery bar */}
      <section className="relative overflow-hidden" style={{ paddingTop: deliveryBarHeight }}>
        {heroImage ? (
          <div className="relative flex items-center justify-center" style={{ height: `calc(100svh - ${deliveryBarHeight})` }}>
            <img
              src={heroImage}
              alt={heroTitle}
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-black/40" />
            <div className="relative z-10 max-w-5xl mx-auto px-6 sm:px-10 text-center">
              <h1
                className="text-4xl sm:text-6xl lg:text-7xl font-bold tracking-tight text-white leading-[1.1]"
                style={{ fontFamily: 'var(--font-heading)' }}
              >
                {heroTitle}
              </h1>
              <p className="mt-4 text-base sm:text-lg text-white/80 max-w-lg mx-auto leading-relaxed">
                {heroSubtitle}
              </p>
            </div>
          </div>
        ) : (
          <div className="relative bg-card flex items-center justify-center" style={{ height: `calc(100svh - ${deliveryBarHeight})` }}>
            <div className="max-w-5xl mx-auto px-6 sm:px-10 text-center">
              <h1
                className="text-4xl sm:text-6xl lg:text-7xl font-bold tracking-tight text-foreground leading-[1.1]"
                style={{ fontFamily: 'var(--font-heading)' }}
              >
                {heroTitle}
              </h1>
              <p className="mt-4 text-base sm:text-lg text-muted-foreground max-w-lg mx-auto leading-relaxed">
                {heroSubtitle}
              </p>
            </div>
            <div
              className="absolute inset-0 opacity-[0.04] pointer-events-none"
              style={{ background: `radial-gradient(ellipse at 50% 0%, ${accent}, transparent 70%)` }}
            />
          </div>
        )}
      </section>

      {/* About — editorial text block */}
      {data.settings.about_text && (
        <section className="border-t border-border">
          <div className="max-w-3xl mx-auto px-6 sm:px-10 py-20 sm:py-28 text-center">
            <p
              className="text-xl sm:text-3xl font-bold tracking-tight text-foreground leading-snug"
              style={{ fontFamily: 'var(--font-heading)' }}
            >
              {data.settings.about_text}
            </p>
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
