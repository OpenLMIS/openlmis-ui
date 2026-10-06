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
import { useQuantityUnit } from '@/hooks/use-quantity-unit';
import { useSearchNavigation } from '@/hooks/use-search-navigation';
import { downloadFile } from '@/lib/download-file';
import {
  type CompleteSelection,
  type FacilityProgramOptions,
  type FacilityProgramSelection,
  isCompleteSelection,
  type NamedRecord,
  validSelection,
} from '@/lib/facility-program-selection';
import { queryKeys } from '@/lib/key-factory';
import { hasProgramGrant, programGrants } from '@/lib/permissions';
import type { QuantityUnit } from '@/lib/quantity';

const RIGHT = RIGHTS.stockCardsView;

const NO_DIALOGS = {} satisfies Partial<StockOnHandSearch>;

/** Cards stack once the content is narrower than the table needs. */
const TABLE_MIN_WIDTH = 768;

export const Route = createFileRoute('/(protected)/_protected/stock-management/stock-on-hand')({
  validateSearch: stockOnHandSearchSchema,
  // The inactive box only filters the page shown, so it never reloads.
  loaderDeps: ({ search: { includeInactive: _includeInactive, ...search } }) => ({ search }),
  loader: async ({ context: { queryClient }, deps: { search } }) => {
    const permissions = await requirePermissions(queryClient, RIGHT);
    const userId = useLoginData.getState().referenceDataUserId;
    const selection = {
      mode: search.mode,
      programId: search.programId,
      facilityId: search.facilityId,
    };
    if (!userId || !isCompleteSelection(selection)) return;
    if (!hasProgramGrant(permissions, RIGHT, selection.facilityId, selection.programId)) return;
    try {
      const options = await loadFacilityProgramOptions(
        queryClient,
        userId,
        programGrants(permissions, RIGHT),
      );
      if (!validSelection(selection, options)) return;
    } catch {
      // The picker shows the failure with a retry; no stock loads for a selection not checked.
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

function StockOnHandPending() {
  return (
    <Workspace>
      <StockOnHandHeader />
      <WorkspaceContent>
        <FacilityProgramSelectorSkeleton />
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
  const [measureContent, contentWidth] = useElementWidth<HTMLDivElement>();
  const layout: ResultsLayout =
    contentWidth === undefined || contentWidth >= TABLE_MIN_WIDTH ? 'table' : 'cards';

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
            pendingFallback={<FacilityProgramSelectorSkeleton />}
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
  grants: ReturnType<typeof programGrants>;
  search: StockOnHandSearch;
  layout: ResultsLayout;
  onSearchChange: ReturnType<typeof useSearchNavigation<StockOnHandSearch>>['updateSearch'];
};

const selectionKey = (selection: FacilityProgramSelection) =>
  [selection.mode, selection.programId, selection.facilityId].join('|');

function StockOnHandBody({ userId, grants, search, layout, onSearchChange }: StockOnHandBodyProps) {
  const queryClient = useQueryClient();
  const options = useFacilityProgramOptions(userId, grants);
  const applied = useMemo(
    () => ({ mode: search.mode, programId: search.programId, facilityId: search.facilityId }),
    [search.mode, search.programId, search.facilityId],
  );
  const valid = validSelection(applied, options);
  const [draft, setDraft] = useState<FacilityProgramSelection | null>(null);
  const [draftFor, setDraftFor] = useState(selectionKey(applied));
  if (draftFor !== selectionKey(applied)) {
    setDraftFor(selectionKey(applied));
    setDraft(null);
  }
  const pending = valid !== null && draft !== null && selectionKey(draft) !== selectionKey(valid);

  const onSearch = useCallback(
    (selection: CompleteSelection) => {
      setDraft(null);
      if (selectionKey(selection) === selectionKey(applied)) {
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
  return (
    <StockOnHandList
      facility={named(options, valid, 'facility')}
      layout={layout}
      onSearchChange={onSearchChange}
      program={named(options, valid, 'program')}
      search={search}
      selection={valid}
      userId={userId}
    />
  );
}

function named(
  options: FacilityProgramOptions,
  { mode, programId, facilityId }: CompleteSelection,
  kind: 'facility' | 'program',
): NamedRecord | undefined {
  if (kind === 'facility') {
    return options.facilitiesFor(programId).find((facility) => facility.id === facilityId);
  }
  const programs = mode === 'my' ? options.myPrograms : options.supervisedPrograms;
  return programs.find((program) => program.id === programId);
}

type StockOnHandListProps = {
  userId: string;
  search: StockOnHandSearch;
  selection: CompleteSelection;
  facility: NamedRecord | undefined;
  program: NamedRecord | undefined;
  layout: ResultsLayout;
  onSearchChange: StockOnHandBodyProps['onSearchChange'];
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
  const label = (record: NamedRecord | undefined) => record?.name || record?.code || '';

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
  query: ReturnType<typeof toSummariesQuery>;
};

/** Downloads the whole facility and program's report, after checking the right is still held there. */
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
          facility: facility?.name ?? facility?.code ?? '',
          program: program?.name ?? program?.code ?? '',
        }),
      });
    },
    onError: (error) => {
      toast.error(t('stock-on-hand.print-error-title'), {
        description: serverMessage(error) ?? t('stock-on-hand.error-description'),
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
