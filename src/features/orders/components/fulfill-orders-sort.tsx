import { useTranslation } from 'react-i18next';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { type FulfillOrdersSearch, ORDER_DEFAULT_SORT } from '@/features/orders/lib/order-search';
import { type SearchChange, searchSort } from '@/lib/table-search';

export function FulfillOrdersSort({
  search,
  onSearchChange,
  disabled = false,
}: {
  search: FulfillOrdersSearch;
  onSearchChange: SearchChange<FulfillOrdersSearch>;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const sort = searchSort(search, ORDER_DEFAULT_SORT, onSearchChange);
  const options = [
    { value: 'desc', label: t('orders.fulfill.sort-newest') },
    { value: 'asc', label: t('orders.fulfill.sort-oldest') },
  ];
  return (
    <Select
      value={sort.value.id === 'createdDate' ? (sort.value.desc ? 'desc' : 'asc') : null}
      items={options}
      disabled={disabled}
      onValueChange={(value) => {
        if (value) sort.onValueChange({ id: 'createdDate', desc: value === 'desc' });
      }}
    >
      <SelectTrigger aria-label={t('data-table.sort-by')} size="lg" width="full">
        <SelectValue placeholder={t('data-table.sort-by')} />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {options.map(({ value, label }) => (
            <SelectItem key={value} value={value}>
              {label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
