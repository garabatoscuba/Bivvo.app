import { Megaphone } from 'lucide-react';

interface Announcement {
  id: string;
  title: string;
  description: string | null;
  badge_text: string | null;
}

interface Props {
  announcements: Announcement[];
  accent: string;
}

const StorefrontAnnouncements = ({ announcements, accent }: Props) => {
  if (announcements.length === 0) return null;

  return (
    <div className="space-y-4">
      <h2
        className="text-xs font-semibold text-muted-foreground uppercase tracking-[0.15em] flex items-center gap-2"
      >
        <Megaphone className="h-3.5 w-3.5" style={{ color: accent }} />
        Ofertas y anuncios
      </h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {announcements.map(a => (
          <div
            key={a.id}
            className="rounded-xl p-5 bg-card border border-border"
          >
            <div className="flex items-center gap-2 mb-1.5">
              {a.badge_text && (
                <span
                  className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full text-white"
                  style={{ backgroundColor: accent }}
                >
                  {a.badge_text}
                </span>
              )}
              <h3 className="text-sm font-semibold text-foreground">{a.title}</h3>
            </div>
            {a.description && (
              <p className="text-xs text-muted-foreground leading-relaxed">{a.description}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default StorefrontAnnouncements;
