import { useSuspenseQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { createColumnHelper, useTable } from '@tanstack/react-table';
import type { TFunction } from 'i18next';
import { PencilIcon, TruckIcon } from 'lucide-react';
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
import { RowActions } from '@/components/display/card-actions';
import { CellText, TableCards, TableCardsSkeleton } from '@/components/display/table-cards';
import { supplyPartnersOptions } from '@/features/supply-partners/api/queries';
import {
  type SupplyPartnersSearch,
  toSupplyPartnersQuery,
} from '@/features/supply-partners/lib/search';
import type { SupplyPartner } from '@/features/supply-partners/lib/types';
import { usePagedTableSearch } from '@/hooks/use-page-start';
import { type SearchChange, toPaginationState } from '@/lib/table-search';

const helper = createColumnHelper<DataTableFeatures, SupplyPartner>();
const NO_SORT = { id: 'name', desc: false };
const EMPTY: SupplyPartner[] = [];
const noop = () => {};
function columns(t: TFunction, search: SupplyPartnersSearch) {
  return helper.columns([
    helper.accessor('code', {
      header: t('supply-partners.code'),
      cell: ({ getValue }) => <CellText overflow="nowrap">{getValue()}</CellText>,
      meta: { label: t('supply-partners.code') },
    }),
    helper.accessor('name', {
      header: t('supply-partners.name'),
      cell: ({ getValue }) => (
        <CellText overflow="nowrap" strong>
          {getValue()}
        </CellText>
      ),
    }),
    helper.display({
      id: 'actions',
      header: () => <span className="sr-only">{t('supply-partners.actions')}</span>,
      meta: { className: 'w-16' },
      cell: ({ row }) => <SupplyPartnerActions partner={row.original} search={search} />,
    }),
  ]);
}

function SupplyPartnerActions({
  partner,
  search,
}: {
  partner: SupplyPartner;
  search: SupplyPartnersSearch;
}) {
  const { t } = useTranslation();
  const label = t('supply-partners.actions-for', { partner: partner.name });
  const link = (
    <Link
      to="/administration/supply-partners/$id"
      params={{ id: partner.id }}
      search={{ listPage: search.page, listSize: search.size }}
      state={{ supplyPartnersListSearch: search }}
    />
  );

  return (
    <RowActions
      label={label}
      actions={[{ id: 'edit', icon: <PencilIcon />, label: t('supply-partners.edit'), link }]}
    />
  );
}

function usePartnersTable(
  cards: boolean,
  data: SupplyPartner[],
  rowCount: number,
  search: SupplyPartnersSearch,
  onSearchChange: SearchChange<SupplyPartnersSearch>,
) {
  const { t } = useTranslation();
  const cols = useMemo(() => columns(t, search), [t, search]);
  const { pageStart, searchState: state } = usePagedTableSearch({
    search,
    defaultSort: NO_SORT,
    onSearchChange,
    cards,
  });
  const table = useTable({
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
  return { table, pageStart };
}
export function SupplyPartnersTableSkeleton({
  cards,
  search,
}: {
  cards: boolean;
  search: SupplyPartnersSearch;
}) {
  const { table } = usePartnersTable(false, EMPTY, 0, search, noop);
  const rowCount = toPaginationState(search).pageSize;
  if (cards) return <TableCardsSkeleton rowCount={rowCount} table={table} title="name" />;
  return <DataTableSkeleton layout="auto" table={table} rowCount={rowCount} />;
}
export function SupplyPartnersTable({
  cards,
  search,
  onSearchChange,
}: {
  cards: boolean;
  search: SupplyPartnersSearch;
  onSearchChange: SearchChange<SupplyPartnersSearch>;
}) {
  const { t } = useTranslation();
  const deferred = useDeferredValue(search);
  const { data } = useSuspenseQuery(supplyPartnersOptions(toSupplyPartnersQuery(deferred)));
  const { table, pageStart } = usePartnersTable(
    cards,
    data.content,
    data.totalElements,
    deferred,
    onSearchChange,
  );
  const page = Math.max(1, data.totalPages);
  const pastEnd = (deferred.page ?? 1) > page;
  useEffect(() => {
    if (pastEnd) onSearchChange({ page: page > 1 ? page : undefined }, true);
  }, [pastEnd, page, onSearchChange]);
  const empty = !pastEnd && (
    <DataTableEmpty
      icon={<TruckIcon />}
      title={t('supply-partners.empty-title')}
      description={t('supply-partners.empty-description')}
    />
  );
  const footer = !pastEnd && data.totalElements > 0 && <DataTablePagination table={table} />;
  const isStale = search !== deferred;
  if (cards) {
    return (
      <TableCards
        busy={isStale}
        empty={empty}
        footer={footer}
        listRef={pageStart.ref}
        table={table}
        title="name"
      />
    );
  }
  return <DataTable layout="auto" table={table} isStale={isStale} empty={empty} footer={footer} />;
}
