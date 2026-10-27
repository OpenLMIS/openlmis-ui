import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { DataTableToolbar } from '@/components/data-table/data-table';
import { DataTableFilters } from '@/components/data-table/data-table-filters-popover';
import { DataTableSearch } from '@/components/data-table/data-table-search';
import { DataTableViewOptions } from '@/components/data-table/data-table-view-options';
import { QuantityUnitToggle } from '@/components/quantity-unit-toggle';
import { Badge } from '@/components/ui/badge';
import { Field, FieldLabel } from '@/components/ui/field';
import { Switch } from '@/components/ui/switch';
import type { GridSearch } from '@/features/requisitions/components/requisition-grid';
import type { GridColumn } from '@/features/requisitions/lib/template';
import type { useCardView } from '@/hooks/use-card-view';
import type { QuantityUnit } from '@/lib/quantity';
import type { SearchChange } from '@/lib/table-search';

export function RequisitionGridToolbar({
  columns,
  view,
  search,
  onSearchChange,
  hideSkipped,
  skippedCount,
  unit,
  setUnit,
  canSwitch,
}: {
  columns: GridColumn[];
  view: Pick<ReturnType<typeof useCardView>, 'layout' | 'columnView'>;
  search: GridSearch;
  onSearchChange: SearchChange<GridSearch>;
  hideSkipped: boolean;
  skippedCount: number;
  unit: QuantityUnit;
  setUnit: (unit: QuantityUnit) => void;
  canSwitch: boolean;
}) {
  const { t } = useTranslation();
  const id = useId();
  return (
    <DataTableToolbar>
      <div className="w-full @2xl/main:w-72">
        <DataTableSearch
          size="lg"
          placeholder={t('requisitions.requisition.search-products')}
          value={search.product ?? ''}
          onValueChange={(product) =>
            onSearchChange({ product: product || undefined, detailPage: undefined }, true)
          }
        />
      </div>
      {hideSkipped && (
        <div className="flex-1 @2xl/main:me-auto @2xl/main:flex-none">
          <DataTableFilters
            size="lg"
            activeCount={search.skipped ? 1 : 0}
            onClear={() => onSearchChange({ skipped: undefined, detailPage: undefined })}
          >
            <Field orientation="horizontal">
              <Switch
                id={id}
                checked={!!search.skipped}
                onCheckedChange={(checked) =>
                  onSearchChange({ skipped: checked || undefined, detailPage: undefined })
                }
              />
              <FieldLabel htmlFor={id}>
                {t('requisitions.requisition.show-skipped')}
                <Badge variant="secondary">{skippedCount.toLocaleString()}</Badge>
              </FieldLabel>
            </Field>
          </DataTableFilters>
        </div>
      )}
      {canSwitch && <QuantityUnitToggle unit={unit} onUnitChange={setUnit} />}
      <div className={hideSkipped ? 'shrink-0' : 'ms-auto shrink-0'}>
        <DataTableViewOptions
          size="lg"
          layout={view.layout}
          columns={columns.filter((c) => !c.sticky).map((c) => ({ id: c.name, label: c.label }))}
          {...view.columnView}
        />
      </div>
    </DataTableToolbar>
  );
}
