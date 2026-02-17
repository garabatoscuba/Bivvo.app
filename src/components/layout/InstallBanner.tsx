import { useState } from 'react';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import { Download, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

const DISMISS_KEY = 'install-banner-dismissed';
const DISMISS_DAYS = 7;

function isDismissed(): boolean {
  const val = localStorage.getItem(DISMISS_KEY);
  if (!val) return false;
  const dismissed = parseInt(val, 10);
  return Date.now() - dismissed < DISMISS_DAYS * 24 * 60 * 60 * 1000;
}

const InstallBanner = () => {
  const { canInstall, isInstalled, isMobile, promptInstall } = usePWAInstall();
  const [dismissed, setDismissed] = useState(isDismissed);

  if (isInstalled || dismissed || !isMobile || !canInstall) return null;

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, Date.now().toString());
    setDismissed(true);
  };

  return (
    <div className="flex items-center justify-between gap-2 bg-primary px-4 py-2 text-primary-foreground">
      <div className="flex items-center gap-2 text-sm">
        <Download className="h-4 w-4 shrink-0" />
        <span>Instala la app para usar sin internet</span>
      </div>
      <div className="flex items-center gap-1">
        <Button
          size="sm"
          variant="secondary"
          className="h-7 text-xs"
          onClick={promptInstall}
        >
          Instalar
        </Button>
        <button
          onClick={handleDismiss}
          className="rounded p-1 hover:bg-primary-foreground/20"
          aria-label="Cerrar"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

export default InstallBanner;
