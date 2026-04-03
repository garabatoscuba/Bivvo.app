import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { useOffline } from '@/contexts/OfflineContext';
import { getStoreCounts, getFailedOperations, retryAllFailedOperations, removePendingOperation, type PendingOperation } from '@/lib/offlineDb';
import { SYNC_MANDATORY_INTERVAL_MS, SYNC_WARNING_INTERVAL_MS } from '@/lib/syncEngine';
import { Cloud, WifiOff, Wifi, Loader2, RefreshCw, Download, AlertTriangle, Trash2, Database, Clock } from 'lucide-react';

interface SyncStatusModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function timeAgo(ts: number | null): string {
  if (!ts) return 'Nunca';
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Ahora mismo';
  if (mins < 60) return `hace ${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `hace ${hours}h ${mins % 60}m`;
  const days = Math.floor(hours / 24);
  return `hace ${days}d`;
}

export const SyncStatusModal = ({ open, onOpenChange }: SyncStatusModalProps) => {
  const {
    isOnline, isSyncing, pendingCount, failedOps,
    lastSyncTime, syncWarning, syncBlocked,
    triggerSync, triggerPullOnly,
  } = useOffline();

  const [storeCounts, setStoreCounts] = useState<{ name: string; label: string; count: number }[]>([]);
  const [failedList, setFailedList] = useState<PendingOperation[]>([]);
  const [showFailed, setShowFailed] = useState(false);

  useEffect(() => {
    if (!open) return;
    getStoreCounts().then(setStoreCounts);
    getFailedOperations().then(setFailedList);
  }, [open, isSyncing]);

  const hoursElapsed = lastSyncTime ? (Date.now() - lastSyncTime) / (60 * 60 * 1000) : 48;
  const progressPercent = Math.min((hoursElapsed / 48) * 100, 100);
  const hoursRemaining = Math.max(0, 48 - hoursElapsed);

  const handleRetryAll = async () => {
    await retryAllFailedOperations();
    await triggerSync();
    getFailedOperations().then(setFailedList);
  };

  const handleDeleteFailed = async (id: string) => {
    await removePendingOperation(id);
    const updated = failedList.filter(op => op.id !== id);
    setFailedList(updated);
  };

  const connectionColor = !isOnline ? 'text-destructive' : syncWarning ? 'text-warning' : 'text-success';
  const connectionText = !isOnline ? 'Sin conexión' : syncBlocked ? 'Bloqueado — sincroniza' : syncWarning ? 'Advertencia — sincroniza pronto' : 'Conectado';
  const ConnectionIcon = !isOnline ? WifiOff : Wifi;

  const totalRecords = storeCounts.reduce((sum, s) => sum + s.count, 0);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Cloud className="h-5 w-5" />
            Estado de sincronización
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-5 mt-4">
          {/* Section 1: Connection */}
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
            <ConnectionIcon className={`h-5 w-5 ${connectionColor}`} />
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium ${connectionColor}`}>{connectionText}</p>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Última sync: {timeAgo(lastSyncTime)}
              </p>
            </div>
          </div>

          {/* Section 2: Local DB */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Database className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-medium">Base de datos local</h3>
              <Badge variant="secondary" className="ml-auto text-[10px]">{totalRecords} registros</Badge>
            </div>
            <div className="grid grid-cols-2 gap-1">
              {storeCounts.filter(s => s.count > 0).map(s => (
                <div key={s.name} className="flex justify-between text-xs text-muted-foreground px-2 py-1 rounded bg-muted/30">
                  <span>{s.label}</span>
                  <span className="font-mono">{s.count}</span>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* Section 3: Queue */}
          <div>
            <h3 className="text-sm font-medium mb-2">Cola de sincronización</h3>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">Pendientes:</span>
                <Badge variant={pendingCount > 0 ? 'default' : 'secondary'} className="text-[10px]">{pendingCount}</Badge>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">Fallidas:</span>
                <Badge variant={failedOps > 0 ? 'destructive' : 'secondary'} className="text-[10px]">{failedOps}</Badge>
              </div>
            </div>

            {failedOps > 0 && (
              <div className="mt-2 space-y-2">
                <Button variant="outline" size="sm" className="w-full text-xs" onClick={() => setShowFailed(!showFailed)}>
                  {showFailed ? 'Ocultar detalles' : 'Ver operaciones fallidas'}
                </Button>

                {showFailed && (
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {failedList.map(op => (
                      <div key={op.id} className="flex items-center gap-2 p-2 rounded bg-destructive/5 text-xs">
                        <AlertTriangle className="h-3 w-3 text-destructive flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <span className="font-medium">{op.table}</span>
                          <span className="text-muted-foreground"> · {op.operation}</span>
                          {op.errorMessage && (
                            <p className="text-[10px] text-muted-foreground truncate">{op.errorMessage}</p>
                          )}
                        </div>
                        <button onClick={() => handleDeleteFailed(op.id)} className="text-muted-foreground hover:text-destructive">
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <Button variant="outline" size="sm" className="w-full text-xs" onClick={handleRetryAll} disabled={isSyncing}>
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Reintentar todas
                </Button>
              </div>
            )}
          </div>

          <Separator />

          {/* Section 4: Actions */}
          <div className="space-y-2">
            <Button
              className="w-full"
              onClick={() => { triggerSync(); }}
              disabled={!isOnline || isSyncing}
            >
              {isSyncing ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" />Sincronizando...</>
              ) : (
                <><RefreshCw className="h-4 w-4 mr-2" />Sincronizar ahora</>
              )}
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => { triggerPullOnly(); }}
              disabled={!isOnline || isSyncing}
            >
              <Download className="h-4 w-4 mr-2" />
              Forzar descarga completa
            </Button>
          </div>

          <Separator />

          {/* Section 5: Time limit */}
          <div>
            <h3 className="text-sm font-medium mb-2">Límite de uso offline</h3>
            <Progress
              value={progressPercent}
              className={`h-2 ${progressPercent > 75 ? '[&>div]:bg-destructive' : progressPercent > 50 ? '[&>div]:bg-warning' : ''}`}
            />
            <div className="flex justify-between mt-1.5 text-[10px] text-muted-foreground">
              <span>0h</span>
              <span>36h</span>
              <span>48h</span>
            </div>

            {syncBlocked ? (
              <p className="text-xs text-destructive font-medium mt-2 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                Sincroniza para continuar usando Bivoo
              </p>
            ) : syncWarning ? (
              <p className="text-xs text-warning font-medium mt-2">
                ⚠️ Quedan {hoursRemaining.toFixed(0)}h — sincroniza pronto
              </p>
            ) : (
              <p className="text-xs text-muted-foreground mt-2">
                {hoursRemaining.toFixed(0)}h restantes de uso offline
              </p>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};
