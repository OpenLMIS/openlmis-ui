import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';
import { AppShell } from '@/components/app-shell';
import { AppShellSkeleton } from '@/components/app-shell-skeleton';
import { useLoginData } from '@/features/auth/store/login-data';

export const Route = createFileRoute('/(protected)/_protected')({
  beforeLoad: () => {
    if (!useLoginData.getState().isAuthenticated) {
      throw redirect({ to: '/login' });
    }
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
