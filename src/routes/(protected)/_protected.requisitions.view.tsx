import {
  useQueries,
  useQuery,
  useQueryClient,
  useSuspenseQueries,
  useSuspenseQuery,
} from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { CalendarX2Icon, ClipboardListIcon, ShieldAlertIcon } from 'lucide-react';
import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ListError } from '@/components/app-shell/list-error';
import { LoadError } from '@/components/app-shell/load-error';
import { QueryBoundary } from '@/components/app-shell/query-boundary';
import { DataTableCard, DataTableEmpty } from '@/components/data-table/data-table';
import { DataTableViewOptions } from '@/components/data-table/data-table-view-options';
import { Button } from '@/components/ui/button';
import {
  Workspace,
  WorkspaceContent,
  WorkspaceDescription,
  WorkspaceHeader,
  WorkspaceHeading,
  WorkspaceIcon,
  WorkspaceTitle,
} from '@/components/workspace/workspace';
import { permissionsOptions } from '@/features/auth/api/queries';
import { requisitionViewNodes } from '@/features/auth/lib/requisition-access';
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
import type { RequisitionGroup } from '@/features/reference-data/lib/types';
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
import { prepareRequisitionAccess } from '@/features/requisitions/lib/offline-access';
import {
  groupIdsOf,
  invalidDateRange,
  partnerNodeIds,
  REQUISITIONS_SORT,
  type RequisitionSearch,
  requisitionSearchSchema,
  type SearchFacility,
  searchFacilityOptions,
  toRequisitionQuery,
} from '@/features/requisitions/lib/search-facilities';
import { useCardView } from '@/hooks/use-card-view';
import { useSearchNavigation } from '@/hooks/use-search-navigation';
import { queryKeys } from '@/lib/key-factory';
import { isOnline } from '@/lib/online';
import { programGrants } from '@/lib/permissions';
import { RIGHTS } from '@/lib/rights';
import { isSecureOrigin } from '@/lib/secure-context';
import { type SearchChange, searchSort } from '@/lib/table-search';
import { requireRequisitionViewWithDevice } from '@/routes/-requisition-access';

const NO_DIALOGS = {} satisfies Partial<RequisitionSearch>;
const noop = () => {};
const combineGroups = (results: { data?: RequisitionGroup }[]) =>
  results.flatMap(({ data }) => data ?? []);

export const Route = createFileRoute('/(protected)/_protected/requisitions/view')({
  validateSearch: (input) => {
    const search = requisitionSearchSchema.parse(input);
    return isSecureOrigin ? search : { ...search, offline: undefined };
  },
  loaderDeps: ({ search }) => ({ search }),
  loader: async ({ context: { queryClient }, deps: { search } }) => {
    await prepareRequisitionAccess(queryClient);
    const userId = useLoginData.getState().referenceDataUserId;
    if (!userId) return;
    const permissions = await queryClient.fetchQuery(permissionsOptions(userId));
    if (!programGrants(permissions, RIGHTS.requisitionView).length)
      await requireRequisitionViewWithDevice(queryClient);
    if (!userId || useLoginData.getState().referenceDataUserId !== userId) return;
    queryClient.prefetchQuery(deploymentTimeZoneOptions());
    queryClient.prefetchQuery(minimalFacilitiesOptions());
    const grants = programGrants(permissions, RIGHTS.requisitionView);
    queryClient.prefetchQuery(userRecordOptions(userId));
    queryClient.prefetchQuery(rolesOptions());
    const userProgramsQuery = userProgramsOptions(userId);
    queryClient.prefetchQuery(userProgramsQuery).then(() => {
      if (useLoginData.getState().referenceDataUserId !== userId) return;
      const programs = queryClient.getQueryData(userProgramsQuery.queryKey);
      if (programs && grants.some(({ programId }) => !programs.some(({ id }) => id === programId)))
        queryClient.prefetchQuery(programsOptions());
    });
    const facilityPrograms = grants.filter(({ facilityId }) => facilityId === search.facility);
    if (
      isOnline() &&
      !search.offline &&
      search.facility &&
      !invalidDateRange(search) &&
      facilityPrograms.length > 0
    ) {
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
    return { userId };
  },
  pendingComponent: RequisitionsPending,
  component: RequisitionsPage,
});

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

type ColumnView = ReturnType<typeof useCardView<HTMLDivElement>>;

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
    <DataTableViewOptions
      size="lg"
      layout={columnView.layout}
      columns={REQUISITION_HIDEABLE_COLUMNS.map(({ id, labelKey }) => ({
        id,
        label: t(labelKey),
      }))}
      onReset={columnView.columnView.onReset}
      onVisibilityChange={columnView.columnView.onVisibilityChange}
      visibility={columnView.columnView.visibility}
      sort={{
        ...searchSort(search, REQUISITIONS_SORT, onSearchChange),
        columns: [{ id: 'createdDate', label: t('requisitions.columns.date-initiated') }],
      }}
    />
  );
}

function PageSkeleton({
  columnView,
  search,
}: {
  columnView: ColumnView;
  search: RequisitionSearch;
}) {
  const { t } = useTranslation();
  return (
    <>
      <RequisitionSearchPickerSkeleton />
      <div aria-busy className="flex flex-col gap-4">
        <fieldset className="min-w-0" disabled>
          <RequisitionsToolbar
            disabled
            onFilterChange={noop}
            search={search}
            view={
              search.facility ? (
                <ColumnsMenu columnView={columnView} search={search} onSearchChange={noop} />
              ) : undefined
            }
          />
        </fieldset>
        {search.facility ? (
          <RequisitionsTableSkeleton
            cards={columnView.cards}
            columns={columnView.columnView.visibility}
            search={search}
          />
        ) : (
          <OutcomeMessage
            icon={<ClipboardListIcon />}
            title={t('requisitions.view.pick-title')}
            description={t('requisitions.view.pick-description')}
          />
        )}
      </div>
    </>
  );
}

function RequisitionsPending() {
  const search = Route.useSearch();
  const columnView = useCardView(REQUISITION_HIDEABLE_COLUMNS, 'requisitions.column-visibility');
  return (
    <Workspace>
      <RequisitionsHeader />
      <WorkspaceContent>
        <div className="flex flex-col gap-4 @4xl/main:gap-6" ref={columnView.measure}>
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
  const columnView = useCardView(REQUISITION_HIDEABLE_COLUMNS, 'requisitions.column-visibility');
  const { updateSearch } = useSearchNavigation<RequisitionSearch>(NO_DIALOGS);
  return (
    <Workspace>
      <RequisitionsHeader />
      <WorkspaceContent>
        <div className="flex flex-col gap-4 @4xl/main:gap-6" ref={columnView.measure}>
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

function useSearchFacilities(userId: string) {
  const [facilities, userPrograms] = useSuspenseQueries({
    queries: [minimalFacilitiesOptions(), userProgramsOptions(userId)],
  });
  const { data: permissions } = useSuspenseQuery(permissionsOptions(userId));
  const { data: user } = useQuery({ ...userRecordOptions(userId), throwOnError: true });
  const { data: roles } = useQuery({ ...rolesOptions(), throwOnError: true });
  const grants = useMemo(() => programGrants(permissions, RIGHTS.requisitionView), [permissions]);
  const missingPrograms = grants.some(
    ({ programId }) => !userPrograms.data.some(({ id }) => id === programId),
  );
  const fallback = useSuspenseQueries({
    queries: [...(missingPrograms ? [programsOptions()] : [])],
  });
  const nodeIds = user && roles ? requisitionViewNodes(user, roles) : [];
  const nodes = useQueries({
    queries: [
      ...(nodeIds.length ? [{ ...supervisoryNodesByIdsOptions(nodeIds), throwOnError: true }] : []),
    ],
  });
  const viewerNodes = nodes.flatMap(({ data }) => data ?? []);
  const partnerIds = partnerNodeIds(viewerNodes);
  const partners = useQueries({
    queries: [
      ...(partnerIds.length
        ? [{ ...supervisoryNodesByIdsOptions(partnerIds), throwOnError: true }]
        : []),
    ],
  });
  const groupIds = groupIdsOf(partners.flatMap(({ data }) => data ?? []));
  const groups = useQueries({
    queries: groupIds.map((id) => ({ ...requisitionGroupOptions(id), throwOnError: true })),
    combine: combineGroups,
  });
  const fallbackPrograms = fallback[0]?.data;
  const options = useMemo(() => {
    const programsById = new Map(
      [...(fallbackPrograms ?? []), ...userPrograms.data].map((program) => [program.id, program]),
    );
    return searchFacilityOptions(grants, facilities.data, [...programsById.values()], groups);
  }, [grants, facilities.data, userPrograms.data, fallbackPrograms, groups]);
  return {
    options,
    pending:
      !user ||
      !roles ||
      nodes.some((result) => result.isPending) ||
      partners.some((result) => result.isPending) ||
      groups.length < groupIds.length,
  };
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
  const { options, pending: choicesPending } = useSearchFacilities(userId);
  const facility = options.find(({ id }) => id === search.facility);
  const [draft, setDraft] = useState<string | null>(null);
  const [draftProgram, setDraftProgram] = useState<string | undefined>(search.program);
  const [draftOver, setDraftOver] = useState(search.facility);
  if (draftOver !== search.facility) {
    setDraftOver(search.facility);
    setDraft(null);
    setDraftProgram(search.program);
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
    if (!pending && !programValid) onSearchChange({ program: undefined, page: undefined }, true);
  }, [programValid, pending, onSearchChange]);
  const onSearch = useCallback(
    (next: string) => {
      if (next === search.facility)
        void queryClient.invalidateQueries({ queryKey: queryKeys.requisitions.all });
      onSearchChange((previous) => ({
        facility: next,
        program: options
          .find(({ id }) => id === next)
          ?.programs.some(({ id }) => id === (pending ? draftProgram : previous.program))
          ? pending
            ? draftProgram
            : previous.program
          : undefined,
        page: undefined,
      }));
    },
    [search.facility, queryClient, onSearchChange, options, pending, draftProgram],
  );
  const toolbar = (
    <RequisitionsToolbar
      programs={draftedFacility?.programs}
      search={pending ? { ...search, program: draftProgram } : search}
      onFilterChange={(patch) => {
        if (pending && 'program' in patch) setDraftProgram(patch.program);
        else onSearchChange(patch, true);
      }}
      view={
        facility && !pending ? (
          <ColumnsMenu columnView={columnView} search={search} onSearchChange={onSearchChange} />
        ) : undefined
      }
    />
  );
  let outcome: ReactNode;
  if (!facility && search.facility && choicesPending) {
    outcome = (
      <RequisitionsTableSkeleton
        cards={columnView.cards}
        columns={columnView.columnView.visibility}
        search={search}
      />
    );
  } else if (!facility) {
    outcome = (
      <OutcomeMessage
        icon={search.facility ? <ShieldAlertIcon /> : <ClipboardListIcon />}
        title={t(
          search.facility
            ? 'requisitions.view.refused-title'
            : draftedFacility
              ? 'requisitions.view.search-pending-title'
              : 'requisitions.view.pick-title',
        )}
        description={t(
          options.length === 0
            ? 'requisitions.view.no-facilities'
            : search.facility
              ? 'requisitions.view.refused-description'
              : draftedFacility
                ? 'requisitions.view.search-pending-description'
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
        onDraftChange={(facilityId) => {
          setDraft(facilityId);
          setDraftProgram(search.program);
        }}
        onSearch={onSearch}
        options={options}
      />
      <div className="flex flex-col gap-4">
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
          columns={columnView.columnView.visibility}
          search={search}
        />
      }
      resetKey={JSON.stringify(toRequisitionQuery(applied))}
    >
      <RequisitionsTable
        cards={columnView.cards}
        columns={columnView.columnView.visibility}
        search={applied}
        onSearchChange={onSearchChange}
      />
    </QueryBoundary>
  );
}
