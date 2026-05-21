import { useState } from 'react';
import { Cloud, Camera, MessageCircle, WifiOff, Loader2 } from 'lucide-react';
import { useOffline } from '@/contexts/OfflineContext';
import { SidebarTrigger } from '@/components/ui/sidebar';
import ScannerModal from '@/components/layout/ScannerModal';
import { SyncStatusModal } from '@/components/layout/SyncStatusModal';

interface Props {
  businessName: string;
  pageTitle?: string;
}

const EasyTopbar = ({ businessName, pageTitle = 'Dashboard' }: Props) => {
  const { isOnline, isSyncing, pendingCount, failedOps, syncWarning, syncBlocked } = useOffline();
  const [scannerOpen, setScannerOpen] = useState(false);
  const [syncOpen, setSyncOpen] = useState(false);

  const totalBadge = pendingCount + failedOps;
  const cloudColor = syncBlocked || !isOnline
    ? 'var(--te-red)'
    : syncWarning || totalBadge > 0
      ? 'var(--te-amber)'
      : 'var(--te-brand)';

  return (
    <>
      <div
        className="sticky top-0 z-40 flex items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--bg-app)] py-3.5 px-4 sm:px-10"
        style={{ maxWidth: 1480, margin: '0 auto', width: '100%' }}
      >
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="flex items-baseline gap-2.5 min-w-0">
            <span className="text-[12px] text-[var(--te-text-quaternary)] tracking-[0.3px] truncate">
              {businessName}
              <span className="mx-1.5 text-[var(--te-text-quaternary)]">/</span>
            </span>
            <span className="text-[14px] font-semibold text-[var(--te-text-primary)]">
              {pageTitle}
            </span>
          </div>
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
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--te-r-sm)] text-[12.5px] font-medium text-[var(--te-brand)] hover:bg-[var(--te-brand-soft)] transition-colors no-underline"
          >
            <MessageCircle className="w-4 h-4" strokeWidth={1.8} />
            Soporte
          </a>
        </div>
      </div>

      <ScannerModal open={scannerOpen} onOpenChange={setScannerOpen} />
      <SyncStatusModal open={syncOpen} onOpenChange={setSyncOpen} />
    </>
  );
};

export default EasyTopbar;
