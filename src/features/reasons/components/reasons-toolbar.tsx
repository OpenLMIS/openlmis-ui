import { PlusIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { DataTableToolbar } from '@/components/data-table/data-table';
import { DataTableSearch } from '@/components/data-table/data-table-search';
import { DataTableViewOptions } from '@/components/data-table/data-table-view-options';
import type { useColumnVisibility } from '@/components/data-table/responsive-columns';
import { Button } from '@/components/ui/button';
import {
  DEFAULT_REASONS_SORT,
  REASON_HIDEABLE_COLUMNS,
  REASON_SORT_COLUMNS,
  type ReasonsSearch,
} from '@/features/reasons/lib/search';
import { searchSort } from '@/lib/table-search';

type ReasonsToolbarProps = {
  search: ReasonsSearch;
  onFilterChange: (patch: Partial<ReasonsSearch>) => void;
  onSortChange: (patch: Partial<ReasonsSearch>) => void;
  columnView: ReturnType<typeof useColumnVisibility>;
  layout: 'table' | 'cards';
  onAdd: () => void;
};

export function ReasonsToolbar({
  search,
  onFilterChange,
  onSortChange,
  columnView,
  layout,
  onAdd,
}: ReasonsToolbarProps) {
  const { t } = useTranslation();

  return (
    <DataTableToolbar>
      <div className="w-full @2xl/main:w-72">
        <DataTableSearch
          size="lg"
          label={t('reasons.search')}
          onValueChange={(q) => onFilterChange({ q: q || undefined, page: undefined })}
          value={search.q ?? ''}
        />
      </div>
      <div className="@2xl/main:ms-auto">
        <DataTableViewOptions
          size="lg"
          columns={REASON_HIDEABLE_COLUMNS.map(({ id, labelKey }) => ({ id, label: t(labelKey) }))}
          layout={layout}
          onReset={columnView.onReset}
          onVisibilityChange={columnView.onVisibilityChange}
          sort={{
            columns: REASON_SORT_COLUMNS.map(({ id, labelKey }) => ({ id, label: t(labelKey) })),
            ...searchSort(search, DEFAULT_REASONS_SORT, onSortChange),
          }}
          visibility={columnView.visibility}
        />
      </div>
      <div className="flex-1 @2xl/main:flex-none">
        <Button size="lg" onClick={onAdd} width="full">
          <PlusIcon data-icon="inline-start" />
          {t('reasons.add')}
        </Button>
      </div>
    </DataTableToolbar>
  );
}
