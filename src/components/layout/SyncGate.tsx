import { useOffline } from '@/contexts/OfflineContext';
import { Cloud, WifiOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const SyncGate = ({ children }: { children: React.ReactNode }) => {
  const { syncBlocked, isOnline, isSyncing, triggerSync } = useOffline();

  if (!syncBlocked) return <>{children}</>;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background p-6 text-center gap-6">
      <div className="rounded-full bg-destructive/10 p-6">
        <Cloud className="h-16 w-16 text-destructive" />
      </div>

      <div className="space-y-2 max-w-sm">
        <h1 className="text-xl font-bold text-foreground">Necesitas sincronizar</h1>
        <p className="text-sm text-muted-foreground">
          Han pasado más de 48 horas sin sincronizar. Para proteger tus datos, necesitas conectarte y sincronizar antes de continuar.
        </p>
      </div>

      {!isOnline ? (
        <div className="flex items-center gap-2 text-sm text-warning">
          <WifiOff className="h-4 w-4" />
          <span>Conéctate a internet para continuar</span>
        </div>
      ) : (
        <Button onClick={triggerSync} disabled={isSyncing} size="lg">
          {isSyncing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Sincronizando...
            </>
          ) : (
            'Sincronizar ahora'
          )}
        </Button>
      )}
    </div>
  );
};
