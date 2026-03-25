import type { StorefrontTab } from '@/pages/PublicStorefront';
import FadeInView from '@/components/storefront/FadeInView';

export interface PromoBlock {
  block_number: number;
  image_url: string | null;
  text_primary: string | null;
  text_secondary: string | null;
  link_target: string;
  link_custom_url: string | null;
}

interface Props {
  blocks: PromoBlock[];
  accent: string;
  onNavigate: (tab: StorefrontTab) => void;
}

const StorefrontPromoBlocks = ({ blocks, accent, onNavigate }: Props) => {
  const sorted = [...blocks]
    .filter(b => b.image_url || b.text_primary)
    .sort((a, b) => a.block_number - b.block_number);

  if (sorted.length === 0) return null;

  const linkLabel = (target: string, customUrl: string | null) =>
    target === 'custom' ? (customUrl ? new URL(customUrl).hostname : 'Ver enlace') : target === 'contact' ? 'Ver contacto' : 'Ver el catálogo';

  const handleClick = (target: string, customUrl: string | null) => {
    if (target === 'custom' && customUrl) {
      window.open(customUrl, '_blank', 'noopener,noreferrer');
    } else {
      onNavigate(target === 'contact' ? 'contact' : 'catalog');
    }
  };

  return (
    <section>
      {sorted.map(block => {
        const imageFirst = block.block_number === 1;

        const imageEl = block.image_url ? (
          <div className="w-full md:w-1/2 aspect-[4/3] md:aspect-auto">
            <img
              src={block.image_url}
              alt={block.text_primary || 'Promoción'}
              className="w-full h-full object-cover"
            />
          </div>
        ) : (
          <div className="w-full md:w-1/2 aspect-[4/3] md:aspect-auto flex items-center justify-center bg-muted">
            <span className="text-muted-foreground text-lg font-medium uppercase tracking-wider" style={{ fontFamily: 'var(--font-heading)' }}>
              Imagen
            </span>
          </div>
        );

        const textEl = (
          <div
            className="w-full md:w-1/2 flex flex-col items-center justify-center px-8 py-16 text-center bg-background text-foreground"
          >
            {block.text_primary && (
              <p
                className="text-xl sm:text-2xl font-semibold tracking-tight leading-snug"
                style={{ fontFamily: 'var(--font-heading)' }}
              >
                {block.text_primary}
              </p>
            )}
            {block.text_secondary && (
              <p className="mt-2 text-sm text-muted-foreground">
                {block.text_secondary}
              </p>
            )}
            <button
              onClick={() => handleClick(block.link_target, block.link_custom_url)}
              className="mt-4 text-xs tracking-widest uppercase underline underline-offset-4 text-foreground hover:opacity-80 transition-opacity"
            >
              {linkLabel(block.link_target, block.link_custom_url)}
            </button>
          </div>
        );

        return (
          <FadeInView
            key={block.block_number}
            className="flex flex-col md:flex-row md:min-h-[420px]"
          >
            {imageFirst ? (
              <>
                {imageEl}
                {textEl}
              </>
            ) : (
              <>
                {textEl}
                {imageEl}
              </>
            )}
          </FadeInView>
        );
      })}
    </section>
  );
};

export default StorefrontPromoBlocks;
