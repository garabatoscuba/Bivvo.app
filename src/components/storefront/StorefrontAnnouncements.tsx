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
    <div className="space-y-3">
      <h2 className="text-lg font-semibold text-neutral-900 flex items-center gap-2">
        <Megaphone className="h-4 w-4" style={{ color: accent }} />
        Ofertas y anuncios
      </h2>
      <div className="space-y-2">
        {announcements.map(a => (
          <div
            key={a.id}
            className="rounded-xl p-4 border-l-4"
            style={{ borderColor: accent, backgroundColor: `${accent}08` }}
          >
            <div className="flex items-center gap-2 mb-1">
              {a.badge_text && (
                <span
                  className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full text-white"
                  style={{ backgroundColor: accent }}
                >
                  {a.badge_text}
                </span>
              )}
              <h3 className="text-sm font-semibold text-neutral-900">{a.title}</h3>
            </div>
            {a.description && (
              <p className="text-xs text-neutral-500 leading-relaxed">{a.description}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default StorefrontAnnouncements;
