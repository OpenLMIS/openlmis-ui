import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { DataTableToolbar } from '@/components/data-table/data-table';
import { DataTableSelectFilter } from '@/components/data-table/data-table-filters';
import { DataTableFilters } from '@/components/data-table/data-table-filters-popover';
import { DatePicker } from '@/components/form/form-fields';
import {
  activeRequisitionFilterCount,
  CLEARED_REQUISITION_FILTERS,
  type RequisitionSearch,
  type SearchProgram,
} from '@/features/requisitions/lib/search-facilities';
import {
  REQUISITION_STATUS,
  REQUISITION_STATUSES,
  type RequisitionStatus,
} from '@/lib/requisition-status';

export function RequisitionsToolbar({
  search,
  programs,
  onFilterChange,
  view,
  disabled = false,
}: {
  search: RequisitionSearch;
  programs?: readonly SearchProgram[];
  onFilterChange: (patch: Partial<RequisitionSearch>) => void;
  view?: ReactNode;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const change = (patch: Partial<RequisitionSearch>) =>
    onFilterChange({ ...patch, page: undefined });
  return (
    <DataTableToolbar>
      <div className="flex-1 @2xl/main:me-auto @2xl/main:flex-none">
        <DataTableFilters
          size="lg"
          activeCount={activeRequisitionFilterCount(search)}
          disabled={disabled}
          onClear={() => change(CLEARED_REQUISITION_FILTERS)}
        >
          <DataTableSelectFilter
            label={t('requisitions.filters.program')}
            allLabel={t('requisitions.filters.all-programs')}
            disabled={!programs?.length}
            value={search.program ?? ''}
            options={(programs ?? []).map(({ id, name }) => ({ value: id, label: name ?? id }))}
            onValueChange={(program) => change({ program: program || undefined })}
          />
          {programs && !programs.length ? (
            <p className="text-muted-foreground text-sm">{t('requisitions.view.no-programs')}</p>
          ) : null}
          <DataTableSelectFilter
            label={t('requisitions.filters.status')}
            value={search.status ?? ''}
            options={REQUISITION_STATUSES.map((status) => ({
              value: status,
              label: t(REQUISITION_STATUS[status].labelKey),
            }))}
            onValueChange={(status) =>
              change({ status: status ? (status as RequisitionStatus) : undefined })
            }
          />
          <DatePicker
            clearLabel={t('data-table.clear-filter', {
              label: t('requisitions.filters.initiated-from'),
            })}
            id="requisitions-initiated-from"
            label={t('requisitions.filters.initiated-from')}
            latest={search.initiatedTo}
            onValueChange={(initiatedFrom) => change({ initiatedFrom: initiatedFrom || undefined })}
            placeholder={t('requisitions.filters.initiated-from')}
            value={search.initiatedFrom ?? ''}
          />
          <DatePicker
            clearLabel={t('data-table.clear-filter', {
              label: t('requisitions.filters.initiated-to'),
            })}
            earliest={search.initiatedFrom}
            id="requisitions-initiated-to"
            label={t('requisitions.filters.initiated-to')}
            onValueChange={(initiatedTo) => change({ initiatedTo: initiatedTo || undefined })}
            placeholder={t('requisitions.filters.initiated-to')}
            value={search.initiatedTo ?? ''}
          />
        </DataTableFilters>
      </div>
      {view}
    </DataTableToolbar>
  );
}
