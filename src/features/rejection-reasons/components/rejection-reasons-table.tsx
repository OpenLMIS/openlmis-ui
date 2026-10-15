import { useSuspenseQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { type ColumnVisibilityState, createColumnHelper, useTable } from '@tanstack/react-table';
import type { TFunction } from 'i18next';
import {
  CheckIcon,
  EllipsisIcon,
  MessageSquareXIcon,
  PencilIcon,
  PlusIcon,
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
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { rejectionReasonsOptions } from '@/features/reference-data/api/queries';
import type { RejectionReason } from '@/features/reference-data/lib/types';
import { pageOfRejectionReasons } from '@/features/rejection-reasons/lib/rejection-reasons-list';
import {
  DEFAULT_REJECTION_REASONS_SORT,
  type RejectionReasonsListSearch,
} from '@/features/rejection-reasons/lib/search';
import { type SearchChange, toPaginationState, useTableSearchState } from '@/lib/table-search';

const columnHelper = createColumnHelper<DataTableFeatures, RejectionReason>();

function createColumns(t: TFunction, listSearch: RejectionReasonsListSearch) {
  return columnHelper.columns([
    columnHelper.accessor('name', {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('rejection-reasons.name')} />
      ),
      cell: ({ getValue }) =>
        getValue() ? (
          <span className="flex">
            <span className="min-w-0 truncate font-medium" dir="auto">
              {getValue()}
            </span>
          </span>
        ) : null,
    }),
    columnHelper.accessor('code', {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('rejection-reasons.code')} />
      ),
      cell: ({ getValue }) => (
        <span className="flex">
          <span className="min-w-0 truncate" dir="ltr">
            {getValue()}
          </span>
        </span>
      ),
      meta: { className: '@xl/main:w-1/4' },
    }),
    columnHelper.accessor((reason) => reason.rejectionReasonCategory.name, {
      id: 'category',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('rejection-reasons.category')} />
      ),
      cell: ({ getValue }) => (
        <span className="flex">
          <span className="min-w-0 truncate" dir="auto">
            {getValue()}
          </span>
        </span>
      ),
      meta: { className: '@xl/main:w-1/4' },
    }),
    columnHelper.accessor('active', {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('rejection-reasons.active')} />
      ),
      cell: ({ getValue }) =>
        getValue() ? (
          <Badge variant="success">
            <CheckIcon data-icon="inline-start" />
            {t('rejection-reasons.active')}
          </Badge>
        ) : (
          <Badge variant="destructive">
            <XIcon data-icon="inline-start" />
            {t('rejection-reasons.inactive-label')}
          </Badge>
        ),
      meta: { className: 'w-32' },
    }),
    columnHelper.display({
      id: 'actions',
      header: () => <span className="sr-only">{t('rejection-reasons.actions')}</span>,
      meta: { className: 'w-16' },
      cell: ({ row }) => <RejectionReasonActions listSearch={listSearch} reason={row.original} />,
    }),
  ]);
}

function RejectionReasonActions({
  reason,
  listSearch,
}: {
  reason: RejectionReason;
  listSearch: RejectionReasonsListSearch;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex justify-end">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              aria-label={t('rejection-reasons.actions-for', { name: reason.name })}
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
                  to="/administration/rejection-reasons/$id"
                  params={{ id: reason.id }}
                  search={listSearch}
                  state={{ rejectionReasonsListSearch: listSearch }}
                />
              }
            >
              <PencilIcon />
              {t('rejection-reasons.edit')}
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

type RejectionReasonsTableProps = {
  search: RejectionReasonsListSearch;
  onSearchChange: SearchChange<RejectionReasonsListSearch>;
  columnVisibility: ColumnVisibilityState;
  onAdd: () => void;
};

const NO_REASONS: RejectionReason[] = [];

const getRowId = (reason: RejectionReason) => reason.id;

const noop = () => {};

function useRejectionReasonsTable({
  data,
  rowCount,
  search,
  onSearchChange,
  columnVisibility,
}: Omit<RejectionReasonsTableProps, 'onAdd'> & { data: RejectionReason[]; rowCount: number }) {
  const { t } = useTranslation();
  const columns = useMemo(() => createColumns(t, search), [t, search]);
  const searchState = useTableSearchState({
    search,
    defaultSort: DEFAULT_REJECTION_REASONS_SORT,
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

export function RejectionReasonsTableSkeleton({
  search,
  columnVisibility,
}: Pick<RejectionReasonsTableProps, 'search' | 'columnVisibility'>) {
  const table = useRejectionReasonsTable({
    data: NO_REASONS,
    rowCount: 0,
    search,
    onSearchChange: noop,
    columnVisibility,
  });
  return <DataTableSkeleton rowCount={toPaginationState(search).pageSize} table={table} />;
}

export function RejectionReasonsTable({
  search,
  onSearchChange,
  columnVisibility,
  onAdd,
}: RejectionReasonsTableProps) {
  const { t } = useTranslation();
  const deferredSearch = useDeferredValue(search);
  const { data: reasons } = useSuspenseQuery(rejectionReasonsOptions());
  const data = useMemo(
    () => pageOfRejectionReasons(reasons, deferredSearch),
    [reasons, deferredSearch],
  );
  const table = useRejectionReasonsTable({
    data: data.content,
    rowCount: data.totalElements,
    search: deferredSearch,
    onSearchChange,
    columnVisibility,
  });
  const isPastLastPage = (deferredSearch.page ?? 1) !== data.page;

  useEffect(() => {
    if (isPastLastPage && search === deferredSearch) {
      onSearchChange({ page: data.page > 1 ? data.page : undefined }, true);
    }
  }, [isPastLastPage, data.page, onSearchChange, search, deferredSearch]);

  return (
    <DataTable
      empty={
        <DataTableEmpty
          action={
            search.name ? (
              <Button
                onClick={() => onSearchChange({ name: undefined, page: undefined }, true)}
                variant="outline"
              >
                {t('rejection-reasons.clear')}
              </Button>
            ) : (
              <Button onClick={onAdd}>
                <PlusIcon data-icon="inline-start" />
                {t('rejection-reasons.add')}
              </Button>
            )
          }
          description={t(
            search.name
              ? 'rejection-reasons.no-matches-description'
              : 'rejection-reasons.empty-description',
          )}
          icon={<MessageSquareXIcon />}
          title={t(
            search.name ? 'rejection-reasons.no-matches-title' : 'rejection-reasons.empty-title',
          )}
        />
      }
      footer={!isPastLastPage && data.totalElements > 0 && <DataTablePagination table={table} />}
      isStale={search !== deferredSearch}
      table={table}
    />
  );
}
