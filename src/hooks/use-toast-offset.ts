import { useLocation } from '@tanstack/react-router';
import { useLayoutEffect, useState } from 'react';
import { useSonner } from 'sonner';

export function useToastOffset() {
  const { pathname } = useLocation();
  const { toasts } = useSonner();
  const [bottom, setBottom] = useState(0);
  // biome-ignore lint/correctness/useExhaustiveDependencies: navigation replaces the observed headers
  useLayoutEffect(() => {
    if (!toasts.length) return;
    const headers = [...document.querySelectorAll<HTMLElement>('[data-slot="workspace-header"]')];
    const update = () => {
      const visible = headers.filter(
        (header) => header.getClientRects().length && !header.closest('[hidden]'),
      );
      setBottom(Math.max(0, ...visible.map((header) => header.getBoundingClientRect().bottom)));
    };
    update();
    const observer = new ResizeObserver(update);
    for (const header of headers) observer.observe(header);
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [pathname, toasts.length]);
  return { top: `calc(16px + max(var(--app-header-height, 0px), ${bottom}px))` };
}
