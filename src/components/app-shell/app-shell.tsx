import { createContext, type ReactNode } from 'react';
import { AppHeader } from '@/components/app-shell/app-header';
import { AppSidebar } from '@/components/app-shell/app-sidebar';
import { TranslatedDataTableLabels } from '@/components/i18n/translated-data-table-labels';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';

export const AppShellContext = createContext(false);

type AppShellProps = {
  children: ReactNode;
  headerActions?: ReactNode;
};

export function AppShell({ children, headerActions }: AppShellProps) {
  return (
    <AppShellContext value={true}>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <AppHeader actions={headerActions} />
          <div className="mx-auto flex w-full flex-1 flex-col">
            <TranslatedDataTableLabels>{children}</TranslatedDataTableLabels>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </AppShellContext>
  );
}
