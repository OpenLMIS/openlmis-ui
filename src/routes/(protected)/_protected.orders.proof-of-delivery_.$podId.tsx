import { useSuspenseQuery } from '@tanstack/react-query';
import {
  createFileRoute,
  type ErrorComponentProps,
  useNavigate,
  useRouterState,
} from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { QueryBoundary } from '@/components/app-shell/query-boundary';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Workspace,
  WorkspaceContent,
  WorkspaceDescription,
  WorkspaceHeader,
  WorkspaceHeading,
  WorkspaceTitle,
} from '@/components/workspace/workspace';
import { requirePermissions } from '@/features/auth/lib/access';
import {
  podReasonsOptions,
  podReferenceOptions,
  proofOfDeliveryOptions,
} from '@/features/orders/api/queries';
import { OrderHeaderSkeleton } from '@/features/orders/components/order-header';
import { OrdersError } from '@/features/orders/components/orders-error';
import { PodEditor } from '@/features/orders/components/pod-editor';
import { orderReturnTarget } from '@/features/orders/lib/order-return';
import { deploymentTimeZoneOptions } from '@/features/reference-data/api/queries';
import { isNotFound, isRefused } from '@/lib/http';
import { hasProgramGrant } from '@/lib/permissions';
import { RIGHTS } from '@/lib/rights';

export const Route = createFileRoute('/(protected)/_protected/orders/proof-of-delivery_/$podId')({
  loader: async ({ context: { queryClient }, params, cause }) => {
    const [permissions, pod] = await Promise.all([
      requirePermissions(queryClient, [RIGHTS.podsManage, RIGHTS.podsView, RIGHTS.shipmentsEdit]),
      queryClient.fetchQuery({
        ...proofOfDeliveryOptions(params.podId),
        staleTime: cause === 'enter' ? 0 : undefined,
      }),
    ]);
    const refs = podReferenceOptions(pod);
    queryClient.prefetchQuery(refs.products);
    queryClient.prefetchQuery(refs.lots);
    queryClient.prefetchQuery(refs.fulfills);
    queryClient.prefetchQuery(
      podReasonsOptions({
        program: pod.shipment.order.program.id,
        facilityType: pod.shipment.order.facility.type.id,
      }),
    );
    queryClient.prefetchQuery(deploymentTimeZoneOptions());
    return { pod, permissions };
  },
  preload: false,
  pendingComponent: PodPending,
  staticData: { crumbKey: 'orders.pod.detail-title' },
  errorComponent: PodLoadError,
  component: PodPage,
});
function PodPage() {
  const { pod } = Route.useLoaderData();
  return (
    <QueryBoundary errorComponent={PodLoadError} resetKey={pod.id} pendingFallback={<PodPending />}>
      <PodContent />
    </QueryBoundary>
  );
}
function PodContent() {
  const { pod, permissions } = Route.useLoaderData();
  const refs = podReferenceOptions(pod);
  const { data: products } = useSuspenseQuery(refs.products);
  const { data: lots } = useSuspenseQuery(refs.lots);
  const { data: fulfills } = useSuspenseQuery(refs.fulfills);
  const { data: reasons } = useSuspenseQuery(
    podReasonsOptions({
      program: pod.shipment.order.program.id,
      facilityType: pod.shipment.order.facility.type.id,
    }),
  );
  const { data: timeZone } = useSuspenseQuery(deploymentTimeZoneOptions());
  const navigate = useNavigate();
  const state = useRouterState({ select: (router) => router.location.state });
  return (
    <PodEditor
      key={pod.id}
      initial={pod}
      products={products}
      lots={lots}
      fulfills={fulfills}
      reasons={reasons}
      canEdit={hasProgramGrant(
        permissions,
        RIGHTS.podsManage,
        pod.shipment.order.receivingFacility?.id ?? '',
        pod.shipment.order.program.id,
      )}
      timeZone={timeZone.zone}
      onCancel={() =>
        void navigate(orderReturnTarget(state, { to: '/orders/proof-of-delivery', search: {} }))
      }
    />
  );
}

function PodPending() {
  const { t } = useTranslation();
  return (
    <Workspace>
      <WorkspaceHeader>
        <WorkspaceHeading>
          <WorkspaceTitle>{t('orders.pod.detail-title')}</WorkspaceTitle>
          <WorkspaceDescription>{t('orders.pod.detail-description')}</WorkspaceDescription>
        </WorkspaceHeading>
      </WorkspaceHeader>
      <WorkspaceContent>
        <OrderHeaderSkeleton />
      </WorkspaceContent>
    </Workspace>
  );
}

function PodLoadError(props: ErrorComponentProps) {
  const { t } = useTranslation();
  if (!isNotFound(props.error) && !isRefused(props.error)) return <OrdersError {...props} />;
  return (
    <Workspace>
      <WorkspaceHeader>
        <WorkspaceHeading>
          <WorkspaceTitle>{t('orders.pod.detail-title')}</WorkspaceTitle>
          <WorkspaceDescription>{t('orders.pod.detail-description')}</WorkspaceDescription>
        </WorkspaceHeading>
      </WorkspaceHeader>
      <WorkspaceContent>
        <Alert>
          <AlertDescription>
            {t(isNotFound(props.error) ? 'orders.pod.not-found' : 'orders.pod.refused-description')}
          </AlertDescription>
        </Alert>
      </WorkspaceContent>
    </Workspace>
  );
}
