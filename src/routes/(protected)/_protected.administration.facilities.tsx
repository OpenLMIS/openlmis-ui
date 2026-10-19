import { createFileRoute } from '@tanstack/react-router';
import { BuildingIcon } from 'lucide-react';
import { useCallback } from 'react';
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
import { facilitiesListOptions } from '@/features/facilities/api/queries';
import {
  FacilitiesTable,
  FacilitiesTableSkeleton,
} from '@/features/facilities/components/facilities-table';
import { FacilitiesToolbar } from '@/features/facilities/components/facilities-toolbar';
import {
  FACILITY_HIDEABLE_COLUMNS,
  type FacilitiesSearch,
  facilitiesSearchSchema,
  toFacilitiesQuery,
} from '@/features/facilities/lib/search';
import { geographicZonesOptions } from '@/features/reference-data/api/queries';
import { useCardView } from '@/hooks/use-card-view';
import { useSearchNavigation } from '@/hooks/use-search-navigation';

declare module '@tanstack/react-router' {
  // biome-ignore lint/style/useConsistentTypeDefinitions: extending the router's type needs interface merging.
  interface HistoryState {
    facilitiesListSearch?: FacilitiesSearch;
  }
}

export const Route = createFileRoute('/(protected)/_protected/administration/facilities')({
  validateSearch: facilitiesSearchSchema,
  loaderDeps: ({ search }) => ({ query: toFacilitiesQuery(search) }),
  loader: async ({ context: { queryClient }, deps }) => {
    await requireRight(queryClient, RIGHTS.facilitiesManage);
    queryClient.prefetchQuery(facilitiesListOptions(deps.query));
    queryClient.prefetchQuery(geographicZonesOptions());
  },
  pendingComponent: FacilitiesPagePending,
  component: FacilitiesPage,
});

function FacilitiesPage() {
  const { t } = useTranslation();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const { measure, cards, columnView, layout } = useCardView(
    FACILITY_HIDEABLE_COLUMNS,
    'facilities.column-visibility',
  );
  const query = Route.useLoaderDeps({ select: (deps) => deps.query });
  const { updateSearch } = useSearchNavigation<FacilitiesSearch>({});
  const addFacility = useCallback(
    () =>
      navigate({ to: '/administration/facilities/new', state: { facilitiesListSearch: search } }),
    [navigate, search],
  );

  return (
    <Workspace>
      <FacilitiesHeader />
      <WorkspaceContent>
        <div className="flex flex-col gap-4 @4xl/main:gap-6" ref={measure}>
          <FacilitiesToolbar
            columnView={columnView}
            layout={layout}
            onAdd={addFacility}
            onFilterChange={(patch) => updateSearch(patch, true)}
            onSortChange={updateSearch}
            search={search}
          />
          <QueryBoundary
            errorComponent={({ error, reset }) => (
              <ListError
                description={t('facilities.error-description')}
                error={error}
                reset={reset}
                title={t('facilities.error-title')}
              />
            )}
            pendingFallback={
              <FacilitiesTableSkeleton
                cards={cards}
                columnVisibility={columnView.visibility}
                search={search}
              />
            }
            resetKey={JSON.stringify(query)}
          >
            <FacilitiesTable
              cards={cards}
              columnVisibility={columnView.visibility}
              onAdd={addFacility}
              onSearchChange={updateSearch}
              search={search}
            />
          </QueryBoundary>
        </div>
      </WorkspaceContent>
    </Workspace>
  );
}

function FacilitiesHeader() {
  const { t } = useTranslation();
  return (
    <WorkspaceHeader>
      <WorkspaceHeading>
        <WorkspaceIcon>
          <BuildingIcon />
        </WorkspaceIcon>
        <WorkspaceTitle>{t('facilities.title')}</WorkspaceTitle>
        <WorkspaceDescription>{t('facilities.page-description')}</WorkspaceDescription>
      </WorkspaceHeading>
    </WorkspaceHeader>
  );
}

function FacilitiesPagePending() {
  const { measure, cards, columnView } = useCardView(
    FACILITY_HIDEABLE_COLUMNS,
    'facilities.column-visibility',
  );
  return (
    <Workspace>
      <FacilitiesHeader />
      <WorkspaceContent>
        <div ref={measure}>
          <FacilitiesTableSkeleton
            cards={cards}
            columnVisibility={columnView.visibility}
            search={{}}
          />
        </div>
      </WorkspaceContent>
    </Workspace>
  );
}
