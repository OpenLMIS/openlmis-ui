import type { ColumnVisibilityState } from '@tanstack/react-table';
import { useSyncExternalStore } from 'react';

/** Tailwind's default breakpoints, so a column hides at the same widths as the layout around it. */
const BREAKPOINTS = { sm: '40rem', md: '48rem', lg: '64rem', xl: '80rem' } as const;

export type Breakpoint = keyof typeof BREAKPOINTS;

export type ResponsiveColumn = {
  id: string;
  /** The column is hidden by default on screens narrower than this. */
  hideBelow?: Breakpoint;
};

type ScreenWidths = Record<Breakpoint, boolean>;

const BREAKPOINT_NAMES = Object.keys(BREAKPOINTS) as Breakpoint[];

let mediaQueries: MediaQueryList[] | undefined;

// Created on first use, not at import, so the module also loads where there is no window.
function getMediaQueries() {
  mediaQueries ??= BREAKPOINT_NAMES.map((name) =>
    window.matchMedia(`(min-width: ${BREAKPOINTS[name]})`),
  );
  return mediaQueries;
}

function subscribe(onChange: () => void) {
  const lists = getMediaQueries();
  for (const list of lists) list.addEventListener('change', onChange);
  return () => {
    for (const list of lists) list.removeEventListener('change', onChange);
  };
}

// A string snapshot keeps useSyncExternalStore from seeing a new value on every read.
function getSnapshot() {
  return getMediaQueries()
    .map((list) => (list.matches ? '1' : '0'))
    .join('');
}

function useScreenWidths(): ScreenWidths {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot);
  return Object.fromEntries(
    BREAKPOINT_NAMES.map((name, index) => [name, snapshot[index] === '1']),
  ) as ScreenWidths;
}

/** What shows: the user's own choice for a column, otherwise whether the screen is wide enough. */
export function resolveColumnVisibility(
  columns: readonly ResponsiveColumn[],
  choices: ColumnVisibilityState,
  screen: ScreenWidths,
): ColumnVisibilityState {
  return Object.fromEntries(
    columns.map((column) => [
      column.id,
      choices[column.id] ?? (column.hideBelow ? screen[column.hideBelow] : true),
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

/** Visibility that follows the screen until the user picks; the caller stores the picks, e.g. in local storage. */
export function useColumnVisibility(
  columns: readonly ResponsiveColumn[],
  [choices, setChoices]: readonly [ColumnVisibilityState, (next: ColumnVisibilityState) => void],
) {
  const visibility = resolveColumnVisibility(columns, choices, useScreenWidths());

  return {
    visibility,
    onVisibilityChange: (next: ColumnVisibilityState) =>
      setChoices({ ...choices, ...changedColumns(visibility, next) }),
    onReset: () => setChoices({}),
  };
}
