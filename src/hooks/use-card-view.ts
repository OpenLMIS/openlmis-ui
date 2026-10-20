import { useState } from 'react';
import { z } from 'zod';
import {
  CONTAINER_WIDTHS,
  type ResponsiveColumn,
  useColumnVisibility,
  useElementWidth,
} from '@/components/data-table/responsive-columns';
import { useStoredState } from '@/hooks/use-stored-state';

const choicesSchema = z.record(z.string(), z.boolean());

export function useCardLayout<T extends HTMLElement>() {
  const [measure, width] = useElementWidth<T>();
  const cards = width !== undefined && width < CONTAINER_WIDTHS['2xl'];
  return { measure, width, cards };
}

export function useCardView<T extends HTMLElement = HTMLDivElement>(
  columns: readonly ResponsiveColumn[],
  storageKey: string,
) {
  const { measure, width, cards } = useCardLayout<T>();
  const columnView = useColumnVisibility(
    columns,
    useStoredState(storageKey, choicesSchema, {}),
    cards ? undefined : width,
  );
  const layout = cards ? 'cards' : 'table';
  return { measure, cards, columnView, layout } as const;
}

const DIALOG_WIDTHS_REM = { lg: 32, table: 36, xl: 48 } as const;

type CardDialogSize = keyof typeof DIALOG_WIDTHS_REM;

export const isDialogCards = (width: number | undefined, size: CardDialogSize, rem = 16) =>
  width !== undefined &&
  width < Math.min(CONTAINER_WIDTHS['2xl'], (DIALOG_WIDTHS_REM[size] - 2) * rem - 1);

export function useDialogCardLayout(size: CardDialogSize) {
  const [measure, width] = useElementWidth<HTMLDivElement>();
  const [rem] = useState(
    () => Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16,
  );
  return { measure, width, cards: isDialogCards(width, size, rem) };
}
