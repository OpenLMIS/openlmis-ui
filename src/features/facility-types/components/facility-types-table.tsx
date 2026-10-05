import { useSuspenseQuery } from '@tanstack/react-query';
import { type ColumnVisibilityState, createColumnHelper, useTable } from '@tanstack/react-table';
import type { TFunction } from 'i18next';
import { CheckIcon, EllipsisIcon, PencilIcon, PlusIcon, ShapesIcon, XIcon } from 'lucide-react';
import { useDeferredValue, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DataTable,
  DataTableColumnHeader,
  DataTableEmpty,
  type DataTableFeatures,
  DataTableSkeleton,
  dataTableFeatures,
} from '@/components/data-table/data-table';
import { DataTablePagination } from '@/components/data-table/data-table-pagination';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { facilityTypesListOptions } from '@/features/facility-types/api/queries';
import {
  DEFAULT_FACILITY_TYPES_SORT,
  type FacilityTypesSearch,
  toFacilityTypesQuery,
} from '@/features/facility-types/lib/search';
import { facilityTypeName } from '@/features/reference-data/lib/facility-types';
import type { FacilityType } from '@/features/reference-data/lib/types';
import { useMenuOpensDialog } from '@/hooks/use-menu-opens-dialog';
import { type SearchChange, toPaginationState, useTableSearchState } from '@/lib/table-search';

const columnHelper = createColumnHelper<DataTableFeatures, FacilityType>();

function createColumns(t: TFunction, onEdit: (id: string) => void) {
  return columnHelper.columns([
    columnHelper.accessor('code', {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('facility-types.code')} />
      ),
      cell: ({ getValue }) => (
        <span className="flex">
          <span className="min-w-0 truncate font-medium" dir="ltr">
            {getValue()}
          </span>
        </span>
      ),
      meta: { className: '@xl/main:w-1/3' },
    }),
    columnHelper.accessor('name', {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('facility-types.name')} />
      ),
      cell: ({ getValue }) =>
        getValue() ? (
          <span className="flex">
            <span className="min-w-0 truncate" dir="auto">
              {getValue()}
            </span>
          </span>
        ) : (
          <span className="text-muted-foreground">-</span>
        ),
    }),
    columnHelper.accessor('displayOrder', {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('facility-types.display-order')} />
      ),
      cell: ({ getValue }) => <span className="tabular-nums">{getValue() ?? '-'}</span>,
      meta: { className: 'w-40' },
    }),
    columnHelper.accessor('active', {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('facility-types.status')} />
      ),
      cell: ({ getValue }) =>
        getValue() ? (
          <Badge variant="success">
            <CheckIcon data-icon="inline-start" />
            {t('facility-types.active')}
          </Badge>
        ) : (
          <Badge variant="destructive">
            <XIcon data-icon="inline-start" />
            {t('facility-types.inactive')}
          </Badge>
        ),
      meta: { className: 'w-32' },
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
  const menu = useMenuOpensDialog();

  return (
    <div className="flex justify-end">
      <DropdownMenu onOpenChange={menu.onOpenChange}>
        <DropdownMenuTrigger
          render={
            <Button
              aria-label={t('facility-types.actions-for', { type: facilityTypeName(type) })}
              size="icon-sm"
              variant="ghost"
            />
          }
        >
          <EllipsisIcon />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" finalFocus={menu.finalFocus} width="auto">
          <DropdownMenuItem onClick={menu.opensDialog(() => onEdit(type.id))}>
            <PencilIcon />
            {t('facility-types.edit')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

type FacilityTypesTableProps = {
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
  data,
  rowCount,
  search,
  onSearchChange,
  columnVisibility,
  onEdit,
}: Omit<FacilityTypesTableProps, 'onAdd'> & { data: FacilityType[]; rowCount: number }) {
  const { t } = useTranslation();
  const columns = useMemo(() => createColumns(t, onEdit), [t, onEdit]);
  const searchState = useTableSearchState({
    search,
    defaultSort: DEFAULT_FACILITY_TYPES_SORT,
    onSearchChange,
  });

  return useTable({
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
}

export function FacilityTypesTableSkeleton({
  search,
  columnVisibility,
}: Pick<FacilityTypesTableProps, 'search' | 'columnVisibility'>) {
  const table = useFacilityTypesTable({
    data: NO_TYPES,
    rowCount: 0,
    search,
    onSearchChange: noop,
    columnVisibility,
    onEdit: noop,
  });
  return <DataTableSkeleton rowCount={toPaginationState(search).pageSize} table={table} />;
}

export function FacilityTypesTable({
  search,
  onSearchChange,
  columnVisibility,
  onAdd,
  onEdit,
}: FacilityTypesTableProps) {
  const { t } = useTranslation();
  const deferredSearch = useDeferredValue(search);
  const { data } = useSuspenseQuery(facilityTypesListOptions(toFacilityTypesQuery(deferredSearch)));
  const table = useFacilityTypesTable({
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

  return (
    <DataTable
      empty={
        !isPastLastPage && (
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
        )
      }
      footer={!isPastLastPage && data.totalElements > 0 && <DataTablePagination table={table} />}
      isStale={search !== deferredSearch}
      table={table}
    />
  );
}
