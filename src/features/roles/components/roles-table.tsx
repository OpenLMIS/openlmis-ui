import { useSuspenseQuery } from '@tanstack/react-query';
import { type ColumnVisibilityState, createColumnHelper, useTable } from '@tanstack/react-table';
import type { TFunction } from 'i18next';
import { EllipsisIcon, ListChecksIcon, PencilIcon, SearchXIcon, ShieldIcon } from 'lucide-react';
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
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { rolesOptions } from '@/features/reference-data/api/queries';
import { roleTypeInfo, roleTypeOf } from '@/features/reference-data/lib/roles';
import type { Role } from '@/features/reference-data/lib/types';
import { filterRoles, sortRoles } from '@/features/roles/lib/roles-list';
import {
  CLEARED_ROLE_FILTERS,
  DEFAULT_ROLES_SORT,
  hasRoleFilters,
  type RoleSortField,
  type RolesSearch,
} from '@/features/roles/lib/search';
import { useMenuOpensDialog } from '@/hooks/use-menu-opens-dialog';
import {
  type SearchChange,
  toPaginationState,
  toSortingState,
  useTableSearchState,
} from '@/lib/table-search';

/** What the signed-in user may do with a role; an action left out is not offered. */
type RoleRowActions = {
  onEdit?: (roleId: string) => void;
  onViewRights?: (roleId: string) => void;
};

const columnHelper = createColumnHelper<DataTableFeatures, Role>();

function createColumns(t: TFunction, actions: RoleRowActions) {
  const hasActions = Boolean(actions.onEdit || actions.onViewRights);
  return columnHelper.columns([
    columnHelper.accessor('name', {
      header: ({ column }) => <DataTableColumnHeader column={column} title={t('roles.name')} />,
      cell: ({ getValue }) => <span className="font-medium">{getValue()}</span>,
      meta: { className: '@xl/main:w-1/3 @4xl/main:w-1/4' },
    }),
    columnHelper.accessor((role) => roleTypeOf(role), {
      id: 'type',
      header: ({ column }) => <DataTableColumnHeader column={column} title={t('roles.type')} />,
      cell: ({ getValue }) => {
        const type = getValue();
        return type ? (
          t(roleTypeInfo(type).labelKey)
        ) : (
          <span className="text-muted-foreground">{t('roles.no-type')}</span>
        );
      },
      meta: { className: '@xl/main:w-40' },
    }),
    columnHelper.accessor('description', {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('roles.description')} />
      ),
      cell: ({ getValue }) => getValue() || <span className="text-muted-foreground">-</span>,
      enableSorting: false,
    }),
    columnHelper.accessor('count', {
      header: ({ column }) => <DataTableColumnHeader column={column} title={t('roles.users')} />,
      cell: ({ getValue }) => <span className="tabular-nums">{getValue() ?? 0}</span>,
      meta: { className: 'w-36' },
    }),
    ...(hasActions
      ? [
          columnHelper.display({
            id: 'actions',
            header: () => <span className="sr-only">{t('roles.actions')}</span>,
            meta: { className: 'w-16' },
            cell: ({ row }) => <RoleActions actions={actions} role={row.original} />,
          }),
        ]
      : []),
  ]);
}

function RoleActions({ role, actions }: { role: Role; actions: RoleRowActions }) {
  const { t } = useTranslation();
  const { onEdit, onViewRights } = actions;
  const menu = useMenuOpensDialog();

  return (
    <div className="flex justify-end">
      <DropdownMenu onOpenChange={menu.onOpenChange}>
        <DropdownMenuTrigger
          render={
            <Button
              aria-label={t('roles.actions-for', { role: role.name })}
              size="icon-sm"
              variant="ghost"
            />
          }
        >
          <EllipsisIcon />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" finalFocus={menu.finalFocus} width="auto">
          {onEdit && (
            <DropdownMenuItem onClick={menu.opensDialog(() => onEdit(role.id))}>
              <PencilIcon />
              {t('roles.edit')}
            </DropdownMenuItem>
          )}
          {onViewRights && (
            <DropdownMenuItem onClick={menu.opensDialog(() => onViewRights(role.id))}>
              <ListChecksIcon />
              {t('roles.view-rights')}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

type RolesTableProps = RoleRowActions & {
  search: RolesSearch;
  onSearchChange: SearchChange<RolesSearch>;
  columnVisibility: ColumnVisibilityState;
};

const NO_ROLES: Role[] = [];

const getRowId = (role: Role) => role.id;

const noop = () => {};

/** One table setup for the table and its skeleton; `GET /roles` cannot page or sort, so it happens here. */
function useRolesTable({
  roles,
  search,
  onSearchChange,
  columnVisibility,
  onEdit,
  onViewRights,
}: Omit<RolesTableProps, 'search'> & { roles: Role[]; search: RolesSearch }) {
  const { t } = useTranslation();
  const columns = useMemo(
    () => createColumns(t, { onEdit, onViewRights }),
    [t, onEdit, onViewRights],
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
    () => sortRoles(filterRoles(roles, { q: search.q, type: search.type }), id, desc),
    [roles, search.q, search.type, id, desc],
  );
  const data = useMemo(
    () => matching.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize),
    [matching, pageIndex, pageSize],
  );

  const table = useTable({
    features: dataTableFeatures,
    columns,
    data,
    getRowId,
    rowCount: matching.length,
    manualPagination: true,
    manualSorting: true,
    enableSortingRemoval: false,
    ...searchState,
    state: { ...searchState.state, columnVisibility },
  });

  return { table, matching: matching.length };
}

export function RolesTableSkeleton({
  search,
  columnVisibility,
  onEdit,
  onViewRights,
}: Pick<RolesTableProps, 'search' | 'columnVisibility' | 'onEdit' | 'onViewRights'>) {
  const { table } = useRolesTable({
    roles: NO_ROLES,
    search,
    onSearchChange: noop,
    columnVisibility,
    onEdit,
    onViewRights,
  });
  return <DataTableSkeleton rowCount={toPaginationState(search).pageSize} table={table} />;
}

export function RolesTable({ search, onSearchChange, ...props }: RolesTableProps) {
  const { t } = useTranslation();
  const { data: roles } = useSuspenseQuery(rolesOptions());
  const { table, matching } = useRolesTable({ roles, search, onSearchChange, ...props });
  const pageCount = table.getPageCount();
  const isPastLastPage = matching > 0 && toPaginationState(search).pageIndex >= pageCount;

  // A stale link, or a filter that leaves fewer pages, can point past the end.
  useEffect(() => {
    if (isPastLastPage) onSearchChange({ page: pageCount > 1 ? pageCount : undefined }, true);
  }, [isPastLastPage, pageCount, onSearchChange]);

  const empty = hasRoleFilters(search) ? (
    <DataTableEmpty
      action={
        <Button onClick={() => onSearchChange(CLEARED_ROLE_FILTERS)} variant="destructive">
          {t('roles.clear-filters')}
        </Button>
      }
      description={t('roles.no-results-description')}
      icon={<SearchXIcon />}
      title={t('roles.no-results-title')}
    />
  ) : (
    <DataTableEmpty
      description={t('roles.empty-description')}
      icon={<ShieldIcon />}
      title={t('roles.empty-title')}
    />
  );

  return (
    <DataTable
      empty={!isPastLastPage && empty}
      footer={!isPastLastPage && matching > 0 && <DataTablePagination table={table} />}
      table={table}
    />
  );
}
