import '@/routes/-offline-pages';
import { createFileRoute, Outlet, redirect, useLocation, useRouter } from '@tanstack/react-router';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AppShell } from '@/components/app-shell';
import { AppShellSkeleton } from '@/components/app-shell-skeleton';
import { ErrorFallback } from '@/components/error-fallback';
import { OfflineNotice } from '@/components/offline-notice';
import { PageVisibility } from '@/components/page-visibility';
import { useLoginData } from '@/features/auth/store/login-data';
import { OfflinePageUnavailableError } from '@/lib/offline-capability';
import { canRetainPageOffline, isOfflineCapable } from '@/lib/offline-pages';
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
  const available = online || canRetainPageOffline(pathname);
  const scope = useSessionScope();
  const context = Route.useRouteContext();
  const [loadedScope, setLoadedScope] = useState(context.sessionScope);
  const router = useRouter();
  const contentRef = useRef<HTMLDivElement>(null);
  const noticeRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const [previousAvailable, setPreviousAvailable] = useState(available);
  if (available !== previousAvailable) {
    setPreviousAvailable(available);
    if (!available) {
      const focused = document.activeElement;
      previousFocus.current = focused instanceof HTMLElement ? focused : null;
    }
  }
  useLayoutEffect(() => {
    if (!available && previousFocus.current) {
      if (
        contentRef.current?.contains(previousFocus.current) ||
        previousFocus.current.closest('[hidden]')
      ) {
        noticeRef.current?.querySelector<HTMLElement>('h1')?.focus();
      } else previousFocus.current = null;
    } else if (available && previousFocus.current) {
      const target = previousFocus.current;
      const frame = requestAnimationFrame(() => {
        const focused = document.activeElement;
        const dialog = target.closest('[role=dialog], [role=alertdialog]');
        if (
          focused === document.body ||
          noticeRef.current?.contains(focused) ||
          dialog?.contains(focused)
        ) {
          if (target.isConnected) target.focus();
        }
        previousFocus.current = null;
      });
      return () => cancelAnimationFrame(frame);
    }
  }, [available]);

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
      <div ref={noticeRef} hidden={available}>
        {!available && (
          <OfflineNotice
            headingLevel={1}
            reason="online-only"
            onRetry={() => {
              seedOnline();
              if (isOnline()) void router.invalidate();
            }}
          />
        )}
      </div>
      <div ref={contentRef} className={available ? 'contents' : undefined} hidden={!available}>
        <PageVisibility hidden={!available}>
          <Outlet />
        </PageVisibility>
      </div>
    </AppShell>
  );
}
