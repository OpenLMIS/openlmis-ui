import { createFileRoute, Outlet } from '@tanstack/react-router';
import { AppShell } from '@/components/app-shell';
import { AppShellSkeleton } from '@/components/app-shell-skeleton';

export const Route = createFileRoute('/(protected)/_protected')({
  beforeLoad: async () => {
    // Auth guard - redirect unauthenticated users to login.
    // Example:
    //   const user = await getAuthUser();
    //   if (!user) throw redirect({ to: '/login' });
  },
  component: ProtectedLayout,
  pendingComponent: AppShellSkeleton,
});

function ProtectedLayout() {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
