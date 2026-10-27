import { createColumnHelper, FlexRender, functionalUpdate, useTable } from '@tanstack/react-table';
import { ChevronRightIcon, TriangleAlertIcon } from 'lucide-react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DataTableCard,
  DataTableEmpty,
  type DataTableFeatures,
  DataTableFooter,
  DataTableHeaderLabel,
  dataTableFeatures,
} from '@/components/data-table/data-table';
import { DataTablePagination } from '@/components/data-table/data-table-pagination';
import { FlagBadge } from '@/components/flag-badge';
import { TableCards } from '@/components/table-cards';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { productLabel } from '@/features/reference-data/lib/products';
import type { CurrencySettings } from '@/features/reference-data/lib/types';
import { AdjustmentsDialog } from '@/features/requisitions/components/adjustments-dialog';
import { RequisitionGridToolbar } from '@/features/requisitions/components/requisition-grid-toolbar';
import { SupplyingStockNote } from '@/features/requisitions/components/supplying-stock-note';
import type { calculateTotals } from '@/features/requisitions/lib/calculations';
import { formatCurrency } from '@/features/requisitions/lib/currency';
import { gridRowTone } from '@/features/requisitions/lib/grid-row-tone';
import { filterLines, type RequisitionLine, splitLines } from '@/features/requisitions/lib/lines';
import { PATIENT_QUANTITY_COLUMNS } from '@/features/requisitions/lib/patients';
import type { RequisitionLineItem } from '@/features/requisitions/lib/requisition';
import {
  compileColumns,
  type GridColumn,
  hidesSkipped,
} from '@/features/requisitions/lib/template';
import type { RequisitionRecord } from '@/features/requisitions/lib/types';
import { useCardView } from '@/hooks/use-card-view';
import { usePageStart } from '@/hooks/use-page-start';
import { EMPTY_VALUE, tableValue } from '@/lib/empty-value';
import { cardQuantity, type QuantityUnit } from '@/lib/quantity';
import {
  changeDetailPaging,
  detailTableSearch,
  fromPaginationState,
  type SearchChange,
  toPaginationState,
} from '@/lib/table-search';

export type GridSearch = {
  detailPage?: number;
  detailSize?: number;
  product?: string;
  skipped?: boolean;
  adjustments?: string;
};
export type GridRow = { id: string; category?: string; model?: RequisitionLine };
type Props = {
  record: RequisitionRecord;
  tab: 'fullSupply' | 'nonFullSupply';
  search: GridSearch;
  onSearchChange: SearchChange<GridSearch>;
  onAdjustments: (id: string) => void;
  onCloseAdjustments: () => void;
  supplyingStock: boolean;
  unit: QuantityUnit;
  setUnit: (unit: QuantityUnit) => void;
  canSwitch: boolean;
};
const helper = createColumnHelper<DataTableFeatures, GridRow>();
export function RequisitionGridView({
  record,
  tab,
  search,
  onSearchChange,
  onAdjustments,
  onCloseAdjustments,
  supplyingStock,
  models,
  totals,
  currency,
  unit,
  setUnit,
  canSwitch,
}: Props & {
  models: RequisitionLine[];
  totals: ReturnType<typeof calculateTotals>;
  currency: CurrencySettings;
}) {
  const { t, i18n } = useTranslation();
  const formatter = useMemo(() => new Intl.NumberFormat(i18n.language), [i18n.language]);
  const tableElement = useRef<HTMLTableElement>(null);
  const [pinnedWidths, setPinnedWidths] = useState<Record<string, number>>({});
  const columns = useMemo(
    () =>
      compileColumns(record.template, {
        tab,
        status: record.status,
        emergency: record.emergency,
        supplyingStock: supplyingStock && !record.supplyingFacilityAccessDenied,
      }).map((column) => ({
        ...column,
        label: column.kind === 'packSize' ? t('requisitions.requisition.pack-size') : column.label,
        definition: column.stockBasedNote
          ? [column.definition, t('requisitions.adjustments.stock-based-note')]
              .filter(Boolean)
              .join(' ')
          : column.definition,
      })),
    [record, tab, supplyingStock, t],
  );
  const hideable = useMemo(
    () => columns.filter((column) => !column.sticky).map((column) => ({ id: column.name })),
    [columns],
  );
  const templateId = record.template.id ?? Object.keys(record.template.columnsMap).sort().join(':');
  const view = useCardView(hideable, `requisition-columns:${templateId}`);
  const selected = useMemo(() => splitLines(models)[tab], [models, tab]);
  const filtered = useMemo(
    () =>
      filterLines(selected, {
        hideSkipped: hidesSkipped(record.template, tab),
        product: search.product,
        showSkipped: search.skipped,
      }),
    [selected, record.template, tab, search.product, search.skipped],
  );
  const pagination = toPaginationState(detailTableSearch(search));
  const pageIndex = Math.min(
    pagination.pageIndex,
    Math.max(0, Math.ceil(filtered.length / pagination.pageSize) - 1),
  );
  useEffect(() => {
    if (pageIndex !== pagination.pageIndex)
      onSearchChange({ detailPage: pageIndex ? pageIndex + 1 : undefined }, true);
  }, [pageIndex, pagination.pageIndex, onSearchChange]);
  const pageStart = usePageStart<HTMLUListElement>(
    `${record.id}:${tab}:${pageIndex}:${pagination.pageSize}`,
    view.cards,
  );
  const data = useMemo(() => {
    const rows: GridRow[] = [];
    let previous: string | undefined;
    for (const model of filtered.slice(
      pageIndex * pagination.pageSize,
      (pageIndex + 1) * pagination.pageSize,
    )) {
      if (model.categoryName !== previous) {
        rows.push({ id: `category:${model.categoryName}`, category: model.categoryName });
        previous = model.categoryName;
      }
      rows.push({ id: model.line.id, model });
    }
    return rows;
  }, [filtered, pageIndex, pagination.pageSize]);
  const supplyingHasStock =
    supplyingStock &&
    !record.supplyingFacilityAccessDenied &&
    !!record.supplyingFacilities?.length &&
    models.some((model) => model.line.supplyingFacilityStockOnHand != null);
  const defs = useMemo(
    () =>
      columns.map((column) =>
        helper.display({
          id: column.name,
          header: column.label,
          meta: { label: column.label },
          cell: ({ row }) =>
            row.original.model
              ? renderValue(column, row.original.model, {
                  currency,
                  unit,
                  formatter,
                  shortfall: supplyingHasStock && gridRowTone(row.original, true) === 'shortfall',
                  shortfallLabel: t('requisitions.requisition.stock-shortfall'),
                  cards: view.cards,
                  stockBased: !!record.template.populateStockOnHandFromStockCards,
                  yes: t('requisitions.yes'),
                  no: t('requisitions.no'),
                  unavailable: t('requisitions.requisition.not-available'),
                  onAdjustments,
                })
              : null,
        }),
      ),
    [
      columns,
      currency,
      unit,
      formatter,
      supplyingHasStock,
      view.cards,
      record.template.populateStockOnHandFromStockCards,
      t,
      onAdjustments,
    ],
  );
  const table = useTable({
    features: dataTableFeatures,
    columns: defs,
    data,
    getRowId: (row) => row.id,
    rowCount: filtered.length,
    manualPagination: true,
    manualSorting: true,
    state: {
      pagination: { ...pagination, pageIndex },
      columnVisibility: { ...view.columnView.visibility, 'orderable.productCode': !view.cards },
    },
    onPaginationChange: pageStart.onPaginationChange((updater) =>
      onSearchChange(
        (previous) => {
          return changeDetailPaging(previous, (current) => {
            const pagination = toPaginationState(current);
            return fromPaginationState(pagination, functionalUpdate(updater, pagination));
          });
        },
        false,
        pageStart.navigation,
      ),
    ),
  });
  const empty = (
    <DataTableEmpty
      action={
        search.product || search.skipped ? (
          <Button
            variant="destructive"
            onClick={() =>
              onSearchChange(
                { product: undefined, skipped: undefined, detailPage: undefined },
                true,
              )
            }
          >
            {t('data-table.clear-filters')}
          </Button>
        ) : undefined
      }
      title={t(
        search.product || search.skipped
          ? 'requisitions.requisition.no-matching-products'
          : tab === 'fullSupply'
            ? 'requisitions.requisition.empty-full-supply'
            : 'requisitions.requisition.empty-non-full-supply',
      )}
    />
  );
  const footer = <DataTablePagination table={table} />;
  const visible = table.getVisibleLeafColumns();
  useLayoutEffect(() => {
    if (view.cards || !columns.some((column) => column.sticky)) return;
    const headers = tableElement.current?.querySelectorAll<HTMLTableCellElement>('th[data-pinned]');
    if (!headers?.length) return;
    const update = () => {
      const widths = Object.fromEntries(
        Array.from(headers, (h) => [h.dataset.pinned as string, h.offsetWidth]),
      );
      setPinnedWidths((previous) =>
        JSON.stringify(previous) === JSON.stringify(widths) ? previous : widths,
      );
    };
    update();
    const observer = new ResizeObserver(update);
    for (const header of headers) observer.observe(header);
    return () => observer.disconnect();
  }, [columns, view.cards]);
  const pin = (id: string) => {
    const pinned = visible.filter((c) => columns.find((column) => column.name === c.id)?.sticky);
    const index = pinned.findIndex((c) => c.id === id);
    return index < 0
      ? {}
      : {
          sticky: true,
          stickyOffset: pinned
            .slice(0, index)
            .reduce((sum, c) => sum + (pinnedWidths[c.id] ?? 0), 0),
        };
  };
  const adjustment = models.find((model) => model.line.id === search.adjustments);
  return (
    <div ref={view.measure} className="flex min-w-0 flex-col gap-4">
      {supplyingStock && <SupplyingStockNote record={record} />}
      <RequisitionGridToolbar
        columns={columns}
        view={view}
        search={search}
        onSearchChange={onSearchChange}
        hideSkipped={hidesSkipped(record.template, tab)}
        skippedCount={selected.filter((model) => model.line.skipped).length}
        unit={unit}
        setUnit={setUnit}
        canSwitch={canSwitch}
      />
      {view.cards ? (
        <TableCards
          table={table}
          footer={footer}
          empty={empty}
          listRef={pageStart.ref}
          title="orderable.fullProductName"
          heading={(row) => row.category}
          tone={(row) => gridRowTone(row, supplyingHasStock)}
        />
      ) : (
        <DataTableCard>
          <Table
            ref={tableElement}
            density="compact"
            layout="auto"
            tabIndex={-1}
            aria-label={t('requisitions.requisition.products')}
          >
            <TableHeader>
              <TableRow pinned surface="muted">
                {visible.map((column) => {
                  const definition = columns.find((c) => c.name === column.id)?.definition;
                  const label = (
                    <DataTableHeaderLabel>{column.columnDef.meta?.label}</DataTableHeaderLabel>
                  );
                  return (
                    <TableHead
                      key={column.id}
                      data-pinned={
                        columns.find((c) => c.name === column.id)?.sticky ? column.id : undefined
                      }
                      {...pin(column.id)}
                    >
                      {definition ? (
                        <Tooltip>
                          <TooltipTrigger render={<button type="button" />}>{label}</TooltipTrigger>
                          <TooltipContent>{definition}</TooltipContent>
                        </Tooltip>
                      ) : (
                        label
                      )}
                    </TableHead>
                  );
                })}
              </TableRow>
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.length ? (
                table.getRowModel().rows.map((row) =>
                  row.original.category !== undefined ? (
                    <TableRow key={row.id} pinned surface="primary">
                      <TableCell colSpan={visible.length}>
                        <div className="sticky start-0 w-fit ps-6">
                          <bdi>{row.original.category}</bdi>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    <TableRow
                      key={row.id}
                      pinned
                      tone={gridRowTone(row.original, supplyingHasStock)}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id} {...pin(cell.column.id)}>
                          <FlexRender cell={cell} />
                        </TableCell>
                      ))}
                    </TableRow>
                  ),
                )
              ) : (
                <TableRow>
                  <TableCell colSpan={visible.length}>{empty}</TableCell>
                </TableRow>
              )}
            </TableBody>
            {visible.some((column) => column.id === 'totalCost') && (
              <TableFooter>
                <TableRow pinned surface="muted">
                  {visible.map((column, index) => (
                    <TableCell key={column.id} {...pin(column.id)}>
                      {index === 0 && t('requisitions.requisition.total')}
                      {column.id === 'totalCost' && (
                        <bdi>{formatCurrency(totals[tab], currency)}</bdi>
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              </TableFooter>
            )}
          </Table>
          <DataTableFooter>{footer}</DataTableFooter>
        </DataTableCard>
      )}
      {adjustment && !record.template.populateStockOnHandFromStockCards && (
        <AdjustmentsDialog
          model={adjustment}
          reasons={record.stockAdjustmentReasons ?? []}
          unit={unit}
          onClose={onCloseAdjustments}
        />
      )}
    </div>
  );
}
function renderValue(
  column: GridColumn,
  model: RequisitionLine,
  context: {
    currency: CurrencySettings;
    unit: QuantityUnit;
    formatter: Intl.NumberFormat;
    shortfall: boolean;
    shortfallLabel: string;
    cards: boolean;
    stockBased: boolean;
    yes: string;
    no: string;
    unavailable: string;
    onAdjustments: (id: string) => void;
  },
) {
  const { line, product } = model;
  const value = line[column.name as keyof RequisitionLineItem];
  if (
    line.patientQuantitiesNotAvailable &&
    (PATIENT_QUANTITY_COLUMNS as readonly string[]).includes(column.name)
  )
    return context.unavailable;
  switch (column.kind) {
    case 'product':
      return column.name === 'orderable.productCode' ? (
        (product?.productCode ?? null)
      ) : product ? (
        <bdi>
          {context.cards
            ? `${productLabel(product)} (${product.productCode})`
            : product.fullProductName}
        </bdi>
      ) : null;
    case 'packSize':
      return product?.netContent == null ? null : context.formatter.format(product.netContent);
    case 'unit':
      return tableValue(product?.dispensable?.displayUnit);
    case 'skip':
      return context.cards ? (
        <FlagBadge value={!!line.skipped} trueLabel={context.yes} falseLabel={context.no} />
      ) : (
        <Checkbox
          disabled
          checked={!!line.skipped}
          aria-label={`${column.label}: ${product?.fullProductName ?? product?.productCode ?? ''}`}
        />
      );
    case 'currency':
      return formatCurrency(value as number | null | undefined, context.currency);
    case 'text':
      return tableValue(value as string | null | undefined);
    default: {
      const number = value as number | null | undefined;
      const text =
        column.convertsToPacks || column.kind === 'supplyingStock'
          ? cardQuantity(number, product?.netContent, context.unit, undefined, context.formatter)
          : number == null
            ? null
            : context.formatter.format(number);
      const quantity =
        text != null &&
        context.unit === 'PACKS' &&
        (column.convertsToPacks || column.kind === 'supplyingStock') ? (
          <bdi dir="ltr">{text}</bdi>
        ) : (
          text
        );
      return column.kind === 'adjustments' && !context.stockBased && text != null ? (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => context.onAdjustments(line.id)}
          aria-label={`${column.label}: ${text}, ${product?.fullProductName ?? product?.productCode ?? ''}`}
        >
          {quantity}
          <ChevronRightIcon data-icon="inline-end" className="rtl:rotate-180" />
        </Button>
      ) : column.kind === 'supplyingStock' && context.shortfall ? (
        <span className="inline-flex items-center gap-1">
          {quantity ?? (context.cards ? EMPTY_VALUE : null)}
          <TriangleAlertIcon aria-hidden className="size-4 text-warning" />
          <span className="sr-only">{context.shortfallLabel}</span>
        </span>
      ) : (
        quantity
      );
    }
  }
}
