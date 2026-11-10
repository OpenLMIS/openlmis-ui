import { useTranslation } from 'react-i18next';
import { DataTableViewOptions } from '@/components/data-table/data-table-view-options';
import { viewColumns } from '@/features/orders/components/orders-table';
import {
  isOrderSortField,
  ORDER_DEFAULT_SORT,
  type ViewOrdersSearch,
} from '@/features/orders/lib/order-search';
import type { OrderKind } from '@/features/orders/lib/order-status';
import type { useCardView } from '@/hooks/use-card-view';
import { type SearchChange, searchSort } from '@/lib/table-search';

export function OrdersViewOptions<T extends ViewOrdersSearch>({
  kind = 'view',
  columnView,
  search,
  onSearchChange,
}: {
  kind?: OrderKind;
  columnView: ReturnType<typeof useCardView<HTMLDivElement>>;
  search: T;
  onSearchChange: SearchChange<T>;
}) {
  const { t } = useTranslation();
  const columns = viewColumns(kind);
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
