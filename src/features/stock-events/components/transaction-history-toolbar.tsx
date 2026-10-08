import { FilterIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { DataTableSelectFilter } from '@/components/data-table/data-table-filters';
import { DataTableSearch } from '@/components/data-table/data-table-search';
import { DatePicker } from '@/components/form/form-fields';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
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
  [search.type, search.startDate, search.endDate, search.documentNumber].filter(Boolean).length;

const isEventType = (value: string): value is EventTypeFilter =>
  (EVENT_TYPES as readonly string[]).includes(value);

export function TransactionHistoryToolbar({
  search,
  onFilterChange,
  view,
  disabled = false,
}: TransactionHistoryToolbarProps) {
  const { t } = useTranslation();
  const count = activeFilters(search);
  const documentNumberId = useId();
  const change = (patch: Partial<TransactionHistorySearch>) =>
    onFilterChange({ ...patch, page: undefined });
  const typeOptions = [
    { value: '', label: t('transaction-history.type-all') },
    ...EVENT_TYPES.map((type) => ({
      value: type,
      label: t(eventTypeKey(type) ?? 'transaction-history.type'),
    })),
  ];

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="basis-full @md/main:me-auto @md/main:basis-auto">
        <Popover>
          <PopoverTrigger
            render={<Button disabled={disabled} type="button" variant="outline" width="full" />}
          >
            <FilterIcon data-icon="inline-start" />
            {t('transaction-history.filter')}
            {count > 0 && (
              <>
                <Badge aria-hidden variant="secondary">
                  {count}
                </Badge>
                <span className="sr-only">
                  {t('transaction-history.active-filters', { count })}
                </span>
              </>
            )}
          </PopoverTrigger>
          <PopoverContent align="start" aria-label={t('transaction-history.filter')} side="top">
            <div className="flex flex-col gap-3">
              <DataTableSelectFilter
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
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={documentNumberId}>
                  {t('transaction-history.search-document-number')}
                </Label>
                <DataTableSearch
                  id={documentNumberId}
                  onValueChange={(value) => change({ documentNumber: value || undefined })}
                  placeholder={t('transaction-history.search-document-number')}
                  value={search.documentNumber ?? ''}
                />
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>
      {view}
    </div>
  );
}
