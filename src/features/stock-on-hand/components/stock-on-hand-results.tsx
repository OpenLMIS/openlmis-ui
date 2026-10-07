import { useSuspenseQueries, useSuspenseQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { type ColumnVisibilityState, useTable } from '@tanstack/react-table';
import { ChevronDownIcon, PackageSearchIcon, SearchXIcon } from 'lucide-react';
import { type ReactNode, useDeferredValue, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
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
import { formatDateValue } from '@/components/form/date-value';
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
import { lotsByIdsOptions, orderablesByIdsOptions } from '@/features/reference-data/api/queries';
import { productName } from '@/features/reference-data/lib/product-name';
import type { Orderable } from '@/features/reference-data/lib/types';
import { stockCardSummariesOptions } from '@/features/stock-on-hand/api/queries';
import {
  CLEARED_STOCK_FILTERS,
  type StockOnHandSearch,
  showsInactive,
  toSummariesQuery,
} from '@/features/stock-on-hand/lib/search';
import { summaryIds, toStockGroups } from '@/features/stock-on-hand/lib/stock-groups';
import type { StockCardRow, StockProductGroup } from '@/features/stock-on-hand/lib/types';
import { useStoredState } from '@/hooks/use-stored-state';
import { orEmpty } from '@/lib/empty-value';
import { cardQuantity, productQuantity, type QuantityUnit } from '@/lib/quantity';
import { type SearchChange, toPaginationState, useTableSearchState } from '@/lib/table-search';

export type ResultsLayout = { columns: ColumnVisibilityState };

type StockOnHandResultsProps = {
  search: StockOnHandSearch;
  facilityId: string;
  programId: string;
  unit: QuantityUnit;
  layout: ResultsLayout;
  collapsedKey: string;
  onSearchChange: SearchChange<StockOnHandSearch>;
};

const collapsedSchema = z.array(z.string());

const NO_SORT = { id: 'productCode', desc: false };

export function StockOnHandResults({
  search,
  facilityId,
  programId,
  unit,
  layout,
  collapsedKey,
  onSearchChange,
}: StockOnHandResultsProps) {
  const { t } = useTranslation();
  const deferredSearch = useDeferredValue(search);
  const query = toSummariesQuery(deferredSearch, { facilityId, programId });
  const { data: page } = useSuspenseQuery(stockCardSummariesOptions(query));
  const ids = useMemo(() => summaryIds(page.content), [page]);
  const [orderables, lots] = useSuspenseQueries({
    queries: [orderablesByIdsOptions(ids.orderableIds), lotsByIdsOptions(ids.lotIds)],
  });
  const includeInactive = showsInactive(deferredSearch);
  const groups = useMemo(
    () => toStockGroups(page.content, orderables.data, lots.data, includeInactive),
    [page, orderables.data, lots.data, includeInactive],
  );
  const [collapsed, setCollapsed] = useStoredState(collapsedKey, collapsedSchema, []);
  const toggle = (id: string, open: boolean) =>
    setCollapsed(open ? collapsed.filter((item) => item !== id) : [...collapsed, id]);

  const searchState = useTableSearchState({
    search: deferredSearch,
    defaultSort: NO_SORT,
    onSearchChange,
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

  return <GroupedTable {...view} columns={layout.columns} />;
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
  return { productCode, productLabel, lotLabel, date, unavailable };
}

const groupBalance = (group: StockProductGroup, unit: QuantityUnit) =>
  productQuantity(
    group.stockOnHand,
    group.cards.map((card) => card.stockOnHand),
    group.product?.netContent,
    unit,
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

function Wrapped({ children }: { children: ReactNode }) {
  return (
    <span className="block whitespace-normal break-normal">
      <bdi>{children}</bdi>
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
  { key: 'view', labelKey: 'stock-on-hand.view', width: 'w-20' },
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
                      product: <Wrapped>{name}</Wrapped>,
                      packSize: orEmpty(group.product?.netContent),
                      stockOnHand: (
                        <Quantity
                          unavailable={text.unavailable}
                          value={groupBalance(group, unit)}
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
                            product: <Wrapped>{text.productLabel(card.product)}</Wrapped>,
                            packSize: orEmpty(card.product?.netContent),
                            lotCode: <Wrapped>{text.lotLabel(card)}</Wrapped>,
                            expiry: orEmpty(text.date(card.lot?.expirationDate)),
                            lastUpdate: orEmpty(text.date(card.occurredDate)),
                            stockOnHand: (
                              <Quantity
                                unavailable={text.unavailable}
                                value={cardQuantity(
                                  card.stockOnHand,
                                  card.product?.netContent,
                                  unit,
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

function StockCardView({
  card,
  search,
  product,
  lot,
  disabled,
}: {
  card: StockCardRow;
  search: StockOnHandSearch;
  product: string;
  lot: string;
  disabled: boolean;
}) {
  const { t } = useTranslation();
  if (!card.stockCardId) return null;
  return (
    <Button
      nativeButton={false}
      size="sm"
      disabled={disabled}
      aria-label={t('stock-on-hand.view-card', { product, lot })}
      render={
        <Link
          to="/stock-management/stock-on-hand/$stockCardId"
          params={{ stockCardId: card.stockCardId }}
          search={search}
        />
      }
    >
      {t('stock-on-hand.view')}
    </Button>
  );
}

function SkeletonBar({ width = 'w-3/4', height = 'h-4' }: { width?: string; height?: string }) {
  return (
    <div className={`${height} ${width}`}>
      <Skeleton fill />
    </div>
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
  search,
  layout,
}: {
  search: StockOnHandSearch;
  layout: ResultsLayout;
}) {
  const columns = layout.columns;
  const products = SKELETON_PRODUCTS.slice(0, toPaginationState(search).pageSize);
  const footer = (
    <DataTableFooter>
      <DataTablePaginationSkeleton />
    </DataTableFooter>
  );

  const bar = (width: string) => <SkeletonBar width={width} />;
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
                      view: bar('w-12'),
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
