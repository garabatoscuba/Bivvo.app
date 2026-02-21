import { X, Megaphone } from 'lucide-react';
import type { StorefrontAnnouncement } from '@/pages/PublicStorefront';

interface Props {
  announcements: StorefrontAnnouncement[];
  accent: string;
  onClose: () => void;
}

const StorefrontAnnouncementPopup = ({ announcements, accent, onClose }: Props) => (
  <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
    <div className="relative bg-background border border-border rounded-2xl max-w-md w-full max-h-[80vh] overflow-y-auto shadow-xl">
      <div className="flex items-center justify-between p-5 border-b border-border">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Megaphone className="h-4 w-4" style={{ color: accent }} />
          Ofertas y anuncios
        </h3>
        <button
          onClick={onClose}
          className="h-8 w-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="p-5 space-y-3">
        {announcements.map(a => (
          <div key={a.id} className="rounded-xl p-4 bg-card border border-border">
            <div className="flex items-center gap-2 mb-1.5">
              {a.badge_text && (
                <span
                  className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full text-white"
                  style={{ backgroundColor: accent }}
                >
                  {a.badge_text}
                </span>
              )}
              <h4 className="text-sm font-semibold text-foreground">{a.title}</h4>
            </div>
            {a.description && (
              <p className="text-xs text-muted-foreground leading-relaxed">{a.description}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  </div>
);

export default StorefrontAnnouncementPopup;
