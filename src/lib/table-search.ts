import {
  functionalUpdate,
  type PaginationState,
  type SortingState,
  type Updater,
} from '@tanstack/react-table';
import { useMemo } from 'react';
import { z } from 'zod';
import { DEFAULT_PAGE_SIZE_OPTIONS } from '@/components/data-table/data-table-pagination';

const DEFAULT_PAGE_SIZE = 10;

/** Table state as it lives in the URL. Defaults are left out so links stay short. */
export type TableSearch = {
  page?: number | undefined;
  size?: number | undefined;
  sort?: string | undefined;
  dir?: 'asc' | 'desc' | undefined;
};

export type DefaultSort = { id: string; desc: boolean };

/** Validation for the shared table params; an invalid value falls back to its default. */
export function tableSearchSchema<const TSortField extends string>(
  sortFields: readonly [TSortField, ...TSortField[]],
) {
  return z.object({
    page: z.number().int().min(1).optional().catch(undefined),
    size: z
      .number()
      .refine((size) => DEFAULT_PAGE_SIZE_OPTIONS.includes(size))
      .optional()
      .catch(undefined),
    sort: z.enum(sortFields).optional().catch(undefined),
    dir: z.enum(['asc', 'desc']).optional().catch(undefined),
  });
}

/** Optional text filter kept as typed, so the input never sees its own text change; blanks drop out. */
export const textFilterSchema = z
  .string()
  .transform((value) => (value.trim() ? value : undefined))
  .optional()
  .catch(undefined);

export function toPaginationState(search: TableSearch): PaginationState {
  return { pageIndex: (search.page ?? 1) - 1, pageSize: search.size ?? DEFAULT_PAGE_SIZE };
}

export function toSortingState(search: TableSearch, defaultSort: DefaultSort): SortingState {
  const id = search.sort ?? defaultSort.id;
  const desc = search.dir ? search.dir === 'desc' : defaultSort.desc;
  return [{ id, desc }];
}

export function fromPaginationState(
  previous: PaginationState,
  next: PaginationState,
): Pick<TableSearch, 'page' | 'size'> {
  // A new page size starts over, since the old page number points at different rows.
  const pageIndex = next.pageSize === previous.pageSize ? next.pageIndex : 0;
  return {
    page: pageIndex > 0 ? pageIndex + 1 : undefined,
    size: next.pageSize === DEFAULT_PAGE_SIZE ? undefined : next.pageSize,
  };
}

export function fromSortingState(
  sorting: SortingState,
  defaultSort: DefaultSort,
): Pick<TableSearch, 'sort' | 'dir'> {
  const [first] = sorting;
  if (!first || (first.id === defaultSort.id && first.desc === defaultSort.desc)) {
    return { sort: undefined, dir: undefined };
  }
  return { sort: first.id, dir: first.desc ? 'desc' : 'asc' };
}

/** The Spring Data `sort` param, e.g. `username,asc`. */
export function toSortParam(search: TableSearch, defaultSort: DefaultSort) {
  const [{ id, desc }] = toSortingState(search, defaultSort) as [SortingState[number]];
  return `${id},${desc ? 'desc' : 'asc'}`;
}

/** Receives the latest URL search, so a change never builds on a stale render. */
export type SearchUpdate<TSearch> = (previous: TSearch) => Partial<TSearch>;

type TableSearchStateOptions<TSearch extends TableSearch> = {
  search: TableSearch;
  defaultSort: DefaultSort;
  onSearchChange: (update: SearchUpdate<TSearch>) => void;
};

/** Controlled pagination and sorting for a server-side table whose state lives in the URL. */
export function tableSearchState<TSearch extends TableSearch>({
  search,
  defaultSort,
  onSearchChange,
}: TableSearchStateOptions<TSearch>) {
  // Sort ids are column ids, which the page's search schema validates on the way back in.
  const update = (change: (previous: TSearch) => TableSearch) =>
    onSearchChange((previous) => change(previous) as Partial<TSearch>);

  return {
    state: {
      pagination: toPaginationState(search),
      sorting: toSortingState(search, defaultSort),
    },
    onPaginationChange: (updater: Updater<PaginationState>) =>
      update((previous) => {
        const current = toPaginationState(previous);
        return fromPaginationState(current, functionalUpdate(updater, current));
      }),
    onSortingChange: (updater: Updater<SortingState>) =>
      update((previous) => {
        const next = functionalUpdate(updater, toSortingState(previous, defaultSort));
        return { ...fromSortingState(next, defaultSort), page: undefined };
      }),
  };
}

/** `tableSearchState` with state that keeps its identity until the URL values change, as useTable expects. */
export function useTableSearchState<TSearch extends TableSearch>({
  search,
  defaultSort,
  onSearchChange,
}: TableSearchStateOptions<TSearch>) {
  const { page, size, sort, dir } = search;
  const state = useMemo(
    () => tableSearchState({ search: { page, size, sort, dir }, defaultSort, onSearchChange }),
    [page, size, sort, dir, defaultSort, onSearchChange],
  );
  return state;
}
