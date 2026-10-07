import { type ColumnVisibilityState, createColumnHelper, useTable } from '@tanstack/react-table';
import { ClipboardListIcon } from 'lucide-react';
import { useCallback, useEffect, useMemo } from 'react';
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
import {
  documentNumbers,
  namedWithFreeText,
  reasonLabel,
  toCardLines,
} from '@/features/stock-card/lib/card-lines';
import {
  type CardPagingSearch,
  cardTableSearch,
  changeCardPaging,
} from '@/features/stock-card/lib/search';
import type { CardLineRow, StockCard } from '@/features/stock-card/lib/types';
import { orEmpty } from '@/lib/empty-value';
import { cardQuantity, type QuantityUnit } from '@/lib/quantity';
import {
  type SearchChange,
  type TableSearch,
  toPaginationState,
  useTableSearchState,
} from '@/lib/table-search';

const NO_SORT = { id: 'date', desc: true };
const columnHelper = createColumnHelper<DataTableFeatures, CardLineRow>();
const getRowId = (row: CardLineRow) => row.rowId;
const COLUMNS = [
  ['date', 'stock-card.date'],
  ['receiveFrom', 'stock-card.receive-from'],
  ['issueTo', 'stock-card.issue-to'],
  ['reason', 'stock-card.reason'],
  ['adjustment', 'stock-card.adjustment'],
  ['balance', 'stock-card.stock-on-hand'],
  ['performedBy', 'stock-card.performed-by'],
  ['signature', 'stock-card.signature'],
  ['document', 'stock-card.document-number'],
  ['reversing', 'stock-card.reversing'],
  ['reversedBy', 'stock-card.reversed-by'],
] as const;

export const STOCK_CARD_HIDEABLE_COLUMNS = [
  { id: 'receiveFrom', labelKey: 'stock-card.receive-from', hideBelow: 844 },
  { id: 'issueTo', labelKey: 'stock-card.issue-to', hideBelow: 844 },
  { id: 'signature', labelKey: 'stock-card.signature', defaultHidden: true },
  { id: 'document', labelKey: 'stock-card.document-number', hideBelow: 1004 },
  { id: 'reversing', labelKey: 'stock-card.reversing', defaultHidden: true },
  { id: 'reversedBy', labelKey: 'stock-card.reversed-by', defaultHidden: true },
] as const;
type CellId = (typeof COLUMNS)[number][0];

function Wrapped({ children }: { children: string | null | undefined }) {
  return (
    <span className="block max-w-60 whitespace-normal break-normal">
      <bdi>{orEmpty(children)}</bdi>
    </span>
  );
}

function LineCell({
  id,
  line,
  netContent,
  unit,
}: {
  id: CellId;
  line: CardLineRow;
  netContent: number | null | undefined;
  unit: QuantityUnit;
}) {
  const { t, i18n } = useTranslation();
  switch (id) {
    case 'date':
      return (
        <span className="whitespace-nowrap">
          <bdi>{formatDateValue(line.occurredDate, i18n.language)}</bdi>
        </span>
      );
    case 'receiveFrom':
      return <Wrapped>{namedWithFreeText(line.source, line.sourceFreeText)}</Wrapped>;
    case 'issueTo':
      return <Wrapped>{namedWithFreeText(line.destination, line.destinationFreeText)}</Wrapped>;
    case 'reason':
      return <Wrapped>{reasonLabel(line, t('stock-card.physical-inventory'))}</Wrapped>;
    case 'adjustment':
    case 'balance':
      return (
        <span className="whitespace-nowrap tabular-nums" dir="ltr">
          {cardQuantity(
            id === 'balance' ? line.stockOnHand : line.quantity,
            netContent,
            unit,
            i18n.language,
          )}
        </span>
      );
    case 'performedBy':
      return <Wrapped>{line.username}</Wrapped>;
    case 'signature':
      return <Wrapped>{line.signature}</Wrapped>;
    case 'document':
      // TODO: FM-76 link to event detail
      return <Wrapped>{documentNumbers(line, t('stock-card.no-number')).document}</Wrapped>;
    case 'reversing':
      // TODO: FM-76 link to event detail
      return <Wrapped>{documentNumbers(line, t('stock-card.no-number')).reversing}</Wrapped>;
    case 'reversedBy':
      // TODO: FM-76 link to event detail
      return <Wrapped>{documentNumbers(line, t('stock-card.no-number')).reversedBy}</Wrapped>;
  }
}

function useLineColumns(netContent?: number | null, unit: QuantityUnit = 'DOSES') {
  const { t } = useTranslation();
  return useMemo(
    () =>
      columnHelper.columns(
        COLUMNS.map(([id, key]) =>
          columnHelper.display({
            id,
            header: () => <DataTableHeaderLabel>{t(key)}</DataTableHeaderLabel>,
            cell: ({ row }) => (
              <LineCell id={id} line={row.original} netContent={netContent} unit={unit} />
            ),
          }),
        ),
      ),
    [t, netContent, unit],
  );
}

type LinesProps = {
  card: StockCard;
  search: CardPagingSearch;
  onSearchChange: SearchChange<CardPagingSearch>;
  unit: QuantityUnit;
  columnVisibility: ColumnVisibilityState;
};

export function StockCardLines({
  card,
  search,
  onSearchChange,
  unit,
  columnVisibility,
}: LinesProps) {
  const { t } = useTranslation();
  const lines = useMemo(() => toCardLines(card.lineItems), [card.lineItems]);
  const columns = useLineColumns(card.orderable.netContent, unit);
  const onTableSearchChange = useCallback<SearchChange<TableSearch>>(
    (update, replace) => {
      onSearchChange((previous) => changeCardPaging(previous, update), replace);
    },
    [onSearchChange],
  );
  const searchState = useTableSearchState({
    search: cardTableSearch(search),
    defaultSort: NO_SORT,
    onSearchChange: onTableSearchChange,
  });
  const { pageIndex, pageSize } = toPaginationState(cardTableSearch(search));
  const pageCount = Math.max(1, Math.ceil(lines.length / pageSize));
  const clampedIndex = Math.min(pageIndex, pageCount - 1);
  const rows = useMemo(
    () => lines.slice(clampedIndex * pageSize, (clampedIndex + 1) * pageSize),
    [lines, clampedIndex, pageSize],
  );
  const table = useTable({
    features: dataTableFeatures,
    columns,
    data: rows,
    getRowId,
    rowCount: lines.length,
    manualPagination: true,
    manualSorting: true,
    enableSorting: false,
    ...searchState,
    state: { ...searchState.state, columnVisibility },
  });
  useEffect(() => {
    if (pageIndex !== clampedIndex)
      onSearchChange({ cardPage: clampedIndex > 0 ? clampedIndex + 1 : undefined }, true);
  }, [pageIndex, clampedIndex, onSearchChange]);
  const empty = (
    <DataTableEmpty
      icon={<ClipboardListIcon />}
      title={t('stock-card.no-transactions')}
      description={t('stock-card.no-transactions-description')}
    />
  );
  const footer = lines.length > 0 && <DataTablePagination table={table} />;
  return <DataTable table={table} empty={empty} footer={footer} density="default" layout="auto" />;
}

export function StockCardLinesSkeleton({
  search,
  columnVisibility,
}: {
  search: CardPagingSearch;
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
  const rowCount = toPaginationState(cardTableSearch(search)).pageSize;
  return <DataTableSkeleton table={table} rowCount={rowCount} density="default" layout="auto" />;
}
