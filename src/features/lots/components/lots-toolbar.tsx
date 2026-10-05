import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DataTableToolbar } from '@/components/data-table/data-table';
import { DataTableComboboxFilter } from '@/components/data-table/data-table-filters';
import { DataTableViewOptions } from '@/components/data-table/data-table-view-options';
import type { useColumnVisibility } from '@/components/data-table/responsive-columns';
import { DatePicker } from '@/components/form/form-fields';
import { LOT_HIDEABLE_COLUMNS, type LotsSearch } from '@/features/lots/lib/search';
import {
  orderablesByIdsOptions,
  orderablesSearchOptions,
} from '@/features/reference-data/api/queries';
import { productName } from '@/features/reference-data/lib/product-name';
import type { Orderable } from '@/features/reference-data/lib/types';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { isOfflineError } from '@/lib/http';

const SEARCH_DELAY = 300;

const toOption = (orderable: Orderable) => ({
  value: orderable.id,
  label: productName(orderable),
  description: orderable.productCode,
});

type LotsToolbarProps = {
  search: LotsSearch;
  onFilterChange: (patch: Partial<LotsSearch>) => void;
  columnView: ReturnType<typeof useColumnVisibility>;
};

export function LotsToolbar({ search, onFilterChange, columnView }: LotsToolbarProps) {
  const { t } = useTranslation();

  return (
    <DataTableToolbar>
      <div className="w-full @2xl/main:w-72">
        <ProductFilter
          onValueChange={(product) =>
            onFilterChange({ product: product || undefined, page: undefined })
          }
          value={search.product}
        />
      </div>
      <div className="min-w-64 flex-1 @2xl/main:max-w-80">
        <DatePicker
          clearLabel={t('data-table.clear-filter', { label: t('lots.earliest-expiry') })}
          id="lots-earliest-expiry"
          label={t('lots.earliest-expiry')}
          latest={search.expiryTo}
          onValueChange={(expiryFrom) =>
            onFilterChange({ expiryFrom: expiryFrom || undefined, page: undefined })
          }
          placeholder={t('lots.earliest-expiry')}
          value={search.expiryFrom ?? ''}
        />
      </div>
      <div className="min-w-64 flex-1 @2xl/main:max-w-80">
        <DatePicker
          clearLabel={t('data-table.clear-filter', { label: t('lots.latest-expiry') })}
          earliest={search.expiryFrom}
          id="lots-latest-expiry"
          label={t('lots.latest-expiry')}
          onValueChange={(expiryTo) =>
            onFilterChange({ expiryTo: expiryTo || undefined, page: undefined })
          }
          placeholder={t('lots.latest-expiry')}
          value={search.expiryTo ?? ''}
        />
      </div>
      <div className="@2xl/main:ms-auto">
        <DataTableViewOptions
          columns={LOT_HIDEABLE_COLUMNS.map(({ id, labelKey }) => ({ id, label: t(labelKey) }))}
          onReset={columnView.onReset}
          onVisibilityChange={columnView.onVisibilityChange}
          visibility={columnView.visibility}
        />
      </div>
    </DataTableToolbar>
  );
}

type ProductFilterProps = {
  value: string | undefined;
  onValueChange: (value: string) => void;
};

function ProductFilter({ value, onValueChange }: ProductFilterProps) {
  const { t } = useTranslation();
  const [typed, setTyped] = useState('');
  const query = useDebouncedValue(typed.trim(), SEARCH_DELAY);
  const [opened, setOpened] = useState(false);

  const results = useQuery({
    ...orderablesSearchOptions(query),
    placeholderData: keepPreviousData,
    enabled: opened,
  });
  const picked = useQuery({
    ...orderablesByIdsOptions(value ? [value] : []),
    enabled: Boolean(value),
  });
  const searching = typed.trim() !== query || results.isFetching;

  const options = useMemo(() => {
    const found = (results.data?.content ?? []).map(toOption);
    if (!value) return found;
    const others = found.filter((option) => option.value !== value);
    const named = picked.data?.find((orderable) => orderable.id === value);
    if (named) return [toOption(named), ...others];
    return picked.isSuccess ? [{ value, label: t('lots.unknown-product') }, ...others] : others;
  }, [results.data, picked.data, picked.isSuccess, value, t]);
  const pickedLabel = options.find((option) => option.value === value)?.label;

  return (
    <DataTableComboboxFilter
      emptyMessage={
        searching
          ? t('lots.searching')
          : results.isError
            ? t(isOfflineError(results.error) ? 'offline.notice-title' : 'lots.search-error')
            : undefined
      }
      label={t('lots.product')}
      onOpenChange={(open) => {
        if (open) setOpened(true);
      }}
      // The pick's own name fills the input; reopening lists products afresh rather than searching it.
      onSearch={(text) => setTyped(text === pickedLabel ? '' : text)}
      onValueChange={onValueChange}
      options={options}
      value={value ?? ''}
    />
  );
}
