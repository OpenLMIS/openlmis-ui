import { type QueryClient, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, notFound } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Workspace,
  WorkspaceContent,
  WorkspaceDescription,
  WorkspaceFooter,
  WorkspaceHeader,
  WorkspaceHeading,
  WorkspaceTitle,
} from '@/components/workspace/workspace';
import { requirePermissions } from '@/features/auth/lib/access';
import { OrderEditor } from '@/features/orders/components/order-editor';
import { OrderHeaderSkeleton } from '@/features/orders/components/order-header';
import { OrderLinesSkeleton } from '@/features/orders/components/order-lines';
import { orderIds } from '@/features/orders/lib/order-draft';
import { cachedOrders, loadOrders } from '@/features/orders/lib/order-load';
import { deploymentTimeZoneOptions } from '@/features/reference-data/api/queries';
import { randomId } from '@/lib/random-id';
import { RIGHTS } from '@/lib/rights';
import { assertSessionScope, getSessionScope } from '@/lib/session-scope';

const batchChanges = new WeakMap<QueryClient, string>();

export const Route = createFileRoute(
  '/(protected)/_protected/requisitions/create-orders_/$orderIds',
)({
  validateSearch: z.object({ tab: z.string().optional().catch(undefined) }),
  preload: false,
  staticData: { crumbKey: 'orders.edit.crumb' },
  loader: ({ context: { queryClient }, params, cause, location }) => {
    const ids = orderIds(params.orderIds);
    if (!ids.length) throw notFound();
    const batchChange = batchChanges.get(queryClient) === location.state.orderBatchChange;
    batchChanges.delete(queryClient);
    return requirePermissions(queryClient, RIGHTS.orderCreate).then(() => {
      queryClient.prefetchQuery(deploymentTimeZoneOptions());
      if (batchChange && location.state.orderBatchChange) {
        const cached = cachedOrders(queryClient, ids);
        if (cached) return cached;
      }
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
  const queryClient = useQueryClient();
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
      onBatchChange={async (ids) => {
        const scope = getSessionScope();
        const token = randomId();
        batchChanges.set(queryClient, token);
        try {
          await (ids.length
            ? navigate({
                to: '/requisitions/create-orders/$orderIds',
                params: { orderIds: ids.join(',') },
                search: {},
                state: { orderBatchChange: token },
                replace: true,
              })
            : navigate({ to: '/requisitions/create-orders', replace: true }));
          assertSessionScope(scope);
          if (!ids.length) {
            const heading = document.querySelector<HTMLElement>('main h1');
            heading?.setAttribute('tabindex', '-1');
            heading?.focus();
          }
        } finally {
          if (batchChanges.get(queryClient) === token) batchChanges.delete(queryClient);
        }
      }}
    />
  );
}
function Pending() {
  const { t } = useTranslation();
  return (
    <>
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
              <div className="w-full min-w-0 @2xl/main:w-auto @2xl/main:flex-1">
                <OrderHeaderSkeleton />
              </div>
              <div className="h-9 w-32">
                <Skeleton fill />
              </div>
            </div>
            <div className="h-9">
              <Skeleton fill />
            </div>
            <OrderLinesSkeleton />
          </div>
        </WorkspaceContent>
      </Workspace>
      <WorkspaceFooter>
        <div className="flex flex-wrap gap-2">
          {(['cancel', 'delete-batch'] as const).map((key) => (
            <Button key={key} size="lg" variant="outline" disabled>
              {t(`orders.edit.${key}`)}
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {(['save-draft', 'create'] as const).map((key) => (
            <Button key={key} size="lg" disabled>
              {t(`orders.edit.${key}`)}
            </Button>
          ))}
        </div>
      </WorkspaceFooter>
    </>
  );
}

declare module '@tanstack/react-router' {
  // biome-ignore lint/style/useConsistentTypeDefinitions: extending router history requires interface merging.
  interface HistoryState {
    orderBatchChange?: string;
  }
}
