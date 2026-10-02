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
import { productDetailOptions } from '@/features/products/api/queries';
import { ProgramLinkDialog } from '@/features/products/components/program-link-dialog';
import {
  ProgramLinksTable,
  ProgramLinksTableSkeleton,
} from '@/features/products/components/program-links-table';
import { RemoveProgramLinkDialog } from '@/features/products/components/remove-program-link-dialog';
import { useBackToProducts } from '@/features/products/hooks/back-to-products';
import {
  CLOSED_PROGRAM_DIALOGS,
  PROGRAM_LINK_HIDEABLE_COLUMNS,
  type ProgramLinksSearch,
  programLinksSearchSchema,
} from '@/features/products/lib/program-links';
import {
  orderableDisplayCategoriesOptions,
  programsOptions,
} from '@/features/reference-data/api/queries';
import { useSearchNavigation } from '@/hooks/use-search-navigation';
import { useStoredState } from '@/hooks/use-stored-state';

const productRoute = getRouteApi('/(protected)/_protected/administration/products_/$id');

export const Route = createFileRoute(
  '/(protected)/_protected/administration/products_/$id/programs',
)({
  validateSearch: programLinksSearchSchema,
  staticData: { crumbKey: 'products.edit.crumb' },
  loader: ({ context: { queryClient } }) => {
    queryClient.prefetchQuery(programsOptions());
    queryClient.prefetchQuery(orderableDisplayCategoriesOptions());
  },
  component: ProgramsTab,
});

const columnChoicesSchema = z.record(z.string(), z.boolean());

function ProgramsTab() {
  const { t } = useTranslation();
  const { id } = Route.useParams();
  const { canEditProduct } = productRoute.useLoaderData();
  const { data: product } = useSuspenseQuery(productDetailOptions(id));
  const search = Route.useSearch();
  const [measureContent, contentWidth] = useElementWidth<HTMLDivElement>();
  const columnView = useColumnVisibility(
    PROGRAM_LINK_HIDEABLE_COLUMNS,
    useStoredState('products.programs.column-visibility', columnChoicesSchema, {}),
    contentWidth,
  );
  const { openDialog, closeDialog } =
    useSearchNavigation<ProgramLinksSearch>(CLOSED_PROGRAM_DIALOGS);
  const onEdit = useCallback(
    (programId: string) => openDialog({ program: programId }),
    [openDialog],
  );
  const onRemove = useCallback(
    (programId: string) => openDialog({ remove: programId }),
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
            columns={PROGRAM_LINK_HIDEABLE_COLUMNS.map(({ id: column, labelKey }) => ({
              id: column,
              label: t(labelKey),
            }))}
            onReset={columnView.onReset}
            onVisibilityChange={columnView.onVisibilityChange}
            visibility={columnView.visibility}
          />
        </div>
        {canEditProduct && (
          <div className="w-full @2xl/main:w-auto">
            <Button onClick={() => openDialog({ program: 'new' })} width="full">
              <PlusIcon data-icon="inline-start" />
              {t('products.programs.add')}
            </Button>
          </div>
        )}
      </DataTableToolbar>
      <QueryBoundary
        errorComponent={({ error, reset }) => (
          <LoadError
            description={t('products.programs.error-description')}
            error={error}
            reset={reset}
            title={t('products.programs.error-title')}
          />
        )}
        pendingFallback={<ProgramLinksTableSkeleton columnVisibility={columnView.visibility} />}
        resetKey="program-links"
      >
        <ProgramLinksTable
          canEdit={canEditProduct}
          columnVisibility={columnView.visibility}
          onEdit={onEdit}
          onRemove={onRemove}
          product={product}
        />
      </QueryBoundary>
      <ProgramLinkDialog
        onClose={closeDialog}
        product={product}
        readOnly={!canEditProduct}
        target={canEditProduct || search.program !== 'new' ? search.program : undefined}
      />
      <RemoveProgramLinkDialog
        onClose={closeDialog}
        product={product}
        programId={canEditProduct ? search.remove : undefined}
      />
    </div>
  );
}
