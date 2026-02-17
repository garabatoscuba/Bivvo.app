import { SidebarTrigger } from '@/components/ui/sidebar';
import { useAuth } from '@/contexts/AuthContext';
import NotificationCenter from './NotificationCenter';

interface AppHeaderProps {
  title?: string;
}

const AppHeader = ({ title }: AppHeaderProps) => {
  const { profile } = useAuth();

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border/60 bg-card/80 backdrop-blur-sm px-4">
      <div className="flex items-center gap-3">
        <SidebarTrigger className="md:hidden" />
        <h1 className="text-base font-semibold text-foreground">
          {title || `¡Hola, ${profile?.full_name?.split(' ')[0] || 'Usuario'}!`}
        </h1>
      </div>

      <div className="flex items-center gap-1">
        <NotificationCenter />
      </div>
    </header>
  );
};

export default AppHeader;
