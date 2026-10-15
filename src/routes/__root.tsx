import type { QueryClient } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { createRootRouteWithContext, Outlet } from '@tanstack/react-router';
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools';
import { lazy, type ReactNode, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { AppShellSkeleton } from '@/components/app-shell-skeleton';
import { NotFoundPage } from '@/components/not-found-page';
import { SessionExpiredDialog } from '@/components/session-expired-dialog';
import { TranslatedFormMessages } from '@/components/translated-form-messages';
import { DialogCloseLabelProvider } from '@/components/ui/dialog';
import { Toaster } from '@/components/ui/sonner';
import { useLoginData } from '@/features/auth/store/login-data';

const DeviceWorkProvider = lazy(() =>
  import('@/routes/-device-work-provider').then((module) => ({
    default: module.DeviceWorkProvider,
  })),
);

function SignedInDeviceWork({ children }: { children: ReactNode }) {
  const authenticated = useLoginData((state) => state.isAuthenticated);
  return authenticated ? (
    <Suspense fallback={<AppShellSkeleton />}>
      <DeviceWorkProvider>{children}</DeviceWorkProvider>
    </Suspense>
  ) : (
    children
  );
}

export type RouterContext = {
  queryClient: QueryClient;
  getResolvedPathname?: () => string | undefined;
};

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
  notFoundComponent: NotFoundPage,
});

function RootLayout() {
  const { t } = useTranslation();

  return (
    <>
      {/* At the root, so forms outside the app shell, like sign in, translate their messages too. */}
      <SignedInDeviceWork>
        <TranslatedFormMessages>
          <DialogCloseLabelProvider label={t('dialog.close')}>
            <Outlet />
            {/* At the root, so it also covers a page whose loader is waiting for the session. */}
            <SessionExpiredDialog />
          </DialogCloseLabelProvider>
        </TranslatedFormMessages>
      </SignedInDeviceWork>
      <Toaster toastOptions={{ closeButtonAriaLabel: t('toast.close') }} />
      {import.meta.env.VITE_SHOW_DEVTOOLS === 'true' && (
        <>
          <ReactQueryDevtools initialIsOpen={false} />
          <TanStackRouterDevtools initialIsOpen={false} />
        </>
      )}
    </>
  );
}
