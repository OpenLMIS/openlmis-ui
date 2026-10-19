import { useStore } from '@tanstack/react-form';
import { useQuery, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import {
  type ColumnVisibilityState,
  createColumnHelper,
  type Row,
  type RowSelectionState,
  useTable,
} from '@tanstack/react-table';
import { isAxiosError } from 'axios';
import { CheckIcon, CircleAlertIcon, ClipboardListIcon, Loader2Icon } from 'lucide-react';
import {
  createContext,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
  use,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  CardList,
  CardListItem,
  CardListSkeleton,
  CardRows,
  CardSelectBand,
  SkeletonBar,
} from '@/components/card-list';
import {
  DataTable,
  DataTableEmpty,
  type DataTableFeatures,
  DataTableHeaderLabel,
  DataTableSkeleton,
  dataTableFeatures,
} from '@/components/data-table/data-table';
import { DataTablePagination } from '@/components/data-table/data-table-pagination';
import { DataTableViewOptions } from '@/components/data-table/data-table-view-options';
import { serverMessage } from '@/components/dialog-parts';
import { DiscardChangesDialog } from '@/components/discard-changes-dialog';
import { formatDateValue } from '@/components/form/date-value';
import { useAppForm } from '@/components/form/form';
import { SettingsItem, SettingsRowFrame } from '@/components/form/settings-list';
import { LoadError } from '@/components/load-error';
import { QuantityUnitToggle } from '@/components/quantity-unit-toggle';
import { QueryBoundary } from '@/components/query-boundary';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Workspace, WorkspaceContent, WorkspaceFooter } from '@/components/workspace';
import { reasonsOptions } from '@/features/reference-data/api/queries';
import { cancelStockEvent, fetchAllStockEventLines } from '@/features/stock-events/api/api';
import {
  eventStockOnHandOptions,
  stockEventAllLinesOptions,
} from '@/features/stock-events/api/queries';
import { EventHeader } from '@/features/stock-events/components/event-header';
import { ReverseConfirmDialog } from '@/features/stock-events/components/reverse-confirm-dialog';
import { ReverseSummaryDialog } from '@/features/stock-events/components/reverse-summary-dialog';
import { SignatureDialog } from '@/features/stock-events/components/signature-dialog';
import {
  cancellationReasons,
  canReverseLine,
  currentStockOnHand,
  lineErrorMessage,
  liveReverseMarks,
  newStockOnHand,
  type ReverseDraft,
  type ReverseRowMarks,
  reversePayload,
  reverseRowId,
  validateReverse,
} from '@/features/stock-events/lib/event-reverse';
import {
  changeReversePaging,
  type ReversePagingSearch,
  reverseTableSearch,
} from '@/features/stock-events/lib/search';
import type {
  EventStockOnHand,
  StockEventCancel,
  StockEventCancelError,
  StockEventCancelLineError,
  StockEventLine,
  StockEventLineReason,
  StockEventSummary,
} from '@/features/stock-events/lib/types';
import { useCardView } from '@/hooks/use-card-view';
import { useDiscardGuard } from '@/hooks/use-discard-guard';
import { usePageStart } from '@/hooks/use-page-start';
import { useQuantityUnit } from '@/hooks/use-quantity-unit';
import { useSessionMutation } from '@/hooks/use-session-mutation';
import { EMPTY_VALUE, orEmpty, tableValue } from '@/lib/empty-value';
import { isRefused } from '@/lib/http';
import { queryKeys } from '@/lib/key-factory';
import { cardQuantity, type QuantityUnit } from '@/lib/quantity';
import { namedWithFreeText } from '@/lib/stock-labels';
import { type SearchChange, type TableSearch, useTableSearchState } from '@/lib/table-search';

const COLUMNS = [
  ['reverse', 'stock-event-reverse.reverse'],
  ['code', 'stock-events.product-code'],
  ['product', 'stock-event.product'],
  ['lot', 'stock-event.lot-code'],
  ['date', 'stock-event.line-date'],
  ['source', 'stock-event.source'],
  ['destination', 'stock-event.destination'],
  ['reason', 'stock-event.reason'],
  ['quantity', 'stock-event.quantity'],
  ['current', 'stock-event-reverse.current-stock-on-hand'],
  ['reversed', 'stock-event-reverse.reversed'],
  ['cancelReason', 'stock-event-reverse.cancel-reason'],
  ['comments', 'stock-event-reverse.cancel-reason-comments'],
  ['balance', 'stock-event-reverse.new-stock-on-hand'],
] as const;
const READ_ONLY_COLUMNS = COLUMNS.filter(
  ([id]) => !['reverse', 'code', 'product', 'cancelReason', 'comments', 'balance'].includes(id),
);
const REVERSE_HIDEABLE_COLUMNS = [
  { id: 'code', labelKey: 'stock-events.product-code' },
  { id: 'lot', labelKey: 'stock-event.lot-code' },
  { id: 'date', labelKey: 'stock-event.line-date' },
  { id: 'source', labelKey: 'stock-event.source', hideBelow: 944 },
  { id: 'destination', labelKey: 'stock-event.destination', hideBelow: 944 },
  { id: 'reason', labelKey: 'stock-event.reason', hideBelow: 944 },
  { id: 'current', labelKey: 'stock-event-reverse.current-stock-on-hand', hideBelow: 729 },
  { id: 'reversed', labelKey: 'stock-event-reverse.reversed' },
  { id: 'comments', labelKey: 'stock-event-reverse.cancel-reason-comments', hideBelow: 896 },
] as const;
type TableRow = { id: string; line: StockEventLine };
const helper = createColumnHelper<DataTableFeatures, TableRow>();
const NO_CURRENT: EventStockOnHand = {};
const NO_LINES: StockEventLine[] = [];
const NO_REASONS: StockEventLineReason[] = [];
const FORM_ID = 'reverse-form';
type Props = {
  children: ReactNode;
  event: StockEventSummary;
  username: string;
  search: ReversePagingSearch;
  onSearchChange: SearchChange<ReversePagingSearch>;
  cancel: ReactNode;
  onSubmitted: () => void | Promise<void>;
};

export function ReverseEditor({
  children,
  event,
  username,
  search,
  onSearchChange,
  cancel,
  onSubmitted,
}: Props) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const linesQuery = useQuery({ ...stockEventAllLinesOptions(event.id), enabled: false });
  const reasonsQuery = useQuery({ ...reasonsOptions(), enabled: false });
  const lines = linesQuery.data ?? NO_LINES;
  const reasons = reasonsQuery.data ?? NO_REASONS;
  const orderableIds = useMemo(() => [...new Set(lines.map((line) => line.orderable.id))], [lines]);
  const stock = useQuery({
    ...eventStockOnHandOptions({
      facilityId: event.facilityId,
      programId: event.programId,
      orderableIds,
    }),
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: false,
    enabled: orderableIds.length > 0,
  });
  const current = stock.isError ? NO_CURRENT : (stock.data ?? NO_CURRENT);
  const quantityUnit = useQuantityUnit();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [signatureOpen, setSignatureOpen] = useState(false);
  const [summary, setSummary] = useState<{ lines: StockEventLine[]; unavailable: boolean } | null>(
    null,
  );
  const [validationMessage, setValidationMessage] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [marks, setMarks] = useState<Record<string, ReverseRowMarks>>({});
  const [errors, setErrors] = useState<Record<string, StockEventCancelLineError>>({});
  const [focusField, setFocusField] = useState<{ id: string; page: number } | null>(null);
  const submitButton = useRef<HTMLButtonElement>(null);
  const alertTarget = useRef<{ id: string; page: number } | null>(null);
  const leaving = useRef(false);
  const posting = useRef(false);
  const { measure, cards, columnView, layout } = useCardView(
    REVERSE_HIDEABLE_COLUMNS,
    'stock-event-reverse.columns',
  );
  const form = useReverseForm();
  const draft = useStore(form.store, (state) => state.values);
  const ticked = useMemo(() => new Set(Object.keys(draft.lines)), [draft.lines]);
  const rows = useMemo(
    () => lines.map((line, index) => ({ id: reverseRowId(line, index), line })),
    [lines],
  );
  const selected = rows
    .filter((row) => ticked.has(row.id))
    .map((row) => ({ ...row, ...draft.lines[row.id] }));
  const balances = useMemo(() => newStockOnHand(lines, ticked, current), [lines, ticked, current]);
  const liveMarks = liveReverseMarks(marks, draft, balances);
  if (liveMarks !== marks) setMarks(liveMarks);
  const mutation = useSessionMutation({
    mutationFn: (body: StockEventCancel) => cancelStockEvent(event.id, body),
    retry: false,
  });
  const [readingSummary, setReadingSummary] = useState(false);
  const pending = mutation.isPending || readingSummary;
  const guard = useDiscardGuard(ticked.size > 0 && !summary, {
    allowLeave: () => leaving.current,
    pending: pending || !!summary,
  });
  const size = search.reverseSize ?? 10;
  const requestedPage = search.reversePage ?? 1;
  const page = Math.min(requestedPage, Math.max(1, Math.ceil(rows.length / size)));
  const pageStart = usePageStart<HTMLUListElement>(`${page}:${size}`, cards);
  useEffect(() => {
    if (linesQuery.data && requestedPage !== page)
      onSearchChange({ reversePage: page === 1 ? undefined : page }, true, { resetScroll: false });
  }, [linesQuery.data, requestedPage, page, onSearchChange]);
  useEffect(() => {
    if (!focusField || page !== focusField.page) return;
    const target = document.getElementById(focusField.id);
    if (target) {
      target.focus({ preventScroll: true });
      if (cards) target.closest('li')?.scrollIntoView?.({ block: 'start' });
      target.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
      setFocusField(null);
    }
  }, [focusField, page, cards]);
  const clearFieldMark = useCallback(
    (id: string, field: 'reasonId' | 'comments') =>
      form.setFieldMeta(`lines.${id}.${field}`, (meta) => ({ ...meta, errorMap: {} })),
    [form],
  );
  const selectRows = (selection: RowSelectionState) => {
    setValidationMessage(null);
    const next: ReverseDraft['lines'] = {};
    for (const row of rows)
      if (selection[row.id] && canReverseLine(row.line))
        next[row.id] = draft.lines[row.id] ?? { reasonId: '', comments: '' };
    for (const id of Object.keys(draft.lines))
      if (!next[id]) {
        clearFieldMark(id, 'reasonId');
        clearFieldMark(id, 'comments');
      }
    form.setFieldValue('lines', next);
    setErrors((previous) =>
      Object.fromEntries(Object.entries(previous).filter(([id]) => selection[id])),
    );
  };
  const submit = () => {
    if (pending || !lines.length || stock.isFetching) return;
    alertTarget.current = null;
    const validation = validateReverse(lines, form.state.values, current);
    setMarks(validation.marks);
    setErrors({});
    setFailure(null);
    setValidationMessage(validation.message ? t(validation.message) : null);
    for (const id of new Set([...Object.keys(form.state.values.lines), ...Object.keys(marks)])) {
      form.setFieldMeta(`lines.${id}.reasonId`, (meta) => ({
        ...meta,
        errorMap: { onSubmit: validation.marks[id]?.reason },
      }));
      form.setFieldMeta(`lines.${id}.comments`, (meta) => ({
        ...meta,
        errorMap: { onSubmit: validation.marks[id]?.comments },
      }));
    }
    if (validation.valid) {
      setConfirmOpen(true);
      return;
    }
    const first = rows.find((row) => validation.marks[row.id]);
    if (!first) return;
    const mark = validation.marks[first.id];
    const field = mark.reason
      ? `lines.${first.id}.reasonId`
      : mark.comments
        ? `lines.${first.id}.comments`
        : `balance-${first.id}`;
    const invalidPage = Math.floor(rows.indexOf(first) / size) + 1;
    if (mark.comments) columnView.onVisibilityChange({ ...columnView.visibility, comments: true });
    alertTarget.current = { id: field, page: invalidPage };
  };
  const confirmSubmit = async (signature: string) => {
    if (posting.current) return;
    posting.current = true;
    alertTarget.current = null;
    setFailure(null);
    try {
      const newId = await mutation.mutateAsync(reversePayload(selected, signature));
      if (!mutation.isCurrent()) return;
      for (const queryKey of [
        queryKeys.stockEvents.all,
        queryKeys.stockCardSummaries.all,
        queryKeys.stockCards.all,
      ])
        void queryClient.invalidateQueries({ queryKey });
      setReadingSummary(true);
      let saved: StockEventLine[] = [];
      let unavailable = false;
      try {
        saved = await fetchAllStockEventLines(newId);
      } catch {
        if (!mutation.isCurrent()) return;
        unavailable = true;
      }
      if (!mutation.isCurrent()) return;
      setReadingSummary(false);
      setSignatureOpen(false);
      setConfirmOpen(false);
      setSummary({ lines: saved, unavailable });
    } catch (error) {
      if (!mutation.isCurrent()) return;
      const lineErrors: StockEventCancelLineError[] | undefined =
        isAxiosError<StockEventCancelError>(error) && error.response?.status === 400
          ? error.response.data?.lineErrors
          : undefined;
      if (lineErrors?.length) {
        const byId: Record<string, StockEventCancelLineError> = {};
        const lineErrorsById = new Map(lineErrors.map((item) => [item.stockEventLineItemId, item]));
        for (const row of rows) {
          const rowError = lineErrorsById.get(row.line.stockEventLineItemId);
          if (rowError) byId[row.id] = rowError;
        }
        setErrors(byId);
        setFailure(t('stock-event-reverse.line-errors'));
        const first = rows.find((row) => byId[row.id]);
        if (first) {
          const invalidPage = Math.floor(rows.indexOf(first) / size) + 1;
          alertTarget.current = { id: `reverse-${first.id}`, page: invalidPage };
        }
      } else setFailure(serverMessage(error) ?? t('stock-event-reverse.failed-description'));
      setSignatureOpen(false);
      setConfirmOpen(false);
    } finally {
      posting.current = false;
    }
  };
  const onTableSearchChange = useCallback<SearchChange<TableSearch>>(
    (update, replace) =>
      onSearchChange(
        (previous) => changeReversePaging(previous, update),
        replace,
        pageStart.navigation,
      ),
    [onSearchChange, pageStart.navigation],
  );
  const searchState = useTableSearchState({
    search: { ...reverseTableSearch(search), page },
    defaultSort: { id: 'product', desc: false },
    onSearchChange: onTableSearchChange,
  });
  const columns = useMemo(
    () =>
      helper.columns(
        COLUMNS.map(([id, key]) =>
          helper.display({
            id,
            ...(id === 'cancelReason' && { meta: { skeleton: 'control' as const } }),
            header: () => (
              <div className={id === 'reverse' ? 'flex justify-center' : undefined}>
                <DataTableHeaderLabel>{t(key)}</DataTableHeaderLabel>
              </div>
            ),
            cell: ({ row }) => {
              const props = { row, id, keyLabel: key };
              switch (id) {
                case 'reverse':
                  return <ReverseCheckboxCell {...props} />;
                case 'cancelReason':
                  return <ReverseReasonCell {...props} />;
                case 'comments':
                  return <ReverseCommentsCell {...props} />;
                case 'balance':
                  return <ReverseBalanceCell {...props} />;
                default:
                  return <ReverseReadOnlyCell {...props} />;
              }
            },
          }),
        ),
      ),
    [t],
  );
  const visibleRows = useMemo(() => rows.slice((page - 1) * size, page * size), [rows, page, size]);
  const selection = Object.fromEntries([...ticked].map((id) => [id, true as const]));
  const table = useTable({
    features: dataTableFeatures,
    columns,
    data: visibleRows,
    getRowId: (row) => row.id,
    rowCount: rows.length,
    manualPagination: true,
    manualSorting: true,
    enableSorting: false,
    ...searchState,
    onPaginationChange: pageStart.onPaginationChange(searchState.onPaginationChange),
    state: {
      ...searchState.state,
      columnVisibility: columnView.visibility,
      rowSelection: selection,
    },
    onRowSelectionChange: (update) =>
      selectRows(typeof update === 'function' ? update(selection) : update),
  });
  const cells = useMemo(
    () => ({
      form,
      draft,
      marks: liveMarks,
      errors,
      reasons,
      current,
      balances,
      pending,
      fetching: stock.isFetching,
      unit: quantityUnit.unit,
      clearFieldMark,
      setValidationMessage,
      setErrors,
    }),
    [
      form,
      draft,
      liveMarks,
      errors,
      reasons,
      current,
      balances,
      pending,
      stock.isFetching,
      quantityUnit.unit,
      clearFieldMark,
    ],
  );
  const empty = (
    <DataTableEmpty icon={<ClipboardListIcon />} title={t('stock-event-reverse.no-lines')} />
  );
  const footer = rows.length > 0 && (
    <DataTablePagination
      table={table}
      disabled={pending}
      isPageInvalid={(index) =>
        rows
          .slice(index * size, (index + 1) * size)
          .some((row) => Object.keys(liveMarks[row.id] ?? {}).length > 0 || !!errors[row.id])
      }
    />
  );
  const closeSummary = async () => {
    if (!mutation.isCurrent()) return;
    leaving.current = true;
    setSummary(null);
    toast.success(t('stock-event-reverse.done-title'), {
      description: t('stock-event-reverse.done-description'),
    });
    if (!guard.leaveIfAsked()) await onSubmitted();
  };
  return (
    <>
      <Workspace width="wide">
        {children}
        <WorkspaceContent>
          <div className="flex min-w-0 flex-col gap-4" ref={measure}>
            <EventHeader event={event} showSignature={false} />
            <form
              id={FORM_ID}
              className="flex min-w-0 flex-col gap-4 **:scroll-mt-14 **:scroll-mb-18"
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                submit();
              }}
            >
              <div className="flex flex-wrap items-center justify-end gap-2">
                {quantityUnit.canSwitch && (
                  <div className="flex-1 @2xl/main:flex-none">
                    <QuantityUnitToggle
                      unit={quantityUnit.unit}
                      onUnitChange={quantityUnit.setUnit}
                      disabled={pending}
                    />
                  </div>
                )}
                <div className={quantityUnit.canSwitch ? 'shrink-0' : 'flex-1 @2xl/main:flex-none'}>
                  <DataTableViewOptions
                    {...columnView}
                    layout={layout}
                    columns={REVERSE_HIDEABLE_COLUMNS.filter(
                      (column) => !cards || column.id !== 'code',
                    ).map((column) => ({
                      id: column.id,
                      label: t(column.labelKey),
                    }))}
                  />
                </div>
              </div>
              <QueryBoundary
                resetKey={event.id}
                pendingFallback={
                  cards ? (
                    <ReverseCardsSkeleton count={size} visibility={columnView.visibility} />
                  ) : (
                    <DataTableSkeleton
                      table={table}
                      rowCount={size}
                      density="compact"
                      layout="auto"
                    />
                  )
                }
                errorComponent={ReverseDataError}
              >
                <ReverseDataReady eventId={event.id}>
                  <ReverseCells value={cells}>
                    {cards ? (
                      <CardList
                        listRef={pageStart.ref}
                        empty={rows.length === 0 && empty}
                        footer={footer}
                      >
                        {table.getRowModel().rows.map((row) => (
                          <ReverseLineCard
                            key={row.id}
                            row={row}
                            visibility={columnView.visibility}
                          />
                        ))}
                      </CardList>
                    ) : (
                      <DataTable
                        table={table}
                        density="compact"
                        layout="auto"
                        empty={empty}
                        footer={footer}
                      />
                    )}
                  </ReverseCells>
                </ReverseDataReady>
              </QueryBoundary>
            </form>
          </div>
        </WorkspaceContent>
      </Workspace>
      <WorkspaceFooter width="wide">
        {cancel}
        <Button
          disabled={!reasonsQuery.data || !lines.length || pending || !!summary || stock.isFetching}
          form={FORM_ID}
          ref={submitButton}
          size="lg"
          type="submit"
        >
          {pending && <Loader2Icon className="animate-spin" data-icon="inline-start" />}
          {t('stock-events.submit')}
        </Button>
      </WorkspaceFooter>
      <AlertDialog
        open={!!(validationMessage || failure)}
        onOpenChange={(open) => {
          if (!open) {
            setValidationMessage(null);
            setFailure(null);
          }
        }}
        onOpenChangeComplete={(open) => {
          if (open || !alertTarget.current) return;
          const target = alertTarget.current;
          alertTarget.current = null;
          setFocusField(target);
          if (target.page !== page)
            onSearchChange({ reversePage: target.page === 1 ? undefined : target.page }, true, {
              resetScroll: false,
            });
        }}
      >
        <AlertDialogContent finalFocus={alertTarget.current ? false : submitButton}>
          <AlertDialogHeader>
            <AlertDialogMedia>
              <CircleAlertIcon className="text-destructive" />
            </AlertDialogMedia>
            <AlertDialogTitle>{validationMessage || failure}</AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('stock-event-reverse.close')}</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <ReverseConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        onConfirm={() => {
          setConfirmOpen(false);
          setSignatureOpen(true);
        }}
        rows={selected}
        reasons={reasons}
        current={current}
        balances={balances}
        unit={quantityUnit.unit}
      />
      <SignatureDialog
        open={signatureOpen}
        onOpenChange={setSignatureOpen}
        pending={pending}
        username={username}
        onConfirm={confirmSubmit}
      />
      <ReverseSummaryDialog
        open={!!summary}
        lines={summary?.lines ?? []}
        unavailable={summary?.unavailable ?? false}
        unit={quantityUnit.unit}
        onClose={() => void closeSummary()}
      />
      <DiscardChangesDialog
        {...guard.dialog}
        description={t('stock-event-reverse.discard-description')}
      />
    </>
  );
}

function ReverseDataReady({ eventId, children }: { eventId: string; children: ReactNode }) {
  useSuspenseQuery({ ...stockEventAllLinesOptions(eventId), staleTime: Infinity });
  useSuspenseQuery(reasonsOptions());
  return children;
}
function ReverseDataError({ error, reset }: { error: unknown; reset: () => void }) {
  const { t } = useTranslation();
  if (isRefused(error)) return <p>{t('no-access.description')}</p>;
  return (
    <LoadError
      error={error}
      reset={reset}
      title={t('stock-event.lines-error-title')}
      description={t('stock-event.lines-error-description')}
    />
  );
}

function useReverseForm() {
  const [defaultValues] = useState<ReverseDraft>(() => ({ lines: {} }));
  return useAppForm({ defaultValues });
}

type ReverseCellState = {
  form: ReturnType<typeof useReverseForm>;
  draft: ReverseDraft;
  marks: Record<string, ReverseRowMarks>;
  errors: Record<string, StockEventCancelLineError>;
  reasons: StockEventLineReason[];
  current: EventStockOnHand;
  balances: Record<string, number>;
  pending: boolean;
  fetching: boolean;
  unit: QuantityUnit;
  clearFieldMark: (id: string, field: 'reasonId' | 'comments') => void;
  setValidationMessage: Dispatch<SetStateAction<string | null>>;
  setErrors: Dispatch<SetStateAction<Record<string, StockEventCancelLineError>>>;
};
const ReverseCells = createContext<ReverseCellState | null>(null);
type CellProps = {
  row: Row<DataTableFeatures, TableRow>;
  id: (typeof COLUMNS)[number][0];
  keyLabel: (typeof COLUMNS)[number][1];
  cards?: boolean;
};

function useReverseCell(props: CellProps) {
  const { row, keyLabel: key } = props;
  const state = use(ReverseCells);
  if (!state) throw new Error('Reverse cells require their editor');
  const { t, i18n } = useTranslation();
  const { draft, marks, reasons, unit } = state;
  const { line, id: rowId } = row.original;
  const rowDraft = draft.lines[rowId];
  const mark = marks[rowId];
  const reason = reasons.find((item) => item.id === rowDraft?.reasonId);
  const label = () =>
    t('stock-events.field-of', {
      field: t(key),
      row: `${line.orderable.fullProductName} (${line.orderable.productCode}) ${line.lot?.lotCode ?? t('stock-event.no-lot')} ${formatDateValue(line.occurredDate, i18n.language)}`,
    });
  const quantity = (value: number | undefined) => (
    <bdi className="whitespace-nowrap tabular-nums" dir="ltr">
      {(props.cards ? orEmpty : tableValue)(
        cardQuantity(value, line.orderable.netContent, unit, i18n.language),
      )}
    </bdi>
  );

  const disabled = state.pending || state.fetching || !canReverseLine(line);
  return { ...state, t, line, rowId, rowDraft, mark, reason, label, quantity, disabled };
}

function ReverseCheckboxCell(props: CellProps) {
  const { rowId, label, errors, disabled } = useReverseCell(props);
  const { row } = props;
  const invalid = !!errors[rowId];
  const checkbox = (
    <Checkbox
      id={`reverse-${rowId}`}
      aria-invalid={invalid}
      aria-describedby={invalid ? `reverse-error-${rowId}` : undefined}
      aria-label={label()}
      disabled={disabled}
      checked={row.getIsSelected()}
      onCheckedChange={(checked) => row.toggleSelected(checked)}
    />
  );
  if (props.cards) return checkbox;
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <div className="flex items-center justify-center">{checkbox}</div>
      <ReverseLineError {...props} />
    </div>
  );
}

function ReverseLineError(props: CellProps) {
  const { t, rowId, errors } = useReverseCell(props);
  const error = errors[rowId] ? lineErrorMessage(errors[rowId]) : undefined;
  return error ? (
    <p
      id={`reverse-error-${rowId}`}
      className={
        props.cards
          ? 'flex min-w-0 items-start gap-1 px-4 py-1.5 text-sm text-destructive'
          : 'flex min-w-0 w-48 items-start gap-1 whitespace-normal break-words text-start text-sm text-destructive'
      }
      role="alert"
    >
      <span className="shrink-0">
        <CircleAlertIcon />
      </span>
      <span className="min-w-0">{'key' in error ? t(error.key) : error.message}</span>
    </p>
  ) : null;
}

function ReverseReasonCell(props: CellProps) {
  const {
    t,
    line,
    rowId,
    rowDraft,
    mark,
    label,
    pending,
    form,
    reasons,
    clearFieldMark,
    setValidationMessage,
    setErrors,
  } = useReverseCell(props);

  return (
    <div className={props.cards ? 'min-w-0' : 'grid min-h-7 w-56 items-center'}>
      {props.cards && !rowDraft && (
        <Select disabled>
          <SelectTrigger aria-label={label()} width="full">
            <SelectValue placeholder={t('stock-event-reverse.select-option')} />
          </SelectTrigger>
        </Select>
      )}
      {rowDraft && (
        <form.AppField
          name={`lines.${rowId}.reasonId`}
          validators={{ onMount: () => mark?.reason }}
          listeners={{
            onChange: ({ value }) => {
              setValidationMessage(null);
              const picked = reasons.find((item) => item.id === value);
              if (!picked) return;
              form.setFieldValue('lines', (previous) => ({
                ...previous,
                [rowId]: {
                  reasonId: picked.id,
                  comments: picked.isFreeTextAllowed ? previous[rowId].comments : '',
                },
              }));
              clearFieldMark(rowId, 'reasonId');
              if (!picked.isFreeTextAllowed) clearFieldMark(rowId, 'comments');
              setErrors((previous) => {
                const { [rowId]: _removed, ...kept } = previous;
                return kept;
              });
            },
          }}
        >
          {(field) => (
            <field.SelectField
              disabled={pending}
              items={cancellationReasons(line, reasons).map((item) => ({
                value: item.id,
                label: item.name,
              }))}
              label={label()}
              layout="inline"
              hideErrors
              placeholder={t('stock-event-reverse.select-option')}
              required
              size={props.cards ? 'default' : 'sm'}
            />
          )}
        </form.AppField>
      )}
    </div>
  );
}

function ReverseCommentsCell(props: CellProps) {
  const { rowId, rowDraft, mark, reason, label, pending, form, clearFieldMark } =
    useReverseCell(props);
  const tooLong = ({ value }: { value: string }) =>
    value.length > 255 ? mark?.comments : undefined;

  return (
    <div className={props.cards ? 'min-w-0' : 'grid min-h-7 w-48 items-center'}>
      {rowDraft && reason?.isFreeTextAllowed && (
        <form.AppField
          name={`lines.${rowId}.comments`}
          validators={{ onMount: tooLong, onChange: tooLong, onBlur: tooLong }}
          listeners={{
            onChange: ({ value }) => {
              if (value.length <= 255) clearFieldMark(rowId, 'comments');
            },
          }}
        >
          {(field) => (
            <field.TextareaField
              label={label()}
              layout="inline"
              hideErrors
              maxLength={255}
              dir="auto"
              disabled={pending}
            />
          )}
        </form.AppField>
      )}
    </div>
  );
}

function ReverseBalanceCell(props: CellProps) {
  const { t, rowId, rowDraft, mark, label, quantity, balances, fetching } = useReverseCell(props);

  return rowDraft ? (
    <fieldset
      id={`balance-${rowId}`}
      tabIndex={-1}
      aria-invalid={!!mark?.stock}
      aria-describedby={mark?.stock ? `stock-error-${rowId}` : undefined}
      aria-label={label()}
      className={mark?.stock ? 'text-destructive' : undefined}
    >
      {fetching ? (
        <div className="h-4 w-12">
          <Skeleton fill />
        </div>
      ) : (
        balances[rowId] !== undefined && quantity(balances[rowId])
      )}
      {mark?.stock && (
        <p id={`stock-error-${rowId}`} className="sr-only">
          {t(mark.stock)}
        </p>
      )}
    </fieldset>
  ) : null;
}

function ReverseReadOnlyCell(props: CellProps) {
  const { t, i18n } = useTranslation();
  const { line, quantity, current, fetching } = useReverseCell(props);
  const value = props.cards ? orEmpty : tableValue;
  const textClass = props.cards ? 'wrap-break-word' : 'whitespace-nowrap';
  switch (props.id) {
    case 'code':
      return <bdi className="whitespace-nowrap">{line.orderable.productCode}</bdi>;
    case 'product':
      return (
        <span className="whitespace-nowrap">
          <bdi>{line.orderable.fullProductName}</bdi>
        </span>
      );
    case 'lot':
      return line.lot ? (
        <bdi className={textClass}>{value(line.lot.lotCode)}</bdi>
      ) : (
        <span className={textClass}>{t('stock-event.no-lot')}</span>
      );
    case 'date':
      return (
        <bdi className={textClass}>{value(formatDateValue(line.occurredDate, i18n.language))}</bdi>
      );
    case 'source':
      return (
        <bdi className={textClass}>
          {value(namedWithFreeText(line.source, line.sourceFreeText))}
        </bdi>
      );
    case 'destination':
      return (
        <bdi className={textClass}>
          {value(namedWithFreeText(line.destination, line.destinationFreeText))}
        </bdi>
      );
    case 'reason':
      return (
        <bdi className={textClass}>
          {value(namedWithFreeText(line.reason, line.reasonFreeText))}
        </bdi>
      );
    case 'quantity':
      return quantity(line.quantity);
    case 'current':
      return fetching ? (
        <div className="h-4 w-12">
          <Skeleton fill />
        </div>
      ) : (
        quantity(currentStockOnHand(line, current))
      );
    case 'reversed':
      return line.cancellationEventId ? (
        line.cancellationEventDocumentNumber ? (
          <bdi className={textClass}>{line.cancellationEventDocumentNumber}</bdi>
        ) : (
          <CheckIcon aria-label={t('stock-event-reverse.reversed')} role="img" />
        )
      ) : (
        value(null)
      );
  }
}

function ReverseLineCard({
  row,
  visibility,
}: {
  row: Row<DataTableFeatures, TableRow>;
  visibility: ColumnVisibilityState;
}) {
  const { t } = useTranslation();
  const props: CellProps = {
    row,
    id: 'reverse',
    keyLabel: 'stock-event-reverse.reverse',
    cards: true,
  };
  const { line, rowId, rowDraft, reason, disabled } = useReverseCell(props);
  return (
    <CardListItem>
      <CardSelectBand
        htmlFor={`reverse-${rowId}`}
        disabled={disabled}
        selected={row.getIsSelected()}
      >
        <ReverseCheckboxCell {...props} />
        <bdi aria-hidden className="min-w-0 wrap-break-word">
          {line.orderable.fullProductName} ({line.orderable.productCode})
        </bdi>
      </CardSelectBand>
      <ReverseLineError {...props} />
      <CardRows>
        {READ_ONLY_COLUMNS.filter(([id]) => visibility[id] !== false).map(([id, key]) => (
          <SettingsItem key={id} label={t(key)}>
            <ReverseReadOnlyCell {...props} id={id} keyLabel={key} />
          </SettingsItem>
        ))}
        <SettingsRowFrame
          value="control"
          align="center"
          label={<span className="text-sm">{t('stock-event-reverse.cancel-reason')}</span>}
        >
          <ReverseReasonCell
            {...props}
            id="cancelReason"
            keyLabel="stock-event-reverse.cancel-reason"
          />
        </SettingsRowFrame>
        {rowDraft && reason?.isFreeTextAllowed && visibility.comments !== false && (
          <SettingsRowFrame
            value="control"
            align="center"
            label={
              <span className="text-sm">{t('stock-event-reverse.cancel-reason-comments')}</span>
            }
          >
            <ReverseCommentsCell
              {...props}
              id="comments"
              keyLabel="stock-event-reverse.cancel-reason-comments"
            />
          </SettingsRowFrame>
        )}
        <SettingsRowFrame
          label={<strong className="text-sm">{t('stock-event-reverse.new-stock-on-hand')}</strong>}
        >
          <div className="font-bold text-sm">
            {rowDraft ? (
              <ReverseBalanceCell
                {...props}
                id="balance"
                keyLabel="stock-event-reverse.new-stock-on-hand"
              />
            ) : (
              EMPTY_VALUE
            )}
          </div>
        </SettingsRowFrame>
      </CardRows>
    </CardListItem>
  );
}

function ReverseCardsSkeleton({
  count,
  visibility,
}: {
  count: number;
  visibility: ColumnVisibilityState;
}) {
  return (
    <CardListSkeleton
      count={Math.min(3, count)}
      rows={READ_ONLY_COLUMNS.filter(([id]) => visibility[id] !== false).length + 2}
      band={
        <div className="flex items-center gap-3">
          <div className="size-4">
            <Skeleton fill />
          </div>
          <SkeletonBar width="w-40" />
        </div>
      }
    />
  );
}
