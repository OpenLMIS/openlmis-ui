import { useSuspenseQueries, useSuspenseQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { type ColumnVisibilityState, useTable } from '@tanstack/react-table';
import { ChevronDownIcon, EyeIcon, PackageSearchIcon, SearchXIcon } from 'lucide-react';
import { type ReactNode, type Ref, useDeferredValue, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import {
  PendingWorkAlert,
  SnapshotAlert,
  useSnapshotNotice,
} from '@/components/app-shell/offline-alert';
import {
  DataTableCard,
  DataTableEmpty,
  DataTableFooter,
  DataTableHeaderLabel,
  dataTableFeatures,
} from '@/components/data-table/data-table';
import {
  DataTablePagination,
  DataTablePaginationSkeleton,
} from '@/components/data-table/data-table-pagination';
import { CardActions, CardActionsSkeleton } from '@/components/display/card-actions';
import {
  CardBand,
  CardList,
  CardListItem,
  CardRowSkeleton,
  CardRows,
  SkeletonBar,
} from '@/components/display/card-list';
import { WrappingCell } from '@/components/display/wrapping-cell';
import { formatDateValue } from '@/components/form/date-value';
import { SettingsItem } from '@/components/form/settings-list';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { productName } from '@/features/reference-data/lib/product-name';
import type { Orderable } from '@/features/reference-data/lib/types';
import {
  stockCardSummariesOptions,
  stockSummaryLookups,
} from '@/features/stock-on-hand/api/queries';
import {
  CLEARED_STOCK_FILTERS,
  type StockOnHandSearch,
  showsInactive,
  toSummariesQuery,
} from '@/features/stock-on-hand/lib/search';
import { summaryIds, toStockGroups } from '@/features/stock-on-hand/lib/stock-groups';
import type {
  DeviceStockOnHandReader,
  StockCardRow,
  StockProductGroup,
} from '@/features/stock-on-hand/lib/types';
import { usePagedTableSearch } from '@/hooks/use-page-start';
import { useStoredState } from '@/hooks/use-stored-state';
import { orEmpty, tableValue } from '@/lib/empty-value';
import { useOnline } from '@/lib/online';
import { cardQuantity, productQuantity, type QuantityUnit } from '@/lib/quantity';
import { type SearchChange, toPaginationState } from '@/lib/table-search';

type StockOnHandResultsProps = {
  pendingEvents?: number;
  cards: boolean;
  search: StockOnHandSearch;
  facilityId: string;
  programId: string;
  unit: QuantityUnit;
  columns: ColumnVisibilityState;
  collapsedKey: string;
  onSearchChange: SearchChange<StockOnHandSearch>;
  readOnDevice?: DeviceStockOnHandReader;
};

const collapsedSchema = z.array(z.string());

const NO_SORT = { id: 'productCode', desc: false };

export function StockOnHandResults({
  pendingEvents = 0,
  cards,
  search,
  facilityId,
  programId,
  unit,
  columns,
  collapsedKey,
  onSearchChange,
  readOnDevice,
}: StockOnHandResultsProps) {
  const { t } = useTranslation();
  const deferredSearch = useDeferredValue(search);
  const query = toSummariesQuery(deferredSearch, { facilityId, programId });
  const online = useOnline();
  const {
    data: page,
    isFetching,
    dataUpdatedAt,
    errorUpdatedAt,
  } = useSuspenseQuery(stockCardSummariesOptions(query, readOnDevice, online));
  const snapshotOnline = useSnapshotNotice(
    !!page.device,
    isFetching,
    Math.max(dataUpdatedAt, errorUpdatedAt),
  );
  const ids = useMemo(() => summaryIds(page.content), [page]);
  const [orderables, lots] = useSuspenseQueries({
    queries: stockSummaryLookups(ids, page.device),
  });
  const includeInactive = showsInactive(deferredSearch);
  const groups = useMemo(
    () => toStockGroups(page.content, orderables.data, lots.data, includeInactive),
    [page, orderables.data, lots.data, includeInactive],
  );
  const [collapsed, setCollapsed] = useStoredState(collapsedKey, collapsedSchema, []);
  const toggle = (id: string, open: boolean) =>
    setCollapsed(open ? collapsed.filter((item) => item !== id) : [...collapsed, id]);

  const { pageStart, searchState } = usePagedTableSearch({
    search: deferredSearch,
    defaultSort: NO_SORT,
    onSearchChange,
    cards,
  });
  const table = useTable({
    features: dataTableFeatures,
    columns: [],
    data: groups,
    rowCount: page.totalElements,
    manualPagination: true,
    manualSorting: true,
    enableSorting: false,
    ...searchState,
  });
  const isPastLastPage = page.content.length === 0 && page.totalElements > 0;

  useEffect(() => {
    if (isPastLastPage) {
      onSearchChange({ page: page.totalPages > 1 ? page.totalPages : undefined }, true);
    }
  }, [isPastLastPage, page.totalPages, onSearchChange]);

  if (isPastLastPage) return null;

  const hasTextFilters = Boolean(
    deferredSearch.productCode || deferredSearch.productName || deferredSearch.lotCode,
  );
  const empty =
    page.totalElements === 0 ? (
      hasTextFilters ? (
        <DataTableEmpty
          action={
            <Button onClick={() => onSearchChange(CLEARED_STOCK_FILTERS)} variant="destructive">
              {t('stock-on-hand.clear-filters')}
            </Button>
          }
          description={t('stock-on-hand.no-matches-description')}
          icon={<SearchXIcon />}
          title={t('stock-on-hand.no-matches-title')}
        />
      ) : (
        <DataTableEmpty
          description={t('stock-on-hand.no-products-description')}
          icon={<PackageSearchIcon />}
          title={t('stock-on-hand.no-products')}
        />
      )
    ) : (
      <DataTableEmpty
        action={
          <Button
            onClick={() => onSearchChange({ includeInactive: undefined }, true)}
            variant="outline"
          >
            {t('stock-on-hand.include-inactive')}
          </Button>
        }
        description={t('stock-on-hand.page-inactive-only')}
        icon={<PackageSearchIcon />}
        title={t('stock-on-hand.inactive-only-title')}
      />
    );
  const footer = page.totalElements > 0 && <DataTablePagination table={table} />;
  const isStale = search !== deferredSearch;
  const view = {
    groups,
    search: deferredSearch,
    unit,
    collapsed,
    onToggle: toggle,
    empty,
    footer,
    isStale,
  };

  return (
    <>
      {page.device && snapshotOnline !== undefined ? (
        <SnapshotAlert
          snapshot={page.device}
          online={snapshotOnline}
          message="stock-on-hand.offline-snapshot"
          pending={pendingEvents}
        />
      ) : (
        <PendingWorkAlert
          count={pendingEvents}
          message={{
            online: 'offline-events.stock-pending-online',
            offline: 'offline-events.stock-pending-offline',
          }}
        />
      )}
      {cards ? (
        <GroupedCards {...view} columns={columns} listRef={pageStart.ref} />
      ) : (
        <GroupedTable {...view} columns={columns} />
      )}
    </>
  );
}

type GroupedViewProps = {
  search: StockOnHandSearch;
  groups: StockProductGroup[];
  unit: QuantityUnit;
  collapsed: readonly string[];
  onToggle: (id: string, open: boolean) => void;
  empty: ReactNode;
  footer: ReactNode;
  isStale: boolean;
};

function ResultsFrame({
  isStale,
  footer,
  children,
}: Pick<GroupedViewProps, 'isStale' | 'footer'> & { children: ReactNode }) {
  return (
    <DataTableCard>
      <div aria-busy={isStale} className="transition-opacity aria-busy:opacity-60">
        {children}
      </div>
      {footer && <DataTableFooter>{footer}</DataTableFooter>}
    </DataTableCard>
  );
}

function useStockText() {
  const { t, i18n } = useTranslation();
  const productCode = (product: Orderable | undefined) =>
    product ? <Code>{product.productCode}</Code> : <bdi>{t('stock-on-hand.unknown-product')}</bdi>;
  const productLabel = (product: Orderable | undefined) =>
    product ? productName(product) : t('stock-on-hand.unknown-product');
  const lotLabel = (row: StockCardRow) => {
    if (row.lot) return <Code>{row.lot.lotCode}</Code>;
    return <bdi>{t(row.lot === null ? 'stock-on-hand.no-lot' : 'stock-on-hand.unknown-lot')}</bdi>;
  };
  const date = (value: string | null | undefined) =>
    value ? formatDateValue(value.slice(0, 10), i18n.language) : '';
  const unavailable = t('stock-on-hand.unavailable');
  const packSize = (product: Orderable | undefined) =>
    product?.netContent == null
      ? tableValue(product?.netContent)
      : new Intl.NumberFormat(i18n.language).format(product.netContent);
  return {
    productCode,
    productLabel,
    lotLabel,
    date,
    unavailable,
    packSize,
    language: i18n.language,
  };
}

const groupBalance = (group: StockProductGroup, unit: QuantityUnit, language: string) =>
  productQuantity(
    group.stockOnHand,
    group.cards.map((card) => card.stockOnHand),
    group.product?.netContent,
    unit,
    language,
  );

function Quantity({ value, unavailable }: { value: string | null; unavailable: string }) {
  return value === null ? (
    <span className="text-muted-foreground">{unavailable}</span>
  ) : (
    <span className="tabular-nums" dir="ltr">
      {value}
    </span>
  );
}

function Code({ children }: { children: ReactNode }) {
  return (
    <span className="flex">
      <span className="min-w-0 whitespace-normal break-normal" dir="ltr">
        {children}
      </span>
    </span>
  );
}

function ToggleIcon({ open }: { open: boolean }) {
  return <ChevronDownIcon className={open ? undefined : '-rotate-90 rtl:rotate-90'} />;
}

const TABLE_COLUMNS = [
  { key: 'productCode', labelKey: 'stock-on-hand.product-code', width: 'w-40' },
  { key: 'product', labelKey: 'stock-on-hand.product', width: 'w-48' },
  { key: 'packSize', labelKey: 'stock-on-hand.pack-size', width: 'w-24' },
  { key: 'lotCode', labelKey: 'stock-on-hand.lot-code', width: 'w-28' },
  { key: 'expiry', labelKey: 'stock-on-hand.expiry-date', width: 'w-28' },
  { key: 'lastUpdate', labelKey: 'stock-on-hand.last-update', width: 'w-28' },
  { key: 'stockOnHand', labelKey: 'stock-on-hand.stock-on-hand', width: 'w-32' },
  { key: 'view', labelKey: 'stock-on-hand.actions', width: 'w-24' },
] as const;

type ColumnKey = (typeof TABLE_COLUMNS)[number]['key'];

export const STOCK_HIDEABLE_COLUMNS = [
  { id: 'packSize', labelKey: 'stock-on-hand.pack-size', hideBelow: 776 },
  { id: 'expiry', labelKey: 'stock-on-hand.expiry-date', hideBelow: 888 },
  { id: 'lastUpdate', labelKey: 'stock-on-hand.last-update', hideBelow: 1000 },
] as const;

const visibleColumns = (columns: ColumnVisibilityState) =>
  TABLE_COLUMNS.filter((column) => columns[column.key] !== false);

function StockTableHeader({ columns }: { columns: ColumnVisibilityState }) {
  const { t } = useTranslation();
  const shown = visibleColumns(columns);
  return (
    <>
      <colgroup>
        {shown.map((column) => (
          <col className={column.width} key={column.key} />
        ))}
      </colgroup>
      <TableHeader surface="muted">
        <TableRow>
          {shown.map((column) => (
            <TableHead key={column.key}>
              <DataTableHeaderLabel>{t(column.labelKey)}</DataTableHeaderLabel>
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
    </>
  );
}

function Cells({
  columns,
  cells,
}: {
  columns: ColumnVisibilityState;
  cells: Partial<Record<ColumnKey, ReactNode>>;
}) {
  return visibleColumns(columns).map((column) => (
    <TableCell key={column.key}>{cells[column.key]}</TableCell>
  ));
}

function GroupedTable({
  search,
  groups,
  unit,
  collapsed,
  onToggle,
  empty,
  footer,
  isStale,
  columns,
}: GroupedViewProps & { columns: ColumnVisibilityState }) {
  const { t } = useTranslation();
  const text = useStockText();

  return (
    <ResultsFrame footer={footer} isStale={isStale}>
      <Table density="default" layout="fixed">
        <StockTableHeader columns={columns} />
        <TableBody>
          {groups.length === 0 ? (
            <TableRow>
              <TableCell colSpan={visibleColumns(columns).length}>
                <div className="whitespace-normal">{empty}</div>
              </TableCell>
            </TableRow>
          ) : (
            groups.map((group) => {
              const open = !collapsed.includes(group.id);
              const name = text.productLabel(group.product);
              return [
                <TableRow key={group.id} surface="muted">
                  <Cells
                    columns={columns}
                    cells={{
                      productCode: (
                        <span className="flex items-center gap-1">
                          <Button
                            aria-expanded={open}
                            aria-label={t('stock-on-hand.toggle-product', { product: name })}
                            onClick={() => onToggle(group.id, !open)}
                            size="icon-sm"
                            variant="ghost"
                          >
                            <ToggleIcon open={open} />
                          </Button>
                          {text.productCode(group.product)}
                        </span>
                      ),
                      product: <WrappingCell>{name}</WrappingCell>,
                      packSize: text.packSize(group.product),
                      stockOnHand: (
                        <Quantity
                          unavailable={text.unavailable}
                          value={groupBalance(group, unit, text.language)}
                        />
                      ),
                    }}
                  />
                </TableRow>,
                ...(open
                  ? group.cards.map((card) => (
                      <TableRow key={`${group.id}:${card.id}`}>
                        <Cells
                          columns={columns}
                          cells={{
                            productCode: (
                              <span className="flex ps-8">{text.productCode(card.product)}</span>
                            ),
                            product: <WrappingCell>{text.productLabel(card.product)}</WrappingCell>,
                            packSize: text.packSize(card.product),
                            lotCode: <WrappingCell>{text.lotLabel(card)}</WrappingCell>,
                            expiry: tableValue(text.date(card.lot?.expirationDate)),
                            lastUpdate: tableValue(text.date(card.occurredDate)),
                            stockOnHand: (
                              <Quantity
                                unavailable={text.unavailable}
                                value={cardQuantity(
                                  card.stockOnHand,
                                  card.product?.netContent,
                                  unit,
                                  text.language,
                                )}
                              />
                            ),
                            view: (
                              <StockCardView
                                card={card}
                                search={search}
                                disabled={isStale}
                                product={text.productLabel(card.product)}
                                lot={card.lot?.lotCode ?? t('stock-on-hand.no-lot')}
                              />
                            ),
                          }}
                        />
                      </TableRow>
                    ))
                  : []),
              ];
            })
          )}
        </TableBody>
      </Table>
    </ResultsFrame>
  );
}

function GroupedCards({
  search,
  groups,
  unit,
  collapsed,
  onToggle,
  empty,
  footer,
  isStale,
  columns,
  listRef,
}: GroupedViewProps & { columns: ColumnVisibilityState; listRef: Ref<HTMLUListElement> }) {
  const { t } = useTranslation();
  const text = useStockText();

  return (
    <CardList busy={isStale} empty={groups.length === 0 && empty} footer={footer} listRef={listRef}>
      {groups.map((group) => {
        const open = !collapsed.includes(group.id);
        const name = text.productLabel(group.product);
        const packSize = columns.packSize !== false && text.packSize(group.product);
        return (
          <CardListItem key={group.id}>
            <div className="flex items-start gap-2 bg-muted/50 px-4 py-2.5">
              <Button
                aria-expanded={open}
                aria-label={t('stock-on-hand.toggle-product', { product: name })}
                onClick={() => onToggle(group.id, !open)}
                size="icon-sm"
                variant="ghost"
              >
                <ToggleIcon open={open} />
              </Button>
              <div className="min-w-0 flex-1 wrap-anywhere">
                <div className="font-semibold text-sm">
                  <WrappingCell>{name}</WrappingCell>
                </div>
                <div className="flex flex-wrap items-center gap-1 text-muted-foreground text-xs">
                  {text.productCode(group.product)}
                  {packSize && (
                    <>
                      <span aria-hidden>·</span>
                      <span>
                        {t('stock-on-hand.pack-size')} <bdi>{packSize}</bdi>
                      </span>
                    </>
                  )}
                </div>
              </div>
              <div className="max-w-1/2 wrap-anywhere text-end font-semibold text-sm">
                <span className="sr-only">{t('stock-on-hand.stock-on-hand')} </span>
                <Quantity
                  unavailable={text.unavailable}
                  value={groupBalance(group, unit, text.language)}
                />
              </div>
            </div>
            {open && (
              <ul className="divide-y">
                {group.cards.map((card) => (
                  <li className="divide-y" key={card.id}>
                    <StockLotDetails
                      card={card}
                      group={group}
                      columns={columns}
                      unit={unit}
                      search={search}
                      isStale={isStale}
                      text={text}
                    />
                  </li>
                ))}
              </ul>
            )}
          </CardListItem>
        );
      })}
    </CardList>
  );
}

function StockLotDetails({
  card,
  group,
  columns,
  unit,
  search,
  isStale,
  text,
}: {
  card: StockCardRow;
  group: StockProductGroup;
  columns: ColumnVisibilityState;
  unit: QuantityUnit;
  search: StockOnHandSearch;
  isStale: boolean;
  text: ReturnType<typeof useStockText>;
}) {
  const { t } = useTranslation();
  return (
    <>
      <CardBand>
        <div className="min-w-0 wrap-anywhere">{text.lotLabel(card)}</div>
        {card.stockCardId && (
          <StockCardView
            cards
            card={card}
            search={search}
            disabled={isStale}
            product={text.productLabel(card.product)}
            lot={card.lot?.lotCode ?? t('stock-on-hand.no-lot')}
          />
        )}
      </CardBand>
      <CardRows>
        {card.product?.id !== group.product?.id && (
          <>
            <SettingsItem label={t('stock-on-hand.product')}>
              <bdi>{text.productLabel(card.product)}</bdi>
            </SettingsItem>
            <SettingsItem label={t('stock-on-hand.product-code')}>
              <span className="flex justify-end">{text.productCode(card.product)}</span>
            </SettingsItem>
            {columns.packSize !== false && (
              <SettingsItem label={t('stock-on-hand.pack-size')}>
                {text.packSize(card.product)}
              </SettingsItem>
            )}
          </>
        )}
        {columns.expiry !== false && (
          <SettingsItem label={t('stock-on-hand.expiry-date')}>
            <bdi>{orEmpty(text.date(card.lot?.expirationDate))}</bdi>
          </SettingsItem>
        )}
        {columns.lastUpdate !== false && (
          <SettingsItem label={t('stock-on-hand.last-update')}>
            <bdi>{orEmpty(text.date(card.occurredDate))}</bdi>
          </SettingsItem>
        )}
        <SettingsItem label={t('stock-on-hand.stock-on-hand')}>
          <strong>
            <Quantity
              unavailable={text.unavailable}
              value={cardQuantity(card.stockOnHand, card.product?.netContent, unit, text.language)}
            />
          </strong>
        </SettingsItem>
      </CardRows>
    </>
  );
}

function StockCardView({
  card,
  search,
  product,
  lot,
  disabled,
  cards = false,
}: {
  card: StockCardRow;
  search: StockOnHandSearch;
  product: string;
  lot: string;
  disabled: boolean;
  cards?: boolean;
}) {
  const { t } = useTranslation();
  if (!card.stockCardId) return null;
  const name = t('stock-on-hand.view-card', { product, lot });
  const link = (
    <Link
      to="/stock-management/stock-on-hand/$stockCardId"
      params={{ stockCardId: card.stockCardId }}
      search={search}
      state={{ cardHasLot: card.lot !== null }}
    />
  );
  if (cards) {
    return (
      <CardActions
        label={t('card-actions.actions-for', { name: `${product} ${lot}` })}
        actions={[
          {
            id: 'view',
            icon: <EyeIcon />,
            label: t('stock-on-hand.view'),
            name,
            disabled,
            link,
          },
        ]}
      />
    );
  }
  return (
    <Button nativeButton={false} size="sm" disabled={disabled} aria-label={name} render={link}>
      {t('stock-on-hand.view')}
    </Button>
  );
}

function ToggleSkeleton() {
  return (
    <span className="flex size-7 shrink-0 items-center justify-center text-muted-foreground">
      <ChevronDownIcon className="size-4" />
    </span>
  );
}

const SKELETON_PRODUCTS = [
  { id: 'a', cards: ['a1', 'a2'] },
  { id: 'b', cards: ['b1'] },
  { id: 'c', cards: ['c1'] },
  { id: 'd', cards: ['d1', 'd2'] },
  { id: 'e', cards: ['e1'] },
];

export function StockOnHandResultsSkeleton({
  cards,
  search,
  columns,
}: {
  cards: boolean;
  search: StockOnHandSearch;
  columns: ColumnVisibilityState;
}) {
  const products = SKELETON_PRODUCTS.slice(0, toPaginationState(search).pageSize);
  const footer = (
    <DataTableFooter>
      <DataTablePaginationSkeleton />
    </DataTableFooter>
  );

  const bar = (width: string) => <SkeletonBar width={width} />;
  if (cards) {
    return (
      <div aria-busy>
        <CardList footer={<DataTablePaginationSkeleton />}>
          {products.map((product) => (
            <CardListItem key={product.id}>
              <div className="flex items-start gap-2 bg-muted/50 px-4 py-2.5">
                <ToggleSkeleton />
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  {bar('w-3/4')}
                  {bar(columns.packSize !== false ? 'w-40' : 'w-12')}
                </div>
                {bar('w-10')}
              </div>
              <ul className="divide-y">
                {product.cards.map((card) => (
                  <li className="divide-y" key={card}>
                    <CardBand>
                      {bar('w-20')}
                      <CardActionsSkeleton count={1} />
                    </CardBand>
                    <CardRows>
                      {['expiry', 'lastUpdate', 'stockOnHand']
                        .filter((key) => columns[key] !== false)
                        .map((key) => (
                          <CardRowSkeleton key={key} />
                        ))}
                    </CardRows>
                  </li>
                ))}
              </ul>
            </CardListItem>
          ))}
        </CardList>
      </div>
    );
  }
  return (
    <div aria-busy>
      <DataTableCard>
        <Table density="default" layout="fixed">
          <StockTableHeader columns={columns} />
          <TableBody>
            {products.flatMap((product) => [
              <TableRow key={product.id} surface="muted">
                <Cells
                  columns={columns}
                  cells={{
                    productCode: (
                      <span className="flex items-center gap-1">
                        <ToggleSkeleton />
                        {bar('w-12')}
                      </span>
                    ),
                    product: bar('w-3/4'),
                    packSize: bar('w-6'),
                    stockOnHand: bar('w-10'),
                  }}
                />
              </TableRow>,
              ...product.cards.map((card) => (
                <TableRow key={card}>
                  <Cells
                    columns={columns}
                    cells={{
                      productCode: <span className="flex ps-8">{bar('w-12')}</span>,
                      product: bar('w-3/4'),
                      packSize: bar('w-6'),
                      lotCode: bar('w-20'),
                      expiry: bar('w-20'),
                      lastUpdate: bar('w-20'),
                      stockOnHand: bar('w-10'),
                      view: (
                        <div className="h-7 w-16">
                          <Skeleton fill />
                        </div>
                      ),
                    }}
                  />
                </TableRow>
              )),
            ])}
          </TableBody>
        </Table>
        {footer}
      </DataTableCard>
    </div>
  );
}
