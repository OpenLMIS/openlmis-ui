import { useLayoutEffect, useState } from 'react';
import { useSonner } from 'sonner';

const shown = (element: Element) =>
  element.getClientRects().length > 0 && !element.closest('[hidden]');

export function useToastOffset() {
  const { toasts } = useSonner();
  const [bottom, setBottom] = useState(0);
  useLayoutEffect(() => {
    if (!toasts.length) return;
    let frame = 0;
    const resize = new ResizeObserver(() => update());
    const update = () => {
      frame = 0;
      for (const header of document.querySelectorAll('[data-slot="workspace-header"]'))
        resize.observe(header);
      const column = document.querySelector('[data-sonner-toaster]')?.getBoundingClientRect();
      const covered = [...document.querySelectorAll('[data-slot="workspace-actions"] > *')]
        .filter(shown)
        .map((action) => action.getBoundingClientRect())
        .filter((rect) => !column || (rect.right > column.left && rect.left < column.right));
      setBottom(Math.max(0, ...covered.map((rect) => rect.bottom)));
    };
    const schedule = () => {
      frame ||= requestAnimationFrame(update);
    };
    update();
    const mutations = new MutationObserver(schedule);
    mutations.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['hidden'],
    });
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      cancelAnimationFrame(frame);
      mutations.disconnect();
      resize.disconnect();
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [toasts.length]);
  return { top: `calc(16px + max(var(--app-header-height, 0px), ${bottom}px))` };
}
