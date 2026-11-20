import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { DataTableToolbar } from '@/components/data-table/data-table';
import { DataTableSelectFilter } from '@/components/data-table/data-table-filters';
import { DataTableFilters } from '@/components/data-table/data-table-filters-popover';
import { DataTableSearch } from '@/components/data-table/data-table-search';
import { DatePicker } from '@/components/form/form-fields';
import { eventTypeKey } from '@/features/stock-events/lib/event-list';
import type { TransactionHistorySearch } from '@/features/stock-events/lib/search';
import { EVENT_TYPES, type EventTypeFilter } from '@/features/stock-events/lib/types';

type TransactionHistoryToolbarProps = {
  search: TransactionHistorySearch;
  onFilterChange: (patch: Partial<TransactionHistorySearch>) => void;
  view?: ReactNode;
  disabled?: boolean;
};

const activeFilters = (search: TransactionHistorySearch) =>
  [search.type, search.startDate, search.endDate].filter(Boolean).length;

const isEventType = (value: string): value is EventTypeFilter =>
  (EVENT_TYPES as readonly string[]).includes(value);

export function TransactionHistoryToolbar({
  search,
  onFilterChange,
  view,
  disabled = false,
}: TransactionHistoryToolbarProps) {
  const { t } = useTranslation();
  const change = (patch: Partial<TransactionHistorySearch>) =>
    onFilterChange({ ...patch, page: undefined });
  const typeOptions = EVENT_TYPES.map((type) => ({
    value: type,
    label: t(eventTypeKey(type) ?? 'transaction-history.type'),
  }));
  return (
    <DataTableToolbar>
      <div className="w-full @2xl/main:w-72">
        <DataTableSearch
          size="lg"
          onValueChange={(value) => change({ documentNumber: value || undefined })}
          placeholder={t('transaction-history.search-document-number')}
          value={search.documentNumber ?? ''}
        />
      </div>
      <div className="flex-1 @2xl/main:me-auto @2xl/main:flex-none">
        <DataTableFilters
          size="lg"
          activeCount={activeFilters(search)}
          disabled={disabled}
          onClear={() => change({ type: undefined, startDate: undefined, endDate: undefined })}
        >
          <DataTableSelectFilter
            allLabel={t('transaction-history.type-all')}
            label={t('transaction-history.type')}
            onValueChange={(type) => change({ type: isEventType(type) ? type : undefined })}
            options={typeOptions}
            value={search.type ?? ''}
          />
          <DatePicker
            clearLabel={t('data-table.clear-filter', {
              label: t('transaction-history.start-date'),
            })}
            id="transaction-history-start-date"
            label={t('transaction-history.start-date')}
            latest={search.endDate}
            onValueChange={(startDate) => change({ startDate: startDate || undefined })}
            placeholder={t('transaction-history.start-date')}
            value={search.startDate ?? ''}
          />
          <DatePicker
            clearLabel={t('data-table.clear-filter', {
              label: t('transaction-history.end-date'),
            })}
            earliest={search.startDate}
            id="transaction-history-end-date"
            label={t('transaction-history.end-date')}
            onValueChange={(endDate) => change({ endDate: endDate || undefined })}
            placeholder={t('transaction-history.end-date')}
            value={search.endDate ?? ''}
          />
        </DataTableFilters>
      </div>
      {view}
    </DataTableToolbar>
  );
}
