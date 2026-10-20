import { createFileRoute } from '@tanstack/react-router';
import { NetworkIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
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
import { geographicZonesOptions } from '@/features/reference-data/api/queries';
import { supervisoryNodesPageOptions } from '@/features/supervisory-nodes/api/queries';
import {
  SupervisoryNodesTable,
  SupervisoryNodesTableSkeleton,
} from '@/features/supervisory-nodes/components/supervisory-nodes-table';
import { SupervisoryNodesToolbar } from '@/features/supervisory-nodes/components/supervisory-nodes-toolbar';
import {
  SUPERVISORY_NODE_HIDEABLE_COLUMNS,
  type SupervisoryNodesSearch,
  supervisoryNodesSearchSchema,
  toSupervisoryNodesQuery,
} from '@/features/supervisory-nodes/lib/search';
import { useCardView } from '@/hooks/use-card-view';
import { useSearchNavigation } from '@/hooks/use-search-navigation';

declare module '@tanstack/react-router' {
  // biome-ignore lint/style/useConsistentTypeDefinitions: extending the router's type needs interface merging.
  interface HistoryState {
    supervisoryNodesListSearch?: SupervisoryNodesSearch;
  }
}

const usePageCardView = () =>
  useCardView(SUPERVISORY_NODE_HIDEABLE_COLUMNS, 'supervisory-nodes.column-visibility');

export const Route = createFileRoute('/(protected)/_protected/administration/supervisory-nodes')({
  validateSearch: supervisoryNodesSearchSchema,
  loaderDeps: ({ search }) => ({ query: toSupervisoryNodesQuery(search) }),
  loader: async ({ context: { queryClient }, deps }) => {
    await requireRight(queryClient, RIGHTS.supervisoryNodesManage);
    queryClient.prefetchQuery(supervisoryNodesPageOptions(deps.query));
    queryClient.prefetchQuery(geographicZonesOptions());
  },
  pendingComponent: SupervisoryNodesPagePending,
  component: SupervisoryNodesPage,
});

function SupervisoryNodesPage() {
  const { t } = useTranslation();
  const search = Route.useSearch();
  const { measure, cards, columnView, layout } = usePageCardView();
  const query = Route.useLoaderDeps({ select: (deps) => deps.query });
  const { updateSearch } = useSearchNavigation<SupervisoryNodesSearch>({});

  return (
    <Workspace width="large">
      <SupervisoryNodesHeader />
      <WorkspaceContent>
        <div className="flex flex-col gap-4 @4xl/main:gap-6" ref={measure}>
          <SupervisoryNodesToolbar
            columnView={columnView}
            layout={layout}
            onFilterChange={(patch) => updateSearch(patch, true)}
            search={search}
          />
          <QueryBoundary
            errorComponent={({ error, reset }) => (
              <ListError
                description={t('supervisory-nodes.error-description')}
                error={error}
                reset={reset}
                title={t('supervisory-nodes.error-title')}
              />
            )}
            pendingFallback={
              <SupervisoryNodesTableSkeleton
                cards={cards}
                columnVisibility={columnView.visibility}
                search={search}
              />
            }
            resetKey={JSON.stringify(query)}
          >
            <SupervisoryNodesTable
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

function SupervisoryNodesHeader() {
  const { t } = useTranslation();
  return (
    <WorkspaceHeader>
      <WorkspaceHeading>
        <WorkspaceIcon>
          <NetworkIcon />
        </WorkspaceIcon>
        <WorkspaceTitle>{t('supervisory-nodes.title')}</WorkspaceTitle>
        <WorkspaceDescription>{t('supervisory-nodes.page-description')}</WorkspaceDescription>
      </WorkspaceHeading>
    </WorkspaceHeader>
  );
}

function SupervisoryNodesPagePending() {
  const { measure, cards, columnView } = usePageCardView();
  return (
    <Workspace width="large">
      <SupervisoryNodesHeader />
      <WorkspaceContent>
        <div ref={measure}>
          <SupervisoryNodesTableSkeleton
            cards={cards}
            columnVisibility={columnView.visibility}
            search={{}}
          />
        </div>
      </WorkspaceContent>
    </Workspace>
  );
}
