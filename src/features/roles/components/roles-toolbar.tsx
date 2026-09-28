import { PlusIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { DataTableToolbar } from '@/components/data-table/data-table';
import { DataTableSelectFilter } from '@/components/data-table/data-table-filters';
import { DataTableSearch } from '@/components/data-table/data-table-search';
import { DataTableViewOptions } from '@/components/data-table/data-table-view-options';
import type { useColumnVisibility } from '@/components/data-table/responsive-columns';
import { Button } from '@/components/ui/button';
import { ROLE_TYPES } from '@/features/reference-data/lib/roles';
import { ROLE_HIDEABLE_COLUMNS, type RolesSearch } from '@/features/roles/lib/search';

type RolesToolbarProps = {
  search: RolesSearch;
  onFilterChange: (patch: Partial<RolesSearch>) => void;
  columnView: ReturnType<typeof useColumnVisibility>;
  /** Left out for a user who may not create roles. */
  onCreate?: () => void;
};

export function RolesToolbar({ search, onFilterChange, columnView, onCreate }: RolesToolbarProps) {
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
      <div className="flex-1 @2xl/main:w-64 @2xl/main:flex-none">
        <DataTableSelectFilter
          label={t('roles.type')}
          onValueChange={(value) =>
            onFilterChange({ type: (value || undefined) as RolesSearch['type'], page: undefined })
          }
          options={ROLE_TYPES.map((item) => ({ value: item.type, label: t(item.labelKey) }))}
          value={search.type ?? ''}
        />
      </div>
      <div className="@2xl/main:ms-auto">
        <DataTableViewOptions
          columns={ROLE_HIDEABLE_COLUMNS.map(({ id, labelKey }) => ({ id, label: t(labelKey) }))}
          onReset={columnView.onReset}
          onVisibilityChange={columnView.onVisibilityChange}
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
