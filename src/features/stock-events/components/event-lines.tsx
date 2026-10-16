import { useSuspenseQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { type ColumnVisibilityState, createColumnHelper, useTable } from '@tanstack/react-table';
import { ClipboardListIcon } from 'lucide-react';
import { useCallback, useDeferredValue, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  CardBand,
  CardList,
  CardListItem,
  CardRowSkeleton,
  CardRows,
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
import {
  DataTablePagination,
  DataTablePaginationSkeleton,
} from '@/components/data-table/data-table-pagination';
import { formatDateValue } from '@/components/form/date-value';
import { SettingsItem } from '@/components/form/settings-list';
import { stockEventLinesOptions } from '@/features/stock-events/api/queries';
import {
  changeDetailPaging,
  type DetailPagingSearch,
  detailPagingSchema,
  detailTableSearch,
  transactionHistorySearchSchema,
} from '@/features/stock-events/lib/search';
import type { StockEventLine } from '@/features/stock-events/lib/types';
import { usePageStart } from '@/hooks/use-page-start';
import { EMPTY_VALUE, tableValue } from '@/lib/empty-value';
import { cardQuantity, type QuantityUnit } from '@/lib/quantity';
import { eventLinks, namedWithFreeText } from '@/lib/stock-labels';
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
  { id: 'lot', labelKey: 'stock-event.lot-code', hideBelow: 760 },
  { id: 'expiry', labelKey: 'stock-event.expiry-date', hideBelow: 900 },
  { id: 'source', labelKey: 'stock-event.source', hideBelow: 900 },
  { id: 'destination', labelKey: 'stock-event.destination', hideBelow: 900 },
  { id: 'date', labelKey: 'stock-event.line-date' },
  { id: 'reason', labelKey: 'stock-event.reason' },
  { id: 'balance', labelKey: 'stock-event.stock-on-hand' },
  { id: 'reversing', labelKey: 'stock-event.reversing', defaultHidden: true },
  { id: 'reversedBy', labelKey: 'stock-event.reversed-by', defaultHidden: true },
] as const;
type CellId = (typeof COLUMNS)[number][0];

const CARD_ROWS = COLUMNS.filter(([id]) => id !== 'product');

function Wrapped({ children, empty }: { children: string | null | undefined; empty?: string }) {
  if (empty !== undefined) return <bdi>{tableValue(children) ?? empty}</bdi>;
  return (
    <span className="whitespace-nowrap">
      <bdi>{tableValue(children)}</bdi>
    </span>
  );
}

function LineCell({
  id,
  line,
  unit,
  empty,
}: {
  id: CellId;
  line: StockEventLine;
  unit: QuantityUnit;
  empty?: string;
}) {
  const { t, i18n } = useTranslation();
  switch (id) {
    case 'product':
      return (
        <Wrapped>{`${line.orderable.fullProductName} (${line.orderable.productCode})`}</Wrapped>
      );
    case 'lot':
      return (
        <Wrapped empty={empty}>{line.lot ? line.lot.lotCode : t('stock-event.no-lot')}</Wrapped>
      );
    case 'expiry':
    case 'date':
      return (
        <span className="whitespace-nowrap">
          <bdi>
            {tableValue(
              formatDateValue(
                id === 'date' ? line.occurredDate : (line.lot?.expirationDate ?? ''),
                i18n.language,
              ),
            ) ?? empty}
          </bdi>
        </span>
      );
    case 'source':
      return <Wrapped empty={empty}>{namedWithFreeText(line.source, line.sourceFreeText)}</Wrapped>;
    case 'destination':
      return (
        <Wrapped empty={empty}>
          {namedWithFreeText(line.destination, line.destinationFreeText)}
        </Wrapped>
      );
    case 'reason':
      return <Wrapped empty={empty}>{namedWithFreeText(line.reason, line.reasonFreeText)}</Wrapped>;
    case 'quantity':
    case 'balance':
      return (
        <span className="whitespace-nowrap tabular-nums" dir="ltr">
          {tableValue(
            cardQuantity(
              id === 'balance' ? line.stockOnHand : line.quantity,
              line.orderable.netContent,
              unit,
              i18n.language,
            ),
          ) ?? empty}
        </span>
      );
    case 'reversing':
    case 'reversedBy': {
      const view = t('stock-event.view-event');
      const link = eventLinks(line, { noNumber: '', view })[id];
      if (!link?.eventId) return <Wrapped empty={empty}>{link?.label}</Wrapped>;
      return (
        <span className="whitespace-nowrap">
          <Link
            aria-label={
              link.label === view
                ? t(
                    id === 'reversing'
                      ? 'stock-event.view-reversing'
                      : 'stock-event.view-reversed-by',
                  )
                : undefined
            }
            className="font-medium text-primary underline-offset-4 hover:underline"
            params={{ eventId: link.eventId }}
            search={(previous) => ({
              ...transactionHistorySearchSchema.parse(previous),
              detailSize: detailPagingSchema.parse(previous).detailSize,
            })}
            to="/stock-management/transaction-history/$eventId"
          >
            <bdi>{link.label}</bdi>
          </Link>
        </span>
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

function LineCard({
  line,
  unit,
  columnVisibility,
}: {
  line: StockEventLine;
  unit: QuantityUnit;
  columnVisibility: ColumnVisibilityState;
}) {
  const { t } = useTranslation();
  const cell = (id: CellId) => <LineCell id={id} line={line} unit={unit} empty={EMPTY_VALUE} />;
  return (
    <CardListItem>
      <CardBand>
        <div className="min-w-0 wrap-anywhere">
          <bdi>{`${line.orderable.fullProductName} (${line.orderable.productCode})`}</bdi>
        </div>
      </CardBand>
      <CardRows>
        {CARD_ROWS.filter(([id]) => columnVisibility[id] !== false).map(([id, key]) => (
          <SettingsItem key={id} label={t(key)}>
            {id === 'balance' ? <strong>{cell(id)}</strong> : cell(id)}
          </SettingsItem>
        ))}
      </CardRows>
    </CardListItem>
  );
}

type LinesProps = {
  cards: boolean;
  eventId: string;
  search: DetailPagingSearch;
  onSearchChange: SearchChange<DetailPagingSearch>;
  unit: QuantityUnit;
  columnVisibility: ColumnVisibilityState;
};

export function EventLines({
  cards,
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
      onSearchChange(
        (previous) => changeDetailPaging(previous, update),
        replace,
        cards ? { resetScroll: false } : undefined,
      );
    },
    [onSearchChange, cards],
  );
  const searchState = useTableSearchState({
    search: detailTableSearch(deferredSearch),
    defaultSort: NO_SORT,
    onSearchChange: onTableSearchChange,
  });
  const pageStart = usePageStart<HTMLUListElement>(`${paging.pageIndex}:${paging.pageSize}`);
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
    onPaginationChange: (updater) => {
      if (cards) pageStart.request();
      searchState.onPaginationChange(updater);
    },
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
  const pastEnd = data.content.length === 0 && data.totalElements > 0;
  const footer = !pastEnd && data.totalElements > 0 && <DataTablePagination table={table} />;
  if (cards) {
    return (
      <CardList
        empty={data.totalElements === 0 && empty}
        footer={footer}
        busy={search !== deferredSearch}
        listRef={pageStart.ref}
      >
        {data.content.map((line, index) => (
          <LineCard
            key={getRowId(line, index)}
            line={line}
            unit={unit}
            columnVisibility={columnVisibility}
          />
        ))}
      </CardList>
    );
  }
  return (
    <DataTable
      table={table}
      empty={!pastEnd && empty}
      footer={footer}
      isStale={search !== deferredSearch}
      density="default"
      layout="auto"
    />
  );
}

const SKELETON_CARDS = ['a', 'b', 'c'];

export function EventLinesSkeleton({
  cards,
  search,
  columnVisibility,
}: {
  cards: boolean;
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
  const rowCount = toPaginationState(detailTableSearch(search)).pageSize;
  if (cards) {
    return (
      <CardList footer={<DataTablePaginationSkeleton />}>
        {SKELETON_CARDS.slice(0, rowCount).map((id) => (
          <CardListItem key={id}>
            <CardBand>
              <SkeletonBar width="w-24" />
            </CardBand>
            <CardRows>
              {CARD_ROWS.filter(([column]) => columnVisibility[column] !== false).map(
                ([column]) => (
                  <CardRowSkeleton key={column} />
                ),
              )}
            </CardRows>
          </CardListItem>
        ))}
      </CardList>
    );
  }
  return <DataTableSkeleton table={table} rowCount={rowCount} density="default" layout="auto" />;
}
