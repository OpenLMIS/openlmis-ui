import { Link } from '@tanstack/react-router';
import { type ColumnVisibilityState, createColumnHelper, useTable } from '@tanstack/react-table';
import { ClipboardListIcon } from 'lucide-react';
import { useCallback, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  CardBand,
  CardList,
  CardListItem,
  CardListSkeleton,
  CardRows,
} from '@/components/card-list';
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
import { SettingsItem } from '@/components/form/settings-list';
import { toCardLines } from '@/features/stock-card/lib/card-lines';
import {
  type CardPagingSearch,
  cardTableSearch,
  changeCardPaging,
} from '@/features/stock-card/lib/search';
import type { CardLineRow, StockCard } from '@/features/stock-card/lib/types';
import { usePageStart } from '@/hooks/use-page-start';
import { EMPTY_VALUE, tableValue } from '@/lib/empty-value';
import type { FacilityProgramSelection } from '@/lib/facility-program-selection';
import { cardQuantity, type QuantityUnit } from '@/lib/quantity';
import { type EventLink, eventLinks, namedWithFreeText, reasonLabel } from '@/lib/stock-labels';
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
  { id: 'document', labelKey: 'stock-card.document-number', hideBelow: 900 },
  { id: 'reversing', labelKey: 'stock-card.reversing', defaultHidden: true },
  { id: 'reversedBy', labelKey: 'stock-card.reversed-by', defaultHidden: true },
] as const;
type CellId = (typeof COLUMNS)[number][0];
const CARD_ROWS = COLUMNS.filter(([id]) => id !== 'date');

function Wrapped({ children, empty }: { children: string | null | undefined; empty?: string }) {
  return (
    <span className="block max-w-60 whitespace-normal break-normal">
      <bdi>{tableValue(children) ?? empty}</bdi>
    </span>
  );
}

type EventSearch = FacilityProgramSelection;

function EventCell({
  link,
  search,
  name,
  empty,
}: {
  link: EventLink | null;
  search: EventSearch;
  name?: string | undefined;
  empty?: string | undefined;
}) {
  if (!link?.eventId) return <Wrapped empty={empty}>{link?.label}</Wrapped>;
  return (
    <span className="whitespace-nowrap">
      <Link
        aria-label={name}
        className="font-medium text-primary underline-offset-4 hover:underline"
        params={{ eventId: link.eventId }}
        search={search}
        to="/stock-management/transaction-history/$eventId"
      >
        <bdi>{link.label}</bdi>
      </Link>
    </span>
  );
}

function LineCell({
  id,
  line,
  netContent,
  unit,
  eventSearch,
  empty,
}: {
  id: CellId;
  line: CardLineRow;
  netContent: number | null | undefined;
  unit: QuantityUnit;
  eventSearch: EventSearch;
  empty?: string;
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
      return <Wrapped empty={empty}>{namedWithFreeText(line.source, line.sourceFreeText)}</Wrapped>;
    case 'issueTo':
      return (
        <Wrapped empty={empty}>
          {namedWithFreeText(line.destination, line.destinationFreeText)}
        </Wrapped>
      );
    case 'reason':
      return (
        <Wrapped empty={empty}>{reasonLabel(line, t('stock-card.physical-inventory'))}</Wrapped>
      );
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
      return <Wrapped empty={empty}>{line.username}</Wrapped>;
    case 'signature':
      return <Wrapped empty={empty}>{line.signature}</Wrapped>;
    case 'document':
    case 'reversing':
    case 'reversedBy': {
      const view = t('stock-card.view-event');
      const link = eventLinks(line, { noNumber: t('stock-card.no-number'), view })[id];
      const named = id !== 'document' && link?.label === view;
      return (
        <EventCell
          link={link}
          name={
            named
              ? t(id === 'reversing' ? 'stock-card.view-reversing' : 'stock-card.view-reversed-by')
              : undefined
          }
          search={eventSearch}
          empty={empty}
        />
      );
    }
  }
}

const NO_EVENT_SEARCH: EventSearch = {};

function useLineColumns(
  netContent?: number | null,
  unit: QuantityUnit = 'DOSES',
  eventSearch: EventSearch = NO_EVENT_SEARCH,
) {
  const { t } = useTranslation();
  return useMemo(
    () =>
      columnHelper.columns(
        COLUMNS.map(([id, key]) =>
          columnHelper.display({
            id,
            header: () => <DataTableHeaderLabel>{t(key)}</DataTableHeaderLabel>,
            cell: ({ row }) => (
              <LineCell
                eventSearch={eventSearch}
                id={id}
                line={row.original}
                netContent={netContent}
                unit={unit}
              />
            ),
          }),
        ),
      ),
    [t, netContent, unit, eventSearch],
  );
}

function LineCard({
  line,
  columnVisibility,
  netContent,
  unit,
  eventSearch,
}: {
  line: CardLineRow;
  columnVisibility: ColumnVisibilityState;
  netContent: number | null | undefined;
  unit: QuantityUnit;
  eventSearch: EventSearch;
}) {
  const { t } = useTranslation();
  const cell = (id: CellId) => (
    <LineCell
      empty={EMPTY_VALUE}
      eventSearch={eventSearch}
      id={id}
      line={line}
      netContent={netContent}
      unit={unit}
    />
  );
  return (
    <CardListItem>
      <CardBand>{cell('date')}</CardBand>
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
  card: StockCard;
  search: CardPagingSearch;
  onSearchChange: SearchChange<CardPagingSearch>;
  unit: QuantityUnit;
  columnVisibility: ColumnVisibilityState;
  eventSearch: FacilityProgramSelection;
};

export function StockCardLines({
  cards,
  card,
  search,
  onSearchChange,
  unit,
  columnVisibility,
  eventSearch,
}: LinesProps) {
  const { t } = useTranslation();
  const lines = useMemo(() => toCardLines(card.lineItems), [card.lineItems]);
  const columns = useLineColumns(card.orderable.netContent, unit, eventSearch);
  const { pageIndex, pageSize } = toPaginationState(cardTableSearch(search));
  const pageCount = Math.max(1, Math.ceil(lines.length / pageSize));
  const clampedIndex = Math.min(pageIndex, pageCount - 1);
  const pageStart = usePageStart<HTMLUListElement>(`${clampedIndex}:${pageSize}`, cards);
  const onTableSearchChange = useCallback<SearchChange<TableSearch>>(
    (update) =>
      onSearchChange((previous) => changeCardPaging(previous, update), false, pageStart.navigation),
    [onSearchChange, pageStart.navigation],
  );
  const searchState = useTableSearchState({
    search: cardTableSearch(search),
    defaultSort: NO_SORT,
    onSearchChange: onTableSearchChange,
  });
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
    onPaginationChange: pageStart.onPaginationChange(searchState.onPaginationChange),
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
  if (cards) {
    return (
      <CardList empty={rows.length === 0 && empty} footer={footer} listRef={pageStart.ref}>
        {rows.map((line) => (
          <LineCard
            columnVisibility={columnVisibility}
            eventSearch={eventSearch}
            key={line.rowId}
            line={line}
            netContent={card.orderable.netContent}
            unit={unit}
          />
        ))}
      </CardList>
    );
  }
  return <DataTable table={table} empty={empty} footer={footer} density="default" layout="auto" />;
}

export function StockCardLinesSkeleton({
  cards,
  search,
  columnVisibility,
}: {
  cards: boolean;
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
  if (cards) {
    return (
      <CardListSkeleton
        count={Math.min(3, rowCount)}
        rows={CARD_ROWS.filter(([column]) => columnVisibility[column] !== false).length}
      />
    );
  }
  return <DataTableSkeleton table={table} rowCount={rowCount} density="default" layout="auto" />;
}
