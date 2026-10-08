import { createFileRoute, Outlet, redirect, useRouter } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { AppShell } from '@/components/app-shell';
import { AppShellSkeleton } from '@/components/app-shell-skeleton';
import { useLoginData } from '@/features/auth/store/login-data';
import { loginSearch } from '@/lib/redirect';
import { getSessionScope, useSessionScope } from '@/lib/session-scope';

export const Route = createFileRoute('/(protected)/_protected')({
  beforeLoad: ({ location }) => {
    if (!useLoginData.getState().isAuthenticated) {
      throw redirect({ to: '/login', search: loginSearch(location) });
    }
    return { sessionScope: getSessionScope() };
  },
  component: ProtectedLayout,
  pendingComponent: AppShellSkeleton,
});

function ProtectedLayout() {
  const scope = useSessionScope();
  const context = Route.useRouteContext();
  const [loadedScope, setLoadedScope] = useState(context.sessionScope);
  const router = useRouter();

  useEffect(() => {
    if (scope === loadedScope) return;
    let active = true;
    void router.invalidate({ sync: true }).then(() => {
      if (active && scope === getSessionScope()) setLoadedScope(scope);
    });
    return () => {
      active = false;
    };
  }, [scope, loadedScope, router]);

  if (scope !== loadedScope) return <AppShellSkeleton />;

  return (
    <AppShell key={scope}>
      <Outlet />
    </AppShell>
  );
}
