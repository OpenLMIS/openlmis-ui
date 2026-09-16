import type { QueryClient } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { createRootRouteWithContext, Link, Outlet } from '@tanstack/react-router';
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools';
import { ChevronLeft, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { Toaster } from '@/components/ui/sonner';

export type RouterContext = {
  queryClient: QueryClient;
};

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
  notFoundComponent: NotFoundPage,
});

function RootLayout() {
  return (
    <>
      <Outlet />
      <Toaster />
      {/* Production: Tools are not rendered by design, the VITE_SHOW_DEVTOOLS is purely for development purposes */}
      {import.meta.env.VITE_SHOW_DEVTOOLS === 'true' && (
        <>
          <ReactQueryDevtools initialIsOpen={false} />
          <TanStackRouterDevtools initialIsOpen={false} />
        </>
      )}
    </>
  );
}

function NotFoundPage() {
  const { t } = useTranslation();

  return (
    <Empty className="h-screen">
      <EmptyHeader>
        <EmptyMedia variant="icon" className="size-12 [&_svg:not([class*='size-'])]:size-8">
          <X />
        </EmptyMedia>
        <EmptyTitle size="lg">{t('not-found.title')}</EmptyTitle>
        <EmptyDescription size="lg">{t('not-found.description')}</EmptyDescription>
      </EmptyHeader>
      <Button
        render={(props) => (
          <Link {...props} to="/">
            <ChevronLeft />
            {t('not-found.back-home')}
          </Link>
        )}
        size="lg"
      />
    </Empty>
  );
}
