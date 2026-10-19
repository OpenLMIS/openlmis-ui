import { PlusIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { DataTableToolbar } from '@/components/data-table/data-table';
import { DataTableSelectFilter } from '@/components/data-table/data-table-filters';
import { DataTableFilters } from '@/components/data-table/data-table-filters-popover';
import { DataTableSearch } from '@/components/data-table/data-table-search';
import { DataTableViewOptions } from '@/components/data-table/data-table-view-options';
import type { useColumnVisibility } from '@/components/data-table/responsive-columns';
import { Button } from '@/components/ui/button';
import { ROLE_TYPES } from '@/features/reference-data/lib/roles';
import {
  DEFAULT_ROLES_SORT,
  ROLE_HIDEABLE_COLUMNS,
  ROLE_SORT_COLUMNS,
  type RolesSearch,
} from '@/features/roles/lib/search';
import { searchSort } from '@/lib/table-search';

type RolesToolbarProps = {
  search: RolesSearch;
  onFilterChange: (patch: Partial<RolesSearch>) => void;
  onSortChange: (patch: Partial<RolesSearch>) => void;
  columnView: ReturnType<typeof useColumnVisibility>;
  layout: 'table' | 'cards';
  onCreate?: () => void;
};

export function RolesToolbar({
  search,
  onFilterChange,
  onSortChange,
  columnView,
  layout,
  onCreate,
}: RolesToolbarProps) {
  const { t } = useTranslation();

  return (
    <DataTableToolbar>
      <div className="w-full @2xl/main:w-72">
        <DataTableSearch
          label={t('roles.search')}
          onValueChange={(q) => onFilterChange({ q: q || undefined, page: undefined })}
          value={search.q ?? ''}
        />
      </div>
      <div className="flex-1 @2xl/main:flex-none">
        <DataTableFilters
          activeCount={search.type ? 1 : 0}
          onClear={() => onFilterChange({ type: undefined, page: undefined })}
        >
          <DataTableSelectFilter
            label={t('roles.type')}
            onValueChange={(value) =>
              onFilterChange({ type: (value || undefined) as RolesSearch['type'], page: undefined })
            }
            options={ROLE_TYPES.map((item) => ({ value: item.type, label: t(item.labelKey) }))}
            value={search.type ?? ''}
          />
        </DataTableFilters>
      </div>
      <div className="@2xl/main:ms-auto">
        <DataTableViewOptions
          columns={ROLE_HIDEABLE_COLUMNS.map(({ id, labelKey }) => ({ id, label: t(labelKey) }))}
          layout={layout}
          onReset={columnView.onReset}
          onVisibilityChange={columnView.onVisibilityChange}
          sort={{
            columns: ROLE_SORT_COLUMNS.map(({ id, labelKey }) => ({ id, label: t(labelKey) })),
            ...searchSort(search, DEFAULT_ROLES_SORT, onSortChange),
          }}
          visibility={columnView.visibility}
        />
      </div>
      {onCreate && (
        <div className="w-full @2xl/main:w-auto">
          <Button onClick={onCreate} width="full">
            <PlusIcon data-icon="inline-start" />
            {t('roles.create')}
          </Button>
        </div>
      )}
    </DataTableToolbar>
  );
}
