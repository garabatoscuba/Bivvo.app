import { useOffline } from '@/contexts/OfflineContext';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { WifiOff, RefreshCw, Loader2, AlertTriangle } from 'lucide-react';

interface SyncGateProps {
  children: React.ReactNode;
}

export const SyncGate = ({ children }: SyncGateProps) => {
  const { syncRequired, isOnline, isSyncing, triggerSync } = useOffline();
  const { user, loading } = useAuth();

  // Don't gate if not authenticated or still loading
  if (!user || loading) {
    return <>{children}</>;
  }

  // Block app if sync is required AND we're online (user must sync)
  if (syncRequired && isOnline) {
    return (
      <div className="flex h-screen items-center justify-center bg-background p-4">
        <div className="max-w-sm text-center space-y-4">
          <div className="mx-auto h-16 w-16 rounded-full bg-warning/20 flex items-center justify-center">
            <AlertTriangle className="h-8 w-8 text-warning" />
          </div>
          <h2 className="text-lg font-semibold">Sincronización necesaria</h2>
          <p className="text-sm text-muted-foreground">
            Han pasado más de 24 horas desde la última sincronización. Necesitas sincronizar para continuar.
          </p>
          <Button onClick={triggerSync} disabled={isSyncing} className="w-full">
            {isSyncing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sincronizando...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Sincronizar ahora
              </>
            )}
          </Button>
        </div>
      </div>
    );
  }

  // Block if sync required and offline (can't sync)
  if (syncRequired && !isOnline) {
    return (
      <div className="flex h-screen items-center justify-center bg-background p-4">
        <div className="max-w-sm text-center space-y-4">
          <div className="mx-auto h-16 w-16 rounded-full bg-destructive/20 flex items-center justify-center">
            <WifiOff className="h-8 w-8 text-destructive" />
          </div>
          <h2 className="text-lg font-semibold">Sin conexión</h2>
          <p className="text-sm text-muted-foreground">
            Necesitas conectarte a internet para sincronizar. Han pasado más de 24 horas desde la última sincronización.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
