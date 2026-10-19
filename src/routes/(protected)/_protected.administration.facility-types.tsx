import { createFileRoute } from '@tanstack/react-router';
import { ShapesIcon } from 'lucide-react';
import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
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
import { facilityTypesListOptions } from '@/features/facility-types/api/queries';
import {
  FacilityTypesTable,
  FacilityTypesTableSkeleton,
} from '@/features/facility-types/components/facility-types-table';
import { FacilityTypesToolbar } from '@/features/facility-types/components/facility-types-toolbar';
import {
  FACILITY_TYPE_HIDEABLE_COLUMNS,
  type FacilityTypesSearch,
  facilityTypesSearchSchema,
  toFacilityTypesQuery,
} from '@/features/facility-types/lib/search';
import { facilityTypesOptions } from '@/features/reference-data/api/queries';
import { useCardView } from '@/hooks/use-card-view';
import { useSearchNavigation } from '@/hooks/use-search-navigation';

const loadDialog = () => import('@/features/facility-types/components/facility-type-form-dialog');
const FacilityTypeFormDialog = lazy(() =>
  loadDialog().then((module) => ({ default: module.FacilityTypeFormDialog })),
);

const CLOSED_DIALOGS = { facilityType: undefined } satisfies Partial<FacilityTypesSearch>;

export const Route = createFileRoute('/(protected)/_protected/administration/facility-types')({
  validateSearch: facilityTypesSearchSchema,
  loaderDeps: ({ search }) => ({
    query: toFacilityTypesQuery(search),
    facilityType: search.facilityType,
  }),
  loader: async ({ context: { queryClient }, deps }) => {
    await requireRight(queryClient, RIGHTS.facilitiesManage);
    queryClient.prefetchQuery(facilityTypesListOptions(deps.query));
    if (!deps.facilityType) return;
    queryClient.prefetchQuery(facilityTypesOptions());
  },
  pendingComponent: FacilityTypesPagePending,
  component: FacilityTypesPage,
});

function FacilityTypesPage() {
  const { t } = useTranslation();
  const search = Route.useSearch({
    select: ({ facilityType: _facilityType, ...list }): FacilityTypesSearch => list,
    structuralSharing: true,
  });
  const facilityType = Route.useSearch({ select: (search) => search.facilityType });
  const { measure, cards, columnView, layout } = useCardView(
    FACILITY_TYPE_HIDEABLE_COLUMNS,
    'facility-types.column-visibility',
  );
  const { updateSearch, openDialog, closeDialog } =
    useSearchNavigation<FacilityTypesSearch>(CLOSED_DIALOGS);
  const addType = useCallback(() => openDialog({ facilityType: 'new' }), [openDialog]);
  const editType = useCallback((id: string) => openDialog({ facilityType: id }), [openDialog]);
  const [dialogsMounted, setDialogsMounted] = useState(facilityType !== undefined);
  if (facilityType !== undefined && !dialogsMounted) setDialogsMounted(true);
  useEffect(() => {
    void loadDialog();
  }, []);

  return (
    <Workspace>
      <FacilityTypesHeader />
      <WorkspaceContent>
        <div className="flex flex-col gap-4 @4xl/main:gap-6" ref={measure}>
          <FacilityTypesToolbar
            columnView={columnView}
            layout={layout}
            onAdd={addType}
            onSortChange={updateSearch}
            search={search}
          />
          <QueryBoundary
            errorComponent={({ error, reset }) => (
              <ListError
                description={t('facility-types.error-description')}
                error={error}
                reset={reset}
                title={t('facility-types.error-title')}
              />
            )}
            pendingFallback={
              <FacilityTypesTableSkeleton
                cards={cards}
                columnVisibility={columnView.visibility}
                search={search}
              />
            }
            resetKey={JSON.stringify(search)}
          >
            <FacilityTypesTable
              cards={cards}
              columnVisibility={columnView.visibility}
              onAdd={addType}
              onEdit={editType}
              onSearchChange={updateSearch}
              search={search}
            />
          </QueryBoundary>
        </div>
        {dialogsMounted && (
          <Suspense fallback={null}>
            <FacilityTypeFormDialog onClose={closeDialog} target={facilityType} />
          </Suspense>
        )}
      </WorkspaceContent>
    </Workspace>
  );
}

function FacilityTypesHeader() {
  const { t } = useTranslation();
  return (
    <WorkspaceHeader>
      <WorkspaceHeading>
        <WorkspaceIcon>
          <ShapesIcon />
        </WorkspaceIcon>
        <WorkspaceTitle>{t('facility-types.title')}</WorkspaceTitle>
        <WorkspaceDescription>{t('facility-types.description')}</WorkspaceDescription>
      </WorkspaceHeading>
    </WorkspaceHeader>
  );
}

function FacilityTypesPagePending() {
  const { measure, cards, columnView } = useCardView(
    FACILITY_TYPE_HIDEABLE_COLUMNS,
    'facility-types.column-visibility',
  );
  return (
    <Workspace>
      <FacilityTypesHeader />
      <WorkspaceContent>
        <div ref={measure}>
          <FacilityTypesTableSkeleton
            cards={cards}
            columnVisibility={columnView.visibility}
            search={{}}
          />
        </div>
      </WorkspaceContent>
    </Workspace>
  );
}
