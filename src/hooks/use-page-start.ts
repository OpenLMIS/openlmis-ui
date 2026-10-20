import type { OnChangeFn, PaginationState } from '@tanstack/react-table';
import { useCallback, useEffect, useRef } from 'react';
import {
  type SearchChange,
  type TableSearch,
  type TableSearchStateOptions,
  useTableSearchState,
} from '@/lib/table-search';

const CARD_NAVIGATION = { resetScroll: false };

export function usePageStart<T extends HTMLElement>(page: string, cards: boolean) {
  const ref = useRef<T>(null);
  const shown = useRef(page);
  const requested = useRef(false);
  useEffect(() => {
    if (shown.current === page) return;
    shown.current = page;
    if (!requested.current) return;
    requested.current = false;
    ref.current?.scrollIntoView?.({ block: 'start' });
    ref.current?.focus({ preventScroll: true });
  }, [page]);
  return {
    ref,
    navigation: cards ? CARD_NAVIGATION : undefined,
    onPaginationChange:
      (original: OnChangeFn<PaginationState>): OnChangeFn<PaginationState> =>
      (updater) => {
        if (cards) requested.current = true;
        original(updater);
      },
  };
}

export function usePagedTableSearch<TSearch extends TableSearch>({
  cards,
  page,
  onSearchChange,
  ...options
}: Omit<TableSearchStateOptions<TSearch>, 'onSearchChange'> & {
  cards: boolean;
  onSearchChange: SearchChange<TSearch>;
  page?: string;
}) {
  const pageStart = usePageStart<HTMLUListElement>(
    page ?? `${options.search.page}:${options.search.size}`,
    cards,
  );
  const { navigation } = pageStart;
  const onTableChange = useCallback<SearchChange<TSearch>>(
    (update) => onSearchChange(update, false, navigation),
    [onSearchChange, navigation],
  );
  const searchState = useTableSearchState({ ...options, onSearchChange: onTableChange });
  return {
    pageStart,
    searchState: {
      ...searchState,
      onPaginationChange: pageStart.onPaginationChange(searchState.onPaginationChange),
    },
  };
}
