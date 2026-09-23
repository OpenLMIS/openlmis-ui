import { useSuspenseQuery } from '@tanstack/react-query';
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
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { usersListOptions } from '@/features/users/api/queries';
import {
  CLEARED_USER_FILTERS,
  DEFAULT_USERS_SORT,
  hasUserFilters,
  toUsersQuery,
  type UsersSearch,
} from '@/features/users/lib/search';
import type { UserListItem } from '@/features/users/lib/types';
import { type SearchUpdate, toPaginationState, useTableSearchState } from '@/lib/table-search';

const columnHelper = createColumnHelper<DataTableFeatures, UserListItem>();

function fullName(user: UserListItem) {
  return [user.firstName, user.lastName].filter(Boolean).join(' ');
}

function createColumns(t: TFunction) {
  return columnHelper.columns([
    // Shows the full name but sorts by last name, the usual order for a list of people.
    columnHelper.accessor('lastName', {
      header: ({ column }) => <DataTableColumnHeader column={column} title={t('users.name')} />,
      meta: { className: '@xl/main:w-2/5 @4xl/main:w-1/5' },
      cell: ({ row }) => fullName(row.original) || '-',
    }),
    columnHelper.accessor('username', {
      header: ({ column }) => <DataTableColumnHeader column={column} title={t('users.username')} />,
      cell: ({ getValue }) => <span className="font-medium">{getValue()}</span>,
      // No width below 4xl, so the username takes the room the hidden columns leave.
      meta: { className: '@4xl/main:w-1/6' },
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
      meta: { className: 'w-16 @2xl/main:w-32' },
      cell: ({ row }) => <UserActions username={row.original.username} />,
    }),
  ]);
}

// TODO: Wire up once the edit, roles and password reset screens exist.
function UserActions({ username }: { username: string }) {
  const { t } = useTranslation();
  const actions = [
    { id: 'edit', label: t('users.edit'), icon: PencilIcon, variant: 'default' },
    { id: 'roles', label: t('users.roles'), icon: ShieldIcon, variant: 'outline' },
    {
      id: 'reset-password',
      label: t('users.reset-password'),
      icon: KeyRoundIcon,
      variant: 'destructive',
    },
  ] as const;

  return (
    <div className="flex justify-end">
      {/* Icon buttons where the row has room; a menu on phones, where three would crowd it. */}
      <div className="hidden gap-1 @2xl/main:flex">
        {actions.map(({ id, label, icon: Icon, variant }) => (
          <Tooltip key={id}>
            <TooltipTrigger render={<Button aria-label={label} size="icon-sm" variant={variant} />}>
              <Icon />
            </TooltipTrigger>
            <TooltipContent>{label}</TooltipContent>
          </Tooltip>
        ))}
      </div>
      <div className="@2xl/main:hidden">
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
            {actions.map(({ id, label, icon: Icon, variant }) => (
              <DropdownMenuItem
                key={id}
                variant={variant === 'destructive' ? 'destructive' : 'default'}
              >
                <Icon />
                {label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

type UsersTableProps = {
  search: UsersSearch;
  onSearchChange: (
    update: Partial<UsersSearch> | SearchUpdate<UsersSearch>,
    replace?: boolean,
  ) => void;
  columnVisibility: ColumnVisibilityState;
};

const NO_USERS: UserListItem[] = [];

const getRowId = (user: UserListItem) => user.id;

const ignoreSearchChange = () => {};

/** The one table setup, shared by the real table and its skeleton so both lay out the same. */
function useUsersTable({
  data,
  rowCount,
  search,
  onSearchChange,
  columnVisibility,
}: UsersTableProps & { data: UserListItem[]; rowCount: number }) {
  const { t } = useTranslation();
  const columns = useMemo(() => createColumns(t), [t]);
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
    onSearchChange: ignoreSearchChange,
    columnVisibility,
  });

  return <DataTableSkeleton rowCount={toPaginationState(search).pageSize} table={table} />;
}

export function UsersTable({ search, onSearchChange, columnVisibility }: UsersTableProps) {
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
