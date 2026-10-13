import { useLayoutEffect, useRef, useState } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export function ProductName({
  label,
  width = 'default',
}: {
  label: string;
  width?: 'default' | 'compact' | 'wide' | 'inventory';
}) {
  const region = useRef<HTMLSpanElement>(null);
  const [truncated, setTruncated] = useState(false);
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  useLayoutEffect(() => {
    const element = region.current;
    if (!element) return;
    const measure = () => {
      const content = element.firstElementChild as HTMLElement | null;
      if (content?.textContent !== label) return;
      setTruncated(Math.max(element.scrollWidth, content?.scrollWidth ?? 0) > element.clientWidth);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [label]);
  return (
    <span
      ref={region}
      className={
        width === 'inventory'
          ? 'block w-0 min-w-full max-w-full truncate font-medium'
          : width === 'wide'
            ? 'block w-50 truncate font-medium'
            : width === 'compact'
              ? 'block max-w-48 truncate font-medium'
              : 'block w-28 truncate font-medium'
      }
    >
      {truncated || focused ? (
        <Tooltip open={open} onOpenChange={setOpen}>
          <TooltipTrigger
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onClick={(event) => {
              event.preventDefault();
              setOpen(true);
            }}
            render={
              <button
                type="button"
                dir={truncated ? 'auto' : undefined}
                className="block w-full truncate text-start outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            }
          >
            <bdi>{label}</bdi>
          </TooltipTrigger>
          <TooltipContent>
            <bdi>{label}</bdi>
          </TooltipContent>
        </Tooltip>
      ) : (
        <bdi>{label}</bdi>
      )}
    </span>
  );
}
