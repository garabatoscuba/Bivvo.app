import { Truck } from 'lucide-react';
import type { StorefrontData, StorefrontTab } from '@/pages/PublicStorefront';
import StorefrontReviewForm from '@/components/storefront/StorefrontReviewForm';
import StorefrontPromoBlocks from '@/components/storefront/StorefrontPromoBlocks';
import FadeInView from '@/components/storefront/FadeInView';

interface Props {
  data: StorefrontData;
  accent: string;
  portalPath: string;
  onGoToCatalog: () => void;
  onNavigate: (tab: StorefrontTab) => void;
  currencySymbol: string;
}

const StorefrontHome = ({ data, accent, portalPath, onNavigate, currencySymbol }: Props) => {
  const heroTitle = data.settings.hero_title || data.business.name;
  const heroSubtitle = data.settings.hero_subtitle || data.branch.name;
  const heroImage = data.settings.hero_image_url;

  const hasDelivery = data.settings.has_delivery;

  return (
    <>
      {/* Delivery banner — static, first element on the page */}
      {hasDelivery && (
        <div
          className="text-center text-[11px] tracking-widest uppercase py-2.5 font-medium"
          style={{ backgroundColor: accent, color: 'white' }}
        >
          <Truck className="inline h-3.5 w-3.5 mr-1.5 -mt-0.5" />
          Delivery disponible
        </div>
      )}

      {/* Hero — full remaining viewport, navbar overlays on top of this */}
      <section className="relative overflow-hidden">
        {heroImage ? (
          <div
            className="relative flex items-center justify-center"
            style={{ height: hasDelivery ? 'calc(100svh - 38px)' : '100svh' }}
          >
            <img
              src={heroImage}
              alt={heroTitle}
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-black/40" />
            <div className="relative z-10 max-w-5xl mx-auto px-6 sm:px-10 text-center pt-14">
              {data.business.logo_url && (
                <FadeInView>
                  <img
                    src={data.business.logo_url}
                    alt={heroTitle}
                    className="mx-auto mb-6 h-20 sm:h-28 w-auto rounded-2xl object-cover shadow-xl"
                  />
                </FadeInView>
              )}
              <FadeInView>
                <h1
                  className="text-4xl sm:text-6xl lg:text-7xl font-bold tracking-tight text-white leading-[1.1]"
                  style={{ fontFamily: 'var(--font-heading)' }}
                >
                  {heroTitle}
                </h1>
              </FadeInView>
              <FadeInView delay={150}>
                <p className="mt-4 text-base sm:text-lg text-white/80 max-w-lg mx-auto leading-relaxed">
                  {heroSubtitle}
                </p>
              </FadeInView>
            </div>
          </div>
        ) : (
          <div
            className="relative bg-card flex items-center justify-center"
            style={{ height: hasDelivery ? 'calc(100svh - 38px)' : '100svh' }}
          >
            <div className="max-w-5xl mx-auto px-6 sm:px-10 text-center pt-14">
              {data.business.logo_url && (
                <FadeInView>
                  <img
                    src={data.business.logo_url}
                    alt={heroTitle}
                    className="mx-auto mb-6 h-20 sm:h-28 w-auto rounded-2xl object-cover shadow-xl"
                  />
                </FadeInView>
              )}
              <FadeInView>
                <h1
                  className="text-4xl sm:text-6xl lg:text-7xl font-bold tracking-tight text-foreground leading-[1.1]"
                  style={{ fontFamily: 'var(--font-heading)' }}
                >
                  {heroTitle}
                </h1>
              </FadeInView>
              <FadeInView delay={150}>
                <p className="mt-4 text-base sm:text-lg text-muted-foreground max-w-lg mx-auto leading-relaxed">
                  {heroSubtitle}
                </p>
              </FadeInView>
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
          <FadeInView className="max-w-3xl mx-auto px-6 sm:px-10 py-20 sm:py-28 text-center">
            <p
              className="text-xl sm:text-3xl font-bold tracking-tight text-foreground leading-snug"
              style={{ fontFamily: 'var(--font-heading)' }}
            >
              {data.settings.about_text}
            </p>
          </FadeInView>
        </section>
      )}

      {/* Promo blocks */}
      {data.promo_blocks && data.promo_blocks.length > 0 && (
        <StorefrontPromoBlocks blocks={data.promo_blocks} accent={accent} onNavigate={onNavigate} />
      )}

      {/* Leave a review */}
      <section className="border-t border-border">
        <FadeInView className="max-w-md mx-auto px-6 sm:px-10 py-14 sm:py-20">
          <StorefrontReviewForm
            branchId={data.branch.id}
            accent={accent}
          />
        </FadeInView>
      </section>
    </>
  );
};

export default StorefrontHome;
