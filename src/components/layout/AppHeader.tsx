import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { useAuth } from '@/contexts/AuthContext';
import { useOffline } from '@/contexts/OfflineContext';
import { useJornadaActiva } from '@/hooks/useJornadaActiva';
import CerrarJornadaModal from '@/components/employees/CerrarJornadaModal';
import NotificationCenter from './NotificationCenter';
import { WifiOff, Loader2, Cloud } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

function useElapsedTime(startIso: string | null | undefined) {
  const [text, setText] = useState('');
  useEffect(() => {
    if (!startIso) return;
    const update = () => {
      const diffMs = Date.now() - new Date(startIso).getTime();
      const m = Math.floor(diffMs / 60000);
      const h = Math.floor(m / 60);
      setText(h > 0 ? `${h}h ${m % 60}m` : `${m}m`);
    };
    update();
    const id = setInterval(update, 60000);
    return () => clearInterval(id);
  }, [startIso]);
  return text;
}

interface AppHeaderProps {
  title?: string;
}

const AppHeader = ({ title }: AppHeaderProps) => {
  const { profile, isOwner, isManager, isSuperAdmin } = useAuth();
  const { isOnline, isSyncing, pendingCount } = useOffline();
  const navigate = useNavigate();

  const isPrivileged = isOwner || isManager || isSuperAdmin;
  const { jornadaActiva, jornada, isLoading: jornadaLoading } = useJornadaActiva();
  const elapsed = useElapsedTime(jornada?.apertura_at);
  const [cerrarOpen, setCerrarOpen] = useState(false);

  return (
    <header className="flex h-11 md:h-14 shrink-0 items-center justify-between border-b border-border/60 bg-card/80 backdrop-blur-sm px-2 md:px-4 overflow-hidden max-w-full">
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <SidebarTrigger className="md:hidden flex-shrink-0" />
        <h1 className="text-sm md:text-base font-semibold text-foreground truncate">
          {title || `¡Hola, ${profile?.full_name?.split(' ')[0] || 'Usuario'}!`}
        </h1>
      </div>

      <div className="flex items-center gap-1 flex-shrink-0">
        {/* Jornada indicator — only for non-privileged roles */}
        {!isPrivileged && !jornadaLoading && (
          jornadaActiva && jornada ? (
            <button
              onClick={() => setCerrarOpen(true)}
              className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-primary/10 text-primary text-[11px] font-medium hover:bg-primary/20 transition-colors mr-1"
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
              </span>
              Activa · {elapsed}
            </button>
          ) : (
            <button
              onClick={() => navigate('/jornada/entrada')}
              className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-destructive/10 text-destructive text-[11px] font-medium hover:bg-destructive/20 transition-colors mr-1"
            >
              <span className="h-2 w-2 rounded-full bg-destructive" />
              Sin jornada
            </button>
          )
        )}

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

      {/* Modal cerrar jornada */}
      {jornada && (
        <CerrarJornadaModal
          open={cerrarOpen}
          onOpenChange={setCerrarOpen}
          jornada={jornada}
        />
      )}
    </header>
  );
};

export default AppHeader;
