import { useTranslation } from 'react-i18next';
import { DataTableViewOptions } from '@/components/data-table/data-table-view-options';
import {
  FULFILL_ORDER_HIDEABLE_COLUMNS,
  ORDER_HIDEABLE_COLUMNS,
} from '@/features/orders/components/orders-table';
import {
  isOrderSortField,
  ORDER_DEFAULT_SORT,
  type ViewOrdersSearch,
} from '@/features/orders/lib/order-search';
import type { useCardView } from '@/hooks/use-card-view';
import { type SearchChange, searchSort } from '@/lib/table-search';

export function OrdersViewOptions<T extends ViewOrdersSearch>({
  kind = 'view',
  columnView,
  search,
  onSearchChange,
}: {
  kind?: 'view' | 'fulfill';
  columnView: ReturnType<typeof useCardView<HTMLDivElement>>;
  search: T;
  onSearchChange: SearchChange<T>;
}) {
  const { t } = useTranslation();
  const columns = [
    {
      id: 'orderCode',
      labelKey:
        kind === 'view' ? 'orders.view.columns.order-code' : 'orders.fulfill.columns.order-code',
    } as const,
    ...(kind === 'view' ? ORDER_HIDEABLE_COLUMNS : FULFILL_ORDER_HIDEABLE_COLUMNS),
  ];
  return (
    <DataTableViewOptions
      size="lg"
      layout={columnView.layout}
      columns={columns
        .filter(({ id }) => id !== 'orderCode')
        .map(({ id, labelKey }) => ({ id, label: t(labelKey) }))}
      {...columnView.columnView}
      sort={{
        ...searchSort(search, ORDER_DEFAULT_SORT, onSearchChange),
        columns: columns
          .filter(({ id }) => isOrderSortField(id))
          .map(({ id, labelKey }) => ({ id, label: t(labelKey) })),
      }}
    />
  );
}
