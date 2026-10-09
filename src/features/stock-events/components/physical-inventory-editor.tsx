import { useStore } from '@tanstack/react-form';
import { queryOptions, useQuery, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import type { ErrorComponentProps } from '@tanstack/react-router';
import { createColumnHelper, useTable } from '@tanstack/react-table';
import { ClipboardListIcon } from 'lucide-react';
import { useDeferredValue, useEffect, useId, useMemo, useRef, useState } from 'react';
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
import { formatDateValue } from '@/components/form/date-value';
import {
  FormDialog,
  FormDialogBody,
  FormDialogCancel,
  FormDialogDescription,
  FormDialogFooter,
  FormDialogForm,
  FormDialogHeader,
  FormDialogSubmit,
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
import { deactivateInventoryStockCard } from '@/features/stock-events/api/physical-inventory-api';
import {
  eligibleInventoryProductsOptions,
  inventoryStockLinesOptions,
} from '@/features/stock-events/api/physical-inventory-queries';
import { InventoryActions } from '@/features/stock-events/components/inventory-actions';
import { InventoryAddProductsDialog } from '@/features/stock-events/components/inventory-add-products-dialog';
import { InventoryEditLotDialog } from '@/features/stock-events/components/inventory-edit-lot-dialog';
import { InventoryReasonsDialog } from '@/features/stock-events/components/inventory-reasons-dialog';
import { InventoryScan } from '@/features/stock-events/components/inventory-scan';
import {
  INVENTORY_HIDEABLE_COLUMNS,
  PhysicalInventoryGrid,
  PhysicalInventoryGridSkeleton,
} from '@/features/stock-events/components/physical-inventory-grid';
import { usePhysicalInventoryAutosave } from '@/features/stock-events/hooks/use-physical-inventory-autosave';
import { usePhysicalInventoryForm } from '@/features/stock-events/hooks/use-physical-inventory-form';
import { inventoryLineError } from '@/features/stock-events/lib/physical-inventory-form';
import {
  buildInventoryLines,
  filterInventoryLines,
  inventoryGroups,
  inventoryPage,
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
  userId?: string;
  username?: string;
  onDeleted?: () => void | Promise<void>;
  onSubmitted?: () => void | Promise<void>;
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
  const view = useColumnVisibility(INVENTORY_HIDEABLE_COLUMNS, choices, width);
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
        pendingFallback={<PhysicalInventoryGridSkeleton visibility={view.visibility} />}
        resetKey={props.draft.id}
      >
        <InventoryRows
          {...props}
          visibility={view.visibility}
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
  if (local.isPending) return <PhysicalInventoryGridSkeleton visibility={props.visibility} />;
  return (
    <InventoryDraftRows
      {...props}
      stock={stock}
      localLines={local.data?.modified ? local.data.lines : []}
      localFailed={local.isError}
    />
  );
}

function InventoryDraftRows({
  draft,
  search,
  onSearchChange,
  visibility,
  stock,
  localLines,
  localFailed,
  quantityUnit,
  addOpen,
  onAddClose,
  facilityTypeId,
  canManageLots,
  userId = '',
  username = '',
  onDeleted = () => {},
  onSubmitted = () => {},
}: RowsProps & { stock: InventoryStockLine[]; localLines: InventoryLine[]; localFailed: boolean }) {
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
    buildInventoryLines(stock, draft.lineItems, localLines),
  );
  const form = usePhysicalInventoryForm(formLines, validationAttempted);
  const records = useStore(form.store, (state) => state.values.lines);
  const allLines = useMemo(() => Object.values(records), [records]);
  const changed = useMemo(() => {
    const originals = new Map(baseline.map((line) => [line.key, line]));
    return allLines.filter(
      (line) => JSON.stringify(line) !== JSON.stringify(originals.get(line.key)),
    );
  }, [allLines, baseline]);
  const [modified, setModified] = useState(Boolean(localLines.length));
  if (!modified && form.state.isDirty) setModified(true);
  const copy = useMemo(
    () =>
      !busy && !submitted && (modified || form.state.isDirty)
        ? {
            draftId: draft.id,
            programId: draft.programId,
            facilityId: draft.facilityId,
            lines: changed,
            modified: true,
            savedAt: Date.now(),
          }
        : null,
    [
      changed,
      draft.id,
      draft.programId,
      draft.facilityId,
      modified,
      form.state.isDirty,
      busy,
      submitted,
    ],
  );
  const autosave = usePhysicalInventoryAutosave(copy);
  const status = readFailed && !copy ? 'failed' : autosave.status;
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
      if (dialogLine)
        form.setFieldValue('lines', (current) => ({
          ...current,
          [dialogLine.key]: { ...current[dialogLine.key], active: false },
        }));
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
  const lines = useMemo(() => {
    const allowed = eligible.data && new Set(eligible.data.map((line) => line.orderable.id));
    return allLines.filter((line) => !allowed || allowed.has(line.orderable.id));
  }, [allLines, eligible.data]);
  const filtered = useMemo(
    () =>
      filterInventoryLines(
        lines,
        deferred,
        (date) => formatDateValue(date, i18n.language),
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
    defaultPageSize: 20,
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
  useEffect(() => {
    if (validationAttempted) void form.validate('change');
  }, [validationAttempted, form]);
  useEffect(() => {
    if (!focusKey || search !== deferred) return;
    const element = region.current?.querySelector<HTMLInputElement>(
      `[data-inventory-key="${CSS.escape(focusKey)}"] input`,
    );
    if (element) {
      element.focus();
      setFocusKey(null);
    }
  }, [focusKey, search, deferred]);
  return (
    <div ref={region} className="flex flex-col gap-4" aria-busy={search !== deferred}>
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
            editor={{
              form,
              unit: quantityUnit.unit,
              online,
              reasonsReady: reasonsQuery.isSuccess,
              pending: mutation.isPending || busy || submitted,
              errors: validationAttempted
                ? Object.fromEntries(lines.map((line) => [line.key, inventoryLineError(line)]))
                : {},
              onReasons: (line) => setDialog({ type: 'reasons', key: line.key }),
              onEditLot: (line) => setDialog({ type: 'lot', key: line.key }),
              onDeactivate: (line) => setDialog({ type: 'deactivate', key: line.key }),
              onRemove: (line) => {
                if (line.justAdded)
                  form.setFieldValue('lines', (current) => {
                    const next = { ...current };
                    delete next[line.key];
                    return next;
                  });
              },
            }}
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
          lines={lines}
          canManageLots={canManageLots}
          paused={busy || submitted || mutation.isPending || addOpen || !!dialog || actionDialog}
          onCount={(line) => {
            form.setFieldValue('lines', (current) => ({ ...current, [line.key]: line }));
            const groups = inventoryGroups(
              filterInventoryLines(
                [...lines.filter((item) => item.key !== line.key), line],
                { includeInactive: search.includeInactive },
                String,
              ),
            );
            const index = groups.findIndex((group) => group.orderable.id === line.orderable.id);
            const target = Math.floor(index / (search.size ?? 20)) + 1;
            onSearchChange({ keyword: undefined, page: target === 1 ? undefined : target }, true);
          }}
        />
      )}
      <InventoryActions
        draft={draft}
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
          const first = invalid[0];
          const includeInactive =
            search.includeInactive || (!first.active && first.stockOnHand === 0);
          const groups = inventoryGroups(filterInventoryLines(lines, { includeInactive }, String));
          const index = groups.findIndex((group) => group.orderable.id === first.orderable.id);
          const targetPage = Math.floor(index / (search.size ?? 20)) + 1;
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
              form.setFieldValue('lines', (current) => ({
                ...current,
                [dialogLine.key]: { ...current[dialogLine.key], stockAdjustments: adjustments },
              }));
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
                  product: dialogLine.orderable.fullProductName || dialogLine.orderable.productCode,
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
            form.setFieldValue('lines', (current) => ({
              ...current,
              [dialogLine.key]: { ...current[dialogLine.key], newLot: lot },
            }));
            setDialog(null);
          }}
        />
      )}
      <FormDialog
        open={dialog?.type === 'deactivate'}
        closeButton={!mutation.isPending}
        onOpenChange={(open) => {
          if (!open && !mutation.isPending) setDialog(null);
        }}
      >
        {dialogLine && (
          <FormDialogForm
            onSubmit={() => {
              if (
                !mutation.isPending &&
                canDeactivateInventoryLine(dialogLine, online) &&
                dialogLine.stockCardId
              )
                mutation.mutate(dialogLine.stockCardId);
            }}
          >
            <FormDialogHeader>
              <FormDialogTitle>{t('physical-inventory.deactivate')}</FormDialogTitle>
              <FormDialogDescription>
                {t('physical-inventory.deactivate-confirm', {
                  product: dialogLine.orderable.fullProductName || dialogLine.orderable.productCode,
                  lot: dialogLine.lot?.lotCode ?? t('stock-events.no-lot-defined'),
                })}
              </FormDialogDescription>
            </FormDialogHeader>
            <FormDialogFooter>
              <FormDialogCancel disabled={mutation.isPending}>
                {t('stock-events.cancel')}
              </FormDialogCancel>
              <FormDialogSubmit
                pending={mutation.isPending}
                disabled={!canDeactivateInventoryLine(dialogLine, online)}
              >
                {t('physical-inventory.deactivate')}
              </FormDialogSubmit>
            </FormDialogFooter>
          </FormDialogForm>
        )}
      </FormDialog>
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
        description={t('physical-inventory.no-stock-view-description')}
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
