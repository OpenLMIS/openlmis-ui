import { useSuspenseQuery } from '@tanstack/react-query';
import { type ColumnVisibilityState, createColumnHelper, useTable } from '@tanstack/react-table';
import type { TFunction } from 'i18next';
import { PencilIcon, PlusIcon, ShapesIcon } from 'lucide-react';
import { useDeferredValue, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { RowActions } from '@/components/card-actions';
import {
  DataTable,
  DataTableColumnHeader,
  DataTableEmpty,
  type DataTableFeatures,
  DataTableSkeleton,
  dataTableFeatures,
} from '@/components/data-table/data-table';
import { DataTablePagination } from '@/components/data-table/data-table-pagination';
import { FlagBadge } from '@/components/flag-badge';
import { CellText, TableCards, TableCardsSkeleton } from '@/components/table-cards';
import { Button } from '@/components/ui/button';
import { facilityTypesListOptions } from '@/features/facility-types/api/queries';
import {
  DEFAULT_FACILITY_TYPES_SORT,
  type FacilityTypesSearch,
  toFacilityTypesQuery,
} from '@/features/facility-types/lib/search';
import { facilityTypeName } from '@/features/reference-data/lib/facility-types';
import type { FacilityType } from '@/features/reference-data/lib/types';
import { usePagedTableSearch } from '@/hooks/use-page-start';
import { type SearchChange, toPaginationState } from '@/lib/table-search';

const columnHelper = createColumnHelper<DataTableFeatures, FacilityType>();

function createColumns(t: TFunction, onEdit: (id: string) => void) {
  return columnHelper.columns([
    columnHelper.accessor('code', {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('facility-types.code')} />
      ),
      cell: ({ getValue }) => (
        <CellText dir="ltr" strong>
          {getValue()}
        </CellText>
      ),
      meta: { className: '@xl/main:w-1/3' },
    }),
    columnHelper.accessor('name', {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('facility-types.name')} />
      ),
      cell: ({ getValue }) => (getValue() ? <CellText>{getValue()}</CellText> : null),
      meta: { label: t('facility-types.name') },
    }),
    columnHelper.accessor('displayOrder', {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('facility-types.display-order')} />
      ),
      cell: ({ getValue }) =>
        getValue() === null ? null : <span className="tabular-nums">{getValue()}</span>,
      meta: { className: 'w-40', label: t('facility-types.display-order') },
    }),
    columnHelper.accessor('active', {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('facility-types.status')} />
      ),
      cell: ({ getValue }) => (
        <FlagBadge
          value={getValue() ?? false}
          trueLabel={t('facility-types.active')}
          falseLabel={t('facility-types.inactive')}
        />
      ),
      meta: { className: 'w-32', label: t('facility-types.status') },
    }),
    columnHelper.display({
      id: 'actions',
      header: () => <span className="sr-only">{t('facility-types.actions')}</span>,
      meta: { className: 'w-16' },
      cell: ({ row }) => <FacilityTypeActions onEdit={onEdit} type={row.original} />,
    }),
  ]);
}

function FacilityTypeActions({
  type,
  onEdit,
}: {
  type: FacilityType;
  onEdit: (id: string) => void;
}) {
  const { t } = useTranslation();

  const label = t('facility-types.actions-for', { type: facilityTypeName(type) });

  return (
    <RowActions
      label={label}
      actions={[
        {
          id: 'edit',
          icon: <PencilIcon />,
          label: t('facility-types.edit'),
          onSelect: () => onEdit(type.id),
        },
      ]}
    />
  );
}

type FacilityTypesTableProps = {
  cards: boolean;
  search: FacilityTypesSearch;
  onSearchChange: SearchChange<FacilityTypesSearch>;
  columnVisibility: ColumnVisibilityState;
  onAdd: () => void;
  onEdit: (id: string) => void;
};

const NO_TYPES: FacilityType[] = [];

const getRowId = (type: FacilityType) => type.id;

const noop = () => {};

function useFacilityTypesTable({
  cards,
  data,
  rowCount,
  search,
  onSearchChange,
  columnVisibility,
  onEdit,
}: Omit<FacilityTypesTableProps, 'onAdd'> & { data: FacilityType[]; rowCount: number }) {
  const { t } = useTranslation();
  const columns = useMemo(() => createColumns(t, onEdit), [t, onEdit]);
  const { pageStart, searchState } = usePagedTableSearch({
    search,
    defaultSort: DEFAULT_FACILITY_TYPES_SORT,
    onSearchChange,
    cards,
  });

  const table = useTable({
    features: dataTableFeatures,
    columns,
    data,
    getRowId,
    rowCount,
    manualPagination: true,
    manualSorting: true,
    enableSortingRemoval: false,
    ...searchState,
    state: { ...searchState.state, columnVisibility },
  });
  return { table, pageStart };
}

export function FacilityTypesTableSkeleton({
  cards,
  search,
  columnVisibility,
}: Pick<FacilityTypesTableProps, 'cards' | 'search' | 'columnVisibility'>) {
  const { table } = useFacilityTypesTable({
    cards: false,
    data: NO_TYPES,
    rowCount: 0,
    search,
    onSearchChange: noop,
    columnVisibility,
    onEdit: noop,
  });
  const rowCount = toPaginationState(search).pageSize;
  if (cards) return <TableCardsSkeleton rowCount={rowCount} table={table} title="code" />;
  return <DataTableSkeleton rowCount={rowCount} table={table} />;
}

export function FacilityTypesTable({
  cards,
  search,
  onSearchChange,
  columnVisibility,
  onAdd,
  onEdit,
}: FacilityTypesTableProps) {
  const { t } = useTranslation();
  const deferredSearch = useDeferredValue(search);
  const { data } = useSuspenseQuery(facilityTypesListOptions(toFacilityTypesQuery(deferredSearch)));
  const { table, pageStart } = useFacilityTypesTable({
    cards,
    data: data.content,
    rowCount: data.totalElements,
    search: deferredSearch,
    onSearchChange,
    columnVisibility,
    onEdit,
  });
  const isPastLastPage = data.content.length === 0 && data.totalElements > 0;

  useEffect(() => {
    if (isPastLastPage) {
      onSearchChange({ page: data.totalPages > 1 ? data.totalPages : undefined }, true);
    }
  }, [isPastLastPage, data.totalPages, onSearchChange]);

  const empty = !isPastLastPage && (
    <DataTableEmpty
      action={
        <Button onClick={onAdd}>
          <PlusIcon data-icon="inline-start" />
          {t('facility-types.add')}
        </Button>
      }
      description={t('facility-types.empty-description')}
      icon={<ShapesIcon />}
      title={t('facility-types.empty-title')}
    />
  );
  const footer = !isPastLastPage && data.totalElements > 0 && <DataTablePagination table={table} />;
  const isStale = search !== deferredSearch;
  if (cards) {
    return (
      <TableCards
        busy={isStale}
        empty={empty}
        footer={footer}
        listRef={pageStart.ref}
        table={table}
        title="code"
      />
    );
  }
  return <DataTable empty={empty} footer={footer} isStale={isStale} table={table} />;
}
