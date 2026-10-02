import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, getRouteApi } from '@tanstack/react-router';
import { PlusIcon } from 'lucide-react';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { DataTableToolbar } from '@/components/data-table/data-table';
import { DataTableViewOptions } from '@/components/data-table/data-table-view-options';
import { useColumnVisibility, useElementWidth } from '@/components/data-table/responsive-columns';
import { LoadError } from '@/components/load-error';
import { QueryBoundary } from '@/components/query-boundary';
import { Button } from '@/components/ui/button';
import { WorkspaceFooterPortal } from '@/components/workspace-tabs';
import { productApprovalsOptions, productDetailOptions } from '@/features/products/api/queries';
import { ApprovalDialog } from '@/features/products/components/approval-dialog';
import {
  ApprovalsTable,
  ApprovalsTableSkeleton,
} from '@/features/products/components/approvals-table';
import { RemoveApprovalDialog } from '@/features/products/components/remove-approval-dialog';
import { useBackToProducts } from '@/features/products/hooks/back-to-products';
import {
  APPROVAL_HIDEABLE_COLUMNS,
  type ApprovalsSearch,
  approvalsSearchSchema,
  CLOSED_APPROVAL_DIALOGS,
} from '@/features/products/lib/approvals';
import { facilityTypesOptions, programsOptions } from '@/features/reference-data/api/queries';
import { useSearchNavigation } from '@/hooks/use-search-navigation';
import { useStoredState } from '@/hooks/use-stored-state';

const productRoute = getRouteApi('/(protected)/_protected/administration/products_/$id');

export const Route = createFileRoute(
  '/(protected)/_protected/administration/products_/$id/facility-types',
)({
  validateSearch: approvalsSearchSchema,
  staticData: { crumbKey: 'products.edit.crumb' },
  loader: ({ context: { queryClient }, params }) => {
    queryClient.prefetchQuery(productApprovalsOptions(params.id));
    queryClient.prefetchQuery(facilityTypesOptions());
    queryClient.prefetchQuery(programsOptions());
  },
  component: FacilityTypesTab,
});

const columnChoicesSchema = z.record(z.string(), z.boolean());

function FacilityTypesTab() {
  const { t } = useTranslation();
  const { id } = Route.useParams();
  const { canEditApprovals } = productRoute.useLoaderData();
  const { data: product } = useSuspenseQuery(productDetailOptions(id));
  const search = Route.useSearch();
  const [measureContent, contentWidth] = useElementWidth<HTMLDivElement>();
  const columnView = useColumnVisibility(
    APPROVAL_HIDEABLE_COLUMNS,
    useStoredState('products.approvals.column-visibility', columnChoicesSchema, {}),
    contentWidth,
  );
  const { openDialog, closeDialog } = useSearchNavigation<ApprovalsSearch>(CLOSED_APPROVAL_DIALOGS);
  const onEdit = useCallback(
    (approvalId: string) => openDialog({ approval: approvalId }),
    [openDialog],
  );
  const onRemove = useCallback(
    (approvalId: string) => openDialog({ remove: approvalId }),
    [openDialog],
  );

  const backToProducts = useBackToProducts();

  return (
    <div className="flex flex-col gap-4" ref={measureContent}>
      <WorkspaceFooterPortal width="default">
        <Button onClick={backToProducts} size="lg" variant="outline">
          {t('products.edit.back')}
        </Button>
      </WorkspaceFooterPortal>
      <DataTableToolbar>
        <div className="@2xl/main:ms-auto">
          <DataTableViewOptions
            columns={APPROVAL_HIDEABLE_COLUMNS.map(({ id: column, labelKey }) => ({
              id: column,
              label: t(labelKey),
            }))}
            onReset={columnView.onReset}
            onVisibilityChange={columnView.onVisibilityChange}
            visibility={columnView.visibility}
          />
        </div>
        {canEditApprovals && (
          <div className="w-full @2xl/main:w-auto">
            <Button onClick={() => openDialog({ approval: 'new' })} width="full">
              <PlusIcon data-icon="inline-start" />
              {t('products.approvals.add')}
            </Button>
          </div>
        )}
      </DataTableToolbar>
      <QueryBoundary
        errorComponent={({ error, reset }) => (
          <LoadError
            description={t('products.approvals.error-description')}
            error={error}
            reset={reset}
            title={t('products.approvals.error-title')}
          />
        )}
        pendingFallback={<ApprovalsTableSkeleton columnVisibility={columnView.visibility} />}
        resetKey="approvals"
      >
        <ApprovalsTable
          canEdit={canEditApprovals}
          columnVisibility={columnView.visibility}
          onEdit={onEdit}
          onRemove={onRemove}
          productId={id}
        />
      </QueryBoundary>
      <ApprovalDialog
        onClose={closeDialog}
        product={product}
        readOnly={!canEditApprovals}
        target={canEditApprovals || search.approval !== 'new' ? search.approval : undefined}
      />
      <RemoveApprovalDialog
        approvalId={canEditApprovals ? search.remove : undefined}
        onClose={closeDialog}
        product={product}
      />
    </div>
  );
}
