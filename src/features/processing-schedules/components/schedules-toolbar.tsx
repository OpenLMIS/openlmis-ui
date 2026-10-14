import { PlusIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { DataTableToolbar } from '@/components/data-table/data-table';
import { DataTableViewOptions } from '@/components/data-table/data-table-view-options';
import type { useColumnVisibility } from '@/components/data-table/responsive-columns';
import { Button } from '@/components/ui/button';
import { SCHEDULE_HIDEABLE_COLUMNS } from '@/features/processing-schedules/lib/search';

type SchedulesToolbarProps = {
  columnView: ReturnType<typeof useColumnVisibility>;
  onAdd: () => void;
};

export function SchedulesToolbar({ columnView, onAdd }: SchedulesToolbarProps) {
  const { t } = useTranslation();

  return (
    <DataTableToolbar>
      <div className="@2xl/main:ms-auto">
        <DataTableViewOptions
          columns={SCHEDULE_HIDEABLE_COLUMNS.map(({ id, labelKey }) => ({
            id,
            label: t(labelKey),
          }))}
          onReset={columnView.onReset}
          onVisibilityChange={columnView.onVisibilityChange}
          visibility={columnView.visibility}
        />
      </div>
      <div className="flex-1 @2xl/main:flex-none">
        <Button onClick={onAdd} width="full">
          <PlusIcon data-icon="inline-start" />
          {t('processing-schedules.add')}
        </Button>
      </div>
    </DataTableToolbar>
  );
}
