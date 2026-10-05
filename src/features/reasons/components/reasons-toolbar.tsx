import { PlusIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { DataTableToolbar } from '@/components/data-table/data-table';
import { DataTableSearch } from '@/components/data-table/data-table-search';
import { DataTableViewOptions } from '@/components/data-table/data-table-view-options';
import type { useColumnVisibility } from '@/components/data-table/responsive-columns';
import { Button } from '@/components/ui/button';
import { REASON_HIDEABLE_COLUMNS, type ReasonsSearch } from '@/features/reasons/lib/search';

type ReasonsToolbarProps = {
  search: ReasonsSearch;
  onFilterChange: (patch: Partial<ReasonsSearch>) => void;
  columnView: ReturnType<typeof useColumnVisibility>;
  onAdd: () => void;
};

export function ReasonsToolbar({ search, onFilterChange, columnView, onAdd }: ReasonsToolbarProps) {
  const { t } = useTranslation();

  return (
    <DataTableToolbar>
      <div className="w-full @2xl/main:w-72">
        <DataTableSearch
          label={t('reasons.search')}
          onValueChange={(q) => onFilterChange({ q: q || undefined, page: undefined })}
          value={search.q ?? ''}
        />
      </div>
      <div className="@2xl/main:ms-auto">
        <DataTableViewOptions
          columns={REASON_HIDEABLE_COLUMNS.map(({ id, labelKey }) => ({ id, label: t(labelKey) }))}
          onReset={columnView.onReset}
          onVisibilityChange={columnView.onVisibilityChange}
          visibility={columnView.visibility}
        />
      </div>
      <div className="w-full @2xl/main:w-auto">
        <Button onClick={onAdd} width="full">
          <PlusIcon data-icon="inline-start" />
          {t('reasons.add')}
        </Button>
      </div>
    </DataTableToolbar>
  );
}
