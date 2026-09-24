import type { QueryClient } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { createRootRouteWithContext, Outlet } from '@tanstack/react-router';
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools';
import { useTranslation } from 'react-i18next';
import { NotFoundPage } from '@/components/not-found-page';
import { TranslatedFormMessages } from '@/components/translated-form-messages';
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
        <Outlet />
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
