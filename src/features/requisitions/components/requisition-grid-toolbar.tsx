import { type ReactNode, useId } from 'react';
import { useTranslation } from 'react-i18next';
import { DataTableToolbar } from '@/components/data-table/data-table';
import { DataTableFilters } from '@/components/data-table/data-table-filters-popover';
import { DataTableSearch } from '@/components/data-table/data-table-search';
import { DataTableViewOptions } from '@/components/data-table/data-table-view-options';
import { QuantityUnitToggle } from '@/components/display/quantity-unit-toggle';
import { Checkbox } from '@/components/ui/checkbox';
import { Field, FieldLabel } from '@/components/ui/field';
import type { GridSearch } from '@/features/requisitions/components/requisition-grid';
import type { GridColumn } from '@/features/requisitions/lib/template';
import type { useCardView } from '@/hooks/use-card-view';
import type { QuantityUnit } from '@/lib/quantity';
import type { SearchChange } from '@/lib/table-search';

export function RequisitionGridToolbar({
  columns,
  extra,
  action,
  status,
  view,
  search,
  onSearchChange,
  showSearch,
  showSkipFilter,
  unit,
  setUnit,
  canSwitch,
  disabled,
}: {
  columns: GridColumn[];
  extra?: ReactNode;
  action?: ReactNode;
  status?: ReactNode;
  view: Pick<ReturnType<typeof useCardView>, 'layout' | 'columnView'>;
  search: GridSearch;
  onSearchChange: SearchChange<GridSearch>;
  showSearch: boolean;
  showSkipFilter: boolean;
  unit: QuantityUnit;
  setUnit: (unit: QuantityUnit) => void;
  canSwitch: boolean;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const id = useId();
  return (
    <DataTableToolbar>
      {showSkipFilter && (
        <div className="flex h-9 w-full items-center rounded-lg border border-border bg-background px-3 dark:border-input dark:bg-input/30 @2xl/main:w-auto">
          <Field orientation="horizontal" data-disabled={disabled}>
            <Checkbox
              disabled={disabled}
              id={id}
              checked={search.skipped !== false}
              onCheckedChange={(checked) =>
                onSearchChange({
                  skipped: checked ? undefined : false,
                  detailPage: undefined,
                })
              }
            />
            <FieldLabel htmlFor={id}>{t('requisitions.requisition.show-skipped')}</FieldLabel>
          </Field>
        </div>
      )}
      {showSearch && (
        <div className="flex-1 @2xl/main:flex-none">
          <DataTableFilters
            size="lg"
            disabled={disabled}
            activeCount={search.product ? 1 : 0}
            onClear={() => onSearchChange({ product: undefined, detailPage: undefined }, true)}
          >
            <DataTableSearch
              disabled={disabled}
              placeholder={t('requisitions.requisition.search-products')}
              value={search.product ?? ''}
              onValueChange={(product) =>
                onSearchChange({ product: product || undefined, detailPage: undefined }, true)
              }
            />
          </DataTableFilters>
        </div>
      )}
      {extra}
      <div className="flex w-full flex-wrap items-center gap-2 @2xl/main:ms-auto @2xl/main:w-auto">
        {status && <div className="flex w-full @2xl/main:w-auto">{status}</div>}
        {canSwitch && (
          <div className="flex-1 @2xl/main:flex-none">
            <QuantityUnitToggle disabled={disabled} unit={unit} onUnitChange={setUnit} />
          </div>
        )}
        <div className={canSwitch ? 'shrink-0' : 'flex-1 @2xl/main:flex-none'}>
          <DataTableViewOptions
            disabled={disabled}
            size="lg"
            layout={view.layout}
            columns={columns.filter((c) => !c.sticky).map((c) => ({ id: c.name, label: c.label }))}
            {...view.columnView}
          />
        </div>
        {action}
      </div>
    </DataTableToolbar>
  );
}
