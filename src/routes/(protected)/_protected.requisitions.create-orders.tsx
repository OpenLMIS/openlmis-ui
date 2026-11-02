import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { ListError } from '@/components/app-shell/list-error';
import { QueryBoundary } from '@/components/app-shell/query-boundary';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Workspace,
  WorkspaceContent,
  WorkspaceDescription,
  WorkspaceHeader,
  WorkspaceHeading,
  WorkspaceTitle,
} from '@/components/workspace/workspace';
import {
  WorkspaceActionsPortal,
  WorkspaceActionsSlot,
  WorkspaceSlots,
} from '@/components/workspace/workspace-tabs';
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
  const { t } = useTranslation();
  return (
    <WorkspaceSlots>
      <Workspace>
        <WorkspaceHeader>
          <WorkspaceHeading>
            <WorkspaceTitle>{t('orders.create.title')}</WorkspaceTitle>
            <WorkspaceDescription>{t('orders.create.description')}</WorkspaceDescription>
          </WorkspaceHeading>
          <WorkspaceActionsSlot />
        </WorkspaceHeader>
        <WorkspaceContent>
          <QueryBoundary
            resetKey="create-orders"
            errorComponent={CreateError}
            pendingFallback={<CreatePending />}
          >
            <Content />
          </QueryBoundary>
        </WorkspaceContent>
      </Workspace>
    </WorkspaceSlots>
  );
}
function CreatePending() {
  const { t } = useTranslation();
  return (
    <>
      <WorkspaceActionsPortal>
        <Button size="lg" disabled>
          {t('orders.create.create')}
        </Button>
      </WorkspaceActionsPortal>
      <div className="h-9">
        <Skeleton fill />
      </div>
      <div className="h-40">
        <Skeleton fill />
      </div>
    </>
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
