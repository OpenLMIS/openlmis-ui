import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { type ColumnVisibilityState, createColumnHelper, useTable } from '@tanstack/react-table';
import type { TFunction } from 'i18next';
import { EllipsisIcon, EyeIcon, NetworkIcon, PencilIcon, SearchXIcon } from 'lucide-react';
import { useDeferredValue, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { CardActions, useInCards } from '@/components/card-actions';
import {
  DataTable,
  DataTableColumnHeader,
  DataTableEmpty,
  type DataTableFeatures,
  DataTableSkeleton,
  dataTableFeatures,
} from '@/components/data-table/data-table';
import { DataTablePagination } from '@/components/data-table/data-table-pagination';
import { ListError } from '@/components/list-error';
import { Block } from '@/components/skeleton-block';
import { TableCards, TableCardsSkeleton } from '@/components/table-cards';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { facilitiesByIdsOptions } from '@/features/reference-data/api/queries';
import type { RequisitionGroup } from '@/features/reference-data/lib/types';
import {
  requisitionGroupNodeFacilityIds,
  requisitionGroupsSearchOptions,
} from '@/features/requisition-groups/api/queries';
import { ProgramNamesCell } from '@/features/requisition-groups/components/program-names-cell';
import {
  CLEARED_REQUISITION_GROUP_FILTERS,
  type RequisitionGroupsListSearch,
  toRequisitionGroupsQuery,
  toSearchBody,
} from '@/features/requisition-groups/lib/search';
import { usePagedTableSearch } from '@/hooks/use-page-start';
import { type SearchChange, toPaginationState } from '@/lib/table-search';

const columnHelper = createColumnHelper<DataTableFeatures, RequisitionGroup>();

function createColumns(
  t: TFunction,
  search: RequisitionGroupsListSearch,
  zones: Map<string, string>,
  zonesPending: boolean,
) {
  return columnHelper.columns([
    columnHelper.accessor('name', {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('requisition-groups.name')} />
      ),
      cell: ({ getValue }) => (
        <span className="font-medium whitespace-normal break-words" dir="auto">
          {getValue()}
        </span>
      ),
      meta: { className: 'w-3/5 @xl/main:w-2/5 @5xl/main:w-1/4' },
    }),
    columnHelper.display({
      id: 'program',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('requisition-groups.program')} />
      ),
      cell: ({ row }) =>
        row.original.requisitionGroupProgramSchedules.length > 0 ? (
          <ProgramNamesCell
            name={row.original.name}
            schedules={row.original.requisitionGroupProgramSchedules}
          />
        ) : null,
      meta: { label: t('requisition-groups.program') },
    }),
    columnHelper.accessor('code', {
      cell: ({ getValue }) => (
        <span className="whitespace-normal break-words" dir="auto">
          {getValue()}
        </span>
      ),
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('requisition-groups.code')} />
      ),
      meta: { label: t('requisition-groups.code') },
    }),
    columnHelper.accessor((group) => group.supervisoryNode.name, {
      id: 'supervisoryNode',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('requisition-groups.supervisory-node')} />
      ),
      meta: { label: t('requisition-groups.supervisory-node') },
    }),
    columnHelper.display({
      id: 'zone',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('requisition-groups.zone')} />
      ),
      cell: ({ row }) => {
        const facilityId = row.original.supervisoryNode.facility?.id;
        if (!facilityId) return null;
        return zonesPending ? <Block className="h-4 w-24" /> : (zones.get(facilityId) ?? null);
      },
      meta: { label: t('requisition-groups.zone') },
    }),
    columnHelper.accessor((group) => group.memberFacilities.length, {
      id: 'facilityCount',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('requisition-groups.facility-count')} />
      ),
      meta: { label: t('requisition-groups.facility-count') },
    }),
    columnHelper.display({
      id: 'actions',
      header: () => <span className="sr-only">{t('requisition-groups.actions')}</span>,
      meta: { className: 'w-16' },
      cell: ({ row }) => <RequisitionGroupActions group={row.original} search={search} />,
    }),
  ]);
}

function RequisitionGroupActions({
  group,
  search,
}: {
  group: RequisitionGroup;
  search: RequisitionGroupsListSearch;
}) {
  const { t } = useTranslation();
  const label = t('requisition-groups.actions-for', {
    name: group.name,
    code: group.code,
  });

  if (useInCards()) {
    return (
      <CardActions
        label={label}
        actions={[
          {
            id: 'edit',
            icon: <PencilIcon />,
            label: t('requisition-groups.edit'),
            link: (
              <Link
                to="/administration/requisition-groups/$id/edit"
                params={{ id: group.id }}
                state={{ requisitionGroupsListSearch: search }}
              />
            ),
          },
          {
            id: 'view',
            icon: <EyeIcon />,
            label: t('requisition-groups.view'),
            link: (
              <Link
                to="/administration/requisition-groups/$id"
                params={{ id: group.id }}
                state={{ requisitionGroupsListSearch: search }}
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
                  to="/administration/requisition-groups/$id"
                  params={{ id: group.id }}
                  state={{ requisitionGroupsListSearch: search }}
                />
              }
            >
              <EyeIcon />
              {t('requisition-groups.view')}
            </DropdownMenuItem>
            <DropdownMenuItem
              render={
                <Link
                  to="/administration/requisition-groups/$id/edit"
                  params={{ id: group.id }}
                  state={{ requisitionGroupsListSearch: search }}
                />
              }
            >
              <PencilIcon />
              {t('requisition-groups.edit')}
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

type RequisitionGroupsTableProps = {
  cards: boolean;
  search: RequisitionGroupsListSearch;
  onSearchChange: SearchChange<RequisitionGroupsListSearch>;
  columnVisibility: ColumnVisibilityState;
};

const NO_GROUPS: RequisitionGroup[] = [];
const NO_ZONES = new Map<string, string>();
const NO_SORT = { id: 'name', desc: false };
const getRowId = (group: RequisitionGroup) => group.id;
const noop = () => {};

function useRequisitionGroupsTable({
  cards,
  data,
  rowCount,
  search,
  onSearchChange,
  columnVisibility,
  zones = NO_ZONES,
  zonesPending = false,
}: RequisitionGroupsTableProps & {
  data: RequisitionGroup[];
  rowCount: number;
  zones?: Map<string, string>;
  zonesPending?: boolean;
}) {
  const { t } = useTranslation();
  const columns = useMemo(
    () => createColumns(t, search, zones, zonesPending),
    [t, search, zones, zonesPending],
  );
  const { pageStart, searchState } = usePagedTableSearch({
    search,
    defaultSort: NO_SORT,
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
    enableSorting: false,
    ...searchState,
    state: { ...searchState.state, columnVisibility },
  });
  return { table, pageStart };
}

export function RequisitionGroupsTableSkeleton({
  cards,
  search,
  columnVisibility,
}: Pick<RequisitionGroupsTableProps, 'cards' | 'search' | 'columnVisibility'>) {
  const { table } = useRequisitionGroupsTable({
    cards: false,
    data: NO_GROUPS,
    rowCount: 0,
    search,
    onSearchChange: noop,
    columnVisibility,
  });
  const rowCount = toPaginationState(search).pageSize;
  if (cards)
    return <TableCardsSkeleton rowCount={rowCount} table={table} title="name" actions={2} />;
  return <DataTableSkeleton rowCount={rowCount} table={table} />;
}

function RequisitionGroupsNoMatches({
  onSearchChange,
}: Pick<RequisitionGroupsTableProps, 'onSearchChange'>) {
  const { t } = useTranslation();
  return (
    <DataTableEmpty
      action={
        <Button
          onClick={() => onSearchChange(CLEARED_REQUISITION_GROUP_FILTERS, true)}
          variant="destructive"
        >
          {t('requisition-groups.clear-filters')}
        </Button>
      }
      description={t('requisition-groups.no-results-description')}
      icon={<SearchXIcon />}
      title={t('requisition-groups.no-results-title')}
    />
  );
}

export function RequisitionGroupsListError({
  error,
  reset,
}: {
  error: unknown;
  reset: () => void;
}) {
  const { t } = useTranslation();
  return (
    <ListError
      description={t('requisition-groups.error-description')}
      error={error}
      reset={reset}
      title={t('requisition-groups.error-title')}
    />
  );
}

export function RequisitionGroupsTable({
  cards,
  search,
  onSearchChange,
  columnVisibility,
}: RequisitionGroupsTableProps) {
  const { t } = useTranslation();
  const deferredSearch = useDeferredValue(search);
  const { data } = useSuspenseQuery(
    requisitionGroupsSearchOptions(toRequisitionGroupsQuery(deferredSearch)),
  );
  const facilityIds = useMemo(() => requisitionGroupNodeFacilityIds(data.content), [data.content]);
  const facilities = useQuery({
    ...facilitiesByIdsOptions(facilityIds),
    enabled: facilityIds.length > 0,
  });
  const zones = useMemo(
    () =>
      new Map(
        (facilities.data ?? []).map((facility) => [
          facility.id,
          facility.geographicZone?.name ?? '',
        ]),
      ),
    [facilities.data],
  );
  const { table, pageStart } = useRequisitionGroupsTable({
    cards,
    data: data.content,
    rowCount: data.totalElements,
    search: deferredSearch,
    onSearchChange,
    columnVisibility,
    zones,
    zonesPending: facilities.isPending,
  });
  const isPastLastPage = data.content.length === 0 && data.totalElements > 0;

  useEffect(() => {
    if (isPastLastPage)
      onSearchChange({ page: data.totalPages > 1 ? data.totalPages : undefined }, true);
  }, [isPastLastPage, data.totalPages, onSearchChange]);

  const empty =
    data.unknownFilter || Object.keys(toSearchBody(deferredSearch)).length > 0 ? (
      <RequisitionGroupsNoMatches onSearchChange={onSearchChange} />
    ) : (
      <DataTableEmpty
        description={t('requisition-groups.empty-description')}
        icon={<NetworkIcon />}
        title={t('requisition-groups.empty-title')}
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
    <DataTable empty={!isPastLastPage && empty} footer={footer} isStale={isStale} table={table} />
  );
}
