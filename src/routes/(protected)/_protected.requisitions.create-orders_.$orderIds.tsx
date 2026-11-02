import { createFileRoute, notFound } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Workspace,
  WorkspaceContent,
  WorkspaceDescription,
  WorkspaceHeader,
  WorkspaceHeading,
  WorkspaceTitle,
} from '@/components/workspace/workspace';
import { requirePermissions } from '@/features/auth/lib/access';
import { OrderEditor } from '@/features/orders/components/order-editor';
import { orderIds } from '@/features/orders/lib/order-draft';
import { loadOrders } from '@/features/orders/lib/order-load';
import { deploymentTimeZoneOptions } from '@/features/reference-data/api/queries';
import { RIGHTS } from '@/lib/rights';

export const Route = createFileRoute(
  '/(protected)/_protected/requisitions/create-orders_/$orderIds',
)({
  validateSearch: z.object({ tab: z.string().optional().catch(undefined) }),
  preload: false,
  staticData: { crumbKey: 'orders.edit.crumb' },
  loader: async ({ context: { queryClient }, params, cause }) => {
    await requirePermissions(queryClient, RIGHTS.orderCreate);
    queryClient.prefetchQuery(deploymentTimeZoneOptions());
    const ids = orderIds(params.orderIds);
    if (!ids.length) throw notFound();
    return loadOrders(queryClient, ids, cause === 'enter');
  },
  pendingComponent: Pending,
  component: Page,
});
function Page() {
  const entries = Route.useLoaderData();
  const { tab } = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <OrderEditor
      entries={entries}
      tab={tab}
      onTab={(id) => navigate({ search: { tab: id }, replace: true })}
      onCancel={() => navigate({ to: '/requisitions/create-orders' })}
      onBatchChange={(ids) =>
        ids.length
          ? navigate({
              to: '/requisitions/create-orders/$orderIds',
              params: { orderIds: ids.join(',') },
              search: {},
              replace: true,
            })
          : navigate({ to: '/requisitions/create-orders', replace: true })
      }
    />
  );
}
function Pending() {
  const { t } = useTranslation();
  return (
    <Workspace>
      <WorkspaceHeader>
        <WorkspaceHeading>
          <WorkspaceTitle>{t('orders.create.title')}</WorkspaceTitle>
          <WorkspaceDescription>{t('orders.edit.description')}</WorkspaceDescription>
        </WorkspaceHeading>
      </WorkspaceHeader>
      <WorkspaceContent>
        <Skeleton />
        <Skeleton />
        <Skeleton />
      </WorkspaceContent>
    </Workspace>
  );
}
