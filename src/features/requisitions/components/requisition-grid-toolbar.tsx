import { type ReactNode, useId } from 'react';
import { useTranslation } from 'react-i18next';
import { DataTableToolbar } from '@/components/data-table/data-table';
import { DataTableFilters } from '@/components/data-table/data-table-filters-popover';
import { DataTableSearch } from '@/components/data-table/data-table-search';
import { DataTableViewOptions } from '@/components/data-table/data-table-view-options';
import { QuantityUnitToggle } from '@/components/pickers/quantity-unit-toggle';
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
  hideSkipped,
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
  hideSkipped: boolean;
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
      <div className="w-full @2xl/main:w-72">
        <DataTableSearch
          disabled={disabled}
          size="lg"
          placeholder={t('requisitions.requisition.search-products')}
          value={search.product ?? ''}
          onValueChange={(product) =>
            onSearchChange({ product: product || undefined, detailPage: undefined }, true)
          }
        />
      </div>
      {showSkipFilter && (
        <div className="flex-1 @2xl/main:flex-none">
          <DataTableFilters
            size="lg"
            disabled={disabled}
            activeCount={search.skipped === undefined ? 0 : 1}
            onClear={() => onSearchChange({ skipped: undefined, detailPage: undefined }, true)}
          >
            <Field orientation="horizontal">
              <Checkbox
                disabled={disabled}
                id={id}
                checked={search.skipped ?? !hideSkipped}
                onCheckedChange={(checked) =>
                  onSearchChange({
                    skipped: checked === !hideSkipped ? undefined : checked,
                    detailPage: undefined,
                  })
                }
              />
              <FieldLabel htmlFor={id}>{t('requisitions.requisition.show-skipped')}</FieldLabel>
            </Field>
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
