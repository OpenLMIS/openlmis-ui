import { PlusIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { DataTableToolbar } from '@/components/data-table/data-table';
import { DataTableSelectFilter } from '@/components/data-table/data-table-filters';
import { DataTableSearch } from '@/components/data-table/data-table-search';
import { DataTableViewOptions } from '@/components/data-table/data-table-view-options';
import type { useColumnVisibility } from '@/components/data-table/responsive-columns';
import { Button } from '@/components/ui/button';
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
      {/* Search above the rest while the page is narrow, one row once there is room; sized by the page. */}
      <div className="w-full @2xl/main:w-72">
        <DataTableSearch
          label={t('users.search')}
          onValueChange={(q) => onFilterChange({ q: q || undefined, page: undefined })}
          value={search.q ?? ''}
        />
      </div>
      <div className="flex-1 @2xl/main:w-40 @2xl/main:flex-none">
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
      <div className="@2xl/main:ms-auto">
        <DataTableViewOptions
          columns={USER_HIDEABLE_COLUMNS.map(({ id, labelKey }) => ({ id, label: t(labelKey) }))}
          onReset={columnView.onReset}
          onVisibilityChange={columnView.onVisibilityChange}
          visibility={columnView.visibility}
        />
      </div>
      {/* TODO: Open the create user screen once it exists. */}
      <Button>
        <PlusIcon data-icon="inline-start" />
        {t('users.add')}
      </Button>
    </DataTableToolbar>
  );
}
