import { Store, MapPin, Phone, Truck } from 'lucide-react';
import type { StorefrontData } from '@/pages/PublicStorefront';

interface Props {
  data: StorefrontData;
  isOpen: boolean;
  accent: string;
}

const StorefrontHeader = ({ data, isOpen, accent }: Props) => (
  <header className="border-b border-neutral-100">
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
      <div className="flex items-center gap-4">
        {data.business.logo_url ? (
          <img
            src={data.business.logo_url}
            alt={data.business.name}
            className="h-14 w-14 sm:h-16 sm:w-16 rounded-2xl object-cover border border-neutral-100"
          />
        ) : (
          <div
            className="h-14 w-14 sm:h-16 sm:w-16 rounded-2xl flex items-center justify-center"
            style={{ backgroundColor: accent }}
          >
            <Store className="h-7 w-7 text-white" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h1 className="text-xl sm:text-2xl font-semibold text-neutral-900 tracking-tight">
            {data.business.name}
          </h1>
          <p className="text-sm text-neutral-400 mt-0.5">{data.branch.name}</p>
        </div>
        <span
          className="shrink-0 text-xs font-medium px-3 py-1 rounded-full"
          style={isOpen
            ? { backgroundColor: `${accent}15`, color: accent }
            : { backgroundColor: '#f5f5f5', color: '#a3a3a3' }
          }
        >
          {isOpen ? 'Abierto' : 'Cerrado'}
        </span>
      </div>

      <div className="flex flex-wrap gap-x-5 gap-y-1 mt-4 text-sm text-neutral-400">
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

export default StorefrontHeader;
