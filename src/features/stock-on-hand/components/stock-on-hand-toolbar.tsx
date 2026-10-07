import { FilterIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { DataTableToolbar } from '@/components/data-table/data-table';
import { DataTableSearch } from '@/components/data-table/data-table-search';
import { QuantityUnitToggle } from '@/components/quantity-unit-toggle';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  CLEARED_STOCK_FILTERS,
  type StockOnHandSearch,
  showsInactive,
} from '@/features/stock-on-hand/lib/search';
import type { QuantityUnit } from '@/lib/quantity';

type StockOnHandToolbarProps = {
  search: StockOnHandSearch;
  onFilterChange: (patch: Partial<StockOnHandSearch>) => void;
  unit: QuantityUnit;
  onUnitChange: ((unit: QuantityUnit) => void) | undefined;
  print: ReactNode;
  view?: ReactNode;
  disabled?: boolean;
};

const activeFilters = (search: StockOnHandSearch) =>
  [search.productCode, search.productName, search.lotCode, !showsInactive(search)].filter(Boolean)
    .length;

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
  const count = activeFilters(search);
  const text = (key: 'productCode' | 'productName' | 'lotCode', placeholder: string) => (
    <DataTableSearch
      label={placeholder}
      onValueChange={(value) => onFilterChange({ [key]: value || undefined, page: undefined })}
      placeholder={placeholder}
      value={search[key] ?? ''}
    />
  );

  return (
    <DataTableToolbar>
      <Popover>
        <PopoverTrigger render={<Button disabled={disabled} type="button" variant="outline" />}>
          <FilterIcon data-icon="inline-start" />
          {t('stock-on-hand.filter')}
          {count > 0 && <Badge variant="secondary">{count}</Badge>}
        </PopoverTrigger>
        <PopoverContent align="start">
          <div className="flex flex-col gap-3">
            {text('productCode', t('stock-on-hand.search-product-code'))}
            {text('productName', t('stock-on-hand.search-product-name'))}
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
            {count > 0 && (
              <Button
                onClick={() => onFilterChange(CLEARED_STOCK_FILTERS)}
                type="button"
                variant="outline"
              >
                {t('stock-on-hand.clear-filters')}
              </Button>
            )}
          </div>
        </PopoverContent>
      </Popover>
      <div className="flex flex-wrap items-center gap-2 @2xl/main:ms-auto">
        {onUnitChange && (
          <QuantityUnitToggle disabled={disabled} onUnitChange={onUnitChange} unit={unit} />
        )}
        {view}
        {print}
      </div>
    </DataTableToolbar>
  );
}
