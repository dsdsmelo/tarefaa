import { ReactNode } from 'react';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from './AppSidebar';
import { QuickCaptureProvider } from '@/components/quick-capture/QuickCaptureProvider';

interface MainLayoutProps {
  children: ReactNode;
}

export const MainLayout = ({ children }: MainLayoutProps) => {
  return (
    <QuickCaptureProvider>
      <SidebarProvider defaultOpen={true}>
        <div className="min-h-screen bg-background flex w-full">
          <AppSidebar />
          <SidebarInset className="flex-1 overflow-hidden">
            <div className="h-full overflow-auto">
              {children}
            </div>
          </SidebarInset>
        </div>
      </SidebarProvider>
    </QuickCaptureProvider>
  );
};
