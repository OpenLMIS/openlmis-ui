import { createColumnHelper, useTable } from '@tanstack/react-table';
import type { TFunction } from 'i18next';
import {
  EllipsisIcon,
  InfoIcon,
  PlusIcon,
  SearchXIcon,
  ShieldIcon,
  Trash2Icon,
  TriangleAlertIcon,
} from 'lucide-react';
import { useCallback, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { CardActions } from '@/components/card-actions';
import {
  DataTable,
  DataTableColumnHeader,
  DataTableEmpty,
  type DataTableFeatures,
  DataTableSkeleton,
  dataTableFeatures,
} from '@/components/data-table/data-table';
import { DataTablePagination } from '@/components/data-table/data-table-pagination';
import { RoleRightsPopover } from '@/components/role-rights-popover';
import { TableCards, TableCardsSkeleton, useInCards } from '@/components/table-cards';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import {
  compareRows,
  filterRows,
  type RoleRow,
  type RoleSortField,
  type RoleTab,
} from '@/features/users/lib/role-assignments';
import {
  DEFAULT_ROLES_SORT,
  type RolesTableSearch,
  TAB_RESET,
} from '@/features/users/lib/roles-search';
import type { LookupStatus } from '@/features/users/lib/use-role-lookups';
import { usePageStart } from '@/hooks/use-page-start';
import {
  type SearchChange,
  toPaginationState,
  toSortingState,
  useTableSearchState,
} from '@/lib/table-search';
import { cn } from '@/lib/utils';

const columnHelper = createColumnHelper<DataTableFeatures, RoleRow>();

type RowActions = {
  /** Left out where the roles are only shown, e.g. on the user's own profile. */
  onRemove?: (row: RoleRow) => void;
};

type ColumnOptions = RowActions & {
  t: TFunction;
  tab: RoleTab;
  status: LookupStatus;
};

function Pending() {
  return (
    <span className="block h-4 w-2/3">
      <Skeleton fill />
    </span>
  );
}

type NameStatus = LookupStatus['nodes'];

function Name({ value, status = 'ready' }: { value: string | undefined; status?: NameStatus }) {
  const { t } = useTranslation();
  const cards = useInCards();
  if (value !== undefined) return <span className={cards ? undefined : 'truncate'}>{value}</span>;
  if (status === 'pending') return <Pending />;
  return <span className="text-muted-foreground">{t('users.roles.unknown')}</span>;
}

/** The node with its facility beneath, or Home Facility with the user's home facility. */
function NodeCell({ row, status }: { row: RoleRow; status: LookupStatus }) {
  const { t } = useTranslation();
  const cards = useInCards();
  const facilityPending =
    status.facilities === 'pending' || (!row.isHomeFacility && status.nodes === 'pending');
  return (
    <span className="flex min-w-0 flex-col">
      {row.isHomeFacility ? (
        <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <span className="truncate">{t('users.roles.home-facility')}</span>
          {row.isIgnored && (
            <Badge variant="warning">
              <TriangleAlertIcon data-icon="inline-start" />
              {t('users.roles.ignored')}
            </Badge>
          )}
        </span>
      ) : (
        <Name status={status.nodes} value={row.node} />
      )}
      {row.isIgnored ? null : row.nodeFacility !== undefined ? (
        <span className={cn('text-muted-foreground text-xs', !cards && 'truncate')}>
          {row.nodeFacility}
        </span>
      ) : (
        facilityPending && <Pending />
      )}
    </span>
  );
}

function RoleCell({ row }: { row: RoleRow }) {
  const { t } = useTranslation();
  const cards = useInCards();

  return (
    <span className={cn('flex min-w-0 items-center gap-2', cards && 'flex-wrap')}>
      {row.role === undefined ? (
        <Name value={undefined} />
      ) : (
        <RoleRightsPopover name={row.role} roleId={row.assignment.roleId} />
      )}
      {row.isUnsaved && (
        <Badge variant="info">
          <InfoIcon data-icon="inline-start" />
          {t('users.roles.unsaved')}
        </Badge>
      )}
    </span>
  );
}

function createColumns(options: ColumnOptions) {
  const { t, tab, status, onRemove } = options;
  const role = columnHelper.accessor('role', {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={t('users.roles.column.role')} />
    ),
    cell: ({ row }) => <RoleCell row={row.original} />,
  });
  const actions = columnHelper.display({
    id: 'actions',
    header: () => <span className="sr-only">{t('users.roles.actions')}</span>,
    meta: { className: 'w-16' },
    cell: ({ row }) => (
      <RoleActions
        onRemove={() => onRemove?.(row.original)}
        role={row.original.role ?? t('users.roles.unknown')}
      />
    ),
  });
  const withActions = onRemove ? [actions] : [];

  if (tab.type === 'SUPERVISION') {
    return columnHelper.columns([
      columnHelper.accessor('program', {
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t('users.roles.column.program')} />
        ),
        meta: { className: 'w-1/5', label: t('users.roles.column.program') },
        cell: ({ getValue }) => <Name value={getValue()} />,
      }),
      columnHelper.accessor('node', {
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t('users.roles.column.node')} />
        ),
        meta: { className: 'w-2/5', label: t('users.roles.column.node') },
        cell: ({ row }) => <NodeCell row={row.original} status={status} />,
      }),
      role,
      ...withActions,
    ]);
  }
  if (tab.type === 'ORDER_FULFILLMENT') {
    return columnHelper.columns([
      columnHelper.accessor('facility', {
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t('users.roles.column.facility')} />
        ),
        meta: { className: 'w-1/2', label: t('users.roles.column.facility') },
        cell: ({ getValue }) => <Name status={status.facilities} value={getValue()} />,
      }),
      role,
      ...withActions,
    ]);
  }
  return columnHelper.columns([role, ...withActions]);
}

function RoleActions({ role, onRemove }: { role: string; onRemove: () => void }) {
  const { t } = useTranslation();

  const label = t('users.roles.actions-for', { role });

  if (useInCards()) {
    return (
      <CardActions
        label={label}
        actions={[
          {
            id: 'remove',
            icon: <Trash2Icon />,
            label: t('users.roles.remove'),
            destructive: true,
            onSelect: onRemove,
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
          <DropdownMenuItem onClick={onRemove} variant="destructive">
            <Trash2Icon />
            {t('users.roles.remove')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

type RoleAssignmentsTableProps = RowActions & {
  tab: RoleTab;
  /** Every row of the tab, unfiltered; the table filters, sorts and pages them. */
  rows: RoleRow[];
  status: LookupStatus;
  cards: boolean;
  search: RolesTableSearch;
  onSearchChange: SearchChange<RolesTableSearch>;
  onAdd?: () => void;
};

const noop = () => {};

const SKELETON_STATUS: LookupStatus = { nodes: 'pending', facilities: 'pending' };

function useRoleTable({
  rows,
  tab,
  cards,
  status,
  search,
  onSearchChange,
  onRemove,
}: Omit<RoleAssignmentsTableProps, 'onAdd'>) {
  const { t } = useTranslation();
  const columns = useMemo(
    () => createColumns({ t, tab, status, onRemove }),
    [t, tab, status, onRemove],
  );
  const { pageIndex, pageSize } = toPaginationState(search);
  const pageStart = usePageStart<HTMLUListElement>(`${pageIndex}:${pageSize}`, cards);
  const onTableChange = useCallback<SearchChange<RolesTableSearch>>(
    (update) => onSearchChange(update, false, pageStart.navigation),
    [onSearchChange, pageStart.navigation],
  );
  const searchState = useTableSearchState({
    search,
    defaultSort: DEFAULT_ROLES_SORT,
    onSearchChange: onTableChange,
  });

  const [{ id, desc }] = toSortingState(search, DEFAULT_ROLES_SORT) as [
    { id: RoleSortField; desc: boolean },
  ];
  const matching = useMemo(
    () => filterRows(rows, search.q).sort(compareRows(id, desc)),
    [rows, search.q, id, desc],
  );
  const data = useMemo(
    () => matching.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize),
    [matching, pageIndex, pageSize],
  );

  const table = useTable({
    features: dataTableFeatures,
    columns,
    data,
    getRowId: (row) => row.id,
    rowCount: matching.length,
    manualPagination: true,
    manualSorting: true,
    enableSortingRemoval: false,
    ...searchState,
    onPaginationChange: pageStart.onPaginationChange(searchState.onPaginationChange),
  });

  return { table, matching: matching.length, pageStart };
}

export function RoleAssignmentsTableSkeleton({
  tab,
  cards,
  search,
  onRemove,
}: Pick<RoleAssignmentsTableProps, 'tab' | 'cards' | 'search' | 'onRemove'>) {
  const { table } = useRoleTable({
    rows: [],
    tab,
    cards: false,
    status: SKELETON_STATUS,
    search,
    onSearchChange: noop,
    onRemove,
  });
  if (cards) return <TableCardsSkeleton rowCount={5} table={table} title="role" />;
  return <DataTableSkeleton rowCount={5} table={table} />;
}

export function RoleAssignmentsTable({ onAdd, ...props }: RoleAssignmentsTableProps) {
  const { t } = useTranslation();
  const { rows, tab, cards, onSearchChange } = props;
  const { table, matching, pageStart } = useRoleTable(props);
  const pageCount = table.getPageCount();
  const isPastLastPage = table.getRowModel().rows.length === 0 && matching > 0;

  // A removal or a stale link can leave the page past the end; move to the last page that exists.
  useEffect(() => {
    if (isPastLastPage) onSearchChange({ page: pageCount > 1 ? pageCount : undefined }, true);
  }, [isPastLastPage, pageCount, onSearchChange]);

  const empty =
    rows.length === 0 ? (
      <DataTableEmpty
        action={
          onAdd && (
            <Button onClick={onAdd} variant="outline">
              <PlusIcon data-icon="inline-start" />
              {t('users.roles.add')}
            </Button>
          )
        }
        description={t(onAdd ? `users.roles.empty.${tab.id}` : 'users.roles.empty-read-only')}
        icon={<ShieldIcon />}
        title={t('users.roles.empty-title')}
      />
    ) : (
      <DataTableEmpty
        action={
          <Button onClick={() => onSearchChange(TAB_RESET)} variant="destructive">
            {t('users.roles.clear-filters')}
          </Button>
        }
        description={t('users.roles.no-results-description')}
        icon={<SearchXIcon />}
        title={t('users.roles.no-results-title')}
      />
    );

  const footer = matching > 0 && <DataTablePagination table={table} />;
  if (cards) {
    return (
      <TableCards
        empty={!isPastLastPage && empty}
        footer={footer}
        listRef={pageStart.ref}
        table={table}
        title="role"
      />
    );
  }
  return <DataTable empty={!isPastLastPage && empty} footer={footer} table={table} />;
}
