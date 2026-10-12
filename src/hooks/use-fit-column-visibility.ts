import type { ColumnVisibilityState } from '@tanstack/react-table';
import { type RefObject, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  changedColumns,
  type ResponsiveColumn,
  resolveColumnVisibility,
} from '@/components/data-table/responsive-columns';

export function useFitColumnVisibility(
  columns: readonly ResponsiveColumn[],
  [choices, setChoices]: readonly [ColumnVisibilityState, (next: ColumnVisibilityState) => void],
  region: RefObject<HTMLDivElement | null>,
  width: number | undefined,
  content: unknown,
  enabled = true,
  frozen = false,
) {
  const [hidden, setHidden] = useState<ColumnVisibilityState>({});
  const requiredWidths = useRef(new Map<string, number>());
  const [, measureAgain] = useState(0);
  const [tableContainer, setContainer] = useState<HTMLElement | null>(null);
  const [tableNode, setTableNode] = useState<HTMLTableElement | null>(null);
  const measuredContent = useRef({ content, enabled });
  const visibility = useMemo(() => {
    const defaults = resolveColumnVisibility(columns, choices, enabled ? undefined : width);
    return enabled ? { ...defaults, ...hidden, ...choices } : defaults;
  }, [columns, choices, enabled, width, hidden]);

  useLayoutEffect(() => {
    const previous = measuredContent.current;
    if (!frozen && (previous.content !== content || previous.enabled !== enabled)) {
      measuredContent.current = { content, enabled };
      requiredWidths.current.clear();
      setHidden({});
      return;
    }
    if (!enabled) return;
    const container =
      region.current?.querySelector<HTMLElement>('[data-slot="table-container"]') ?? null;
    if (container !== tableContainer) setContainer(container);
    const table = container?.querySelector('table') ?? null;
    if (table !== tableNode) setTableNode(table);
    if (frozen || !container?.clientWidth) return;
    const available = container.clientWidth;
    const required = container.scrollWidth;
    if (required > available) {
      const next = columns.find(({ id }) => choices[id] === undefined && visibility[id] !== false);
      if (next) {
        requiredWidths.current.set(next.id, required);
        setHidden((current) => ({ ...current, [next.id]: false }));
      }
    } else {
      const next = columns
        .toReversed()
        .find(
          ({ id }) =>
            choices[id] === undefined &&
            hidden[id] === false &&
            available >= (requiredWidths.current.get(id) ?? Number.POSITIVE_INFINITY),
        );
      if (next) setHidden((current) => ({ ...current, [next.id]: true }));
    }
  });

  useLayoutEffect(() => {
    if (!enabled || !tableContainer) return;
    const container = tableContainer;
    const table = tableNode;
    const dimensions = () =>
      `${container.clientWidth}/${container.scrollWidth}/${table?.clientHeight}`;
    let previous = dimensions();
    const observer = new ResizeObserver(() => {
      const next = dimensions();
      if (next !== previous) {
        previous = next;
        measureAgain((current) => current + 1);
      }
    });
    const mutations = new MutationObserver(() => {
      const nextTable = container.querySelector('table');
      if (nextTable !== table) {
        setTableNode(nextTable);
        measureAgain((current) => current + 1);
      }
    });
    mutations.observe(container, { childList: true, subtree: true });
    observer.observe(container);
    if (table) observer.observe(table);
    return () => {
      observer.disconnect();
      mutations.disconnect();
    };
  }, [enabled, tableContainer, tableNode]);

  return {
    visibility,
    onVisibilityChange: (next: ColumnVisibilityState) =>
      setChoices({ ...choices, ...changedColumns(visibility, next) }),
    onReset: () => {
      requiredWidths.current.clear();
      setHidden({});
      setChoices({});
    },
  };
}
