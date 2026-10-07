import type { QueryClient } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { createRootRouteWithContext, Outlet } from '@tanstack/react-router';
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools';
import { useTranslation } from 'react-i18next';
import { NotFoundPage } from '@/components/not-found-page';
import { SessionExpiredDialog } from '@/components/session-expired-dialog';
import { TranslatedFormMessages } from '@/components/translated-form-messages';
import { DialogCloseLabelProvider } from '@/components/ui/dialog';
import { Toaster } from '@/components/ui/sonner';

export type RouterContext = {
  queryClient: QueryClient;
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
      <TranslatedFormMessages>
        <DialogCloseLabelProvider label={t('dialog.close')}>
          <Outlet />
          {/* At the root, so it also covers a page whose loader is waiting for the session. */}
          <SessionExpiredDialog />
        </DialogCloseLabelProvider>
      </TranslatedFormMessages>
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
