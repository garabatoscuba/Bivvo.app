import type { StorefrontTab } from '@/pages/PublicStorefront';

export interface PromoBlock {
  block_number: number;
  image_url: string | null;
  text_primary: string | null;
  text_secondary: string | null;
  link_target: string;
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

  const linkLabel = (target: string) =>
    target === 'contact' ? 'Ver contacto' : 'Ver el catálogo';

  const handleClick = (target: string) => {
    onNavigate(target === 'contact' ? 'contact' : 'catalog');
  };

  return (
    <section>
      {sorted.map(block => {
        const isDark = block.block_number === 1;
        const imageFirst = block.block_number === 1;

        const imageEl = block.image_url ? (
          <div className="flex-1 min-h-[280px] sm:min-h-[360px]">
            <img
              src={block.image_url}
              alt={block.text_primary || 'Promoción'}
              className="w-full h-full object-cover"
            />
          </div>
        ) : (
          <div className="flex-1 min-h-[280px] sm:min-h-[360px] flex items-center justify-center bg-muted">
            <span className="text-muted-foreground text-lg font-medium uppercase tracking-wider" style={{ fontFamily: 'var(--font-heading)' }}>
              Imagen
            </span>
          </div>
        );

        const textEl = (
          <div
            className="flex-1 min-h-[280px] sm:min-h-[360px] flex flex-col items-center justify-center px-8 py-12 text-center"
            style={{
              backgroundColor: isDark ? '#18181b' : '#f5f5f4',
              color: isDark ? '#fafafa' : '#18181b',
            }}
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
              <p className="mt-2 text-sm opacity-70">
                {block.text_secondary}
              </p>
            )}
            <button
              onClick={() => handleClick(block.link_target)}
              className="mt-4 text-xs tracking-widest uppercase underline underline-offset-4 hover:opacity-80 transition-opacity"
            >
              {linkLabel(block.link_target)}
            </button>
          </div>
        );

        return (
          <div
            key={block.block_number}
            className="flex flex-col md:flex-row"
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
          </div>
        );
      })}
    </section>
  );
};

export default StorefrontPromoBlocks;
