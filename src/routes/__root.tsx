import type { QueryClient } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { createRootRouteWithContext, Outlet } from '@tanstack/react-router';
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools';
import { lazy, type ReactNode, Suspense, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  type DeviceSync,
  DeviceSyncContext,
  DeviceSyncPublisher,
  type DeviceWork,
  DeviceWorkContext,
  DeviceWorkPublisher,
  EMPTY_DEVICE_SYNC,
  EMPTY_DEVICE_WORK,
} from '@/components/app-shell/device-work';
import { NotFoundPage } from '@/components/app-shell/not-found-page';
import { OfflineNavigationProvider } from '@/components/app-shell/offline-navigation';
import { SessionExpiredDialog } from '@/components/auth/session-expired-dialog';
import { TranslatedFormMessages } from '@/components/i18n/translated-form-messages';
import { DialogCloseLabelProvider } from '@/components/ui/dialog';
import { Toaster } from '@/components/ui/sonner';
import { useLoginData } from '@/features/auth/store/login-data';
import { countUnsyncedRequisitionDrafts } from '@/features/requisitions/lib/unsynced-device-work';
import { countUnsyncedDeviceWork } from '@/features/stock-events/lib/unsynced-device-work';
import type { InitialTrigger } from '@/lib/offline-coordinator';
import { isSecureOrigin } from '@/lib/secure-context';
import { getSessionScope, useSessionScope } from '@/lib/session-scope';

const DeviceWorkProvider = lazy(() =>
  import('@/routes/-device-work-provider').then((module) => ({
    default: module.DeviceWorkProvider,
  })),
);

async function countUnsyncedWork() {
  const counts = await Promise.all([countUnsyncedDeviceWork(), countUnsyncedRequisitionDrafts()]);
  return counts.reduce((total, count) => total + count, 0);
}

export function SignedInDeviceWork({ children }: { children: ReactNode }) {
  const authenticated = useLoginData((state) => state.isAuthenticated);
  const scope = useSessionScope();
  const [work, setWork] = useState({ scope, value: EMPTY_DEVICE_WORK });
  const [sync, setSync] = useState({ scope, value: EMPTY_DEVICE_SYNC });
  const publish = useCallback(
    (value: DeviceWork) => setWork({ scope: getSessionScope(), value }),
    [],
  );
  const publishSync = useCallback(
    (value: DeviceSync) => setSync({ scope: getSessionScope(), value }),
    [],
  );
  const value = useMemo(
    () => ({
      ...(authenticated && work.scope === scope ? work.value : EMPTY_DEVICE_WORK),
      countUnsyncedWork,
    }),
    [authenticated, work, scope],
  );
  const [initialTrigger, setInitialTrigger] = useState<InitialTrigger>(
    authenticated ? 'boot' : 'sign-in',
  );
  if (!authenticated && initialTrigger !== 'sign-in') setInitialTrigger('sign-in');
  return (
    <DeviceWorkContext value={value}>
      <DeviceWorkPublisher value={publish}>
        <DeviceSyncContext
          value={authenticated && sync.scope === scope ? sync.value : EMPTY_DEVICE_SYNC}
        >
          <DeviceSyncPublisher value={publishSync}>
            {children}
            <Suspense fallback={null}>
              {authenticated && isSecureOrigin && (
                <DeviceWorkProvider initialTrigger={initialTrigger} />
              )}
            </Suspense>
          </DeviceSyncPublisher>
        </DeviceSyncContext>
      </DeviceWorkPublisher>
    </DeviceWorkContext>
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
            <OfflineNavigationProvider>
              <Outlet />
              {/* At the root, so it also covers a page whose loader is waiting for the session. */}
              <SessionExpiredDialog />
            </OfflineNavigationProvider>
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
