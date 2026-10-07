import { useSuspenseQueries, useSuspenseQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useTable } from '@tanstack/react-table';
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
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
import { cardQuantity, productQuantity, type QuantityUnit } from '@/lib/quantity';
import { type SearchChange, toPaginationState, useTableSearchState } from '@/lib/table-search';

export type ResultsLayout = 'table' | 'cards';

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
  const footer = page.totalElements > 0 && (
    <div className="flex flex-col gap-2">
      {!includeInactive && (
        <p className="text-muted-foreground text-xs">{t('stock-on-hand.count-before-inactive')}</p>
      )}
      <DataTablePagination table={table} />
    </div>
  );
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

  return layout === 'table' ? <GroupedTable {...view} /> : <GroupedCards {...view} />;
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
  { key: 'productCode', labelKey: 'stock-on-hand.product-code', width: 'w-28 @4xl/main:w-36' },
  { key: 'product', labelKey: 'stock-on-hand.product', width: undefined },
  { key: 'packSize', labelKey: 'stock-on-hand.pack-size', width: 'w-12 @4xl/main:w-20' },
  { key: 'lotCode', labelKey: 'stock-on-hand.lot-code', width: 'w-28' },
  { key: 'expiry', labelKey: 'stock-on-hand.expiry-date', width: 'w-26 @4xl/main:w-28' },
  { key: 'lastUpdate', labelKey: 'stock-on-hand.last-update', width: 'w-26 @4xl/main:w-28' },
  { key: 'stockOnHand', labelKey: 'stock-on-hand.stock-on-hand', width: 'w-20 @4xl/main:w-28' },
  { key: 'view', labelKey: 'stock-on-hand.view', width: 'w-20 @4xl/main:w-24' },
] as const;

function StockTableHeader() {
  const { t } = useTranslation();
  return (
    <>
      <colgroup>
        {TABLE_COLUMNS.map((column) => (
          <col className={column.width} key={column.key} />
        ))}
      </colgroup>
      <TableHeader surface="muted">
        <TableRow>
          {TABLE_COLUMNS.map((column) => (
            <TableHead key={column.key}>
              <div className="whitespace-normal break-normal">
                <DataTableHeaderLabel>{t(column.labelKey)}</DataTableHeaderLabel>
              </div>
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
    </>
  );
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
}: GroupedViewProps) {
  const { t } = useTranslation();
  const text = useStockText();

  return (
    <ResultsFrame footer={footer} isStale={isStale}>
      <Table density="default" layout="fixed">
        <StockTableHeader />
        <TableBody>
          {groups.length === 0 ? (
            <TableRow>
              <TableCell colSpan={TABLE_COLUMNS.length}>
                <div className="whitespace-normal">{empty}</div>
              </TableCell>
            </TableRow>
          ) : (
            groups.map((group) => {
              const open = !collapsed.includes(group.id);
              const name = text.productLabel(group.product);
              return [
                <TableRow key={group.id} surface="muted">
                  <TableCell>
                    <span className="flex flex-col items-start gap-1 @4xl/main:flex-row @4xl/main:items-center">
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
                  </TableCell>
                  <TableCell>
                    <Wrapped>{name}</Wrapped>
                  </TableCell>
                  <TableCell>{group.product?.netContent ?? ''}</TableCell>
                  <TableCell />
                  <TableCell />
                  <TableCell />
                  <TableCell>
                    <Quantity unavailable={text.unavailable} value={groupBalance(group, unit)} />
                  </TableCell>
                  <TableCell />
                </TableRow>,
                ...(open
                  ? group.cards.map((card) => (
                      <TableRow key={`${group.id}:${card.id}`}>
                        <TableCell>
                          <span className="flex @4xl/main:ps-9">
                            {text.productCode(card.product)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Wrapped>{text.productLabel(card.product)}</Wrapped>
                        </TableCell>
                        <TableCell>{card.product?.netContent ?? ''}</TableCell>
                        <TableCell>
                          <Wrapped>{text.lotLabel(card)}</Wrapped>
                        </TableCell>
                        <TableCell>{text.date(card.lot?.expirationDate)}</TableCell>
                        <TableCell>{text.date(card.occurredDate)}</TableCell>
                        <TableCell>
                          <Quantity
                            unavailable={text.unavailable}
                            value={cardQuantity(card.stockOnHand, card.product?.netContent, unit)}
                          />
                        </TableCell>
                        <TableCell>
                          <StockCardView
                            card={card}
                            search={search}
                            disabled={isStale}
                            product={text.productLabel(card.product)}
                            lot={card.lot?.lotCode ?? t('stock-on-hand.no-lot')}
                          />
                        </TableCell>
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

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="min-w-0 break-words text-sm">{children || '-'}</dd>
    </div>
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
}: GroupedViewProps) {
  const { t } = useTranslation();
  const text = useStockText();

  return (
    <ResultsFrame footer={footer} isStale={isStale}>
      {groups.length === 0 ? (
        <div className="p-4">{empty}</div>
      ) : (
        <ul className="divide-y">
          {groups.map((group) => {
            const open = !collapsed.includes(group.id);
            const name = text.productLabel(group.product);
            return (
              <li key={group.id}>
                <Collapsible onOpenChange={(next) => onToggle(group.id, next)} open={open}>
                  <div className="flex items-start gap-2 bg-muted/30 p-3">
                    <CollapsibleTrigger
                      render={
                        <Button
                          aria-label={t('stock-on-hand.toggle-product', { product: name })}
                          size="icon-sm"
                          variant="ghost"
                        />
                      }
                    >
                      <ToggleIcon open={open} />
                    </CollapsibleTrigger>
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="font-medium text-sm">
                        <Wrapped>{name}</Wrapped>
                      </span>
                      <span className="text-muted-foreground text-xs">
                        {text.productCode(group.product)}
                      </span>
                      <span className="text-muted-foreground text-xs">
                        {t('stock-on-hand.pack-size-value', {
                          size: group.product?.netContent ?? '-',
                        })}
                      </span>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-0.5">
                      <span className="text-muted-foreground text-xs">
                        {t('stock-on-hand.stock-on-hand')}
                      </span>
                      <span className="font-medium text-sm">
                        <Quantity
                          unavailable={text.unavailable}
                          value={groupBalance(group, unit)}
                        />
                      </span>
                    </div>
                  </div>
                  <CollapsibleContent>
                    <ul className="divide-y border-t">
                      {group.cards.map((card) => (
                        <li className="p-3 ps-12" key={card.id}>
                          <dl className="grid grid-cols-2 gap-3 @md/table:grid-cols-3">
                            <Detail label={t('stock-on-hand.lot-code')}>
                              {text.lotLabel(card)}
                            </Detail>
                            <Detail label={t('stock-on-hand.stock-on-hand')}>
                              <Quantity
                                unavailable={text.unavailable}
                                value={cardQuantity(
                                  card.stockOnHand,
                                  card.product?.netContent,
                                  unit,
                                )}
                              />
                            </Detail>
                            <Detail label={t('stock-on-hand.expiry-date')}>
                              {text.date(card.lot?.expirationDate)}
                            </Detail>
                            <Detail label={t('stock-on-hand.last-update')}>
                              {text.date(card.occurredDate)}
                            </Detail>
                            <Detail label={t('stock-on-hand.product')}>
                              <Wrapped>{text.productLabel(card.product)}</Wrapped>
                            </Detail>
                            <Detail label={t('stock-on-hand.product-code')}>
                              {text.productCode(card.product)}
                            </Detail>
                            <Detail label={t('stock-on-hand.pack-size')}>
                              {card.product?.netContent ?? ''}
                            </Detail>
                          </dl>
                          <div className="mt-3 flex justify-end">
                            <StockCardView
                              card={card}
                              search={search}
                              disabled={isStale}
                              product={text.productLabel(card.product)}
                              lot={card.lot?.lotCode ?? t('stock-on-hand.no-lot')}
                            />
                          </div>
                        </li>
                      ))}
                    </ul>
                  </CollapsibleContent>
                </Collapsible>
              </li>
            );
          })}
        </ul>
      )}
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
      variant="outline"
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
      <ChevronDownIcon />
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

const SKELETON_DETAILS = [
  'stock-on-hand.lot-code',
  'stock-on-hand.stock-on-hand',
  'stock-on-hand.expiry-date',
  'stock-on-hand.last-update',
] as const;

export function StockOnHandResultsSkeleton({
  search,
  layout,
}: {
  search: StockOnHandSearch;
  layout: ResultsLayout;
}) {
  const { t } = useTranslation();
  const products = SKELETON_PRODUCTS.slice(0, toPaginationState(search).pageSize);
  const footer = (
    <DataTableFooter>
      <DataTablePaginationSkeleton />
    </DataTableFooter>
  );

  if (layout === 'cards') {
    return (
      <div aria-busy>
        <DataTableCard>
          <ul className="divide-y">
            {products.map((product) => (
              <li key={product.id}>
                <div className="flex items-start gap-2 bg-muted/30 p-3">
                  <ToggleSkeleton />
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <div className="flex h-5 items-center">
                      <SkeletonBar width="w-2/3" />
                    </div>
                    <div className="flex h-4 items-center">
                      <SkeletonBar height="h-3" width="w-16" />
                    </div>
                    <div className="flex h-4 items-center">
                      <SkeletonBar height="h-3" width="w-20" />
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-0.5">
                    <span className="text-muted-foreground text-xs">
                      {t('stock-on-hand.stock-on-hand')}
                    </span>
                    <div className="flex h-5 items-center">
                      <SkeletonBar width="w-10" />
                    </div>
                  </div>
                </div>
                <ul className="divide-y border-t">
                  {product.cards.map((card) => (
                    <li className="p-3 ps-12" key={card}>
                      <dl className="grid grid-cols-2 gap-3 @md/table:grid-cols-3">
                        {SKELETON_DETAILS.map((labelKey) => (
                          <div className="flex min-w-0 flex-col gap-0.5" key={labelKey}>
                            <dt className="text-muted-foreground text-xs">{t(labelKey)}</dt>
                            <dd className="flex h-5 items-center">
                              <SkeletonBar width="w-20" />
                            </dd>
                          </div>
                        ))}
                      </dl>
                      <div className="mt-3 flex justify-end">
                        <SkeletonBar height="h-7" width="w-12" />
                      </div>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
          {footer}
        </DataTableCard>
      </div>
    );
  }

  const cell = (width: string) => (
    <TableCell>
      <SkeletonBar width={width} />
    </TableCell>
  );
  return (
    <div aria-busy>
      <DataTableCard>
        <Table density="default" layout="fixed">
          <StockTableHeader />
          <TableBody>
            {products.flatMap((product) => [
              <TableRow key={product.id} surface="muted">
                <TableCell>
                  <span className="flex flex-col items-start gap-1 @4xl/main:flex-row @4xl/main:items-center">
                    <ToggleSkeleton />
                    <SkeletonBar width="w-12" />
                  </span>
                </TableCell>
                {cell('w-3/4')}
                {cell('w-6')}
                <TableCell />
                <TableCell />
                <TableCell />
                {cell('w-10')}
                <TableCell />
              </TableRow>,
              ...product.cards.map((card) => (
                <TableRow key={card}>
                  <TableCell>
                    <span className="flex @4xl/main:ps-9">
                      <SkeletonBar width="w-12" />
                    </span>
                  </TableCell>
                  {cell('w-3/4')}
                  {cell('w-6')}
                  {cell('w-20')}
                  {cell('w-20')}
                  {cell('w-20')}
                  {cell('w-10')}
                  {cell('w-12')}
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
