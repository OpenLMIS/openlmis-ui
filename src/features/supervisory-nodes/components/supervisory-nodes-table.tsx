import { useSuspenseQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { type ColumnVisibilityState, createColumnHelper, useTable } from '@tanstack/react-table';
import type { TFunction } from 'i18next';
import { EllipsisIcon, NetworkIcon, PencilIcon, SearchXIcon } from 'lucide-react';
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
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from '@/components/ui/popover';
import { supervisoryNodesPageOptions } from '@/features/supervisory-nodes/api/queries';
import {
  CLEARED_SUPERVISORY_NODE_FILTERS,
  hasSupervisoryNodeFilters,
  type SupervisoryNodesSearch,
  toSupervisoryNodesQuery,
} from '@/features/supervisory-nodes/lib/search';
import type { NodeRow } from '@/features/supervisory-nodes/lib/types';
import { tableValue } from '@/lib/empty-value';
import { type SearchChange, toPaginationState, useTableSearchState } from '@/lib/table-search';

const columnHelper = createColumnHelper<DataTableFeatures, NodeRow>();

function text(value: string | null, dir: 'auto' | 'ltr' = 'auto', strong = false) {
  if (!tableValue(value)) return null;
  return (
    <span className="flex">
      <span className={strong ? 'min-w-0 truncate font-medium' : 'min-w-0 truncate'} dir={dir}>
        {value}
      </span>
    </span>
  );
}

function PartnerNodes({ partners }: { partners: NodeRow['partners'] }) {
  const { t } = useTranslation();
  if (partners.length === 0) return null;
  if (partners.length === 1) return text(partners[0].name);
  return (
    <Popover>
      <PopoverTrigger render={<Button size="sm" variant="link" />}>
        {t('supervisory-nodes.partner-count', { count: partners.length })}
      </PopoverTrigger>
      <PopoverContent align="start" side="inline-start">
        <PopoverTitle>{t('supervisory-nodes.partner-nodes')}</PopoverTitle>
        <ul className="flex flex-col gap-1">
          {partners.map((partner) => (
            <li className="break-words" dir="auto" key={partner.id}>
              {tableValue(partner.name)}
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

function createColumns(t: TFunction, listSearch: SupervisoryNodesSearch) {
  return columnHelper.columns([
    columnHelper.accessor('name', {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('supervisory-nodes.name')} />
      ),
      cell: ({ getValue }) => text(getValue(), 'auto', true),
      enableHiding: false,
      meta: { className: 'w-48' },
    }),
    columnHelper.accessor('code', {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('supervisory-nodes.code')} />
      ),
      cell: ({ getValue }) => text(getValue(), 'ltr'),
      meta: { className: 'w-28' },
    }),
    columnHelper.accessor('facilityName', {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('supervisory-nodes.facility')} />
      ),
      cell: ({ getValue }) => text(getValue()),
      meta: { className: 'w-40' },
    }),
    columnHelper.accessor('childCount', {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('supervisory-nodes.child-nodes')} />
      ),
      cell: ({ getValue }) => t('supervisory-nodes.child-count', { count: getValue() }),
      meta: { className: 'w-32' },
    }),
    columnHelper.accessor('zoneName', {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('supervisory-nodes.zone')} />
      ),
      cell: ({ getValue }) => text(getValue()),
      meta: { className: 'w-40' },
    }),
    columnHelper.accessor('partners', {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('supervisory-nodes.partner-nodes')} />
      ),
      cell: ({ getValue }) => <PartnerNodes partners={getValue()} />,
      meta: { className: 'w-40' },
    }),
    columnHelper.display({
      id: 'actions',
      header: () => <span className="sr-only">{t('supervisory-nodes.actions')}</span>,
      meta: { className: 'w-16' },
      enableHiding: false,
      cell: ({ row }) => <NodeActions node={row.original} listSearch={listSearch} />,
    }),
  ]);
}

function NodeActions({ node, listSearch }: { node: NodeRow; listSearch: SupervisoryNodesSearch }) {
  const { t } = useTranslation();
  return (
    <div className="flex justify-end">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              aria-label={t('supervisory-nodes.actions-for', { node: node.name || node.code })}
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
                  params={{ id: node.id }}
                  state={{ supervisoryNodesListSearch: listSearch }}
                  to="/administration/supervisory-nodes/$id"
                />
              }
            >
              <PencilIcon />
              {t('supervisory-nodes.edit')}
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

type SupervisoryNodesTableProps = {
  search: SupervisoryNodesSearch;
  onSearchChange: SearchChange<SupervisoryNodesSearch>;
  columnVisibility: ColumnVisibilityState;
};

const NO_NODES: NodeRow[] = [];
const getRowId = (node: NodeRow) => node.id;
const noop = () => {};
const NO_SORT = { id: 'name', desc: false };

function useSupervisoryNodesTable({
  data,
  rowCount,
  search,
  onSearchChange,
  columnVisibility,
}: SupervisoryNodesTableProps & { data: NodeRow[]; rowCount: number }) {
  const { t } = useTranslation();
  const columns = useMemo(() => createColumns(t, search), [t, search]);
  const searchState = useTableSearchState({ search, defaultSort: NO_SORT, onSearchChange });
  return useTable({
    features: dataTableFeatures,
    columns,
    data,
    getRowId,
    rowCount,
    manualPagination: true,
    manualSorting: true,
    enableSorting: false,
    ...searchState,
    state: { ...searchState.state, columnVisibility },
  });
}

export function SupervisoryNodesTableSkeleton({
  search,
  columnVisibility,
}: Pick<SupervisoryNodesTableProps, 'search' | 'columnVisibility'>) {
  const table = useSupervisoryNodesTable({
    data: NO_NODES,
    rowCount: 0,
    search,
    onSearchChange: noop,
    columnVisibility,
  });
  return <DataTableSkeleton rowCount={toPaginationState(search).pageSize} table={table} />;
}

export function SupervisoryNodesTable({
  search,
  onSearchChange,
  columnVisibility,
}: SupervisoryNodesTableProps) {
  const { t } = useTranslation();
  const deferredSearch = useDeferredValue(search);
  const { data } = useSuspenseQuery(
    supervisoryNodesPageOptions(toSupervisoryNodesQuery(deferredSearch)),
  );
  const table = useSupervisoryNodesTable({
    data: data.content,
    rowCount: data.totalElements,
    search: deferredSearch,
    onSearchChange,
    columnVisibility,
  });
  const isPastLastPage = data.content.length === 0 && data.totalElements > 0;
  useEffect(() => {
    if (isPastLastPage) {
      onSearchChange({ page: data.totalPages > 1 ? data.totalPages : undefined }, true);
    }
  }, [isPastLastPage, data.totalPages, onSearchChange]);
  const empty = hasSupervisoryNodeFilters(deferredSearch) ? (
    <DataTableEmpty
      action={
        <Button
          onClick={() => onSearchChange(CLEARED_SUPERVISORY_NODE_FILTERS)}
          variant="destructive"
        >
          {t('supervisory-nodes.clear-filters')}
        </Button>
      }
      description={t('supervisory-nodes.no-results-description')}
      icon={<SearchXIcon />}
      title={t('supervisory-nodes.no-results-title')}
    />
  ) : (
    <DataTableEmpty
      description={t('supervisory-nodes.empty-description')}
      icon={<NetworkIcon />}
      title={t('supervisory-nodes.empty-title')}
    />
  );
  return (
    <DataTable
      empty={!isPastLastPage && empty}
      footer={!isPastLastPage && data.totalElements > 0 && <DataTablePagination table={table} />}
      isStale={search !== deferredSearch}
      table={table}
    />
  );
}
