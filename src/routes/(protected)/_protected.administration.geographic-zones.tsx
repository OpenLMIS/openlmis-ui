import { createFileRoute } from '@tanstack/react-router';
import { MapPinIcon } from 'lucide-react';
import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { serverMessage } from '@/components/dialog-parts';
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
import { geographicZonesListOptions } from '@/features/geographic-zones/api/queries';
import {
  GeographicZonesTable,
  GeographicZonesTableSkeleton,
} from '@/features/geographic-zones/components/geographic-zones-table';
import { GeographicZonesToolbar } from '@/features/geographic-zones/components/geographic-zones-toolbar';
import {
  GEOGRAPHIC_ZONE_HIDEABLE_COLUMNS,
  type GeographicZonesSearch,
  geographicZonesSearchSchema,
  toGeographicZonesQuery,
} from '@/features/geographic-zones/lib/search';
import {
  geographicLevelsOptions,
  geographicZonesOptions,
} from '@/features/reference-data/api/queries';
import { useCardView } from '@/hooks/use-card-view';
import { useSearchNavigation } from '@/hooks/use-search-navigation';
import { useFlag } from '@/lib/feature-flags';

const loadDialogs = () =>
  Promise.all([
    import('@/features/geographic-zones/components/geographic-zone-form-dialog'),
    import('@/features/geographic-zones/components/geographic-zone-population-dialog'),
  ]);
const GeographicZoneFormDialog = lazy(() =>
  loadDialogs().then(([module]) => ({ default: module.GeographicZoneFormDialog })),
);
const GeographicZonePopulationDialog = lazy(() =>
  loadDialogs().then(([, module]) => ({ default: module.GeographicZonePopulationDialog })),
);

const usePageCardView = () =>
  useCardView(GEOGRAPHIC_ZONE_HIDEABLE_COLUMNS, 'geographic-zones.column-visibility');

export const Route = createFileRoute('/(protected)/_protected/administration/geographic-zones')({
  validateSearch: geographicZonesSearchSchema,
  loaderDeps: ({ search }) => ({ query: toGeographicZonesQuery(search) }),
  loader: async ({ context: { queryClient }, deps }) => {
    await requireRight(queryClient, RIGHTS.geographicZonesManage);
    queryClient.prefetchQuery(geographicZonesListOptions(deps.query));
    queryClient.prefetchQuery(geographicLevelsOptions());
    queryClient.prefetchQuery(geographicZonesOptions());
  },
  pendingComponent: GeographicZonesPagePending,
  component: GeographicZonesPage,
});

const CLOSED_DIALOGS = {
  zone: undefined,
  population: undefined,
} satisfies Partial<GeographicZonesSearch>;
function GeographicZonesPage() {
  const { t } = useTranslation();
  const search = Route.useSearch({
    select: ({ zone: _zone, population: _population, ...list }): GeographicZonesSearch => list,
    structuralSharing: true,
  });
  const automatic = useFlag('CATCHMENT_POPULATION_CALC_AUTO');
  const zone = Route.useSearch({ select: (search) => search.zone });
  const population = Route.useSearch({
    select: (search) => (search.zone ? undefined : search.population),
  });
  const { measure, cards, columnView, layout } = usePageCardView();
  const { updateSearch, openDialog, closeDialog } =
    useSearchNavigation<GeographicZonesSearch>(CLOSED_DIALOGS);
  const showDetail = useCallback((id: string) => openDialog({ zone: id }), [openDialog]);
  const showPopulation = useCallback((id: string) => openDialog({ population: id }), [openDialog]);
  const query = Route.useLoaderDeps({ select: (deps) => deps.query });
  const [dialogsMounted, setDialogsMounted] = useState(
    zone !== undefined || population !== undefined,
  );
  if ((zone !== undefined || population !== undefined) && !dialogsMounted) setDialogsMounted(true);
  useEffect(() => {
    void loadDialogs();
  }, []);

  return (
    <Workspace>
      <GeographicZonesHeader />
      <WorkspaceContent>
        <div className="flex flex-col gap-4 @4xl/main:gap-6" ref={measure}>
          <GeographicZonesToolbar
            layout={layout}
            columnView={columnView}
            onFilterChange={(patch) => updateSearch(patch, true)}
            search={search}
          />
          <QueryBoundary
            errorComponent={({ error, reset }) => (
              <ListError
                description={serverMessage(error) ?? t('geographic-zones.error-description')}
                error={error}
                reset={reset}
                title={t('geographic-zones.error-title')}
              />
            )}
            pendingFallback={
              <GeographicZonesTableSkeleton
                cards={cards}
                columnVisibility={columnView.visibility}
                search={search}
              />
            }
            resetKey={JSON.stringify(query)}
          >
            <GeographicZonesTable
              cards={cards}
              automatic={automatic}
              columnVisibility={columnView.visibility}
              onDetail={showDetail}
              onPopulation={showPopulation}
              onSearchChange={updateSearch}
              search={search}
            />
          </QueryBoundary>
        </div>
        {dialogsMounted && (
          <Suspense fallback={null}>
            <GeographicZoneFormDialog automatic={automatic} onClose={closeDialog} target={zone} />
            <GeographicZonePopulationDialog onClose={closeDialog} target={population} />
          </Suspense>
        )}
      </WorkspaceContent>
    </Workspace>
  );
}

function GeographicZonesHeader() {
  const { t } = useTranslation();
  return (
    <WorkspaceHeader>
      <WorkspaceHeading>
        <WorkspaceIcon>
          <MapPinIcon />
        </WorkspaceIcon>
        <WorkspaceTitle>{t('geographic-zones.title')}</WorkspaceTitle>
        <WorkspaceDescription>{t('geographic-zones.description')}</WorkspaceDescription>
      </WorkspaceHeading>
    </WorkspaceHeader>
  );
}

function GeographicZonesPagePending() {
  const { measure, cards, columnView } = usePageCardView();
  return (
    <Workspace>
      <GeographicZonesHeader />
      <WorkspaceContent>
        <div ref={measure}>
          <GeographicZonesTableSkeleton
            cards={cards}
            columnVisibility={columnView.visibility}
            search={{}}
          />
        </div>
      </WorkspaceContent>
    </Workspace>
  );
}
