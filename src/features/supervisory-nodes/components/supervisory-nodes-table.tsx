import { useSuspenseQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { type ColumnVisibilityState, createColumnHelper, useTable } from '@tanstack/react-table';
import type { TFunction } from 'i18next';
import { EllipsisIcon, NetworkIcon, PencilIcon, SearchXIcon } from 'lucide-react';
import { useCallback, useDeferredValue, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { CardActions } from '@/components/card-actions';
import {
  DataTable,
  DataTableEmpty,
  type DataTableFeatures,
  DataTableSkeleton,
  dataTableFeatures,
} from '@/components/data-table/data-table';
import { DataTablePagination } from '@/components/data-table/data-table-pagination';
import { CellText, TableCards, TableCardsSkeleton, useInCards } from '@/components/table-cards';
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
import { usePageStart } from '@/hooks/use-page-start';
import { tableValue } from '@/lib/empty-value';
import { type SearchChange, toPaginationState, useTableSearchState } from '@/lib/table-search';

const columnHelper = createColumnHelper<DataTableFeatures, NodeRow>();

function text(value: string | null, dir: 'auto' | 'ltr' = 'auto', strong = false) {
  if (!tableValue(value)) return null;
  return (
    <CellText dir={dir} overflow="nowrap" strong={strong}>
      {value}
    </CellText>
  );
}

function PartnerNodes({ partners, node }: { partners: NodeRow['partners']; node: string | null }) {
  const { t } = useTranslation();
  if (partners.length === 0) return null;
  if (partners.length === 1) return text(partners[0].name);
  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            aria-label={t('supervisory-nodes.partners-for', { node, count: partners.length })}
            size="sm"
            variant="link"
          />
        }
      >
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
      header: t('supervisory-nodes.name'),
      cell: ({ getValue }) => text(getValue(), 'auto', true),
      enableHiding: false,
    }),
    columnHelper.accessor('code', {
      header: t('supervisory-nodes.code'),
      cell: ({ getValue }) => text(getValue(), 'ltr'),
      meta: { label: t('supervisory-nodes.code') },
    }),
    columnHelper.accessor('facilityName', {
      header: t('supervisory-nodes.facility'),
      cell: ({ getValue }) => text(getValue()),
      meta: { label: t('supervisory-nodes.facility') },
    }),
    columnHelper.accessor('childCount', {
      header: t('supervisory-nodes.child-nodes'),
      cell: ({ getValue }) => t('supervisory-nodes.child-count', { count: getValue() }),
      meta: { label: t('supervisory-nodes.child-nodes') },
    }),
    columnHelper.accessor('zoneName', {
      header: t('supervisory-nodes.zone'),
      cell: ({ getValue }) => text(getValue()),
      meta: { label: t('supervisory-nodes.zone') },
    }),
    columnHelper.accessor('partners', {
      header: t('supervisory-nodes.partner-nodes'),
      cell: ({ getValue, row }) =>
        getValue().length > 0 ? (
          <PartnerNodes partners={getValue()} node={row.original.name} />
        ) : null,
      meta: { label: t('supervisory-nodes.partner-nodes') },
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
  const label = t('supervisory-nodes.actions-for', { node: node.name || node.code });

  if (useInCards()) {
    return (
      <CardActions
        label={label}
        actions={[
          {
            id: 'edit',
            icon: <PencilIcon />,
            label: t('supervisory-nodes.edit'),
            link: (
              <Link
                params={{ id: node.id }}
                state={{ supervisoryNodesListSearch: listSearch }}
                to="/administration/supervisory-nodes/$id"
              />
            ),
          },
        ]}
      />
    );
  }

  return (
    <div className="flex justify-end">
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button aria-label={label} size="icon-sm" variant="ghost" />}>
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
  cards: boolean;
  search: SupervisoryNodesSearch;
  onSearchChange: SearchChange<SupervisoryNodesSearch>;
  columnVisibility: ColumnVisibilityState;
};

const NO_NODES: NodeRow[] = [];
const getRowId = (node: NodeRow) => node.id;
const noop = () => {};
const NO_SORT = { id: 'name', desc: false };

function useSupervisoryNodesTable({
  cards,
  data,
  rowCount,
  search,
  onSearchChange,
  columnVisibility,
}: SupervisoryNodesTableProps & { data: NodeRow[]; rowCount: number }) {
  const { t } = useTranslation();
  const columns = useMemo(() => createColumns(t, search), [t, search]);
  const { pageIndex, pageSize } = toPaginationState(search);
  const pageStart = usePageStart<HTMLUListElement>(`${pageIndex}:${pageSize}`, cards);
  const onTableChange = useCallback<SearchChange<SupervisoryNodesSearch>>(
    (update) => onSearchChange(update, false, pageStart.navigation),
    [onSearchChange, pageStart.navigation],
  );
  const searchState = useTableSearchState({
    search,
    defaultSort: NO_SORT,
    onSearchChange: onTableChange,
  });
  const table = useTable({
    features: dataTableFeatures,
    columns,
    data,
    getRowId,
    rowCount,
    manualPagination: true,
    manualSorting: true,
    enableSorting: false,
    ...searchState,
    onPaginationChange: pageStart.onPaginationChange(searchState.onPaginationChange),
    state: { ...searchState.state, columnVisibility },
  });
  return { table, pageStart };
}

export function SupervisoryNodesTableSkeleton({
  cards,
  search,
  columnVisibility,
}: Pick<SupervisoryNodesTableProps, 'cards' | 'search' | 'columnVisibility'>) {
  const { table } = useSupervisoryNodesTable({
    cards: false,
    data: NO_NODES,
    rowCount: 0,
    search,
    onSearchChange: noop,
    columnVisibility,
  });
  const rowCount = toPaginationState(search).pageSize;
  if (cards) return <TableCardsSkeleton rowCount={rowCount} table={table} title="name" />;
  return <DataTableSkeleton layout="auto" rowCount={rowCount} table={table} />;
}

export function SupervisoryNodesTable({
  cards,
  search,
  onSearchChange,
  columnVisibility,
}: SupervisoryNodesTableProps) {
  const { t } = useTranslation();
  const deferredSearch = useDeferredValue(search);
  const { data } = useSuspenseQuery(
    supervisoryNodesPageOptions(toSupervisoryNodesQuery(deferredSearch)),
  );
  const { table, pageStart } = useSupervisoryNodesTable({
    cards,
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
  const footer = !isPastLastPage && data.totalElements > 0 && <DataTablePagination table={table} />;
  const isStale = search !== deferredSearch;
  if (cards) {
    return (
      <TableCards
        busy={isStale}
        empty={!isPastLastPage && empty}
        footer={footer}
        listRef={pageStart.ref}
        table={table}
        title="name"
      />
    );
  }
  return (
    <DataTable
      layout="auto"
      empty={!isPastLastPage && empty}
      footer={footer}
      isStale={isStale}
      table={table}
    />
  );
}
