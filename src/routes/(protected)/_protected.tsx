import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';
import { AppShell } from '@/components/app-shell';
import { AppShellSkeleton } from '@/components/app-shell-skeleton';
import { useLoginData } from '@/features/auth/store/login-data';
import { loginSearch } from '@/lib/redirect';

export const Route = createFileRoute('/(protected)/_protected')({
  beforeLoad: ({ location }) => {
    if (!useLoginData.getState().isAuthenticated) {
      throw redirect({ to: '/login', search: loginSearch(location) });
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
