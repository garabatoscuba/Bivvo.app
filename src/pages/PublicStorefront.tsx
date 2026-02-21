import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2, AlertCircle } from 'lucide-react';
import StorefrontHeader from '@/components/storefront/StorefrontHeader';
import StorefrontCatalog from '@/components/storefront/StorefrontCatalog';
import StorefrontSchedule from '@/components/storefront/StorefrontSchedule';
import StorefrontAbout from '@/components/storefront/StorefrontAbout';
import StorefrontFooter from '@/components/storefront/StorefrontFooter';
import StorefrontSearch from '@/components/storefront/StorefrontSearch';
import StorefrontAffiliateForm from '@/components/storefront/StorefrontAffiliateForm';
import StorefrontReviews from '@/components/storefront/StorefrontReviews';
import StorefrontAnnouncements from '@/components/storefront/StorefrontAnnouncements';

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
    social_instagram: string | null;
    social_facebook: string | null;
    social_tiktok: string | null;
    social_twitter: string | null;
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

const PublicStorefront = () => {
  const { bizSlug, branchSlug } = useParams<{ bizSlug: string; branchSlug: string }>();
  const [data, setData] = useState<StorefrontData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch(
          `${API_BASE}/functions/v1/public-storefront?biz=${bizSlug}&branch=${branchSlug}`,
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
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4 px-6 text-center">
        <AlertCircle className="h-10 w-10 text-muted-foreground/40" />
        <p className="text-muted-foreground text-base max-w-xs">{error || 'Tienda no encontrada'}</p>
      </div>
    );
  }

  const open = isOpenNow(data.settings.schedule);
  const accent = data.settings.accent_color || '#18181b';

  // Filter products by search
  const filteredProducts = search.trim()
    ? data.products.filter(p =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        (p.description && p.description.toLowerCase().includes(search.toLowerCase())) ||
        (p.category && p.category.toLowerCase().includes(search.toLowerCase()))
      )
    : data.products;

  return (
    <div className="min-h-screen bg-background flex flex-col" style={{ '--accent': accent } as React.CSSProperties}>
      <StorefrontHeader data={data} isOpen={open} accent={accent} />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {/* Search bar */}
        <div className="mb-8 max-w-md">
          <StorefrontSearch value={search} onChange={setSearch} />
        </div>

        {/* Announcements */}
        {data.announcements.length > 0 && (
          <div className="mb-10">
            <StorefrontAnnouncements announcements={data.announcements} accent={accent} />
          </div>
        )}

        <div className="grid gap-12 lg:grid-cols-[1fr_280px]">
          {/* Main content */}
          <div className="space-y-12">
            <StorefrontCatalog products={filteredProducts} accent={accent} />
            <StorefrontReviews
              reviews={data.reviews}
              branchId={data.branch.id}
              accent={accent}
              apiBase={API_BASE}
              apiKey={API_KEY}
            />
          </div>

          {/* Sidebar */}
          <aside className="space-y-6">
            <StorefrontAffiliateForm
              branchId={data.branch.id}
              accent={accent}
              portalPath={`/tienda/${bizSlug}/${branchSlug}`}
            />
            <StorefrontSchedule schedule={data.settings.schedule} />
            <StorefrontAbout
              aboutText={data.settings.about_text}
              socialInstagram={data.settings.social_instagram}
              socialFacebook={data.settings.social_facebook}
              socialTiktok={data.settings.social_tiktok}
              socialTwitter={data.settings.social_twitter}
            />
          </aside>
        </div>
      </main>

      <StorefrontFooter />
    </div>
  );
};

export default PublicStorefront;
