import { ReactNode } from 'react';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { usePWAUpdate } from '@/hooks/usePWAUpdate';
import { Button } from '@/components/ui/button';
import AppSidebar from './AppSidebar';
import AppHeader from './AppHeader';
import SubscriptionBanner from './SubscriptionBanner';
import InstallBanner from './InstallBanner';

interface AppLayoutProps {
  children: ReactNode;
  title?: string;
}

const AppLayout = ({ children, title }: AppLayoutProps) => {
  const { needsUpdate, updateApp, dismissUpdate } = usePWAUpdate();

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <SidebarInset className="flex flex-1 flex-col">
          {needsUpdate && (
            <div className="flex items-center justify-between gap-2 bg-primary px-4 py-2 text-primary-foreground">
              <span className="text-sm font-medium">Nueva versión disponible</span>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="secondary" className="h-7 text-xs" onClick={updateApp}>
                  Actualizar ahora
                </Button>
                <button onClick={dismissUpdate} className="rounded p-1 hover:bg-primary-foreground/20 text-xs" aria-label="Cerrar">✕</button>
              </div>
            </div>
          )}
          <InstallBanner />
          <SubscriptionBanner />
          <AppHeader title={title} />
          <main className="flex-1 overflow-auto p-3 md:p-6">
            {children}
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
};

export default AppLayout;
