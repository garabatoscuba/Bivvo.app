import { Store, MapPin, Phone, Truck, Sun, Moon, Search } from 'lucide-react';
import { useTheme } from 'next-themes';
import type { StorefrontData } from '@/pages/PublicStorefront';

interface Props {
  data: StorefrontData;
  isOpen: boolean;
  accent: string;
}

const StorefrontHeader = ({ data, isOpen, accent }: Props) => {
  const { theme, setTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <header className="w-full">
      {/* Announcement bar */}
      {data.settings.has_delivery && (
        <div
          className="text-center text-xs tracking-widest uppercase py-2.5 font-medium"
          style={{ backgroundColor: accent, color: 'white' }}
        >
          <Truck className="inline h-3.5 w-3.5 mr-1.5 -mt-0.5" />
          Delivery disponible
        </div>
      )}

      {/* Minimal nav bar */}
      <nav className="flex items-center justify-between px-6 sm:px-10 py-5 border-b border-border bg-background/80 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          {data.business.logo_url ? (
            <img
              src={data.business.logo_url}
              alt={data.business.name}
              className="h-8 w-8 rounded-lg object-cover"
            />
          ) : (
            <div
              className="h-8 w-8 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: accent }}
            >
              <Store className="h-4 w-4 text-white" />
            </div>
          )}
          <span className="text-sm font-semibold tracking-tight text-foreground">
            {data.business.name}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <span
            className="text-[11px] font-medium px-3 py-1 rounded-full"
            style={isOpen
              ? { backgroundColor: `${accent}18`, color: accent }
              : {}
            }
          >
            {isOpen ? 'Abierto' : <span className="text-muted-foreground">Cerrado</span>}
          </span>
          <button
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
            className="h-8 w-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Cambiar tema"
          >
            {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        </div>
      </nav>

      {/* Hero section — large, editorial */}
      <section className="relative bg-card overflow-hidden">
        <div className="max-w-5xl mx-auto px-6 sm:px-10 py-20 sm:py-32 text-center">
          <h1
            className="text-4xl sm:text-6xl font-bold tracking-tight text-foreground leading-[1.1]"
            style={{ fontFamily: 'var(--font-serif)' }}
          >
            {data.business.name}
          </h1>
          <p className="mt-4 text-base sm:text-lg text-muted-foreground max-w-lg mx-auto leading-relaxed">
            {data.settings.about_text || data.branch.name}
          </p>

          {/* Branch info pills */}
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 mt-8 text-sm text-muted-foreground">
            {data.branch.address && (
              <span className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" /> {data.branch.address}
              </span>
            )}
            {data.branch.phone && (
              <span className="flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5" /> {data.branch.phone}
              </span>
            )}
          </div>
        </div>

        {/* Subtle decorative gradient */}
        <div
          className="absolute inset-0 opacity-[0.04] pointer-events-none"
          style={{
            background: `radial-gradient(ellipse at 50% 0%, ${accent}, transparent 70%)`,
          }}
        />
      </section>
    </header>
  );
};

export default StorefrontHeader;
