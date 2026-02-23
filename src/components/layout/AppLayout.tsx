import { ReactNode } from 'react';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import AppSidebar from './AppSidebar';
import AppHeader from './AppHeader';
import SubscriptionBanner from './SubscriptionBanner';
import InstallBanner from './InstallBanner';
import AlertaInactividad from '@/components/employees/AlertaInactividad';

interface AppLayoutProps {
  children: ReactNode;
  title?: string;
}

const AppLayout = ({ children, title }: AppLayoutProps) => {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full overflow-hidden">
        <AppSidebar />
        <SidebarInset className="flex flex-1 flex-col overflow-hidden">
          <InstallBanner />
          <SubscriptionBanner />
          <AppHeader title={title} />
          <main className="flex-1 overflow-auto p-3 md:p-6 px-1 py-[5px] border-transparent border-none border-0 max-w-full">
            {children}
          </main>
          <AlertaInactividad />
        </SidebarInset>
      </div>
    </SidebarProvider>);

};

export default AppLayout;