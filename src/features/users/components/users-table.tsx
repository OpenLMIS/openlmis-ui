import { useSuspenseQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { type ColumnVisibilityState, createColumnHelper, useTable } from '@tanstack/react-table';
import type { TFunction } from 'i18next';
import {
  CheckIcon,
  EllipsisIcon,
  KeyRoundIcon,
  PencilIcon,
  SearchXIcon,
  ShieldIcon,
  UsersIcon,
  XIcon,
} from 'lucide-react';
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
import { usersListOptions } from '@/features/users/api/queries';
import { fullName } from '@/features/users/lib/names';
import {
  CLEARED_USER_FILTERS,
  DEFAULT_USERS_SORT,
  hasUserFilters,
  toUsersQuery,
  type UsersSearch,
} from '@/features/users/lib/search';
import type { UserListItem } from '@/features/users/lib/types';
import { type SearchChange, toPaginationState, useTableSearchState } from '@/lib/table-search';

const columnHelper = createColumnHelper<DataTableFeatures, UserListItem>();

function createColumns(t: TFunction, actions: UserRowActions) {
  return columnHelper.columns([
    // Shows the full name but sorts by last name, the usual order for a list of people.
    columnHelper.accessor('lastName', {
      header: ({ column }) => <DataTableColumnHeader column={column} title={t('users.name')} />,
      meta: { className: '@xl/main:w-2/5 @4xl/main:w-1/4' },
      cell: ({ row }) => fullName(row.original) || '-',
    }),
    columnHelper.accessor('username', {
      header: ({ column }) => <DataTableColumnHeader column={column} title={t('users.username')} />,
      cell: ({ getValue }) => <span className="font-medium">{getValue()}</span>,
      // No width below 4xl, so the username takes the room the hidden columns leave.
      meta: { className: '@4xl/main:w-1/4' },
    }),
    columnHelper.accessor('email', {
      header: ({ column }) => <DataTableColumnHeader column={column} title={t('users.email')} />,
      cell: ({ getValue }) => getValue() ?? <span className="text-muted-foreground">-</span>,
      enableSorting: false,
    }),
    columnHelper.accessor('active', {
      header: ({ column }) => <DataTableColumnHeader column={column} title={t('users.status')} />,
      meta: { className: 'w-32' },
      cell: ({ getValue }) =>
        getValue() ? (
          <Badge variant="success">
            <CheckIcon data-icon="inline-start" />
            {t('users.active')}
          </Badge>
        ) : (
          <Badge variant="destructive">
            <XIcon data-icon="inline-start" />
            {t('users.inactive')}
          </Badge>
        ),
    }),
    columnHelper.display({
      id: 'actions',
      header: () => <span className="sr-only">{t('users.actions')}</span>,
      meta: { className: 'w-16' },
      cell: ({ row }) => (
        <UserActions
          listSearch={actions.listSearch}
          onEdit={() => actions.onEdit(row.original.id)}
          onResetPassword={() => actions.onResetPassword(row.original.id)}
          userId={row.original.id}
          username={row.original.username}
        />
      ),
    }),
  ]);
}

type UserRowActions = {
  onEdit: (userId: string) => void;
  onResetPassword: (userId: string) => void;
  /** Handed to the roles page, so leaving it returns to this page of the list. */
  listSearch: UsersSearch;
};

type UserActionsProps = {
  userId: string;
  username: string;
  listSearch: UsersSearch;
  onEdit: () => void;
  onResetPassword: () => void;
};

function UserActions({ userId, username, listSearch, onEdit, onResetPassword }: UserActionsProps) {
  const { t } = useTranslation();

  return (
    <div className="flex justify-end">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              aria-label={t('users.actions-for', { username })}
              size="icon-sm"
              variant="ghost"
            />
          }
        >
          <EllipsisIcon />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" width="auto">
          <DropdownMenuItem onClick={onEdit}>
            <PencilIcon />
            {t('users.edit')}
          </DropdownMenuItem>
          {/* A link, so it can open in a new tab to compare two users' roles. */}
          <DropdownMenuItem
            render={
              <Link
                params={{ id: userId }}
                state={{ usersListSearch: listSearch }}
                to="/administration/users/$id/roles"
              />
            }
          >
            <ShieldIcon />
            {t('users.roles')}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onResetPassword} variant="destructive">
            <KeyRoundIcon />
            {t('users.reset-password')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

type UsersTableProps = {
  search: UsersSearch;
  onSearchChange: SearchChange<UsersSearch>;
  columnVisibility: ColumnVisibilityState;
} & Omit<UserRowActions, 'listSearch'>;

const NO_USERS: UserListItem[] = [];

const getRowId = (user: UserListItem) => user.id;

const noop = () => {};

/** The one table setup, shared by the real table and its skeleton so both lay out the same. */
function useUsersTable({
  data,
  rowCount,
  search,
  onSearchChange,
  columnVisibility,
  onEdit,
  onResetPassword,
}: UsersTableProps & { data: UserListItem[]; rowCount: number }) {
  const { t } = useTranslation();
  const columns = useMemo(
    () => createColumns(t, { onEdit, onResetPassword, listSearch: search }),
    [t, onEdit, onResetPassword, search],
  );
  const searchState = useTableSearchState({
    search,
    defaultSort: DEFAULT_USERS_SORT,
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

export function UsersTableSkeleton({
  search,
  columnVisibility,
}: Pick<UsersTableProps, 'search' | 'columnVisibility'>) {
  const table = useUsersTable({
    data: NO_USERS,
    rowCount: 0,
    search,
    onSearchChange: noop,
    columnVisibility,
    onEdit: noop,
    onResetPassword: noop,
  });

  return <DataTableSkeleton rowCount={toPaginationState(search).pageSize} table={table} />;
}

export function UsersTable({
  search,
  onSearchChange,
  columnVisibility,
  onEdit,
  onResetPassword,
}: UsersTableProps) {
  const { t } = useTranslation();
  // Keeps the current page on screen, dimmed, while the next one loads instead of suspending.
  const deferredSearch = useDeferredValue(search);
  const { data } = useSuspenseQuery(usersListOptions(toUsersQuery(deferredSearch)));
  // Everything on screen describes the rows on screen; changes still build on the latest URL.
  const table = useUsersTable({
    data: data.content,
    rowCount: data.totalElements,
    search: deferredSearch,
    onSearchChange,
    columnVisibility,
    onEdit,
    onResetPassword,
  });
  const isPastLastPage = data.content.length === 0 && data.totalElements > 0;

  // A stale link or deleted users can point past the end; move to the last page that exists.
  useEffect(() => {
    if (isPastLastPage) {
      onSearchChange({ page: data.totalPages > 1 ? data.totalPages : undefined }, true);
    }
  }, [isPastLastPage, data.totalPages, onSearchChange]);

  const empty = hasUserFilters(deferredSearch) ? (
    <DataTableEmpty
      action={
        <Button onClick={() => onSearchChange(CLEARED_USER_FILTERS)} variant="destructive">
          {t('users.clear-filters')}
        </Button>
      }
      description={t('users.no-results-description')}
      icon={<SearchXIcon />}
      title={t('users.no-results-title')}
    />
  ) : (
    <DataTableEmpty
      description={t('users.empty-description')}
      icon={<UsersIcon />}
      title={t('users.empty-title')}
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
