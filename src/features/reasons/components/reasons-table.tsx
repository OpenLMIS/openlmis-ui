import { useSuspenseQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { type ColumnVisibilityState, createColumnHelper, useTable } from '@tanstack/react-table';
import type { TFunction } from 'i18next';
import { EllipsisIcon, MessageSquareTextIcon, PencilIcon, SearchXIcon } from 'lucide-react';
import { useCallback, useEffect, useMemo } from 'react';
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
import { FlagBadge } from '@/components/flag-badge';
import { TableCards, TableCardsSkeleton } from '@/components/table-cards';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useReasonLabels } from '@/features/reasons/hooks/use-reason-labels';
import { filterReasons, type ReasonLabels, sortReasons } from '@/features/reasons/lib/reasons-list';
import {
  CLEARED_REASON_FILTERS,
  DEFAULT_REASONS_SORT,
  hasReasonFilters,
  type ReasonSortField,
  type ReasonsSearch,
} from '@/features/reasons/lib/search';
import { reasonsOptions } from '@/features/reference-data/api/queries';
import type { Reason } from '@/features/reference-data/lib/types';
import { usePageStart } from '@/hooks/use-page-start';
import {
  type SearchChange,
  toPaginationState,
  toSortingState,
  useTableSearchState,
} from '@/lib/table-search';

const columnHelper = createColumnHelper<DataTableFeatures, Reason>();

function createColumns(
  t: TFunction,
  labels: ReasonLabels,
  listSearch: ReasonsSearch,
  cards: boolean,
) {
  return columnHelper.columns([
    columnHelper.accessor('name', {
      header: ({ column }) => <DataTableColumnHeader column={column} title={t('reasons.name')} />,
      cell: ({ row, table }) => {
        const folded = cards
          ? []
          : [
              !table.getColumn('type')?.getIsVisible() && labels.type(row.original.reasonType),
              !table.getColumn('category')?.getIsVisible() &&
                labels.category(row.original.reasonCategory),
            ].filter(Boolean);
        return (
          <span className="flex flex-col whitespace-normal break-words" dir="auto">
            <span className="font-medium">{row.original.name}</span>
            {folded.length > 0 && (
              <span className="text-muted-foreground">{folded.join(' · ')}</span>
            )}
          </span>
        );
      },
      meta: { className: '@xl/main:w-2/5' },
    }),
    columnHelper.accessor((reason) => labels.category(reason.reasonCategory), {
      id: 'category',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('reasons.category')} />
      ),
      meta: { label: t('reasons.category') },
    }),
    columnHelper.accessor((reason) => labels.type(reason.reasonType), {
      id: 'type',
      header: ({ column }) => <DataTableColumnHeader column={column} title={t('reasons.type')} />,
      meta: { label: t('reasons.type') },
    }),
    columnHelper.accessor('isFreeTextAllowed', {
      id: 'freeText',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('reasons.free-text')} />
      ),
      cell: ({ getValue }) => (
        <FlagBadge
          value={getValue()}
          trueLabel={t('reasons.free-text-yes')}
          falseLabel={t('reasons.free-text-no')}
        />
      ),
      enableSorting: false,
      meta: { label: t('reasons.free-text') },
    }),
    columnHelper.display({
      id: 'actions',
      header: () => <span className="sr-only">{t('reasons.actions')}</span>,
      meta: { className: 'w-16' },
      cell: ({ row }) => <ReasonActions listSearch={listSearch} reason={row.original} />,
    }),
  ]);
}

function ReasonActions({ reason, listSearch }: { reason: Reason; listSearch: ReasonsSearch }) {
  const { t } = useTranslation();

  return (
    <div className="flex justify-end">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              aria-label={t('reasons.actions-for', { name: reason.name })}
              size="icon-sm"
              variant="ghost"
            />
          }
        >
          <EllipsisIcon />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" width="auto">
          <DropdownMenuItem
            render={
              <Link
                params={{ id: reason.id }}
                state={{ reasonsListSearch: listSearch }}
                to="/administration/reasons/$id"
              />
            }
          >
            <PencilIcon />
            {t('reasons.edit')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

type ReasonsTableProps = {
  cards: boolean;
  search: ReasonsSearch;
  onSearchChange: SearchChange<ReasonsSearch>;
  columnVisibility: ColumnVisibilityState;
};

const NO_REASONS: Reason[] = [];

const getRowId = (reason: Reason) => reason.id;

const noop = () => {};

/** One table setup for the table and its skeleton; the endpoint cannot page or sort, so it happens here. */
function useReasonsTable({
  cards,
  reasons,
  search,
  onSearchChange,
  columnVisibility,
}: ReasonsTableProps & { reasons: Reason[] }) {
  const { t } = useTranslation();
  const labels = useReasonLabels();
  const columns = useMemo(
    () => createColumns(t, labels, search, cards),
    [t, labels, search, cards],
  );
  const { pageIndex, pageSize } = toPaginationState(search);
  const pageStart = usePageStart<HTMLUListElement>(`${pageIndex}:${pageSize}`, cards);
  const onTableChange = useCallback<SearchChange<ReasonsSearch>>(
    (update) => onSearchChange(update, false, pageStart.navigation),
    [onSearchChange, pageStart.navigation],
  );
  const searchState = useTableSearchState({
    search,
    defaultSort: DEFAULT_REASONS_SORT,
    onSearchChange: onTableChange,
  });
  const [{ id, desc }] = toSortingState(search, DEFAULT_REASONS_SORT) as [
    { id: ReasonSortField; desc: boolean },
  ];
  const matching = useMemo(
    () => sortReasons(filterReasons(reasons, search.q), id, desc, labels),
    [reasons, search.q, id, desc, labels],
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
    onPaginationChange: pageStart.onPaginationChange(searchState.onPaginationChange),
    state: { ...searchState.state, columnVisibility },
  });

  return { table, pageStart, matching: matching.length };
}

export function ReasonsTableSkeleton({
  cards,
  search,
  columnVisibility,
}: Pick<ReasonsTableProps, 'cards' | 'search' | 'columnVisibility'>) {
  const { table } = useReasonsTable({
    cards: false,
    reasons: NO_REASONS,
    search,
    onSearchChange: noop,
    columnVisibility,
  });
  const rowCount = toPaginationState(search).pageSize;
  if (cards) return <TableCardsSkeleton rowCount={rowCount} table={table} title="name" />;
  return <DataTableSkeleton rowCount={rowCount} table={table} />;
}

export function ReasonsTable({ search, onSearchChange, ...props }: ReasonsTableProps) {
  const { t } = useTranslation();
  const { data: reasons } = useSuspenseQuery(reasonsOptions());
  const { table, pageStart, matching } = useReasonsTable({
    reasons,
    search,
    onSearchChange,
    ...props,
  });
  const pageCount = table.getPageCount();
  const isPastLastPage = matching > 0 && toPaginationState(search).pageIndex >= pageCount;

  // A stale link, or a search that leaves fewer pages, can point past the end.
  useEffect(() => {
    if (isPastLastPage) onSearchChange({ page: pageCount > 1 ? pageCount : undefined }, true);
  }, [isPastLastPage, pageCount, onSearchChange]);

  const empty = hasReasonFilters(search) ? (
    <DataTableEmpty
      action={
        <Button onClick={() => onSearchChange(CLEARED_REASON_FILTERS)} variant="destructive">
          {t('reasons.clear-filters')}
        </Button>
      }
      description={t('reasons.no-results-description')}
      icon={<SearchXIcon />}
      title={t('reasons.no-results-title')}
    />
  ) : (
    <DataTableEmpty
      description={t('reasons.empty-description')}
      icon={<MessageSquareTextIcon />}
      title={t('reasons.empty-title')}
    />
  );

  const footer = !isPastLastPage && matching > 0 && <DataTablePagination table={table} />;
  if (props.cards) {
    return (
      <TableCards
        empty={!isPastLastPage && empty}
        footer={footer}
        listRef={pageStart.ref}
        table={table}
        title="name"
      />
    );
  }
  return <DataTable empty={!isPastLastPage && empty} footer={footer} table={table} />;
}
