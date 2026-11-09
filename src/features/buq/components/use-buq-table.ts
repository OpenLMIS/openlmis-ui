import { type ColumnDef, useTable } from '@tanstack/react-table';
import { useEffect, useMemo } from 'react';
import { type DataTableFeatures, dataTableFeatures } from '@/components/data-table/data-table';
import type { BuqRow } from '@/features/buq/lib/rows';
import { type BuqListSearch, DEFAULT_BUQ_SORT } from '@/features/buq/lib/search';
import { usePagedTableSearch } from '@/hooks/use-page-start';
import { type SearchChange, toPaginationState } from '@/lib/table-search';

export type BuqTableProps = {
  search: BuqListSearch;
  onSearchChange: SearchChange<BuqListSearch>;
  cards: boolean;
};

const getRowId = (row: BuqRow) => row.id;

export function useBuqTable(
  rows: readonly BuqRow[],
  columns: ColumnDef<DataTableFeatures, BuqRow>[],
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
