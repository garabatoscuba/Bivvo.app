import { useOnlineStatus, type SyncStatus } from '@/hooks/useOnlineStatus';
import { WifiOff, Loader2, CheckCircle2 } from 'lucide-react';

const statusConfig: Record<Exclude<SyncStatus, 'online'>, { icon: React.ReactNode; text: string; bg: string }> = {
  offline: {
    icon: <WifiOff className="h-3.5 w-3.5" />,
    text: 'Modo sin conexión — los cambios se sincronizarán cuando vuelva el internet',
    bg: 'bg-yellow-500/90 text-yellow-950',
  },
  syncing: {
    icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />,
    text: 'Sincronizando...',
    bg: 'bg-blue-500/90 text-white',
  },
  synced: {
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
    text: 'Todo sincronizado ✓',
    bg: 'bg-green-500/90 text-white',
  },
};

export const OfflineBanner = () => {
  const { syncStatus } = useOnlineStatus();

  if (syncStatus === 'online') return null;

  const config = statusConfig[syncStatus];

  return (
    <div className={`flex items-center justify-center gap-2 px-3 py-1.5 text-xs font-medium ${config.bg} transition-all duration-300`}>
      {config.icon}
      <span>{config.text}</span>
    </div>
  );
};
