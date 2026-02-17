import { SidebarTrigger } from '@/components/ui/sidebar';
import { useAuth } from '@/contexts/AuthContext';
import { useOffline } from '@/contexts/OfflineContext';
import NotificationCenter from './NotificationCenter';
import { WifiOff, Loader2, Cloud } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface AppHeaderProps {
  title?: string;
}

const AppHeader = ({ title }: AppHeaderProps) => {
  const { profile } = useAuth();
  const { isOnline, isSyncing, pendingCount } = useOffline();

  return (
    <header className="flex h-11 md:h-14 shrink-0 items-center justify-between border-b border-border/60 bg-card/80 backdrop-blur-sm px-3 md:px-4">
      <div className="flex items-center gap-3">
        <SidebarTrigger className="md:hidden" />
        <h1 className="text-base font-semibold text-foreground">
          {title || `¡Hola, ${profile?.full_name?.split(' ')[0] || 'Usuario'}!`}
        </h1>
      </div>

      <div className="flex items-center gap-1">
        {/* Offline/Sync indicator */}
        <div className="flex items-center gap-1.5 mr-1">
          {isSyncing ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : !isOnline ? (
            <div className="flex items-center gap-1">
              <WifiOff className="h-4 w-4 text-warning" />
              {pendingCount > 0 && (
                <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                  {pendingCount}
                </Badge>
              )}
            </div>
          ) : (
            <Cloud className="h-4 w-4 text-success" />
          )}
        </div>
        <NotificationCenter />
      </div>
    </header>
  );
};

export default AppHeader;
