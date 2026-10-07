import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { ClipboardListIcon, PrinterIcon, ShieldAlertIcon, WarehouseIcon } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { DataTableCard, DataTableEmpty } from '@/components/data-table/data-table';
import { useElementWidth } from '@/components/data-table/responsive-columns';
import { serverMessage } from '@/components/dialog-parts';
import {
  FacilityProgramSelector,
  FacilityProgramSelectorSkeleton,
} from '@/components/facility-program-selector/facility-program-selector';
import {
  loadFacilityProgramOptions,
  useFacilityProgramOptions,
} from '@/components/facility-program-selector/use-facility-program-options';
import { ListError } from '@/components/list-error';
import { LoadError } from '@/components/load-error';
import { QueryBoundary } from '@/components/query-boundary';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
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
import { ForbiddenError, requirePermissions } from '@/features/auth/lib/access';
import { RIGHTS } from '@/features/auth/lib/rights';
import { useLoginData } from '@/features/auth/store/login-data';
import { fetchStockOnHandReport } from '@/features/stock-on-hand/api/api';
import { stockCardSummariesOptions } from '@/features/stock-on-hand/api/queries';
import {
  type ResultsLayout,
  StockOnHandResults,
  StockOnHandResultsSkeleton,
} from '@/features/stock-on-hand/components/stock-on-hand-results';
import { StockOnHandToolbar } from '@/features/stock-on-hand/components/stock-on-hand-toolbar';
import {
  type StockOnHandSearch,
  stockOnHandSearchSchema,
  toSummariesQuery,
} from '@/features/stock-on-hand/lib/search';
import type { StockCardSummariesQuery } from '@/features/stock-on-hand/lib/types';
import { useQuantityUnit } from '@/hooks/use-quantity-unit';
import { useSearchNavigation } from '@/hooks/use-search-navigation';
import { downloadFile } from '@/lib/download-file';
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
import type { ProgramGrant } from '@/lib/permissions';
import { hasProgramGrant, type Permissions, programGrants } from '@/lib/permissions';
import type { QuantityUnit } from '@/lib/quantity';
import type { SearchChange } from '@/lib/table-search';

const RIGHT = RIGHTS.stockCardsView;

const NO_DIALOGS = {} satisfies Partial<StockOnHandSearch>;

const TABLE_MIN_WIDTH = 768;

export const Route = createFileRoute('/(protected)/_protected/stock-management/stock-on-hand')({
  validateSearch: stockOnHandSearchSchema,
  // The inactive box only filters the page shown, so it never reloads.
  loaderDeps: ({ search: { includeInactive: _includeInactive, ...search } }) => ({ search }),
  loader: async ({ context: { queryClient }, deps: { search } }) => {
    const permissions = await requirePermissions(queryClient, RIGHT);
    const userId = useLoginData.getState().referenceDataUserId;
    if (!userId) return;
    const options = loadFacilityProgramOptions(
      queryClient,
      userId,
      programGrants(permissions, RIGHT),
    );
    // The picker shows a failed lookup with a retry; no stock loads for a selection not checked.
    const checked = options.catch(() => null);
    const selection = {
      mode: search.mode,
      programId: search.programId,
      facilityId: search.facilityId,
    };
    if (!isCompleteSelection(selection)) return;
    const granted = (current: Permissions) =>
      hasProgramGrant(current, RIGHT, selection.facilityId, selection.programId);
    if (!granted(permissions)) return;
    const loaded = await checked;
    if (!loaded || !validSelection(selection, loaded)) return;
    // Rights or the user can change while the lookups load.
    const current = await queryClient.fetchQuery(permissionsOptions(userId)).catch(() => null);
    if (useLoginData.getState().referenceDataUserId !== userId || !current || !granted(current)) {
      return;
    }
    queryClient.prefetchQuery(stockCardSummariesOptions(toSummariesQuery(search, selection)));
  },
  pendingComponent: StockOnHandPending,
  component: StockOnHandPage,
});

function StockOnHandHeader() {
  const { t } = useTranslation();
  return (
    <WorkspaceHeader>
      <WorkspaceHeading>
        <WorkspaceIcon>
          <WarehouseIcon />
        </WorkspaceIcon>
        <WorkspaceTitle>{t('stock-on-hand.title')}</WorkspaceTitle>
        <WorkspaceDescription>{t('stock-on-hand.page-description')}</WorkspaceDescription>
      </WorkspaceHeading>
    </WorkspaceHeader>
  );
}

function useResultsLayout() {
  const [measure, width] = useElementWidth<HTMLDivElement>();
  const layout: ResultsLayout = width === undefined || width >= TABLE_MIN_WIDTH ? 'table' : 'cards';
  return [measure, layout] as const;
}

const noop = () => {};

function StockOnHandListSkeleton({
  search,
  layout,
}: {
  search: StockOnHandSearch;
  layout: ResultsLayout;
}) {
  const { t } = useTranslation();
  const { unit, canSwitch } = useQuantityUnit();
  return (
    <div aria-busy className="flex flex-col gap-4">
      <div className="flex h-6 items-center">
        <div className="h-4 w-72 max-w-full">
          <Skeleton fill />
        </div>
      </div>
      <fieldset className="min-w-0" disabled>
        <StockOnHandToolbar
          disabled
          onFilterChange={noop}
          onUnitChange={canSwitch ? noop : undefined}
          print={
            <Button type="button">
              <PrinterIcon data-icon="inline-start" />
              {t('stock-on-hand.print')}
            </Button>
          }
          search={search}
          unit={unit}
        />
      </fieldset>
      <StockOnHandResultsSkeleton layout={layout} search={search} />
    </div>
  );
}

function StockOnHandPageSkeleton({
  search,
  layout,
}: {
  search: StockOnHandSearch;
  layout: ResultsLayout;
}) {
  return (
    <>
      <FacilityProgramSelectorSkeleton />
      {isCompleteSelection(search) && <StockOnHandListSkeleton layout={layout} search={search} />}
    </>
  );
}

function StockOnHandPending() {
  const search = Route.useSearch();
  const [measure, layout] = useResultsLayout();
  return (
    <Workspace>
      <StockOnHandHeader />
      <WorkspaceContent>
        <div className="flex flex-col gap-4 @4xl/main:gap-6" ref={measure}>
          <StockOnHandPageSkeleton layout={layout} search={search} />
        </div>
      </WorkspaceContent>
    </Workspace>
  );
}

function StockOnHandPage() {
  const userId = useLoginData((state) => state.referenceDataUserId);
  // Signing out clears the cache before leaving, so the page must not load rights for no one.
  return userId ? <StockOnHandContent userId={userId} /> : null;
}

function StockOnHandContent({ userId }: { userId: string }) {
  const { t } = useTranslation();
  const search = Route.useSearch();
  const { updateSearch } = useSearchNavigation<StockOnHandSearch>(NO_DIALOGS);
  const { data: permissions } = useSuspenseQuery(permissionsOptions(userId));
  const grants = useMemo(() => programGrants(permissions, RIGHT), [permissions]);
  const [measureContent, layout] = useResultsLayout();

  return (
    <Workspace>
      <StockOnHandHeader />
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
            pendingFallback={<StockOnHandPageSkeleton layout={layout} search={search} />}
            resetKey={userId}
          >
            <StockOnHandBody
              grants={grants}
              layout={layout}
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

type StockOnHandBodyProps = {
  userId: string;
  grants: readonly ProgramGrant[];
  search: StockOnHandSearch;
  layout: ResultsLayout;
  onSearchChange: SearchChange<StockOnHandSearch>;
};

function StockOnHandBody({ userId, grants, search, layout, onSearchChange }: StockOnHandBodyProps) {
  const queryClient = useQueryClient();
  const options = useFacilityProgramOptions(userId, grants);
  const applied = useMemo(
    () => ({ mode: search.mode, programId: search.programId, facilityId: search.facilityId }),
    [search.mode, search.programId, search.facilityId],
  );
  const valid = validSelection(applied, options);
  // Back, a link or a finished Search brings a new selection, which the picker starts over from.
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
        void queryClient.invalidateQueries({ queryKey: queryKeys.stockCardSummaries.all });
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
      <StockOnHandOutcome
        applied={applied}
        layout={layout}
        onSearchChange={onSearchChange}
        options={options}
        pending={pending}
        search={search}
        userId={userId}
        valid={valid}
      />
    </>
  );
}

type StockOnHandOutcomeProps = Omit<StockOnHandBodyProps, 'grants'> & {
  options: FacilityProgramOptions;
  applied: FacilityProgramSelection;
  valid: CompleteSelection | null;
  pending: boolean;
};

function StockOnHandOutcome({
  userId,
  search,
  layout,
  onSearchChange,
  options,
  applied,
  valid,
  pending,
}: StockOnHandOutcomeProps) {
  const { t } = useTranslation();

  if (!valid) {
    const refused = isCompleteSelection(applied);
    return (
      <DataTableCard>
        <DataTableEmpty
          description={t(
            refused ? 'stock-on-hand.refused-description' : 'stock-on-hand.pick-description',
          )}
          icon={refused ? <ShieldAlertIcon /> : <ClipboardListIcon />}
          title={t(refused ? 'stock-on-hand.refused-title' : 'stock-on-hand.pick-title')}
        />
      </DataTableCard>
    );
  }
  if (pending) {
    return (
      <DataTableCard>
        <DataTableEmpty
          description={t('stock-on-hand.search-pending-description')}
          icon={<ClipboardListIcon />}
          title={t('stock-on-hand.search-pending-title')}
        />
      </DataTableCard>
    );
  }
  const programs = valid.mode === 'my' ? options.myPrograms : options.supervisedPrograms;
  return (
    <StockOnHandList
      facility={options
        .facilitiesFor(valid.programId)
        .find((facility) => facility.id === valid.facilityId)}
      layout={layout}
      onSearchChange={onSearchChange}
      program={programs.find((program) => program.id === valid.programId)}
      search={search}
      selection={valid}
      userId={userId}
    />
  );
}

const label = (record: NamedRecord | undefined) => (record ? recordLabel(record) : '');

type StockOnHandListProps = {
  userId: string;
  search: StockOnHandSearch;
  selection: CompleteSelection;
  facility: NamedRecord | undefined;
  program: NamedRecord | undefined;
  layout: ResultsLayout;
  onSearchChange: SearchChange<StockOnHandSearch>;
};

function StockOnHandList({
  userId,
  search,
  selection,
  facility,
  program,
  layout,
  onSearchChange,
}: StockOnHandListProps) {
  const { t } = useTranslation();
  const { unit, setUnit, canSwitch } = useQuantityUnit();
  const query = toSummariesQuery(search, selection);
  const collapsedKey = `stock-on-hand.collapsed:${userId}:${selection.facilityId}:${selection.programId}`;

  return (
    <div className="flex flex-col gap-4">
      <h2 className="font-semibold text-base">
        {t('stock-on-hand.applied', { facility: label(facility), program: label(program) })}
      </h2>
      <StockOnHandToolbar
        onFilterChange={(patch) => onSearchChange(patch, true)}
        onUnitChange={canSwitch ? setUnit : undefined}
        print={
          <PrintButton
            facility={facility}
            program={program}
            query={query}
            selection={selection}
            unit={unit}
            userId={userId}
          />
        }
        search={search}
        unit={unit}
      />
      <QueryBoundary
        errorComponent={({ error, reset }) => (
          <ListError
            description={t('stock-on-hand.error-description')}
            error={error}
            reset={reset}
            title={t('stock-on-hand.error-title')}
          />
        )}
        pendingFallback={<StockOnHandResultsSkeleton layout={layout} search={search} />}
        resetKey={JSON.stringify(query)}
      >
        <StockOnHandResults
          collapsedKey={collapsedKey}
          facilityId={selection.facilityId}
          key={collapsedKey}
          layout={layout}
          onSearchChange={onSearchChange}
          programId={selection.programId}
          search={search}
          unit={unit}
        />
      </QueryBoundary>
    </div>
  );
}

const fileCode = (record: NamedRecord | undefined) =>
  (record?.code ?? '').replace(/[^A-Za-z0-9_-]+/g, '-');

type PrintButtonProps = {
  userId: string;
  selection: CompleteSelection;
  facility: NamedRecord | undefined;
  program: NamedRecord | undefined;
  unit: QuantityUnit;
  query: StockCardSummariesQuery;
};

function PrintButton({ userId, selection, facility, program, unit, query }: PrintButtonProps) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const { data: page } = useQuery({ ...stockCardSummariesOptions(query), enabled: false });
  const print = useMutation({
    mutationFn: async () => {
      const permissions = await queryClient.fetchQuery(permissionsOptions(userId));
      if (!hasProgramGrant(permissions, RIGHT, selection.facilityId, selection.programId)) {
        throw new ForbiddenError(RIGHT);
      }
      return fetchStockOnHandReport({
        programId: selection.programId,
        facilityId: selection.facilityId,
        showInDoses: unit === 'DOSES',
        lang: i18n.resolvedLanguage ?? i18n.language,
      });
    },
    onSuccess: (report) => {
      const codes = [fileCode(facility), fileCode(program)].filter(Boolean).join('-');
      downloadFile(report, `stock-on-hand${codes ? `-${codes}` : ''}.pdf`);
      toast.success(t('stock-on-hand.printed-title'), {
        description: t('stock-on-hand.printed', {
          facility: label(facility),
          program: label(program),
        }),
      });
    },
    onError: (error) => {
      toast.error(t('stock-on-hand.print-error-title'), {
        description:
          error instanceof ForbiddenError
            ? t('stock-on-hand.print-refused')
            : (serverMessage(error) ?? t('stock-on-hand.print-error')),
      });
    },
  });

  return (
    <Button
      disabled={!page || page.totalElements === 0 || print.isPending}
      onClick={() => print.mutate()}
      type="button"
    >
      {print.isPending ? (
        <Spinner data-icon="inline-start" />
      ) : (
        <PrinterIcon data-icon="inline-start" />
      )}
      {t('stock-on-hand.print')}
    </Button>
  );
}
