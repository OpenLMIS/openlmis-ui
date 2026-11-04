import { useLayoutEffect, useRef } from 'react';

export function useRemovalFocus(ids: readonly string[], fallback: () => HTMLElement | null) {
  const region = useRef<HTMLDivElement>(null);
  const pending = useRef<number | null>(null);
  useLayoutEffect(() => {
    if (pending.current === null) return;
    const buttons = region.current?.querySelectorAll<HTMLElement>(
      '[data-removal-control] button, button[data-removal-control]',
    );
    const next = ids.length ? buttons?.[Math.min(pending.current, buttons.length - 1)] : null;
    (next ?? fallback())?.focus();
    pending.current = null;
  }, [ids, fallback]);
  return {
    region,
    removing: (id: string) => {
      pending.current = ids.indexOf(id);
    },
  };
}
