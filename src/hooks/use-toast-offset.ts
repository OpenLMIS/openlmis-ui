import { useLocation } from '@tanstack/react-router';
import { useLayoutEffect, useState } from 'react';
import { useSonner } from 'sonner';

const shown = (element: Element) =>
  element.getClientRects().length > 0 && !element.closest('[hidden]');

export function useToastOffset() {
  const pathname = useLocation({ select: (location) => location.pathname });
  const { toasts } = useSonner();
  const [bottom, setBottom] = useState(0);
  // biome-ignore lint/correctness/useExhaustiveDependencies: navigation replaces the observed headers
  useLayoutEffect(() => {
    if (!toasts.length) return;
    const headers = [...document.querySelectorAll<HTMLElement>('[data-slot="workspace-header"]')];
    const update = () => {
      const column = document.querySelector('[data-sonner-toaster]')?.getBoundingClientRect();
      const covered = [...document.querySelectorAll('[data-slot="workspace-actions"] > *')]
        .filter(shown)
        .map((action) => action.getBoundingClientRect())
        .filter((rect) => !column || (rect.right > column.left && rect.left < column.right));
      setBottom(Math.max(0, ...covered.map((rect) => rect.bottom)));
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
  return { top: `calc(16px + min(50vh, max(var(--app-header-height, 0px), ${bottom}px)))` };
}
