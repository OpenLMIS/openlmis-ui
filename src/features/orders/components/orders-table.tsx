import { useSuspenseQuery } from '@tanstack/react-query';
import { type ColumnVisibilityState, createColumnHelper, useTable } from '@tanstack/react-table';
import type { ParseKeys, TFunction } from 'i18next';
import { PackageIcon, SearchXIcon } from 'lucide-react';
import { type ReactNode, useDeferredValue, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DataTable,
  DataTableColumnHeader,
  DataTableEmpty,
  type DataTableFeatures,
  DataTableHeaderLabel,
  DataTableSkeleton,
  dataTableFeatures,
} from '@/components/data-table/data-table';
import { DataTablePagination } from '@/components/data-table/data-table-pagination';
import { CellText, TableCards, TableCardsSkeleton } from '@/components/display/table-cards';
import { formatDateValue, formatTimestamp, toDateValue } from '@/components/form/date-value';
import { FlagBadge } from '@/components/shared/flag-badge';
import { Button } from '@/components/ui/button';
import { ordersSearchOptions } from '@/features/orders/api/queries';
import {
  FulfillOrderButton,
  OrderRowButtons,
} from '@/features/orders/components/order-row-buttons';
import {
  activeOrderFilterCount,
  CLEARED_ORDER_FILTERS,
} from '@/features/orders/components/orders-toolbar';
import { PodRowButtons } from '@/features/orders/components/pod-row-buttons';
import type { OrderAccess } from '@/features/orders/lib/order-row-actions';
import {
  isOrderSortField,
  ORDER_DEFAULT_SORT,
  toOrderParams,
  type ViewOrdersSearch,
} from '@/features/orders/lib/order-search';
import { type OrderKind, orderStatusKey } from '@/features/orders/lib/order-status';
import type { OrderSummary } from '@/features/orders/lib/types';
import { useDeploymentTimeZone } from '@/hooks/use-deployment-time-zone';
import { usePagedTableSearch } from '@/hooks/use-page-start';
import { tableValue } from '@/lib/empty-value';
import { type SearchChange, toPaginationState } from '@/lib/table-search';

const helper = createColumnHelper<DataTableFeatures, OrderSummary>();
const VIEW_ORDER_COLUMNS = [
  ['orderCode', 'orders.view.columns.order-code'],
  ['facility', 'orders.view.columns.facility'],
  ['district', 'orders.view.columns.district'],
  ['program', 'orders.view.columns.program'],
  ['period', 'orders.view.columns.period'],
  ['startDate', 'orders.view.columns.start-date'],
  ['endDate', 'orders.view.columns.end-date'],
  ['status', 'orders.view.columns.status'],
  ['emergency', 'orders.view.columns.emergency'],
  ['createdDate', 'orders.view.columns.created-date'],
  ['lastUpdatedDate', 'orders.view.columns.last-updated-date'],
] as const;
const FULFILL_ORDER_COLUMNS = [
  ['emergency', 'orders.fulfill.columns.emergency'],
  ['orderCode', 'orders.fulfill.columns.order-code'],
  ['status', 'orders.fulfill.columns.status'],
  ['facility', 'orders.fulfill.columns.facility'],
  ['program', 'orders.fulfill.columns.program'],
  ['period', 'orders.fulfill.columns.period'],
  ['createdDate', 'orders.fulfill.columns.created-date'],
] as const;
const POD_ORDER_COLUMNS = [
  ['orderCode', 'orders.pod.columns.order-code'],
  ['status', 'orders.pod.columns.status'],
  ['requestingFacility', 'orders.pod.columns.requesting-facility'],
  ['supplyingFacility', 'orders.pod.columns.supplying-facility'],
  ['program', 'orders.pod.columns.program'],
  ['period', 'orders.pod.columns.period'],
  ['createdDate', 'orders.pod.columns.created-date'],
  ['emergency', 'orders.pod.columns.emergency'],
] as const;
const ORDER_LIST_KINDS = {
  pod: {
    columns: POD_ORDER_COLUMNS,
    actionsKey: 'orders.pod.columns.actions',
    emptyDescription: 'orders.pod.empty-description',
  },
  view: {
    columns: VIEW_ORDER_COLUMNS,
    actionsKey: 'orders.view.columns.actions',
    emptyDescription: 'orders.view.empty-description',
  },
  fulfill: {
    columns: FULFILL_ORDER_COLUMNS,
    actionsKey: 'orders.fulfill.columns.actions',
    emptyDescription: 'orders.fulfill.empty-description',
  },
} satisfies Record<
  OrderKind,
  {
    columns: readonly (readonly [string, ParseKeys])[];
    actionsKey: ParseKeys;
    emptyDescription: ParseKeys;
  }
>;
export const viewColumns = (kind: OrderKind) =>
  ORDER_LIST_KINDS[kind].columns.map(([id, labelKey]) => ({ id, labelKey }));
const hideableColumns = (kind: OrderKind) =>
  viewColumns(kind).filter(({ id }) => id !== 'orderCode');
export const FULFILL_ORDER_HIDEABLE_COLUMNS = hideableColumns('fulfill');
export const POD_ORDER_HIDEABLE_COLUMNS = hideableColumns('pod');
export const ORDER_HIDEABLE_COLUMNS = hideableColumns('view');
const NO_ROWS: OrderSummary[] = [];
const NO_ACCESS: OrderAccess = { canEdit: false, retrySupplierIds: [] };
const noop = () => {};
const rowId = (order: OrderSummary) => order.id;

function orderListCell(
  id: string,
  order: OrderSummary,
  language: string,
  timeZone: string,
  t: TFunction,
  kind: OrderKind,
) {
  const text = (value: string | null | undefined) =>
    tableValue(value) === null ? null : <CellText overflow="nowrap">{value}</CellText>;
  switch (id) {
    case 'orderCode':
      return text(order.orderCode);
    case 'facility':
      return order.facility
        ? text([order.facility.code, order.facility.name].filter(Boolean).join(' - '))
        : null;
    case 'requestingFacility':
      return text(order.requestingFacility?.name);
    case 'supplyingFacility':
      return text(order.supplyingFacility?.name);
    case 'district':
      return text(order.facility?.geographicZone?.name);
    case 'program':
      return text(order.program?.name);
    case 'period':
      return text(order.processingPeriod?.name);
    case 'startDate':
    case 'endDate':
      return text(formatDateValue(order.processingPeriod?.[id] ?? '', language));
    case 'createdDate':
      if (kind === 'pod')
        return text(
          formatDateValue(
            order.createdDate ? toDateValue(new Date(order.createdDate), timeZone) : '',
            language,
          ),
        );
      return text(formatTimestamp(order.createdDate, language, { timeZone }));
    case 'lastUpdatedDate':
      return text(formatTimestamp(order[id], language, { timeZone }));
    case 'status': {
      const key = orderStatusKey(order.status);
      return text(key ? t(key) : order.status);
    }
    case 'emergency':
      return (
        <FlagBadge
          value={order.emergency}
          trueLabel={t('orders.yes')}
          falseLabel={t('orders.no')}
        />
      );
  }
}

function orderColumns({
  kind,
  columns,
  t,
  language,
  timeZone,
  actions,
  actionsKey,
}: {
  kind: OrderKind;
  columns: readonly (readonly [string, ParseKeys])[];
  t: TFunction;
  language: string;
  timeZone: string;
  actions?: (order: OrderSummary) => ReactNode;
  actionsKey: ParseKeys;
}) {
  return helper.columns([
    ...columns.map(([id, key]) =>
      helper.display({
        id,
        ...(isOrderSortField(id) && { accessorFn: (order: OrderSummary) => order[id] }),
        enableSorting: isOrderSortField(id),
        sortDescFirst: id === 'createdDate',
        meta: { label: t(key) },
        header: ({ column }) => <DataTableColumnHeader column={column} title={t(key)} />,
        cell: ({ row }) => orderListCell(id, row.original, language, timeZone, t, kind),
      }),
    ),
    ...(actions
      ? [
          helper.display({
            id: 'actions',
            meta: { label: t(actionsKey), skeleton: 'control', sticky: 'end' },
            header: () => <DataTableHeaderLabel>{t(actionsKey)}</DataTableHeaderLabel>,
            cell: ({ row }) => actions(row.original),
          }),
        ]
      : []),
  ]);
}

type Props<T extends ViewOrdersSearch = ViewOrdersSearch> = {
  kind?: OrderKind;
  cards: boolean;
  columns: ColumnVisibilityState;
  search: T;
  onSearchChange: SearchChange<T>;
  access?: OrderAccess;
};
function useResultsTable<T extends ViewOrdersSearch>(
  {
    kind = 'view',
    cards,
    columns,
    search,
    onSearchChange,
    access = NO_ACCESS,
    data,
    rowCount,
    stale,
  }: Props<T> & { data: OrderSummary[]; rowCount: number; stale: boolean },
  timeZone: string,
) {
  const { t, i18n } = useTranslation();
  const defs = useMemo(
    () =>
      orderColumns({
        kind,
        columns: ORDER_LIST_KINDS[kind].columns,
        t,
        language: i18n.language,
        timeZone,
        actionsKey: ORDER_LIST_KINDS[kind].actionsKey,
        actions: (order) =>
          kind === 'pod' ? (
            <PodRowButtons order={order} search={search} disabled={stale} />
          ) : kind === 'fulfill' ? (
            <FulfillOrderButton order={order} search={search} disabled={stale} />
          ) : (
            <OrderRowButtons order={order} search={search} access={access} disabled={stale} />
          ),
      }),
    [kind, t, i18n.language, timeZone, search, access, stale],
  );
  const { pageStart, searchState } = usePagedTableSearch({
    cards,
    search,
    defaultSort: ORDER_DEFAULT_SORT,
    onSearchChange,
  });
  const table = useTable({
    features: dataTableFeatures,
    columns: defs,
    data,
    getRowId: rowId,
    rowCount,
    manualPagination: true,
    manualSorting: true,
    ...searchState,
    state: { ...searchState.state, columnVisibility: columns },
  });
  return { table, pageStart };
}
export function OrdersTable<T extends ViewOrdersSearch>(props: Props<T>) {
  const { t } = useTranslation();
  const deferred = useDeferredValue(props.search);
  const { data: page } = useSuspenseQuery(ordersSearchOptions(toOrderParams(deferred, props.kind)));
  const timeZone = useDeploymentTimeZone();
  const stale = deferred !== props.search;
  const { table, pageStart } = useResultsTable(
    {
      ...props,
      search: deferred,
      data: page.content,
      rowCount: page.totalElements,
      stale,
    },
    timeZone,
  );
  const pastEnd = page.content.length === 0 && page.totalElements > 0;
  const { onSearchChange } = props;
  useEffect(() => {
    if (pastEnd)
      onSearchChange(
        (previous) => ({ ...previous, page: page.totalPages > 1 ? page.totalPages : undefined }),
        true,
      );
  }, [pastEnd, page.totalPages, onSearchChange]);
  const filtered = props.kind !== 'pod' && activeOrderFilterCount(deferred) > 0;
  const empty = !pastEnd && (
    <DataTableEmpty
      icon={filtered ? <SearchXIcon /> : <PackageIcon />}
      title={t(
        props.kind === 'pod'
          ? 'orders.pod.empty-title'
          : filtered
            ? 'orders.view.no-matches-title'
            : 'orders.view.empty-title',
      )}
      description={t(
        filtered
          ? 'orders.view.no-matches-description'
          : ORDER_LIST_KINDS[props.kind ?? 'view'].emptyDescription,
      )}
      action={
        filtered && (
          <Button
            variant="destructive"
            onClick={() =>
              onSearchChange((previous) => ({ ...previous, ...CLEARED_ORDER_FILTERS }), true)
            }
          >
            {t('data-table.clear-filters')}
          </Button>
        )
      }
    />
  );
  const footer = !pastEnd && page.totalElements > 0 && <DataTablePagination table={table} />;
  return props.cards ? (
    <TableCards
      busy={stale}
      empty={empty}
      footer={footer}
      listRef={pageStart.ref}
      table={table}
      title="orderCode"
    />
  ) : (
    <DataTable
      density="default"
      empty={empty}
      footer={footer}
      isStale={stale}
      layout="auto"
      table={table}
    />
  );
}
export function OrdersTableSkeleton<T extends ViewOrdersSearch>({
  kind,
  cards,
  columns,
  search,
}: Pick<Props<T>, 'kind' | 'cards' | 'columns' | 'search'>) {
  const { table } = useResultsTable(
    {
      kind,
      cards,
      columns,
      search,
      onSearchChange: noop,
      data: NO_ROWS,
      rowCount: 0,
      stale: false,
    },
    'UTC',
  );
  const rowCount = toPaginationState(search).pageSize;
  return cards ? (
    <TableCardsSkeleton
      actions={kind === 'fulfill' ? 1 : 2}
      rowCount={rowCount}
      table={table}
      title="orderCode"
    />
  ) : (
    <DataTableSkeleton density="default" layout="auto" rowCount={rowCount} table={table} />
  );
}
