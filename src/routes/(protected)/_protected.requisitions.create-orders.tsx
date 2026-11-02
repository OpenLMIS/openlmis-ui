import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { ListError } from '@/components/app-shell/list-error';
import { QueryBoundary } from '@/components/app-shell/query-boundary';
import { Skeleton } from '@/components/ui/skeleton';
import { permissionsOptions } from '@/features/auth/api/queries';
import { requirePermissions } from '@/features/auth/lib/access';
import { CreateOrderForm } from '@/features/orders/components/create-order-form';
import { canReadOrders, requestingFacilities } from '@/features/orders/lib/supplying-facilities';
import {
  minimalFacilitiesOptions,
  userProgramsOptions,
} from '@/features/reference-data/api/queries';
import { RIGHTS } from '@/lib/rights';
import { getSessionUserId } from '@/lib/session-scope';

export const Route = createFileRoute('/(protected)/_protected/requisitions/create-orders')({
  loader: async ({ context: { queryClient } }) => {
    await requirePermissions(queryClient, RIGHTS.orderCreate);
    const userId = getSessionUserId() ?? '';
    queryClient.prefetchQuery(userProgramsOptions(userId));
    queryClient.prefetchQuery(minimalFacilitiesOptions());
    return { userId };
  },
  component: Page,
});
function Page() {
  return (
    <QueryBoundary
      resetKey="create-orders"
      errorComponent={CreateError}
      pendingFallback={<Skeleton />}
    >
      <Content />
    </QueryBoundary>
  );
}
function Content() {
  const { userId } = Route.useLoaderData();
  const navigate = Route.useNavigate();
  const { data: permissions } = useSuspenseQuery(permissionsOptions(userId));
  const { data: facilities } = useSuspenseQuery(minimalFacilitiesOptions());
  return (
    <CreateOrderForm
      userId={userId}
      facilities={facilities}
      requesting={requestingFacilities(permissions, facilities)}
      canRead={(program, supplier, ids) => canReadOrders(permissions, program, supplier, ids)}
      onCreated={(ids) =>
        navigate({
          to: '/requisitions/create-orders/$orderIds',
          params: { orderIds: ids.join(',') },
        })
      }
    />
  );
}

function CreateError(props: import('@tanstack/react-router').ErrorComponentProps) {
  const { t } = useTranslation();
  return (
    <ListError
      {...props}
      title={t('orders.create.title')}
      description={t('orders.create.description')}
    />
  );
}
