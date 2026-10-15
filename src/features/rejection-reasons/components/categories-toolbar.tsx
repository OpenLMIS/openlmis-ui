import { PlusIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { DataTableToolbar } from '@/components/data-table/data-table';
import { DataTableSearch } from '@/components/data-table/data-table-search';
import { DataTableViewOptions } from '@/components/data-table/data-table-view-options';
import type { useColumnVisibility } from '@/components/data-table/responsive-columns';
import { Button } from '@/components/ui/button';
import {
  CATEGORY_HIDEABLE_COLUMNS,
  type CategoriesListSearch,
} from '@/features/rejection-reasons/lib/search';
import type { SearchChange } from '@/lib/table-search';

type CategoriesToolbarProps = {
  search: CategoriesListSearch;
  onSearchChange: SearchChange<CategoriesListSearch>;
  columnView: ReturnType<typeof useColumnVisibility>;
  onAdd: () => void;
};

export function CategoriesToolbar({
  search,
  onSearchChange,
  columnView,
  onAdd,
}: CategoriesToolbarProps) {
  const { t } = useTranslation();
  return (
    <DataTableToolbar>
      <div className="w-full @2xl/main:w-72">
        <DataTableSearch
          label={t('rejection-reason-categories.search')}
          value={search.name ?? ''}
          onValueChange={(name) =>
            onSearchChange({ name: name || undefined, page: undefined }, true)
          }
        />
      </div>
      <div className="@2xl/main:ms-auto">
        <DataTableViewOptions
          columns={CATEGORY_HIDEABLE_COLUMNS.map(({ id, labelKey }) => ({
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
          {t('rejection-reason-categories.add')}
        </Button>
      </div>
    </DataTableToolbar>
  );
}
