import { useState } from 'react';
import { Store, Search, Sun, Moon, Megaphone, User, Menu, X } from 'lucide-react';
import { useTheme } from 'next-themes';
import type { StorefrontData, StorefrontTab } from '@/pages/PublicStorefront';
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
  const [showAnnouncements, setShowAnnouncements] = useState(false);
  const [showMembership, setShowMembership] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const tabs: { key: StorefrontTab; label: string }[] = [
    { key: 'home', label: 'Home' },
    { key: 'catalog', label: 'Catálogo' },
    { key: 'contact', label: 'Contacto' },
  ];

  const hasAnnouncements = data.announcements.length > 0;

  return (
    <>
      <nav className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-sm">
        <div className="flex items-center justify-between px-4 sm:px-10 py-3 sm:py-4">
          {/* Left — Logo + name */}
          <div className="flex items-center gap-2.5 shrink-0">
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

          {/* Center — Tabs (desktop) */}
          <div className="hidden sm:flex items-center gap-6 absolute left-1/2 -translate-x-1/2">
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
          <div className="flex items-center gap-0.5 sm:gap-1">
            {/* Announcements */}
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
              onClick={() => { if (activeTab !== 'catalog') onTabChange('catalog'); }}
              className="h-8 w-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Buscar"
            >
              <Search className="h-4 w-4" />
            </button>

            {/* Divider */}
            <div className="hidden sm:block h-4 w-px bg-border mx-1" />

            {/* Open / Closed */}
            <span
              className="hidden sm:inline text-[11px] font-medium px-2.5 py-1 rounded-full"
              style={isOpen ? { backgroundColor: `${accent}18`, color: accent } : {}}
            >
              {isOpen ? 'Abierto' : <span className="text-muted-foreground">Cerrado</span>}
            </span>

            {/* Theme toggle */}
            <button
              onClick={() => setTheme(isDark ? 'light' : 'dark')}
              className="hidden sm:flex h-8 w-8 rounded-full items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Cambiar tema"
            >
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>

            {/* Mobile menu toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="sm:hidden h-8 w-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Menú"
            >
              {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="sm:hidden border-t border-border px-4 py-3 space-y-1 bg-background">
            {tabs.map(t => (
              <button
                key={t.key}
                onClick={() => { onTabChange(t.key); setMobileMenuOpen(false); }}
                className={`block w-full text-left text-sm px-3 py-2 rounded-lg transition-colors ${
                  activeTab === t.key
                    ? 'text-foreground font-medium bg-muted/30'
                    : 'text-muted-foreground'
                }`}
              >
                {t.label}
              </button>
            ))}
            <div className="flex items-center justify-between px-3 pt-2">
              <span
                className="text-[11px] font-medium px-2.5 py-1 rounded-full"
                style={isOpen ? { backgroundColor: `${accent}18`, color: accent } : {}}
              >
                {isOpen ? 'Abierto' : <span className="text-muted-foreground">Cerrado</span>}
              </span>
              <button
                onClick={() => setTheme(isDark ? 'light' : 'dark')}
                className="h-8 w-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
              >
                {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>
            </div>
          </div>
        )}
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
