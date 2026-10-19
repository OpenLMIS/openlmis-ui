import { PlusIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { DataTableToolbar } from '@/components/data-table/data-table';
import { DataTableViewOptions } from '@/components/data-table/data-table-view-options';
import type { useColumnVisibility } from '@/components/data-table/responsive-columns';
import { Button } from '@/components/ui/button';
import {
  DEFAULT_FACILITY_TYPES_SORT,
  FACILITY_TYPE_HIDEABLE_COLUMNS,
  FACILITY_TYPE_SORT_COLUMNS,
  type FacilityTypesSearch,
} from '@/features/facility-types/lib/search';
import { searchSort } from '@/lib/table-search';

type FacilityTypesToolbarProps = {
  search: FacilityTypesSearch;
  onSortChange: (patch: Partial<FacilityTypesSearch>) => void;
  columnView: ReturnType<typeof useColumnVisibility>;
  layout: 'table' | 'cards';
  onAdd: () => void;
};

export function FacilityTypesToolbar({
  search,
  onSortChange,
  columnView,
  layout,
  onAdd,
}: FacilityTypesToolbarProps) {
  const { t } = useTranslation();

  return (
    <DataTableToolbar>
      <div className="@2xl/main:ms-auto">
        <DataTableViewOptions
          columns={FACILITY_TYPE_HIDEABLE_COLUMNS.map(({ id, labelKey }) => ({
            id,
            label: t(labelKey),
          }))}
          layout={layout}
          onReset={columnView.onReset}
          onVisibilityChange={columnView.onVisibilityChange}
          sort={{
            columns: FACILITY_TYPE_SORT_COLUMNS.map(({ id, labelKey }) => ({
              id,
              label: t(labelKey),
            })),
            ...searchSort(search, DEFAULT_FACILITY_TYPES_SORT, onSortChange),
          }}
          visibility={columnView.visibility}
        />
      </div>
      <div className="flex-1 @2xl/main:flex-none">
        <Button onClick={onAdd} width="full">
          <PlusIcon data-icon="inline-start" />
          {t('facility-types.add')}
        </Button>
      </div>
    </DataTableToolbar>
  );
}
