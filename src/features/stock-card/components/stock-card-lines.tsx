import { createColumnHelper, useTable } from '@tanstack/react-table';
import { ClipboardListIcon } from 'lucide-react';
import { type ReactNode, useCallback, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DataTable,
  DataTableCard,
  DataTableEmpty,
  type DataTableFeatures,
  DataTableFooter,
  DataTableHeaderLabel,
  DataTableSkeleton,
  dataTableFeatures,
} from '@/components/data-table/data-table';
import {
  DataTablePagination,
  DataTablePaginationSkeleton,
} from '@/components/data-table/data-table-pagination';
import { formatDateValue } from '@/components/form/date-value';
import { Skeleton } from '@/components/ui/skeleton';
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
import { cardQuantity, type QuantityUnit } from '@/lib/quantity';
import {
  type SearchChange,
  type TableSearch,
  toPaginationState,
  useTableSearchState,
} from '@/lib/table-search';

export type CardLayout = 'table' | 'cards';
const NO_SORT = { id: 'date', desc: true };
const columnHelper = createColumnHelper<DataTableFeatures, CardLineRow>();
const getRowId = (row: CardLineRow) => row.rowId;
const COLUMNS = [
  ['date', 'stock-card.date', 'w-28'],
  ['receiveFrom', 'stock-card.receive-from', 'w-20'],
  ['issueTo', 'stock-card.issue-to', 'w-16'],
  ['reason', 'stock-card.reason', undefined],
  ['adjustment', 'stock-card.adjustment', 'w-28'],
  ['balance', 'stock-card.stock-on-hand', 'w-24'],
  ['performedBy', 'stock-card.performed-by', 'w-28'],
  ['signature', 'stock-card.signature', 'w-24'],
  ['document', 'stock-card.document-number', 'w-24'],
  ['reversing', 'stock-card.reversing', 'w-24'],
  ['reversedBy', 'stock-card.reversed-by', 'w-20'],
] as const;
type CellId = (typeof COLUMNS)[number][0];

function Wrapped({ children }: { children: ReactNode }) {
  return (
    <span className="block whitespace-normal break-normal">
      <bdi>{children}</bdi>
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
        <span className="block whitespace-nowrap tabular-nums" dir="ltr">
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
        COLUMNS.map(([id, key, width]) =>
          columnHelper.display({
            id,
            meta: { className: width },
            header: () => (
              <div className="whitespace-normal break-normal">
                <DataTableHeaderLabel>{t(key)}</DataTableHeaderLabel>
              </div>
            ),
            cell: ({ row }) => (
              <LineCell id={id} line={row.original} netContent={netContent} unit={unit} />
            ),
          }),
        ),
      ),
    [t, netContent, unit],
  );
}

function hasLineValue(id: CellId, line: CardLineRow) {
  switch (id) {
    case 'date':
    case 'reason':
    case 'adjustment':
    case 'balance':
      return true;
    case 'receiveFrom':
      return Boolean(namedWithFreeText(line.source, line.sourceFreeText));
    case 'issueTo':
      return Boolean(namedWithFreeText(line.destination, line.destinationFreeText));
    case 'performedBy':
      return Boolean(line.username);
    case 'signature':
      return Boolean(line.signature);
    case 'document':
      return Boolean(line.eventOrigin);
    case 'reversing':
      return Boolean(line.reversedEventId);
    case 'reversedBy':
      return Boolean(line.cancellationEventId);
  }
}

type LinesProps = {
  card: StockCard;
  search: CardPagingSearch;
  onSearchChange: SearchChange<CardPagingSearch>;
  unit: QuantityUnit;
  layout: CardLayout;
};

export function StockCardLines({ card, search, onSearchChange, unit, layout }: LinesProps) {
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
  if (layout === 'table')
    return <DataTable table={table} empty={empty} footer={footer} density="default" />;
  return (
    <DataTableCard>
      {rows.length ? (
        <ul className="divide-y">
          {rows.map((line) => (
            <li className="p-4" key={line.rowId}>
              <dl className="grid grid-cols-2 gap-3 @md/table:grid-cols-3">
                {COLUMNS.filter(([id]) => hasLineValue(id, line)).map(([id, key]) => (
                  <div className="flex min-w-0 flex-col gap-1" key={id}>
                    <dt className="text-muted-foreground text-xs">{t(key)}</dt>
                    <dd className="min-w-0 text-sm">
                      <LineCell
                        id={id}
                        line={line}
                        netContent={card.orderable.netContent}
                        unit={unit}
                      />
                    </dd>
                  </div>
                ))}
              </dl>
            </li>
          ))}
        </ul>
      ) : (
        empty
      )}
      {footer && <DataTableFooter>{footer}</DataTableFooter>}
    </DataTableCard>
  );
}

export function StockCardLinesSkeleton({
  layout,
  search,
}: {
  layout: CardLayout;
  search: CardPagingSearch;
}) {
  const { t } = useTranslation();
  const columns = useLineColumns();
  const table = useTable({ features: dataTableFeatures, columns, data: [], enableSorting: false });
  const rowCount = toPaginationState(cardTableSearch(search)).pageSize;
  if (layout === 'table')
    return <DataTableSkeleton table={table} rowCount={rowCount} density="default" />;
  return (
    <div aria-busy>
      <DataTableCard>
        <ul className="divide-y">
          {Array.from({ length: rowCount }, (_, index) => `skeleton:${index}`).map((id) => (
            <li className="p-4" key={id}>
              <dl className="grid grid-cols-2 gap-3 @md/table:grid-cols-3">
                {COLUMNS.map(([id, key]) => (
                  <div className="flex min-w-0 flex-col gap-1" key={id}>
                    <dt className="text-muted-foreground text-xs">{t(key)}</dt>
                    <dd className="h-5 w-3/4">
                      <Skeleton fill />
                    </dd>
                  </div>
                ))}
              </dl>
            </li>
          ))}
        </ul>
        <DataTableFooter>
          <DataTablePaginationSkeleton />
        </DataTableFooter>
      </DataTableCard>
    </div>
  );
}
