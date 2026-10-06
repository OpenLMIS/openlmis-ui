import type { ReactNode } from 'react';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { DataTableToolbar } from '@/components/data-table/data-table';
import { DataTableSearch } from '@/components/data-table/data-table-search';
import { QuantityUnitToggle } from '@/components/quantity-unit-toggle';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { type StockOnHandSearch, showsInactive } from '@/features/stock-on-hand/lib/search';
import type { QuantityUnit } from '@/lib/quantity';

type StockOnHandToolbarProps = {
  search: StockOnHandSearch;
  onFilterChange: (patch: Partial<StockOnHandSearch>) => void;
  unit: QuantityUnit;
  onUnitChange: ((unit: QuantityUnit) => void) | undefined;
  /** Ends the toolbar, as a list's main action does. */
  print: ReactNode;
};

export function StockOnHandToolbar({
  search,
  onFilterChange,
  unit,
  onUnitChange,
  print,
}: StockOnHandToolbarProps) {
  const { t } = useTranslation();
  const inactiveId = useId();
  const text = (key: 'productCode' | 'productName' | 'lotCode', placeholder: string) => (
    <div className="w-full @2xl/main:w-56">
      <DataTableSearch
        label={placeholder}
        onValueChange={(value) => onFilterChange({ [key]: value || undefined, page: undefined })}
        placeholder={placeholder}
        value={search[key] ?? ''}
      />
    </div>
  );

  return (
    <DataTableToolbar>
      {text('productCode', t('stock-on-hand.search-product-code'))}
      {text('productName', t('stock-on-hand.search-product-name'))}
      {text('lotCode', t('stock-on-hand.search-lot-code'))}
      <div className="flex h-9 items-center">
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
      </div>
      <div className="flex flex-wrap items-center gap-2 @2xl/main:ms-auto">
        {onUnitChange && <QuantityUnitToggle onUnitChange={onUnitChange} unit={unit} />}
        {print}
      </div>
    </DataTableToolbar>
  );
}
