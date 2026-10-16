import { useCallback, useEffect, useRef } from 'react';

export function usePageStart<T extends HTMLElement>(page: string) {
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
  const request = useCallback(() => {
    requested.current = true;
  }, []);
  return { ref, request };
}
