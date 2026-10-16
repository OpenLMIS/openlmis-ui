import type { OnChangeFn, PaginationState } from '@tanstack/react-table';
import { useEffect, useRef } from 'react';

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
