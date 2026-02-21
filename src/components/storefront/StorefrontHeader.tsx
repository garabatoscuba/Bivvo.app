import { Store, MapPin, Phone, Truck, Sun, Moon } from 'lucide-react';
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
    <header className="border-b border-border">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <div className="flex items-center gap-4">
          {data.business.logo_url ? (
            <img
              src={data.business.logo_url}
              alt={data.business.name}
              className="h-14 w-14 sm:h-16 sm:w-16 rounded-2xl object-cover border border-border"
            />
          ) : (
            <div
              className="h-14 w-14 sm:h-16 sm:w-16 rounded-2xl flex items-center justify-center"
              style={{ backgroundColor: accent }}
            >
              <Store className="h-7 w-7 text-primary-foreground" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h1 className="text-xl sm:text-2xl font-semibold text-foreground tracking-tight">
              {data.business.name}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">{data.branch.name}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setTheme(isDark ? 'light' : 'dark')}
              className="h-9 w-9 rounded-full flex items-center justify-center bg-card border border-border text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Cambiar tema"
            >
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <span
              className="text-xs font-medium px-3 py-1 rounded-full"
              style={isOpen
                ? { backgroundColor: `${accent}15`, color: accent }
                : {}
              }
            >
              {isOpen ? (
                <span style={{ color: accent }}>Abierto</span>
              ) : (
                <span className="text-muted-foreground bg-muted/50 px-3 py-1 rounded-full">Cerrado</span>
              )}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap gap-x-5 gap-y-1 mt-4 text-sm text-muted-foreground">
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
          {data.settings.has_delivery && (
            <span className="flex items-center gap-1.5 font-medium" style={{ color: accent }}>
              <Truck className="h-3.5 w-3.5" /> Delivery disponible
            </span>
          )}
        </div>
      </div>
    </header>
  );
};

export default StorefrontHeader;
