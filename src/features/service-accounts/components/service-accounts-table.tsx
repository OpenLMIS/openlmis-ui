import { useSuspenseQuery } from '@tanstack/react-query';
import { createColumnHelper, useTable } from '@tanstack/react-table';
import type { TFunction } from 'i18next';
import { EllipsisIcon, KeyRoundIcon, PlusIcon, Trash2Icon } from 'lucide-react';
import { useCallback, useDeferredValue, useEffect, useMemo } from 'react';
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
import { TableCards, TableCardsSkeleton, useInCards } from '@/components/table-cards';
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
import { usePageStart } from '@/hooks/use-page-start';
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
      meta: { className: '@xl/main:w-56', label: t('service-accounts.created') },
    }),
    columnHelper.accessor('token', {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('service-accounts.key')} />
      ),
      enableSorting: false,
      cell: ({ getValue }) => (
        <div className="flex items-center gap-1 whitespace-normal">
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

  const label = t('service-accounts.actions-for', { key: token });

  if (useInCards()) {
    return (
      <CardActions
        label={label}
        actions={[
          {
            id: 'delete',
            icon: <Trash2Icon />,
            label: t('service-accounts.delete'),
            destructive: true,
            onSelect: () => onDelete(token),
          },
        ]}
      />
    );
  }

  return (
    <div className="flex justify-end">
      <DropdownMenu onOpenChange={menu.onOpenChange}>
        <DropdownMenuTrigger render={<Button aria-label={label} size="icon-sm" variant="ghost" />}>
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
  cards: boolean;
  search: ServiceAccountsSearch;
  onSearchChange: SearchChange<ServiceAccountsSearch>;
  onAdd: () => void;
  onDelete: (token: string) => void;
};

const NO_KEYS: ServiceAccount[] = [];

const getRowId = (key: ServiceAccount) => key.token;

const noop = () => {};

function useServiceAccountsTable({
  cards,
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
  const { pageIndex, pageSize } = toPaginationState(search);
  const pageStart = usePageStart<HTMLUListElement>(`${pageIndex}:${pageSize}`, cards);
  const onTableChange = useCallback<SearchChange<ServiceAccountsSearch>>(
    (update) => onSearchChange(update, false, pageStart.navigation),
    [onSearchChange, pageStart.navigation],
  );
  const searchState = useTableSearchState({
    search,
    defaultSort: DEFAULT_SERVICE_ACCOUNTS_SORT,
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
    enableSortingRemoval: false,
    ...searchState,
    onPaginationChange: pageStart.onPaginationChange(searchState.onPaginationChange),
  });
  return { table, pageStart };
}

export function ServiceAccountsTableSkeleton({
  cards,
  search,
}: Pick<ServiceAccountsTableProps, 'cards' | 'search'>) {
  const { table } = useServiceAccountsTable({
    cards: false,
    data: NO_KEYS,
    rowCount: 0,
    search,
    onSearchChange: noop,
    onDelete: noop,
  });
  const rowCount = toPaginationState(search).pageSize;
  if (cards)
    return <TableCardsSkeleton rowCount={rowCount} table={table} title="token" titleLines={2} />;
  return <DataTableSkeleton rowCount={rowCount} table={table} />;
}

export function ServiceAccountsTable({
  cards,
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
  const { table, pageStart } = useServiceAccountsTable({
    cards,
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

  const empty = !isPastLastPage && (
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
  );
  const footer = !isPastLastPage && data.totalElements > 0 && <DataTablePagination table={table} />;
  const isStale = search !== deferredSearch;
  if (cards) {
    return (
      <TableCards
        busy={isStale}
        empty={empty}
        footer={footer}
        listRef={pageStart.ref}
        table={table}
        title="token"
      />
    );
  }
  return <DataTable empty={empty} footer={footer} isStale={isStale} table={table} />;
}
