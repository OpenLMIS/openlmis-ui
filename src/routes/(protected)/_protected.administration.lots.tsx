import { createFileRoute } from '@tanstack/react-router';
import { BoxesIcon } from 'lucide-react';
import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ListError } from '@/components/app-shell/list-error';
import { QueryBoundary } from '@/components/app-shell/query-boundary';
import {
  Workspace,
  WorkspaceContent,
  WorkspaceDescription,
  WorkspaceHeader,
  WorkspaceHeading,
  WorkspaceIcon,
  WorkspaceTitle,
} from '@/components/workspace/workspace';
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
import { useCardView } from '@/hooks/use-card-view';
import { useSearchNavigation } from '@/hooks/use-search-navigation';

const loadDialog = () => import('@/features/lots/components/lot-form-dialog');
const LotFormDialog = lazy(() =>
  loadDialog().then((module) => ({ default: module.LotFormDialog })),
);

const CLOSED_DIALOGS = { lot: undefined } satisfies Partial<LotsSearch>;

const usePageCardView = () => useCardView(LOT_HIDEABLE_COLUMNS, 'lots.column-visibility');

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
  const { measure, cards, columnView, layout } = usePageCardView();
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
        <div className="flex flex-col gap-4 @4xl/main:gap-6" ref={measure}>
          <LotsToolbar
            columnView={columnView}
            layout={layout}
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
              <LotsTableSkeleton
                cards={cards}
                columnVisibility={columnView.visibility}
                search={search}
              />
            }
            resetKey={JSON.stringify(query)}
          >
            <LotsTable
              cards={cards}
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
  const { measure, cards, columnView } = usePageCardView();
  return (
    <Workspace>
      <LotsHeader />
      <WorkspaceContent>
        <div ref={measure}>
          <LotsTableSkeleton cards={cards} columnVisibility={columnView.visibility} search={{}} />
        </div>
      </WorkspaceContent>
    </Workspace>
  );
}
