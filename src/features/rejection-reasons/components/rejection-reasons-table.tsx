import { useSuspenseQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { type ColumnVisibilityState, createColumnHelper, useTable } from '@tanstack/react-table';
import type { TFunction } from 'i18next';
import { MessageSquareXIcon, PencilIcon, PlusIcon } from 'lucide-react';
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
import { RowActions } from '@/components/display/card-actions';
import { CellText, TableCards, TableCardsSkeleton } from '@/components/display/table-cards';
import { FlagBadge } from '@/components/shared/flag-badge';
import { Button } from '@/components/ui/button';
import { rejectionReasonsOptions } from '@/features/reference-data/api/queries';
import type { RejectionReason } from '@/features/reference-data/lib/types';
import { pageOfRejectionReasons } from '@/features/rejection-reasons/lib/rejection-reasons-list';
import {
  DEFAULT_REJECTION_REASONS_SORT,
  type RejectionReasonsListSearch,
} from '@/features/rejection-reasons/lib/search';
import { usePagedTableSearch } from '@/hooks/use-page-start';
import { markDialogOpened } from '@/hooks/use-search-navigation';
import { type SearchChange, toPaginationState } from '@/lib/table-search';

const columnHelper = createColumnHelper<DataTableFeatures, RejectionReason>();

function createColumns(t: TFunction, listSearch: RejectionReasonsListSearch) {
  return columnHelper.columns([
    columnHelper.accessor('name', {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('rejection-reasons.name')} />
      ),
      cell: ({ getValue }) => (getValue() ? <CellText strong>{getValue()}</CellText> : null),
    }),
    columnHelper.accessor('code', {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('rejection-reasons.code')} />
      ),
      cell: ({ getValue }) => <CellText dir="ltr">{getValue()}</CellText>,
      meta: { className: '@xl/main:w-1/4', label: t('rejection-reasons.code') },
    }),
    columnHelper.accessor((reason) => reason.rejectionReasonCategory.name, {
      id: 'category',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('rejection-reasons.category')} />
      ),
      cell: ({ getValue }) => <CellText>{getValue()}</CellText>,
      meta: { className: '@xl/main:w-1/4', label: t('rejection-reasons.category') },
    }),
    columnHelper.accessor('active', {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('rejection-reasons.active')} />
      ),
      cell: ({ getValue }) => (
        <FlagBadge
          value={getValue()}
          trueLabel={t('rejection-reasons.active')}
          falseLabel={t('rejection-reasons.inactive-label')}
        />
      ),
      meta: { className: 'w-32', label: t('rejection-reasons.active') },
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
  const label = t('rejection-reasons.actions-for', { name: reason.name });

  return (
    <RowActions
      label={label}
      actions={[
        {
          id: 'edit',
          icon: <PencilIcon />,
          label: t('rejection-reasons.edit'),
          link: (
            <Link
              to="/administration/rejection-reasons"
              search={{ ...listSearch, reason: reason.id }}
              state={markDialogOpened}
            />
          ),
        },
      ]}
    />
  );
}

type RejectionReasonsTableProps = {
  cards: boolean;
  search: RejectionReasonsListSearch;
  onSearchChange: SearchChange<RejectionReasonsListSearch>;
  columnVisibility: ColumnVisibilityState;
  onAdd: () => void;
};

const NO_REASONS: RejectionReason[] = [];

const getRowId = (reason: RejectionReason) => reason.id;

const noop = () => {};

function useRejectionReasonsTable({
  cards,
  data,
  rowCount,
  search,
  onSearchChange,
  columnVisibility,
}: Omit<RejectionReasonsTableProps, 'onAdd'> & { data: RejectionReason[]; rowCount: number }) {
  const { t } = useTranslation();
  const columns = useMemo(() => createColumns(t, search), [t, search]);
  const { pageStart, searchState } = usePagedTableSearch({
    search,
    defaultSort: DEFAULT_REJECTION_REASONS_SORT,
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
    enableSortingRemoval: false,
    ...searchState,
    state: { ...searchState.state, columnVisibility },
  });
  return { table, pageStart };
}

export function RejectionReasonsTableSkeleton({
  cards,
  search,
  columnVisibility,
}: Pick<RejectionReasonsTableProps, 'cards' | 'search' | 'columnVisibility'>) {
  const { table } = useRejectionReasonsTable({
    cards: false,
    data: NO_REASONS,
    rowCount: 0,
    search,
    onSearchChange: noop,
    columnVisibility,
  });
  const rowCount = toPaginationState(search).pageSize;
  if (cards) return <TableCardsSkeleton rowCount={rowCount} table={table} title="name" />;
  return <DataTableSkeleton rowCount={rowCount} table={table} />;
}

export function RejectionReasonsTable({
  cards,
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
  const { table, pageStart } = useRejectionReasonsTable({
    cards,
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

  const empty = (
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
        title="name"
      />
    );
  }
  return <DataTable empty={empty} footer={footer} isStale={isStale} table={table} />;
}
