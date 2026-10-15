import { createFileRoute } from '@tanstack/react-router';
import { RouteIcon } from 'lucide-react';
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
import { useSearchNavigation } from '@/hooks/use-search-navigation';
import { useStoredState } from '@/hooks/use-stored-state';

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

const columnChoicesSchema = z.record(z.string(), z.boolean());

function SupplyLinesPage() {
  const { t } = useTranslation();
  const search = Route.useSearch({
    select: ({ supplyLine: _supplyLine, ...listSearch }) => listSearch,
    structuralSharing: true,
  });
  const [measureContent, contentWidth] = useElementWidth<HTMLDivElement>();
  const columnView = useColumnVisibility(
    SUPPLY_LINE_HIDEABLE_COLUMNS,
    useStoredState('supply-lines.column-visibility', columnChoicesSchema, {}),
    contentWidth,
  );
  const query = Route.useLoaderDeps({ select: (deps) => deps.query });
  const { updateSearch } = useSearchNavigation<SupplyLinesSearch>(CLOSED_DIALOGS);

  return (
    <>
      <Workspace>
        <SupplyLinesHeader />
        <WorkspaceContent>
          <div className="flex flex-col gap-4 @4xl/main:gap-6" ref={measureContent}>
            <SupplyLinesToolbar
              columnView={columnView}
              onFilterChange={(patch) => updateSearch(patch, true)}
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
                  columnVisibility={columnView.visibility}
                  search={search}
                />
              }
              resetKey={JSON.stringify(query)}
            >
              <SupplyLinesTable
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
  return (
    <Workspace>
      <SupplyLinesHeader />
      <WorkspaceContent>
        <div className="flex flex-col gap-4 @4xl/main:gap-6">
          <SupplyLinesToolbar
            disabled
            search={{}}
            onFilterChange={() => {}}
            columnView={{ visibility: {}, onReset: () => {}, onVisibilityChange: () => {} }}
          />
          <SupplyLinesTableSkeleton columnVisibility={{}} search={{}} />
        </div>
      </WorkspaceContent>
    </Workspace>
  );
}
