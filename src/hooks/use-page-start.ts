import { useEffect, useRef } from 'react';

/** Brings the returned element into view when `page` changes, so each page of cards starts at its first card. */
export function usePageStart<T extends HTMLElement>(page: number, enabled: boolean) {
  const ref = useRef<T>(null);
  const shown = useRef(page);
  useEffect(() => {
    if (shown.current === page) return;
    shown.current = page;
    if (enabled) ref.current?.scrollIntoView?.({ block: 'start' });
  }, [page, enabled]);
  return ref;
}
