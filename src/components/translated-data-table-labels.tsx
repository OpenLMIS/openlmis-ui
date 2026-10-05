import { type ReactNode, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  type DataTableLabels,
  DataTableLabelsProvider,
} from '@/components/data-table/data-table-labels';

export function TranslatedDataTableLabels({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const labels = useMemo(
    (): Partial<DataTableLabels> => ({
      search: t('data-table.search'),
      clearSearch: t('data-table.clear-search'),
      clearFilter: (label) => t('data-table.clear-filter', { label }),
      noMatches: t('data-table.no-matches'),
      view: t('data-table.view'),
      toggleColumns: t('data-table.toggle-columns'),
      resetColumns: t('data-table.reset-columns'),
      rowsPerPage: t('data-table.rows-per-page'),
      range: (from, to, total) => t('data-table.range', { from, to, total }),
      firstPage: t('data-table.first-page'),
      previousPage: t('data-table.previous-page'),
      nextPage: t('data-table.next-page'),
      lastPage: t('data-table.last-page'),
      retry: t('data-table.retry'),
      selectPage: t('data-table.select-page'),
      selectRow: (row) => t('data-table.select-row', { row }),
      selectedCount: (count) => t('data-table.selected-count', { count }),
      clearSelection: t('data-table.clear-selection'),
    }),
    [t],
  );

  return <DataTableLabelsProvider labels={labels}>{children}</DataTableLabelsProvider>;
}
