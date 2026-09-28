import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';
import { AppShell } from '@/components/app-shell';
import { AppShellSkeleton } from '@/components/app-shell-skeleton';
import { useLoginData } from '@/features/auth/store/login-data';

export const Route = createFileRoute('/(protected)/_protected')({
  beforeLoad: ({ location }) => {
    if (!useLoginData.getState().isAuthenticated) {
      // Home is where signing in lands anyway, so only another page is worth carrying along.
      const search = location.pathname === '/home' ? {} : { redirect: location.href };
      throw redirect({ to: '/login', search });
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
