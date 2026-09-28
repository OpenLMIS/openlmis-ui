import { useSuspenseQuery } from '@tanstack/react-query';
import { createColumnHelper, useTable } from '@tanstack/react-table';
import type { TFunction } from 'i18next';
import { EllipsisIcon, KeyRoundIcon, PlusIcon, Trash2Icon } from 'lucide-react';
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
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { serviceAccountsListOptions } from '@/features/service-accounts/api/queries';
import { CopyKeyButton } from '@/features/service-accounts/components/copy-key-button';
import {
  DEFAULT_SERVICE_ACCOUNTS_SORT,
  type ServiceAccountsSearch,
  toServiceAccountsQuery,
} from '@/features/service-accounts/lib/search';
import type { ServiceAccount } from '@/features/service-accounts/lib/types';
import { useMenuOpensDialog } from '@/hooks/use-menu-opens-dialog';
import { type SearchChange, toPaginationState, useTableSearchState } from '@/lib/table-search';

const columnHelper = createColumnHelper<DataTableFeatures, ServiceAccount>();

function createColumns(
  t: TFunction,
  formatDate: (date: Date) => string,
  onDelete: (token: string) => void,
) {
  return columnHelper.columns([
    columnHelper.accessor('createdDate', {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('service-accounts.created')} />
      ),
      cell: ({ getValue }) => (
        <span className="whitespace-normal">{formatDate(new Date(getValue()))}</span>
      ),
      meta: { className: '@xl/main:w-56' },
    }),
    columnHelper.accessor('token', {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('service-accounts.key')} />
      ),
      enableSorting: false,
      cell: ({ getValue }) => (
        <div className="flex items-center gap-1 whitespace-normal">
          {/* A key reads left to right in every language. */}
          <span className="font-mono text-sm" dir="ltr">
            {getValue()}
          </span>
          <CopyKeyButton token={getValue()} />
        </div>
      ),
    }),
    columnHelper.display({
      id: 'actions',
      header: () => <span className="sr-only">{t('service-accounts.actions')}</span>,
      meta: { className: 'w-16' },
      cell: ({ row }) => <KeyActions onDelete={onDelete} token={row.original.token} />,
    }),
  ]);
}

function KeyActions({ token, onDelete }: { token: string; onDelete: (token: string) => void }) {
  const { t } = useTranslation();
  const menu = useMenuOpensDialog();

  return (
    <div className="flex justify-end">
      <DropdownMenu onOpenChange={menu.onOpenChange}>
        <DropdownMenuTrigger
          render={
            <Button
              aria-label={t('service-accounts.actions-for', { key: token })}
              size="icon-sm"
              variant="ghost"
            />
          }
        >
          <EllipsisIcon />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" finalFocus={menu.finalFocus} width="auto">
          <DropdownMenuItem onClick={menu.opensDialog(() => onDelete(token))} variant="destructive">
            <Trash2Icon />
            {t('service-accounts.delete')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

type ServiceAccountsTableProps = {
  search: ServiceAccountsSearch;
  onSearchChange: SearchChange<ServiceAccountsSearch>;
  onAdd: () => void;
  onDelete: (token: string) => void;
};

const NO_KEYS: ServiceAccount[] = [];

const getRowId = (key: ServiceAccount) => key.token;

const noop = () => {};

function useServiceAccountsTable({
  data,
  rowCount,
  search,
  onSearchChange,
  onDelete,
}: Omit<ServiceAccountsTableProps, 'onAdd'> & { data: ServiceAccount[]; rowCount: number }) {
  const { t, i18n } = useTranslation();
  const formatDate = useMemo(
    () =>
      new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium', timeStyle: 'short' }).format,
    [i18n.language],
  );
  const columns = useMemo(() => createColumns(t, formatDate, onDelete), [t, formatDate, onDelete]);
  const searchState = useTableSearchState({
    search,
    defaultSort: DEFAULT_SERVICE_ACCOUNTS_SORT,
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
  });
}

export function ServiceAccountsTableSkeleton({ search }: { search: ServiceAccountsSearch }) {
  const table = useServiceAccountsTable({
    data: NO_KEYS,
    rowCount: 0,
    search,
    onSearchChange: noop,
    onDelete: noop,
  });
  return <DataTableSkeleton rowCount={toPaginationState(search).pageSize} table={table} />;
}

export function ServiceAccountsTable({
  search,
  onSearchChange,
  onAdd,
  onDelete,
}: ServiceAccountsTableProps) {
  const { t } = useTranslation();
  const deferredSearch = useDeferredValue(search);
  const { data } = useSuspenseQuery(
    serviceAccountsListOptions(toServiceAccountsQuery(deferredSearch)),
  );
  const table = useServiceAccountsTable({
    data: data.content,
    rowCount: data.totalElements,
    search: deferredSearch,
    onSearchChange,
    onDelete,
  });
  const isPastLastPage = data.content.length === 0 && data.totalElements > 0;

  // Deleting the last key on a page, or a stale link, can point past the end.
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
                {t('service-accounts.add')}
              </Button>
            }
            description={t('service-accounts.empty-description')}
            icon={<KeyRoundIcon />}
            title={t('service-accounts.empty-title')}
          />
        )
      }
      footer={!isPastLastPage && data.totalElements > 0 && <DataTablePagination table={table} />}
      isStale={search !== deferredSearch}
      table={table}
    />
  );
}
