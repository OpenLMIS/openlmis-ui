import { createFileRoute } from '@tanstack/react-router';
import { RouteIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
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
import { supplyLineOptions, supplyLinesPageOptions } from '@/features/supply-lines/api/queries';
import { SupplyLineViewDialog } from '@/features/supply-lines/components/supply-line-view';
import {
  SupplyLinesTable,
  SupplyLinesTableSkeleton,
} from '@/features/supply-lines/components/supply-lines-table';
import { SupplyLinesToolbar } from '@/features/supply-lines/components/supply-lines-toolbar';
import {
  SUPPLY_LINE_HIDEABLE_COLUMNS,
  type SupplyLinesSearch,
  supplyLinesSearchSchema,
  toSupplyLinesQuery,
} from '@/features/supply-lines/lib/search';
import { useCardView } from '@/hooks/use-card-view';
import { useSearchNavigation } from '@/hooks/use-search-navigation';

const usePageCardView = () =>
  useCardView(SUPPLY_LINE_HIDEABLE_COLUMNS, 'supply-lines.column-visibility');

export const Route = createFileRoute('/(protected)/_protected/administration/supply-lines')({
  validateSearch: supplyLinesSearchSchema,
  loaderDeps: ({ search }) => ({
    query: toSupplyLinesQuery(search),
    supplyLine: search.supplyLine,
  }),
  loader: async ({ context: { queryClient }, deps }) => {
    await requireRight(queryClient, RIGHTS.supplyLinesManage);
    queryClient.prefetchQuery(supplyLinesPageOptions(deps.query));
    if (deps.supplyLine && z.guid().safeParse(deps.supplyLine).success) {
      queryClient.prefetchQuery(supplyLineOptions(deps.supplyLine));
    }
  },
  pendingComponent: SupplyLinesPagePending,
  component: SupplyLinesPage,
});

const CLOSED_DIALOGS = { supplyLine: undefined };

function SupplyLinesPage() {
  const { t } = useTranslation();
  const search = Route.useSearch({
    select: ({ supplyLine: _supplyLine, ...listSearch }) => listSearch,
    structuralSharing: true,
  });
  const { measure, cards, columnView, layout } = usePageCardView();
  const query = Route.useLoaderDeps({ select: (deps) => deps.query });
  const { updateSearch } = useSearchNavigation<SupplyLinesSearch>(CLOSED_DIALOGS);

  return (
    <>
      <Workspace>
        <SupplyLinesHeader />
        <WorkspaceContent>
          <div className="flex flex-col gap-4 @4xl/main:gap-6" ref={measure}>
            <SupplyLinesToolbar
              columnView={columnView}
              layout={layout}
              onFilterChange={(patch) => updateSearch(patch, true)}
              onSortChange={updateSearch}
              search={search}
            />
            <QueryBoundary
              errorComponent={({ error, reset }) => (
                <ListError
                  description={t('supply-lines.error-description')}
                  error={error}
                  reset={reset}
                  title={t('supply-lines.error-title')}
                />
              )}
              pendingFallback={
                <SupplyLinesTableSkeleton
                  cards={cards}
                  columnVisibility={columnView.visibility}
                  search={search}
                />
              }
              resetKey={JSON.stringify(query)}
            >
              <SupplyLinesTable
                cards={cards}
                columnVisibility={columnView.visibility}
                onSearchChange={updateSearch}
                search={search}
              />
            </QueryBoundary>
          </div>
        </WorkspaceContent>
      </Workspace>
      <SupplyLineDialog />
    </>
  );
}

function SupplyLineDialog() {
  const target = Route.useSearch({ select: (search) => search.supplyLine });
  const { closeDialog } = useSearchNavigation<SupplyLinesSearch>(CLOSED_DIALOGS);
  return <SupplyLineViewDialog target={target} onClose={closeDialog} />;
}

function SupplyLinesHeader() {
  const { t } = useTranslation();
  return (
    <WorkspaceHeader>
      <WorkspaceHeading>
        <WorkspaceIcon>
          <RouteIcon />
        </WorkspaceIcon>
        <WorkspaceTitle>{t('supply-lines.title')}</WorkspaceTitle>
        <WorkspaceDescription>{t('supply-lines.page-description')}</WorkspaceDescription>
      </WorkspaceHeading>
    </WorkspaceHeader>
  );
}

function SupplyLinesPagePending() {
  const { measure, cards, columnView, layout } = usePageCardView();
  return (
    <Workspace>
      <SupplyLinesHeader />
      <WorkspaceContent>
        <div className="flex flex-col gap-4 @4xl/main:gap-6" ref={measure}>
          <SupplyLinesToolbar
            disabled
            search={{}}
            onFilterChange={() => {}}
            onSortChange={() => {}}
            columnView={columnView}
            layout={layout}
          />
          <SupplyLinesTableSkeleton
            cards={cards}
            columnVisibility={columnView.visibility}
            search={{}}
          />
        </div>
      </WorkspaceContent>
    </Workspace>
  );
}
