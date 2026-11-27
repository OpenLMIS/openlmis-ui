import { z } from 'zod';
import { BUQ_CATALOG_TABS, type BuqCatalogTab } from '@/features/buq-admin/lib/types';
import {
  type DefaultSort,
  type SearchChange,
  type TableSearch,
  tableSearchSchema,
} from '@/lib/table-search';

export const DEFAULT_BUQ_CATALOG_TAB: BuqCatalogTab = 'remarks';
export const DEFAULT_BUQ_CATALOG_SORT: DefaultSort = { id: 'name', desc: false };

const { page, size, sort, dir } = tableSearchSchema(['name']).shape;
const catalogPage = page.transform((value) => (value === 1 ? undefined : value));
const catalogSize = size.transform((value) => (value === 10 ? undefined : value));
const catalogDir = dir.transform((value) => (value === 'asc' ? undefined : value));
const id = z.guid().transform((value) => value.toLowerCase());

export const buqCatalogSearchSchema = z
  .object({
    tab: z
      .enum(BUQ_CATALOG_TABS)
      .optional()
      .catch(undefined)
      .transform((value) => (value === DEFAULT_BUQ_CATALOG_TAB ? undefined : value)),
    remarksPage: catalogPage,
    remarksSize: catalogSize,
    remarksSort: sort,
    remarksDir: catalogDir,
    sourcesPage: catalogPage,
    sourcesSize: catalogSize,
    sourcesSort: sort,
    sourcesDir: catalogDir,
    edit: z
      .union([z.literal('new'), id])
      .optional()
      .catch(undefined),
    delete: id.optional().catch(undefined),
  })
  .transform((search) => ({
    ...search,
    remarksSort: search.remarksDir ? search.remarksSort : undefined,
    sourcesSort: search.sourcesDir ? search.sourcesSort : undefined,
    delete: search.edit ? undefined : search.delete,
  }));

export type BuqCatalogSearch = z.output<typeof buqCatalogSearchSchema>;

export function buqCatalogTableSearch(search: BuqCatalogSearch, tab: BuqCatalogTab): TableSearch {
  return {
    page: search[`${tab}Page`],
    size: search[`${tab}Size`],
    sort: search[`${tab}Sort`],
    dir: search[`${tab}Dir`],
  };
}

export function changeBuqCatalogSearch(
  tab: BuqCatalogTab,
  updateSearch: SearchChange<BuqCatalogSearch>,
  readSearch: () => BuqCatalogSearch,
): SearchChange<TableSearch> {
  return (update, replace, options) => {
    if (replace) {
      const latest = readSearch();
      if ((latest.tab ?? DEFAULT_BUQ_CATALOG_TAB) !== tab || latest.edit || latest.delete) return;
    }
    updateSearch(
      (previous) => {
        const current = buqCatalogTableSearch(previous, tab);
        const patch = typeof update === 'function' ? update(current) : update;
        const { page, size, sort, dir } = { ...current, ...patch };
        return {
          [`${tab}Page`]: page,
          [`${tab}Size`]: size,
          [`${tab}Sort`]: sort === 'name' ? sort : undefined,
          [`${tab}Dir`]: dir,
        };
      },
      replace,
      options,
    );
  };
}
