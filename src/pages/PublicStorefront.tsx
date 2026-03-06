import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2, AlertCircle } from 'lucide-react';
import StorefrontNavbar from '@/components/storefront/StorefrontNavbar';
import StorefrontHome from '@/components/storefront/StorefrontHome';
import StorefrontCatalogView from '@/components/storefront/StorefrontCatalogView';
import StorefrontContact from '@/components/storefront/StorefrontContact';
import StorefrontFooter from '@/components/storefront/StorefrontFooter';
import { StorefrontCartProvider } from '@/contexts/StorefrontCartContext';

export interface StorefrontProduct {
  id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  code: string;
  category: string | null;
  category_color: string | null;
  stock: number;
}

export interface StorefrontReview {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  author: string;
}

export interface StorefrontAnnouncement {
  id: string;
  title: string;
  description: string | null;
  badge_text: string | null;
}

export interface StorefrontData {
  business: { name: string; logo_url: string | null };
  branch: { id: string; name: string; address: string | null; phone: string | null };
  settings: {
    has_delivery: boolean;
    accent_color: string;
    about_text: string | null;
    hero_image_url: string | null;
    hero_title: string | null;
    hero_subtitle: string | null;
    font_heading: string;
    font_body: string;
    social_instagram: string | null;
    social_facebook: string | null;
    social_tiktok: string | null;
    social_twitter: string | null;
    contact_email: string | null;
    currency: string;
    schedule: Record<string, { open: string | null; close: string | null; enabled: boolean }>;
  };
  products: StorefrontProduct[];
  reviews: StorefrontReview[];
  announcements: StorefrontAnnouncement[];
}

const DAY_MAP: Record<number, string> = {
  1: 'monday', 2: 'tuesday', 3: 'wednesday', 4: 'thursday',
  5: 'friday', 6: 'saturday', 0: 'sunday',
};

function isOpenNow(schedule: StorefrontData['settings']['schedule']): boolean {
  const now = new Date();
  const dayKey = DAY_MAP[now.getDay()];
  const day = schedule[dayKey];
  if (!day?.enabled || !day.open || !day.close) return false;
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  return currentTime >= day.open && currentTime <= day.close;
}

const API_BASE = import.meta.env.VITE_SUPABASE_URL;
const API_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export type StorefrontTab = 'home' | 'catalog' | 'contact';

const FONT_MAP: Record<string, string> = {
  'Lora': "'Lora', ui-serif, Georgia, serif",
  'Merriweather': "'Merriweather', ui-serif, Georgia, serif",
  'Libre Baskerville': "'Libre Baskerville', ui-serif, Georgia, serif",
  'Libre Caslon Text': "'Libre Caslon Text', ui-serif, Georgia, serif",
  'Work Sans': "'Work Sans', ui-sans-serif, system-ui, sans-serif",
  'DM Sans': "'DM Sans', ui-sans-serif, system-ui, sans-serif",
  'Inter': "'Inter', ui-sans-serif, system-ui, sans-serif",
  'Poppins': "'Poppins', ui-sans-serif, system-ui, sans-serif",
  'Open Sans': "'Open Sans', ui-sans-serif, system-ui, sans-serif",
  'Roboto': "'Roboto', ui-sans-serif, system-ui, sans-serif",
  'Space Mono': "'Space Mono', ui-monospace, monospace",
  'JetBrains Mono': "'JetBrains Mono', ui-monospace, monospace",
  'Inconsolata': "'Inconsolata', ui-monospace, monospace",
  'Roboto Mono': "'Roboto Mono', ui-monospace, monospace",
  'Source Code Pro': "'Source Code Pro', ui-monospace, monospace",
};

const PublicStorefront = () => {
  const { bizSlug, branchSlug } = useParams<{ bizSlug: string; branchSlug?: string }>();
  const [data, setData] = useState<StorefrontData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<StorefrontTab>('home');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const params = new URLSearchParams({ biz: bizSlug! });
        if (branchSlug) params.set('branch', branchSlug);
        const response = await fetch(
          `${API_BASE}/functions/v1/public-storefront?${params}`,
          { headers: { 'apikey': API_KEY } }
        );
        const json = await response.json();
        if (!response.ok) {
          if (response.status === 403) setError('Esta tienda aún no está disponible.');
          else if (response.status === 404) setError('Tienda no encontrada. Verifica el enlace.');
          else setError(json.error || 'Error al cargar la tienda');
        } else {
          setData(json);
        }
      } catch {
        setError('No se pudo conectar');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [bizSlug, branchSlug]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4 px-6 text-center">
        <AlertCircle className="h-10 w-10 text-muted-foreground/30" />
        <p className="text-muted-foreground text-sm max-w-xs">{error || 'Tienda no encontrada'}</p>
      </div>
    );
  }

  const open = isOpenNow(data.settings.schedule);
  const accent = data.settings.accent_color || '#18181b';
  const portalPath = branchSlug ? `/tienda/${bizSlug}/${branchSlug}` : `/s/${bizSlug}`;
  const currencySymbol = getCurrencySymbol(data.settings.currency);

  const fontHeading = FONT_MAP[data.settings.font_heading] || FONT_MAP['Lora'];
  const fontBody = FONT_MAP[data.settings.font_body] || FONT_MAP['Work Sans'];

  return (
    <StorefrontCartProvider>
      <div
        className="min-h-screen bg-background flex flex-col"
        style={{
          '--accent': accent,
          '--font-heading': fontHeading,
          '--font-body': fontBody,
        } as React.CSSProperties}
      >
        <StorefrontNavbar
          data={data}
          isOpen={open}
          accent={accent}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          portalPath={portalPath}
          hasDelivery={data.settings.has_delivery}
        />

        <main className="flex-1" style={{ fontFamily: fontBody, paddingTop: activeTab !== 'home' ? '56px' : undefined }}>
          {activeTab === 'home' && (
            <StorefrontHome
              data={data}
              accent={accent}
              portalPath={portalPath}
              onGoToCatalog={() => setActiveTab('catalog')}
            />
          )}
          {activeTab === 'catalog' && (
            <StorefrontCatalogView products={data.products} accent={accent} branchId={data.branch.id} />
          )}
          {activeTab === 'contact' && (
            <StorefrontContact data={data} accent={accent} />
          )}
        </main>

        <StorefrontFooter businessName={data.business.name} />
      </div>
    </StorefrontCartProvider>
  );
};

export default PublicStorefront;
