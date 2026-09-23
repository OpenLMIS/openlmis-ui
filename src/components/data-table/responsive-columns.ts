import type { ColumnVisibilityState } from '@tanstack/react-table';
import { useLayoutEffect, useState } from 'react';

/** Tailwind's container sizes in px, so defaults switch where `@md:`-style classes do. */
const CONTAINER_WIDTHS = {
  sm: 384,
  md: 448,
  lg: 512,
  xl: 576,
  '2xl': 672,
  '3xl': 768,
  '4xl': 896,
  '5xl': 1024,
} as const;

export type ContainerSize = keyof typeof CONTAINER_WIDTHS;

export type ResponsiveColumn = {
  id: string;
  /** The column is hidden by default when the table has less room than this container size. */
  hideBelow?: ContainerSize;
};

/** Width of an element, kept current as it resizes; the sidebar changes it, not just the window. */
export function useElementWidth<T extends HTMLElement>() {
  const [element, setElement] = useState<T | null>(null);
  const [width, setWidth] = useState<number | undefined>(undefined);

  useLayoutEffect(() => {
    if (!element) return;
    setWidth(element.getBoundingClientRect().width);
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(entry.contentRect.width);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [element]);

  return [setElement, width] as const;
}

/** What shows: the user's own choice for a column, otherwise whether there is room for it. */
export function resolveColumnVisibility(
  columns: readonly ResponsiveColumn[],
  choices: ColumnVisibilityState,
  width: number | undefined,
): ColumnVisibilityState {
  // Before the first measurement everything counts as fitting; the layout effect corrects it before paint.
  const available = width ?? Number.POSITIVE_INFINITY;
  return Object.fromEntries(
    columns.map((column) => [
      column.id,
      choices[column.id] ??
        (column.hideBelow ? available >= CONTAINER_WIDTHS[column.hideBelow] : true),
    ]),
  );
}

/** The columns where `next` differs from what is showing, i.e. the ones the user just toggled. */
export function changedColumns(
  showing: ColumnVisibilityState,
  next: ColumnVisibilityState,
): ColumnVisibilityState {
  return Object.fromEntries(
    Object.entries(next).filter(([id, visible]) => showing[id] !== visible),
  );
}

/** Visibility that fits the room until the user picks; the caller stores the picks and measures the width. */
export function useColumnVisibility(
  columns: readonly ResponsiveColumn[],
  [choices, setChoices]: readonly [ColumnVisibilityState, (next: ColumnVisibilityState) => void],
  width: number | undefined,
) {
  const visibility = resolveColumnVisibility(columns, choices, width);

  return {
    visibility,
    onVisibilityChange: (next: ColumnVisibilityState) =>
      setChoices({ ...choices, ...changedColumns(visibility, next) }),
    onReset: () => setChoices({}),
  };
}
