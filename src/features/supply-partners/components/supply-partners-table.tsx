import { useSuspenseQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { createColumnHelper, useTable } from '@tanstack/react-table';
import type { TFunction } from 'i18next';
import { EllipsisIcon, PencilIcon, TruckIcon } from 'lucide-react';
import { useDeferredValue, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DataTable,
  DataTableEmpty,
  type DataTableFeatures,
  DataTableSkeleton,
  dataTableFeatures,
} from '@/components/data-table/data-table';
import { DataTablePagination } from '@/components/data-table/data-table-pagination';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { supplyPartnersOptions } from '@/features/supply-partners/api/queries';
import {
  type SupplyPartnersSearch,
  toSupplyPartnersQuery,
} from '@/features/supply-partners/lib/search';
import type { SupplyPartner } from '@/features/supply-partners/lib/types';
import { type SearchChange, toPaginationState, useTableSearchState } from '@/lib/table-search';

const helper = createColumnHelper<DataTableFeatures, SupplyPartner>();
const NO_SORT = { id: 'name', desc: false };
const EMPTY: SupplyPartner[] = [];
const noop = () => {};
function columns(t: TFunction, search: SupplyPartnersSearch) {
  return helper.columns([
    helper.accessor('code', {
      header: t('supply-partners.code'),
      cell: ({ getValue }) => (
        <span className="whitespace-nowrap" dir="auto">
          {getValue()}
        </span>
      ),
    }),
    helper.accessor('name', {
      header: t('supply-partners.name'),
      cell: ({ getValue }) => (
        <span className="whitespace-nowrap font-medium" dir="auto">
          {getValue()}
        </span>
      ),
    }),
    helper.display({
      id: 'actions',
      header: () => <span className="sr-only">{t('supply-partners.actions')}</span>,
      meta: { className: 'w-16' },
      cell: ({ row }) => (
        <div className="flex justify-end">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  aria-label={t('supply-partners.actions-for', { partner: row.original.name })}
                  size="icon-sm"
                  variant="ghost"
                />
              }
            >
              <EllipsisIcon />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" width="auto">
              <DropdownMenuGroup>
                <DropdownMenuItem
                  render={
                    <Link
                      to="/administration/supply-partners/$id"
                      params={{ id: row.original.id }}
                      search={{ listPage: search.page, listSize: search.size }}
                      state={{ supplyPartnersListSearch: search }}
                    />
                  }
                >
                  <PencilIcon />
                  {t('supply-partners.edit')}
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    }),
  ]);
}
function usePartnersTable(
  data: SupplyPartner[],
  rowCount: number,
  search: SupplyPartnersSearch,
  onSearchChange: SearchChange<SupplyPartnersSearch>,
) {
  const { t } = useTranslation();
  const cols = useMemo(() => columns(t, search), [t, search]);
  const state = useTableSearchState({ search, defaultSort: NO_SORT, onSearchChange });
  return useTable({
    features: dataTableFeatures,
    columns: cols,
    data,
    getRowId: (row) => row.id,
    rowCount,
    manualPagination: true,
    manualSorting: true,
    enableSorting: false,
    ...state,
  });
}
export function SupplyPartnersTableSkeleton({ search }: { search: SupplyPartnersSearch }) {
  const table = usePartnersTable(EMPTY, 0, search, noop);
  return (
    <DataTableSkeleton layout="auto" table={table} rowCount={toPaginationState(search).pageSize} />
  );
}
export function SupplyPartnersTable({
  search,
  onSearchChange,
}: {
  search: SupplyPartnersSearch;
  onSearchChange: SearchChange<SupplyPartnersSearch>;
}) {
  const { t } = useTranslation();
  const deferred = useDeferredValue(search);
  const { data } = useSuspenseQuery(supplyPartnersOptions(toSupplyPartnersQuery(deferred)));
  const table = usePartnersTable(data.content, data.totalElements, deferred, onSearchChange);
  const page = Math.max(1, data.totalPages);
  const pastEnd = (deferred.page ?? 1) > page;
  useEffect(() => {
    if (pastEnd) onSearchChange({ page: page > 1 ? page : undefined }, true);
  }, [pastEnd, page, onSearchChange]);
  return (
    <DataTable
      layout="auto"
      table={table}
      isStale={search !== deferred}
      empty={
        !pastEnd && (
          <DataTableEmpty
            icon={<TruckIcon />}
            title={t('supply-partners.empty-title')}
            description={t('supply-partners.empty-description')}
          />
        )
      }
      footer={!pastEnd && data.totalElements > 0 && <DataTablePagination table={table} />}
    />
  );
}
