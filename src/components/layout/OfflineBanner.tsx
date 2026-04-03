import { useOffline } from '@/contexts/OfflineContext';
import { WifiOff, AlertTriangle } from 'lucide-react';

export const OfflineBanner = () => {
  const { isOnline, syncWarning, syncBlocked } = useOffline();

  if (syncBlocked) {
    return (
      <div className="flex items-center justify-center gap-2 px-3 py-1.5 text-xs font-medium bg-destructive text-destructive-foreground">
        <AlertTriangle className="h-3.5 w-3.5" />
        <span>Acceso bloqueado. Sincroniza para continuar.</span>
      </div>
    );
  }

  if (syncWarning) {
    return (
      <div className="flex items-center justify-center gap-2 px-3 py-1.5 text-xs font-medium bg-warning text-warning-foreground">
        <AlertTriangle className="h-3.5 w-3.5" />
        <span>Llevas más de 36h sin sincronizar. Conéctate pronto para no perder acceso.</span>
      </div>
    );
  }

  if (!isOnline) {
    return (
      <div className="flex items-center justify-center gap-2 px-3 py-1.5 text-xs font-medium bg-yellow-500/90 text-yellow-950 transition-all duration-300">
        <WifiOff className="h-3.5 w-3.5" />
        <span>Modo sin conexión — los cambios se sincronizarán cuando vuelva el internet</span>
      </div>
    );
  }

  return null;
};
