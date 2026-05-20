import { ReactNode } from 'react';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import AppSidebar from './AppSidebar';
import AppHeader from './AppHeader';
import SubscriptionBanner from './SubscriptionBanner';
import InstallBanner from './InstallBanner';

import BivooAssistant from '@/components/assistant/BivooAssistant';
import { OfflineBanner } from './OfflineBanner';
import { useFeatureUsage } from '@/hooks/useFeatureUsage';
import { useOfflineCache } from '@/hooks/useOfflineCache';

interface AppLayoutProps {
  children: ReactNode;
  title?: string;
  hideHeader?: boolean;
  noPadding?: boolean;
}

const AppLayout = ({ children, title, hideHeader, noPadding }: AppLayoutProps) => {
  useFeatureUsage();
  useOfflineCache();

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full overflow-hidden">
        <AppSidebar />
        <SidebarInset className="flex flex-1 flex-col overflow-hidden">
          <OfflineBanner />
          <InstallBanner />
          <SubscriptionBanner />
          {!hideHeader && <AppHeader title={title} />}
          <main className={`flex-1 overflow-auto max-w-full ${noPadding ? '' : 'p-3 md:p-6 px-2 py-[5px] border-transparent border-none border-0'}`}>
            {children}
          </main>
        </SidebarInset>
      </div>
      <BivooAssistant />
    </SidebarProvider>
  );
};

export default AppLayout;