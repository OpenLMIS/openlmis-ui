import { createFileRoute, Outlet, redirect, useLocation, useRouter } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { AppShell } from '@/components/app-shell';
import { AppShellSkeleton } from '@/components/app-shell-skeleton';
import { ErrorFallback } from '@/components/error-fallback';
import { OfflineNotice } from '@/components/offline-notice';
import { PageVisibility } from '@/components/page-visibility';
import { useLoginData } from '@/features/auth/store/login-data';
import { isOfflineCapable, OfflinePageUnavailableError } from '@/lib/offline-capability';
import { isOnline, seedOnline, useOnline } from '@/lib/online';
import { loginSearch } from '@/lib/redirect';
import { getSessionScope, useSessionScope } from '@/lib/session-scope';

export const Route = createFileRoute('/(protected)/_protected')({
  beforeLoad: ({ location, context }) => {
    if (!useLoginData.getState().isAuthenticated) {
      throw redirect({ to: '/login', search: loginSearch(location) });
    }
    if (
      !isOnline() &&
      !isOfflineCapable(location.pathname) &&
      location.pathname !== context.getResolvedPathname?.()
    )
      throw new OfflinePageUnavailableError();
    return { sessionScope: getSessionScope() };
  },
  component: ProtectedLayout,
  pendingComponent: AppShellSkeleton,
  errorComponent: (props) => (
    <AppShell>
      <ErrorFallback {...props} />
    </AppShell>
  ),
});

function ProtectedLayout() {
  const online = useOnline();
  const { pathname } = useLocation();
  const available = online || isOfflineCapable(pathname);
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
      {!available && (
        <OfflineNotice
          reason="online-only"
          onRetry={() => {
            seedOnline();
            if (isOnline()) void router.invalidate();
          }}
        />
      )}
      <div className={available ? 'contents' : undefined} hidden={!available}>
        <PageVisibility hidden={!available}>
          <Outlet />
        </PageVisibility>
      </div>
    </AppShell>
  );
}
