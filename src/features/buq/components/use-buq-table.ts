import { type ColumnDef, useTable } from '@tanstack/react-table';
import { useEffect, useMemo } from 'react';
import { type DataTableFeatures, dataTableFeatures } from '@/components/data-table/data-table';
import { type BuqTableProps, DEFAULT_BUQ_SORT } from '@/features/buq/lib/search';
import { usePagedTableSearch } from '@/hooks/use-page-start';
import { toPaginationState } from '@/lib/table-search';

const getRowId = (row: { id: string }) => row.id;

export function useBuqTable<Row extends { id: string }>(
  rows: readonly Row[],
  columns: ColumnDef<DataTableFeatures, Row>[],
  { search, onSearchChange, cards }: BuqTableProps,
) {
  const { pageIndex, pageSize } = toPaginationState(search);
  const data = useMemo(
    () => rows.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize),
    [rows, pageIndex, pageSize],
  );
  const { pageStart, searchState } = usePagedTableSearch({
    search,
    defaultSort: DEFAULT_BUQ_SORT,
    onSearchChange,
    cards,
  });
  const table = useTable({
    features: dataTableFeatures,
    columns,
    data,
    getRowId,
    rowCount: rows.length,
    manualPagination: true,
    manualSorting: true,
    enableSorting: false,
    ...searchState,
  });
  const pageCount = table.getPageCount();
  const isPastLastPage = rows.length > 0 && pageIndex >= pageCount;

  useEffect(() => {
    if (isPastLastPage) onSearchChange({ page: pageCount > 1 ? pageCount : undefined }, true);
  }, [isPastLastPage, pageCount, onSearchChange]);

  return { table, pageStart, isPastLastPage };
}
