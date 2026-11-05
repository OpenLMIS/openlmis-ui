import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, type ErrorComponentProps } from '@tanstack/react-router';
import { useTable } from '@tanstack/react-table';
import { useTranslation } from 'react-i18next';
import { ListError } from '@/components/app-shell/list-error';
import { QueryBoundary } from '@/components/app-shell/query-boundary';
import { DataTableSkeleton, dataTableFeatures } from '@/components/data-table/data-table';
import { TableCardsSkeleton } from '@/components/display/table-cards';
import { Button } from '@/components/ui/button';
import { Field, FieldLabel } from '@/components/ui/field';
import { Separator } from '@/components/ui/separator';
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
import { useCardLayout } from '@/hooks/use-card-view';
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
  const { measure, cards } = useCardLayout<HTMLDivElement>();
  const table = useTable({
    features: dataTableFeatures,
    data: [],
    columns: [
      {
        id: 'name',
        header: t('orders.create.facility'),
        meta: { label: t('orders.create.facility') },
      },
      { id: 'actions', header: t('orders.edit.actions'), meta: { skeleton: 'control' } },
    ],
  });
  return (
    <>
      <WorkspaceActionsPortal>
        <Button size="lg" disabled>
          {t('orders.create.create')}
        </Button>
      </WorkspaceActionsPortal>
      <div className="min-w-0 @3xl/main:max-w-96">
        <Field>
          <FieldLabel>{t('orders.create.program')}</FieldLabel>
          <div className="h-9">
            <Skeleton fill />
          </div>
        </Field>
      </div>
      <div className="flex items-center gap-2 @3xl/main:max-w-xl">
        <div className="h-9 min-w-0 flex-1">
          <Skeleton fill />
        </div>
        <Button size="lg" disabled>
          {t('orders.add')}
        </Button>
      </div>
      <Separator />
      <div ref={measure}>
        {cards ? (
          <TableCardsSkeleton table={table} title="name" rowCount={1} pagination={false} />
        ) : (
          <DataTableSkeleton table={table} rowCount={1} pagination="none" />
        )}
      </div>
      <div className="min-w-0 @3xl/main:max-w-96">
        <Field>
          <FieldLabel>{t('orders.create.supplying-facility')}</FieldLabel>
          <div className="h-9">
            <Skeleton fill />
          </div>
        </Field>
      </div>
    </>
  );
}

function Content() {
  const { userId } = Route.useLoaderData();
  const navigate = Route.useNavigate();
  const { data: permissions } = useSuspenseQuery(permissionsOptions(userId));
  const { data: facilities = [], isPending } = useQuery(minimalFacilitiesOptions());
  return (
    <CreateOrderForm
      userId={userId}
      facilitiesPending={isPending}
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

function CreateError(props: ErrorComponentProps) {
  const { t } = useTranslation();
  return (
    <ListError
      {...props}
      title={t('orders.create.title')}
      description={t('orders.create.description')}
    />
  );
}
