import { createFileRoute } from '@tanstack/react-router';
import { NetworkIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
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
import { geographicZonesOptions, programsOptions } from '@/features/reference-data/api/queries';
import { requisitionGroupsSearchOptions } from '@/features/requisition-groups/api/queries';
import {
  RequisitionGroupsListError,
  RequisitionGroupsTable,
  RequisitionGroupsTableSkeleton,
} from '@/features/requisition-groups/components/requisition-groups-table';
import { RequisitionGroupsToolbar } from '@/features/requisition-groups/components/requisition-groups-toolbar';
import {
  REQUISITION_GROUP_HIDEABLE_COLUMNS,
  type RequisitionGroupsListSearch,
  requisitionGroupsSearchSchema,
  toRequisitionGroupsQuery,
} from '@/features/requisition-groups/lib/search';
import { useCardView } from '@/hooks/use-card-view';
import { useSearchNavigation } from '@/hooks/use-search-navigation';

declare module '@tanstack/react-router' {
  // biome-ignore lint/style/useConsistentTypeDefinitions: extending the router's type needs interface merging.
  interface HistoryState {
    requisitionGroupsListSearch?: RequisitionGroupsListSearch;
  }
}

export const Route = createFileRoute('/(protected)/_protected/administration/requisition-groups')({
  validateSearch: requisitionGroupsSearchSchema,
  loaderDeps: ({ search }) => ({ query: toRequisitionGroupsQuery(search) }),
  loader: async ({ context: { queryClient }, deps }) => {
    await requireRight(queryClient, RIGHTS.requisitionGroupsManage);
    queryClient.prefetchQuery(requisitionGroupsSearchOptions(deps.query));
    queryClient.prefetchQuery(geographicZonesOptions());
    queryClient.prefetchQuery(programsOptions());
  },
  pendingComponent: RequisitionGroupsPagePending,
  component: RequisitionGroupsPage,
});

function RequisitionGroupsPage() {
  const search = Route.useSearch();
  const { measure, cards, columnView, layout } = useCardView(
    REQUISITION_GROUP_HIDEABLE_COLUMNS,
    'requisition-groups.column-visibility',
  );
  const { updateSearch } = useSearchNavigation<RequisitionGroupsListSearch>({});

  return (
    <Workspace>
      <RequisitionGroupsHeader />
      <WorkspaceContent>
        <div className="flex flex-col gap-4 lg:gap-6" ref={measure}>
          <RequisitionGroupsToolbar
            columnView={columnView}
            layout={layout}
            onFilterChange={(patch) => updateSearch(patch, true)}
            search={search}
          />
          <QueryBoundary
            errorComponent={({ error, reset }) => (
              <RequisitionGroupsListError error={error} reset={reset} />
            )}
            pendingFallback={
              <RequisitionGroupsTableSkeleton
                cards={cards}
                columnVisibility={columnView.visibility}
                search={search}
              />
            }
            resetKey={JSON.stringify(toRequisitionGroupsQuery(search))}
          >
            <RequisitionGroupsTable
              cards={cards}
              columnVisibility={columnView.visibility}
              onSearchChange={updateSearch}
              search={search}
            />
          </QueryBoundary>
        </div>
      </WorkspaceContent>
    </Workspace>
  );
}

function RequisitionGroupsHeader() {
  const { t } = useTranslation();
  return (
    <WorkspaceHeader>
      <WorkspaceHeading>
        <WorkspaceIcon>
          <NetworkIcon />
        </WorkspaceIcon>
        <WorkspaceTitle>{t('requisition-groups.title')}</WorkspaceTitle>
        <WorkspaceDescription>{t('requisition-groups.page-description')}</WorkspaceDescription>
      </WorkspaceHeading>
    </WorkspaceHeader>
  );
}

function RequisitionGroupsPagePending() {
  const { measure, cards, columnView } = useCardView(
    REQUISITION_GROUP_HIDEABLE_COLUMNS,
    'requisition-groups.column-visibility',
  );
  return (
    <Workspace>
      <RequisitionGroupsHeader />
      <WorkspaceContent>
        <div ref={measure}>
          <RequisitionGroupsTableSkeleton
            cards={cards}
            columnVisibility={columnView.visibility}
            search={{}}
          />
        </div>
      </WorkspaceContent>
    </Workspace>
  );
}
