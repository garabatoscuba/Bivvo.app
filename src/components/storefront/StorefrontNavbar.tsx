import { useState, useEffect } from 'react';
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
  hasDelivery?: boolean;
}

const StorefrontNavbar = ({ data, isOpen, accent, activeTab, onTabChange, portalPath, hasDelivery }: Props) => {
  const { theme, setTheme } = useTheme();
  const isDark = theme === 'dark';
  const [showAnnouncements, setShowAnnouncements] = useState(false);
  const [showMembership, setShowMembership] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const tabs: { key: StorefrontTab; label: string }[] = [
    { key: 'home', label: 'Home' },
    { key: 'catalog', label: 'Catálogo' },
    { key: 'contact', label: 'Contacto' },
  ];

  const hasAnnouncements = data.announcements.length > 0;

  const isTransparent = activeTab === 'home' && !scrolled && !mobileMenuOpen;

  // When at top (not scrolled), navbar sits below delivery bar; once scrolled, navbar goes to top:0
  const navTop = (activeTab === 'home' && hasDelivery && !scrolled) ? '38px' : '0px';

  return (
    <>
      <nav
        className="fixed left-0 right-0 z-50 transition-all duration-300 ease-out"
        style={{
          top: navTop,
          ...(isTransparent
            ? { backgroundColor: 'transparent', borderBottom: 'none' }
            : { backgroundColor: 'rgba(0,0,0,0.92)', boxShadow: '0 1px 8px rgba(0,0,0,0.15)' }
          ),
        }}
      >
        <div className="flex items-center justify-between px-4 sm:px-10 py-3 sm:py-4">
          {/* Left — Logo + name (clickable → home) */}
          <button
            onClick={() => onTabChange('home')}
            className="flex items-center gap-2.5 shrink-0 hover:opacity-80 transition-opacity"
          >
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
            <span className="text-sm font-bold tracking-tight text-white hidden sm:inline">
              {data.business.name}
            </span>
          </button>

          {/* Center — Tabs (desktop) */}
          <div className="hidden sm:flex items-center gap-6 absolute left-1/2 -translate-x-1/2">
            {tabs.map(t => (
              <button
                key={t.key}
                onClick={() => onTabChange(t.key)}
                className={`text-sm transition-colors ${
                  activeTab === t.key
                    ? 'text-white font-medium'
                    : 'text-white/60 hover:text-white'
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
                className="relative h-8 w-8 rounded-full flex items-center justify-center text-white/70 hover:text-white transition-colors"
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
               className="h-8 w-8 rounded-full flex items-center justify-center text-white/70 hover:text-white transition-colors"
              aria-label="Membresía"
            >
              <User className="h-4 w-4" />
            </button>

            {/* Search */}
            <button
              onClick={() => { if (activeTab !== 'catalog') onTabChange('catalog'); }}
               className="h-8 w-8 rounded-full flex items-center justify-center text-white/70 hover:text-white transition-colors"
              aria-label="Buscar"
            >
              <Search className="h-4 w-4" />
            </button>

            {/* Divider */}
            <div className="hidden sm:block h-4 w-px bg-white/20 mx-1" />

            {/* Open / Closed */}
            <span
              className="hidden sm:inline text-[11px] font-medium px-2.5 py-1 rounded-full"
              style={isOpen ? { backgroundColor: 'rgba(255,255,255,0.15)', color: 'white' } : {}}
            >
              {isOpen ? 'Abierto' : <span className="text-white/50">Cerrado</span>}
            </span>

            {/* Theme toggle */}
            <button
              onClick={() => setTheme(isDark ? 'light' : 'dark')}
              className="hidden sm:flex h-8 w-8 rounded-full items-center justify-center text-white/70 hover:text-white transition-colors"
              aria-label="Cambiar tema"
            >
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>

            {/* Mobile menu toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="sm:hidden h-8 w-8 rounded-full flex items-center justify-center text-white/70 hover:text-white transition-colors"
              aria-label="Menú"
            >
              {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="sm:hidden px-4 py-3 space-y-1 bg-black/95">
            {tabs.map(t => (
              <button
                key={t.key}
                onClick={() => { onTabChange(t.key); setMobileMenuOpen(false); }}
                className={`block w-full text-left text-sm px-3 py-2 rounded-lg transition-colors ${
                  activeTab === t.key
                    ? 'text-white font-medium bg-white/10'
                    : 'text-white/60'
                }`}
              >
                {t.label}
              </button>
            ))}
            <div className="flex items-center justify-between px-3 pt-2">
               <span
                className="text-[11px] font-medium px-2.5 py-1 rounded-full"
                style={isOpen ? { backgroundColor: 'rgba(255,255,255,0.15)', color: 'white' } : {}}
              >
                {isOpen ? 'Abierto' : <span className="text-white/50">Cerrado</span>}
              </span>
              <button
                onClick={() => setTheme(isDark ? 'light' : 'dark')}
                className="h-8 w-8 rounded-full flex items-center justify-center text-white/70 hover:text-white transition-colors"
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
