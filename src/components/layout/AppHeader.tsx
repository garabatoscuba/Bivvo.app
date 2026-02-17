import { SidebarTrigger } from '@/components/ui/sidebar';
import { useAuth } from '@/contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { usePWAUpdate } from '@/hooks/usePWAUpdate';
import { RefreshCw, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useState } from 'react';
import NotificationCenter from './NotificationCenter';

interface AppHeaderProps {
  title?: string;
}

const AppHeader = ({ title }: AppHeaderProps) => {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const { needsUpdate, updateApp } = usePWAUpdate();
  const [syncing, setSyncing] = useState(false);

  const handleSync = async () => {
    setSyncing(true);
    await queryClient.invalidateQueries();
    setTimeout(() => {
      setSyncing(false);
      toast.success('Datos sincronizados');
    }, 600);
  };

  return (
    <header className="flex h-11 md:h-14 shrink-0 items-center justify-between border-b border-border/60 bg-card/80 backdrop-blur-sm px-3 md:px-4">
      <div className="flex items-center gap-3">
        <SidebarTrigger className="md:hidden" />
        <h1 className="text-base font-semibold text-foreground">
          {title || `¡Hola, ${profile?.full_name?.split(' ')[0] || 'Usuario'}!`}
        </h1>
      </div>

      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={handleSync}
          disabled={syncing}
          title="Sincronizar datos"
        >
          <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
        </Button>

        {needsUpdate && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-primary animate-pulse"
            onClick={updateApp}
            title="Actualizar app"
          >
            <Download className="h-4 w-4" />
          </Button>
        )}

        <NotificationCenter />
      </div>
    </header>
  );
};

export default AppHeader;
