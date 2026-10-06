import { useSuspenseQueries, useSuspenseQuery } from '@tanstack/react-query';
import { useTable } from '@tanstack/react-table';
import { ChevronDownIcon, PackageSearchIcon, SearchXIcon } from 'lucide-react';
import { type ReactNode, useDeferredValue, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import {
  DataTableCard,
  DataTableEmpty,
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
  /** Where the products the user collapsed are kept, one place per user, facility and program. */
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
          title={t('stock-on-hand.no-products')}
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
        title={t('stock-on-hand.no-products')}
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
  const view = { groups, unit, collapsed, onToggle: toggle, empty, footer, isStale };

  return layout === 'table' ? <GroupedTable {...view} /> : <GroupedCards {...view} />;
}

type GroupedViewProps = {
  groups: StockProductGroup[];
  unit: QuantityUnit;
  collapsed: readonly string[];
  onToggle: (id: string, open: boolean) => void;
  empty: ReactNode;
  footer: ReactNode;
  isStale: boolean;
};

function useStockText() {
  const { t, i18n } = useTranslation();
  const productCode = (product: Orderable | undefined) =>
    product ? product.productCode : t('stock-on-hand.unknown-product');
  const productLabel = (product: Orderable | undefined) =>
    product ? (product.fullProductName ?? product.productCode) : t('stock-on-hand.unknown-product');
  const lotLabel = (row: StockCardRow) =>
    row.lot === null
      ? t('stock-on-hand.no-lot')
      : (row.lot?.lotCode ?? t('stock-on-hand.unknown-lot'));
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
      <span className="min-w-0 truncate" dir="ltr">
        {children}
      </span>
    </span>
  );
}

function Wrapped({ children }: { children: ReactNode }) {
  return (
    <span className="block whitespace-normal break-words">
      <bdi>{children}</bdi>
    </span>
  );
}

function ToggleIcon({ open }: { open: boolean }) {
  return <ChevronDownIcon className={open ? undefined : '-rotate-90 rtl:rotate-90'} />;
}

function ToggleButton({
  open,
  label,
  onToggle,
}: {
  open: boolean;
  label: string;
  onToggle: () => void;
}) {
  return (
    <Button
      aria-expanded={open}
      aria-label={label}
      onClick={onToggle}
      size="icon-sm"
      variant="ghost"
    >
      <ToggleIcon open={open} />
    </Button>
  );
}

const TABLE_COLUMNS = [
  { key: 'productCode', labelKey: 'stock-on-hand.product-code', width: 'w-40' },
  { key: 'product', labelKey: 'stock-on-hand.product', width: undefined },
  { key: 'packSize', labelKey: 'stock-on-hand.pack-size', width: 'w-24' },
  { key: 'lotCode', labelKey: 'stock-on-hand.lot-code', width: 'w-36' },
  { key: 'expiry', labelKey: 'stock-on-hand.expiry-date', width: 'w-32' },
  { key: 'lastUpdate', labelKey: 'stock-on-hand.last-update', width: 'w-32' },
  { key: 'stockOnHand', labelKey: 'stock-on-hand.stock-on-hand', width: 'w-36' },
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
              <DataTableHeaderLabel>{t(column.labelKey)}</DataTableHeaderLabel>
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
    </>
  );
}

function GroupedTable({
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
    <DataTableCard>
      <div aria-busy={isStale} className="transition-opacity aria-busy:opacity-60">
        <Table density="comfortable" layout="fixed">
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
                      <span className="flex items-center gap-1">
                        <ToggleButton
                          label={t('stock-on-hand.toggle-product', { product: name })}
                          onToggle={() => onToggle(group.id, !open)}
                          open={open}
                        />
                        <Code>{text.productCode(group.product)}</Code>
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
                  </TableRow>,
                  ...(open
                    ? group.cards.map((card) => (
                        <TableRow key={`${group.id}:${card.id}`}>
                          <TableCell>
                            <span className="flex ps-9">
                              <Code>{text.productCode(card.product)}</Code>
                            </span>
                          </TableCell>
                          <TableCell>
                            <Wrapped>{text.productLabel(card.product)}</Wrapped>
                          </TableCell>
                          <TableCell>{card.product?.netContent ?? ''}</TableCell>
                          <TableCell>
                            <Code>{text.lotLabel(card)}</Code>
                          </TableCell>
                          <TableCell>{text.date(card.lot?.expirationDate)}</TableCell>
                          <TableCell>{text.date(card.occurredDate)}</TableCell>
                          <TableCell>
                            <Quantity
                              unavailable={text.unavailable}
                              value={cardQuantity(card.stockOnHand, card.product?.netContent, unit)}
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
      </div>
      {footer && <div className="border-t bg-muted/30 px-4 py-3">{footer}</div>}
    </DataTableCard>
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
    <DataTableCard>
      <div aria-busy={isStale} className="transition-opacity aria-busy:opacity-60">
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
                          <Code>{text.productCode(group.product)}</Code>
                        </span>
                        <span className="text-muted-foreground text-xs">
                          {t('stock-on-hand.pack-size')}: {group.product?.netContent ?? '-'}
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
                                <Code>{text.lotLabel(card)}</Code>
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
                                <Code>{text.productCode(card.product)}</Code>
                              </Detail>
                              <Detail label={t('stock-on-hand.pack-size')}>
                                {card.product?.netContent ?? ''}
                              </Detail>
                            </dl>
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
      </div>
      {footer && <div className="border-t bg-muted/30 px-4 py-3">{footer}</div>}
    </DataTableCard>
  );
}

function SkeletonBar() {
  return (
    <div className="h-4 w-3/4">
      <Skeleton fill />
    </div>
  );
}

/** The results' shape while a page loads: product rows each with two card rows. */
export function StockOnHandResultsSkeleton({
  search,
  layout,
}: {
  search: StockOnHandSearch;
  layout: ResultsLayout;
}) {
  const products = Array.from(
    { length: Math.min(toPaginationState(search).pageSize, 5) },
    (_, index) => index,
  );
  const footer = (
    <div className="border-t bg-muted/30 px-4 py-3">
      <DataTablePaginationSkeleton />
    </div>
  );

  if (layout === 'cards') {
    return (
      <div aria-busy>
        <DataTableCard>
          <ul className="divide-y">
            {products.map((product) => (
              <li className="flex flex-col gap-2 p-3" key={product}>
                <SkeletonBar />
                <div className="h-3 w-1/3">
                  <Skeleton fill />
                </div>
              </li>
            ))}
          </ul>
          {footer}
        </DataTableCard>
      </div>
    );
  }

  return (
    <div aria-busy>
      <DataTableCard>
        <Table density="comfortable" layout="fixed">
          <StockTableHeader />
          <TableBody>
            {products.flatMap((product) =>
              [0, 1, 2].map((row) => (
                <TableRow key={`${product}:${row}`} surface={row === 0 ? 'muted' : 'default'}>
                  {TABLE_COLUMNS.map((column) => (
                    <TableCell key={column.key}>
                      {row === 0 &&
                      ['lotCode', 'expiry', 'lastUpdate'].includes(column.key) ? null : (
                        <SkeletonBar />
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              )),
            )}
          </TableBody>
        </Table>
        {footer}
      </DataTableCard>
    </div>
  );
}
