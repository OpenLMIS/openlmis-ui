import { createFileRoute } from '@tanstack/react-router';
import { MapPinIcon } from 'lucide-react';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { useColumnVisibility, useElementWidth } from '@/components/data-table/responsive-columns';
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
import { useSearchNavigation } from '@/hooks/use-search-navigation';
import { useStoredState } from '@/hooks/use-stored-state';
import { useFlag } from '@/lib/feature-flags';

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
const columnChoicesSchema = z.record(z.string(), z.boolean());

function GeographicZonesPage() {
  const { t } = useTranslation();
  const search = Route.useSearch({
    select: ({ zone: _zone, population: _population, ...list }): GeographicZonesSearch => list,
    structuralSharing: true,
  });
  const automatic = useFlag('CATCHMENT_POPULATION_CALC_AUTO');
  const [measureContent, contentWidth] = useElementWidth<HTMLDivElement>();
  const columnView = useColumnVisibility(
    GEOGRAPHIC_ZONE_HIDEABLE_COLUMNS,
    useStoredState('geographic-zones.column-visibility', columnChoicesSchema, {}),
    contentWidth,
  );
  const { updateSearch, openDialog } = useSearchNavigation<GeographicZonesSearch>(CLOSED_DIALOGS);
  const showDetail = useCallback((id: string) => openDialog({ zone: id }), [openDialog]);
  const showPopulation = useCallback((id: string) => openDialog({ population: id }), [openDialog]);
  const query = Route.useLoaderDeps({ select: (deps) => deps.query });

  return (
    <Workspace>
      <GeographicZonesHeader />
      <WorkspaceContent>
        <div className="flex flex-col gap-4 @4xl/main:gap-6" ref={measureContent}>
          <GeographicZonesToolbar
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
                columnVisibility={columnView.visibility}
                search={search}
              />
            }
            resetKey={JSON.stringify(query)}
          >
            <GeographicZonesTable
              automatic={automatic}
              columnVisibility={columnView.visibility}
              onDetail={showDetail}
              onPopulation={showPopulation}
              onSearchChange={updateSearch}
              search={search}
            />
          </QueryBoundary>
        </div>
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
  return (
    <Workspace>
      <GeographicZonesHeader />
      <WorkspaceContent>
        <GeographicZonesTableSkeleton columnVisibility={{}} search={{}} />
      </WorkspaceContent>
    </Workspace>
  );
}
