import { createFileRoute } from '@tanstack/react-router';
import { BoxesIcon } from 'lucide-react';
import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { useColumnVisibility, useElementWidth } from '@/components/data-table/responsive-columns';
import { ListError } from '@/components/list-error';
import { QueryBoundary } from '@/components/query-boundary';
import {
  Workspace,
  WorkspaceContent,
  WorkspaceDescription,
  WorkspaceHeader,
  WorkspaceHeading,
  WorkspaceIcon,
  WorkspaceTitle,
} from '@/components/workspace';
import { requireRight } from '@/features/auth/lib/access';
import { RIGHTS } from '@/features/auth/lib/rights';
import { lotsListOptions } from '@/features/lots/api/queries';
import { LotsTable, LotsTableSkeleton } from '@/features/lots/components/lots-table';
import { LotsToolbar } from '@/features/lots/components/lots-toolbar';
import {
  LOT_HIDEABLE_COLUMNS,
  type LotsSearch,
  lotsSearchSchema,
  toLotsQuery,
} from '@/features/lots/lib/search';
import { useSearchNavigation } from '@/hooks/use-search-navigation';
import { useStoredState } from '@/hooks/use-stored-state';

const loadDialog = () => import('@/features/lots/components/lot-form-dialog');
const LotFormDialog = lazy(() =>
  loadDialog().then((module) => ({ default: module.LotFormDialog })),
);

const CLOSED_DIALOGS = { lot: undefined } satisfies Partial<LotsSearch>;

const columnChoicesSchema = z.record(z.string(), z.boolean());

export const Route = createFileRoute('/(protected)/_protected/administration/lots')({
  validateSearch: lotsSearchSchema,
  loaderDeps: ({ search }) => ({ query: toLotsQuery(search) }),
  loader: async ({ context: { queryClient }, deps }) => {
    await requireRight(queryClient, RIGHTS.lotsManage);
    queryClient.prefetchQuery(lotsListOptions(deps.query));
  },
  pendingComponent: LotsPagePending,
  component: LotsPage,
});

function LotsPage() {
  const { t } = useTranslation();
  const search = Route.useSearch({
    select: ({ lot: _lot, ...list }): LotsSearch => list,
    structuralSharing: true,
  });
  const lot = Route.useSearch({ select: (search) => search.lot });
  const query = Route.useLoaderDeps({ select: (deps) => deps.query });
  const [measureContent, contentWidth] = useElementWidth<HTMLDivElement>();
  const columnView = useColumnVisibility(
    LOT_HIDEABLE_COLUMNS,
    useStoredState('lots.column-visibility', columnChoicesSchema, {}),
    contentWidth,
  );
  const { updateSearch, openDialog, closeDialog } = useSearchNavigation<LotsSearch>(CLOSED_DIALOGS);
  const editLot = useCallback((id: string) => openDialog({ lot: id }), [openDialog]);
  const [dialogMounted, setDialogMounted] = useState(lot !== undefined);
  if (lot !== undefined && !dialogMounted) setDialogMounted(true);
  useEffect(() => {
    void loadDialog();
  }, []);

  return (
    <Workspace>
      <LotsHeader />
      <WorkspaceContent>
        <div className="flex flex-col gap-4 @4xl/main:gap-6" ref={measureContent}>
          <LotsToolbar
            columnView={columnView}
            onFilterChange={(patch) => updateSearch(patch, true)}
            search={search}
          />
          <QueryBoundary
            errorComponent={({ error, reset }) => (
              <ListError
                description={t('lots.error-description')}
                error={error}
                reset={reset}
                title={t('lots.error-title')}
              />
            )}
            pendingFallback={
              <LotsTableSkeleton columnVisibility={columnView.visibility} search={search} />
            }
            resetKey={JSON.stringify(query)}
          >
            <LotsTable
              columnVisibility={columnView.visibility}
              onEdit={editLot}
              onSearchChange={updateSearch}
              search={search}
            />
          </QueryBoundary>
        </div>
        {dialogMounted && (
          <Suspense fallback={null}>
            <LotFormDialog onClose={closeDialog} target={lot} />
          </Suspense>
        )}
      </WorkspaceContent>
    </Workspace>
  );
}

function LotsHeader() {
  const { t } = useTranslation();
  return (
    <WorkspaceHeader>
      <WorkspaceHeading>
        <WorkspaceIcon>
          <BoxesIcon />
        </WorkspaceIcon>
        <WorkspaceTitle>{t('lots.title')}</WorkspaceTitle>
        <WorkspaceDescription>{t('lots.page-description')}</WorkspaceDescription>
      </WorkspaceHeading>
    </WorkspaceHeader>
  );
}

function LotsPagePending() {
  return (
    <Workspace>
      <LotsHeader />
      <WorkspaceContent>
        <LotsTableSkeleton columnVisibility={{}} search={{}} />
      </WorkspaceContent>
    </Workspace>
  );
}
