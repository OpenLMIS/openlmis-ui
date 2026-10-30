import {
  type CellContext,
  createColumnHelper,
  FlexRender,
  functionalUpdate,
  useTable,
} from '@tanstack/react-table';
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
  createContext,
  memo,
  type ReactNode,
  use,
  useCallback,
  useEffect,
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
import { DraftStatus } from '@/components/display/draft-status';
import { QuantityHeaderSizer } from '@/components/display/quantity-header-sizer';
import { TableCards } from '@/components/display/table-cards';
import { quantityValue } from '@/components/form/quantity-value';
import { ActionTooltip } from '@/components/shared/action-tooltip';
import { FlagBadge } from '@/components/shared/flag-badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Field } from '@/components/ui/field';
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
import { RequisitionEditCards } from '@/features/requisitions/components/requisition-edit-cards';
import { RequisitionGridHeader } from '@/features/requisitions/components/requisition-grid-header';
import { RequisitionGridToolbar } from '@/features/requisitions/components/requisition-grid-toolbar';
import { SkipControls } from '@/features/requisitions/components/skip-controls';
import { SupplyingStockNote } from '@/features/requisitions/components/supplying-stock-note';
import type { RequisitionEditor } from '@/features/requisitions/hooks/use-requisition-form';
import type { calculateTotals } from '@/features/requisitions/lib/calculations';
import { formatCurrency } from '@/features/requisitions/lib/currency';
import { canRemoveLine, type LineDraft } from '@/features/requisitions/lib/draft';
import { gridRowTone } from '@/features/requisitions/lib/grid-row-tone';
import { filterLines, type RequisitionLine } from '@/features/requisitions/lib/lines';
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
  const renderCell = useCallback(
    (column: GridColumn, row: GridRow) =>
      row.model ? (
        <RequisitionLineCell
          column={column}
          model={row.model}
          context={cellContext}
          shortfall={supplyingHasStock && gridRowTone(row, true) === 'shortfall'}
          editing={editing}
          error={errors[row.id]?.[column.name]}
        />
      ) : null,
    [cellContext, supplyingHasStock, editing, errors],
  );
  const removable = canRemoveLine(tab === 'fullSupply', !!editing?.editable);
  const removeLine = useCallback(
    (id: string) => {
      if (!editing || editing.pending) return;
      const ids = data.flatMap((row) => (row.model ? [row.id] : []));
      const index = ids.indexOf(id);
      setFocusAfterRemoval(ids[index + 1] ?? ids[index - 1] ?? '__grid');
      editing.editor.removeLine(id);
    },
    [editing, data],
  );
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
          : RequisitionTableCell,
      }),
    );
    if (removable)
      defs.push(
        helper.display({
          id: 'actions',
          meta: { label: t('requisitions.edit.line-actions') },
          cell: RequisitionTableCell,
        }),
      );
    return defs;
  }, [columns, view.cards, cellContext, supplyingHasStock, removable, t]);
  const renderColumn = useCallback(
    (id: string, row: GridRow) => {
      if (id === 'actions')
        return row.model && editing ? (
          <ActionTooltip reason={t('requisitions.edit.remove-product')}>
            <Button
              variant="destructive-ghost"
              size="icon-sm"
              aria-label={`${t('requisitions.edit.remove-product')}: ${row.model.product?.fullProductName}`}
              data-requisition-remove={row.id}
              disabled={editing.pending}
              onClick={() => removeLine(row.id)}
            >
              <Trash2Icon />
            </Button>
          </ActionTooltip>
        ) : null;
      const column = columns.find((column) => column.name === id);
      return column ? renderCell(column, row) : null;
    },
    [columns, renderCell, editing, removeLine, t],
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
  const pin = (id: string) => pinnedColumns.get(id);
  const leadingPinned = visible.findIndex((column) => !pinnedColumns.has(column.id));
  const totalSpan = Math.max(1, leadingPinned === -1 ? visible.length : leadingPinned);
  const adjustment = models.find((model) => model.line.id === search.adjustments);
  return (
    <RequisitionCells value={renderColumn}>
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
            editing?.editable
              ? editing.editor.device.deviceAvailable && (
                  <DraftStatus
                    {...editing.editor.device.status}
                    labels={{
                      copy: null,
                      conflictDescription: t('requisitions.edit.draft-conflict-description'),
                    }}
                    onRetry={editing.editor.device.retry}
                    onResolve={editing.editor.resolveConflict}
                  />
                )
              : undefined
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
            supplyingStock={supplyingHasStock}
            rows={data}
            columns={columns.filter((column) => view.columnView.visibility[column.name] !== false)}
            renderCell={renderCell}
            footer={footer}
            empty={empty}
            listRef={pageStart.ref}
            remove={removable ? removeLine : undefined}
            pending={editing.pending}
            invalid={(id) => !!errors[id]}
            unit={unit}
            isControl={(column) =>
              editing.editableColumns.includes(column.name) ||
              column.kind === 'skip' ||
              (column.kind === 'adjustments' && !record.template.populateStockOnHandFromStockCards)
            }
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
              layout="auto"
              tabIndex={-1}
              aria-label={t('requisitions.requisition.products')}
            >
              <TableHeader>
                <TableRow pinned surface="muted">
                  {visible.map((column) => (
                    <TableHead
                      key={column.id}
                      data-pinned={pinnedColumns.has(column.id) ? column.id : undefined}
                      width={columnsById.get(column.id)?.kind === 'skip' ? 'fit' : undefined}
                      {...pin(column.id)}
                    >
                      <RequisitionGridHeader
                        label={column.columnDef.meta?.label ?? ''}
                        definition={columnsById.get(column.id)?.definition}
                        align={columnsById.get(column.id)?.kind === 'skip' ? 'center' : 'start'}
                      />
                      {editing?.editable &&
                        columnsById.get(column.id)?.kind === 'quantity' &&
                        editing.editableColumns.includes(column.id) && (
                          <QuantityHeaderSizer unit={unit} />
                        )}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows.length ? (
                  table.getRowModel().rows.map((row) =>
                    row.original.category !== undefined ? (
                      <TableRow key={row.id} pinned surface="primary">
                        <TableCell colSpan={visible.length}>
                          <div className="sticky start-1.5 w-fit ps-6">
                            <bdi>{row.original.category}</bdi>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      <TableRow
                        key={row.id}
                        pinned
                        data-invalid={!!errors[row.id] || undefined}
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
        {adjustment && !editing?.editable && !record.template.populateStockOnHandFromStockCards && (
          <AdjustmentsDialog
            model={adjustment}
            reasons={record.stockAdjustmentReasons ?? []}
            unit={unit}
            onClose={onCloseAdjustments}
          />
        )}
      </div>
    </RequisitionCells>
  );
}
const RequisitionLineCell = memo(function RequisitionLineCell({
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
      {column.kind === 'adjustments' && editing.editable && !context.stockBased ? (
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
});

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

const RequisitionCells = createContext<(id: string, row: GridRow) => ReactNode>(() => null);
function RequisitionTableCell({ row, column }: CellContext<DataTableFeatures, GridRow, unknown>) {
  return use(RequisitionCells)(column.id, row.original);
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
        <div className="flex justify-center">
          <Checkbox
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
  const { t } = useTranslation();
  const { editor } = editing;
  const { form } = editor;
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
  useEffect(() => {
    if (input)
      form.setFieldMeta(name, (meta) => ({
        ...meta,
        isTouched: !!error,
        errorMap: { onChange: error },
      }));
  }, [form, name, input, error]);
  if (editing.editable && column.kind === 'skip') {
    const checkbox = (
      <Checkbox
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
        <Field surface="background">
          {quantity ? (
            <form.AppField
              name={`quantities.${id}:${column.name}`}
              defaultValue={quantityValue(value, model.product?.netContent)}
              listeners={{
                onChange: ({ value }) =>
                  editor.setLine(id, { [column.name]: value.doses } as LineDraft),
              }}
            >
              {(field) => (
                <field.QuantityField
                  label={label}
                  layout="inline"
                  hideErrors={!cards}
                  disabled={editing.pending || !!model.line.skipped}
                  unit={unit}
                  netContent={model.product?.netContent}
                  packsLabel={t('quantity-unit.packs')}
                  dosesLabel={t('quantity-unit.doses')}
                  sizing={cards ? (unit === 'PACKS' ? 'fill' : 'full') : 'minimum'}
                  notation={cards ? 'plus' : 'brackets'}
                />
              )}
            </form.AppField>
          ) : (
            <form.AppField
              name={`texts.${id}:${column.name}`}
              defaultValue={value}
              listeners={{
                onChange: ({ value }) => editor.setLine(id, { [column.name]: value } as LineDraft),
              }}
            >
              {(field) =>
                column.kind === 'text' ? (
                  <field.TextareaField
                    label={label}
                    layout="inline"
                    hideErrors={!cards}
                    disabled={editing.pending || !!model.line.skipped}
                    maxLength={
                      column.name === 'requestedQuantityExplanation'
                        ? 255
                        : column.name === 'remarks'
                          ? 250
                          : undefined
                    }
                    dir="auto"
                  />
                ) : (
                  <field.NumberField
                    label={label}
                    layout="inline"
                    hideErrors={!cards}
                    controlSize={cards ? 'default' : 'sm'}
                    disabled={editing.pending || !!model.line.skipped}
                  />
                )
              }
            </form.AppField>
          )}
        </Field>
      </div>
    );
  if (editing.editable && column.kind === 'adjustments' && !stockBased)
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
