import { type ReactNode, useId } from 'react';
import { useTranslation } from 'react-i18next';
import { DataTableToolbar } from '@/components/data-table/data-table';
import { DataTableSearch } from '@/components/data-table/data-table-search';
import { DataTableViewOptions } from '@/components/data-table/data-table-view-options';
import { QuantityUnitToggle } from '@/components/quantity-unit-toggle';
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
  status,
  view,
  search,
  onSearchChange,
  hideSkipped,
  unit,
  setUnit,
  canSwitch,
  disabled,
}: {
  columns: GridColumn[];
  extra?: ReactNode;
  status?: ReactNode;
  view: Pick<ReturnType<typeof useCardView>, 'layout' | 'columnView'>;
  search: GridSearch;
  onSearchChange: SearchChange<GridSearch>;
  hideSkipped: boolean;
  unit: QuantityUnit;
  setUnit: (unit: QuantityUnit) => void;
  canSwitch: boolean;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const id = useId();
  return (
    <DataTableToolbar>
      {extra}
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
      {hideSkipped && (
        <div className="flex h-9 items-center">
          <Field orientation="horizontal">
            <Checkbox
              disabled={disabled}
              id={id}
              checked={!!search.skipped}
              onCheckedChange={(checked) =>
                onSearchChange({ skipped: checked || undefined, detailPage: undefined })
              }
            />
            <FieldLabel htmlFor={id}>{t('requisitions.requisition.show-skipped')}</FieldLabel>
          </Field>
        </div>
      )}
      <div className="flex w-full flex-wrap items-center gap-2 @2xl/main:ms-auto @2xl/main:w-auto">
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
      </div>
      {status}
    </DataTableToolbar>
  );
}
