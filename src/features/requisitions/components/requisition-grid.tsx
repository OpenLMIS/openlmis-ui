import { createColumnHelper, functionalUpdate, useTable } from '@tanstack/react-table';
import { defaultRangeExtractor, useWindowVirtualizer } from '@tanstack/react-virtual';
import type { ParseKeys } from 'i18next';
import {
  CircleAlertIcon,
  EyeIcon,
  PlusIcon,
  SquarePenIcon,
  Trash2Icon,
  TriangleAlertIcon,
} from 'lucide-react';
import {
  type ComponentProps,
  type CSSProperties,
  Fragment,
  memo,
  type ReactNode,
  type Ref,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  DataTableCard,
  DataTableEmpty,
  type DataTableFeatures,
  DataTableFooter,
  dataTableFeatures,
} from '@/components/data-table/data-table';
import { DataTablePagination } from '@/components/data-table/data-table-pagination';
import { QuantityHeaderSizer } from '@/components/display/quantity-header-sizer';
import { TableCards } from '@/components/display/table-cards';
import { ActionTooltip } from '@/components/shared/action-tooltip';
import { FlagBadge } from '@/components/shared/flag-badge';
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
import { RequisitionCopyBadge } from '@/features/requisitions/components/requisition-copy-notice';
import { RequisitionDraftStatus } from '@/features/requisitions/components/requisition-draft-status';
import { RequisitionEditCards } from '@/features/requisitions/components/requisition-edit-cards';
import { RequisitionGridHeader } from '@/features/requisitions/components/requisition-grid-header';
import { RequisitionGridToolbar } from '@/features/requisitions/components/requisition-grid-toolbar';
import { RequisitionInput } from '@/features/requisitions/components/requisition-input';
import { SkipControls } from '@/features/requisitions/components/skip-controls';
import { SupplyingStockNote } from '@/features/requisitions/components/supplying-stock-note';
import { useGridWidths } from '@/features/requisitions/hooks/use-grid-widths';
import { useLiveGridLine } from '@/features/requisitions/hooks/use-live-grid-line';
import type { RequisitionEditor } from '@/features/requisitions/hooks/use-requisition-form';
import type { calculateTotals } from '@/features/requisitions/lib/calculations';
import { formatCurrency } from '@/features/requisitions/lib/currency';
import { canRemoveLine, type LineDraft } from '@/features/requisitions/lib/draft';
import { gridRowTone } from '@/features/requisitions/lib/grid-row-tone';
import { filterLines, type RequisitionLine } from '@/features/requisitions/lib/lines';
import type { PatientsData } from '@/features/requisitions/lib/patients';
import { PATIENT_QUANTITY_COLUMNS } from '@/features/requisitions/lib/patients';
import type { RequisitionLineItem } from '@/features/requisitions/lib/requisition';
import {
  columnViewKey,
  type GridColumn,
  gridColumns,
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
  addProduct?: boolean;
};
export type GridModel = RequisitionLine & { canSkip: boolean };
export type GridRow = { id: string; category?: string; model?: GridModel };
type Props = {
  record: RequisitionRecord;
  editing?: GridEditing;
  errors?: Record<string, Record<string, ParseKeys>>;
  onAddProduct?: () => void;
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
  editing,
  errors = {},
  onAddProduct,
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
  models: GridModel[];
  totals: ReturnType<typeof calculateTotals>;
  currency: CurrencySettings;
}) {
  const { t, i18n } = useTranslation();
  const formatter = useMemo(() => new Intl.NumberFormat(i18n.language), [i18n.language]);
  const tableElement = useRef<HTMLTableElement>(null);
  const region = useRef<HTMLDivElement>(null);
  const [focusAfterRemoval, setFocusAfterRemoval] = useState<string | null>(null);
  const [pinnedWidths, setPinnedWidths] = useState<Record<string, number>>({});
  const columns = useMemo(
    () =>
      gridColumns(
        record.template,
        {
          tab,
          status: record.status,
          emergency: record.emergency,
          supplyingStock: supplyingStock && !record.supplyingFacilityAccessDenied,
        },
        t,
      ),
    [
      record.template,
      record.status,
      record.emergency,
      record.supplyingFacilityAccessDenied,
      tab,
      supplyingStock,
      t,
    ],
  );
  const hideable = useMemo(
    () => columns.filter((column) => !column.sticky).map((column) => ({ id: column.name })),
    [columns],
  );
  const view = useCardView(hideable, columnViewKey(record.template));
  const measure = useCallback(
    (element: HTMLDivElement | null) => {
      region.current = element;
      view.measure(element);
    },
    [view.measure],
  );
  const selected = useMemo(
    () => models.filter((model) => model.fullSupply === (tab === 'fullSupply')),
    [models, tab],
  );
  const skipFilter = !!editing?.skipLines && tab === 'fullSupply';
  const filtered = useMemo(
    () =>
      filterLines(selected, {
        hideSkipped: hidesSkipped(record.template, tab),
        product: search.product,
        showSkipped: skipFilter ? search.skipped : undefined,
      }),
    [selected, record.template, tab, search.product, search.skipped, skipFilter],
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
  const cellContext = useMemo(
    () => ({
      currency,
      unit,
      formatter,
      shortfallLabel: t('requisitions.requisition.stock-shortfall'),
      cards: view.cards,
      stockBased: !!record.template.populateStockOnHandFromStockCards,
      yes: t('requisitions.yes'),
      no: t('requisitions.no'),
      unavailable: t('requisitions.requisition.not-available'),
      onAdjustments,
    }),
    [
      currency,
      unit,
      formatter,
      view.cards,
      record.template.populateStockOnHandFromStockCards,
      t,
      onAdjustments,
    ],
  );
  const removable = canRemoveLine(tab === 'fullSupply', !!editing?.editable);
  const removal = useRef({ data, editing });
  removal.current = { data, editing };
  const removeLine = useCallback((id: string) => {
    const { data, editing } = removal.current;
    if (!editing || editing.pending) return;
    const ids = data.flatMap((row) => (row.model ? [row.id] : []));
    const index = ids.indexOf(id);
    setFocusAfterRemoval(ids[index + 1] ?? ids[index - 1] ?? '__grid');
    editing.editor.removeLine(id);
  }, []);
  useLayoutEffect(() => {
    if (!focusAfterRemoval) return;
    const target =
      region.current?.querySelector<HTMLElement>(
        `[data-requisition-remove="${CSS.escape(focusAfterRemoval)}"]`,
      ) ??
      region.current?.querySelector<HTMLElement>(view.cards ? 'ul' : 'table') ??
      region.current;
    target?.focus();
    setFocusAfterRemoval(null);
  }, [focusAfterRemoval, view.cards]);
  const defs = useMemo(() => {
    const defs = columns.map((column) =>
      helper.display({
        id: column.name,
        header: column.label,
        meta: { label: column.label },
        cell: view.cards
          ? ({ row }) =>
              row.original.model
                ? renderValue(
                    column,
                    row.original.model,
                    cellContext,
                    supplyingHasStock && gridRowTone(row.original, true) === 'shortfall',
                  )
                : null
          : () => null,
      }),
    );
    if (removable)
      defs.push(
        helper.display({
          id: 'actions',
          meta: { label: t('requisitions.edit.line-actions') },
          cell: () => null,
        }),
      );
    return defs;
  }, [columns, view.cards, cellContext, supplyingHasStock, removable, t]);
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
  const [focusedRow, setFocusedRow] = useState<number | null>(null);
  const virtual = !view.cards && data.length > 30;
  const virtualizer = useWindowVirtualizer({
    count: data.length,
    enabled: virtual,
    estimateSize: () => 48,
    overscan: 4,
    scrollMargin: tableElement.current
      ? tableElement.current.getBoundingClientRect().top + window.scrollY
      : 0,
    getItemKey: (index) => data[index].id,
    rangeExtractor: (range) => {
      const indices = new Set(defaultRangeExtractor(range));
      if (focusedRow !== null)
        for (const index of [focusedRow - 1, focusedRow, focusedRow + 1]) {
          if (index >= 0 && index < data.length) indices.add(index);
        }
      return [...indices].sort((a, b) => a - b);
    },
  });
  useEffect(() => {
    const reveal = (event: Event) => {
      const detail = (event as CustomEvent<{ requisitionId: string; lineId: string }>).detail;
      if (!virtual || detail.requisitionId !== record.id) return;
      const index = data.findIndex((row) => row.id === detail.lineId);
      if (index < 0) return;
      setFocusedRow(index);
      virtualizer.scrollToIndex(index, { align: 'center' });
    };
    document.addEventListener('requisition-line-focus', reveal);
    return () => document.removeEventListener('requisition-line-focus', reveal);
  }, [virtual, record.id, data, virtualizer]);
  const tableRows = table.getRowModel().rows;
  const renderedRows = virtual
    ? virtualizer.getVirtualItems()
    : tableRows.map((_, index) => ({ index, start: 0, end: 0 }));
  let previousEnd = virtualizer.options.scrollMargin ?? 0;
  const empty = (
    <DataTableEmpty
      action={
        search.product || search.skipped !== undefined ? (
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
      description={
        !search.product && search.skipped === undefined
          ? t(
              tab === 'fullSupply'
                ? 'requisitions.requisition.empty-full-supply-description'
                : 'requisitions.requisition.empty-non-full-supply-description',
            )
          : undefined
      }
      title={t(
        search.product || search.skipped !== undefined
          ? 'requisitions.requisition.no-matching-products'
          : tab === 'fullSupply'
            ? 'requisitions.requisition.empty-full-supply'
            : 'requisitions.requisition.empty-non-full-supply',
      )}
    />
  );
  const footer = (
    <DataTablePagination
      table={table}
      isPageInvalid={(index) =>
        filtered
          .slice(index * pagination.pageSize, (index + 1) * pagination.pageSize)
          .some((model) => !!errors[model.line.id])
      }
    />
  );
  const visible = table.getVisibleLeafColumns();
  const columnsById = useMemo(
    () => new Map(columns.map((column) => [column.name, column])),
    [columns],
  );
  const pinnedIds = visible
    .filter((column) => columnsById.get(column.id)?.sticky)
    .map((column) => column.id);
  const pinnedKey = pinnedIds.join('|');
  useLayoutEffect(() => {
    if (view.cards || !pinnedKey) return;
    const headers = tableElement.current?.querySelectorAll<HTMLTableCellElement>('th[data-pinned]');
    if (!headers?.length) return;
    const update = () => {
      const widths = Object.fromEntries(
        Array.from(headers, (h) => [h.dataset.pinned as string, h.getBoundingClientRect().width]),
      );
      setPinnedWidths((previous) =>
        JSON.stringify(previous) === JSON.stringify(widths) ? previous : widths,
      );
    };
    update();
    const observer = new ResizeObserver(update);
    for (const header of headers) observer.observe(header);
    return () => observer.disconnect();
  }, [pinnedKey, view.cards]);
  const pinnedColumns = useMemo(() => {
    const ids = pinnedKey ? pinnedKey.split('|') : [];
    const pinned = new Map<string, { sticky: true; stickyOffset: number }>();
    let offset = 0;
    for (const id of ids) {
      pinned.set(id, { sticky: true, stickyOffset: offset });
      offset += pinnedWidths[id] ?? 0;
    }
    return pinned;
  }, [pinnedKey, pinnedWidths]);
  const visibleKey = visible.map((column) => column.id).join('|');
  const rowColumns = useMemo(
    () => columns.filter((column) => visibleKey.split('|').includes(column.name)),
    [columns, visibleKey],
  );
  const widthModels = useRef({ record, models });
  if (widthModels.current.record !== record) widthModels.current = { record, models };
  const baselineModels = widthModels.current.models;
  const sizing = useMemo(
    () =>
      rowColumns.map((column) => ({
        label: column.label,
        min: column.kind === 'skip' ? 56 : column.name === 'orderable.fullProductName' ? 240 : 112,
        max:
          column.kind === 'skip'
            ? 80
            : column.name === 'orderable.fullProductName'
              ? 384
              : Number.POSITIVE_INFINITY,
        values: baselineModels.map((model) =>
          String(
            column.name === 'orderable.fullProductName'
              ? (model.product?.fullProductName ?? '')
              : column.name === 'orderable.productCode'
                ? (model.product?.productCode ?? '')
                : column.kind === 'currency'
                  ? (formatCurrency(
                      model.line[column.name as keyof RequisitionLineItem] as number,
                      currency,
                    ) ?? '')
                  : column.kind === 'quantity' || column.kind === 'count'
                    ? '0000000000'
                    : (model.line[column.name as keyof RequisitionLineItem] ?? ''),
          ),
        ),
      })),
    [rowColumns, baselineModels, currency],
  );
  const widths = useGridWidths(region, sizing, !view.cards);
  const leadingPinned = visible.findIndex((column) => !pinnedColumns.has(column.id));
  const totalSpan = Math.max(1, leadingPinned === -1 ? visible.length : leadingPinned);
  const adjustment = models.find((model) => model.line.id === search.adjustments);
  const status = editing?.editable && editing.editor.device.deviceAvailable && (
    <RequisitionDraftStatus editor={editing.editor} />
  );
  return (
    <div ref={measure} tabIndex={-1} className="flex min-w-0 flex-col gap-4 outline-none">
      {supplyingStock && <SupplyingStockNote record={record} />}
      <RequisitionGridToolbar
        disabled={editing?.pending}
        action={
          editing?.editable &&
          (tab === 'nonFullSupply'
            ? editing.addNonFullSupplyProduct
            : editing.addFullSupplyProduct) && (
            <Button size="lg" disabled={editing.pending} onClick={onAddProduct}>
              <PlusIcon />
              {t('requisitions.edit.add-product')}
            </Button>
          )
        }
        extra={
          editing?.editable
            ? editing.skipLines &&
              tab === 'fullSupply' &&
              !record.emergency && (
                <SkipControls
                  editing={editing}
                  all={selected}
                  page={data.flatMap((row) => (row.model ? [row.model] : []))}
                />
              )
            : undefined
        }
        status={
          !view.cards && (
            <div className="flex flex-wrap items-center justify-end gap-2">
              {status || <RequisitionCopyBadge />}
            </div>
          )
        }
        columns={columns}
        view={view}
        search={search}
        onSearchChange={onSearchChange}
        hideSkipped={hidesSkipped(record.template, tab)}
        showSkipFilter={skipFilter}
        unit={unit}
        setUnit={setUnit}
        canSwitch={canSwitch}
      />
      {view.cards && editing?.editable ? (
        <RequisitionEditCards
          requisitionId={record.id}
          supplyingStock={supplyingHasStock}
          rows={data}
          columns={rowColumns}
          context={cellContext}
          editing={editing}
          errors={errors}
          footer={footer}
          empty={empty}
          listRef={pageStart.ref}
          remove={removable ? removeLine : undefined}
          pending={editing.pending}
          unit={unit}
        />
      ) : view.cards ? (
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
            layout="fixed"
            width="columns"
            style={
              {
                '--table-width': `${widths.reduce((a, b) => a + b, removable ? 48 : 0)}px`,
              } as CSSProperties
            }
            tabIndex={-1}
            aria-label={t('requisitions.requisition.products')}
            aria-rowcount={
              data.length + 1 + Number(rowColumns.some((column) => column.name === 'totalCost'))
            }
            onFocusCapture={(event) => {
              const row = (event.target as HTMLElement).closest<HTMLElement>('tr[data-index]');
              if (row) setFocusedRow(Number(row.dataset.index));
            }}
          >
            <colgroup>
              {widths.map((width, index) => (
                <col
                  key={rowColumns[index].name}
                  className="w-(--column-width)"
                  style={{ '--column-width': `${width}px` } as CSSProperties}
                />
              ))}
              {removable && <col className="w-12" />}
            </colgroup>
            <RequisitionTableHeader
              columns={rowColumns}
              pinned={pinnedColumns}
              editing={editing}
              unit={unit}
              removable={removable}
            />
            <TableBody>
              {table.getRowModel().rows.length ? (
                renderedRows.map((item) => {
                  const row = tableRows[item.index];
                  const gap = virtual ? item.start - previousEnd : 0;
                  previousEnd = item.end;
                  return (
                    <Fragment key={row.id}>
                      {gap > 0 && (
                        <tr aria-hidden className="invisible">
                          <td
                            colSpan={visible.length}
                            className="requisition-spacer"
                            style={{ '--requisition-spacer-height': `${gap}px` } as CSSProperties}
                          />
                        </tr>
                      )}
                      {row.original.category !== undefined ? (
                        <TableRow
                          data-index={item.index}
                          aria-rowindex={item.index + 2}
                          ref={virtual ? virtualizer.measureElement : undefined}
                          pinned
                          surface="primary"
                        >
                          <TableCell colSpan={visible.length}>
                            <div className="sticky start-1.5 w-fit ps-6">
                              <bdi>{row.original.category}</bdi>
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : (
                        <RequisitionProductRow
                          rowIndex={item.index}
                          measure={virtual ? virtualizer.measureElement : undefined}
                          model={row.original.model}
                          columns={rowColumns}
                          errors={errors[row.id]}
                          context={cellContext}
                          shortfall={supplyingHasStock}
                          editing={editing}
                          pinned={pinnedColumns}
                          remove={removable ? removeLine : undefined}
                        />
                      )}
                    </Fragment>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={visible.length}>{empty}</TableCell>
                </TableRow>
              )}
              {virtual && (
                <tr aria-hidden className="invisible">
                  <td
                    colSpan={visible.length}
                    className="requisition-spacer"
                    style={
                      {
                        '--requisition-spacer-height': `${Math.max(
                          0,
                          virtualizer.getTotalSize() -
                            previousEnd +
                            (virtualizer.options.scrollMargin ?? 0),
                        )}px`,
                      } as CSSProperties
                    }
                  />
                </tr>
              )}
            </TableBody>
            {visible.some((column) => column.id === 'totalCost') && (
              <TableFooter>
                <TableRow pinned surface="muted">
                  <TableCell
                    colSpan={totalSpan}
                    {...(pinnedColumns.size ? { sticky: true, stickyOffset: 0 } : {})}
                  >
                    {t('requisitions.requisition.total')}
                    {visible[0]?.id === 'totalCost' && (
                      <bdi>{formatCurrency(totals[tab], currency)}</bdi>
                    )}
                  </TableCell>
                  {visible.slice(totalSpan).map((column) => (
                    <TableCell key={column.id}>
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
      {adjustment &&
        !editing?.editableColumns.includes('totalLossesAndAdjustments') &&
        !record.template.populateStockOnHandFromStockCards && (
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
const RequisitionTableHeader = memo(function RequisitionTableHeader({
  columns,
  pinned,
  editing,
  unit,
  removable,
}: {
  columns: GridColumn[];
  pinned: Map<string, { sticky: true; stickyOffset: number }>;
  editing?: GridEditing;
  unit: QuantityUnit;
  removable: boolean;
}) {
  const { t } = useTranslation();
  return (
    <TableHeader>
      <TableRow pinned surface="muted">
        {columns.map((column) => (
          <TableHead
            key={column.name}
            data-pinned={pinned.has(column.name) ? column.name : undefined}
            width={column.kind === 'skip' ? 'fit' : undefined}
            {...pinned.get(column.name)}
          >
            <RequisitionGridHeader
              label={column.label}
              definition={column.definition}
              align={column.kind === 'skip' ? 'center' : 'start'}
            />
            {editing?.editable &&
              column.kind === 'quantity' &&
              editing.editableColumns.includes(column.name) && <QuantityHeaderSizer unit={unit} />}
          </TableHead>
        ))}
        {removable && (
          <TableHead>
            <RequisitionGridHeader label={t('requisitions.edit.line-actions')} />
          </TableHead>
        )}
      </TableRow>
    </TableHeader>
  );
});

type ProductRowProps = ComponentProps<typeof RequisitionProductRowView>;
const RequisitionProductRow = memo(function RequisitionProductRow(props: ProductRowProps) {
  return props.model && props.editing?.calculation ? (
    <LiveProductRow {...props} model={props.model} editing={props.editing} />
  ) : (
    <RequisitionProductRowView {...props} />
  );
});
function LiveProductRow(props: ProductRowProps & { model: GridModel; editing: GridEditing }) {
  const live = useLiveGridLine(props.model, props.editing);
  return <RequisitionProductRowView {...props} model={live.model} errors={live.errors} />;
}
const RequisitionProductRowView = memo(function RequisitionProductRowView({
  model,
  rowIndex,
  measure,
  columns,
  errors,
  context,
  shortfall,
  editing,
  pinned,
  remove,
}: {
  model?: GridModel;
  rowIndex?: number;
  measure?: Ref<HTMLTableRowElement>;
  columns: GridColumn[];
  errors?: Record<string, ParseKeys>;
  context: Parameters<typeof renderValue>[2];
  shortfall: boolean;
  editing?: GridEditing;
  pinned: Map<string, { sticky: true; stickyOffset: number }>;
  remove?: (id: string) => void;
}) {
  const { t } = useTranslation();
  if (!model) return null;
  const tone = gridRowTone({ model }, shortfall);
  return (
    <TableRow
      data-index={rowIndex}
      aria-rowindex={rowIndex === undefined ? undefined : rowIndex + 2}
      ref={measure}
      pinned
      data-invalid={!!errors || undefined}
      tone={tone}
    >
      {columns.map((column) => (
        <TableCell key={column.name} {...pinned.get(column.name)}>
          <RequisitionLineCell
            column={column}
            model={model}
            context={context}
            shortfall={tone === 'shortfall'}
            editing={editing}
            error={errors?.[column.name]}
          />
        </TableCell>
      ))}
      {remove && (
        <TableCell>
          <ActionTooltip reason={t('requisitions.edit.remove-product')}>
            <Button
              variant="destructive-ghost"
              size="icon-sm"
              aria-label={t('requisitions.edit.remove-product-label', {
                product: model.product?.fullProductName ?? '',
              })}
              data-requisition-remove={model.line.id}
              disabled={editing?.pending}
              onClick={() => remove(model.line.id)}
            >
              <Trash2Icon />
            </Button>
          </ActionTooltip>
        </TableCell>
      )}
    </TableRow>
  );
});
export const RequisitionLineCell = memo(
  function RequisitionLineCell({
    column,
    model,
    context,
    shortfall,
    editing,
    error,
  }: {
    column: GridColumn;
    model: GridModel;
    context: Parameters<typeof renderValue>[2];
    shortfall: boolean;
    editing?: GridEditing;
    error?: ParseKeys;
  }) {
    return editing ? (
      <RequisitionEditCell
        column={column}
        model={model}
        stockBased={context.stockBased}
        formatter={context.formatter}
        editing={editing}
        unit={context.unit}
        error={error}
        cards={context.cards}
        onAdjustments={context.onAdjustments}
      >
        {column.kind === 'adjustments' &&
        editing.editable &&
        editing.editableColumns.includes(column.name) &&
        !context.stockBased ? (
          cardQuantity(
            model.line.totalLossesAndAdjustments ?? 0,
            model.product?.netContent,
            context.unit,
            undefined,
            context.formatter,
          )
        ) : (
          <RequisitionReadCell
            column={column}
            model={model}
            context={context}
            shortfall={shortfall}
          />
        )}
      </RequisitionEditCell>
    ) : (
      renderValue(column, model, context, shortfall)
    );
  },
  (previous, next) => {
    if (
      previous.column !== next.column ||
      previous.context !== next.context ||
      previous.shortfall !== next.shortfall ||
      previous.editing !== next.editing ||
      previous.error !== next.error
    )
      return false;
    const { column, editing } = next;
    if (
      editing &&
      (editing.editableColumns.includes(column.name) ||
        column.kind === 'skip' ||
        column.kind === 'adjustments')
    )
      return previous.model === next.model;
    const a = previous.model;
    const b = next.model;
    return (
      a.line.id === b.line.id &&
      a.product === b.product &&
      a.line.patientQuantitiesNotAvailable === b.line.patientQuantitiesNotAvailable &&
      a.line[column.name as keyof RequisitionLineItem] ===
        b.line[column.name as keyof RequisitionLineItem]
    );
  },
);

function RequisitionReadCell({
  column,
  model,
  context,
  shortfall,
}: {
  column: GridColumn;
  model: GridModel;
  context: Parameters<typeof renderValue>[2];
  shortfall: boolean;
}) {
  return renderValue(column, model, context, shortfall);
}

function renderValue(
  column: GridColumn,
  model: RequisitionLine,
  context: {
    currency: CurrencySettings;
    unit: QuantityUnit;
    formatter: Intl.NumberFormat;
    shortfallLabel: string;
    cards: boolean;
    stockBased: boolean;
    yes: string;
    no: string;
    unavailable: string;
    onAdjustments: (id: string) => void;
  },
  shortfall: boolean,
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
        <bdi
          title={product?.fullProductName ?? undefined}
          className={context.cards ? undefined : 'line-clamp-3 max-w-96 whitespace-normal'}
        >
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
        <div className="flex justify-center">
          <SkipCheckbox
            disabled
            checked={!!line.skipped}
            aria-label={`${column.label}: ${product?.fullProductName ?? product?.productCode ?? ''}`}
          />
        </div>
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
        <AdjustmentsCell
          mode="view"
          cards={context.cards}
          name={`${column.label}: ${text}, ${product?.fullProductName ?? product?.productCode ?? ''}`}
          onOpen={() => context.onAdjustments(line.id)}
        >
          {quantity}
        </AdjustmentsCell>
      ) : column.kind === 'supplyingStock' && shortfall ? (
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

export type GridEditing = {
  calculation?: { record: RequisitionRecord; months: number; patients: PatientsData };
  patientsEditable?: boolean;
  approver?: boolean;
  editor: RequisitionEditor;
  editable: boolean;
  pending: boolean;
  editableColumns: readonly string[];
  skipLines: boolean;
  addFullSupplyProduct: boolean;
  addNonFullSupplyProduct: boolean;
};
function RequisitionEditCell({
  column,
  model,
  stockBased,
  formatter,
  editing,
  unit,
  error,
  cards,
  children,
  onAdjustments,
}: {
  column: GridColumn;
  model: GridModel;
  stockBased: boolean;
  formatter: Intl.NumberFormat;
  editing: GridEditing;
  unit: QuantityUnit;
  error?: ParseKeys;
  cards?: boolean;
  children?: ReactNode;
  onAdjustments: (id: string) => void;
}) {
  const { editor } = editing;
  const id = model.line.id;
  const rowLabel = `${model.product?.fullProductName ?? ''} (${model.product?.productCode ?? id})`;
  const label = `${column.label}: ${rowLabel}`;
  const field = column.name as keyof LineDraft;
  const draft = editor.draft.lines[id];
  const value = String(
    (draft && Object.hasOwn(draft, field) ? draft[field] : model.line[field]) ?? '',
  );
  const quantity = column.kind === 'quantity';
  const name = `${quantity ? 'quantities' : 'texts'}.${id}:${column.name}` as const;
  const input =
    editing.editable &&
    editing.editableColumns.includes(column.name) &&
    ['quantity', 'count', 'text'].includes(column.kind);
  if (editing.editable && column.kind === 'skip') {
    const checkbox = (
      <SkipCheckbox
        surface={cards ? 'background' : 'default'}
        checked={!!model.line.skipped}
        disabled={editing.pending || !editing.skipLines || (!model.line.skipped && !model.canSkip)}
        aria-label={label}
        onCheckedChange={(skipped) => editor.setLine(id, { skipped })}
      />
    );
    return cards ? checkbox : <div className="flex justify-center">{checkbox}</div>;
  }
  if (input)
    return (
      <div className={cards ? 'w-full min-w-0' : 'w-full min-w-20 whitespace-normal'}>
        <RequisitionInput
          name={name}
          label={label}
          value={value}
          kind={column.kind as 'quantity' | 'count' | 'text'}
          unit={unit}
          netContent={model.product?.netContent}
          cards={cards}
          disabled={editing.pending || !!model.line.skipped}
          error={error}
          maxLength={
            column.name === 'requestedQuantityExplanation'
              ? 255
              : column.name === 'remarks'
                ? 250
                : undefined
          }
          onChange={(value) => editor.setLine(id, { [column.name]: value } as LineDraft)}
        />
      </div>
    );
  if (
    editing.editable &&
    editing.editableColumns.includes(column.name) &&
    column.kind === 'adjustments' &&
    !stockBased
  )
    return (
      <AdjustmentsCell
        mode="edit"
        cards={cards}
        disabled={editing.pending || !!model.line.skipped}
        name={`${column.label}: ${cardQuantity(model.line.totalLossesAndAdjustments ?? 0, model.product?.netContent, unit, undefined, formatter)}, ${rowLabel}`}
        onOpen={() => onAdjustments(id)}
      >
        {children ?? '0'}
      </AdjustmentsCell>
    );
  return (
    <CalculatedError error={error}>{children ?? (cards ? EMPTY_VALUE : null)}</CalculatedError>
  );
}
function AdjustmentsCell({
  mode,
  cards = false,
  disabled = false,
  name,
  onOpen,
  children,
}: {
  mode: 'edit' | 'view';
  cards?: boolean;
  disabled?: boolean;
  name: string;
  onOpen: () => void;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const Icon = mode === 'edit' ? SquarePenIcon : EyeIcon;
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            aria-label={name}
            align={cards ? 'default' : 'between'}
            disabled={disabled}
            size="sm"
            variant="ghost"
            width={cards ? 'default' : 'full'}
            onClick={onOpen}
          />
        }
      >
        <Icon />
        <span className={cards ? 'font-medium tabular-nums' : 'tabular-nums'}>{children}</span>
      </TooltipTrigger>
      <TooltipContent>
        {t(mode === 'edit' ? 'requisitions.adjustments.edit' : 'requisitions.adjustments.view')}
      </TooltipContent>
    </Tooltip>
  );
}
function CalculatedError({ error, children }: { error?: ParseKeys; children?: ReactNode }) {
  const { t } = useTranslation();
  if (!error) return children;
  return (
    <span className="inline-flex items-center gap-1 text-destructive">
      {children}
      <Tooltip>
        <TooltipTrigger render={<Button variant="ghost" size="icon-xs" aria-label={t(error)} />}>
          <CircleAlertIcon className="size-4" aria-hidden />
        </TooltipTrigger>
        <TooltipContent>{t(error)}</TooltipContent>
      </Tooltip>
    </span>
  );
}

function SkipCheckbox({ 'aria-label': label, ...props }: ComponentProps<typeof Checkbox>) {
  const id = useId();
  return (
    <>
      <span id={id} className="sr-only">
        {label}
      </span>
      <Checkbox {...props} aria-labelledby={id} />
    </>
  );
}
