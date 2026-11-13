import { useSuspenseQuery } from '@tanstack/react-query';
import {
  createFileRoute,
  type ErrorComponentProps,
  Link,
  useNavigate,
  useRouterState,
} from '@tanstack/react-router';
import { ClipboardCheckIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ErrorFallback } from '@/components/app-shell/error-fallback';
import { QueryBoundary } from '@/components/app-shell/query-boundary';
import {
  RecordSummary,
  RecordSummaryFieldSkeleton,
  RecordSummaryFields,
  RecordSummaryHeading,
} from '@/components/display/record-summary';
import { SettingsItem, SettingsList } from '@/components/form/settings-list';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Workspace,
  WorkspaceActions,
  WorkspaceContent,
  WorkspaceDescription,
  WorkspaceHeader,
  WorkspaceHeading,
  WorkspaceIcon,
  WorkspaceTitle,
} from '@/components/workspace/workspace';
import { requirePermissions } from '@/features/auth/lib/access';
import {
  podReasonsOptions,
  podReferenceOptions,
  proofOfDeliveryOptions,
} from '@/features/orders/api/queries';
import { PodEditor } from '@/features/orders/components/pod-editor';
import { PodGridSkeleton } from '@/features/orders/components/pod-grid';
import { orderReturnTarget } from '@/features/orders/lib/order-return';
import { deploymentTimeZoneOptions } from '@/features/reference-data/api/queries';
import { isNotFound } from '@/lib/http';
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
    <Workspace width="large">
      <WorkspaceHeader>
        <WorkspaceHeading>
          <WorkspaceIcon>
            <ClipboardCheckIcon />
          </WorkspaceIcon>
          <WorkspaceTitle>
            <span className="block h-5 w-72">
              <Skeleton fill inline />
            </span>
          </WorkspaceTitle>
          <WorkspaceDescription>{t('orders.pod.detail-description')}</WorkspaceDescription>
        </WorkspaceHeading>
        <WorkspaceActions>
          <div className="h-9 w-24">
            <Skeleton fill />
          </div>
        </WorkspaceActions>
      </WorkspaceHeader>
      <WorkspaceContent>
        <div className="flex flex-col gap-4">
          <RecordSummary aria-busy>
            <RecordSummaryHeading>
              <span className="font-normal text-muted-foreground text-xs">
                {t('orders.pod.columns.order-code')}
              </span>
              <div className="h-5 w-40">
                <Skeleton fill />
              </div>
            </RecordSummaryHeading>
            <RecordSummaryFields>
              {(
                [
                  'columns.status',
                  'ordering-facility',
                  'columns.created-date',
                  'reporting-period',
                  'supplying-facility',
                  'columns.emergency',
                ] as const
              ).map((key) => (
                <RecordSummaryFieldSkeleton key={key} label={t(`orders.pod.${key}`)} />
              ))}
            </RecordSummaryFields>
          </RecordSummary>
          <PodGridSkeleton />
          <div className="ms-auto w-full max-w-2xl">
            <SettingsList>
              {(['delivered-by', 'received-by', 'received-date'] as const).map((key) => (
                <SettingsItem key={key} label={t(`orders.pod.${key}`)}>
                  <div className="h-8 w-80 max-w-full">
                    <Skeleton fill />
                  </div>
                </SettingsItem>
              ))}
            </SettingsList>
          </div>
        </div>
      </WorkspaceContent>
    </Workspace>
  );
}

function PodLoadError(props: ErrorComponentProps) {
  const { t } = useTranslation();
  if (!isNotFound(props.error))
    return (
      <ErrorFallback
        {...props}
        title={t('orders.pod.load-error-title')}
        description={t('error.description')}
        back={
          <Button
            nativeButton={false}
            render={<Link to="/orders/proof-of-delivery" search={{}} />}
            size="lg"
          >
            {t('orders.pod.title')}
          </Button>
        }
      />
    );
  return (
    <Workspace width="large">
      <WorkspaceHeader>
        <WorkspaceHeading>
          <WorkspaceIcon>
            <ClipboardCheckIcon />
          </WorkspaceIcon>
          <WorkspaceTitle>{t('orders.pod.detail-title')}</WorkspaceTitle>
          <WorkspaceDescription>{t('orders.pod.detail-description')}</WorkspaceDescription>
        </WorkspaceHeading>
      </WorkspaceHeader>
      <WorkspaceContent>
        <Alert>
          <AlertDescription>{t('orders.pod.not-found')}</AlertDescription>
        </Alert>
      </WorkspaceContent>
    </Workspace>
  );
}
