import { createFileRoute } from '@tanstack/react-router';
import { BuildingIcon } from 'lucide-react';
import { useCallback } from 'react';
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
import { useSearchNavigation } from '@/hooks/use-search-navigation';
import { useStoredState } from '@/hooks/use-stored-state';

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

const columnChoicesSchema = z.record(z.string(), z.boolean());

function FacilitiesPage() {
  const { t } = useTranslation();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const [measureContent, contentWidth] = useElementWidth<HTMLDivElement>();
  const columnView = useColumnVisibility(
    FACILITY_HIDEABLE_COLUMNS,
    useStoredState('facilities.column-visibility', columnChoicesSchema, {}),
    contentWidth,
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
        <div className="flex flex-col gap-4 @4xl/main:gap-6" ref={measureContent}>
          <FacilitiesToolbar
            columnView={columnView}
            onAdd={addFacility}
            onFilterChange={(patch) => updateSearch(patch, true)}
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
              <FacilitiesTableSkeleton columnVisibility={columnView.visibility} search={search} />
            }
            resetKey={JSON.stringify(query)}
          >
            <FacilitiesTable
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
  return (
    <Workspace>
      <FacilitiesHeader />
      <WorkspaceContent>
        <FacilitiesTableSkeleton columnVisibility={{}} search={{}} />
      </WorkspaceContent>
    </Workspace>
  );
}
