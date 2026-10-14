import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { type ColumnVisibilityState, createColumnHelper, useTable } from '@tanstack/react-table';
import { isAxiosError } from 'axios';
import type { TFunction } from 'i18next';
import { EllipsisIcon, EyeIcon, NetworkIcon, PencilIcon, SearchXIcon } from 'lucide-react';
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
import { ListError } from '@/components/list-error';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { facilitiesByIdsOptions } from '@/features/reference-data/api/queries';
import { requisitionGroupsSearchOptions } from '@/features/requisition-groups/api/queries';
import { ProgramNamesCell } from '@/features/requisition-groups/components/program-names-cell';
import {
  CLEARED_REQUISITION_GROUP_FILTERS,
  type RequisitionGroupsListSearch,
  toRequisitionGroupsQuery,
  toSearchBody,
} from '@/features/requisition-groups/lib/search';
import type { RequisitionGroup } from '@/features/requisition-groups/lib/types';
import { type SearchChange, toPaginationState, useTableSearchState } from '@/lib/table-search';

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
        <span className="font-medium" dir="auto">
          {getValue()}
        </span>
      ),
      meta: { className: '@xl/main:w-2/5 @5xl/main:w-1/4' },
    }),
    columnHelper.display({
      id: 'program',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('requisition-groups.program')} />
      ),
      cell: ({ row }) => (
        <ProgramNamesCell schedules={row.original.requisitionGroupProgramSchedules} />
      ),
    }),
    columnHelper.accessor('code', {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('requisition-groups.code')} />
      ),
    }),
    columnHelper.accessor((group) => group.supervisoryNode.name, {
      id: 'supervisoryNode',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('requisition-groups.supervisory-node')} />
      ),
    }),
    columnHelper.display({
      id: 'zone',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('requisition-groups.zone')} />
      ),
      cell: ({ row }) => {
        const facilityId = row.original.supervisoryNode.facility?.id;
        if (!facilityId) return null;
        return zonesPending ? (
          <div className="h-4 w-24">
            <Skeleton fill />
          </div>
        ) : (
          (zones.get(facilityId) ?? null)
        );
      },
    }),
    columnHelper.accessor((group) => group.memberFacilities.length, {
      id: 'facilityCount',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('requisition-groups.facility-count')} />
      ),
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
  return (
    <div className="flex justify-end">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              aria-label={t('requisition-groups.actions-for', { name: group.name })}
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
                  to={`/administration/requisition-groups/${group.id}` as string}
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

export function RequisitionGroupsTableSkeleton({
  search,
  columnVisibility,
}: Pick<RequisitionGroupsTableProps, 'search' | 'columnVisibility'>) {
  const table = useRequisitionGroupsTable({
    data: NO_GROUPS,
    rowCount: 0,
    search,
    onSearchChange: noop,
    columnVisibility,
  });
  return <DataTableSkeleton rowCount={toPaginationState(search).pageSize} table={table} />;
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
  onSearchChange,
}: {
  error: unknown;
  reset: () => void;
  onSearchChange: SearchChange<RequisitionGroupsListSearch>;
}) {
  const { t } = useTranslation();
  const messageKey =
    isAxiosError<{ messageKey?: string }>(error) && error.response?.status === 400
      ? error.response.data?.messageKey
      : undefined;
  if (
    messageKey === 'referenceData.error.geographicZone.notFound' ||
    messageKey === 'referenceData.error.program.notFound'
  ) {
    return <RequisitionGroupsNoMatches onSearchChange={onSearchChange} />;
  }
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
  search,
  onSearchChange,
  columnVisibility,
}: RequisitionGroupsTableProps) {
  const { t } = useTranslation();
  const deferredSearch = useDeferredValue(search);
  const { data } = useSuspenseQuery(
    requisitionGroupsSearchOptions(toRequisitionGroupsQuery(deferredSearch)),
  );
  const facilityIds = useMemo(
    () =>
      [
        ...new Set(
          data.content.flatMap((group) =>
            group.supervisoryNode.facility?.id ? [group.supervisoryNode.facility.id] : [],
          ),
        ),
      ].sort(),
    [data.content],
  );
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
  const table = useRequisitionGroupsTable({
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
    Object.keys(toSearchBody(deferredSearch)).length > 0 ? (
      <RequisitionGroupsNoMatches onSearchChange={onSearchChange} />
    ) : (
      <DataTableEmpty
        description={t('requisition-groups.empty-description')}
        icon={<NetworkIcon />}
        title={t('requisition-groups.empty-title')}
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
