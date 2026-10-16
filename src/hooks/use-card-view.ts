import { z } from 'zod';
import {
  CONTAINER_WIDTHS,
  type ResponsiveColumn,
  useColumnVisibility,
  useElementWidth,
} from '@/components/data-table/responsive-columns';
import { useStoredState } from '@/hooks/use-stored-state';

const choicesSchema = z.record(z.string(), z.boolean());

export function useCardView(columns: readonly ResponsiveColumn[], storageKey: string) {
  const [measure, width] = useElementWidth<HTMLDivElement>();
  const cards = width !== undefined && width < CONTAINER_WIDTHS['2xl'];
  const columnView = useColumnVisibility(
    columns,
    useStoredState(storageKey, choicesSchema, {}),
    cards ? undefined : width,
  );
  const layout = cards ? 'cards' : 'table';
  return { measure, cards, columnView, layout } as const;
}
