import { useSuspenseQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { type ColumnVisibilityState, createColumnHelper, useTable } from '@tanstack/react-table';
import { ClipboardListIcon } from 'lucide-react';
import { type ReactNode, useCallback, useDeferredValue, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DataTable,
  DataTableEmpty,
  type DataTableFeatures,
  DataTableHeaderLabel,
  DataTableSkeleton,
  dataTableFeatures,
} from '@/components/data-table/data-table';
import { DataTablePagination } from '@/components/data-table/data-table-pagination';
import { formatDateValue } from '@/components/form/date-value';
import { stockEventLinesOptions } from '@/features/stock-events/api/queries';
import {
  changeDetailPaging,
  type DetailPagingSearch,
  detailTableSearch,
  transactionHistorySearchSchema,
} from '@/features/stock-events/lib/search';
import type { StockEventLine } from '@/features/stock-events/lib/types';
import { orEmpty } from '@/lib/empty-value';
import { cardQuantity, type QuantityUnit } from '@/lib/quantity';
import { eventLinks, namedWithFreeText, reasonLabel, stockProductName } from '@/lib/stock-labels';
import {
  type SearchChange,
  type TableSearch,
  toPaginationState,
  useTableSearchState,
} from '@/lib/table-search';

const NO_SORT = { id: 'date', desc: true };
const columnHelper = createColumnHelper<DataTableFeatures, StockEventLine>();
const getRowId = (row: StockEventLine, index: number) => row.stockEventLineItemId ?? String(index);
const COLUMNS = [
  ['product', 'stock-event.product'],
  ['lot', 'stock-event.lot-code'],
  ['expiry', 'stock-event.expiry-date'],
  ['source', 'stock-event.source'],
  ['destination', 'stock-event.destination'],
  ['date', 'stock-event.line-date'],
  ['quantity', 'stock-event.quantity'],
  ['reason', 'stock-event.reason'],
  ['balance', 'stock-event.stock-on-hand'],
  ['reversing', 'stock-event.reversing'],
  ['reversedBy', 'stock-event.reversed-by'],
] as const;

export const STOCK_EVENT_HIDEABLE_COLUMNS = [
  { id: 'lot', labelKey: 'stock-event.lot-code', hideBelow: 700 },
  { id: 'expiry', labelKey: 'stock-event.expiry-date', hideBelow: 1000 },
  { id: 'source', labelKey: 'stock-event.source', hideBelow: 1150 },
  { id: 'destination', labelKey: 'stock-event.destination', hideBelow: 1150 },
  { id: 'date', labelKey: 'stock-event.line-date', hideBelow: 600 },
  { id: 'reason', labelKey: 'stock-event.reason', hideBelow: 850 },
  { id: 'balance', labelKey: 'stock-event.stock-on-hand', hideBelow: 450 },
  { id: 'reversing', labelKey: 'stock-event.reversing', defaultHidden: true },
  { id: 'reversedBy', labelKey: 'stock-event.reversed-by', defaultHidden: true },
] as const;
type CellId = (typeof COLUMNS)[number][0];

function Wrapped({ children }: { children: ReactNode }) {
  return (
    <span className="block max-w-60 whitespace-normal break-normal">
      <bdi>{children}</bdi>
    </span>
  );
}

function LineCell({ id, line, unit }: { id: CellId; line: StockEventLine; unit: QuantityUnit }) {
  const { t, i18n } = useTranslation();
  switch (id) {
    case 'product':
      return (
        <Wrapped>{`${stockProductName(line.orderable)} (${line.orderable.productCode})`}</Wrapped>
      );
    case 'lot':
      return <Wrapped>{line.lot ? orEmpty(line.lot.lotCode) : t('stock-event.no-lot')}</Wrapped>;
    case 'expiry':
    case 'date':
      return (
        <span className="whitespace-nowrap">
          <bdi>
            {orEmpty(
              formatDateValue(
                id === 'date' ? line.occurredDate : (line.lot?.expirationDate ?? ''),
                i18n.language,
              ),
            )}
          </bdi>
        </span>
      );
    case 'source':
      return <Wrapped>{orEmpty(namedWithFreeText(line.source, line.sourceFreeText))}</Wrapped>;
    case 'destination':
      return (
        <Wrapped>{orEmpty(namedWithFreeText(line.destination, line.destinationFreeText))}</Wrapped>
      );
    case 'reason':
      return <Wrapped>{orEmpty(reasonLabel(line, t('stock-event.physical-inventory')))}</Wrapped>;
    case 'quantity':
    case 'balance':
      return (
        <span className="whitespace-nowrap tabular-nums" dir="ltr">
          {orEmpty(
            cardQuantity(
              id === 'balance' ? line.stockOnHand : line.quantity,
              line.orderable.netContent,
              unit,
              i18n.language,
            ),
          )}
        </span>
      );
    case 'reversing':
    case 'reversedBy': {
      const link = eventLinks(line, t('stock-event.no-number'))[id];
      return (
        <Wrapped>
          {link?.eventId ? (
            <Link
              to="/stock-management/transaction-history/$eventId"
              params={{ eventId: link.eventId }}
              search={(previous) => ({
                ...transactionHistorySearchSchema.parse(previous),
                detailPage: undefined,
                detailSize: undefined,
              })}
              className="text-primary underline-offset-4 hover:underline"
            >
              {link.label}
            </Link>
          ) : (
            orEmpty(link?.label)
          )}
        </Wrapped>
      );
    }
  }
}

function useLineColumns(unit: QuantityUnit = 'DOSES') {
  const { t } = useTranslation();
  return useMemo(
    () =>
      columnHelper.columns(
        COLUMNS.map(([id, key]) =>
          columnHelper.display({
            id,
            header: () => <DataTableHeaderLabel>{t(key)}</DataTableHeaderLabel>,
            cell: ({ row }) => <LineCell id={id} line={row.original} unit={unit} />,
          }),
        ),
      ),
    [t, unit],
  );
}

type LinesProps = {
  eventId: string;
  search: DetailPagingSearch;
  onSearchChange: SearchChange<DetailPagingSearch>;
  unit: QuantityUnit;
  columnVisibility: ColumnVisibilityState;
};

export function EventLines({
  eventId,
  search,
  onSearchChange,
  unit,
  columnVisibility,
}: LinesProps) {
  const { t } = useTranslation();
  const deferredSearch = useDeferredValue(search);
  const paging = toPaginationState(detailTableSearch(deferredSearch));
  const { data } = useSuspenseQuery(
    stockEventLinesOptions(eventId, { page: paging.pageIndex, size: paging.pageSize }),
  );
  const columns = useLineColumns(unit);
  const onTableSearchChange = useCallback<SearchChange<TableSearch>>(
    (update, replace) => {
      onSearchChange((previous) => changeDetailPaging(previous, update), replace);
    },
    [onSearchChange],
  );
  const searchState = useTableSearchState({
    search: detailTableSearch(deferredSearch),
    defaultSort: NO_SORT,
    onSearchChange: onTableSearchChange,
  });
  const table = useTable({
    features: dataTableFeatures,
    columns,
    data: data.content,
    getRowId,
    rowCount: data.totalElements,
    manualPagination: true,
    manualSorting: true,
    enableSorting: false,
    ...searchState,
    state: { ...searchState.state, columnVisibility },
  });
  const lastPageIndex = Math.max(0, Math.ceil(data.totalElements / paging.pageSize) - 1);
  useEffect(() => {
    if (search === deferredSearch && paging.pageIndex > lastPageIndex)
      onSearchChange({ detailPage: lastPageIndex > 0 ? lastPageIndex + 1 : undefined }, true);
  }, [search, deferredSearch, paging.pageIndex, lastPageIndex, onSearchChange]);
  const empty = (
    <DataTableEmpty
      icon={<ClipboardListIcon />}
      title={t('stock-event.no-lines-title')}
      description={t('stock-event.no-lines-description')}
    />
  );
  return (
    <DataTable
      table={table}
      empty={empty}
      footer={data.totalElements > 0 && <DataTablePagination table={table} />}
      isStale={search !== deferredSearch}
      density="default"
      layout="auto"
    />
  );
}

export function EventLinesSkeleton({
  search,
  columnVisibility,
}: {
  search: DetailPagingSearch;
  columnVisibility: ColumnVisibilityState;
}) {
  const columns = useLineColumns();
  const table = useTable({
    features: dataTableFeatures,
    columns,
    data: [],
    enableSorting: false,
    state: { columnVisibility },
  });
  return (
    <DataTableSkeleton
      table={table}
      rowCount={toPaginationState(detailTableSearch(search)).pageSize}
      density="default"
      layout="auto"
    />
  );
}
