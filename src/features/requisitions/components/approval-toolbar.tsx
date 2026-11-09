import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { DataTableToolbar } from '@/components/data-table/data-table';
import { DataTableSelectFilter } from '@/components/data-table/data-table-filters';
import { DataTableFilters } from '@/components/data-table/data-table-filters-popover';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { ApprovalSearch } from '@/features/requisitions/lib/approval-search';

export function ApprovalToolbar({
  search,
  programs,
  onFilterChange,
  newestFirst,
  onOrderChange,
  view,
  disabled = false,
}: {
  search: ApprovalSearch;
  programs?: readonly { id: string; name?: string | null }[];
  onFilterChange: (patch: Partial<ApprovalSearch>) => void;
  newestFirst: boolean;
  onOrderChange: (newestFirst: boolean) => void;
  view: ReactNode;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const orders = [
    { value: 'desc', label: t('requisitions.approve.sort-newest') },
    { value: 'asc', label: t('requisitions.approve.sort-oldest') },
  ];
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
      <div className="flex-1 @2xl/main:flex-none">
        <Select
          value={newestFirst ? 'desc' : 'asc'}
          items={orders}
          disabled={disabled}
          onValueChange={(order) => {
            if (order) onOrderChange(order === 'desc');
          }}
        >
          <SelectTrigger aria-label={t('data-table.sort-by')} size="lg" width="full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {orders.map(({ value, label }) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>
      <div className="flex-1 @2xl/main:flex-none">{view}</div>
    </DataTableToolbar>
  );
}
