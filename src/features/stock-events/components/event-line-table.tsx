import { type ColumnVisibilityState, createColumnHelper, useTable } from '@tanstack/react-table';
import type { ParseKeys } from 'i18next';
import { CalendarIcon, ClipboardPenLineIcon, Trash2Icon } from 'lucide-react';
import { memo, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DataTable,
  DataTableEmpty,
  type DataTableFeatures,
  DataTableHeaderLabel,
  dataTableFeatures,
} from '@/components/data-table/data-table';
import { DataTablePagination } from '@/components/data-table/data-table-pagination';
import { formatDateValue } from '@/components/form/date-value';
import { Button } from '@/components/ui/button';
import { InputSizer } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { ValidAssignment } from '@/components/valid-assignments/types';
import type { Reason } from '@/features/reference-data/lib/types';
import type { EventSearch } from '@/features/stock-events/components/event-editor';
import { ProductName } from '@/features/stock-events/components/product-name';
import { type EventForm, useEventForm } from '@/features/stock-events/hooks/use-event-form';
import {
  changeEventCounterparty,
  changeEventReason,
  type EventLine,
} from '@/features/stock-events/lib/event-form';
import {
  COUNTERPARTY,
  type ConfiguredEventKind,
  EVENT_KINDS,
  type EventKindConfig,
} from '@/features/stock-events/lib/event-kinds';
import { tableValue } from '@/lib/empty-value';
import { cardQuantity, type QuantityUnit } from '@/lib/quantity';
import { type SearchChange, useTableSearchState } from '@/lib/table-search';
import { toLatinDigits, toWholeNumber } from '@/lib/whole-number';

const COLUMNS = [
  ['productCode', 'stock-events.product-code'],
  ['product', 'stock-events.product'],
  ['packSize', 'stock-events.pack-size'],
  ['lotCode', 'stock-events.lot-code'],
  ['expiry', 'stock-events.expiry-date'],
  ['stockOnHand', 'stock-events.stock-on-hand'],
  ['destination', 'stock-events.issue-to'],
  ['destinationComments', 'stock-events.destination-comments'],
  ['reason', 'stock-events.reason'],
  ['comments', 'stock-events.reason-comments'],
  ['quantity', 'stock-events.quantity'],
  ['total', 'stock-events.total-quantity'],
  ['vvm', 'stock-events.vvm-status'],
  ['date', 'stock-events.date'],
  ['actions', 'stock-events.actions'],
] as const;
type CellId = (typeof COLUMNS)[number][0];
export const EVENT_HIDEABLE_COLUMNS = [
  { id: 'productCode', labelKey: 'stock-events.product-code', hideBelow: 1500 },
  { id: 'packSize', labelKey: 'stock-events.pack-size', hideBelow: 1400 },
  { id: 'expiry', labelKey: 'stock-events.expiry-date', hideBelow: 1250 },
  { id: 'total', labelKey: 'stock-events.total-quantity', hideBelow: 1150 },
] as const;
const MEASURED_HIDEABLE_COLUMNS = [
  { id: 'productCode', labelKey: 'stock-events.product-code' },
  { id: 'packSize', labelKey: 'stock-events.pack-size' },
  { id: 'total', labelKey: 'stock-events.total-quantity' },
  { id: 'expiry', labelKey: 'stock-events.expiry-date' },
] as const;
export function eventHideableColumns(kind: ConfiguredEventKind) {
  return EVENT_KINDS[kind].columnFit === 'measured'
    ? MEASURED_HIDEABLE_COLUMNS
    : EVENT_HIDEABLE_COLUMNS;
}
function columnLabel(id: CellId, key: ParseKeys, side: EventKindConfig['counterparty']): ParseKeys {
  if (side === 'none') return key;
  if (id === 'destination') return COUNTERPARTY[side].column;
  if (id === 'destinationComments') return COUNTERPARTY[side].comments;
  return key;
}
const NO_ASSIGNMENTS: readonly ValidAssignment[] = [];
const helper = createColumnHelper<DataTableFeatures, EventLine>();
const NO_SORT = { id: 'product', desc: false };

function SelectSizer({
  labels,
  wrap = 'nowrap',
}: {
  labels: readonly string[];
  wrap?: 'nowrap' | 'wrap';
}) {
  return (
    <div
      aria-hidden
      className={
        wrap === 'wrap'
          ? 'invisible grid h-0 w-28 overflow-hidden pe-8 ps-2.5 text-sm'
          : 'invisible grid h-0 w-max overflow-hidden pe-8 ps-2.5 text-sm'
      }
    >
      {[...new Set(labels)].map((label) => (
        <span
          key={label}
          className={
            wrap === 'wrap'
              ? 'col-start-1 row-start-1 whitespace-normal'
              : 'col-start-1 row-start-1 whitespace-nowrap'
          }
        >
          {label}
        </span>
      ))}
    </div>
  );
}

const DateSizer = memo(function DateSizer({ year, language }: { year: string; language: string }) {
  const labels = useMemo(
    () =>
      Array.from({ length: 12 }, (_, month) =>
        formatDateValue(`${year}-${String(month + 1).padStart(2, '0')}-28`, language),
      ),
    [year, language],
  );
  return (
    <div aria-hidden className="invisible grid h-0 w-max overflow-hidden">
      {labels.map((label) => (
        <span key={label} className="col-start-1 row-start-1">
          <Button align="start" disabled size="sm" tabIndex={-1} variant="outline">
            <CalendarIcon data-icon="inline-start" />
            {label}
          </Button>
        </span>
      ))}
    </div>
  );
});

type CellProps = {
  kind: ConfiguredEventKind;
  reasonRequired: boolean;
  id: CellId;
  index: number;
  line: EventLine;
  form: EventForm;
  reasons: readonly Reason[];
  assignments?: readonly ValidAssignment[];
  unit: QuantityUnit;
  today: string;
  disabled: boolean;
  onRemove: (key: string) => void;
};
const LineCell = memo(function LineCell({
  kind,
  reasonRequired,
  id,
  index,
  line,
  form,
  reasons,
  assignments = NO_ASSIGNMENTS,
  unit,
  today,
  disabled,
  onRemove,
}: CellProps) {
  const { t, i18n } = useTranslation();
  const name = line.orderable.fullProductName || line.orderable.productCode;
  const productLabel = line.orderable.dispensable?.displayUnit
    ? `${name} - ${line.orderable.dispensable.displayUnit}`
    : name;
  const lotLabel =
    line.lot?.lotCode ??
    t(line.productHasLots ? 'stock-events.no-lot-defined' : 'stock-events.product-has-no-lots');
  const row = t('stock-events.row-identity', { product: name, lot: lotLabel, position: index + 1 });
  const label = (key: ParseKeys) => t('stock-events.field-of', { field: t(key), row });
  const side = EVENT_KINDS[kind].counterparty;
  const counterparty = COUNTERPARTY[side === 'none' ? 'destination' : side];
  const reason = reasons.find((item) => item.id === line.reasonId);
  const measured = EVENT_KINDS[kind].columnFit === 'measured';
  switch (id) {
    case 'productCode':
      return <bdi>{line.orderable.productCode}</bdi>;
    case 'product':
      return <ProductName label={productLabel} width={measured ? 'compact' : 'default'} />;
    case 'packSize':
      return (
        <span className="tabular-nums">
          {tableValue(
            line.netContent == null
              ? null
              : new Intl.NumberFormat(i18n.language).format(line.netContent),
          )}
        </span>
      );
    case 'lotCode':
      return <bdi>{lotLabel}</bdi>;
    case 'expiry':
      return (
        <bdi>
          {tableValue(
            line.lot?.expirationDate
              ? formatDateValue(line.lot.expirationDate, i18n.language)
              : null,
          )}
        </bdi>
      );
    case 'stockOnHand':
      return (
        <span className="whitespace-nowrap tabular-nums" dir="ltr">
          {cardQuantity(line.stockOnHand, line.netContent, unit, i18n.language)}
        </span>
      );
    case 'destination':
      return (
        <div className="w-full whitespace-normal break-words">
          <div className="w-full contain-inline-size">
            <form.AppField
              name={`lines[${index}].counterparty`}
              listeners={{
                onChange: ({ value }) => {
                  const next = changeEventCounterparty(line, value ?? '');
                  if (value == null) form.setFieldValue(`lines[${index}].counterparty`, '');
                  if (next !== line)
                    form.setFieldValue(
                      `lines[${index}].counterpartyComments`,
                      next.counterpartyComments,
                    );
                },
              }}
            >
              {(field) => (
                <field.SelectField
                  disabled={disabled}
                  required
                  items={assignments.map((item) => ({ value: item.id, label: item.name ?? '' }))}
                  label={label(counterparty.column)}
                  layout="inline"
                  hideErrors
                  placeholder={t('stock-events.select-option')}
                  size="sm"
                />
              )}
            </form.AppField>
          </div>
        </div>
      );
    case 'destinationComments':
      return assignments.find((item) => item.id === line.counterparty)?.isFreeTextAllowed ? (
        <div
          className={
            measured
              ? 'w-full min-w-28 contain-inline-size whitespace-normal break-words'
              : 'w-full min-w-32 contain-inline-size whitespace-normal break-words'
          }
        >
          <form.AppField name={`lines[${index}].counterpartyComments`}>
            {(field) => (
              <field.TextareaField
                disabled={disabled}
                dir="auto"
                label={label(counterparty.comments)}
                layout="inline"
                hideErrors
                maxLength={255}
              />
            )}
          </form.AppField>
        </div>
      ) : null;
    case 'reason':
      return (
        <div
          className={
            measured
              ? 'w-full whitespace-normal break-words'
              : 'w-full min-w-28 whitespace-normal break-words'
          }
        >
          <div className="w-full contain-inline-size">
            <form.AppField
              name={`lines[${index}].reasonId`}
              listeners={{
                onChange: ({ value }) => {
                  const next = changeEventReason(line, value);
                  if (next !== line)
                    form.setFieldValue(`lines[${index}].reasonFreeText`, next.reasonFreeText);
                },
              }}
            >
              {(field) => (
                <field.SelectField
                  disabled={disabled}
                  items={[
                    ...(!reasonRequired
                      ? [{ value: '', label: t('stock-events.select-option') }]
                      : []),
                    ...reasons.map((item) => ({ value: item.id, label: item.name })),
                  ]}
                  label={label('stock-events.reason')}
                  layout="inline"
                  hideErrors
                  required={reasonRequired}
                  size="sm"
                  wrap={measured ? 'nowrap' : 'wrap'}
                />
              )}
            </form.AppField>
          </div>
        </div>
      );
    case 'comments':
      return reason?.isFreeTextAllowed ? (
        <div
          className={
            measured
              ? 'w-full min-w-28 contain-inline-size whitespace-normal break-words'
              : 'w-full min-w-32 contain-inline-size whitespace-normal break-words'
          }
        >
          <form.AppField name={`lines[${index}].reasonFreeText`}>
            {(field) => (
              <field.TextareaField
                disabled={disabled}
                dir="auto"
                label={label('stock-events.reason-comments')}
                layout="inline"
                hideErrors
              />
            )}
          </form.AppField>
        </div>
      ) : null;
    case 'quantity':
      return (
        <div
          className={
            measured
              ? 'w-full contain-inline-size whitespace-normal break-words'
              : unit === 'PACKS'
                ? 'w-full min-w-28 contain-inline-size whitespace-normal break-words'
                : 'w-full min-w-20 contain-inline-size whitespace-normal break-words'
          }
        >
          <form.AppField name={`lines[${index}].quantity`}>
            {(field) => (
              <field.QuantityField
                disabled={disabled}
                dosesLabel={t('quantity-unit.doses')}
                packsLabel={t('quantity-unit.packs')}
                label={label('stock-events.quantity')}
                layout="inline"
                hideErrors
                sizing={measured ? 'minimum' : 'full'}
                netContent={line.netContent}
                unit={unit}
                required
              />
            )}
          </form.AppField>
        </div>
      );
    case 'total':
      return (
        <span className="tabular-nums">
          {tableValue(
            cardQuantity(
              /^[0-9]+$/.test(toLatinDigits(line.quantity.doses.trim()))
                ? toWholeNumber(line.quantity.doses)
                : null,
              line.netContent,
              'DOSES',
              i18n.language,
            ),
          )}
        </span>
      );
    case 'vvm':
      return line.useVVM ? (
        <div className="w-full whitespace-normal break-words">
          <div className="w-full min-w-24 contain-inline-size">
            <form.AppField name={`lines[${index}].vvmStatus`}>
              {(field) => (
                <field.SelectField
                  disabled={disabled}
                  label={label('stock-events.vvm-status')}
                  size="sm"
                  layout="inline"
                  hideErrors
                  items={[
                    { value: '', label: t('stock-events.vvm-none') },
                    { value: 'STAGE_1', label: t('stock-events.stage-1') },
                    { value: 'STAGE_2', label: t('stock-events.stage-2') },
                  ]}
                />
              )}
            </form.AppField>
          </div>
        </div>
      ) : null;
    case 'date':
      return (
        <div className="w-full whitespace-normal break-words">
          <div
            className={
              measured
                ? 'w-full min-w-28 contain-inline-size'
                : 'w-full min-w-32 contain-inline-size'
            }
          >
            <form.AppField name={`lines[${index}].occurredDate`}>
              {(field) => (
                <field.DateField
                  disabled={disabled}
                  label={label('stock-events.date')}
                  latest={today}
                  layout="inline"
                  hideErrors
                  placeholder={t('stock-events.date')}
                  required
                />
              )}
            </form.AppField>
          </div>
        </div>
      );
    case 'actions':
      return (
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                aria-label={t('stock-events.field-of', { field: t('stock-events.remove'), row })}
                data-line-actions={line.key}
                disabled={disabled}
                onClick={() => onRemove(line.key)}
                size="icon-sm"
                type="button"
                variant="destructive-ghost"
              />
            }
          >
            <Trash2Icon />
          </TooltipTrigger>
          <TooltipContent>{t('stock-events.remove')}</TooltipContent>
        </Tooltip>
      );
  }
});

type Props = Omit<CellProps, 'id' | 'line' | 'index'> & {
  lines: EventLine[];
  search: EventSearch;
  onSearchChange: SearchChange<EventSearch>;
  columnVisibility: ColumnVisibilityState;
  onClearFilter: () => void;
  fitContent?: unknown;
  containerWidth?: number;
};
export function EventLineTable({
  kind,
  reasonRequired,
  form,
  lines,
  reasons,
  assignments = NO_ASSIGNMENTS,
  unit,
  today,
  disabled,
  onRemove,
  search,
  onSearchChange,
  columnVisibility,
  onClearFilter,
  fitContent,
  containerWidth,
}: Props) {
  const { t, i18n } = useTranslation();
  const config = EVENT_KINDS[kind];
  const measured = config.columnFit === 'measured';
  const lineIndex = useRef(new Map<string, number>());
  lineIndex.current = new Map(form.state.values.lines.map((line, index) => [line.key, index]));
  const columns = useMemo(
    () =>
      helper.columns(
        COLUMNS.filter(
          ([id]) =>
            config.counterparty !== 'none' ||
            (id !== 'destination' && id !== 'destinationComments'),
        ).map(([id, columnKey]) => {
          const key = columnLabel(id, columnKey, config.counterparty);
          return helper.display({
            id,
            header: () => (
              <>
                <span className={id === 'actions' ? 'sr-only' : undefined}>
                  <DataTableHeaderLabel>{t(key)}</DataTableHeaderLabel>
                </span>
                <div aria-hidden className="invisible h-0 overflow-hidden font-normal">
                  {id === 'destination' && (
                    <SelectSizer
                      labels={[
                        t('stock-events.select-option'),
                        ...assignments.map((item) => item.name ?? ''),
                      ]}
                    />
                  )}
                  {id === 'reason' && (
                    <SelectSizer
                      wrap={measured ? 'nowrap' : 'wrap'}
                      labels={[
                        ...(!reasonRequired ? [t('stock-events.select-option')] : []),
                        ...reasons.map((item) => item.name),
                      ]}
                    />
                  )}
                  {measured && id === 'quantity' && (
                    <div
                      aria-hidden
                      className="invisible flex h-0 w-max items-center gap-1 overflow-hidden"
                      dir="ltr"
                    >
                      <InputSizer
                        placeholder={t(
                          unit === 'PACKS' ? 'quantity-unit.packs' : 'quantity-unit.doses',
                        )}
                      />
                      {unit === 'PACKS' && (
                        <>
                          <span className="shrink-0 whitespace-nowrap">( +</span>
                          <InputSizer placeholder={t('quantity-unit.doses')} />
                          <span>)</span>
                        </>
                      )}
                    </div>
                  )}
                  {measured && id === 'vvm' && (
                    <SelectSizer
                      labels={[
                        t('stock-events.vvm-none'),
                        t('stock-events.stage-1'),
                        t('stock-events.stage-2'),
                      ]}
                    />
                  )}
                  {measured && id === 'date' && (
                    <DateSizer
                      year={today.slice(0, 4) || String(new Date().getFullYear())}
                      language={i18n.language}
                    />
                  )}
                </div>
              </>
            ),
            meta: id === 'actions' ? { className: 'w-10' } : undefined,
            cell: ({ row }) => (
              <LineCell
                kind={kind}
                reasonRequired={reasonRequired}
                id={id}
                index={lineIndex.current.get(row.original.key) ?? -1}
                line={row.original}
                form={form}
                reasons={reasons}
                assignments={assignments}
                unit={unit}
                today={today}
                disabled={disabled}
                onRemove={onRemove}
              />
            ),
          });
        }),
      ),
    [
      kind,
      config,
      measured,
      reasonRequired,
      form,
      reasons,
      assignments,
      unit,
      today,
      disabled,
      onRemove,
      t,
      i18n.language,
    ],
  );
  const size = search.size ?? 10;
  const requestedPage = search.page ?? 1;
  const page = Math.min(requestedPage, Math.max(1, Math.ceil(lines.length / size)));
  const rows = useMemo(() => lines.slice((page - 1) * size, page * size), [lines, page, size]);
  const searchState = useTableSearchState({
    search: { ...search, page },
    defaultSort: NO_SORT,
    onSearchChange,
  });
  const table = useTable({
    features: dataTableFeatures,
    columns,
    data: rows,
    getRowId: (line) => line.key,
    rowCount: lines.length,
    manualPagination: true,
    manualSorting: true,
    enableSorting: false,
    ...searchState,
    state: { ...searchState.state, columnVisibility },
  });
  useEffect(() => {
    if (page !== requestedPage) onSearchChange({ page: page === 1 ? undefined : page }, true);
  }, [page, requestedPage, onSearchChange]);
  const tableRegion = useRef<HTMLDivElement>(null);
  const columnWidths = useRef<Record<string, number>>({});
  const measuredContent = useRef({ fitContent, containerWidth, unit, language: i18n.language });
  const previous = measuredContent.current;
  if (
    previous.fitContent !== fitContent ||
    previous.containerWidth !== containerWidth ||
    previous.unit !== unit ||
    previous.language !== i18n.language
  ) {
    columnWidths.current = {};
    measuredContent.current = { fitContent, containerWidth, unit, language: i18n.language };
  }
  useLayoutEffect(() => {
    if (!rows.length) return;
    const headers = tableRegion.current?.querySelectorAll('thead th');
    table.getVisibleLeafColumns().forEach((column, index) => {
      const width = headers?.[index]?.getBoundingClientRect().width;
      if (width) columnWidths.current[column.id] = width;
    });
  });
  const hasLines = form.state.values.lines.length > 0;
  const empty = (
    <DataTableEmpty
      icon={<ClipboardPenLineIcon />}
      title={t(hasLines ? 'stock-events.no-matches-title' : config.copy.emptyTitle)}
      description={t(
        hasLines ? 'stock-events.no-matches-description' : config.copy.emptyDescription,
      )}
      action={
        hasLines && (
          <Button onClick={onClearFilter} type="button" variant="outline">
            {t('stock-events.clear-filter')}
          </Button>
        )
      }
    />
  );
  return (
    <div ref={tableRegion}>
      <DataTable
        columnWidths={
          hasLines && !rows.length && Object.keys(columnWidths.current).length
            ? columnWidths.current
            : undefined
        }
        table={table}
        density="compact"
        layout="auto"
        empty={empty}
        footer={lines.length > 0 && <DataTablePagination table={table} disabled={disabled} />}
      />
    </div>
  );
}

export function EventLineTableSkeleton({
  kind,
  unit,
  columnVisibility,
  busy = true,
}: {
  kind: ConfiguredEventKind;
  unit: QuantityUnit;
  columnVisibility: ColumnVisibilityState;
  busy?: boolean;
}) {
  const today = '';
  const form = useEventForm({ kind, reasons: [], today, onValid: () => {}, onInvalid: () => {} });
  return (
    <div aria-busy={busy || undefined}>
      <EventLineTable
        kind={kind}
        unit={unit}
        columnVisibility={columnVisibility}
        form={form}
        lines={[]}
        reasons={[]}
        reasonRequired={false}
        today={today}
        disabled
        search={{}}
        onSearchChange={() => {}}
        onRemove={() => {}}
        onClearFilter={() => {}}
      />
    </div>
  );
}
