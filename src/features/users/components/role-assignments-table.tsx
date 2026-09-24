import { createColumnHelper, useTable } from '@tanstack/react-table';
import type { TFunction } from 'i18next';
import {
  EllipsisIcon,
  ListChecksIcon,
  PlusIcon,
  SearchXIcon,
  ShieldIcon,
  Trash2Icon,
  TriangleAlertIcon,
} from 'lucide-react';
import { useEffect, useMemo } from 'react';
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
import { Skeleton } from '@/components/ui/skeleton';
import {
  compareRows,
  filterRows,
  type RoleRow,
  type RoleSortField,
  type RoleTab,
} from '@/features/users/lib/role-assignments';
import { DEFAULT_ROLES_SORT, type RolesSearch, TAB_RESET } from '@/features/users/lib/roles-search';
import {
  type SearchUpdate,
  toPaginationState,
  toSortingState,
  useTableSearchState,
} from '@/lib/table-search';

const columnHelper = createColumnHelper<DataTableFeatures, RoleRow>();

type RowActions = {
  onRemove: (row: RoleRow) => void;
  onViewRights: (roleId: string) => void;
};

type ColumnOptions = RowActions & {
  t: TFunction;
  tab: RoleTab;
  /** Too narrow for a column each, so the role cell carries the rest on lines of its own. */
  compact: boolean;
  pending: { nodes: boolean; facilities: boolean };
};

function Pending() {
  return (
    <span className="block h-4 w-2/3">
      <Skeleton fill />
    </span>
  );
}

/** A name, a placeholder while its lookup loads, or "Unknown" when the record is gone. */
function Name({ value, pending }: { value: string | undefined; pending: boolean }) {
  const { t } = useTranslation();
  if (value !== undefined) return <span className="truncate">{value}</span>;
  if (pending) return <Pending />;
  return <span className="text-muted-foreground">{t('users.roles.unknown')}</span>;
}

/** The node with its facility beneath, or Home Facility with the user's home facility. */
function NodeCell({ row, pending }: { row: RoleRow; pending: ColumnOptions['pending'] }) {
  const { t } = useTranslation();
  const facilityPending = pending.facilities || (!row.isHomeFacility && pending.nodes);
  return (
    <span className="flex min-w-0 flex-col">
      {row.isHomeFacility ? (
        <span className="truncate">{t('users.roles.home-facility')}</span>
      ) : (
        <Name pending={pending.nodes} value={row.node} />
      )}
      {row.nodeFacility !== undefined ? (
        <span className="truncate text-muted-foreground text-xs">{row.nodeFacility}</span>
      ) : (
        facilityPending && <Pending />
      )}
    </span>
  );
}

function RoleCell({ row, options }: { row: RoleRow; options: ColumnOptions }) {
  const { t } = useTranslation();
  const { tab, compact, pending } = options;

  return (
    <span className="flex min-w-0 flex-col gap-1">
      <span className="flex min-w-0 items-center gap-2 font-medium">
        <Name pending={false} value={row.role} />
        {row.isUnsaved && <Badge variant="secondary">{t('users.roles.unsaved')}</Badge>}
      </span>
      {compact && tab.type === 'SUPERVISION' && (
        <span className="flex min-w-0 flex-col text-muted-foreground text-xs">
          <Name pending={false} value={row.program} />
          <NodeCell pending={pending} row={row} />
        </span>
      )}
      {compact && tab.type === 'ORDER_FULFILLMENT' && (
        <span className="text-muted-foreground text-xs">
          <Name pending={pending.facilities} value={row.facility} />
        </span>
      )}
      {row.isIgnored && (
        <span>
          <Badge variant="warning">
            <TriangleAlertIcon data-icon="inline-start" />
            {t('users.roles.ignored')}
          </Badge>
        </span>
      )}
    </span>
  );
}

function createColumns(options: ColumnOptions) {
  const { t, tab, compact, pending } = options;
  const role = columnHelper.accessor('role', {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={t('users.roles.column.role')} />
    ),
    cell: ({ row }) => <RoleCell options={options} row={row.original} />,
  });
  const actions = columnHelper.display({
    id: 'actions',
    header: () => <span className="sr-only">{t('users.roles.actions')}</span>,
    meta: { className: 'w-16' },
    cell: ({ row }) => (
      <RoleActions
        onRemove={() => options.onRemove(row.original)}
        onViewRights={() => options.onViewRights(row.original.assignment.roleId)}
        role={row.original.role ?? t('users.roles.unknown')}
      />
    ),
  });

  if (compact) return columnHelper.columns([role, actions]);

  if (tab.type === 'SUPERVISION') {
    return columnHelper.columns([
      role,
      columnHelper.accessor('program', {
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t('users.roles.column.program')} />
        ),
        meta: { className: 'w-1/5' },
        cell: ({ getValue }) => <Name pending={false} value={getValue()} />,
      }),
      columnHelper.accessor('node', {
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t('users.roles.column.node')} />
        ),
        meta: { className: 'w-2/5' },
        cell: ({ row }) => <NodeCell pending={pending} row={row.original} />,
      }),
      actions,
    ]);
  }
  if (tab.type === 'ORDER_FULFILLMENT') {
    return columnHelper.columns([
      role,
      columnHelper.accessor('facility', {
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t('users.roles.column.facility')} />
        ),
        meta: { className: 'w-1/2' },
        cell: ({ getValue }) => <Name pending={pending.facilities} value={getValue()} />,
      }),
      actions,
    ]);
  }
  return columnHelper.columns([
    role,
    columnHelper.accessor('description', {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('users.roles.column.description')} />
      ),
      enableSorting: false,
      meta: { className: 'w-1/2' },
      cell: ({ getValue }) => (
        <span className="truncate text-muted-foreground">{getValue() ?? '-'}</span>
      ),
    }),
    actions,
  ]);
}

function RoleActions({
  role,
  onRemove,
  onViewRights,
}: {
  role: string;
  onRemove: () => void;
  onViewRights: () => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="flex justify-end">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              aria-label={t('users.roles.actions-for', { role })}
              size="icon-sm"
              variant="ghost"
            />
          }
        >
          <EllipsisIcon />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" width="auto">
          <DropdownMenuItem onClick={onViewRights}>
            <ListChecksIcon />
            {t('users.roles.view-rights')}
          </DropdownMenuItem>
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
  pending: ColumnOptions['pending'];
  compact: boolean;
  search: RolesSearch;
  onSearchChange: (
    update: Partial<RolesSearch> | SearchUpdate<RolesSearch>,
    replace?: boolean,
  ) => void;
  onAdd: () => void;
};

const noop = () => {};

function useRoleTable({
  rows,
  tab,
  compact,
  pending,
  search,
  onSearchChange,
  onRemove,
  onViewRights,
}: Omit<RoleAssignmentsTableProps, 'onAdd'>) {
  const { t } = useTranslation();
  const columns = useMemo(
    () => createColumns({ t, tab, compact, pending, onRemove, onViewRights }),
    [t, tab, compact, pending, onRemove, onViewRights],
  );
  const searchState = useTableSearchState({
    search,
    defaultSort: DEFAULT_ROLES_SORT,
    onSearchChange,
  });

  const [{ id, desc }] = toSortingState(search, DEFAULT_ROLES_SORT) as [
    { id: RoleSortField; desc: boolean },
  ];
  const { pageIndex, pageSize } = toPaginationState(search);
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
  });

  return { table, matching: matching.length, shown: data.length };
}

export function RoleAssignmentsTableSkeleton({
  tab,
  compact,
  search,
}: Pick<RoleAssignmentsTableProps, 'tab' | 'compact' | 'search'>) {
  const { table } = useRoleTable({
    rows: [],
    tab,
    compact,
    pending: { nodes: true, facilities: true },
    search,
    onSearchChange: noop,
    onRemove: noop,
    onViewRights: noop,
  });
  return <DataTableSkeleton rowCount={5} table={table} />;
}

export function RoleAssignmentsTable({ onAdd, ...props }: RoleAssignmentsTableProps) {
  const { t } = useTranslation();
  const { rows, tab, search, onSearchChange } = props;
  const { table, matching, shown } = useRoleTable(props);
  const pageCount = Math.max(1, Math.ceil(matching / toPaginationState(search).pageSize));
  const isPastLastPage = shown === 0 && matching > 0;

  // A removal or a stale link can leave the page past the end; move to the last page that exists.
  useEffect(() => {
    if (isPastLastPage) onSearchChange({ page: pageCount > 1 ? pageCount : undefined }, true);
  }, [isPastLastPage, pageCount, onSearchChange]);

  const empty =
    rows.length === 0 ? (
      <DataTableEmpty
        action={
          <Button onClick={onAdd} variant="outline">
            <PlusIcon data-icon="inline-start" />
            {t('users.roles.add')}
          </Button>
        }
        description={t(`users.roles.empty.${tab.id}`)}
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

  return (
    <DataTable
      empty={!isPastLastPage && empty}
      footer={matching > 0 && <DataTablePagination table={table} />}
      table={table}
    />
  );
}
