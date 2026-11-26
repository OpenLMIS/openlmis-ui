import { PlusIcon } from 'lucide-react';
import type { RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { DataTableToolbar } from '@/components/data-table/data-table';
import { DataTableViewOptions } from '@/components/data-table/data-table-view-options';
import { Button } from '@/components/ui/button';
import {
  DEFAULT_REPORT_CATEGORIES_SORT,
  type ReportCategoriesSearch,
} from '@/features/report-categories/lib/search';
import { searchSort } from '@/lib/table-search';

type ReportCategoriesToolbarProps = {
  search: ReportCategoriesSearch;
  onSortChange: (patch: Partial<ReportCategoriesSearch>) => void;
  layout: 'table' | 'cards';
  onAdd: (opener: HTMLButtonElement) => void;
  addRef?: RefObject<HTMLButtonElement | null>;
  disabled?: boolean;
};

export function ReportCategoriesToolbar({
  search,
  onSortChange,
  layout,
  onAdd,
  addRef,
  disabled = false,
}: ReportCategoriesToolbarProps) {
  const { t } = useTranslation();
  const add = (
    <Button
      disabled={disabled}
      onClick={(event) => onAdd(event.currentTarget)}
      ref={addRef}
      size="lg"
      width="full"
    >
      <PlusIcon data-icon="inline-start" />
      {t('report-categories.add')}
    </Button>
  );

  if (layout === 'table') {
    return (
      <DataTableToolbar>
        <div className="w-full @2xl/main:ms-auto @2xl/main:w-auto">{add}</div>
      </DataTableToolbar>
    );
  }
  return (
    <DataTableToolbar>
      <DataTableViewOptions
        size="lg"
        disabled={disabled}
        layout={layout}
        sort={{
          columns: [{ id: 'name', label: t('report-categories.name') }],
          ...searchSort(search, DEFAULT_REPORT_CATEGORIES_SORT, onSortChange),
        }}
      />
      <div className="flex-1">{add}</div>
    </DataTableToolbar>
  );
}
