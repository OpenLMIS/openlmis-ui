import { useSuspenseQuery } from '@tanstack/react-query';
import {
  createFileRoute,
  type ErrorComponentProps,
  Link,
  Outlet,
  useLocation,
  useRouter,
} from '@tanstack/react-router';
import { PackageXIcon } from 'lucide-react';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ErrorFallback } from '@/components/error-fallback';
import { Button } from '@/components/ui/button';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { Workspace, WorkspaceContent } from '@/components/workspace';
import { requireRight } from '@/features/auth/lib/access';
import { RIGHTS } from '@/features/auth/lib/rights';
import { productDetailOptions } from '@/features/products/api/queries';
import { ProductGeneralFormSkeleton } from '@/features/products/components/product-general-form';
import { ProductWorkspace } from '@/features/products/components/product-workspace';
import { ProgramLinksTableSkeleton } from '@/features/products/components/program-links-table';
import { BackToProducts } from '@/features/products/hooks/back-to-products';
import { isNotFound } from '@/lib/http';

export const Route = createFileRoute('/(protected)/_protected/administration/products_/$id')({
  preload: false,
  loader: async ({ context: { queryClient }, params, cause }) => {
    const detail = productDetailOptions(params.id);
    const [rights] = await Promise.all([
      requireRight(queryClient, [RIGHTS.orderablesManage, RIGHTS.facilityApprovedOrderablesManage]),
      cause === 'stay'
        ? queryClient.ensureQueryData(detail)
        : queryClient.fetchQuery({ ...detail, staleTime: 0 }),
    ]);
    return {
      canEditProduct: rights.has(RIGHTS.orderablesManage),
    };
  },
  pendingComponent: ProductEditPending,
  errorComponent: ProductEditError,
  component: ProductEditLayout,
});

function ProductEditLayout() {
  const { id } = Route.useParams();
  const router = useRouter();
  const navigate = Route.useNavigate();
  const { data: product } = useSuspenseQuery(productDetailOptions(id));
  const [listSearch] = useState(() => router.state.location.state.productsListSearch ?? {});
  const backToProducts = useCallback(
    () => void navigate({ to: '/administration/products', search: listSearch }),
    [navigate, listSearch],
  );

  return (
    <BackToProducts value={backToProducts}>
      <ProductWorkspace product={product} productId={id}>
        <Outlet />
      </ProductWorkspace>
    </BackToProducts>
  );
}

function ProductEditPending() {
  const { id } = Route.useParams();
  const tab = useLocation({ select: (location) => location.pathname.split('/').at(-1) });
  return (
    <ProductWorkspace productId={id}>
      {tab === 'programs' ? (
        <ProgramLinksTableSkeleton columnVisibility={{}} />
      ) : (
        <ProductGeneralFormSkeleton />
      )}
    </ProductWorkspace>
  );
}

function ProductEditError(props: ErrorComponentProps) {
  const { t } = useTranslation();
  if (!isNotFound(props.error)) {
    return (
      <ErrorFallback
        {...props}
        description={t('products.edit.error-description')}
        title={t('products.edit.error-title')}
      />
    );
  }

  return (
    <Workspace>
      <WorkspaceContent>
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <PackageXIcon />
            </EmptyMedia>
            <EmptyTitle>{t('products.edit.not-found-title')}</EmptyTitle>
            <EmptyDescription>{t('products.edit.not-found-description')}</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button
              nativeButton={false}
              render={<Link to="/administration/products" />}
              variant="outline"
            >
              {t('products.edit.back')}
            </Button>
          </EmptyContent>
        </Empty>
      </WorkspaceContent>
    </Workspace>
  );
}
