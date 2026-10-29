import type { ReactNode } from 'react';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { DataTableToolbar } from '@/components/data-table/data-table';
import { DataTableFilters } from '@/components/data-table/data-table-filters-popover';
import { DataTableSearch } from '@/components/data-table/data-table-search';
import { QuantityUnitToggle } from '@/components/display/quantity-unit-toggle';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { type StockOnHandSearch, showsInactive } from '@/features/stock-on-hand/lib/search';
import type { QuantityUnit } from '@/lib/quantity';

type StockOnHandToolbarProps = {
  search: StockOnHandSearch;
  onFilterChange: (patch: Partial<StockOnHandSearch>) => void;
  unit: QuantityUnit;
  onUnitChange: ((unit: QuantityUnit) => void) | undefined;
  print?: ReactNode;
  view?: ReactNode;
  disabled?: boolean;
};

const activeFilters = (search: StockOnHandSearch) =>
  [search.productCode, search.lotCode, !showsInactive(search)].filter(Boolean).length;

export function StockOnHandToolbar({
  search,
  onFilterChange,
  unit,
  onUnitChange,
  print,
  view,
  disabled = false,
}: StockOnHandToolbarProps) {
  const { t } = useTranslation();
  const inactiveId = useId();
  const text = (
    key: 'productCode' | 'productName' | 'lotCode',
    placeholder: string,
    size?: 'lg',
  ) => (
    <DataTableSearch
      size={size}
      label={placeholder}
      onValueChange={(value) => onFilterChange({ [key]: value || undefined, page: undefined })}
      placeholder={placeholder}
      value={search[key] ?? ''}
    />
  );

  return (
    <DataTableToolbar>
      <div className="w-full @2xl/main:w-72">
        {text('productName', t('stock-on-hand.search-product-name'), 'lg')}
      </div>
      <div className="flex-1 @2xl/main:me-auto @2xl/main:flex-none">
        <DataTableFilters
          size="lg"
          activeCount={activeFilters(search)}
          disabled={disabled}
          onClear={() =>
            onFilterChange({
              productCode: undefined,
              lotCode: undefined,
              includeInactive: undefined,
              page: undefined,
            })
          }
        >
          {text('productCode', t('stock-on-hand.search-product-code'))}
          {text('lotCode', t('stock-on-hand.search-lot-code'))}
          <Label htmlFor={inactiveId}>
            <Checkbox
              checked={showsInactive(search)}
              id={inactiveId}
              onCheckedChange={(checked) =>
                onFilterChange({ includeInactive: checked ? undefined : false })
              }
            />
            {t('stock-on-hand.include-inactive')}
          </Label>
        </DataTableFilters>
      </div>
      {onUnitChange && (
        <div>
          <QuantityUnitToggle disabled={disabled} onUnitChange={onUnitChange} unit={unit} />
        </div>
      )}
      {(view || print) && (
        <div className="flex w-full items-center gap-2 @2xl/main:w-auto">
          <div className="shrink-0">{view}</div>
          {print && <div className="min-w-0 flex-1 @2xl/main:flex-none">{print}</div>}
        </div>
      )}
    </DataTableToolbar>
  );
}
