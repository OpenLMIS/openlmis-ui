import { useQuery } from '@tanstack/react-query';
import { PackageIcon } from 'lucide-react';
import { useDeferredValue, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  PickerAdd,
  PickerAddButton,
  PickerAddField,
  PickerAddIcon,
} from '@/components/pickers/picker-add';
import { Button } from '@/components/ui/button';
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxStatus,
} from '@/components/ui/combobox';
import type { OrderProduct } from '@/features/orders/lib/types';
import { approvedProductsOptions } from '@/features/reference-data/api/queries';
import { productSearchStatus } from '@/lib/product-search-status';

export function OrderProductPicker({
  programId,
  facilityId,
  added,
  disabled,
  onAdd,
}: {
  programId: string;
  facilityId: string;
  added: readonly string[];
  disabled: boolean;
  onAdd: (product: OrderProduct) => void;
}) {
  const { t } = useTranslation();
  const anchor = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const name = useDeferredValue(search);
  const [selected, setSelected] = useState<OrderProduct | null>(null);
  const query = useQuery({
    ...approvedProductsOptions({ programId, facilityId, name, page: 0, size: 50 }),
    enabled: open,
  });
  const products = query.data?.content.map((item) => item.orderable) ?? [];
  const status = productSearchStatus({
    listed: products.length,
    total: query.data?.totalElements ?? 0,
    typed: !!name.trim(),
  });
  return (
    <div className="flex flex-wrap items-center gap-2">
      <PickerAdd>
        <PickerAddField ref={anchor}>
          <Combobox
            items={products}
            filter={null}
            open={open}
            onOpenChange={setOpen}
            value={selected}
            itemToStringLabel={(item) => item.fullProductName ?? item.productCode}
            isItemEqualToValue={(a, b) => a.id === b.id}
            onInputValueChange={(value, details) => {
              if (details.reason === 'input-change') setSearch(value);
            }}
            onValueChange={(item, details) => {
              if (details.reason === 'escape-key' && !item) return details.allowPropagation();
              setSelected(item);
            }}
            disabled={disabled}
          >
            <ComboboxInput
              aria-label={t('orders.edit.select-product')}
              placeholder={t('orders.edit.select-product')}
              clearLabel={t('data-table.clear-filters')}
              size="lg"
              width="full"
            >
              <PickerAddIcon>
                <PackageIcon />
              </PickerAddIcon>
            </ComboboxInput>
            <ComboboxContent anchor={anchor}>
              <ComboboxEmpty>
                {query.isFetching ? t('stock-events.products-loading') : t('orders.create.empty')}
              </ComboboxEmpty>
              <ComboboxList>
                {(item: OrderProduct) => (
                  <ComboboxItem key={item.id} value={item} disabled={added.includes(item.id)}>
                    <span>{item.fullProductName ?? item.productCode}</span>
                    {added.includes(item.id) && (
                      <span className="text-muted-foreground text-xs">
                        {t('orders.edit.already-added')}
                      </span>
                    )}
                  </ComboboxItem>
                )}
              </ComboboxList>
              {status && (
                <ComboboxStatus>
                  {t(status.key, { shown: status.shown, count: status.count })}
                </ComboboxStatus>
              )}
              {query.isError && (
                <ComboboxStatus>
                  <Button variant="outline" onClick={() => query.refetch()}>
                    {t('error.try-again')}
                  </Button>
                </ComboboxStatus>
              )}
            </ComboboxContent>
          </Combobox>
        </PickerAddField>
        <PickerAddButton
          disabled={!selected || added.includes(selected.id) || disabled}
          onClick={() => {
            if (selected) {
              onAdd(selected);
              setSelected(null);
              setSearch('');
            }
          }}
        >
          {t('facilities.form.add')}
        </PickerAddButton>
      </PickerAdd>
    </div>
  );
}
