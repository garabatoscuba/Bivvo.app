import { ReactNode } from 'react';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import AppSidebar from './AppSidebar';
import AppHeader from './AppHeader';
import SubscriptionBanner from './SubscriptionBanner';
import InstallBanner from './InstallBanner';

interface AppLayoutProps {
  children: ReactNode;
  title?: string;
}

const AppLayout = ({ children, title }: AppLayoutProps) => {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <SidebarInset className="flex flex-1 flex-col">
          <InstallBanner />
          <SubscriptionBanner />
          <AppHeader title={title} />
          <main className="flex-1 overflow-auto p-3 md:p-6 px-0 py-[5px] border-transparent border-none border-0">
            {children}
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>);

};

export default AppLayout;