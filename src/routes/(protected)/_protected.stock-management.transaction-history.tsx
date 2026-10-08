import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { CalendarX2Icon, ClipboardListIcon, HistoryIcon, ShieldAlertIcon } from 'lucide-react';
import { type ReactNode, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { DataTableCard, DataTableEmpty } from '@/components/data-table/data-table';
import { DataTableViewOptions } from '@/components/data-table/data-table-view-options';
import { useColumnVisibility, useElementWidth } from '@/components/data-table/responsive-columns';
import {
  FacilityProgramSelector,
  FacilityProgramSelectorSkeleton,
} from '@/components/facility-program-selector/facility-program-selector';
import {
  prefetchFacilityProgramOptions,
  useFacilityProgramOptions,
} from '@/components/facility-program-selector/use-facility-program-options';
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
import { requirePermissions } from '@/features/auth/lib/access';
import { RIGHTS } from '@/features/auth/lib/rights';
import { useLoginData } from '@/features/auth/store/login-data';
import { deploymentTimeZoneOptions } from '@/features/reference-data/api/queries';
import { stockEventsOptions } from '@/features/stock-events/api/queries';
import {
  EVENT_HIDEABLE_COLUMNS,
  TransactionHistoryResults,
  TransactionHistoryResultsSkeleton,
} from '@/features/stock-events/components/transaction-history-results';
import { TransactionHistoryToolbar } from '@/features/stock-events/components/transaction-history-toolbar';
import {
  invalidDateRange,
  type TransactionHistorySearch,
  toEventsQuery,
  transactionHistorySearchSchema,
} from '@/features/stock-events/lib/search';
import { useSearchNavigation } from '@/hooks/use-search-navigation';
import { useStoredState } from '@/hooks/use-stored-state';
import {
  type CompleteSelection,
  type FacilityProgramOptions,
  type FacilityProgramSelection,
  isCompleteSelection,
  type NamedRecord,
  recordLabel,
  sameSelection,
  validSelection,
} from '@/lib/facility-program-selection';
import { queryKeys } from '@/lib/key-factory';
import { hasProgramGrant, type ProgramGrant, programGrants } from '@/lib/permissions';
import type { SearchChange } from '@/lib/table-search';

const RIGHT = RIGHTS.stockCardsView;

const NO_DIALOGS = {} satisfies Partial<TransactionHistorySearch>;

const noop = () => {};

export const Route = createFileRoute(
  '/(protected)/_protected/stock-management/transaction-history',
)({
  validateSearch: transactionHistorySearchSchema,
  loaderDeps: ({ search }) => ({ search }),
  loader: async ({ context: { queryClient }, deps: { search } }) => {
    const userId = useLoginData.getState().referenceDataUserId;
    const permissions = await requirePermissions(queryClient, RIGHT);
    if (!userId || useLoginData.getState().referenceDataUserId !== userId) return;
    prefetchFacilityProgramOptions(queryClient, userId);
    queryClient.prefetchQuery(deploymentTimeZoneOptions());
    const selection = {
      mode: search.mode,
      programId: search.programId,
      facilityId: search.facilityId,
    };
    if (
      isCompleteSelection(selection) &&
      !invalidDateRange(search) &&
      hasProgramGrant(permissions, RIGHT, selection.facilityId, selection.programId)
    ) {
      queryClient.prefetchQuery(stockEventsOptions(toEventsQuery(search, selection)));
    }
  },
  pendingComponent: TransactionHistoryPending,
  component: TransactionHistoryPage,
});

function TransactionHistoryHeader() {
  const { t } = useTranslation();
  return (
    <WorkspaceHeader>
      <WorkspaceHeading>
        <WorkspaceIcon>
          <HistoryIcon />
        </WorkspaceIcon>
        <WorkspaceTitle>{t('transaction-history.title')}</WorkspaceTitle>
        <WorkspaceDescription>{t('transaction-history.page-description')}</WorkspaceDescription>
      </WorkspaceHeading>
    </WorkspaceHeader>
  );
}

const columnChoicesSchema = z.record(z.string(), z.boolean());

type ColumnView = ReturnType<typeof useColumnVisibility>;

function useColumnView() {
  const [measure, width] = useElementWidth<HTMLDivElement>();
  const columnView = useColumnVisibility(
    EVENT_HIDEABLE_COLUMNS,
    useStoredState('transaction-history.column-visibility', columnChoicesSchema, {}),
    width,
  );
  return [measure, columnView] as const;
}

function ColumnsMenu({ columnView }: { columnView: ColumnView }) {
  const { t } = useTranslation();
  return (
    <div>
      <DataTableViewOptions
        columns={EVENT_HIDEABLE_COLUMNS.map(({ id, labelKey }) => ({ id, label: t(labelKey) }))}
        onReset={columnView.onReset}
        onVisibilityChange={columnView.onVisibilityChange}
        visibility={columnView.visibility}
      />
    </div>
  );
}

function TransactionHistoryListSkeleton({
  search,
  columnView,
}: {
  search: TransactionHistorySearch;
  columnView: ColumnView;
}) {
  return (
    <div aria-busy className="flex flex-col gap-4">
      <div className="flex h-6 items-center">
        <div className="h-4 w-72 max-w-full">
          <Skeleton fill />
        </div>
      </div>
      <fieldset className="min-w-0" disabled>
        <TransactionHistoryToolbar
          disabled
          onFilterChange={noop}
          search={search}
          view={<ColumnsMenu columnView={columnView} />}
        />
      </fieldset>
      <TransactionHistoryResultsSkeleton columns={columnView.visibility} search={search} />
    </div>
  );
}

function TransactionHistoryPageSkeleton({
  search,
  columnView,
}: {
  search: TransactionHistorySearch;
  columnView: ColumnView;
}) {
  return (
    <>
      <FacilityProgramSelectorSkeleton />
      {isCompleteSelection(search) && (
        <TransactionHistoryListSkeleton columnView={columnView} search={search} />
      )}
    </>
  );
}

function TransactionHistoryPending() {
  const search = Route.useSearch();
  const [measure, columnView] = useColumnView();
  return (
    <Workspace>
      <TransactionHistoryHeader />
      <WorkspaceContent>
        <div className="flex flex-col gap-4 @4xl/main:gap-6" ref={measure}>
          <TransactionHistoryPageSkeleton columnView={columnView} search={search} />
        </div>
      </WorkspaceContent>
    </Workspace>
  );
}

function TransactionHistoryPage() {
  const userId = useLoginData((state) => state.referenceDataUserId);
  return userId ? <TransactionHistoryContent userId={userId} /> : null;
}

function TransactionHistoryContent({ userId }: { userId: string }) {
  const { t } = useTranslation();
  const search = Route.useSearch();
  const { updateSearch } = useSearchNavigation<TransactionHistorySearch>(NO_DIALOGS);
  const { data: permissions } = useSuspenseQuery(permissionsOptions(userId));
  const grants = useMemo(() => programGrants(permissions, RIGHT), [permissions]);
  const [measureContent, columnView] = useColumnView();

  return (
    <Workspace>
      <TransactionHistoryHeader />
      <WorkspaceContent>
        <div className="flex flex-col gap-4 @4xl/main:gap-6" ref={measureContent}>
          <QueryBoundary
            errorComponent={({ error, reset }) => (
              <LoadError
                description={t('facility-program.load-error-description')}
                error={error}
                reset={reset}
                title={t('facility-program.load-error-title')}
              />
            )}
            pendingFallback={
              <TransactionHistoryPageSkeleton columnView={columnView} search={search} />
            }
            resetKey={userId}
          >
            <TransactionHistoryBody
              columnView={columnView}
              grants={grants}
              onSearchChange={updateSearch}
              search={search}
              userId={userId}
            />
          </QueryBoundary>
        </div>
      </WorkspaceContent>
    </Workspace>
  );
}

type TransactionHistoryBodyProps = {
  userId: string;
  grants: readonly ProgramGrant[];
  search: TransactionHistorySearch;
  columnView: ColumnView;
  onSearchChange: SearchChange<TransactionHistorySearch>;
};

function TransactionHistoryBody({
  userId,
  grants,
  search,
  columnView,
  onSearchChange,
}: TransactionHistoryBodyProps) {
  const queryClient = useQueryClient();
  const options = useFacilityProgramOptions(userId, grants);
  const applied = useMemo(
    () => ({ mode: search.mode, programId: search.programId, facilityId: search.facilityId }),
    [search.mode, search.programId, search.facilityId],
  );
  const valid = validSelection(applied, options);
  const [draft, setDraft] = useState<FacilityProgramSelection | null>(null);
  const [draftOver, setDraftOver] = useState(applied);
  if (!sameSelection(draftOver, applied)) {
    setDraftOver(applied);
    setDraft(null);
  }
  const pending = valid !== null && draft !== null && !sameSelection(draft, valid);

  const onSearch = useCallback(
    (selection: CompleteSelection) => {
      if (sameSelection(selection, applied)) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.stockEvents.all });
      }
      onSearchChange({ ...selection, page: undefined });
    },
    [applied, onSearchChange, queryClient],
  );

  return (
    <>
      <FacilityProgramSelector
        applied={applied}
        onDraftChange={setDraft}
        onSearch={onSearch}
        options={options}
      />
      <TransactionHistoryOutcome
        applied={applied}
        columnView={columnView}
        onSearchChange={onSearchChange}
        options={options}
        pending={pending}
        search={search}
        valid={valid}
      />
    </>
  );
}

type TransactionHistoryOutcomeProps = Omit<TransactionHistoryBodyProps, 'grants' | 'userId'> & {
  options: FacilityProgramOptions;
  applied: FacilityProgramSelection;
  valid: CompleteSelection | null;
  pending: boolean;
};

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

function WithFilters({ filters, children }: { filters: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-4">
      {filters}
      {children}
    </div>
  );
}

function TransactionHistoryOutcome({
  search,
  columnView,
  onSearchChange,
  options,
  applied,
  valid,
  pending,
}: TransactionHistoryOutcomeProps) {
  const { t } = useTranslation();
  const filters = (
    <TransactionHistoryToolbar
      onFilterChange={(patch) => onSearchChange(patch, true)}
      search={search}
    />
  );

  if (!valid) {
    const refused = isCompleteSelection(applied);
    return (
      <WithFilters filters={filters}>
        <OutcomeMessage
          description={t(
            refused
              ? 'transaction-history.refused-description'
              : 'transaction-history.pick-description',
          )}
          icon={refused ? <ShieldAlertIcon /> : <ClipboardListIcon />}
          title={t(
            refused ? 'transaction-history.refused-title' : 'transaction-history.pick-title',
          )}
        />
      </WithFilters>
    );
  }
  if (pending) {
    return (
      <WithFilters filters={filters}>
        <OutcomeMessage
          description={t('transaction-history.search-pending-description')}
          icon={<ClipboardListIcon />}
          title={t('transaction-history.search-pending-title')}
        />
      </WithFilters>
    );
  }
  const programs = valid.mode === 'my' ? options.myPrograms : options.supervisedPrograms;
  return (
    <TransactionHistoryList
      columnView={columnView}
      facility={options
        .facilitiesFor(valid.programId)
        .find((facility) => facility.id === valid.facilityId)}
      onSearchChange={onSearchChange}
      program={programs.find((program) => program.id === valid.programId)}
      search={search}
      selection={valid}
    />
  );
}

const label = (record: NamedRecord | undefined) => (record ? recordLabel(record) : '');

type TransactionHistoryListProps = {
  search: TransactionHistorySearch;
  selection: CompleteSelection;
  facility: NamedRecord | undefined;
  program: NamedRecord | undefined;
  columnView: ColumnView;
  onSearchChange: SearchChange<TransactionHistorySearch>;
};

function TransactionHistoryList({
  search,
  selection,
  facility,
  program,
  columnView,
  onSearchChange,
}: TransactionHistoryListProps) {
  const { t } = useTranslation();
  const query = toEventsQuery(search, selection);

  return (
    <div className="flex flex-col gap-4">
      <h2 className="font-semibold text-base">
        {t('transaction-history.applied', { facility: label(facility), program: label(program) })}
      </h2>
      <TransactionHistoryToolbar
        onFilterChange={(patch) => onSearchChange(patch, true)}
        search={search}
        view={<ColumnsMenu columnView={columnView} />}
      />
      {invalidDateRange(search) ? (
        <OutcomeMessage
          action={
            <Button
              onClick={() =>
                onSearchChange({ startDate: undefined, endDate: undefined, page: undefined })
              }
              variant="outline"
            >
              {t('transaction-history.clear-dates')}
            </Button>
          }
          description={t('transaction-history.date-range-description')}
          icon={<CalendarX2Icon />}
          title={t('transaction-history.date-range-title')}
        />
      ) : (
        <QueryBoundary
          errorComponent={({ error, reset }) => (
            <ListError
              description={t('transaction-history.error-description')}
              error={error}
              reset={reset}
              title={t('transaction-history.error-title')}
            />
          )}
          pendingFallback={
            <TransactionHistoryResultsSkeleton columns={columnView.visibility} search={search} />
          }
          resetKey={JSON.stringify(query)}
        >
          <TransactionHistoryResults
            columns={columnView.visibility}
            facilityId={selection.facilityId}
            onSearchChange={onSearchChange}
            programId={selection.programId}
            search={search}
          />
        </QueryBoundary>
      )}
    </div>
  );
}
