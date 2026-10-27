import { useSuspenseQueries } from '@tanstack/react-query';
import { createColumnHelper, FlexRender, functionalUpdate, useTable } from '@tanstack/react-table';
import { ChevronRightIcon } from 'lucide-react';
import { useEffect, useMemo } from 'react';
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
import {
  approvedProductsByIdentitiesOptions,
  currencySettingsOptions,
  orderablesByIdentitiesOptions,
  processingPeriodOptions,
  programLookupOptions,
} from '@/features/reference-data/api/queries';
import { productLabel } from '@/features/reference-data/lib/products';
import { AdjustmentsDialog } from '@/features/requisitions/components/adjustments-dialog';
import {
  gridRowTone,
  RequisitionGridCards,
} from '@/features/requisitions/components/requisition-grid-cards';
import { RequisitionGridToolbar } from '@/features/requisitions/components/requisition-grid-toolbar';
import { RequisitionTotals } from '@/features/requisitions/components/requisition-totals';
import { SupplyingStockNote } from '@/features/requisitions/components/supplying-stock-note';
import { calculateLine, calculateTotals } from '@/features/requisitions/lib/calculations';
import { type CurrencySettings, formatCurrency } from '@/features/requisitions/lib/currency';
import {
  buildLines,
  filterLines,
  type RequisitionLine,
  splitLines,
} from '@/features/requisitions/lib/lines';
import type {
  RequisitionApprovedProduct,
  RequisitionLineItem,
  RequisitionProduct,
} from '@/features/requisitions/lib/requisition';
import { compileColumns, type GridColumn } from '@/features/requisitions/lib/template';
import type { RequisitionRecord } from '@/features/requisitions/lib/types';
import { useCardView } from '@/hooks/use-card-view';
import { usePageStart } from '@/hooks/use-page-start';
import { tableValue } from '@/lib/empty-value';
import { cardQuantity, type QuantityUnit } from '@/lib/quantity';
import {
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
export function RequisitionGrid(props: Props) {
  const { record } = props;
  const [
    { data: products },
    { data: approvedProducts },
    { data: period },
    { data: currency },
    { data: program },
  ] = useSuspenseQueries({
    queries: [
      orderablesByIdentitiesOptions(record.requisitionLineItems.map((l) => l.orderable)),
      approvedProductsByIdentitiesOptions(
        record.requisitionLineItems.flatMap((l) => (l.approvedProduct ? [l.approvedProduct] : [])),
      ),
      processingPeriodOptions(record.processingPeriod.id),
      currencySettingsOptions(),
      programLookupOptions(record.program.id),
    ],
  });
  return (
    <RequisitionGridView
      {...props}
      products={products}
      approvedProducts={approvedProducts}
      monthsInPeriod={period.durationInMonths ?? 1}
      currency={currency}
      showNonFullSupply={!!program.showNonFullSupplyTab}
    />
  );
}
export function RequisitionGridView({
  record,
  tab,
  search,
  onSearchChange,
  onAdjustments,
  onCloseAdjustments,
  supplyingStock,
  products,
  approvedProducts,
  monthsInPeriod,
  currency,
  showNonFullSupply,
  unit,
  setUnit,
  canSwitch,
}: Props & {
  products: readonly RequisitionProduct[];
  approvedProducts: readonly RequisitionApprovedProduct[];
  monthsInPeriod: number;
  currency: CurrencySettings;
  showNonFullSupply: boolean;
  unit: QuantityUnit;
  setUnit: (unit: QuantityUnit) => void;
  canSwitch: boolean;
}) {
  const { t, i18n } = useTranslation();
  const models = useMemo(
    () =>
      buildLines(record, products, approvedProducts).map((model) => ({
        ...model,
        line: calculateLine(model, record, monthsInPeriod),
      })),
    [record, products, approvedProducts, monthsInPeriod],
  );
  const totals = useMemo(() => calculateTotals(models), [models]);
  const columns = useMemo(
    () =>
      compileColumns(record.template, {
        tab,
        status: record.status,
        emergency: record.emergency,
        supplyingStock,
      }).map((column) =>
        column.kind === 'packSize'
          ? { ...column, label: t('requisitions.requisition.pack-size') }
          : {
              ...column,
              definition: column.definition.replace(
                'Total losses and adjustments modal is disabled for stock based requisitions.',
                t('requisitions.adjustments.stock-based-note'),
              ),
            },
      ),
    [record, tab, supplyingStock, t],
  );
  const hideable = useMemo(
    () => columns.filter((column) => !column.sticky).map((column) => ({ id: column.name })),
    [columns],
  );
  const templateId =
    (record.template as { id?: string }).id ??
    Object.keys(record.template.columnsMap).sort().join(':');
  const view = useCardView(hideable, `requisition-columns:${templateId}`);
  const selected = useMemo(() => splitLines(models)[tab], [models, tab]);
  const filtered = useMemo(
    () =>
      filterLines(selected, {
        template: record.template,
        product: search.product,
        showSkipped: search.skipped,
      }),
    [selected, record.template, search.product, search.skipped],
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
                  language: i18n.language,
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
      i18n.language,
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
      columnVisibility: view.columnView.visibility,
    },
    onPaginationChange: pageStart.onPaginationChange((updater) =>
      onSearchChange(
        (previous) => {
          const current = toPaginationState(detailTableSearch(previous));
          const next = fromPaginationState(current, functionalUpdate(updater, current));
          return { detailPage: next.page, detailSize: next.size };
        },
        false,
        pageStart.navigation,
      ),
    ),
  });
  const empty = (
    <DataTableEmpty
      action={
        search.product ? (
          <Button
            variant="outline"
            onClick={() => onSearchChange({ product: undefined, detailPage: undefined }, true)}
          >
            {t('data-table.clear-filters')}
          </Button>
        ) : undefined
      }
      title={t(
        search.product
          ? 'requisitions.requisition.no-matching-products'
          : tab === 'fullSupply'
            ? 'requisitions.requisition.empty-full-supply'
            : 'requisitions.requisition.empty-non-full-supply',
      )}
    />
  );
  const footer = <DataTablePagination table={table} />;
  const visible = table.getVisibleLeafColumns();
  const adjustment = models.find((model) => model.line.id === search.adjustments);
  return (
    <div ref={view.measure} className="flex min-w-0 flex-col gap-4">
      {supplyingStock && <SupplyingStockNote record={record} />}
      <RequisitionGridToolbar
        columns={columns}
        view={view}
        search={search}
        onSearchChange={onSearchChange}
        hideSkipped={
          record.template.columnsMap.skipped?.option?.optionName === 'hideSkippedLineItems'
        }
        skippedCount={selected.filter((model) => model.line.skipped).length}
        unit={unit}
        setUnit={setUnit}
        canSwitch={canSwitch}
      />
      {view.cards ? (
        <RequisitionGridCards
          table={table}
          footer={footer}
          empty={empty}
          listRef={pageStart.ref}
          supplyingStock={supplyingStock}
        />
      ) : (
        <DataTableCard>
          <Table
            density="compact"
            layout="auto"
            tabIndex={-1}
            aria-label={t('requisitions.requisition.products')}
          >
            <TableHeader surface="muted">
              <TableRow>
                {visible.map((column) => {
                  const definition = columns.find((c) => c.name === column.id)?.definition;
                  const label = (
                    <DataTableHeaderLabel>{column.columnDef.meta?.label}</DataTableHeaderLabel>
                  );
                  return (
                    <TableHead key={column.id}>
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
                    <TableRow key={row.id} surface="primary">
                      <TableCell colSpan={visible.length}>
                        <div className="ps-6">
                          <bdi>{row.original.category}</bdi>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    <TableRow key={row.id} tone={gridRowTone(row.original, supplyingStock)}>
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>
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
            <TableFooter>
              <TableRow>
                {visible.map((column, index) => (
                  <TableCell key={column.id}>
                    {index === 0 ? (
                      t('requisitions.requisition.total')
                    ) : column.id === 'totalCost' ? (
                      <bdi>{formatCurrency(totals[tab], currency)}</bdi>
                    ) : null}
                  </TableCell>
                ))}
              </TableRow>
            </TableFooter>
          </Table>
          <DataTableFooter>{footer}</DataTableFooter>
        </DataTableCard>
      )}
      <RequisitionTotals
        totals={totals}
        currency={currency}
        showNonFullSupply={showNonFullSupply}
      />
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
    language: string;
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
    [
      'totalRequirement',
      'totalQuantityNeededByHf',
      'quantityToIssue',
      'convertedQuantityToIssue',
    ].includes(column.name)
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
            : productLabel(product)}
        </bdi>
      ) : null;
    case 'packSize':
      return product?.netContent == null
        ? null
        : new Intl.NumberFormat(context.language).format(product.netContent);
    case 'unit':
      return tableValue(product?.dispensable?.displayUnit);
    case 'skip':
      return context.cards ? (
        <FlagBadge value={!!line.skipped} trueLabel={context.yes} falseLabel={context.no} />
      ) : (
        <Checkbox disabled checked={!!line.skipped} aria-label={column.label} />
      );
    case 'currency':
      return formatCurrency(value as number | null | undefined, context.currency);
    case 'text':
      return tableValue(value as string | null | undefined);
    default: {
      const number = value as number | null | undefined;
      const text =
        column.convertsToPacks || column.kind === 'supplyingStock'
          ? cardQuantity(number, product?.netContent, context.unit, context.language)
          : number == null
            ? null
            : new Intl.NumberFormat(context.language).format(number);
      return column.kind === 'adjustments' && !context.stockBased && text != null ? (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => context.onAdjustments(line.id)}
          aria-label={`${column.label}: ${product?.fullProductName ?? product?.productCode ?? ''}`}
        >
          {text}
          <ChevronRightIcon data-icon="inline-end" className="rtl:rotate-180" />
        </Button>
      ) : (
        text
      );
    }
  }
}
