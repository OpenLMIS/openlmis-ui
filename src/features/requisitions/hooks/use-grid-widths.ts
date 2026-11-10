import { type RefObject, useLayoutEffect, useRef, useState } from 'react';

export function useGridWidths(
  frame: RefObject<HTMLElement | null>,
  columns: readonly { label: string; values: readonly string[]; min?: number; max?: number }[],
  enabled = true,
) {
  const cache = useRef(new Map<string, number>());
  const [widths, setWidths] = useState<number[]>([]);
  useLayoutEffect(() => {
    if (!enabled) return;
    const element = frame.current;
    const context = document.createElement('canvas').getContext('2d');
    if (!element || !context) return;
    const header = element.querySelector('th');
    const style = getComputedStyle(header ?? element);
    context.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    const measure = (text: string) => {
      const key = `${context.font}:${text}`;
      let width = cache.current.get(key);
      if (width === undefined) {
        width = context.measureText(text).width;
        cache.current.set(key, width);
      }
      return width;
    };
    const headers = element.querySelectorAll('thead tr:last-child th');
    const measureWidths = () => {
      const next = columns.map(({ label, values, min = 96, max = 384 }, index) => {
        const header =
          Math.max(
            ...label
              .toLocaleUpperCase()
              .split(/\s+/)
              .map((word) => measure(word)),
          ) + 40;
        const value = Math.max(0, ...values.map((value) => measure(value))) + 24;
        const cell = headers[index];
        const sizer = cell?.querySelector('[data-slot="quantity-header-sizer"]');
        const cellStyle = cell && getComputedStyle(cell);
        const control =
          sizer && cellStyle
            ? sizer.getBoundingClientRect().width +
              Number.parseFloat(cellStyle.paddingInlineStart || '0') +
              Number.parseFloat(cellStyle.paddingInlineEnd || '0') +
              Number.parseFloat(cellStyle.borderInlineStartWidth || '0') +
              Number.parseFloat(cellStyle.borderInlineEndWidth || '0')
            : 0;
        return Math.ceil(Math.max(control, Math.min(max, Math.max(min, header, value))));
      });
      setWidths((previous) =>
        previous.length === next.length && previous.every((value, index) => value === next[index])
          ? previous
          : next,
      );
    };
    measureWidths();
    const observer = new ResizeObserver(measureWidths);
    for (const sizer of element.querySelectorAll('[data-slot="quantity-header-sizer"]'))
      observer.observe(sizer);
    return () => observer.disconnect();
  }, [columns, frame, enabled]);
  return widths.length === columns.length ? widths : columns.map(({ min = 96 }) => min);
}
