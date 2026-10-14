import { PlusIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { DataTableToolbar } from '@/components/data-table/data-table';
import { DataTableViewOptions } from '@/components/data-table/data-table-view-options';
import type { useColumnVisibility } from '@/components/data-table/responsive-columns';
import { Button } from '@/components/ui/button';
import { PERIOD_HIDEABLE_COLUMNS } from '@/features/processing-schedules/lib/search';

type PeriodsToolbarProps = {
  columnView: ReturnType<typeof useColumnVisibility>;
  onAdd: () => void;
  disabled?: boolean;
};

export function PeriodsToolbar({ columnView, onAdd, disabled }: PeriodsToolbarProps) {
  const { t } = useTranslation();

  return (
    <DataTableToolbar>
      <div className="@2xl/main:ms-auto">
        <DataTableViewOptions
          disabled={disabled}
          columns={PERIOD_HIDEABLE_COLUMNS.map(({ id, labelKey }) => ({
            id,
            label: t(labelKey),
          }))}
          onReset={columnView.onReset}
          onVisibilityChange={columnView.onVisibilityChange}
          visibility={columnView.visibility}
        />
      </div>
      <div className="flex-1 @2xl/main:flex-none">
        <Button disabled={disabled} onClick={onAdd} width="full">
          <PlusIcon data-icon="inline-start" />
          {t('processing-schedules.periods.add')}
        </Button>
      </div>
    </DataTableToolbar>
  );
}
