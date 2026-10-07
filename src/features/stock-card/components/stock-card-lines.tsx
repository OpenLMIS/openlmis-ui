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
type CellId = (typeof COLUMNS)[number][0];

function Wrapped({ children }: { children: ReactNode }) {
  return (
    <span className="block whitespace-normal break-words">
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
      return <Wrapped>{formatDateValue(line.occurredDate, i18n.language)}</Wrapped>;
    case 'receiveFrom':
      return <Wrapped>{namedWithFreeText(line.source, line.sourceFreeText)}</Wrapped>;
    case 'issueTo':
      return <Wrapped>{namedWithFreeText(line.destination, line.destinationFreeText)}</Wrapped>;
    case 'reason':
      return <Wrapped>{reasonLabel(line, t('stock-card.physical-inventory'))}</Wrapped>;
    case 'adjustment':
    case 'balance':
      return (
        <span className="block whitespace-normal break-words tabular-nums" dir="ltr">
          {cardQuantity(id === 'balance' ? line.stockOnHand : line.quantity, netContent, unit)}
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
  const columns = useMemo(
    () =>
      columnHelper.columns(
        COLUMNS.map(([id, key]) =>
          columnHelper.display({
            id,
            header: () => <DataTableHeaderLabel>{t(key)}</DataTableHeaderLabel>,
            cell: ({ row }) => (
              <LineCell
                id={id}
                line={row.original}
                netContent={card.orderable.netContent}
                unit={unit}
              />
            ),
          }),
        ),
      ),
    [t, card.orderable.netContent, unit],
  );
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
  if (layout === 'table') return <DataTable table={table} empty={empty} footer={footer} />;
  return (
    <DataTableCard>
      {rows.length ? (
        <ul className="divide-y">
          {rows.map((line) => (
            <li className="p-4" key={line.rowId}>
              <dl className="grid grid-cols-2 gap-3 @md/table:grid-cols-3">
                {COLUMNS.map(([id, key]) => (
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
  const columns = useMemo(
    () =>
      columnHelper.columns(
        COLUMNS.map(([id, key]) =>
          columnHelper.display({
            id,
            header: () => <DataTableHeaderLabel>{t(key)}</DataTableHeaderLabel>,
          }),
        ),
      ),
    [t],
  );
  const table = useTable({ features: dataTableFeatures, columns, data: [], enableSorting: false });
  const rowCount = toPaginationState(cardTableSearch(search)).pageSize;
  if (layout === 'table') return <DataTableSkeleton table={table} rowCount={rowCount} />;
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
