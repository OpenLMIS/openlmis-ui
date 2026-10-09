import { useStore } from '@tanstack/react-form';
import { queryOptions, useQuery, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import type { ErrorComponentProps } from '@tanstack/react-router';
import { createColumnHelper, useTable } from '@tanstack/react-table';
import { ClipboardListIcon } from 'lucide-react';
import {
  useCallback,
  useDeferredValue,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';
import {
  DataTableEmpty,
  type DataTableFeatures,
  DataTableFooter,
  DataTableToolbar,
  dataTableFeatures,
} from '@/components/data-table/data-table';
import { DataTablePagination } from '@/components/data-table/data-table-pagination';
import { DataTableViewOptions } from '@/components/data-table/data-table-view-options';
import { useColumnVisibility, useElementWidth } from '@/components/data-table/responsive-columns';
import { DiscardChangesDialog } from '@/components/discard-changes-dialog';
import {
  FormDialog,
  FormDialogBody,
  FormDialogCancel,
  FormDialogFooter,
  FormDialogHeader,
  FormDialogTitle,
} from '@/components/form-dialog/form-dialog';
import { LoadError } from '@/components/load-error';
import { QuantityUnitToggle } from '@/components/quantity-unit-toggle';
import { QueryBoundary } from '@/components/query-boundary';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress, ProgressLabel } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { validReasonsOptions } from '@/features/reference-data/api/queries';
import { productName } from '@/features/reference-data/lib/product-name';
import { deactivateInventoryStockCard } from '@/features/stock-events/api/physical-inventory-api';
import {
  eligibleInventoryProductsOptions,
  inventoryStockLinesOptions,
} from '@/features/stock-events/api/physical-inventory-queries';
import { InventoryActions } from '@/features/stock-events/components/inventory-actions';
import { InventoryAddProductsDialog } from '@/features/stock-events/components/inventory-add-products-dialog';
import { InventoryDeactivateDialog } from '@/features/stock-events/components/inventory-deactivate-dialog';
import { InventoryEditLotDialog } from '@/features/stock-events/components/inventory-edit-lot-dialog';
import { InventoryReasonsDialog } from '@/features/stock-events/components/inventory-reasons-dialog';
import { InventoryScan } from '@/features/stock-events/components/inventory-scan';
import {
  INVENTORY_HIDEABLE_COLUMNS,
  inventoryHideableColumns,
  PhysicalInventoryGrid,
  PhysicalInventoryGridSkeleton,
} from '@/features/stock-events/components/physical-inventory-grid';
import { usePhysicalInventoryAutosave } from '@/features/stock-events/hooks/use-physical-inventory-autosave';
import { usePhysicalInventoryForm } from '@/features/stock-events/hooks/use-physical-inventory-form';
import { inventoryFormats } from '@/features/stock-events/lib/physical-inventory-format';
import {
  buildInventoryLines,
  eligibleInventoryLines,
  filterInventoryLines,
  INVENTORY_PAGE_SIZE,
  inventoryFirstInvalid,
  inventoryLocalCopy,
  inventoryPage,
  inventoryPageOf,
  inventoryProgress,
} from '@/features/stock-events/lib/physical-inventory-lines';
import { readInventoryLocal } from '@/features/stock-events/lib/physical-inventory-local';
import {
  canDeactivateInventoryLine,
  inventoryReasons,
} from '@/features/stock-events/lib/physical-inventory-products';
import type { InventorySearch } from '@/features/stock-events/lib/physical-inventory-search';
import type {
  InventoryLine,
  InventoryProductGroup,
  InventoryStockLine,
  PhysicalInventoryDraft,
} from '@/features/stock-events/lib/physical-inventory-types';
import { useDiscardGuard } from '@/hooks/use-discard-guard';
import { useQuantityUnit } from '@/hooks/use-quantity-unit';
import { useSessionMutation } from '@/hooks/use-session-mutation';
import { useStoredState } from '@/hooks/use-stored-state';
import { useFlag } from '@/lib/feature-flags';
import { isRefused } from '@/lib/http';
import { queryKeys } from '@/lib/key-factory';
import { useOnline } from '@/lib/online';
import { type SearchChange, useTableSearchState } from '@/lib/table-search';

const choicesSchema = z.record(z.string(), z.boolean());
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
  search: InventorySearch;
  onSearchChange: SearchChange<InventorySearch>;
};

export function PhysicalInventoryEditor(props: Props) {
  const { t } = useTranslation();
  const inactiveId = useId();
  const quantityUnit = useQuantityUnit();
  const [addOpen, setAddOpen] = useState(false);
  const [measure, width] = useElementWidth<HTMLDivElement>();
  const choices = useStoredState('physical-inventory.columns', choicesSchema, {});
  const [optionalColumns, setOptionalColumns] = useState({ showVvm: false, showActions: false });
  const onOptionalColumns = useCallback((showVvm: boolean, showActions: boolean) => {
    setOptionalColumns((previous) =>
      previous.showVvm === showVvm && previous.showActions === showActions
        ? previous
        : { showVvm, showActions },
    );
  }, []);
  const view = useColumnVisibility(
    inventoryHideableColumns({ ...optionalColumns, unit: quantityUnit.unit }, choices[0]),
    choices,
    width,
  );
  return (
    <div className="flex flex-col gap-4" ref={measure}>
      <DataTableToolbar>
        <div className="w-full @2xl/main:w-72">
          <Input
            aria-label={t('stock-events.keywords')}
            placeholder={t('stock-events.keywords')}
            maxLength={50}
            value={props.search.keyword ?? ''}
            onChange={(event) =>
              props.onSearchChange(
                { keyword: event.target.value || undefined, page: undefined },
                true,
              )
            }
          />
        </div>
        <label htmlFor={inactiveId} className="flex items-center gap-2 text-sm">
          <Switch
            id={inactiveId}
            checked={props.search.includeInactive ?? false}
            onCheckedChange={(checked) =>
              props.onSearchChange({ includeInactive: checked || undefined, page: undefined })
            }
          />
          {t('physical-inventory.include-inactive')}
        </label>
        <div className="ms-auto flex flex-wrap items-center gap-2">
          {quantityUnit.canSwitch && (
            <QuantityUnitToggle unit={quantityUnit.unit} onUnitChange={quantityUnit.setUnit} />
          )}
          <div className="shrink-0">
            <DataTableViewOptions
              columns={INVENTORY_HIDEABLE_COLUMNS.map((column) => ({
                id: column.id,
                label: t(column.labelKey),
              }))}
              {...view}
            />
          </div>
        </div>
        <Button onClick={() => setAddOpen(true)}>{t('physical-inventory.add-product')}</Button>
      </DataTableToolbar>
      <QueryBoundary
        errorComponent={InventoryLoadError}
        pendingFallback={
          <PhysicalInventoryGridSkeleton
            visibility={view.visibility}
            {...optionalColumns}
            unit={quantityUnit.unit}
          />
        }
        resetKey={props.draft.id}
      >
        <InventoryRows
          {...props}
          visibility={view.visibility}
          onOptionalColumns={onOptionalColumns}
          quantityUnit={quantityUnit}
          addOpen={addOpen}
          onAddClose={() => setAddOpen(false)}
        />
      </QueryBoundary>
    </div>
  );
}

type RowsProps = Props & {
  visibility: Record<string, boolean>;
  onOptionalColumns: (showVvm: boolean, showActions: boolean) => void;
  quantityUnit: ReturnType<typeof useQuantityUnit>;
  addOpen: boolean;
  onAddClose: () => void;
};
function InventoryRows(props: RowsProps) {
  const { data: stock } = useSuspenseQuery(inventoryStockLinesOptions(props.draft));
  const [opening] = useState(() => crypto.randomUUID());
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
  if (local.isPending)
    return (
      <PhysicalInventoryGridSkeleton
        visibility={props.visibility}
        unit={props.quantityUnit.unit}
        showVvm={stock.some((line) => line.orderable.extraData?.useVVM === 'true')}
        showActions={buildInventoryLines(stock, props.draft.lineItems).some(
          (line) => line.justAdded || canDeactivateInventoryLine(line, true),
        )}
      />
    );
  return (
    <InventoryDraftRows
      {...props}
      stock={stock}
      localLines={local.data?.modified ? local.data.lines : []}
      localFailed={local.isError}
      localRemoved={local.data?.modified ? (local.data.removedKeys ?? []) : []}
      localModified={Boolean(local.data?.modified)}
    />
  );
}

function InventoryDraftRows({
  draft,
  search,
  onSearchChange,
  visibility,
  onOptionalColumns,
  stock,
  localLines,
  localFailed,
  localRemoved,
  localModified,
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
}: RowsProps & {
  stock: InventoryStockLine[];
  localLines: InventoryLine[];
  localFailed: boolean;
  localRemoved: string[];
  localModified: boolean;
}) {
  const { t, i18n } = useTranslation();
  const scanning = useFlag('GS1_SCANNING');
  const eligible = useQuery(
    eligibleInventoryProductsOptions({ programId: draft.programId, facilityId: draft.facilityId }),
  );
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
  const [focusKey, setFocusKey] = useState<string | null>(null);
  const region = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const [formLines, setFormLines] = useState(() =>
    buildInventoryLines(stock, draft.lineItems, localLines, localRemoved),
  );
  const form = usePhysicalInventoryForm(formLines, validationAttempted);
  const records = useStore(form.store, (state) => state.values.lines);
  const allLines = useMemo(() => Object.values(records), [records]);
  const [modified, setModified] = useState(localModified);
  const dirty = useStore(form.store, (state) => state.isDirty);
  useEffect(() => {
    if (dirty) setModified(true);
  }, [dirty]);
  const copy = useCallback(
    () =>
      !busy && !submitted && (modified || form.state.isDirty)
        ? inventoryLocalCopy(draft, allLines, baseline)
        : null,
    [busy, submitted, modified, form, draft, allLines, baseline],
  );
  const autosave = usePhysicalInventoryAutosave(copy);
  const status = readFailed && !modified && !form.state.isDirty ? 'failed' : autosave.status;
  const guard = useDiscardGuard(!submitted && (status === 'saving' || status === 'failed'));
  const [dialog, setDialog] = useState<{
    type: 'reasons' | 'lot' | 'deactivate';
    key: string;
  } | null>(null);
  const dialogLine = dialog ? records[dialog.key] : undefined;
  const online = useOnline();
  const mutation = useSessionMutation({
    retry: false,
    mutationFn: deactivateInventoryStockCard,
    onSuccess: () => {
      if (dialogLine) {
        focusAfterRemoval(dialogLine);
        patchLine(dialogLine.key, { active: false });
      }
      for (const queryKey of [
        queryKeys.physicalInventories.all,
        queryKeys.stockCardSummaries.all,
        queryKeys.stockCards.all,
      ])
        void queryClient.invalidateQueries({ queryKey });
      setDialog(null);
      toast.success(t('physical-inventory.deactivated-title'), {
        description: t('physical-inventory.deactivated-description'),
      });
    },
    onError: () =>
      toast.error(t('physical-inventory.deactivate-error-title'), {
        description: t('physical-inventory.deactivate-error-description'),
      }),
  });
  const deferred = useDeferredValue(search);
  const lines = useMemo(
    () => eligibleInventoryLines(allLines, eligible.data),
    [allLines, eligible.data],
  );
  const filtered = useMemo(
    () =>
      filterInventoryLines(
        lines,
        deferred,
        inventoryFormats(i18n.language).date,
        t('stock-events.no-lot-defined'),
      ),
    [lines, deferred, i18n.language, t],
  );
  const page = useMemo(
    () => inventoryPage(filtered, draft.programId, deferred.page, deferred.size),
    [filtered, draft.programId, deferred.page, deferred.size],
  );
  const progress = useMemo(() => inventoryProgress(filtered), [filtered]);
  const tableState = useTableSearchState({
    search: { ...search, page: page.page },
    defaultSort: NO_SORT,
    defaultPageSize: INVENTORY_PAGE_SIZE,
    onSearchChange,
  });
  const table = useTable({
    features: dataTableFeatures,
    columns,
    data: page.groups,
    rowCount: page.total,
    manualPagination: true,
    manualSorting: true,
    ...tableState,
  });
  useEffect(() => {
    if (search === deferred && (search.page ?? 1) !== page.page)
      onSearchChange({ page: page.page === 1 ? undefined : page.page }, true);
  }, [search, deferred, page.page, onSearchChange]);
  const showVvm = Boolean(
    eligible.data?.some((line) => line.orderable.extraData?.useVVM === 'true'),
  );
  const showActions = lines.some(
    (line) => line.justAdded || canDeactivateInventoryLine(line, true),
  );
  useLayoutEffect(() => {
    onOptionalColumns(showVvm, showActions);
  }, [showVvm, showActions, onOptionalColumns]);
  useEffect(() => {
    if (validationAttempted) void form.validate('change');
  }, [validationAttempted, form]);
  useEffect(() => {
    if (!focusKey || search !== deferred) return;
    // Let dialog and menu focus restoration finish before focusing a surviving row.
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => {
        const element = region.current?.querySelector<HTMLInputElement>(
          `[data-inventory-key="${CSS.escape(focusKey)}"] input`,
        );
        const target =
          element ??
          (focusKey === '__table'
            ? (region.current?.querySelector<HTMLTableElement>('table') ?? region.current)
            : null);
        if (target) {
          target.focus();
          setFocusKey(null);
        }
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [focusKey, search, deferred]);
  const patchLine = useCallback(
    (key: string, patch: Partial<InventoryLine>) => {
      form.setFieldValue('lines', (current) => ({
        ...current,
        [key]: { ...current[key], ...patch },
      }));
    },
    [form],
  );
  const focusAfterRemoval = useCallback((line: InventoryLine) => {
    const keys = [
      ...(region.current?.querySelectorAll<HTMLElement>('[data-inventory-key]') ?? []),
    ].map((element) => element.dataset.inventoryKey);
    const index = keys.indexOf(line.key);
    setFocusKey(keys[index + 1] ?? keys[index - 1] ?? '__table');
  }, []);
  const onReasons = useCallback(
    (line: InventoryLine) => setDialog({ type: 'reasons', key: line.key }),
    [],
  );
  const onEditLot = useCallback(
    (line: InventoryLine) => setDialog({ type: 'lot', key: line.key }),
    [],
  );
  const onDeactivate = useCallback(
    (line: InventoryLine) => setDialog({ type: 'deactivate', key: line.key }),
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
  const pending = mutation.isPending || busy || submitted;
  const editor = useMemo(
    () => ({
      form,
      unit: quantityUnit.unit,
      online,
      pending,
      validationAttempted,
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
      onReasons,
      onEditLot,
      onDeactivate,
      onRemove,
    ],
  );
  return (
    <div ref={region} tabIndex={-1} className="flex flex-col gap-4" aria-busy={search !== deferred}>
      <p role="status" className="text-sm text-muted-foreground">
        {t(
          status === 'saving'
            ? 'physical-inventory.saving'
            : status === 'failed'
              ? 'physical-inventory.not-saved-local'
              : 'physical-inventory.saved-local',
        )}
      </p>
      <Progress value={progress.total ? (progress.count / progress.total) * 100 : 0}>
        <ProgressLabel>{t('physical-inventory.progress', progress)}</ProgressLabel>
      </Progress>
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
        <>
          <PhysicalInventoryGrid
            bands={page.bands}
            visibility={visibility}
            showVvm={showVvm}
            showActions={showActions}
            editor={editor}
          />
          <DataTableFooter>
            <DataTablePagination table={table} />
          </DataTableFooter>
        </>
      ) : (
        <DataTableEmpty
          title={t(
            search.keyword || search.includeInactive
              ? 'stock-events.no-matches-title'
              : 'physical-inventory.empty-title',
          )}
          description={t(
            search.keyword || search.includeInactive
              ? 'stock-events.no-matches-description'
              : 'physical-inventory.empty-description',
          )}
          icon={<ClipboardListIcon />}
          action={
            search.keyword || search.includeInactive ? (
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
          paused={busy || submitted || mutation.isPending || addOpen || !!dialog || actionDialog}
          onCount={(line) => {
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
        right={right}
        baseline={baseline}
        lines={lines}
        displayed={filtered}
        userId={userId}
        username={username}
        showInDoses={quantityUnit.unit === 'DOSES'}
        disabled={busy || mutation.isPending || !eligible.data}
        flush={autosave.flush}
        onBusy={setBusy}
        onLots={(next) =>
          form.setFieldValue('lines', Object.fromEntries(next.map((line) => [line.key, line])))
        }
        onDialogChange={setActionDialog}
        onSaved={(next, terminal) => {
          setSubmitted(terminal);
          setReadFailed(false);
          autosave.reset();
          setFormLines(next);
          setBaseline(next);
          setModified(false);
          form.reset({ lines: Object.fromEntries(next.map((line) => [line.key, line])) });
        }}
        onInvalid={(invalid) => {
          setValidationAttempted(true);
          const visibleInvalid = inventoryFirstInvalid(
            lines,
            invalid,
            draft.programId,
            Boolean(search.includeInactive),
            search.size,
          );
          const includeInactive = Boolean(search.includeInactive) || !visibleInvalid;
          const first =
            visibleInvalid ??
            inventoryFirstInvalid(lines, invalid, draft.programId, true, search.size) ??
            invalid[0];
          const targetPage = inventoryPageOf(
            filterInventoryLines(lines, { includeInactive }, String),
            first,
            search.size,
          );
          setFocusKey(first.key);
          onSearchChange(
            {
              keyword: undefined,
              ...(includeInactive !== search.includeInactive && includeInactive
                ? { includeInactive: true }
                : {}),
              page: targetPage === 1 ? undefined : targetPage,
            },
            true,
          );
        }}
        onDeleted={async () => {
          setSubmitted(true);
          await onDeleted();
        }}
        onSubmitted={async () => {
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
          listed={lines}
          canManageLots={canManageLots}
          unit={quantityUnit.unit}
          onClose={onAddClose}
          onAdd={(added) => {
            form.setFieldValue('lines', (current) => ({
              ...current,
              ...Object.fromEntries(added.map((line) => [line.key, line])),
            }));
            onAddClose();
            onSearchChange({ keyword: undefined, page: undefined }, true);
          }}
        />
      )}
      {dialog?.type === 'reasons' &&
        dialogLine &&
        (reasonsQuery.isSuccess ? (
          <InventoryReasonsDialog
            line={dialogLine}
            reasons={reasons}
            unit={quantityUnit.unit}
            onClose={() => setDialog(null)}
            onUpdate={(adjustments) => {
              patchLine(dialogLine.key, { stockAdjustments: adjustments });
              setDialog(null);
            }}
          />
        ) : (
          <FormDialog
            open
            onOpenChange={(open) => {
              if (!open) setDialog(null);
            }}
          >
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
      {dialog?.type === 'lot' && dialogLine?.newLot && (
        <InventoryEditLotDialog
          line={dialogLine}
          listed={[...(eligible.data ?? []), ...lines]}
          onClose={() => setDialog(null)}
          onUpdate={(lot) => {
            patchLine(dialogLine.key, { newLot: lot });
            setDialog(null);
          }}
        />
      )}
      {dialog?.type === 'deactivate' && dialogLine && (
        <InventoryDeactivateDialog
          line={dialogLine}
          online={online}
          pending={mutation.isPending}
          onClose={() => setDialog(null)}
          onConfirm={() => {
            if (dialogLine.stockCardId && canDeactivateInventoryLine(dialogLine, online))
              mutation.mutate(dialogLine.stockCardId);
          }}
        />
      )}
      <DiscardChangesDialog {...guard.dialog} description={t('stock-events.discard-description')} />
    </div>
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
