import { useStore } from '@tanstack/react-form';
import { useQuery, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { createColumnHelper, type RowSelectionState, useTable } from '@tanstack/react-table';
import { isAxiosError } from 'axios';
import { CheckIcon, CircleAlertIcon, ClipboardListIcon, Loader2Icon } from 'lucide-react';
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';
import {
  DataTable,
  DataTableEmpty,
  type DataTableFeatures,
  DataTableHeaderLabel,
  DataTableSkeleton,
  DataTableToolbar,
  dataTableFeatures,
} from '@/components/data-table/data-table';
import { DataTablePagination } from '@/components/data-table/data-table-pagination';
import { DataTableViewOptions } from '@/components/data-table/data-table-view-options';
import { useColumnVisibility, useElementWidth } from '@/components/data-table/responsive-columns';
import { ErrorAlert, serverMessage } from '@/components/dialog-parts';
import { DiscardChangesDialog } from '@/components/discard-changes-dialog';
import { formatDateValue } from '@/components/form/date-value';
import { useAppForm } from '@/components/form/form';
import { LoadError } from '@/components/load-error';
import { QuantityUnitToggle } from '@/components/quantity-unit-toggle';
import { QueryBoundary } from '@/components/query-boundary';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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
  changeReverseReason,
  lineErrorMessage,
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
  StockEventCancelLineError,
  StockEventLine,
  StockEventLineReason,
  StockEventSummary,
} from '@/features/stock-events/lib/types';
import { useDiscardGuard } from '@/hooks/use-discard-guard';
import { useQuantityUnit } from '@/hooks/use-quantity-unit';
import { useSessionMutation } from '@/hooks/use-session-mutation';
import { useStoredState } from '@/hooks/use-stored-state';
import { orEmpty } from '@/lib/empty-value';
import { isRefused } from '@/lib/http';
import { queryKeys } from '@/lib/key-factory';
import { cardQuantity } from '@/lib/quantity';
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
export const REVERSE_HIDEABLE_COLUMNS = [
  { id: 'code', labelKey: 'stock-events.product-code', hideBelow: 1200 },
  { id: 'lot', labelKey: 'stock-event.lot-code', hideBelow: 800 },
  { id: 'date', labelKey: 'stock-event.line-date', hideBelow: 1400 },
  { id: 'source', labelKey: 'stock-event.source', hideBelow: 1600 },
  { id: 'destination', labelKey: 'stock-event.destination', hideBelow: 1600 },
  { id: 'reason', labelKey: 'stock-event.reason', hideBelow: 1800 },
  { id: 'current', labelKey: 'stock-event-reverse.current-stock-on-hand', hideBelow: 1000 },
  { id: 'reversed', labelKey: 'stock-event-reverse.reversed', hideBelow: 1400 },
  { id: 'comments', labelKey: 'stock-event-reverse.cancel-reason-comments', hideBelow: 1000 },
] as const;
type TableRow = { id: string; line: StockEventLine };
const helper = createColumnHelper<DataTableFeatures, TableRow>();
const choicesSchema = z.record(z.string(), z.boolean());
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
  const { t, i18n } = useTranslation();
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
    staleTime: 0,
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
  const [failure, setFailure] = useState<string | null>(null);
  const [marks, setMarks] = useState<Record<string, ReverseRowMarks>>({});
  const [errors, setErrors] = useState<Record<string, StockEventCancelLineError>>({});
  const [focusField, setFocusField] = useState<{ id: string; page: number } | null>(null);
  const leaving = useRef(false);
  const posting = useRef(false);
  const [measure, width] = useElementWidth<HTMLDivElement>();
  const columnView = useColumnVisibility(
    REVERSE_HIDEABLE_COLUMNS,
    useStoredState('stock-event-reverse.columns', choicesSchema, {}),
    width,
  );
  const [defaultValues] = useState<ReverseDraft>(() => ({ lines: {} }));
  const form = useAppForm({ defaultValues });
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
  const guard = useDiscardGuard(ticked.size > 0 && !summary, { allowLeave: () => leaving.current });
  const mutation = useSessionMutation({
    mutationFn: (body: Parameters<typeof cancelStockEvent>[1]) => cancelStockEvent(event.id, body),
    retry: false,
  });
  const [readingSummary, setReadingSummary] = useState(false);
  const pending = mutation.isPending || readingSummary;
  const size = search.reverseSize ?? 10;
  const requestedPage = search.reversePage ?? 1;
  const page = Math.min(requestedPage, Math.max(1, Math.ceil(rows.length / size)));
  useEffect(() => {
    if (linesQuery.data && requestedPage !== page)
      onSearchChange({ reversePage: page === 1 ? undefined : page }, true);
  }, [linesQuery.data, requestedPage, page, onSearchChange]);
  useEffect(() => {
    if (!focusField || page !== focusField.page) return;
    const target = document.getElementById(focusField.id);
    if (target) {
      target.focus();
      setFocusField(null);
    }
  }, [focusField, page]);
  const clearReasonMark = useCallback(
    (id: string) =>
      form.setFieldMeta(`lines.${id}.reasonId`, (meta) => ({ ...meta, errorMap: {} })),
    [form],
  );
  const selectRows = (selection: RowSelectionState) => {
    const next: ReverseDraft['lines'] = {};
    for (const row of rows) {
      if (selection[row.id] && canReverseLine(row.line))
        next[row.id] = draft.lines[row.id] ?? { reasonId: '', comments: '' };
      if (!selection[row.id]) clearReasonMark(row.id);
    }
    form.setFieldValue('lines', next);
    setMarks((previous) =>
      Object.fromEntries(Object.entries(previous).filter(([id]) => selection[id])),
    );
    setErrors((previous) =>
      Object.fromEntries(Object.entries(previous).filter(([id]) => selection[id])),
    );
  };
  const submit = () => {
    if (pending || !lines.length || (orderableIds.length > 0 && stock.isFetching)) return;
    const validation = validateReverse(lines, form.state.values, current);
    setMarks(validation.marks);
    setErrors({});
    setFailure(validation.message ? t(validation.message) : null);
    for (const row of rows)
      form.setFieldMeta(`lines.${row.id}.reasonId`, (meta) => ({
        ...meta,
        errorMap: { onSubmit: validation.marks[row.id]?.reason },
      }));
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
    setFocusField({ id: field, page: invalidPage });
    onSearchChange({ reversePage: invalidPage === 1 ? undefined : invalidPage }, true);
  };
  const confirmSubmit = async (signature: string) => {
    if (posting.current) return;
    posting.current = true;
    setFailure(null);
    try {
      const newId = await mutation.mutateAsync(reversePayload(selected, signature));
      if (!mutation.isCurrent()) return;
      leaving.current = true;
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
        isAxiosError(error) && error.response?.status === 400
          ? error.response.data?.lineErrors
          : undefined;
      if (lineErrors?.length) {
        const byId: Record<string, StockEventCancelLineError> = {};
        for (const row of rows) {
          const rowError = lineErrors.find(
            (item) => item.stockEventLineItemId === row.line.stockEventLineItemId,
          );
          if (rowError) byId[row.id] = rowError;
        }
        setErrors(byId);
        setFailure(t('stock-event-reverse.line-errors'));
      } else setFailure(serverMessage(error) ?? t('stock-event-reverse.failed-description'));
      setSignatureOpen(false);
      setConfirmOpen(false);
    } finally {
      posting.current = false;
    }
  };
  const onTableSearchChange = useCallback<SearchChange<TableSearch>>(
    (update, replace) =>
      onSearchChange((previous) => changeReversePaging(previous, update), replace),
    [onSearchChange],
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
            meta: {
              className: id === 'reverse' ? 'w-16' : id === 'product' ? '@xl/main:w-60' : 'w-40',
            },
            header: () => <DataTableHeaderLabel>{t(key)}</DataTableHeaderLabel>,
            cell: ({ row }) => {
              const { line, id: rowId } = row.original;
              const rowDraft = draft.lines[rowId];
              const mark = marks[rowId];
              const reason = reasons.find((item) => item.id === rowDraft?.reasonId);
              const label = t('stock-events.field-of', {
                field: t(key),
                row: `${line.orderable.fullProductName} (${line.orderable.productCode}) ${line.lot?.lotCode ?? t('stock-event.no-lot')} ${formatDateValue(line.occurredDate, i18n.language)}`,
              });
              const quantity = (value: number | undefined) => (
                <span className="whitespace-nowrap tabular-nums" dir="ltr">
                  {orEmpty(
                    cardQuantity(
                      value,
                      line.orderable.netContent,
                      quantityUnit.unit,
                      i18n.language,
                    ),
                  )}
                </span>
              );
              switch (id) {
                case 'reverse': {
                  const error = errors[rowId] ? lineErrorMessage(errors[rowId]) : undefined;
                  return (
                    <div className="flex flex-col gap-1">
                      <Checkbox
                        aria-label={label}
                        disabled={pending || stock.isFetching || !canReverseLine(line)}
                        checked={row.getIsSelected()}
                        onCheckedChange={(checked) => row.toggleSelected(checked)}
                      />
                      {error && (
                        <p className="flex items-start gap-1 text-sm text-destructive" role="alert">
                          <CircleAlertIcon />
                          <span>{'key' in error ? t(error.key) : error.message}</span>
                        </p>
                      )}
                    </div>
                  );
                }
                case 'code':
                  return <bdi>{line.orderable.productCode}</bdi>;
                case 'product':
                  return (
                    <span className="block min-w-28 max-w-60 whitespace-normal">
                      <bdi>{line.orderable.fullProductName}</bdi>
                    </span>
                  );
                case 'lot':
                  return <bdi>{line.lot?.lotCode ?? t('stock-event.no-lot')}</bdi>;
                case 'date':
                  return <bdi>{orEmpty(formatDateValue(line.occurredDate, i18n.language))}</bdi>;
                case 'source':
                  return orEmpty(namedWithFreeText(line.source, line.sourceFreeText));
                case 'destination':
                  return orEmpty(namedWithFreeText(line.destination, line.destinationFreeText));
                case 'reason':
                  return orEmpty(namedWithFreeText(line.reason, line.reasonFreeText));
                case 'quantity':
                  return quantity(line.quantity);
                case 'current':
                  return quantity(
                    current[`${line.orderable.id}/${line.lot?.id ?? ''}`] ?? line.stockOnHand,
                  );
                case 'reversed':
                  return line.cancellationEventId ? (
                    line.cancellationEventDocumentNumber ? (
                      <bdi>{line.cancellationEventDocumentNumber}</bdi>
                    ) : (
                      <CheckIcon aria-label={t('stock-event-reverse.reversed')} role="img" />
                    )
                  ) : null;
                case 'cancelReason':
                  return rowDraft ? (
                    <div className="w-40">
                      <form.AppField
                        name={`lines.${rowId}.reasonId`}
                        validators={{ onMount: () => mark?.reason }}
                        listeners={{
                          onChange: ({ value }) => {
                            const picked = reasons.find((item) => item.id === value);
                            if (!picked) return;
                            const next = changeReverseReason(
                              { line, ...rowDraft, marks: mark, serverError: errors[rowId] },
                              picked,
                            );
                            form.setFieldValue('lines', (previous) => ({
                              ...previous,
                              [rowId]: { ...previous[rowId], comments: next.comments },
                            }));
                            clearReasonMark(rowId);
                            setMarks((previous) => ({ ...previous, [rowId]: next.marks ?? {} }));
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
                            label={label}
                            layout="inline"
                            placeholder={t('stock-event-reverse.select-option')}
                            required
                          />
                        )}
                      </form.AppField>
                    </div>
                  ) : null;
                case 'comments':
                  return rowDraft && reason?.isFreeTextAllowed ? (
                    <div className="w-40">
                      <form.AppField name={`lines.${rowId}.comments`}>
                        {(field) => (
                          <field.TextareaField
                            label={label}
                            layout="inline"
                            maxLength={255}
                            dir="auto"
                            disabled={pending}
                          />
                        )}
                      </form.AppField>
                      {mark?.comments && (
                        <p className="text-sm text-destructive">{t(mark.comments)}</p>
                      )}
                    </div>
                  ) : null;
                case 'balance':
                  return rowDraft ? (
                    <fieldset
                      id={`balance-${rowId}`}
                      tabIndex={-1}
                      aria-label={label}
                      className="flex flex-col gap-1"
                    >
                      {balances[rowId] !== undefined && quantity(balances[rowId])}
                      {mark?.stock && <p className="text-sm text-destructive">{t(mark.stock)}</p>}
                    </fieldset>
                  ) : null;
              }
            },
          }),
        ),
      ),
    [
      t,
      i18n.language,
      draft.lines,
      marks,
      errors,
      reasons,
      form,
      pending,
      current,
      balances,
      quantityUnit.unit,
      clearReasonMark,
      stock.isFetching,
    ],
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
    state: {
      ...searchState.state,
      columnVisibility: columnView.visibility,
      rowSelection: selection,
    },
    onRowSelectionChange: (update) =>
      selectRows(typeof update === 'function' ? update(selection) : update),
  });
  const closeSummary = async () => {
    if (!mutation.isCurrent()) return;
    setSummary(null);
    toast.success(t('stock-event-reverse.done-title'), {
      description: t('stock-event-reverse.done-description'),
    });
    if (!guard.leaveIfAsked()) await onSubmitted();
  };
  return (
    <>
      <Workspace>
        {children}
        <WorkspaceContent>
          <div className="flex min-w-0 flex-col gap-4" ref={measure}>
            <EventHeader event={event} showSignature={false} />
            <form
              id={FORM_ID}
              className="flex min-w-0 flex-col gap-4"
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                submit();
              }}
            >
              <DataTableToolbar>
                <div className="ms-auto flex flex-wrap items-center justify-end gap-2">
                  {quantityUnit.canSwitch && (
                    <QuantityUnitToggle
                      unit={quantityUnit.unit}
                      onUnitChange={quantityUnit.setUnit}
                      disabled={pending}
                    />
                  )}
                  <DataTableViewOptions
                    {...columnView}
                    columns={REVERSE_HIDEABLE_COLUMNS.map((column) => ({
                      id: column.id,
                      label: t(column.labelKey),
                    }))}
                  />
                </div>
              </DataTableToolbar>
              {failure && (
                <ErrorAlert title={t('stock-event-reverse.failed-title')} description={failure} />
              )}
              <QueryBoundary
                resetKey={event.id}
                pendingFallback={
                  <DataTableSkeleton
                    table={table}
                    rowCount={size}
                    density="default"
                    layout="auto"
                  />
                }
                errorComponent={ReverseDataError}
              >
                <ReverseDataReady eventId={event.id}>
                  <DataTable
                    table={table}
                    density="default"
                    layout="auto"
                    empty={
                      <DataTableEmpty
                        icon={<ClipboardListIcon />}
                        title={t('stock-event-reverse.no-lines')}
                      />
                    }
                    footer={
                      rows.length > 0 && (
                        <DataTablePagination
                          table={table}
                          disabled={pending}
                          isPageInvalid={(index) =>
                            rows
                              .slice(index * size, (index + 1) * size)
                              .some(
                                (row) =>
                                  Object.keys(marks[row.id] ?? {}).length > 0 || !!errors[row.id],
                              )
                          }
                        />
                      )
                    }
                  />
                </ReverseDataReady>
              </QueryBoundary>
            </form>
          </div>
        </WorkspaceContent>
      </Workspace>
      <WorkspaceFooter>
        {cancel}
        <Button
          disabled={
            !linesQuery.data ||
            !reasonsQuery.data ||
            !lines.length ||
            pending ||
            !!summary ||
            (orderableIds.length > 0 && stock.isFetching)
          }
          form={FORM_ID}
          size="lg"
          type="submit"
        >
          {pending && <Loader2Icon className="animate-spin" data-icon="inline-start" />}
          {t('stock-events.submit')}
        </Button>
      </WorkspaceFooter>
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
