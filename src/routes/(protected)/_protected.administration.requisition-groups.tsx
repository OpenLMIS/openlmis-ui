import { createFileRoute } from '@tanstack/react-router';
import { NetworkIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { useColumnVisibility, useElementWidth } from '@/components/data-table/responsive-columns';
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
import { useSearchNavigation } from '@/hooks/use-search-navigation';
import { useStoredState } from '@/hooks/use-stored-state';

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

const columnChoicesSchema = z.record(z.string(), z.boolean());

function RequisitionGroupsPage() {
  const search = Route.useSearch();
  const [measureContent, contentWidth] = useElementWidth<HTMLDivElement>();
  const columnView = useColumnVisibility(
    REQUISITION_GROUP_HIDEABLE_COLUMNS,
    useStoredState('requisition-groups.column-visibility', columnChoicesSchema, {}),
    contentWidth,
  );
  const { updateSearch } = useSearchNavigation<RequisitionGroupsListSearch>({});

  return (
    <Workspace>
      <RequisitionGroupsHeader />
      <WorkspaceContent>
        <div className="flex flex-col gap-4 lg:gap-6" ref={measureContent}>
          <RequisitionGroupsToolbar
            columnView={columnView}
            onFilterChange={(patch) => updateSearch(patch, true)}
            search={search}
          />
          <QueryBoundary
            errorComponent={({ error, reset }) => (
              <RequisitionGroupsListError error={error} reset={reset} />
            )}
            pendingFallback={
              <RequisitionGroupsTableSkeleton
                columnVisibility={columnView.visibility}
                search={search}
              />
            }
            resetKey={JSON.stringify(toRequisitionGroupsQuery(search))}
          >
            <RequisitionGroupsTable
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
  return (
    <Workspace>
      <RequisitionGroupsHeader />
      <WorkspaceContent>
        <RequisitionGroupsTableSkeleton columnVisibility={{}} search={{}} />
      </WorkspaceContent>
    </Workspace>
  );
}
