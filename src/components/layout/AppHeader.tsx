import { SidebarTrigger } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Bell } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

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
        <Button variant="ghost" size="icon" className="relative h-8 w-8">
          <Bell className="h-4 w-4" />
          <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-destructive" />
        </Button>
      </div>
    </header>
  );
};

export default AppHeader;
