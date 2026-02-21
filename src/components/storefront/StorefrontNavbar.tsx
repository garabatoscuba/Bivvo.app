import { useState } from 'react';
import { Store, Search, Sun, Moon, Bell, User, X, Megaphone } from 'lucide-react';
import { useTheme } from 'next-themes';
import type { StorefrontData, StorefrontTab } from '@/pages/PublicStorefront';
import StorefrontSearch from '@/components/storefront/StorefrontSearch';
import StorefrontAnnouncementPopup from '@/components/storefront/StorefrontAnnouncementPopup';
import StorefrontMembershipPopup from '@/components/storefront/StorefrontMembershipPopup';

interface Props {
  data: StorefrontData;
  isOpen: boolean;
  accent: string;
  activeTab: StorefrontTab;
  onTabChange: (tab: StorefrontTab) => void;
  portalPath: string;
}

const StorefrontNavbar = ({ data, isOpen, accent, activeTab, onTabChange, portalPath }: Props) => {
  const { theme, setTheme } = useTheme();
  const isDark = theme === 'dark';
  const [showSearch, setShowSearch] = useState(false);
  const [search, setSearch] = useState('');
  const [showAnnouncements, setShowAnnouncements] = useState(false);
  const [showMembership, setShowMembership] = useState(false);

  const tabs: { key: StorefrontTab; label: string }[] = [
    { key: 'home', label: 'Home' },
    { key: 'catalog', label: 'Catálogo' },
    { key: 'contact', label: 'Contact' },
  ];

  const hasAnnouncements = data.announcements.length > 0;

  return (
    <>
      <nav className="sticky top-0 z-50 flex items-center justify-between px-6 sm:px-10 py-4 border-b border-border bg-background/80 backdrop-blur-sm">
        {/* Left — Logo + name */}
        <div className="flex items-center gap-3 shrink-0">
          {data.business.logo_url ? (
            <img
              src={data.business.logo_url}
              alt={data.business.name}
              className="h-7 w-7 rounded-lg object-cover"
            />
          ) : (
            <div
              className="h-7 w-7 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: accent }}
            >
              <Store className="h-3.5 w-3.5 text-white" />
            </div>
          )}
          <span className="text-sm font-bold tracking-tight text-foreground hidden sm:inline">
            {data.business.name}
          </span>
        </div>

        {/* Center — Tabs */}
        <div className="flex items-center gap-6">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => onTabChange(t.key)}
              className={`text-sm transition-colors ${
                activeTab === t.key
                  ? 'text-foreground font-medium'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Right — Icons */}
        <div className="flex items-center gap-1">
          {/* Announcements bell */}
          {hasAnnouncements && (
            <button
              onClick={() => setShowAnnouncements(true)}
              className="relative h-8 w-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Anuncios"
            >
              <Megaphone className="h-4 w-4" />
              <span
                className="absolute top-1 right-1 h-2 w-2 rounded-full"
                style={{ backgroundColor: accent }}
              />
            </button>
          )}

          {/* Membership */}
          <button
            onClick={() => setShowMembership(true)}
            className="h-8 w-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Membresía"
          >
            <User className="h-4 w-4" />
          </button>

          {/* Search */}
          <button
            onClick={() => { setShowSearch(!showSearch); if (activeTab !== 'catalog') onTabChange('catalog'); }}
            className="h-8 w-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Buscar"
          >
            <Search className="h-4 w-4" />
          </button>

          {/* Divider */}
          <div className="h-4 w-px bg-border mx-1" />

          {/* Open / Closed */}
          <span
            className="text-[11px] font-medium px-2.5 py-1 rounded-full"
            style={isOpen ? { backgroundColor: `${accent}18`, color: accent } : {}}
          >
            {isOpen ? 'Abierto' : <span className="text-muted-foreground">Cerrado</span>}
          </span>

          {/* Theme toggle */}
          <button
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
            className="h-8 w-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Cambiar tema"
          >
            {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        </div>
      </nav>

      {/* Announcement popup */}
      {showAnnouncements && (
        <StorefrontAnnouncementPopup
          announcements={data.announcements}
          accent={accent}
          onClose={() => setShowAnnouncements(false)}
        />
      )}

      {/* Membership popup */}
      {showMembership && (
        <StorefrontMembershipPopup
          branchId={data.branch.id}
          accent={accent}
          portalPath={portalPath}
          onClose={() => setShowMembership(false)}
        />
      )}
    </>
  );
};

export default StorefrontNavbar;
