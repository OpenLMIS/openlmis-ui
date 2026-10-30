import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { DataTableToolbar } from '@/components/data-table/data-table';
import { DataTableSelectFilter } from '@/components/data-table/data-table-filters';
import { DataTableFilters } from '@/components/data-table/data-table-filters-popover';
import type { ApprovalSearch } from '@/features/requisitions/lib/approval-search';

export function ApprovalToolbar({
  search,
  programs,
  onFilterChange,
  view,
  disabled = false,
}: {
  search: ApprovalSearch;
  programs?: readonly { id: string; name?: string | null }[];
  onFilterChange: (patch: Partial<ApprovalSearch>) => void;
  view: ReactNode;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <DataTableToolbar>
      <div className="flex-1 @2xl/main:me-auto @2xl/main:flex-none">
        <DataTableFilters
          size="lg"
          activeCount={search.program ? 1 : 0}
          disabled={disabled}
          onClear={() => onFilterChange({ program: undefined, page: undefined })}
        >
          <DataTableSelectFilter
            label={t('requisitions.filters.program')}
            allLabel={t('requisitions.filters.all-programs')}
            value={search.program ?? ''}
            disabled={!programs?.length}
            options={(programs ?? []).map(({ id, name }) => ({ value: id, label: name ?? id }))}
            onValueChange={(program) =>
              onFilterChange({ program: program || undefined, page: undefined })
            }
          />
        </DataTableFilters>
      </div>
      <div className="flex-1 @2xl/main:flex-none">{view}</div>
    </DataTableToolbar>
  );
}
