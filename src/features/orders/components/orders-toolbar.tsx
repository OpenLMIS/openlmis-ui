import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { DataTableToolbar } from '@/components/data-table/data-table';
import {
  DataTableComboboxFilter,
  DataTableSelectFilter,
} from '@/components/data-table/data-table-filters';
import { DataTableFilters } from '@/components/data-table/data-table-filters-popover';
import { DatePicker } from '@/components/form/form-fields';
import type { ViewOrdersSearch } from '@/features/orders/lib/order-search';
import type { OrderKind } from '@/features/orders/lib/order-status';
import {
  FULFILL_STATUSES,
  ORDER_STATUS,
  VIEW_FILTER_STATUSES,
} from '@/features/orders/lib/order-status';

export const CLEARED_ORDER_FILTERS = {
  requestingFacilityId: undefined,
  programId: undefined,
  status: undefined,
  periodStart: undefined,
  periodEnd: undefined,
  page: undefined,
};
export const activeOrderFilterCount = (search: ViewOrdersSearch) =>
  [
    search.requestingFacilityId,
    search.programId,
    search.status,
    search.periodStart,
    search.periodEnd,
  ].filter(Boolean).length;

type FilterOption = { value: string; label: string };
export function OrdersToolbar({
  kind = 'view',
  search,
  facilities = [],
  programs = [],
  onFilterChange,
  sort,
  view,
  disabled = false,
  facilitiesDisabled = false,
  programsDisabled = false,
}: {
  kind?: Exclude<OrderKind, 'pod'>;
  search: ViewOrdersSearch;
  facilities?: FilterOption[];
  programs?: FilterOption[];
  onFilterChange: (patch: Partial<ViewOrdersSearch>) => void;
  sort?: ReactNode;
  view?: ReactNode;
  disabled?: boolean;
  facilitiesDisabled?: boolean;
  programsDisabled?: boolean;
}) {
  const { t } = useTranslation();
  const statuses = kind === 'fulfill' ? FULFILL_STATUSES : VIEW_FILTER_STATUSES;
  const change = (patch: Partial<ViewOrdersSearch>) =>
    onFilterChange({ ...patch, page: undefined });
  return (
    <DataTableToolbar>
      <div className="flex-1 @2xl/main:flex-none">
        <DataTableFilters
          size="lg"
          activeCount={activeOrderFilterCount(search)}
          disabled={disabled}
          onClear={() => change(CLEARED_ORDER_FILTERS)}
        >
          <fieldset disabled={facilitiesDisabled} className="min-w-0">
            <DataTableComboboxFilter
              label={t(
                kind === 'fulfill'
                  ? 'orders.fulfill.filters.facility'
                  : 'orders.view.filters.requesting-facility',
              )}
              value={search.requestingFacilityId ?? ''}
              options={facilities}
              onValueChange={(value) => change({ requestingFacilityId: value || undefined })}
            />
          </fieldset>
          <fieldset disabled={programsDisabled} className="min-w-0">
            <DataTableComboboxFilter
              label={t('orders.view.filters.program')}
              value={search.programId ?? ''}
              options={programs}
              onValueChange={(value) => change({ programId: value || undefined })}
            />
          </fieldset>
          <DataTableSelectFilter
            label={t(
              kind === 'fulfill' ? 'orders.fulfill.filters.status' : 'orders.view.filters.status',
            )}
            value={search.status ?? ''}
            options={statuses.map((status) => ({
              value: status,
              label: t(ORDER_STATUS[status]),
            }))}
            onValueChange={(value) =>
              change({ status: value ? (value as ViewOrdersSearch['status']) : undefined })
            }
          />
          {kind === 'view' && (
            <>
              <DatePicker
                id="orders-period-start"
                label={t('orders.view.filters.period-start')}
                placeholder={t('orders.view.filters.period-start')}
                clearLabel={t('data-table.clear-filter', {
                  label: t('orders.view.filters.period-start'),
                })}
                value={search.periodStart ?? ''}
                latest={search.periodEnd}
                onValueChange={(value) => change({ periodStart: value || undefined })}
              />
              <DatePicker
                id="orders-period-end"
                label={t('orders.view.filters.period-end')}
                placeholder={t('orders.view.filters.period-end')}
                clearLabel={t('data-table.clear-filter', {
                  label: t('orders.view.filters.period-end'),
                })}
                value={search.periodEnd ?? ''}
                earliest={search.periodStart}
                onValueChange={(value) => change({ periodEnd: value || undefined })}
              />
            </>
          )}
        </DataTableFilters>
      </div>
      {sort && <div className="flex-1 @2xl/main:flex-none">{sort}</div>}
      {view && <div className="flex-1 @2xl/main:ms-auto @2xl/main:flex-none">{view}</div>}
    </DataTableToolbar>
  );
}
