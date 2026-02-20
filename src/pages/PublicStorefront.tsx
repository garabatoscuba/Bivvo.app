import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  Clock, MapPin, Phone, Truck, Store, ShoppingBag, Loader2, AlertCircle,
} from 'lucide-react';

interface StorefrontData {
  business: { name: string; logo_url: string | null };
  branch: { name: string; address: string | null; phone: string | null };
  settings: {
    has_delivery: boolean;
    schedule: Record<string, { open: string | null; close: string | null; enabled: boolean }>;
  };
  products: {
    id: string; name: string; description: string | null;
    price: number; image_url: string | null; code: string;
    category: string | null; category_color: string | null; stock: number;
  }[];
}

const DAY_LABELS: Record<string, string> = {
  monday: 'Lunes', tuesday: 'Martes', wednesday: 'Miércoles',
  thursday: 'Jueves', friday: 'Viernes', saturday: 'Sábado', sunday: 'Domingo',
};

const DAY_MAP: Record<number, string> = {
  1: 'monday', 2: 'tuesday', 3: 'wednesday', 4: 'thursday',
  5: 'friday', 6: 'saturday', 0: 'sunday',
};

const DAYS_ORDER = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

function isOpenNow(schedule: StorefrontData['settings']['schedule']): boolean {
  const now = new Date();
  const dayKey = DAY_MAP[now.getDay()];
  const day = schedule[dayKey];
  if (!day?.enabled || !day.open || !day.close) return false;
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  return currentTime >= day.open && currentTime <= day.close;
}

const PublicStorefront = () => {
  const { bizSlug, branchSlug } = useParams<{ bizSlug: string; branchSlug: string }>();
  const [data, setData] = useState<StorefrontData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/public-storefront?biz=${bizSlug}&branch=${branchSlug}`,
          {
            headers: {
              'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            },
          }
        );

        const json = await response.json();
        if (!response.ok) {
          setError(json.error || 'Error al cargar la tienda');
        } else {
          setData(json);
        }
      } catch (e: any) {
        setError('No se pudo conectar');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [bizSlug, branchSlug]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <Loader2 className="h-8 w-8 animate-spin text-stone-400" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-stone-50 gap-3 px-4">
        <AlertCircle className="h-12 w-12 text-stone-300" />
        <p className="text-stone-500 text-lg font-medium">{error || 'Tienda no encontrada'}</p>
        <p className="text-stone-400 text-sm">Verifica el enlace e intenta de nuevo.</p>
      </div>
    );
  }

  const open = isOpenNow(data.settings.schedule);

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Hero header */}
      <header className="bg-white border-b border-stone-200">
        <div className="max-w-5xl mx-auto px-4 py-6 sm:py-8">
          <div className="flex items-center gap-4">
            {data.business.logo_url ? (
              <img
                src={data.business.logo_url}
                alt={data.business.name}
                className="h-14 w-14 rounded-xl object-cover border border-stone-200"
              />
            ) : (
              <div className="h-14 w-14 rounded-xl bg-stone-900 flex items-center justify-center">
                <Store className="h-7 w-7 text-white" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold text-stone-900 tracking-tight">
                {data.business.name}
              </h1>
              <p className="text-sm text-stone-500">{data.branch.name}</p>
            </div>
            <Badge
              variant={open ? 'default' : 'secondary'}
              className={`shrink-0 text-xs ${open ? 'bg-emerald-500 hover:bg-emerald-600 text-white' : 'bg-stone-200 text-stone-600'}`}
            >
              {open ? 'Abierto' : 'Cerrado'}
            </Badge>
          </div>

          {/* Info row */}
          <div className="flex flex-wrap gap-4 mt-4 text-sm text-stone-500">
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
              <span className="flex items-center gap-1.5 text-emerald-600 font-medium">
                <Truck className="h-3.5 w-3.5" /> Delivery disponible
              </span>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-6 sm:py-8">
        <div className="grid gap-8 lg:grid-cols-[1fr_280px]">
          {/* Products grid */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <ShoppingBag className="h-5 w-5 text-stone-700" />
              <h2 className="text-lg font-semibold text-stone-900">Catálogo</h2>
              <span className="text-sm text-stone-400">({data.products.length})</span>
            </div>

            {data.products.length === 0 ? (
              <div className="text-center py-16 text-stone-400">
                <ShoppingBag className="h-10 w-10 mx-auto mb-2 opacity-40" />
                <p>No hay productos disponibles.</p>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {data.products.map((product) => (
                  <Card key={product.id} className="overflow-hidden border-stone-200 hover:shadow-md transition-shadow">
                    <div className="flex">
                      {product.image_url ? (
                        <img
                          src={product.image_url}
                          alt={product.name}
                          className="h-28 w-28 object-cover shrink-0"
                          loading="lazy"
                        />
                      ) : (
                        <div className="h-28 w-28 bg-stone-100 flex items-center justify-center shrink-0">
                          <ShoppingBag className="h-8 w-8 text-stone-300" />
                        </div>
                      )}
                      <CardContent className="p-3 flex flex-col justify-between flex-1 min-w-0">
                        <div>
                          {product.category && (
                            <span className="text-[10px] uppercase tracking-wider font-semibold text-stone-400">
                              {product.category}
                            </span>
                          )}
                          <h3 className="text-sm font-semibold text-stone-900 leading-tight truncate">
                            {product.name}
                          </h3>
                          {product.description && (
                            <p className="text-xs text-stone-400 mt-0.5 line-clamp-2">
                              {product.description}
                            </p>
                          )}
                        </div>
                        <p className="text-base font-bold text-stone-900 mt-1">
                          Bs {Number(product.price).toFixed(2)}
                        </p>
                      </CardContent>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Schedule sidebar */}
          <aside>
            <div className="bg-white rounded-xl border border-stone-200 p-4 sticky top-6">
              <h3 className="text-sm font-semibold text-stone-900 flex items-center gap-2 mb-3">
                <Clock className="h-4 w-4" /> Horario
              </h3>
              <div className="space-y-1.5">
                {DAYS_ORDER.map(day => {
                  const d = data.settings.schedule[day];
                  const isToday = DAY_MAP[new Date().getDay()] === day;
                  return (
                    <div
                      key={day}
                      className={`flex justify-between text-sm py-1 px-2 rounded ${isToday ? 'bg-stone-100 font-medium' : ''}`}
                    >
                      <span className={d?.enabled ? 'text-stone-700' : 'text-stone-400'}>
                        {DAY_LABELS[day]}
                      </span>
                      <span className={d?.enabled ? 'text-stone-900' : 'text-stone-400 italic'}>
                        {d?.enabled ? `${d.open} – ${d.close}` : 'Cerrado'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </aside>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-stone-200 mt-8">
        <div className="max-w-5xl mx-auto px-4 py-4 text-center text-xs text-stone-400">
          Powered by GestorPro
        </div>
      </footer>
    </div>
  );
};

export default PublicStorefront;
