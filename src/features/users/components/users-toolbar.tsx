import { useTranslation } from 'react-i18next';
import { DataTableToolbar } from '@/components/data-table/data-table';
import { DataTableSelectFilter } from '@/components/data-table/data-table-filters';
import { DataTableSearch } from '@/components/data-table/data-table-search';
import { DataTableViewOptions } from '@/components/data-table/data-table-view-options';
import type { useColumnVisibility } from '@/components/data-table/responsive-columns';
import { USER_HIDEABLE_COLUMNS, type UsersSearch } from '@/features/users/lib/search';

type UsersToolbarProps = {
  search: UsersSearch;
  onFilterChange: (patch: Partial<UsersSearch>) => void;
  columnView: ReturnType<typeof useColumnVisibility>;
};

export function UsersToolbar({ search, onFilterChange, columnView }: UsersToolbarProps) {
  const { t } = useTranslation();

  return (
    <DataTableToolbar>
      <DataTableSearch
        label={t('users.search')}
        onValueChange={(q) => onFilterChange({ q: q || undefined, page: undefined })}
        value={search.q ?? ''}
      />
      {/* On phones the two share the row under the search box; from sm, View sits at the far end. */}
      <div className="flex flex-1 gap-2">
        <div className="flex-1 sm:w-40 sm:flex-none">
          <DataTableSelectFilter
            label={t('users.status')}
            onValueChange={(value) =>
              onFilterChange({
                status: (value || undefined) as UsersSearch['status'],
                page: undefined,
              })
            }
            options={[
              { value: 'active', label: t('users.active') },
              { value: 'inactive', label: t('users.inactive') },
            ]}
            value={search.status ?? ''}
          />
        </div>
        <div className="flex-1 sm:ms-auto sm:flex-none">
          <DataTableViewOptions
            columns={USER_HIDEABLE_COLUMNS.map(({ id, labelKey }) => ({ id, label: t(labelKey) }))}
            onReset={columnView.onReset}
            onVisibilityChange={columnView.onVisibilityChange}
            visibility={columnView.visibility}
          />
        </div>
      </div>
    </DataTableToolbar>
  );
}
