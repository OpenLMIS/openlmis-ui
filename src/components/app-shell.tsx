import type { ReactNode } from 'react';
import { AppHeader } from '@/components/app-header';
import { AppSidebar } from '@/components/app-sidebar';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';

type AppShellProps = {
  children: ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset surface="muted">
        <AppHeader />
        <div className="mx-auto flex w-full flex-1">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
