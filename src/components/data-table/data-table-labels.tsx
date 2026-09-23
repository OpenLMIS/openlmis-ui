import { createContext, type ReactNode, use, useMemo } from 'react';

export type DataTableLabels = {
  search: string;
  clearSearch: string;
  all: string;
  view: string;
  toggleColumns: string;
  resetColumns: string;
  rowsPerPage: string;
  /** The rows on screen out of the total, e.g. "1-10 / 1,211". */
  range: (from: number, to: number, total: number) => string;
  firstPage: string;
  previousPage: string;
  nextPage: string;
  lastPage: string;
  retry: string;
};

export const defaultDataTableLabels: DataTableLabels = {
  search: 'Search...',
  clearSearch: 'Clear Search',
  all: 'All',
  view: 'View',
  toggleColumns: 'Toggle Columns',
  resetColumns: 'Reset Columns',
  rowsPerPage: 'Rows Per Page',
  range: (from, to, total) =>
    `${from.toLocaleString()}-${to.toLocaleString()} / ${total.toLocaleString()}`,
  firstPage: 'First Page',
  previousPage: 'Previous Page',
  nextPage: 'Next Page',
  lastPage: 'Last Page',
  retry: 'Try Again',
};

const DataTableLabelsContext = createContext<DataTableLabels>(defaultDataTableLabels);

type DataTableLabelsProviderProps = {
  labels: Partial<DataTableLabels>;
  children: ReactNode;
};

/** Overrides the built-in English strings, e.g. with translations, for every table below. */
export function DataTableLabelsProvider({ labels, children }: DataTableLabelsProviderProps) {
  const value = useMemo(() => ({ ...defaultDataTableLabels, ...labels }), [labels]);
  return <DataTableLabelsContext value={value}>{children}</DataTableLabelsContext>;
}

export function useDataTableLabels() {
  return use(DataTableLabelsContext);
}
