import { createFileRoute, notFound } from '@tanstack/react-router';
import { useState } from 'react';
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
import { cachedOrders, loadOrders } from '@/features/orders/lib/order-load';
import { deploymentTimeZoneOptions } from '@/features/reference-data/api/queries';
import { RIGHTS } from '@/lib/rights';

export const Route = createFileRoute(
  '/(protected)/_protected/requisitions/create-orders_/$orderIds',
)({
  validateSearch: z.object({ tab: z.string().optional().catch(undefined) }),
  preload: false,
  staticData: { crumbKey: 'orders.edit.crumb' },
  loader: ({ context: { queryClient }, params, cause, location }) => {
    const ids = orderIds(params.orderIds);
    if (!ids.length) throw notFound();
    if (location.state.orderBatchChange) {
      const cached = cachedOrders(queryClient, ids);
      if (cached) return cached;
    }
    return requirePermissions(queryClient, RIGHTS.orderCreate).then(() => {
      queryClient.prefetchQuery(deploymentTimeZoneOptions());
      return loadOrders(queryClient, ids, cause === 'enter');
    });
  },
  pendingComponent: Pending,
  component: Page,
});
function Page() {
  const entries = Route.useLoaderData();
  const { tab } = Route.useSearch();
  const navigate = Route.useNavigate();
  const [batch, setBatch] = useState(() => entries.map((entry) => entry.id));
  if (entries.some((entry) => !batch.includes(entry.id)))
    setBatch(entries.map((entry) => entry.id));
  return (
    <OrderEditor
      key={batch.join(',')}
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
              state: { orderBatchChange: true },
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
        <div className="flex flex-col gap-4">
          <div className="h-9">
            <Skeleton fill />
          </div>
          <div className="flex flex-wrap items-start gap-4">
            <div className="h-48 min-w-0 flex-1">
              <Skeleton fill />
            </div>
            <div className="h-9 w-32">
              <Skeleton fill />
            </div>
          </div>
          <div className="h-9">
            <Skeleton fill />
          </div>
          <div className="h-64">
            <Skeleton fill />
          </div>
        </div>
      </WorkspaceContent>
    </Workspace>
  );
}

declare module '@tanstack/react-router' {
  // biome-ignore lint/style/useConsistentTypeDefinitions: extending router history requires interface merging.
  interface HistoryState {
    orderBatchChange?: boolean;
  }
}
