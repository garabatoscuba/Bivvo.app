import { useState, useEffect, useRef } from 'react';
import { Cloud, Camera, MessageCircle, WifiOff, Loader2, User, LogOut, ChevronDown } from 'lucide-react';
import { useOffline } from '@/contexts/OfflineContext';
import { useAuth } from '@/contexts/AuthContext';
import { SidebarTrigger } from '@/components/ui/sidebar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import ScannerModal from '@/components/layout/ScannerModal';
import { SyncStatusModal } from '@/components/layout/SyncStatusModal';
import ProfileModal from '@/components/hub/ProfileModal';

interface Props {
  businessName: string;
  pageTitle?: string;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase() || '')
    .join('');
}

const EasyTopbar = ({ businessName, pageTitle = 'Dashboard' }: Props) => {
  const { isOnline, isSyncing, pendingCount, failedOps, syncWarning, syncBlocked } = useOffline();
  const { profile, signOut } = useAuth();
  const [scannerOpen, setScannerOpen] = useState(false);
  const [syncOpen, setSyncOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [hidden, setHidden] = useState(false);
  const lastY = useRef(0);

  // Auto-hide on scroll down, show on scroll up (mobile only)
  useEffect(() => {
    const onScroll = () => {
      if (window.innerWidth >= 640) {
        setHidden(false);
        return;
      }
      const y = window.scrollY;
      const delta = y - lastY.current;
      if (y < 40) {
        setHidden(false);
      } else if (Math.abs(delta) > 8) {
        setHidden(delta > 0);
      }
      lastY.current = y;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const totalBadge = pendingCount + failedOps;
  const cloudColor = syncBlocked || !isOnline
    ? 'var(--te-red)'
    : syncWarning || totalBadge > 0
      ? 'var(--te-amber)'
      : 'var(--te-brand)';

  const initials = profile?.full_name ? getInitials(profile.full_name) : 'U';
  const firstName = profile?.full_name?.split(' ')[0] || 'Usuario';

  return (
    <>
      <div
        className={`sticky top-0 z-40 flex items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--bg-app)] py-3.5 px-4 sm:px-10 transition-transform duration-300 ${
          hidden ? '-translate-y-full' : 'translate-y-0'
        } sm:!translate-y-0`}
        style={{ maxWidth: 1480, margin: '0 auto', width: '100%' }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <SidebarTrigger className="-ml-1 text-[var(--te-text-tertiary)] hover:text-[var(--te-text-primary)]" />
          <span className="text-[14px] font-semibold text-[var(--te-text-primary)]">
            {pageTitle}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setSyncOpen(true)}
            title="Estado de sincronización"
            className="relative w-[34px] h-[34px] inline-flex items-center justify-center rounded-[var(--te-r-sm)] bg-transparent border-0 cursor-pointer transition-colors hover:bg-[var(--bg-surface)]"
            style={{ color: cloudColor }}
          >
            {isSyncing ? (
              <Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.8} />
            ) : !isOnline ? (
              <WifiOff className="w-4 h-4" strokeWidth={1.8} />
            ) : (
              <Cloud className="w-4 h-4" strokeWidth={1.8} />
            )}
            {totalBadge > 0 && !isSyncing && (
              <span
                className="absolute top-[7px] right-[7px] w-1.5 h-1.5 rounded-full bg-[var(--te-red)]"
                style={{ border: `1.5px solid var(--bg-app)` }}
              />
            )}
          </button>

          <button
            onClick={() => setScannerOpen(true)}
            title="Escanear"
            className="w-[34px] h-[34px] inline-flex items-center justify-center rounded-[var(--te-r-sm)] bg-transparent border-0 cursor-pointer transition-colors text-[var(--te-text-tertiary)] hover:bg-[var(--bg-surface)] hover:text-[var(--te-text-primary)]"
          >
            <Camera className="w-4 h-4" strokeWidth={1.8} />
          </button>

          <a
            href="https://wa.me/5352514878?text=Hola%2C%20necesito%20soporte%20con%20Bivoo"
            target="_blank"
            rel="noopener noreferrer"
            title="Soporte"
            className="inline-flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-[var(--te-r-sm)] text-[12.5px] font-medium text-[var(--te-brand)] hover:bg-[var(--te-brand-soft)] transition-colors no-underline"
          >
            <MessageCircle className="w-4 h-4" strokeWidth={1.8} />
            <span className="hidden sm:inline">Soporte</span>
          </a>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                title="Mi cuenta"
                className="ml-1 flex items-center gap-1.5 py-[3px] px-2 pl-[3px] rounded-full border border-transparent hover:border-[var(--border-subtle)] transition-all cursor-pointer"
              >
                <div className="w-[26px] h-[26px] rounded-full bg-[var(--te-brand-soft)] border border-[var(--te-brand-soft)] flex items-center justify-center text-[11px] font-medium text-[var(--te-brand)] flex-shrink-0">
                  {initials}
                </div>
                <ChevronDown className="hidden sm:inline w-[11px] h-[11px] text-[var(--te-text-tertiary)]" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[200px]">
              <div className="px-2.5 py-2 border-b border-border mb-1">
                <p className="text-[13px] font-medium truncate">{profile?.full_name || firstName}</p>
                <p className="text-[11px] text-muted-foreground truncate mt-0.5">{profile?.email}</p>
              </div>
              <DropdownMenuItem className="gap-2 text-[13px]" onClick={() => setProfileOpen(true)}>
                <User className="h-3.5 w-3.5" /> Perfil
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="gap-2 text-[13px] text-destructive focus:text-destructive" onClick={() => signOut()}>
                <LogOut className="h-3.5 w-3.5" /> Cerrar sesión
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <ScannerModal open={scannerOpen} onOpenChange={setScannerOpen} />
      <SyncStatusModal open={syncOpen} onOpenChange={setSyncOpen} />
      <ProfileModal open={profileOpen} onOpenChange={setProfileOpen} />
    </>
  );
};

export default EasyTopbar;
