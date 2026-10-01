import { useSuspenseQuery } from '@tanstack/react-query';
import {
  createFileRoute,
  type ErrorComponentProps,
  Link,
  Outlet,
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
import { BackToProducts } from '@/features/products/components/back-to-products';
import { ProductGeneralFormSkeleton } from '@/features/products/components/product-general-form';
import { ProductWorkspace } from '@/features/products/components/product-workspace';
import { isNotFound } from '@/lib/http';

export const Route = createFileRoute('/(protected)/_protected/administration/products_/$id')({
  staticData: { crumbKey: 'products.edit.crumb' },
  loader: async ({ context: { queryClient }, params, cause }) => {
    const detail = productDetailOptions(params.id);
    const [rights] = await Promise.all([
      requireRight(queryClient, [RIGHTS.orderablesManage, RIGHTS.facilityApprovedOrderablesManage]),
      // A save sends the product back whole, so each opening reads it again; a tab switch does not.
      cause === 'stay'
        ? queryClient.ensureQueryData(detail)
        : cause === 'enter' && queryClient.fetchQuery({ ...detail, staleTime: 0 }),
    ]);
    return {
      canEditProduct: rights.has(RIGHTS.orderablesManage),
      canEditFtaps: rights.has(RIGHTS.facilityApprovedOrderablesManage),
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
  // The list as it was when this page was opened from it; tab links do not carry it along.
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
  return (
    <ProductWorkspace productId={id}>
      <ProductGeneralFormSkeleton />
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
