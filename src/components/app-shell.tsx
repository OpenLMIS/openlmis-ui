import type { ReactNode } from 'react';
import { AppHeader } from '@/components/app-header';
import { AppSidebar } from '@/components/app-sidebar';
import { TranslatedDataTableLabels } from '@/components/translated-data-table-labels';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';

type AppShellProps = {
  children: ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <AppHeader />
        <div className="mx-auto flex w-full flex-1">
          <TranslatedDataTableLabels>{children}</TranslatedDataTableLabels>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
