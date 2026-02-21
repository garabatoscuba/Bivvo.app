import { MapPin, Phone } from 'lucide-react';
import type { StorefrontData } from '@/pages/PublicStorefront';
import StorefrontSchedule from '@/components/storefront/StorefrontSchedule';
import StorefrontAbout from '@/components/storefront/StorefrontAbout';

interface Props {
  data: StorefrontData;
  accent: string;
}

const StorefrontContact = ({ data, accent }: Props) => (
  <section className="max-w-3xl mx-auto px-6 sm:px-10 py-14 sm:py-20">
    <h1
      className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground mb-12"
      style={{ fontFamily: 'var(--font-serif)' }}
    >
      Contact
    </h1>

    <div className="grid gap-12 md:grid-cols-2">
      {/* Schedule */}
      <div>
        <StorefrontSchedule schedule={data.settings.schedule} />
      </div>

      {/* Info & Socials */}
      <div className="space-y-8">
        {/* Address & Phone */}
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-[0.15em] mb-4">
            Información
          </h3>
          {data.branch.address && (
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <MapPin className="h-3.5 w-3.5 shrink-0" /> {data.branch.address}
            </p>
          )}
          {data.branch.phone && (
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <Phone className="h-3.5 w-3.5 shrink-0" /> {data.branch.phone}
            </p>
          )}
        </div>

        {/* Socials */}
        <StorefrontAbout
          aboutText={null}
          socialInstagram={data.settings.social_instagram}
          socialFacebook={data.settings.social_facebook}
          socialTiktok={data.settings.social_tiktok}
          socialTwitter={data.settings.social_twitter}
        />
      </div>
    </div>
  </section>
);

export default StorefrontContact;
