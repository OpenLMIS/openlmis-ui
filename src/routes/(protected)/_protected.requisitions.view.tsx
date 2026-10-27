import { useQueryClient, useSuspenseQueries, useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { CalendarX2Icon, ClipboardListIcon, ShieldAlertIcon } from 'lucide-react';
import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DataTableCard, DataTableEmpty } from '@/components/data-table/data-table';
import { DataTableViewOptions } from '@/components/data-table/data-table-view-options';
import { ListError } from '@/components/list-error';
import { LoadError } from '@/components/load-error';
import { QueryBoundary } from '@/components/query-boundary';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Workspace,
  WorkspaceContent,
  WorkspaceDescription,
  WorkspaceHeader,
  WorkspaceHeading,
  WorkspaceIcon,
  WorkspaceTitle,
} from '@/components/workspace';
import { permissionsOptions } from '@/features/auth/api/queries';
import {
  requireRequisitionView,
  requisitionViewNodes,
} from '@/features/auth/lib/requisition-access';
import { useLoginData } from '@/features/auth/store/login-data';
import {
  deploymentTimeZoneOptions,
  minimalFacilitiesOptions,
  programsOptions,
  requisitionGroupOptions,
  rolesOptions,
  supervisoryNodesByIdsOptions,
  userProgramsOptions,
  userRecordOptions,
} from '@/features/reference-data/api/queries';
import { requisitionSearchOptions } from '@/features/requisitions/api/queries';
import {
  RequisitionSearchPicker,
  RequisitionSearchPickerSkeleton,
} from '@/features/requisitions/components/requisition-search-picker';
import {
  REQUISITION_HIDEABLE_COLUMNS,
  RequisitionsTable,
  RequisitionsTableSkeleton,
} from '@/features/requisitions/components/requisitions-table';
import { RequisitionsToolbar } from '@/features/requisitions/components/requisitions-toolbar';
import {
  invalidDateRange,
  partnerLookupIds,
  REQUISITIONS_SORT,
  type RequisitionSearch,
  requisitionSearchSchema,
  type SearchFacility,
  searchFacilityOptions,
  toRequisitionQuery,
} from '@/features/requisitions/lib/search-facilities';
import { useCardView } from '@/hooks/use-card-view';
import { useSearchNavigation } from '@/hooks/use-search-navigation';
import { recordLabel } from '@/lib/facility-program-selection';
import { queryKeys } from '@/lib/key-factory';
import { programGrants } from '@/lib/permissions';
import { RIGHTS } from '@/lib/rights';
import { type SearchChange, searchSort } from '@/lib/table-search';

const NO_DIALOGS = {} satisfies Partial<RequisitionSearch>;
const noop = () => {};

export const Route = createFileRoute('/(protected)/_protected/requisitions/view')({
  validateSearch: requisitionSearchSchema,
  loaderDeps: ({ search }) => ({ search }),
  loader: async ({ context: { queryClient }, deps: { search } }) => {
    const userId = useLoginData.getState().referenceDataUserId;
    const access = await requireRequisitionView(queryClient);
    if (!userId || useLoginData.getState().referenceDataUserId !== userId) return;
    queryClient.prefetchQuery(deploymentTimeZoneOptions());
    queryClient.prefetchQuery(minimalFacilitiesOptions());
    queryClient.prefetchQuery(userProgramsOptions(userId));
    const grants = programGrants(access.permissions, RIGHTS.requisitionView);
    if (
      search.facility &&
      !invalidDateRange(search) &&
      grants.some(({ facilityId }) => facilityId === search.facility)
    ) {
      const facilityPrograms = grants.filter(({ facilityId }) => facilityId === search.facility);
      queryClient.prefetchQuery(
        requisitionSearchOptions(
          toRequisitionQuery({
            ...search,
            facility: search.facility,
            program: facilityPrograms.some(({ programId }) => programId === search.program)
              ? search.program
              : undefined,
          }),
        ),
      );
    }
    return { ...access, userId };
  },
  pendingComponent: RequisitionsPending,
  component: RequisitionsPage,
});

type Access = Awaited<ReturnType<typeof requireRequisitionView>> & { userId: string };

function RequisitionsHeader() {
  const { t } = useTranslation();
  return (
    <WorkspaceHeader>
      <WorkspaceHeading>
        <WorkspaceIcon>
          <ClipboardListIcon />
        </WorkspaceIcon>
        <WorkspaceTitle>{t('requisitions.view.title')}</WorkspaceTitle>
        <WorkspaceDescription>{t('requisitions.view.description')}</WorkspaceDescription>
      </WorkspaceHeading>
    </WorkspaceHeader>
  );
}

function useColumnView() {
  const { measure, cards, columnView, layout } = useCardView(
    REQUISITION_HIDEABLE_COLUMNS,
    'requisitions.column-visibility',
  );
  return [measure, { ...columnView, cards, layout }] as const;
}
type ColumnView = ReturnType<typeof useColumnView>[1];

function ColumnsMenu({
  columnView,
  search,
  onSearchChange,
}: {
  columnView: ColumnView;
  search: RequisitionSearch;
  onSearchChange: SearchChange<RequisitionSearch>;
}) {
  const { t } = useTranslation();
  return (
    <div>
      <DataTableViewOptions
        size="lg"
        layout={columnView.layout}
        columns={REQUISITION_HIDEABLE_COLUMNS.map(({ id, labelKey }) => ({
          id,
          label: t(labelKey),
        }))}
        onReset={columnView.onReset}
        onVisibilityChange={columnView.onVisibilityChange}
        visibility={columnView.visibility}
        sort={{
          ...searchSort(search, REQUISITIONS_SORT, onSearchChange),
          columns: [{ id: 'createdDate', label: t('requisitions.columns.date-initiated') }],
        }}
      />
    </div>
  );
}

function PageSkeleton({
  columnView,
  search,
}: {
  columnView: ColumnView;
  search: RequisitionSearch;
}) {
  return (
    <>
      <RequisitionSearchPickerSkeleton />
      {search.facility && (
        <div aria-busy className="flex flex-col gap-4">
          <div className="flex h-6 items-center">
            <div className="h-4 w-72 max-w-full">
              <Skeleton fill />
            </div>
          </div>
          <fieldset className="min-w-0" disabled>
            <RequisitionsToolbar
              disabled
              programs={[]}
              onFilterChange={noop}
              search={search}
              view={<ColumnsMenu columnView={columnView} search={search} onSearchChange={noop} />}
            />
          </fieldset>
          <RequisitionsTableSkeleton
            cards={columnView.cards}
            columns={columnView.visibility}
            search={search}
          />
        </div>
      )}
    </>
  );
}

function RequisitionsPending() {
  const search = Route.useSearch();
  const [measure, columnView] = useColumnView();
  return (
    <Workspace>
      <RequisitionsHeader />
      <WorkspaceContent>
        <div className="flex flex-col gap-4 @4xl/main:gap-6" ref={measure}>
          <PageSkeleton columnView={columnView} search={search} />
        </div>
      </WorkspaceContent>
    </Workspace>
  );
}

function RequisitionsPage() {
  const { t } = useTranslation();
  const search = Route.useSearch();
  const userId = useLoginData((state) => state.referenceDataUserId);
  const [measure, columnView] = useColumnView();
  const { updateSearch } = useSearchNavigation<RequisitionSearch>(NO_DIALOGS);
  return (
    <Workspace>
      <RequisitionsHeader />
      <WorkspaceContent>
        <div className="flex flex-col gap-4 @4xl/main:gap-6" ref={measure}>
          <QueryBoundary
            errorComponent={({ error, reset }) => (
              <LoadError
                description={t('facility-program.load-error-description')}
                error={error}
                reset={reset}
                title={t('facility-program.load-error-title')}
              />
            )}
            pendingFallback={<PageSkeleton columnView={columnView} search={search} />}
            resetKey={userId}
          >
            {userId && (
              <RequisitionsBody
                userId={userId}
                columnView={columnView}
                onSearchChange={updateSearch}
                search={search}
              />
            )}
          </QueryBoundary>
        </div>
      </WorkspaceContent>
    </Workspace>
  );
}

function useSearchFacilities(access: Access) {
  const [facilities, userPrograms] = useSuspenseQueries({
    queries: [minimalFacilitiesOptions(), userProgramsOptions(access.userId)],
  });
  const grants = useMemo(
    () => programGrants(access.permissions, RIGHTS.requisitionView),
    [access.permissions],
  );
  const missingPrograms = grants.some(
    ({ programId }) => !userPrograms.data.some(({ id }) => id === programId),
  );
  const fallback = useSuspenseQueries({
    queries: [missingPrograms].filter(Boolean).map(() => programsOptions()),
  });
  const nodeIds = requisitionViewNodes(access.user, access.roles);
  const nodes = useSuspenseQueries({
    queries: [nodeIds].filter((ids) => ids.length > 0).map(supervisoryNodesByIdsOptions),
  });
  const viewerNodes = nodes.flatMap(({ data }) => data);
  const { partnerIds } = partnerLookupIds(viewerNodes);
  const partners = useSuspenseQueries({
    queries: [partnerIds].filter((ids) => ids.length > 0).map(supervisoryNodesByIdsOptions),
  });
  const { groupIds } = partnerLookupIds(
    viewerNodes,
    partners.flatMap(({ data }) => data),
  );
  const groups = useSuspenseQueries({ queries: groupIds.map(requisitionGroupOptions) });
  const programs = [
    ...userPrograms.data,
    ...(fallback[0]?.data ?? []).filter(
      ({ id }) => !userPrograms.data.some((program) => program.id === id),
    ),
  ];
  return searchFacilityOptions(
    grants,
    facilities.data,
    programs,
    groups.map(({ data }) => data),
  );
}

function RequisitionsBody({
  userId,
  columnView,
  search,
  onSearchChange,
}: {
  userId: string;
  columnView: ColumnView;
  search: RequisitionSearch;
  onSearchChange: SearchChange<RequisitionSearch>;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data: permissions } = useSuspenseQuery(permissionsOptions(userId));
  const { data: user } = useSuspenseQuery(userRecordOptions(userId));
  const { data: roles } = useSuspenseQuery(rolesOptions());
  const options = useSearchFacilities({ userId, permissions, user, roles });
  const facility = options.find(({ id }) => id === search.facility);
  const [draft, setDraft] = useState<string | null>(null);
  const [draftOver, setDraftOver] = useState(search.facility);
  if (draftOver !== search.facility) {
    setDraftOver(search.facility);
    setDraft(null);
  }
  const draftedFacility = options.find(
    ({ id }) =>
      id ===
      (draft ??
        facility?.id ??
        (!search.facility && options.length === 1 ? options[0]?.id : undefined)),
  );
  const pending = Boolean(facility && draft !== null && draft !== facility.id);
  const programValid =
    !search.program || !facility || facility.programs.some(({ id }) => id === search.program);
  const validSearch = useMemo(
    () => ({ ...search, program: programValid ? search.program : undefined }),
    [search, programValid],
  );
  useEffect(() => {
    if (!programValid) onSearchChange({ program: undefined, page: undefined }, true);
  }, [programValid, onSearchChange]);
  const onSearch = useCallback(
    (next: string) => {
      if (next === search.facility)
        void queryClient.invalidateQueries({ queryKey: queryKeys.requisitions.all });
      onSearchChange((previous) => ({
        facility: next,
        program: options
          .find(({ id }) => id === next)
          ?.programs.some(({ id }) => id === previous.program)
          ? previous.program
          : undefined,
        page: undefined,
      }));
    },
    [search.facility, queryClient, onSearchChange, options],
  );
  const toolbar = (
    <RequisitionsToolbar
      programs={draftedFacility?.programs ?? []}
      search={search}
      onFilterChange={(patch) => onSearchChange(patch, true)}
      view={
        facility && !pending ? (
          <ColumnsMenu columnView={columnView} search={search} onSearchChange={onSearchChange} />
        ) : undefined
      }
    />
  );
  let outcome: ReactNode;
  if (!facility) {
    outcome = (
      <OutcomeMessage
        icon={search.facility ? <ShieldAlertIcon /> : <ClipboardListIcon />}
        title={t(
          search.facility ? 'requisitions.view.refused-title' : 'requisitions.view.pick-title',
        )}
        description={t(
          options.length === 0
            ? 'requisitions.view.no-facilities'
            : search.facility
              ? 'requisitions.view.refused-description'
              : 'requisitions.view.pick-description',
        )}
      />
    );
  } else if (pending) {
    outcome = (
      <OutcomeMessage
        icon={<ClipboardListIcon />}
        title={t('requisitions.view.search-pending-title')}
        description={t('requisitions.view.search-pending-description')}
      />
    );
  } else if (invalidDateRange(search)) {
    outcome = (
      <OutcomeMessage
        icon={<CalendarX2Icon />}
        title={t('requisitions.view.date-range-title')}
        description={t('requisitions.view.date-range-description')}
        action={
          <Button
            variant="outline"
            onClick={() =>
              onSearchChange({ initiatedFrom: undefined, initiatedTo: undefined, page: undefined })
            }
          >
            {t('requisitions.view.clear-dates')}
          </Button>
        }
      />
    );
  } else {
    outcome = (
      <RequisitionsResults
        columnView={columnView}
        facility={facility}
        search={validSearch}
        onSearchChange={onSearchChange}
      />
    );
  }
  return (
    <>
      <RequisitionSearchPicker
        applied={search.facility}
        onDraftChange={setDraft}
        onSearch={onSearch}
        options={options}
      />
      <div className="flex flex-col gap-4">
        {facility && !pending && (
          <h2 className="font-semibold text-base">
            {t('requisitions.view.applied', { facility: recordLabel(facility) })}
          </h2>
        )}
        {toolbar}
        {outcome}
      </div>
    </>
  );
}

function OutcomeMessage({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <DataTableCard>
      <DataTableEmpty action={action} description={description} icon={icon} title={title} />
    </DataTableCard>
  );
}

function RequisitionsResults({
  columnView,
  facility,
  search,
  onSearchChange,
}: {
  columnView: ColumnView;
  facility: SearchFacility;
  search: RequisitionSearch;
  onSearchChange: SearchChange<RequisitionSearch>;
}) {
  const { t } = useTranslation();
  const applied = useMemo(() => ({ ...search, facility: facility.id }), [search, facility.id]);
  return (
    <QueryBoundary
      errorComponent={({ error, reset }) => (
        <ListError
          description={t('requisitions.view.error-description')}
          error={error}
          reset={reset}
          title={t('requisitions.view.error-title')}
        />
      )}
      pendingFallback={
        <RequisitionsTableSkeleton
          cards={columnView.cards}
          columns={columnView.visibility}
          search={search}
        />
      }
      resetKey={JSON.stringify(toRequisitionQuery(applied))}
    >
      <RequisitionsTable
        cards={columnView.cards}
        columns={columnView.visibility}
        search={applied}
        onSearchChange={onSearchChange}
      />
    </QueryBoundary>
  );
}
