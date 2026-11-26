import { PlusIcon } from 'lucide-react';
import type { RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { DataTableAddToolbar } from '@/components/data-table/data-table-add-toolbar';
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
  return (
    <DataTableAddToolbar
      disabled={disabled}
      layout={layout}
      sort={{
        columns: [{ id: 'name', label: t('report-categories.name') }],
        ...searchSort(search, DEFAULT_REPORT_CATEGORIES_SORT, onSortChange),
      }}
    >
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
    </DataTableAddToolbar>
  );
}
