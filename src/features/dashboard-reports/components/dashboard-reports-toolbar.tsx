import { PlusIcon } from 'lucide-react';
import type { RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { DataTableAddToolbar } from '@/components/data-table/data-table-add-toolbar';
import { Button } from '@/components/ui/button';
import {
  type DashboardReportsSearch,
  DEFAULT_DASHBOARD_REPORTS_SORT,
} from '@/features/dashboard-reports/lib/search';
import { searchSort } from '@/lib/table-search';

type DashboardReportsToolbarProps = {
  search: DashboardReportsSearch;
  onSortChange: (patch: Partial<DashboardReportsSearch>) => void;
  layout: 'table' | 'cards';
  onAdd: (opener: HTMLButtonElement) => void;
  addRef?: RefObject<HTMLButtonElement | null>;
  disabled?: boolean;
};

export function DashboardReportsToolbar({
  search,
  onSortChange,
  layout,
  onAdd,
  addRef,
  disabled = false,
}: DashboardReportsToolbarProps) {
  const { t } = useTranslation();
  return (
    <DataTableAddToolbar
      disabled={disabled}
      layout={layout}
      sort={{
        columns: [
          { id: 'name', label: t('dashboard-reports.name') },
          { id: 'category', label: t('dashboard-reports.category') },
        ],
        ...searchSort(search, DEFAULT_DASHBOARD_REPORTS_SORT, onSortChange),
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
        {t('dashboard-reports.add')}
      </Button>
    </DataTableAddToolbar>
  );
}
