import { PlusIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { DataTableToolbar } from '@/components/data-table/data-table';
import { DataTableViewOptions } from '@/components/data-table/data-table-view-options';
import type { useColumnVisibility } from '@/components/data-table/responsive-columns';
import { Button } from '@/components/ui/button';
import {
  DEFAULT_PROGRAMS_SORT,
  PROGRAM_HIDEABLE_COLUMNS,
  PROGRAM_SORT_COLUMNS,
  type ProgramsSearch,
} from '@/features/programs/lib/search';
import { searchSort } from '@/lib/table-search';

type ProgramsToolbarProps = {
  search: ProgramsSearch;
  onSortChange: (patch: Partial<ProgramsSearch>) => void;
  columnView: ReturnType<typeof useColumnVisibility>;
  layout: 'table' | 'cards';
  onAdd: () => void;
};

export function ProgramsToolbar({
  search,
  onSortChange,
  columnView,
  layout,
  onAdd,
}: ProgramsToolbarProps) {
  const { t } = useTranslation();

  return (
    <DataTableToolbar>
      <div className="@2xl/main:ms-auto">
        <DataTableViewOptions
          size="lg"
          columns={PROGRAM_HIDEABLE_COLUMNS.map(({ id, labelKey }) => ({
            id,
            label: t(labelKey),
          }))}
          layout={layout}
          onReset={columnView.onReset}
          onVisibilityChange={columnView.onVisibilityChange}
          sort={{
            columns: PROGRAM_SORT_COLUMNS.map(({ id, labelKey }) => ({ id, label: t(labelKey) })),
            ...searchSort(search, DEFAULT_PROGRAMS_SORT, onSortChange),
          }}
          visibility={columnView.visibility}
        />
      </div>
      <div className="flex-1 @2xl/main:flex-none">
        <Button size="lg" onClick={onAdd} width="full">
          <PlusIcon data-icon="inline-start" />
          {t('programs.add')}
        </Button>
      </div>
    </DataTableToolbar>
  );
}
