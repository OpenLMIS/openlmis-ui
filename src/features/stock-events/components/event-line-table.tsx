import { type ColumnVisibilityState, createColumnHelper, useTable } from '@tanstack/react-table';
import { ClipboardPenLineIcon, EllipsisIcon, Trash2Icon } from 'lucide-react';
import { useEffect, useMemo } from 'react';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { Reason } from '@/features/reference-data/lib/types';
import type { AdjustmentSearch } from '@/features/stock-events/components/adjustment-editor';
import type { AdjustmentForm } from '@/features/stock-events/hooks/use-adjustment-form';
import {
  type AdjustmentLine,
  changeAdjustmentReason,
} from '@/features/stock-events/lib/adjustment-form';
import { orEmpty } from '@/lib/empty-value';
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
const helper = createColumnHelper<DataTableFeatures, AdjustmentLine>();
const NO_SORT = { id: 'product', desc: false };

type CellProps = {
  id: CellId;
  line: AdjustmentLine;
  form: AdjustmentForm;
  reasons: readonly Reason[];
  unit: QuantityUnit;
  today: string;
  disabled: boolean;
  onRemove: (key: string) => void;
};
function LineCell({ id, line, form, reasons, unit, today, disabled, onRemove }: CellProps) {
  const { t, i18n } = useTranslation();
  const index = form.state.values.lines.findIndex((item) => item.key === line.key);
  const name = line.orderable.fullProductName || line.orderable.productCode;
  const row = `${name} ${line.lot?.lotCode ?? t('stock-events.no-lot-defined')}`;
  const label = (key: (typeof COLUMNS)[number][1]) =>
    t('stock-events.field-of', { field: t(key), row });
  const reason = reasons.find((item) => item.id === line.reasonId);
  switch (id) {
    case 'productCode':
      return <bdi>{line.orderable.productCode}</bdi>;
    case 'product':
      return (
        <span className="block min-w-28 max-w-40 whitespace-normal break-words font-medium">
          <bdi>
            {name}
            {line.orderable.dispensable?.displayUnit &&
              ` - ${line.orderable.dispensable.displayUnit}`}
          </bdi>
        </span>
      );
    case 'packSize':
      return (
        <span className="tabular-nums">
          {orEmpty(
            line.netContent == null
              ? null
              : new Intl.NumberFormat(i18n.language).format(line.netContent),
          )}
        </span>
      );
    case 'lotCode':
      return <bdi>{line.lot?.lotCode ?? t('stock-events.no-lot-defined')}</bdi>;
    case 'expiry':
      return (
        <bdi>
          {orEmpty(
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
    case 'reason':
      return (
        <div className="w-28">
          <form.AppField
            name={`lines[${index}].reasonId`}
            listeners={{
              onChange: ({ value }) => {
                const next = changeAdjustmentReason(line, value);
                if (next !== line)
                  form.setFieldValue(`lines[${index}].reasonFreeText`, next.reasonFreeText);
              },
            }}
          >
            {(field) => (
              <field.SelectField
                disabled={disabled}
                items={reasons.map((item) => ({ value: item.id, label: item.name }))}
                label={label('stock-events.reason')}
                layout="inline"
                required
              />
            )}
          </form.AppField>
        </div>
      );
    case 'comments':
      return reason?.isFreeTextAllowed ? (
        <div className="w-32">
          <form.AppField name={`lines[${index}].reasonFreeText`}>
            {(field) => (
              <field.TextField
                disabled={disabled}
                dir="auto"
                label={label('stock-events.reason-comments')}
                layout="inline"
              />
            )}
          </form.AppField>
        </div>
      ) : null;
    case 'quantity':
      return (
        <div className={unit === 'PACKS' ? 'w-28' : 'w-20'}>
          <form.AppField name={`lines[${index}].quantity`}>
            {(field) => (
              <field.QuantityField
                disabled={disabled}
                dosesLabel={t('quantity-unit.doses')}
                packsLabel={t('quantity-unit.packs')}
                label={label('stock-events.quantity')}
                layout="inline"
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
          {orEmpty(
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
        <div className="w-24">
          <form.AppField name={`lines[${index}].vvmStatus`}>
            {(field) => (
              <field.SelectField
                disabled={disabled}
                label={label('stock-events.vvm-status')}
                layout="inline"
                items={[
                  { value: '', label: t('stock-events.vvm-none') },
                  { value: 'STAGE_1', label: t('stock-events.stage-1') },
                  { value: 'STAGE_2', label: t('stock-events.stage-2') },
                ]}
              />
            )}
          </form.AppField>
        </div>
      ) : null;
    case 'date':
      return (
        <div className="w-32">
          <form.AppField name={`lines[${index}].occurredDate`}>
            {(field) => (
              <field.DateField
                disabled={disabled}
                label={label('stock-events.date')}
                latest={today}
                layout="inline"
                placeholder={t('stock-events.date')}
                required
              />
            )}
          </form.AppField>
        </div>
      );
    case 'actions':
      return (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                aria-label={label('stock-events.actions')}
                data-line-actions={line.key}
                disabled={disabled}
                size="icon-sm"
                type="button"
                variant="ghost"
              />
            }
          >
            <EllipsisIcon />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" width="auto">
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={() => onRemove(line.key)} variant="destructive">
                <Trash2Icon />
                {t('stock-events.remove')}
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      );
  }
}

type Props = Omit<CellProps, 'id' | 'line'> & {
  lines: AdjustmentLine[];
  search: AdjustmentSearch;
  onSearchChange: SearchChange<AdjustmentSearch>;
  columnVisibility: ColumnVisibilityState;
  onClearFilter: () => void;
};
export function EventLineTable({
  form,
  lines,
  reasons,
  unit,
  today,
  disabled,
  onRemove,
  search,
  onSearchChange,
  columnVisibility,
  onClearFilter,
}: Props) {
  const { t } = useTranslation();
  const columns = useMemo(
    () =>
      helper.columns(
        COLUMNS.map(([id, key]) =>
          helper.display({
            id,
            header: () => <DataTableHeaderLabel>{t(key)}</DataTableHeaderLabel>,
            cell: ({ row }) => (
              <LineCell
                id={id}
                line={row.original}
                form={form}
                reasons={reasons}
                unit={unit}
                today={today}
                disabled={disabled}
                onRemove={onRemove}
              />
            ),
          }),
        ),
      ),
    [form, reasons, unit, today, disabled, onRemove, t],
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
  const hasLines = form.state.values.lines.length > 0;
  const empty = (
    <DataTableEmpty
      icon={<ClipboardPenLineIcon />}
      title={t(hasLines ? 'stock-events.no-matches-title' : 'stock-adjustment.empty-title')}
      description={t(
        hasLines ? 'stock-events.no-matches-description' : 'stock-adjustment.empty-description',
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
    <DataTable
      table={table}
      density="compact"
      layout="auto"
      empty={empty}
      footer={lines.length > 0 && <DataTablePagination table={table} disabled={disabled} />}
    />
  );
}
