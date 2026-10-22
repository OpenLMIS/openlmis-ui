import { useStore } from '@tanstack/react-form';
import { queryOptions, useQuery, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import type { ErrorComponentProps } from '@tanstack/react-router';
import { createColumnHelper, useTable } from '@tanstack/react-table';
import { ClipboardListIcon } from 'lucide-react';
import {
  type ReactNode,
  useCallback,
  useDeferredValue,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  DataTableEmpty,
  type DataTableFeatures,
  dataTableFeatures,
} from '@/components/data-table/data-table';
import { DataTablePagination } from '@/components/data-table/data-table-pagination';
import { DiscardChangesDialog } from '@/components/discard-changes-dialog';
import {
  FormDialog,
  FormDialogBody,
  FormDialogCancel,
  FormDialogFooter,
  FormDialogHeader,
  FormDialogTitle,
} from '@/components/form-dialog/form-dialog';
import { useDialogTarget } from '@/components/form-dialog/use-dialog-target';
import { LoadError } from '@/components/load-error';
import { QueryBoundary } from '@/components/query-boundary';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Progress, ProgressLabel, ProgressValue } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { validReasonsOptions } from '@/features/reference-data/api/queries';
import { productName } from '@/features/reference-data/lib/product-name';
import { deactivateInventoryStockCard } from '@/features/stock-events/api/physical-inventory-api';
import {
  eligibleInventoryProductsOptions,
  inventoryRefreshFilters,
  inventoryStockLinesOptions,
} from '@/features/stock-events/api/physical-inventory-queries';
import { InventoryActions } from '@/features/stock-events/components/inventory-actions';
import { InventoryAddProductsDialog } from '@/features/stock-events/components/inventory-add-products-dialog';
import { InventoryDeactivateDialog } from '@/features/stock-events/components/inventory-deactivate-dialog';
import { InventoryEditLotDialog } from '@/features/stock-events/components/inventory-edit-lot-dialog';
import { InventoryReasonsDialog } from '@/features/stock-events/components/inventory-reasons-dialog';
import { InventorySaveIndicator } from '@/features/stock-events/components/inventory-save-indicator';
import { InventoryScan } from '@/features/stock-events/components/inventory-scan';
import {
  inventoryHideableColumns,
  PhysicalInventoryGrid,
} from '@/features/stock-events/components/physical-inventory-grid';
import {
  InventoryToolbar,
  PhysicalInventoryPendingBody,
} from '@/features/stock-events/components/physical-inventory-pending';
import { usePhysicalInventoryAutosave } from '@/features/stock-events/hooks/use-physical-inventory-autosave';
import {
  type PhysicalInventoryForm,
  usePhysicalInventoryForm,
} from '@/features/stock-events/hooks/use-physical-inventory-form';
import { inventoryLineError } from '@/features/stock-events/lib/physical-inventory-form';
import { inventoryFormats } from '@/features/stock-events/lib/physical-inventory-format';
import {
  buildInventoryLines,
  eligibleInventoryLines,
  filterInventoryLines,
  INVENTORY_PAGE_SIZE,
  inventoryFirstInvalid,
  inventoryGroups,
  inventoryLocalCopy,
  inventoryPage,
  inventoryPageOf,
  inventoryProgress,
  inventoryStructureEqual,
} from '@/features/stock-events/lib/physical-inventory-lines';
import {
  type InventoryLocalCopy,
  inventoryReference,
  readInventoryLocal,
} from '@/features/stock-events/lib/physical-inventory-local';
import {
  canDeactivateInventoryLine,
  inventoryOptionalColumns,
  inventoryReasons,
} from '@/features/stock-events/lib/physical-inventory-products';
import type { InventorySearch } from '@/features/stock-events/lib/physical-inventory-search';
import type {
  InventoryLine,
  InventoryProductGroup,
  InventoryStockLine,
  PhysicalInventoryDraft,
} from '@/features/stock-events/lib/physical-inventory-types';
import { columnChoicesSchema, useCardLayout } from '@/hooks/use-card-view';
import { useDiscardGuard } from '@/hooks/use-discard-guard';
import { useFitColumnVisibility } from '@/hooks/use-fit-column-visibility';
import { useOpening } from '@/hooks/use-opening';
import { usePageStart } from '@/hooks/use-page-start';
import { useQuantityUnit } from '@/hooks/use-quantity-unit';
import { useSessionMutation } from '@/hooks/use-session-mutation';
import { useStoredState } from '@/hooks/use-stored-state';
import { useFlag } from '@/lib/feature-flags';
import { isRefused } from '@/lib/http';
import { queryKeys } from '@/lib/key-factory';
import { useOnline } from '@/lib/online';
import { reportCaughtError } from '@/lib/report-error';
import { revealField } from '@/lib/reveal-field';
import { type SearchChange, useTableSearchState } from '@/lib/table-search';

const NO_SORT = { id: 'product', desc: false };
const helper = createColumnHelper<DataTableFeatures, InventoryProductGroup>();
const columns = helper.columns([helper.display({ id: 'product' })]);
type Props = {
  userId: string;
  username: string;
  onDeleted: () => void | Promise<void>;
  onSubmitted: () => void | Promise<void>;
  right: string;
  facilityTypeId: string;
  canManageLots: boolean;
  draft: PhysicalInventoryDraft;
  eligibleUpdatedAfter?: number;
  search: InventorySearch;
  onSearchChange: SearchChange<InventorySearch>;
};

export function PhysicalInventoryEditor(props: Props) {
  const { i18n } = useTranslation();
  const quantityUnit = useQuantityUnit();
  const [addOpen, setAddOpen] = useState(false);
  const [progressSlot, setProgressSlot] = useState<HTMLDivElement | null>(null);
  const [saveSlot, setSaveSlot] = useState<HTMLDivElement | null>(null);
  const region = useRef<HTMLDivElement>(null);
  const { measure, width, cards } = useCardLayout<HTMLDivElement>();
  const measureRegion = useCallback(
    (element: HTMLDivElement | null) => {
      region.current = element;
      measure(element);
    },
    [measure],
  );
  const choices = useStoredState('physical-inventory.columns', columnChoicesSchema, {});
  const queryClient = useQueryClient();
  const [optionalColumns, setOptionalColumns] = useState(() => {
    const stock = queryClient.getQueryData(inventoryStockLinesOptions(props.draft).queryKey) ?? [];
    const eligible =
      queryClient.getQueryData(eligibleInventoryProductsOptions(props.draft).queryKey) ?? [];
    return inventoryOptionalColumns(eligible, buildInventoryLines(stock, props.draft.lineItems));
  });
  const onOptionalColumns = useCallback((showVvm: boolean, showActions: boolean) => {
    setOptionalColumns((previous) =>
      previous.showVvm === showVvm && previous.showActions === showActions
        ? previous
        : { showVvm, showActions },
    );
  }, []);
  const view = useFitColumnVisibility(
    inventoryHideableColumns({ ...optionalColumns, unit: quantityUnit.unit }, choices[0]),
    choices,
    region,
    cards ? undefined : width,
    `${optionalColumns.showVvm}/${optionalColumns.showActions}/${quantityUnit.unit}/${i18n.language}`,
    !cards,
  );
  const pendingBody = (
    <PhysicalInventoryPendingBody
      search={props.search}
      draft={props.draft}
      visibility={view.visibility}
      {...optionalColumns}
      quantityUnit={quantityUnit}
    />
  );
  return (
    <div className="flex min-w-0 flex-col gap-4" ref={measureRegion}>
      <QueryBoundary
        errorComponent={InventoryLoadError}
        pendingFallback={pendingBody}
        resetKey={props.draft.id}
      >
        <InventoryRows
          {...props}
          toolbar={
            <InventoryToolbar
              search={props.search}
              onSearchChange={props.onSearchChange}
              view={view}
              cards={cards}
              quantityUnit={quantityUnit}
              onAdd={() => setAddOpen(true)}
              progress={<div ref={setProgressSlot} />}
              save={<div ref={setSaveSlot} />}
            />
          }
          pendingBody={pendingBody}
          progressSlot={progressSlot}
          saveSlot={saveSlot}
          visibility={view.visibility}
          cards={cards}
          onOptionalColumns={onOptionalColumns}
          quantityUnit={quantityUnit}
          addOpen={addOpen}
          onAddClose={() => setAddOpen(false)}
        />
      </QueryBoundary>
    </div>
  );
}

type ToolbarSlots = {
  progressSlot: HTMLDivElement | null;
  saveSlot: HTMLDivElement | null;
};

type RowsProps = Props &
  ToolbarSlots & {
    toolbar: ReactNode;
    pendingBody: ReactNode;
    visibility: Record<string, boolean>;
    cards: boolean;
    onOptionalColumns: (showVvm: boolean, showActions: boolean) => void;
    quantityUnit: ReturnType<typeof useQuantityUnit>;
    addOpen: boolean;
    onAddClose: () => void;
  };
function InventoryRows(props: RowsProps) {
  const stockQuery = useSuspenseQuery(
    inventoryStockLinesOptions(props.draft, props.eligibleUpdatedAfter),
  );
  if (
    stockQuery.isError &&
    !stockQuery.isFetching &&
    stockQuery.dataUpdatedAt < (props.eligibleUpdatedAfter ?? 0)
  )
    throw stockQuery.error;
  const { data: stock } = stockQuery;
  const opening = useOpening();
  const [loaded, setLoaded] = useState<InventoryLocalCopy | null>();
  const [loadKey, setLoadKey] = useState(0);
  const local = useQuery(
    queryOptions({
      queryKey: [...queryKeys.physicalInventories.detail(props.draft.id), 'local', opening],
      queryFn: async () => (await readInventoryLocal(props.draft.id)) ?? null,
      staleTime: Infinity,
      gcTime: 0,
      refetchOnWindowFocus: false,
      retry: false,
    }),
  );
  if (local.isPending || stockQuery.dataUpdatedAt < (props.eligibleUpdatedAfter ?? 0))
    return props.pendingBody;
  const currentCopy = loaded === undefined ? local.data : loaded;
  return (
    <>
      {props.toolbar}
      <InventoryDraftRows
        {...props}
        key={loadKey}
        onAdopt={(copy) => {
          setLoaded(copy ?? null);
          setLoadKey((key) => key + 1);
        }}
        stock={stock}
        localLines={currentCopy?.modified ? currentCopy.lines : undefined}
        localFailed={local.isError}
        localRemoved={currentCopy?.modified ? (currentCopy.removedKeys ?? []) : []}
        localModified={Boolean(currentCopy?.modified)}
        localRevision={currentCopy?.revision}
      />
    </>
  );
}

function InventoryDraftRows({
  progressSlot,
  saveSlot,
  draft,
  search,
  onSearchChange,
  visibility,
  cards,
  onOptionalColumns,
  stock,
  localLines,
  localFailed,
  localRemoved,
  localModified,
  localRevision,
  onAdopt,
  quantityUnit,
  addOpen,
  onAddClose,
  facilityTypeId,
  canManageLots,
  right,
  userId,
  username,
  onDeleted,
  onSubmitted,
  eligibleUpdatedAfter,
}: RowsProps & {
  stock: InventoryStockLine[];
  localLines?: InventoryLine[];
  localFailed: boolean;
  localRemoved: string[];
  localModified: boolean;
  localRevision?: number;
  onAdopt: (copy: InventoryLocalCopy | undefined) => void;
}) {
  const { t, i18n } = useTranslation();
  const [entryUpdatedAfter] = useState(eligibleUpdatedAfter);
  const scanning = useFlag('GS1_SCANNING');
  const eligible = useQuery(eligibleInventoryProductsOptions(draft, entryUpdatedAfter));
  const reasonsQuery = useQuery(
    validReasonsOptions({ program: draft.programId, facilityType: facilityTypeId }),
  );
  const reasons = useMemo(() => inventoryReasons(reasonsQuery.data ?? []), [reasonsQuery.data]);
  const [baseline, setBaseline] = useState(() => buildInventoryLines(stock, draft.lineItems));
  const [busy, setBusy] = useState(false);
  const [actionDialog, setActionDialog] = useState(false);
  const [readFailed, setReadFailed] = useState(localFailed);
  const [submitted, setSubmitted] = useState(false);
  const [validationAttempted, setValidationAttempted] = useState(false);
  const [unchecked, setUnchecked] = useState<ReadonlySet<string>>(() => new Set());
  const onCounted = useCallback(
    (key: string) =>
      setUnchecked((current) => {
        if (!current.has(key)) return current;
        const next = new Set(current);
        next.delete(key);
        return next;
      }),
    [],
  );
  const [focusTarget, setFocusTarget] = useState<{ key: string; page?: number } | null>(null);
  const region = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const [formLines, setFormLines] = useState(() =>
    buildInventoryLines(stock, draft.lineItems, localLines, localRemoved),
  );
  const form = usePhysicalInventoryForm(formLines, validationAttempted);
  const deferred = useDeferredValue(search);
  const formatDate = inventoryFormats(i18n.language).date;
  const noLotLabel = t('stock-events.no-lot-defined');
  const allLines = useStore(
    form.store,
    (state) => Object.values(state.values.lines),
    (previous, next) => {
      if (!inventoryStructureEqual(previous, next)) return false;
      if (!deferred.keyword) return true;
      const before = filterInventoryLines(previous, deferred, formatDate, noLotLabel);
      const after = filterInventoryLines(next, deferred, formatDate, noLotLabel);
      return (
        before.length === after.length &&
        before.every((line, index) => line.key === after[index].key)
      );
    },
  );
  const displayedKeys = useRef(new Set<string>());
  const withDisplayedMembership = useCallback(
    (lines: InventoryLine[]) =>
      lines.map((line) =>
        displayedKeys.current.has(line.key) ? { ...line, isAdded: true } : line,
      ),
    [],
  );
  const getLines = useCallback(
    () =>
      withDisplayedMembership(
        eligibleInventoryLines(Object.values(form.state.values.lines), eligible.data),
      ),
    [form, eligible.data, withDisplayedMembership],
  );
  const [snapshot] = useState(() => ({ fetchedAt: Date.now(), generation: crypto.randomUUID() }));
  const [modified, setModified] = useState(localModified);
  const dirty = useStore(form.store, (state) => state.isDirty);
  useEffect(() => {
    if (dirty) setModified(true);
  }, [dirty]);
  const copy = useCallback(
    () =>
      !busy && !submitted && (modified || form.state.isDirty)
        ? inventoryLocalCopy(
            draft,
            withDisplayedMembership(Object.values(form.state.values.lines)),
            baseline,
            modified || form.state.isDirty,
            snapshot,
          )
        : null,
    [busy, submitted, modified, form, draft, baseline, withDisplayedMembership, snapshot],
  );
  const autosave = usePhysicalInventoryAutosave(copy, form, localRevision, onAdopt);
  const snapshotWritten = useRef(false);
  useEffect(() => {
    if (
      snapshotWritten.current ||
      !eligible.isSuccess ||
      eligible.isFetching ||
      eligible.dataUpdatedAt < (entryUpdatedAfter ?? 0) ||
      !reasonsQuery.isSuccess ||
      busy ||
      submitted
    )
      return;
    snapshotWritten.current = true;
    const value = inventoryLocalCopy(
      draft,
      withDisplayedMembership(Object.values(form.state.values.lines)),
      baseline,
      modified || form.state.isDirty,
      snapshot,
    );
    void autosave
      .write(value, inventoryReference({ ...value, ...snapshot }, eligible.data, reasons))
      .then(() => setReadFailed(false))
      .catch((error) => reportCaughtError(error, {}));
  }, [
    eligible.isSuccess,
    eligible.isFetching,
    eligible.dataUpdatedAt,
    entryUpdatedAfter,
    eligible.data,
    reasonsQuery.isSuccess,
    reasons,
    busy,
    submitted,
    draft,
    form,
    baseline,
    modified,
    snapshot,
    withDisplayedMembership,
    autosave.write,
  ]);
  const status = readFailed && !modified && !form.state.isDirty ? 'failed' : autosave.status;
  const allowLeave = useRef(false);
  const guard = useDiscardGuard(
    !submitted &&
      (modified || dirty) &&
      (status === 'saving' || status === 'failed' || status === 'conflict'),
    {
      allowLeave: () => allowLeave.current,
    },
  );
  const [dialog, setDialog] = useState<{
    type: 'reasons' | 'lot' | 'deactivate';
    line: InventoryLine;
  }>();
  const {
    shown: shownDialog,
    close: closeDialog,
    dialogProps,
  } = useDialogTarget(dialog, () => setDialog(undefined));
  const { open: dialogOpen, onOpenChangeComplete } = dialogProps();
  const dialogLine = useStore(form.store, (state) =>
    shownDialog ? (state.values.lines[shownDialog.line.key] ?? shownDialog.line) : undefined,
  );
  const online = useOnline();
  const mutation = useSessionMutation({
    retry: false,
    mutationFn: deactivateInventoryStockCard,
    onSuccess: () => {
      const line = dialogLine && form.state.values.lines[dialogLine.key];
      if (line) {
        focusAfterRemoval(line);
        displayedKeys.current.delete(line.key);
        patchLine(line.key, { active: false, isAdded: false });
      }
      for (const filter of [
        ...inventoryRefreshFilters(draft),
        { queryKey: queryKeys.stockCardSummaries.all },
        { queryKey: queryKeys.stockCards.all },
      ])
        void queryClient.invalidateQueries(filter);
      closeDialog();
      toast.success(t('physical-inventory.deactivated-title'), {
        description: t('physical-inventory.deactivated-description'),
      });
    },
    onError: () =>
      toast.error(t('physical-inventory.deactivate-error-title'), {
        description: t('physical-inventory.deactivate-error-description'),
      }),
  });
  const lines = useMemo(
    () => eligibleInventoryLines(allLines, eligible.data),
    [allLines, eligible.data],
  );
  const filtered = useMemo(
    () => filterInventoryLines(lines, deferred, formatDate, noLotLabel),
    [lines, deferred, formatDate, noLotLabel],
  );
  useLayoutEffect(() => {
    for (const line of filtered) displayedKeys.current.add(line.key);
  }, [filtered]);
  const page = useMemo(
    () => inventoryPage(filtered, draft.programId, deferred.page, deferred.size),
    [filtered, draft.programId, deferred.page, deferred.size],
  );
  const pageStart = usePageStart<HTMLUListElement>(
    `${page.page}:${deferred.size ?? INVENTORY_PAGE_SIZE}`,
    cards,
  );
  const onPagingChange = useCallback<SearchChange<InventorySearch>>(
    (update, replace) => onSearchChange(update, replace, pageStart.navigation),
    [onSearchChange, pageStart.navigation],
  );
  const tableState = useTableSearchState({
    search: { ...search, page: page.page },
    defaultSort: NO_SORT,
    defaultPageSize: INVENTORY_PAGE_SIZE,
    onSearchChange: onPagingChange,
  });
  const table = useTable({
    features: dataTableFeatures,
    columns,
    data: page.groups,
    rowCount: page.total,
    manualPagination: true,
    manualSorting: true,
    ...tableState,
    onPaginationChange: pageStart.onPaginationChange(tableState.onPaginationChange),
  });
  useEffect(() => {
    if (search === deferred && (search.page ?? 1) !== page.page)
      onSearchChange({ page: page.page === 1 ? undefined : page.page }, true);
  }, [search, deferred, page.page, onSearchChange]);
  const { showVvm, showActions } = inventoryOptionalColumns(eligible.data ?? [], lines);
  useLayoutEffect(() => {
    onOptionalColumns(showVvm, showActions);
  }, [showVvm, showActions, onOptionalColumns]);
  useEffect(() => {
    if (validationAttempted) void form.validate('change');
  }, [validationAttempted, form]);
  useEffect(() => {
    if (!focusTarget || actionDialog || search !== deferred) return;
    if (
      focusTarget.page !== undefined &&
      (search.keyword || (search.page ?? 1) !== focusTarget.page)
    )
      return;
    const element = region.current?.querySelector<HTMLInputElement>(
      `[data-inventory-key="${CSS.escape(focusTarget.key)}"] input`,
    );
    const target =
      element ??
      (focusTarget.key === '__table'
        ? (region.current?.querySelector<HTMLElement>(cards ? 'ul' : 'table') ?? region.current)
        : null);
    if (target) {
      revealField(target, cards);
      if (document.activeElement === target) setFocusTarget(null);
    }
  }, [focusTarget, actionDialog, search, deferred, cards]);
  const patchLine = useCallback(
    (key: string, patch: Partial<InventoryLine>) => {
      form.setFieldValue('lines', (current) =>
        current[key] ? { ...current, [key]: { ...current[key], ...patch } } : current,
      );
    },
    [form],
  );
  const focusAfterRemoval = useCallback((line: InventoryLine) => {
    const keys = [
      ...(region.current?.querySelectorAll<HTMLElement>('[data-inventory-key]') ?? []),
    ].map((element) => element.dataset.inventoryKey);
    const index = keys.indexOf(line.key);
    setFocusTarget({ key: keys[index + 1] ?? keys[index - 1] ?? '__table' });
  }, []);
  const onReasons = useCallback((line: InventoryLine) => setDialog({ type: 'reasons', line }), []);
  const onEditLot = useCallback((line: InventoryLine) => setDialog({ type: 'lot', line }), []);
  const onDeactivate = useCallback(
    (line: InventoryLine) => setDialog({ type: 'deactivate', line }),
    [],
  );
  const onRemove = useCallback(
    (line: InventoryLine) => {
      if (!line.justAdded) return;
      focusAfterRemoval(line);
      form.setFieldValue('lines', (current) => {
        const next = { ...current };
        delete next[line.key];
        return next;
      });
    },
    [form, focusAfterRemoval],
  );
  const hasFilters = search.keyword || search.includeInactive;
  const pending = mutation.isPending || busy || submitted;
  const editor = useMemo(
    () => ({
      form,
      unit: quantityUnit.unit,
      online,
      pending,
      validationAttempted,
      unchecked,
      onCounted,
      onReasons,
      onEditLot,
      onDeactivate,
      onRemove,
    }),
    [
      form,
      quantityUnit.unit,
      online,
      pending,
      validationAttempted,
      unchecked,
      onCounted,
      onReasons,
      onEditLot,
      onDeactivate,
      onRemove,
    ],
  );
  return (
    <div ref={region} tabIndex={-1} className="flex flex-col gap-4" aria-busy={search !== deferred}>
      {saveSlot && createPortal(<InventorySaveIndicator status={status} />, saveSlot)}
      {progressSlot &&
        createPortal(<InventoryCompletion form={form} lines={filtered} />, progressSlot)}
      {status === 'conflict' && (
        <Alert variant="warning">
          <AlertDescription>
            <p>{t('stock-events.draft-conflict')}</p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="warning"
                onClick={() => {
                  void autosave.loadLatest().catch((error) => {
                    reportCaughtError(error, {});
                    toast.error(t('physical-inventory.copy-error-title'), {
                      description: t('physical-inventory.copy-error-description'),
                    });
                  });
                }}
              >
                {t('physical-inventory.load-latest')}
              </Button>
              <Button
                variant="warning"
                onClick={() => {
                  const value = inventoryLocalCopy(
                    draft,
                    withDisplayedMembership(Object.values(form.state.values.lines)),
                    baseline,
                    true,
                    snapshot,
                  );
                  void autosave
                    .keepCounts(
                      value,
                      eligible.data && reasonsQuery.isSuccess
                        ? inventoryReference({ ...value, ...snapshot }, eligible.data, reasons)
                        : undefined,
                    )
                    .catch((error) => {
                      reportCaughtError(error, {});
                      toast.error(t('physical-inventory.copy-error-title'), {
                        description: t('physical-inventory.copy-error-description'),
                      });
                    });
                }}
              >
                {t('physical-inventory.keep-counts')}
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}
      {eligible.isError ? (
        <LoadError
          error={eligible.error}
          reset={() => {
            void eligible.refetch();
          }}
          title={t('physical-inventory.load-error-title')}
          description={t('physical-inventory.load-error-description')}
        />
      ) : null}
      {filtered.length ? (
        <PhysicalInventoryGrid
          cards={cards}
          listRef={pageStart.ref}
          bands={page.bands}
          visibility={visibility}
          showVvm={showVvm}
          showActions={showActions}
          editor={editor}
          footer={
            <InventoryPagination
              table={table}
              form={form}
              lines={filtered}
              validationAttempted={validationAttempted}
              includeInactive={Boolean(search.includeInactive)}
              size={deferred.size ?? INVENTORY_PAGE_SIZE}
            />
          }
        />
      ) : (
        <DataTableEmpty
          title={t(hasFilters ? 'stock-events.no-matches-title' : 'physical-inventory.empty-title')}
          description={t(
            hasFilters
              ? 'stock-events.no-matches-description'
              : 'physical-inventory.empty-description',
          )}
          icon={<ClipboardListIcon />}
          action={
            hasFilters ? (
              <Button
                variant="outline"
                onClick={() =>
                  onSearchChange({
                    keyword: undefined,
                    includeInactive: undefined,
                    page: undefined,
                  })
                }
              >
                {t('stock-on-hand.clear-filters')}
              </Button>
            ) : undefined
          }
        />
      )}
      {scanning && eligible.data && (
        <InventoryScan
          eligible={eligible.data}
          getLines={() => Object.values(form.state.values.lines)}
          canManageLots={canManageLots}
          paused={
            busy || submitted || mutation.isPending || addOpen || !!shownDialog || actionDialog
          }
          onCount={(line) => {
            onCounted(line.key);
            form.setFieldValue('lines', (current) => ({ ...current, [line.key]: line }));
            const target = inventoryPageOf(
              filterInventoryLines(
                [...lines.filter((item) => item.key !== line.key), line],
                { includeInactive: search.includeInactive },
                String,
              ),
              line,
              search.size,
            );
            onSearchChange({ keyword: undefined, page: target === 1 ? undefined : target }, true);
          }}
        />
      )}
      <InventoryActions
        draft={draft}
        eligibleUpdatedAfter={entryUpdatedAfter}
        right={right}
        baseline={baseline}
        getLines={getLines}
        displayed={filtered}
        includeInactive={Boolean(search.includeInactive)}
        userId={userId}
        username={username}
        showInDoses={quantityUnit.unit === 'DOSES'}
        disabled={busy || mutation.isPending}
        writeDisabled={!eligible.data || eligible.isError || status === 'conflict'}
        flush={autosave.flush}
        writeLocal={autosave.write}
        clearLocal={autosave.clear}
        onBusy={setBusy}
        onLots={(next) =>
          form.setFieldValue('lines', Object.fromEntries(next.map((line) => [line.key, line])))
        }
        onDialogChange={setActionDialog}
        onSaved={(next, terminal, localSaved) => {
          allowLeave.current = terminal;
          setSubmitted(terminal);
          setReadFailed(false);
          if (terminal || localSaved) autosave.reset();
          setFormLines(next);
          setBaseline(next);
          setModified(false);
          form.reset({ lines: Object.fromEntries(next.map((line) => [line.key, line])) });
        }}
        onInvalid={(invalid) => {
          setValidationAttempted(true);
          const currentLines = getLines();
          const includeInactive = Boolean(search.includeInactive);
          const visibleInvalid = inventoryFirstInvalid(
            currentLines,
            invalid,
            draft.programId,
            includeInactive,
            search.size,
          );
          const first = visibleInvalid ?? invalid[0];
          const targetPage = inventoryPageOf(
            filterInventoryLines(currentLines, { includeInactive }, String),
            first,
            search.size,
          );
          setFocusTarget({ key: first.key, page: targetPage });
          onSearchChange(
            {
              keyword: undefined,
              page: targetPage === 1 ? undefined : targetPage,
            },
            true,
          );
        }}
        onDeleted={async () => {
          allowLeave.current = true;
          setSubmitted(true);
          await onDeleted();
        }}
        onSubmitted={async () => {
          allowLeave.current = true;
          setSubmitted(true);
          await onSubmitted();
        }}
      />
      {addOpen && (
        <InventoryAddProductsDialog
          eligible={eligible.data}
          error={eligible.error}
          onRetry={() => {
            void eligible.refetch();
          }}
          listed={getLines()}
          canManageLots={canManageLots}
          unit={quantityUnit.unit}
          onClose={onAddClose}
          onAdd={(added) => {
            setUnchecked((current) => new Set([...current, ...added.map((line) => line.key)]));
            form.setFieldValue('lines', (current) => ({
              ...current,
              ...Object.fromEntries(added.map((line) => [line.key, line])),
            }));
            onAddClose();
            onSearchChange({ keyword: undefined, page: undefined }, true);
          }}
        />
      )}
      {shownDialog?.type === 'reasons' &&
        dialogLine &&
        (reasonsQuery.isSuccess ? (
          <InventoryReasonsDialog
            key={dialogLine.key}
            open={dialogOpen}
            onOpenChangeComplete={onOpenChangeComplete}
            line={dialogLine}
            cards={cards}
            reasons={reasons}
            unit={quantityUnit.unit}
            onClose={closeDialog}
            onUpdate={(adjustments) => {
              if (!closeDialog()) return;
              onCounted(dialogLine.key);
              patchLine(dialogLine.key, { stockAdjustments: adjustments });
            }}
          />
        ) : (
          <FormDialog {...dialogProps()}>
            <FormDialogHeader>
              <FormDialogTitle>
                {t('physical-inventory.reasons-title', {
                  product: productName(dialogLine.orderable),
                })}
              </FormDialogTitle>
            </FormDialogHeader>
            <FormDialogBody>
              {reasonsQuery.isError ? (
                <LoadError
                  error={reasonsQuery.error}
                  reset={() => {
                    void reasonsQuery.refetch();
                  }}
                  title={t('stock-events.reasons-error-title')}
                  description={t('stock-events.reasons-error-description')}
                />
              ) : (
                <div className="h-20">
                  <Skeleton fill />
                </div>
              )}
            </FormDialogBody>
            <FormDialogFooter>
              <FormDialogCancel>{t('stock-events.cancel')}</FormDialogCancel>
            </FormDialogFooter>
          </FormDialog>
        ))}
      {shownDialog?.type === 'lot' && dialogLine?.newLot && (
        <InventoryEditLotDialog
          key={dialogLine.key}
          open={dialogOpen}
          onOpenChangeComplete={onOpenChangeComplete}
          line={dialogLine}
          listed={[...(eligible.data ?? []), ...getLines()]}
          onClose={closeDialog}
          onUpdate={(lot) => {
            if (closeDialog()) patchLine(dialogLine.key, { newLot: lot });
          }}
        />
      )}
      {shownDialog?.type === 'deactivate' && dialogLine && (
        <InventoryDeactivateDialog
          open={dialogOpen}
          onOpenChangeComplete={onOpenChangeComplete}
          line={dialogLine}
          online={online}
          pending={mutation.isPending}
          onClose={closeDialog}
          onConfirm={() => {
            if (
              dialogOpen &&
              dialogLine.stockCardId &&
              canDeactivateInventoryLine(dialogLine, online)
            )
              mutation.mutate(dialogLine.stockCardId);
          }}
        />
      )}
      <DiscardChangesDialog {...guard.dialog} description={t('stock-events.discard-description')} />
    </div>
  );
}

function InventoryPagination({
  table,
  form,
  lines,
  validationAttempted,
  includeInactive,
  size,
}: {
  table: Parameters<typeof DataTablePagination<InventoryProductGroup>>[0]['table'];
  form: ReturnType<typeof usePhysicalInventoryForm>;
  lines: readonly InventoryLine[];
  validationAttempted: boolean;
  includeInactive: boolean;
  size: number;
}) {
  const invalid = useStore(
    form.store,
    (state) =>
      Object.values(state.values.lines)
        .filter(
          (line) =>
            (includeInactive || !(!line.active && line.stockOnHand === 0)) &&
            inventoryLineError(line),
        )
        .map((line) => line.key),
    (previous, next) => previous.join() === next.join(),
  );
  const keys = new Set(invalid);
  const groups = useMemo(() => inventoryGroups(lines), [lines]);
  return (
    <DataTablePagination
      table={table}
      isPageInvalid={(index) =>
        validationAttempted &&
        groups
          .slice(index * size, (index + 1) * size)
          .some((group) => group.lines.some((line) => keys.has(line.key)))
      }
    />
  );
}

function InventoryLoadError({ error, reset }: ErrorComponentProps) {
  const { t } = useTranslation();
  if (isRefused(error))
    return (
      <DataTableEmpty
        title={t('physical-inventory.no-stock-view-title')}
        description={t('physical-inventory.no-stock-view-description', {
          right: t('rights.stock-cards-view'),
        })}
      />
    );
  return (
    <LoadError
      error={error}
      reset={reset}
      title={t('physical-inventory.load-error-title')}
      description={t('physical-inventory.load-error-description')}
    />
  );
}

function InventoryCompletion({
  form,
  lines,
}: {
  form: PhysicalInventoryForm;
  lines: readonly InventoryLine[];
}) {
  const { t } = useTranslation();
  const total = useMemo(() => new Set(lines.map((line) => line.orderable.id)).size, [lines]);
  const count = useStore(
    form.store,
    (state) =>
      inventoryProgress(lines.map((line) => state.values.lines[line.key]).filter(Boolean)).count,
  );
  return (
    <Progress layout="compact" value={total ? (count / total) * 100 : 0}>
      <ProgressLabel>{t('physical-inventory.progress', { count, total })}</ProgressLabel>
      <ProgressValue />
    </Progress>
  );
}
