import { PlusIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { DataTableToolbar } from '@/components/data-table/data-table';
import { DataTableViewOptions } from '@/components/data-table/data-table-view-options';
import { Button } from '@/components/ui/button';
import {
  DEFAULT_SCHEDULES_SORT,
  SCHEDULE_SORT_COLUMNS,
  type SchedulesSearch,
} from '@/features/processing-schedules/lib/search';
import { searchSort } from '@/lib/table-search';

type SchedulesToolbarProps = {
  search: SchedulesSearch;
  onSortChange: (patch: Partial<SchedulesSearch>) => void;
  layout: 'table' | 'cards';
  onAdd: () => void;
};

const NO_COLUMNS: [] = [];
const NO_VISIBILITY = {};
const noop = () => {};

export function SchedulesToolbar({ search, onSortChange, layout, onAdd }: SchedulesToolbarProps) {
  const { t } = useTranslation();

  return (
    <DataTableToolbar>
      {layout === 'cards' && (
        <DataTableViewOptions
          columns={NO_COLUMNS}
          layout={layout}
          onVisibilityChange={noop}
          sort={{
            columns: SCHEDULE_SORT_COLUMNS.map(({ id, labelKey }) => ({ id, label: t(labelKey) })),
            ...searchSort(search, DEFAULT_SCHEDULES_SORT, onSortChange),
          }}
          visibility={NO_VISIBILITY}
        />
      )}
      <div className="flex-1 @2xl/main:ms-auto @2xl/main:w-auto @2xl/main:flex-none">
        <Button onClick={onAdd} width="full">
          <PlusIcon data-icon="inline-start" />
          {t('processing-schedules.add')}
        </Button>
      </div>
    </DataTableToolbar>
  );
}
